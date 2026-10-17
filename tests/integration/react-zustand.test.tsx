import { describe, expect, test } from "bun:test";
import { createRoot } from "@cdd-team/react";
import { create } from "@cdd-team/zustand";

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

describe("@cdd-team/react + @cdd-team/zustand", () => {
	test("компонент читает store через хук, setState обновляет DOM", async () => {
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
});
