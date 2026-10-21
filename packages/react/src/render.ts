import type { ReactElement } from "./types/element.ts";
import type { FiberRoot } from "./types/fiber.ts";
import { configureWorkLoop, scheduleWork, unscheduleWork } from "./scheduler.ts";
import {
	commitRoot as commitRendererRoot,
	createFiberRoot,
	createRenderRoot,
	createUpdateRoot,
	getPendingCommit,
	resetFiberRoot,
} from "./renderer-state.ts";
import { performUnitOfWork } from "./fiber.ts";
import { commitRoot, commitRootUnmount } from "./commit.ts";
import { setScheduleRender } from "./hooks.ts";
import { flushPassiveEffects } from "./effects.ts";
import { findStaleExternalStoreConsumers, hasUncachedSnapshot } from "./external-store.ts";
import { markFiberDirty } from "./renderer-state.ts";

const STALE_SNAPSHOT_RESTART_LIMIT = 25;

const staleSnapshotRestarts = new WeakMap<FiberRoot, number>();

export interface Root {
	render(element: ReactElement): void;
	unmount(): void;
}

configureWorkLoop({
	performUnitOfWork,
	commitRoot: commitPendingRoot,
});

setScheduleRender(
	(root) => {
		flushPassiveEffects();

		if (createUpdateRoot(root)) {
			scheduleWork(root);
		}
	},
	(root) => {
		if (!createUpdateRoot(root)) {
			return false;
		}

		scheduleWork(root);
		return true;
	},
);

export function createRoot(container: Element): Root {
	const fiberRoot = createFiberRoot(container);

	return {
		render(element: ReactElement): void {
			if (fiberRoot.isUnmounted) {
				throw new Error("Root.render was called on an unmounted root.");
			}

			flushPassiveEffects();
			staleSnapshotRestarts.delete(fiberRoot);
			createRenderRoot(fiberRoot, element);
			scheduleWork(fiberRoot);
		},
		unmount(): void {
			unmountRoot(fiberRoot);
		},
	};
}

function unmountRoot(root: FiberRoot): void {
	if (root.isUnmounted) {
		return;
	}

	unscheduleWork(root);
	staleSnapshotRestarts.delete(root);

	if (root.currentRoot) {
		commitRootUnmount(root.currentRoot);
	}

	resetFiberRoot(root);
}

function commitPendingRoot(root: FiberRoot): void {
	const pendingCommit = getPendingCommit(root);
	if (!pendingCommit) {
		return;
	}
	const staleConsumers = findStaleExternalStoreConsumers(pendingCommit.root);
	if (staleConsumers.length > 0) {
		if (staleConsumers.some(hasUncachedSnapshot)) {
			countStaleSnapshotRestartOrThrow(root);
		}
		staleConsumers.forEach(markFiberDirty);
		const element = pendingCommit.root.props.children[0];
		if (element) {
			createRenderRoot(root, element);
			scheduleWork(root);
		}
		return;
	}

	staleSnapshotRestarts.delete(root);
	commitRoot({
		...pendingCommit,
		onCommitted: (rootFiber) => commitRendererRoot(root, rootFiber),
	});
}

function countStaleSnapshotRestartOrThrow(root: FiberRoot): void {
	const restarts = (staleSnapshotRestarts.get(root) ?? 0) + 1;
	if (restarts > STALE_SNAPSHOT_RESTART_LIMIT) {
		staleSnapshotRestarts.delete(root);
		throw new Error(
			"Render.useSyncExternalStore: getSnapshot returned a new value on every call. Cache the snapshot to avoid an infinite loop.",
		);
	}

	staleSnapshotRestarts.set(root, restarts);
}
