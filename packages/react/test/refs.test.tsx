import { describe, expect, test } from "bun:test";
import {
	createRoot,
	memo,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "../src/index.ts";
import type { Dispatch, ReactElement, Ref, RefObject } from "../src/index.ts";

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

	return { container, root };
}

function click(container: HTMLElement, selector = "button"): void {
	container.querySelector<HTMLElement>(selector)?.click();
}

describe("useRef", () => {
	test("returns the same object between renders", async () => {
		const seen: RefObject<number>[] = [];

		function Counter() {
			const ref = useRef(0);
			const [count, setCount] = useState(0);
			seen.push(ref);
			return <button onClick={() => setCount(count + 1)}>{count}</button>;
		}

		const { container, root } = await mount(<Counter />);
		click(container);
		await flush();

		expect(seen).toHaveLength(2);
		expect(seen[0]).toBe(seen[1] as RefObject<number>);
		root.unmount();
	});

	test("changing current does not re-render", async () => {
		const seen: RefObject<number>[] = [];

		function Clicker() {
			const clicksRef = useRef(0);
			// Эффект без deps срабатывает на каждом коммите — заодно считает рендеры.
			useLayoutEffect(() => {
				seen.push(clicksRef);
			});
			return <button onClick={() => (clicksRef.current += 1)}>click</button>;
		}

		const { container, root } = await mount(<Clicker />);
		click(container);
		await flush();

		expect(seen).toHaveLength(1);
		expect(seen[0]?.current).toBe(1);
		root.unmount();
	});
});

function createRef<Value>(): RefObject<Value | null> {
	return { current: null };
}

function createSwitch<Value>(initial: Value) {
	const setters: Dispatch<Value>[] = [];

	function useSwitch(): Value {
		const [value, setValue] = useState(initial);
		setters.push(setValue);
		return value;
	}

	async function toggle(value: Value): Promise<void> {
		setters.at(-1)?.(value);
		await flush();
	}

	return { useSwitch, toggle };
}

describe("ref prop", () => {
	test("object ref receives the node", async () => {
		const ref = createRef<HTMLInputElement>();
		const { container, root } = await mount(<input ref={ref} />);

		expect(ref.current).toBe(container.querySelector("input"));
		root.unmount();
	});

	test("callback ref is called with the node", async () => {
		const calls: Array<HTMLInputElement | null> = [];
		const { container, root } = await mount(<input ref={(node) => calls.push(node)} />);

		expect(calls).toEqual([container.querySelector("input")]);
		root.unmount();
	});

	test("ref is not rendered to DOM", async () => {
		const ref = createRef<HTMLInputElement>();
		const { container, root } = await mount(<input ref={ref} />);
		const input = container.querySelector("input") as HTMLInputElement;

		expect(input.hasAttribute("ref")).toBe(false);
		expect((input as unknown as Record<string, unknown>).ref).toBeUndefined();
		root.unmount();
	});

	test("ref is attached before useLayoutEffect", async () => {
		const seen: Array<{ node: HTMLInputElement | null; inDocument: boolean }> = [];

		function Field() {
			const ref = useRef<HTMLInputElement>(null);
			useLayoutEffect(() => {
				seen.push({ node: ref.current, inDocument: document.contains(ref.current) });
			}, []);
			return <input ref={ref} />;
		}

		const { container, root } = await mount(<Field />);

		expect(seen).toEqual([{ node: container.querySelector("input"), inDocument: true }]);
		root.unmount();
	});

	test("removed element detaches object and callback refs", async () => {
		const ref = createRef<HTMLInputElement>();
		const calls: Array<HTMLSpanElement | null> = [];
		const visible = createSwitch(true);

		function App() {
			const show = visible.useSwitch();
			return (
				<div>
					{show && <input ref={ref} />}
					{show && <span ref={(node) => calls.push(node)} />}
				</div>
			);
		}

		const { root } = await mount(<App />);
		await visible.toggle(false);

		expect(ref.current).toBeNull();
		expect(calls).toHaveLength(2);
		expect(calls.at(-1)).toBeNull();
		root.unmount();
	});

	test("nested refs detached on subtree removal", async () => {
		const ref = createRef<HTMLSpanElement>();
		const visible = createSwitch(true);

		function Child() {
			return (
				<div>
					<span ref={ref} />
				</div>
			);
		}

		function App() {
			return <main>{visible.useSwitch() && <Child />}</main>;
		}

		const { root } = await mount(<App />);
		expect(ref.current).not.toBeNull();
		await visible.toggle(false);

		expect(ref.current).toBeNull();
		root.unmount();
	});

	test("unmount detaches refs", async () => {
		const ref = createRef<HTMLSpanElement>();
		const { root } = await mount(
			<div>
				<span ref={ref} />
			</div>,
		);
		expect(ref.current).not.toBeNull();

		root.unmount();
		await flush();

		expect(ref.current).toBeNull();
	});

	test("changing ref detaches old and attaches new", async () => {
		const refA = createRef<HTMLInputElement>();
		const refB = createRef<HTMLInputElement>();
		const which = createSwitch<"a" | "b">("a");

		function App() {
			return <input ref={which.useSwitch() === "a" ? refA : refB} />;
		}

		const { container, root } = await mount(<App />);
		await which.toggle("b");

		expect(refA.current).toBeNull();
		expect(refB.current).toBe(container.querySelector("input"));
		root.unmount();
	});

	test("same ref on re-render is not re-invoked", async () => {
		const calls: Array<HTMLInputElement | null> = [];
		const callback = (node: HTMLInputElement | null) => {
			calls.push(node);
		};
		const value = createSwitch("one");

		function App() {
			return <input ref={callback} value={value.useSwitch()} />;
		}

		const { root } = await mount(<App />);
		await value.toggle("two");

		expect(calls).toHaveLength(1);
		root.unmount();
	});

	test("reorder by key does not re-invoke ref", async () => {
		const calls: Array<{ id: number; node: HTMLLIElement | null }> = [];
		const callbacks = new Map<number, (node: HTMLLIElement | null) => void>();
		const order = createSwitch([1, 2, 3]);

		function getCallback(id: number) {
			let callback = callbacks.get(id);
			if (!callback) {
				callback = (node) => calls.push({ id, node });
				callbacks.set(id, callback);
			}
			return callback;
		}

		function List() {
			return (
				<ul>
					{order.useSwitch().map((id) => (
						<li key={id} ref={getCallback(id)}>
							{id}
						</li>
					))}
				</ul>
			);
		}

		const { container, root } = await mount(<List />);
		await order.toggle([3, 1, 2]);

		expect(container.textContent).toBe("312");
		expect(calls).toHaveLength(3);
		root.unmount();
	});

	test("ref removed from props is detached", async () => {
		const ref = createRef<HTMLInputElement>();
		const attached = createSwitch(true);

		function App() {
			return <input ref={attached.useSwitch() ? ref : undefined} />;
		}

		const { root } = await mount(<App />);
		expect(ref.current).not.toBeNull();
		await attached.toggle(false);

		expect(ref.current).toBeNull();
		root.unmount();
	});

	test("siblings swapping refs both end attached", async () => {
		const refA = createRef<HTMLElement>();
		const refB = createRef<HTMLElement>();
		const swapped = createSwitch(false);

		function App() {
			const swap = swapped.useSwitch();
			return (
				<div>
					<i ref={swap ? refB : refA} />
					<b ref={swap ? refA : refB} />
				</div>
			);
		}

		const { container, root } = await mount(<App />);
		await swapped.toggle(true);

		expect(refA.current).toBe(container.querySelector("b"));
		expect(refB.current).toBe(container.querySelector("i"));
		root.unmount();
	});

	test("ref moving from removed subtree to new node stays attached", async () => {
		const ref = createRef<HTMLElement>();
		const first = createSwitch(false);

		function App() {
			const a = first.useSwitch();
			return (
				<div>
					<section>{a && <i ref={ref} />}</section>
					<section>{!a && <b ref={ref} />}</section>
				</div>
			);
		}

		const { container, root } = await mount(<App />);
		expect(ref.current).toBe(container.querySelector("b"));

		await first.toggle(true);
		expect(ref.current).toBe(container.querySelector("i"));

		await first.toggle(false);
		expect(ref.current).toBe(container.querySelector("b"));
		root.unmount();
	});

	test("function component receives ref as prop", async () => {
		const ref = createRef<HTMLInputElement>();

		function Field({ ref }: { ref?: Ref<HTMLInputElement> }) {
			return <input ref={ref} />;
		}

		const { container, root } = await mount(<Field ref={ref} />);

		expect(ref.current).toBe(container.querySelector("input"));
		root.unmount();
	});

	test("ref passes through memo as prop", async () => {
		const ref = createRef<HTMLInputElement>();
		const fieldRenders: number[] = [];
		const tick = createSwitch(0);

		const Field = memo(function Field({ ref }: { ref?: Ref<HTMLInputElement> }) {
			fieldRenders.push(fieldRenders.length);
			return <input ref={ref} />;
		});

		function App() {
			return (
				<div data-tick={tick.useSwitch()}>
					<Field ref={ref} />
				</div>
			);
		}

		const { container, root } = await mount(<App />);
		await tick.toggle(1);

		expect(fieldRenders).toHaveLength(1);
		expect(ref.current).toBe(container.querySelector("input"));
		root.unmount();
	});

	test("ref type follows the element", () => {
		const divRef = createRef<HTMLDivElement>();
		// @ts-expect-error ref на div не подходит для input
		const element = <input ref={divRef} />;

		expect(element).toBeDefined();
	});
});

type Handle = { focus: () => void; value: string };

function HandleOwner({ ref, value }: { ref?: Ref<Handle>; value: string }) {
	useImperativeHandle(ref, () => ({ focus: () => {}, value }), [value]);
	return <span>{value}</span>;
}

describe("useImperativeHandle", () => {
	test("sets handle and clears on unmount", async () => {
		const ref = createRef<Handle>();
		const { root } = await mount(<HandleOwner ref={ref} value="a" />);

		expect(typeof ref.current?.focus).toBe("function");
		expect(ref.current?.value).toBe("a");

		root.unmount();
		await flush();

		expect(ref.current).toBeNull();
	});

	test("recreates handle when deps change", async () => {
		const ref = createRef<Handle>();
		const handles: Array<Handle | null> = [];
		const state = createSwitch({ value: "a", tick: 0 });

		function App() {
			const { value, tick } = state.useSwitch();
			return (
				<div data-tick={tick}>
					<HandleOwner ref={ref} value={value} />
				</div>
			);
		}

		const { root } = await mount(<App />);
		handles.push(ref.current);
		await state.toggle({ value: "a", tick: 1 });
		handles.push(ref.current);
		await state.toggle({ value: "b", tick: 1 });
		handles.push(ref.current);

		expect(handles[1]).toBe(handles[0] as Handle);
		expect(handles[2]).not.toBe(handles[1] as Handle);
		expect(handles[2]?.value).toBe("b");
		root.unmount();
	});

	test("callback ref receives handle then null", async () => {
		const calls: Array<Handle | null> = [];
		const { root } = await mount(<HandleOwner ref={(handle) => calls.push(handle)} value="a" />);

		root.unmount();
		await flush();

		expect(calls).toHaveLength(2);
		expect(calls[0]?.value).toBe("a");
		expect(calls[1]).toBeNull();
	});
});
