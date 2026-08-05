import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const ping = defineTool({
  name: "ping",
  schema: z.object({}),
  rateLimit: { max: 1, windowMs: 60_000 },
  handler: () => "pong",
});

await createToolCatalog({ tools: [ping] }).stdio({ tenantId: "acme", jwt: "demo" });
