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
	test("публикация ранней попытки не теряется за пропуском в поздней", () => {
		expect(mergeReports([[react("unconfirmed")], [react("skipped")]])).toEqual([
			react("unconfirmed"),
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
