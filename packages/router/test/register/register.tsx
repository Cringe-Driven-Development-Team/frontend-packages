// Проверяется только компилятором (`bun run typecheck`): регистрация дерева маршрутов
// включает проверку путей и параметров в Link, navigate, redirect и хуках
import {
	Link,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	getRouteApi,
	redirect,
	useLoaderData,
	useMatch,
	useParams,
	useRouterState,
	type RouteIds,
	type RoutePaths,
} from "../../src/index.ts";

const rootRoute = createRootRoute();
const notebooksRoute = createRoute({ getParentRoute: () => rootRoute, path: "notebooks" });
const notebookRoute = createRoute({
	getParentRoute: () => notebooksRoute,
	path: "$notebookId",
	loader: ({ params }) => ({ id: Number(params.notebookId) }),
});
const authRoute = createRoute({ getParentRoute: () => rootRoute, id: "_auth" });
const settingsRoute = createRoute({ getParentRoute: () => authRoute, path: "settings" });

const routeTree = rootRoute.addChildren([
	notebooksRoute.addChildren([notebookRoute]),
	authRoute.addChildren([settingsRoute]),
]);
export const router = createRouter({ routeTree, history: createMemoryHistory() });

declare module "../../src/router.ts" {
	interface Register {
		router: typeof router;
	}
}

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assert = <T extends true>(): T => true as T;

assert<Equal<RoutePaths, "/" | "/notebooks" | "/notebooks/$notebookId" | "/settings">>();
assert<
	Equal<
		RouteIds,
		"__root__" | "/notebooks" | "/notebooks/$notebookId" | "/_auth" | "/_auth/settings"
	>
>();

export function TypedChecks() {
	void router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 1 } });
	void router.navigate({ to: "../settings" });
	// @ts-expect-error: такого пути нет в дереве
	void router.navigate({ to: "/unknown" });
	// @ts-expect-error: путь с параметром требует params
	void router.navigate({ to: "/notebooks/$notebookId" });

	redirect({ to: "/settings" });
	// @ts-expect-error: редирект тоже проверяет путь
	redirect({ to: "/nope" });

	const params = useParams({ from: "/notebooks/$notebookId" });
	assert<Equal<typeof params, { notebookId: string }>>();
	const data = useLoaderData({ from: "/notebooks/$notebookId" });
	assert<Equal<typeof data, { id: number }>>();
	const api = getRouteApi("/notebooks/$notebookId");
	assert<Equal<ReturnType<typeof api.useLoaderData>, { id: number }>>();
	// @ts-expect-error: неизвестный id маршрута
	getRouteApi("/missing");
	assert<Equal<ReturnType<typeof api.useParams>, { notebookId: string }>>();
	const match = useMatch({ from: "/notebooks/$notebookId" });
	assert<Equal<typeof match.loaderData, { id: number }>>();

	const pathname = useRouterState({ select: (state) => state.location.pathname });
	assert<Equal<typeof pathname, string>>();
	const selected = useRouterState({
		select: (state) => ({ count: state.matches.length }),
		isEqual: (previous, next) => previous.count === next.count,
	});
	assert<Equal<typeof selected, { count: number }>>();
	useRouterState({
		// @ts-expect-error: isEqual сравнивает значения того же типа, что вернул select
		select: (state) => state.status,
		isEqual: (previous: number, next: number) => previous === next,
	});

	return (
		<>
			<Link to="/notebooks/$notebookId" params={{ notebookId: "a" }} />
			{/* @ts-expect-error: неизвестный путь в Link */}
			<Link to="/missing" />
		</>
	);
}
