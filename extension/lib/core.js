/* Shared, dependency-free logic. Loaded by the extension (as a global) and by
 * Node (require) for the relay and the unit tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SlopCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Noul value = probability that the answer to the slop question is "yes".
  const THRESHOLDS = Object.freeze({ slop: 0.7, lean: 0.5 });
  const MIN_CHARS = 15;
  const MAX_CHARS = 1500;

  /** Map a Noul probability to a verdict. Returns null for invalid input. */
  function classify(p, t = THRESHOLDS) {
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
    if (p >= t.slop) return { verdict: 'slop', label: 'Slop', percent: Math.round(p * 100), show: true, stamp: true, probability: p };
    // Middle band: too close to call, so no label is shown (better than a hedged one).
    if (p >= t.lean) return { verdict: 'unclear', label: null, percent: null, show: false, stamp: false, probability: p };
    return { verdict: 'not_slop', label: 'Not slop', percent: Math.round((1 - p) * 100), show: true, stamp: false, probability: p };
  }

  function normalizeText(text) {
    return String(text == null ? '' : text).normalize('NFKC').replace(/\s+/g, ' ').trim();
  }

  /** Text sent for scoring, or null when there is too little to judge. */
  function prepareText(text) {
    const t = normalizeText(text);
    const withoutUrls = t.replace(/https?:\/\/\S+/g, '').trim();
    if (withoutUrls.length < MIN_CHARS) return null;
    return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) : t;
  }

  class LruCache {
    constructor(max = 500) { this.max = max; this.map = new Map(); }
    has(k) { return this.map.has(k); }
    get(k) {
      if (!this.map.has(k)) return undefined;
      const v = this.map.get(k);
      this.map.delete(k); this.map.set(k, v);
      return v;
    }
    set(k, v) {
      this.map.delete(k); this.map.set(k, v);
      if (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    }
    get size() { return this.map.size; }
  }

  /** Run at most `max` async tasks at once; the rest wait in FIFO order. */
  function createLimiter(max) {
    let active = 0;
    const queue = [];
    const next = () => {
      if (active >= max || !queue.length) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
    };
    const run = (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
    run.stats = () => ({ active, queued: queue.length });
    return run;
  }

  /** Retry fn on errors where err.retryable is true, with exponential backoff. */
  async function withRetry(fn, { retries = 3, baseMs = 500, maxMs = 8000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    for (let attempt = 0; ; attempt++) {
      try { return await fn(attempt); } catch (err) {
        if (!err || !err.retryable || attempt >= retries) throw err;
        const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
        await sleep(Math.max(backoff, Math.min(err.retryAfterMs || 0, maxMs)));
      }
    }
  }

  /**
   * Cached, de-duplicated, concurrency-limited scoring.
   * request(text) must resolve to a probability in [0,1] or throw.
   * Only successful results are cached; errors are never cached or invented.
   */
  function createScorer({ request, cacheSize = 500, concurrency = 3, retries = 2, baseMs = 500, sleep } = {}) {
    const cache = new LruCache(cacheSize);
    const inflight = new Map();
    const limit = createLimiter(concurrency);
    const stats = { requests: 0, cacheHits: 0, joined: 0 };
    async function score(rawText) {
      const text = prepareText(rawText);
      if (text === null) return null;
      if (cache.has(text)) { stats.cacheHits++; return cache.get(text); }
      if (inflight.has(text)) { stats.joined++; return inflight.get(text); }
      const p = limit(() => withRetry(async () => {
        stats.requests++;
        const prob = await request(text);
        if (typeof prob !== 'number' || !Number.isFinite(prob) || prob < 0 || prob > 1) {
          throw Object.assign(new Error('Invalid probability from relay'), { retryable: false });
        }
        return prob;
      }, { retries, baseMs, sleep })).then((prob) => { cache.set(text, prob); return prob; })
        .finally(() => inflight.delete(text));
      inflight.set(text, p);
      return p;
    }
    return { score, stats, cache };
  }

  /**
   * Turn a relay reply {ok,status,body} into a probability or a typed error.
   * Transient failures (relay down, 429, 503) are retryable; auth/validation/bad shape are not.
   */
  function interpretRelayResponse(resp) {
    if (resp && resp.ok && resp.body && typeof resp.body.probability === 'number') return resp.body.probability;
    const status = resp && typeof resp.status === 'number' ? resp.status : 0;
    const e = resp && resp.body && resp.body.error;
    const err = new Error((e && e.message) || 'Classification unavailable');
    err.code = (e && e.code) || (status === 0 ? 'relay_unreachable' : 'unknown');
    err.status = status;
    err.retryable = status === 0 || status === 429 || status === 503;
    err.retryAfterMs = (e && e.retryAfterMs) || 0;
    throw err;
  }

  return { interpretRelayResponse, THRESHOLDS, MIN_CHARS, MAX_CHARS, classify, normalizeText, prepareText, LruCache, createLimiter, withRetry, createScorer };
});
