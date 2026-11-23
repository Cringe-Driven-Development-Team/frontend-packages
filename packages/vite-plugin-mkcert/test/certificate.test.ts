import { expect, test } from "bun:test";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureCertificate } from "../src/certificate.ts";
import { cachedMkcert, fakeDeps, fixture } from "./helpers.ts";

const fixtures = join(import.meta.dir, "fixtures");

/**
 * mkcert, который на `-install` создаёт CA из фикстуры, а на выпуск кладёт готовый сертификат.
 * @returns зависимости и путь к подставному mkcert
 */
async function setup(leaf = "both") {
	const deps = await fakeDeps({
		run: async (_file, args) => {
			if (args[0] === "-install")
				await copyFile(join(fixtures, "ca.pem"), join(deps.dir, "rootCA.pem"));
			if (args[0] === "-cert-file") {
				await copyFile(join(fixtures, `${leaf}.pem`), args[1]!);
				await copyFile(join(fixtures, `${leaf}-key.pem`), args[3]!);
			}
		},
	});
	return { deps, bin: await cachedMkcert(deps) };
}

test("первый запуск: CA устанавливается, сертификат выпускается для hosts", async () => {
	const { deps, bin } = await setup();

	const https = await ensureCertificate(["localhost", "127.0.0.1"], deps);

	expect(deps.runs).toEqual([
		[bin, ["-install"]],
		[
			bin,
			[
				"-cert-file",
				join(deps.dir, "cert.pem"),
				"-key-file",
				join(deps.dir, "key.pem"),
				"localhost",
				"127.0.0.1",
			],
		],
	]);
	expect(https).toEqual({ cert: await fixture("both.pem"), key: await fixture("both-key.pem") });
	expect(deps.downloads).toEqual([]);
});

test("повторный запуск с пригодным кэшем ничего не запускает, порядок hosts не важен", async () => {
	const { deps } = await setup();
	await ensureCertificate(["localhost", "127.0.0.1"], deps);
	deps.runs.length = 0;

	const https = await ensureCertificate(["127.0.0.1", "localhost"], deps);

	expect(deps.runs).toEqual([]);
	expect(https.cert).toBe(await fixture("both.pem"));
});

test("при изменении hosts сертификат перевыпускается", async () => {
	const { deps } = await setup("localhost");
	await ensureCertificate(["localhost"], deps);
	deps.runs.length = 0;

	await ensureCertificate(["localhost", "127.0.0.1"], deps).catch(() => {});

	expect(deps.runs.map(([, args]) => args[0])).toEqual(["-install", "-cert-file"]);
});

test("сертификат, выпущенный другим CA, перевыпускается", async () => {
	const { deps } = await setup();
	await ensureCertificate(["localhost", "127.0.0.1"], deps);
	await copyFile(join(fixtures, "foreign.pem"), join(deps.dir, "cert.pem"));
	deps.runs.length = 0;

	await ensureCertificate(["localhost", "127.0.0.1"], deps);

	expect(deps.runs.map(([, args]) => args[0])).toEqual(["-install", "-cert-file"]);
});

test("выпущенный сертификат не подходит под hosts — ошибка, а не HTTPS с чужими именами", async () => {
	const { deps } = await setup("localhost");

	await expect(ensureCertificate(["localhost", "127.0.0.1"], deps)).rejects.toThrow(/127\.0\.0\.1/);
});

test("ошибка mkcert видна с префиксом плагина", async () => {
	const deps = await fakeDeps({
		run: async () => {
			throw new Error("sudo: a password is required");
		},
	});
	await cachedMkcert(deps);

	await expect(ensureCertificate(["localhost"], deps)).rejects.toThrow(
		/^vite-plugin-mkcert: .*sudo: a password is required/s,
	);
});
