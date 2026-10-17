import { jsdocBefore } from "../jsdoc.ts";
import type { Context, Node, Rule } from "../types.ts";

const HINT = "добавьте комментарий /** … */ перед объявлением";

/**
 * Публичный метод класса: обычный метод или свойство с функцией (`go = () => {}`).
 * Конструктор, геттеры и сеттеры, `private`, `protected` и `#приватные` — не в счёт.
 * @param member - член класса
 * @returns true, если методу нужен JSDoc
 */
function isPublicMethod(member: Node): boolean {
  if (member.key?.type === "PrivateIdentifier") return false;
  if (member.accessibility === "private" || member.accessibility === "protected") return false;
  if (member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition") {
    return member.kind === "method";
  }
  if (member.type === "PropertyDefinition") {
    const value: string | undefined = member.value?.type;
    return value === "ArrowFunctionExpression" || value === "FunctionExpression";
  }
  return false;
}

/**
 * Сигнатура перегрузки: объявление функции или метода без тела.
 * @param node - объявление или член класса
 * @returns true, если тела нет
 */
function isOverloadSignature(node: Node | undefined): boolean {
  return (
    node?.type === "TSDeclareFunction" || node?.value?.type === "TSEmptyBodyFunctionExpression"
  );
}

/**
 * Проверяет публичные методы экспортируемого класса.
 * @param context - контекст правила
 * @param declaration - объявление класса
 */
function checkMethods(context: Context, declaration: Node): void {
  const members: Node[] = declaration.body?.body ?? [];
  members.forEach((member, index) => {
    if (!isPublicMethod(member) || jsdocBefore(context, member) !== null) return;

    const name: string | undefined = member.key?.name;
    // у перегрузок JSDoc несёт первая сигнатура
    const previous = members[index - 1];
    if (name && isOverloadSignature(previous) && previous?.key?.name === name) return;

    const owner: string = declaration.id?.name ? `${declaration.id.name}.` : "";
    context.report({
      node: member.key ?? member,
      message: `У метода ${name ? `«${owner}${name}» ` : ""}нет JSDoc: ${HINT}`,
    });
  });
}

/**
 * У каждого экспортируемого объявления есть JSDoc: функции, классы и их публичные методы,
 * константы, типы, интерфейсы и enum. Проверяется только наличие блока `/** … *\/`, теги
 * и типы в нём — нет. Реэкспорт (`export { a } from './a'`) и `export default <выражение>` —
 * не объявления, их правило не трогает. У перегрузок комментарий несёт первая сигнатура.
 */
export const requireJsdoc: Rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Экспортируемое объявление должно иметь JSDoc" },
    schema: [],
  },
  create(context) {
    const check = (node: Node): void => {
      const declaration: Node | null = node.declaration;
      // сигнатура перегрузки — TSDeclareFunction, остальные объявления — *Declaration
      if (!declaration) return;
      if (!declaration.type.endsWith("Declaration") && !isOverloadSignature(declaration)) return;
      if (declaration.type === "ClassDeclaration") checkMethods(context, declaration);
      if (jsdocBefore(context, node) !== null) return;

      const id: Node | undefined = declaration.id ?? declaration.declarations?.[0]?.id;
      // у перегрузок JSDoc несёт первая сигнатура
      const siblings: Node[] = node.parent?.body ?? [];
      const previous: Node | undefined = siblings[siblings.indexOf(node) - 1]?.declaration;
      if (id?.name && isOverloadSignature(previous) && previous?.id?.name === id.name) return;

      context.report({
        node: id ?? node,
        message: `У экспорта ${id?.name ? `«${id.name}» ` : ""}нет JSDoc: ${HINT}`,
      });
    };
    return { ExportNamedDeclaration: check, ExportDefaultDeclaration: check };
  },
};
