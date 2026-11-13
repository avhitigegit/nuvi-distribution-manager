# NUVI Social Media Distribution Manager — Prototype (v0.2)

A simple, working prototype built from the three documents in `../doc`
(BRD, Technical Document, System Architecture). Plain HTML + CSS + JavaScript:
no build step, no libraries, no server.

## Run it

**A. In any browser:** double-click `index.html`.
Data is saved in the browser's localStorage. Group pages open in one re-used
second tab named `nuvi-distribution-tab`.

**B. As a Chrome extension:**
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this `prototype` folder.
3. Click the extension icon. The app opens in a full browser tab.

**First run:** a login window asks you to create the first account (name,
username and password). After that, it asks you to sign in.

## What changed in v0.2

| Request | Done |
|---|---|
| Two profiles now, more later | NUVI Engineering and NUVI IT are created on first run. **Settings → Profiles → + Add profile** adds more (name, short name, tag, colour and ad types). Each profile's data stays separate. |
| Full browser view | Sidebar layout with tables. On small screens the sidebar becomes a ☰ menu. |
| Login window | Local accounts. Passwords are stored as a salted SHA-256 hash. **Settings → Users** lets you add users, reset passwords and remove users. Logins are not included in backups. |
| Simpler groups | Fields: **Name\***, **URL\***, **Status\***, **Notes** (optional). Location was removed. Category is optional, from a short list: Property, IT & Software, Online Selling, Business, Community, Other (editable in Settings). |

Data saved by v0.1 is upgraded automatically: locations are dropped and
categories are mapped to the new list.

## Files

| File | What it holds |
|---|---|
| `index.html` | The app page (loads the 3 scripts) |
| `css/styles.css` | All styles. `--biz` is the selected profile's colour |
| `js/store.js` | Constants, messages, URL rules, CSV, storage, profiles, login (`Auth`), demo data |
| `js/engine.js` | Distribution engine: start, result, skip, prev, pause, resume, stop, and tab handling |
| `js/app.js` | All screens. There is one function per screen (`viewDashboard`, `viewGroups`, …) |
| `background.js` | Opens the app in a tab when the extension icon is clicked |
| `samples/groups-template.csv` | Test CSV with valid, invalid and duplicate rows |

CSV columns: `group_name, group_url, category, status, notes`. Only the first
two are required.

## Demo script

1. Create your account and sign in.
2. **Advertisements** → *Kiriwaththuduwa House for Sale* → **Distribute**.
3. **Select All** → **START DISTRIBUTION**. The first group opens in a second tab.
4. Come back to the app tab and click **Published → Next Group**. Try **Failed** with a reason, then **Skip**.
5. **Stop** the campaign, then use the **Resume** banner on the Dashboard.
6. **Settings → Profiles → + Add profile** (e.g. "NUVI Marketing"). It appears in the sidebar with its own empty data.
7. **Facebook Groups → Import CSV** → pick `samples/groups-template.csv`.

## Prototype notes

- The app is now a full tab, not a side panel. So you switch between the app
  tab and the group tab for each result. The side panel (BRD FR-032) avoided
  that switch. It can be added back later as a second view.
- The login protects the app screen only. All data is still stored unencrypted
  in this browser.
- The distribution engine runs in the page, not in the service worker. It
  saves before every navigation, so it can be moved later.
