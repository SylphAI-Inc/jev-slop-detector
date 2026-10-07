#!/usr/bin/env python3
"""Run the Jev classification example. No third-party packages required."""
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ENDPOINT = "https://api.typesafe.ai/v1/systemone"
QUESTION = {
    "type": "noul",
    "instructions": (
        "Does this post substitute unsupported hype for concrete substance? "
        "Judge the claims, not whether the writing sounds AI-generated. "
        "Avoid a confident yes when the text is insufficient."
    ),
    "criteria": {
        "true": "Predominantly unsupported hype or implausible claims.",
        "false": "Concrete substance, bounded claims, or insufficient basis to label it hype.",
    },
}
CASES = [
    ("Concrete report", "I replaced the washer in my kitchen tap this morning. It was split on one edge. The leak stopped after I tightened the fitting."),
    ("Ordinary announcement", "We released version 1.2 today. It adds CSV export and fixes the login timeout. The release notes list the changes."),
    ("Exaggerated promise", "Our AI guarantees you will earn a million dollars in seven days with no effort, no skills, and zero risk. Buy now!"),
]


def load_key(env_file):
    key = os.environ.get("TYPESAFE_API_KEY", "").strip()
    if key:
        return key
    if env_file:
        # Read only the designated demo file; never print its contents.
        for line in Path(env_file).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:].strip()
            name, separator, value = line.partition("=")
            if separator and name.strip() == "TYPESAFE_API_KEY":
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                if value:
                    return value
    raise ValueError("Set TYPESAFE_API_KEY or pass --env-file with the demo .env path.")


def classify(text, key, with_criteria=True):
    question = dict(QUESTION)
    if not with_criteria:
        question.pop("criteria")
    payload = {"model": "jev-latest", "state": text,
               "questions": {"is_slop": question}}
    request = urllib.request.Request(
        ENDPOINT, data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        # Upstream bodies can contain sensitive data; show the status only.
        raise RuntimeError(f"Jev returned HTTP {error.code}") from None
    answer = result.get("answers", {}).get("is_slop", {})
    probability = answer.get("noul")
    if (answer.get("type") != "noul" or isinstance(probability, bool)
            or not isinstance(probability, (int, float))
            or not 0 <= probability <= 1):
        raise ValueError("Unexpected Jev response: expected a Noul value in [0, 1].")
    return result, round((time.perf_counter() - started) * 1000)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", help="Post to classify")
    parser.add_argument("--env-file", help="Explicit path to the demo .env; optional if the key is in the environment")
    parser.add_argument("--test", action="store_true", help="Run three contrasting examples")
    args = parser.parse_args()
    if not args.test and not args.text:
        parser.error("Pass --text or --test.")
    key = load_key(args.env_file)
    cases = CASES if args.test else [("Your post", args.text)]
    scores = []
    for label, text in cases:
        result, elapsed = classify(text, key)
        score = result["answers"]["is_slop"]["noul"]
        scores.append(score)
        print(json.dumps({"case": label, "state": text,
                          "response": result, "elapsed_ms": elapsed}, indent=2))
    if args.test:
        print(json.dumps({
            "directional_check": "PASS" if scores[2] > max(scores[:2]) else "FAIL",
            "meaning": "The exaggerated promise should score above the concrete examples.",
            "limitation": "Three examples do not establish accuracy or verify factual truth.",
        }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, urllib.error.URLError) as error:
        raise SystemExit(str(error))
