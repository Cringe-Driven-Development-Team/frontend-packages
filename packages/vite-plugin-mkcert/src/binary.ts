import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Deps } from "./deps.ts";

const VERSION = "v1.4.4";

/** Адрес и SHA-256 ассета релиза mkcert. */
const asset = (name: string, sha256: string) => ({
	url: `https://github.com/FiloSottile/mkcert/releases/download/${VERSION}/mkcert-${VERSION}-${name}`,
	sha256,
});

/** Официальные сборки FiloSottile/mkcert для окружений команды: ключ — `platform-arch` Node. */
export const BINARIES: Record<string, { url: string; sha256: string }> = {
	"darwin-x64": asset(
		"darwin-amd64",
		"a32dfab51f1845d51e810db8e47dcf0e6b51ae3422426514bf5a2b8302e97d4e",
	),
	"darwin-arm64": asset(
		"darwin-arm64",
		"c8af0df44bce04359794dad8ea28d750437411d632748049d08644ffb66a60c6",
	),
	"linux-x64": asset(
		"linux-amd64",
		"6d31c65b03972c6dc4a14ab429f2928300518b26503f58723e532d1b0a3bbb52",
	),
	"win32-x64": asset(
		"windows-amd64.exe",
		"d2660b50a9ed59eada480750561c96abc2ed4c9a38c6a24d93e30e0977631398",
	),
};

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/**
 * Путь к пригодному mkcert. Порядок: скачанный ранее бинарник с закреплённым хэшем, затем каждый
 * `mkcert` из PATH, который отвечает на `-CAROOT` (одноимённые чужие команды пропускаются),
 * затем загрузка официального бинарника (только для поддерживаемых платформ) с проверкой SHA-256 до первого запуска. PATH процесса не
 * меняется: выбранный mkcert запускается по абсолютному пути.
 * @param deps побочные эффекты
 * @returns абсолютный путь к mkcert
 */
export async function resolveMkcert(deps: Deps): Promise<string> {
	const key = `${deps.platform}-${deps.arch}`;
	const binary = BINARIES[key];
	const name = deps.platform === "win32" ? "mkcert.exe" : "mkcert";
	const cached = join(deps.dir, name);
	if (existsSync(cached) && sha256(await readFile(cached)) === binary?.sha256) return cached;

	for (const dir of deps.path.split(delimiter).filter(Boolean)) {
		const candidate = join(dir, name);
		if (!existsSync(candidate)) continue;
		try {
			await deps.run(candidate, ["-CAROOT"]);
			return candidate;
		} catch {
			deps.log(`${candidate} — не mkcert FiloSottile, пропускаю`);
		}
	}

	if (!binary) {
		throw new Error(
			`нет mkcert в PATH, а скачать его для ${key} нельзя: поддерживаются Windows x64, Linux x64 (WSL) и macOS x64/arm64`,
		);
	}
	deps.log(`скачиваю mkcert ${VERSION}: ${binary.url}`);
	const data = await deps.download(binary.url);
	const actual = sha256(data);
	if (actual !== binary.sha256) {
		throw new Error(`SHA-256 ${binary.url} — ${actual}, ожидался ${binary.sha256}`);
	}
	await mkdir(deps.dir, { recursive: true });
	const temporary = `${cached}.download`;
	try {
		await writeFile(temporary, data, { mode: 0o755 });
		await rename(temporary, cached);
	} finally {
		await rm(temporary, { force: true });
	}
	return cached;
}
