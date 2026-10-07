// Relay HTTP tests: real local server, fake classifier. No TypeSafe calls, no key needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../relay/server.js');
const { RelayError } = require('../relay/typesafe.js');

async function withServer(opts, fn) {
  const srv = createServer({ apiKey: 'test-key-not-real', ...opts });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try { await fn(base); } finally { await new Promise((r) => srv.close(r)); }
}
const post = (base, body, headers = {}) => fetch(base + '/classify', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('health reports key configured without revealing it', async () => {
  await withServer({}, async (base) => {
    const t = await (await fetch(base + '/health')).text();
    assert.deepEqual(JSON.parse(t), { ok: true, keyConfigured: true });
    assert.ok(!t.includes('test-key-not-real'));
  });
});

test('classify returns probability; repeated text is served from cache', async () => {
  let calls = 0;
  await withServer({ classify: async () => { calls++; return { probability: 0.77, model: 'fixture' }; } }, async (base) => {
    const a = await (await post(base, { text: 'Some post text that is long enough.' })).json();
    const b = await (await post(base, { text: 'Some  post text that is long enough.' })).json();
    assert.equal(a.probability, 0.77); assert.equal(a.cached, false); assert.equal(b.cached, true); assert.equal(calls, 1);
  });
});

test('concurrent identical requests share one upstream call; upstream concurrency is capped', async () => {
  let calls = 0, active = 0, peak = 0;
  const classify = async () => { calls++; active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 20)); active--; return { probability: 0.4 }; };
  await withServer({ classify, concurrency: 2 }, async (base) => {
    await Promise.all([...Array(3)].map(() => post(base, { text: 'Identical text sent three times at once.' })));
    assert.equal(calls, 1);
    await Promise.all([...Array(6)].map((_, i) => post(base, { text: `Distinct post number ${i} with enough text.` })));
    assert.ok(peak <= 2);
  });
});

test('upstream failures become typed errors with no probability field', async () => {
  const classify = async () => { throw new RelayError('upstream_busy', 'busy', { status: 503, retryable: true, retryAfterMs: 1500 }); };
  await withServer({ classify }, async (base) => {
    const r = await post(base, { text: 'Some post text that is long enough.' });
    const j = await r.json();
    assert.equal(r.status, 503); assert.equal(j.error.code, 'upstream_busy'); assert.equal(j.error.retryAfterMs, 1500);
    assert.equal(j.probability, undefined);
  });
});

test('unexpected exceptions return a generic 500 (no internals leaked)', async () => {
  await withServer({ classify: async () => { throw new Error('boom test-key-not-real'); } }, async (base) => {
    const r = await post(base, { text: 'Some post text that is long enough.' });
    const t = await r.text();
    assert.equal(r.status, 500); assert.ok(!t.includes('boom')); assert.ok(!t.includes('test-key-not-real'));
  });
});

test('rejects bad bodies, unknown routes, and web-page origins', async () => {
  await withServer({ classify: async () => ({ probability: 0.5 }) }, async (base) => {
    assert.equal((await post(base, { nope: 1 })).status, 400);
    assert.equal((await fetch(base + '/other')).status, 404);
    assert.equal((await post(base, { text: 'Long enough text for the relay.' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(base, { text: 'Long enough text for the relay.' }, { Origin: 'chrome-extension://abc' })).status, 200);
  });
  await withServer({ allowedExtensionId: 'goodid', classify: async () => ({ probability: 0.5 }) }, async (base) => {
    assert.equal((await post(base, { text: 'Long enough text for the relay.' }, { Origin: 'chrome-extension://other' })).status, 403);
    assert.equal((await post(base, { text: 'Long enough text for the relay.' }, { Origin: 'chrome-extension://goodid' })).status, 200);
  });
});
