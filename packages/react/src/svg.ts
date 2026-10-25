export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
export const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

// Источник правды и для рантайма, и для типов SVGAttributes в types/jsx.ts.
export const SVG_ATTRIBUTE_NAMES = {
	alignmentBaseline: "alignment-baseline",
	baselineShift: "baseline-shift",
	clipPath: "clip-path",
	clipRule: "clip-rule",
	colorInterpolation: "color-interpolation",
	colorInterpolationFilters: "color-interpolation-filters",
	colorRendering: "color-rendering",
	dominantBaseline: "dominant-baseline",
	fillOpacity: "fill-opacity",
	fillRule: "fill-rule",
	floodColor: "flood-color",
	floodOpacity: "flood-opacity",
	fontFamily: "font-family",
	fontSize: "font-size",
	fontStyle: "font-style",
	fontWeight: "font-weight",
	imageRendering: "image-rendering",
	letterSpacing: "letter-spacing",
	lightingColor: "lighting-color",
	markerEnd: "marker-end",
	markerMid: "marker-mid",
	markerStart: "marker-start",
	paintOrder: "paint-order",
	pointerEvents: "pointer-events",
	shapeRendering: "shape-rendering",
	stopColor: "stop-color",
	stopOpacity: "stop-opacity",
	strokeDasharray: "stroke-dasharray",
	strokeDashoffset: "stroke-dashoffset",
	strokeLinecap: "stroke-linecap",
	strokeLinejoin: "stroke-linejoin",
	strokeMiterlimit: "stroke-miterlimit",
	strokeOpacity: "stroke-opacity",
	strokeWidth: "stroke-width",
	tabIndex: "tabindex",
	textAnchor: "text-anchor",
	textDecoration: "text-decoration",
	textRendering: "text-rendering",
	transformOrigin: "transform-origin",
	vectorEffect: "vector-effect",
	wordSpacing: "word-spacing",
} as const;

export function getSvgAttributeName(name: string): string {
	return (SVG_ATTRIBUTE_NAMES as Record<string, string>)[name] ?? name;
}
