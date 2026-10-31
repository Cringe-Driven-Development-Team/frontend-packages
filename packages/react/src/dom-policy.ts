export function isEventProp(name: string): boolean {
	return name.slice(0, 2).toLowerCase() === "on";
}

export function isBlockedHtmlProp(name: string): boolean {
	const normalizedName = name.toLowerCase();
	return (
		normalizedName === "innerhtml" ||
		normalizedName === "outerhtml" ||
		normalizedName === "srcdoc" ||
		normalizedName === "protocol"
	);
}

export function isUrlProp(name: string): boolean {
	const normalizedName = name.toLowerCase();
	return (
		normalizedName === "href" ||
		normalizedName === "src" ||
		normalizedName === "action" ||
		normalizedName === "formaction" ||
		normalizedName === "xlink:href" ||
		normalizedName === "xlinkhref"
	);
}

export function isUnsafeJavaScriptUrl(value: string): boolean {
	const normalizedValue = value.replace(/[\r\n\t]/g, "");
	let start = 0;
	while (start < normalizedValue.length && normalizedValue.charCodeAt(start) <= 32) {
		start += 1;
	}
	return normalizedValue.slice(start).toLowerCase().startsWith("javascript:");
}
