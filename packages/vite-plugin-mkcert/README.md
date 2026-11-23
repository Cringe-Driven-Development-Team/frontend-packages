# @cdd-team/vite-plugin-mkcert

Плагин dev-сервера [Vite](https://vite.dev): локальный HTTPS сертификатом, который выпускает
[mkcert](https://github.com/FiloSottile/mkcert)
([frontend-packages#55](https://github.com/Cringe-Driven-Development-Team/frontend-packages/issues/55)).
Одноимённая чужая команда `mkcert` в PATH (например, npm-пакет `mkcert`) первый запуск не ломает.
Рантайм-зависимостей нет.

## Установка

```sh
bun add -d @cdd-team/vite-plugin-mkcert   # или npm install -D @cdd-team/vite-plugin-mkcert
```

Нужен `vite` ^8.3.3 (peer).

```ts
// vite.config.ts
import { mkcert } from '@cdd-team/vite-plugin-mkcert';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [mkcert({ hosts: ['localhost', '127.0.0.1'] })],
});
```

## Что делает

Плагин работает только в `vite serve` и задаёт `server.https` сертификатом и ключом.

1. Ищет mkcert: сначала скачанный ранее `~/.vite-plugin-mkcert/mkcert` (`mkcert.exe` в Windows),
   если его SHA-256 совпадает с закреплённой версией; затем каждый `mkcert` из PATH, который отвечает
   на `mkcert -CAROOT`. Неподходящие кандидаты пропускаются, PATH процесса не меняется. В Windows
   кандидат — только `mkcert.exe`: npm-обёртка `mkcert.cmd` не запускается.
2. Если подходящего нет, скачивает официальный mkcert v1.4.4 с GitHub и проверяет SHA-256 до запуска.
3. Если в каталоге нет пригодного сертификата, выполняет `mkcert -install` (создаёт CA и доверяет ему
   в ОС, где работает Vite; на macOS и Linux может спросить пароль sudo) и выпускает сертификат для
   `hosts`. Пригодный — с теми же именами (порядок не важен), сроком больше суток и подписью текущего CA.

Любая ошибка — неподдерживаемая платформа, сбой загрузки, неверный хэш, отказ mkcert — останавливает
запуск dev-сервера с сообщением `vite-plugin-mkcert: …`. На HTTP плагин молча не переходит.

Скачивание поддерживается для Windows x64, Linux x64 (в том числе WSL Ubuntu) и macOS x64/arm64; на
других платформах нужен установленный mkcert в PATH.

## Каталог `~/.vite-plugin-mkcert`

| Файл | Что это |
| --- | --- |
| `mkcert` / `mkcert.exe` | скачанный бинарник (только если подходящего mkcert нет в PATH) |
| `rootCA.pem` | публичный сертификат CA |
| `rootCA-key.pem` | ключ CA: плагин его не читает и не выводит |
| `cert.pem`, `key.pem` | сертификат dev-сервера и его ключ |

Все команды mkcert запускаются с `CAROOT`, равным этому каталогу, поэтому CA лежит здесь и при
установленном в систему mkcert.

При разработке из WSL с браузером в Windows CA доверен только в Ubuntu. Разово доверить его в Windows —
`bun run dev:trust-windows` в репозитории
[frontend](https://github.com/Cringe-Driven-Development-Team/frontend): он берёт публичный
`rootCA.pem` из этого каталога.

Других опций стороннего `vite-plugin-mkcert` (proxy, свой источник бинарника, автообновление) нет.
