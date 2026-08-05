import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createToolCatalog } from "../src/index.js";
import { searchCreators } from "./tool.js";

const ctx = { tenantId: "acme", jwt: "demo" };
const catalog = createToolCatalog({ tools: [searchCreators] });

// same tool, called in-process — e.g. from your own copilot loop
const { data: direct, error } = await catalog.call("search_creators", { niche: "beleza" }, ctx);
if (error) throw error;
console.log("in-process:", direct);

// same tool, called by an external agent over MCP — zero extra code written for it
const transport = new StdioClientTransport({
	command: "bun",
	args: ["run", new URL("./server.ts", import.meta.url).pathname],
});
const client = new Client({ name: "demo-client", version: "0.1.0" });
await client.connect(transport);

const viaMcp = await client.callTool({
	name: "search_creators",
	arguments: { niche: "beleza" },
});
const content = viaMcp.content as Array<{ type: string; text: string }>;
console.log("via MCP:   ", JSON.parse(content[0].text));

await client.close();
