import { resolve } from "node:path";

// Пакеты, которые должны публиковаться раньше остальных: Zustand зависит от React.
const publishFirst = ["packages/react", "packages/zustand"];

type Run = (cmd: string[], cwd: string) => Promise<number>;

export function orderForPublish(paths: string[]): string[] {
	const first = publishFirst.filter((path) => paths.includes(path));
	return [...first, ...paths.filter((path) => !first.includes(path))];
}

export async function publishReleased(paths: string[], run: Run): Promise<void> {
	for (const path of orderForPublish(paths)) {
		const code = await run(["npm", "publish", "--access", "public"], path);
		if (code !== 0) {
			throw new Error(
				`npm publish в ${path} завершилась кодом ${code}; следующие пакеты не опубликованы`,
			);
		}
	}
}

const root = resolve(import.meta.dir, "..");

const runInRepo: Run = async (cmd, cwd) => {
	const proc = Bun.spawn(cmd, {
		cwd: resolve(root, cwd),
		stdout: "inherit",
		stderr: "inherit",
	});
	return proc.exited;
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
	publishReleased(paths, runInRepo).catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
