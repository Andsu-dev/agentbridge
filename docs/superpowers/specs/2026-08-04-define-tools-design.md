# `defineTools` design

## Goal

Add a batch helper for defining named tools without repeating the `name` property.

## Public API

```ts
const tools = defineTools({
  search: {
    schema: z.object({ query: z.string() }),
    handler: async ({ query }) => ({ results: [] }),
  },
});

const catalog = createToolCatalog({ tools: Object.values(tools) });
```

`defineTools` returns an object with the same keys. Each returned entry is a normal `Tool`, whose `name` is the corresponding key (for example, `tools.search.name === "search"`).

Keys are supplied as string literals in the intended usage. They become the tool names registered in a catalog, so callers should use names accepted by their MCP client.

`defineTool` remains unchanged and continues to support defining a single tool explicitly.

## Implementation

- Add `defineTools` beside `defineTool`.
- Its input type omits `name` from every `Tool` definition while retaining schema and handler inference per property.
- Construct each returned tool by adding the object key as `name`. If JavaScript callers provide a `name`, discard it so the key always wins.
- Export the helper from the package entry point.

## Validation

- Add a unit test using two tools. It verifies the returned names and handlers and registers `Object.values(tools)` in a catalog to exercise the intended integration path.
- Add `tsconfig.typecheck.json`, extending the main config and including the type-test fixture under `test/`. Update the `typecheck` script to run it. The fixture shows that each handler input is inferred from its own schema; a field absent from that entry's schema must make the command fail.
- Run the existing test suite, typecheck, and build.
