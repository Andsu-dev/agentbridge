import type { z } from "zod";
import type { Tool } from "./types.js";

export function defineTool<Schema extends z.ZodObject<any>, Output>(
  tool: Tool<Schema, Output>
): Tool<Schema, Output> {
  return tool;
}
