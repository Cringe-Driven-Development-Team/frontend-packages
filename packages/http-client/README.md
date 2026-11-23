# @cdd-team/http-client

Типизированный HTTP-клиент по карте операций. Клиент собирает путь, query, заголовки и тело, отдаёт
запрос транспорту `(path, init) => Promise<Response>` и один раз разбирает ответ в
`{ status, headers, data }`. Адрес сервера, авторизация, сессия, таймауты и учёт запросов — забота
транспорта в приложении. Повторов, middleware и проверки тела ответа в библиотеке нет. Без
зависимостей, только Fetch API: работает в браузере и в Bun.

```sh
bun add @cdd-team/http-client
```

Карта операций — обычные редактируемые типы: шаблон пути → HTTP-метод → параметры, тела по content
type и ответы по статусам.

```ts
import { createClient, type Transport } from "@cdd-team/http-client";

type Paths = {
	"/notebooks/{id}": {
		GET: {
			params: { path: { id: number }; query?: { cells?: boolean } };
			responses: { 200: { id: number; title: string }; 404: { error: string } };
		};
		PATCH: {
			params: { path: { id: number } };
			body: { "application/json": { title: string } };
			responses: { 204: undefined };
		};
	};
};

const transport: Transport = (path, init) =>
	fetch(`/api${path}`, { ...init, credentials: "same-origin" });

const client = createClient<Paths>({ transport });

const res = await client.request("GET", "/notebooks/{id}", {
	params: { path: { id: 1 }, query: { cells: true } },
});
if (res.status === 200) console.log(res.data); // data не проверено: проверяет приложение

await client.request("PATCH", "/notebooks/{id}", {
	params: { path: { id: 1 } },
	contentType: "application/json",
	body: { title: "Черновик" },
});
```

- Path-параметры кодируются `encodeURIComponent`; нет значения для `{name}` — `TypeError`.
- Query собирается `URLSearchParams`: `undefined` пропускается, массив — повторяемыми ключами.
- `application/json` — `JSON.stringify` и `Content-Type`; `multipart/form-data` — `FormData`,
  `Content-Type` с boundary ставит fetch.
- Тело ответа: пустое (а также у `HEAD` и `204`) — `undefined`, JSON — значение, иначе текст.
- HTTP-ошибки возвращаются результатом; сбои транспорта и чтения тела — исключением как есть.
- Каждый `createClient` — независимый экземпляр; заголовки одного вызова не попадают в другие.

Пакет заменяет `@cdd-team/openapi`: генератора и CLI нет, типы карты пишутся вручную.

## Выпуск

Версию, `CHANGELOG.md` и тег `http-client-v<версия>` ведёт release-please; в npm пакет публикует workflow
`release.yml` по OIDC (Trusted Publisher), без npm-токена. Перед выпуском `bun run verify:packages` проверяет архив
пакета и сценарий `http` (типы и браузерная сборка из архива). Первая публикация, настройка доверия и восстановление после сбоя —
[runbook выпуска](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/docs/release-runbook.md).

Пакет живёт в монорепозитории
[`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages); команды
разработки — в его README.
