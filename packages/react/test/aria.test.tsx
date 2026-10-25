import { describe, expect, test } from "bun:test";
import { createRoot } from "../src/index.ts";
import type { ReactElement } from "../src/index.ts";

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

async function mount(element: ReactElement) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(element);
	await flush();

	return {
		container,
		root,
		async rerender(next: ReactElement) {
			root.render(next);
			await flush();
		},
	};
}

describe("aria-атрибуты со значением false", () => {
	test("у HTML false пишется строкой", async () => {
		const { container, root } = await mount(<button aria-expanded={false} aria-pressed={false} />);
		const button = container.querySelector("button")!;

		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(button.getAttribute("aria-pressed")).toBe("false");
		root.unmount();
	});

	test("у SVG false пишется строкой", async () => {
		const { container, root } = await mount(<svg aria-hidden={false} aria-expanded={false} />);
		const svg = container.querySelector("svg")!;

		expect(svg.getAttribute("aria-hidden")).toBe("false");
		expect(svg.getAttribute("aria-expanded")).toBe("false");
		root.unmount();
	});

	test("undefined и удалённый проп убирают aria-атрибут", async () => {
		const { container, root, rerender } = await mount(
			<div>
				<button aria-expanded={true} aria-pressed={false} />
				<svg aria-hidden={true} aria-expanded={false} />
			</div>,
		);

		await rerender(
			<div>
				<button aria-expanded={undefined} />
				<svg aria-hidden={undefined} />
			</div>,
		);
		const button = container.querySelector("button")!;
		const svg = container.querySelector("svg")!;

		expect(button.hasAttribute("aria-expanded")).toBe(false);
		expect(button.hasAttribute("aria-pressed")).toBe(false);
		expect(svg.hasAttribute("aria-hidden")).toBe(false);
		expect(svg.hasAttribute("aria-expanded")).toBe(false);
		root.unmount();
	});
});
