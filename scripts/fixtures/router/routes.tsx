import { clsx } from "@cdd-team/clsx";
import { createPortal, type RefObject } from "@cdd-team/react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	getRouteApi,
	Link,
	Outlet,
	useRouterState,
	type RouterHistory,
	type RouterStateSelector,
} from "@cdd-team/router";

/** Получает элемент `<a>` ссылки на главную */
export const homeLinkRef: RefObject<HTMLAnchorElement | null> = { current: null };
/** Куда портал отрисовывает вторую ссылку; без него ссылки в портале нет */
export const portalTarget: { current: HTMLElement | null } = { current: null };

/** Объектная выборка с isEqual: при неизменном адресе возвращается прежняя ссылка */
const selectPath: RouterStateSelector<{ path: string }> = {
	select: (state) => ({ path: state.location.pathname }),
	isEqual: (previous, next) => previous.path === next.path,
};

const rootRoute = createRootRoute({
	component: function Layout() {
		const { path } = useRouterState(selectPath);
		return (
			<main class={clsx("app", { "app--ready": true })} data-path={path}>
				<Link to="/" ref={homeLinkRef} activeOptions={{ exact: true }}>
					Главная
				</Link>
				{portalTarget.current &&
					createPortal(
						<Link to="/notebooks/$notebookId" params={{ notebookId: 7 }}>
							Из портала
						</Link>,
						portalTarget.current,
					)}
				<Outlet />
			</main>
		);
	},
});
const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: () => <h1>Главная страница</h1>,
});
const notebookRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "notebooks/$notebookId",
	loader: ({ params }) => ({ title: `Блокнот ${params.notebookId}` }),
	component: function NotebookPage() {
		const { notebookId } = getRouteApi("/notebooks/$notebookId").useParams();
		return <h1 data-id={notebookId}>{notebookRoute.useLoaderData().title}</h1>;
	},
});

export const routeTree = rootRoute.addChildren([indexRoute, notebookRoute]);

export function makeRouter(history: RouterHistory = createMemoryHistory()) {
	return createRouter({ routeTree, history });
}

export const router = makeRouter();

// Регистрация типизированного дерева через публичное имя пакета
declare module "@cdd-team/router" {
	interface Register {
		router: typeof router;
	}
}
