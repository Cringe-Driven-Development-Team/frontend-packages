import type { Plugin } from "vite";

// заголовки браузера, нужные BFF для HTML: сессия, тип ответа и признаки CSRF
const REQUEST_HEADERS = ["accept", "cookie", "sec-fetch-site", "user-agent", "x-request-id"];

// длину и сжатие задаёт уже преобразованный HTML, Set-Cookie переносится отдельными заголовками.
// Заголовки соединения относятся к связи с BFF, а не с браузером: в HTTP/2 (Vite по HTTPS без
// server.proxy) setHeader на них бросает ERR_HTTP2_INVALID_CONNECTION_HEADERS
const SKIPPED_RESPONSE_HEADERS = [
	"content-length",
	"content-encoding",
	"set-cookie",
	"connection",
	"keep-alive",
	"proxy-connection",
	"transfer-encoding",
	"upgrade",
];

/**
 * Подходит ли адрес под ключ `server.proxy` — по тем же правилам, что у прокси Vite: ключ с `^` —
 * регулярное выражение, остальные — префикс.
 * @param context ключ `server.proxy`
 * @param url адрес запроса
 * @returns `true`, если запрос уйдёт в прокси
 */
const proxied = (context: string, url: string) =>
	context.startsWith("^") ? new RegExp(context).test(url) : url.startsWith(context);

/**
 * Плагин dev-сервера Vite: запрос страницы (`GET`/`HEAD` с `Accept: text/html`) уходит в BFF, а его
 * HTML Vite пропускает через `transformIndexHtml` — добавляет клиент HMR и преобразования
 * `index.html` других плагинов. Статус и заголовки ответа BFF сохраняются, каждый `Set-Cookie` —
 * отдельным заголовком. Редирект BFF (`3xx`) отдаётся браузеру как есть — с `Location` и `Set-Cookie`,
 * без перехода внутри плагина и без `transformIndexHtml`. Пути из `server.proxy` плагин не трогает: при прямом открытии API браузер
 * тоже шлёт `Accept: text/html`, а ответ должен прийти от прокси без изменений. Ответ BFF не в HTML
 * отдаётся как есть, без `transformIndexHtml`. Остальные запросы обрабатывает Vite.
 * @param target адрес BFF без слеша в конце, например `http://127.0.0.1:3000`
 * @returns плагин Vite, который работает только в `vite serve`
 */
export function bffHtml(target: string): Plugin {
	return {
		name: "bff-html",
		apply: "serve",
		configureServer(server) {
			const proxy = Object.keys(server.config.server.proxy ?? {});
			server.middlewares.use((req, res, next) => {
				const page = req.method === "GET" || req.method === "HEAD";
				if (!page || !req.headers.accept?.includes("text/html")) return next();
				const url = req.originalUrl ?? "/";
				if (proxy.some((context) => proxied(context, req.url ?? url))) return next();
				void (async () => {
					const headers = new Headers();
					for (const name of REQUEST_HEADERS) {
						const value = req.headers[name];
						if (typeof value === "string") headers.set(name, value);
					}
					// редирект BFF (гость на защищённой странице) уходит браузеру как есть: со своими
					// Location и Set-Cookie, без перехода внутри плагина и без transformIndexHtml
					const answer = await fetch(target + url, { headers, redirect: "manual" });
					const redirect = answer.status >= 300 && answer.status < 400;
					const body = redirect ? "" : await answer.text();
					const html =
						!redirect && answer.headers.get("content-type")?.includes("text/html")
							? await server.transformIndexHtml(url, body)
							: body;
					res.statusCode = answer.status;
					for (const [name, value] of answer.headers) {
						if (!SKIPPED_RESPONSE_HEADERS.includes(name)) res.setHeader(name, value);
					}
					const cookies = answer.headers.getSetCookie();
					if (cookies.length > 0) res.setHeader("Set-Cookie", cookies);
					res.end(req.method === "HEAD" ? undefined : html);
				})().catch(next);
			});
		},
	};
}
