import { describe, expect, test } from "bun:test";
import {
	bumpType,
	cleanItem,
	parseChangelogSection,
	previousVersion,
} from "./release-changelog.ts";

const react = `# Changelog

## [1.3.0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/react-v1.2.1...react-v1.3.0) (2026-10-19)


### Features

* пример refs в playground @cdd-team/react ([6fa3b15](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/6fa3b15c9f59f21cb6bb1f31bde9981aa55ad9b4))
* проп ref у DOM-элементов в @cdd-team/react ([013e007](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/013e007e5cb03a6eb2c6d23fecc76b03d1d72d7e))
* хук useImperativeHandle в @cdd-team/react ([3ca2321](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/3ca2321e6dced15c9bf1b6b9023a059da25ec608))
* хук useRef в @cdd-team/react ([46da710](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/46da71080a0468e5e1511d6eafd00f8978f37ab4))

## [1.2.1](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/react-v1.2.0...react-v1.2.1) (2026-10-17)


### Bug Fixes

* README пакета react — установка и минимальный пример ([a7f63a9](https://github.com/x/commit/a7f63a9))
`;

const zustand = `# Changelog

## [1.0.2](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/zustand-v1.0.1...zustand-v1.0.2) (2026-10-19)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @cdd-team/react bumped from ^1.2.1 to ^1.3.0
  * peerDependencies
    * @cdd-team/react bumped from ^1.2.1 to ^1.3.0

## [1.0.1](https://github.com/x/compare/zustand-v1.0.0...zustand-v1.0.1) (2026-10-17)
`;

describe("parseChangelogSection", () => {
	test("пункты Features из секции версии", () => {
		const section = parseChangelogSection(react, "1.3.0");

		expect(section?.items).toHaveLength(4);
		expect(section?.items[0]).toBe("пример refs в playground @cdd-team/react");
		expect(section?.breaking).toEqual([]);
	});

	test("секция Bug Fixes другой версии не смешивается", () => {
		expect(parseChangelogSection(react, "1.2.1")?.items).toEqual([
			"README пакета react — установка и минимальный пример",
		]);
	});

	test("зависимый выпуск: только Dependencies", () => {
		const section = parseChangelogSection(zustand, "1.0.2");

		expect(section?.items).toEqual([]);
		expect(section?.dependencies).toEqual([{ name: "@cdd-team/react", range: "^1.3.0" }]);
	});

	test("peer важнее dev при расхождении", () => {
		const text = `## [1.0.3](x) (2026-10-20)

### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * @cdd-team/react bumped from ^1.3.0 to ^1.4.0
  * devDependencies
    * @cdd-team/react bumped from ^1.3.0 to ^1.4.1
`;
		expect(parseChangelogSection(text, "1.0.3")?.dependencies).toEqual([
			{ name: "@cdd-team/react", range: "^1.4.0" },
		]);
	});

	test("breaking changes", () => {
		const text = `## [0.3.0](x) (2026-10-20)


### ⚠ BREAKING CHANGES

* удалён useFoo

### Features

* **openapi:** новый клиент ([abc1234](https://x/commit/abc))
`;
		const section = parseChangelogSection(text, "0.3.0");

		expect(section?.breaking).toEqual(["удалён useFoo"]);
		expect(section?.items).toEqual(["новый клиент"]);
	});

	test("неизвестная версия — null", () => {
		expect(parseChangelogSection(react, "9.9.9")).toBeNull();
	});

	test("заголовок без ссылки", () => {
		expect(
			parseChangelogSection("## 0.1.0 (2026-10-20)\n\n### Features\n\n* старт\n", "0.1.0")?.items,
		).toEqual(["старт"]);
	});
});

describe("cleanItem", () => {
	test("убирает scope и ссылку на коммит", () => {
		expect(cleanItem("* **react:** фикс ([abc1234](https://x/commit/abc))")).toBe("фикс");
	});
});

describe("previousVersion", () => {
	const tags = ["react-v1.2.0", "react-v1.2.1", "react-v1.3.0", "zustand-v1.0.2"];

	test("ближайшая меньшая версия компонента", () => {
		expect(previousVersion(tags, "react", "1.3.0")).toBe("1.2.1");
	});

	test("первый выпуск — null", () => {
		expect(previousVersion(tags, "react", "1.2.0")).toBeNull();
	});

	test("игнорирует пререлизы и чужие компоненты", () => {
		expect(
			previousVersion(
				["react-v2.0.0-rc.1", "react-native-v9.0.0", "react-v1.0.0"],
				"react",
				"2.0.0",
			),
		).toBe("1.0.0");
	});

	test("сравнение численное", () => {
		expect(previousVersion(["react-v1.9.0", "react-v1.10.0"], "react", "1.11.0")).toBe("1.10.0");
	});
});

describe("bumpType", () => {
	test("тип изменения версии", () => {
		expect(bumpType("1.2.1", "1.3.0")).toBe("minor");
		expect(bumpType("1.0.1", "1.0.2")).toBe("patch");
		expect(bumpType("0.2.1", "1.0.0")).toBe("major");
	});
});
