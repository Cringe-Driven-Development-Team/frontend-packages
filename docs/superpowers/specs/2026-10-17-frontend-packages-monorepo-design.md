# Монорепо frontend-packages: дизайн

Источник требований: задача [frontend#18](https://github.com/Cringe-Driven-Development-Team/frontend/issues/18) (полный текст — `gh issue view 18 -R Cringe-Driven-Development-Team/frontend`). Этот документ фиксирует решения, принятые при обсуждении, и то, что не сказано в задаче. Если документ и задача расходятся, прав документ: расхождение явно помечено «Уточнение».

## Зачем

Три учебные библиотеки фронта лежат в трёх репозиториях с расходящимися конфигами, ручной публикацией под личными скоупами (`@maninthecoat/react`, `@maninthecoat/zustand`, `@iredtea/openapi`). Пакетов станет больше. Собираем их в одно монорепо `Cringe-Driven-Development-Team/frontend-packages` с общим тулингом, одним CI и автоматическими релизами под командным скоупом `@cdd-team`.

## Цели

- Три пакета в Bun workspaces: `packages/react` (`@cdd-team/react`, старт `1.2.0`), `packages/zustand` (`@cdd-team/zustand`, `1.0.0`), `packages/openapi` (`@cdd-team/openapi`, `0.2.0`).
- Общие конфиги в корне (tsconfig, oxlint, oxfmt), единые версии `typescript` и `tsdown`, у каждого пакета одинаковые скрипты `lint`, `fmt:check`, `typecheck`, `test`, `build`.
- CI на feature PR и release PR: формат, линт, типы, тесты, сборка, runtime-интеграция React+Zustand, vanilla Zustand без React, сборка npm-архивов и их установка в чистый проект вне workspace.
- Релизы через release-please (manifest-режим, независимые версии, `node-workspace` с `updatePeerDependencies: true`), публикация в npm по OIDC без постоянного секрета, только для `paths_released`, React перед Zustand.
- README и runbook: структура, как добавить пакет, bootstrap, автовыпуск, восстановление частичного выпуска.

## Не цели

- Перевод курсового фронта на `@cdd-team/*`, архивация старых репозиториев, перенос их задач, `npm deprecate` старых имён, правка CONTRIBUTING.
- Новые пакеты (Query-клиент #15).
- Playground в CI и релизах. `zustand-playground` и `openapi-playground` остаются отдельными репозиториями.
- Права публикации для участников команды: после bootstrap публикует только workflow.

## Анти-цели (провал, даже если формально работает)

- Ручной `bun publish` и скрипты `release:*` остаются.
- В опубликованных архивах есть `workspace:*` или ссылки на `@maninthecoat`/`@iredtea`.
- Постоянный npm-секрет (`NPM_TOKEN`, `NODE_AUTH_TOKEN`, токен в `.npmrc`) нужен для обычного выпуска.
- Выпуск проходит, хотя интеграция React/Zustand сломана: «собралось» не считается доказательством совместимости.
- Повторная публикация уже существующей пары имя/версия.

## Принятые решения

**Организация npm.** Организация `cdd-team` создана, единственный owner — `maninthecoat`. Имена `@cdd-team/react|zustand|openapi` свободны (проверено 2026-10-17).

**Bootstrap.** Делает owner вручную: `npm publish --access public`, порядок React → Zustand → OpenAPI, стартовые версии как выше, интерактивная авторизация и 2FA (режим `auth-and-writes`). Затем GitHub Releases с тегами `react-v1.2.0`, `zustand-v1.0.0`, `openapi-v0.2.0` на проверенном коммите; версии записаны в `.release-please-manifest.json`. После этого настраивается Trusted Publishing по каждому пакету (owner `Cringe-Driven-Development-Team`, repository `frontend-packages`, workflow `release.yml`, **Allow npm publish**, environment — только если используется, с совпадающим именем). Новое доверие подтверждается успешным workflow-выпуском в течение двух дней, иначе настройка пересоздаётся.

**Перенос истории.** `git subtree add` без `--squash`, из GitHub-адресов старых репозиториев. Достаточно, что исходные коммиты и авторы видны в общем `git log` (решение пользователя); история по каталогам пакетов (`git log -- packages/react`) не требуется, `git-filter-repo` не используем.

**Playground.** `react/playground` переезжает вместе с пакетом в `packages/react/playground`, но остаётся ручным dev-стендом: не входит в `workspaces`, CI, релизы и корневые скрипты, имеет собственную установку зависимостей. Причина: включение в workspaces с зависимостью на `@cdd-team/react` порождает рекурсивные цепочки `node_modules` (наблюдалось на Windows).

**Зависимость Zustand от React.** `peerDependencies: {"@cdd-team/react": "^1.2.0"}` + `peerDependenciesMeta` optional; `devDependencies` — тот же semver-диапазон, не `workspace:*`; Bun резолвит его в workspace, пока версия подходит. Экспорт `./vanilla` сохраняется.

**Тесты.** Раннер — `bun test` везде (в задаче Bun — инструмент тестов; у Zustand уже `bun test` + `happy-dom`). Для `react` и `openapi` пишем минимальные smoke-тесты в рамках задачи; React-тесты используют `@happy-dom/global-registrator` через preload, OpenAPI — без DOM. Vitest не добавляем. Интеграционные тесты (React+Zustand и vanilla без React) лежат в корне, отдельно от пакетов.

**Форматирование и линт.** Весь перенесённый код приводится к общим конфигам oxfmt/oxlint отдельным коммитом; сгенерированный `packages/openapi/src/api/schema.ts` исключается из форматтера. Правки кода ради линтера минимальны и перечисляются в описании PR.

**Токен release-please.** Release-please работает от секрета `RELEASE_PLEASE_TOKEN` (fine-grained PAT ментора: Contents и Pull requests — read/write, только репозиторий `frontend-packages`), иначе CI не запускается на release PR. Секрет добавлен ментором (подтверждено словами пользователя, прав на проверку нет). Токену нужно продлевать срок; зафиксировать в runbook. Это отдельное от OIDC: OIDC права release-please не заменяет.

**Порядок работы.** Сначала код, CI и документация одним PR из ветки `web-18`; затем bootstrap и Trusted Publisher (вручную owner); затем проверка автовыпуска на следующем релизе. PR закрывает задачу строкой `Closes Cringe-Driven-Development-Team/frontend#18`. Ручные шаги (bootstrap, Releases, Trusted Publisher, секрет) в PR не выполняются.

## Ограничения

- Bun 1.4.2, TypeScript 7.0.2, tsdown 0.23.0, Node ≥ 22.14.0 и npm ≥ 11.5.1 в publish job (версия проверяется явно), GitHub-hosted runner, `id-token: write`.
- Права release-please job: `pull-requests: write`, `contents: write`.
- PR вливаются merge-коммитом. `feat`/`fix` дают релиз; `test`/`docs`/`chore`/`refactor` без breaking — нет; breaking — `feat!`.
- `publishConfig.access: public`; `repository.url` = `git+https://github.com/Cringe-Driven-Development-Team/frontend-packages.git`, `repository.directory` = каталог пакета.
- Публикация последовательная; ошибка останавливает следующие; GitHub Release не означает успешную публикацию в npm.
- Коммиты на русском в стиле старых репозиториев; трейлер ко-авторства — по правилам сессии.

## Оставлено исполнителю

- Структура корневых конфигов, конкретные smoke-сценарии, формат скриптов проверки архивов и публикации, имена workflow-джобов, текст README и runbook (в пределах требований выше и приёмки задачи).
- Способ проверки синтаксиса workflow (actionlint или аналог).
- Уточнение: если Bun-резолв `^1.2.0` в workspace на Windows ведёт себя нестабильно, исполнитель выбирает рабочий вариант, не нарушая «без `workspace:*` в архивах», и фиксирует выбор.

## Решения, принятые при проверке спеки (моё решение, не согласовано с пользователем)

- **Диапазон peer-зависимости при выпуске React.** Ожидаем, что плагин `node-workspace` с `updatePeerDependencies: true` сам поднимает `peerDependencies` Zustand до `^1.2.1` (так сказано в задаче). Исполнитель проверяет это тестом конфигурации и, если плагин не трогает `devDependencies` или caret-диапазон, добавляет в `release-please-config.json` `extra-files` (jsonpath-обновление) для `packages/zustand/package.json`, не меняя итоговое требование: после `fix:` в React диапазон равен `^1.2.1` и в peer, и в devDependency. Запасной вариант — скрипт, запускаемый в release PR, только если `extra-files` не хватает.
- **Платформа CI.** Только Linux (`ubuntu-latest`) и Bun 1.4.2; Windows-матрицы нет. Проблемы Windows (рекурсивные `node_modules`, резолв workspace) относятся к локальной разработке и описываются в README.
- **Проверка архивов на release PR.** Проверка (`сборка → pack → установка в чистый проект`) входит в общий CI и идёт на release PR с окончательными версиями; publish job повторяет её на коммите релиза перед `npm publish` и не публикует при падении.
- **Environment.** Publish job не использует GitHub environment; Trusted Publisher настраивается без поля environment.
- **Источники импорта.** Ветка `main` каждого из трёх репозиториев на момент импорта. Состав известен: в `react` и `openapi` есть скрипты `release:*`, `.github/workflows` (`automation.yml` у `react`, `ci.yml` у `openapi`) и `bun.lock` — всё это удаляется, `automation.yml` переносится в корень без изменений. Ссылки на `@maninthecoat/react` есть в `package.json`, `tsconfig`, `tsdown.config.ts`, README, исходниках playground и тестах Zustand; заменяются все.
- **Имя секрета.** `RELEASE_PLEASE_TOKEN` (подтвердить у пользователя; проверить секрет через API нельзя).

## Приёмка

Как в задаче #18, раздел «Приёмка», без изменений. Часть, зависящая от ручных шагов (npm view после bootstrap, OIDC-выпуск, сценарии `fix:` в `zustand` и `react`), проверяется после bootstrap и на следующем выпуске, не в PR.
