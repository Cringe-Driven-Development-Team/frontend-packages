import { expect, test } from "bun:test";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { build, createServer } from "vite";
import { createPlugin as mkcert } from "../src/plugin.ts";
import { cachedMkcert, fakeDeps, fixture } from "./helpers.ts";

const fixtures = join(import.meta.dir, "fixtures");

test("dev-сервер Vite отвечает по HTTPS сертификатом из кэша", async () => {
	const deps = await fakeDeps();
	await mkdir(deps.dir, { recursive: true });
	await copyFile(join(fixtures, "ca.pem"), join(deps.dir, "rootCA.pem"));
	await copyFile(join(fixtures, "both.pem"), join(deps.dir, "cert.pem"));
	await copyFile(join(fixtures, "both-key.pem"), join(deps.dir, "key.pem"));
	const root = join(deps.dir, "..", "app");
	await mkdir(root);
	await Bun.write(join(root, "index.html"), "<!doctype html><title>ok</title>");

	const vite = await createServer({
		root,
		configFile: false,
		logLevel: "silent",
		server: { host: "127.0.0.1", port: 0 },
		plugins: [mkcert({ hosts: ["localhost", "127.0.0.1"] }, deps)],
	});
	try {
		await vite.listen();
		const address = vite.httpServer?.address();
		if (!address || typeof address === "string") throw new Error("Vite не слушает порт");

		const response = await fetch(`https://127.0.0.1:${address.port}/`, {
			tls: { ca: await fixture("ca.pem") },
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("<title>ok</title>");
		expect(deps.runs).toEqual([]);
	} finally {
		await vite.close();
	}
});

test("vite build не трогает mkcert", async () => {
	const deps = await fakeDeps({
		run: async () => {
			throw new Error("mkcert не должен запускаться");
		},
	});
	const root = join(deps.dir, "..", "app");
	await mkdir(root, { recursive: true });
	await Bun.write(join(root, "index.html"), "<!doctype html><title>ok</title>");

	await build({
		root,
		configFile: false,
		logLevel: "silent",
		build: { outDir: join(root, "dist") },
		plugins: [mkcert({ hosts: ["localhost"] }, deps)],
	});

	expect(deps.runs).toEqual([]);
	expect(deps.downloads).toEqual([]);
});

test("ошибка HTTPS останавливает запуск dev-сервера, а не переводит его на HTTP", async () => {
	const deps = await fakeDeps({
		run: async () => {
			throw new Error("mkcert -install: код 1");
		},
	});
	await cachedMkcert(deps);

	await expect(
		createServer({
			configFile: false,
			logLevel: "silent",
			plugins: [mkcert({ hosts: ["localhost"] }, deps)],
		}),
	).rejects.toThrow(/vite-plugin-mkcert: mkcert -install: код 1/);
});
