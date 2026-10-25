import type { Key, ReactElement, ReactNode } from "./element.ts";
import type { Ref } from "./hooks.ts";

export type MouseEvent<T extends globalThis.Element = globalThis.Element> =
	globalThis.MouseEvent & {
		currentTarget: T;
	};

type CSSPropertyName = Exclude<
	{
		[Name in keyof CSSStyleDeclaration]: Name extends string
			? CSSStyleDeclaration[Name] extends string
				? Name
				: never
			: never;
	}[keyof CSSStyleDeclaration],
	"cssText"
>;

export type CSSProperties = { [Name in CSSPropertyName]?: string | number } & {
	[Name: `--${string}`]: string | number;
};

// DOMAttributes (DOM события)
export interface DOMAttributes<_T extends globalThis.Element = globalThis.Element> {
	// Clipboard Events
	onCopy?(event: ClipboardEvent): void;
	onCopyCapture?(event: ClipboardEvent): void;
	onCut?(event: ClipboardEvent): void;
	onCutCapture?(event: ClipboardEvent): void;
	onPaste?(event: ClipboardEvent): void;
	onPasteCapture?(event: ClipboardEvent): void;

	// Composition Events
	onCompositionEnd?(event: CompositionEvent): void;
	onCompositionEndCapture?(event: CompositionEvent): void;
	onCompositionStart?(event: CompositionEvent): void;
	onCompositionStartCapture?(event: CompositionEvent): void;
	onCompositionUpdate?(event: CompositionEvent): void;
	onCompositionUpdateCapture?(event: CompositionEvent): void;

	// Focus Events
	onFocus?(event: FocusEvent): void;
	onFocusCapture?(event: FocusEvent): void;
	onBlur?(event: FocusEvent): void;
	onBlurCapture?(event: FocusEvent): void;

	// Form Events
	onChange?(event: Event): void;
	onChangeCapture?(event: Event): void;
	onBeforeInput?(event: Event): void;
	onBeforeInputCapture?(event: Event): void;
	onInput?(event: Event): void;
	onInputCapture?(event: Event): void;
	onReset?(event: Event): void;
	onResetCapture?(event: Event): void;
	onSubmit?(event: Event): void;
	onSubmitCapture?(event: Event): void;
	onInvalid?(event: Event): void;
	onInvalidCapture?(event: Event): void;

	// Image Events
	onLoad?(event: Event): void;
	onLoadCapture?(event: Event): void;
	onError?(event: Event): void;
	onErrorCapture?(event: Event): void;

	// Keyboard Events
	onKeyDown?(event: KeyboardEvent): void;
	onKeyDownCapture?(event: KeyboardEvent): void;
	onKeyPress?(event: KeyboardEvent): void;
	onKeyPressCapture?(event: KeyboardEvent): void;
	onKeyUp?(event: KeyboardEvent): void;
	onKeyUpCapture?(event: KeyboardEvent): void;

	// Media Events
	onAbort?(event: Event): void;
	onAbortCapture?(event: Event): void;
	onCanPlay?(event: Event): void;
	onCanPlayCapture?(event: Event): void;
	onCanPlayThrough?(event: Event): void;
	onCanPlayThroughCapture?(event: Event): void;
	onDurationChange?(event: Event): void;
	onDurationChangeCapture?(event: Event): void;
	onEmptied?(event: Event): void;
	onEmptiedCapture?(event: Event): void;
	onEncrypted?(event: Event): void;
	onEncryptedCapture?(event: Event): void;
	onEnded?(event: Event): void;
	onEndedCapture?(event: Event): void;
	onLoadedData?(event: Event): void;
	onLoadedDataCapture?(event: Event): void;
	onLoadedMetadata?(event: Event): void;
	onLoadedMetadataCapture?(event: Event): void;
	onLoadStart?(event: Event): void;
	onLoadStartCapture?(event: Event): void;
	onPause?(event: Event): void;
	onPauseCapture?(event: Event): void;
	onPlay?(event: Event): void;
	onPlayCapture?(event: Event): void;
	onPlaying?(event: Event): void;
	onPlayingCapture?(event: Event): void;
	onProgress?(event: Event): void;
	onProgressCapture?(event: Event): void;
	onRateChange?(event: Event): void;
	onRateChangeCapture?(event: Event): void;
	onSeeked?(event: Event): void;
	onSeekedCapture?(event: Event): void;
	onSeeking?(event: Event): void;
	onSeekingCapture?(event: Event): void;
	onStalled?(event: Event): void;
	onStalledCapture?(event: Event): void;
	onSuspend?(event: Event): void;
	onSuspendCapture?(event: Event): void;
	onTimeUpdate?(event: Event): void;
	onTimeUpdateCapture?(event: Event): void;
	onVolumeChange?(event: Event): void;
	onVolumeChangeCapture?(event: Event): void;
	onWaiting?(event: Event): void;
	onWaitingCapture?(event: Event): void;

	// Mouse Events
	onClick?(event: MouseEvent<_T>): void;
	onClickCapture?(event: MouseEvent<_T>): void;
	onContextMenu?(event: MouseEvent<_T>): void;
	onContextMenuCapture?(event: MouseEvent<_T>): void;
	onDoubleClick?(event: MouseEvent<_T>): void;
	onDoubleClickCapture?(event: MouseEvent<_T>): void;
	onDrag?(event: DragEvent): void;
	onDragCapture?(event: DragEvent): void;
	onDragEnd?(event: DragEvent): void;
	onDragEndCapture?(event: DragEvent): void;
	onDragEnter?(event: DragEvent): void;
	onDragEnterCapture?(event: DragEvent): void;
	onDragExit?(event: DragEvent): void;
	onDragExitCapture?(event: DragEvent): void;
	onDragLeave?(event: DragEvent): void;
	onDragLeaveCapture?(event: DragEvent): void;
	onDragOver?(event: DragEvent): void;
	onDragOverCapture?(event: DragEvent): void;
	onDragStart?(event: DragEvent): void;
	onDragStartCapture?(event: DragEvent): void;
	onDrop?(event: DragEvent): void;
	onDropCapture?(event: DragEvent): void;
	onMouseDown?(event: MouseEvent<_T>): void;
	onMouseDownCapture?(event: MouseEvent<_T>): void;
	onMouseEnter?(event: MouseEvent<_T>): void;
	onMouseLeave?(event: MouseEvent<_T>): void;
	onMouseMove?(event: MouseEvent<_T>): void;
	onMouseMoveCapture?(event: MouseEvent<_T>): void;
	onMouseOut?(event: MouseEvent<_T>): void;
	onMouseOutCapture?(event: MouseEvent<_T>): void;
	onMouseOver?(event: MouseEvent<_T>): void;
	onMouseOverCapture?(event: MouseEvent<_T>): void;
	onMouseUp?(event: MouseEvent<_T>): void;
	onMouseUpCapture?(event: MouseEvent<_T>): void;

	// Selection Events
	onSelect?(event: Event): void;
	onSelectCapture?(event: Event): void;

	// Touch Events
	onTouchCancel?(event: TouchEvent): void;
	onTouchCancelCapture?(event: TouchEvent): void;
	onTouchEnd?(event: TouchEvent): void;
	onTouchEndCapture?(event: TouchEvent): void;
	onTouchMove?(event: TouchEvent): void;
	onTouchMoveCapture?(event: TouchEvent): void;
	onTouchStart?(event: TouchEvent): void;
	onTouchStartCapture?(event: TouchEvent): void;

	// Pointer Events
	onPointerDown?(event: PointerEvent): void;
	onPointerDownCapture?(event: PointerEvent): void;
	onPointerMove?(event: PointerEvent): void;
	onPointerMoveCapture?(event: PointerEvent): void;
	onPointerUp?(event: PointerEvent): void;
	onPointerUpCapture?(event: PointerEvent): void;
	onPointerCancel?(event: PointerEvent): void;
	onPointerCancelCapture?(event: PointerEvent): void;
	onPointerEnter?(event: PointerEvent): void;
	onPointerLeave?(event: PointerEvent): void;
	onPointerOver?(event: PointerEvent): void;
	onPointerOverCapture?(event: PointerEvent): void;
	onPointerOut?(event: PointerEvent): void;
	onPointerOutCapture?(event: PointerEvent): void;

	// UI Events
	onScroll?(event: UIEvent): void;
	onScrollCapture?(event: UIEvent): void;

	// Wheel Events
	onWheel?(event: WheelEvent): void;
	onWheelCapture?(event: WheelEvent): void;

	// Animation Events
	onAnimationStart?(event: AnimationEvent): void;
	onAnimationStartCapture?(event: AnimationEvent): void;
	onAnimationEnd?(event: AnimationEvent): void;
	onAnimationEndCapture?(event: AnimationEvent): void;
	onAnimationIteration?(event: AnimationEvent): void;
	onAnimationIterationCapture?(event: AnimationEvent): void;

	// Transition Events
	onTransitionEnd?(event: TransitionEvent): void;
	onTransitionEndCapture?(event: TransitionEvent): void;

	children?: ReactNode;
}

// AriaAttributes (ARIA атрибуты для доступности)
export interface AriaAttributes {
	// ARIA Live Regions
	"aria-atomic"?: boolean | "false" | "true";
	"aria-busy"?: boolean | "false" | "true";
	"aria-live"?: "off" | "polite" | "assertive";
	"aria-relevant"?: "additions" | "additions text" | "all" | "removals" | "text";

	// ARIA Relationship
	"aria-activedescendant"?: string;
	"aria-colcount"?: number;
	"aria-colindex"?: number;
	"aria-colspan"?: number;
	"aria-controls"?: string;
	"aria-describedby"?: string;
	"aria-details"?: string;
	"aria-errormessage"?: string;
	"aria-flowto"?: string;
	"aria-labelledby"?: string;
	"aria-owns"?: string;
	"aria-posinset"?: number;
	"aria-rowcount"?: number;
	"aria-rowindex"?: number;
	"aria-rowspan"?: number;

	// ARIA Widget
	"aria-autocomplete"?: "none" | "inline" | "list" | "both";
	"aria-checked"?: boolean | "false" | "mixed" | "true";
	"aria-disabled"?: boolean | "false" | "true";
	"aria-expanded"?: boolean | "false" | "true";
	"aria-haspopup"?: boolean | "false" | "true" | "menu" | "listbox" | "tree" | "grid" | "dialog";
	"aria-hidden"?: boolean | "false" | "true";
	"aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
	"aria-label"?: string;
	"aria-level"?: number;
	"aria-modal"?: boolean | "false" | "true";
	"aria-multiline"?: boolean | "false" | "true";
	"aria-multiselectable"?: boolean | "false" | "true";
	"aria-orientation"?: "horizontal" | "vertical";
	"aria-placeholder"?: string;
	"aria-pressed"?: boolean | "false" | "mixed" | "true";
	"aria-readonly"?: boolean | "false" | "true";
	"aria-required"?: boolean | "false" | "true";
	"aria-selected"?: boolean | "false" | "true";
	"aria-sort"?: "ascending" | "descending" | "none" | "other";

	// ARIA Drag and Drop
	"aria-dropeffect"?: "copy" | "execute" | "link" | "move" | "none" | "popup";
	"aria-grabbed"?: boolean | "false" | "true";

	// ARIA Range
	"aria-valuemax"?: number;
	"aria-valuemin"?: number;
	"aria-valuenow"?: number;
	"aria-valuetext"?: string;

	// ARIA Role
	role?: string;

	// ARIA Current
	"aria-current"?: boolean | "false" | "true" | "page" | "step" | "location" | "date" | "time";

	// ARIA Description
	"aria-description"?: string;

	// ARIA Keyshortcuts
	"aria-keyshortcuts"?: string;

	// ARIA Roledescription
	"aria-roledescription"?: string;

	// ARIA Braille
	"aria-braillelabel"?: string;
	"aria-brailleroledescription"?: string;
}

export interface Attributes {
	key?: Key | null;
}

// Базовые элементы, общие для большинства элементов
export interface BaseHTMLAttributes<ElementType extends globalThis.Element = globalThis.HTMLElement>
	extends Attributes, DOMAttributes<ElementType>, AriaAttributes {
	class?: string;
	className?: string;
	style?: CSSProperties;
	id?: string;
	title?: string;
	lang?: string;
	tabIndex?: number;
	ref?: Ref<ElementType>;

	// Data attributes
	[key: `data-${string}`]: any;
}

type IntrinsicHTMLAttributes<Tag extends keyof HTMLElementTagNameMap> = BaseHTMLAttributes<
	HTMLElementTagNameMap[Tag]
>;

export type AnchorHTMLAttributes<ElementType extends HTMLAnchorElement = HTMLAnchorElement> =
	BaseHTMLAttributes<ElementType> & {
		href?: string;
		target?: string;
		rel?: string;
		download?: boolean | string;
	};

// SVGAttributes — атрибуты и события элемента, SVGProps добавляет key и ref.
export interface SVGAttributes<ElementType extends SVGElement = SVGElement>
	extends DOMAttributes<ElementType>, AriaAttributes {
	class?: string;
	className?: string;
	style?: CSSProperties;
	id?: string;
	tabIndex?: number;
	children?: ReactNode;

	[key: `data-${string}`]: any;

	clipPath?: string;
	cx?: string | number;
	cy?: string | number;
	d?: string;
	fill?: string;
	fillOpacity?: string | number;
	fillRule?: "nonzero" | "evenodd" | "inherit";
	focusable?: boolean | "auto" | "true" | "false";
	height?: string | number;
	href?: string;
	imageRendering?: string;
	opacity?: string | number;
	pointerEvents?: string;
	points?: string;
	r?: string | number;
	rx?: string | number;
	ry?: string | number;
	shapeRendering?: string;
	stroke?: string;
	strokeDasharray?: string | number;
	strokeDashoffset?: string | number;
	strokeLinecap?: "butt" | "round" | "square" | "inherit";
	strokeLinejoin?: "miter" | "round" | "bevel" | "inherit";
	strokeMiterlimit?: string | number;
	strokeOpacity?: string | number;
	strokeWidth?: string | number;
	textRendering?: string;
	transform?: string;
	vectorEffect?: string;
	viewBox?: string;
	width?: string | number;
	x?: string | number;
	x1?: string | number;
	x2?: string | number;
	xlinkHref?: string;
	xmlns?: string;
	y?: string | number;
	y1?: string | number;
	y2?: string | number;
}

export interface SVGProps<ElementType extends SVGElement = SVGElement>
	extends SVGAttributes<ElementType>, Attributes {
	ref?: Ref<ElementType>;
}

// ValueType - тип для значений input
type ValueType = string | number | string[] | boolean | Date | File | FileList | null | undefined;

export namespace JSX {
	export type Element = ReactElement;
	export type ElementType = keyof IntrinsicElements | ((props: any) => ReactElement | null);

	export interface IntrinsicElements {
		// Core Elements
		div: IntrinsicHTMLAttributes<"div">;
		span: IntrinsicHTMLAttributes<"span">;
		p: IntrinsicHTMLAttributes<"p">;
		i: IntrinsicHTMLAttributes<"i">;
		b: IntrinsicHTMLAttributes<"b">;
		strong: IntrinsicHTMLAttributes<"strong">;
		em: IntrinsicHTMLAttributes<"em">;
		small: IntrinsicHTMLAttributes<"small">;
		sub: IntrinsicHTMLAttributes<"sub">;
		sup: IntrinsicHTMLAttributes<"sup">;
		br: IntrinsicHTMLAttributes<"br">;
		hr: IntrinsicHTMLAttributes<"hr">;

		// Headings
		h1: IntrinsicHTMLAttributes<"h1">;
		h2: IntrinsicHTMLAttributes<"h2">;
		h3: IntrinsicHTMLAttributes<"h3">;
		h4: IntrinsicHTMLAttributes<"h4">;
		h5: IntrinsicHTMLAttributes<"h5">;
		h6: IntrinsicHTMLAttributes<"h6">;

		// Links and Media
		a: AnchorHTMLAttributes;
		img: IntrinsicHTMLAttributes<"img"> & {
			src?: string;
			alt?: string;
			width?: string | number;
			height?: string | number;
			loading?: "eager" | "lazy";
		};

		video: IntrinsicHTMLAttributes<"video"> & {
			src?: string;
			width?: string | number;
			height?: string | number;
			autoplay?: boolean;
			loop?: boolean;
			muted?: boolean;
			playsInline?: boolean;
			controls?: boolean;
			poster?: string;
		};

		// Lists
		ul: IntrinsicHTMLAttributes<"ul">;
		ol: IntrinsicHTMLAttributes<"ol"> & {
			start?: number;
			type?: "1" | "a" | "A" | "i" | "I";
			reversed?: boolean;
		};
		li: IntrinsicHTMLAttributes<"li"> & {
			value?: number;
		};
		dl: IntrinsicHTMLAttributes<"dl">;
		dt: IntrinsicHTMLAttributes<"dt">;
		dd: IntrinsicHTMLAttributes<"dd">;

		// Forms
		form: IntrinsicHTMLAttributes<"form"> & {
			action?: string;
			method?: "GET" | "POST";
			encType?: string;
			target?: string;
			noValidate?: boolean;
		};

		input: IntrinsicHTMLAttributes<"input"> & {
			type?: string;
			value?: ValueType;
			checked?: boolean;
			placeholder?: string;
			disabled?: boolean;
			name?: string;
			required?: boolean;
			readOnly?: boolean;
			min?: string | number;
			max?: string | number;
			step?: string | number;
			multiple?: boolean;
			pattern?: string;
			accept?: string;
		};
		button: IntrinsicHTMLAttributes<"button"> & {
			type?: "button" | "submit" | "reset";
			disabled?: boolean;
			name?: string;
			value?: string;
		};
		label: IntrinsicHTMLAttributes<"label"> & {
			htmlFor?: string;
		};
		textarea: IntrinsicHTMLAttributes<"textarea"> & {
			value?: string | number | readonly string[];
			placeholder?: string;
			disabled?: boolean;
			name?: string;
			required?: boolean;
			readOnly?: boolean;
			rows?: number;
			cols?: number;
			wrap?: "hard" | "soft" | "off";
		};
		select: IntrinsicHTMLAttributes<"select"> & {
			value?: string | number | readonly string[];
			disabled?: boolean;
			name?: string;
			required?: boolean;
			multiple?: boolean;
			size?: number;
		};
		option: IntrinsicHTMLAttributes<"option"> & {
			value?: string | number;
			disabled?: boolean;
			selected?: boolean;
			label?: string;
		};
		optgroup: IntrinsicHTMLAttributes<"optgroup"> & {
			label?: string;
			disabled?: boolean;
		};
		fieldset: IntrinsicHTMLAttributes<"fieldset"> & {
			disabled?: boolean;
			name?: string;
		};
		legend: IntrinsicHTMLAttributes<"legend">;

		// Tables
		table: IntrinsicHTMLAttributes<"table">;
		caption: IntrinsicHTMLAttributes<"caption">;
		thead: IntrinsicHTMLAttributes<"thead">;
		tbody: IntrinsicHTMLAttributes<"tbody">;
		tfoot: IntrinsicHTMLAttributes<"tfoot">;
		tr: IntrinsicHTMLAttributes<"tr">;
		th: IntrinsicHTMLAttributes<"th"> & {
			scope?: "col" | "row" | "colgroup" | "rowgroup";
			colSpan?: number;
			rowSpan?: number;
		};
		td: IntrinsicHTMLAttributes<"td"> & {
			colSpan?: number;
			rowSpan?: number;
		};
		colgroup: IntrinsicHTMLAttributes<"colgroup">;
		col: IntrinsicHTMLAttributes<"col"> & {
			span?: number;
		};

		// Semantic/Layout Elements
		header: IntrinsicHTMLAttributes<"header">;
		footer: IntrinsicHTMLAttributes<"footer">;
		main: IntrinsicHTMLAttributes<"main">;
		nav: IntrinsicHTMLAttributes<"nav">;
		section: IntrinsicHTMLAttributes<"section">;
		article: IntrinsicHTMLAttributes<"article">;
		aside: IntrinsicHTMLAttributes<"aside">;
		address: IntrinsicHTMLAttributes<"address">;
		figure: IntrinsicHTMLAttributes<"figure">;
		figcaption: IntrinsicHTMLAttributes<"figcaption">;

		// Details & Dialog
		details: IntrinsicHTMLAttributes<"details"> & {
			open?: boolean;
		};
		summary: IntrinsicHTMLAttributes<"summary">;
		dialog: IntrinsicHTMLAttributes<"dialog"> & {
			open?: boolean;
		};

		// Other
		blockquote: IntrinsicHTMLAttributes<"blockquote"> & {
			cite?: string;
		};
		pre: IntrinsicHTMLAttributes<"pre">;
		code: IntrinsicHTMLAttributes<"code">;

		// SVG
		svg: SVGProps<SVGSVGElement>;
		g: SVGProps<SVGGElement>;
		path: SVGProps<SVGPathElement>;
		circle: SVGProps<SVGCircleElement>;
		rect: SVGProps<SVGRectElement>;
		line: SVGProps<SVGLineElement>;
		polyline: SVGProps<SVGPolylineElement>;
		polygon: SVGProps<SVGPolygonElement>;
		ellipse: SVGProps<SVGEllipseElement>;
		text: SVGProps<SVGTextElement>;
		tspan: SVGProps<SVGTSpanElement>;
		defs: SVGProps<SVGDefsElement>;
		linearGradient: SVGProps<SVGLinearGradientElement>;
		radialGradient: SVGProps<SVGRadialGradientElement>;
		stop: SVGProps<SVGStopElement>;
		clipPath: SVGProps<SVGClipPathElement>;
		mask: SVGProps<SVGMaskElement>;
		use: SVGProps<SVGUseElement>;
		foreignObject: SVGProps<SVGForeignObjectElement>;
		symbol: SVGProps<SVGSymbolElement>;
	}

	export interface ElementAttributesProperty {
		props: {};
	}

	export interface ElementChildrenAttribute {
		children: {};
	}

	export interface IntrinsicAttributes extends Attributes {}

	export type LibraryManagedAttributes<_Component, Props> = Props extends {
		children?: infer Children;
	}
		? ReactElement[] extends Children
			? Omit<Props, "children"> & { children?: ReactNode }
			: Omit<Props, "children"> & { children?: never }
		: Props;
}
