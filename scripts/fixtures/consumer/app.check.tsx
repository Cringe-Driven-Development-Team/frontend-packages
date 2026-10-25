import { expect, test } from "bun:test";
import { createRoot, useSyncExternalStoreWithSelector } from "@cdd-team/react";
import { create } from "@cdd-team/zustand";

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

test("опубликованные архивы: компонент читает store, setState обновляет DOM", async () => {
	const useCounter = create<{ count: number }>()(() => ({ count: 0 }));
	function Counter() {
		const count = useCounter((state) => state.count);
		return <p>{count}</p>;
	}
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	root.render(<Counter />);
	await flush();
	expect(container.textContent).toBe("0");

	useCounter.setState({ count: 1 });
	await flush();
	expect(container.textContent).toBe("1");

	root.unmount();
});

test("опубликованный архив: useSyncExternalStoreWithSelector выбирает часть стора", async () => {
	let state = { count: 0, other: 0 };
	const listeners = new Set<() => void>();
	const store = {
		getState: () => state,
		setState(next: typeof state) {
			state = next;
			listeners.forEach((listener) => listener());
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
	const renders: number[] = [];
	function Counter() {
		const selection = useSyncExternalStoreWithSelector(
			store.subscribe,
			store.getState,
			(snapshot) => ({ value: snapshot.count }),
			(previous, next) => previous.value === next.value,
		);
		const value: number = selection.value;
		renders.push(value);
		return <p>{value}</p>;
	}
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	root.render(<Counter />);
	await flush();
	expect(container.textContent).toBe("0");

	store.setState({ count: 0, other: 1 });
	await flush();
	expect(renders).toHaveLength(1);

	store.setState({ count: 1, other: 1 });
	await flush();
	expect(container.textContent).toBe("1");

	root.unmount();
});
