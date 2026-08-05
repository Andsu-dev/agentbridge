import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("tenant guard over MCP", () => {
  test("a leaking handler never reaches the MCP client as data", async () => {
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["run", new URL("./mcp-tenant-guard-server.ts", import.meta.url).pathname],
    });
    const client = new Client({ name: "test", version: "0.1.0" });
    await client.connect(transport);

    const result = await client.callTool({ name: "list_creators", arguments: {} });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toMatch(/Cross-tenant leak/);
    // the record itself (id "1") never reaches the client as data — only the guard's error text does
    expect(content).toHaveLength(1);

    await client.close();
  });
});
