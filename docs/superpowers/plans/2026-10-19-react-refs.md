# Refs в `@cdd-team/react`: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** перенести в пакет refs из главы `21-refs`: `useRef`, проп `ref` у DOM-элементов, `useImperativeHandle`. Коммит `ref` — в два шага, как в React 19.

**Architecture:** глава 21 переносится поверх `packages/react/src` с сохранением правок пакета. Единственное отличие от главы — `commit.ts`: в мутационной фазе `ref` только отвязываются, а fiber на привязку собираются в список, который `commitRoot` обрабатывает перед layout-эффектами.

**Tech Stack:** TypeScript, Bun (`bun test` + happy-dom), oxlint/oxfmt, tsdown.

**Spec:** `docs/superpowers/specs/2026-10-19-react-refs-design.md`. Эталон: `C:\Users\erofe\Documents\TechColab\react-from-scratch-course\21-refs` (сравнивать с `20-context-api`: `diff -u <курс>/20-context-api/src/<файл> <курс>/21-refs/src/<файл>`).

## Global Constraints

- Все отличия пакета от главы 20 сохраняются, если глава 21 их не затрагивает. Где затрагивает — совмещение по разделу спеки «Совмещение с правками пакета» (`BaseHTMLAttributes`, а не `HTMLAttributes`).
- Отличие от главы 21 только одно: двухшаговый коммит `ref` (Task 2).
- Тесты только `bun test`, Vitest не добавлять. Команды из `packages/react`: `bun test --preload ./test/setup-dom.ts test/refs.test.tsx`.
- Коммиты по-русски, `тип: что сделано`. Код — `feat:`. Каждое сообщение заканчивается строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Версии в `package.json`, `CHANGELOG.md` и манифесте не трогать. Не пушить и не открывать PR без просьбы пользователя. PR потом — draft, `Closes #14`.

## Review Focus

- **Тот же `ref` и тот же узел на повторном рендере** (обновление пропсов, `MOVE` при перестановке по `key`): функция-`ref` не вызывается повторно, ни с `null`, ни с узлом. Тест в Task 2: `reorder by key does not re-invoke ref`.
- **Смена `ref` с объекта на `null`/`undefined`** (`ref={cond ? r : undefined}`): старый получает `null`, новой привязки нет. Тест в Task 2: `ref removed from props is detached`.
- **`ref` на элементе внутри поддерева, которое удаляется вместе с родителем-компонентом**, а не на самом удаляемом host-узле: `null` получают все вложенные. Тест в Task 2: `nested refs detached on subtree removal`.
- **`ref` при `root.unmount()`**: путь `commitRootUnmount` → `commitDeletion` → `detachRef`. Тест в Task 2: `unmount detaches refs`.
- **`ref` на `memo`-компоненте**: приходит в `props`, при том же `ref` и тех же пропсах memo не ререндерит. Тест в Task 2: `ref passes through memo as prop`.

---

### Task 1: `useRef` и типы ref

**Files:**
- Modify: `packages/react/src/types/hooks.ts` — `HookKind.REF`, `RefObject`, `RefCallback`, `Ref`, `RefHook`, `Hook` (как в главе 21).
- Modify: `packages/react/src/hooks.ts` — `useRef` с тремя перегрузками, `isRefHook`; сообщение в `useState` меняется на `"Render hooks were not initialized."` (как в главе). Комментарий и `oxlint-disable` в `useCallback` оставить.
- Modify: `packages/react/src/types/index.ts` — `export type { Dispatch, StateAction, Ref, RefCallback, RefObject } from "./hooks.ts";` (экспорт `BaseHTMLAttributes` оставить).
- Modify: `packages/react/src/index.ts` — многострочный экспорт хуков, как в главе, пока без `useImperativeHandle`.
- Create: `packages/react/test/refs.test.tsx`

**Interfaces:**
- Produces: `useRef<Value>(initial: Value): RefObject<Value>` (+ перегрузки `Value | null`, `Value | undefined`); типы `RefObject<Value> = { current: Value }`, `RefCallback<Value>` (bivariance-хак), `Ref<Value> = RefObject<Value | null> | RefCallback<Value> | null | undefined`.

- [ ] **Step 1: Тесты.** Создать `test/refs.test.tsx` с локальным `flush()` и `mount(element)` (container в `document.body`, `createRoot`, `render`, `await flush()`, вернуть `{ container, root }`), по образцу `test/smoke.test.tsx`. В `describe("useRef")`:
  - `returns the same object between renders`: компонент сохраняет результат `useRef(0)` во внешний массив и рендерит `useState`-счётчик по клику. После клика `seen[0] === seen[1]`, длина 2.
  - `changing current does not re-render`: счётчик рендеров во внешней переменной; кнопка делает `ref.current += 1`. После клика и `flush()` рендеров 1, `ref.current === 1`.
- [ ] **Step 2: Запуск.** `bun test --preload ./test/setup-dom.ts test/refs.test.tsx`. Ожидается FAIL: `useRef` не экспортируется.
- [ ] **Step 3: Реализация** по diff главы 21 для перечисленных файлов.
- [ ] **Step 4: Запуск.** Тот же тест — PASS; `bun run typecheck` в `packages/react` — без ошибок.
- [ ] **Step 5: Коммит** `feat: хук useRef в @cdd-team/react`.

### Task 2: проп `ref` у DOM-элементов (двухшаговый коммит)

**Files:**
- Modify: `packages/react/src/types/fiber.ts` — `REF: 1 << 6`, `REF` в `MutationMask`.
- Modify: `packages/react/src/types/props.ts` — `ElementProps = object & { ref?: Ref<unknown> }`.
- Modify: `packages/react/src/types/jsx.ts` — `ref?: Ref<ElementType>` в `BaseHTMLAttributes`; `IntrinsicHTMLAttributes<Tag extends keyof HTMLElementTagNameMap> = BaseHTMLAttributes<HTMLElementTagNameMap[Tag]>`; все `IntrinsicElements`, кроме `a`, переводятся на `IntrinsicHTMLAttributes<"tag">` с сохранением дополнительных полей (`img`, `ol`, `input` и т. д.).
- Modify: `packages/react/src/patch-dom.ts` — `isProperty` исключает `"ref"`.
- Modify: `packages/react/src/fiber-pair.ts` — `getRefFlagForNewFiber`, `getRefFlagForWorkInProgress`, `canHaveRef`, `getRawRef` как в главе 21.
- Modify: `packages/react/src/commit.ts` — см. Step 3.
- Test: `packages/react/test/refs.test.tsx`

**Interfaces:**
- Consumes: `Ref`, `RefObject` из Task 1.
- Produces: внутри `commit.ts` — `commitWork(fiber: Fiber | null, refsToAttach: Fiber[]): void`, `attachRefs(fibers: Fiber[]): void`; `getRef`, `setRef`, `detachRef` как в главе.

- [ ] **Step 1: Тесты.** В `describe("ref prop")`:
  - `object ref receives the node`: `<input ref={r} />` → `r.current === container.querySelector("input")`.
  - `callback ref is called with the node`: `calls` (массив) после монтирования равен `[input]`.
  - `ref is not rendered to DOM`: `input.hasAttribute("ref") === false`, `"ref" in input === false` (если у happy-dom нет такого свойства; иначе `(input as any).ref === undefined`).
  - `ref is attached before useLayoutEffect`: в `useLayoutEffect` компонента записать `r.current` и `document.contains(r.current)` — узел и `true`.
  - `removed element detaches object and callback refs`: условный рендер по `useState`; после скрытия `r.current === null`, последний вызов callback — `null`.
  - `nested refs detached on subtree removal`: скрыть `<Child/>`, внутри которого `<div><span ref={r}/></div>` → `r.current === null`.
  - `unmount detaches refs`: после `root.unmount()` `r.current === null`.
  - `changing ref detaches old and attaches new`: переключение `refA`/`refB` → `refA.current === null`, `refB.current === input`.
  - `reorder by key does not re-invoke ref`: список `<li key ref={cb}>` с одним стабильным callback на элемент; перестановка — новых вызовов нет.
  - `ref removed from props is detached`: `ref={show ? r : undefined}` → после переключения `r.current === null`.
  - `siblings swapping refs both end attached`: X `refA→refB`, Y `refB→refA` в одном рендере → `refA.current === Y`, `refB.current === X`.
  - `ref moving from removed subtree to new node stays attached`: `<section>{a && <i ref={r}/>}</section><section>{!a && <b ref={r}/>}</section>`, переключить `a` с `false` на `true` и обратно → после каждого коммита `r.current` — видимый узел, не `null`.
  - `function component receives ref as prop`: `function Field({ ref }: { ref?: Ref<HTMLInputElement> }) { return <input ref={ref} />; }` → `r.current === input`.
  - `ref passes through memo as prop`: `memo(Field)` с тем же `r`; повторный рендер родителя с теми же пропсами не вызывает рендер `Field` (счётчик), `r.current === input`.
  - Проверка типов: `// @ts-expect-error` на `<input ref={useRef<HTMLDivElement>(null)} />`.
- [ ] **Step 2: Запуск** теста — FAIL (атрибут `ref` в DOM, `current` пустой).
- [ ] **Step 3: Реализация.** Все файлы, кроме `commit.ts`, — по diff главы 21. В `commit.ts` вместо `commitRef` главы:
  - `commitRoot` создаёт `const refsToAttach: Fiber[] = []`, передаёт его в `commitWork(root.child, refsToAttach)`, после `commitWork` вызывает `attachRefs(refsToAttach)` до `onCommitted`/layout-эффектов. Удаления корня (`commitChildDeletions(root)`) остаются до `commitWork`.
  - В `commitWork` при `FiberFlags.REF` и `current.dom !== null`: если есть `alternate` и `getRef(alternate.props) !== getRef(props)` — `setRef(prevRef, null)`; затем, если `getRef(props) != null`, `refsToAttach.push(current)`. Если `alternate` нет — только `push`.
  - `attachRefs` для каждого fiber вызывает `setRef(getRef(fiber.props), fiber.dom)`.
  - `detachRef` в `cleanupDomTree` — как в главе.
- [ ] **Step 4: Запуск.** Тест — PASS; `bun run test` и `bun run typecheck` в `packages/react` — без ошибок.
- [ ] **Step 5: Коммит** `feat: проп ref у DOM-элементов в @cdd-team/react`.

### Task 3: `useImperativeHandle`

**Files:**
- Modify: `packages/react/src/hooks.ts` — `useImperativeHandle`, `setImperativeRef` как в главе 21.
- Modify: `packages/react/src/index.ts` — добавить `useImperativeHandle` в экспорт.
- Test: `packages/react/test/refs.test.tsx`

**Interfaces:**
- Produces: `useImperativeHandle<Handle>(ref: Ref<Handle> | undefined, createHandle: () => Handle, deps?: EffectDeps): void`.

- [ ] **Step 1: Тесты.** В `describe("useImperativeHandle")`:
  - `sets handle and clears on unmount`: компонент с `ref` пропом ставит `{ focus }`; `r.current.focus` — функция; после `root.unmount()` `r.current === null`.
  - `recreates handle when deps change`: `deps=[value]`; после смены `value` — новый объект handle, при неизменном `value` — тот же.
  - `callback ref receives handle then null`: вызовы `[handle, null]` после размонтирования.
- [ ] **Step 2: Запуск** — FAIL (нет экспорта).
- [ ] **Step 3: Реализация** по diff главы 21.
- [ ] **Step 4: Запуск** — PASS, `bun run typecheck` чистый.
- [ ] **Step 5: Коммит** `feat: хук useImperativeHandle в @cdd-team/react`.

### Task 4: пример в playground

**Files:**
- Modify: `packages/react/playground/src/App.tsx`, `Header.tsx`, `Toolbar.tsx`, `types.ts`, `styles.css` — изменения главы 21, импорты из `@cdd-team/react`.
- Не трогать: `Memoized.tsx`, его импорт и `<Memoized />` в `App.tsx`, стили `.memo-*`, тип `MemoCardProps` (решение спеки).

- [ ] **Step 1: Перенос** правок главы 21 в перечисленные файлы, кроме удаления `Memoized`.
- [ ] **Step 2: Проверка сборки** на локальном пакете: в `packages/react` — `bun run build && bun link`; в `packages/react/playground` — `bun install && bun link @cdd-team/react && bun run build`. Ожидается: `tsc` и `vite build` без ошибок.
- [ ] **Step 3: Ручная проверка** (`bun run dev`, браузер): «Focus input via handle» ставит фокус в поле «Todo text»; у `<input class="quick-add">` в DOM нет атрибута `ref`; «Click Add via ref» добавляет задачу. Если браузера нет — сказать пользователю, что ручная проверка за ним.
- [ ] **Step 4: Коммит** `feat: пример refs в playground @cdd-team/react`. `bun link` не должен попасть в `package.json`/lockfile playground — проверить `git status`.

### Task 5: полная проверка

- [ ] **Step 1:** из корня worktree по `AGENTS.md`: `bun install --frozen-lockfile`, `bun run fmt:check && bun run lint && bun run build && bun run typecheck`, `bun run test && bun run test:integration && bun run test:scripts`, `bun run verify:packages`. Всё зелёное.
- [ ] **Step 2:** `git log --oneline main..` — коммиты задач 1–4 и спеки/плана; сообщить пользователю результат и спросить про пуш и draft PR (`Closes #14`).
