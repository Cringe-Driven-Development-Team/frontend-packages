import { defineConfig } from "tsdown";

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: ["esm"],
	dts: true,
	clean: true,
	// Вторая копия рантайма React сломала бы контекст и хуки: React и clsx ставит потребитель
	deps: { neverBundle: [/^@cdd-team\/react(\/|$)/, "@cdd-team/clsx"] },
});
