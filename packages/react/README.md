# @cdd-team/react

[![npm](https://img.shields.io/npm/v/@cdd-team/react)](https://www.npmjs.com/package/@cdd-team/react)

Учебная реализация React: fiber-реконсилер, хуки (`useState`, `useEffect`, `useLayoutEffect`, `useMemo`, `useCallback`, `useContext`), `memo`, контекст и JSX-рантайм.

## Установка

```sh
bun add @cdd-team/react   # или npm install @cdd-team/react
```

Чтобы JSX компилировался в вызовы этой библиотеки, укажите пакет в `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@cdd-team/react"
  }
}
```

## Пример

```tsx
import { createRoot, useState } from "@cdd-team/react";

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

createRoot(document.getElementById("root")!).render(<Counter />);
```

Стейт-менеджер для этой библиотеки — [`@cdd-team/zustand`](https://www.npmjs.com/package/@cdd-team/zustand).
## Playground

`playground/` — ручной dev-стенд. Он не входит в `workspaces`, CI и релизы, зависимости ставятся в его
каталоге. Чтобы запустить стенд на локальной сборке пакета:

```sh
cd packages/react && bun link          # зарегистрировать локальный пакет
cd playground && bun link @cdd-team/react
bun run dev
```

После первой публикации `@cdd-team/react` в npm достаточно `bun install` в `playground/`. На Windows не
добавляйте playground в корневые `workspaces`: зависимость на собственный пакет порождает рекурсивные
цепочки `node_modules`.
