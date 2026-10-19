import type { Ref } from "./hooks.ts";

export type ElementProps = object & {
	ref?: Ref<unknown>;
};

export type RuntimeProps = Record<string, unknown>;
