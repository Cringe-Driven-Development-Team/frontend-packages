import { describe, expect, test } from "bun:test";
import {
	comparePatterns,
	interpolatePath,
	matchPath,
	normalizePath,
	parseSearch,
	resolvePath,
	stringifySearch,
} from "../src/path.ts";

describe("matchPath", () => {
	test("достаёт параметры и не учитывает регистр статичных сегментов", () => {
		expect(matchPath("/users/$userId", "/Users/42")).toEqual({ userId: "42" });
	});

	test("сплат забирает остаток пути", () => {
		expect(matchPath("/files/$", "/files/a/b%20c")).toEqual({ _splat: "a/b c" });
	});

	test("лишний или недостающий сегмент не подходит", () => {
		expect(matchPath("/users/$userId", "/users")).toBeUndefined();
		expect(matchPath("/users/$userId", "/users/1/edit")).toBeUndefined();
	});
});

describe("interpolatePath", () => {
	test("кодирует слэш в обычном параметре и сохраняет его в сплате", () => {
		expect(interpolatePath("/users/$id", { id: "a/b" })).toBe("/users/a%2Fb");
		expect(interpolatePath("/files/$", { _splat: "a/b c" })).toBe("/files/a/b%20c");
	});

	test("без нужного параметра бросает ошибку", () => {
		expect(() => interpolatePath("/users/$id", {})).toThrow('Не передан параметр "id"');
	});
});

test("resolvePath понимает абсолютные пути, . и ..", () => {
	expect(resolvePath("/a/b", "/c")).toBe("/c");
	expect(resolvePath("/a/b", "..")).toBe("/a");
	expect(resolvePath("/a/b", "./c")).toBe("/a/b/c");
	expect(resolvePath("/a/b", "../../..")).toBe("/");
});

test("normalizePath приводит кодирование и слэши к единому виду", () => {
	expect(normalizePath("/a//b@c/")).toBe("/a/b%40c");
});

test("comparePatterns: статичный сегмент важнее параметра, параметр важнее сплата", () => {
	const patterns = ["/users/$", "/users/$id", "/users/new"];
	expect(patterns.sort(comparePatterns)).toEqual(["/users/new", "/users/$id", "/users/$"]);
});

describe("search-параметры", () => {
	test("значения читаются как JSON, повторяющийся ключ даёт массив", () => {
		expect(parseSearch("?page=2&draft=true&tag=a&tag=b&q=text")).toEqual({
			page: 2,
			draft: true,
			tag: ["a", "b"],
			q: "text",
		});
	});

	test("типы значений переживают запись в адрес и разбор", () => {
		const search = { page: 2, q: "42", filter: { done: false } };
		expect(parseSearch(stringifySearch(search))).toEqual(search);
	});

	test("ключ __proto__ не попадает в прототип", () => {
		const search = parseSearch("?__proto__=1");
		expect(Object.getPrototypeOf(search)).toBe(Object.prototype);
	});

	test("пустой search — пустая строка", () => {
		expect(stringifySearch({ skipped: undefined })).toBe("");
	});
});
