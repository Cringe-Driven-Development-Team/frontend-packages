import { describe, expect, test } from "bun:test";
import { createRoot, useLayoutEffect, type ReactElement } from "@cdd-team/react";
import { create, createStore, useShallow, useStore } from "@cdd-team/zustand";

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function mount(element: ReactElement) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(element);
	return { container, root };
}

function blockFor(ms: number): void {
	const until = performance.now() + ms;
	while (performance.now() < until) {
		continue;
	}
}

describe("@cdd-team/react + @cdd-team/zustand", () => {
	test("компонент читает store через хук, setState обновляет DOM", async () => {
		const useCounter = create<{ count: number }>()(() => ({ count: 0 }));
		function Counter() {
			const count = useCounter((state) => state.count);
			return <p>{count}</p>;
		}
		const { container, root } = mount(<Counter />);
		await flush();
		expect(container.textContent).toBe("0");

		useCounter.setState({ count: 1 });
		await flush();
		expect(container.textContent).toBe("1");

		root.unmount();
	});

	test("обновление между render и подпиской не теряется (bound hook)", async () => {
		const useCounter = create<{ count: number }>()(() => ({ count: 0 }));
		function Child() {
			useLayoutEffect(() => {
				useCounter.setState({ count: 42 });
			}, []);
			return null;
		}
		function Parent() {
			const count = useCounter((state) => state.count);
			return (
				<div>
					<p>{count}</p>
					<Child />
				</div>
			);
		}
		const { container, root } = mount(<Parent />);
		await flush();
		expect(container.textContent).toBe("42");

		root.unmount();
	});

	test("обновление во время прерванного render не фиксирует смешанный DOM", async () => {
		const store = createStore<{ count: number }>()(() => ({ count: 0 }));
		const committed: string[] = [];
		let paused = false;
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);
		function A() {
			const count = useStore(store, (state) => state.count);
			useLayoutEffect(() => {
				committed.push(container.textContent ?? "");
			});
			if (!paused) {
				paused = true;
				queueMicrotask(() => store.setState({ count: 1 }));
				blockFor(8);
			}
			return <span>{count}</span>;
		}
		function B() {
			const count = useStore(store, (state) => state.count);
			useLayoutEffect(() => {
				committed.push(container.textContent ?? "");
			});
			return <span>{count}</span>;
		}
		root.render(
			<>
				<A />
				<B />
			</>,
		);
		await flush();

		expect(committed.length).toBeGreaterThan(0);
		for (const text of committed) {
			expect(text).toBe("11");
		}
		expect(container.textContent).toBe("11");

		root.unmount();
	});

	test("прерванный render не оставляет подписок после unmount", async () => {
		const store = createStore<{ count: number }>()(() => ({ count: 0 }));
		let active = 0;
		const subscribe = store.subscribe;
		store.subscribe = (listener) => {
			active += 1;
			const unsubscribe = subscribe(listener);
			return () => {
				active -= 1;
				unsubscribe();
			};
		};
		let paused = false;
		function Reader() {
			const count = useStore(store, (state) => state.count);
			if (!paused) {
				paused = true;
				queueMicrotask(() => store.setState({ count: 1 }));
				blockFor(8);
			}
			return <p>{count}</p>;
		}
		const { container, root } = mount(
			<div>
				<Reader />
				<Reader />
			</div>,
		);
		await flush();
		expect(container.textContent).toBe("11");
		expect(active).toBe(2);

		root.unmount();
		await flush();
		expect(active).toBe(0);
	});

	test("изменение выбранного и невыбранного поля", async () => {
		const useCounter = create<{ count: number; step: number }>()(() => ({ count: 0, step: 1 }));
		let renders = 0;
		function CountOnly() {
			renders += 1;
			return <p>{useCounter((state) => state.count)}</p>;
		}
		const { container, root } = mount(<CountOnly />);
		await flush();
		expect(renders).toBe(1);

		useCounter.setState({ step: 2 });
		await flush();
		expect(renders).toBe(1);

		useCounter.setState({ count: 3 });
		await flush();
		expect(renders).toBe(2);
		expect(container.textContent).toBe("3");

		root.unmount();
	});

	test("нестабильный объектный селектор не зацикливает render", async () => {
		const useCounter = create<{ count: number }>()(() => ({ count: 0 }));
		let renders = 0;
		function Broken() {
			renders += 1;
			const { count } = useCounter((state) => ({ count: state.count }));
			return <p>{count}</p>;
		}
		const { container, root } = mount(<Broken />);
		await flush();
		expect(renders).toBe(1);

		useCounter.setState({ count: 1 });
		await flush();
		expect(renders).toBe(2);
		expect(container.textContent).toBe("1");

		root.unmount();
	});

	test("useShallow через bound hook перерисовывает только на выбранные поля", async () => {
		const useProfile = create<{ name: string; age: number }>()(() => ({
			name: "Ерофей",
			age: 19,
		}));
		let renders = 0;
		function Name() {
			renders += 1;
			const { name } = useProfile(useShallow((state) => ({ name: state.name })));
			return <p>{name}</p>;
		}
		const { container, root } = mount(<Name />);
		await flush();
		expect(renders).toBe(1);

		useProfile.setState({ age: 20 });
		await flush();
		expect(renders).toBe(1);

		useProfile.setState({ name: "Денис" });
		await flush();
		expect(renders).toBe(2);
		expect(container.textContent).toBe("Денис");

		root.unmount();
	});
});
