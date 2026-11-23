import type { Plugin } from "vite";
import { ensureCertificate } from "./certificate.ts";
import type { Deps } from "./deps.ts";

/** Опции плагина. */
export interface MkcertOptions {
	/** имена и IP сертификата, например `['localhost', '127.0.0.1']` */
	hosts: string[];
}

/**
 * Плагин dev-сервера Vite: задаёт `server.https` сертификатом и ключом, которые выпускает mkcert.
 * Бинарник, CA и сертификат хранятся в `~/.vite-plugin-mkcert`. Ошибка настройки HTTPS
 * останавливает запуск: на HTTP плагин молча не переходит.
 * @param options имена сертификата
 * @param deps побочные эффекты
 * @returns плагин Vite, который работает только в `vite serve`
 */
export function createPlugin(options: MkcertOptions, deps: Deps): Plugin {
	return {
		name: "cdd:mkcert",
		apply: "serve",
		async config() {
			return { server: { https: await ensureCertificate(options.hosts, deps) } };
		},
	};
}
