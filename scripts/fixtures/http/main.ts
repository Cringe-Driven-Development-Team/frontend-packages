import { createClient, type Transport } from "@cdd-team/http-client";
import { serializeJsonForHtml } from "@cdd-team/serialize-javascript";

type Paths = {
	"/items/{id}": {
		GET: {
			params: { path: { id: number } };
			responses: { 200: { id: number } };
		};
	};
	"/items": {
		POST: {
			body: { "application/json": { name: string } };
			responses: { 201: { id: number } };
		};
		PUT: {
			body?: { "application/json": { name: string } };
			responses: { 204: undefined };
		};
	};
};

const transport: Transport = (path, init) => fetch(`/api${path}`, init);
const client = createClient<Paths>({ transport });

const item = await client.request("GET", "/items/{id}", { params: { path: { id: 1 } } });
await client.request("POST", "/items", { contentType: "application/json", body: { name: "a" } });
// @ts-expect-error тело не по карте: декларации из архива должны сохранить типы операций
await client.request("POST", "/items", { contentType: "application/json", body: { name: 1 } });
await client.request("PUT", "/items", { contentType: "application/json", body: { name: "a" } });
await client.request("PUT", "/items");
// @ts-expect-error у GET с обязательными path-параметрами options не опускается
await client.request("GET", "/items/{id}");

document.body.textContent = serializeJsonForHtml({ html: "</script>", status: item.status });
