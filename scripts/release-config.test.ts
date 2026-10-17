import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));

const config = readJson("release-please-config.json");
const manifest = readJson(".release-please-manifest.json");

const expected = {
	"packages/react": { component: "react" },
	"packages/zustand": { component: "zustand" },
	"packages/openapi": { component: "openapi" },
};

describe("release-please manifest", () => {
	// Версии не фиксируем: release PR сам поднимает manifest, и CI на нём должен оставаться зелёным.
	test("manifest покрывает те же пакеты и хранит semver-версии", () => {
		expect(Object.keys(manifest).sort()).toEqual(Object.keys(expected).sort());
		for (const version of Object.values(manifest)) {
			expect(version).toMatch(/^\d+\.\d+\.\d+$/);
		}
	});

	test("версия в package.json каждого пакета равна версии в manifest", () => {
		for (const [path, version] of Object.entries(manifest)) {
			expect(readJson(`${path}/package.json`).version).toBe(version as string);
		}
	});
});

describe("release-please config", () => {
	test("пути, компоненты и тип релиза заданы для каждого пакета", () => {
		for (const [path, { component }] of Object.entries(expected)) {
			expect(config.packages[path]).toMatchObject({
				"release-type": "node",
				component,
				"changelog-path": "CHANGELOG.md",
			});
		}
		expect(Object.keys(config.packages).sort()).toEqual(Object.keys(expected).sort());
	});

	test("теги содержат компонент, а изменения идут одним release PR", () => {
		expect(config["include-component-in-tag"]).toBe(true);
		expect(config["separate-pull-requests"]).toBe(false);
	});

	test("node-workspace обновляет peer-зависимости", () => {
		expect(config.plugins).toContainEqual({ type: "node-workspace", updatePeerDependencies: true });
	});

	test("test, docs, chore, refactor скрыты из changelog, feat и fix видны", () => {
		const sections = config["changelog-sections"] as Array<{ type: string; hidden?: boolean }>;
		const byType = new Map(sections.map((s) => [s.type, s]));

		for (const type of ["feat", "fix"]) expect(byType.get(type)?.hidden).not.toBe(true);
		for (const type of ["test", "docs", "chore", "refactor"]) {
			expect(byType.get(type)?.hidden).toBe(true);
		}
	});
});

describe("диапазон React в Zustand", () => {
	test("peer и dev используют один caret-диапазон, который обновит node-workspace", () => {
		const zustand = readJson("packages/zustand/package.json");
		const peer = zustand.peerDependencies["@cdd-team/react"];
		const dev = zustand.devDependencies["@cdd-team/react"];

		expect(peer).toMatch(/^\^\d+\.\d+\.\d+$/);
		expect(dev).toBe(peer);
		expect(zustand.peerDependenciesMeta["@cdd-team/react"]).toEqual({ optional: true });
	});
});
