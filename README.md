# bench.unsigned.gg

Static [Cloudflare Worker](https://developers.cloudflare.com/workers/) serving
the model-benchmark dashboards at **[bench.unsigned.gg](https://bench.unsigned.gg)**.
Two pages, one growing pile of numbers:

- **`/`** (`public/index.html`) — the **local bank**: decode speed + MTP
  speculative-decoding gains, measured first-hand on an RTX 5090.
- **`/frontier`** — the **frontier leaderboard**: models we can't run at home,
  each score tagged with its provenance (independent / corroborated /
  self-reported / disputed).

Migrated out of the `agentic` monorepo (`packages/local-models/bench`) into its
own repo so it ships on its own CI/CD cadence.

## The benchmark data — `public/data/`

Numbers live as JSON so adding a benchmark is a data edit, not HTML surgery.
They sit under `public/` because only the assets root is served; the pages
`fetch()` them at load.

| File | What it holds | Schema |
|---|---|---|
| `public/data/frontier.json` | vendor frontier chart | `{ snapshot, source, provenance, model_sources, higher_is_better, models[], benchmarks[] }` — each benchmark `{ name, scores[] }`, `scores` aligned to `models` order |
| `public/data/swe-pro.json` | independent SWE-bench Pro board | `{ benchmark, source, url, verification, rows[] }` — each row `{ model, score, flag, note }` |
| `public/data/candidates.json` | models awaiting a run | `{ note, candidates[] }` |

Winners, runners-up, and provenance badges are computed in the page — never
hand-marked. Add a row, and the tables, win tally, and stat tiles recompute.

### House rule

**Humor is allowed; lying is not.** Snark about a score all you want — the score
itself stays honest, and unverified provenance gets *labeled* (see the Sakana /
Fugu disclaimer), never laundered into fact.

## Develop

```bash
npm install
npm run dev       # local preview at http://localhost:8787
npm run check     # wrangler dry-run build (no deploy, no auth)
```

## Deploy — CI/CD

Every push to `main` runs `.github/workflows/deploy.yml`: it validates the JSON
data, dry-run-builds the Worker, scans for secrets (pinned gitleaks), then
deploys to `bench.unsigned.gg` via
[`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action).

**One-time setup — add the deploy token** (the deploy step self-skips with a
warning until this exists, so CI stays green in the meantime):

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token**, template
   **"Edit Cloudflare Workers"** (scopes: `Account · Workers Scripts · Edit`,
   plus the zone for `unsigned.gg`).
2. Add it to the repo: **Settings → Secrets and variables → Actions → New
   repository secret**, name **`CLOUDFLARE_API_TOKEN`**.

The account ID is committed in `wrangler.jsonc` (not a secret). Wrangler and the
custom-domain route are pinned; bump deliberately.

Manual deploy (from a machine with `wrangler login`):

```bash
npm run deploy
```
