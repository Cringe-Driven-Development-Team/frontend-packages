import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateServiceWorker } from "../src/index.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "workbox-build-"));
	await writeFile(join(dir, "index.html"), "<html></html>");
	await writeFile(join(dir, "app.js"), "console.log(1)");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const options = () => ({
	directory: dir,
	files: ["index.html", "app.js"],
	publicPath: "/",
	fallback: "/index.html",
	cacheNamespace: "app",
	output: join(dir, "sw.js"),
});

test("пишет самодостаточный sw.js с конфигом комплекта", async () => {
	const result = await generateServiceWorker(options());
	expect(result.urls).toEqual(["/index.html", "/app.js"]);
	expect(result.cacheName).toMatch(/^app-precache-[\da-f]{16}$/);
	const sw = await readFile(join(dir, "sw.js"), "utf8");
	expect(sw).toContain("cddWorkbox.startPrecacheWorker(");
	expect(sw).toContain(`"cachePrefix":"app-precache-"`);
	expect(sw).not.toMatch(/^\s*import\s/m);
});

test("версия стабильна и меняется вместе с содержимым файла", async () => {
	const first = await generateServiceWorker(options());
	expect((await generateServiceWorker(options())).cacheName).toBe(first.cacheName);
	await writeFile(join(dir, "app.js"), "console.log(2)");
	expect((await generateServiceWorker(options())).cacheName).not.toBe(first.cacheName);
});

test("отклоняет неверные входные данные", async () => {
	const bad = [
		{ cacheNamespace: "" },
		{ cacheNamespace: "a b" },
		{ publicPath: "app/" },
		{ publicPath: "//cdn/" },
		{ files: ["../secret"] },
		{ files: ["https://cdn.test/a.js"] },
		{ files: ["index.html", "index.html"] },
		{ files: ["missing.js", "index.html"] },
		{ fallback: "/offline.html" },
	];
	for (const patch of bad) {
		await expect(generateServiceWorker({ ...options(), ...patch })).rejects.toThrow();
	}
});
