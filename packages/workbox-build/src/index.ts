import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Настройки {@link generateServiceWorker}. */
export interface GenerateServiceWorkerOptions {
	/** Каталог с файлами комплекта, обычно каталог сборки. */
	directory: string;
	/** Пути файлов комплекта относительно `directory`, без glob. */
	files: readonly string[];
	/** Публичный корень, под которым файлы доступны с origin приложения, например `/`. */
	publicPath: string;
	/** URL офлайн-страницы для навигации без сети; должен входить в комплект. */
	fallback: string;
	/** Пространство имён кешей приложения: латиница, цифры, `-` и `_`. */
	cacheNamespace: string;
	/** Путь итогового `sw.js`. */
	output: string;
}

/** Результат {@link generateServiceWorker}. */
export interface GeneratedServiceWorker {
	/** Имя кеша этой версии комплекта. */
	cacheName: string;
	/** URL комплекта в порядке `files`. */
	urls: string[];
}

const externalUrl = /^([a-z][a-z\d+.-]*:|\/\/)/i;

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

/**
 * Пишет один классический `sw.js` без импортов: runtime `@cdd-team/workbox`, precache явного
 * списка файлов и офлайн-fallback навигации. Версия кеша зависит только от содержимого файлов, их
 * URL, настроек и runtime: одинаковые входы дают одинаковый файл.
 * @param options каталог и список файлов, публичный корень, fallback, пространство имён и выход
 * @returns имя кеша и URL комплекта; ошибка входных данных отклоняет Promise
 */
export async function generateServiceWorker(
	options: GenerateServiceWorkerOptions,
): Promise<GeneratedServiceWorker> {
	const { files, publicPath, fallback, cacheNamespace } = options;
	if (!/^[\w-]+$/.test(cacheNamespace)) {
		throw new Error(`cacheNamespace «${cacheNamespace}»: допустимы латиница, цифры, - и _`);
	}
	if (!publicPath.startsWith("/") || publicPath.startsWith("//") || !publicPath.endsWith("/")) {
		throw new Error(`publicPath «${publicPath}» должен быть путём origin вида /app/`);
	}

	const root = resolve(options.directory);
	// URL файла → хеш содержимого, в порядке files
	const entries = new Map<string, string>();
	for (const file of files) {
		if (externalUrl.test(file)) throw new Error(`precache: внешний URL ${file} не поддерживается`);
		const path = resolve(root, file);
		const inside = relative(root, path);
		if (!inside || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
			throw new Error(`precache: ${file} вне каталога ${root}`);
		}
		const url = publicPath + inside.split(sep).join("/");
		if (entries.has(url)) throw new Error(`precache: URL ${url} указан дважды`);
		const content = await readFile(path).catch(() => {
			throw new Error(`precache: нет файла ${file} в ${root}`);
		});
		entries.set(url, sha256(content));
	}
	const urls = [...entries.keys()];
	if (!entries.has(fallback)) {
		throw new Error(
			`fallback ${fallback} не входит в precache: ${urls.join(", ") || "список пуст"}`,
		);
	}

	const runtimePath = fileURLToPath(import.meta.resolve("@cdd-team/workbox/sw-runtime.js"));
	const runtime = await readFile(runtimePath, "utf8");
	const hashes = Object.fromEntries(entries);
	const version = sha256(JSON.stringify({ runtime, hashes, fallback, cacheNamespace })).slice(
		0,
		16,
	);
	const cachePrefix = `${cacheNamespace}-precache-`;
	const config = { cachePrefix, version, urls, fallback };

	await mkdir(dirname(resolve(options.output)), { recursive: true });
	await writeFile(
		options.output,
		`(() => {\n${runtime}\ncddWorkbox.startPrecacheWorker(${JSON.stringify(config)});\n})();\n`,
	);
	return { cacheName: cachePrefix + version, urls };
}
