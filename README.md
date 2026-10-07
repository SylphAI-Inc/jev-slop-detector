# Jev Slop Detector (unofficial demo)

A Chrome extension inspired by [Robin Bilgil's real-time slop detector](https://x.com/RBilgil/status/2100976648552169805). It scans X feed cards as you scroll and overlays a compact label such as `● Slop | 83%`. High-probability posts also get a large tilted red **SLOP** stamp. Labels and stamp are zero-height overlays: they never hide, delete, edit or move posts. It is read-only: it does not post, like, follow, or touch account settings.

![Stamp on a real post](docs/screenshots/live-feed-slop-stamp.png)

## What the percentage means

The label is a **classification probability** from TypeSafe's Jev model. It is **not verified truth**, and it is **not an AI-writing detector**.

The relay asks Jev one Noul (yes/no) question about each post:

> Does the post substitute unsupported hype for concrete substance?

- **Yes** means mostly grand or vague claims, superlatives, buzzwords, predictions, engagement bait or self-promotion, with no specific, checkable detail (numbers, named tools or methods, sources, examples, code, first-hand results).
- **No** means concrete substance (facts, data, code, a named method, a source, a reproducible example, a first-hand report), or a plain remark, question, joke or news item with no inflated claim.
- The post text is sent only as `state.post_text`. The instructions tell the model to treat anything inside it, including instructions, as content and never as a command. They also tell it not to judge whether the writing sounds AI-generated.

| Jev `noul` (P of yes) | Label | Shown percent | Stamp |
|---|---|---|---|
| 0.70 to 1.00 | Slop | P(yes) | yes |
| 0.50 to 0.70 | none (too close to call) | n/a | no |
| 0.00 to 0.50 | Not slop | P(no) = 1 - P(yes) | no |

If a request fails, the post shows a grey "Unscored" label. No number is invented.

Sources: [API reference](https://docs.typesafe.ai/api), [Noul](https://docs.typesafe.ai/primitives/noul), [State](https://docs.typesafe.ai/concepts/state), [Quick start](https://docs.typesafe.ai/introduction/quickstart).

## Setup

Requires Node 20 or newer and Chrome.

1. `cp relay/.env.example relay/.env`, then paste your own key after `TYPESAFE_API_KEY=`. Do not paste it into chat or commit it; `.env` is git-ignored.
2. `npm run relay` starts the relay on `127.0.0.1:8790`. Only the relay holds the key.
3. Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select the `extension/` folder.
4. Open x.com while signed in. Labels appear as posts scroll into view. The extension popup shows whether the relay is up.

Optional: set `ALLOWED_EXTENSION_ID` in `.env` so the relay accepts only your extension. The relay rejects any request from a web-page origin.

## How it works

- `extension/content.js` finds `article[data-testid="tweet"]` cards with an IntersectionObserver and a MutationObserver.
- `extension/lib/cards.js` binds each label to the post's status ID (text is the fallback). If X recycles a card for another post, the old label is removed. A late result for an old post is never drawn on the new one. Duplicate cards share one request.
- `extension/lib/core.js` holds the thresholds, an LRU text cache, in-flight de-duplication, a concurrency limit (3 per tab, 4 at the relay) and retry with backoff.
- `relay/typesafe.js` builds the request and validates the response. It retries 429, 529, 5xx and network errors with exponential backoff, and honours `Retry-After`. It does not retry 401 or 422.
- The stamp animates in over about 340 ms. With `prefers-reduced-motion: reduce` it appears with no animation.

## Test results

`npm test`: **37 of 37 pass** (Node's built-in runner, no dependencies). They use in-memory fakes and a fake `fetch`; none call the network or use a real feed. They cover:

- threshold boundaries and invalid input;
- the request shape, including that post text appears only in `state`;
- response parsing and malformed bodies;
- 429, 529, 401, 422 and network retries, and that errors never contain the key;
- caching, in-flight de-duplication and concurrency caps;
- duplicate cards, recycled cards, late results, and the error cooldown;
- relay HTTP behavior, including origin checks.

`test/fixtures/style-fixture.html` is a hand-written page used only to tune CSS. It is **not** X and **not** live verification.

## Live verification

I ran the extension's own code on the real signed-in X "For you" feed (Chrome 155). It was loaded unpacked into the automation browser's profile over the DevTools protocol, with the relay calling the live TypeSafe API (`jev-1.13.0`). Across one scroll session it scored about 10 posts and showed both labels. Screenshots are cropped to the feed column and show public posts only.

| Slop + stamp | Not slop |
|---|---|
| ![](docs/screenshots/live-feed-slop-stamp.png) | ![](docs/screenshots/live-feed-not-slop.png) |

## Known limitations

- The sample is small, roughly 10 posts in one session. The 0.70 and 0.50 thresholds are not calibrated against labeled data.
- The score is a single-question model estimate. It can be wrong, and it reflects the question wording above.
- Only the main post text is scored. Quoted posts, images and video are ignored. Posts under 15 characters, or links only, get no label.
- The label sits over the top-right of whatever follows the post text, and the stamp covers part of the text. Both can hide a little of the post underneath. Its exact look is approximate, not pixel-matched to the reference.
- Selectors rely on X's `data-testid` attributes, which X can change without notice.
- The cache is in memory and resets on reload or relay restart.
- The relay is a local process. If it is down, posts show "Unscored" and the extension pauses requests for 30 seconds after a hard failure.
- `prefers-reduced-motion` is handled in CSS. I did not toggle the OS setting during the live run.
- Another unrelated slop-detector extension was installed in the same browser profile. The screenshots above are from this project's classes (`.jev-badge`, `.jev-stamp`) only.
