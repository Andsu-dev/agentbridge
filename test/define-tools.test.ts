import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTools } from "../src/index.js";

describe("defineTools", () => {
	test("uses object keys as tool names and preserves handlers", async () => {
		const tools = defineTools({
			search: {
				schema: z.object({ query: z.string() }),
				handler: ({ query }) => ({ results: [query] }),
			},
			search_with_pagination: {
				schema: z.object({ query: z.string(), page: z.number() }),
				handler: ({ query, page }) => ({ results: [query], page }),
			},
		});

		expect(tools.map((tool) => tool.name)).toEqual([
			"search",
			"search_with_pagination",
		]);

		const catalog = createToolCatalog({ tools });
		await expect(
			catalog.call(
				"search_with_pagination",
				{ query: "oi", page: 2 },
				{ tenantId: "t1", jwt: "x" },
			),
		).resolves.toEqual({ results: ["oi"], page: 2 });
	});

	test("overrides a name supplied by JavaScript callers", () => {
		const tools = defineTools({
			search: {
				name: "ignored",
				schema: z.object({}),
				handler: () => null,
			},
		} as any);

		expect(tools[0]?.name).toBe("search");
	});
});
