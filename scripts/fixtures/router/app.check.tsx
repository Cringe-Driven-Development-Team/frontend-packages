import { expect, test } from "bun:test";
import { createRoot } from "@cdd-team/react";
import { RouterProvider, createMemoryHistory } from "@cdd-team/router";
import { homeLinkRef, makeRouter, portalTarget } from "./routes";

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

test("опубликованные архивы: Link с ref и Link в портале переходят по маршрутам", async () => {
	const history = createMemoryHistory();
	const router = makeRouter(history);
	const container = document.createElement("div");
	const modalRoot = document.createElement("div");
	document.body.append(container, modalRoot);
	portalTarget.current = modalRoot;

	const root = createRoot(container);
	root.render(<RouterProvider router={router} />);
	await flush();

	expect(homeLinkRef.current).toBeInstanceOf(HTMLAnchorElement);
	expect(homeLinkRef.current?.getAttribute("href")).toBe("/");
	expect(homeLinkRef.current?.getAttribute("aria-current")).toBe("page");
	expect(container.querySelector("main")?.getAttribute("class")).toBe("app app--ready");

	const portalLink = modalRoot.querySelector("a")!;
	expect(container.contains(portalLink)).toBe(false);
	// Переход по href отменяем у окна: иначе happy-dom стал бы загружать страницу
	window.addEventListener("click", (event) => event.preventDefault(), { once: true });
	portalLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
	await flush();

	expect(history.location.pathname).toBe("/notebooks/7");
	expect(container.textContent).toContain("Блокнот 7");
	expect(portalLink.getAttribute("aria-current")).toBe("page");
	expect(homeLinkRef.current?.getAttribute("aria-current")).toBeNull();

	root.unmount();
	expect(homeLinkRef.current).toBeNull();
});
