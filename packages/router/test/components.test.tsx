import { afterEach, describe, expect, test } from "bun:test";
import { createPortal, useState, type RefObject } from "@cdd-team/react";
import {
	Link,
	Outlet,
	RouterProvider,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	getRouteApi,
	useLocation,
	useNavigate,
	useParams,
} from "../src/index.ts";
import { flush, mount } from "./utils.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
	for (const cleanup of cleanups.splice(0)) await cleanup();
});

function setup(path = "/", rootComponent?: () => ReturnType<typeof Outlet>) {
	const rootRoute = createRootRoute({
		component:
			rootComponent ??
			(() => (
				<main>
					<Outlet />
				</main>
			)),
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <h1>Главная</h1>,
	});
	const notebooksRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "notebooks",
		component: () => (
			<section>
				<Outlet />
			</section>
		),
	});
	const notebookRoute = createRoute({
		getParentRoute: () => notebooksRoute,
		path: "$notebookId",
		loader: ({ params }) => ({ title: `Блокнот ${params.notebookId}` }),
		component: function NotebookPage() {
			const { title } = notebookRoute.useLoaderData();
			const { notebookId } = useParams();
			const search = getRouteApi("/notebooks/$notebookId").useSearch();
			return (
				<h1>
					{title}:{notebookId}:{JSON.stringify(search)}
				</h1>
			);
		},
	});
	const brokenRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "broken",
		loader: () => {
			throw new Error("сломалось");
		},
	});

	const routeTree = rootRoute.addChildren([
		indexRoute,
		notebooksRoute.addChildren([notebookRoute]),
		brokenRoute,
	]);
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createRouter({ routeTree, history });

	return { router, history };
}

async function render(element: Parameters<typeof mount>[0]) {
	const view = await mount(element);
	cleanups.push(view.unmount);
	return view;
}

/**
 * Кликает по элементу и сообщает, отменил ли переход кто-то до окна.
 * Само окно переход всегда отменяет: иначе happy-dom загрузил бы страницу по href.
 */
function click(element: Element, init: MouseEventInit = {}): { defaultPrevented: boolean } {
	const result = { defaultPrevented: false };
	const onWindow = (event: Event) => {
		result.defaultPrevented = event.defaultPrevented;
		event.preventDefault();
	};
	window.addEventListener("click", onWindow, { once: true });
	element.dispatchEvent(
		new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }),
	);
	return result;
}

describe("RouterProvider и Outlet", () => {
	test("отрисовывают вложенные маршруты с данными loader, параметрами и search", async () => {
		const { router } = setup("/notebooks/42?tab=%22notes%22");
		const { container } = await render(<RouterProvider router={router} />);

		expect(container.innerHTML).toBe(
			'<main><section><h1>Блокнот 42:42:{"tab":"notes"}</h1></section></main>',
		);
	});

	test("ошибка loader отрисовывает компонент ошибки, неизвестный адрес — «не найдено»", async () => {
		const broken = setup("/broken");
		const { container } = await render(<RouterProvider router={broken.router} />);
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("сломалось");

		const unknown = setup("/unknown");
		const view = await render(<RouterProvider router={unknown.router} />);
		expect(view.container.textContent).toBe("Страница не найдена");
	});

	test("назад и вперёд по истории перерисовывают маршрут", async () => {
		const { router, history } = setup("/");
		const { container } = await render(<RouterProvider router={router} />);

		await router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 1 } });
		await flush();
		expect(container.textContent).toContain("Блокнот 1");

		history.back();
		await flush();
		expect(container.textContent).toBe("Главная");

		history.forward();
		await flush();
		expect(container.textContent).toContain("Блокнот 1");
	});

	test("хуки useLocation и useNavigate работают вне маршрутов, под RouterProvider", async () => {
		function Panel() {
			const location = useLocation();
			const navigate = useNavigate();
			return (
				<button
					type="button"
					onClick={() => void navigate({ to: "/notebooks/$notebookId", params: { notebookId: 5 } })}
				>
					{location.pathname}
				</button>
			);
		}
		const { router } = setup("/", () => (
			<div>
				<Panel />
				<Outlet />
			</div>
		));
		const { container } = await render(<RouterProvider router={router} />);

		click(container.querySelector("button")!);
		await flush();
		expect(container.querySelector("button")?.textContent).toBe("/notebooks/5");
		expect(container.textContent).toContain("Блокнот 5");
	});
});

describe("Link", () => {
	function withLinks(links: () => ReturnType<typeof Outlet>) {
		return setup("/", () => (
			<div>
				<nav>{links()}</nav>
				<Outlet />
			</div>
		));
	}

	test("переходит по клику без перезагрузки и отмечает активную ссылку", async () => {
		const { router, history } = withLinks(() => (
			<Link
				to="/notebooks/$notebookId"
				params={{ notebookId: 7 }}
				class="link"
				activeProps={{ class: "link--active" }}
			>
				Блокнот
			</Link>
		));
		const { container } = await render(<RouterProvider router={router} />);
		const anchor = container.querySelector("a")!;

		expect(anchor.getAttribute("href")).toBe("/notebooks/7");
		expect(anchor.getAttribute("aria-current")).toBeNull();

		const event = click(anchor);
		await flush();

		expect(event.defaultPrevented).toBe(true);
		expect(history.location.pathname).toBe("/notebooks/7");
		expect(container.textContent).toContain("Блокнот 7");
		expect(anchor.getAttribute("class")).toBe("link link--active");
		expect(anchor.getAttribute("aria-current")).toBe("page");
		expect(anchor.getAttribute("data-status")).toBe("active");
	});

	test("клики с модификатором и ссылки в новую вкладку оставляет браузеру", async () => {
		const { router, history } = withLinks(() => (
			<div>
				<Link to="/notebooks/$notebookId" params={{ notebookId: 1 }}>
					Обычная
				</Link>
				<Link to="/notebooks/$notebookId" params={{ notebookId: 2 }} target="_blank">
					В новой вкладке
				</Link>
			</div>
		));
		const { container } = await render(<RouterProvider router={router} />);
		const [plain, blank] = container.querySelectorAll("a");

		expect(click(plain!, { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(click(blank!).defaultPrevented).toBe(false);
		await flush();
		expect(history.location.pathname).toBe("/");
	});

	test("disabled-ссылка не переходит и не получает href", async () => {
		const { router, history } = withLinks(() => (
			<Link to="/notebooks/$notebookId" params={{ notebookId: 1 }} disabled>
				Недоступно
			</Link>
		));
		const { container } = await render(<RouterProvider router={router} />);
		const anchor = container.querySelector("a")!;

		expect(anchor.hasAttribute("href")).toBe(false);
		expect(anchor.getAttribute("aria-disabled")).toBe("true");
		expect(click(anchor).defaultPrevented).toBe(true);
		await flush();
		expect(history.location.pathname).toBe("/");
	});

	test("ref-объект и ref-функция получают элемент <a>", async () => {
		const seen: Array<HTMLAnchorElement | null> = [];
		const objectRef: RefObject<HTMLAnchorElement | null> = { current: null };
		function Links() {
			return (
				<div>
					<Link to="/" ref={objectRef}>
						Главная
					</Link>
					<Link
						to="/notebooks/$notebookId"
						params={{ notebookId: 1 }}
						ref={(node) => seen.push(node)}
					>
						Блокнот
					</Link>
				</div>
			);
		}
		const { router } = withLinks(() => <Links />);
		const { container, unmount } = await render(<RouterProvider router={router} />);
		const [home, notebook] = container.querySelectorAll("a");

		expect(objectRef.current).toBe(home!);
		expect(objectRef.current).toBeInstanceOf(HTMLAnchorElement);
		expect(seen[0]).toBe(notebook!);

		await unmount();
		expect(objectRef.current).toBeNull();
		expect(seen.at(-1)).toBeNull();
	});

	test("внутри createPortal сохраняет контекст роутера и переходит по клику", async () => {
		const modalRoot = document.createElement("div");
		document.body.appendChild(modalRoot);
		cleanups.push(async () => modalRoot.remove());

		function Modal() {
			const [open] = useState(true);
			if (!open) return null;
			return createPortal(
				<Link
					to="/notebooks/$notebookId"
					params={{ notebookId: 9 }}
					activeProps={{ class: "active" }}
				>
					Из модалки
				</Link>,
				modalRoot,
			);
		}
		const { router, history } = withLinks(() => <Modal />);
		const { container } = await render(<RouterProvider router={router} />);
		const anchor = modalRoot.querySelector("a")!;

		expect(container.querySelector("a")).toBeNull();
		expect(anchor.getAttribute("href")).toBe("/notebooks/9");

		expect(click(anchor).defaultPrevented).toBe(true);
		await flush();

		expect(history.location.pathname).toBe("/notebooks/9");
		expect(container.textContent).toContain("Блокнот 9");
		expect(modalRoot.querySelector("a")?.getAttribute("class")).toBe("active");
	});
});
