# Runbook выпуска

Как первый раз выпустить пакеты, как проверить автоматику и что делать при сбое. Общая схема — в [README](../README.md#как-выпускается-версия).

## 1. Разовый bootstrap

Новые имена `@cdd-team/*` в npm не существуют, поэтому первую публикацию делает человек с правами на организацию `cdd-team` (owner или участник с правом публикации). Дальше публикует только workflow. Делать с проверенного коммита `main`, где CI зелёный.

1. Войти в npm и проверить, кто вы: `npm login`, `npm whoami`. Если на аккаунте включена 2FA (`auth-and-writes`), npm попросит одноразовый код при каждой публикации.
2. Собрать и проверить архивы: `bun install --frozen-lockfile && bun run build && bun run verify:packages`.
3. Опубликовать по порядку, из каталога каждого пакета (React раньше Zustand — у Zustand peer на React):
   ```sh
   cd packages/react   && npm publish --access public
   cd ../zustand       && npm publish --access public
   cd ../openapi       && npm publish --access public
   ```
4. Проверить, что опубликованы стартовые версии:
   ```sh
   npm view @cdd-team/react version      # 1.2.0
   npm view @cdd-team/zustand version    # 1.0.0
   npm view @cdd-team/openapi version    # 0.2.0
   ```
5. На том же коммите создать исходные GitHub Releases с тегами `react-v1.2.0`, `zustand-v1.0.0`, `openapi-v0.2.0`. Это baseline для release-please: без тегов он не знает, от чего считать изменения.
6. Убедиться, что `.release-please-manifest.json` хранит те же версии, а `release-please-config.json` — пути `packages/react|zustand|openapi`, компоненты `react|zustand|openapi` и `include-component-in-tag: true`. Одна публикация в npm без тегов и manifest настройку не завершает.

## 2. Trusted Publishing

Для каждого из трёх пакетов (четвёртый, `@cdd-team/oxlint-plugin-jsdoc` — в разделе 6), после его первой публикации: npmjs.com → пакет → Settings → Trusted Publisher → GitHub Actions:

| Поле | Значение |
| --- | --- |
| Organization or user | `Cringe-Driven-Development-Team` |
| Repository | `frontend-packages` |
| Workflow filename | `release.yml` |
| Environment | пусто (workflow не использует environment) |
| Permissions | **Allow npm publish** |

Publish job работает на GitHub-hosted runner с `id-token: write`, Node 22.14.0+ и npm 11.5.1+ (версии проверяются в шаге workflow). Постоянные npm-секреты (`NPM_TOKEN`, `NODE_AUTH_TOKEN`, токен в `.npmrc`) для обычного выпуска не нужны.

Доверие считается подтверждённым после первого успешного workflow-выпуска. Если за два дня выпуска не было или публикация падает на авторизации, настройку Trusted Publisher нужно пересоздать.

## 3. Секрет `RELEASE_PLEASE_TOKEN`

Release-please создаёт release PR от этого токена; от `GITHUB_TOKEN` на таком PR не запустился бы CI. OIDC этих прав не заменяет.

- Fine-grained personal access token, resource owner `Cringe-Driven-Development-Team`, доступ только к репозиторию `frontend-packages`.
- Права: Contents — read and write, Pull requests — read and write (Metadata — read, ставится автоматически).
- Секрет репозитория: Settings → Secrets and variables → Actions → `RELEASE_PLEASE_TOKEN`.
- У токена есть срок жизни. Когда он истечёт, release PR перестанут создаваться: владелец токена выпускает новый и обновляет секрет. Токен привязан к человеку; если он покидает организацию, токен нужно заменить.

## 4. Проверка автоматики после bootstrap

**`fix:` в Zustand.** PR с `fix:` в `packages/zustand` → после merge появляется release PR, который поднимает только Zustand (`1.0.0 → 1.0.1`). После его merge — тег `zustand-v1.0.1`, GitHub Release и новая версия в npm без ручных команд. Проверить: `npm view @cdd-team/zustand version`.

**`fix:` в React.** От baseline `fix:` только в `packages/react` даёт:
- React `1.2.0 → 1.2.1`;
- Zustand `1.0.0 → 1.0.1` (исходники Zustand не менялись) с записью в его `CHANGELOG.md`;
- диапазон `@cdd-team/react` в Zustand — `^1.2.1`, и в `peerDependencies`, и в `devDependencies`;
- OpenAPI остаётся `0.2.0` без выпуска.

После merge в логе workflow видно: публикуются только `paths_released`, React раньше Zustand, OIDC-авторизация проходит без токена. Проверить:
```sh
npm view @cdd-team/react version                              # 1.2.1
npm view @cdd-team/zustand@1.0.1 peerDependencies --json      # "@cdd-team/react": "^1.2.1"
```
Optional peer и экспорт `./vanilla` в Zustand должны сохраниться.

**Чистая установка.** В отдельных пустых каталогах вне монорепозитория:
- `bun add @cdd-team/react@1.2.1 @cdd-team/zustand@1.0.1` → типы (`tsc --noEmit`), сборка и `bun test` с компонентом, читающим store;
- `bun add @cdd-team/zustand` → `@cdd-team/zustand/vanilla` работает без React.

**`test:`/`docs:` без других изменений.** Коммит такого типа сам по себе не создаёт новый release PR.

## 5. Частичный выпуск

Публикация идёт последовательно, поэтому после сбоя часть пакетов может уйти в npm, а часть нет. GitHub Release и тег при этом уже созданы, но это не доказательство, что пакет есть в npm.

1. Найти упавший запуск workflow Release и посмотреть, на каком пакете остановилась публикация.
2. Для каждого пути из `paths_released` сопоставить логи, теги и фактическое состояние registry точной версией:
   ```sh
   npm view @cdd-team/react@<версия> version
   ```
   Метаданные registry могут появляться с задержкой в несколько минут — повторить проверку позже, прежде чем считать версию отсутствующей.
3. Уже существующую пару имя/версия не перезаписывать и не пытаться публиковать повторно.
4. Исправить причину сбоя (авторизация, сеть, настройка Trusted Publisher, проверка архивов).
5. Опубликовать только отсутствующие пути из того же проверенного релизного коммита. Скрипт пропускает пути, версия которых уже есть в npm (`npm view <имя>@<версия>`), поэтому упавший job можно просто перезапустить: с тем же `paths_released` он опубликует только недостающее. Либо запустить вручную из чекаута тега, соблюдая порядок зависимостей (React раньше Zustand):
   ```sh
   git checkout <тег релиза>
   bun install --frozen-lockfile && bun run build && bun run verify:packages
   bun scripts/publish-released.ts '["packages/zustand"]'
   ```
   Для локального запуска нужен вход в npm с правом публикации (`npm login`).

   После перезапуска job придёт новая карточка (раздел 7): уже опубликованные версии в ней помечены «Уже был в npm, пропущен», новые — как опубликованные. Если пропущено всё и ошибок нет, новой карточки не будет. При ручной публикации карточка не отправляется.
6. Если нужно изменить содержимое уже опубликованного пакета, выпустить новую версию через `fix:`, а не перезаписывать старую.
7. После восстановления повторить проверку registry (`npm view …@<версия>`) и чистую установку из раздела 4.

## 6. Bootstrap нового пакета (пример: `@cdd-team/oxlint-plugin-jsdoc`)

Пакет, добавленный в монорепозиторий позже (первые три — раздел 1), проходит тот же путь, но без остальных пакетов. Для плагина jsdoc стартовая версия — `0.1.1`.

1. Перед мержем PR, который добавляет пакет: release-please может открыть release PR раньше, чем появится тег baseline. **Не вливайте** этот release PR.
2. После мержа PR на проверенном коммите `main` (CI зелёный): `bun install --frozen-lockfile && bun run build && bun run verify:packages`, затем
   ```sh
   cd packages/oxlint-plugin-jsdoc && npm publish --access public
   ```
   (2FA и подтверждение в браузере, как в разделе 1). Сразу после публикации `npm view` может показывать заглушку `0.0.0-stage` (так было у первых трёх пакетов): реальная версия появляется в реестре через несколько минут, заглушка остаётся в списке версий, но `latest` переключается на реальную. Повторно `npm publish` не запускайте, подождите и проверьте реестр.
3. Проверить: `npm view @cdd-team/oxlint-plugin-jsdoc version` → `0.1.1`.
4. На том же коммите создать GitHub Release с тегом `oxlint-plugin-jsdoc-v0.1.1` (baseline release-please); версия в `.release-please-manifest.json` должна совпадать.
5. Закрыть без мержа устаревший release PR, если он успел появиться: актуальный release-please создаст при следующем пуше в `main`.
6. Trusted Publisher для пакета на npmjs.com (Settings → Trusted Publisher → GitHub Actions): Organization `Cringe-Driven-Development-Team`, Repository `frontend-packages`, Workflow filename `release.yml`, Environment пустой, **Allow npm publish**. Статус будет Pending validation до первого успешного выпуска из workflow (в пределах 48 часов).
7. Для подтверждения Trusted Publisher нужен небольшой `fix:` в `packages/oxlint-plugin-jsdoc` после bootstrap: release PR выпустит `0.1.2` по OIDC. Затем переводится потребитель (`frontend`) на `@cdd-team/oxlint-plugin-jsdoc`.

## 7. Уведомления о выпуске

После каждого выпуска (`releases_created == 'true'`) job `notify` workflow Release отправляет **одну** итоговую карточку в тред **Frontend / Releases** командного Telegram-чата. Release PR и запуск без релизов карточки не дают. Сбой самого шага release-please карточку тоже не даёт: неизвестно, какие пакеты выпускались.

### Настройки

| Секрет | Где | Что это |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | организация | токен командного бота |
| `TELEGRAM_CHAT_ID` | организация | командный чат |
| `TELEGRAM_RELEASES_TOPIC_ID` | репозиторий | ID треда Frontend / Releases, уходит в `message_thread_id` |

Секреты передаются только в job `notify`. В job `publish` (у него `id-token: write` для OIDC) их нет. npm-токен по-прежнему не нужен.

### Откуда берутся данные

- `publish-released.ts --report release-report.json` пишет статус каждого пути из `paths_released`. После `npm publish` версия подтверждается через `npm view <имя>@<версия>` (до 6 попыток с паузой 10 с). Отчёт уходит в артефакт `release-report`.
- `scripts/release-notify.ts` читает отчёт и результаты шагов publish и собирает карточку:

| В карточке | Источник |
| --- | --- |
| имя, новая версия | `package.json` пакета в релизном коммите |
| предыдущая версия | ближайший меньший тег `<component>-v*`; нет такого — «первый выпуск» (npm `latest` не используется) |
| patch / minor / major | разница предыдущей и новой версии |
| описание | секции Features и Bug Fixes в `CHANGELOG.md` этой версии; у зависимого выпуска — новый диапазон из Dependencies; нет ни того, ни другого — ссылка на changelog |
| «⚠️ Требуется миграция» | секция `⚠ BREAKING CHANGES` (не номер major: в `0.x` ломающее изменение поднимает minor) |
| «Совместимость» | шаг `test:integration` в publish прошёл на том же коммите; версии React и Zustand из их `package.json` |
| ссылки | имя пакета → GitHub Release; «Изменения» → влитый release PR; «Проверки» и «Логи ошибки» → запуск workflow; «Восстановление выпуска» → раздел 5 |

### Статусы

- **✅ Библиотеки опубликованы**: все пакеты опубликованы или уже были в npm, хотя бы один опубликован сейчас.
- **⚠️ Выпуск завершён частично**: часть пакетов доступна, часть нет (ошибка, остановка после ошибки или неподтверждённая публикация).
- **❌ Выпуск не состоялся**: ни один пакет не доступен из-за ошибки, или упал шаг до публикации (сборка, проверка архивов, интеграционные тесты, подготовка Node/npm). В карточке указан этап.
- **⚠️ Результат выпуска неизвестен**: job publish оборвался без отчёта (отменён, runner умер), упал шаг без названного этапа (checkout, setup-bun) или ни одна публикация не подтвердилась, хотя `npm publish` прошёл.

Отчёт берётся, только если шаг публикации запускался в этой попытке: артефакт прошлой попытки при перезапуске не используется. Когда отчёта нет, `notify` сам смотрит каждую версию в npm. Поэтому версия, опубликованная в прошлой попытке, показывается как доступная.

Как читать строки пакетов:
- «Уже был в npm, пропущен»: версию опубликовали раньше, в этом запуске её не публиковали.
- «Публикация не подтверждена»: `npm publish` прошёл, но версия не появилась в registry за 10 минут проверки. Это не значит, что её нет: проверьте `npm view <имя>@<версия>` через несколько минут.
- «В registry не видна» и «Состояние в npm не проверено»: публикацию не начинали или проверка registry не удалась. Перед повтором проверьте registry.

### Если карточка не пришла

Job `notify` красный, а в его summary есть строка «Telegram: сообщение не доставлено (…)» с ответом Telegram и полный текст карточки. Публикация от этого не меняется: смотрите job `publish` и `npm view`. Частые причины: бот не состоит в чате или у него нет доступа к треду, неверный `TELEGRAM_RELEASES_TOPIC_ID`, секрет недоступен репозиторию.
