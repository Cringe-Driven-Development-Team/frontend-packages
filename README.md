# frontend-packages

Монорепозиторий учебных библиотек фронта команды Cringe-Driven-Development. Пакеты публикуются в npm под скоупом `@cdd-team`. Развёрнутый план — [трек документации](https://docs.cellestial.ru/modules/2/tracks/front-libs).

| Пакет | Каталог | Что это |
| --- | --- | --- |
| `@cdd-team/react` | `packages/react` | учебная реализация React |
| `@cdd-team/zustand` | `packages/zustand` | учебный стейт-менеджер; `@cdd-team/react` — необязательный peer, `@cdd-team/zustand/vanilla` работает без React |
| `@cdd-team/openapi` | `packages/openapi` | генератор типов из OpenAPI 3.1 и typed fetch-клиент |
| `@cdd-team/oxlint-plugin-jsdoc` | `packages/oxlint-plugin-jsdoc` | правила oxlint про JSDoc: `cdd/require-jsdoc` и `cdd/check-param-names` |
| `@cdd-team/vite-plugin-bff-html` | `packages/vite-plugin-bff-html` | плагин dev-сервера Vite: HTML страниц от BFF с клиентом HMR |

## Структура

```
packages/
  react/        # пакет; playground/ — ручной dev-стенд, см. packages/react/README.md
  zustand/
  openapi/
  oxlint-plugin-jsdoc/  # тесты собирают dist и ходят в CLI oxlint, а не в RuleTester
  vite-plugin-bff-html/ # тесты поднимают dev-сервер Vite против подставного BFF
scripts/        # проверка архивов и публикация (verify-packages, publish-released) и их тесты
tests/integration/  # runtime-интеграция React + Zustand и vanilla без React
docs/release-runbook.md
```

Общие конфиги лежат в корне: `tsconfig.base.json`, `oxlint.config.ts`, `oxfmt.config.ts`. Пакеты расширяют их. Версии `typescript` и `tsdown` едины и заданы в корневом `package.json`.

## Разработка

Нужен Bun 1.4.4 (`.bvmrc`).

```sh
bun install
bun run fmt:check     # формат
bun run lint          # линт
bun run build         # сборка всех пакетов (нужна до typecheck и интеграции: Zustand берёт dist React)
bun run typecheck     # типы
bun run test          # тесты пакетов (тесты плагина jsdoc собирают dist и запускают CLI oxlint; если Node установлен, oxlint исполняет JS-плагины в нём, и он должен быть ≥ 20.19 или ≥ 22.12)
bun run test:integration  # React + Zustand в happy-dom и vanilla без React
bun run test:scripts      # тесты скриптов и конфигурации release-please
bun run verify:packages   # собрать npm-архивы и поставить их в чистый проект вне workspace
```

В каждом пакете одинаковый набор скриптов: `lint`, `fmt:check`, `typecheck`, `test`, `build`. Корневые скрипты запускают их по всем пакетам.

Playground React не входит в `workspaces`, CI и релизы. На Windows не добавляйте его в `workspaces`: зависимость на собственный пакет порождает рекурсивные цепочки `node_modules`.

## Кто за что отвечает

- **Bun** — установка зависимостей, тулинг, тесты и сборка. `bunfig.toml` содержит `[run] bun = true`: утилиты с `#!/usr/bin/env node` (tsdown, oxlint, oxfmt) запускаются в рантайме Bun, а не в Node, поэтому версия Node на сборку не влияет.
- **Node и npm CLI** — только публикация по OIDC (Node 22.14.0+, npm 11.5.1+ ставятся лишь в publish job) (`npm publish` в [release.yml](.github/workflows/release.yml)).
- **release-please** — версии, `CHANGELOG.md`, теги и release PR. Режим manifest: у каждого пакета своя версия, свой changelog и свой тег (`react-v1.2.0`, `zustand-v1.0.0`, `openapi-v0.2.0`, `oxlint-plugin-jsdoc-v0.1.1`, `vite-plugin-bff-html-v0.1.0`). Плагин `node-workspace` с `updatePeerDependencies` при выпуске React поднимает диапазон `@cdd-team/react` в Zustand (peer и dev), даёт Zustand patch-релиз и запись в его changelog, даже если исходники Zustand не менялись.

## Коммиты и релизы

PR вливаются merge-коммитом. Тип коммита определяет, будет ли релиз:

| Тип | Релиз |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` | major (в `0.x` — minor) |
| `test:`, `docs:`, `chore:`, `refactor:` без breaking | сами по себе release PR не создают |

Накопленные релизные изменения (`feat`, `fix`) учитываются в ближайшем release PR; `docs:` и `test:` в него попадают только вместе с ними. Пакет определяется по изменённым путям, а не по scope коммита.

## Как выпускается версия

1. В `main` вливается PR с `feat:`/`fix:`. Workflow [Release](.github/workflows/release.yml) создаёт или обновляет общий release PR (одним PR — независимые изменения нескольких пакетов).
2. CI проходит на release PR: формат, линт, типы, тесты, сборка и установка собранных архивов в чистый проект.
3. После merge release PR release-please создаёт теги и GitHub Releases. Затем workflow собирает пакеты, повторно проверяет архивы, прогоняет интеграционные тесты и публикует **только пути из `paths_released`** по порядку зависимостей: React перед Zustand. Ошибка останавливает следующие публикации. GitHub Release ещё не значит, что пакет в npm: проверяйте `npm view`.
4. Job `notify` отправляет одну итоговую карточку выпуска в Telegram (тред Frontend / Releases): версии, изменения, миграция, совместимость, результат публикации.

Токен npm для этого не нужен (Trusted Publishing через OIDC). Секреты: `RELEASE_PLEASE_TOKEN` для release-please и Telegram-настройки для уведомлений. Первичная настройка, bootstrap, восстановление частичного выпуска и уведомления описаны в [docs/release-runbook.md](docs/release-runbook.md).

## Как добавить пакет

1. Создать `packages/<имя>` с `package.json`: `name` `@cdd-team/<имя>`, `repository` (`url` и `directory`), `publishConfig.access: public`, скрипты `lint`, `fmt:check`, `typecheck`, `test`, `build` как у соседних пакетов, `tsconfig.json` с `extends: "../../tsconfig.base.json"`.
2. Добавить пакет в `release-please-config.json` (`release-type: node`, `component`, `changelog-path`) и в `.release-please-manifest.json` со стартовой версией.
3. Добавить пакет в `packageNames` и в проверки `scripts/verify-packages.ts`, а при зависимостях между пакетами — в порядок `scripts/publish-released.ts`.
4. Выполнить bootstrap нового имени в npm (см. runbook), затем настроить для него Trusted Publisher.
