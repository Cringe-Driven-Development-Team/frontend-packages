import { describe, expect, test } from "bun:test";
import { type PackageResult, mergeReports, reportAttempt } from "./release-report.ts";

const react = (status: PackageResult["status"], reason?: string): PackageResult => ({
	path: "packages/react",
	name: "@cdd-team/react",
	version: "1.4.0",
	status,
	...(reason ? { reason } : {}),
});

describe("mergeReports", () => {
	// Поздняя попытка нашла версию в npm, а ранняя — нет: версия появилась за время запуска.
	test.each(["published", "unconfirmed", "failed", "not-attempted"] as const)(
		"%s, а затем пропуск — опубликован",
		(status) => {
			expect(mergeReports([[react(status, "сбой")], [react("skipped")]])).toEqual([
				react("published"),
			]);
		},
	);

	test("конфликт версии после другого статуса — опубликован", () => {
		const conflict = {
			...react("failed", "версия уже занята в npm"),
			errorKind: "conflict" as const,
		};

		expect(mergeReports([[react("published")], [conflict]])).toEqual([react("published")]);
	});

	test("пакет, до которого поздняя попытка не дошла, сохраняет статус ранней", () => {
		expect(mergeReports([[react("published")], [react("not-attempted")]])).toEqual([
			react("published"),
		]);
	});

	test("из нескольких попыток с публикацией берётся последняя", () => {
		expect(mergeReports([[react("failed", "403")], [react("published")]])).toEqual([
			react("published"),
		]);
	});

	test("пакет, пропущенный во всех попытках, остаётся пропущенным", () => {
		expect(mergeReports([[react("skipped")], [react("skipped")]])).toEqual([react("skipped")]);
	});

	test("пакеты из разных попыток собираются вместе", () => {
		const zustand: PackageResult = { ...react("published"), path: "packages/zustand" };

		expect(mergeReports([[react("published")], [zustand]])).toEqual([react("published"), zustand]);
	});
});

describe("reportAttempt", () => {
	test("номер попытки берётся из имени артефакта", () => {
		expect(reportAttempt("reports/release-report-12/release-report.json")).toBe(12);
	});

	test("путь без номера попытки не считается отчётом", () => {
		expect(reportAttempt("reports/release-report/release-report.json")).toBeNull();
	});
});
