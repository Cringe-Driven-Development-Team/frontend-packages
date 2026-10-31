// Перехватывает DOM-записи элементов, созданных после вызова: property setters, setAttribute, setAttributeNS.
// Адаптация tools/harness/dom-write-recorder.ts курса.

export type DomWrite = {
	kind: "property" | "attribute" | "attributeNS";
	node: Element;
	name: string;
	value: unknown;
};

export function recordDomWrites(document: Document): {
	writes: DomWrite[];
	restore(): void;
} {
	const writes: DomWrite[] = [];
	const restorers: (() => void)[] = [];
	const observed = new WeakSet<Element>();
	const replace = (target: object, name: string, descriptor: PropertyDescriptor): void => {
		const previous = Object.getOwnPropertyDescriptor(target, name);
		Object.defineProperty(target, name, { configurable: true, ...descriptor });
		restorers.push(() => {
			if (previous) {
				Object.defineProperty(target, name, previous);
			} else {
				Reflect.deleteProperty(target, name);
			}
		});
	};
	const observe = (node: Element): Element => {
		if (observed.has(node)) {
			return node;
		}
		observed.add(node);
		for (const name of ["setAttribute", "setAttributeNS"] as const) {
			const original = node[name];
			replace(node, name, {
				value: function (this: Element, ...args: unknown[]): unknown {
					const namespace = name === "setAttributeNS";
					writes.push({
						kind: namespace ? "attributeNS" : "attribute",
						node,
						name: args[namespace ? 1 : 0] as string,
						value: args[namespace ? 2 : 1],
					});
					return Reflect.apply(original, this, args);
				},
			});
		}
		for (const name of [
			"innerHTML",
			"outerHTML",
			"srcdoc",
			"href",
			"src",
			"action",
			"formAction",
		]) {
			const descriptor = findDescriptor(node, name);
			if (!descriptor?.set) {
				continue;
			}
			const setter = descriptor.set;
			replace(node, name, {
				get: descriptor.get,
				set: function (this: Element, value: unknown): void {
					writes.push({ kind: "property", node, name, value });
					setter.call(this, value);
				},
			});
		}
		return node;
	};
	for (const name of ["createElement", "createElementNS"] as const) {
		const original = document[name];
		replace(document, name, {
			value: function (this: Document, ...args: unknown[]): Element {
				return observe(Reflect.apply(original, this, args) as Element);
			},
		});
	}
	return {
		writes,
		restore(): void {
			for (const restore of restorers.reverse()) {
				restore();
			}
			restorers.length = 0;
		},
	};
}

function findDescriptor(target: object, name: string): PropertyDescriptor | undefined {
	let current: object | null = target;
	while (current) {
		const descriptor = Object.getOwnPropertyDescriptor(current, name);
		if (descriptor) {
			return descriptor;
		}
		current = Object.getPrototypeOf(current) as object | null;
	}
	return undefined;
}
