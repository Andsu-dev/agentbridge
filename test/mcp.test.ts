import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("catalog.stdio()", () => {
	test("serves defined tools over a real MCP stdio connection", async () => {
		const transport = new StdioClientTransport({
			command: "bun",
			args: ["run", new URL("./mcp-server.ts", import.meta.url).pathname],
		});

		const client = new Client({ name: "agentbridge-test", version: "0.1.0" });
		await client.connect(transport);

		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name)).toEqual(["echo"]);

		const result = await client.callTool({
			name: "echo",
			arguments: { message: "oi" },
		});
		expect(result.content).toEqual([{ type: "text", text: '"t1: oi"' }]);

		await client.close();
	});
});
