import { z } from "zod";
import { createToolCatalog, defineTool } from "../src/index.js";

const buggyListCreators = defineTool({
	name: "list_creators",
	schema: z.object({}),
	tenantField: "enterpriseId",
	// simulates a missing WHERE clause: returns another tenant's record
	handler: () => [{ id: "1", enterpriseId: "someone-elses-tenant" }],
});

await createToolCatalog({ tools: [buggyListCreators] }).stdio({
	tenantId: "acme",
	jwt: "demo",
});
