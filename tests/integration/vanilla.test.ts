import { describe, expect, test } from "bun:test";
import { createStore } from "@cdd-team/zustand/vanilla";

describe("@cdd-team/zustand/vanilla", () => {
	test("подписчик получает новое и прежнее состояние", () => {
		const store = createStore<{ count: number }>(() => ({ count: 0 }));
		const seen: Array<[number, number]> = [];
		const unsubscribe = store.subscribe((state, prev) => seen.push([state.count, prev.count]));

		store.setState({ count: 2 });
		unsubscribe();
		store.setState({ count: 3 });

		expect(seen).toEqual([[2, 0]]);
		expect(store.getState().count).toBe(3);
	});
});
