# @cdd-team/serialize-javascript

Сериализует данные в JSON для тела `<script type="application/json">` в HTML. После `JSON.stringify`
символы `<`, `>`, `&`, U+2028 и U+2029 во всём результате, включая ключи, заменяются JSON escapes
(`<` и т. д.): `</script>` и `<!--` в данных не закрывают элемент, а `JSON.parse` возвращает
исходные значения. Без зависимостей, без DOM, Bun и Node.

```sh
bun add @cdd-team/serialize-javascript
```

```ts
import { serializeJsonForHtml } from "@cdd-team/serialize-javascript";

const json = serializeJsonForHtml({ user: { name: "</script><script>alert(1)</script>" } });
const html = `<script id="bootstrap" type="application/json">${json}</script>`;

// в браузере
const data = JSON.parse(document.getElementById("bootstrap")!.textContent!);
```

Это не HTML-санитайзер: функция не экранирует атрибуты и URL и не проверяет состав данных.
Значение, которое не сериализуется в JSON (цикл, `BigInt`, корневые `undefined`, функция или символ),
даёт `TypeError` с фиксированным сообщением без входных данных.

Пакет живёт в монорепозитории
[`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages); команды
разработки — в его README.
