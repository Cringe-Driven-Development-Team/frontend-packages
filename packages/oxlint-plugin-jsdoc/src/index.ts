import { checkParamNames } from "./rules/check-param-names.ts";
import { requireJsdoc } from "./rules/require-jsdoc.ts";
import type { Plugin } from "./types.ts";

export type { Plugin, Rule } from "./types.ts";

/**
 * Плагин oxlint: правила `cdd/require-jsdoc` и `cdd/check-param-names`.
 * Подключается через `jsPlugins` в конфиге oxlint.
 */
const plugin: Plugin = {
  meta: { name: "cdd" },
  rules: {
    "require-jsdoc": requireJsdoc,
    "check-param-names": checkParamNames,
  },
};

export default plugin;
