# react
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
