# Вынос oxlint-plugin-jsdoc в монорепо: дизайн

Источник требований: задача [frontend#63](https://github.com/Cringe-Driven-Development-Team/frontend/issues/63) (`gh issue view 63 -R Cringe-Driven-Development-Team/frontend`). Документ фиксирует решения, принятые при обсуждении, и факты, проверенные в коде. Если документ и задача расходятся, прав документ.

## Зачем

Пакет `@iredtea/oxlint-plugin-jsdoc` (версия `0.1.1`, правила oxlint `cdd/require-jsdoc` и `cdd/check-param-names`) живёт в отдельном репозитории [oxlint-plugin-jsdoc](https://github.com/Cringe-Driven-Development-Team/oxlint-plugin-jsdoc), публикуется вручную под личным скоупом и не вошёл в монорепо `frontend-packages` (задача #18). Клиент в `frontend` остаётся единственным потребителем с зависимостью от `@iredtea/*`. Переносим плагин в монорепо под скоуп `@cdd-team`, чтобы он получил общий тулинг, CI и автоматические релизы, как остальные пакеты.

## Цели

- Пакет `packages/oxlint-plugin-jsdoc` (`@cdd-team/oxlint-plugin-jsdoc`, стартовая версия `0.1.1`) с общим набором скриптов `lint`, `fmt:check`, `typecheck`, `test`, `build`, общими конфигами и единым CI.
- История репозитория плагина (7 коммитов, 3 автора) видна в общем `git log`.
- Тесты плагина идут на `bun test`, без `RuleTester` и без Node-исключений.
- Релизы пакета — через release-please (свой тег `oxlint-plugin-jsdoc-v<версия>`, свой changelog) и публикация по OIDC из `release.yml`, как у остальных.
- Документация (README монорепо, `AGENTS.md`, runbook) учитывает четвёртый пакет.

## Не цели

- Перевод потребителя в `frontend` (`oxlint.config.ts`, `package.json`, README) — отдельным PR после bootstrap.
- Архивация старого репозитория, `npm deprecate` для `@iredtea/oxlint-plugin-jsdoc`.
- Новые правила, изменение поведения плагина, перевод на другие линтеры.
- Ручные шаги: bootstrap-публикация, GitHub Release, Trusted Publisher — их делает человек (owner npm-организации `cdd-team`).

## Анти-цели (провал, даже если формально работает)

- Тесты проходят, но проверяют меньше, чем нынешние 50 кейсов (тексты сообщений, позиции строк, перегрузки, классы, TSDoc и JSDoc с типами).
- В тестах остаётся `RuleTester`, `node --test` или `node:test`, из-за чего `bun run test` падает при `[run] bun = true`.
- В публикуемом манифесте остаются `@iredtea`, `workspace:*` или скрипты `release:*`/`prepublishOnly`.
- Релиз плагина, при котором в `dist/` нет плагина или он не грузится oxlint.

## Принятые решения

**Порядок работ (подтверждено пользователем).** Сначала один PR в `frontend-packages` из ветки `web-63` (перенос, переименование, тесты, конфиги, CI, документация). Затем owner вручную публикует `@cdd-team/oxlint-plugin-jsdoc@0.1.1`, создаёт GitHub Release `oxlint-plugin-jsdoc-v0.1.1` и настраивает Trusted Publisher. И только потом отдельным PR в `frontend` переводится потребитель, потому что без опубликованного пакета он не соберётся. PR открываются как draft; ручные шаги и PR в `frontend` в этой работе не выполняются.

**Перенос.** `git subtree add --prefix=packages/oxlint-plugin-jsdoc https://github.com/Cringe-Driven-Development-Team/oxlint-plugin-jsdoc.git main` без `--squash` (так же, как для остальных). Лишнее после переноса удаляется: `bun.lock`, `.npmrc`, `.gitignore`, `.github/workflows/ci.yml` пакета (CI общий).

**Имя и манифест.** `@cdd-team/oxlint-plugin-jsdoc` (имя в npm свободно, проверено 2026-10-18). `repository` с `url` монорепо и `directory: packages/oxlint-plugin-jsdoc`, `publishConfig.access: public`, версия `0.1.1`. Без скриптов `release:*` и `prepublishOnly`. Поля `engines.node` (`^20.19.0 || >=22.12.0`) и `peerDependencies.oxlint` (`>=1.86.0`) остаются: oxlint запускает JS-плагины под Node, это ограничение потребителя.

**Скрипты и конфиги.** Общий набор: `lint`, `fmt:check`, `typecheck`, `test`, `build` (`tsdown`). `tsconfig.json` расширяет `tsconfig.base.json` (сохраняются `allowImportingTsExtensions` и `types: ["node"]`; в `include` — `src`, `test`, `tsdown.config.ts`). Версии `typescript`, `tsdown` берутся из корня; `oxlint` в devDependencies пакета нужен для тестов (CLI), версия — не ниже `1.86.0`; корневой диапазон `oxlint` поднимается до `^1.86.0`, чтобы один пакет не тянул другую версию.

**Тесты (главное решение).** `RuleTester` из oxlint отказывается работать не на Node («`RuleTester` is not supported on … other runtimes»), а на этой Windows-машине падает и под Node 24 (`Array buffer allocation failed`). Поэтому тесты переписываются на `bun test` через CLI oxlint, без `RuleTester`:

1. Перед тестами собирается `dist` (тест вызывает сборку сам или `test` идёт после `build`; выбор исполнителя).
2. Каждый кейс `valid`/`invalid` записывается во временный файл (`.ts` или `.js` по полю `filename` кейса) во временном каталоге, рядом лежит `oxlint.config.ts` с `jsPlugins: ["<путь>/dist/index.mjs"]` и правилом `cdd/<правило>: "error"`.
3. oxlint запускается один раз на пачку (`oxlint -c <конфиг> --format json <файлы>`), диагностики сопоставляются с кейсами по имени файла.
4. Для `valid` — ноль диагностик; для `invalid` — те же сообщения, что в текущих тестах, в том же порядке, и там, где есть, номер строки (`line`).

Проверено на копии плагина в `/tmp`: `bunx oxlint -c <конфиг> --format json файл.ts` при `[run] bun = true` отдаёт диагностику с нужным текстом, кодом `cdd(require-jsdoc)`, строкой и столбцом. Обе проверены этим способом: `cdd/require-jsdoc` (сообщение про `sum`) и `cdd/check-param-names` (`@param «b»: параметр называется «a»`, `line: 4`). Сам JS-плагин oxlint исполняет настоящим Node (проверено служебным плагином, печатающим рантайм: `runtime=node 24.18.0`) даже при запуске через `bunx` и `[run] bun = true`: поэтому тестам нужен Node ≥ 20.19 или ≥ 22.12 (требование oxlint, а не наше). На `ubuntu-latest` Node предустановлен, отдельный шаг `setup-node` не нужен; локально Node у разработчика есть.

**Что покрывают нынешние тесты** (`test/rules.test.ts`, 158 строк, 50 кейсов, проверено чтением): сообщения об ошибках и в двух местах `line`; автоисправлений (`output`) нет. Сообщения на русском: `У экспорта «<имя>» нет JSDoc: добавьте комментарий /** … */ перед объявлением`, `У метода «<класс.метод>» нет JSDoc: …`, `@param «<имя>»: параметр называется «<имя>»`, `@param «<имя>»: такого параметра нет`. Новый набор должен покрывать все те же кейсы.

**release-please.** В `release-please-config.json` и `.release-please-manifest.json` добавляется `packages/oxlint-plugin-jsdoc` (`release-type: node`, `component: oxlint-plugin-jsdoc`, `changelog-path: CHANGELOG.md`, версия `0.1.1`). `bump-minor-pre-major: true` уже глобальный. Тест `scripts/release-config.test.ts` расширяется на четвёртый пакет.

**Скрипты проверки и публикации.** Пакет добавляется в `packageNames` в `scripts/verify-packages.ts` (проверка манифеста и `exports` архива). Consumer-сценарий для него не добавляется (моё решение: архив плагина проверяется манифестом и составом, установка в проект с oxlint — лишний вес). В `scripts/publish-released.ts` порядок не меняется: плагин независим и публикуется после React и Zustand.

**CI.** Общие job `check` и `packages` без изменений в структуре: тесты плагина идут в `bun run test`, отдельный Node-шаг не нужен. `[run] bun = true` не трогаем.

**Документация.** README монорепо (таблица и структура), `AGENTS.md` (структура; замечание, что тесты плагина собирают `dist` и ходят в CLI oxlint), runbook (bootstrap четвёртого пакета и Trusted Publisher для него), README плагина (имя пакета, примеры установки и `jsPlugins` с `@cdd-team/oxlint-plugin-jsdoc`).

## Решения при проверке спеки (моё решение, не согласовано с пользователем)

- **Сопоставление кейсов.** Для каждого `invalid`-кейса список сообщений из JSON oxlint сортируется по (строка, столбец) и сравнивается со списком `errors` кейса в том порядке, в каком их выдаёт `RuleTester` (по позиции); `line` проверяется там, где он есть в кейсе. Файлу кейса даётся расширение `.ts`, если у кейса есть `filename: "file.ts"`, иначе `.js`; `sourceType: module` в oxlint — значение по умолчанию. Если какой-то кейс нельзя выразить через конфиг oxlint, его адаптируют и это записывают как `Ruling:`, работу это не блокирует.
- **Сборка.** Плагин собирается в `dist/index.mjs` (проверено: `main`/`exports` и `tsdown` с `platform: node`, `dts`, `sourcemap` дают тот же вид, что у соседних пакетов); конфиг сборки считается верным, выравнивание под соседей — по общему `tsconfig.base.json`.
- **Windows.** Тесты через CLI запускаются и на этой Windows-машине (в отличие от `RuleTester`, который падает с `Array buffer allocation failed`), так что приёмка включает локальный запуск; диагностику ошибки `RuleTester` не проводим.
- **Тип коммитов переноса.** Коммиты переноса и переименования — `chore:`, а не `feat:`: старые коммиты плагина релизер не засчитает (он выбирает пакет по изменённым путям, а они лежат в корне, а не в `packages/oxlint-plugin-jsdoc`; так же было с release PR #2), а `feat` переименования дал бы минорный релиз `0.2.0` до bootstrap.
- **Release PR до bootstrap.** Пока нет тега `oxlint-plugin-jsdoc-v0.1.1`, release-please может открыть release PR; его не вливают. После bootstrap (публикация, GitHub Release с тегом) этот PR закрывают без мержа, актуальный он создаст сам при следующем пуше в `main` (так же было с PR #2).
- **Первый релиз для валидации Trusted Publisher.** Подтверждается отдельным небольшим `fix:` в пакете после bootstrap (как README-правки в PR #3); в этот PR он не входит.
- **Корневой oxlint.** Диапазон поднимается до `^1.86.0`; `bun.lock` уже резолвит `1.88.0`, поэтому версия не меняется. Если новые диагностики появятся в других пакетах, они исправляются отдельным коммитом в этом же PR.

## Ограничения

- Bun 1.4.2, TypeScript 7.0.2, tsdown 0.23.0, oxlint не ниже 1.86.0; Node и npm 11.5.1+ нужны только публикации.
- Коммиты по-русски; `feat`/`fix` дают релиз, `docs`, `test`, `chore`, `refactor` — нет. Перенос и переименование — `chore:` (см. решения выше).
- PR вливается merge-коммитом.
- Рабочее дерево с LF (`.gitattributes`).

## Оставлено исполнителю

- Точная структура тестового харнесса (общий хелпер, кеш сборки, запуск пачками), имена временных файлов, обработка кейсов с `filename` и с несколькими `errors`.
- Способ получить `dist` перед тестами.
- Формулировка текста коммитов и PR, правки README в пределах требований.

## Приёмка

Как в задаче #63, раздел «Приёмка». Часть, зависящая от ручных шагов (`npm view`, тег, Trusted Publisher, первый автоматический выпуск, перевод потребителя в `frontend`), проверяется после bootstrap и не входит в PR.
