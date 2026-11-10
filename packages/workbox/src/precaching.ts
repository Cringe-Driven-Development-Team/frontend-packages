/** Комплект ресурсов, который service worker кладёт в собственный кеш при установке. */
export interface PrecacheOptions {
	/** Префикс имён всех версий комплекта: старые версии с ним удаляет {@link Precache.cleanup}. */
	cachePrefix: string;
	/** Версия комплекта; имя кеша — `cachePrefix + version`. */
	version: string;
	/** URL ресурсов; относительные считаются от адреса service worker. */
	urls: readonly string[];
}

/** Операции над комплектом из {@link createPrecache}. */
export interface Precache {
	/** Имя кеша этой версии комплекта. */
	readonly cacheName: string;
	/** Входит ли абсолютный URL в комплект (точное совпадение, с query). */
	has(url: string): boolean;
	/**
	 * Загружает весь комплект из сети в новый кеш. Отклоняется при любой ошибке сети, HTTP или
	 * Cache API; частично заполненный кеш при этом удаляется, прежние версии не трогаются.
	 */
	install(): Promise<void>;
	/** Ответ из своего кеша по точному URL ресурса комплекта или `undefined`. */
	match(url: string): Promise<Response | undefined>;
	/** Удаляет кеши с префиксом комплекта, кроме текущего. Чужие кеши не трогает. */
	cleanup(): Promise<void>;
}

/**
 * Описывает комплект precache. Сам по себе ничего не загружает и обработчиков не ставит.
 * @param options префикс и версия кеша, URL ресурсов
 * @returns операции установки, поиска и очистки
 */
export function createPrecache(options: PrecacheOptions): Precache {
	const { cachePrefix } = options;
	const cacheName = cachePrefix + options.version;
	const urls = options.urls.map((url) => new URL(url, location.href).href);
	const known = new Set(urls);

	return {
		cacheName,
		has: (url) => known.has(url),
		async install() {
			// Сначала весь комплект в память: ошибка любой загрузки не оставит кеш наполовину заполненным
			const responses = await Promise.all(
				urls.map(async (url) => {
					// reload — мимо HTTP-кеша браузера, чтобы не положить устаревшую версию файла
					const response = await fetch(url, { cache: "reload" });
					if (!response.ok) throw new Error(`precache: ${url} ответил ${response.status}`);
					// Непрочитанные тела держат соединения: в воркере Chrome следующие fetch тогда зависают.
					// Новый Response к тому же без флага redirected, который запрещает отдавать его навигации.
					const { status, statusText, headers } = response;
					return new Response(await response.blob(), { status, statusText, headers });
				}),
			);
			try {
				const cache = await caches.open(cacheName);
				await Promise.all(urls.map((url, index) => cache.put(url, responses[index]!)));
			} catch (error) {
				await caches.delete(cacheName);
				throw error;
			}
		},
		async match(url) {
			return known.has(url) ? caches.match(url, { cacheName }) : undefined;
		},
		async cleanup() {
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
					.map((name) => caches.delete(name)),
			);
		},
	};
}
