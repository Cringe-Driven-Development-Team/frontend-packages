import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";

import plugin from "../src/index.ts";

RuleTester.describe = describe;
RuleTester.it = it;

// свои типы плагина уже, чем у oxlint (src/types.ts), поэтому правило приводится к его типу
type TestedRule = Parameters<RuleTester["run"]>[1];
const rule = (name: string) => plugin.rules[name] as unknown as TestedRule;

const tester = new RuleTester({ languageOptions: { sourceType: "module" } });
const ts = { filename: "file.ts" };
const HINT = "добавьте комментарий /** … */ перед объявлением";
const noJsdoc = (name: string) => `У экспорта «${name}» нет JSDoc: ${HINT}`;
const noMethodJsdoc = (name: string) => `У метода «${name}» нет JSDoc: ${HINT}`;

tester.run("require-jsdoc", rule("require-jsdoc"), {
  valid: [
    "/** Сумма. */\nexport function sum(a, b) { return a + b; }",
    // блок TSDoc: теги без типов
    {
      code: "/**\n * Сумма двух чисел.\n *\n * @param a - первое слагаемое\n * @param b - второе слагаемое\n * @returns сумма\n */\nexport function sum(a: number, b: number): number { return a + b; }",
      ...ts,
    },
    "/** Число. */\nexport const answer = 42;",
    "/** Класс. */\nexport class Box {}",
    "/** Функция. */\nexport default function main() {}",
    { code: "/** Тип. */\nexport type Id = string;", ...ts },
    { code: "/** Интерфейс. */\nexport interface User { id: string }", ...ts },
    { code: "/** Перечисление. */\nexport enum Color { Red }", ...ts },
    // не экспорт — JSDoc не обязателен
    "function local() {}\nconst value = 1;",
    "class Local { run() {} }",
    // компонент и хук
    "/** Кнопка. */\nexport const Button = () => null;",
    "/** Счётчик. */\nexport function useCounter() { return 0; }",
    // методы экспортируемого класса: публичным нужен JSDoc, остальным — нет
    "/** Класс. */\nexport class Box {\n  /** Открывает. */\n  open() {}\n  /** Закрывает. */\n  close = () => {};\n}",
    "/** Класс. */\nexport class Box {\n  constructor() {}\n  get size() { return 0; }\n  #secret() {}\n  value = 1;\n}",
    {
      code: "/** Класс. */\nexport class Box {\n  private a() {}\n  protected b() {}\n  private c = () => {};\n}",
      ...ts,
    },
    {
      code: "/** Класс. */\nexport class Box {\n  /** Читает. */\n  read(): string;\n  read(key: string): string;\n  read(key?: string): string { return key ?? ''; }\n}",
      ...ts,
    },
    // реэкспорт и default-выражение — не объявления
    "export { a } from './a';",
    "export * from './a';",
    "const a = 1;\nexport { a };",
    "export default { name: 'config' };",
    // у перегрузок комментарий несёт первая сигнатура
    {
      code: "/** Читает. */\nexport function read(): string;\nexport function read(key: string): string;\nexport function read(key?: string): string { return key ?? ''; }",
      ...ts,
    },
  ],
  invalid: [
    { code: "export function sum(a, b) { return a + b; }", errors: [{ message: noJsdoc("sum") }] },
    { code: "export const answer = 42;", errors: [{ message: noJsdoc("answer") }] },
    { code: "export class Box {}", errors: [{ message: noJsdoc("Box") }] },
    { code: "export default function main() {}", errors: [{ message: noJsdoc("main") }] },
    { code: "export type Id = string;", ...ts, errors: [{ message: noJsdoc("Id") }] },
    {
      code: "export interface User { id: string }",
      ...ts,
      errors: [{ message: noJsdoc("User") }],
    },
    { code: "export const Button = () => null;", errors: [{ message: noJsdoc("Button") }] },
    { code: "export function useCounter() { return 0; }", errors: [{ message: noJsdoc("useCounter") }] },
    {
      code: "/** Класс. */\nexport class Box {\n  open() {}\n  close = () => {};\n  static make() {}\n}",
      errors: [
        { message: noMethodJsdoc("Box.open") },
        { message: noMethodJsdoc("Box.close") },
        { message: noMethodJsdoc("Box.make") },
      ],
    },
    // класс и его метод проверяются независимо
    {
      code: "export class Box {\n  open() {}\n}",
      errors: [{ message: noJsdoc("Box") }, { message: noMethodJsdoc("Box.open") }],
    },
    {
      code: "/** Класс. */\nexport default class Box {\n  open() {}\n}",
      errors: [{ message: noMethodJsdoc("Box.open") }],
    },
    {
      code: "/** Класс. */\nexport class Box {\n  read(): string;\n  read(key?: string): string { return key ?? ''; }\n}",
      ...ts,
      errors: [{ message: noMethodJsdoc("Box.read"), line: 3 }],
    },
    // обычный и строчный комментарии — не JSDoc
    { code: "/* не JSDoc */\nexport const a = 1;", errors: [{ message: noJsdoc("a") }] },
    { code: "// не JSDoc\nexport const a = 1;", errors: [{ message: noJsdoc("a") }] },
    // JSDoc нужен каждому экспорту, а не одному на файл
    {
      code: "/** Первая. */\nexport const a = 1;\nexport const b = 2;",
      errors: [{ message: noJsdoc("b") }],
    },
    // перегрузки без комментария: одна ошибка, у первой сигнатуры
    {
      code: "export function read(): string;\nexport function read(key?: string): string { return key ?? ''; }",
      ...ts,
      errors: [{ message: noJsdoc("read"), line: 1 }],
    },
  ],
});

tester.run("check-param-names", rule("check-param-names"), {
  valid: [
    "/**\n * @param a первое\n * @param b второе\n */\nexport function sum(a, b) { return a + b; }",
    "/**\n * @param {number} a первое\n * @param {number} [b] второе\n */\nfunction sum(a, b = 0) { return a + b; }",
    "/**\n * @param {{ id: string }} user пользователь\n */\nconst show = (user) => user.id;",
    // TSDoc: без типа, описание через дефис
    {
      code: "/**\n * @param a - первое\n * @param b - второе\n * @returns сумма\n */\nexport function sum(a: number, b: number): number { return a + b; }",
      ...ts,
    },
    // на месте деструктурированного параметра имя любое, вложенные теги не проверяются
    "/**\n * @param props свойства\n * @param props.id идентификатор\n */\nexport function View({ id }) { return id; }",
    "/**\n * @param values значения\n */\nexport function all(...values) { return values; }",
    // тегов меньше, чем параметров, — это дело jsdoc/require-param
    "/** Сумма. */\nexport function sum(a, b) { return a + b; }",
    // комментарий не перед функцией
    "/**\n * @param a первое\n */\nexport const answer = 42;",
  ],
  invalid: [
    {
      code: "/**\n * @param b первое\n */\nexport function id(a) { return a; }",
      errors: [{ message: "@param «b»: параметр называется «a»" }],
    },
    {
      code: "/**\n * @param b второе\n * @param a первое\n */\nfunction sum(a, b) { return a + b; }",
      errors: [
        { message: "@param «b»: параметр называется «a»" },
        { message: "@param «a»: параметр называется «b»" },
      ],
    },
    {
      code: "/**\n * @param a первое\n * @param c лишнее\n */\nconst id = (a) => a;",
      errors: [{ message: "@param «c»: такого параметра нет" }],
    },
    {
      code: "/**\n * @param name - имя\n */\nexport function greet(title: string): string { return title; }",
      ...ts,
      errors: [{ message: "@param «name»: параметр называется «title»" }],
    },
    {
      code: "/**\n * @param {string} name имя\n */\nexport function greet(title: string): string { return title; }",
      ...ts,
      errors: [{ message: "@param «name»: параметр называется «title»" }],
    },
  ],
});
