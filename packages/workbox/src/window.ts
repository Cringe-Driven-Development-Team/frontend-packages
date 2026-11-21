/**
 * Регистрирует service worker. Не перезагружает страницу и не проверяет режим сборки: это решает
 * приложение.
 * @param url адрес скрипта service worker
 * @param scope область действия
 * @returns регистрация; `undefined`, если браузер не поддерживает service worker; ошибка регистрации
 * отклоняет Promise
 */
export async function register(
	url: string | URL,
	scope: string,
): Promise<ServiceWorkerRegistration | undefined> {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
	return navigator.serviceWorker.register(url, { scope });
}
