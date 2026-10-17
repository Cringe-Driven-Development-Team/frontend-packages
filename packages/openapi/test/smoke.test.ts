import { describe, expect, test } from "bun:test";
import createClient from "../src/index.ts";
import { GenerateError, generate } from "../src/generator.ts";

const spec = {
	openapi: "3.1.0",
	info: { title: "Ping", version: "1.0.0" },
	paths: {
		"/ping": {
			get: {
				operationId: "ping",
				responses: {
					"200": {
						description: "ok",
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["pong"],
									properties: { pong: { type: "boolean" } },
								},
							},
						},
					},
				},
			},
		},
	},
};

describe("generator", () => {
	test("генерирует типы с путём и схемой ответа", () => {
		const output = generate(spec);

		expect(output).toContain("export interface paths");
		expect(output).toContain('"/ping"');
		expect(output).toContain("pong: boolean");
	});

	test("падает с GenerateError на невалидной спецификации", () => {
		expect(() => generate({ openapi: "2.0" })).toThrow(GenerateError);
	});
});

describe("createClient", () => {
	test("возвращает data для 2xx и error для остальных", async () => {
		const respond = (status: number, body: unknown) => async () =>
			new Response(JSON.stringify(body), { status });
		const ok = createClient({ baseUrl: "http://api.test/", fetch: respond(200, { pong: true }) });
		const fail = createClient({
			baseUrl: "http://api.test",
			fetch: respond(500, { code: "boom" }),
		});

		const success = await ok.GET("/ping" as never);
		const failure = await fail.GET("/ping" as never);

		expect(success.data).toEqual({ pong: true });
		expect(failure.error).toEqual({ code: "boom" });
		expect(failure.response.status).toBe(500);
	});
});
