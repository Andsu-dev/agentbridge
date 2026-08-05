import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const ctx = { tenantId: "acme", jwt: "x" };

describe("tenant guard", () => {
	test("passes through records that belong to the calling tenant", async () => {
		const listCreators = defineTool({
			name: "list_creators",
			schema: z.object({}),
			tenantField: "enterpriseId",
			handler: () => [{ id: "1", enterpriseId: "acme" }],
		});

		const catalog = createToolCatalog({ tools: [listCreators] });
		const result = await catalog.call("list_creators", {}, ctx);
		expect(result).toEqual([{ id: "1", enterpriseId: "acme" }]);
	});

	test("throws when a handler bug leaks another tenant's record", async () => {
		const buggyListCreators = defineTool({
			name: "list_creators",
			schema: z.object({}),
			tenantField: "enterpriseId",
			// simulates a missing WHERE clause: returns data from another tenant
			handler: () => [{ id: "1", enterpriseId: "someone-elses-tenant" }],
		});

		const catalog = createToolCatalog({ tools: [buggyListCreators] });
		await expect(catalog.call("list_creators", {}, ctx)).rejects.toThrow(
			/Cross-tenant leak/,
		);
	});

	test("is opt-in — tools without tenantField are not checked", async () => {
		const noGuard = defineTool({
			name: "no_guard",
			schema: z.object({}),
			handler: () => [{ id: "1", enterpriseId: "whatever" }],
		});

		const catalog = createToolCatalog({ tools: [noGuard] });
		const result = await catalog.call("no_guard", {}, ctx);
		expect(result).toEqual([{ id: "1", enterpriseId: "whatever" }]);
	});
});
