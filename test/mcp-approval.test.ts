import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("approval gate over MCP", () => {
	test("a rejected approval never executes the tool for the calling agent", async () => {
		const transport = new StdioClientTransport({
			command: "bun",
			args: [
				"run",
				new URL("./mcp-approval-server.ts", import.meta.url).pathname,
			],
		});
		const client = new Client({ name: "test", version: "0.1.0" });
		await client.connect(transport);

		const result = await client.callTool({
			name: "delete_campaign",
			arguments: { id: "1" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0].text).toBe(
			'[APPROVAL_REJECTED] Call to "delete_campaign" was not approved',
		);

		await client.close();
	});
});
