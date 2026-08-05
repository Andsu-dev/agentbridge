import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool, ToolError } from "../src/index.js";

const ctx = { tenantId: "acme", jwt: "x" };

describe("structured error codes", () => {
  test("UNKNOWN_TOOL", async () => {
    const catalog = createToolCatalog({ tools: [] });
    const { error } = await catalog.call("nope", {}, ctx);
    expect(error).toMatchObject({ code: "UNKNOWN_TOOL" });
  });

  test("VALIDATION_ERROR", async () => {
    const echo = defineTool({
      name: "echo",
      schema: z.object({ message: z.string() }),
      handler: (input) => input.message,
    });
    const catalog = createToolCatalog({ tools: [echo] });
    const { error } = await catalog.call("echo", { message: 123 }, ctx);
    expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("HANDLER_ERROR wraps an unexpected throw, and is marked retryable by default", async () => {
    const boom = defineTool({
      name: "boom",
      schema: z.object({}),
      handler: () => {
        throw new Error("db is down");
      },
    });
    const catalog = createToolCatalog({ tools: [boom] });
    const { error } = await catalog.call("boom", {}, ctx);
    expect(error).toMatchObject({ code: "HANDLER_ERROR", message: "db is down", retryable: true });
  });

  test("errors are instances of ToolError with a .code callers can branch on", async () => {
    const catalog = createToolCatalog({ tools: [] });
    const { error } = await catalog.call("nope", {}, ctx);
    expect(error).toBeInstanceOf(ToolError);
    expect(error?.code).toBe("UNKNOWN_TOOL");
  });
});
