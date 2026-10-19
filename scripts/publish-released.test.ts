import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyPublishError, orderForPublish, publishReleased } from "./publish-released.ts";
import { readReport } from "./release-report.ts";

type Call = { cmd: string[]; cwd: string };

function recorder(failOn?: string) {
	const calls: Call[] = [];
	const run = async (cmd: string[], cwd: string) => {
		calls.push({ cmd, cwd });
		const failed = cwd.endsWith(failOn ?? "\0");
		return { code: failed ? 1 : 0, stderr: failed ? "npm error code E403" : "" };
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

	test("плагин jsdoc независим и публикуется после React и Zustand", () => {
		expect(
			orderForPublish(["packages/oxlint-plugin-jsdoc", "packages/zustand", "packages/react"]),
		).toEqual(["packages/react", "packages/zustand", "packages/oxlint-plugin-jsdoc"]);
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

		const results = await publishReleased(["packages/react", "packages/zustand"], run);

		expect(results.map((result) => result.status)).toEqual(["failed", "not-attempted"]);
		expect(results[0]?.errorKind).toBe("auth");
		expect(calls.map((call) => call.cwd)).toEqual(["packages/react"]);
	});

	test("уже опубликованная версия пропускается, остальные публикуются (повторный запуск после сбоя)", async () => {
		const { calls, run } = recorder();
		const isPublished = async (path: string) => path === "packages/react";

		const results = await publishReleased(["packages/react", "packages/zustand"], run, {
			isPublished,
			isVisible: async () => true,
		});

		expect(calls.map((call) => call.cwd)).toEqual(["packages/zustand"]);
		expect(results.map((result) => result.status)).toEqual(["skipped", "published"]);
	});

	test("успех даёт published для каждого пакета в порядке публикации", async () => {
		const { run } = recorder();

		const results = await publishReleased(["packages/zustand", "packages/react"], run);

		expect(results).toEqual([
			{ path: "packages/react", name: "@cdd-team/react", version: "1.0.0", status: "published" },
			{
				path: "packages/zustand",
				name: "@cdd-team/zustand",
				version: "1.0.0",
				status: "published",
			},
		]);
	});

	test("задержка registry: версия видна с третьей попытки", async () => {
		const { run } = recorder();
		let checks = 0;
		const sleeps: number[] = [];

		const results = await publishReleased(["packages/react"], run, {
			isVisible: async () => ++checks > 2,
			confirm: { attempts: 6, delayMs: 10, sleep: async (ms) => void sleeps.push(ms) },
		});

		expect(results[0]?.status).toBe("published");
		expect(sleeps).toEqual([10, 10]);
	});

	test("не подтверждено после всех попыток, следующий пакет всё равно публикуется", async () => {
		const { calls, run } = recorder();

		const results = await publishReleased(["packages/react", "packages/zustand"], run, {
			isVisible: async (path) => path !== "packages/react",
			confirm: { attempts: 3, delayMs: 0, sleep: async () => {} },
		});

		expect(results.map((result) => result.status)).toEqual(["unconfirmed", "published"]);
		expect(calls).toHaveLength(2);
	});
});

describe("classifyPublishError", () => {
	test("авторизация", () => {
		expect(classifyPublishError("npm error code E403", 1)).toEqual({
			errorKind: "auth",
			reason: "npm отклонил авторизацию",
		});
		expect(classifyPublishError("npm error code ENEEDAUTH", 1).errorKind).toBe("auth");
		expect(classifyPublishError("npm error code E401", 1).errorKind).toBe("auth");
	});

	test("конфликт версии", () => {
		expect(classifyPublishError("npm error code EPUBLISHCONFLICT", 1)).toEqual({
			errorKind: "conflict",
			reason: "версия уже занята в npm",
		});
		expect(
			classifyPublishError("You cannot publish over the previously published versions", 1)
				.errorKind,
		).toBe("conflict");
	});

	test("сеть", () => {
		for (const code of ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]) {
			expect(classifyPublishError(`npm error code ${code}`, 1)).toEqual({
				errorKind: "network",
				reason: "сетевая ошибка при обращении к npm",
			});
		}
	});

	test("неизвестная ошибка не пересказывает stderr", () => {
		expect(classifyPublishError("что-то секретное", 7)).toEqual({
			errorKind: "unknown",
			reason: "npm publish завершилась кодом 7",
		});
	});
});

describe("readReport", () => {
	test("нет файла или не массив — null, массив читается", async () => {
		const dir = await mkdtemp(join(tmpdir(), "report-"));
		const file = join(dir, "report.json");

		expect(await readReport(file)).toBeNull();
		await writeFile(file, "{}");
		expect(await readReport(file)).toBeNull();
		await writeFile(file, '[{"path":"packages/react"}]');
		expect(await readReport(file)).toEqual([{ path: "packages/react" }] as never);
	});
});
