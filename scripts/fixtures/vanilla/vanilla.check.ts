import { expect, test } from "bun:test";
import { createStore } from "@cdd-team/zustand/vanilla";

test("опубликованный архив: vanilla работает без React", () => {
	const store = createStore<{ count: number }>(() => ({ count: 0 }));
	let notified = 0;
	store.subscribe(() => {
		notified += 1;
	});

	store.setState({ count: 1 });

	expect(store.getState().count).toBe(1);
	expect(notified).toBe(1);
});
