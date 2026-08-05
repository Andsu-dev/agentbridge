import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const ping = defineTool({
  name: "ping",
  schema: z.object({}),
  rateLimit: { max: 2, windowMs: 50 },
  handler: () => "pong",
});

describe("rate limit", () => {
  test("allows up to max calls then rejects within the window", async () => {
    const catalog = createToolCatalog({ tools: [ping] });
    const ctx = { tenantId: "acme", jwt: "x" };

    await catalog.call("ping", {}, ctx);
    await catalog.call("ping", {}, ctx);
    await expect(catalog.call("ping", {}, ctx)).rejects.toThrow(/Rate limit exceeded/);
  });

  test("tracks each tenant separately", async () => {
    const catalog = createToolCatalog({ tools: [ping] });

    await catalog.call("ping", {}, { tenantId: "tenant-a", jwt: "x" });
    await catalog.call("ping", {}, { tenantId: "tenant-a", jwt: "x" });
    // tenant-b has its own budget, untouched by tenant-a's calls
    await expect(catalog.call("ping", {}, { tenantId: "tenant-b", jwt: "x" })).resolves.toBe("pong");
  });

  test("resets after the window passes", async () => {
    const catalog = createToolCatalog({ tools: [ping] });
    const ctx = { tenantId: "acme", jwt: "x" };

    await catalog.call("ping", {}, ctx);
    await catalog.call("ping", {}, ctx);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await expect(catalog.call("ping", {}, ctx)).resolves.toBe("pong");
  });
});
