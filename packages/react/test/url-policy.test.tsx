import { afterEach, describe, expect, test } from "bun:test";
import type { ReactElement } from "../src/index.ts";
import { recordDomWrites, type DomWrite } from "./helpers/dom-write-recorder.ts";
import { mount, query } from "./helpers/render.tsx";

const XLINK = "http://www.w3.org/1999/xlink";
const DANGER = "javascript:alert(1)";

let recorder: { writes: DomWrite[]; restore(): void } | null = null;

function record(): DomWrite[] {
	recorder = recordDomWrites(document);
	return recorder.writes;
}

afterEach(() => {
	recorder?.restore();
	recorder = null;
});

function unsafeWrites(writes: DomWrite[]): DomWrite[] {
	return writes.filter((write) => String(write.value).toLowerCase().includes("script"));
}

type UrlCase = {
	name: string;
	render(value: unknown): ReactElement;
	selector: string;
	has(element: Element): boolean;
	read(element: Element): string | null;
};

function htmlCase(tag: string, prop: string, attribute = prop.toLowerCase()): UrlCase {
	return {
		name: `${tag} ${prop}`,
		render: (value) => {
			const Tag = tag as "a";
			return <Tag {...{ [prop]: value }} />;
		},
		selector: tag,
		has: (element) => element.hasAttribute(attribute),
		read: (element) => element.getAttribute(attribute),
	};
}

function svgCase(prop: string): UrlCase {
	return {
		name: `use ${prop}`,
		render: (value) => (
			<svg>
				<use {...{ [prop]: value }} />
			</svg>
		),
		selector: "use",
		has: (element) => element.hasAttributeNS(XLINK, "href") || element.hasAttribute("xlink:href"),
		read: (element) => element.getAttributeNS(XLINK, "href") ?? element.getAttribute("xlink:href"),
	};
}

const cases: UrlCase[] = [
	htmlCase("a", "href"),
	htmlCase("a", "HREF", "href"),
	htmlCase("img", "src"),
	htmlCase("img", "Src", "src"),
	htmlCase("form", "action"),
	htmlCase("button", "formAction", "formaction"),
	htmlCase("button", "FORMACTION", "formaction"),
	svgCase("xlinkHref"),
	svgCase("XLINKHREF"),
	svgCase("xlink:href"),
];

describe("javascript:-URL", () => {
	for (const urlCase of cases) {
		test(`опасный URL блокируется: ${urlCase.name}`, async () => {
			const writes = record();
			const { container, root } = await mount(urlCase.render(DANGER));

			expect(urlCase.has(query(container, urlCase.selector))).toBe(false);
			expect(unsafeWrites(writes)).toEqual([]);
			root.unmount();
		});
	}

	test("начальные коды 0–32 не обходят проверку", async () => {
		for (let code = 0; code <= 32; code += 1) {
			const writes = record();
			const { container, root } = await mount(
				<a href={`${String.fromCharCode(code)}javascript:alert(1)`} />,
			);

			expect(query(container, "a").hasAttribute("href")).toBe(false);
			expect(unsafeWrites(writes)).toEqual([]);
			root.unmount();
			recorder?.restore();
			recorder = null;
		}
	});

	for (const value of [
		"JaVaScRiPt:alert(1)",
		"java\tscript:alert(1)",
		"java\nscript:alert(1)",
		"java\rscript:alert(1)",
		"javascript\t:alert(1)",
	]) {
		test(`регистр протокола и tab/CR/LF: ${JSON.stringify(value)}`, async () => {
			const writes = record();
			const { container, root } = await mount(<a href={value} />);

			expect(query(container, "a").hasAttribute("href")).toBe(false);
			expect(writes.filter((write) => write.value === value)).toEqual([]);
			root.unmount();
		});
	}

	for (const urlCase of [htmlCase("a", "href"), svgCase("xlinkHref")]) {
		test(`безопасный → опасный → безопасный → нет prop: ${urlCase.name}`, async () => {
			const { container, root, rerender } = await mount(urlCase.render("https://a.test/"));
			const element = query(container, urlCase.selector);

			expect(urlCase.read(element)).toBe("https://a.test/");
			await rerender(urlCase.render(DANGER));
			expect(urlCase.has(element)).toBe(false);
			await rerender(urlCase.render("/next"));
			expect(urlCase.read(element)).toBe("/next");
			await rerender(urlCase.render(undefined));
			expect(urlCase.has(element)).toBe(false);
			expect(query(container, urlCase.selector)).toBe(element);
			root.unmount();
		});
	}

	test("toString вызывается один раз и записывается проверенная строка", async () => {
		let calls = 0;
		const safeFirst = {
			toString(): string {
				calls += 1;
				return calls === 1 ? "https://safe.test/" : DANGER;
			},
		};
		const { container, root } = await mount(
			<a {...({ href: safeFirst } as Record<string, unknown>)} />,
		);

		expect(calls).toBe(1);
		expect(query(container, "a").getAttribute("href")).toBe("https://safe.test/");
		root.unmount();
	});

	test("опасный первый toString не записывается", async () => {
		let calls = 0;
		const dangerFirst = {
			toString(): string {
				calls += 1;
				return calls === 1 ? DANGER : "https://safe.test/";
			},
		};
		const writes = record();
		const { container, root } = await mount(
			<a {...({ href: dangerFirst } as Record<string, unknown>)} />,
		);

		expect(calls).toBe(1);
		expect(query(container, "a").hasAttribute("href")).toBe(false);
		expect(writes.filter((write) => write.name === "href")).toEqual([]);
		root.unmount();
	});

	for (const value of ["https://x.test/", "mailto:a@b.test", "/rel", "rel/path", "#frag"]) {
		test(`безопасный URL записывается: ${value}`, async () => {
			const { container, root } = await mount(<a href={value} />);

			expect(query(container, "a").getAttribute("href")).toBe(value);
			root.unmount();
		});
	}

	test("null, undefined и false не вызывают toString и не дают атрибут", async () => {
		for (const value of [null, undefined, false]) {
			const { container, root } = await mount(
				<a {...({ href: value } as Record<string, unknown>)} />,
			);

			expect(query(container, "a").hasAttribute("href")).toBe(false);
			root.unmount();
		}
	});
});
