import { defineConfig } from "tsdown";

// dist чистит скрипт build: обе конфигурации пишут в один каталог
export default defineConfig([
	{
		entry: {
			precaching: "src/precaching.ts",
			navigation: "src/navigation.ts",
			window: "src/window.ts",
		},
		format: ["esm"],
		dts: true,
		clean: false,
	},
	// Классический скрипт без import/export: @cdd-team/workbox-build встраивает его в sw.js
	{
		entry: { "sw-runtime": "src/sw-runtime.ts" },
		format: ["iife"],
		globalName: "cddWorkbox",
		clean: false,
	},
]);
