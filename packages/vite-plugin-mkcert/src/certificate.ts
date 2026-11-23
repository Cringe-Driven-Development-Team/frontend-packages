import { X509Certificate } from "node:crypto";
import { isIPv6 } from "node:net";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveMkcert } from "./binary.ts";
import type { Deps } from "./deps.ts";

/**
 * Имя в виде для сравнения: IPv6 в SAN Node печатает развёрнутым (`0:0:0:0:0:0:0:1`), в hosts он
 * обычно сжат (`::1`).
 */
const canonical = (host: string) =>
	isIPv6(host) ? new URL(`http://[${host}]`).hostname : host.toLowerCase();

// перевыпуск заранее, а не в день, когда сертификат уже отвергнет браузер
const MIN_VALIDITY_MS = 24 * 60 * 60 * 1000;

/**
 * Сертификат из кэша, если он подходит: имена в SAN совпадают с hosts, срок не истекает, подписан
 * текущим CA из каталога.
 * @returns PEM сертификата и ключа или `null`, если нужен перевыпуск
 */
async function cached(hosts: string[], certFile: string, keyFile: string, caFile: string) {
	try {
		const [cert, key, ca] = await Promise.all(
			[certFile, keyFile, caFile].map((f) => readFile(f, "utf8")),
		);
		const leaf = new X509Certificate(cert!);
		const root = new X509Certificate(ca!);
		const names = new Set(
			(leaf.subjectAltName ?? "")
				.split(", ")
				.map((n) => canonical(n.replace(/^(DNS|IP Address):/, ""))),
		);
		const wanted = new Set(hosts.map(canonical));
		const ok =
			names.size === wanted.size &&
			[...wanted].every((host) => names.has(host)) &&
			leaf.validToDate.getTime() - Date.now() > MIN_VALIDITY_MS &&
			leaf.checkIssued(root) &&
			leaf.verify(root.publicKey);
		return ok ? { cert: cert!, key: key! } : null;
	} catch {
		return null;
	}
}

/**
 * Сертификат и ключ для `server.https`. Пригодный кэш используется как есть; иначе mkcert создаёт
 * (если его нет) и доверяет CA в ОС, где работает Vite, и выпускает сертификат для hosts. Ключ CA
 * (`rootCA-key.pem`) остаётся у mkcert в каталоге и не читается.
 * @param hosts имена и IP сертификата
 * @param deps побочные эффекты
 * @returns PEM сертификата и ключа
 */
export async function ensureCertificate(
	hosts: string[],
	deps: Deps,
): Promise<{ cert: string; key: string }> {
	const certFile = join(deps.dir, "cert.pem");
	const keyFile = join(deps.dir, "key.pem");
	const caFile = join(deps.dir, "rootCA.pem");
	try {
		const reused = await cached(hosts, certFile, keyFile, caFile);
		if (reused) return reused;
		const mkcert = await resolveMkcert(deps);
		await mkdir(deps.dir, { recursive: true });
		deps.log(`CA в ${deps.dir}, выпускаю сертификат для ${hosts.join(", ")}`);
		await deps.run(mkcert, ["-install"]);
		await deps.run(mkcert, ["-cert-file", certFile, "-key-file", keyFile, ...hosts]);
		const issued = await cached(hosts, certFile, keyFile, caFile);
		if (!issued) throw new Error(`${mkcert} выпустил сертификат не для ${hosts.join(", ")}`);
		return issued;
	} catch (error) {
		throw new Error(
			`vite-plugin-mkcert: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		);
	}
}
