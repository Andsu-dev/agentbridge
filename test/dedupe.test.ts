import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const ctx = { tenantId: "acme", jwt: "x" };

describe("dedupe", () => {
  test("concurrent identical calls run the handler only once", async () => {
    let runs = 0;
    const createCampaign = defineTool({
      name: "create_campaign",
      schema: z.object({ name: z.string() }),
      dedupe: { windowMs: 1000 },
      handler: async (input) => {
        runs++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { id: "camp_1", name: input.name };
      },
    });
    const catalog = createToolCatalog({ tools: [createCampaign] });

    const [a, b] = await Promise.all([
      catalog.call("create_campaign", { name: "verao" }, ctx),
      catalog.call("create_campaign", { name: "verao" }, ctx),
    ]);

    expect(runs).toBe(1);
    expect(a).toEqual(b);
  });

  test("different input is not deduped", async () => {
    let runs = 0;
    const createCampaign = defineTool({
      name: "create_campaign",
      schema: z.object({ name: z.string() }),
      dedupe: { windowMs: 1000 },
      handler: (input) => {
        runs++;
        return { name: input.name };
      },
    });
    const catalog = createToolCatalog({ tools: [createCampaign] });

    await catalog.call("create_campaign", { name: "verao" }, ctx);
    await catalog.call("create_campaign", { name: "inverno" }, ctx);

    expect(runs).toBe(2);
  });

  test("a failed call is not cached — a real retry re-runs the handler", async () => {
    let runs = 0;
    const flaky = defineTool({
      name: "flaky",
      schema: z.object({}),
      dedupe: { windowMs: 1000 },
      handler: () => {
        runs++;
        throw new Error("timeout");
      },
    });
    const catalog = createToolCatalog({ tools: [flaky] });

    expect((await catalog.call("flaky", {}, ctx)).error).not.toBeNull();
    expect((await catalog.call("flaky", {}, ctx)).error).not.toBeNull();

    expect(runs).toBe(2);
  });
});
