/* "New version available" notice (website only).
   Each deploy writes version.json with the commit id. The page remembers the
   build it loaded with, checks again every 60 s and when the tab gets focus,
   and shows a Reload bar when a newer build is live. */
const Updates = (() => {
  let loaded = null;     // build the page started with
  let shown = false;
  const isWeb = location.protocol === 'https:' || location.protocol === 'http:';

  async function fetchBuild() {
    if (!isWeb) return null;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.commit ? j : null;
    } catch { return null; }
  }

  function showBar(next) {
    if (shown) return;
    shown = true;
    const bar = h('div', { class: 'update-bar', role: 'status' },
      h('span', {}, '🔄 A new version of the app is available' + (next.version ? ` (v${next.version})` : '') + '.'),
      h('button', { class: 'btn sm primary', onclick: () => location.reload() }, 'Reload now'));
    document.body.appendChild(bar);
  }

  async function check() {
    const b = await fetchBuild();
    if (!b) return;
    if (!loaded) { loaded = b; Updates.build = b; return; }
    if (b.commit !== loaded.commit) showBar(b);
  }

  function label() {
    const b = Updates.build;
    return `v${APP_VERSION}` + (b ? ` · build ${b.commit.slice(0, 7)}` : '');
  }

  async function start(onFirst) {
    await check();
    if (onFirst) onFirst();
    if (!isWeb) return;
    setInterval(check, 60 * 1000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  return { start, label, build: null };
})();
