import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const whoAmI = defineTool({
	name: "who_am_i",
	schema: z.object({}),
	handler: (input, ctx) => ({ tenant: ctx.tenantId }),
});

async function withServer(run: (baseUrl: URL) => Promise<void>) {
	const catalog = createToolCatalog({ tools: [whoAmI] });
	const handle = catalog.http((req) => ({
		tenantId: req.headers.get("x-tenant-id") ?? "unknown",
		jwt: req.headers.get("authorization") ?? "",
	}));

	const server = Bun.serve({ port: 0, fetch: handle });
	try {
		await run(new URL(`http://localhost:${server.port}/mcp`));
	} finally {
		server.stop(true);
	}
}

describe("catalog.http()", () => {
	test("resolves tenant per request from headers", async () => {
		await withServer(async (baseUrl) => {
			const transport = new StreamableHTTPClientTransport(baseUrl, {
				requestInit: { headers: { "x-tenant-id": "acme" } },
			});
			const client = new Client({ name: "test", version: "0.1.0" });
			await client.connect(transport);

			const result = await client.callTool({ name: "who_am_i", arguments: {} });
			const content = result.content as Array<{ type: string; text: string }>;
			expect(JSON.parse(content[0].text)).toEqual({ tenant: "acme" });

			await client.close();
		});
	});

	test("two concurrent tenants never see each other's context", async () => {
		await withServer(async (baseUrl) => {
			async function callAs(tenantId: string) {
				const transport = new StreamableHTTPClientTransport(baseUrl, {
					requestInit: { headers: { "x-tenant-id": tenantId } },
				});
				const client = new Client({ name: "test", version: "0.1.0" });
				await client.connect(transport);
				const result = await client.callTool({
					name: "who_am_i",
					arguments: {},
				});
				const content = result.content as Array<{ type: string; text: string }>;
				await client.close();
				return JSON.parse(content[0].text);
			}

			const [a, b] = await Promise.all([
				callAs("tenant-a"),
				callAs("tenant-b"),
			]);
			expect(a).toEqual({ tenant: "tenant-a" });
			expect(b).toEqual({ tenant: "tenant-b" });
		});
	});
});
