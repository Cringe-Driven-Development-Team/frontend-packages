import { useCallback, useContext, useSyncExternalStoreWithSelector } from "@cdd-team/react";

import { MatchContext, RouterContext } from "./context";
import type { AnyRoute } from "./route";
import type {
	ParsedLocation,
	RegisteredRouter,
	RouteById,
	RouteIds,
	RouteMatch,
	RouterState,
} from "./router";

type RouteTypes<TId> = RouteById<TId>["types"];
type MatchOf<TRoute extends AnyRoute> = RouteMatch<
	TRoute["types"]["params"],
	TRoute["types"]["search"],
	TRoute["types"]["context"],
	TRoute["types"]["loaderData"]
>;

/** `from` — `id` маршрута, чьи данные нужны. Без него берётся ближайший к компоненту маршрут */
interface FromOptions<TFrom> {
	from: TFrom;
}

/**
 * Роутер из ближайшего `<RouterProvider>`.
 * @returns роутер
 */
export function useRouter(): RegisteredRouter {
	const router = useContext(RouterContext);
	if (!router) throw new Error("Хуки роутера работают только внутри <RouterProvider>");

	return router as RegisteredRouter;
}

/** Настройки {@link useRouterState}: какую часть состояния выбрать и как сравнивать выборки. */
export interface RouterStateSelector<TSelected> {
	/** Выбирает часть состояния. Повторно для того же `router.state` не вызывается */
	select: (state: RouterState) => TSelected;
	/**
	 * Сравнивает прежнюю и новую выборку. При равенстве хук вернёт прежнюю ссылку и не
	 * перерисует компонент. По умолчанию `Object.is`
	 */
	isEqual?: (previous: TSelected, next: TSelected) => boolean;
}

/**
 * Состояние роутера. С `select` — его часть: компонент перерисовывается, только когда она меняется.
 * @returns состояние роутера
 */
export function useRouterState(): RouterState;
export function useRouterState<TSelected>(options: RouterStateSelector<TSelected>): TSelected;
export function useRouterState(options?: RouterStateSelector<unknown>): unknown {
	const router = useRouter();
	// `router.state` заменяется целиком при каждом изменении, поэтому годится как snapshot
	const getState = useCallback(() => router.state, [router]);

	return useSyncExternalStoreWithSelector(
		router.subscribe,
		getState,
		options?.select ?? selectState,
		options?.isEqual,
	);
}

// Селекторы объявлены на уровне модуля: стрелочная функция в теле хука менялась бы на каждом
// рендере и сбрасывала бы кеш выборки
function selectState(state: RouterState): RouterState {
	return state;
}

function selectLocation(state: RouterState): ParsedLocation {
	return state.location;
}

function selectMatches(state: RouterState): RouteMatch[] {
	return state.matches;
}

function selectMatch(match: RouteMatch): RouteMatch {
	return match;
}

function selectParams(match: RouteMatch): unknown {
	return match.params;
}

function selectSearch(match: RouteMatch): unknown {
	return match.search;
}

function selectLoaderData(match: RouteMatch): unknown {
	return match.loaderData;
}

function selectContext(match: RouteMatch): unknown {
	return match.context;
}

/**
 * Текущий адрес.
 * @returns адрес, на который идёт навигация
 */
export function useLocation(): ParsedLocation {
	return useRouterState({ select: selectLocation });
}

/**
 * Функция перехода на другой адрес.
 * @returns `navigate` роутера
 */
export function useNavigate(): RegisteredRouter["navigate"] {
	return useRouter().navigate;
}

/**
 * Совпадения маршрутов текущего адреса.
 * @returns совпадения от корня к листу
 */
export function useMatches(): RouteMatch[] {
	return useRouterState({ select: selectMatches });
}

/**
 * Часть совпадения маршрута `from`, а без него — ближайшего к компоненту. Подписка идёт на
 * выбранное значение: обновления других совпадений компонент не перерисовывают.
 * @param from `id` маршрута
 * @param select что взять из совпадения; должен быть стабильным между рендерами
 * @returns выбранное значение
 */
function useMatchSelection<TSelected>(
	from: string | undefined,
	select: (match: RouteMatch) => TSelected,
): TSelected {
	const nearestRouteId = useContext(MatchContext);
	const routeId = from ?? nearestRouteId;
	const selectFromState = useCallback(
		(state: RouterState) => {
			const match = state.matches.find((candidate) => candidate.routeId === routeId);
			// Бросаем и из повторного чтения после уведомления: React перерисует дерево, и
			// родитель, из которого маршрут ушёл, отбросит этот компонент
			if (!match) throw new Error(`Маршрут "${routeId}" сейчас не отрисован`);

			return select(match);
		},
		[routeId, select],
	);

	return useRouterState({ select: selectFromState });
}

/**
 * Совпадение маршрута: параметры, данные и состояние загрузки.
 * @param options `from` — `id` маршрута; без него берётся ближайший к компоненту
 * @returns совпадение маршрута
 */
export function useMatch<TFrom extends RouteIds>(
	options: FromOptions<TFrom>,
): MatchOf<RouteById<TFrom>>;
export function useMatch(): RouteMatch;
export function useMatch(options?: FromOptions<string>): RouteMatch {
	return useMatchSelection(options?.from, selectMatch);
}

/**
 * Параметры пути маршрута.
 * @param options `from` — `id` маршрута; без него берётся ближайший к компоненту
 * @returns параметры пути
 */
export function useParams<TFrom extends RouteIds>(
	options: FromOptions<TFrom>,
): RouteTypes<TFrom>["params"];
export function useParams(): Record<string, string>;
export function useParams(options?: FromOptions<string>): unknown {
	return useMatchSelection(options?.from, selectParams);
}

/**
 * Search-параметры маршрута, разобранные его `validateSearch`.
 * @param options `from` — `id` маршрута; без него берётся ближайший к компоненту
 * @returns search-параметры
 */
export function useSearch<TFrom extends RouteIds>(
	options: FromOptions<TFrom>,
): RouteTypes<TFrom>["search"];
export function useSearch(): Record<string, unknown>;
export function useSearch(options?: FromOptions<string>): unknown {
	return useMatchSelection(options?.from, selectSearch);
}

/**
 * Данные, которые вернул `loader` маршрута.
 * @param options `from` — `id` маршрута; без него берётся ближайший к компоненту
 * @returns данные маршрута
 */
export function useLoaderData<TFrom extends RouteIds>(
	options: FromOptions<TFrom>,
): RouteTypes<TFrom>["loaderData"];
export function useLoaderData(): unknown;
export function useLoaderData(options?: FromOptions<string>): unknown {
	return useMatchSelection(options?.from, selectLoaderData);
}

/**
 * Контекст маршрута: контекст роутера и то, что вернули `beforeLoad` маршрута и его предков.
 * @param options `from` — `id` маршрута; без него берётся ближайший к компоненту
 * @returns контекст маршрута
 */
export function useRouteContext<TFrom extends RouteIds>(
	options: FromOptions<TFrom>,
): RouteTypes<TFrom>["context"];
export function useRouteContext(): unknown;
export function useRouteContext(options?: FromOptions<string>): unknown {
	return useMatchSelection(options?.from, selectContext);
}

/**
 * Собирает хук, читающий данные совпадения маршрута. `id` читается лениво: роутер задаёт его позже.
 * @param route маршрут или объект с его `id`
 * @param select что взять из совпадения
 * @returns хук
 */
export function createMatchHook<TSelected>(
	route: { id: string },
	select: (match: RouteMatch) => TSelected,
): () => TSelected {
	return function useRouteData() {
		return useMatchSelection(route.id, select);
	};
}

/**
 * Типизированные хуки маршрута по его `id` — без импорта самого маршрута.
 * @param id `id` маршрута
 * @returns хуки `useMatch`, `useParams`, `useSearch`, `useLoaderData` и `useRouteContext`
 */
export function getRouteApi<TId extends RouteIds>(id: TId) {
	const route = { id: id as string };

	return {
		useMatch: createMatchHook<MatchOf<RouteById<TId>>>(route, (match) => match),
		useParams: createMatchHook<RouteTypes<TId>["params"]>(route, (match) => match.params),
		useSearch: createMatchHook<RouteTypes<TId>["search"]>(route, (match) => match.search),
		useLoaderData: createMatchHook<RouteTypes<TId>["loaderData"]>(
			route,
			(match) => match.loaderData,
		),
		useRouteContext: createMatchHook<RouteTypes<TId>["context"]>(route, (match) => match.context),
	};
}
