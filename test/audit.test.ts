import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool, type CallEvent } from "../src/index.js";

const echo = defineTool({
  name: "echo",
  schema: z.object({ message: z.string() }),
  handler: (input) => input.message,
});

const boom = defineTool({
  name: "boom",
  schema: z.object({}),
  handler: () => {
    throw new Error("handler blew up");
  },
});

describe("onCall audit hook", () => {
  test("records a successful call", async () => {
    const events: CallEvent[] = [];
    const catalog = createToolCatalog({ tools: [echo], hooks: { onCall: (event) => events.push(event) } });

    await catalog.call("echo", { message: "oi" }, { tenantId: "acme", jwt: "x" });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tool: "echo", tenantId: "acme", ok: true });
    expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  test("records a failed call with the error message, and returns it instead of throwing", async () => {
    const events: CallEvent[] = [];
    const catalog = createToolCatalog({ tools: [boom], hooks: { onCall: (event) => events.push(event) } });

    const { data, error } = await catalog.call("boom", {}, { tenantId: "acme", jwt: "x" });
    expect(data).toBeNull();
    expect(error?.message).toBe("handler blew up");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tool: "boom", tenantId: "acme", ok: false, error: "handler blew up" });
  });
});
