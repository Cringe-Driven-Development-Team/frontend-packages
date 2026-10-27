import { describe, expect, test } from "bun:test";
import { checkManifest, packageNames } from "./verify-packages.ts";

describe("packageNames", () => {
	test("проверяются все семь пакетов, включая плагины, clsx и router", () => {
		expect([...packageNames].sort()).toEqual([
			"clsx",
			"openapi",
			"oxlint-plugin-jsdoc",
			"react",
			"router",
			"vite-plugin-bff-html",
			"zustand",
		]);
	});
});

const expected = { name: "@cdd-team/react", directory: "packages/react" };
const clean = {
	name: "@cdd-team/react",
	version: "1.2.0",
	repository: {
		type: "git",
		url: "git+https://github.com/Cringe-Driven-Development-Team/frontend-packages.git",
		directory: "packages/react",
	},
	publishConfig: { access: "public" },
	dependencies: { left: "^1.0.0" },
};

describe("checkManifest", () => {
	test("чистый манифест не даёт нарушений", () => {
		expect(checkManifest(clean, expected)).toEqual([]);
	});

	test("находит workspace: в любом блоке зависимостей", () => {
		const violations = checkManifest(
			{ ...clean, devDependencies: { "@cdd-team/react": "workspace:*" } },
			expected,
		);

		expect(violations).toHaveLength(1);
		expect(violations[0]).toContain("workspace:");
	});

	test("находит ссылки на старые скоупы", () => {
		const violations = checkManifest(
			{ ...clean, peerDependencies: { "@maninthecoat/react": "^1.2.0" } },
			expected,
		);

		expect(violations.some((v) => v.includes("@maninthecoat"))).toBe(true);
	});

	test("находит неверное имя, repository и отсутствие publishConfig", () => {
		const violations = checkManifest(
			{ name: "react", repository: "https://example.com/x.git" },
			expected,
		);

		expect(violations.some((v) => v.includes("name"))).toBe(true);
		expect(violations.some((v) => v.includes("repository"))).toBe(true);
		expect(violations.some((v) => v.includes("publishConfig"))).toBe(true);
	});
});
