import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createRoot, useLayoutEffect, useSyncExternalStore } from "../src/index.ts";
import type { ReactElement, Root } from "../src/index.ts";

type ListSnapshot = { ids: string[]; items: Record<string, string> };

const remaining: ListSnapshot = { ids: ["one"], items: { one: "one" } };

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
