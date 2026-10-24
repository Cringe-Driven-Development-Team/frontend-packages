# @cdd-team/vite-plugin-bff-html

Плагин dev-сервера [Vite](https://vite.dev) для клиента за BFF: HTML страниц отдаёт BFF, как на
проде (пользователь в bootstrap, `Set-Cookie` сессии), а Vite добавляет в этот HTML свой клиент HMR
и преобразования `index.html` других плагинов
([frontend#5](https://github.com/Cringe-Driven-Development-Team/frontend/issues/5)).
Рантайм-зависимостей нет.

## Установка

```sh
bun add -d @cdd-team/vite-plugin-bff-html   # или npm install -D @cdd-team/vite-plugin-bff-html
```

Нужен `vite` ^8.3.3 (peer).

```ts
// vite.config.ts
import { bffHtml } from '@cdd-team/vite-plugin-bff-html';
import { defineConfig } from 'vite';

const bffUrl = 'http://127.0.0.1:3000';

export default defineConfig({
    server: { proxy: { '/api/trpc': bffUrl } },
    plugins: [bffHtml(bffUrl)],
});
```

API BFF плагин не проксирует: его пути задаются в `server.proxy`, и такие запросы плагин
пропускает к прокси, даже с `Accept: text/html` (браузер шлёт его при прямом открытии адреса API).
Ключи сопоставляются как в Vite: с `^` — регулярное выражение, иначе префикс.

## Что делает

Плагин работает только в `vite serve`. Запрос страницы — `GET` или `HEAD` с `Accept: text/html`:

1. уходит в BFF по тому же пути и query, с заголовками `Accept`, `Cookie`, `Sec-Fetch-Site`,
   `User-Agent` и `X-Request-Id`; остальные заголовки браузера в BFF не передаются;
2. HTML ответа проходит через `server.transformIndexHtml`; ответ не в HTML (`Content-Type` без
   `text/html`) отдаётся как есть;
3. браузер получает статус и заголовки BFF, кроме `Content-Length` и `Content-Encoding` (их задаёт
   преобразованный HTML) и заголовков соединения (`Connection`, `Keep-Alive`, `Transfer-Encoding` и
   других: в HTTP/2 они запрещены), а каждый `Set-Cookie` — отдельным заголовком; на `HEAD` — без тела.

Модули, стили, ассеты и остальные запросы обрабатывает Vite. Если BFF недоступен, Vite отвечает
ошибкой `500`.

## Разработка

Из корня монорепозитория:

```sh
bun run --filter @cdd-team/vite-plugin-bff-html typecheck
bun run --filter @cdd-team/vite-plugin-bff-html test    # bun test: настоящий dev-сервер Vite против подставного BFF
bun run --filter @cdd-team/vite-plugin-bff-html build   # tsdown → dist/
```
