import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	createRoot,
	memo,
	useLayoutEffect,
	useState,
	useSyncExternalStore,
	useSyncExternalStoreWithSelector,
} from "../src/index.ts";
import type { ReactElement, Root } from "../src/index.ts";

type ListSnapshot = { ids: string[]; items: Record<string, string> };
type CounterSnapshot = { count: number; other: number };
type Selection = { value: number };

const remaining: ListSnapshot = { ids: ["one"], items: { one: "one" } };

async function settle<T>(read: () => T, floorMs = 25): Promise<void> {
	const startedAt = performance.now();
	let previous = read();
	while (true) {
		await new Promise((resolve) => setTimeout(resolve, 5));
		const next = read();
		if (Object.is(next, previous) && performance.now() - startedAt >= floorMs) return;
		previous = next;
	}
}

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
	const deadline = performance.now() + timeoutMs;
	while (!condition() && performance.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

function captureThrow(): { get: () => Error | null; restore: () => void } {
	let caught: Error | null = null;
	const onUncaught = (error: unknown): void => {
		caught ??= error as Error;
	};
	const originalError = console.error;
	process.on("uncaughtException", onUncaught);
	process.on("unhandledRejection", onUncaught);
	console.error = (...args: unknown[]) => {
		if (!caught && args[0] instanceof Error) {
			caught = args[0];
		}
	};
	return {
		get: () => caught,
		restore: () => {
			process.off("uncaughtException", onUncaught);
			process.off("unhandledRejection", onUncaught);
			console.error = originalError;
		},
	};
}

async function runFirstReadProbe(...args: string[]): Promise<unknown> {
	const probe = Bun.spawn(
		["bun", "--preload", "./test/setup-dom.ts", "./test/probes/first-read.tsx", ...args],
		{ cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
	);
	const output = await new Response(probe.stdout).text();
	await probe.exited;
	return JSON.parse(output.trim().split("\n").at(-1) ?? "null");
}

function mount(element: ReactElement): { container: HTMLElement; root: Root } {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(element);
	return { container, root };
}

function createListStore() {
	let state: ListSnapshot = { ids: ["one", "two"], items: { one: "one", two: "two" } };
	const listeners = new Set<() => void>();
	return {
		getState: (): ListSnapshot => state,
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		setState(next: ListSnapshot, notify = true): void {
			state = next;
			if (notify) [...listeners].forEach((listener) => listener());
		},
		get listenerCount(): number {
			return listeners.size;
		},
	};
}

function createCounterStore(initial: CounterSnapshot = { count: 1, other: 1 }) {
	let snapshot = initial;
	const listeners = new Set<() => void>();
	const callbacks: (() => void)[] = [];
	let reads = 0;
	return {
		callbacks,
		getSnapshot: (): CounterSnapshot => {
			reads += 1;
			return snapshot;
		},
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			callbacks.push(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		setSnapshot(next: CounterSnapshot, notify = true): void {
			snapshot = next;
			if (notify) [...listeners].forEach((listener) => listener());
		},
		get listenerCount(): number {
			return listeners.size;
		},
		get readCount(): number {
			return reads;
		},
	};
}

const selectCount = (snapshot: CounterSnapshot): Selection => ({ value: snapshot.count });
const isSameValue = (previous: Selection, next: Selection): boolean =>
	previous.value === next.value;

type ListStore = ReturnType<typeof createListStore>;

function readItem(store: ListStore, id: string): string {
	const value = store.getState().items[id];
	if (value === undefined) throw new Error(`missing ${id}`);
	return value;
}

describe("исключение при повторном чтении snapshot", () => {
	test("бросающая перепроверка после layout-мутации планирует обновление", async () => {
		const store = createListStore();
		const events: string[] = [];
		function RemoveInLayout() {
			useLayoutEffect(() => {
				events.push(`layout:${store.listenerCount}`);
				store.setState(remaining, false);
			}, []);
			return null;
		}
		function Item(props: { id: string }) {
			const item = useSyncExternalStore(store.subscribe, () => readItem(store, props.id));
			events.push(`render:${item}`);
			return (
				<li>
					{item}
					{props.id === "two" ? <RemoveInLayout /> : null}
				</li>
			);
		}
		function List() {
			const snapshot = useSyncExternalStore(store.subscribe, store.getState);
			return (
				<ul>
					{snapshot.ids.map((id) => (
						<Item key={id} id={id} />
					))}
				</ul>
			);
		}
		const error = captureThrow();
		const { container, root } = mount(<List />);
		try {
			await waitFor(() => container.innerHTML === "<ul><li>one</li></ul>" || error.get() !== null);
			expect(events.slice(0, 3)).toEqual(["render:one", "render:two", "layout:1"]);
			expect(error.get()).toBeNull();
			expect(container.innerHTML).toBe("<ul><li>one</li></ul>");
			expect(store.listenerCount).toBe(2);
			root.unmount();
			expect(container.innerHTML).toBe("");
			expect(store.listenerCount).toBe(0);
		} finally {
			root.unmount();
			error.restore();
		}
	});

	test("удаление элемента у подписанного списка не бросает из setState", async () => {
		const store = createListStore();
		function Item(props: { id: string }) {
			const item = useSyncExternalStore(store.subscribe, () => readItem(store, props.id));
			return <li>{item}</li>;
		}
		function List() {
			const snapshot = useSyncExternalStore(store.subscribe, store.getState);
			return (
				<ul>
					{snapshot.ids.map((id) => (
						<Item key={id} id={id} />
					))}
				</ul>
			);
		}
		const error = captureThrow();
		const { container, root } = mount(<List />);
		try {
			await waitFor(() => store.listenerCount === 3);
			expect(container.innerHTML).toBe("<ul><li>one</li><li>two</li></ul>");
			expect(() => store.setState(remaining)).not.toThrow();
			await waitFor(() => container.innerHTML === "<ul><li>one</li></ul>" || error.get() !== null);
			expect(error.get()).toBeNull();
			expect(container.innerHTML).toBe("<ul><li>one</li></ul>");
			expect(store.listenerCount).toBe(2);
			root.unmount();
			expect(container.innerHTML).toBe("");
			expect(store.listenerCount).toBe(0);
		} finally {
			root.unmount();
			error.restore();
		}
	});

	test("ошибка первого чтения в render доходит до вызывающего кода", async () => {
		expect(await runFirstReadProbe()).toEqual({
			error: "first render read",
			html: "",
			subscriptions: 0,
			reads: 1,
			subscriptionsAfterUnmount: 0,
		});
	});
});

describe("useSyncExternalStoreWithSelector", () => {
	test("кеширует новый объект селектора при неизменном snapshot", async () => {
		const store = createCounterStore();
		const selections: Selection[] = [];
		let selectorCalls = 0;
		const selector = (snapshot: CounterSnapshot): Selection => {
			selectorCalls += 1;
			return { value: snapshot.count };
		};
		function Reader(props: { phase: number }) {
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				selector,
			);
			selections.push(selection);
			return <span>{`${props.phase}:${selection.value}`}</span>;
		}
		const { container, root } = mount(<Reader phase={0} />);
		try {
			await waitFor(() => container.textContent === "0:1");
			await settle(() => selections.length);
			expect(selections).toHaveLength(1);
			store.setSnapshot(store.getSnapshot());
			await settle(() => selections.length);
			expect(selections).toHaveLength(1);
			root.render(<Reader phase={1} />);
			await waitFor(() => container.textContent === "1:1");
			expect(selections).toHaveLength(2);
			expect(selections[1]).toBe(selections[0]);
			expect(selectorCalls).toBe(1);
		} finally {
			root.unmount();
		}
	});

	test("равенство пропускает невыбранные обновления и отображает выбранные", async () => {
		const store = createCounterStore();
		const selections: Selection[] = [];
		function Reader() {
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				selectCount,
				isSameValue,
			);
			selections.push(selection);
			return <span>{selection.value}</span>;
		}
		const { container, root } = mount(<Reader />);
		try {
			await waitFor(() => container.textContent === "1");
			store.setSnapshot({ count: 1, other: 2 });
			await settle(() => selections.length);
			expect(selections).toHaveLength(1);
			expect(container.textContent).toBe("1");
			store.setSnapshot({ count: 2, other: 2 });
			await waitFor(() => container.textContent === "2");
			expect(selections).toHaveLength(2);
			expect(selections[1]).not.toBe(selections[0]);
		} finally {
			root.unmount();
		}
	});

	test("по умолчанию сравнивает выбранные значения через Object.is", async () => {
		const store = createCounterStore({ count: Number.NaN, other: 1 });
		const selector = (snapshot: CounterSnapshot): number => snapshot.count;
		const renders: number[] = [];
		function Reader() {
			renders.push(1);
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				selector,
			);
			return <span>{Object.is(selection, -0) ? "-0" : String(selection)}</span>;
		}
		const { container, root } = mount(<Reader />);
		try {
			await waitFor(() => container.textContent === "NaN");
			store.setSnapshot({ count: Number.NaN, other: 2 });
			await settle(() => renders.length);
			expect(renders).toHaveLength(1);
			store.setSnapshot({ count: 0, other: 2 });
			await waitFor(() => container.textContent === "0");
			store.setSnapshot({ count: -0, other: 2 });
			await waitFor(() => container.textContent === "-0");
			expect(renders).toHaveLength(3);
		} finally {
			root.unmount();
		}
	});

	test("новый selector переиспользует только равную committed selection", async () => {
		const store = createCounterStore();
		const selections: Selection[] = [];
		function Reader(props: { phase: number; selector: (snapshot: CounterSnapshot) => Selection }) {
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				props.selector,
				isSameValue,
			);
			selections.push(selection);
			return <span>{`${props.phase}:${selection.value}`}</span>;
		}
		const { container, root } = mount(<Reader phase={0} selector={(s) => ({ value: s.count })} />);
		try {
			await waitFor(() => container.textContent === "0:1");
			root.render(<Reader phase={1} selector={(s) => ({ value: s.other })} />);
			await waitFor(() => container.textContent === "1:1");
			expect(selections).toHaveLength(2);
			expect(selections[1]).toBe(selections[0]);
			root.render(<Reader phase={2} selector={(s) => ({ value: s.other * 10 })} />);
			await waitFor(() => container.textContent === "2:10");
			expect(selections).toHaveLength(3);
			expect(selections[2]).not.toBe(selections[1]);
		} finally {
			root.unmount();
		}
	});

	test("новый isEqual пересчитывает против committed selection", async () => {
		const store = createCounterStore();
		const selections: Selection[] = [];
		const unequal = (): boolean => false;
		function Reader(props: {
			phase: number;
			isEqual: (previous: Selection, next: Selection) => boolean;
		}) {
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				selectCount,
				props.isEqual,
			);
			selections.push(selection);
			return <span>{`${props.phase}:${selection.value}`}</span>;
		}
		const { container, root } = mount(<Reader phase={0} isEqual={unequal} />);
		try {
			await waitFor(() => container.textContent === "0:1");
			root.render(<Reader phase={1} isEqual={isSameValue} />);
			await waitFor(() => container.textContent === "1:1");
			expect(selections).toHaveLength(2);
			expect(selections[1]).toBe(selections[0]);
			root.render(<Reader phase={2} isEqual={unequal} />);
			await waitFor(() => container.textContent === "2:1");
			expect(selections).toHaveLength(3);
			expect(selections[2]).not.toBe(selections[1]);
		} finally {
			root.unmount();
		}
	});

	test("inline-селектор с объектом и isEqual не зацикливается", async () => {
		const store = createCounterStore();
		let commits = 0;
		function Reader() {
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				(snapshot) => ({ value: snapshot.count }),
				(previous, next) => previous.value === next.value,
			);
			useLayoutEffect(() => {
				commits += 1;
			});
			return <span>{selection.value}</span>;
		}
		const { container, root } = mount(<Reader />);
		try {
			await waitFor(() => container.textContent === "1");
			await settle(() => commits);
			expect(commits).toBe(1);
			store.setSnapshot({ count: 1, other: 2 });
			await settle(() => commits);
			expect(commits).toBe(1);
		} finally {
			root.unmount();
		}
	});

	test("хук внутри memo обновляется по уведомлению стора", async () => {
		const store = createCounterStore();
		const Reader = memo(function Reader() {
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				selectCount,
				isSameValue,
			);
			return <span>{selection.value}</span>;
		});
		const { container, root } = mount(<Reader />);
		try {
			await waitFor(() => container.textContent === "1");
			store.setSnapshot({ count: 5, other: 1 });
			await waitFor(() => container.textContent === "5");
			expect(container.textContent).toBe("5");
		} finally {
			root.unmount();
		}
	});

	test("два селектора одного стора в одном компоненте независимы", async () => {
		const store = createCounterStore();
		const counts: Selection[] = [];
		const others: Selection[] = [];
		const selectOther = (snapshot: CounterSnapshot): Selection => ({ value: snapshot.other });
		function Reader() {
			const count = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				selectCount,
				isSameValue,
			);
			const other = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				selectOther,
				isSameValue,
			);
			counts.push(count);
			others.push(other);
			return <span>{`${count.value}:${other.value}`}</span>;
		}
		const { container, root } = mount(<Reader />);
		try {
			await waitFor(() => container.textContent === "1:1");
			store.setSnapshot({ count: 1, other: 2 });
			await waitFor(() => container.textContent === "1:2");
			expect(counts.at(-1)).toBe(counts[0]);
			expect(others.at(-1)).not.toBe(others[0]);
			store.setSnapshot({ count: 3, other: 2 });
			await waitFor(() => container.textContent === "3:2");
			expect(others.at(-1)).toBe(others.at(-2));
		} finally {
			root.unmount();
		}
	});
});

describe("useSyncExternalStoreWithSelector: гонки и жизненный цикл", () => {
	test("подхватывает обновление в layout effect ребёнка до подписки", async () => {
		const store = createCounterStore({ count: 0, other: 0 });
		const events: string[] = [];
		const subscribe = (listener: () => void): (() => void) => {
			events.push("subscribe");
			return store.subscribe(listener);
		};
		function Child() {
			useLayoutEffect(() => {
				events.push(`change:${store.listenerCount}`);
				store.setSnapshot({ count: 1, other: 0 });
			}, []);
			return null;
		}
		function Reader() {
			const selection = useSyncExternalStoreWithSelector(
				subscribe,
				store.getSnapshot,
				selectCount,
				isSameValue,
			);
			events.push(`render:${selection.value}`);
			return (
				<div>
					<span>{selection.value}</span>
					<Child />
				</div>
			);
		}
		const { container, root } = mount(<Reader />);
		try {
			await waitFor(() => container.textContent === "1");
			expect(events.slice(0, 3)).toEqual(["render:0", "change:0", "subscribe"]);
			expect(container.textContent).toBe("1");
			expect(store.listenerCount).toBe(1);
			expect(store.callbacks).toHaveLength(1);
		} finally {
			root.unmount();
		}
	});

	for (const phase of ["mount", "update"] as const) {
		test(`прерванный ${phase} с DOM-less корнем не коммитит смешанные selection`, async () => {
			const store = createCounterStore({ count: 0, other: 0 });
			const events: string[] = [];
			const committed: string[] = [];
			const controls = { paused: false, startUpdate: (): void => {} };
			const container = document.createElement("div");
			document.body.appendChild(container);
			const root = createRoot(container);
			const interruptOnce = (): void => {
				if (controls.paused) return;
				controls.paused = true;
				queueMicrotask(() => {
					events.push("change");
					store.setSnapshot({ count: 1, other: 0 }, false);
				});
				const until = performance.now() + 8;
				while (performance.now() < until) {
					continue;
				}
			};
			function A(props: { pause: boolean }) {
				const selection = useSyncExternalStoreWithSelector(
					store.subscribe,
					store.getSnapshot,
					selectCount,
					isSameValue,
				);
				events.push(`A${selection.value}`);
				useLayoutEffect(() => {
					committed.push(container.textContent ?? "");
				});
				if (props.pause) interruptOnce();
				return <span>{selection.value}</span>;
			}
			function B() {
				const selection = useSyncExternalStoreWithSelector(
					store.subscribe,
					store.getSnapshot,
					selectCount,
					isSameValue,
				);
				events.push(`B${selection.value}`);
				useLayoutEffect(() => {
					committed.push(container.textContent ?? "");
				});
				return <span>{selection.value}</span>;
			}
			function App() {
				const [pause, setPause] = useState(phase === "mount");
				useLayoutEffect(() => {
					controls.startUpdate = () => setPause(true);
				}, []);
				return (
					<>
						<A pause={pause} />
						<B />
					</>
				);
			}
			try {
				root.render(<App />);
				if (phase === "update") {
					await waitFor(() => container.textContent === "00");
					expect(container.textContent).toBe("00");
					events.length = 0;
					committed.length = 0;
					controls.startUpdate();
				}
				await waitFor(() => committed.length > 0);
				expect(events.slice(0, 3)).toEqual(["A0", "change", "B1"]);
				expect(committed).toEqual(["11", "11"]);
				expect(container.textContent).toBe("11");
				expect(store.listenerCount).toBe(2);
				expect(store.callbacks).toHaveLength(2);
			} finally {
				root.unmount();
			}
		});
	}

	test("смена стора и unmount игнорируют очищенные callback", async () => {
		const first = createCounterStore({ count: 1, other: 0 });
		const second = createCounterStore({ count: 10, other: 0 });
		const renders: number[] = [];
		function Reader(props: { store: typeof first }) {
			renders.push(1);
			const selection = useSyncExternalStoreWithSelector(
				props.store.subscribe,
				props.store.getSnapshot,
				selectCount,
				isSameValue,
			);
			return <span>{selection.value}</span>;
		}
		const { container, root } = mount(<Reader store={first} />);
		const counters = (): string => `${first.readCount}:${second.readCount}:${renders.length}`;
		try {
			await waitFor(() => container.textContent === "1");
			const oldCallback = first.callbacks[0];
			expect(typeof oldCallback).toBe("function");
			root.render(<Reader store={second} />);
			await waitFor(() => container.textContent === "10");
			expect(first.listenerCount).toBe(0);
			expect(second.listenerCount).toBe(1);
			first.setSnapshot({ count: 2, other: 0 }, false);
			second.setSnapshot({ count: 11, other: 0 }, false);
			const afterSwitch = counters();
			oldCallback?.();
			await settle(counters);
			expect(counters()).toBe(afterSwitch);
			expect(container.textContent).toBe("10");
			const newCallback = second.callbacks[0];
			expect(typeof newCallback).toBe("function");
			newCallback?.();
			await waitFor(() => container.textContent === "11");
			expect(container.textContent).toBe("11");
			root.unmount();
			expect(container.textContent).toBe("");
			expect(second.listenerCount).toBe(0);
			first.setSnapshot({ count: 3, other: 0 }, false);
			second.setSnapshot({ count: 12, other: 0 }, false);
			const afterUnmount = counters();
			oldCallback?.();
			newCallback?.();
			await settle(counters);
			expect(counters()).toBe(afterUnmount);
			expect(container.textContent).toBe("");
		} finally {
			root.unmount();
		}
	});

	test("кеши и подписки независимы в двух корнях", async () => {
		const store = createCounterStore();
		const tenfold = (snapshot: CounterSnapshot): Selection => ({ value: snapshot.count * 10 });
		const selections: Selection[][] = [[], []];
		function Reader(props: { index: number; selector: typeof selectCount }) {
			const selection = useSyncExternalStoreWithSelector(
				store.subscribe,
				store.getSnapshot,
				props.selector,
				isSameValue,
			);
			selections[props.index]?.push(selection);
			return <span>{selection.value}</span>;
		}
		const first = mount(<Reader index={0} selector={selectCount} />);
		const second = mount(<Reader index={1} selector={selectCount} />);
		try {
			await waitFor(
				() => first.container.textContent === "1" && second.container.textContent === "1",
			);
			expect(store.listenerCount).toBe(2);
			expect(selections[0]).toHaveLength(1);
			expect(selections[1]).toHaveLength(1);
			expect(selections[0]?.[0]).not.toBe(selections[1]?.[0]);
			first.root.render(<Reader index={0} selector={tenfold} />);
			await waitFor(() => first.container.textContent === "10");
			expect(second.container.textContent).toBe("1");
			expect(selections[1]).toHaveLength(1);
			store.setSnapshot({ count: 2, other: 1 });
			await waitFor(
				() => first.container.textContent === "20" && second.container.textContent === "2",
			);
			expect(first.container.textContent).toBe("20");
			expect(second.container.textContent).toBe("2");
			first.root.unmount();
			expect(store.listenerCount).toBe(1);
			store.setSnapshot({ count: 3, other: 1 });
			await waitFor(() => second.container.textContent === "3");
			expect(first.container.textContent).toBe("");
			expect(second.container.textContent).toBe("3");
		} finally {
			first.root.unmount();
			second.root.unmount();
		}
		expect(store.listenerCount).toBe(0);
	});

	test("бросающий селектор при первом mount повторяет render", async () => {
		const store = createListStore();
		const events: string[] = [];
		const controls = { removed: false };
		function Item(props: { id: string }) {
			const item = useSyncExternalStoreWithSelector(store.subscribe, store.getState, (snapshot) => {
				const value = snapshot.items[props.id];
				if (value === undefined) throw new Error(`missing ${props.id}`);
				return value;
			});
			events.push(`render:${item}`);
			return <li>{item}</li>;
		}
		function List() {
			const snapshot = useSyncExternalStore(store.subscribe, store.getState);
			return (
				<ul>
					{snapshot.ids.map((id) => (
						<Item key={id} id={id} />
					))}
				</ul>
			);
		}
		function RemoveLater() {
			if (!controls.removed) {
				controls.removed = true;
				events.push("remove:two");
				store.setState(remaining);
			}
			return null;
		}
		const error = captureThrow();
		const { container, root } = mount(
			<>
				<List />
				<RemoveLater />
			</>,
		);
		try {
			await waitFor(() => container.innerHTML === "<ul><li>one</li></ul>" || error.get() !== null);
			expect(events.slice(0, 3)).toEqual(["render:one", "render:two", "remove:two"]);
			expect({
				error: error.get()?.message ?? null,
				html: container.innerHTML,
				subscriptions: store.listenerCount,
			}).toEqual({ error: null, html: "<ul><li>one</li></ul>", subscriptions: 2 });
			root.unmount();
			expect(container.innerHTML).toBe("");
			expect(store.listenerCount).toBe(0);
		} finally {
			root.unmount();
			error.restore();
		}
	});

	test("удаление выбранного элемента у подписанного списка не бросает из setState", async () => {
		const store = createListStore();
		function Item(props: { id: string }) {
			const item = useSyncExternalStoreWithSelector(store.subscribe, store.getState, (snapshot) => {
				const value = snapshot.items[props.id];
				if (value === undefined) throw new Error(`missing ${props.id}`);
				return value;
			});
			return <li>{item}</li>;
		}
		function List() {
			const snapshot = useSyncExternalStore(store.subscribe, store.getState);
			return (
				<ul>
					{snapshot.ids.map((id) => (
						<Item key={id} id={id} />
					))}
				</ul>
			);
		}
		const error = captureThrow();
		const { container, root } = mount(<List />);
		try {
			await waitFor(() => store.listenerCount === 3);
			expect(container.innerHTML).toBe("<ul><li>one</li><li>two</li></ul>");
			expect(() => store.setState(remaining)).not.toThrow();
			await waitFor(() => container.innerHTML === "<ul><li>one</li></ul>" || error.get() !== null);
			expect(error.get()).toBeNull();
			expect(container.innerHTML).toBe("<ul><li>one</li></ul>");
			expect(store.listenerCount).toBe(2);
		} finally {
			root.unmount();
			error.restore();
		}
	});
});
