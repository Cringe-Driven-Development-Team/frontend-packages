import { describe, expect, test } from "bun:test";
import { createRoot, useRef, useState } from "../src/index.ts";
import type { ReactElement, RefObject } from "../src/index.ts";

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
		let renders = 0;
		let ref: RefObject<number> | undefined;

		function Clicker() {
			renders += 1;
			const clicks = useRef(0);
			ref = clicks;
			return <button onClick={() => (clicks.current += 1)}>click</button>;
		}

		const { container, root } = await mount(<Clicker />);
		click(container);
		await flush();

		expect(renders).toBe(1);
		expect(ref?.current).toBe(1);
		root.unmount();
	});
});
