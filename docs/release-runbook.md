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

Для каждого из трёх пакетов, после его первой публикации: npmjs.com → пакет → Settings → Trusted Publisher → GitHub Actions:

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
5. Опубликовать только отсутствующие пути из того же проверенного релизного коммита. Запускать перезапуском упавшего job или локально из чекаута тега, соблюдая порядок зависимостей (React раньше Zustand):
   ```sh
   git checkout <тег релиза>
   bun install --frozen-lockfile && bun run build && bun run verify:packages
   bun scripts/publish-released.ts '["packages/zustand"]'
   ```
   Для локального запуска нужен вход в npm с правом публикации (`npm login`).
6. Если нужно изменить содержимое уже опубликованного пакета, выпустить новую версию через `fix:`, а не перезаписывать старую.
7. После восстановления повторить проверку registry (`npm view …@<версия>`) и чистую установку из раздела 4.
