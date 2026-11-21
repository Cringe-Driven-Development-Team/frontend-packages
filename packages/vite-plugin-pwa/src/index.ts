import { join } from "node:path";
import { generateServiceWorker, type GenerateServiceWorkerOptions } from "@cdd-team/workbox-build";
import type { Plugin } from "vite";

/**
 * Настройки {@link pwa}. `publicPath` — корень PWA на origin приложения, например `/`; он не зависит
 * от `base` Vite: чанки могут идти с CDN, а манифест и `sw.js` — только со своего origin.
 * `fallback` и `cacheNamespace` — как в `@cdd-team/workbox-build`.
 */
export interface PwaOptions extends Pick<
	GenerateServiceWorkerOptions,
	"publicPath" | "fallback" | "cacheNamespace"
> {
	/** Содержимое `manifest.webmanifest`. */
	manifest: Record<string, unknown>;
	/**
	 * Файлы precache относительно каталога сборки. Список явный: манифест, если он нужен офлайн,
	 * перечисляет сам потребитель.
	 */
	precache: readonly string[];
}

const manifestFile = "manifest.webmanifest";

/**
 * Пишет `manifest.webmanifest`, добавляет ссылку на него в HTML и после production-сборки
 * генерирует `sw.js` в каталоге сборки. В dev отдаёт манифест, `sw.js` не создаёт. Регистрирует
 * service worker само приложение (`@cdd-team/workbox/window`).
 * @param options публичный корень, манифест и настройки precache
 * @returns плагин Vite
 */
export function pwa(options: PwaOptions): Plugin {
	const { manifest: manifestData, precache, ...serviceWorker } = options;
	const manifestUrl = options.publicPath + manifestFile;
	const manifest = JSON.stringify(manifestData);

	return {
		name: "cdd-pwa",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (req.url?.split("?")[0] !== manifestUrl) return next();
				res.setHeader("Content-Type", "application/manifest+json");
				res.end(manifest);
			});
		},
		transformIndexHtml: () => [
			{ tag: "link", attrs: { rel: "manifest", href: manifestUrl }, injectTo: "head" },
		],
		generateBundle() {
			this.emitFile({ type: "asset", fileName: manifestFile, source: manifest });
		},
		// После записи бандла в каталоге уже лежат и файлы public, и манифест
		async writeBundle({ dir }) {
			if (!dir) throw new Error("pwa: у сборки нет каталога вывода (build.outDir)");
			await generateServiceWorker({
				...serviceWorker,
				directory: dir,
				files: precache,
				output: join(dir, "sw.js"),
			});
		},
	};
}
