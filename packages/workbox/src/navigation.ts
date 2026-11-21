/**
 * Обработчик навигации «сначала сеть». Возвращает ответ сети как есть, включая HTTP-ошибки;
 * `fallback` вызывается только при сетевом отказе. Нет fallback — запрос отклоняется с исходной
 * ошибкой.
 * @param fallback офлайн-страница, например из precache
 * @returns функция: для GET-навигации — Promise ответа, для остальных запросов — `undefined`
 */
export function createNavigationHandler(
	fallback: () => Promise<Response | undefined>,
): (request: Request) => Promise<Response> | undefined {
	return (request) => {
		if (request.method !== "GET" || request.mode !== "navigate") return undefined;
		return fetch(request).catch(async (error: unknown) => {
			const response = await fallback();
			if (response) return response;
			throw error;
		});
	};
}
