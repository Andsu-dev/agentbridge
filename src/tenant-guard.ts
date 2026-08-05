import type { Tool, ToolContext } from "./types.js";

export function assertTenantScope(output: unknown, tool: Tool<any, any>, ctx: ToolContext) {
  if (!tool.tenantField) return;

  const records = Array.isArray(output) ? output : [output];
  for (const record of records) {
    if (!record || typeof record !== "object" || !(tool.tenantField in record)) continue;

    const value = (record as Record<string, unknown>)[tool.tenantField];
    if (value !== undefined && value !== ctx.tenantId) {
      throw new Error(
        `Cross-tenant leak in "${tool.name}": record has ${tool.tenantField}="${value}", expected "${ctx.tenantId}"`
      );
    }
  }
}
