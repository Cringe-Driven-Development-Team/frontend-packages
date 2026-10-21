import type { ExternalStoreDependency, Fiber } from "./types/fiber.ts";

export function findStaleExternalStoreConsumers(root: Fiber): Fiber[] {
	const stale: Fiber[] = [];
	const stack = [root];
	while (stack.length > 0) {
		const fiber = stack.pop() as Fiber;
		if (fiber.externalStoreDependencies?.some(didSnapshotChange)) {
			stale.push(fiber);
		}
		if (fiber.sibling) stack.push(fiber.sibling);
		if (fiber.child) stack.push(fiber.child);
	}
	return stale;
}

export function didSnapshotChange<Snapshot>({
	getSnapshot,
	snapshot,
}: ExternalStoreDependency<Snapshot>): boolean {
	try {
		return !Object.is(getSnapshot(), snapshot);
	} catch {
		return true;
	}
}

export function hasUncachedSnapshot(fiber: Fiber): boolean {
	return (
		fiber.externalStoreDependencies?.some(({ getSnapshot }) => {
			try {
				return !Object.is(getSnapshot(), getSnapshot());
			} catch {
				return false;
			}
		}) ?? false
	);
}
