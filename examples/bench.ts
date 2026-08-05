import { createToolCatalog } from "../src/index.js";
import { searchCreators } from "./tool.js";

const catalog = createToolCatalog({ tools: [searchCreators] });
const ctx = { tenantId: "acme", jwt: "demo" };
const N = 100_000;

const start = performance.now();
for (let i = 0; i < N; i++) {
  await catalog.call("search_creators", { niche: "beleza" }, ctx);
}
const ms = performance.now() - start;

console.log(`${N.toLocaleString()} in-process calls in ${ms.toFixed(1)}ms`);
console.log(`${Math.round(N / (ms / 1000)).toLocaleString()} ops/sec`);
console.log(`${((ms * 1000) / N).toFixed(2)}µs overhead per call (validation + dispatch)`);
