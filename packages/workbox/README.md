# @cdd-team/workbox

Учебный runtime service worker: precache явного комплекта файлов, офлайн-fallback навигации и регистрация
воркера со страницы. Заменяет используемую часть Workbox; совместимости с его API нет.

```sh
bun add @cdd-team/workbox
```

## Границы пакетов

| Пакет | Где работает | Что делает |
| --- | --- | --- |
| `@cdd-team/workbox` | браузер: страница и воркер | precache, fallback навигации, регистрация |
| `@cdd-team/workbox-build` | Node/Bun при сборке | пишет самостоятельный `sw.js` с этим runtime внутри |
| `@cdd-team/vite-plugin-pwa` | Vite | манифест, ссылка на него в HTML и вызов генератора после сборки |

Runtime не зависит от Vite, Node и Bun. Точки входа разделены по контекстам: `/window` не тянет код воркера,
`/precaching` и `/navigation` не обращаются к DOM страницы. Импорт ничего не регистрирует и обработчиков не ставит.

## `/window` — регистрация

```ts
import { register } from "@cdd-team/workbox/window";

if (import.meta.env.PROD) {
	register("/sw.js", "/").catch(console.error);
}
```

`register(url, scope)` вызывает `navigator.serviceWorker.register` и возвращает регистрацию; без поддержки service
worker — `undefined`, ошибка регистрации отклоняет Promise. Режим сборки, логирование и реакцию на ошибку решает
приложение. Страница не перезагружается: новая версия воркера вступает в силу без участия вкладки.

## `/precaching` — комплект в своём кеше

```ts
import { createPrecache } from "@cdd-team/workbox/precaching";

const precache = createPrecache({
	cachePrefix: "app-precache-",
	version: "3f2a9c01", // имя кеша — app-precache-3f2a9c01
	urls: ["/offline.html", "/offline.css"],
});
```

- `install()` загружает весь комплект мимо HTTP-кеша (`cache: "reload"`) и только после этого пишет его в новый
  кеш. Ошибка сети, HTTP-статус не 2xx или сбой Cache API отклоняют установку; частично заполненный кеш удаляется,
  прежние версии не трогаются.
- `has(url)` и `match(url)` проверяют точный URL комплекта; `match` ищет ответ только в своём кеше.
- `cleanup()` удаляет кеши с `cachePrefix`, кроме текущего. Чужие кеши остаются.

## `/navigation` — fallback навигации

```ts
import { createNavigationHandler } from "@cdd-team/workbox/navigation";

const navigate = createNavigationHandler(() => precache.match(new URL("/offline.html", location.href).href));
```

Для GET-навигации — сначала сеть. Ответ сети возвращается как есть, включая HTTP 503; fallback подставляется
только при сетевом отказе. Для остальных запросов обработчик возвращает `undefined`, и воркер их не перехватывает.
Если fallback в кеше нет, навигация завершается исходной ошибкой сети.

Обычно эти функции не собирают руками: `@cdd-team/workbox-build` встраивает их в готовый `sw.js`. Для этого пакет
публикует классическую сборку `@cdd-team/workbox/sw-runtime.js`, приложению её импортировать не нужно.

## Ограничения

Нет роутера, стратегий кеширования кроме описанных, runtime-кеша, background sync, push, injectManifest, UI
обновления и миграции кешей Workbox. Личные ответы, API и файлы SPA в кеш не попадают: только явный комплект.

Пакет живёт в монорепозитории
[frontend-packages](https://github.com/Cringe-Driven-Development-Team/frontend-packages).
