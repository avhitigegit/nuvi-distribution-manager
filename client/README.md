# Frontend — Chrome extension (v0.5)

The real app, built step by step from `../doc/IMPLEMENTATION_PLAN.md`.
Started in Step 4 as a copy of `../prototype` plus a Supabase connection.
Login (Step 5) and profiles (Step 6) use Supabase. Groups, ads and campaigns still use local storage; Steps 7–11 move them.

## Website (main way to use it)
Hosted free on **Cloudflare Pages** from this folder (build output directory `client`, no build command).
Every push to `main` re-deploys it. `_headers` sets the security headers; `robots.txt` blocks search engines.

## As a Chrome extension (backup)
1. `js/config.js` holds the Supabase Project URL and **publishable (anon) key**
   (committed; the website needs it). Never put the `service_role` / secret key here.
2. `chrome://extensions` → **Developer mode** on → **Load unpacked** → choose this `client` folder.
3. Click the extension icon. The app opens in a tab.
4. Right-click the page → **Inspect** → **Console**. You should see `[NUVI] Connected to Supabase`.

After changing code: click **Reload** on the extension card in `chrome://extensions`.

## Files
| File | What it holds |
|---|---|
| `manifest.json` | MV3 manifest. `host_permissions` allows the Supabase project URL |
| `lib/supabase.js` | supabase-js **2.118.0** UMD build, bundled locally (MV3 forbids remote code). MIT licence in `lib/supabase.LICENSE` |
| `js/config.js` | Supabase URL + publishable key (committed; no secrets) |
| `_headers`, `robots.txt`, `favicon.svg` | Website-only: security headers, no search indexing, tab icon |
| `js/db.js` | Creates `DB.client`, keeps the login session in `chrome.storage.local`, checks the connection |
| `js/store.js`, `js/engine.js`, `js/app.js`, `css/styles.css` | Screens and logic from the prototype |
| `background.js` | Opens the app in a tab when the icon is clicked |

To update the library: `npm pack @supabase/supabase-js@<version>`, then copy
`package/dist/umd/supabase.js` to `lib/supabase.js`.
