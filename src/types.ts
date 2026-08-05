import type { z } from "zod";

export type ToolContext = {
  tenantId: string;
  jwt: string;
};

export type Tool<Schema extends z.ZodObject<any> = z.ZodObject<any>, Output = unknown> = {
  name: string;
  description?: string;
  schema: Schema;
  handler: (input: z.infer<Schema>, ctx: ToolContext) => Promise<Output> | Output;
  /**
   * Field name that identifies the tenant on returned records (e.g. "enterpriseId").
   * When set, the catalog throws if any returned record's field doesn't match ctx.tenantId,
   * catching cross-tenant leaks even when the handler itself has a bug.
   */
  tenantField?: string;
  /** Opt-in cap on calls per tenant within a rolling window. */
  rateLimit?: { max: number; windowMs: number };
};

export type CallEvent = {
  tool: string;
  tenantId: string;
  durationMs: number;
  ok: boolean;
  error?: string;
};
