"""Bench-off task: MiniMax-M2.7 vs GLM-5.2 vs Kimi-K2.7-Code via the gateway.

Scaffold task-set (wave-1, 2026-07-08 program): small, deterministic,
string-verifiable coding samples — enough to exercise the full lane
(gateway -> model -> scorer -> .eval transcript -> dashboard JSON), NOT a
definitive capability ranking. Grow the dataset before treating deltas as
adoption evidence (the survey's rule: verify vendor numbers, never adopt on
marketing claims).

Run (bench key = the capped OPS-465 lane, never the shared interactive key):

    export LLM_BASE_URL=https://llm.unsigned.gg/v1
    export LLM_API_KEY=$UNSIGNED_LLM_BENCH_KEY
    uv run inspect eval tasks/benchoff.py \
        --model openai-api/llm/zai/GLM-5.2 \
        --model openai-api/llm/moonshotai/kimi-k2.7-code \
        --model openai-api/llm/minimax/minimax-m2.7
    # NOTE: openai-api/<service>/ (not openai/) — the plain openai provider
    # speaks the Responses API, which the gateway's upstream lanes 404
    # (verified live 2026-07-08); openai-api pins chat-completions.

.eval transcripts under logs/ are the canonical evidence (model-infra gap
survey decision); export_summary.py turns them into public/data/benchoff.json.
"""

from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.scorer import includes
from inspect_ai.solver import generate, system_message

SYSTEM = (
    "You are a precise coding assistant. Answer with ONLY the requested "
    "output — no prose, no markdown fences."
)

SAMPLES = [
    Sample(
        input="Write a Python one-liner expression (no assignment) that reverses the string s. Reply with only the expression.",
        target="s[::-1]",
    ),
    Sample(
        input="What does this Python print? `print(sorted({'b': 2, 'a': 1}))` Reply with only the printed output.",
        target="['a', 'b']",
    ),
    Sample(
        input="Give the exact jq filter to extract the field `id` from every element of a top-level JSON array. Reply with only the filter.",
        target=".[].id",
    ),
    Sample(
        input="In git, what single flag makes `git log` show one commit per line? Reply with only the flag.",
        target="--oneline",
    ),
    Sample(
        input="What is the exit status of `bash -c 'false || true'`? Reply with only the number.",
        target="0",
    ),
    Sample(
        input="Complete: a Kubernetes CronJob field that prevents overlapping runs is `concurrencyPolicy: ___`. Reply with only the value.",
        target="Forbid",
    ),
]


@task
def benchoff() -> Task:
    return Task(
        dataset=SAMPLES,
        solver=[system_message(SYSTEM), generate()],
        scorer=includes(),
    )
