export function selectTarget(targets, { targetId = '', sessionId = '', urlFilter = '' } = {}) {
  const regex = urlFilter ? new RegExp(urlFilter) : null;
  const matches = targets.filter(target => {
    if (target.type !== 'page') return false;
    if (targetId && target.targetId !== targetId) return false;
    if (sessionId) {
      try {
        if (new URL(target.url).searchParams.get('session') !== sessionId) return false;
      } catch { return false; }
    }
    return !regex || regex.test(target.url);
  });
  if (matches.length !== 1) {
    throw new Error(`Expected one UI target, found ${matches.length}. Select ARENA_UI_TARGET_ID from this list:\n${JSON.stringify(matches.length ? matches : targets, null, 2)}`);
  }
  return matches[0];
}
