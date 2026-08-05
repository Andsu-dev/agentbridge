import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const ctx = { tenantId: "acme", jwt: "x" };

function sensitiveTool(handlerRuns: { count: number }) {
  return defineTool({
    name: "delete_campaign",
    schema: z.object({ id: z.string() }),
    requiresApproval: true,
    handler: (input) => {
      handlerRuns.count++;
      return { deleted: input.id };
    },
  });
}

describe("approval gate", () => {
  test("fails closed when no onApprovalNeeded handler is configured", async () => {
    const runs = { count: 0 };
    const catalog = createToolCatalog({ tools: [sensitiveTool(runs)] });

    const { data, error } = await catalog.call("delete_campaign", { id: "1" }, ctx);
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(runs.count).toBe(0);
  });

  test("blocks the handler when approval is rejected", async () => {
    const runs = { count: 0 };
    const catalog = createToolCatalog({
      tools: [sensitiveTool(runs)],
      hooks: { onApprovalNeeded: () => false },
    });

    const { data, error } = await catalog.call("delete_campaign", { id: "1" }, ctx);
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "APPROVAL_REJECTED" });
    expect(runs.count).toBe(0);
  });

  test("runs the handler once approved, and passes the parsed input along", async () => {
    const runs = { count: 0 };
    const seen: unknown[] = [];
    const catalog = createToolCatalog({
      tools: [sensitiveTool(runs)],
      hooks: {
      onApprovalNeeded: (request) => {
        seen.push(request);
        return true;
      },
    },
  });

    const { data, error } = await catalog.call("delete_campaign", { id: "1" }, ctx);

    expect(error).toBeNull();
    expect(runs.count).toBe(1);
    expect(data).toEqual({ deleted: "1" });
    expect(seen).toEqual([{ tool: "delete_campaign", tenantId: "acme", input: { id: "1" } }]);
  });

  test("tools without requiresApproval skip the gate entirely", async () => {
    const openTool = defineTool({
      name: "list_campaigns",
      schema: z.object({}),
      handler: () => [],
    });
    const catalog = createToolCatalog({ tools: [openTool] }); // no onApprovalNeeded at all

    const { data, error } = await catalog.call("list_campaigns", {}, ctx);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
