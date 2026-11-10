# @cdd-team/workbox-build

Генератор одного самостоятельного `sw.js`: классический скрипт без импортов и `eval` с runtime
`@cdd-team/workbox` внутри. От Vite не зависит, работает в Node 20.19+ и Bun.

```sh
bun add -d @cdd-team/workbox-build
```

```ts
import { generateServiceWorker } from "@cdd-team/workbox-build";

const { cacheName, urls } = await generateServiceWorker({
	directory: "dist", // каталог с файлами
	files: ["offline.html", "offline.css", "fonts/main.woff2"], // явный список, без glob
	publicPath: "/", // корень, под которым файлы доступны с origin приложения
	fallback: "/offline.html", // офлайн-страница, должна входить в комплект
	cacheNamespace: "notes", // префикс имён кешей приложения
	output: "dist/sw.js",
});
```

Сборка останавливается ошибкой, если файла нет, путь выходит за `directory`, указан внешний URL, URL повторяется
или `fallback` не входит в комплект.

Имя кеша — `<cacheNamespace>-precache-<хеш>`. Хеш считается от содержимого файлов, их URL, значимых настроек и
встроенного runtime, а не от времени сборки или пути checkout: одинаковые входы дают байт в байт одинаковый
`sw.js`, а правка CSS, HTML или шрифта меняет его без ручного повышения версии.

Что делает `sw.js`:

- `install`: загружает весь комплект в новый кеш, затем `skipWaiting`. Ошибка любой загрузки отменяет установку,
  прежняя версия продолжает работать;
- `activate`: удаляет только свои старые кеши, затем `clients.claim`;
- `fetch`: точный GET к файлу комплекта — из своего кеша (при потере кеша — сеть), GET-навигация — сеть, при
  сетевом отказе — `fallback`; остальное идёт в сеть без перехвата. Query-параметры не отбрасываются: `/a.css?v=2`
  не совпадает с `/a.css`.

Не входит: glob-паттерны, injectManifest, пользовательский код в `sw.js`, дополнительные стратегии и миграция
кешей Workbox.

Пакет живёт в монорепозитории
[frontend-packages](https://github.com/Cringe-Driven-Development-Team/frontend-packages).
