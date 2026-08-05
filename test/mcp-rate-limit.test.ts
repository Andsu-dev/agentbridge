import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("retry hints over MCP", () => {
  test("a retryable error tells the agent to retry, with a wait time", async () => {
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["run", new URL("./mcp-rate-limit-server.ts", import.meta.url).pathname],
    });
    const client = new Client({ name: "test", version: "0.1.0" });
    await client.connect(transport);

    await client.callTool({ name: "ping", arguments: {} }); // consumes the only slot
    const result = await client.callTool({ name: "ping", arguments: {} });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toMatch(/^\[RATE_LIMITED\] .*\(retryable, retry after \d+ms\)$/);

    await client.close();
  });
});
