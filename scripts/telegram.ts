// Отправка карточки выпуска через Telegram Bot API.
import type { Card } from "./release-card.ts";

export type TelegramConfig = { token: string; chatId: string; threadId: string };

export type SendResult = { ok: true } | { ok: false; error: string };

const RETRY_DELAY_MS = 2000;

type TelegramResponse = { description?: string; parameters?: { retry_after?: number } };

export async function sendCard(
	card: Card,
	config: TelegramConfig,
	deps: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; attempts?: number } = {},
): Promise<SendResult> {
	const fetchFn = deps.fetch ?? fetch;
	const sleep = deps.sleep ?? ((ms: number) => Bun.sleep(ms));
	const attempts = deps.attempts ?? 3;
	const body = JSON.stringify({
		chat_id: config.chatId,
		message_thread_id: Number(config.threadId),
		text: card.text,
		parse_mode: "HTML",
		link_preview_options: { is_disabled: true },
		reply_markup: { inline_keyboard: card.keyboard },
	});
	// Токен входит в URL: его нельзя выводить ни в каком сообщении об ошибке.
	const hide = (text: string) => text.replaceAll(config.token, "***");
	let error = "";

	for (let attempt = 1; attempt <= attempts; attempt++) {
		let delay = RETRY_DELAY_MS;
		try {
			const response = await fetchFn(`https://api.telegram.org/bot${config.token}/sendMessage`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
			});
			if (response.ok) return { ok: true };
			const data = (await response.json().catch(() => ({}))) as TelegramResponse;
			error = hide(`${response.status}: ${data.description ?? response.statusText}`);
			if (response.status !== 429 && response.status < 500) return { ok: false, error };
			if (data.parameters?.retry_after) delay = data.parameters.retry_after * 1000;
		} catch (cause) {
			error = hide(cause instanceof Error ? cause.message : String(cause));
		}
		if (attempt < attempts) await sleep(delay);
	}
	return { ok: false, error };
}
