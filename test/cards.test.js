// Tests for card tracking with fake elements. These are logic fixtures, not a feed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cardKey, CardTracker } = require('../extension/lib/cards.js');

function harness(scoreImpl) {
  const dom = new Map(); // el -> rendered badge ("what the user would see")
  const calls = [];
  const errors = [];
  const tracker = new CardTracker({
    score: async (text) => { calls.push(text); return scoreImpl(text); },
    render: (el, key, prob) => dom.set(el, { key, prob }),
    clear: (el) => dom.delete(el),
    onError: (el, key, err) => dom.set(el, { key, error: err.message }),
    errorCooldownMs: 1000,
    now: () => harness.t,
  });
  harness.t = 0;
  return { dom, calls, errors, tracker };
}
const card = (el, id, text) => ({ el, text, key: cardKey(id, text) });
const tick = () => new Promise((r) => setImmediate(r));

test('cardKey prefers status id, falls back to normalized text, null when empty', () => {
  assert.equal(cardKey('123', 'x'), 'id:123');
  assert.equal(cardKey(null, '  Hello   world '), 'txt:Hello world');
  assert.equal(cardKey(null, '   '), null);
});

test('duplicate cards of the same post share one request and both get the badge', async () => {
  const h = harness(() => 0.9);
  const a = {}, b = {};
  await Promise.all([h.tracker.sync(card(a, '1', 'Same post text appears twice here.')), h.tracker.sync(card(b, '1', 'Same post text appears twice here.'))]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.dom.get(a).prob, 0.9); assert.equal(h.dom.get(b).prob, 0.9);
});

test('repeated sync (X re-render) is idempotent and does not re-request', async () => {
  const h = harness(() => 0.2);
  const a = {};
  await h.tracker.sync(card(a, '1', 'A stable post with enough text.'));
  h.dom.delete(a); // X wiped our badge during a re-render
  await h.tracker.sync(card(a, '1', 'A stable post with enough text.'));
  assert.equal(h.calls.length, 1);
  assert.equal(h.dom.get(a).prob, 0.2); // re-attached from memory
});

test('recycled node showing a different post drops the old badge and gets the right one', async () => {
  const h = harness((t) => (t.includes('hype') ? 0.95 : 0.1));
  const el = {};
  await h.tracker.sync(card(el, '1', 'Total hype about the future of everything.'));
  assert.equal(h.dom.get(el).key, 'id:1');
  const p = h.tracker.sync(card(el, '2', 'Plain note: fixed the bug in parser v2.'));
  assert.equal(h.dom.has(el), false); // stale badge removed immediately
  await p;
  assert.deepEqual(h.dom.get(el), { key: 'id:2', prob: 0.1 });
});

test('late result for an old post never lands on a recycled node', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const h = harness(async (t) => { if (t.includes('slow')) { await gate; return 0.99; } return 0.05; });
  const el = {};
  const slow = h.tracker.sync(card(el, '1', 'A slow post that resolves late.'));
  await tick();
  const fast = h.tracker.sync(card(el, '2', 'A quick different post text here.'));
  await fast;
  release(); await slow;
  assert.deepEqual(h.dom.get(el), { key: 'id:2', prob: 0.05 });
});

test('same text under two different ids is two cards (ids win over text)', async () => {
  const h = harness(() => 0.6);
  const a = {}, b = {};
  await h.tracker.sync(card(a, '1', 'Identical text from two accounts.'));
  await h.tracker.sync(card(b, '2', 'Identical text from two accounts.'));
  assert.equal(h.dom.get(a).key, 'id:1'); assert.equal(h.dom.get(b).key, 'id:2');
});

test('errors show an error state, never a number; retry only after cooldown', async () => {
  let fail = true;
  const h = harness(() => { if (fail) throw new Error('relay down'); return 0.75; });
  const el = {};
  await h.tracker.sync(card(el, '1', 'Post that fails to score at first.'));
  assert.deepEqual(h.dom.get(el), { key: 'id:1', error: 'relay down' });
  assert.equal(h.dom.get(el).prob, undefined);
  h.tracker.sync(card(el, '1', 'Post that fails to score at first.')); // within cooldown
  await tick(); assert.equal(h.calls.length, 1);
  harness.t = 5000; fail = false;
  await h.tracker.sync(card(el, '1', 'Post that fails to score at first.'));
  assert.equal(h.calls.length, 2); assert.equal(h.dom.get(el).prob, 0.75);
});

test('posts too short to score (null) get no badge and no repeated requests', async () => {
  const h = harness(() => null);
  const el = {};
  await h.tracker.sync(card(el, '1', 'ok'));
  await h.tracker.sync(card(el, '1', 'ok'));
  assert.equal(h.dom.has(el), false); assert.equal(h.calls.length, 1);
});

test('card with no key clears any previous badge', async () => {
  const h = harness(() => 0.9);
  const el = {};
  await h.tracker.sync(card(el, '1', 'Some real post text goes here.'));
  await h.tracker.sync({ el, text: '', key: null });
  assert.equal(h.dom.has(el), false);
});
