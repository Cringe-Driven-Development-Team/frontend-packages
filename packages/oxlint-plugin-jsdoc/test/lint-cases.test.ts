import { describe, expect, test } from "bun:test";
import { lintCases } from "./helpers/lint-cases.ts";

describe("lintCases: сбои не маскируются пустым списком диагностик", () => {
	test("синтаксическая ошибка в кейсе приводит к падению, а не к пустому результату", async () => {
		await expect(lintCases("require-jsdoc", [{ code: "export const = ;" }])).rejects.toThrow(
			"case-0.js",
		);
	});

	test("кейс без диагностик возвращает пустой список", async () => {
		const [diagnostics] = await lintCases("require-jsdoc", [
			{ code: "/** Сумма. */\nexport const answer = 42;" },
		]);

		expect(diagnostics).toEqual([]);
	});
});
