import { describe, expect, test } from "bun:test";
import { sendCard } from "./telegram.ts";

const config = { token: "123:SECRET", chatId: "-100", threadId: "42" };
const card = { text: "<b>x</b>", keyboard: [[{ text: "npm", url: "https://npm" }]] };

function fakeFetch(responses: (Response | Error)[]) {
	const requests: { url: string; body: Record<string, unknown> }[] = [];
	const fetch = (async (url: string, init: RequestInit) => {
		requests.push({ url, body: JSON.parse(String(init.body)) });
		const next = responses.shift() ?? new Response("{}", { status: 200 });
		if (next instanceof Error) throw next;
		return next;
	}) as unknown as typeof globalThis.fetch;
	return { fetch, requests };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("sendCard", () => {
	test("отправляет в тред с HTML и без превью", async () => {
		const { fetch, requests } = fakeFetch([json(200, { ok: true })]);

		expect(await sendCard(card, config, { fetch })).toEqual({ ok: true });
		expect(requests[0]?.url).toBe("https://api.telegram.org/bot123:SECRET/sendMessage");
		expect(requests[0]?.body).toEqual({
			chat_id: "-100",
			message_thread_id: 42,
			text: "<b>x</b>",
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
			reply_markup: { inline_keyboard: card.keyboard },
		});
	});

	test("повторяет 5xx и 429", async () => {
		const sleeps: number[] = [];
		const { fetch, requests } = fakeFetch([
			json(502, { ok: false, description: "Bad Gateway" }),
			json(429, { ok: false, description: "Too Many Requests", parameters: { retry_after: 1 } }),
			json(200, { ok: true }),
		]);

		const result = await sendCard(card, config, {
			fetch,
			sleep: async (ms) => void sleeps.push(ms),
		});

		expect(result).toEqual({ ok: true });
		expect(requests).toHaveLength(3);
		expect(sleeps).toEqual([2000, 1000]);
	});

	test("400 не повторяется", async () => {
		const { fetch, requests } = fakeFetch([
			json(400, { ok: false, description: "Bad Request: can't parse entities" }),
		]);

		const result = await sendCard(card, config, { fetch, sleep: async () => {} });

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toBe("400: Bad Request: can't parse entities");
		expect(requests).toHaveLength(1);
	});

	test("сетевая ошибка не раскрывает токен", async () => {
		const failure = new Error("connect failed https://api.telegram.org/bot123:SECRET/sendMessage");
		const { fetch, requests } = fakeFetch([failure, failure, failure]);

		const result = await sendCard(card, config, { fetch, sleep: async () => {} });

		expect(result.ok).toBe(false);
		expect(requests).toHaveLength(3);
		expect(JSON.stringify(result)).not.toContain("SECRET");
	});
});
