import { REACT_FRAGMENT_TYPE, REACT_TEXT_TYPE } from "./symbols.ts";
import type { ReactElement } from "./types/element.ts";
import { FiberFlags, FiberTag, type Fiber, type FiberTag as FiberTagType } from "./types/fiber.ts";
import { isContext } from "./context.ts";
import { isMemoComponent } from "./memo.ts";

type FiberElementInput = Pick<Fiber, "type" | "key" | "props">;

export function createFiberFromElement(
	element: ReactElement,
	parent: Fiber,
	index: number,
	flags: FiberFlags,
): Fiber {
	const tag = getFiberTag(element);

	return {
		tag,
		type: element.type,
		key: element.key,
		props: element.props,
		dom: null,
		index,
		parent,
		child: null,
		sibling: null,
		alternate: null,
		deletions: null,
		flags: flags | getRefFlagForNewFiber(tag, element),
		subtreeFlags: FiberFlags.NO_FLAGS,
		dirty: true,
		hasDirtySubtree: false,
		hasContextUpdate: false,
	};
}

export function createWorkInProgressFiber(
	current: Fiber,
	element: FiberElementInput,
	parent: Fiber,
	index: number,
	flags: FiberFlags = FiberFlags.NO_FLAGS,
): Fiber {
	const workInProgress = current.alternate ?? { ...current };

	workInProgress.tag = current.tag;
	workInProgress.type = element.type;
	workInProgress.key = element.key;
	workInProgress.props = element.props;
	workInProgress.dom = current.dom;
	workInProgress.index = index;
	workInProgress.parent = parent;
	workInProgress.child = null;
	workInProgress.sibling = null;
	workInProgress.alternate = current;
	workInProgress.deletions = null;
	workInProgress.flags = flags | getRefFlagForWorkInProgress(current, element);
	workInProgress.subtreeFlags = 0;
	workInProgress.hooks = current.hooks;
	workInProgress.contextDependencies = canReadContext(workInProgress.tag)
		? current.contextDependencies
		: undefined;
	workInProgress.dirty = current.dirty;
	workInProgress.hasDirtySubtree = current.hasDirtySubtree;
	workInProgress.hasContextUpdate = current.hasContextUpdate;

	delete workInProgress.didBailout;

	current.alternate = workInProgress;

	return workInProgress;
}

function getFiberTag(element: ReactElement): Fiber["tag"] {
	if (typeof element.type === "function") {
		return FiberTag.FUNCTION_COMPONENT;
	}

	if (isMemoComponent(element.type)) {
		return FiberTag.MEMO_COMPONENT;
	}

	if (isContext(element.type)) {
		return FiberTag.CONTEXT_PROVIDER;
	}

	if (element.type === REACT_FRAGMENT_TYPE) {
		return FiberTag.FRAGMENT;
	}

	if (element.type === REACT_TEXT_TYPE) {
		return FiberTag.TEXT;
	}

	return FiberTag.HOST;
}

function getRefFlagForNewFiber(tag: FiberTagType, element: FiberElementInput): FiberFlags {
	return canHaveRef(tag) && getRawRef(element) != null ? FiberFlags.REF : FiberFlags.NO_FLAGS;
}

function getRefFlagForWorkInProgress(current: Fiber, element: FiberElementInput): FiberFlags {
	if (!canHaveRef(current.tag)) {
		return FiberFlags.NO_FLAGS;
	}

	return getRawRef(current) !== getRawRef(element) ? FiberFlags.REF : FiberFlags.NO_FLAGS;
}

function canHaveRef(tag: FiberTagType): boolean {
	return tag === FiberTag.HOST;
}

function canReadContext(tag: FiberTagType): boolean {
	return tag === FiberTag.FUNCTION_COMPONENT || tag === FiberTag.MEMO_COMPONENT;
}

function getRawRef(element: FiberElementInput): unknown {
	return element.props.ref;
}
