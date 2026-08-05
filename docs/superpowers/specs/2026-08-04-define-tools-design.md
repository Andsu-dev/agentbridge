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
```

`defineTools` returns an object with the same keys. Each returned entry is a normal `Tool`, whose `name` is the corresponding key (for example, `tools.search.name === "search"`).

`defineTool` remains unchanged and continues to support defining a single tool explicitly.

## Implementation

- Add `defineTools` beside `defineTool`.
- Its input type omits `name` from every `Tool` definition while retaining schema and handler inference per property.
- Construct each returned tool by adding the object key as `name`.
- Export the helper from the package entry point.

## Validation

- Add a unit test that verifies the returned names and handlers.
- Run the existing test suite, typecheck, and build.
