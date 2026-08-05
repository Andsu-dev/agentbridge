import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const echo = defineTool({
	name: "echo",
	schema: z.object({ message: z.string() }),
	handler: (input, ctx) => `${ctx.tenantId}: ${input.message}`,
});

await createToolCatalog({ tools: [echo] }).stdio({ tenantId: "t1", jwt: "x" });
