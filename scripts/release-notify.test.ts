import { describe, expect, test } from "bun:test";
import type { Card } from "./release-card.ts";
import { type NotifyEnv, type NotifyIo, notify } from "./release-notify.ts";
import type { PackageResult } from "./release-report.ts";

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
	reportFile: "release-report.json",
};

function fakeIo(report: PackageResult[], inNpm: boolean | null) {
	const sent: Card[] = [];
	const files: Record<string, string> = {
		"release-report.json": JSON.stringify(report),
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

const unconfirmed: PackageResult[] = [
	{ path: "packages/react", name: "@cdd-team/react", version: "1.4.0", status: "unconfirmed" },
];

describe("notify", () => {
	test("неподтверждённая версия, которая уже есть в npm, показывается опубликованной", async () => {
		const { io, sent } = fakeIo(unconfirmed, true);

		expect(await notify(env, io)).toBe(0);

		expect(sent[0]?.text).toStartWith("✅ <b>Библиотеки опубликованы</b>");
	});

	test("неподтверждённая версия, которой всё ещё нет в npm, остаётся неподтверждённой", async () => {
		const { io, sent } = fakeIo(unconfirmed, false);

		await notify(env, io);

		expect(sent[0]?.text).toContain("Публикация не подтверждена");
	});
});
