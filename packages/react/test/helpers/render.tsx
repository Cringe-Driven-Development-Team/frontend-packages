import { createRoot } from "../../src/index.ts";
import type { ReactElement, Root } from "../../src/index.ts";

export async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

export type Mounted = {
	container: HTMLElement;
	root: Root;
	rerender(next: ReactElement): Promise<void>;
};

export async function mount(element: ReactElement): Promise<Mounted> {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(element);
	await flush();

	return {
		container,
		root,
		async rerender(next) {
			root.render(next);
			await flush();
		},
	};
}

export function query<Type extends Element = Element>(
	container: ParentNode,
	selector: string,
): Type {
	const element = container.querySelector<Type>(selector);
	if (!element) {
		throw new Error(`Не найден элемент ${selector}`);
	}
	return element;
}
