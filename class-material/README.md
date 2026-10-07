# Class material: Jev and the slop detector

The class page for this project, copied from `demos-idea-to-market-1/`. Open `jev-class-material.html` in a browser. It has four tabbed lessons:

1. **Set up AdaL:** install, open a project and sign in, open the visual IDE, and the class prerequisites.
2. **Jev:** the API's input and output, choosing a question type, and a small live experiment on whether adding `criteria` changes a Noul answer, with speed and cost (`#operations`) and how to run the examples.
3. **Jev slop detector:** Robin Bilgil's reference demo and the prompt used to build this extension with AdaL.
4. **Demo video:** preparing material, prompting, revising and exporting a real product demo.

## Files

| File | What it is |
|---|---|
| `jev-class-material.html` | The class page. It links to the files below with relative paths. |
| `jev_example.py` | One Jev Noul request ("does this post substitute unsupported hype for concrete substance?"), or `--test` for three contrasting examples. |
| `compare_criteria.py` | Paired live comparison of the detailed question with and without `criteria`, three repeats per case. |
| `compare_simple_question.py` | The same comparison with the deliberately vague question "Is this post slop?". |
| `jev-comparison-data.json` | The measured scores shown on the page. |
| `jev-reference-post.png` | Screenshot of Robin Bilgil's original post. It shows the reference product, not this extension. |

## Running the examples

The scripts use only the Python standard library. Run them from this folder. They read `TYPESAFE_API_KEY` from the environment, or from the git-ignored `../relay/.env` (see the main README for setup). They never print the key.

```bash
cd class-material
python3 jev_example.py --env-file ../relay/.env --test
python3 compare_criteria.py
python3 compare_simple_question.py
```

Changes from the originals: the key path in the two comparison scripts and in the page's run command, from `workspace/real-slop-detector/.env` to `../relay/.env`. Nothing else changed.

Check run on 6 October 2026 (`jev_example.py --test`, live API): concrete report 0.03, ordinary announcement 0.06, exaggerated promise 0.97, directional check PASS. Three examples show direction only; they do not measure accuracy.
