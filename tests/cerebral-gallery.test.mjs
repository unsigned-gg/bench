import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromArrayBuffer } from "geotiff";
import { validateInventory } from "../scripts/gallery-contract.mjs";
const inventory = JSON.parse(
  readFileSync(
    new URL("../cerebral-src/visualizations/inventory.json", import.meta.url),
    "utf8",
  ),
);
const binary = readFileSync(
  new URL("../cerebral/visualizations/kernels.wasm", import.meta.url),
);
function kernels() {
  return new WebAssembly.Instance(new WebAssembly.Module(binary)).exports;
}
const input = (e) =>
  new Float64Array(e.memory.buffer, e.input_ptr(), e.capacity());
const output = (e, n) =>
  Array.from(new Float64Array(e.memory.buffer, e.output_ptr(), n));
test("the pinned source has complete, attributed, supported coverage", () =>
  assert.equal(validateInventory(inventory), true));
test("unknown adapters cannot silently use a generic fallback", () => {
  const data = structuredClone(inventory);
  data.entries[0].adapter = "made-up";
  assert.throws(() => validateInventory(data), /Unsupported adapter/);
});
test("missing or duplicated entries and source drift fail closed", () => {
  for (const mutate of [
    (d) => d.entries.pop(),
    (d) => (d.entries[1].id = d.entries[0].id),
    (d) => (d.sourceSha256 = "drift"),
    (d) => (d.entries[0].source = "https://example.org/embed"),
  ]) {
    const d = structuredClone(inventory);
    mutate(d);
    assert.throws(() => validateInventory(d));
  }
});
test("the browser artifact is actual deterministic WASM", () => {
  assert.deepEqual(Array.from(binary.slice(0, 4)), [0, 97, 115, 109]);
  const e = kernels();
  e.generate(42, 192, 0);
  const first = output(e, 1152);
  e.generate(42, 192, 0);
  assert.deepEqual(output(e, 1152), first);
  assert.ok(first.every(Number.isFinite));
  e.generate(43, 192, 0);
  assert.notDeepEqual(output(e, 1152), first);
});
test("histograms retain observations and reject invalid domains", () => {
  const e = kernels();
  input(e).set([-1, 0, 1, 2, 3, 4, 5, 6, NaN]);
  assert.equal(e.histogram(9, 3, 0, 6), 3);
  assert.equal(
    output(e, 3).reduce((a, b) => a + b),
    7,
  );
  assert.equal(e.histogram(9, 3, 6, 0), 0);
});
test("rolling means and interpolated quantiles preserve numeric meaning", () => {
  const e = kernels();
  input(e).set([1, 2, 3, 4]);
  e.moving_average(4, 2);
  assert.deepEqual(output(e, 4), [1, 1.5, 2.5, 3.5]);
  e.quantiles(4);
  assert.deepEqual(output(e, 5), [1, 1.75, 2.5, 3.25, 4]);
  assert.equal(e.quantiles(0), 0);
});
test("nearest-point selection and empty controls use the real kernel", () => {
  const e = kernels();
  input(e).set([1, 2, 8, 9, 12, 4]);
  assert.equal(e.nearest(3, 8, 8), 1);
  assert.equal(e.nearest(0, 0, 0), -1);
  assert.equal(e.nearest(3, NaN, 0), -1);
});
test("density is finite and integrates close to one on a broad grid", () => {
  const e = kernels();
  input(e).set([49, 50, 51]);
  assert.equal(e.kde(3, 3, 0, 100), 128);
  const pairs = output(e, 256);
  const integral =
    (pairs.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) * 100) /
    127;
  assert.ok(Math.abs(integral - 1) < 0.02);
  assert.equal(e.kde(3, 0, 0, 100), 0);
});
test("the local geographic raster really decodes as EPSG:4326 GeoTIFF", async () => {
  const bytes = readFileSync(
    new URL("../cerebral/visualizations/terrain.tiff", import.meta.url),
  );
  const file = await fromArrayBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const image = await file.getImage();
  assert.equal(image.getWidth(), 64);
  assert.equal(image.getHeight(), 64);
  assert.equal(image.getGeoKeys().GeographicTypeGeoKey, 4326);
  const values = await image.readRasters({ interleave: true });
  assert.equal(values.length, 4096);
  assert.ok(new Set(values).size > 50);
});
test("the static catalog and locally bundled runtime require no Observable embed", () => {
  const html = readFileSync(
    new URL("../cerebral/visualizations/index.html", import.meta.url),
    "utf8",
  );
  assert.equal((html.match(/data-example=/g) || []).length, 174);
  assert.ok(!html.includes("<iframe"));
  const js = readFileSync(
    new URL("../cerebral/visualizations/lab.js", import.meta.url),
    "utf8",
  );
  assert.ok(!js.includes("api.observablehq.com"));
});

test("Bollinger bands use actual rolling standard deviations", () => {
  const e = kernels();
  input(e).set([1, 2, 3, 4]);
  e.rolling_bands(4, 2);
  assert.deepEqual(output(e, 8), [1, 0, 1.5, 0.5, 2.5, 0.5, 3.5, 0.5]);
});

test("published WASM remaps personal compiler source paths", () => {
  assert.ok(binary.includes(Buffer.from("memory")));
  assert.ok(!/\/(?:home|Users)\//.test(binary.toString("latin1")));
});
