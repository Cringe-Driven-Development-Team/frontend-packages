import { describe, expect, test } from "bun:test";
import {
	type CardContext,
	type CardPackage,
	decideStatus,
	escapeHtml,
	MAX_TEXT,
	npmUrl,
	renderCard,
	visibleLength,
} from "./release-card.ts";

const releases = "https://github.com/Cringe-Driven-Development-Team/frontend-packages/releases/tag";

function pkg(overrides: Partial<CardPackage> = {}): CardPackage {
	return {
		name: "@cdd-team/react",
		version: "1.2.1",
		previous: "1.2.0",
		bump: "patch",
		releaseUrl: `${releases}/react-v1.2.1`,
		changelog: { items: ["Исправлено обновление компонентов."], breaking: [], dependencies: [] },
		outcome: "published",
		...overrides,
	};
}

const zustand = (overrides: Partial<CardPackage> = {}) =>
	pkg({
		name: "@cdd-team/zustand",
		version: "1.0.1",
		previous: "1.0.0",
		releaseUrl: `${releases}/zustand-v1.0.1`,
		changelog: {
			items: [],
			breaking: [],
			dependencies: [{ name: "@cdd-team/react", range: "^1.2.1" }],
		},
		...overrides,
	});

function ctx(overrides: Partial<CardContext> = {}): CardContext {
	return {
		repo: "frontend-packages",
		failedStage: null,
		stageKnown: true,
		integrationPassed: true,
		hasReport: true,
		runUrl: "https://github.com/x/actions/runs/1/attempts/1",
		changesUrl: "https://github.com/x/pull/16",
		recoveryUrl: "https://github.com/x/blob/sha/docs/release-runbook.md#5-частичный-выпуск",
		compatibility: { react: "1.2.1", zustand: "1.0.1" },
		...overrides,
	};
}

const labels = (keyboard: { text: string }[][]) => keyboard.map((row) => row.map((b) => b.text));

describe("renderCard", () => {
	test("пример успешной карточки", () => {
		const card = renderCard([pkg(), zustand()], ctx(), "success");

		expect(card.text).toBe(
			[
				"✅ <b>Библиотеки опубликованы</b>",
				"frontend-packages · 2 пакета",
				"",
				`<b><a href="${releases}/react-v1.2.1"><code>@cdd-team/react</code></a></b>`,
				"<code>1.2.0 → 1.2.1</code> · patch",
				"Исправлено обновление компонентов.",
				"",
				`<b><a href="${releases}/zustand-v1.0.1"><code>@cdd-team/zustand</code></a></b>`,
				"<code>1.0.0 → 1.0.1</code> · patch",
				"Обновлён диапазон <code>@cdd-team/react</code> до <code>^1.2.1</code>.",
				"",
				"<b>Совместимость</b>",
				"Интеграционные проверки React <code>1.2.1</code> + Zustand <code>1.0.1</code> прошли.",
			].join("\n"),
		);
		expect(labels(card.keyboard)).toEqual([
			["react 1.2.1 в npm", "zustand 1.0.1 в npm"],
			["Изменения", "Проверки"],
		]);
		expect(card.keyboard[0]?.[0]?.url).toBe(npmUrl("@cdd-team/react", "1.2.1"));
		expect(card.keyboard[1]?.map((b) => b.url)).toEqual([ctx().changesUrl, ctx().runUrl]);
	});

	test("пример частичного сбоя", () => {
		const card = renderCard(
			[
				pkg(),
				zustand({ outcome: "failed", errorKind: "auth", reason: "npm отклонил авторизацию" }),
			],
			ctx(),
			"partial",
		);

		expect(card.text).toBe(
			[
				"⚠️ <b>Выпуск завершён частично</b>",
				"frontend-packages · в npm 1 из 2",
				"",
				`✅ <b><a href="${releases}/react-v1.2.1"><code>@cdd-team/react · 1.2.1</code></a></b>`,
				"Доступен в npm.",
				"",
				`❌ <b><a href="${releases}/zustand-v1.0.1"><code>@cdd-team/zustand · 1.0.1</code></a></b>`,
				"Не опубликован: npm отклонил авторизацию.",
				"",
				"<b>Что делать</b>",
				"Проверить Trusted Publisher для <code>@cdd-team/zustand</code> и перезапустить job publish: уже опубликованные версии будут пропущены.",
			].join("\n"),
		);
		expect(labels(card.keyboard)).toEqual([
			["Логи ошибки", "Восстановление выпуска"],
			["react 1.2.1 в npm"],
		]);
		expect(card.keyboard[0]?.map((b) => b.url)).toEqual([ctx().runUrl, ctx().recoveryUrl]);
	});

	test("ошибка до публикации", () => {
		const card = renderCard(
			[pkg({ outcome: "available" }), zustand({ outcome: "not-visible" })],
			ctx({ failedStage: "build", hasReport: false }),
			"failed",
		);

		expect(card.text).toStartWith("❌ <b>Выпуск не состоялся</b>");
		expect(card.text).toContain("Этап: <b>сборка</b>");
		expect(card.text).toContain("Доступен в npm.");
		expect(card.text).toContain("В registry не видна");
		expect(card.text).not.toContain("отсутств");
		expect(card.text).not.toContain("Совместимость");
		expect(labels(card.keyboard)).toEqual([
			["Логи ошибки", "Восстановление выпуска"],
			["react 1.2.1 в npm"],
		]);
	});

	test("все версии уже были в npm при ошибке до публикации", () => {
		const card = renderCard(
			[pkg({ outcome: "available" })],
			ctx({ failedStage: "integration", hasReport: false }),
			"failed",
		);

		expect(card.text).toContain("Этап: <b>интеграционные проверки</b>");
		expect(card.text).toContain("Все версии уже были в npm.");
	});

	test("неизвестный результат", () => {
		const card = renderCard(
			[pkg({ outcome: "unchecked" })],
			ctx({ stageKnown: false, hasReport: false }),
			"unknown",
		);

		expect(card.text).toStartWith("⚠️ <b>Результат выпуска неизвестен</b>");
		expect(card.text).toContain("Состояние в npm не проверено.");
	});

	test("skipped показан как пропущенный", () => {
		const card = renderCard([pkg({ outcome: "skipped" }), zustand()], ctx(), "success");

		expect(card.text).toContain("↩️ <b><a");
		expect(card.text).toContain("Уже был в npm, пропущен.");
		expect(labels(card.keyboard)[0]).toEqual(["react 1.2.1 в npm", "zustand 1.0.1 в npm"]);
	});

	test("unconfirmed без npm-кнопки", () => {
		const card = renderCard([pkg({ outcome: "unconfirmed" }), zustand()], ctx(), "partial");

		expect(card.text).toContain("Публикация не подтверждена");
		expect(card.text).toContain("<code>npm view @cdd-team/react@1.2.1</code>");
		expect(labels(card.keyboard)).toEqual([
			["Логи ошибки", "Восстановление выпуска"],
			["zustand 1.0.1 в npm"],
		]);
	});

	test("миграция в 0.x по секции breaking", () => {
		const card = renderCard(
			[
				pkg({
					name: "@cdd-team/openapi",
					version: "0.3.0",
					previous: "0.2.1",
					bump: "minor",
					changelog: { items: ["новый клиент"], breaking: ["удалён useFoo"], dependencies: [] },
				}),
			],
			ctx(),
			"success",
		);

		expect(card.text).toContain("⚠️ <b>Требуется миграция</b>");
		expect(card.text).toContain("<code>@cdd-team/openapi</code>: удалён useFoo");
		expect(card.text).toContain("Изучите breaking changes по");
	});

	test("major без breaking не требует миграции", () => {
		const card = renderCard([pkg({ version: "2.0.0", bump: "major" })], ctx(), "success");

		expect(card.text).not.toContain("миграция");
	});

	test("совместимость только при integrationPassed и только для React/Zustand", () => {
		expect(renderCard([pkg()], ctx({ integrationPassed: false }), "success").text).not.toContain(
			"Совместимость",
		);
		expect(
			renderCard([pkg({ name: "@cdd-team/openapi" })], ctx({ compatibility: {} }), "success").text,
		).not.toContain("Совместимость");
	});

	test("первый выпуск", () => {
		const card = renderCard(
			[pkg({ previous: null, bump: null, version: "0.1.0" })],
			ctx(),
			"success",
		);

		expect(card.text).toContain("<code>0.1.0</code> · первый выпуск");
		expect(card.text).toContain("frontend-packages · 1 пакет");
	});

	test("нет описания — ссылка на changelog", () => {
		const card = renderCard([pkg({ changelog: null })], ctx(), "success");

		expect(card.text).toContain(`Подробности в <a href="${releases}/react-v1.2.1">changelog</a>.`);
	});

	test("экранирует changelog", () => {
		const card = renderCard(
			[pkg({ changelog: { items: ["Array<T> & co"], breaking: [], dependencies: [] } })],
			ctx(),
			"success",
		);

		expect(card.text).toContain("Array&lt;T&gt; &amp; co");
		expect(escapeHtml('<a href="x">&')).toBe('&lt;a href="x"&gt;&amp;');
	});

	test("несколько пунктов — список, лишние скрыты за ссылкой", () => {
		const items = ["a", "b", "c", "d", "e", "f", "g"];
		const card = renderCard(
			[pkg({ changelog: { items, breaking: [], dependencies: [] } })],
			ctx(),
			"success",
		);

		expect(card.text).toContain("• a\n• b");
		expect(card.text).not.toContain("• f");
		expect(card.text).toContain(`…и ещё 2 в <a href="${releases}/react-v1.2.1">changelog</a>`);
	});

	test("длинный changelog укладывается в лимит Telegram", () => {
		const items = Array.from({ length: 300 }, (_, i) => `${i} ${"x".repeat(180)}`);
		const many = Array.from({ length: 12 }, (_, i) =>
			pkg({ name: `@cdd-team/p${i}`, changelog: { items, breaking: items, dependencies: [] } }),
		);
		const card = renderCard(many, ctx(), "success");

		expect(visibleLength(card.text)).toBeLessThanOrEqual(MAX_TEXT);
		expect(visibleLength(card.text)).toBeGreaterThan(MAX_TEXT / 2);
		for (let i = 0; i < 12; i++) expect(card.text).toContain(`<code>@cdd-team/p${i}</code>`);
		expect(card.text).toContain("…и ещё");
	});

	test("раскладка кнопок для 5 пакетов", () => {
		const five = ["a", "b", "c", "d", "e"].map((name) => pkg({ name: `@cdd-team/${name}` }));
		const card = renderCard(five, ctx({ compatibility: {} }), "success");

		expect(card.keyboard.map((row) => row.length)).toEqual([2, 2, 1, 2]);
	});

	test("нет открытых URL", () => {
		const card = renderCard([pkg(), zustand()], ctx(), "success");

		expect(card.text.replace(/href="[^"]*"/g, "")).not.toContain("http");
	});
});

describe("decideStatus", () => {
	test("всё пропущено с отчётом — алерта нет", () => {
		expect(decideStatus([pkg({ outcome: "skipped" })], ctx())).toBeNull();
	});

	test("published и skipped — успех", () => {
		expect(decideStatus([pkg({ outcome: "skipped" }), zustand()], ctx())).toBe("success");
	});

	test("сбои публикации", () => {
		expect(decideStatus([pkg({ outcome: "unconfirmed" })], ctx())).toBe("unknown");
		expect(decideStatus([pkg({ outcome: "failed" })], ctx())).toBe("failed");
		expect(decideStatus([pkg({ outcome: "unconfirmed" }), zustand()], ctx())).toBe("partial");
		expect(
			decideStatus([pkg({ outcome: "failed" }), zustand({ outcome: "not-attempted" })], ctx()),
		).toBe("failed");
	});

	test("без отчёта", () => {
		const available = [pkg({ outcome: "available" })];
		expect(decideStatus(available, ctx({ hasReport: false, failedStage: "build" }))).toBe("failed");
		expect(decideStatus(available, ctx({ hasReport: false, stageKnown: false }))).toBe("unknown");
		expect(decideStatus(available, ctx({ hasReport: false, failedStage: "publish" }))).toBe(
			"unknown",
		);
	});
});
