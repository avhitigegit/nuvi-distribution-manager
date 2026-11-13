# Frontend — Chrome extension (v0.3)

The real app, built step by step from `../doc/IMPLEMENTATION_PLAN.md`.
Started in Step 4 as a copy of `../prototype` plus a Supabase connection.
Screens still use local storage; Steps 5–11 move them to Supabase.

## First-time setup
1. Copy `js/config.example.js` to `js/config.js` and fill in the Supabase
   Project URL and **publishable (anon) key**. `config.js` is git-ignored.
   Never put the `service_role` / secret key here.
2. `chrome://extensions` → **Developer mode** on → **Load unpacked** → choose this `client` folder.
3. Click the extension icon. The app opens in a tab.
4. Right-click the page → **Inspect** → **Console**. You should see `[NUVI] Connected to Supabase`.

After changing code: click **Reload** on the extension card in `chrome://extensions`.

## Files
| File | What it holds |
|---|---|
| `manifest.json` | MV3 manifest. `host_permissions` allows the Supabase project URL |
| `lib/supabase.js` | supabase-js **2.118.0** UMD build, bundled locally (MV3 forbids remote code). MIT licence in `lib/supabase.LICENSE` |
| `js/config.js` | Supabase URL + publishable key (git-ignored) |
| `js/db.js` | Creates `DB.client`, keeps the login session in `chrome.storage.local`, checks the connection |
| `js/store.js`, `js/engine.js`, `js/app.js`, `css/styles.css` | Screens and logic from the prototype |
| `background.js` | Opens the app in a tab when the icon is clicked |

To update the library: `npm pack @supabase/supabase-js@<version>`, then copy
`package/dist/umd/supabase.js` to `lib/supabase.js`.
