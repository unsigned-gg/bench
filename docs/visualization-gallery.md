# Cerebral visualization lab

The `/visualizations/` surface belongs to the Cerebral consumer of unsigned-gg/bench. The legacy model benchmark site is unaffected. The homepage navigation links to the lab and wraps at narrow widths.

## Coverage and sources

The requested source is [D3 gallery](https://observablehq.com/@d3/gallery), observed as notebook revision **1120** on 2026-10-26, with 174 entries across 14 categories. SHA-256 of its retrieved JavaScript source: `e9b19333c720b5cf3eebc6dc682a124a052c449627ac7b0861e763d95b8ac3e0`. The same entry count was verified in the rendered notebook. `cerebral-src/visualizations/inventory.json` pins every title, author, original URL, adapter, interaction and stable local ID.

The [featured-libraries collection](https://observablehq.com/@observablehq/-/collection/featured-libraries) points to the D3 gallery, Plot Gallery and Hello Inputs. It informs the library/control references; the complete implementation set here is the requested 174-entry D3 snapshot. This does not claim to port every example in the separate Plot gallery.

These are local concept implementations with demonstration data, rather than copies of the original notebooks or their historical datasets. Titles identify the source example; a historical title does not identify the local data as a historical measurement. The lab does not execute or embed remote notebook code. Every source entry has an explicit adapter, and validation rejects an unknown adapter instead of substituting a generic chart.

## Rendering and data

- `painter.js`: Three.js orthographic camera, batched triangle/line buffers, raster tile/text texture quads, semantic HTML labels, bounded pixel ratio and resource disposal. Word-cloud glyphs are WebGL textures; labels elsewhere are HTML annotations.
- `layouts.js`, `maps.js`, `special.js`: explicit chart-family encodings and per-example variants. D3 supplies scales, shapes, contours, layouts and geographic math; Three.js owns the graphics.
- `visualization-wasm/src/lib.rs`: compiled WASM for deterministic sampling, rolling means/deviations, histograms, quantiles, Gaussian density estimation, force steps, nearest-mark selection and Lotka–Volterra integration. This is actual numeric processing, not a JavaScript fallback labeled as WASM. Layout/projection algorithms remain JavaScript; no performance speedup is claimed.
- `raster.js`: decodes a real locally generated EPSG:4326 GeoTIFF; WASM quantiles choose its contour thresholds. Geographic outlines use locally bundled Natural Earth and US Atlas data; raster/vector tile examples derive their own local tiles.
- `lab.js`: category/search/example query state, frame/detail/sample deep links, keyboard/touch inspection, brush selection, hierarchy focus/reset, scale/sort changes, camera zoom/pan, quaternion globe dragging, bounding-box focus and opt-in animation. Reduced motion disables playback; hidden documents suspend the frame loop.

Synthetic seed data is independent of benchmark receipts. The existing Scorcher/Cortex/Saga JSON records remain unchanged. No demonstration is presented as a measured benchmark result. Table/CSV expose input samples; some layouts derive groups, positions or model outputs, while frame-driven geometry also uses the displayed animation state.

## Build and package

`node scripts/build-cerebral.mjs` compiles the WASM crate for `wasm32-unknown-unknown`, builds the local gallery bundle and writes it into `cerebral/visualizations/`. The observed local compiler is rustc 1.99.0. Cargo has no third-party crate dependencies; JavaScript packages are pinned in package-lock.json. Compiler home-directory paths are remapped in the public WASM.

The build emits the catalog, runtime, WASM, source inventory, generated terrain TIFF and a NOTICE file containing licenses for every bundled package identified by esbuild's dependency graph. The LERC Apache notice is kept under `third-party/` because its npm package omits the full license file. Hosted display typography uses the same Cerebral CSS URL as the benchmark homepage; no commercial font binary is copied into the repo.

The CI workflow installs the WASM target, runs native and compiled-kernel tests, builds all assets, exercises every example in Chromium and performs a Worker dry-run. It retains review artifacts and does not deploy this hostname.

## Practical boundaries

The interactive lab needs JavaScript, WebAssembly and WebGL. Its static 174-entry catalog and source links remain readable without JavaScript. WASM/WebGL failures have explicit fallback messages; the benchmark homepage retains its independently verified no-JavaScript results. Browser render tests use software WebGL and establish correctness, not GPU performance. Original essay prose, original historical datasets, live third-party map tiles and pixel-identical notebook reproductions are outside this consumer.
