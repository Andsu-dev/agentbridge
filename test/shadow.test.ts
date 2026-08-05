import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool, type CallEvent } from "../src/index.js";

const ctx = { tenantId: "acme", jwt: "x" };

describe("shadow mode", () => {
  test("the handler never runs, but the attempt is logged via onCall", async () => {
    let realRuns = 0;
    const events: CallEvent[] = [];

    const deleteAccount = defineTool({
      name: "delete_account",
      schema: z.object({ id: z.string() }),
      shadow: true,
      handler: () => {
        realRuns++;
        return { deleted: true };
      },
    });

    const catalog = createToolCatalog({ tools: [deleteAccount], onCall: (event) => events.push(event) });
    const { error } = await catalog.call("delete_account", { id: "1" }, ctx);

    expect(error).toBeNull();
    expect(realRuns).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tool: "delete_account", tenantId: "acme", ok: true, shadow: true });
    expect(events[0].input).toEqual({ id: "1" });
  });

  test("still goes through rate limiting — shadow observes the full pipeline, not just the handler", async () => {
    const limited = defineTool({
      name: "limited",
      schema: z.object({}),
      shadow: true,
      rateLimit: { max: 1, windowMs: 1000 },
      handler: () => "real result",
    });

    const catalog = createToolCatalog({ tools: [limited] });
    await catalog.call("limited", {}, ctx);
    const { error } = await catalog.call("limited", {}, ctx);

    expect(error?.code).toBe("RATE_LIMITED");
  });
});
