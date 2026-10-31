# @cdd-team/router

Роутер для [`@cdd-team/react`](https://www.npmjs.com/package/@cdd-team/react) с API по образцу
[TanStack Router](https://tanstack.com/router/latest) (code-based routing). Работает поверх History API;
кроме React зависит только от [`@cdd-team/clsx`](https://www.npmjs.com/package/@cdd-team/clsx).

```sh
bun add @cdd-team/router @cdd-team/react
```

`@cdd-team/react` — peer-зависимость: роутер использует копию React приложения, второй рантайм
не ставится. Нужен `@cdd-team/react` 1.7.0 или новее.

## Быстрый старт

Маршруты удобно описывать по файлу на раздел и собирать в дерево:

```tsx
// src/routes/root.tsx
import { createRootRoute, Outlet } from '@cdd-team/router';

export const rootRoute = createRootRoute({ component: () => <Outlet /> });
```

```tsx
// src/routes/notebooks.tsx
import { createRoute } from '@cdd-team/router';
import { rootRoute } from './root';

export const notebooksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'notebooks',
    component: NotebooksLayout, // внутри — <Outlet />
});

export const notebookRoute = createRoute({
    getParentRoute: () => notebooksRoute,
    path: '$notebookId',
    loader: ({ params }) => fetchNotebook(params.notebookId),
    component: NotebookPage,
});
```

```ts
// src/routes/routeTree.ts
import { notebookRoute, notebooksRoute } from './notebooks';
import { rootRoute } from './root';

export const routeTree = rootRoute.addChildren([notebooksRoute.addChildren([notebookRoute])]);
```

Экземпляр роутера и регистрация типов живут в одном файле:

```ts
// src/router.ts
import { createRouter } from '@cdd-team/router';
import { routeTree } from './routes/routeTree';

export const router = createRouter({ routeTree });

// Регистрация включает проверку путей и параметров в Link, navigate и хуках
declare module '@cdd-team/router' {
    interface Register {
        router: typeof router;
    }
}
```

```tsx
// src/main.tsx
import { createRoot } from '@cdd-team/react';
import { RouterProvider } from '@cdd-team/router';
import { router } from './router';

createRoot(container).render(<RouterProvider router={router} />);
```

## Пути

| `path` | Что означает |
|---|---|
| `notebooks` | статичный сегмент |
| `$notebookId` | параметр, попадает в `params.notebookId` |
| `$` | сплат: остаток пути в `params._splat` |
| `/` | индексный маршрут: отрисовывается в `<Outlet />` родителя по его точному пути |
| `id: '_auth'` вместо `path` | обёртка без сегмента пути: общий layout или проверка доступа |

Из подходящих маршрутов выбирается самый специфичный: статичный сегмент важнее параметра,
параметр важнее сплата. Регистр статичных сегментов и завершающий слэш не учитываются.
На `/` без индексного маршрута отрисовывается корневой маршрут с пустым `<Outlet />`.

Слэш в значении обычного параметра кодируется как `%2F` и остаётся частью значения. На сегменты
делится только значение сплата.

## Опции маршрута

| Опция | Назначение |
|---|---|
| `component` | компонент маршрута. Без него отрисовывается `<Outlet />` |
| `validateSearch` | разбирает search-параметры: `(search) => ({ page: Number(search.page ?? 1) })` |
| `beforeLoad` | вызывается при каждой навигации от корня к листу. Возвращённый объект дополняет `context` потомков |
| `loaderDeps` | выбирает search-параметры, от которых зависит `loader` |
| `loader` | загружает данные маршрута, получает `params`, `deps`, `context`, `location`, `abortController` |
| `pendingComponent` | показывается, если загрузка длится дольше `defaultPendingMs` (1000 мс) |
| `errorComponent` | получает `error` и `reset`, отрисовывается при ошибке в `validateSearch`, `beforeLoad` или `loader` |
| `notFoundComponent` | отрисовывается на `throw notFound()`. У корневого маршрута — ещё и для неизвестных адресов |

Из `beforeLoad` и `loader` можно бросить `redirect({ to: '/login' })` или `notFound()`.
Относительный путь и `params: true` в редиректе считаются от адреса, на который шла навигация.
Редирект, по которому нельзя перейти (больше 10 подряд или не хватает параметра пути),
отрисовывает `errorComponent` бросившего его маршрута.

Пока новый адрес загружается, на экране остаются прежние маршруты. `loader` уже отрисованного
маршрута при навигации не перезапускается, пока не изменились его параметры пути или `loaderDeps`.
Перезапустить всё принудительно — `router.invalidate()`: уже загруженные маршруты при этом
остаются на экране с прежними данными, пока не придут новые.

## Навигация

```tsx
<Link to="/notebooks/$notebookId" params={{ notebookId: 42 }} activeProps={{ class: 'active' }}>
    Блокнот
</Link>

const navigate = useNavigate();
navigate({ to: '/notebooks' });
navigate({ to: '..' }); // относительно текущего адреса
navigate({ search: (current) => ({ ...current, page: 2 }) }); // тот же путь, другой search
navigate({ to: '/login', replace: true });
```

- `params` обязательны, если в `to` есть параметры.
- `search` по умолчанию сбрасывается. `search: true` сохраняет текущие параметры.
- Не-строковые значения search хранятся в адресе как JSON, поэтому числа, булевы значения и
  объекты переживают перезагрузку страницы.
- `ref` у `Link` указывает на элемент `<a>`: `<Link to="/" ref={anchorRef}>`.
- `Link` внутри `createPortal` работает так же: контекст роутера доступен через портал.
- Активная ссылка получает `data-status="active"` и `aria-current="page"`. По умолчанию ссылка
  активна и на вложенных адресах. `activeOptions={{ exact: true }}` требует точного совпадения.
  Ссылка на `/` активна только на самой главной.

## Хуки

Хуки маршрута типизированы по самому маршруту:

```tsx
const { notebookId } = notebookRoute.useParams();
const notebook = notebookRoute.useLoaderData();
const { page } = notebookRoute.useSearch();
```

Чтобы не импортировать маршрут в файл страницы, есть `getRouteApi('/notebooks/$notebookId')` с
теми же хуками и глобальные `useParams({ from })`, `useSearch({ from })`, `useLoaderData({ from })`,
`useRouteContext({ from })`, `useMatch({ from })`. Без `from` они читают ближайший к компоненту маршрут.

Хуки маршрута подписаны только на своё поле своего совпадения: компонент с `useLoaderData()` не
перерисуется, пока меняются другие маршруты или их данные. Если совпадение ушло из состояния, хук бросает
`Маршрут "<id>" сейчас не отрисован`; при навигации родитель сразу отбрасывает такой маршрут, и ошибка до
экрана не доходит.

Остальные: `useRouter()`, `useRouterState({ select, isEqual })`, `useLocation()`, `useNavigate()`,
`useMatches()`.

`useRouterState` построен на `useSyncExternalStoreWithSelector` из `@cdd-team/react`: прерванный рендер
не зафиксирует устаревшее состояние. `select` вызывается один раз на каждое новое `router.state`, а
компонент перерисовывается, только когда выборка изменилась по `isEqual` (по умолчанию `Object.is`).
Селектор, который каждый раз собирает новый объект, без `isEqual` перерисует компонент на любом
изменении роутера; с `isEqual` равная выборка сохранит прежнюю ссылку:

```tsx
const { pathname, status } = useRouterState({
	select: (state) => ({ pathname: state.location.pathname, status: state.status }),
	isEqual: (a, b) => a.pathname === b.pathname && a.status === b.status,
});
```

Тип настроек — `RouterStateSelector<T>`.

## Отличия от TanStack Router

- Только code-based routing: генерации маршрутов по файлам нет.
- Нет предзагрузки по наведению, восстановления прокрутки, блокировки навигации и `staleTime`.
- `search` в `Link` и `navigate` не типизирован по маршруту — типы даёт `validateSearch` на чтении.
- `notFound()` отрисовывает `notFoundComponent` того маршрута, который его бросил, без всплытия к родителям.

## История

По умолчанию роутер работает с `window.history` (`createBrowserHistory()`). Для тестов и окружений без
`window` есть `createMemoryHistory({ initialEntries: ['/notebooks/1'] })`:

```ts
const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
```

Пакет живёт в монорепозитории
[`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages); команды
разработки — в его README.
