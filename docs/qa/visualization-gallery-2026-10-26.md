# Visualization gallery validation — 2026-10-26

## Coverage

- Pinned D3 gallery revision 1120: 174 unique attributed entries, 14 categories.
- All 174 selected in an actual Chrome browser: finite Three.js geometry, positive mark/vertex counts, nonempty pixel output. No uncaught page errors.
- Browser coverage is reproducible with `CHROME_PATH=/usr/bin/google-chrome npm run test:gallery:browser`; CI uses its installed Playwright Chromium. Both use SwiftShader software WebGL. Results are not a hardware-performance benchmark.
- Eight accessibility combinations: widths 1440, 768, 390, 320 × light/dark, zero axe WCAG A/AA and WCAG 2.1 A/AA violations; no horizontal document overflow.
- Search, category count, empty/reset state, deep links/reload, frame persistence, hierarchy drill/reset, brush selection, keyboard mark inspection, zoom/reset, quaternion globe drag, geographic bounding-box focus, stacked/grouped interpolation, adaptive image subdivision, CSV download, animation play/pause and reduced-motion behavior pass.
- Failure controls: blocked WASM request, unavailable WebGL context, and disabled JavaScript preserve the catalog and explain renderer availability.

## Numeric and packaging checks

- 3 native Rust tests pass with the shared-buffer tests serialized.
- 24 Node tests pass: 12 existing benchmark evidence checks plus 12 gallery/kernel checks. Unknown adapter, missing/duplicate inventory and source drift controls fail as expected. Compiled WASM magic, deterministic sampling, histogram count conservation, rolling means/deviations, interpolated quantiles, nearest-point selection, density integration and public-path remapping are verified.
- GeoTIFF decodes as a 64 × 64 EPSG:4326 raster with nonconstant values.
- Static catalog contains exactly 174 local entries. No Observable iframe/API runtime is bundled.
- Cerebral and legacy Worker dry-runs both pass; the Cerebral assets include the gallery bundle, WASM, terrain file and complete bundled-package attribution.
- Original homepage browser regression passes: filters, real p99 values, Saga fixture selection, persistence, downloads, 320/375/768/1024 overflow controls and no-JavaScript evidence rendering. The gallery navigation addition wraps at narrow widths.

## Artifacts and release

Browser output: `test-results/gallery/coverage.json`, desktop/mobile PNGs (generated, gitignored, retained by CI). Additional local evidence is in `/tmp/cerebral-gallery-20261026/`. Screenshots were visually reviewed. Source snapshot, data types, attribution and limitations are recorded in `docs/visualization-gallery.md`.

No merge, production deploy or DNS change was performed. The existing benchmark capture limitations remain in force, including Cortex results pending and Saga virtual-clock units.
