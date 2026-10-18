export const HookKind = {
	STATE: "state",
	EFFECT: "effect",
	MEMO: "memo",
	REF: "ref",
} as const;

export interface StateHook<State> {
	kind: typeof HookKind.STATE;
	state: State;
	queue: StateAction<State>[];
	dispatch: Dispatch<State>;
}

export type StateAction<State> = State | ((previousState: State) => State);
export type Dispatch<State> = (action: StateAction<State>) => void;

export const EffectKind = {
	LAYOUT: "layout",
	PASSIVE: "passive",
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];

export type EffectCleanup = () => void;
export type EffectCallback = () => unknown;
export type EffectDeps = readonly unknown[];
export type MemoCallback = (...args: never[]) => unknown;

export interface EffectHook {
	kind: typeof HookKind.EFFECT;
	effectKind: EffectKind;
	callback: EffectCallback;
	deps: EffectDeps | undefined;
	cleanup?: EffectCleanup;
	shouldRun: boolean;
}

export interface MemoHook<Value = unknown> {
	kind: typeof HookKind.MEMO;
	value: Value;
	deps: EffectDeps | undefined;
}

export type RefObject<Value> = {
	current: Value;
};
export type RefCallback<Value> = {
	bivarianceHack(value: Value | null): void;
}["bivarianceHack"];
export type Ref<Value> = RefObject<Value | null> | RefCallback<Value> | null | undefined;

export interface RefHook<Value> {
	kind: typeof HookKind.REF;
	ref: RefObject<Value>;
}

export type Hook = StateHook<unknown> | EffectHook | MemoHook | RefHook<unknown>;
