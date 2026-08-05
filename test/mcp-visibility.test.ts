import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function toolsFor(tenantId: string) {
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", new URL("./mcp-visibility-server.ts", import.meta.url).pathname],
    env: { ...process.env, TENANT_ID: tenantId } as Record<string, string>,
  });
  const client = new Client({ name: "test", version: "0.1.0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((t) => t.name);
}

describe("visibleTo over MCP", () => {
  test("a tenant without access never sees the tool in tools/list", async () => {
    expect(await toolsFor("free-tenant")).not.toContain("advanced_analytics");
  });

  test("a tenant with access sees it", async () => {
    expect(await toolsFor("acme-enterprise")).toContain("advanced_analytics");
  });
});
