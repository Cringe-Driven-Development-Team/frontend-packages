# Вынос oxlint-plugin-jsdoc в монорепо: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (пользователь запретил subagent-driven-development). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести `@iredtea/oxlint-plugin-jsdoc` в монорепо как `@cdd-team/oxlint-plugin-jsdoc` (`packages/oxlint-plugin-jsdoc`, версия `0.1.1`) с общим тулингом, тестами на `bun test`, release-please и документацией.

**Architecture:** `git subtree add` переносит репозиторий плагина с историей. Пакет приводится к общему набору скриптов и конфигам. Тесты `RuleTester` заменяются на `bun test`, который собирает `dist`, пачкой запускает CLI oxlint с плагином и сверяет JSON-диагностики. Пакет добавляется в release-please, скрипты проверки архивов и публикации, документацию.

**Tech Stack:** Bun 1.4.2, TypeScript 7.0.2, tsdown 0.23.0, oxlint ≥ 1.86.0 (CLI, JS-плагины), bun test, release-please.

**Spec:** `docs/superpowers/specs/2026-10-18-oxlint-plugin-jsdoc-monorepo-design.md` (утверждена пользователем); требования и приёмка — задача https://github.com/Cringe-Driven-Development-Team/frontend/issues/63. При расхождении прав спека.

## Global Constraints

- Имя: `@cdd-team/oxlint-plugin-jsdoc`, каталог `packages/oxlint-plugin-jsdoc`, версия `0.1.1`, компонент release-please `oxlint-plugin-jsdoc`, тег `oxlint-plugin-jsdoc-v0.1.1`.
- `repository.url` = `git+https://github.com/Cringe-Driven-Development-Team/frontend-packages.git`, `repository.directory` = `packages/oxlint-plugin-jsdoc`, `publishConfig.access: public`. Без `release:*` и `prepublishOnly`.
- `engines.node` (`^20.19.0 || >=22.12.0`) и `peerDependencies.oxlint` (`>=1.86.0`) сохраняются. Имя плагина в oxlint остаётся `cdd` (правила `cdd/require-jsdoc`, `cdd/check-param-names`).
- Общий набор скриптов: `lint`, `fmt:check`, `typecheck`, `test`, `build`. Тесты — только `bun test`: без `RuleTester`, `node:test`, `node --test`.
- Тесты покрывают все 50 нынешних кейсов (тексты сообщений, `line` там, где он есть, перегрузки, классы, TSDoc/JSDoc с типами). Автоисправлений в плагине нет.
- В манифесте архива нет `@iredtea`, `workspace:*` и скриптов `release:*`.
- Коммиты по-русски; перенос и переименование — `chore:`, а не `feat:` (иначе минорный релиз до bootstrap). Работа в ветке `web-63`, worktree `.claude/worktrees/web-63`. PR — draft.
- Не выполнять без отдельной просьбы: `npm publish`, GitHub Releases, настройка Trusted Publisher, PR в `frontend`, `git push` (push и PR — после подтверждения пользователя). Ручные шаги перечисляются в Task 8.
- Файлы UTF-8, LF; консоль Windows показывает кириллицу кракозябрами у корректных файлов — проверять чтением через bun/node.

## Review Focus

- Тесты не слабее прежних: число портированных кейсов равно 50 (valid + invalid обоих правил), сообщения посимвольно как в оригинале; кейсы с несколькими `errors` и `line` проверяются (Task 3).
- Тест реально падает, если сломать правило (мутация, Task 3), и не зависит от порядка запуска/остатков временных файлов.
- Плагин в архиве загружается oxlint: `dist/index.mjs` есть в архиве и в `exports` (Task 5).
- Release PR до bootstrap не вливается; нет `feat:` в переносе (Task 1, 2).
- `bun run test` в корне не ломается из-за плагина: сборка перед тестом, временные каталоги чистятся (Task 3).

---

### Task 1: Перенос репозитория с историей

**Files:** `packages/oxlint-plugin-jsdoc/**` (создаётся через subtree).

**Interfaces:** Produces: содержимое репозитория плагина под `packages/oxlint-plugin-jsdoc/`, история сохранена.

- [ ] **Step 1:** `git subtree add --prefix=packages/oxlint-plugin-jsdoc https://github.com/Cringe-Driven-Development-Team/oxlint-plugin-jsdoc.git main` (без `--squash`, дерево чистое). Expected: исходные коммиты в `git log`.
- [ ] **Step 2:** Авторы: `git shortlog -sn HEAD` содержит `iRedTea`, `Yaroslav Mihalev`, `Denis Istratov`; в `git log` 7 исходных коммитов плагина.
- [ ] **Step 3:** Удалить дублирующее корень: `packages/oxlint-plugin-jsdoc/{bun.lock,.npmrc,.gitignore}` и `.github/`. Перед удалением прочитать `.npmrc` (токенов быть не должно; значения в отчёт не выводить).
- [ ] **Step 4: Commit** `chore: удалены дублирующие конфиги перенесённого пакета`

### Task 2: Переименование и общий набор скриптов

**Files:** `packages/oxlint-plugin-jsdoc/{package.json,tsconfig.json,tsdown.config.ts,README.md,src/**,test/**}`, корневой `package.json`, `bun.lock`.

**Interfaces:**
- Consumes: корневые `tsconfig.base.json`, `oxlint.config.ts`, `oxfmt.config.ts`.
- Produces: манифест `name: "@cdd-team/oxlint-plugin-jsdoc"`, `version: "0.1.1"`, `repository`, `publishConfig`; скрипты `lint: "oxlint -c ../../oxlint.config.ts src test"`, `fmt:check: "oxfmt -c ../../oxfmt.config.ts --check src test"`, `typecheck: "tsc --noEmit"`, `build: "tsdown"` (скрипт `test` добавляется в Task 3); devDependencies только `oxlint` (версия `1.86.0` как раньше или выше, нужна CLI тестам) и `@types/node`; `tsconfig.json` расширяет `../../tsconfig.base.json` (сохранить `allowImportingTsExtensions`, `types: ["node"]`, `include: ["src","test","tsdown.config.ts"]`). Корневой `oxlint` — `^1.86.0`.

- [ ] **Step 1:** Заменить `@iredtea/oxlint-plugin-jsdoc` → `@cdd-team/oxlint-plugin-jsdoc` во всех файлах пакета (README, примеры `jsPlugins`, ссылки). Проверка: `git grep -nE "@iredtea|iredtea" -- packages/oxlint-plugin-jsdoc` пусто.
- [ ] **Step 2:** Манифест по Interfaces: удалить `release:*`, `prepublishOnly`, текущий скрипт `test` (`node --test …`), `typescript` и `tsdown` из devDependencies. README пакета — установка `bun add -d @cdd-team/oxlint-plugin-jsdoc`.
- [ ] **Step 3:** `bun install` (lockfile обновлён), затем `bun run --filter @cdd-team/oxlint-plugin-jsdoc lint`, `fmt:check`, `typecheck`, `build`. Если `fmt:check` падает на импортированном коде — `oxfmt -c ../../oxfmt.config.ts src test` отдельным коммитом `chore: форматирование перенесённого плагина`. Правки кода ради линтера минимальны, список — в отчёт. Build: `dist/index.mjs` существует.
- [ ] **Step 4: Commit** `chore: плагин переименован в @cdd-team и приведён к общему набору скриптов`

### Task 3: Тесты на bun test через CLI oxlint

**Files:**
- Create: `packages/oxlint-plugin-jsdoc/test/helpers/lint-cases.ts`, `packages/oxlint-plugin-jsdoc/test/rules.test.ts` (заменяет старый)
- Modify: `packages/oxlint-plugin-jsdoc/package.json` (`test`)

**Interfaces:**
- Produces: `lintCases(rule: "require-jsdoc" | "check-param-names", cases: Array<{ code: string; filename?: string }>): Promise<Array<Array<{ message: string; line: number }>>>` — для i-го кейса список диагностик, отсортированный по (строка, столбец). Реализация: временный каталог (`mkdtemp`, удаляется в `finally`), файл на кейс (`.ts` если `filename` заканчивается на `.ts`, иначе `.js`), `oxlint.config.ts` с `jsPlugins: [<абсолютный путь к dist/index.mjs>]` и `rules: { "cdd/<rule>": "error" }`, один запуск CLI oxlint (`--format json`, абсолютные пути файлов) из `node_modules/.bin`/`bunx`, сопоставление диагностик по `filename`. Падает с понятной ошибкой, если `dist/index.mjs` нет или oxlint вернул не-JSON.
- `package.json`: `"test": "bun run build && bun test test"`.

- [ ] **Step 1 (failing test):** В новом `test/rules.test.ts` (пока без helper) записать один кейс: `lintCases("require-jsdoc", [{ code: "export function sum(a, b) { return a + b; }" }])` ожидает `[[{ message: "У экспорта «sum» нет JSDoc: добавьте комментарий /** … */ перед объявлением", line: 1 }]]`. `bun test test` — Expected: FAIL (модуль `./helpers/lint-cases.ts` не найден).
- [ ] **Step 2:** Реализовать `lintCases`; тест PASS. Проверить на втором правиле: `check-param-names` с кейсом `@param b` против параметра `a` даёт `@param «b»: параметр называется «a»`, `line: 4`.
- [ ] **Step 3:** Перенести все кейсы старого `test/rules.test.ts` (взять из `git show HEAD:packages/oxlint-plugin-jsdoc/test/rules.test.ts`), данные и тексты сообщений без изменений: `valid` — диагностик нет, `invalid` — список сообщений совпадает с `errors` (порядок по позиции), `line` проверяется там, где он был. Один `test(...)` на кейс с именем из начала кода кейса; кейсы с `filename: "file.ts"` идут как `.ts`. Проверка полноты: число портированных кейсов равно 50 (подсчитать в оригинале: все элементы `valid` и `invalid` обоих `tester.run`), добавить в тест ассерт на это число или сверить скриптом и записать в отчёт.
- [ ] **Step 4:** Удалить `node:test`/`RuleTester` из тестов; `bun run --filter @cdd-team/oxlint-plugin-jsdoc test` — PASS, 50 кейсов, вывод без шума.
- [ ] **Step 5 (мутация):** временно сломать `src/rules/require-jsdoc.ts` (например, не репортить экспорты-классы) и убедиться, что падает несколько тестов; то же для `check-param-names`; откатить `git checkout`-ом файлов и убедиться, что рабочее дерево чисто.
- [ ] **Step 6:** Корневые проверки: `bun run fmt:check`, `lint`, `typecheck`, `test` зелёные (корневой `test` запускает тесты плагина после сборки).
- [ ] **Step 7: Commit** `test: тесты плагина на bun test через CLI oxlint вместо RuleTester`

### Task 4: release-please

**Files:** `release-please-config.json`, `.release-please-manifest.json`, `scripts/release-config.test.ts`.

**Interfaces:** Produces: в конфиге `packages/oxlint-plugin-jsdoc` = `{ "release-type": "node", "component": "oxlint-plugin-jsdoc", "changelog-path": "CHANGELOG.md" }`; в manifest `"packages/oxlint-plugin-jsdoc": "0.1.1"`.

- [ ] **Step 1 (failing test):** В `scripts/release-config.test.ts` добавить `"packages/oxlint-plugin-jsdoc": { component: "oxlint-plugin-jsdoc" }` в `expected`. `bun run test:scripts` — Expected: FAIL (нет пути в конфиге и manifest).
- [ ] **Step 2:** Добавить запись в `release-please-config.json` и `.release-please-manifest.json`; тест PASS (включая «версия в package.json равна manifest»).
- [ ] **Step 3: Commit** `ci: плагин jsdoc в конфигурации release-please`

### Task 5: Проверка архивов и порядок публикации

**Files:** `scripts/verify-packages.ts`, `scripts/verify-packages.test.ts`, `scripts/publish-released.test.ts`.

**Interfaces:** Produces: `PackageName` и `packageNames` включают `"oxlint-plugin-jsdoc"`; `orderForPublish` не меняется (React, Zustand, затем остальные).

- [ ] **Step 1 (failing tests):** В `verify-packages.test.ts` — тест `packageNames` содержит `"oxlint-plugin-jsdoc"` и ровно четыре имени; в `publish-released.test.ts` — `orderForPublish(["packages/oxlint-plugin-jsdoc","packages/zustand","packages/react"])` даёт react, zustand, oxlint-plugin-jsdoc. Запуск `bun run test:scripts` — Expected: FAIL.
- [ ] **Step 2:** Добавить имя в тип и список; тесты PASS.
- [ ] **Step 3:** `bun run verify:packages` — Expected: `OK`, архив плагина проходит `checkManifest` (имя, `repository`, `publishConfig`), `exports` указывают на существующие в архиве файлы. Consumer-сценарий для плагина не добавляется (решение спеки).
- [ ] **Step 4 (мутация):** временно оставить в манифесте плагина `@iredtea` в `peerDependencies` → `verify:packages` падает с нарушением; откатить.
- [ ] **Step 5: Commit** `ci: проверка архива и порядок публикации учитывают плагин jsdoc`

### Task 6: Документация

**Files:** `README.md`, `AGENTS.md`, `docs/release-runbook.md`, `packages/oxlint-plugin-jsdoc/README.md`.

- [ ] **Step 1:** README монорепо: строка в таблице пакетов и в структуре; тесты плагина через CLI oxlint (нужен Node ≥ 20.19/22.12 — требование oxlint; на CI предустановлен). `AGENTS.md`: четвёртый пакет в «Что где лежит» и замечание, что тесты плагина собирают `dist` и ходят в CLI oxlint (Node исполняет сам oxlint), не `RuleTester`.
- [ ] **Step 2:** `docs/release-runbook.md`: bootstrap четвёртого пакета (`cd packages/oxlint-plugin-jsdoc && npm publish --access public`, версия `0.1.1`, тег `oxlint-plugin-jsdoc-v0.1.1`, `npm view`), Trusted Publisher для него, закрытие устаревшего release PR после baseline.
- [ ] **Step 3:** README плагина: имя пакета, `jsPlugins: ['@cdd-team/oxlint-plugin-jsdoc']`, требования (oxlint ≥ 1.86, Node для JS-плагинов); без упоминаний `@iredtea`.
- [ ] **Step 4:** `git grep -nE "@iredtea|iredtea" -- README.md AGENTS.md docs/release-runbook.md packages` — пусто (кроме `docs/superpowers`).
- [ ] **Step 5: Commit** `docs: плагин jsdoc в README, AGENTS.md и runbook`

### Task 7: Итоговая проверка

- [ ] **Step 1:** Чистая установка и полная цепочка: `bun install --frozen-lockfile && bun run fmt:check && bun run lint && bun run build && bun run typecheck && bun run test && bun run test:integration && bun run test:scripts && bun run verify:packages` — всё зелёное; `actionlint` по workflow без ошибок.
- [ ] **Step 2:** `git shortlog -sn HEAD` — авторы плагина на месте; `git log --oneline origin/main..HEAD` без `feat:`-коммитов переноса.

### Task 8: Ручные шаги (не выполнять, только передать)

- [ ] **Step 1:** Список для человека: push `web-63` и draft PR (после подтверждения); после мержа — `npm publish --access public` из `packages/oxlint-plugin-jsdoc` (версия `0.1.1`), GitHub Release `oxlint-plugin-jsdoc-v0.1.1` на проверенном коммите, закрыть устаревший release PR, Trusted Publisher для пакета (repo `frontend-packages`, workflow `release.yml`, без environment, **Allow npm publish**), небольшой `fix:` в пакете для первого OIDC-выпуска в течение 48 часов, затем отдельный PR в `frontend` с переводом потребителя.
