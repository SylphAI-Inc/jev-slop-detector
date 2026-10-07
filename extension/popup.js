const el = document.getElementById('status');
chrome.runtime.sendMessage({ type: 'health' }, (r) => {
  if (r && r.ok && r.body && r.body.keyConfigured) { el.textContent = 'Relay running, key configured.'; el.className = 'ok'; }
  else if (r && r.ok) { el.textContent = 'Relay running, but no API key.'; el.className = 'bad'; }
  else { el.textContent = 'Relay not running. Start it with: npm run relay'; el.className = 'bad'; }
});
