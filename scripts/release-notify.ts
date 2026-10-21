// Итоговое уведомление о выпуске: собирает карточку по фактам запуска и отправляет её в Telegram.
// Запускается в отдельном job `notify` после publish, в том числе при его сбое.
import { resolve } from "node:path";
import { orderForPublish } from "./publish-released.ts";
import {
	type Card,
	type CardContext,
	type CardPackage,
	decideStatus,
	type Outcome,
	renderCard,
	type Stage,
} from "./release-card.ts";
import { bumpType, parseChangelogSection, previousVersion } from "./release-changelog.ts";
import type { PackageResult } from "./release-report.ts";
import { type SendResult, sendCard } from "./telegram.ts";

export type NotifyIo = {
	readText(path: string): Promise<string | null>;
	tags(): Promise<string[]>;
	releasePrUrl(sha: string): Promise<string | null>;
	// null — проверить не удалось; это не значит, что версии нет.
	npmHasVersion(name: string, version: string): Promise<boolean | null>;
	send(card: Card): Promise<SendResult>;
	summary(text: string): Promise<void>;
	log(text: string): void;
};

export type NotifyEnv = {
	paths: string[];
	outcomes: Partial<Record<Stage, string>>;
	server: string;
	repo: string;
	runId: string;
	attempt: string;
	sha: string;
	reportFile: string;
};

const stages: Stage[] = ["install", "build", "verify", "integration", "node", "publish"];

// Пустой outcome значит, что GitHub не передал результат шага (job отменён, runner умер).
// skipped первым не-success значит, что упал шаг без id (checkout, setup-bun); cancelled — не ошибка шага.
export function stageFromOutcomes(outcomes: Partial<Record<Stage, string>>): {
	failedStage: Stage | null;
	stageKnown: boolean;
} {
	for (const stage of stages) {
		const outcome = outcomes[stage];
		if (outcome === "success") continue;
		if (outcome === "failure") return { failedStage: stage, stageKnown: true };
		return { failedStage: null, stageKnown: false };
	}
	return { failedStage: null, stageKnown: true };
}

async function readJson<T>(io: NotifyIo, path: string): Promise<T | null> {
	const text = await io.readText(path);
	if (text === null) return null;
	try {
		return JSON.parse(text) as T;
	} catch {
		return null;
	}
}

async function readReport(io: NotifyIo, file: string): Promise<PackageResult[] | null> {
	const report = await readJson<unknown>(io, file);
	return Array.isArray(report) ? (report as PackageResult[]) : null;
}

async function registryOutcome(io: NotifyIo, name: string, version: string): Promise<Outcome> {
	const found = await io.npmHasVersion(name, version);
	if (found === null) return "unchecked";
	return found ? "available" : "not-visible";
}

// Отчёт мог устареть: registry показывает версию позже окна проверки, а перезапуск одного notify
// берёт отчёт прошлой попытки. Неподтверждённую версию, которая уже видна в npm, считаем опубликованной.
async function reportOutcome(
	io: NotifyIo,
	entry: PackageResult | undefined,
	name: string,
	version: string,
): Promise<Outcome> {
	if (!entry) return "unknown";
	if (entry.status !== "unconfirmed") return entry.status;
	return (await io.npmHasVersion(name, version)) ? "published" : "unconfirmed";
}

export async function notify(env: NotifyEnv, io: NotifyIo): Promise<number> {
	const config = await readJson<{ packages: Record<string, { component: string }> }>(
		io,
		"release-please-config.json",
	);
	// download-artifact видит артефакты прошлых попыток: отчёт верен, только если publish шёл в этой.
	const publishRan = Boolean(env.outcomes.publish) && env.outcomes.publish !== "skipped";
	const report = publishRan ? await readReport(io, env.reportFile) : null;
	const tags = await io.tags();
	const base = `${env.server}/${env.repo}`;
	const packages: CardPackage[] = [];

	for (const path of orderForPublish(env.paths)) {
		const manifest = await readJson<{ name: string; version: string }>(io, `${path}/package.json`);
		const name = manifest?.name ?? path;
		const version = manifest?.version ?? "?";
		const component = config?.packages[path]?.component ?? path.replace(/^.*\//, "");
		const previous = previousVersion(tags, component, version);
		const changelog = await io.readText(`${path}/CHANGELOG.md`);
		const entry = report?.find((result) => result.path === path);
		packages.push({
			name,
			version,
			previous,
			bump: previous ? bumpType(previous, version) : null,
			releaseUrl: `${base}/releases/tag/${component}-v${version}`,
			changelog: changelog === null ? null : parseChangelogSection(changelog, version),
			outcome: report
				? await reportOutcome(io, entry, name, version)
				: await registryOutcome(io, name, version),
			...(entry?.reason ? { reason: entry.reason } : {}),
			...(entry?.errorKind ? { errorKind: entry.errorKind } : {}),
		});
	}

	const pairReleased = env.paths.some((path) => /^packages\/(react|zustand)$/.test(path));
	const versionOf = async (path: string) =>
		(await readJson<{ version: string }>(io, `${path}/package.json`))?.version;
	const react = pairReleased ? await versionOf("packages/react") : undefined;
	const zustand = pairReleased ? await versionOf("packages/zustand") : undefined;

	const ctx: CardContext = {
		repo: env.repo.replace(/^.*\//, ""),
		...stageFromOutcomes(env.outcomes),
		integrationPassed: env.outcomes.integration === "success",
		hasReport: report !== null,
		runUrl: `${base}/actions/runs/${env.runId}/attempts/${env.attempt}`,
		changesUrl: (await io.releasePrUrl(env.sha)) ?? packages[0]?.releaseUrl ?? base,
		// Telegram принимает в кнопках только корректно закодированные URL.
		recoveryUrl: encodeURI(`${base}/blob/${env.sha}/docs/release-runbook.md#5-частичный-выпуск`),
		compatibility: { ...(react ? { react } : {}), ...(zustand ? { zustand } : {}) },
	};

	const status = decideStatus(packages, ctx);
	if (status === null) {
		const message = "Алерт не отправлен: все версии уже были в npm, ошибок нет.";
		io.log(message);
		await io.summary(`## Telegram-карточка выпуска\n\n${message}\n`);
		return 0;
	}

	const card = renderCard(packages, ctx, status);
	const sent = await io.send(card);
	const delivery = sent.ok
		? "Telegram: доставлено"
		: `Telegram: сообщение не доставлено (${sent.error})`;
	io.log(delivery);
	await io.summary(
		`## Telegram-карточка выпуска\n\n\`\`\`html\n${card.text}\n\`\`\`\n\n${delivery}\n`,
	);
	return sent.ok ? 0 : 1;
}

const root = resolve(import.meta.dir, "..");

async function output(cmd: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn(cmd, { cwd: root, stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	return { code: await proc.exited, stdout: stdout.trim(), stderr };
}

function realIo(repo: string): NotifyIo {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;
	const threadId = process.env.TELEGRAM_RELEASES_TOPIC_ID;
	return {
		readText: async (path) => {
			const file = Bun.file(resolve(root, path));
			return (await file.exists()) ? file.text() : null;
		},
		tags: async () => (await output(["git", "tag", "--list"])).stdout.split("\n"),
		releasePrUrl: async (sha) => {
			const { code, stdout } = await output([
				"gh",
				"api",
				`repos/${repo}/commits/${sha}/pulls`,
				"--jq",
				"[.[] | select(.merged_at != null)][0].html_url",
			]);
			return code === 0 && stdout.startsWith("https://") ? stdout : null;
		},
		npmHasVersion: async (name, version) => {
			const { code, stdout, stderr } = await output([
				"npm",
				"view",
				`${name}@${version}`,
				"version",
			]);
			if (code === 0) return stdout === version;
			return stderr.includes("E404") ? false : null;
		},
		send: async (card) =>
			token && chatId && threadId
				? sendCard(card, { token, chatId, threadId })
				: {
						ok: false,
						error: "не заданы TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID/TELEGRAM_RELEASES_TOPIC_ID",
					},
		summary: async (text) => {
			const file = process.env.GITHUB_STEP_SUMMARY;
			if (!file) return console.log(text);
			const previous = await Bun.file(file)
				.text()
				.catch(() => "");
			await Bun.write(file, previous + text);
		},
		log: (text) => console.log(text),
	};
}

if (import.meta.main) {
	const env = process.env;
	let paths: string[] = [];
	try {
		paths = JSON.parse(env.PATHS_RELEASED ?? "[]");
	} catch {
		console.error("PATHS_RELEASED не JSON-массив");
	}
	const outcomes = Object.fromEntries(
		stages.map((stage) => [stage, env[`OUTCOME_${stage.toUpperCase()}`] ?? ""]),
	);
	const repo = env.GITHUB_REPOSITORY ?? "";
	const code = await notify(
		{
			paths,
			outcomes,
			server: env.GITHUB_SERVER_URL ?? "https://github.com",
			repo,
			// При ручном повторе карточка ссылается на запуск выпуска, а не на текущий.
			runId: env.RELEASE_RUN_ID || (env.GITHUB_RUN_ID ?? ""),
			attempt: env.GITHUB_RUN_ATTEMPT ?? "1",
			sha: env.RELEASE_SHA || (env.GITHUB_SHA ?? ""),
			reportFile: env.RELEASE_REPORT ?? "release-report.json",
		},
		realIo(repo),
	);
	process.exit(code);
}
