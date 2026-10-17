import type { Context, Node } from "./types.ts";

/**
 * JSDoc-комментарий прямо перед узлом.
 * @param context - контекст правила
 * @param node - узел AST
 * @returns текст комментария без ограничителей или null, если JSDoc нет
 */
export function jsdocBefore(context: Context, node: Node): string | null {
  const comment = context.sourceCode.getCommentsBefore(node).at(-1);
  return comment?.type === "Block" && comment.value.startsWith("*") ? comment.value : null;
}

/**
 * Имена параметров из тегов `@param` в порядке записи. Вложенные (`props.name`) пропускаются.
 * @param jsdoc - текст JSDoc-комментария
 * @returns имена параметров
 */
export function paramTags(jsdoc: string): string[] {
  const names: string[] = [];
  for (const [, rest = ""] of jsdoc.matchAll(/@param\b([^\n]*)/g)) {
    let text = rest.trim();
    if (text.startsWith("{")) {
      // тип может содержать вложенные скобки: {{ id: string }}
      let depth = 0;
      let end = 0;
      for (; end < text.length; end++) {
        if (text[end] === "{") depth++;
        else if (text[end] === "}" && --depth === 0) break;
      }
      text = text.slice(end + 1).trim();
    }
    const name = /^\[?\s*([\w$.]+)/.exec(text)?.[1];
    if (name && !name.includes(".")) names.push(name);
  }
  return names;
}

/**
 * Функция, которую документирует комментарий перед узлом: само объявление либо функция
 * в инициализаторе `const`.
 * @param node - объявление или узел `export` с ним
 * @returns узел функции или null, если документируется не функция
 */
export function documentedFunction(node: Node): Node | null {
  const target: Node | null = node.type.startsWith("Export") ? node.declaration : node;
  if (!target) return null;
  if (target.type === "FunctionDeclaration" || target.type === "TSDeclareFunction") return target;
  if (target.type === "VariableDeclaration" && target.declarations.length === 1) {
    const init: Node | null = target.declarations[0].init;
    if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") {
      return init;
    }
  }
  return null;
}

/**
 * Имя параметра функции, как его ждёт `@param`.
 * @param param - узел параметра
 * @returns имя или null, если параметр деструктурирован и имя в JSDoc любое
 */
export function paramName(param: Node): string | null {
  if (param.type === "TSParameterProperty") return paramName(param.parameter);
  if (param.type === "AssignmentPattern") return paramName(param.left);
  if (param.type === "RestElement") return paramName(param.argument);
  return param.type === "Identifier" ? param.name : null;
}
