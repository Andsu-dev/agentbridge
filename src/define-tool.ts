import type { z } from "zod";
import type { Tool } from "./types.js";

export function defineTool<Schema extends z.ZodObject<any>, Output>(
	tool: Tool<Schema, Output>,
): Tool<Schema, Output> {
	return tool;
}

type ToolDefinitions = Record<string, Tool<z.ZodObject<any>, any>>;

export function defineTools<Tools extends ToolDefinitions>(
	tools: { [Name in keyof Tools]: Omit<Tools[Name], "name"> },
): Tool[] {
	return Object.entries(tools).map(([name, tool]) => ({ ...tool, name }));
}
