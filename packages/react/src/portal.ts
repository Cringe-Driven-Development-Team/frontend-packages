import { toChildren } from "./children.ts";
import { REACT_ELEMENT_TYPE, REACT_PORTAL_TYPE } from "./symbols.ts";
import type { Key, PortalContainer, PortalElement, ReactNode } from "./types/element.ts";

export function createPortal(
	children: ReactNode,
	container: PortalContainer,
	key?: Key | null,
): PortalElement {
	return {
		$$typeof: REACT_ELEMENT_TYPE,
		type: REACT_PORTAL_TYPE,
		key: key ?? null,
		props: {
			container,
			children: toChildren(Array.isArray(children) ? children : [children]),
		},
	};
}

export function isPortalElement(value: unknown): value is PortalElement {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { $$typeof?: unknown }).$$typeof === REACT_ELEMENT_TYPE &&
		(value as { type?: unknown }).type === REACT_PORTAL_TYPE
	);
}
