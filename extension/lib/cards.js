/* Card tracking: keeps results attached to the right post even when X
 * re-renders or recycles article nodes. DOM-free so it can be unit tested. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.SlopCards = factory(root.SlopCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  /** Stable identity for a post: status id when known, else normalized text. */
  function cardKey(statusId, text) {
    if (statusId) return 'id:' + statusId;
    const t = Core.normalizeText(text);
    return t ? 'txt:' + t : null;
  }

  /**
   * adapter: { score(text) -> Promise<number|null>, render(el, key, result), clear(el), onError?(el,key,err) }
   * A "card" is { el, key, text }. `el` is any object usable as a WeakMap key.
   */
  class CardTracker {
    constructor({ score, render, clear, onError, now = () => Date.now(), errorCooldownMs = 60000 }) {
      Object.assign(this, { scoreFn: score, renderFn: render, clearFn: clear, onError, now, errorCooldownMs });
      this.attached = new WeakMap(); // el -> key currently bound to that element
      this.entries = new Map();      // key -> { status, result, cards:Set<el>, errorAt }
    }

    /** Called for every (re)seen card. Idempotent. */
    sync(card) {
      const { el, key, text } = card;
      const prevKey = this.attached.get(el);
      if (prevKey && prevKey !== key) {
        // Node was recycled for a different post: drop the old badge and binding.
        this.clearFn(el);
        const old = this.entries.get(prevKey);
        if (old) old.cards.delete(el);
        this.attached.delete(el);
      }
      if (!key) { this.clearFn(el); return Promise.resolve(); }
      this.attached.set(el, key);

      let entry = this.entries.get(key);
      if (!entry) { entry = { status: 'new', result: null, cards: new Set(), errorAt: 0 }; this.entries.set(key, entry); }
      entry.cards.add(el);

      if (entry.status === 'done') { this.renderFn(el, key, entry.result); return Promise.resolve(); }
      if (entry.status === 'pending' || (entry.status === 'skipped' && entry.text === text)) return entry.promise || Promise.resolve();
      if (entry.status === 'error' && this.now() - entry.errorAt < this.errorCooldownMs) return Promise.resolve();

      entry.status = 'pending'; entry.text = text;
      entry.promise = Promise.resolve().then(() => this.scoreFn(text)).then((prob) => {
        if (prob === null || prob === undefined) { entry.status = 'skipped'; return; }
        entry.status = 'done'; entry.result = prob;
        for (const e of entry.cards) if (this.attached.get(e) === key) this.renderFn(e, key, prob);
      }, (err) => {
        entry.status = 'error'; entry.errorAt = this.now();
        if (this.onError) for (const e of entry.cards) if (this.attached.get(e) === key) this.onError(e, key, err);
      });
      return entry.promise;
    }

    /** Element removed from the page. */
    forget(el) {
      const key = this.attached.get(el);
      if (key) { const en = this.entries.get(key); if (en) en.cards.delete(el); }
      this.attached.delete(el);
    }
  }

  return { cardKey, CardTracker };
});
