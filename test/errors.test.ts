import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool, ToolError } from "../src/index.js";

const ctx = { tenantId: "acme", jwt: "x" };

describe("structured error codes", () => {
	test("UNKNOWN_TOOL", async () => {
		const catalog = createToolCatalog({ tools: [] });
		await expect(catalog.call("nope", {}, ctx)).rejects.toMatchObject({
			code: "UNKNOWN_TOOL",
		});
	});

	test("VALIDATION_ERROR", async () => {
		const echo = defineTool({
			name: "echo",
			schema: z.object({ message: z.string() }),
			handler: (input) => input.message,
		});
		const catalog = createToolCatalog({ tools: [echo] });
		await expect(
			catalog.call("echo", { message: 123 }, ctx),
		).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
	});

	test("HANDLER_ERROR wraps an unexpected throw", async () => {
		const boom = defineTool({
			name: "boom",
			schema: z.object({}),
			handler: () => {
				throw new Error("db is down");
			},
		});
		const catalog = createToolCatalog({ tools: [boom] });
		await expect(catalog.call("boom", {}, ctx)).rejects.toMatchObject({
			code: "HANDLER_ERROR",
			message: "db is down",
		});
	});

	test("errors are instances of ToolError with a .code callers can branch on", async () => {
		const catalog = createToolCatalog({ tools: [] });
		try {
			await catalog.call("nope", {}, ctx);
			throw new Error("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(ToolError);
			expect((error as ToolError).code).toBe("UNKNOWN_TOOL");
		}
	});
});
