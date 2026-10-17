// Минимум типов API плагинов oxlint (он совместим с ESLint): сам oxlint типы плагинов не экспортирует.

/** Узел AST в формате ESTree / TS-ESTree. */
export interface Node {
  type: string;
  parent?: Node;
  // поля узла зависят от его типа
  [key: string]: any;
}

/** Комментарий из исходника: `value` — текст без ограничителей. */
export interface Comment {
  type: "Line" | "Block";
  value: string;
}

/** Контекст правила — то, что нужно этим правилам. */
export interface Context {
  sourceCode: { getCommentsBefore(node: Node): Comment[] };
  report(problem: { node: Node; message: string }): void;
}

/** Правило плагина. */
export interface Rule {
  meta: { type: "problem" | "suggestion"; docs: { description: string }; schema: [] };
  create(context: Context): Record<string, (node: Node) => void>;
}

/** Плагин: `meta.name` — префикс правил в конфиге. */
export interface Plugin {
  meta: { name: string };
  rules: Record<string, Rule>;
}
