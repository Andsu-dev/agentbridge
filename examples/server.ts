import { createToolCatalog } from "../src/index.js";
import { searchCreators } from "./tool.js";

await createToolCatalog({ tools: [searchCreators] }).stdio({ tenantId: "acme", jwt: "demo" });
