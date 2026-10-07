# Class material: from loop and graph engineering to Jev

Material from Li Yin's talk on agent autonomy, which used this Jev slop detector as its live demo. It was copied from `adal/docs/adal/loop_graph_presentation/`.

## Contents

| File | What it is |
|---|---|
| `slides.html` | The deck as a single HTML page. Open it in a browser. |
| `article.html` / `article.md` | The long-form article version of the talk. |
| `talk-script-clean.md` | The talk transcript, cleaned. Its sections match the 15 slides. |
| `build_deck.js` | Builds the editable 16:9 PowerPoint deck with `pptxgenjs`. It loads the library from `../node_modules/pptxgenjs`, its path in the `adal` repo; here, run `npm i pptxgenjs` and change that `require` to `pptxgenjs`. |
| `scripts/build_google_slides.py` | Builds the 15-slide deck as native Google Slides. It uploads every image to Drive and shares each one with anyone who has the link, so check the images before running it. |
| `scripts/gws_client.py` | Small wrapper around the `gws` CLI that the Slides builder calls. It holds no credentials; `gws` uses its own login. |
| `assets/` | Images, QR codes and the two demo videos that the slides and article use. |

## Viewing

Open `slides.html` or `article.html` directly from this folder; the image paths are relative (`assets/...`).

## Not included

- `adal-autonomy-deck-2026-09-25.pptx` (64 MB). Rebuild it with `build_deck.js`, or get it from the `adal` repo.
- `assets/demo-preview/` (359 MB of raw recordings, some showing people other than the speaker).
- Four images the HTML references but that are missing in the source folder too: `17-agentic-loop-graph.png`, `adal-logo.png`, `babysitting-paradox.png` and `five-gaps-autonomy.png`. These show as broken images until they are added.
