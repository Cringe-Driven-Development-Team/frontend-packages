import { afterEach, expect, test } from "bun:test";
import { createNavigationHandler } from "../src/navigation.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const navigation = (method = "GET") =>
	({ method, mode: "navigate", url: "https://app.test/" }) as Request;

test("не перехватывает не-навигацию и не-GET", () => {
	const handle = createNavigationHandler(async () => undefined);
	expect(handle({ method: "GET", mode: "cors" } as Request)).toBeUndefined();
	expect(handle(navigation("POST"))).toBeUndefined();
});

test("отдаёт ответ сети как есть, включая HTTP-ошибку", async () => {
	globalThis.fetch = (async () => new Response("nf", { status: 404 })) as unknown as typeof fetch;
	const response = await createNavigationHandler(async () => new Response("offline"))(
		navigation(),
	)!;
	expect(response.status).toBe(404);
});

test("при сетевом отказе отдаёт fallback, без него — исходную ошибку", async () => {
	const failure = new TypeError("offline");
	globalThis.fetch = (async () => {
		throw failure;
	}) as unknown as typeof fetch;
	const offline = await createNavigationHandler(async () => new Response("offline"))(navigation())!;
	expect(await offline.text()).toBe("offline");
	await expect(createNavigationHandler(async () => undefined)(navigation())).rejects.toBe(failure);
});
