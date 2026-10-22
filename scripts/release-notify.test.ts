import { describe, expect, test } from "bun:test";
import type { Card } from "./release-card.ts";
import { type NotifyEnv, type NotifyIo, notify } from "./release-notify.ts";
import type { PackageResult } from "./release-report.ts";

const first = "reports/release-report-1/release-report.json";
const second = "reports/release-report-2/release-report.json";

const env: NotifyEnv = {
	paths: ["packages/react"],
	outcomes: {
		install: "success",
		build: "success",
		verify: "success",
		integration: "success",
		node: "success",
		publish: "failure",
	},
	server: "https://github.com",
	repo: "team/frontend-packages",
	runId: "1",
	attempt: "1",
	sha: "abc",
	reportFiles: [first],
};

function fakeIo(reports: Record<string, PackageResult[]>, inNpm: boolean | null) {
	const sent: Card[] = [];
	const files: Record<string, string> = {
		...Object.fromEntries(
			Object.entries(reports).map(([path, report]) => [path, JSON.stringify(report)]),
		),
		"release-please-config.json": JSON.stringify({
			packages: { "packages/react": { component: "react" } },
		}),
		"packages/react/package.json": JSON.stringify({ name: "@cdd-team/react", version: "1.4.0" }),
	};
	const io: NotifyIo = {
		readText: async (path) => files[path] ?? null,
		tags: async () => ["react-v1.3.0"],
		releasePrUrl: async () => null,
		npmHasVersion: async () => inNpm,
		send: async (card) => {
			sent.push(card);
			return { ok: true };
		},
		summary: async () => {},
		log: () => {},
	};
	return { io, sent };
}

const react = (status: PackageResult["status"]): PackageResult[] => [
	{ path: "packages/react", name: "@cdd-team/react", version: "1.4.0", status },
];

describe("notify", () => {
	test("неподтверждённая версия, которая уже есть в npm, показывается опубликованной", async () => {
		const { io, sent } = fakeIo({ [first]: react("unconfirmed") }, true);

		expect(await notify(env, io)).toBe(0);

		expect(sent[0]?.text).toStartWith("✅ <b>Библиотеки опубликованы</b>");
	});

	test("неподтверждённая версия, которой всё ещё нет в npm, остаётся неподтверждённой", async () => {
		const { io, sent } = fakeIo({ [first]: react("unconfirmed") }, false);

		await notify(env, io);

		expect(sent[0]?.text).toContain("Публикация не подтверждена");
	});

	test("публикация первой попытки не теряется за пропуском при перезапуске", async () => {
		const { io, sent } = fakeIo(
			{ [first]: react("unconfirmed"), [second]: react("skipped") },
			true,
		);

		await notify({ ...env, attempt: "2", reportFiles: [first, second] }, io);

		expect(sent[0]?.text).toStartWith("✅ <b>Библиотеки опубликованы</b>");
	});

	test("ссылка ручного повтора ведёт на запуск выпуска без номера попытки", async () => {
		const { io, sent } = fakeIo({ [first]: react("published") }, true);

		await notify({ ...env, runId: "42", attempt: "" }, io);

		expect(sent[0]?.keyboard.flat().map((button) => button.url)).toContain(
			"https://github.com/team/frontend-packages/actions/runs/42",
		);
	});
});
