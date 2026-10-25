<div align="center">

# @cdd-team/react

**Учебная реализация React на TypeScript**

От JSX и компонентов до hooks, Context и обновления DOM.

<p>
  <a href="https://www.npmjs.com/package/@cdd-team/react"><img src="https://img.shields.io/npm/v/%40cdd-team%2Freact?style=for-the-badge&amp;logo=npm&amp;label=npm&amp;color=CB3837" alt="Версия в npm"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&amp;logo=typescript&amp;logoColor=white" alt="TypeScript"></a>
  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-%3E%3D1.4.0-000000?style=for-the-badge&amp;logo=bun&amp;logoColor=white" alt="Bun 1.4.0 и новее"></a>
  <a href="https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/packages/react/package.json"><img src="https://img.shields.io/npm/l/%40cdd-team%2Freact?style=for-the-badge&amp;color=22C55E" alt="Лицензия MIT"></a>
</p>

[Быстрый старт](#быстрый-старт) · [Возможности](#возможности) · [Разработка](#разработка) · [Контекст проекта](https://docs.cellestial.ru/project-context)

</div>

Реализация React команды [Cringe-Driven Development](https://github.com/Cringe-Driven-Development-Team) с функциональными компонентами, JSX, hooks, Context и мемоизацией. В основе — Fiber-дерево, собственный планировщик и обновление DOM.

## Быстрый старт

Установи пакет в приложение со сборщиком, поддерживающим TSX:

```sh
bun add @cdd-team/react
```

В `tsconfig.json` настрой automatic JSX runtime:

```json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "@cdd-team/react"
	}
}
```

Добавь в HTML контейнер `<div id="root"></div>`. Пример входного файла приложения:

```tsx
import { createRoot, useState } from "@cdd-team/react";
import type { ReactElement } from "@cdd-team/react";

function Counter(): ReactElement {
	const [count, setCount] = useState(0);

	return (
		<button onClick={() => setCount((value) => value + 1)}>
			Счётчик: {count}
		</button>
	);
}

const container = document.getElementById("root");

if (container) {
	createRoot(container).render(<Counter />);
}
```

Стейт-менеджер для этой библиотеки — [`@cdd-team/zustand`](https://www.npmjs.com/package/@cdd-team/zustand).

## Возможности

| Механизм | API и реализация |
| --- | --- |
| Элементы | `h`, `hFragment`, `createElement`, `Fragment`, `Children`, `isValidElement` |
| Рендеринг | `createRoot`, `root.render`, `root.unmount`, Fiber и reconciliation |
| Планирование | scheduler, render и commit phases |
| Состояние и эффекты | `useState`, `useEffect`, `useLayoutEffect` |
| Мемоизация | `memo`, `useMemo`, `useCallback` |
| Контекст | `createContext`, `useContext` |
| Внешние сторы | `useSyncExternalStore`, `useSyncExternalStoreWithSelector` |
| JSX | automatic runtime: `jsx-runtime` и `jsx-dev-runtime` |

Публичные экспорты собраны в [`src/index.ts`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/packages/react/src/index.ts). Проект развивается как учебная реализация; набор поддерживаемых API определяется этим репозиторием.

## Разработка

Пакет живёт в монорепозитории [`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages). Нужен **Bun 1.4.2**; версия указана в [`.bvmrc`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/.bvmrc).

```sh
git clone https://github.com/Cringe-Driven-Development-Team/frontend-packages.git
cd frontend-packages
bun install --frozen-lockfile
cd packages/react
bun run build
```

Общие команды проверки и порядок их запуска — в [корневом README](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/README.md#разработка), правила выпуска — в [release runbook](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/docs/release-runbook.md).

### Playground

`playground/` — ручной dev-стенд с примерами состояния, эффектов, Context и мемоизации. Он находится вне `workspaces`, CI и релизов; зависимости устанавливаются отдельно.

Чтобы запустить стенд на локальной сборке пакета, после сборки выполни из корня монорепозитория:

```sh
cd packages/react
bun link
cd playground
bun install
bun link @cdd-team/react
bun run dev -- --host 127.0.0.1
```

Для запуска с опубликованным пакетом достаточно выполнить `bun install` и `bun run dev -- --host 127.0.0.1` в `packages/react/playground`. Версия зависимости указана в его [`package.json`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/packages/react/playground/package.json).

На Windows сохраняй playground вне корневых `workspaces`: зависимость на собственный пакет порождает рекурсивные цепочки `node_modules`.

### Навигация по коду

- [`src/`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/tree/main/packages/react/src) — элементы, Fiber, scheduler, reconciliation, hooks и DOM-layer.
- [`test/`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/tree/main/packages/react/test) — тесты библиотеки.
- [`playground/src/`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/tree/main/packages/react/playground/src) — примеры использования библиотеки.
- [`AGENTS.md`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/main/AGENTS.md) — инструкции для работы с монорепозиторием.

## Документация и участие

- [Контекст проекта](https://docs.cellestial.ru/project-context) — общепроектная документация, архитектура и планы.
- [Трек учебных библиотек](https://docs.cellestial.ru/modules/2/tracks/front-libs) — документация библиотек монорепозитория.
- [Задачи монорепозитория](https://github.com/Cringe-Driven-Development-Team/frontend-packages/issues) — обсуждения и развитие пакетов.
- [Правила команды](https://github.com/Cringe-Driven-Development-Team/.github/blob/main/CONTRIBUTING.md) — оформление задач и pull requests.
