import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	Children,
	createContext,
	createElement,
	createPortal,
	createRoot,
	h,
	memo,
	type ReactElement,
} from "../src/index.ts";
import { flush, mount } from "./helpers/render.tsx";

const MESSAGE = "Expected a React element with a valid $$typeof marker.";
const json = JSON.parse('{"type":"div","key":null,"props":{"children":[]}}') as ReactElement;
const stringMarker = { ...json, $$typeof: "Symbol(react.element)" } as unknown as ReactElement;
const fakes = [
	["JSON-объект", json],
	["строковый $$typeof", stringMarker],
] as const;

async function runInvalidElementProbe(): Promise<unknown> {
	const probe = Bun.spawn(
		["bun", "--preload", "./test/setup-dom.ts", "./test/probes/invalid-element.tsx"],
		{ cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
	);
	const output = await new Response(probe.stdout).text();
	await probe.exited;
	return JSON.parse(output.trim().split("\n").at(-1) ?? "null");
}

describe("проверка $$typeof", () => {
	for (const [label, fake] of fakes) {
		test(`h и createElement отклоняют поддельный child: ${label}`, () => {
			expect(() => h("div", null, fake)).toThrow(new TypeError(MESSAGE));
			expect(() => createElement("div", null, fake)).toThrow(new TypeError(MESSAGE));
			expect(() => h("div", null, [[fake]])).toThrow(new TypeError(MESSAGE));
		});

		test(`JSX отклоняет поддельный child: ${label}`, () => {
			expect(() => <div>{fake}</div>).toThrow(new TypeError(MESSAGE));
			expect(() => <div>{[fake]}</div>).toThrow(new TypeError(MESSAGE));
		});

		test(`Children.toArray отклоняет поддельный child: ${label}`, () => {
			expect(() => Children.toArray([fake])).toThrow(new TypeError(MESSAGE));
		});

		test(`root.render отклоняет поддельный корень до изменения DOM: ${label}`, () => {
			const container = document.createElement("div");
			container.innerHTML = '<p id="sentinel">keep</p>';
			const sentinel = container.firstChild;
			const root = createRoot(container);

			expect(() => root.render(fake)).toThrow(new TypeError(MESSAGE));
			expect(container.firstChild).toBe(sentinel);
			expect(container.innerHTML).toBe('<p id="sentinel">keep</p>');
		});

		test(`отклонённый root.render не отменяет запланированный: ${label}`, async () => {
			const container = document.createElement("div");
			const root = createRoot(container);

			root.render(<p>pending</p>);
			expect(() => root.render(fake)).toThrow(new TypeError(MESSAGE));
			await flush();

			expect(container.innerHTML).toBe("<p>pending</p>");
			root.unmount();
		});
	}

	test("ошибка update сохраняет дерево, следующий render проходит", async () => {
		expect(await runInvalidElementProbe()).toEqual({
			error: MESSAGE,
			sameNode: true,
			html: "<p>ok</p>",
			recovered: "<p>next</p>",
		});
	});

	test("настоящие элементы работают", async () => {
		const Theme = createContext("light");
		const Memo = memo(({ text }: { text: string }) => <i>{text}</i>);
		const portalTarget = document.createElement("div");
		const { container, root } = await mount(
			<Theme value="dark">
				<>
					<b>fragment</b>
					{"text"}
					{42}
					{null}
					{false}
					{[]}
				</>
				<Memo text="memo" />
				{createPortal(<span>portal</span>, portalTarget)}
			</Theme>,
		);

		expect(container.innerHTML).toBe("<b>fragment</b>text42<i>memo</i>");
		expect(portalTarget.innerHTML).toBe("<span>portal</span>");
		root.unmount();
	});
});
