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
};
