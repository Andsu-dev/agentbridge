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
import { defineTool, createToolCatalog } from "agentbridge";

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

Same handler, same validation, same tenant context, both times. There's no second copy to drift.

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

## Why this and not a bigger agent framework

`agentbridge` doesn't orchestrate agents, doesn't manage conversations, and doesn't pick which LLM to call. It does one narrow thing: a tool is defined once and reachable from more than one caller. If you only ever call your tools from one place, you don't need this — a plain function is simpler and you should use that instead.

## Scope today

- `call(name, input, ctx)` — in-process invocation, schema-validated with Zod.
- `stdio(ctx)` — serves the whole catalog as a local MCP server over stdio, the way Claude Desktop and Claude Code expect.

Not built yet: an HTTP/Streamable transport that resolves tenant per request. That's the natural next step once you need a *remote*, multi-tenant MCP server instead of a local one — it's left out for now because getting per-request auth right deserves its own pass, not a rushed one.

## Install

```bash
bun add agentbridge
```
