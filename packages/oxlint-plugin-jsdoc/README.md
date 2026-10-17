# @cdd-team/oxlint-plugin-jsdoc

Правила [oxlint](https://oxc.rs/docs/guide/usage/linter) про JSDoc, которых нет в его встроенном
плагине `jsdoc`: обязательный комментарий у экспортов и сверка имён в `@param`
([frontend#26](https://github.com/Cringe-Driven-Development-Team/frontend/issues/26)).
Рантайм-зависимостей нет.

| Правило | Что требует |
| --- | --- |
| `cdd/require-jsdoc` | JSDoc у каждого экспортируемого объявления: функции, компоненты, хуки, классы и их публичные методы, константы, типы, интерфейсы, enum |
| `cdd/check-param-names` | имена в `@param` совпадают с параметрами функции и идут в том же порядке |

## Установка

```sh
bun add -d @cdd-team/oxlint-plugin-jsdoc   # или npm install -D @cdd-team/oxlint-plugin-jsdoc
```

Нужен `oxlint` ≥ 1.86 — в нём есть `jsPlugins`. Плагины на JS oxlint выполняет под node
(`^20.19.0 || >=22.12.0`).

```ts
// oxlint.config.ts
import { defineConfig } from 'oxlint';

export default defineConfig({
    jsPlugins: ['@cdd-team/oxlint-plugin-jsdoc'],
    rules: {
        'cdd/require-jsdoc': 'error',
        'cdd/check-param-names': 'error',
    },
});
```

Правила проверяют наличие комментария и имена параметров — этого достаточно. Настроек у них нет.

Комментарии — в стиле [TSDoc](https://tsdoc.org): блок `/** … */`, типы в тегах не пишутся, их
несёт TypeScript. Поэтому встроенные правила oxlint, которые требуют теги и типы в них, включать
не нужно. JSDoc с типами (`@param {string} name`) правила плагина тоже понимают.

```ts
/**
 * Сумма двух чисел.
 *
 * @param a - первое слагаемое
 * @param b - второе слагаемое
 * @returns сумма
 */
export function sum(a: number, b: number): number {
    return a + b;
}
```

## `cdd/require-jsdoc`

```ts
// ошибка: У экспорта «sum» нет JSDoc: добавьте комментарий /** … */ перед объявлением
export function sum(a: number, b: number): number {
    return a + b;
}

/** Сумма двух чисел. */
export function sum(a: number, b: number): number {
    return a + b;
}
```

- JSDoc — блочный комментарий `/** … */` прямо перед `export`; `/* … */` и `// …` не считаются.
- Не объявления правило не трогает: реэкспорт (`export { a } from './a'`, `export * from`,
  `export { a }`) и `export default <выражение>` — например, `export default defineConfig({ … })`.
- У перегрузок комментарий несёт первая сигнатура, остальным и реализации он не нужен.
- У экспортируемого класса JSDoc нужен и публичным методам, включая статические и свойства с
  функцией (`go = () => {}`). Конструктор, геттеры и сеттеры, `private`, `protected` и `#приватные`
  не проверяются.
- Проверяется только наличие блока: теги и типы в нём правило не требует — типы несёт TypeScript.
- Неэкспортируемый код не проверяется.

## `cdd/check-param-names`

```ts
/**
 * @param name - имя      // ошибка: @param «name»: параметр называется «title»
 * @param extra - лишнее  // ошибка: @param «extra»: такого параметра нет
 */
export function greet(title: string): string {
    return title;
}
```

- Проверяются объявления функций и функции в инициализаторе `const`, с `export` и без.
- Сверка идёт по порядку: первый `@param` — с первым параметром, и так далее.
- На месте деструктурированного параметра имя в JSDoc любое (`@param props`); вложенные теги
  (`@param props.id`) пропускаются.
- Нехватку тегов правило не ловит: описывать каждый параметр не обязательно.

## Разработка

```sh
bun install
bun run typecheck
bun run test    # node --test: RuleTester из oxlint под bun не работает, нужен node ≥ 22.18
bun run build   # tsdown → dist/
```

Правила лежат в `src/rules/`, общий разбор JSDoc — в `src/jsdoc.ts`. Типы API плагинов в
`src/types.ts` свои: `oxlint` их не экспортирует. Тесты — `test/rules.test.ts` на `RuleTester`
из `oxlint/plugins-dev`.

Публикация автоматическая: версии, changelog и теги ведёт release-please, в npm пакет уходит из GitHub
Actions по OIDC. Подробности — в README и `docs/release-runbook.md` монорепозитория `frontend-packages`.
