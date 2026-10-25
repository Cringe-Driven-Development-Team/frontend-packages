import { afterEach, describe, expect, test } from "bun:test";
import { recordDomWrites, type DomWrite } from "./helpers/dom-write-recorder.ts";
import { mount, query } from "./helpers/render.tsx";

let recorder: { writes: DomWrite[]; restore(): void } | null = null;

function record(): DomWrite[] {
	recorder = recordDomWrites(document);
	return recorder.writes;
}

afterEach(() => {
	recorder?.restore();
	recorder = null;
});

describe("строковые on*", () => {
	for (const name of ["onerror", "onError", "OnError", "ONERROR", "oNerror"]) {
		test(`строковый ${name} не попадает в DOM`, async () => {
			const writes = record();
			const props = { src: "x.png", [name]: "globalThis.__xss = 1" };
			const { container, root } = await mount(<img {...props} />);
			const img = query(container, "img");

			expect(img.hasAttribute(name.toLowerCase())).toBe(false);
			expect(writes.filter((write) => write.name.toLowerCase() === "onerror")).toEqual([]);
			root.unmount();
		});
	}

	test("функция A → строка → функция B → нет prop", async () => {
		const calls: string[] = [];
		const a = (): void => {
			calls.push("a");
		};
		const b = (): void => {
			calls.push("b");
		};
		const { container, root, rerender } = await mount(<button onClick={a} />);
		const button = query<HTMLButtonElement>(container, "button");

		button.click();
		const stringHandler: Record<string, unknown> = { onClick: "globalThis.__xss = 1" };
		await rerender(<button {...stringHandler} />);
		button.click();
		await rerender(<button onClick={b} />);
		button.click();
		await rerender(<button />);
		button.click();

		expect(calls).toEqual(["a", "b"]);
		expect(button.hasAttribute("onclick")).toBe(false);
		expect(query(container, "button")).toBe(button);
		root.unmount();
	});

	test("capture-обработчик подключается и снимается", async () => {
		let calls = 0;
		const spy = (): void => {
			calls += 1;
		};
		const { container, root, rerender } = await mount(
			<div onClickCapture={spy}>
				<button />
			</div>,
		);

		query<HTMLButtonElement>(container, "button").click();
		await rerender(
			<div>
				<button />
			</div>,
		);
		query<HTMLButtonElement>(container, "button").click();

		expect(calls).toBe(1);
		root.unmount();
	});
});

describe("HTML-props", () => {
	for (const name of ["innerHTML", "INNERHTML", "outerHTML", "srcdoc", "srcDoc", "SRCDOC"]) {
		test(`${name} игнорируется при mount, update и удалении`, async () => {
			const writes = record();
			const { container, root, rerender } = await mount(
				<div {...{ [name]: "<b id=x>bad</b>" }}>
					<span>keep</span>
				</div>,
			);
			const div = query(container, "div");
			const span = query(container, "span");

			const check = (): void => {
				expect(container.querySelector("#x")).toBeNull();
				expect(query(container, "div")).toBe(div);
				expect(query(container, "span")).toBe(span);
				expect(span.textContent).toBe("keep");
				expect(div.hasAttribute(name.toLowerCase())).toBe(false);
			};

			check();
			await rerender(
				<div {...{ [name]: "<b id=x>other</b>" }}>
					<span>keep</span>
				</div>,
			);
			check();
			await rerender(
				<div>
					<span>keep</span>
				</div>,
			);
			check();
			expect(writes.filter((write) => write.name.toLowerCase() === name.toLowerCase())).toEqual([]);
			root.unmount();
		});
	}

	test("HTML в текстовом child остаётся текстом", async () => {
		const text = "<img src=x onerror=alert(1)>";
		const { container, root } = await mount(<p>{text}</p>);
		const p = query(container, "p");

		expect(p.textContent).toBe(text);
		expect(p.querySelector("img")).toBeNull();
		root.unmount();
	});
});
