import { afterEach, describe, expect, test } from "bun:test";
import { createElement, createPortal } from "../src/index.ts";
import type { Tag } from "../src/index.ts";
import { jsx } from "../src/jsx-runtime.ts";
import { recordDomWrites, type DomWrite } from "./helpers/dom-write-recorder.ts";
import { mount, query } from "./helpers/render.tsx";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

let recorder: { writes: DomWrite[]; restore(): void } | null = null;

function record(): DomWrite[] {
	recorder = recordDomWrites(document);
	return recorder.writes;
}

function innerHtmlWrites(writes: DomWrite[]): unknown[] {
	return writes.filter((write) => write.name === "innerHTML").map((write) => write.value);
}

afterEach(() => {
	recorder?.restore();
	recorder = null;
});

describe("инертный HTML script", () => {
	for (const tag of ["script", "SCRIPT"]) {
		test(`${tag} создаётся парсером и сохраняет props и children`, async () => {
			const writes = record();
			const { container, root } = await mount(
				createElement(
					tag as Tag,
					{ src: "data:text/javascript,globalThis.__probe%3D2" },
					"globalThis.__probe=1",
				),
			);
			const script = query<HTMLScriptElement>(container, "script");

			expect(script.tagName).toBe("SCRIPT");
			expect(script.namespaceURI).toBe(HTML_NAMESPACE);
			expect(script.textContent).toBe("globalThis.__probe=1");
			expect(script.getAttribute("src")).toBe("data:text/javascript,globalThis.__probe%3D2");
			expect(innerHtmlWrites(writes)).toEqual(["<script></script>"]);
			root.unmount();
		});
	}

	test("разметка script в строковом child остаётся текстом", async () => {
		const { container, root } = await mount(<div>{"<script>globalThis.__probe=1</script>"}</div>);

		expect(container.querySelector("script")).toBeNull();
		expect(container.textContent).toBe("<script>globalThis.__probe=1</script>");
		root.unmount();
	});

	test("обновление по key сохраняет инертный узел", async () => {
		const writes = record();
		const { container, root, rerender } = await mount(
			createElement("script", { key: "script", src: "data:text/javascript,A" }, "payload A"),
		);
		const script = query<HTMLScriptElement>(container, "script");

		await rerender(
			createElement("script", { key: "script", src: "data:text/javascript,B" }, "payload B"),
		);

		expect(container.querySelector("script")).toBe(script);
		expect(script.textContent).toBe("payload B");
		expect(script.getAttribute("src")).toBe("data:text/javascript,B");
		expect(innerHtmlWrites(writes)).toEqual(["<script></script>"]);
		root.unmount();
	});

	test("JSX создаёт инертный script", async () => {
		const writes = record();
		const { container, root } = await mount(
			jsx("script", { src: "data:text/javascript,jsx", children: "jsx payload" }),
		);
		const script = query<HTMLScriptElement>(container, "script");

		expect(script.textContent).toBe("jsx payload");
		expect(script.getAttribute("src")).toBe("data:text/javascript,jsx");
		expect(innerHtmlWrites(writes)).toEqual(["<script></script>"]);
		root.unmount();
	});

	test("портал создаёт инертный script в своём контейнере", async () => {
		const portalTarget = document.createElement("div");
		const writes = record();
		const { container, root } = await mount(
			<div>
				{createPortal(
					createElement("script", { src: "data:text/javascript,portal" }, "portal payload"),
					portalTarget,
				)}
			</div>,
		);
		const script = query<HTMLScriptElement>(portalTarget, "script");

		expect(script.textContent).toBe("portal payload");
		expect(script.getAttribute("src")).toBe("data:text/javascript,portal");
		expect(container.querySelector("script")).toBeNull();
		expect(innerHtmlWrites(writes)).toEqual(["<script></script>"]);
		root.unmount();
	});
});
