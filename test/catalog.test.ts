import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const echo = defineTool({
  name: "echo",
  schema: z.object({ message: z.string() }),
  handler: (input, ctx) => `${ctx.tenantId}: ${input.message}`,
});

describe("createToolCatalog", () => {
  test("call() runs the handler with parsed input and context", async () => {
    const catalog = createToolCatalog({ tools: [echo] });
    const { data, error } = await catalog.call("echo", { message: "oi" }, { tenantId: "t1", jwt: "x" });
    expect(error).toBeNull();
    expect(data).toBe("t1: oi");
  });

  test("call() returns an error, not a throw, on unknown tool", async () => {
    const catalog = createToolCatalog({ tools: [echo] });
    const { data, error } = await catalog.call("nope", {}, { tenantId: "t1", jwt: "x" });
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "UNKNOWN_TOOL", message: "Unknown tool: nope" });
  });

  test("call() validates input against schema", async () => {
    const catalog = createToolCatalog({ tools: [echo] });
    const { data, error } = await catalog.call("echo", { message: 123 }, { tenantId: "t1", jwt: "x" });
    expect(data).toBeNull();
    expect(error?.code).toBe("VALIDATION_ERROR");
  });
});
