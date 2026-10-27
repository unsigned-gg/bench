import { adapterNames } from "../cerebral-src/visualizations/registry.mjs";
const interactions = new Set([
  "inspect",
  "zoom",
  "pan",
  "drill",
  "sort",
  "scale",
  "rotate",
  "sequence",
  "brush",
  "projection",
  "refine",
  "index",
  "tooltip",
  "drag",
]);
export function validateInventory(data) {
  if (
    data.revision !== 1120 ||
    data.sourceSha256 !==
      "e9b19333c720b5cf3eebc6dc682a124a052c449627ac7b0861e763d95b8ac3e0"
  )
    throw Error("Unknown gallery snapshot");
  if (
    data.entries.length !== 174 ||
    new Set(data.entries.map((e) => e.id)).size !== 174
  )
    throw Error("Coverage must contain 174 unique examples");
  if (new Set(data.entries.map((e) => e.category)).size !== 14)
    throw Error("Category coverage changed");
  data.entries.forEach((e, i) => {
    if (
      e.index !== i + 1 ||
      !e.title ||
      !e.author ||
      !/^https:\/\/observablehq\.com\/@[a-z0-9-]+\/[a-z0-9-]+(?:\/\d+)?$/.test(
        e.source,
      )
    )
      throw Error(`Invalid source attribution at ${i}`);
    if (!adapterNames.has(e.adapter))
      throw Error(`Unsupported adapter: ${e.adapter}`);
    if (
      !interactions.has(e.interaction) ||
      typeof e.animated !== "boolean" ||
      e.data !== "deterministic-demo"
    )
      throw Error(`Invalid behavior metadata: ${e.id}`);
  });
  return true;
}
