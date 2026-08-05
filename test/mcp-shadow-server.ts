import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

let realRuns = 0;

const deleteAccount = defineTool({
  name: "delete_account",
  schema: z.object({ id: z.string() }),
  shadow: true,
  handler: () => {
    realRuns++;
    return { deleted: true };
  },
});

await createToolCatalog({
  tools: [deleteAccount],
  onCall: (event) => console.error(`[shadow-log] ${JSON.stringify(event)} realRuns=${realRuns}`),
}).stdio({ tenantId: "acme", jwt: "demo" });
