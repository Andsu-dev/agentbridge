import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { assertTenantScope } from "./tenant-guard.js";
import type { Tool, ToolContext } from "./types.js";

export type ToolCatalogOptions = {
  tools: Tool<any, any>[];
};

export function createToolCatalog(options: ToolCatalogOptions) {
  const byName = new Map(options.tools.map((tool) => [tool.name, tool]));

  async function call(name: string, input: unknown, ctx: ToolContext) {
    const tool = byName.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const output = await tool.handler(tool.schema.parse(input), ctx);
    assertTenantScope(output, tool, ctx);
    return output;
  }

  function mcpServer(ctx: ToolContext) {
    const server = new McpServer({ name: "agentbridge", version: "0.1.0" });
    for (const tool of options.tools) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.schema.shape },
        async (input: unknown) => {
          const output = await call(tool.name, input, ctx);
          return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
        }
      );
    }
    return server;
  }

  async function stdio(ctx: ToolContext) {
    const server = mcpServer(ctx);
    await server.connect(new StdioServerTransport());
    return server;
  }

  return { call, mcpServer, stdio, tools: options.tools };
}
