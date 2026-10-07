// Unit tests. Everything here uses in-memory fakes; no network, no real feed.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/lib/core.js');

test('classify: thresholds and boundaries', () => {
  assert.deepEqual(pick(C.classify(0.7)), { verdict: 'slop', percent: 70, stamp: true });
  assert.deepEqual(pick(C.classify(0.699)), { verdict: 'unclear', percent: null, stamp: false });
  assert.deepEqual(pick(C.classify(0.5)), { verdict: 'unclear', percent: null, stamp: false });
  assert.deepEqual(pick(C.classify(0.499)), { verdict: 'not_slop', percent: 50, stamp: false });
  assert.deepEqual(pick(C.classify(0.38)), { verdict: 'not_slop', percent: 62, stamp: false }); // percent = P(no)
  assert.deepEqual(pick(C.classify(1)), { verdict: 'slop', percent: 100, stamp: true });
  assert.deepEqual(pick(C.classify(0)), { verdict: 'not_slop', percent: 100, stamp: false });
});
function pick(r) { return { verdict: r.verdict, percent: r.percent, stamp: r.stamp }; }
test('classify: middle band is unclear and not shown', () => {
  for (const p of [0.5, 0.6, 0.699]) { const r = C.classify(p); assert.equal(r.verdict, 'unclear'); assert.equal(r.show, false); assert.equal(r.label, null); }
  assert.equal(C.classify(0.7).show, true); assert.equal(C.classify(0.499).show, true);
});

test('classify: invalid probabilities yield null, never a guess', () => {
  for (const bad of [NaN, Infinity, -0.1, 1.1, '0.9', null, undefined, {}]) assert.equal(C.classify(bad), null);
});

test('classify: custom thresholds', () => {
  assert.equal(C.classify(0.8, { slop: 0.9, lean: 0.6 }).verdict, 'unclear');
});

test('prepareText: skips too-short and link-only text, truncates long text', () => {
  assert.equal(C.prepareText('lol'), null);
  assert.equal(C.prepareText('   https://t.co/abcdef   '), null);
  assert.equal(C.prepareText('a  b\n c'.repeat(1)), null);
  assert.equal(C.prepareText('This is a real sentence.\n\nWith   spacing.'), 'This is a real sentence. With spacing.');
  assert.equal(C.prepareText('x'.repeat(5000)).length, C.MAX_CHARS);
});

test('interpretRelayResponse: success and typed errors', () => {
  assert.equal(C.interpretRelayResponse({ ok: true, status: 200, body: { probability: 0.42 } }), 0.42);
  const err = (r) => { try { C.interpretRelayResponse(r); } catch (e) { return e; } };
  const down = err({ ok: false, status: 0, body: null });
  assert.equal(down.code, 'relay_unreachable'); assert.equal(down.retryable, true);
  const busy = err({ ok: false, status: 503, body: { error: { code: 'upstream_busy', message: 'busy', retryAfterMs: 2000 } } });
  assert.equal(busy.retryable, true); assert.equal(busy.retryAfterMs, 2000);
  const auth = err({ ok: false, status: 502, body: { error: { code: 'upstream_auth', message: 'key' } } });
  assert.equal(auth.retryable, false);
  // 200 with a missing/garbled probability is an error, not a number
  assert.ok(err({ ok: true, status: 200, body: { probability: 'high' } }));
  assert.ok(err({ ok: true, status: 200, body: {} }));
});

test('withRetry: backoff doubles, honours retryAfter, stops on non-retryable', async () => {
  const sleeps = [];
  const sleep = async (ms) => sleeps.push(ms);
  let n = 0;
  const v = await C.withRetry(async () => { if (++n < 4) throw Object.assign(new Error('x'), { retryable: true }); return 'ok'; }, { retries: 3, baseMs: 100, sleep });
  assert.equal(v, 'ok'); assert.deepEqual(sleeps, [100, 200, 400]);

  sleeps.length = 0; n = 0;
  await C.withRetry(async () => { if (++n < 2) throw Object.assign(new Error('x'), { retryable: true, retryAfterMs: 3000 }); }, { retries: 2, baseMs: 100, sleep });
  assert.deepEqual(sleeps, [3000]);

  n = 0;
  await assert.rejects(C.withRetry(async () => { n++; throw Object.assign(new Error('fatal'), { retryable: false }); }, { retries: 5, sleep }), /fatal/);
  assert.equal(n, 1);

  n = 0;
  await assert.rejects(C.withRetry(async () => { n++; throw Object.assign(new Error('still'), { retryable: true }); }, { retries: 2, baseMs: 1, sleep }), /still/);
  assert.equal(n, 3); // 1 try + 2 retries
});

test('createLimiter: never exceeds max concurrency', async () => {
  const limit = C.createLimiter(2);
  let active = 0, peak = 0;
  const task = () => limit(async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 10)); active--; });
  await Promise.all(Array.from({ length: 9 }, task));
  assert.equal(peak, 2);
});

test('LruCache evicts least recently used', () => {
  const c = new C.LruCache(2);
  c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3);
  assert.equal(c.has('b'), false); assert.equal(c.get('a'), 1); assert.equal(c.get('c'), 3);
});

test('scorer: caches repeated text, joins in-flight duplicates, limits concurrency', async () => {
  let calls = 0, active = 0, peak = 0;
  const request = async () => { calls++; active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 10)); active--; return 0.8; };
  const s = C.createScorer({ request, concurrency: 2 });
  const same = 'The exact same sentence appears twice.';
  const r = await Promise.all([s.score(same), s.score(same + '  '), s.score('A second distinct sentence here.'), s.score('A third distinct sentence here!!'), s.score('A fourth distinct sentence here??')]);
  assert.deepEqual(r, [0.8, 0.8, 0.8, 0.8, 0.8]);
  assert.equal(calls, 4); // duplicate text joined, not re-requested
  assert.ok(peak <= 2);
  await s.score(same); assert.equal(calls, 4); assert.equal(s.stats.cacheHits, 1);
});

test('scorer: errors are not cached and never produce a number', async () => {
  let n = 0;
  const request = async () => { n++; throw Object.assign(new Error('nope'), { retryable: false }); };
  const s = C.createScorer({ request });
  await assert.rejects(s.score('A perfectly fine long sentence.'), /nope/);
  await assert.rejects(s.score('A perfectly fine long sentence.'), /nope/);
  assert.equal(n, 2);
});

test('scorer: retries transient errors then succeeds; rejects out-of-range values', async () => {
  let n = 0;
  const s = C.createScorer({ request: async () => { if (++n < 3) throw Object.assign(new Error('t'), { retryable: true }); return 0.3; }, retries: 2, sleep: async () => {} });
  assert.equal(await s.score('Transient failures should be retried.'), 0.3);
  const bad = C.createScorer({ request: async () => 7, sleep: async () => {} });
  await assert.rejects(bad.score('Out of range value from relay.'), /Invalid probability/);
});

test('scorer: too-short text resolves null without a request', async () => {
  let n = 0;
  const s = C.createScorer({ request: async () => { n++; return 0.5; } });
  assert.equal(await s.score('hi'), null); assert.equal(n, 0);
});
