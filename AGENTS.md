# AGENTS.md

Монорепозиторий учебных библиотек фронта Cringe-Driven-Development-Team: `@cdd-team/react`, `@cdd-team/zustand`,
`@cdd-team/openapi`, `@cdd-team/oxlint-plugin-jsdoc`, `@cdd-team/vite-plugin-bff-html`. Обзор, структура и команды — `README.md`; выпуск, bootstrap и восстановление после сбоя —
`docs/release-runbook.md`. Не копируй их сюда и не пересказывай: правь там.

Общепроектный контекст, действующая архитектура и планы развития проекта — в
[Контекст проекта](https://docs.cellestial.ru/project-context).
Спеки и планы реализации конкретной задачи размещай в `docs/superpowers` репозитория, где выполняется
работа, и не коммить: каталог в `.gitignore`. Общие для нескольких компонентов решения отражай в `docs`.

## Учебный проект: совместимость и прод

У проекта нет живых пользователей; преподаватели проверяют прод примерно раз в месяц.
Между проверками допустимы временная недоступность и несовместимость фронта и бэка
после выкладки одной стороны. Не добавляй по своей инициативе в задачи, планы,
приёмку или код поддержку старого API/клиента, legacy-режимы, поэтапное
переключение, безостановочный деплой и требования высокого uptime. Делай это
только по прямому требованию владельца для конкретной задачи.

Если фронт и бэк можно реализовать и проверить локально по согласованному
целевому контракту, работай над ними независимо. Временная поломка прода
между выкладками не создаёт связи `Blocked by`; проверь интеграцию после обеих
задач. К преподавательской проверке прод должен работать.

## Code Review Rules

- Пиши заголовки и пояснения замечаний к PR на русском языке.
  Имена файлов, идентификаторы, команды и метки приоритета сохраняй без перевода.

## Что где лежит

- `packages/react`, `packages/zustand`, `packages/openapi`, `packages/oxlint-plugin-jsdoc`,
  `packages/vite-plugin-bff-html` — пакеты. У каждого свой `package.json`, `tsconfig.json`
  (расширяет `tsconfig.base.json`) и одинаковый набор скриптов: `lint`, `fmt:check`, `typecheck`, `test`, `build`.
- `scripts/` — проверка архивов (`verify-packages.ts`), публикация (`publish-released.ts`) и их тесты;
  `scripts/fixtures/` — чистые проекты для установки архивов (`*.check.ts(x)`, не `*.test.*`).
- `tests/integration/` — React + Zustand в happy-dom и vanilla Zustand без React.
- `packages/react/playground` — ручной dev-стенд. Он вне `workspaces`, CI и релизов; не добавляй его в
  `workspaces`: зависимость на собственный пакет порождает рекурсивные `node_modules` на Windows.
- Тесты `packages/oxlint-plugin-jsdoc` идут на `bun test` через CLI oxlint: `test` сначала собирает `dist`, помощник
  `test/helpers/lint-cases.ts` пишет кейсы во временные файлы и один раз запускает `oxlint --format json` с плагином.
  `RuleTester` из oxlint не используй: он не работает под Bun. Если в системе есть Node, oxlint исполняет в нём JS-плагины (нужен ≥ 20.19 или ≥ 22.12); в CI он предустановлен.
- Конфиги в корне: `oxlint.config.ts`, `oxfmt.config.ts`, `release-please-config.json`,
  `.release-please-manifest.json`. `packages/openapi/src/api/schema.ts` сгенерирован и исключён из oxfmt.

## Перед коммитом

Порядок важен: Zustand берёт типы из `dist` React, поэтому сборка идёт до `typecheck`.

```sh
bun install --frozen-lockfile
bun run fmt:check && bun run lint && bun run build && bun run typecheck
bun run test && bun run test:integration && bun run test:scripts
bun run verify:packages   # архивы + установка в чистый проект вне workspace
```

CI делает то же самое на каждом PR, включая release PR. Тесты — только `bun test`, Vitest не добавляй.

## Инструменты: Bun и Node

- Bun — установка, тулинг, тесты и сборка. `bunfig.toml` содержит `[run] bun = true`: tsdown, oxlint и oxfmt
  запускаются в рантайме Bun, поэтому версия Node на них не влияет.
- Node и npm CLI нужны только для `npm publish` по OIDC (Node 22.14.0+, npm 11.5.1+, только в publish job).
- `scripts/publish-released.ts` запускай напрямую (`bun scripts/publish-released.ts`), не через `bun run`: при
  `[run] bun = true` `bun run` подменяет `node` на `bun`, а публикация по OIDC должна идти настоящим Node.

## Что нельзя

- Править версии в `package.json`, `CHANGELOG.md` и `.release-please-manifest.json` руками: их ведёт
  release-please.
- Публиковать в npm, создавать GitHub Releases, пушить и вливать PR без прямой просьбы. Публикацию делает только
  workflow `release.yml`.
- Класть `workspace:*` и ссылки на `@maninthecoat`/`@iredtea` в публикуемые манифесты. Диапазон зависимости Zustand
  от React — semver (`^1.2.0`), он же в `peerDependencies` (optional) и `devDependencies`; `./vanilla` должен
  работать без React.
- Возвращать постоянные npm-секреты (`NPM_TOKEN`, `NODE_AUTH_TOKEN`, токен в `.npmrc`).
  Секреты репозитория: `RELEASE_PLEASE_TOKEN` (для release-please, не для npm) и `TELEGRAM_RELEASES_TOPIC_ID`;
  `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` — секреты организации. Telegram-секреты передаются только в job
  `notify`, не в `publish` с `id-token: write`.

## Коммиты и релизы

- Коммиты по-русски: `тип: что сделано`. `feat` и `fix` дают релиз, `test`, `docs`, `chore`, `refactor` без
  breaking сами по себе — нет; ломающее изменение — `feat!`. Пакет выбирается по изменённым путям, а не по scope.
- PR вливаются merge-коммитом (release-please читает отдельные коммиты; squash слил бы их в один).
- Release PR открывает release-please; перед мержем проверь версии и диапазон `@cdd-team/react` в Zustand.
- Менеджер пакетов — только Bun, lockfile `bun.lock`; `package-lock.json` не создавай.

## Окружение: Windows

- `.gitattributes` задаёт LF в рабочем дереве: форматтер проверяет LF. `LF will be replaced by CRLF` при коммите
  можно игнорировать.
- Git Bash переписывает пути с `C:` в аргументах: в скриптах используй относительные пути (см. распаковку архива в
  `scripts/verify-packages.ts`).
