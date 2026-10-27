import { describe, expect, test } from "bun:test";
import { createBrowserHistory, createMemoryHistory } from "../src/index.ts";

describe("createMemoryHistory", () => {
	test("push отрезает записи впереди, back и forward ходят по истории", () => {
		const history = createMemoryHistory({ initialEntries: ["/a", "/b"], initialIndex: 0 });

		history.push("/c?x=1#top", { from: "a" });
		expect(history.location).toEqual({
			pathname: "/c",
			search: "?x=1",
			hash: "#top",
			state: { from: "a" },
		});

		history.back();
		expect(history.location.pathname).toBe("/a");
		history.forward();
		expect(history.location.pathname).toBe("/c");
		history.forward();
		expect(history.location.pathname).toBe("/c");
	});

	test("слушатель вызывается при переходах по истории, но не при push и replace", () => {
		const history = createMemoryHistory();
		let calls = 0;
		const unsubscribe = history.subscribe(() => {
			calls += 1;
		});

		history.push("/a");
		history.replace("/b");
		expect(calls).toBe(0);

		history.back();
		expect(calls).toBe(1);

		unsubscribe();
		history.forward();
		expect(calls).toBe(1);
	});
});

test("createBrowserHistory пишет в window.history и слушает popstate", () => {
	const history = createBrowserHistory();
	let calls = 0;
	const unsubscribe = history.subscribe(() => {
		calls += 1;
	});

	history.push("/browser?x=1", { key: 1 });
	expect(history.location).toMatchObject({ pathname: "/browser", search: "?x=1" });
	expect(history.location.state).toEqual({ key: 1 });

	window.dispatchEvent(new PopStateEvent("popstate"));
	expect(calls).toBe(1);

	unsubscribe();
	window.dispatchEvent(new PopStateEvent("popstate"));
	expect(calls).toBe(1);
});
