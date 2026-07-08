<!-- lineage
role: eval-harness-readme
conforms_to: ../README.md
consumes: agentic docs/eval/2026-07-07-* (verdicts: inspect-ai anchor, promptfoo gate, bench-off rule)
-->

# evals — inspect-ai harness + promptfoo merge gate

Greenfield lane from the 2026-07-08 research-implementation program. Two
layers, per the gap-closure verdicts:

- **inspect-ai** (`inspect-ai==0.3.244`, the PR #11 anchor) — deep evals.
  `.eval` transcripts under `logs/` are the **canonical evidence**;
  `export_summary.py` renders them into `public/data/benchoff.json` for the
  dashboard. First task: `tasks/benchoff.py` (MiniMax-M2.7 vs GLM-5.2 vs
  Kimi-K2.7-Code — a plumbing-scale task-set; grow it before treating deltas
  as adoption evidence).
- **promptfoo** (`.github/workflows/eval-gate.yml`, SHA-pinned action) —
  merge-blocking gateway regression on `evals/**` PRs: threshold 80, repeat 2,
  pass-1-of-2 flake tolerance, disk cache. Self-skips with a warning until the
  `UNSIGNED_LLM_BENCH_KEY` secret exists.

## Run the bench-off

```bash
cd evals && uv sync
export LLM_BASE_URL=https://llm.unsigned.gg/v1
export LLM_API_KEY=$UNSIGNED_LLM_BENCH_KEY   # capped OPS-465 lane key
# openai-api/<service>/... pins chat-completions; the plain openai provider
# uses the Responses API which upstream lanes 404 (verified 2026-07-08).
uv run inspect eval tasks/benchoff.py \
  --model openai-api/llm/zai/GLM-5.2 \
  --model openai-api/llm/moonshotai/kimi-k2.7-code \
  --model openai-api/llm/minimax/minimax-m2.7
uv run python export_summary.py
```

## Prereqs (operator)

1. paas PR #880 synced (mints the capped `bench` virtual key + adds the
   `minimax/minimax-m2.7` lane).
2. Repo secret `UNSIGNED_LLM_BENCH_KEY` = the bench key value (from OpenBao
   `secret/llm` property `bench-api-key`).
3. `CLOUDFLARE_API_TOKEN` still pending separately for the deploy job.
