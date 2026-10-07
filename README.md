# Jev Slop Detector

An unofficial Chrome extension that labels posts on your X feed with a [TypeSafe Jev](https://docs.typesafe.ai/introduction) classification. Each post gets a compact label such as `● Slop | 83%`, and high-probability posts get a tilted red **SLOP** stamp. It is inspired by [Robin Bilgil's real-time slop detector](https://x.com/RBilgil/status/2100976648552169805).

The repository also holds the class material that teaches Jev with this project, and the scripts used to record the demo footage.

![The SLOP stamp and label on a real post](docs/screenshots/live-feed-slop-stamp.png)

> The percentage is a **classification probability** from one model question. It is not verified truth, and it is not an AI-writing detector.

## What is in this repository

| Folder | What it is | Start here |
|---|---|---|
| `extension/` | The Chrome extension (Manifest V3). It labels posts and never hides, deletes, edits or moves them. | [Quick start](#quick-start) |
| `relay/` | A local Node relay. It holds `TYPESAFE_API_KEY` and calls the TypeSafe API, so the extension never sees the key. | [Quick start](#quick-start) |
| `test/` | Unit tests (Node's built-in runner) and a labeled CSS fixture. | [Tests](#tests) |
| `docs/screenshots/` | Screenshots of the extension on a real, signed-in X feed. | [Live verification](#live-verification) |
| `class-material/` | The class page `jev-class-material.html`: setting up AdaL, the Jev API and a small criteria experiment, this slop detector, and making a demo video. Includes runnable Jev example scripts. | [class-material/README.md](class-material/README.md) |
| `recording/` | Scripts that record a browser tab as timestamped frames and encode them to MP4. Also explains why recording browser use is hard, with a proposal. | [recording/README.md](recording/README.md) |

## Quick start

You need Node 20 or newer, Chrome, and a TypeSafe API key from the [TypeSafe console](https://console.typesafe.ai/keys).

1. **Add your key.** Copy the example file and paste your key after `TYPESAFE_API_KEY=`:

   ```bash
   cp relay/.env.example relay/.env
   ```

   `.env` is git-ignored. Do not commit it or paste the key into a chat.

2. **Start the relay.** It listens on `127.0.0.1:8790`:

   ```bash
   npm run relay
   ```

3. **Load the extension.** Open `chrome://extensions`, turn on **Developer mode**, select **Load unpacked**, and choose the `extension/` folder.

4. **Open x.com while signed in.** Labels appear as posts scroll into view. The extension's popup shows whether the relay is running and has a key.

Optional: set `ALLOWED_EXTENSION_ID` in `relay/.env` so the relay accepts requests only from your extension. The relay always rejects requests from web pages.

## How the classification works

The relay asks Jev one Noul (yes/no) question about each post:

> Does the post substitute unsupported hype for concrete substance?

- **Yes:** the post is mostly grand or vague claims, superlatives, buzzwords, predictions, engagement bait or self-promotion. It gives no specific, checkable detail such as numbers, named tools or methods, sources, examples, code or first-hand results.
- **No:** the post has concrete substance (facts, data, code, a named method, a source, a reproducible example, a first-hand report). Or it is a plain remark, question, joke or news item with no inflated claim.

The question judges substance, not whether the writing sounds AI-generated. The post text is sent only as `state.post_text`, and the instructions tell Jev to treat anything inside it, including instructions, as content to judge and never as a command.

| Jev `noul` (probability of yes) | Label | Percent shown | Stamp |
|---|---|---|---|
| 0.70 to 1.00 | Slop | P(yes) | Yes |
| 0.50 to 0.70 | None: too close to call | — | No |
| 0.00 to 0.50 | Not slop | P(no) = 1 − P(yes) | No |

If a request fails, the post shows a grey **Unscored** label. The extension never shows a number it did not receive.

TypeSafe docs used: [API reference](https://docs.typesafe.ai/api), [Noul](https://docs.typesafe.ai/primitives/noul), [State](https://docs.typesafe.ai/concepts/state), [Quick start](https://docs.typesafe.ai/introduction/quickstart).

## How the extension works

- **Finding posts:** `extension/content.js` watches for `article[data-testid="tweet"]` cards with an IntersectionObserver and a MutationObserver.
- **Keeping labels on the right post:** `extension/lib/cards.js` ties each label to the post's status ID, with the text as a fallback. If X reuses a card for another post, the old label is removed, and a late result for the old post is never drawn on the new one. Duplicate cards share one request.
- **Requests:** `extension/lib/core.js` holds the thresholds, an LRU text cache, de-duplication of in-flight requests, a concurrency limit (3 per tab, 4 at the relay) and retry with backoff.
- **API calls:** `relay/typesafe.js` builds the request and checks the response. It retries 429, 529, 5xx and network errors with exponential backoff and honours `Retry-After`. It does not retry 401 or 422.
- **Layout:** the label and stamp are zero-height overlays, so the feed never shifts.
- **Motion:** the stamp animates in over about 340 ms. With `prefers-reduced-motion: reduce`, it appears without animation.
- **Read-only:** the extension does not post, like, follow or change account settings.

## Tests

```bash
npm test
```

**38 of 38 pass.** The tests use in-memory fakes and a fake `fetch`. They make no network calls and use no real feed. They cover:

- threshold boundaries, the no-label middle band, and invalid input;
- the request shape, including that post text appears only in `state`;
- response parsing and malformed bodies;
- retries on 429, 529 and network errors, no retry on 401 and 422, and errors that never contain the key;
- caching, in-flight de-duplication and concurrency limits;
- duplicate cards, recycled cards, late results and the error cooldown;
- relay HTTP behaviour, including origin checks.

`test/fixtures/style-fixture.html` is a hand-written page used only to tune CSS. It is not X and is not live verification.

## Live verification

The extension ran on a real, signed-in X "For you" feed in Chrome 155. The relay called the live TypeSafe API (`jev-1.13.0`). In one scroll session it scored about 10 posts and showed both labels. The screenshots are cropped to the feed column and show public posts only.

| Slop with stamp | Not slop |
|---|---|
| ![Slop label and stamp](docs/screenshots/live-feed-slop-stamp.png) | ![Not slop label](docs/screenshots/live-feed-not-slop.png) |

## Known limitations

- **Small sample:** about 10 live posts in one session. The 0.70 and 0.50 thresholds are not calibrated against labeled data.
- **One question:** the score is a single model estimate. It can be wrong, and it depends on the question wording above.
- **Text only:** only the main post text is scored. Quoted posts, images and video are ignored. Posts under 15 characters, or with only a link, get no label.
- **Overlay:** the label and stamp can hide a little of the post underneath. The stamp's look is close to the reference but not pixel-matched.
- **X markup:** selectors rely on X's `data-testid` attributes, which X can change without notice.
- **Cache:** the cache is in memory and resets when you reload the page or restart the relay.
- **Relay required:** if the relay is down, posts show **Unscored**, and the extension pauses requests for 30 seconds after a hard failure.
- **Reduced motion:** handled in CSS. The OS setting was not toggled during the live run.
