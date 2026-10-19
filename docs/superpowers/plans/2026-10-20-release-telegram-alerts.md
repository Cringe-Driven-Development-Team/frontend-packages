# Telegram-алерты о выпуске: план реализации

> **Статус:** задача требует проверки сценариев с подменёнными npm/Telegram, но не тестов в репозитории. По решению автора новые тесты пишутся и прогоняются при разработке, а в Task 8 удаляются из PR. Существующие тесты `scripts/publish-released.test.ts` остаются, адаптированные под новую сигнатуру.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** после каждого выпуска из `paths_released` отправлять в тред Frontend / Releases одну достоверную итоговую карточку (успех, частичный выпуск, ошибка, неизвестный результат).

**Architecture:** `publish-released.ts` перестаёт бросать исключения и пишет `release-report.json` со статусом каждого пакета. Новый job `notify` (без `id-token: write`) собирает модель из отчёта, outcomes шагов publish, `CHANGELOG.md`, git-тегов и registry, рендерит HTML-карточку с inline-кнопками и отправляет её через Bot API. Чистые функции отделены от ввода-вывода, тот подменяется в тестах.

**Tech Stack:** TypeScript, Bun (`bun test`, `Bun.spawn`, `fetch`), GitHub Actions, Telegram Bot API (`sendMessage`, `parse_mode: "HTML"`).

**Spec:** `docs/superpowers/specs/2026-10-20-release-telegram-alerts-design.md`. Источник требований — issue #6.

## Global Constraints

- Тесты только `bun test`, файлы `scripts/*.test.ts` (их запускает `bun run test:scripts`). Никаких запросов к реальному npm и Telegram в тестах.
- Без новых зависимостей: semver-сравнение, разбор changelog и HTTP пишутся на месте.
- Telegram-секреты только в job `notify`; токен не печатается ни в лог, ни в summary.
- Ни в одной ветке кода не писать «отсутствует» о версии в npm: только «не видна в registry», «не подтверждена», «не проверено».
- Код не перечисляет пакеты: всё выводится из `paths_released`, `package.json` пути и `release-please-config.json`.
- Скрипты в Bun запускаются напрямую (`bun scripts/<файл>.ts`), не через `bun run`.
- Коммиты по-русски, `тип: что сделано`, в конце `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Не пушить и не открывать PR без просьбы; PR потом draft, `Closes #6`.
- Перед каждым коммитом из корня: `bun run fmt:check && bun run lint && bun run typecheck` (после `bun run build`, если `dist` ещё нет).

## Review Focus

- **Changelog с пунктами-ссылками и `**scope:**`** (release-please пишет `* **react:** текст ([sha](url))`): в карточке должен остаться только текст, без `**` и хвоста. Тест в Task 2: `убирает scope и ссылку на коммит`.
- **Текст из changelog с `<`, `>`, `&`** (например, `Array<T>`): Telegram с `parse_mode: HTML` отвергнет сообщение целиком. Тест в Task 3: `экранирует changelog`.
- **Пять и больше пакетов в выпуске**: кнопки npm по две в ряд, нечётный хвост — одна кнопка в ряду. Тест в Task 3: `раскладка кнопок для 5 пакетов`.
- **Ответ Telegram 400** (неверный HTML): не повторять, а показать `description` в summary. Тест в Task 4: `400 не повторяется`.
- **Предрелизные или чужие теги** (`react-v2.0.0-rc.1`, `zustand-v1.0.0` при компоненте `react`): не берутся как предыдущая версия. Тест в Task 2: `игнорирует пререлизы и чужие компоненты`.

---

### Task 1: отчёт публикации в `publish-released.ts`

**Files:**
- Create: `scripts/release-report.ts` — типы отчёта и `readReport`.
- Modify: `scripts/publish-released.ts`
- Modify: `scripts/publish-released.test.ts`

**Interfaces:**
- Produces (`release-report.ts`):
  - `type PublishStatus = "published" | "skipped" | "unconfirmed" | "failed" | "not-attempted"`
  - `type ErrorKind = "auth" | "conflict" | "network" | "unknown"`
  - `type PackageResult = { path: string; name: string; version: string; status: PublishStatus; reason?: string; errorKind?: ErrorKind }`
  - `readReport(file: string): Promise<PackageResult[] | null>` — `null`, если файла нет или JSON не массив.
- Produces (`publish-released.ts`):
  - `type Run = (cmd: string[], cwd: string) => Promise<{ code: number; stderr: string }>` (меняется: теперь со stderr)
  - `type Manifest = (path: string) => Promise<{ name: string; version: string }>`
  - `type Confirm = { attempts: number; delayMs: number; sleep: (ms: number) => Promise<void> }`
  - `publishReleased(paths: string[], run: Run, options?: { isPublished?: IsPublished; isVisible?: IsPublished; manifest?: Manifest; confirm?: Confirm }): Promise<PackageResult[]>` — не бросает. `isVisible` — та же проверка `npm view`, используемая для подтверждения после публикации (по умолчанию равна `isPublished`). Значения по умолчанию в тестах: `manifest` возвращает `{ name: "@cdd-team/<basename>", version: "1.0.0" }`, `confirm` — `{ attempts: 1, delayMs: 0, sleep: async () => {} }`.
  - `classifyPublishError(stderr: string, code: number): { errorKind: ErrorKind; reason: string }`
  - `CONFIRM_DEFAULT = { attempts: 6, delayMs: 10_000 }`

- [ ] **Step 1: Тесты.** Поправить `recorder` под новый `Run` (`{ code, stderr: failOn ? "npm error code E403" : "" }`). Существующий тест «ошибка публикации останавливает последующие» переписать на результат: `status` React `failed`, Zustand `not-attempted`, вызов один. Новые:
  - `успех даёт published для каждого пакета в порядке публикации`: `[react, zustand]` → статусы `["published","published"]`, имена из `manifest`.
  - `пропущенная версия — skipped`: `isPublished` true для react → react `skipped`, zustand `published`.
  - `задержка registry`: `isVisible` возвращает false на первые 2 вызова, затем true; `confirm.attempts = 6` → `published`, `sleep` вызван 2 раза.
  - `не подтверждено после всех попыток`: `isVisible` всегда false, `attempts = 3` → `unconfirmed`, следующий пакет всё равно опубликован.
  - `classifyPublishError`: `"npm error code E403"` → `auth`, reason `"npm отклонил авторизацию"`; `"ENEEDAUTH"` → `auth`; `"EPUBLISHCONFLICT"` и `"cannot publish over the previously published versions"` → `conflict`, reason `"версия уже занята в npm"`; `"ETIMEDOUT"`/`"ECONNRESET"`/`"ENOTFOUND"`/`"EAI_AGAIN"` → `network`, reason `"сетевая ошибка при обращении к npm"`; `"что-то"` с кодом 7 → `unknown`, reason `"npm publish завершилась кодом 7"`. В reason нет текста stderr.
  - `readReport`: несуществующий файл → `null`; файл с `{}` → `null`; массив → массив.
- [ ] **Step 2: Запуск.** `bun test scripts/publish-released.test.ts` — FAIL.
- [ ] **Step 3: Реализация.** `runInRepo` пишет stderr и в `process.stderr` (лог job), и в буфер (читать `proc.stderr` потоком, дублируя). `isPublishedInNpm` принимает путь и читает манифест, как сейчас. CLI: `bun scripts/publish-released.ts '<json>' [--report <файл>]`; отчёт пишется в `finally` (`Bun.write`, JSON с отступом), лог по пакету — как сейчас плюс строка для `unconfirmed`. Код выхода 1, если есть `failed` или `unconfirmed`, иначе 0. Неверный JSON путей — по-прежнему код 2 без отчёта.
- [ ] **Step 4: Запуск.** `bun test scripts/publish-released.test.ts` — PASS.
- [ ] **Step 5: Коммит** `feat: отчёт о результатах публикации пакетов`.

### Task 2: changelog и версии

**Files:**
- Create: `scripts/release-changelog.ts`
- Test: `scripts/release-changelog.test.ts`

**Interfaces:**
- Produces:
  - `type ChangelogSection = { items: string[]; breaking: string[]; dependencies: { name: string; range: string }[] }`
  - `parseChangelogSection(markdown: string, version: string): ChangelogSection | null` — секция от `## [<version>]` (или `## <version>`) до следующего `## `; `null`, если её нет. `items` — пункты `### Features` и `### Bug Fixes` по порядку; `breaking` — пункты `### ⚠ BREAKING CHANGES`; `dependencies` — строки `@scope/name bumped from X to Y` (уникальные по имени, при расхождении peer и dev берётся из блока `peerDependencies`).
  - `cleanItem(line: string): string` — без `* `, `**scope:** `, хвоста ` ([abc1234](url))`, обрезанный по краям.
  - `previousVersion(tags: string[], component: string, version: string): string | null` — максимальная по semver среди тегов `^<component>-v(\d+\.\d+\.\d+)$`, строго меньшая `version`.
  - `bumpType(previous: string, next: string): "major" | "minor" | "patch"`

- [ ] **Step 1: Тесты** на фикстурах — реальные секции из `packages/react/CHANGELOG.md` (1.3.0) и `packages/zustand/CHANGELOG.md` (1.0.2), вставленные в тест строками:
  - react 1.3.0: 4 пункта, первый `"пример refs в playground @cdd-team/react"`, `breaking` пуст.
  - zustand 1.0.2: `items` пуст, `dependencies` = `[{ name: "@cdd-team/react", range: "^1.3.0" }]`.
  - `убирает scope и ссылку на коммит`: `"* **react:** фикс ([abc1234](https://x/commit/abc))"` → `"фикс"`.
  - breaking-секция `### ⚠ BREAKING CHANGES\n\n* удалён useFoo` → `breaking = ["удалён useFoo"]`.
  - неизвестная версия → `null`.
  - `previousVersion(["react-v1.2.0","react-v1.2.1","react-v1.3.0","zustand-v1.0.2"], "react", "1.3.0")` → `"1.2.1"`; для `"1.2.0"` → `null`.
  - `игнорирует пререлизы и чужие компоненты`: `["react-v2.0.0-rc.1","react-native-v9.0.0","react-v1.0.0"]`, `"react"`, `"2.0.0"` → `"1.0.0"`; сравнение численное (`1.10.0 > 1.9.0`).
  - `bumpType`: `1.2.1→1.3.0` minor, `1.0.1→1.0.2` patch, `0.2.1→1.0.0` major.
- [ ] **Step 2: Запуск.** `bun test scripts/release-changelog.test.ts` — FAIL.
- [ ] **Step 3: Реализация** в `scripts/release-changelog.ts`.
- [ ] **Step 4: Запуск** — PASS.
- [ ] **Step 5: Коммит** `feat: разбор changelog и версий для карточки выпуска`.

### Task 3: модель, статус и рендер карточки

**Files:**
- Create: `scripts/release-card.ts`
- Test: `scripts/release-card.test.ts`

**Interfaces:**
- Consumes: `PackageResult`, `ErrorKind` (Task 1), `ChangelogSection` (Task 2).
- Produces:
  - `type Stage = "install" | "build" | "verify" | "integration" | "node" | "publish"`
  - `type Outcome = PublishStatus | "available" | "not-visible" | "unchecked" | "unknown"` — последние четыре только для пакетов без отчёта (проверка registry).
  - `type CardPackage = { name: string; version: string; previous: string | null; bump: "major" | "minor" | "patch" | null; releaseUrl: string; changelog: ChangelogSection | null; outcome: Outcome; reason?: string; errorKind?: ErrorKind }`
  - `type CardContext = { repo: string; failedStage: Stage | null; stageKnown: boolean; integrationPassed: boolean; hasReport: boolean; runUrl: string; changesUrl: string; recoveryUrl: string; compatibility: { react?: string; zustand?: string } }`
  - `type CardStatus = "success" | "partial" | "failed" | "unknown"`
  - `decideStatus(packages: CardPackage[], ctx: CardContext): CardStatus | null` — `null` = алерта нет. Правила — раздел «Статус карточки» спеки, дословно: нет отчёта и `!stageKnown` или упал/отменён `publish` → `unknown`; нет отчёта и упал шаг до publish → `failed`; отчёт есть и все `skipped` → `null`; есть `failed`/`unconfirmed`/`not-attempted` → `partial`, если хоть один `published`/`skipped`; иначе `unknown`, если есть `unconfirmed` и нет `failed`, иначе `failed`; иначе `success`.
  - `renderCard(packages: CardPackage[], ctx: CardContext, status: CardStatus): { text: string; keyboard: { text: string; url: string }[][] }`
  - `escapeHtml(text: string): string`, `npmUrl(name: string, version: string): string` (`https://www.npmjs.com/package/<name>/v/<version>`)
  - `MAX_TEXT = 4096`

Заголовки дословно: `✅ <b>Библиотеки опубликованы</b>`, `⚠️ <b>Выпуск завершён частично</b>`, `❌ <b>Выпуск не состоялся</b>`, `⚠️ <b>Результат выпуска неизвестен</b>`. Подзаголовок: `frontend-packages · N пакет/пакета/пакетов` (русское склонение) или `frontend-packages · опубликовано K из N`. Имя пакета — `<a href="<releaseUrl>"><code>@cdd-team/x</code></a>`, версии — `<code>1.2.0 → 1.2.1</code> · patch` или `<code>0.1.0</code> · первый выпуск`. Этапы по-русски: install «установка зависимостей», build «сборка», verify «проверка архивов», integration «интеграционные проверки», node «подготовка Node/npm», publish «публикация». Кнопки: успех — npm по две в ряд (`react 1.3.0 в npm`: имя без scope), затем `[Изменения → changesUrl] [Проверки → runUrl]`; иначе `[Логи ошибки → runUrl] [Восстановление выпуска → recoveryUrl]`, затем npm-кнопки пакетов с outcome `published`/`skipped`/`available`. Сокращение: пока текст длиннее `MAX_TEXT`, у пакета с самым длинным описанием убирается последний пункт и добавляется `…и ещё N`; заголовок, версии и статусы не трогаются.

- [ ] **Step 1: Тесты** (фабрика `pkg(overrides)` и `ctx(overrides)` в тесте):
  - `пример успешной карточки`: React `1.2.0→1.2.1` patch с пунктом «Исправлено обновление компонентов.», Zustand `1.0.0→1.0.1` с `dependencies [{@cdd-team/react, ^1.2.1}]`, `integrationPassed`, `compatibility {react: "1.2.1", zustand: "1.0.1"}` → точный ожидаемый `text` целиком (это пример карточки для PR) и `keyboard` из двух рядов `[["react 1.2.1 в npm","zustand 1.0.1 в npm"],["Изменения","Проверки"]]` по `text`.
  - `пример частичного сбоя`: React `published`, Zustand `failed` `auth` → точный `text` с «опубликовано 1 из 2», «Не опубликован: npm отклонил авторизацию.», блоком «Что делать» про Trusted Publisher для `@cdd-team/zustand`; кнопки `[["Логи ошибки","Восстановление выпуска"],["react 1.2.1 в npm"]]`.
  - `decideStatus`: все `skipped` с отчётом → `null`; `published`+`skipped` → `success`; `unconfirmed` один → `unknown`, `failed` один → `failed`, `unconfirmed`+`published` → `partial`; без отчёта, `failedStage: "build"` → `failed`; без отчёта, `stageKnown: false` → `unknown`.
  - `ошибка до публикации`: `failedStage "build"`, пакеты `not-visible` и `available` → текст содержит «Этап: сборка», «доступен в npm» для `available`, «в registry не видна» для `not-visible`, не содержит «отсутств».
  - `skipped показан как пропущенный`: текст содержит «уже был в npm, пропущен», а не «опубликован».
  - `unconfirmed`: текст содержит «Публикация не подтверждена» и `npm view @cdd-team/react@1.2.1`, без npm-кнопки для него.
  - `миграция`: `breaking ["удалён useFoo"]` в `0.3.0` minor → блок `⚠️ <b>Требуется миграция</b>`, пункт и «Изучите breaking changes по ссылке»; major без breaking → блока нет.
  - `совместимость только при integrationPassed`: false → нет «Совместимость»; только OpenAPI → нет.
  - `первый выпуск`: `previous null` → «первый выпуск», без типа изменения.
  - `нет описания`: `changelog null` → «Подробности в changelog» ссылкой на `releaseUrl`.
  - `экранирует changelog`: пункт `Array<T> & co` → в тексте `Array&lt;T&gt; &amp; co`.
  - `длинный changelog`: 300 пунктов по 80 символов → `text.length <= 4096`, есть «…и ещё», оба пакета и их версии на месте.
  - `раскладка кнопок для 5 пакетов`: npm-ряды `[2,2,1]`, затем ряд из 2.
  - `нет открытых URL`: в `text` нет `https://` вне атрибута `href`.
- [ ] **Step 2: Запуск.** `bun test scripts/release-card.test.ts` — FAIL.
- [ ] **Step 3: Реализация** в `scripts/release-card.ts`.
- [ ] **Step 4: Запуск** — PASS.
- [ ] **Step 5: Коммит** `feat: карточка итогов выпуска для Telegram`.

### Task 4: отправка в Telegram

**Files:**
- Create: `scripts/telegram.ts`
- Test: `scripts/telegram.test.ts`

**Interfaces:**
- Produces:
  - `type TelegramConfig = { token: string; chatId: string; threadId: string }`
  - `type SendResult = { ok: true } | { ok: false; error: string }`
  - `sendCard(card: { text: string; keyboard: { text: string; url: string }[][] }, config: TelegramConfig, deps?: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; attempts?: number }): Promise<SendResult>` — `POST https://api.telegram.org/bot<token>/sendMessage`, тело JSON: `chat_id`, `message_thread_id: Number(threadId)`, `text`, `parse_mode: "HTML"`, `link_preview_options: { is_disabled: true }`, `reply_markup: { inline_keyboard }`. До 3 попыток на исключение `fetch`, 5xx и 429 (пауза `parameters.retry_after` секунд или 2 с). `error` — `"<status>: <description>"` или текст исключения; токен в `error` не попадает.

- [ ] **Step 1: Тесты** с подменённым `fetch`, записывающим запросы:
  - `отправляет в тред с HTML и без превью`: URL `…/bot<token>/sendMessage`, тело содержит `message_thread_id: 42` (из `"42"`), `parse_mode: "HTML"`, `link_preview_options.is_disabled: true`, `reply_markup.inline_keyboard`.
  - `повторяет 5xx и 429`: ответы 502, 429 (`retry_after: 1`), 200 → `ok: true`, 3 запроса, `sleep` вызван с `1000`.
  - `400 не повторяется`: 400 `{ description: "Bad Request: can't parse entities" }` → `ok: false`, `error` содержит `can't parse entities`, 1 запрос.
  - `сетевая ошибка`: `fetch` бросает трижды → `ok: false`, в `error` нет токена.
- [ ] **Step 2: Запуск.** `bun test scripts/telegram.test.ts` — FAIL.
- [ ] **Step 3: Реализация.**
- [ ] **Step 4: Запуск** — PASS.
- [ ] **Step 5: Коммит** `feat: отправка карточки выпуска в Telegram`.

### Task 5: сбор данных и запуск `release-notify.ts`

**Files:**
- Create: `scripts/release-notify.ts`
- Test: `scripts/release-notify.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `type NotifyIo = { readText(path: string): Promise<string | null>; tags(): Promise<string[]>; releasePrUrl(sha: string): Promise<string | null>; npmHasVersion(name: string, version: string): Promise<boolean | null>; send(card): Promise<SendResult>; summary(text: string): Promise<void>; log(text: string): void }` — `npmHasVersion` возвращает `null`, если проверка не удалась; `send` уже замкнут на конфиг.
  - `type NotifyEnv = { paths: string[]; outcomes: Partial<Record<Stage, string>>; server: string; repo: string; runId: string; attempt: string; sha: string; reportFile: string }`
  - `notify(env: NotifyEnv, io: NotifyIo): Promise<number>` — код выхода: 0 — отправлено или алерт не нужен; 1 — сбой доставки или нет Telegram-секретов.
  - `stageFromOutcomes(outcomes): { failedStage: Stage | null; stageKnown: boolean }` — порядок `install, build, verify, integration, node, publish`; первый не-`success` — `failedStage`; пустые все → `stageKnown: false`; `skipped` у шага после упавшего игнорируется.

Сборка `CardPackage`: имя и версия — `package.json` пути; компонент — `release-please-config.json`; `previous`/`bump` — Task 2 по `tags()`; `changelog` — `parseChangelogSection(<path>/CHANGELOG.md, version)`; `releaseUrl` — `<server>/<repo>/releases/tag/<component>-v<version>`; outcome — из отчёта по `path`, а без отчёта — `npmHasVersion` (true → `available`, false → `not-visible`, null → `unchecked`); если отчёт есть, а пути в нём нет — `unknown`. `runUrl` — `<server>/<repo>/actions/runs/<runId>/attempts/<attempt>`; `recoveryUrl` — `<server>/<repo>/blob/<sha>/docs/release-runbook.md#5-частичный-выпуск`; `changesUrl` — `releasePrUrl(sha)`, иначе `releaseUrl` первого пакета. `compatibility` — версии из `packages/react/package.json` и `packages/zustand/package.json`, только если среди путей есть хотя бы один из них. `repo` в карточке — часть `env.repo` после `/`. Summary: всегда заголовок «Telegram-карточка выпуска», текст карточки в блоке кода и строка «Telegram: доставлено» либо «Telegram: сообщение не доставлено (<error>)»; при `null` от `decideStatus` — «Алерт не отправлен: все версии уже были в npm, ошибок нет».

`import.meta.main`: env из `PATHS_RELEASED`, `OUTCOME_INSTALL|BUILD|VERIFY|INTEGRATION|NODE|PUBLISH`, `GITHUB_*`, `RELEASE_REPORT` (по умолчанию `release-report.json`), `TELEGRAM_*`. Реальный `NotifyIo`: файлы через `Bun.file`, `git tag --list`, `gh api repos/<repo>/commits/<sha>/pulls --jq '[.[] | select(.merged_at != null)][0].html_url'`, `npm view <name>@<version> version` (код ≠ 0 и пустой вывод с `E404` в stderr → false, другая ошибка → null), `summary` дописывает в `GITHUB_STEP_SUMMARY`. Нет хотя бы одного `TELEGRAM_*` — `send` возвращает `{ ok: false, error: "не заданы TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID/TELEGRAM_RELEASES_TOPIC_ID" }`.

- [ ] **Step 1: Тесты** на фейковом `NotifyIo` (файлы — `Map`, вызовы `send` и `summary` записываются), по одному на сценарий приёмки:
  - полный успех React+Zustand: один `send`, текст содержит обе версии и «Совместимость», код 0;
  - один OpenAPI: нет «Совместимость»;
  - ошибка до публикации (`build: "failure"`, отчёта нет): `npmHasVersion` вызван для каждого пакета, статус ❌, «Этап: сборка»;
  - перезапуск: отчёта нет, `integration: "failure"`, React `npmHasVersion → true` → текст содержит «доступен в npm» для React;
  - пустые outcomes без отчёта → «Результат выпуска неизвестен»;
  - ошибка первого пакета (`failed`, остальные `not-attempted`) → ❌;
  - частичный сбой → ⚠️ «опубликовано 1 из 2»;
  - `unconfirmed` в отчёте → «не подтверждена»;
  - все `skipped` → `send` не вызван, summary с «Алерт не отправлен», код 0;
  - `skipped` + `published` → ✅, «уже был в npm, пропущен»;
  - Telegram недоступен (`send → ok: false`) → код 1, summary содержит «не доставлено» и текст карточки;
  - новый пакет `packages/foo` (компонент `foo` в фейковом конфиге) → в карточке `@cdd-team/foo`, без правок кода;
  - `stageFromOutcomes`: `{install:"success", build:"failure", verify:"skipped"}` → `build`; `{}` → `stageKnown: false`.
- [ ] **Step 2: Запуск.** `bun test scripts/release-notify.test.ts` — FAIL.
- [ ] **Step 3: Реализация.**
- [ ] **Step 4: Запуск** `bun run test:scripts` — PASS целиком.
- [ ] **Step 5: Коммит** `feat: итоговое уведомление о выпуске`.

### Task 6: workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Job `publish`.** `id` у шагов: `install`, `build`, `verify`, `integration` (новый `run: bun run test:integration` после `verify`), `node` (setup-node; `npm install -g` и проверку версий объединить в один шаг `id: npm` и экспортировать `node` как первый не-`success` из `steps.node.outcome`, `steps.npm.outcome`), `publish` (`run: bun scripts/publish-released.ts "$PATHS_RELEASED" --report release-report.json`). После публикации — `actions/upload-artifact@v4` с `if: always()`, `name: release-report`, `path: release-report.json`, `if-no-files-found: ignore`. `outputs:` `install|build|verify|integration|node|publish: ${{ steps.<id>.outcome }}` (для `node` — выражение `steps.node.outcome != 'success' && steps.node.outcome || steps.npm.outcome`).
- [ ] **Step 2: Job `notify`.** `needs: [release-please, publish]`, `if: always() && needs.release-please.outputs.releases_created == 'true'`, `permissions: { contents: read, pull-requests: read }`. Шаги: `actions/checkout@v7` с `fetch-depth: 0`; `oven-sh/setup-bun@v2` (`bun-version: 1.4.2`); `bun install --frozen-lockfile`; `actions/download-artifact@v4` с `name: release-report`, `continue-on-error: true`; `bun scripts/release-notify.ts` с env: `PATHS_RELEASED`, `OUTCOME_*` из `needs.publish.outputs.*`, `GH_TOKEN: ${{ github.token }}`, `TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}`, `TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}`, `TELEGRAM_RELEASES_TOPIC_ID: ${{ secrets.TELEGRAM_RELEASES_TOPIC_ID }}`. Короткий комментарий над job: почему отдельный (секреты не в job с `id-token: write`).
- [ ] **Step 3: Проверка.** `bun -e "Bun.YAML.parse(await Bun.file('.github/workflows/release.yml').text())"` — без ошибок; глазами сверить, что `if` у `notify` не срабатывает на release PR (`releases_created` пустой) и что в `publish` нет `TELEGRAM_*`.
- [ ] **Step 4: Коммит** `feat: Telegram-уведомление в workflow выпуска`.

### Task 7: документация

**Files:**
- Modify: `docs/release-runbook.md` — новый раздел «7. Уведомления о выпуске» и дополнение раздела 5.
- Modify: `README.md:70-72`
- Modify: `AGENTS.md` (строка «Секрет в репозитории один…»)

- [ ] **Step 1: Runbook, раздел 7:** секреты (org: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; repo: `TELEGRAM_RELEASES_TOPIC_ID` — ID треда Frontend / Releases); job `notify` и почему он отдельно; таблица «поле карточки → источник» из спеки; четыре статуса и когда алерта нет; значения «пропущен», «не подтверждена», «в registry не видна»; где искать карточку при сбое Telegram (summary запуска, job `notify` красный, публикация не затронута). Раздел 5, пункт 5: повторный запуск даёт карточку, где уже опубликованные версии помечены «уже был в npm, пропущен»; если пропущено всё — алерта нет. Заголовок раздела 5 не менять (на него ссылается кнопка «Восстановление выпуска»).
- [ ] **Step 2: README** шаг 3: добавить интеграционные проверки перед публикацией и итоговую карточку в Telegram; строку про секреты — «npm-токен не нужен; секреты: `RELEASE_PLEASE_TOKEN` и Telegram-настройки для уведомлений (runbook, раздел 7)». **AGENTS.md:** «Постоянных npm-секретов нет. Секреты репозитория: `RELEASE_PLEASE_TOKEN` (release-please) и `TELEGRAM_RELEASES_TOPIC_ID`; `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` — секреты организации».
- [ ] **Step 3: Проверка.** `bun run fmt:check` (oxfmt не трогает md — убедиться, что ничего не сломалось), ссылка `#5-частичный-выпуск` соответствует заголовку `## 5. Частичный выпуск` в рендере GitHub.
- [ ] **Step 4: Коммит** `docs: уведомления о выпуске в runbook`.

### Task 8: финальная проверка

- [ ] **Step 1:** из корня worktree полный набор из `AGENTS.md`:
  ```sh
  bun install --frozen-lockfile
  bun run fmt:check && bun run lint && bun run build && bun run typecheck
  bun run test && bun run test:integration && bun run test:scripts
  bun run verify:packages
  ```
  Ожидается: все команды с кодом 0.
- [ ] **Step 2:** сохранить примеры карточек для PR: тексты из тестов `пример успешной карточки` и `пример частичного сбоя` (Task 3) вместе с раскладкой кнопок — в описание PR, без секретов.
- [ ] **Step 3:** удалить новые тестовые файлы (`scripts/release-changelog.test.ts`, `scripts/release-card.test.ts`, `scripts/telegram.test.ts`, `scripts/release-notify.test.ts`) и новые кейсы в `scripts/publish-released.test.ts`, оставив существующие (адаптированные). Повторить `bun run lint && bun run typecheck && bun run test:scripts` — PASS. Коммит `test: убрать тесты алертов из PR`.
- [ ] **Step 4:** доложить пользователю результат; push и draft PR (`Closes #6`) — только по его просьбе.
