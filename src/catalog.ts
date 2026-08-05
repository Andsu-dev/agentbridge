import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { assertApproved, type OnApprovalNeeded } from "./approval.js";
import { createDeduper } from "./dedupe.js";
import { ToolError, toToolError } from "./errors.js";
import { createRateLimiter } from "./rate-limit.js";
import { assertTenantScope } from "./tenant-guard.js";
import type { CallEvent, Tool, ToolContext } from "./types.js";

export type ResolveTenant = (
	req: Request,
) => ToolContext | Promise<ToolContext>;

export type ToolCatalogHooks = {
	/** Fires after every call, success or failure — use for logging/audit trails. */
	onCall?: (event: CallEvent) => void | Promise<void>;
	/** Required for any tool with requiresApproval: true — decides whether the call proceeds. */
	onApprovalNeeded?: OnApprovalNeeded;
};

export type ToolCatalogOptions = {
	tools: Tool<any, any>[];
	hooks?: ToolCatalogHooks;
};

export function createToolCatalog(options: ToolCatalogOptions) {
	const byName = new Map(options.tools.map((tool) => [tool.name, tool]));
	const assertRateLimit = createRateLimiter();
	const dedupe = createDeduper();

	async function call(name: string, input: unknown, ctx: ToolContext) {
		const tool = byName.get(name);
		if (!tool) throw new ToolError("UNKNOWN_TOOL", `Unknown tool: ${name}`);

		return dedupe(tool, ctx, input, async () => {
			const start = performance.now();
			try {
				assertRateLimit(tool, ctx);
				const parsed = tool.schema.parse(input);
				await assertApproved(
					tool,
					ctx,
					parsed,
					options.hooks?.onApprovalNeeded,
				);
				const output = await tool.handler(parsed, ctx);
				assertTenantScope(output, tool, ctx);
				await options.hooks?.onCall?.({
					tool: name,
					tenantId: ctx.tenantId,
					durationMs: performance.now() - start,
					ok: true,
				});
				return output;
			} catch (error) {
				const toolError = toToolError(error);
				await options.hooks?.onCall?.({
					tool: name,
					tenantId: ctx.tenantId,
					durationMs: performance.now() - start,
					ok: false,
					error: toolError.message,
					code: toolError.code,
				});
				throw toolError;
			}
		});
	}

	function mcpServer(ctx: ToolContext) {
		const server = new McpServer({ name: "agentbridge", version: "0.1.0" });
		for (const tool of options.tools) {
			server.registerTool(
				tool.name,
				{ description: tool.description, inputSchema: tool.schema.shape },
				async (input: unknown) => {
					try {
						const output = await call(tool.name, input, ctx);
						return {
							content: [
								{ type: "text" as const, text: JSON.stringify(output) },
							],
						};
					} catch (error) {
						const toolError = toToolError(error);
						return {
							content: [
								{
									type: "text" as const,
									text: `[${toolError.code}] ${toolError.message}`,
								},
							],
							isError: true,
						};
					}
				},
			);
		}
		return server;
	}

	async function stdio(ctx: ToolContext) {
		const server = mcpServer(ctx);
		await server.connect(new StdioServerTransport());
		return server;
	}

	// stateless: resolves tenant fresh from every request, no session kept between calls
	function http(resolveTenant: ResolveTenant) {
		return async function handle(req: Request): Promise<Response> {
			const ctx = await resolveTenant(req);
			const server = mcpServer(ctx);
			const transport = new WebStandardStreamableHTTPServerTransport({
				sessionIdGenerator: undefined,
			});
			await server.connect(transport);
			return transport.handleRequest(req);
		};
	}

	return { call, mcpServer, stdio, http, tools: options.tools };
}
