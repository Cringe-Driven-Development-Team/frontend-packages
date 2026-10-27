# @cdd-team/clsx

Собирает строку CSS-классов из строк, чисел, массивов и объектов-условий. Ведёт себя как функция
[`clsx`](https://github.com/lukeed/clsx), без зависимостей. Отличия от `clsx`:

- экспорт только именованный: `import { clsx } from "@cdd-team/clsx"`, экспорта по умолчанию и `clsx/lite` нет;
- из объекта берутся только собственные ключи, унаследованные через прототип не попадают в строку;
- ненулевой `bigint` попадает в строку как число (`clsx(2n)` → `"2"`), `clsx` его пропускает.

```sh
bun add @cdd-team/clsx
```

```ts
import { clsx } from "@cdd-team/clsx";

clsx("button", { "button--active": isActive, "button--disabled": false }); // "button button--active"
clsx(["card", ["card--wide", null]], size === "lg" && "card--lg"); // "card card--wide card--lg"
```

| Значение | Что попадает в строку |
| --- | --- |
| строка, число, `bigint` | само значение |
| массив | его элементы по тем же правилам, вложенность любая |
| объект | ключи с истинными значениями |
| `false`, `true`, `null`, `undefined`, `0`, `""` | ничего |

Типы значений экспортируются: `ClassValue`, `ClassArray`, `ClassDictionary`.

Пакет живёт в монорепозитории
[`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages); команды
разработки — в его README.
