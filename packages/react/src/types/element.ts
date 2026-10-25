import type {
	REACT_ELEMENT_TYPE,
	REACT_FRAGMENT_TYPE,
	REACT_PORTAL_TYPE,
	REACT_ROOT_TYPE,
	REACT_TEXT_TYPE,
} from "../symbols.ts";
import type { FunctionComponent, MemoComponent } from "./component.ts";
import type { ElementProps } from "./props.ts";
import type { Context } from "./context.ts";

export type Tag = keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap;

export type Key = string | number;
export type PortalContainer = Element | DocumentFragment;

export type ReactElementType =
	| Tag
	| FunctionComponent
	| MemoComponent
	| Context<unknown>
	| typeof REACT_ROOT_TYPE
	| typeof REACT_FRAGMENT_TYPE
	| typeof REACT_TEXT_TYPE
	| typeof REACT_PORTAL_TYPE;

export interface ReactElement<Props extends ElementProps = ElementProps> {
	$$typeof: typeof REACT_ELEMENT_TYPE;
	type: ReactElementType;
	key: Key | null;
	props: Props & {
		children: ReactElement[];
	};
}

export interface PortalProps extends ElementProps {
	container: PortalContainer;
	children: ReactElement[];
}

export interface PortalElement extends ReactElement<PortalProps> {
	type: typeof REACT_PORTAL_TYPE;
	props: PortalProps;
}

export type ReactText = string | number;
export type RenderableChild = ReactElement | PortalElement | ReactText;
export type ReactNode = RenderableChild | ReactNode[] | boolean | null | undefined;
