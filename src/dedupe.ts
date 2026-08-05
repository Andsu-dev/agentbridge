import type { Tool, ToolContext } from "./types.js";

type Entry = { result: Promise<unknown>; expiresAt: number };

function isFailedResult(value: unknown): boolean {
  return typeof value === "object" && value !== null && "error" in value && Boolean((value as any).error);
}

// ponytail: per-process in-memory cache, same ceiling as the rate limiter.
export function createDeduper() {
  const inflight = new Map<string, Entry>();

  return function dedupe<T>(
    tool: Tool<any, any>,
    ctx: ToolContext,
    input: unknown,
    run: () => Promise<T>
  ): Promise<T> {
    if (!tool.dedupe) return run();

    const key = `${tool.name}:${ctx.tenantId}:${JSON.stringify(input)}`;
    const now = Date.now();
    const existing = inflight.get(key);
    if (existing && existing.expiresAt > now) {
      return existing.result as Promise<T>;
    }

    const result = run();
    inflight.set(key, { result, expiresAt: now + tool.dedupe.windowMs });
    // don't cache a failed attempt — a real retry should re-run, not replay the same error
    result.then((value) => isFailedResult(value) && inflight.delete(key)).catch(() => inflight.delete(key));

    return result;
  };
}
