import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pwa } from "../src/index.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "vite-plugin-pwa-"));
	await writeFile(join(dir, "index.html"), "<html></html>");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const plugin = () =>
	pwa({
		publicPath: "/app/",
		fallback: "/app/index.html",
		cacheNamespace: "app",
		manifest: { name: "App" },
		precache: ["index.html"],
	});

// Хуки вызываются напрямую: поднимать Vite ради трёх функций не нужно
type Hook = (this: unknown, ...args: unknown[]) => unknown;
const call = (hook: unknown, context: unknown, ...args: unknown[]) =>
	(hook as Hook).call(context, ...args);

test("добавляет ссылку на манифест под publicPath", () => {
	expect(call(plugin().transformIndexHtml, undefined)).toEqual([
		{
			tag: "link",
			attrs: { rel: "manifest", href: "/app/manifest.webmanifest" },
			injectTo: "head",
		},
	]);
});

test("эмитит манифест и после записи бандла генерирует sw.js", async () => {
	const emitted: unknown[] = [];
	const instance = plugin();
	call(instance.generateBundle, { emitFile: (file: unknown) => emitted.push(file) });
	expect(emitted).toEqual([
		{ type: "asset", fileName: "manifest.webmanifest", source: `{"name":"App"}` },
	]);
	await call(instance.writeBundle, undefined, { dir });
	expect(await readFile(join(dir, "sw.js"), "utf8")).toContain(`"/app/index.html"`);
});

test("в dev отдаёт манифест, остальные запросы пропускает дальше", () => {
	let middleware: Hook = () => undefined;
	call(plugin().configureServer, undefined, {
		middlewares: { use: (fn: Hook) => (middleware = fn) },
	});
	const headers: Record<string, string> = {};
	let body = "";
	let passed = 0;
	const res = {
		setHeader: (k: string, v: string) => (headers[k] = v),
		end: (b: string) => (body = b),
	};
	middleware({ url: "/app/manifest.webmanifest?v=1" }, res, () => passed++);
	middleware({ url: "/app/other" }, res, () => passed++);
	expect(headers["Content-Type"]).toBe("application/manifest+json");
	expect(body).toBe(`{"name":"App"}`);
	expect(passed).toBe(1);
});
