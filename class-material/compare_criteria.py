"""Paired live comparison: identical state/instructions, criteria on or off."""
import json
from statistics import mean
from jev_example import CASES, classify, load_key

key = load_key("../relay/.env")
cases = CASES + [
    ("Generic launch copy", "Introducing Core, The Personal AI Computer. The most powerful technology humanity has built should belong to you. Order today."),
    ("Opinion", "I think this new model feels slower than the previous release. I prefer the old one."),
    ("Bounded benchmark claim", "In our test of 50 tasks, the model completed 32. We have not tested other workloads, and results may vary."),
]
rows = []
for label, text in cases:
    scores = {"without": [], "with": []}
    models = set()
    for repeat in range(3):
        # Alternate request order to reduce ordering effects.
        for mode in ([False, True] if repeat % 2 == 0 else [True, False]):
            result, elapsed = classify(text, key, with_criteria=mode)
            scores["with" if mode else "without"].append(result["answers"]["is_slop"]["noul"])
            models.add(result["model"])
    row = {"case": label, "state": text, "without": scores["without"],
           "with": scores["with"], "without_mean": mean(scores["without"]),
           "with_mean": mean(scores["with"]), "models": sorted(models)}
    row["delta"] = row["with_mean"] - row["without_mean"]
    rows.append(row)
    print(json.dumps(row), flush=True)
print("RESULTS=" + json.dumps(rows), flush=True)
