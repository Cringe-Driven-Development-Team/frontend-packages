import type { Fiber } from "./types/fiber.ts";

export function findStaleExternalStoreConsumers(root: Fiber): Fiber[] {
	const stale: Fiber[] = [];
	const stack = [root];
	while (stack.length > 0) {
		const fiber = stack.pop() as Fiber;
		if (
			fiber.externalStoreDependencies?.some(
				({ getSnapshot, snapshot }) => !Object.is(getSnapshot(), snapshot),
			)
		) {
			stale.push(fiber);
		}
		if (fiber.sibling) stack.push(fiber.sibling);
		if (fiber.child) stack.push(fiber.child);
	}
	return stale;
}

// Как React определяет «getSnapshot should be cached»: два вызова подряд дают разные значения
export function hasUncachedSnapshot(fiber: Fiber): boolean {
	return (
		fiber.externalStoreDependencies?.some(
			({ getSnapshot }) => !Object.is(getSnapshot(), getSnapshot()),
		) ?? false
	);
}
