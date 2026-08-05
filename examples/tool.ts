import { z } from "zod";
import { defineTool } from "../src/index.js";

export const searchCreators = defineTool({
	name: "search_creators",
	schema: z.object({ niche: z.string() }),
	handler: (input, ctx) => ({
		tenant: ctx.tenantId,
		creators: [`@${input.niche}_creator_1`, `@${input.niche}_creator_2`],
	}),
});
