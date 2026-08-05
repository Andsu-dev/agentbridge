import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const enterpriseOnlyTool = defineTool({
  name: "advanced_analytics",
  schema: z.object({}),
  visibleTo: (ctx) => ctx.tenantId === "acme-enterprise",
  handler: () => "secret metrics",
});

describe("visibleTo", () => {
  test("call() rejects a hidden tool as UNKNOWN_TOOL, not a permission error", async () => {
    const catalog = createToolCatalog({ tools: [enterpriseOnlyTool] });
    const { data, error } = await catalog.call("advanced_analytics", {}, { tenantId: "free-tenant", jwt: "x" });
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "UNKNOWN_TOOL" });
  });

  test("call() allows it for a tenant the visibleTo check approves", async () => {
    const catalog = createToolCatalog({ tools: [enterpriseOnlyTool] });
    const { data, error } = await catalog.call("advanced_analytics", {}, { tenantId: "acme-enterprise", jwt: "x" });
    expect(error).toBeNull();
    expect(data).toBe("secret metrics");
  });
});
