import { resolve } from "node:path";
import type { ErrorKind, PackageResult } from "./release-report.ts";

// Пакеты, которые должны публиковаться раньше остальных: Zustand и Router зависят от React,
// Router ещё и от clsx.
const publishFirst = ["packages/react", "packages/clsx", "packages/zustand", "packages/router"];

export type Run = (cmd: string[], cwd: string) => Promise<{ code: number; stderr: string }>;

type IsPublished = (path: string) => Promise<boolean>;

export type Manifest = (path: string) => Promise<{ name: string; version: string }>;

export type Confirm = { attempts: number; delayMs: number; sleep: (ms: number) => Promise<void> };

// Метаданные registry появляются с задержкой в несколько минут: проверяем версию до 10 минут.
export const CONFIRM_DEFAULT = { attempts: 41, delayMs: 15_000 };

export function orderForPublish(paths: string[]): string[] {
	const first = publishFirst.filter((path) => paths.includes(path));
	return [...first, ...paths.filter((path) => !first.includes(path))];
}

// Порядок важен: публикацию поверх версии npm отклоняет с E403, а сбой обмена OIDC-токена бывает сетевым.
const errorPatterns: [ErrorKind, RegExp, string][] = [
	["conflict", /EPUBLISHCONFLICT|E409|cannot publish over/i, "версия уже занята в npm"],
	["network", /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/, "сетевая ошибка при обращении к npm"],
	["auth", /E401|E403|ENEEDAUTH|OIDC/i, "npm отклонил авторизацию"],
];

// Причина для карточки: только распознанный вид ошибки, без текста stderr.
export function classifyPublishError(
	stderr: string,
	code: number,
): { errorKind: ErrorKind; reason: string } {
	for (const [errorKind, pattern, reason] of errorPatterns) {
		if (pattern.test(stderr)) return { errorKind, reason };
	}
	return { errorKind: "unknown", reason: `npm publish завершилась кодом ${code}` };
}

const root = resolve(import.meta.dir, "..");

const readManifest: Manifest = async (path) =>
	JSON.parse(await Bun.file(resolve(root, path, "package.json")).text());

async function isConfirmed(path: string, isVisible: IsPublished, confirm: Confirm) {
	for (let attempt = 1; attempt <= confirm.attempts; attempt++) {
		if (await isVisible(path)) return true;
		if (attempt < confirm.attempts) await confirm.sleep(confirm.delayMs);
	}
	return false;
}

// Повторный запуск после частичного сбоя не должен публиковать то, что уже в npm.
export async function publishReleased(
	paths: string[],
	run: Run,
	options: {
		isPublished?: IsPublished;
		isVisible?: IsPublished;
		manifest?: Manifest;
		confirm?: Confirm;
		// Отчёт пишется после каждого шага: отменённый job не успевает дойти до конца, а перезапуск по
		// отчёту отличает версию, опубликованную этим выпуском, от уже бывшей в npm.
		save?: (results: PackageResult[]) => Promise<void>;
	} = {},
): Promise<PackageResult[]> {
	const isPublished = options.isPublished ?? (async () => false);
	const isVisible = options.isVisible ?? options.isPublished ?? (async () => true);
	const manifest = options.manifest ?? readManifest;
	const confirm = options.confirm ?? { attempts: 1, delayMs: 0, sleep: async () => {} };
	const save = options.save ?? (async () => {});
	const results: PackageResult[] = [];
	const record = async (result: PackageResult, replace = false) => {
		if (replace) results.pop();
		results.push(result);
		await save(results);
	};
	let stopped = false;

	for (const path of orderForPublish(paths)) {
		const { name, version } = await manifest(path);
		const base = { path, name, version };
		if (stopped) {
			await record({ ...base, status: "not-attempted" });
			continue;
		}
		if (await isPublished(path)) {
			console.log(`${path}: версия уже опубликована, пропускаем`);
			await record({ ...base, status: "skipped" });
			continue;
		}
		const { code, stderr } = await run(["npm", "publish", "--access", "public"], path);
		if (code !== 0) {
			console.error(
				`npm publish в ${path} завершилась кодом ${code}; следующие пакеты не опубликованы`,
			);
			await record({ ...base, status: "failed", ...classifyPublishError(stderr, code) });
			stopped = true;
			continue;
		}
		// npm publish прошёл: до подтверждения версия в отчёте неподтверждённая.
		await record({ ...base, status: "unconfirmed" });
		if (await isConfirmed(path, isVisible, confirm)) {
			await record({ ...base, status: "published" }, true);
		} else {
			console.error(`${path}: ${name}@${version} не видна в registry, публикация не подтверждена`);
		}
	}
	return results;
}

// Запускать напрямую (`bun scripts/publish-released.ts`), не через `bun run`: при `[run] bun = true`
// `bun run` подменяет node на bun, а npm publish с OIDC должен выполняться настоящим Node.

// stderr идёт и в лог job, и в буфер: по нему определяется причина сбоя.
const runInRepo: Run = async (cmd, cwd) => {
	const proc = Bun.spawn(cmd, {
		cwd: resolve(root, cwd),
		stdout: "inherit",
		stderr: "pipe",
	});
	let stderr = "";
	const decoder = new TextDecoder();
	for await (const chunk of proc.stderr) {
		process.stderr.write(chunk);
		stderr += decoder.decode(chunk, { stream: true });
	}
	return { code: await proc.exited, stderr };
};

const isPublishedInNpm: IsPublished = async (path) => {
	const { name, version } = await readManifest(path);
	const proc = Bun.spawn(["npm", "view", `${name}@${version}`, "version"], {
		cwd: root,
		stdout: "pipe",
		stderr: "ignore",
	});
	const output = await new Response(proc.stdout).text();
	await proc.exited;
	return output.trim() === version;
};

if (import.meta.main) {
	const [rawPaths, flag, reportFile] = process.argv.slice(2);
	let paths: unknown;
	try {
		paths = JSON.parse(rawPaths ?? "[]");
	} catch {
		paths = undefined;
	}
	if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) {
		console.error("Ожидается JSON-массив путей, например '[\"packages/react\"]'");
		process.exit(2);
	}
	const report = flag === "--report" ? reportFile : undefined;
	const save = async (results: PackageResult[]) => {
		if (report) await Bun.write(report, `${JSON.stringify(results, null, "\t")}\n`);
	};
	const results = await publishReleased(paths, runInRepo, {
		isPublished: isPublishedInNpm,
		manifest: readManifest,
		confirm: { ...CONFIRM_DEFAULT, sleep: (ms) => Bun.sleep(ms) },
		save,
	});
	if (results.some((result) => result.status === "failed" || result.status === "unconfirmed")) {
		process.exit(1);
	}
}
