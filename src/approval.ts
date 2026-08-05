import { ToolError } from "./errors.js";
import type { Tool, ToolContext } from "./types.js";

export type ApprovalRequest = { tool: string; tenantId: string; input: unknown };
export type OnApprovalNeeded = (request: ApprovalRequest) => boolean | Promise<boolean>;

export async function assertApproved(
  tool: Tool<any, any>,
  ctx: ToolContext,
  input: unknown,
  onApprovalNeeded: OnApprovalNeeded | undefined
) {
  if (!tool.requiresApproval) return;

  if (!onApprovalNeeded) {
    throw new ToolError(
      "APPROVAL_REQUIRED",
      `"${tool.name}" requires approval but no onApprovalNeeded handler is configured`
    );
  }

  const approved = await onApprovalNeeded({ tool: tool.name, tenantId: ctx.tenantId, input });
  if (!approved) {
    throw new ToolError("APPROVAL_REJECTED", `Call to "${tool.name}" was not approved`);
  }
}
