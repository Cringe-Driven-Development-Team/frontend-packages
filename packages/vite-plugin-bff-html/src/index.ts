import type { Plugin } from "vite";

// заголовки браузера, нужные BFF для HTML: сессия, тип ответа и признаки CSRF
const REQUEST_HEADERS = ["accept", "cookie", "sec-fetch-site", "user-agent", "x-request-id"];

// длину и сжатие задаёт уже преобразованный HTML, Set-Cookie переносится отдельными заголовками
const SKIPPED_RESPONSE_HEADERS = ["content-length", "content-encoding", "set-cookie"];

/**
 * Плагин dev-сервера Vite: запрос страницы (`GET`/`HEAD` с `Accept: text/html`) уходит в BFF, а его
 * HTML Vite пропускает через `transformIndexHtml` — добавляет клиент HMR и преобразования
 * `index.html` других плагинов. Статус и заголовки ответа BFF сохраняются, каждый `Set-Cookie` —
 * отдельным заголовком. Остальные запросы обрабатывает Vite.
 * @param target адрес BFF без слеша в конце, например `http://127.0.0.1:3000`
 * @returns плагин Vite, который работает только в `vite serve`
 */
export function bffHtml(target: string): Plugin {
	return {
		name: "bff-html",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const page = req.method === "GET" || req.method === "HEAD";
				if (!page || !req.headers.accept?.includes("text/html")) return next();
				const url = req.originalUrl ?? "/";
				void (async () => {
					const headers = new Headers();
					for (const name of REQUEST_HEADERS) {
						const value = req.headers[name];
						if (typeof value === "string") headers.set(name, value);
					}
					const answer = await fetch(target + url, { headers });
					const html = await server.transformIndexHtml(url, await answer.text());
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
