import { useSyncExternalStore } from "@cdd-team/react";

type State = { count: number };
type Listener = () => void;

type Store = {
	getState: () => State;
	setState: (updater: (state: State) => State) => void;
	subscribe: (listener: Listener) => () => void;
};

export function createStore(initial: State): Store {
	let state = initial;
	const listeners = new Set<Listener>();
	return {
		getState: () => state,
		setState(updater) {
			const next = updater(state);
			if (Object.is(next, state)) return;
			state = next;
			listeners.forEach(listener => listener());
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
	};
}

export function useStore<Selected>(store: Store, selector: (state: State) => Selected): Selected {
	return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export const counterStore = createStore({ count: 0 });
