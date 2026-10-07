/* Scans X feed cards as they appear and attaches a label (and a stamp for
 * high-probability slop). Never hides, removes, or edits posts. Read-only. */
(function () {
  const { classify, createScorer, interpretRelayResponse } = SlopCore;
  const { cardKey, CardTracker } = SlopCards;

  const ARTICLE = 'article[data-testid="tweet"]';
  const TEXT = '[data-testid="tweetText"]';
  const EXPLAIN =
    'Classification probability from TypeSafe Jev on one yes/no question: does this post substitute unsupported hype for concrete substance? ' +
    'It is a model estimate, not verified truth, and not an AI-writing detector.';

  // Circuit breaker: after a hard failure, stop hitting the relay briefly.
  let pausedUntil = 0;
  const HARD = new Set(['upstream_auth', 'relay_unreachable', 'upstream_rejected']);

  async function request(text) {
    if (Date.now() < pausedUntil) {
      throw Object.assign(new Error('Paused after a previous failure'), { code: 'paused', retryable: false });
    }
    let resp;
    try { resp = await chrome.runtime.sendMessage({ type: 'classify', text }); }
    catch { resp = { ok: false, status: 0, body: null }; }
    try { return interpretRelayResponse(resp); }
    catch (err) { if (HARD.has(err.code)) pausedUntil = Date.now() + 30000; throw err; }
  }

  const scorer = createScorer({ request, concurrency: 3, retries: 2, baseMs: 800 });

  function readCard(el) {
    const textEl = el.querySelector(TEXT);
    const text = textEl ? textEl.innerText : '';
    const time = el.querySelector('time');
    const a = time && time.closest('a');
    const m = a && a.getAttribute('href') && a.getAttribute('href').match(/\/status\/(\d+)/);
    return { el, text, key: cardKey(m ? m[1] : null, text) };
  }

  const stamped = new Set(); // keys whose stamp already animated; re-renders don't replay it

  function removeWrap(el) { el.querySelectorAll(':scope > .jev-wrap').forEach((w) => w.remove()); }

  // The overlay lives on the card itself (not inside X's text wrapper) so it stacks above
  // media. It is absolutely positioned to the post text and adds no height to the layout.
  function place(el) {
    const wrap = el.querySelector(':scope > .jev-wrap');
    const textEl = el.querySelector(TEXT);
    if (!wrap || !textEl) return;
    const o = (wrap.offsetParent || el).getBoundingClientRect();
    const t = textEl.getBoundingClientRect();
    const box = { left: t.left - o.left, top: t.top - o.top, width: t.width, height: t.height };
    for (const k of Object.keys(box)) { const v = Math.round(box[k]) + 'px'; if (wrap.style[k] !== v) wrap.style[k] = v; }
  }

  function mount(el, key, verdict, build) {
    const textEl = el.querySelector(TEXT);
    if (!textEl) { removeWrap(el); return; }
    const existing = el.querySelector(':scope > .jev-wrap');
    if (existing && existing.dataset.jevKey === key && existing.dataset.jevVerdict === verdict) { place(el); return; }
    removeWrap(el);
    const wrap = document.createElement('div');
    wrap.className = 'jev-wrap';
    wrap.dataset.jevKey = key;
    wrap.dataset.jevVerdict = verdict;
    build(wrap);
    el.appendChild(wrap);
    place(el);
  }

  function render(el, key, prob) {
    const r = classify(prob);
    if (!r) return;
    if (!r.show) { removeWrap(el); return; } // unclear band: no label
    mount(el, key, r.verdict, (wrap) => {
      const badge = document.createElement('span');
      badge.className = `jev-badge jev-${r.verdict}`;
      badge.title = `${EXPLAIN}\n\nP(hype over substance) = ${prob.toFixed(2)}`;
      badge.innerHTML = '<i class="jev-dot"></i><span class="jev-label"></span><b class="jev-sep">|</b><span class="jev-pct"></span>';
      badge.querySelector('.jev-label').textContent = r.label;
      badge.querySelector('.jev-pct').textContent = `${r.percent}%`;
      wrap.appendChild(badge);
      if (r.stamp) {
        const s = document.createElement('div');
        s.className = 'jev-stamp' + (stamped.has(key) ? ' jev-no-anim' : '');
        s.setAttribute('aria-hidden', 'true');
        s.textContent = 'SLOP';
        wrap.appendChild(s);
        stamped.add(key);
      }
    });
  }

  function renderError(el, key, err) {
    mount(el, key, 'error', (wrap) => {
      const badge = document.createElement('span');
      badge.className = 'jev-badge jev-error';
      badge.title = 'Not scored: ' + (err && err.message ? err.message : 'classification unavailable') + '. No result is shown rather than a guess.';
      badge.innerHTML = '<i class="jev-dot"></i><span class="jev-label">Unscored</span>';
      wrap.appendChild(badge);
    });
  }

  const tracker = new CardTracker({
    score: (text) => scorer.score(text),
    render,
    clear: removeWrap,
    onError: renderError,
  });

  const visible = new Set();
  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { visible.add(e.target); tracker.sync(readCard(e.target)); }
      else visible.delete(e.target);
    }
  }, { rootMargin: '300px 0px' });

  function updateTheme() {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    if (!m) return;
    const lum = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
    document.documentElement.dataset.jevTheme = lum < 0.5 ? 'dark' : 'light';
  }

  let queued = false;
  function scan() {
    queued = false;
    updateTheme();
    for (const el of document.querySelectorAll(ARTICLE)) {
      if (!seen.has(el)) { seen.add(el); io.observe(el); }
    }
    for (const el of visible) {
      if (!el.isConnected) { visible.delete(el); tracker.forget(el); continue; }
      tracker.sync(readCard(el)); // idempotent; re-attaches after X re-renders
      place(el); // follow layout changes (Show more, images loading)
    }
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(scan); } };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  scan();
})();
