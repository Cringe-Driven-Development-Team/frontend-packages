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
