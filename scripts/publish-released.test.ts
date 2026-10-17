import { describe, expect, test } from "bun:test";
import { orderForPublish, publishReleased } from "./publish-released.ts";

type Call = { cmd: string[]; cwd: string };

function recorder(failOn?: string) {
	const calls: Call[] = [];
	const run = async (cmd: string[], cwd: string) => {
		calls.push({ cmd, cwd });
		return cwd.endsWith(failOn ?? "\0") ? 1 : 0;
	};
	return { calls, run };
}

describe("orderForPublish", () => {
	test("React публикуется раньше Zustand, остальные идут после", () => {
		expect(orderForPublish(["packages/zustand", "packages/openapi", "packages/react"])).toEqual([
			"packages/react",
			"packages/zustand",
			"packages/openapi",
		]);
	});

	test("порядок остальных пакетов сохраняется", () => {
		expect(orderForPublish(["packages/b", "packages/a"])).toEqual(["packages/b", "packages/a"]);
	});
});

describe("publishReleased", () => {
	test("пустой список ничего не публикует", async () => {
		const { calls, run } = recorder();

		await publishReleased([], run);

		expect(calls).toEqual([]);
	});

	test("публикует только перечисленные пути, в порядке зависимостей", async () => {
		const { calls, run } = recorder();

		await publishReleased(["packages/zustand", "packages/react"], run);

		expect(calls.map((call) => call.cwd)).toEqual(["packages/react", "packages/zustand"]);
		expect(calls[0]?.cmd).toEqual(["npm", "publish", "--access", "public"]);
	});

	test("только openapi не затрагивает react и zustand", async () => {
		const { calls, run } = recorder();

		await publishReleased(["packages/openapi"], run);

		expect(calls.map((call) => call.cwd)).toEqual(["packages/openapi"]);
	});

	test("ошибка публикации останавливает последующие", async () => {
		const { calls, run } = recorder("packages/react");

		await expect(publishReleased(["packages/react", "packages/zustand"], run)).rejects.toThrow(
			"packages/react",
		);

		expect(calls.map((call) => call.cwd)).toEqual(["packages/react"]);
	});

	test("уже опубликованная версия пропускается, остальные публикуются (повторный запуск после сбоя)", async () => {
		const { calls, run } = recorder();
		const isPublished = async (path: string) => path === "packages/react";

		await publishReleased(["packages/react", "packages/zustand"], run, isPublished);

		expect(calls.map((call) => call.cwd)).toEqual(["packages/zustand"]);
	});
});
