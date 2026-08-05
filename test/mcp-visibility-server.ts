import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const enterpriseOnlyTool = defineTool({
  name: "advanced_analytics",
  schema: z.object({}),
  visibleTo: (ctx) => ctx.tenantId === "acme-enterprise",
  handler: () => "secret metrics",
});

const tenantId = process.env.TENANT_ID ?? "unknown";
await createToolCatalog({ tools: [enterpriseOnlyTool] }).stdio({ tenantId, jwt: "demo" });
