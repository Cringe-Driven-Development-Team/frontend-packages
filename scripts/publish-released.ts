import { basename, resolve } from "node:path";
import type { ErrorKind, PackageResult } from "./release-report.ts";

// Пакеты, которые должны публиковаться раньше остальных: Zustand зависит от React.
const publishFirst = ["packages/react", "packages/zustand"];

export type Run = (cmd: string[], cwd: string) => Promise<{ code: number; stderr: string }>;

type IsPublished = (path: string) => Promise<boolean>;

export type Manifest = (path: string) => Promise<{ name: string; version: string }>;

export type Confirm = { attempts: number; delayMs: number; sleep: (ms: number) => Promise<void> };

// Метаданные registry появляются с задержкой: проверяем версию около минуты.
export const CONFIRM_DEFAULT = { attempts: 6, delayMs: 10_000 };

export function orderForPublish(paths: string[]): string[] {
	const first = publishFirst.filter((path) => paths.includes(path));
	return [...first, ...paths.filter((path) => !first.includes(path))];
}

const errorPatterns: [ErrorKind, RegExp, string][] = [
	["auth", /E401|E403|ENEEDAUTH|OIDC/i, "npm отклонил авторизацию"],
	["conflict", /EPUBLISHCONFLICT|E409|cannot publish over/i, "версия уже занята в npm"],
	["network", /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/, "сетевая ошибка при обращении к npm"],
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

const defaultManifest: Manifest = async (path) => ({
	name: `@cdd-team/${basename(path)}`,
	version: "1.0.0",
});

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
	} = {},
): Promise<PackageResult[]> {
	const isPublished = options.isPublished ?? (async () => false);
	const isVisible = options.isVisible ?? options.isPublished ?? (async () => true);
	const manifest = options.manifest ?? defaultManifest;
	const confirm = options.confirm ?? { attempts: 1, delayMs: 0, sleep: async () => {} };
	const results: PackageResult[] = [];
	let stopped = false;

	for (const path of orderForPublish(paths)) {
		const { name, version } = await manifest(path);
		const base = { path, name, version };
		if (stopped) {
			results.push({ ...base, status: "not-attempted" });
			continue;
		}
		if (await isPublished(path)) {
			console.log(`${path}: версия уже опубликована, пропускаем`);
			results.push({ ...base, status: "skipped" });
			continue;
		}
		const { code, stderr } = await run(["npm", "publish", "--access", "public"], path);
		if (code !== 0) {
			console.error(
				`npm publish в ${path} завершилась кодом ${code}; следующие пакеты не опубликованы`,
			);
			results.push({ ...base, status: "failed", ...classifyPublishError(stderr, code) });
			stopped = true;
			continue;
		}
		if (await isConfirmed(path, isVisible, confirm)) {
			results.push({ ...base, status: "published" });
		} else {
			console.error(`${path}: ${name}@${version} не видна в registry, публикация не подтверждена`);
			results.push({ ...base, status: "unconfirmed" });
		}
	}
	return results;
}

// Запускать напрямую (`bun scripts/publish-released.ts`), не через `bun run`: при `[run] bun = true`
// `bun run` подменяет node на bun, а npm publish с OIDC должен выполняться настоящим Node.
const root = resolve(import.meta.dir, "..");

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

const readManifest: Manifest = async (path) =>
	JSON.parse(await Bun.file(resolve(root, path, "package.json")).text());

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
	let results: PackageResult[] = [];
	try {
		results = await publishReleased(paths, runInRepo, {
			isPublished: isPublishedInNpm,
			manifest: readManifest,
			confirm: { ...CONFIRM_DEFAULT, sleep: (ms) => Bun.sleep(ms) },
		});
	} finally {
		if (report) await Bun.write(report, `${JSON.stringify(results, null, "\t")}\n`);
	}
	if (results.some((result) => result.status === "failed" || result.status === "unconfirmed")) {
		process.exit(1);
	}
}
