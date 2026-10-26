# bench.cerebral.work

A separate Cerebral benchmark site in `unsigned-gg/bench`, the established benchmark repository. The existing `bench.unsigned.gg` model bank continues to use `public/` and `wrangler.jsonc`.

## Source and design

- `cerebral-src/`: page template, CSS, browser behavior, and evidence JSON.
- `scripts/build-cerebral.mjs`: generates `cerebral/`, a static asset tree, including initial server-readable results and a CSV export.
- `scripts/bench-data.mjs`: validates evidence types, denominators, source values, artifact hashes and public-data boundaries.
- `wrangler.cerebral.jsonc`: the separate `cerebral-bench` Worker and `bench.cerebral.work` custom-domain target.
- `.github/workflows/cerebral-bench.yml`: checks PRs and retains the static site as a review artifact. It does not deploy.

Visual source: the Cerebral V2 homepage captured on 2026-10-26. Warm paper `#F0EEE9`, ink `#0A0A0B`, black/white dark theme, the existing Fractul/Gunter display stack, Space Mono labels, full-width two-column structure, square controls, and 1px rules. Extraction is recorded in `cerebral-work/cerebral-design` PR #40 and the site implementation map in `cerebral-work/site` PR #52. This consumer does not ratify or modify shared brand contracts. Fonts are requested from their existing hosted locations; no font binaries are redistributed here. A platform mono fallback remains functional if those fonts are unavailable.

## Evidence model

All initial results are first-party. There is no universal score or cross-system ranking.

| Source | Captured evidence | Boundary |
| --- | --- | --- |
| Scorcher | Local release-binary microbenchmark; 10,000 routing iterations; 100 shared-memory roundtrips | Other loop denominators scale separately. One capture on a shared Linux/WSL2 workstation; no confidence interval or production claim. |
| Cortex | Inspected reference suite 0056 coverage | No distinct run record was found/attached during this capture. Its numbers remain absent. Scorcher's vendored lineage is not an independent Cortex execution. |
| Saga scheduling | Local debug-binary run: four plans × three strategies | Virtual-clock simulation in declared plan units; no tasks executed and no host-pressure trace. |
| Saga eval fixtures | Two committed validation records, each with a failing no-op and two passing reference-patch runs | Fixture validity, not an agent-model pass rate. Advisory judge scores and transcripts are excluded. |

Each source record includes the inspected revision/path and SHA-256. Captured executable SHA-256 and source-context revision are separate fields because the source revision is not a binary-build attestation. The public index includes SHA-256 for each published JSON artifact. The original Scorcher output's hash is retained; the public capture omits per-request solver outputs and retains the relevant summary.

The source repos were read without editing their shared checkouts or launching a distributed benchmark. A bounded local Scorcher capture and Saga simulation supplied new evidence. Cortex remains protocol-only. The public tree contains no local machine names, personal paths, internal endpoints or raw agent transcripts.

## Develop and verify

```sh
npm install
npm run test:cerebral
npm run build:cerebral
npm run check:cerebral
npm run dev:cerebral
```

The builder requires only Node. Wrangler uses the existing pinned dev dependency. `check:cerebral` runs tests, generates the static tree and performs a Worker dry run. The browser UI progressively adds query/search/evidence filters, percentile selection, scheduler fixture selection, and a saved theme. Initial results and evidence links are present without JavaScript.

A query such as `?system=saga&q=lock&evidence=simulation` is shareable. Filters update URL state, not the underlying evidence. Numeric downloads retain original units and evidence labels.

## Updating results

Add/update a sanitized artifact in `cerebral-src/data/`, record its context and limitations, and update its SHA-256 in `benchmarks.json`. Every displayed index measurement must resolve to its source value, with an independent sample count for each measured workload. Add a dedicated validated adapter before attaching a numeric Cortex result. Retain negative controls for eval fixtures. Build and inspect the rendered page at desktop/mobile widths in both themes before opening a PR.

## Production handoff

The configured hostname was not resolvable when this work started; `cerebral.work` and the existing benchmark host resolved as controls. The hostname and Worker target are prepared in source. Merge/deployment and external DNS/edge changes remain operator-gated under the estate rules.

After approval, deploy the reviewed revision with `npm run deploy:cerebral` (or the estate `cf` deploy workflow where supported), then probe the real hostname, downloadable records and custom 404. The separate config keeps the model-bank deployment independent. No new credentials, Access changes or infrastructure application are part of this implementation.
