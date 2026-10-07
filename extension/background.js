// Service worker: the only place that talks to the local relay.
// The extension holds no API key; the relay does.
const RELAY = 'http://127.0.0.1:8790';

async function callRelay(path, init) {
  try {
    const res = await fetch(RELAY + path, init);
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: { code: 'relay_unreachable', message: 'Local relay is not running' } } };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'classify' && typeof msg.text === 'string') {
    callRelay('/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: msg.text }) }).then(sendResponse);
    return true;
  }
  if (msg && msg.type === 'health') {
    callRelay('/health').then(sendResponse);
    return true;
  }
  return false;
});
