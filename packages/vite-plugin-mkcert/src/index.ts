import type { Plugin } from "vite";
import { defaultDeps } from "./deps.ts";
import { createPlugin, type MkcertOptions } from "./plugin.ts";

export type { MkcertOptions };

/**
 * Плагин dev-сервера Vite: задаёт `server.https` сертификатом и ключом, которые выпускает mkcert.
 * Бинарник, CA и сертификат хранятся в `~/.vite-plugin-mkcert`. Ошибка настройки HTTPS
 * останавливает запуск: на HTTP плагин молча не переходит.
 * @param options имена сертификата
 * @returns плагин Vite, который работает только в `vite serve`
 */
export function mkcert(options: MkcertOptions): Plugin {
	return createPlugin(options, defaultDeps());
}
