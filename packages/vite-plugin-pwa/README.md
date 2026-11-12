# @cdd-team/vite-plugin-pwa

Плагин Vite 8 для PWA: пишет `manifest.webmanifest`, добавляет одну ссылку на него в HTML и после
production-сборки генерирует `sw.js` через `@cdd-team/workbox-build`. Регистрирует воркер само
приложение через `@cdd-team/workbox/window`; виртуальных модулей и встроенного скрипта регистрации нет.

```sh
bun add -d @cdd-team/vite-plugin-pwa
bun add @cdd-team/workbox
```

Пример приложения заметок, у которого чанки лежат на CDN, а офлайн-страница — в `public/`:

```ts
// vite.config.ts
import { pwa } from "@cdd-team/vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
	base: "https://cdn.example.com/notes/1.4.0/",
	plugins: [
		pwa({
			publicPath: "/",
			manifest: { name: "Notes", short_name: "Notes", start_url: "/", display: "standalone", icons: [] },
			precache: ["offline.html", "offline.css", "manifest.webmanifest"],
			fallback: "/offline.html",
			cacheNamespace: "notes",
		}),
	],
});
```

```ts
// src/main.ts
import { register } from "@cdd-team/workbox/window";

if (import.meta.env.PROD) register("/sw.js", "/").catch(console.error);
```

- `publicPath` — корень PWA на origin приложения, отдельный от `base`. Ссылка на манифест и URL комплекта строятся
  от него, поэтому при CDN-`base` манифест, `sw.js` и офлайн-файлы запрашиваются со своего origin. Отдавать их по
  этим адресам — задача сервера приложения.
- `precache` — файлы относительно каталога сборки, без glob. Манифест в комплект не добавляется сам: перечислите
  его, если он нужен офлайн.
- Файлы пишутся в корень каталога сборки: `manifest.webmanifest` и `sw.js`.
- В `vite dev` плагин отдаёт манифест по `<publicPath>manifest.webmanifest` и добавляет ссылку, но `sw.js` не создаёт.

Ограничения: одна конфигурация на сборку клиента, имена файлов фиксированы, нет UI обновления, dev-воркера и
injectManifest.

Пакет живёт в монорепозитории
[frontend-packages](https://github.com/Cringe-Driven-Development-Team/frontend-packages).
