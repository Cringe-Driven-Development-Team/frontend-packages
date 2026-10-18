# Refs в `@cdd-team/react`: дизайн

Источник требований: задача [frontend-packages#14](https://github.com/Cringe-Driven-Development-Team/frontend-packages/issues/14) (`gh issue view 14 -R Cringe-Driven-Development-Team/frontend-packages`; перенесена из react#15). Эталонная реализация — глава `21-refs` курса в `C:\Users\erofe\Documents\TechColab\react-from-scratch-course` (дальше «глава 21»; предыдущая глава — `20-context-api`, «глава 20»). Документ фиксирует решения, принятые при обсуждении, и факты, проверенные в коде. Если документ и задача расходятся, прав документ.

## Зачем

Это шаг «refs» на графе трека React. Пакет при этом используется в курсовом фронте, поэтому поведение должно совпадать с React 19, а не только проходить тесты. Компонентам нужен доступ к DOM-узлу (фокус, прокрутка, измерения, сторонний код). Сейчас в пакете нет ни `useRef`, ни пропа `ref`: `isProperty` в `packages/react/src/patch-dom.ts` пропускает `ref`, и он уходит в DOM атрибутом.

## Исходное состояние (проверено)

`packages/react/src` — это глава 20 плюс собственные правки пакета:

- `types/jsx.ts`: `HTMLAttributes` переименован в `BaseHTMLAttributes` (и в `IntrinsicElements`, и в `AnchorHTMLAttributes`), комментарий над ним по-русски.
- `types/index.ts`: экспортируется `BaseHTMLAttributes` вместо `HTMLAttributes`.
- `types/component.ts`: `FunctionComponent`/`ExoticComponent` ограничены `ElementProps`, а не `object`; убран JSDoc у `MemoComponent`.
- `memo.ts`: убран поясняющий комментарий.
- `renderer-state.ts`: `queueDeletion` без `??=`.
- `hooks.ts`: в `useCallback` комментарий и `oxlint-disable-next-line react/exhaustive-deps`.
- `playground/src`: импорты из `@cdd-team/react` вместо `@wely6743/react` (и прочие правки пакета).

Глава 21 меняет относительно главы 20 файлы: `commit.ts`, `fiber-pair.ts`, `h.ts` (только пустая строка), `hooks.ts`, `index.ts`, `patch-dom.ts`, `types/fiber.ts`, `types/hooks.ts`, `types/index.ts`, `types/jsx.ts`, `types/props.ts`, а в playground — `App.tsx`, `Header.tsx`, `Toolbar.tsx`, `types.ts`, `styles.css`, удаление `Memoized.tsx`. Тестов в главе 21 нет.

## Цели

- Перенести в пакет diff «глава 20 → глава 21» по `src`.
- Сохранить все отличия пакета от главы 20 там, где глава 21 их не затрагивает. Где затрагивает, совместить: изменение главы 21 применяется поверх имён и правок пакета (см. «Совмещение»).
- Тесты на `bun test` в `packages/react/test` на всё поведение ниже.
- Пример в playground: фокус в поле через `ref`; у поля в DOM нет атрибута `ref`.
- Выпуск новой минорной версии через release-please (коммит `feat:`).

## Не цели

- Cleanup-функция, возвращаемая из функции-`ref` (React 19). Как в главе 21 и в задаче: при откреплении функция вызывается с `null`.
- `ref` на функциональных/memo-компонентах как отдельный механизм и `forwardRef`: `ref` приходит компоненту обычным пропом, компонент передаёт его вниз сам.
- Ручная публикация в npm, пуш и слияние PR без просьбы.

## Анти-цели (провал, даже если работает)

- `ref` попадает в DOM атрибутом или свойством.
- Потеряна какая-то из правок пакета относительно главы 20 (например, вернулось имя `HTMLAttributes`).
- `ref` проставляется после `useLayoutEffect` или не обнуляется при удалении вложенных узлов.
- Поведение расходится с главой 21 без записанной в этом документе причины. Единственное записанное расхождение — двухшаговый коммит `ref` (см. «Поведение»).

## Поведение (как в главе 21)

**`useRef(initial)`.** Новый хук `HookKind.REF` (`RefHook { kind, ref }`). На первом рендере создаётся `{ current: initial }`, на следующих объект берётся из `alternate.hooks[hookIndex]`. Смена `current` рендер не вызывает. Три перегрузки: `Value`, `Value | null`, `Value | undefined`. Ошибка вне компонента: `"Render.useRef must be called inside a function component."`.

**`useImperativeHandle(ref, createHandle, deps?)`.** Входит в работу (решение пользователя, хотя в задаче он в «Не входит»). Реализация главы 21: `useLayoutEffect`, который ставит `createHandle()` в `ref` (объект или функция), а в cleanup ставит `null`. Если `deps` переданы, к ним добавляется сам `ref`; без `deps` эффект срабатывает на каждом рендере.

**Флаг `FiberFlags.REF = 1 << 6`** входит в `MutationMask`. Ставится в `fiber-pair.ts` только host-fiber (`FiberTag.HOST`): новому, если `props.ref != null`; переиспользованному, если `current.props.ref !== element.props.ref`. Всплывает через существующий `bubbleSubtreeFlags`.

**Commit — в два шага, как в React 19 (отличие от главы 21).** Глава 21 отвязывает и привязывает `ref` по каждому fiber по очереди прямо в обходе `commitWork`. Из-за этого расходится с React 19 в двух сценариях: соседи в одном рендере обмениваются `ref` (X: `refA→refB`, Y: `refB→refA` — в главе `refB` остаётся `null`), и `ref` переходит из удаляемого поддерева на новый узел, а удаление обходится позже вставки (в главе удаление обнуляет уже привязанный `ref`). Решение пользователя — как в React 19:

1. Мутационная фаза (`commitWork` и удаления) только отвязывает. В `commitWork` при флаге `REF` у переиспользованного fiber со сменой `ref` старый `ref` получает `null`. Каждый host-fiber с флагом `REF` и узлом (новый или со сменой `ref`) складывается в список на привязку. Удаления обнуляют `ref` через `detachRef` в `cleanupDomTree`, как в главе.
2. После всех мутаций, в `commitRoot` перед запуском layout-эффектов, каждый fiber из списка получает узел (объект: `current = dom`, функция: `ref(dom)`).

Так в момент `useLayoutEffect` все `ref` уже указывают на узлы в документе. Список собирается в существующем обходе `commitWork`, отдельного обхода дерева нет.

**Удаление.** `cleanupDomTree` вызывает `detachRef` для каждого host-узла поддерева до `removeChild`, поэтому `null` получают и вложенные узлы. Так же работает `root.unmount()` (через `commitDeletion`).

**DOM.** `isProperty` исключает `ref`: ни атрибута, ни свойства.

**Функциональные компоненты.** `h`/`createElement`/jsx-runtime `ref` не вырезают. Он остаётся в `props` и для функционального компонента, и для `memo` (сравнивается вместе с остальными пропсами).

**Типы и экспорт.** `RefObject<Value> = { current: Value }`, `RefCallback<Value>` с bivariance-хаком, `Ref<Value> = RefObject<Value | null> | RefCallback<Value> | null | undefined`. `ElementProps = object & { ref?: Ref<unknown> }`. Из пакета экспортируются `useRef`, `useImperativeHandle` и типы `Ref`, `RefObject`, `RefCallback`.

## Совмещение с правками пакета

- **`types/jsx.ts`.** Глава 21 добавляет `ref?: Ref<ElementType>` в `HTMLAttributes` и вводит `IntrinsicHTMLAttributes<Tag> = HTMLAttributes<HTMLElementTagNameMap[Tag]>`, а все `IntrinsicElements` (кроме `a`) переводит на него. В пакете `ref` добавляется в `BaseHTMLAttributes`, `IntrinsicHTMLAttributes<Tag>` строится на `BaseHTMLAttributes<HTMLElementTagNameMap[Tag]>`, и `IntrinsicElements` переводятся с `BaseHTMLAttributes` на `IntrinsicHTMLAttributes<"tag">` так же, как в главе. Русский комментарий и экспорт `BaseHTMLAttributes` сохраняются.
- **`hooks.ts`.** Изменения главы 21 переносятся целиком, включая сообщение `"Render hooks were not initialized."` в `useState` (эту строку глава меняет). Комментарий и `oxlint-disable` в `useCallback` сохраняются.
- **`types/props.ts`.** В пакете файл совпадает с главой 20, берётся версия главы 21. `FunctionComponent<Props extends ElementProps>` из пакета остаётся и теперь знает о `ref`.
- **`h.ts`.** Глава 21 только удаляет пустую строку. Не переносится (моё решение): к refs отношения не имеет, oxfmt решит сам.
- **Playground.** Переносятся изменения главы 21 в `App.tsx`, `Header.tsx`, `Toolbar.tsx`, `types.ts`, `styles.css`, импорты остаются из `@cdd-team/react`. Удаление `Memoized.tsx` вместе с его стилями и типом `MemoCardProps` (моё решение) не переносится: к refs оно не относится, а демо memo полезно. Пример по приёмке — кнопка «Focus input via handle» (через `useImperativeHandle` фокусирует `<input ref={inputRef}>`) и «Click Add via ref».

## Тесты

Новый файл `packages/react/test/refs.test.tsx` в стиле `smoke.test.tsx` (happy-dom, `flush()` через `setTimeout`):

- `useRef`: один и тот же объект между рендерами; смена `current` рендер не вызывает.
- Объектный `ref` на DOM-элементе получает узел после монтирования.
- Функциональный `ref` вызывается с узлом.
- При удалении элемента (условный рендер) объектный `ref` получает `null`, функция вызывается с `null`, включая вложенный узел удаляемого поддерева.
- `root.unmount()` обнуляет `ref`.
- Смена `ref` между рендерами: старый получает `null`, новый — узел; тот же `ref` повторно не вызывается.
- Соседние элементы обмениваются `ref` в одном рендере: оба `ref` указывают на новые узлы, а не на `null`.
- `ref` переходит с удаляемого узла на новый узел в другой ветке дерева (`<section>{a && <i ref={r}/>}</section><section>{!a && <b ref={r}/>}</section>`): после коммита `r` указывает на новый узел.
- Порядок: в `useLayoutEffect` `ref.current` уже указывает на узел, и узел уже в документе.
- У элемента нет атрибута `ref` и свойства `ref`.
- `ref` приходит функциональному компоненту в `props`, компонент передаёт его на DOM-элемент.
- `useImperativeHandle`: `ref` получает handle, при размонтировании — `null`; с `deps` handle пересоздаётся при их смене.

## Порядок работ

Ветка `react-14` в worktree `.claude/worktrees/react-15`. Коммиты по-русски, `feat:` для кода, `test:`/`docs:` по смыслу. Перед PR — полный набор проверок из `AGENTS.md` (`fmt:check`, `lint`, `build`, `typecheck`, `test`, `test:integration`, `test:scripts`, `verify:packages`). PR — draft, описание `Closes #14`, если нет причины писать иначе.

## Что оставлено исполнителю

Разбиение на коммиты, точный набор тест-кейсов внутри перечисленного, формулировки тестов.
