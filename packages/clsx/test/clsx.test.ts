import { describe, expect, test } from "bun:test";
import { clsx } from "../src/index.ts";

describe("clsx", () => {
	test("склеивает строки через пробел", () => {
		expect(clsx("button", "button--primary")).toBe("button button--primary");
	});

	test("пропускает ложные значения и true", () => {
		expect(clsx("a", false, null, undefined, "", 0, true, "b")).toBe("a b");
	});

	test("числа и bigint превращаются в строку", () => {
		expect(clsx(1, 2n)).toBe("1 2");
	});

	test("объект даёт ключи с истинными значениями", () => {
		expect(clsx({ active: true, disabled: false, hidden: 0, visible: "yes" })).toBe(
			"active visible",
		);
	});

	test("разворачивает вложенные массивы", () => {
		expect(clsx(["a", ["b", { c: true }], [false, null]], "d")).toBe("a b c d");
	});

	test("без аргументов и из одних ложных значений — пустая строка", () => {
		expect(clsx()).toBe("");
		expect(clsx(false, [], {}, [[null]])).toBe("");
	});
});
