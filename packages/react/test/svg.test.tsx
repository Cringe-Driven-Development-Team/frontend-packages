import { describe, expect, test } from "bun:test";
import { createRoot } from "../src/index.ts";
import type { ReactElement, Root } from "../src/index.ts";

const SVG = "http://www.w3.org/2000/svg";
const HTML = "http://www.w3.org/1999/xhtml";

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

type Mounted = {
	container: HTMLElement;
	root: Root;
	rerender(next: ReactElement): Promise<void>;
};

async function mount(element: ReactElement): Promise<Mounted> {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(element);
	await flush();

	return {
		container,
		root,
		async rerender(next) {
			root.render(next);
			await flush();
		},
	};
}

function query(container: HTMLElement, selector: string): Element {
	const element = container.querySelector(selector);
	if (!element) {
		throw new Error(`Не найден элемент ${selector}`);
	}
	return element;
}

describe("svg namespace", () => {
	test("svg и path создаются в пространстве имён SVG", async () => {
		const { container, root } = await mount(
			<svg>
				<path d="M0 0" />
			</svg>,
		);

		expect(query(container, "svg").namespaceURI).toBe(SVG);
		expect(query(container, "path").namespaceURI).toBe(SVG);
		root.unmount();
	});

	test("foreignObject в SVG, его дети снова HTML", async () => {
		const { container, root } = await mount(
			<svg>
				<foreignObject>
					<div>
						<span />
					</div>
				</foreignObject>
			</svg>,
		);

		expect(query(container, "foreignObject").namespaceURI).toBe(SVG);
		expect(query(container, "div").namespaceURI).toBe(HTML);
		expect(query(container, "span").namespaceURI).toBe(HTML);
		root.unmount();
	});

	test("HTML вне svg остаётся HTML", async () => {
		const { container, root } = await mount(
			<div>
				<span />
			</div>,
		);

		expect(query(container, "div").namespaceURI).toBe(HTML);
		expect(query(container, "span").namespaceURI).toBe(HTML);
		root.unmount();
	});

	test("компонент и фрагмент между svg и path не прерывают наследование", async () => {
		function Icon(): ReactElement {
			return (
				<>
					<path />
				</>
			);
		}

		const { container, root } = await mount(
			<svg>
				<Icon />
			</svg>,
		);

		expect(query(container, "path").namespaceURI).toBe(SVG);
		root.unmount();
	});

	test("path, добавленный при перерендере, создаётся в SVG", async () => {
		const { container, root, rerender } = await mount(<svg />);

		await rerender(
			<svg>
				<path />
			</svg>,
		);

		expect(query(container, "path").namespaceURI).toBe(SVG);
		root.unmount();
	});

	test("общий тег a внутри svg — SVG", async () => {
		const { container, root } = await mount(
			<svg>
				<a />
			</svg>,
		);

		expect(query(container, "a").namespaceURI).toBe(SVG);
		root.unmount();
	});

	test("svg внутри HTML внутри foreignObject снова SVG", async () => {
		const { container, root } = await mount(
			<svg>
				<foreignObject>
					<div>
						<svg class="inner">
							<circle />
						</svg>
					</div>
				</foreignObject>
			</svg>,
		);

		expect(query(container, "svg.inner").namespaceURI).toBe(SVG);
		expect(query(container, "circle").namespaceURI).toBe(SVG);
		root.unmount();
	});
});

const XLINK = "http://www.w3.org/1999/xlink";

describe("svg attributes", () => {
	test("camelCase переводится в kebab-case, viewBox как есть", async () => {
		const { container, root } = await mount(
			<svg viewBox="0 0 24 24" width="24">
				<path strokeWidth="2" strokeLinecap="round" fillRule="evenodd" d="M0 0" />
			</svg>,
		);
		const svg = query(container, "svg");
		const path = query(container, "path");

		expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
		expect(svg.getAttribute("width")).toBe("24");
		expect(path.getAttribute("stroke-width")).toBe("2");
		expect(path.getAttribute("stroke-linecap")).toBe("round");
		expect(path.getAttribute("fill-rule")).toBe("evenodd");
		expect(path.getAttribute("d")).toBe("M0 0");
		expect(path.hasAttribute("strokeWidth")).toBe(false);
		root.unmount();
	});

	test("className у svg становится атрибутом class", async () => {
		const { container, root } = await mount(<svg className="icon" />);

		expect(query(container, "svg").getAttribute("class")).toBe("icon");
		root.unmount();
	});

	test("xlinkHref пишется в пространстве имён xlink", async () => {
		const { container, root } = await mount(
			<svg>
				<use xlinkHref="#a" />
			</svg>,
		);
		const use = query(container, "use");

		expect(use.getAttributeNS(XLINK, "href")).toBe("#a");
		expect(use.getAttribute("xlink:href")).toBe("#a");
		root.unmount();
	});

	test("перерендер обновляет и удаляет атрибуты", async () => {
		const { container, root, rerender } = await mount(
			<svg className="icon">
				<path strokeWidth="2" d="M0 0" />
				<use xlinkHref="#a" />
			</svg>,
		);

		await rerender(
			<svg>
				<path strokeWidth="3" />
				<use />
			</svg>,
		);
		const path = query(container, "path");

		expect(path.getAttribute("stroke-width")).toBe("3");
		expect(path.hasAttribute("d")).toBe(false);
		expect(query(container, "use").hasAttributeNS(XLINK, "href")).toBe(false);
		expect(query(container, "svg").hasAttribute("class")).toBe(false);
		root.unmount();
	});

	test("события и style на SVG работают", async () => {
		let clicks = 0;
		const { container, root } = await mount(
			<svg>
				<circle onClick={() => (clicks += 1)} style={{ opacity: 0.5 }} />
			</svg>,
		);
		const circle = query(container, "circle") as SVGCircleElement;

		circle.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(clicks).toBe(1);
		expect(circle.style.opacity).toBe("0.5");
		root.unmount();
	});

	test("HTML внутри foreignObject получает свойства как раньше", async () => {
		const { container, root } = await mount(
			<svg>
				<foreignObject>
					<input value="x" className="f" />
				</foreignObject>
			</svg>,
		);
		const input = query(container, "input") as HTMLInputElement;

		expect(input.value).toBe("x");
		expect(input.getAttribute("class")).toBe("f");
		root.unmount();
	});
});
