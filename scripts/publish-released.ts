import { resolve } from "node:path";

// Пакеты, которые должны публиковаться раньше остальных: Zustand зависит от React.
const publishFirst = ["packages/react", "packages/zustand"];

type Run = (cmd: string[], cwd: string) => Promise<number>;

export function orderForPublish(paths: string[]): string[] {
	const first = publishFirst.filter((path) => paths.includes(path));
	return [...first, ...paths.filter((path) => !first.includes(path))];
}

type IsPublished = (path: string) => Promise<boolean>;

// Повторный запуск после частичного сбоя не должен публиковать то, что уже в npm.
export async function publishReleased(
	paths: string[],
	run: Run,
	isPublished: IsPublished = async () => false,
): Promise<void> {
	for (const path of orderForPublish(paths)) {
		if (await isPublished(path)) {
			console.log(`${path}: версия уже опубликована, пропускаем`);
			continue;
		}
		const code = await run(["npm", "publish", "--access", "public"], path);
		if (code !== 0) {
			throw new Error(
				`npm publish в ${path} завершилась кодом ${code}; следующие пакеты не опубликованы`,
			);
		}
	}
}

// Запускать напрямую (`bun scripts/publish-released.ts`), не через `bun run`: при `[run] bun = true`
// `bun run` подменяет node на bun, а npm publish с OIDC должен выполняться настоящим Node.
const root = resolve(import.meta.dir, "..");

const runInRepo: Run = async (cmd, cwd) => {
	const proc = Bun.spawn(cmd, {
		cwd: resolve(root, cwd),
		stdout: "inherit",
		stderr: "inherit",
	});
	return proc.exited;
};

const isPublishedInNpm: IsPublished = async (path) => {
	const { name, version } = JSON.parse(await Bun.file(resolve(root, path, "package.json")).text());
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
	let paths: unknown;
	try {
		paths = JSON.parse(process.argv[2] ?? "[]");
	} catch {
		paths = undefined;
	}
	if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) {
		console.error("Ожидается JSON-массив путей, например '[\"packages/react\"]'");
		process.exit(2);
	}
	publishReleased(paths, runInRepo, isPublishedInNpm).catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
