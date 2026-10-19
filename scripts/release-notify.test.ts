import { describe, expect, test } from "bun:test";
import type { Card } from "./release-card.ts";
import { type NotifyEnv, type NotifyIo, notify, stageFromOutcomes } from "./release-notify.ts";
import type { PackageResult } from "./release-report.ts";
import type { SendResult } from "./telegram.ts";

const success = {
	install: "success",
	build: "success",
	verify: "success",
	integration: "success",
	node: "success",
	publish: "success",
};

const packages: Record<string, { name: string; version: string; changelog: string }> = {
	"packages/react": {
		name: "@cdd-team/react",
		version: "1.2.1",
		changelog:
			"## [1.2.1](x) (2026-10-20)\n\n### Bug Fixes\n\n* фикс рендера ([abc1234](https://x))\n",
	},
	"packages/zustand": {
		name: "@cdd-team/zustand",
		version: "1.0.1",
		changelog:
			"## [1.0.1](x) (2026-10-20)\n\n### Dependencies\n\n* The following workspace dependencies were updated\n  * peerDependencies\n    * @cdd-team/react bumped from ^1.2.0 to ^1.2.1\n",
	},
	"packages/openapi": {
		name: "@cdd-team/openapi",
		version: "0.2.2",
		changelog: "## [0.2.2](x) (2026-10-20)\n\n### Bug Fixes\n\n* клиент\n",
	},
	"packages/foo": {
		name: "@cdd-team/foo",
		version: "0.1.0",
		changelog: "## [0.1.0](x) (2026-10-20)\n\n### Features\n\n* старт\n",
	},
};

function fakeIo(
	options: {
		report?: PackageResult[];
		npm?: Record<string, boolean | null>;
		send?: SendResult;
	} = {},
) {
	const files = new Map<string, string>();
	const components = Object.fromEntries(
		Object.keys(packages).map((path) => [path, { component: path.replace("packages/", "") }]),
	);
	files.set("release-please-config.json", JSON.stringify({ packages: components }));
	for (const [path, { name, version, changelog }] of Object.entries(packages)) {
		files.set(`${path}/package.json`, JSON.stringify({ name, version }));
		files.set(`${path}/CHANGELOG.md`, changelog);
	}
	if (options.report) files.set("release-report.json", JSON.stringify(options.report));
	const sent: Card[] = [];
	const summaries: string[] = [];
	const npmChecks: string[] = [];
	const io: NotifyIo = {
		readText: async (path) => files.get(path) ?? null,
		tags: async () => ["react-v1.2.0", "zustand-v1.0.0", "openapi-v0.2.1"],
		releasePrUrl: async () => "https://github.com/x/pull/16",
		npmHasVersion: async (name) => {
			npmChecks.push(name);
			return options.npm && name in options.npm ? (options.npm[name] ?? null) : false;
		},
		send: async (card) => {
			sent.push(card);
			return options.send ?? { ok: true };
		},
		summary: async (text) => void summaries.push(text),
		log: () => {},
	};
	return { io, sent, summaries, npmChecks };
}

function env(paths: string[], outcomes: NotifyEnv["outcomes"] = success): NotifyEnv {
	return {
		paths,
		outcomes,
		server: "https://github.com",
		repo: "Cringe-Driven-Development-Team/frontend-packages",
		runId: "77",
		attempt: "1",
		sha: "abc",
		reportFile: "release-report.json",
	};
}

const result = (
	path: string,
	status: PackageResult["status"],
	extra: Partial<PackageResult> = {},
) => {
	const { name, version } = packages[path] ?? { name: "?", version: "?" };
	return { path, name, version, status, ...extra };
};

describe("notify", () => {
	test("полный успех React + Zustand", async () => {
		const { io, sent, summaries } = fakeIo({
			report: [result("packages/react", "published"), result("packages/zustand", "published")],
		});

		const code = await notify(env(["packages/zustand", "packages/react"]), io);

		expect(code).toBe(0);
		expect(sent).toHaveLength(1);
		const text = sent[0]?.text ?? "";
		expect(text).toStartWith("✅ <b>Библиотеки опубликованы</b>\nfrontend-packages · 2 пакета");
		expect(text).toContain("<code>1.2.0 → 1.2.1</code> · patch");
		expect(text).toContain("фикс рендера");
		expect(text).toContain(
			"Обновлён диапазон <code>@cdd-team/react</code> до <code>^1.2.1</code>.",
		);
		expect(text).toContain("React <code>1.2.1</code> + Zustand <code>1.0.1</code>");
		expect(text).toContain(
			'href="https://github.com/Cringe-Driven-Development-Team/frontend-packages/releases/tag/react-v1.2.1"',
		);
		expect(text.indexOf("@cdd-team/react")).toBeLessThan(text.indexOf("@cdd-team/zustand"));
		expect(sent[0]?.keyboard.at(-1)?.map((b) => b.url)).toEqual([
			"https://github.com/x/pull/16",
			"https://github.com/Cringe-Driven-Development-Team/frontend-packages/actions/runs/77/attempts/1",
		]);
		expect(summaries.join("\n")).toContain("Telegram: доставлено");
	});

	test("один OpenAPI без блока совместимости", async () => {
		const { io, sent } = fakeIo({ report: [result("packages/openapi", "published")] });

		await notify(env(["packages/openapi"]), io);

		expect(sent[0]?.text).not.toContain("Совместимость");
		expect(sent[0]?.text).toContain("<code>0.2.1 → 0.2.2</code> · patch");
	});

	test("ошибка до публикации проверяет registry", async () => {
		const { io, sent, npmChecks } = fakeIo();

		await notify(
			env(["packages/react", "packages/zustand"], { install: "success", build: "failure" }),
			io,
		);

		expect(npmChecks).toEqual(["@cdd-team/react", "@cdd-team/zustand"]);
		expect(sent[0]?.text).toStartWith("❌ <b>Выпуск не состоялся</b>");
		expect(sent[0]?.text).toContain("Этап: <b>сборка</b>");
	});

	test("перезапуск: ошибка до публикации, React уже в npm", async () => {
		const { io, sent } = fakeIo({ npm: { "@cdd-team/react": true } });

		await notify(
			env(["packages/react", "packages/zustand"], { ...success, integration: "failure" }),
			io,
		);

		const text = sent[0]?.text ?? "";
		expect(text).toContain("@cdd-team/react · 1.2.1</code></a></b>\nДоступен в npm.");
		expect(text).toContain("@cdd-team/zustand · 1.0.1</code></a></b>\nВ registry не видна");
	});

	test("пустые outcomes без отчёта — результат неизвестен", async () => {
		const { io, sent } = fakeIo({ npm: { "@cdd-team/react": null } });

		await notify(env(["packages/react"], {}), io);

		expect(sent[0]?.text).toStartWith("⚠️ <b>Результат выпуска неизвестен</b>");
		expect(sent[0]?.text).toContain("Состояние в npm не проверено.");
	});

	test("ошибка первого пакета", async () => {
		const { io, sent } = fakeIo({
			report: [
				result("packages/react", "failed", {
					errorKind: "network",
					reason: "сетевая ошибка при обращении к npm",
				}),
				result("packages/zustand", "not-attempted"),
			],
		});

		await notify(
			env(["packages/react", "packages/zustand"], { ...success, publish: "failure" }),
			io,
		);

		expect(sent[0]?.text).toStartWith("❌ <b>Выпуск не состоялся</b>");
		expect(sent[0]?.text).toContain("Не опубликован: сетевая ошибка при обращении к npm.");
	});

	test("частичный сбой", async () => {
		const { io, sent } = fakeIo({
			report: [
				result("packages/react", "published"),
				result("packages/zustand", "failed", {
					errorKind: "auth",
					reason: "npm отклонил авторизацию",
				}),
			],
		});

		await notify(
			env(["packages/react", "packages/zustand"], { ...success, publish: "failure" }),
			io,
		);

		expect(sent[0]?.text).toContain("опубликовано 1 из 2");
	});

	test("неподтверждённый результат", async () => {
		const { io, sent } = fakeIo({ report: [result("packages/react", "unconfirmed")] });

		await notify(env(["packages/react"], { ...success, publish: "failure" }), io);

		expect(sent[0]?.text).toContain("Публикация не подтверждена");
		expect(sent[0]?.text).not.toContain("Выпуск не состоялся");
	});

	test("всё пропущено — алерта нет", async () => {
		const { io, sent, summaries } = fakeIo({ report: [result("packages/react", "skipped")] });

		expect(await notify(env(["packages/react"]), io)).toBe(0);
		expect(sent).toHaveLength(0);
		expect(summaries.join("\n")).toContain(
			"Алерт не отправлен: все версии уже были в npm, ошибок нет",
		);
	});

	test("перезапуск: пропущенный и новый", async () => {
		const { io, sent } = fakeIo({
			report: [result("packages/react", "skipped"), result("packages/zustand", "published")],
		});

		await notify(env(["packages/react", "packages/zustand"]), io);

		expect(sent[0]?.text).toStartWith("✅");
		expect(sent[0]?.text).toContain("Уже был в npm, пропущен.");
	});

	test("Telegram недоступен", async () => {
		const { io, summaries } = fakeIo({
			report: [result("packages/react", "published")],
			send: { ok: false, error: "502: Bad Gateway" },
		});

		expect(await notify(env(["packages/react"]), io)).toBe(1);
		const summary = summaries.join("\n");
		expect(summary).toContain("Telegram: сообщение не доставлено (502: Bad Gateway)");
		expect(summary).toContain("Библиотеки опубликованы");
	});

	test("новый пакет без правок кода", async () => {
		const { io, sent } = fakeIo({ report: [result("packages/foo", "published")] });

		await notify(env(["packages/foo"]), io);

		expect(sent[0]?.text).toContain("<code>@cdd-team/foo</code>");
		expect(sent[0]?.text).toContain("<code>0.1.0</code> · первый выпуск");
	});

	test("путь без записи в отчёте — результат неизвестен", async () => {
		const { io, sent } = fakeIo({ report: [result("packages/react", "published")] });

		await notify(env(["packages/react", "packages/openapi"]), io);

		expect(sent[0]?.text).toContain("Результат неизвестен, проверьте registry.");
	});
});

describe("stageFromOutcomes", () => {
	test("первый не-success шаг", () => {
		expect(stageFromOutcomes({ install: "success", build: "failure", verify: "skipped" })).toEqual({
			failedStage: "build",
			stageKnown: true,
		});
	});

	test("все успешны", () => {
		expect(stageFromOutcomes(success)).toEqual({ failedStage: null, stageKnown: true });
	});

	test("пустые outcomes", () => {
		expect(stageFromOutcomes({})).toEqual({ failedStage: null, stageKnown: false });
	});
});
