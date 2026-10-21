/* oxlint-disable react/globals, react/immutability -- счётчики рендеров и сеттеры вынесены наружу */
import { describe, expect, test } from "bun:test";
import { createRoot, memo, useLayoutEffect, useState, useSyncExternalStore } from "../src/index.ts";
import type { ReactElement, Root } from "../src/index.ts";

async function flush(): Promise<void> {
	for (let i = 0; i < 10; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

async function mount(element: ReactElement): Promise<{ container: HTMLElement; root: Root }> {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(element);
	await flush();
	return { container, root };
}

type TestStore<State> = {
	getState: () => State;
	setState: (updater: State | ((state: State) => State)) => void;
	subscribe: (listener: () => void) => () => void;
	notify: () => void;
	listenerCount: () => number;
	subscribeCalls: number;
	unsubscribeCalls: number;
};

function createTestStore<State>(initial: State): TestStore<State> {
	let state = initial;
	const listeners = new Set<() => void>();
	const store: TestStore<State> = {
		getState: () => state,
		setState(updater) {
			const next =
				typeof updater === "function" ? (updater as (state: State) => State)(state) : updater;
			if (Object.is(next, state)) {
				return;
			}
			state = next;
			store.notify();
		},
		subscribe(listener) {
			store.subscribeCalls += 1;
			listeners.add(listener);
			return () => {
				store.unsubscribeCalls += 1;
				listeners.delete(listener);
			};
		},
		notify: () => [...listeners].forEach((listener) => listener()),
		listenerCount: () => listeners.size,
		subscribeCalls: 0,
		unsubscribeCalls: 0,
	};
	return store;
}

describe("useSyncExternalStore", () => {
	test("renders current snapshot and updates on change", async () => {
		const store = createTestStore(0);
		function Reader() {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			return <p>{value}</p>;
		}

		const { container, root } = await mount(<Reader />);
		expect(container.textContent).toBe("0");

		store.setState(1);
		await flush();

		expect(container.textContent).toBe("1");
		root.unmount();
	});

	test("change between render and subscribe is not lost", async () => {
		const store = createTestStore(0);
		let mutated = false;
		function EarlyMutator() {
			useLayoutEffect(() => {
				if (!mutated) {
					mutated = true;
					store.setState(1);
				}
			}, []);
			return <span />;
		}
		function Reader() {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			return <p>{value}</p>;
		}

		const { container, root } = await mount(
			<div>
				<EarlyMutator />
				<Reader />
			</div>,
		);

		expect(mutated).toBe(true);
		expect(container.querySelector("p")?.textContent).toBe("1");
		root.unmount();
	});

	test("resubscribes when subscribe changes", async () => {
		const storeA = createTestStore("a");
		const storeB = createTestStore("b");
		let renders = 0;
		let useB: (value: boolean) => void = () => {};
		function Reader() {
			const [isB, setIsB] = useState(false);
			useB = setIsB;
			const store = isB ? storeB : storeA;
			const value = useSyncExternalStore(store.subscribe, store.getState);
			renders += 1;
			return <p>{value}</p>;
		}

		const { container, root } = await mount(<Reader />);
		useB(true);
		await flush();

		expect(container.textContent).toBe("b");
		expect(storeA.unsubscribeCalls).toBe(1);
		expect(storeA.listenerCount()).toBe(0);
		expect(storeB.listenerCount()).toBe(1);

		const rendersBefore = renders;
		storeA.setState("a2");
		await flush();
		expect(renders).toBe(rendersBefore);
		expect(container.textContent).toBe("b");

		storeB.setState("b2");
		await flush();
		expect(container.textContent).toBe("b2");
		root.unmount();
	});

	test("getSnapshot change shows new value without resubscribe", async () => {
		const store = createTestStore({ a: "a", b: "b" });
		const getA = () => store.getState().a;
		const getB = () => store.getState().b;
		let useB: (value: boolean) => void = () => {};
		function Reader() {
			const [isB, setIsB] = useState(false);
			useB = setIsB;
			const value = useSyncExternalStore(store.subscribe, isB ? getB : getA);
			return <p>{value}</p>;
		}

		const { container, root } = await mount(<Reader />);
		useB(true);
		await flush();

		expect(container.textContent).toBe("b");
		expect(store.subscribeCalls).toBe(1);

		store.setState((state) => ({ ...state, b: "b2" }));
		await flush();
		expect(container.textContent).toBe("b2");
		root.unmount();
	});

	test("inline getSnapshot does not resubscribe", async () => {
		const store = createTestStore({ count: 0 });
		let renders = 0;
		function Reader() {
			const count = useSyncExternalStore(store.subscribe, () => store.getState().count);
			renders += 1;
			return <p>{count}</p>;
		}

		const { container, root } = await mount(<Reader />);
		for (let i = 1; i <= 3; i += 1) {
			store.setState({ count: i });
			await flush();
		}

		expect(container.textContent).toBe("3");
		expect(store.subscribeCalls).toBe(1);
		expect(renders).toBe(1 + 3);
		root.unmount();
	});

	test("unmount unsubscribes", async () => {
		const store = createTestStore(0);
		let renders = 0;
		let setShow: (value: boolean) => void = () => {};
		function Reader() {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			renders += 1;
			return <p>{value}</p>;
		}
		function Parent() {
			const [show, nextSetShow] = useState(true);
			setShow = nextSetShow;
			return <div>{show ? <Reader /> : null}</div>;
		}

		const { root } = await mount(<Parent />);
		expect(store.listenerCount()).toBe(1);

		setShow(false);
		await flush();
		expect(store.listenerCount()).toBe(0);

		const rendersBefore = renders;
		store.setState(1);
		await flush();
		expect(renders).toBe(rendersBefore);
		root.unmount();
	});

	test("root.unmount unsubscribes", async () => {
		const store = createTestStore(0);
		function Reader() {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			return <p>{value}</p>;
		}

		const { root } = await mount(<Reader />);
		expect(store.listenerCount()).toBe(1);

		root.unmount();
		expect(store.listenerCount()).toBe(0);
		store.setState(1);
		await flush();
	});

	test("unmounting one reader keeps the other subscribed", async () => {
		const store = createTestStore(0);
		let setShow: (value: boolean) => void = () => {};
		function Reader({ label }: { label: string }) {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			return (
				<p class={label}>
					{label}:{value}
				</p>
			);
		}
		function Parent() {
			const [show, nextSetShow] = useState(true);
			setShow = nextSetShow;
			return (
				<div>
					<Reader label="first" />
					{show ? <Reader label="second" /> : null}
				</div>
			);
		}

		const { container, root } = await mount(<Parent />);
		setShow(false);
		await flush();
		expect(store.listenerCount()).toBe(1);

		store.setState(5);
		await flush();
		expect(container.querySelector(".first")?.textContent).toBe("first:5");
		expect(container.querySelector(".second")).toBeNull();
		root.unmount();
	});

	test("same snapshot does not re-render", async () => {
		const store = createTestStore({ count: 0 });
		let renders = 0;
		function Reader() {
			const state = useSyncExternalStore(store.subscribe, store.getState);
			renders += 1;
			return <p>{state.count}</p>;
		}

		const { root } = await mount(<Reader />);
		expect(renders).toBe(1);

		store.setState((state) => state);
		store.notify();
		await flush();

		expect(renders).toBe(1);
		root.unmount();
	});

	test("one store change renders each reader once", async () => {
		const store = createTestStore(0);
		const renders = { first: 0, second: 0 };
		function Reader({ label }: { label: "first" | "second" }) {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			renders[label] += 1;
			return <p>{value}</p>;
		}

		const { root } = await mount(
			<div>
				<Reader label="first" />
				<Reader label="second" />
			</div>,
		);
		store.setState(1);
		await flush();

		expect(renders).toEqual({ first: 2, second: 2 });
		root.unmount();
	});

	test("reader under bailed-out memo parent updates", async () => {
		const store = createTestStore(0);
		let memoRenders = 0;
		function Reader() {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			return <p>{value}</p>;
		}
		const MemoParent = memo(function MemoParent() {
			memoRenders += 1;
			return <Reader />;
		});

		const { container, root } = await mount(<MemoParent />);
		store.setState(1);
		await flush();

		expect(container.textContent).toBe("1");
		expect(memoRenders).toBe(1);
		root.unmount();
	});
});

describe("stale commit", () => {
	function createReader(store: TestStore<number>, committed: number[]) {
		return function Reader() {
			const value = useSyncExternalStore(store.subscribe, store.getState);
			useLayoutEffect(() => {
				committed.push(value);
			});
			return <p>{value}</p>;
		};
	}

	test("store change during later sibling render on mount", async () => {
		const store = createTestStore(0);
		const committed: number[] = [];
		const Reader = createReader(store, committed);
		let mutated = false;
		function Mutator() {
			if (!mutated) {
				mutated = true;
				store.setState(1);
			}
			return <span />;
		}

		const { container, root } = await mount(
			<div>
				<Reader />
				<Mutator />
			</div>,
		);

		expect(committed).toEqual([1]);
		expect(container.querySelector("p")?.textContent).toBe("1");
		root.unmount();
	});

	test("store change during later sibling render on update", async () => {
		const store = createTestStore(0);
		const committed: number[] = [];
		const Reader = createReader(store, committed);
		let mutated = false;
		let setTick: (value: number) => void = () => {};
		function Mutator({ tick }: { tick: number }) {
			if (tick === 1 && !mutated) {
				mutated = true;
				store.setState(1);
			}
			return <span />;
		}
		function Parent() {
			const [tick, nextSetTick] = useState(0);
			setTick = nextSetTick;
			return (
				<div>
					<Reader />
					<Mutator tick={tick} />
				</div>
			);
		}

		const { container, root } = await mount(<Parent />);
		setTick(1);
		await flush();

		expect(mutated).toBe(true);
		expect(committed).toEqual([0, 1]);
		expect(container.querySelector("p")?.textContent).toBe("1");
		root.unmount();
	});

	test("interrupted renders leave no extra listeners", async () => {
		const store = createTestStore(0);
		const committed: number[] = [];
		const Reader = createReader(store, committed);
		const mutatedOn = new Set<number>();
		let setTick: (value: number) => void = () => {};
		function Mutator({ tick }: { tick: number }) {
			if (!mutatedOn.has(tick)) {
				mutatedOn.add(tick);
				store.setState((value) => value + 1);
			}
			return <span />;
		}
		function Parent() {
			const [tick, nextSetTick] = useState(0);
			setTick = nextSetTick;
			return (
				<div>
					<Reader />
					<Reader />
					<Mutator tick={tick} />
				</div>
			);
		}

		const { root } = await mount(<Parent />);
		for (let tick = 1; tick <= 3; tick += 1) {
			setTick(tick);
			await flush();
		}

		expect(store.getState()).toBe(4);
		expect(store.listenerCount()).toBe(2);
		expect(store.subscribeCalls - store.unsubscribeCalls).toBe(2);
		expect(committed.slice(-2)).toEqual([4, 4]);
		root.unmount();
	});
});
