import { documentedFunction, jsdocBefore, paramName, paramTags } from "../jsdoc.ts";
import type { Node, Rule } from "../types.ts";

/**
 * Имена в `@param` совпадают с параметрами функции и идут в том же порядке. Проверяются
 * объявления функций и функции в инициализаторе `const`, с `export` и без. На месте
 * деструктурированного параметра имя в JSDoc может быть любым; вложенные теги
 * (`props.name`) не проверяются.
 */
export const checkParamNames: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Имена в @param совпадают с параметрами функции" },
    schema: [],
  },
  create(context) {
    const check = (node: Node): void => {
      const fn = documentedFunction(node);
      const jsdoc = fn && jsdocBefore(context, node);
      if (!fn || !jsdoc) return;

      const params: (string | null)[] = fn.params.map(paramName);
      paramTags(jsdoc).forEach((tag, index) => {
        const expected = params[index];
        if (index >= params.length) {
          context.report({ node: fn, message: `@param «${tag}»: такого параметра нет` });
        } else if (expected != null && expected !== tag) {
          context.report({ node: fn, message: `@param «${tag}»: параметр называется «${expected}»` });
        }
      });
    };
    return {
      ExportNamedDeclaration: check,
      ExportDefaultDeclaration: check,
      // без export — сами объявления; под export их уже проверил обработчик выше
      ":not(ExportNamedDeclaration, ExportDefaultDeclaration) > FunctionDeclaration": check,
      ":not(ExportNamedDeclaration) > VariableDeclaration": check,
    };
  },
};
