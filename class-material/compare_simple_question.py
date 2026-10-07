"""Compare optional criteria when the instruction is intentionally vague."""
import json
from statistics import mean
import jev_example

jev_example.QUESTION = {
    **jev_example.QUESTION,
    "instructions": "Is this post slop?",
}
key = jev_example.load_key("../relay/.env")
cases = jev_example.CASES + [
    ("Generic launch copy", "Introducing Core, The Personal AI Computer. The most powerful technology humanity has built should belong to you. Order today."),
    ("Opinion", "I think this new model feels slower than the previous release. I prefer the old one."),
    ("Bounded benchmark claim", "In our test of 50 tasks, the model completed 32. We have not tested other workloads, and results may vary."),
]
for label, text in cases:
    scores = {"without": [], "with": []}
    models = set()
    for repeat in range(3):
        for with_criteria in ([False, True] if repeat % 2 == 0 else [True, False]):
            result, _ = jev_example.classify(text, key, with_criteria)
            scores["with" if with_criteria else "without"].append(
                result["answers"]["is_slop"]["noul"]
            )
            models.add(result["model"])
    print(json.dumps({
        "case": label,
        "without": scores["without"],
        "with": scores["with"],
        "without_mean": mean(scores["without"]),
        "with_mean": mean(scores["with"]),
        "delta_pp": 100 * (mean(scores["with"]) - mean(scores["without"])),
        "models": sorted(models),
    }), flush=True)
