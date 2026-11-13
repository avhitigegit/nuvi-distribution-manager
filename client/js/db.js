/* Supabase connection (Step 4).
   Creates the shared client `DB.client` and checks the connection on load.
   Login sessions are kept in chrome.storage.local, so they survive a Chrome
   restart (used from Step 5). */
const DB = (() => {
  const cfg = window.NUVI_CONFIG;
  const lib = window.supabase;

  // Session storage adapter: chrome.storage.local in the extension,
  // localStorage when the page is opened straight from disk.
  const storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
    ? {
        getItem: async k => (await chrome.storage.local.get(k))[k] ?? null,
        setItem: (k, v) => chrome.storage.local.set({ [k]: v }),
        removeItem: k => chrome.storage.local.remove(k)
      }
    : window.localStorage;

  let client = null;
  let problem = '';
  if (!lib || !lib.createClient) problem = 'lib/supabase.js did not load.';
  else if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_KEY) problem = 'js/config.js is missing. Copy js/config.example.js to js/config.js.';
  else if (/service_role|sb_secret_/.test(cfg.SUPABASE_KEY)) problem = 'config.js holds a secret key. Use the publishable (anon) key only.';
  else {
    client = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  // Reachability check: the public auth settings endpoint needs only the key.
  async function ping() {
    if (!client) { console.error('[NUVI] Not connected to Supabase: ' + problem); return { ok: false, error: problem }; }
    try {
      const res = await fetch(cfg.SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: cfg.SUPABASE_KEY } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const s = await res.json();
      console.log('[NUVI] Connected to Supabase');
      if (s.disable_signup === false) console.warn('[NUVI] Supabase sign-ups are ON. Turn them off: Authentication → Sign In / Providers.');
      return { ok: true, signupsOff: s.disable_signup === true };
    } catch (e) {
      console.error('[NUVI] Cannot reach Supabase: ' + e.message);
      return { ok: false, error: e.message };
    }
  }

  return { client, problem, ping, ready: ping() };
})();
