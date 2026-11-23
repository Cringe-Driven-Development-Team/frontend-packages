import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BINARIES } from "../src/binary.ts";
import type { Deps } from "../src/deps.ts";

/** Содержимое «официального» mkcert в тестах: закреплённые хэши подменяются на его SHA-256. */
export const GOOD = new TextEncoder().encode("official mkcert");
const goodHash = createHash("sha256").update(GOOD).digest("hex");
for (const binary of Object.values(BINARIES)) binary.sha256 = goodHash;

export const fixture = (name: string) => Bun.file(join(import.meta.dir, "fixtures", name)).text();

/**
 * Кладёт в каталог deps скачанный ранее mkcert, чтобы поиск не шёл дальше кэша.
 * @returns путь к бинарнику
 */
export async function cachedMkcert(deps: Deps): Promise<string> {
	await mkdir(deps.dir, { recursive: true });
	const path = join(deps.dir, "mkcert");
	await writeFile(path, GOOD);
	return path;
}

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
