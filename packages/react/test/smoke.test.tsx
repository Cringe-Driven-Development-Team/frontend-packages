import { describe, expect, test } from "bun:test";
import { createRoot, useState } from "../src/index.ts";

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

describe("react smoke", () => {
	test("компонент рендерится в DOM", async () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);

		root.render(<Counter />);
		await flush();

		expect(container.querySelector("button")?.textContent).toBe("0");
		root.unmount();
	});

	test("клик по кнопке обновляет состояние и DOM", async () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(<Counter />);
		await flush();

		container.querySelector("button")?.click();
		await flush();

		expect(container.querySelector("button")?.textContent).toBe("1");
		root.unmount();
	});
});
