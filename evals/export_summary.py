"""Export inspect .eval transcripts into the dashboard's data dir.

Reads every log under evals/logs/, aggregates per-model accuracy + sample
count + token usage, writes public/data/benchoff.json for the existing static
dashboard. The .eval files remain the canonical evidence; this JSON is a view.

    uv run python export_summary.py [--logs logs] [--out ../public/data/benchoff.json]
"""

import argparse
import json
from pathlib import Path

from inspect_ai.log import list_eval_logs, read_eval_log


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--logs", default="logs")
    ap.add_argument("--out", default="../public/data/benchoff.json")
    args = ap.parse_args()

    results = {}
    for info in list_eval_logs(args.logs):
        log = read_eval_log(info, header_only=True)
        if log.status != "success" or not log.results:
            continue
        model = log.eval.model
        accuracy = None
        for score in log.results.scores:
            for name, metric in score.metrics.items():
                if name == "accuracy":
                    accuracy = metric.value
        usage = log.stats.model_usage.get(model)
        results[model] = {
            "task": log.eval.task,
            "accuracy": accuracy,
            "samples": log.results.total_samples,
            "input_tokens": usage.input_tokens if usage else None,
            "output_tokens": usage.output_tokens if usage else None,
            "run_id": log.eval.run_id,
            "created": log.eval.created,
        }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"benchoff": results}, indent=2, sort_keys=True) + "\n")
    print(f"wrote {out} ({len(results)} models)")


if __name__ == "__main__":
    main()
