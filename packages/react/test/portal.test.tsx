import { describe, expect, test } from "bun:test";
import { createPortal } from "../src/index.ts";

describe("createPortal", () => {
	test("создаёт элемент портала с контейнером и нормализованными детьми", () => {
		const target = document.createElement("div");
		const portal = createPortal(["a", <b key="b" />, null], target, "k");

		expect(portal.$$typeof as symbol).toBe(Symbol.for("react.element"));
		expect(portal.type as symbol).toBe(Symbol.for("react.portal"));
		expect(portal.key).toBe("k");
		expect(portal.props.container).toBe(target);
		expect(portal.props.children).toHaveLength(2);
	});

	test("key по умолчанию — null", () => {
		expect(createPortal(<b />, document.createElement("div")).key).toBeNull();
	});
});
