# Recording scripts

These scripts recorded the real X feed for the demo video. They capture a browser tab or the AdaL Desktop renderer as a stream of timestamped JPEG frames, then turn a stream into an MP4.

| File | What it does |
|---|---|
| `record.mjs` | Attaches over the Chrome DevTools Protocol (CDP) and records each matching tab into its own frame stream (`<out>/tab-N/`). It can also record the AdaL Desktop renderer and the agent-arena terminals. |
| `target-selection.mjs` | Helper for `record.mjs`. It picks exactly one Desktop target by id, session or URL, and refuses to guess. Keep it beside `record.mjs`. |
| `encode_stream.py` | Turns one frame stream into a 1920x1080 H.264 MP4 at a fixed frame rate. Each output frame shows the last frame captured at that moment, so timing stays real. |

Sources: `tests-jev-demo-1/record.mjs` and `adal/recorder-full-run-test/scripts/encode_stream.py`. They are copied here unchanged.

## Requirements

- Node 20 or newer, with `playwright` installed beside `record.mjs` (`npm i playwright`). Or set `ARENA_DEPENDENCIES` to a `package.json` that depends on it.
- `record.mjs` starts its own headless Chromium even when it only records an external browser. It needs Playwright's browser (`npx playwright install chromium`), or you can change the launch to `channel: 'chrome'` to use installed Chrome.
- Python 3 with Pillow, and `ffmpeg` on the `PATH`, for `encode_stream.py`.

## Record one browser tab

1. Start Chrome with a debug port, for example the AdaL shared browser on `9333`.
2. Give the tab you want a unique marker in its URL, for example `https://x.com/home#jevdemo-rec`. The shared browser also holds other agents' and the user's tabs. A broad filter such as `x\.com` records all of them.
3. Record:

```bash
ARENA_LIVE=0 \
ARENA_BROWSER_PORT=9333 \
ARENA_BROWSER_URLFILTER='jevdemo-rec' \
ARENA_CAPTURE_SECONDS=80 \
ARENA_OUT=/tmp/rec/take1 \
node record.mjs
```

The output is `/tmp/rec/take1/tab-1/` (frames plus `index.tsv`) and `director.log`. Each `index.tsv` line is `<epoch seconds>\t<frame file>`, and the last line is `END`.

## Encode a stream

`--start` and `--end` are epoch seconds on the same clock as `index.tsv`:

```bash
python3 encode_stream.py /tmp/rec/take1/tab-1 take1.mp4 \
  --start "$(head -1 /tmp/rec/take1/tab-1/index.tsv | cut -f1)" \
  --end   "$(tail -1 /tmp/rec/take1/tab-1/index.tsv | cut -f1)" --fps 30
```

Frames are fitted into 1920x1080 on a dark background. For a sharper close-up or a vertical crop, encode at the source size instead. The demo did this with `ffmpeg`'s concat demuxer and per-frame durations.

## Why recording browser use is hard

AdaL's browser tools have no recorder. The browser-use instructions say "There is no recorder", and the tools offer only one-off screenshots. Each workaround in this session hit a different limit:

| Problem | What happened |
|---|---|
| Shared browser | One Chrome process holds every agent's and the user's tabs. A URL filter of `x.com` recorded three tabs that were not ours, and those frames had to be deleted. |
| Screencast frame rate | CDP sends a frame only when the page repaints, so a still page gives few frames. The stream needs timestamps and a fixed-rate re-encode. |
| Screencast resolution | Frames come at layout size. Device pixel ratio is ignored, so a 1x layout gives soft close-ups. |
| Emulation is session-bound | A `setDeviceMetricsOverride` made for a sharper layout disappeared when the CDP session that set it went away. |
| Window claims drop | When a recorder or a second CDP client attached, the browser tool lost its claimed window ("The page this session claimed is gone"). A re-attach without a new window then pointed at another agent's tab. |
| OS screen recording | `screencapture -v` works and records real pixels, but it records whatever window is on top. Here that was the AdaL app or another window. Keystrokes for browser zoom went to the wrong app. |
| Painting | A minimized window stops painting, and an off-screen headed window renders at 1x. |

## Proposal

Add a recording tool to the browser capability, scoped to the agent's own claimed window, so no agent has to assemble this by hand.

1. **`record_start` and `record_stop` on the claimed target.** Start `Page.startScreencast` on the window's CDP target id from `window.py`, never on a URL filter. Other tabs cannot be recorded by mistake.
2. **One long-lived CDP session for the recording.** Hold it in the browser sidecar, so emulation overrides and the screencast survive between tool calls, and attaching the recorder does not drop the window claim.
3. **Sharp frames by default.** Lay the page out at 2x size with page zoom 2, as `record.mjs` does for its own pages, or emulate `deviceScaleFactor` on the same session. Close-ups and 9:16 crops then stay sharp.
4. **Keep the window painting.** Park it off-screen at normal size and never minimize it. This is the same approach as `agent-arena/live/server.mjs`.
5. **Markers.** `record_mark("stamp")` writes a beat on the frame clock, so edits and sound effects can land on exact moments, such as the SLOP stamp landing.
6. **One output format.** Write `frames/ + index.tsv + beats.json`, then encode with `encode_stream.py`, or write directly into a video project's `assets/` and register it in the bin.
7. **OS capture as an opt-in fallback.** Use `screencapture -v -R` only on a window the tool has raised and measured, for the rare case that needs real compositor pixels such as browser chrome or native dialogs.
