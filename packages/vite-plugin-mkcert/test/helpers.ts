import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Deps } from "../src/deps.ts";

export interface FakeDeps extends Deps {
	runs: Array<[string, string[]]>;
	downloads: string[];
}

/**
 * Зависимости без сети и настоящих команд: `run` и `download` записывают вызовы.
 * @returns зависимости во временном каталоге
 */
export async function fakeDeps(overrides: Partial<Deps> = {}): Promise<FakeDeps> {
	const root = await mkdtemp(join(tmpdir(), "vite-plugin-mkcert-"));
	const runs: Array<[string, string[]]> = [];
	const downloads: string[] = [];
	const deps: FakeDeps = {
		dir: join(root, "home"),
		platform: "linux",
		arch: "x64",
		path: "",
		runs,
		downloads,
		run: async () => {},
		download: async () => new Uint8Array(),
		log: () => {},
		...overrides,
	};
	const { run, download } = deps;
	deps.run = (file, args) => {
		runs.push([file, args]);
		return run(file, args);
	};
	deps.download = (url) => {
		downloads.push(url);
		return download(url);
	};
	return deps;
}
