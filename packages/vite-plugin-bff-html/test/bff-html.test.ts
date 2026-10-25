import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { bffHtml } from "../src/index.ts";

// запросы, которые дошли до BFF: путь и заголовки
const seen: Array<{ url: string; headers: Headers }> = [];

const bff = Bun.serve({
	port: 0,
	fetch(req) {
		const url = new URL(req.url);
		seen.push({ url: url.pathname + url.search, headers: req.headers });
		if (url.pathname === "/private") {
			const redirect = new Headers({ Location: "/login" });
			redirect.append("Set-Cookie", "__Host-session=; Path=/; Max-Age=0");
			redirect.append("Set-Cookie", "flash=login; Path=/");
			return new Response(null, { status: 302, headers: redirect });
		}
		if (url.pathname.startsWith("/api/") || url.pathname === "/data") {
			return Response.json({ path: url.pathname });
		}
		const headers = new Headers({
			"Content-Type": "text/html; charset=utf-8",
			"X-Bff": "1",
			"Keep-Alive": "timeout=99",
			TE: "gzip",
			Trailer: "X-Checksum",
			Connection: "keep-alive, X-Hop",
			"X-Hop": "1",
		});
		headers.append("Set-Cookie", "__Host-session=abc; Path=/; Secure; HttpOnly");
		headers.append("Set-Cookie", "other=1; Path=/");
		const status = url.pathname === "/missing" ? 404 : 200;
		const html = `<!doctype html><html><head><title>bff</title></head><body>${url.pathname}</body></html>`;
		return new Response(html, { status, headers });
	},
});

let root: string;
let vite: ViteDevServer;
let base: string;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "vite-plugin-bff-html-"));
	await writeFile(join(root, "main.js"), "export const value = 1;\n");
	vite = await createServer({
		root,
		configFile: false,
		logLevel: "silent",
		server: {
			port: 0,
			host: "127.0.0.1",
			proxy: {
				"/api/trpc": `http://127.0.0.1:${bff.port}`,
				"^/api/v\\d+/": `http://127.0.0.1:${bff.port}`,
			},
		},
		plugins: [bffHtml(`http://127.0.0.1:${bff.port}`)],
	});
	await vite.listen();
	const address = vite.httpServer?.address();
	if (!address || typeof address === "string") throw new Error("Vite не слушает порт");
	base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await vite.close();
	await bff.stop(true);
	await rm(root, { recursive: true, force: true });
});

const page = (path: string, init: RequestInit = {}) =>
	fetch(base + path, {
		...init,
		headers: { Accept: "text/html", ...init.headers },
	});

test("HTML страницы приходит от BFF и проходит через transformIndexHtml", async () => {
	const res = await page("/notebooks/1?tab=cells");
	const html = await res.text();
	expect(res.status).toBe(200);
	expect(html).toContain("<body>/notebooks/1</body>");
	expect(html).toContain("/@vite/client");
	expect(seen.at(-1)?.url).toBe("/notebooks/1?tab=cells");
});

test("статус и заголовки BFF сохраняются, каждый Set-Cookie — отдельным заголовком", async () => {
	const res = await page("/missing");
	expect(res.status).toBe(404);
	expect(res.headers.get("x-bff")).toBe("1");
	expect(res.headers.getSetCookie()).toEqual([
		"__Host-session=abc; Path=/; Secure; HttpOnly",
		"other=1; Path=/",
	]);
});

test("длина ответа — у преобразованного HTML", async () => {
	const res = await page("/");
	const body = await res.arrayBuffer();
	const length = res.headers.get("content-length");
	if (length !== null) expect(Number(length)).toBe(body.byteLength);
});

test("в BFF уходят сессия, тип ответа и признаки CSRF, остальные заголовки — нет", async () => {
	await page("/", {
		headers: {
			Cookie: "__Host-session=abc",
			"Sec-Fetch-Site": "same-origin",
			"User-Agent": "test-agent",
			"X-Request-Id": "req-1",
			Authorization: "Bearer secret",
		},
	});
	const headers = seen.at(-1)?.headers;
	expect(headers?.get("cookie")).toBe("__Host-session=abc");
	expect(headers?.get("accept")).toBe("text/html");
	expect(headers?.get("sec-fetch-site")).toBe("same-origin");
	expect(headers?.get("user-agent")).toBe("test-agent");
	expect(headers?.get("x-request-id")).toBe("req-1");
	expect(headers?.get("authorization")).toBeNull();
});

test("HEAD отдаёт статус и заголовки без тела", async () => {
	const res = await page("/", { method: "HEAD" });
	expect(res.status).toBe(200);
	expect(res.headers.getSetCookie()).toHaveLength(2);
	expect(await res.text()).toBe("");
});

test("модули и запросы без Accept: text/html обрабатывает Vite", async () => {
	const before = seen.length;
	const module = await fetch(`${base}/main.js`);
	expect(module.status).toBe(200);
	expect(await module.text()).toContain("value");
	const post = await fetch(`${base}/`, { method: "POST", headers: { Accept: "text/html" } });
	await post.arrayBuffer();
	expect(seen.length).toBe(before);
});

test("пути server.proxy с Accept: text/html идут через прокси Vite, JSON без клиента HMR", async () => {
	for (const path of ["/api/trpc/users.me", "/api/v1/users"]) {
		const res = await page(path, { headers: { Authorization: "Bearer token" } });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = await res.text();
		expect(body).not.toContain("/@vite/client");
		expect(JSON.parse(body)).toEqual({ path });
		// плагин не передал бы Authorization: запрос пришёл через прокси
		expect(seen.at(-1)?.headers.get("authorization")).toBe("Bearer token");
	}
});

test("ответ BFF не в HTML отдаётся без transformIndexHtml", async () => {
	const res = await page("/data", { headers: { Authorization: "Bearer token" } });
	expect(res.headers.get("content-type")).toContain("application/json");
	expect(await res.json()).toEqual({ path: "/data" });
	// запрос шёл через плагин, а не прокси: Authorization в BFF не передан
	expect(seen.at(-1)?.headers.get("authorization")).toBeNull();
});

test("заголовки соединения BFF в ответ не переносятся: в HTTP/2 Node на них падает", async () => {
	const res = await page("/");
	expect(res.status).toBe(200);
	expect(res.headers.get("keep-alive") ?? "").not.toContain("timeout=99");
	expect(res.headers.get("te")).toBeNull();
	expect(res.headers.get("trailer")).toBeNull();
	// заголовок, который BFF перечислил в Connection, тоже относится к соединению
	expect(res.headers.get("x-hop")).toBeNull();
	expect(res.headers.get("x-bff")).toBe("1");
});

test("редирект BFF доходит до браузера как есть: статус, Location, оба Set-Cookie", async () => {
	const before = seen.length;
	const res = await page("/private", { redirect: "manual" });
	expect(res.status).toBe(302);
	expect(res.headers.get("location")).toBe("/login");
	expect(res.headers.getSetCookie()).toEqual([
		"__Host-session=; Path=/; Max-Age=0",
		"flash=login; Path=/",
	]);
	expect(await res.text()).not.toContain("/@vite/client");
	// плагин сам за редиректом не ходил: в BFF ушёл один запрос, /login не запрашивался
	expect(seen.slice(before).map((r) => r.url)).toEqual(["/private"]);
});

test("HEAD с редиректом BFF — тот же 302 без тела", async () => {
	const res = await page("/private", { method: "HEAD", redirect: "manual" });
	expect(res.status).toBe(302);
	expect(res.headers.get("location")).toBe("/login");
	expect(await res.text()).toBe("");
});
