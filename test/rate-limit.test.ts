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
  test("allows up to max calls then errors within the window", async () => {
    const catalog = createToolCatalog({ tools: [ping] });
    const ctx = { tenantId: "acme", jwt: "x" };

    await catalog.call("ping", {}, ctx);
    await catalog.call("ping", {}, ctx);
    const { data, error } = await catalog.call("ping", {}, ctx);

    expect(data).toBeNull();
    expect(error?.code).toBe("RATE_LIMITED");
    expect(error?.retryable).toBe(true);
    expect(error?.retryAfterMs).toBeGreaterThan(0);
  });

  test("tracks each tenant separately", async () => {
    const catalog = createToolCatalog({ tools: [ping] });

    await catalog.call("ping", {}, { tenantId: "tenant-a", jwt: "x" });
    await catalog.call("ping", {}, { tenantId: "tenant-a", jwt: "x" });
    // tenant-b has its own budget, untouched by tenant-a's calls
    const { data, error } = await catalog.call("ping", {}, { tenantId: "tenant-b", jwt: "x" });
    expect(error).toBeNull();
    expect(data).toBe("pong");
  });

  test("resets after the window passes", async () => {
    const catalog = createToolCatalog({ tools: [ping] });
    const ctx = { tenantId: "acme", jwt: "x" };

    await catalog.call("ping", {}, ctx);
    await catalog.call("ping", {}, ctx);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const { data, error } = await catalog.call("ping", {}, ctx);
    expect(error).toBeNull();
    expect(data).toBe("pong");
  });
});
