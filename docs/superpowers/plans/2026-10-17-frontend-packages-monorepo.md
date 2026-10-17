# frontend-packages monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать `react`, `zustand-cdd`, `openapi-cdd` в Bun-монорепо `frontend-packages` с общим тулингом, CI и релизами через release-please под скоупом `@cdd-team`.

**Architecture:** Bun workspaces `packages/*`; общие конфиги в корне (`tsconfig.base.json`, `oxlint.config.ts`, `oxfmt.config.ts`), пакеты расширяют их. История старых репозиториев переносится `git subtree add`. CI один: проверки → интеграция → сборка архивов и установка в чистый проект. Релиз: release-please (manifest, `node-workspace`), затем последовательная публикация `npm publish` через OIDC только для `paths_released`.

**Tech Stack:** Bun 1.4.2, TypeScript 7.0.2, tsdown 0.23.0, oxlint, oxfmt, bun test + happy-dom, GitHub Actions, release-please, npm CLI ≥ 11.5.1, Node ≥ 22.14.0.

**Spec:** задача https://github.com/Cringe-Driven-Development-Team/frontend/issues/18 (локально: `gh issue view 18 -R Cringe-Driven-Development-Team/frontend`).

## Global Constraints

- Имена: `@cdd-team/react`, `@cdd-team/zustand`, `@cdd-team/openapi`; каталоги `packages/react`, `packages/zustand`, `packages/openapi`.
- `repository.url` = `git+https://github.com/Cringe-Driven-Development-Team/frontend-packages.git`, `repository.directory` = `packages/<name>`.
- Стартовые версии: react `1.2.0`, zustand `1.0.0`, openapi `0.2.0`. Теги: `react-v1.2.0`, `zustand-v1.0.0`, `openapi-v0.2.0`; `include-component-in-tag: true`; компоненты `react`, `zustand`, `openapi`.
- Zustand: `@cdd-team/react` — optional peer (`peerDependenciesMeta.optional: true`), экспорт `./vanilla` сохраняется; в devDependencies — semver-диапазон (не `workspace:*`), резолвится в workspace.
- В опубликованных архивах нет `workspace:*` и упоминаний `@maninthecoat`/`@iredtea`.
- Единый набор скриптов в каждом пакете: `lint`, `fmt:check`, `typecheck`, `test`, `build`. Скриптов `release:*` и `prepublishOnly` с ручным `bun publish` нет.
- Постоянных npm-секретов (`NPM_TOKEN`, `NODE_AUTH_TOKEN`, токен в `.npmrc`) нет. Publish job: GitHub-hosted runner, `id-token: write`, Node `22.14.0`+, npm `11.5.1`+ (версия проверяется явно). Release-please job: `pull-requests: write`, `contents: write`.
- Порядок публикации: react перед zustand; публикуются только пути из `paths_released`; ошибка останавливает дальнейшие публикации.
- Типы коммитов: `feat`/`fix` дают релиз; `test`/`docs`/`chore`/`refactor` без breaking — нет; breaking — `feat!`. PR вливаются merge-коммитом.
- Коммиты на русском в стиле репозиториев (`feat: …`, `chore: …`).

## Review Focus

- Zustand собран с `neverBundle: ["@cdd-team/react"]` — в `dist/` не должно остаться инлайна React (проверяет Task 5).
- `@cdd-team/zustand/vanilla` импортируется там, где `@cdd-team/react` не установлен (Task 4, Task 5).
- Чистая установка обоих локальных архивов вместе: registry не должен подтянуть `@maninthecoat/react` или старый `@cdd-team/react` (Task 5).
- Коммит `test:`/`docs:` не создаёт release PR — скрытые типы в `changelog-sections` (Task 7).
- Публикация при `paths_released = []` или только `packages/openapi` не трогает react/zustand (Task 8).

---

### Task 1: Корневой каркас workspace

**Files:**
- Create: `package.json`, `bunfig.toml`, `.gitignore`, `.bvmrc`, `tsconfig.base.json`, `oxlint.config.ts`, `oxfmt.config.ts`

**Interfaces:**
- Produces: корневые скрипты `lint`, `fmt:check`, `typecheck`, `test`, `build` = `bun run --filter './packages/*' <script>`; `tsconfig.base.json` с общими `compilerOptions` из `react/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `moduleResolution: bundler`, `module: Preserve`, `target: ESNext`, `lib: [ESNext, DOM]`, `noEmit`, `skipLibCheck`, `types: [bun]`); `oxfmt.config.ts` (`useTabs: true`, ignore `**/*.md`, `**/*.json`, `**/*.lock`, `dist`); `oxlint.config.ts` (plugins `typescript`, `react`; `correctness: error`; правила `react/rules-of-hooks`, `react/exhaustive-deps`; override `files: ["**/test/react/**"]` → `react/globals: off`; игнор `dist/`, `node_modules/`).

- [ ] **Step 1:** `package.json`: `"private": true`, `"workspaces": ["packages/*"]`, `"packageManager": "bun@1.4.2"`, devDependencies с едиными версиями `typescript@7.0.2`, `tsdown@0.23.0`, `oxlint@^1.79.0`, `oxfmt@^0.64.0`, `@types/bun@1.4.2`.
- [ ] **Step 2:** остальные файлы из Interfaces; `.gitignore` скопировать из `../react/.gitignore`, `.bvmrc` = `1.4.2`.
- [ ] **Step 3:** `bun install` — Expected: lockfile создан без ошибок.
- [ ] **Step 4: Commit** `chore: каркас bun workspaces и общие конфиги`

### Task 2: Перенос истории трёх репозиториев

**Files:** `packages/react/**`, `packages/zustand/**`, `packages/openapi/**` (создаются через subtree).

**Interfaces:** Produces: содержимое старых репозиториев (включая `react/playground`) под `packages/<name>/`, история сохранена.

- [ ] **Step 1:** Для каждой пары (`react`→`packages/react`, `zustand-cdd`→`packages/zustand`, `openapi-cdd`→`packages/openapi`): `git subtree add --prefix=packages/<name> https://github.com/Cringe-Driven-Development-Team/<repo>.git main` (без `--squash`). Expected: исходные коммиты в `git log`.
- [ ] **Step 2:** Проверка авторства: `git shortlog -sne` содержит `ManInTheCoat` и `Yaroslav Mihalev`; число коммитов ≥ 1 + 23 + 9 + 13.
- [ ] **Step 3:** Удалить дублирующее корень: `packages/*/bun.lock`, `packages/*/.npmrc` (сначала прочитать — токенов быть не должно), `packages/*/.gitignore` (кроме `packages/react/playground/.gitignore`), `packages/*/.idea`, `packages/react/.bvmrc`, `packages/react/oxfmt.config.ts`, `packages/zustand/{oxfmt,oxlint}.config.ts`, `packages/openapi/.github` и `packages/react/.github` (workflow `automation.yml` из react сначала скопировать в корневой `.github/workflows/automation.yml` без изменений; CI пишется в Task 6).
- [ ] **Step 4: Commit** `chore: удалены дублирующие конфиги перенесённых пакетов`

### Task 3: Переименование и унификация пакетов

**Files:** `packages/*/package.json`, `packages/*/tsconfig.json`, `packages/*/tsdown.config.ts`, `packages/*/README.md`, `packages/react/playground/{package.json,tsconfig.json,src/**}`, все `src/**` и `test/**` с импортами `@maninthecoat/react`.

**Interfaces:**
- Consumes: Task 1 (`tsconfig.base.json`, корневые конфиги).
- Produces: манифесты с `name`, `version` (react `1.2.0`, zustand `1.0.0`, openapi `0.2.0`), `repository: {type:"git", url, directory}`, `publishConfig: {access:"public"}`; скрипты `lint: "oxlint -c ../../oxlint.config.ts src [test]"`, `fmt:check: "oxfmt -c ../../oxfmt.config.ts --check src [test]"`, `typecheck: "tsc --noEmit"`, `test`, `build: "tsdown"`; у zustand `peerDependencies: {"@cdd-team/react": "^1.2.0"}` + optional meta, `devDependencies: {"@cdd-team/react": "^1.2.0"}`.

- [ ] **Step 1:** Заменить во всех файлах пакетов `@maninthecoat/react`→`@cdd-team/react`, `@maninthecoat/zustand`→`@cdd-team/zustand`, `@iredtea/openapi`→`@cdd-team/openapi` (включая `jsxImportSource` и `paths` в react, `neverBundle` в zustand, README, docs). Проверка: `git grep -nE "@maninthecoat|@iredtea" -- . ':!docs/superpowers'` — пусто. Файлы читать и писать как UTF-8 (описания в `package.json` на кириллице).
- [ ] **Step 2:** Манифесты по Interfaces; удалить `release:*`, `prepublishOnly`, `format*`, `fmt`; скрипты `apidog`, `generate`, `sync`, `demo` в openapi оставить.
- [ ] **Step 3:** `tsconfig.json` каждого пакета: `extends: "../../tsconfig.base.json"` + специфика (jsx/jsxImportSource/paths у react и zustand), `include` как раньше.
- [ ] **Step 4:** Playground добавить в корневой `workspaces` строкой `packages/react/playground`; зависимость `@cdd-team/react: ^1.2.0` резолвится локально; общий набор скриптов его не касается (корневые скрипты фильтруют `./packages/*`).
- [ ] **Step 5:** `bun install && bun run lint && bun run fmt:check && bun run typecheck && bun run build` — Expected: зелёные. `fmt:check` падает → `bun x oxfmt -c oxfmt.config.ts <dirs>` и повторить.
- [ ] **Step 6: Commit** `feat: пакеты переименованы в @cdd-team и приведены к общему набору скриптов`

### Task 4: Тесты пакетов и runtime-интеграция

**Files:**
- Create: `packages/react/test/smoke.test.tsx`, `packages/react/test/setup-dom.ts` (копия `packages/zustand/test/setup-dom.ts`), `packages/openapi/test/smoke.test.ts`, `tests/integration/react-zustand.test.tsx`, `tests/integration/vanilla.test.ts`, `tests/integration/setup-dom.ts`
- Modify: `packages/react/package.json`, `packages/openapi/package.json` (скрипт `test`), корневой `package.json` (`test:integration`)

**Interfaces:**
- Produces: `bun run test` в каждом пакете; корневой `test:integration` = `bun test --preload ./tests/integration/setup-dom.ts tests/integration/react-zustand.test.tsx && bun test tests/integration/vanilla.test.ts`.

- [ ] **Step 1:** `smoke.test.tsx` (react): компонент со счётчиком на `useState` рендерится публичным API из `../src` в happy-dom, клик увеличивает значение. `"test": "bun test --preload ./test/setup-dom.ts test"`.
- [ ] **Step 2:** `smoke.test.ts` (openapi): минимальная spec через публичный `generator` даёт вывод с именем пути (публичные экспорты — по `src/index.ts`/`src/generator.ts`). `"test": "bun test test"`.
- [ ] **Step 3:** `react-zustand.test.tsx`: `render`/хуки из `@cdd-team/react`, `createStore`/`useStore` из `@cdd-team/zustand` (workspace-резолв); тест «компонент читает store через хук, `setState` обновляет DOM» — ожидание по образцу `packages/zustand/test/react/utils.ts`.
- [ ] **Step 4:** `vanilla.test.ts`: импорт только `@cdd-team/zustand/vanilla`, подписка срабатывает; запускается без preload и без импорта react.
- [ ] **Step 5:** `bun run test && bun run test:integration` — Expected: PASS. Затем временно сломать `useStore`, убедиться, что интеграционный тест падает, откатить.
- [ ] **Step 6: Commit** `test: smoke-тесты пакетов и интеграция react + zustand`

### Task 5: Проверка архивов в чистом проекте

**Files:**
- Create: `scripts/verify-packages.ts`, `scripts/verify-packages.test.ts`, `scripts/fixtures/consumer/{package.json,tsconfig.json,app.test.tsx}`, `scripts/fixtures/vanilla/{package.json,tsconfig.json,vanilla.test.ts}`
- Modify: корневой `package.json` (`verify:packages`)

**Interfaces:**
- Produces: `packAll(outDir: string): Promise<Record<"react"|"zustand"|"openapi", string>>` (пути tgz из `npm pack --pack-destination`); `checkManifest(pkg: Record<string, unknown>, expect: { name: string; directory: string }): string[]` — список нарушений: `workspace:` в dependency-блоках, `@maninthecoat`/`@iredtea`, неверный `repository`, нет `publishConfig.access`; `verify(): Promise<void>` — CLI `bun scripts/verify-packages.ts`, ненулевой код при нарушениях.

- [ ] **Step 1 (failing test):** `checkManifest({name:"x", dependencies:{a:"workspace:*"}}, …)` возвращает ровно одно нарушение со словом `workspace:`; чистый манифест — `[]`. `bun test scripts` — FAIL.
- [ ] **Step 2:** Реализовать `checkManifest`; PASS.
- [ ] **Step 3:** `packAll` и `verify`: `bun run build`, упаковать, распаковать каждый архив, проверить манифест и что каждый путь из `exports` есть в архиве; `dist/index.mjs` zustand содержит `from "@cdd-team/react"` и не инлайнит React.
- [ ] **Step 4:** Сценарий consumer во временном каталоге вне workspace (`os.tmpdir()`): `bun add ./react.tgz ./zustand.tgz` одной командой, затем `tsc --noEmit` и `bun test` (компонент + store). Сценарий vanilla — отдельный temp-проект, `bun add ./zustand.tgz` без react, проверка что `node_modules/@cdd-team/react` отсутствует, `bun test` на `@cdd-team/zustand/vanilla`.
- [ ] **Step 5:** `bun run verify:packages` — Expected: `OK` по трём архивам и двум сценариям; temp-каталоги удалены.
- [ ] **Step 6: Commit** `feat: проверка npm-архивов установкой в чистый проект`

### Task 6: CI

**Files:** Create: `.github/workflows/ci.yml`

**Interfaces:** Produces: workflow `CI` на `pull_request` (все ветки, включая `release-please--*`) и `push` в `main`.

- [ ] **Step 1:** Job `check`: `actions/checkout@v7`, `oven-sh/setup-bun@v2` (`bun-version: 1.4.2`), `bun install --frozen-lockfile`, затем `fmt:check`, `lint`, `typecheck`, `test`, `test:integration`, `test:release`, `build`. Job `packages` (needs `check`): `actions/setup-node` с Node 22.14.0, `bun run verify:packages`. Права `contents: read`.
- [ ] **Step 2:** PR от `GITHUB_TOKEN` workflow не запускает — release-please (Task 8) работает с `RELEASE_PLEASE_TOKEN`; отметить в README и runbook.
- [ ] **Step 3:** Проверить синтаксис (`actionlint`, если нет — `bunx --bun yaml-lint`/ручной разбор через `bun -e "Bun.YAML.parse(...)"`).
- [ ] **Step 4: Commit** `ci: проверки пакетов и установка архивов в чистый проект`

### Task 7: release-please

**Files:** Create: `release-please-config.json`, `.release-please-manifest.json`, `scripts/release-config.test.ts`; Modify: корневой `package.json` (`test:release`)

**Interfaces:** Produces: manifest `{"packages/react":"1.2.0","packages/zustand":"1.0.0","packages/openapi":"0.2.0"}`; конфиг: `include-component-in-tag: true`, `separate-pull-requests: false`, `plugins: [{"type":"node-workspace","updatePeerDependencies":true}]`, для каждого пути `{"release-type":"node","component":"react|zustand|openapi","changelog-path":"CHANGELOG.md"}`, `changelog-sections`: видимы `feat`, `fix`; `test`, `docs`, `chore`, `refactor` — `hidden: true`.

- [ ] **Step 1 (failing test):** `release-config.test.ts` проверяет всё из Interfaces плюс совпадение версии каждого `packages/*/package.json` с manifest. `bun run test:release` — FAIL.
- [ ] **Step 2:** Создать файлы; PASS.
- [ ] **Step 3: Commit** `ci: release-please в manifest-режиме с node-workspace`

### Task 8: Workflow выпуска и публикация

**Files:** Create: `.github/workflows/release.yml`, `scripts/publish-released.ts`, `scripts/publish-released.test.ts`

**Interfaces:**
- Produces: `orderForPublish(paths: string[]): string[]` — `packages/react` перед `packages/zustand`, прочие после, порядок стабилен; `publishReleased(paths: string[], run: (cmd: string[], cwd: string) => Promise<number>): Promise<void>` — по порядку `npm publish --access public` из каталога пакета; при ненулевом коде бросает и не публикует остальные; пустой список — `run` не вызывается. CLI: `bun scripts/publish-released.ts '<json paths_released>'`.

- [ ] **Step 1 (failing tests):** порядок `["packages/zustand","packages/openapi","packages/react"]` → react, zustand, openapi; `[]` не вызывает `run`; падение первой публикации — `run` вызван один раз; `["packages/openapi"]` не публикует react/zustand. FAIL.
- [ ] **Step 2:** Реализовать; PASS.
- [ ] **Step 3:** `release.yml` (триггер `push` в `main`): job `release-please` (`contents: write`, `pull-requests: write`; `googleapis/release-please-action@v4`, `config-file`, `manifest-file`, `token: ${{ secrets.RELEASE_PLEASE_TOKEN }}`; outputs `releases_created`, `paths_released`); job `publish` (`needs`, `if: needs.release-please.outputs.releases_created == 'true'`, GitHub-hosted runner, `contents: read`, `id-token: write`; checkout, setup-bun, `actions/setup-node` с `node-version: 22.14.0` и `registry-url` без `NODE_AUTH_TOKEN`; явная проверка `node --version` ≥ 22.14.0 и `npm --version` ≥ 11.5.1 с `npm install -g npm@^11.5.1` при необходимости; `bun install --frozen-lockfile`, `bun run build`, `bun run verify:packages`, `bun scripts/publish-released.ts '${{ needs.release-please.outputs.paths_released }}'`). Environment не использовать.
- [ ] **Step 4:** Проверить синтаксис как в Task 6; `git grep -nE "NPM_TOKEN|NODE_AUTH_TOKEN|_authToken" -- . ':!docs'` — пусто.
- [ ] **Step 5: Commit** `ci: автоматическая публикация изменённых пакетов через OIDC`

### Task 9: README и документация процесса

**Files:** Modify: `README.md`; Create: `docs/release-runbook.md`

- [ ] **Step 1:** `README.md`: структура, как добавить пакет (каталог, строки в `release-please-config.json` и manifest, Trusted Publisher), роли инструментов (Bun — установка/тулинг/тесты/сборка; npm CLI — OIDC-публикация; release-please — версии/CHANGELOG/release PR), типы коммитов (`feat`/`fix` → релиз; `test`/`docs`/`chore`/`refactor` без breaking — нет; breaking — `feat!`; накопленные изменения учитываются; merge-коммит), ссылка на https://docs.cellestial.ru/modules/2/tracks/front-libs.
- [ ] **Step 2:** `docs/release-runbook.md`: (а) bootstrap — `npm publish --access public` react → zustand → openapi участником с правами на `cdd-team` (интерактивный login + 2FA), проверка `npm view`, GitHub Releases `react-v1.2.0`/`zustand-v1.0.0`/`openapi-v0.2.0` на проверенном коммите, соответствие manifest; (б) Trusted Publishing — owner `Cringe-Driven-Development-Team`, repo `frontend-packages`, workflow `release.yml`, **Allow npm publish**, подтверждение выпуском в течение двух дней; (в) секрет `RELEASE_PLEASE_TOKEN`; (г) восстановление частичного выпуска — логи, теги, `npm view <pkg>@<ver>`, задержка registry, не перезаписывать существующее, публиковать только отсутствующие пути из того же коммита (`bun scripts/publish-released.ts '["packages/zustand"]'`), изменение содержимого — новая версия, затем повторные `npm view` и чистая установка; (д) сценарий проверки `fix:` в react → react `1.2.1`, zustand `1.0.1`, peer `^1.2.1`, OpenAPI `0.2.0` без выпуска.
- [ ] **Step 3:** `git grep -nE "@maninthecoat|@iredtea" -- README.md docs/release-runbook.md` — пусто.
- [ ] **Step 4: Commit** `docs: README монорепо и runbook выпуска`

### Task 10: Итоговая локальная проверка

- [ ] **Step 1:** `bun install --frozen-lockfile && bun run fmt:check && bun run lint && bun run typecheck && bun run test && bun run test:integration && bun run test:release && bun run build && bun run verify:packages` — Expected: всё зелёное.
- [ ] **Step 2:** `git shortlog -sne` — исходные авторы на месте.
- [ ] **Step 3:** Список ручных действий для человека (не выполнять): push `web-18` и PR со строкой `Closes Cringe-Driven-Development-Team/frontend#18`; организация `cdd-team` и bootstrap-публикация; GitHub Releases; Trusted Publisher для трёх пакетов; секрет `RELEASE_PLEASE_TOKEN`.
