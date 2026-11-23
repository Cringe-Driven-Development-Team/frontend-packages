import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

/** Побочные эффекты плагина: в тестах подменяются, чтобы не трогать сеть и доверенные сертификаты машины. */
export interface Deps {
	/** каталог бинарника, CA и сертификатов */
	dir: string;
	platform: NodeJS.Platform;
	arch: string;
	/** PATH, в котором ищется установленный mkcert */
	path: string;
	/** запускает команду с `CAROOT=dir`; при ненулевом коде бросает ошибку */
	run(file: string, args: string[]): Promise<void>;
	/** тело ответа по адресу; при ошибке HTTP бросает */
	download(url: string): Promise<Uint8Array>;
	log(message: string): void;
}

/**
 * Настоящие зависимости: каталог `~/.vite-plugin-mkcert`, процесс Node и сеть.
 * @returns зависимости для запуска dev-сервера
 */
export function defaultDeps(): Deps {
	const dir = join(homedir(), ".vite-plugin-mkcert");
	return {
		dir,
		platform: process.platform,
		arch: process.arch,
		path: process.env.PATH ?? "",
		run: (file, args) =>
			new Promise((resolve, reject) => {
				// stdin общий с терминалом: `mkcert -install` может спросить пароль sudo
				const child = spawn(file, args, {
					env: { ...process.env, CAROOT: dir },
					stdio: ["inherit", "ignore", "pipe"],
					timeout: 120_000,
				});
				let stderr = "";
				child.stderr.on("data", (chunk) => (stderr += chunk));
				child.on("error", reject);
				child.on("close", (code) =>
					code === 0
						? resolve()
						: reject(new Error(`${file} ${args.join(" ")}: код ${code}\n${stderr.trim()}`)),
				);
			}),
		download: async (url) => {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
			return new Uint8Array(await response.arrayBuffer());
		},
		log: (message) => console.log(`vite-plugin-mkcert: ${message}`),
	};
}
