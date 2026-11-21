// Точка входа классической сборки для @cdd-team/workbox-build; приложению её импортировать не нужно
import { createNavigationHandler } from "./navigation.ts";
import { createPrecache, type PrecacheOptions } from "./precaching.ts";

/** Настройки воркера, которые генератор записывает в `sw.js`. */
export interface PrecacheWorkerOptions extends PrecacheOptions {
	/** URL офлайн-страницы из комплекта. */
	fallback: string;
}

// В lib DOM нет типов ServiceWorkerGlobalScope: описано только то, что используется
interface ExtendableEvent extends Event {
	waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
	readonly request: Request;
	respondWith(response: Promise<Response>): void;
}
declare const self: {
	addEventListener(type: "install" | "activate", listener: (event: ExtendableEvent) => void): void;
	addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
	skipWaiting(): Promise<void>;
	clients: { claim(): Promise<void> };
};

/**
 * Ставит обработчики воркера: установка комплекта и `skipWaiting`, очистка своих старых кешей и
 * `clients.claim`, затем запросы — точный GET к файлу комплекта из кеша, GET-навигация через сеть с
 * офлайн-fallback, остальное — в сеть без перехвата.
 * @param options комплект и офлайн-страница
 */
export function startPrecacheWorker(options: PrecacheWorkerOptions): void {
	const precache = createPrecache(options);
	const fallback = new URL(options.fallback, location.href).href;
	const navigate = createNavigationHandler(() => precache.match(fallback));

	self.addEventListener("install", (event) => {
		event.waitUntil(precache.install().then(() => self.skipWaiting()));
	});
	self.addEventListener("activate", (event) => {
		event.waitUntil(precache.cleanup().then(() => self.clients.claim()));
	});
	self.addEventListener("fetch", (event) => {
		const { request } = event;
		const response =
			request.method === "GET" && precache.has(request.url)
				? precache.match(request.url).then((cached) => cached ?? fetch(request))
				: navigate(request);
		if (response) event.respondWith(response);
	});
}
