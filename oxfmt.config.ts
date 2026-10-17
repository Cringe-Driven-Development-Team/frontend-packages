import { defineConfig } from "oxfmt";

export default defineConfig({
	ignorePatterns: ["**/*.md", "**/*.json", "**/*.lock", "**/dist", "**/api/schema.ts"],
	useTabs: true,
});
