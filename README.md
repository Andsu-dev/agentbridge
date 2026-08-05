# agentbridge

**Write your AI agent's tool once. Use it everywhere that agent shows up.**

## The problem

Say your product has an MCP server, so external agents (Claude, or whatever your users plug in) can call things like `search_creators` or `create_campaign`. Now say you're also building your own in-house copilot — a chat agent that lives inside your app and calls those exact same capabilities.

You now have two implementations of `search_creators`. One lives in the MCP server. One lives in your copilot's tool loop. They started out identical. Six months later, someone fixes a bug in one and forgets the other. Or worse — one of them forgets to check which tenant is asking, and now enterprise A can see enterprise B's data through whichever path nobody was looking at.

This isn't a hypothetical. It's the exact shape of bug that shows up whenever the same capability has two independent doors into it.

## The fix

Define the tool once. Get both doors for free.

```ts
import { z } from "zod";
import { defineTool, defineTools, createToolCatalog } from "agentbridge";

const searchCreators = defineTool({
  name: "search_creators",
  schema: z.object({ niche: z.string() }),
  handler: async (input, ctx) => {
    // ctx.tenantId and ctx.jwt are already resolved — no way to forget them
    return db.query.creators.findMany({ where: eq(creators.enterpriseId, ctx.tenantId) });
  },
});

const catalog = createToolCatalog({ tools: [searchCreators] });
```

Now call it directly, from your own copilot's loop:

```ts
const result = await catalog.call("search_creators", { niche: "beleza" }, { tenantId, jwt });
```

Or hand the whole catalog to an MCP client, like Claude Desktop or Claude Code:

```ts
await catalog.stdio({ tenantId, jwt });
```

Or serve it remotely, over HTTP, resolving tenant fresh from each incoming request — works on Node, Bun, and Cloudflare Workers, since it's built on the standard `Request`/`Response`:

```ts
const handle = catalog.http((req) => ({
  tenantId: getTenantFromJWT(req.headers.get("authorization")),
  jwt: req.headers.get("authorization") ?? "",
}));

Bun.serve({ port: 3000, fetch: handle });
```

Same handler, same validation, same tenant context, every time. There's no second copy to drift.

## See it work

```bash
bun install
bun run example   # calls the same tool in-process and over a real MCP stdio server, prints both
bun run bench     # throughput of the in-process path
```

`bun run example` defines `search_creators` once, calls it directly, then spawns a real MCP server and calls it again through an actual `@modelcontextprotocol/sdk` client over stdio. Both calls print the exact same result — that's the whole point, made visible.

```
in-process: { tenant: "acme", creators: [ "@beleza_creator_1", "@beleza_creator_2" ] }
via MCP:    { tenant: "acme", creators: [ "@beleza_creator_1", "@beleza_creator_2" ] }
```

`bun run bench` measures the in-process path's own overhead (Zod validation + dispatch, no MCP round-trip) — on a laptop it lands around 4M calls/sec, ~0.24µs each. The library isn't the bottleneck in any real handler; the point of the benchmark is just to confirm that's true rather than assume it.

## Catching cross-tenant leaks

If you're multi-tenant, `ctx.tenantId` reaching every handler isn't enough on its own — a handler can still leak another tenant's data through a bug (missing `WHERE`, wrong id passed down). Declare `tenantField` and the catalog checks every returned record before it leaves the tool, regardless of which door it went out:

```ts
const listCreators = defineTool({
  name: "list_creators",
  schema: z.object({}),
  tenantField: "enterpriseId", // field on the returned records that identifies the tenant
  handler: async (input, ctx) => db.query.creators.findMany({ where: eq(creators.enterpriseId, ctx.tenantId) }),
});
```

If a handler ever returns a record whose `enterpriseId` doesn't match `ctx.tenantId`, `call()` throws instead of letting it reach the caller — MCP client or your own copilot. It's opt-in per tool and only catches leaks the output actually reveals (it can't see a leak baked into a scalar return value with no tenant field) — a runtime backstop, not a substitute for correct queries.

## What's specific to agents calling your tools, not humans

An agent doesn't click buttons — it can call a tool in a loop, and nobody's watching in real time when it does. Two small opt-ins cover the failure modes that come from that:

**Audit trail.** Every call fires `onCall`, whether it succeeded or not — the question "what did the agent actually do to my data" needs an answer, and it needs to not be a maybe.

```ts
const catalog = createToolCatalog({
  tools: [searchCreators],
  hooks: {
    onCall: (event) => logger.info("tool_call", event),
  }, // { tool, tenantId, durationMs, ok, error? }
});
```

**Rate limit per tenant.** A buggy agent retrying in a tight loop can do in seconds what a human couldn't do in a day. Opt in per tool:

```ts
const searchCreators = defineTool({
  name: "search_creators",
  schema: z.object({ niche: z.string() }),
  rateLimit: { max: 20, windowMs: 60_000 }, // per tenant, per tool
  handler: async (input, ctx) => { /* ... */ },
});
```

Both are opt-in and additive — existing tools and catalogs work unchanged without them.

**Idempotency.** An agent that times out waiting for a response tends to just call again. Without protection, `create_campaign` runs twice. Opt in with `dedupe` and identical `(tool, tenant, input)` within the window returns the same result instead of re-executing:

```ts
const createCampaign = defineTool({
  name: "create_campaign",
  schema: z.object({ name: z.string() }),
  dedupe: { windowMs: 5_000 },
  handler: async (input, ctx) => { /* runs once, even if called twice at the same time */ },
});
```

A failed call is never cached — a genuine retry after a real error re-runs the handler.

**Approval gate.** Some tools shouldn't fire just because an agent decided to call them. Mark a tool `requiresApproval: true` and wire up `hooks.onApprovalNeeded` — the call blocks until it returns `true`. No handler configured means the catalog fails closed, not open:

```ts
const tools = defineTools({
  deleteCampaign: {
    schema: z.object({ id: z.string() }),
    requiresApproval: true,
    handler: async (input, ctx) => { /* only runs if approved */ },
  },
});

const catalog = createToolCatalog({
  tools,
  hooks: {
    onApprovalNeeded: async ({ tool, tenantId, input }) => askAHuman(tool, tenantId, input),
  },
});
```

**Structured errors.** Every failure the catalog raises — unknown tool, bad input, tenant leak, rate limit, rejected approval — is a `ToolError` with a stable `.code` (`"RATE_LIMITED"`, `"TENANT_LEAK"`, `"APPROVAL_REJECTED"`, ...), not just a message to parse. Over MCP, the code is prefixed onto the error text agents see, so both callers get to branch on what actually happened instead of guessing from prose.

## Why this and not a bigger agent framework

`agentbridge` doesn't orchestrate agents, doesn't manage conversations, and doesn't pick which LLM to call. It does one narrow thing: a tool is defined once and reachable from more than one caller. If you only ever call your tools from one place, you don't need this — a plain function is simpler and you should use that instead.

## Scope today

- `call(name, input, ctx)` — in-process invocation, schema-validated with Zod.
- `stdio(ctx)` — serves the whole catalog as a local MCP server over stdio, the way Claude Desktop and Claude Code expect.
- `http(resolveTenant)` — a stateless Streamable HTTP handler (`(req: Request) => Promise<Response>`), tenant resolved fresh per request. No session kept between calls — each request gets its own `McpServer` instance, so one tenant's context never leaks into another's, even under concurrent load.

Not built yet: session persistence for the HTTP transport (today it's stateless — every request re-initializes). Add it if you need long-lived streaming sessions instead of simple request/response.

## Install

```bash
bun add agentbridge
```
