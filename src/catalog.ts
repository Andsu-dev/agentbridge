import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { assertApproved, type OnApprovalNeeded } from "./approval.js";
import { createDeduper } from "./dedupe.js";
import { ToolError, toToolError } from "./errors.js";
import { createRateLimiter } from "./rate-limit.js";
import { assertTenantScope } from "./tenant-guard.js";
import type { CallEvent, CallResult, Tool, ToolContext } from "./types.js";

export type ResolveTenant = (req: Request) => ToolContext | Promise<ToolContext>;

export type ToolCatalogOptions = {
  tools: Tool<any, any>[];
  /** Fires after every call, success or failure — use for logging/audit trails. */
  onCall?: (event: CallEvent) => void | Promise<void>;
  /** Required for any tool with requiresApproval: true — decides whether the call proceeds. */
  onApprovalNeeded?: OnApprovalNeeded;
};

async function isVisible(tool: Tool<any, any>, ctx: ToolContext) {
  return !tool.visibleTo || (await tool.visibleTo(ctx));
}

function ok<T>(data: T): CallResult<T> {
  return { data, error: null };
}

function fail<T>(error: ToolError): CallResult<T> {
  return { data: null, error };
}

export function createToolCatalog(options: ToolCatalogOptions) {
  const byName = new Map(options.tools.map((tool) => [tool.name, tool]));
  const assertRateLimit = createRateLimiter();
  const dedupe = createDeduper();

  async function call(name: string, input: unknown, ctx: ToolContext): Promise<CallResult<unknown>> {
    const tool = byName.get(name);
    // a hidden tool reports as unknown, not as forbidden — it shouldn't reveal it exists
    if (!tool || !(await isVisible(tool, ctx))) {
      return fail(new ToolError("UNKNOWN_TOOL", `Unknown tool: ${name}`));
    }

    return dedupe(tool, ctx, input, async () => {
      const start = performance.now();
      try {
        assertRateLimit(tool, ctx);
        const parsed = tool.schema.parse(input);
        await assertApproved(tool, ctx, parsed, options.onApprovalNeeded);

        if (tool.shadow) {
          await options.onCall?.({
            tool: name,
            tenantId: ctx.tenantId,
            input,
            durationMs: performance.now() - start,
            ok: true,
            shadow: true,
          });
          return ok(undefined);
        }

        const output = await tool.handler(parsed, ctx);
        assertTenantScope(output, tool, ctx);
        await options.onCall?.({
          tool: name,
          tenantId: ctx.tenantId,
          input,
          durationMs: performance.now() - start,
          ok: true,
        });
        return ok(output);
      } catch (error) {
        const toolError = toToolError(error);
        await options.onCall?.({
          tool: name,
          tenantId: ctx.tenantId,
          input,
          durationMs: performance.now() - start,
          ok: false,
          error: toolError.message,
          code: toolError.code,
        });
        return fail(toolError);
      }
    });
  }

  async function mcpServer(ctx: ToolContext) {
    // declare the tools capability up front — the SDK only wires up tools/list once
    // registerTool has been called at least once, which wouldn't happen if every tool is hidden
    const server = new McpServer({ name: "agentbridge", version: "0.1.0" }, { capabilities: { tools: {} } });
    for (const tool of options.tools) {
      const registered = server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.schema.shape },
        async (input: unknown) => {
          const { data, error } = await call(tool.name, input, ctx);
          if (error) {
            const retryHint = error.retryable
              ? ` (retryable${error.retryAfterMs ? `, retry after ${error.retryAfterMs}ms` : ""})`
              : "";
            return {
              content: [{ type: "text" as const, text: `[${error.code}] ${error.message}${retryHint}` }],
              isError: true,
            };
          }
          return { content: [{ type: "text" as const, text: JSON.stringify(data ?? null) }] };
        }
      );
      // registered, but hidden: excluded from tools/list, and calling it directly is rejected by the SDK
      if (!(await isVisible(tool, ctx))) registered.disable();
    }
    return server;
  }

  async function stdio(ctx: ToolContext) {
    const server = await mcpServer(ctx);
    await server.connect(new StdioServerTransport());
    return server;
  }

  // stateless: resolves tenant fresh from every request, no session kept between calls
  function http(resolveTenant: ResolveTenant) {
    return async function handle(req: Request): Promise<Response> {
      const ctx = await resolveTenant(req);
      const server = await mcpServer(ctx);
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      return transport.handleRequest(req);
    };
  }

  return { call, mcpServer, stdio, http, tools: options.tools };
}
