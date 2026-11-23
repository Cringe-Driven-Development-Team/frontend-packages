import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { BINARIES, resolveMkcert } from "../src/binary.ts";
import { fakeDeps } from "./helpers.ts";

// подменяем закреплённый хэш: настоящий бинарник mkcert тесты не скачивают
const GOOD = new TextEncoder().encode("official mkcert");
const linux = BINARIES["linux-x64"]!;
const windows = BINARIES["win32-x64"]!;
const goodHash = createHash("sha256").update(GOOD).digest("hex");
for (const binary of Object.values(BINARIES)) binary.sha256 = goodHash;

/**
 * Каталог PATH с файлом команды.
 * @returns путь к созданному файлу
 */
async function command(dir: string, name: string): Promise<string> {
	await mkdir(dir, { recursive: true });
	const path = join(dir, name);
	await writeFile(path, "#!/bin/sh\n");
	return path;
}

test("скачанный бинарник с закреплённым хэшем используется без поиска и загрузки", async () => {
	const deps = await fakeDeps();
	const cached = await command(deps.dir, "mkcert");
	await writeFile(cached, GOOD);

	expect(await resolveMkcert(deps)).toBe(cached);
	expect(deps.runs).toEqual([]);
	expect(deps.downloads).toEqual([]);
});

test("чужой mkcert первым в PATH пропускается, выбирается следующий рабочий", async () => {
	let foreign = "";
	const deps = await fakeDeps({
		run: async (file) => {
			if (file === foreign) throw new Error("unknown flag -CAROOT");
		},
	});
	await command(deps.dir, "mkcert"); // кэш с другим хэшем — не запускается
	const root = dirname(deps.dir);
	foreign = await command(join(root, "npm-bin"), "mkcert");
	const good = await command(join(root, "brew-bin"), "mkcert");
	deps.path = [join(root, "npm-bin"), join(root, "missing"), join(root, "brew-bin")].join(
		delimiter,
	);

	expect(await resolveMkcert(deps)).toBe(good);
	expect(deps.runs).toEqual([
		[foreign, ["-CAROOT"]],
		[good, ["-CAROOT"]],
	]);
	expect(deps.downloads).toEqual([]);
});

test("в Windows кандидат — только mkcert.exe: npm-обёртка mkcert.cmd не запускается", async () => {
	const deps = await fakeDeps({ platform: "win32", download: async () => GOOD });
	const npmBin = join(dirname(deps.dir), "npm");
	await command(npmBin, "mkcert.cmd");
	deps.path = npmBin;

	expect(await resolveMkcert(deps)).toBe(join(deps.dir, "mkcert.exe"));
	expect(deps.runs).toEqual([]);
	expect(deps.downloads).toEqual([windows.url]);
});

test("без кандидатов скачивается официальный бинарник и становится исполняемым", async () => {
	const deps = await fakeDeps({ download: async () => GOOD });

	const path = await resolveMkcert(deps);

	expect(path).toBe(join(deps.dir, "mkcert"));
	expect(deps.downloads).toEqual([linux.url]);
	expect(await readFile(path)).toEqual(Buffer.from(GOOD));
	expect((await stat(path)).mode & 0o100).toBe(0o100);
});

test("бинарник с чужим хэшем не сохраняется и не запускается", async () => {
	const deps = await fakeDeps({ download: async () => new TextEncoder().encode("evil") });

	await expect(resolveMkcert(deps)).rejects.toThrow(/SHA-256/);
	expect(await readdir(deps.dir).catch(() => [])).toEqual([]);
	expect(deps.runs).toEqual([]);
});

test("ошибка загрузки видна с адресом", async () => {
	const deps = await fakeDeps({
		download: async (url) => {
			throw new Error(`${url}: HTTP 404`);
		},
	});

	await expect(resolveMkcert(deps)).rejects.toThrow(/HTTP 404/);
});

test("неподдерживаемая платформа — понятная ошибка до поиска", async () => {
	const deps = await fakeDeps({ arch: "arm64" });

	await expect(resolveMkcert(deps)).rejects.toThrow(/linux-arm64 не поддерживается/);
	expect(deps.downloads).toEqual([]);
});
