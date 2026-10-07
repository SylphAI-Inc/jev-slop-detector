// Records the run as two high quality frame streams, one page on the terminals and one on the
// browsers, with no live camera work. The terminal-to-browser switch, speed changes and zooms on
// the outputs are all done afterwards in cut.py, from 4K frames, so zooms stay sharp.
//
// Run:  node record2.mjs              the real take (the demo server must be running)
//       TEST_SECONDS=20 node record2.mjs   capture only, no prompt, to measure quality and size
import { createRequire } from 'node:module';
import { selectTarget } from './target-selection.mjs';
const localRequire = createRequire(import.meta.url);
let playwright;
try {
  playwright = localRequire('playwright');
} catch (error) {
  if (!process.env.ARENA_DEPENDENCIES) {
    throw new Error('Install playwright beside the recorder or set ARENA_DEPENDENCIES to a package.json whose dependencies include playwright.', { cause: error });
  }
  playwright = createRequire(process.env.ARENA_DEPENDENCIES)('playwright');
}
const { chromium } = playwright;
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const BASE = `http://127.0.0.1:${process.env.PORT || 4477}`;
// The live page's agent folders. Set ARENA_WORKSPACE if the live page was started with custom *_CWD folders.
const WORKSPACE = process.env.ARENA_WORKSPACE || path.join(os.homedir(), 'agent-arena', 'workspace');
// Subset of agents to run, e.g. ARENA_AGENTS=adal for a solo take. Panes not listed never launch.
const AGENTS = (process.env.ARENA_AGENTS || 'claude,codex,adal').split(',').map((a) => a.trim()).filter(Boolean);
// When set, the AdaL Desktop renderer (Electron, dev mode) is recorded as a third stream alongside
// the terminals and browsers, e.g. ARENA_DESKTOP_PORT=9222. The recorder only attaches over CDP;
// it never launches, restarts or closes the desktop app.
const DESKTOP_PORT = process.env.ARENA_DESKTOP_PORT || '';
// When set, the browser the agent drives is recorded as another stream, e.g. ARENA_BROWSER_PORT=9333
// (AdaL's shared browser-use Chrome). ARENA_BROWSER_URLFILTER (JS regex) narrows it to the tabs AdaL
// opens, so the user's own tabs are not captured.
const BROWSER_PORT = process.env.ARENA_BROWSER_PORT || '';
const BROWSER_FILTER = process.env.ARENA_BROWSER_URLFILTER || '';
const MAX_RUN_MIN = Number(process.env.MAX_RUN_MIN || 45);
const TEST_SECONDS = Number(process.env.TEST_SECONDS || 0);
// 15 rather than 16: at 16 Claude Code's panes were 58 columns, and its redraw left stray letters
// between words. The 4K capture keeps 15 just as legible.
const FONT = Number(process.env.FONT || 15);
const DPR = 2;
const FAST_FPS = 30;
// The working stretch is sped up about 7x in the cut, so a lower capture rate still plays smoothly.
const SLOW_FPS = Number(process.env.SLOW_FPS || 6);

// The task typed into every CLI, one prompt for all three.
const PROMPT_FILE = process.env.ARENA_PROMPT_FILE || path.join(HERE, 'prompts', 'maps-top10.txt');
// Only the live CLI flow types a prompt; desktop-only captures may run without one.
const PROMPT = fs.existsSync(PROMPT_FILE) ? fs.readFileSync(PROMPT_FILE, 'utf8').replace(/\s*\n\s*/g, ' ').trim() : '';
// Optional: a file inside each agent's folder whose appearance means that agent is done
// (maps-top10 uses sf-indian-top10/results.md). Without it, done is judged from a quiet folder and no spinner.
const DONE_FILE = process.env.ARENA_DONE_FILE || '';
// Optional: check every pane shows its intended model before the prompt goes in,
// e.g. ARENA_EXPECT='claude=Sonnet 5,codex=gpt-5.6-terra,adal=GLM-5.3'. ADAL_MODEL switches AdaL first.
const EXPECT = Object.fromEntries(
  (process.env.ARENA_EXPECT || '').split(',').filter((p) => p.includes('=')).map((p) => [p.slice(0, p.indexOf('=')).trim(), p.slice(p.indexOf('=') + 1).trim()]),
);

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + (TEST_SECONDS ? '-test' : '');
const OUT = process.env.ARENA_OUT || path.join(HERE, 'out', 'raw', stamp);
fs.mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const beats = [];
const log = (msg) => {
  const line = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(OUT, 'director.log'), line + '\n');
};
// Beat times are epoch seconds, the same clock as the screencast frame timestamps.
const beat = (label) => {
  beats.push({ t: Date.now() / 1000, label });
  log(`beat ${label}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = async () => (await fetch(`${BASE}/api/state?lines=60`)).json();

// Headless by default: a headed window parked off-screen sits on no display, renders at 1x and
// ignores deviceScaleFactor, so frames came back 1920x1080. This page is text and photos, not
// WebGL, so headless renders it at full speed. HEADED=1 restores the parked window.
const browser = await chromium.launch(
  process.env.HEADED ? { headless: false, args: ['--window-position=8000,40'] } : { headless: true },
);

async function openView(name, view) {
  // Chrome's screencast captures at layout size and ignores device pixel ratio, so the page is laid
  // out at 3840x2160 and zoomed 2x: the same design as 1920x1080, with every pixel real.
  const context = await browser.newContext({ viewport: { width: 1920 * DPR, height: 1080 * DPR }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  // The browsers page only watches: its terminals are hidden and must never resize the CLIs.
  await page.goto(`${BASE}/?lock=1&clean=1&font=${FONT}&zoom=${DPR}${view === 'browser' ? '&watch=1' : ''}`);
  await page.waitForFunction(() => window.demo);
  await page.evaluate((v) => {
    window.demo.setClean(true);
    window.demo.setLineup(['claude', 'codex', 'adal']);
    if (v === 'browser') window.demo.setView('all', 'browser');
  }, view);
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const index = fs.createWriteStream(path.join(dir, 'index.tsv'));
  const cdp = await context.newCDPSession(page);
  const v = { name, context, page, cdp, dir, index, fps: FAST_FPS, n: 0, lastKept: 0, bytes: 0, live: true };
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    const t = metadata.timestamp;
    if (t - v.lastKept < 1 / v.fps - 0.002) return;
    v.lastKept = t;
    const file = `${String(++v.n).padStart(6, '0')}.jpg`;
    const buf = Buffer.from(data, 'base64');
    v.bytes += buf.length;
    fs.writeFile(path.join(dir, file), buf, () => {});
    index.write(`${t}\t${file}\n`);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920 * DPR, maxHeight: 1080 * DPR, everyNthFrame: 1 });
  return v;
}

// One screencast stream for an externally attached CDP target (Electron renderer, a Chrome tab).
// Writes frames to OUT/<name>/ with the same clock; closes by disconnecting, never killing the app.
async function screencastExternal(name, ctx, page) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const index = fs.createWriteStream(path.join(dir, 'index.tsv'));
  const cdp = await ctx.newCDPSession(page);
  const v = { name, context: ctx, page, cdp, dir, index, fps: FAST_FPS, n: 0, lastKept: 0, bytes: 0 };
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    const t = metadata.timestamp;
    if (t - v.lastKept < 1 / v.fps - 0.002) return;
    v.lastKept = t;
    const file = `${String(++v.n).padStart(6, '0')}.jpg`;
    const buf = Buffer.from(data, 'base64');
    v.bytes += buf.length;
    fs.writeFile(path.join(dir, file), buf, () => {});
    index.write(`${t}\t${file}\n`);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920 * DPR, maxHeight: 1080 * DPR, everyNthFrame: 1 });
  return v;
}

// Screencast of the AdaL Desktop renderer over its DevTools port (dev mode exposes 9222).
// Attaches to the app's own Chromium; frames land in a third stream with the same clock.
async function openDesktopView() {
  const endpoint = process.env.ARENA_UI_ENDPOINT || (DESKTOP_PORT ? `http://127.0.0.1:${DESKTOP_PORT}` : '');
  if (!endpoint) return null;
  const desktop = await chromium.connectOverCDP(endpoint);
  try {
    const candidates = [];
    for (const context of desktop.contexts()) {
      for (const page of context.pages()) {
        const probe = await context.newCDPSession(page);
        const { targetInfo } = await probe.send('Target.getTargetInfo');
        await probe.detach();
        candidates.push({ ...targetInfo, page, context });
      }
    }
    const selected = selectTarget(candidates.map(({ page, context, ...info }) => info), {
      targetId: process.env.ARENA_UI_TARGET_ID || '',
      sessionId: process.env.ARENA_SESSION_ID || '',
      urlFilter: process.env.ARENA_UI_URLFILTER || '',
    });
    const pick = candidates.find(candidate => candidate.targetId === selected.targetId);
    fs.writeFileSync(path.join(OUT, 'ui-target.json'), JSON.stringify({ endpoint, ...selected }, null, 2));
    log(`UI target ${selected.targetId}: ${selected.url}`);
    const view = await screencastExternal('desktop', pick.context, pick.page);
    view.desktop = desktop;
    view.targetId = selected.targetId;
    return view;
  } catch (error) {
    await desktop.close().catch(() => {});
    throw error;
  }
}

// Screencasts of the browser the agent drives. Every existing tab that matches the filter gets its
// own stream (tab-1, tab-2, ...); tabs opened later are picked up by watchBrowser below.
async function openBrowserViews(chrome) {
  if (!chrome) return [];
  const re = BROWSER_FILTER ? new RegExp(BROWSER_FILTER) : null;
  const made = [];
  let i = 0;
  for (const ctx of chrome.contexts()) {
    for (const p of ctx.pages()) {
      const url = p.url();
      if (/^devtools:|^chrome:\/\//.test(url)) continue;
      if (re && !re.test(url)) continue;
      const v = await screencastExternal(`tab-${++i}`, ctx, p);
      v.browser = chrome;
      log(`browser tab-${i}: ${url.slice(0, 80)}`);
      made.push(v);
    }
  }
  if (!made.length) log(`no matching tabs on browser port ${port0(BROWSER_PORT)} yet — watchBrowser will add streams when tabs appear`);
  return made;
}
const port0 = (p) => p;

// Attach a screencast to tabs that appear after the take started. Polled; a new matching page
// gets its own stream, so the cut can switch to it by timestamp.
async function watchBrowser(existing, chrome) {
  if (!BROWSER_PORT) return;
  const re = BROWSER_FILTER ? new RegExp(BROWSER_FILTER) : null;
  for (const ctx of chrome.contexts()) {
    for (const p of ctx.pages()) {
      if (existing.some((v) => v.page === p)) continue;
      const url = p.url();
      if (/^devtools:|^chrome:\/\//.test(url)) continue;
      if (re && !re.test(url)) continue;
      const v = await screencastExternal(`tab-${existing.length + 1}`, ctx, p);
      v.browser = chrome;
      log(`browser tab-${existing.length + 1} appeared: ${url.slice(0, 80)}`);
      existing.push(v);
      views.push(v);
    }
  }
}

const views = [];
let chrome = null;
let finished = false;
let stopping = false;
process.on('SIGINT', () => { stopping = true; });

async function finish(code) {
  if (finished) return;
  finished = true;
  const end = Date.now() / 1000;
  for (const v of views) {
    await v.cdp.send('Page.stopScreencast').catch(() => {});
    v.index.write(`${end}\tEND\n`);
    v.index.end();
    // The desktop stream is attached to the running app: disconnect only, never close it.
    await v.cdp.detach().catch(() => {});
    log(`${v.name}: ${v.n} frames, ${(v.bytes / 1e9).toFixed(2)} GB`);
  }
  for (const connection of new Set(views.map(v => v.desktop).filter(Boolean))) {
    await connection.close().catch(() => {});
  }
  if (chrome) await chrome.close().catch(() => {});
  const full = process.env.ARENA_LIVE === '0' ? {} : await fetch(`${BASE}/api/state?lines=3000`).then((r) => r.json()).catch(() => ({}));
  for (const a of AGENTS) fs.writeFileSync(path.join(OUT, `${a}-terminal.txt`), full[a]?.screen || '');
  fs.writeFileSync(path.join(OUT, 'beats.json'), JSON.stringify({ beats, font: FONT, dpr: DPR }, null, 2));
  await sleep(1500);
  await browser.close();
  process.exit(code);
}

const setFps = (fps) => views.forEach((v) => (v.fps = fps));
const everyPage = (fn, arg) => Promise.all(views.filter((v) => v.live).map((v) => v.page.evaluate(fn, arg)));

try {
  const LIVE_ONLY = process.env.ARENA_LIVE !== '0';
  if (LIVE_ONLY) {
    views.push(await openView('terminals', 'term'));
    views.push(await openView('browsers', 'browser'));
  } else {
    log('ARENA_LIVE=0: recording no CLI panes');
  }
  const T = views[0];
  const desktopView = await openDesktopView();
  if (desktopView) views.push(desktopView);
  chrome = BROWSER_PORT ? await chromium.connectOverCDP(`http://127.0.0.1:${BROWSER_PORT}`) : null;
  views.push(...(chrome ? await openBrowserViews(chrome) : []));

  if (LIVE_ONLY) for (let i = 0; ; i++) {
    const s = await state();
    // First run in a new folder: Claude Code defaults its trust prompt to "No, exit", so move down, then confirm.
    if (AGENTS.includes('claude') && /Quick safety check|Yes, I trust this folder/.test(s.claude?.screen || '')) {
      await T.page.evaluate(() => window.demo.panes.claude.ws.send(JSON.stringify({ t: 'in', d: '\x1b[B' })));
      await sleep(400);
      await T.page.evaluate(() => window.demo.panes.claude.ws.send(JSON.stringify({ t: 'in', d: '\r' })));
      log('answered Claude Code trust prompt');
      await sleep(2500);
      continue;
    }
    if (AGENTS.includes('codex') && s.codex?.screen.includes('Do you trust')) {
      await T.page.evaluate(() => window.demo.panes.codex.ws.send(JSON.stringify({ t: 'in', d: '\r' })));
      log('answered Codex trust prompt');
      await sleep(2500);
      continue;
    }
    const ready = (a) => (a === 'claude' && s.claude?.screen.includes('❯')) || (a === 'codex' && /Ask Codex|›/.test(s.codex?.screen || '')) || (a === 'adal' && s.adal?.screen.includes('for quick reference'));
    if (AGENTS.every(ready)) break;
    if (i > 120) throw new Error('CLIs did not become ready');
    await sleep(1000);
  }
  if (LIVE_ONLY) log('all CLIs ready');

  if (LIVE_ONLY && process.env.ADAL_MODEL) {
    await T.page.evaluate((m) => window.demo.typePrompt('adal', `/model ${m}`), process.env.ADAL_MODEL);
    await sleep(4000);
  }
  await everyPage(() => Object.values(window.demo.panes).forEach((p) => (p.timer = { start: 0, end: 0, auto: false })));
  const s = LIVE_ONLY ? await state() : null;
  const wrong = LIVE_ONLY ? AGENTS.filter((a) => EXPECT[a] && !s[a].screen.toLowerCase().includes(EXPECT[a].toLowerCase())) : [];
  if (LIVE_ONLY && wrong.length) throw new Error(`model not confirmed on screen for: ${wrong.join(', ')}`);
  log(Object.keys(EXPECT).length ? `models confirmed on screen: ${JSON.stringify(EXPECT)}` : 'models not checked (set ARENA_EXPECT to check)');

  // Gate: every CLI must run at the size the terminals page shows, or its screen wraps into garbage.
  const shown = LIVE_ONLY ? await T.page.evaluate(() => Object.fromEntries(Object.entries(window.demo.panes).map(([a, p]) => [a, [p.term.cols, p.term.rows]]))) : null;
  const sizes = LIVE_ONLY ? await state() : null;
  const misfit = LIVE_ONLY && sizes ? AGENTS.filter((a) => sizes[a].cols !== shown[a][0] || sizes[a].rows !== shown[a][1]) : [];
  if (misfit.length) throw new Error(`terminal size mismatch: ${misfit.map((a) => `${a} cli ${sizes[a].cols}x${sizes[a].rows} vs page ${shown[a].join('x')}`).join(', ')}`);
  if (LIVE_ONLY) log(`terminal sizes match: ${AGENTS.map((a) => `${a} ${shown[a].join('x')}`).join(', ')}`);

  beat('ready');
  await sleep(4000);

  if (TEST_SECONDS) {
    setFps(SLOW_FPS);
    beat('slow');
    await sleep(TEST_SECONDS * 1000);
    setFps(FAST_FPS);
    beat('end');
    await finish(0);
  }

  if (process.env.ARENA_CAPTURE_SECONDS) {
    beat('capture');
    const sec = Number(process.env.ARENA_CAPTURE_SECONDS);
    for (let i = 0; i < sec; i++) {
      if (stopping) break;
      if (chrome) await watchBrowser(views.filter((v) => v.browser), chrome).catch((e) => log(`watchBrowser: ${e.message}`));
      await sleep(1000);
    }
    beat('end');
    await finish(0);
  }

  beat('prompt');
  if (LIVE_ONLY) await T.page.evaluate((text) => window.demo.typePrompt('all', text), PROMPT);
  // The browsers page did not type, so start its clocks at the same moment.
  if (LIVE_ONLY) await views[1].page.evaluate(() => Object.values(window.demo.panes).forEach((p) => (p.timer = { start: performance.now(), end: 0, auto: false })));
  const tPrompt = Date.now();
  beat('sent');
  setFps(SLOW_FPS);

  // Done means the results file exists, the folder has been quiet for a minute and no spinner shows.
  const BUSY = /esc to interrupt|ctrl\+c to cancel|Working \(|still thinking|\(\d+(m \d+)?s ·/i;
  // Seconds since anything in the agent's folder changed (two levels deep, dot folders skipped).
  const folderQuietSec = (a) => {
    let newest = 0;
    const walk = (dir, depth) => {
      for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        newest = Math.max(newest, fs.statSync(full).mtimeMs);
        if (e.isDirectory() && depth < 2) walk(full, depth + 1);
      }
    };
    walk(path.join(WORKSPACE, a), 0);
    return newest ? (Date.now() - newest) / 1000 : 0;
  };
  const doneAt = {};
  while (AGENTS.some((a) => !doneAt[a]) && Date.now() - tPrompt < MAX_RUN_MIN * 60e3) {
    if (stopping) throw new Error('stopped by hand');
    const st = await state();
    const blocked = AGENTS.find((a) => /requires approval, but approval policy is never|tool call was denied|model is at capacity/i.test(st[a].screen));
    if (blocked) throw new Error(`harness blocked ${blocked}'s tools:\n${st[blocked].screen}`);
    for (const a of AGENTS) {
      const done =
        st[a].exited ||
        (Date.now() - tPrompt > 90e3 &&
          (!DONE_FILE || fs.existsSync(path.join(WORKSPACE, a, DONE_FILE))) &&
          folderQuietSec(a) >= 60 &&
          !BUSY.test(st[a].screen.split('\n').slice(-12).join('\n')));
      if (!doneAt[a] && done) {
        doneAt[a] = (Date.now() - tPrompt) / 1000;
        beat(`done-${a}`);
      }
    }
    if (chrome) await watchBrowser(views.filter((v) => v.browser), chrome).catch((e) => log(`watchBrowser: ${e.message}`));
    await sleep(3000);
  }
  if (AGENTS.some((a) => !doneAt[a])) log(`run cap reached; unfinished: ${AGENTS.filter((a) => !doneAt[a]).join(', ')}`);
  fs.writeFileSync(path.join(OUT, 'done.json'), JSON.stringify(doneAt, null, 2));

  // Output phase: everything finished and still, captured at full rate for the zooms in the cut.
  setFps(FAST_FPS);
  beat('outputs');
  await sleep(12000);
  beat('end');
  await finish(0);
} catch (e) {
  log(`ERROR ${e.stack || e.message}`);
  await finish(1);
}
