import { createRoot, type ReactElement } from "@cdd-team/react";
import type { StoreApi } from "../../src/vanilla/index.ts";

export async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

export function countSubscriptions<T>(store: StoreApi<T>): { readonly active: number } {
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
	return {
		get active() {
			return active;
		},
	};
}

// Первый вызов в render планирует обновление стора и держит поток дольше кванта work loop, чтобы render прервался.
export function createInterrupter(update: () => void): () => void {
	let done = false;
	return () => {
		if (done) {
			return;
		}
		done = true;
		queueMicrotask(update);
		const until = performance.now() + 8;
		while (performance.now() < until) {
			continue;
		}
	};
}

export async function mount(element: ReactElement) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(element);
	await flush();

	return {
		container,
		unmount: async () => {
			root.unmount();
			await flush();
		},
	};
}
