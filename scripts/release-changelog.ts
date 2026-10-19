// Факты для карточки выпуска из CHANGELOG.md release-please и тегов `<component>-v<version>`.
export type ChangelogSection = {
	items: string[];
	breaking: string[];
	dependencies: { name: string; range: string }[];
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function cleanItem(line: string): string {
	return line
		.replace(/^\s*\*\s+/, "")
		.replace(/^\*\*[^*]+:\*\*\s*/, "")
		.replace(/\s*\(\[[0-9a-f]{7,}\]\([^)]*\)\)\s*$/, "")
		.trim();
}

function splitSubsections(body: string): Map<string, string[]> {
	const sections = new Map<string, string[]>();
	let current: string[] | undefined;
	for (const line of body.split(/\r?\n/)) {
		const heading = /^###\s+(.+?)\s*$/.exec(line);
		if (heading?.[1]) {
			current = [];
			sections.set(heading[1], current);
		} else if (current) {
			current.push(line);
		}
	}
	return sections;
}

const topItems = (lines: string[] = []) =>
	lines
		.filter((line) => /^\*\s+/.test(line))
		.map(cleanItem)
		.filter(Boolean);

function parseDependencies(lines: string[] = []) {
	const ranges = new Map<string, { range: string; peer: boolean }>();
	let peer = false;
	for (const line of lines) {
		const group = /^\s+\*\s+(\w+Dependencies)\s*$/.exec(line);
		if (group) {
			peer = group[1] === "peerDependencies";
			continue;
		}
		const bump = /^\s+\*\s+(\S+) bumped from \S+ to (\S+)/.exec(line);
		if (!bump?.[1] || !bump[2]) continue;
		const known = ranges.get(bump[1]);
		if (!known || (peer && !known.peer)) ranges.set(bump[1], { range: bump[2], peer });
	}
	return [...ranges].map(([name, { range }]) => ({ name, range }));
}

export function parseChangelogSection(markdown: string, version: string): ChangelogSection | null {
	const heading = new RegExp(`^## \\[?${escapeRegExp(version)}(?:\\]|\\s|$)`, "m");
	const match = heading.exec(markdown);
	if (!match) return null;
	const rest = markdown.slice(match.index + match[0].length);
	const next = rest.search(/^## /m);
	const sections = splitSubsections(next === -1 ? rest : rest.slice(0, next));
	const breaking = [...sections].find(([title]) => title.includes("BREAKING CHANGES"))?.[1];
	return {
		items: [...topItems(sections.get("Features")), ...topItems(sections.get("Bug Fixes"))],
		breaking: topItems(breaking),
		dependencies: parseDependencies(sections.get("Dependencies")),
	};
}

const parts = (version: string) => version.split(".").map(Number);

function compare(a: string, b: string): number {
	const [x, y] = [parts(a), parts(b)];
	for (let i = 0; i < 3; i++) {
		const diff = (x[i] ?? 0) - (y[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

// Предыдущий выпуск — по тегам, а не по npm `latest`: после публикации он уже указывает на новую версию.
export function previousVersion(tags: string[], component: string, version: string): string | null {
	const pattern = new RegExp(`^${escapeRegExp(component)}-v(\\d+\\.\\d+\\.\\d+)$`);
	const older = tags
		.map((tag) => pattern.exec(tag.trim())?.[1])
		.filter((found): found is string => found !== undefined && compare(found, version) < 0)
		.sort(compare);
	return older.at(-1) ?? null;
}

export function bumpType(previous: string, next: string): "major" | "minor" | "patch" {
	const [a, b] = [parts(previous), parts(next)];
	if (a[0] !== b[0]) return "major";
	if (a[1] !== b[1]) return "minor";
	return "patch";
}
