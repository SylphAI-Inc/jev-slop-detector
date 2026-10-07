'use strict';
// Local relay. Holds TYPESAFE_API_KEY so the extension never sees it.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { LruCache, createLimiter } = require('../extension/lib/core.js');
const { classifyText, RelayError } = require('./typesafe.js');

/** Minimal .env reader (no dependency). Real environment variables win. */
function loadEnv(file = path.join(__dirname, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function createServer({ apiKey, allowedExtensionId = '', classify = classifyText, concurrency = 4, cacheSize = 1000, maxBody = 16 * 1024 } = {}) {
  const cache = new LruCache(cacheSize);
  const limit = createLimiter(concurrency);
  const inflight = new Map();

  const originOk = (origin) => {
    if (!origin) return true; // curl / health checks on this machine
    if (!origin.startsWith('chrome-extension://')) return false; // web pages cannot use the relay
    return !allowedExtensionId || origin === `chrome-extension://${allowedExtensionId}`;
  };

  const send = (res, status, obj, origin) => {
    const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (origin && originOk(origin)) { h['Access-Control-Allow-Origin'] = origin; h.Vary = 'Origin'; }
    res.writeHead(status, h);
    res.end(JSON.stringify(obj));
  };

  return http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (!originOk(origin)) return send(res, 403, { error: { code: 'forbidden_origin', message: 'Origin not allowed' } });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin || '', 'Access-Control-Allow-Methods': 'POST, GET', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' });
      return res.end();
    }
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, keyConfigured: Boolean(apiKey) }, origin);
    if (req.method !== 'POST' || req.url !== '/classify') return send(res, 404, { error: { code: 'not_found', message: 'Not found' } }, origin);

    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > maxBody) { req.destroy(); } else chunks.push(c); });
    req.on('end', async () => {
      if (size > maxBody) return;
      let text;
      try { text = JSON.parse(Buffer.concat(chunks).toString('utf8')).text; } catch { /* fallthrough */ }
      if (typeof text !== 'string') return send(res, 400, { error: { code: 'bad_request', message: 'Body must be {"text": string}' } }, origin);
      try {
        const key = text.replace(/\s+/g, ' ').trim();
        if (cache.has(key)) return send(res, 200, { ...cache.get(key), cached: true }, origin);
        let p = inflight.get(key);
        if (!p) {
          p = limit(() => classify({ apiKey, text })).then((r) => { cache.set(key, r); return r; }).finally(() => inflight.delete(key));
          inflight.set(key, p);
        }
        send(res, 200, { ...(await p), cached: false }, origin);
      } catch (e) {
        const known = e instanceof RelayError;
        if (!known) console.error('relay: unexpected error:', e && e.name); // never log message: could echo request data
        send(res, known ? e.status : 500, {
          error: { code: known ? e.code : 'internal', message: known ? e.message : 'Internal relay error', retryAfterMs: known ? e.retryAfterMs : 0 },
        }, origin);
      }
    });
  });
}

if (require.main === module) {
  loadEnv();
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('TYPESAFE_API_KEY is not set. Copy relay/.env.example to relay/.env and paste your key there yourself.');
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 8790;
  createServer({ apiKey: apiKey.trim(), allowedExtensionId: process.env.ALLOWED_EXTENSION_ID || '' })
    .listen(port, '127.0.0.1', () => console.log(`Jev slop relay listening on http://127.0.0.1:${port} (key loaded, not shown)`));
}

module.exports = { createServer, loadEnv };
