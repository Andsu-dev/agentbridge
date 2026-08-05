import { ToolError } from "./errors.js";
import type { Tool, ToolContext } from "./types.js";

type Bucket = { count: number; resetAt: number };

// ponytail: per-process in-memory buckets. Fine for a single long-running server;
// add a shared store (Redis, DO storage) when running multiple instances of the same tenant's traffic.
export function createRateLimiter() {
	const buckets = new Map<string, Bucket>();

	return function assertRateLimit(tool: Tool<any, any>, ctx: ToolContext) {
		if (!tool.rateLimit) return;

		const key = `${tool.name}:${ctx.tenantId}`;
		const now = Date.now();
		const bucket = buckets.get(key);

		if (!bucket || now >= bucket.resetAt) {
			buckets.set(key, { count: 1, resetAt: now + tool.rateLimit.windowMs });
			return;
		}

		if (bucket.count >= tool.rateLimit.max) {
			throw new ToolError(
				"RATE_LIMITED",
				`Rate limit exceeded for "${tool.name}" (tenant "${ctx.tenantId}"): max ${tool.rateLimit.max} calls per ${tool.rateLimit.windowMs}ms`,
			);
		}

		bucket.count++;
	};
}
