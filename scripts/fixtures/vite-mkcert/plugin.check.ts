import { expect, test } from "bun:test";
import { mkcert } from "@cdd-team/vite-plugin-mkcert";
import type { Plugin } from "vite";

test("опубликованный архив: плагин Vite только для dev-сервера", () => {
	const plugin: Plugin = mkcert({ hosts: ["localhost", "127.0.0.1"] });

	expect(plugin.name).toBe("cdd:mkcert");
	expect(plugin.apply).toBe("serve");
	expect(typeof plugin.config).toBe("function");
});
