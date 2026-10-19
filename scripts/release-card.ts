// Итоговая карточка выпуска для Telegram (parse_mode HTML): статус, пакеты, кнопки.
import type { ChangelogSection } from "./release-changelog.ts";
import type { ErrorKind, PublishStatus } from "./release-report.ts";

export type Stage = "install" | "build" | "verify" | "integration" | "node" | "publish";

// available / not-visible / unchecked — проверка registry, когда отчёта публикации нет.
export type Outcome = PublishStatus | "available" | "not-visible" | "unchecked" | "unknown";

export type CardPackage = {
	name: string;
	version: string;
	previous: string | null;
	bump: "major" | "minor" | "patch" | null;
	releaseUrl: string;
	changelog: ChangelogSection | null;
	outcome: Outcome;
	reason?: string;
	errorKind?: ErrorKind;
};

export type CardContext = {
	repo: string;
	failedStage: Stage | null;
	stageKnown: boolean;
	integrationPassed: boolean;
	hasReport: boolean;
	runUrl: string;
	changesUrl: string;
	recoveryUrl: string;
	compatibility: { react?: string; zustand?: string };
};

export type CardStatus = "success" | "partial" | "failed" | "unknown";

export type Button = { text: string; url: string };

export type Card = { text: string; keyboard: Button[][] };

export const MAX_TEXT = 4096;
const MAX_ITEMS = 5;
const MAX_ITEM_LENGTH = 200;

const stageNames: Record<Stage, string> = {
	install: "установка зависимостей",
	build: "сборка",
	verify: "проверка архивов",
	integration: "интеграционные проверки",
	node: "подготовка Node/npm",
	publish: "публикация",
};

const headlines: Record<CardStatus, string> = {
	success: "✅ <b>Библиотеки опубликованы</b>",
	partial: "⚠️ <b>Выпуск завершён частично</b>",
	failed: "❌ <b>Выпуск не состоялся</b>",
	unknown: "⚠️ <b>Результат выпуска неизвестен</b>",
};

const isAvailable = (pkg: CardPackage) =>
	pkg.outcome === "published" || pkg.outcome === "skipped" || pkg.outcome === "available";

const isProblem = (pkg: CardPackage) =>
	pkg.outcome === "failed" || pkg.outcome === "unconfirmed" || pkg.outcome === "not-attempted";

export function decideStatus(packages: CardPackage[], ctx: CardContext): CardStatus | null {
	if (!ctx.hasReport) {
		if (!ctx.stageKnown || ctx.failedStage === "publish" || ctx.failedStage === null) {
			return "unknown";
		}
		return "failed";
	}
	if (packages.every((pkg) => pkg.outcome === "skipped")) return null;
	if (packages.some((pkg) => isProblem(pkg) || pkg.outcome === "unknown")) {
		if (packages.some(isAvailable)) return "partial";
		const onlyUnconfirmed = !packages.some((pkg) => pkg.outcome === "failed");
		return onlyUnconfirmed ? "unknown" : "failed";
	}
	return "success";
}

export function escapeHtml(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function npmUrl(name: string, version: string): string {
	return `https://www.npmjs.com/package/${name}/v/${version}`;
}

const code = (text: string) => `<code>${escapeHtml(text)}</code>`;
const link = (url: string, text: string) => `<a href="${escapeHtml(url)}">${text}</a>`;

function plural(count: number, one: string, few: string, many: string): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return one;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
}

const shortName = (name: string) => name.replace(/^@[^/]+\//, "");

function clip(text: string): string {
	return text.length > MAX_ITEM_LENGTH ? `${text.slice(0, MAX_ITEM_LENGTH - 1)}…` : text;
}

// Пункты списка с хвостом «…и ещё N», ведущим на полный changelog.
function itemLines(items: string[], shown: number, releaseUrl: string): string[] {
	const visible = items.slice(0, shown).map((item) => escapeHtml(clip(item)));
	const lines = visible.length === 1 && items.length === 1 ? visible : visible.map((i) => `• ${i}`);
	const hidden = items.length - visible.length;
	if (hidden > 0) lines.push(`…и ещё ${hidden} в ${link(releaseUrl, "changelog")}`);
	return lines;
}

const statusIcons: Partial<Record<Outcome, string>> = {
	published: "✅",
	available: "✅",
	skipped: "↩️",
	unconfirmed: "⏳",
	failed: "❌",
	"not-attempted": "⏸",
	"not-visible": "⏸",
	unchecked: "❔",
	unknown: "❔",
};

function outcomeLine(pkg: CardPackage): string {
	switch (pkg.outcome) {
		case "published":
		case "available":
			return "Доступен в npm.";
		case "skipped":
			return "Уже был в npm, пропущен.";
		case "unconfirmed":
			return `Публикация не подтверждена: проверьте ${code(`npm view ${pkg.name}@${pkg.version}`)}.`;
		case "failed":
			return `Не опубликован: ${escapeHtml(pkg.reason ?? "ошибка публикации")}.`;
		case "not-attempted":
			return "Не публиковался: публикация остановлена после ошибки.";
		case "not-visible":
			return "В registry не видна, в этом запуске не публиковался.";
		case "unchecked":
			return "Состояние в npm не проверено.";
		case "unknown":
			return "Результат неизвестен, проверьте registry.";
	}
}

function versionLine(pkg: CardPackage): string {
	if (pkg.previous === null) return `${code(pkg.version)} · первый выпуск`;
	return `${code(`${pkg.previous} → ${pkg.version}`)} · ${pkg.bump}`;
}

function description(pkg: CardPackage, shown: number): string[] {
	const changelog = pkg.changelog;
	if (changelog && changelog.items.length > 0) {
		return itemLines(changelog.items, shown, pkg.releaseUrl);
	}
	if (changelog && changelog.dependencies.length > 0) {
		return changelog.dependencies.map(
			({ name, range }) => `Обновлён диапазон ${code(name)} до ${code(range)}.`,
		);
	}
	return [`Подробности в ${link(pkg.releaseUrl, "changelog")}.`];
}

function fullBlock(pkg: CardPackage, shown: number): string[] {
	const skipped = pkg.outcome === "skipped";
	const title = `${skipped ? "↩️ " : ""}<b>${link(pkg.releaseUrl, code(pkg.name))}</b>`;
	return [
		title,
		versionLine(pkg),
		...(skipped ? [outcomeLine(pkg)] : []),
		...description(pkg, shown),
	];
}

function compactBlock(pkg: CardPackage): string[] {
	const icon = statusIcons[pkg.outcome] ?? "❔";
	return [
		`${icon} <b>${link(pkg.releaseUrl, code(`${pkg.name} · ${pkg.version}`))}</b>`,
		outcomeLine(pkg),
	];
}

function compatibilityBlock(packages: CardPackage[], ctx: CardContext): string[] {
	const { react, zustand } = ctx.compatibility;
	if (!ctx.integrationPassed || (!react && !zustand)) return [];
	// Связка проверена, только если все выпущенные React/Zustand реально доступны.
	const pair = packages.filter((pkg) => /^@cdd-team\/(react|zustand)$/.test(pkg.name));
	if (pair.length === 0 || !pair.every(isAvailable)) return [];
	const parts = [react && `React ${code(react)}`, zustand && `Zustand ${code(zustand)}`].filter(
		Boolean,
	);
	return ["<b>Совместимость</b>", `Интеграционные проверки ${parts.join(" + ")} прошли.`];
}

function migrationBlock(packages: CardPackage[], shown: Map<CardPackage, number>): string[] {
	const breaking = packages.filter(
		(pkg) => isAvailable(pkg) && (pkg.changelog?.breaking.length ?? 0) > 0,
	);
	if (breaking.length === 0) return [];
	const lines = ["⚠️ <b>Требуется миграция</b>"];
	for (const pkg of breaking) {
		const items = pkg.changelog?.breaking ?? [];
		const count = shown.get(pkg) ?? 0;
		for (const item of items.slice(0, count)) {
			lines.push(`${code(pkg.name)}: ${escapeHtml(clip(item))}`);
		}
		if (items.length > count) {
			lines.push(`${code(pkg.name)}: …и ещё ${items.length - count}`);
		}
		lines.push(`Изучите breaking changes по ${link(pkg.releaseUrl, "ссылке")}.`);
	}
	return lines;
}

function nextAction(packages: CardPackage[], ctx: CardContext, status: CardStatus): string {
	const rerun = "перезапустить job publish: уже опубликованные версии будут пропущены";
	if (status === "unknown")
		return "Проверить registry и логи, при необходимости перезапустить job publish.";
	if (!ctx.hasReport) return "Исправить причину и перезапустить job publish.";
	const failed = packages.find((pkg) => pkg.outcome === "failed");
	if (failed?.errorKind === "auth") {
		return `Проверить Trusted Publisher для ${code(failed.name)} и ${rerun}.`;
	}
	if (failed?.errorKind === "conflict") {
		return `Версия ${code(`${failed.name}@${failed.version}`)} уже занята: проверьте registry, повторно её не публикуйте.`;
	}
	if (failed) return `Посмотреть логи и ${rerun}.`;
	return "Проверить registry через несколько минут; если версии нет, перезапустить job publish.";
}

function header(packages: CardPackage[], ctx: CardContext, status: CardStatus): string[] {
	const total = packages.length;
	const subtitle =
		status === "success"
			? `${escapeHtml(ctx.repo)} · ${total} ${plural(total, "пакет", "пакета", "пакетов")}`
			: `${escapeHtml(ctx.repo)} · опубликовано ${packages.filter(isAvailable).length} из ${total}`;
	const lines = [headlines[status], subtitle];
	if (!ctx.hasReport && ctx.failedStage && status === "failed") {
		lines.push(
			`Этап: <b>${stageNames[ctx.failedStage]}</b> — шаг завершился с ошибкой, подробности в логах.`,
		);
		if (packages.every(isAvailable)) lines.push("Все версии уже были в npm.");
	}
	return lines;
}

function compose(
	packages: CardPackage[],
	ctx: CardContext,
	status: CardStatus,
	items: Map<CardPackage, number>,
	breaking: Map<CardPackage, number>,
): string {
	const blocks = [header(packages, ctx, status)];
	for (const pkg of packages) {
		blocks.push(status === "success" ? fullBlock(pkg, items.get(pkg) ?? 0) : compactBlock(pkg));
	}
	blocks.push(migrationBlock(packages, breaking));
	if (status === "success" || status === "partial") blocks.push(compatibilityBlock(packages, ctx));
	if (status !== "success") {
		blocks.push(["<b>Что делать</b>", nextAction(packages, ctx, status)]);
	}
	return blocks
		.filter((block) => block.length > 0)
		.map((block) => block.join("\n"))
		.join("\n\n");
}

// Убирает по одному пункту у пакета с самым длинным списком, пока карточка не влезет в лимит.
function shrink(counts: Map<CardPackage, number>): boolean {
	let target: CardPackage | undefined;
	for (const [pkg, count] of counts) {
		if (count > 0 && (!target || count > (counts.get(target) ?? 0))) target = pkg;
	}
	if (!target) return false;
	counts.set(target, (counts.get(target) ?? 0) - 1);
	return true;
}

function keyboard(packages: CardPackage[], ctx: CardContext, status: CardStatus): Button[][] {
	const npm = packages.filter(isAvailable).map((pkg) => ({
		text: `${shortName(pkg.name)} ${pkg.version} в npm`,
		url: npmUrl(pkg.name, pkg.version),
	}));
	const rows: Button[][] = [];
	for (let i = 0; i < npm.length; i += 2) rows.push(npm.slice(i, i + 2));
	if (status === "success") {
		return [
			...rows,
			[
				{ text: "Изменения", url: ctx.changesUrl },
				{ text: "Проверки", url: ctx.runUrl },
			],
		];
	}
	return [
		[
			{ text: "Логи ошибки", url: ctx.runUrl },
			{ text: "Восстановление выпуска", url: ctx.recoveryUrl },
		],
		...rows,
	];
}

// Telegram ограничивает длину текста после разбора разметки: теги и href не считаются.
export function visibleLength(html: string): number {
	return html
		.replace(/<[^>]+>/g, "")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&").length;
}

export function renderCard(packages: CardPackage[], ctx: CardContext, status: CardStatus): Card {
	const items = new Map(
		packages.map((pkg) => [pkg, Math.min(pkg.changelog?.items.length ?? 0, MAX_ITEMS)]),
	);
	const breaking = new Map(
		packages.map((pkg) => [pkg, Math.min(pkg.changelog?.breaking.length ?? 0, MAX_ITEMS)]),
	);
	let text = compose(packages, ctx, status, items, breaking);
	while (visibleLength(text) > MAX_TEXT && (shrink(items) || shrink(breaking))) {
		text = compose(packages, ctx, status, items, breaking);
	}
	return { text, keyboard: keyboard(packages, ctx, status) };
}
