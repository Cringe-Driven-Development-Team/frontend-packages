import { describe, expect, test } from "bun:test";
import {
	createMemoryHistory,
	createRootRoute,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	isNotFound,
	isRedirect,
	notFound,
	redirect,
} from "../src/index.ts";

function setup(path = "/", options: { user?: string; basepath?: string } = {}) {
	const loaderCalls: string[] = [];

	const rootRoute = createRootRouteWithContext<{ user?: string }>()({});
	const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
	const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "login" });
	const authRoute = createRoute({
		getParentRoute: () => rootRoute,
		id: "_auth",
		beforeLoad: ({ context, location }) => {
			if (!context.user) throw redirect({ to: "/login", search: { from: location.pathname } });
			return { greeting: `Привет, ${context.user}` };
		},
	});
	const notebooksRoute = createRoute({
		getParentRoute: () => authRoute,
		path: "notebooks",
		validateSearch: (search) => ({ page: Number(search.page ?? 1) }),
	});
	const newNotebookRoute = createRoute({ getParentRoute: () => notebooksRoute, path: "new" });
	const notebookRoute = createRoute({
		getParentRoute: () => notebooksRoute,
		path: "$notebookId",
		loader: ({ params, context }) => {
			loaderCalls.push(params.notebookId);
			if (params.notebookId === "missing") throw notFound();
			return { id: params.notebookId, greeting: context.greeting };
		},
	});
	const filesRoute = createRoute({ getParentRoute: () => rootRoute, path: "files/$" });
	const loopRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "loop",
		beforeLoad: () => {
			throw redirect({ to: "/loop" });
		},
	});

	const routeTree = rootRoute.addChildren([
		indexRoute,
		loginRoute,
		authRoute.addChildren([notebooksRoute.addChildren([newNotebookRoute, notebookRoute])]),
		filesRoute,
		loopRoute,
	]);
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createRouter({
		routeTree,
		history,
		context: { user: options.user },
		basepath: options.basepath,
	});

	return { router, history, loaderCalls };
}

const routeIds = (router: ReturnType<typeof setup>["router"]) =>
	router.state.matches.map((match) => match.routeId);

describe("сопоставление адреса", () => {
	test("строит цепочку совпадений от корня с параметрами и данными loader", async () => {
		const { router } = setup("/notebooks/42", { user: "Аня" });
		await router.load();

		expect(routeIds(router)).toEqual([
			"__root__",
			"/_auth",
			"/_auth/notebooks",
			"/_auth/notebooks/$notebookId",
		]);
		const leaf = router.state.matches.at(-1)!;
		expect(leaf.params).toEqual({ notebookId: "42" });
		expect(leaf.loaderData).toEqual({ id: "42", greeting: "Привет, Аня" });
		expect(router.state.status).toBe("idle");
		expect(router.state.resolvedLocation?.pathname).toBe("/notebooks/42");
	});

	test("статичный сегмент важнее параметра", async () => {
		const { router, loaderCalls } = setup("/notebooks/new", { user: "Аня" });
		await router.load();

		expect(routeIds(router).at(-1)).toBe("/_auth/notebooks/new");
		expect(loaderCalls).toEqual([]);
	});

	test("регистр и завершающий слэш приводятся к виду шаблона", async () => {
		const { router } = setup("/Notebooks/42/", { user: "Аня" });
		await router.load();

		expect(router.state.location.pathname).toBe("/notebooks/42");
	});

	test("сплат получает остаток пути", async () => {
		const { router } = setup("/files/docs/a.txt");
		await router.load();

		expect(router.state.matches.at(-1)?.params).toEqual({ _splat: "docs/a.txt" });
	});

	test("неизвестный адрес отмечает корень как globalNotFound", async () => {
		const { router } = setup("/unknown");
		await router.load();

		expect(routeIds(router)).toEqual(["__root__"]);
		expect(router.state.matches[0]?.globalNotFound).toBe(true);
	});

	test("маршрут, объявленный дважды, отклоняется", () => {
		const rootRoute = createRootRoute();
		const a = createRoute({ getParentRoute: () => rootRoute, path: "a" });
		const b = createRoute({ getParentRoute: () => rootRoute, path: "a" });

		expect(() =>
			createRouter({ routeTree: rootRoute.addChildren([a, b]), history: createMemoryHistory() }),
		).toThrow('Маршрут "/a" объявлен дважды');
	});
});

describe("beforeLoad, loader и редиректы", () => {
	test("redirect из beforeLoad заменяет запись истории", async () => {
		const { router, history } = setup("/notebooks/42");
		await router.load();

		expect(history.location.pathname).toBe("/login");
		expect(router.state.location.search).toEqual({ from: "/notebooks/42" });
		expect(routeIds(router)).toEqual(["__root__", "/login"]);

		history.back();
		expect(history.location.pathname).toBe("/login");
	});

	test("цикл редиректов становится ошибкой маршрута", async () => {
		const { router } = setup("/loop");
		await router.load();

		const loop = router.state.matches.at(-1)!;
		expect(loop.status).toBe("error");
		expect((loop.error as Error).message).toContain("редиректов подряд");
	});

	test("notFound() из loader даёт статус notFound", async () => {
		const { router } = setup("/notebooks/missing", { user: "Аня" });
		await router.load();

		expect(router.state.matches.at(-1)?.status).toBe("notFound");
	});

	test("ошибка validateSearch даёт статус error", async () => {
		const rootRoute = createRootRoute();
		const listRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "list",
			validateSearch: (search) => {
				if (typeof search.page !== "number") throw new Error("page должен быть числом");
				return { page: search.page };
			},
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([listRoute]),
			history: createMemoryHistory({ initialEntries: ["/list?page=x"] }),
		});
		await router.load();

		expect(router.state.matches.at(-1)).toMatchObject({ status: "error" });
	});

	test("loader не перезапускается без смены параметров, invalidate перезапускает", async () => {
		const { router, loaderCalls } = setup("/notebooks/1", { user: "Аня" });
		await router.load();

		await router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 1 }, hash: "x" });
		expect(loaderCalls).toEqual(["1"]);

		await router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 2 } });
		expect(loaderCalls).toEqual(["1", "2"]);

		await router.invalidate();
		expect(loaderCalls).toEqual(["1", "2", "2"]);
	});

	test("новая навигация отменяет загрузку предыдущей", async () => {
		const signals: AbortSignal[] = [];
		const rootRoute = createRootRoute();
		const slowRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "slow",
			loader: ({ abortController }) => {
				signals.push(abortController.signal);
				return new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 20));
			},
		});
		const fastRoute = createRoute({ getParentRoute: () => rootRoute, path: "fast" });
		const router = createRouter({
			routeTree: rootRoute.addChildren([slowRoute, fastRoute]),
			history: createMemoryHistory(),
		});
		await router.load();

		const slow = router.navigate({ to: "/slow" });
		// Даём загрузке дойти до loader, иначе отменять будет нечего
		await Bun.sleep(1);
		expect(signals).toHaveLength(1);
		await router.navigate({ to: "/fast" });
		await slow;

		expect(signals[0]?.aborted).toBe(true);
		expect(router.state.location.pathname).toBe("/fast");
		expect(router.state.matches.at(-1)?.routeId).toBe("/fast");
	});

	test("таймер pending отменённой загрузки не возвращает её маршруты", async () => {
		const rootRoute = createRootRoute();
		const slowRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "slow",
			// Не завершается: `finally` отменённой загрузки не наступит
			loader: () => new Promise<never>(() => {}),
		});
		const fastRoute = createRoute({ getParentRoute: () => rootRoute, path: "fast" });
		const router = createRouter({
			routeTree: rootRoute.addChildren([slowRoute, fastRoute]),
			history: createMemoryHistory(),
			defaultPendingMs: 15,
		});
		await router.load();

		void router.navigate({ to: "/slow" });
		await Bun.sleep(1);
		await router.navigate({ to: "/fast" });
		await Bun.sleep(30);

		expect(router.state.location.pathname).toBe("/fast");
		expect(router.state.matches.at(-1)?.routeId).toBe("/fast");
	});

	test("isRedirect и isNotFound распознают брошенные значения", () => {
		expect(isRedirect(redirect({ to: "/login" }))).toBe(true);
		expect(isNotFound(notFound())).toBe(true);
		expect(isRedirect(new Error("x"))).toBe(false);
		expect(isNotFound(null)).toBe(false);
	});
});

describe("навигация", () => {
	test("относительные пути, параметры и search", async () => {
		const { router, history } = setup("/notebooks/1?page=3", { user: "Аня" });
		await router.load();

		await router.navigate({ to: ".", params: { notebookId: 7 }, search: true });
		expect(history.location.pathname).toBe("/notebooks/1");
		expect(router.state.location.search).toEqual({ page: 3 });

		await router.navigate({
			to: "/notebooks/$notebookId",
			params: (current) => ({ notebookId: current.notebookId! }),
		});
		expect(router.state.location.search).toEqual({});

		await router.navigate({ search: (current) => ({ ...current, page: 2 }) });
		expect(history.location.search).toBe("?page=2");
		expect(router.state.matches.at(-1)?.search).toEqual({ page: 2 });

		await router.navigate({ to: ".." });
		expect(router.state.location.pathname).toBe("/notebooks");
	});

	test("push добавляет запись истории, replace заменяет", async () => {
		const { router, history } = setup("/");
		await router.load();

		await router.navigate({ to: "/login" });
		await router.navigate({ to: "/files/$", params: { _splat: "a" }, replace: true });
		history.back();

		expect(history.location.pathname).toBe("/");
	});

	test("переходы назад и вперёд загружают маршруты после mount", async () => {
		const { router, history } = setup("/");
		const unmount = router.mount();
		await router.navigate({ to: "/login" });

		history.back();
		await Bun.sleep(0);
		expect(router.state.location.pathname).toBe("/");

		unmount();
		history.forward();
		await Bun.sleep(0);
		expect(router.state.location.pathname).toBe("/");
	});

	test("basepath входит в href и отрезается при разборе адреса", async () => {
		const { router, history } = setup("/app/login", { basepath: "/app/" });
		await router.load();
		expect(router.state.location.pathname).toBe("/login");

		const next = router.buildLocation({ to: "/files/$", params: { _splat: "a b" }, hash: "x" });
		expect(next.href).toBe("/app/files/a%20b#x");

		await router.commitLocation({ to: "/" });
		expect(history.location.pathname).toBe("/app");
	});

	test("адрес вне basepath не сопоставляется с маршрутами и сохраняет свой href", async () => {
		const { router } = setup("/login?x=1", { basepath: "/app" });
		await router.load();

		expect(routeIds(router)).toEqual(["__root__"]);
		expect(router.state.matches[0]?.globalNotFound).toBe(true);
		expect(router.state.location.href).toBe("/login?x=1");
	});

	test("subscribe сообщает об изменениях состояния до отписки", async () => {
		const { router } = setup("/");
		let calls = 0;
		const unsubscribe = router.subscribe(() => {
			calls += 1;
		});

		await router.load();
		expect(calls).toBeGreaterThan(0);

		unsubscribe();
		const before = calls;
		await router.navigate({ to: "/login" });
		expect(calls).toBe(before);
	});
});
