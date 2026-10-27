---
status: draft
created: 2026-10-26
scope: cerebral-src/visualizations, visualization-wasm, scripts/build-cerebral.mjs
---

# Visualization gallery

## Intent

Implement the 174 entries in the Observable D3 gallery snapshot @1120 (captured 2026-10-26) in bench.cerebral.work, using Three.js for rendering and WebAssembly for data processing. Preserve the benchmark observatory and its evidence boundaries. The featured-libraries collection (D3 gallery, Plot Gallery, Hello Inputs) informs the presentation and controls; this spec's complete coverage set is the 174 D3 entries requested by the operator.

## Requirements

- Each source entry has a stable local identifier, category, attribution URL and an explicit implementation adapter; unsupported adapters fail validation rather than using a generic default.
- Every adapter provides the source visualization's defining encoding/behavior, with deterministic local demonstration data labeled separately from measured benchmarks.
- Rendering uses Three.js geometry with an orthographic view and semantic HTML labels/data alternatives; no remote Observable embeds are required to run an example.
- A Rust-generated WebAssembly module performs deterministic sampling and numeric processing; runtime status describes whether WASM and WebGL actually initialized.
- Search, category selection and individual example state are deep-linkable. Keyboard and touch users can select examples, inspect data and operate interactions.
- Animation honors reduced motion, can pause and scrub; animation does not run while the document is hidden. Resize and theme changes update the visualization, with old GPU resources disposed.
- Build/CI validates all 174 adapters and compiles WASM, without deploying. Browser checks exercise every example and the important interactive states.
- Original benchmark records and attribution remain intact; demonstration values are never presented as measured performance.

## Implementation

Add a static `/visualizations/` consumer built with the existing Cerebral site. Keep a pinned source inventory and metadata coverage manifest. Use reusable encoding/layout primitives, with per-example parameters and interactions, rather than copied remote notebook execution. D3's math/layout functions may supply complex hierarchies and geographic projections; Three.js owns graphics. Bundle pinned dependencies locally and ship the compiled WASM with source and reproducible build commands.

## Validation

Verify Rust numeric kernels with negative/edge controls, schema/adapter coverage, stable geometry output and every example in a real browser. Check no empty canvases, runtime exceptions, horizontal overflow or accessibility violations in the UI. Exercise filtering, deep links, animation controls, brushing, zooming, dragging and renderer/WASM failure states. Record source/data licenses and remaining limitations honestly.
