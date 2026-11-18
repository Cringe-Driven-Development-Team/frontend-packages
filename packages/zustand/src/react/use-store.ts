import { useSyncExternalStoreWithSelector } from "@cdd-team/react";
import type { StoreApi } from "../vanilla/index.ts";

const identity = <T>(value: T): T => value;

export function useStore<T>(api: StoreApi<T>): T;
export function useStore<T, U>(api: StoreApi<T>, selector: (state: T) => U): U;
export function useStore<T, U>(
	api: StoreApi<T>,
	selector: (state: T) => U = identity as unknown as (state: T) => U,
): U {
	return useSyncExternalStoreWithSelector(api.subscribe, api.getState, selector);
}
