import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createPrecache } from "../src/precaching.ts";

// В Bun нет Cache API и location воркера: подменяем ровно то, что вызывает precaching
const stores = new Map<string, Map<string, Response>>();
const fakeCaches = {
	keys: async () => [...stores.keys()],
	delete: async (name: string) => stores.delete(name),
	open: async (name: string) => {
		const store = stores.get(name) ?? new Map<string, Response>();
		stores.set(name, store);
		return { put: async (url: string, response: Response) => void store.set(url, response) };
	},
	match: async (url: string, { cacheName }: { cacheName: string }) =>
		stores.get(cacheName)?.get(url),
};
const realFetch = globalThis.fetch;

beforeEach(() => {
	stores.clear();
	Object.assign(globalThis, { caches: fakeCaches, location: new URL("https://app.test/sw.js") });
});
afterEach(() => {
	globalThis.fetch = realFetch;
});

const mockFetch = (status = 200) => {
	globalThis.fetch = (async (url: string) =>
		new Response(`body ${url}`, { status })) as unknown as typeof fetch;
};

describe("createPrecache", () => {
	test("отклоняет пустой cachePrefix", () => {
		expect(() => createPrecache({ cachePrefix: "", version: "1", urls: [] })).toThrow(
			"cachePrefix",
		);
	});

	test("install кладёт комплект в кеш версии, match отдаёт только свои URL", async () => {
		mockFetch();
		const precache = createPrecache({ cachePrefix: "app-", version: "1", urls: ["/index.html"] });
		await precache.install();
		expect(precache.cacheName).toBe("app-1");
		expect(precache.has("https://app.test/index.html")).toBe(true);
		expect(await (await precache.match("https://app.test/index.html"))?.text()).toBe(
			"body https://app.test/index.html",
		);
		expect(await precache.match("https://app.test/other.js")).toBeUndefined();
	});

	test("install при HTTP-ошибке отклоняется и кеш не создаёт", async () => {
		mockFetch(404);
		const precache = createPrecache({ cachePrefix: "app-", version: "1", urls: ["/a.js"] });
		await expect(precache.install()).rejects.toThrow("404");
		expect(stores.size).toBe(0);
	});

	test("cleanup удаляет только старые версии своего префикса", async () => {
		for (const name of ["app-0", "app-1", "other-0"]) stores.set(name, new Map());
		await createPrecache({ cachePrefix: "app-", version: "1", urls: [] }).cleanup();
		expect([...stores.keys()].sort()).toEqual(["app-1", "other-0"]);
	});
});
