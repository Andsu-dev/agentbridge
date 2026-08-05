import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("shadow mode over MCP", () => {
  test("agent gets a normal (non-error) response, but the real handler never ran", async () => {
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["run", new URL("./mcp-shadow-server.ts", import.meta.url).pathname],
      stderr: "pipe",
    });
    const client = new Client({ name: "test", version: "0.1.0" });
    await client.connect(transport);

    const result = await client.callTool({ name: "delete_account", arguments: { id: "1" } });
    expect(result.isError).toBeFalsy();

    let stderr = "";
    transport.stderr?.on("data", (chunk) => (stderr += chunk.toString()));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(stderr).toContain('"shadow":true');
    expect(stderr).toContain("realRuns=0");

    await client.close();
  });
});
