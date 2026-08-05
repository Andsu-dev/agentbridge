import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const deleteCampaign = defineTool({
	name: "delete_campaign",
	schema: z.object({ id: z.string() }),
	requiresApproval: true,
	handler: (input) => ({ deleted: input.id }),
});

await createToolCatalog({
	tools: [deleteCampaign],
	onApprovalNeeded: () => false,
}).stdio({
	tenantId: "acme",
	jwt: "demo",
});
