/* =====================================================================
   app.js — UI: login, layout (sidebar), router, views, dialogs
   Each screen is one function: viewDashboard(), viewGroups(), ...
   User text is always inserted as text nodes (never innerHTML).
   ===================================================================== */

/* ---------- Tiny DOM helper ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach(c => {
    if (c == null || c === false) return;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return el;
}
const $ = sel => document.querySelector(sel);
const badge = st => h('span', { class: 'badge', style: `--c:${(STATUS[st] || {}).color || '#94a3b8'}` }, (STATUS[st] || {}).label || st);
const profileTag = p => h('span', { class: 'ptag', style: `--pc:${p.color}` }, p.tag);

/* ---------- App state ---------- */
const S = {
  view: 'dashboard', params: {},
  groupFilter: { q: '', category: '', status: '' },
  dist: { adId: '', selected: new Set(), q: '' },
  navOpen: false
};
const biz = () => Store.db.meta.lastBusinessId;
const B = () => Store.profile(biz());

function go(view, params = {}) { S.view = view; S.params = params; S.navOpen = false; render(); window.scrollTo(0, 0); }

/** Runs an action and shows errors as a toast. */
async function act(fn) {
  try { return await fn(); }
  catch (e) { console.error(e); toast(e instanceof AppError ? e.message : msg('E-SYS-01'), 'error'); }
}

/* ---------- Toasts & dialogs ---------- */
function toast(text, type = 'ok') {
  const t = h('div', { class: 'toast ' + type }, text);
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

function modal(title, body, buttons = [], wide = false) {
  const close = () => wrap.remove();
  const wrap = h('div', { class: 'modal-wrap', onclick: e => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : '') },
      h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'icon-btn', onclick: close, title: 'Close' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      buttons.length ? h('div', { class: 'modal-foot' }, buttons) : null));
  document.body.append(wrap);
  return { close, el: wrap };
}

function confirmBox(text, okLabel = 'Confirm', danger = false) {
  return new Promise(resolve => {
    const m = modal('Please confirm', h('p', {}, text), [
      h('button', { class: 'btn', onclick: () => { m.close(); resolve(false); } }, 'Cancel'),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { m.close(); resolve(true); } }, okLabel)
    ]);
  });
}

function promptReason(title) {
  return new Promise(resolve => {
    const ta = h('textarea', { rows: 3, maxlength: LIMITS.reason, placeholder: 'Optional, e.g. Group allows only personal profiles' });
    const m = modal(title, h('label', { class: 'field' }, h('span', {}, 'Reason (optional)'), ta), [
      h('button', { class: 'btn', onclick: () => { m.close(); resolve(null); } }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: () => { m.close(); resolve(ta.value.trim()); } }, 'Save & next group')
    ]);
    ta.focus();
  });
}

function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}

function pickFile(accept) {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept, style: 'display:none', onchange: () => { resolve(inp.files[0] || null); inp.remove(); } });
    document.body.append(inp); inp.click();
  });
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text;
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(msg('I-COPY-01'));
}

/** Builds a form field with live validation. Returns { el, input }. */
function makeField(state, key, label, input, { hint, touched, errEls } = {}) {
  errEls[key] = h('div', { class: 'err' });
  const onChange = e => { state.v[key] = e.target.value; touched[key] = true; state.check(); };
  input.addEventListener('input', onChange);
  input.addEventListener('blur', () => { touched[key] = true; state.check(); });
  return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('div', { class: 'muted small' }, hint) : null, errEls[key]);
}

/* =====================================================================
   Login screen
   ===================================================================== */
function viewLogin() {
  const v = { email: '', password: '' };
  const err = h('div', { class: 'err center' }, DB.client ? '' : msg('E-NET-02'));
  const btn = h('button', { class: 'btn primary block big', type: 'submit' }, 'Sign in');
  const inp = (key, attrs) => h('input', { ...attrs, oninput: e => { v[key] = e.target.value; err.textContent = ''; } });

  const submit = async e => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await Auth.login(v.email, v.password);
      S.view = 'dashboard'; render();
    } catch (ex) {
      err.textContent = ex instanceof AppError ? ex.message : msg('E-SYS-01');
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  };

  return h('div', { class: 'login-page' },
    h('form', { class: 'login-card', onsubmit: submit },
      h('div', { class: 'login-logo' }, 'N'),
      h('h1', {}, 'NUVI Distribution Manager'),
      h('p', { class: 'muted center' }, 'Sign in with your NUVI account.'),
      h('label', { class: 'field' }, h('span', {}, 'Email'), inp('email', { type: 'email', autocomplete: 'username', autofocus: true })),
      h('label', { class: 'field' }, h('span', {}, 'Password'), inp('password', { type: 'password', autocomplete: 'current-password' })),
      err, btn,
      h('p', { class: 'muted small center' }, 'Accounts are added by the owner in the Supabase dashboard. Forgot your password? The owner can reset it there.')));
}

/* =====================================================================
   Layout: sidebar + content
   ===================================================================== */
const NAV = [
  ['dashboard', 'Dashboard', '⌂'], ['groups', 'Facebook Groups', '☰'], ['ads', 'Advertisements', '▣'],
  ['distribute', 'Distribution', '➤'], ['history', 'Campaign History', '⟲'], ['settings', 'Settings', '⚙']
];
function activeNav() { return { campaign: 'history', summary: 'distribute' }[S.view] || S.view; }

function sidebar() {
  const me = Auth.current();
  const st = Engine.getState();
  return h('aside', { class: 'side' + (S.navOpen ? ' open' : '') },
    h('div', { class: 'side-brand' }, h('div', { class: 'logo' }, 'N'),
      h('div', {}, h('div', { class: 'brand-title' }, 'Distribution Manager'), h('div', { class: 'side-sub' }, 'NUVI · Facebook groups'))),

    h('div', { class: 'side-section' }, 'Profile'),
    h('div', { class: 'profiles' }, Store.profiles().map(p =>
      h('button', { class: 'profile-btn' + (p.id === biz() ? ' on' : ''), style: `--pc:${p.color}`,
        onclick: () => act(async () => { Store.db.meta.lastBusinessId = p.id; S.dist = { adId: '', selected: new Set(), q: '' }; await Store.save(); S.navOpen = false; render(); }) },
        h('span', { class: 'dot' }), h('span', { class: 'grow' }, p.short), h('span', { class: 'ptag-sm' }, p.tag)))),
    h('button', { class: 'side-link', onclick: () => go('settings', { tab: 'profiles' }) }, '+ Add / manage profiles'),

    h('div', { class: 'side-section' }, 'Menu'),
    h('nav', {}, NAV.map(([v, label, icon]) =>
      h('button', { class: 'nav-item' + (activeNav() === v ? ' on' : ''), onclick: () => go(v) },
        h('span', { class: 'ico' }, icon), label,
        v === 'distribute' && st.active ? h('span', { class: 'live-dot', title: 'Running' }) : null))),

    h('div', { class: 'side-foot' },
      h('div', { class: 'avatar' }, (me.name || '?').slice(0, 1).toUpperCase()),
      h('div', { class: 'grow', style: 'min-width:0' }, h('div', { class: 'b' }, me.name),
        h('div', { class: 'side-sub', style: 'overflow:hidden;text-overflow:ellipsis', title: me.email }, me.email)),
      h('button', { class: 'btn sm ghost-light', onclick: () => act(async () => { await Auth.logout(); render(); }) }, 'Log out')));
}

function topbar() {
  const st = Engine.getState();
  const p = B();
  return h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn menu-toggle', onclick: () => { S.navOpen = !S.navOpen; render(); }, title: 'Menu' }, '☰'),
    h('div', { class: 'top-profile' }, profileTag(p), h('div', {}, h('div', { class: 'b' }, p.name), h('div', { class: 'muted small' }, 'Only this profile’s groups, ads and campaigns are shown'))),
    h('span', { class: 'grow' }),
    st.active ? h('button', { class: 'running-chip', onclick: () => go('distribute') },
      `● ${st.campaign.status === 'PAUSED' ? 'Paused' : 'Running'}: ${st.campaign.id} (${st.current.index + 1}/${st.current.total}) — ${Store.profile(st.campaign.businessId).tag}`) : null);
}

function render() {
  const app = $('#app');
  if (!Auth.current()) { document.documentElement.style.setProperty('--biz', '#13213f'); app.replaceChildren(viewLogin()); return; }
  document.documentElement.style.setProperty('--biz', B().color);
  app.replaceChildren(h('div', { class: 'shell' },
    sidebar(),
    S.navOpen ? h('div', { class: 'scrim', onclick: () => { S.navOpen = false; render(); } }) : null,
    h('div', { class: 'content' }, topbar(), h('main', {}, VIEWS[S.view]()))));
}

const VIEWS = {
  dashboard: viewDashboard, groups: viewGroups, ads: viewAds, distribute: viewDistribute,
  summary: viewSummary, history: viewHistory, campaign: viewCampaign, settings: viewSettings
};

const card = (...kids) => h('section', { class: 'card' }, kids);
const pageTitle = (title, sub, ...actions) => h('div', { class: 'page-title' },
  h('div', {}, h('h2', {}, title), sub ? h('div', { class: 'muted' }, sub) : null), h('div', { class: 'row gap wrap' }, actions));

/* =====================================================================
   1. Dashboard  (FR-002, FR-025, FR-041 reminder)
   ===================================================================== */
function viewDashboard() {
  const groups = Store.listGroups(biz());
  const ads = Store.listAds(biz());
  const camps = Store.listCampaigns(biz());
  const st = Engine.getState();
  const active = groups.filter(g => g.status === 'ACTIVE').length;
  const banners = [];

  if (st.active) {
    banners.push(h('div', { class: 'banner info' },
      h('div', {}, h('b', {}, `${st.campaign.id} is ${st.campaign.status === 'PAUSED' ? 'paused' : 'in progress'}`),
        h('div', { class: 'small' }, `${st.campaign.adName} · group ${st.current.index + 1} of ${st.current.total} · ${Store.profile(st.campaign.businessId).short}`)),
      h('button', { class: 'btn primary sm', onclick: () => go('distribute') }, 'Open')));
  } else {
    const stopped = camps.find(c => c.status === 'STOPPED' || c.status === 'PAUSED');
    if (stopped) banners.push(h('div', { class: 'banner info' },
      h('div', {}, h('b', {}, `Resume ${stopped.id}`), h('div', { class: 'small' },
        `${stopped.adName} · ${stopped.items.filter(i => i.status === 'PENDING').length} groups still pending`)),
      h('button', { class: 'btn primary sm', onclick: () => act(async () => { await Engine.resume(stopped.id); go('distribute'); }) }, 'Resume')));
  }

  const last = Store.db.meta.lastBackupAt;
  const days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null;
  if (last == null || days >= Store.db.settings.backupReminderDays) {
    banners.push(h('div', { class: 'banner warn' },
      h('div', {}, last == null ? 'No backup has been made yet.' : msg('I-BAK-01', { days })),
      h('button', { class: 'btn sm', onclick: doBackup }, 'Back up now')));
  }

  const stat = (label, value, sub, view) => h('button', { class: 'stat', onclick: () => go(view) },
    h('div', { class: 'muted small' }, label), h('div', { class: 'stat-num' }, String(value).padStart(2, '0')), h('div', { class: 'muted small' }, sub));
  const totalPublished = camps.reduce((n, c) => n + c.items.filter(i => i.status === 'PUBLISHED').length, 0);

  return h('div', {},
    pageTitle('Dashboard', `Welcome, ${Auth.current().name}`,
      h('button', { class: 'btn primary', onclick: () => go('distribute') }, '➤ New distribution')),
    banners,
    h('div', { class: 'stats' },
      stat('Facebook Groups', groups.length, `${active} active · ${groups.length - active} inactive`, 'groups'),
      stat('Advertisements', ads.length, `${ads.filter(a => a.status === 'ACTIVE').length} active`, 'ads'),
      stat('Active Campaigns', st.active && st.campaign.businessId === biz() ? 1 : 0, `${camps.length} in history`, 'history'),
      stat('Shares Published', totalPublished, 'all campaigns', 'history')),
    h('div', { class: 'two' },
      card(h('div', { class: 'row between mb' }, h('h3', {}, 'Recent campaigns'), h('button', { class: 'link', onclick: () => go('history') }, 'View all ›')),
        camps.length ? campaignTable(camps.slice(0, 5)) : h('div', { class: 'empty' }, 'No campaigns yet.')),
      card(h('h3', {}, 'All profiles'),
        h('div', { class: 'list' }, Store.profiles().map(p => {
          const n = Object.values(Store.db.groups).filter(g => g.businessId === p.id).length;
          const a = Object.values(Store.db.ads).filter(x => x.businessId === p.id).length;
          return h('div', { class: 'list-row' + (p.id === biz() ? ' hl' : '') }, profileTag(p),
            h('div', { class: 'grow' }, h('div', { class: 'b' }, p.short), h('div', { class: 'muted small' }, `${n} groups · ${a} ads`)));
        })),
        h('button', { class: 'link mt', onclick: () => go('settings', { tab: 'profiles' }) }, '+ Add a profile'))),
    h('p', { class: 'muted small center' }, 'The application only opens group pages. You always share and post yourself.'));
}

/* =====================================================================
   2. Facebook Groups  (FR-004..010, FR-030, FR-031)
   Fields: Name *, URL *, Category, Status *, Notes
   ===================================================================== */
function viewGroups() {
  const all = Store.listGroups(biz());
  const f = S.groupFilter;
  if (f.category && !Store.db.settings.categories.includes(f.category)) f.category = '';
  const tbody = h('tbody', {});
  const countEl = h('span', {});

  const drawList = () => {
    const q = f.q.trim().toLowerCase();
    const rows = all.filter(g => (!q || g.name.toLowerCase().includes(q)) &&
      (!f.category || g.category === f.category) && (!f.status || g.status === f.status));
    countEl.textContent = `${rows.length} of ${all.length} groups`;
    tbody.replaceChildren(...(rows.length ? rows.map(g =>
      h('tr', { class: g.status === 'INACTIVE' ? 'dim' : '' },
        h('td', {}, h('div', { class: 'b' }, g.name), h('a', { class: 'muted small url', href: g.url, target: '_blank', rel: 'noopener' }, g.url.replace('https://www.', ''))),
        h('td', {}, g.category || '—'),
        h('td', {}, badge(g.status)),
        h('td', { class: 'small' }, g.notes || h('span', { class: 'muted' }, '—')),
        h('td', { class: 'right' }, h('button', { class: 'btn sm', onclick: () => groupForm(g) }, 'Edit'))))
      : [h('tr', {}, h('td', { colspan: 5, class: 'empty-cell' }, all.length ? 'No groups match your search.' : 'No groups yet. Add one or import a CSV.'))]));
  };

  let timer;
  const sel = (key, label, options) => h('select', { onchange: e => { f[key] = e.target.value; drawList(); } },
    h('option', { value: '' }, label), options.map(([v, t]) => h('option', { value: v, selected: f[key] === v }, t)));

  drawList();
  return h('div', {},
    pageTitle('Facebook Groups', `${B().short} · group directory`,
      h('button', { class: 'btn', onclick: csvImportDialog }, '⬆ Import CSV'),
      h('button', { class: 'btn', onclick: exportGroupsCSV }, '⬇ Export CSV'),
      h('button', { class: 'btn primary', onclick: () => groupForm() }, '+ Add group')),
    card(
      h('div', { class: 'toolbar' },
        h('input', { type: 'search', class: 'grow', placeholder: 'Search groups by name…', value: f.q,
          oninput: e => { f.q = e.target.value; clearTimeout(timer); timer = setTimeout(drawList, 150); } }),
        sel('category', 'All categories', Store.db.settings.categories.map(c => [c, c])),
        sel('status', 'Any status', [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']])),
      h('div', { class: 'muted small mb' }, countEl),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Group'), h('th', {}, 'Category'), h('th', {}, 'Status'), h('th', {}, 'Notes'), h('th', {}))),
        tbody))));
}

function groupForm(g) {
  const edit = !!g;
  const state = { v: g ? { ...g } : { businessId: biz(), name: '', url: '', category: '', status: 'ACTIVE', notes: '' } };
  const v = state.v;
  const touched = {}, errEls = {};
  const saveBtn = h('button', { class: 'btn primary' }, 'Save');
  state.check = () => {
    const e = validateGroup(v);
    Object.keys(errEls).forEach(k => { errEls[k].textContent = touched[k] ? errText(e[k], k) : ''; });
    saveBtn.disabled = Object.keys(e).length > 0;
  };
  const opt = { touched, errEls };

  const body = h('div', {},
    h('div', { class: 'muted small mb' }, 'Profile: ', h('b', {}, B().short)),
    makeField(state, 'name', 'Group name *', h('input', { value: v.name, maxlength: LIMITS.groupName, placeholder: 'Kiriwaththuduwa Api' }), opt),
    makeField(state, 'url', 'Group URL *', h('input', { value: v.url, placeholder: 'https://www.facebook.com/groups/233212924715137/' }), { ...opt, hint: 'Must be a facebook.com/groups/… link' }),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', {}, 'Status *'),
        h('select', { onchange: e => { v.status = e.target.value; } },
          h('option', { value: 'ACTIVE', selected: v.status === 'ACTIVE' }, 'Active'),
          h('option', { value: 'INACTIVE', selected: v.status === 'INACTIVE' }, 'Inactive'))),
      h('label', { class: 'field' }, h('span', {}, 'Category (optional)'),
        h('select', { onchange: e => { v.category = e.target.value; } },
          h('option', { value: '' }, '— None —'),
          Store.db.settings.categories.map(c => h('option', { value: c, selected: c === v.category }, c))))),
    makeField(state, 'notes', 'Notes (optional)', h('textarea', { rows: 3, maxlength: LIMITS.notes, placeholder: 'e.g. No shares, post the link only' }, v.notes), opt));

  saveBtn.onclick = () => act(async () => {
    Object.keys(errEls).forEach(k => touched[k] = true); state.check();
    if (saveBtn.disabled) return;
    await Store.saveGroup(v); m.close(); toast(edit ? 'Group updated.' : 'Group added.'); render();
  });

  const m = modal(edit ? 'Edit group' : 'Add group', body, [
    edit ? h('button', { class: 'btn danger-ghost', onclick: async () => {
      if (!await confirmBox(`Delete group "${g.name}"? Past campaign history will keep its name.`, 'Delete', true)) return;
      act(async () => { await Store.deleteGroup(g.id); m.close(); toast('Group deleted.'); render(); });
    } }, 'Delete') : null,
    h('span', { class: 'grow' }),
    h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), saveBtn]);
  if (edit) Object.keys(errEls).forEach(k => touched[k] = true);
  state.check();
}

async function csvImportDialog() {
  const file = await pickFile('.csv,text/csv');
  if (!file) return;
  const text = await file.text();
  let rows;
  try { rows = previewCSV(text, biz()); } catch (e) { toast(e.message, 'error'); return; }
  const valid = rows.filter(r => r.result === 'VALID');
  const n = k => rows.filter(r => r.result === k).length;
  const body = h('div', {},
    h('p', { class: 'small' }, `File: ${file.name} → ${B().short}`),
    h('p', { class: 'muted small' }, 'Columns: group_name, group_url, category (optional), status (optional), notes (optional)'),
    h('div', { class: 'row gap mb' },
      h('span', { class: 'badge', style: '--c:#15803d' }, `Valid ${n('VALID')}`),
      h('span', { class: 'badge', style: '--c:#b91c1c' }, `Invalid ${n('INVALID')}`),
      h('span', { class: 'badge', style: '--c:#d97706' }, `Duplicate ${n('DUPLICATE')}`)),
    h('div', { class: 'table-wrap tall' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Line'), h('th', {}, 'Group'), h('th', {}, 'Result'))),
      h('tbody', {}, rows.map(r => h('tr', {},
        h('td', {}, r.line), h('td', {}, r.data.name || '—', h('div', { class: 'muted small url' }, r.data.url)),
        h('td', {}, h('b', { class: 'r-' + r.result }, r.result), r.reason ? h('div', { class: 'muted small' }, r.reason) : null)))))));
  const m = modal('Import groups from CSV', body, [
    h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    h('button', { class: 'btn primary', disabled: !valid.length, onclick: () => act(async () => {
      const res = await Store.importGroups(biz(), valid.map(r => r.data));
      m.close(); toast(`${res.added} groups imported. ${rows.length - res.added} rows skipped.`); render();
    }) }, `Import ${valid.length} groups`)], true);
}

function exportGroupsCSV() {
  const lines = [CSV_COLUMNS.join(',')].concat(Store.listGroups(biz()).map(g =>
    [g.name, g.url, g.category, g.status === 'ACTIVE' ? 'Active' : 'Inactive', g.notes].map(csvEscape).join(',')));
  download(`nuvi-groups-${B().tag.toLowerCase()}-${todayStamp()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('Groups exported.');
}

/* =====================================================================
   3. Advertisements  (FR-011..015, FR-040)
   ===================================================================== */
function viewAds() {
  const ads = Store.listAds(biz());
  return h('div', {},
    pageTitle('Advertisements', `${B().short} · master posts already published on the Facebook Page`,
      h('button', { class: 'btn primary', onclick: () => adForm() }, '+ Add advertisement')),
    card(h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Advertisement'), h('th', {}, 'Type'), h('th', {}, 'Created'), h('th', {}, 'Status'), h('th', {}, 'Published in'), h('th', {}))),
      h('tbody', {}, ads.length ? ads.map(a => {
        const published = [...Store.publishedIndex(a.id).values()].filter(x => x.status === 'PUBLISHED').length;
        return h('tr', { class: a.status === 'ARCHIVED' ? 'dim' : '' },
          h('td', {}, h('div', { class: 'b' }, a.name), a.description ? h('div', { class: 'muted small' }, a.description) : null),
          h('td', {}, a.type), h('td', {}, fmtDate(a.createdAt)), h('td', {}, badge(a.status)),
          h('td', {}, h('button', { class: 'link', onclick: () => adDistributionView(a) }, `${published} group${published === 1 ? '' : 's'}`)),
          h('td', { class: 'right nowrap' },
            h('button', { class: 'icon-btn', title: 'Open post', onclick: () => Engine.openOriginal(a.postUrl) }, '↗'), ' ',
            h('button', { class: 'btn sm', onclick: () => adForm(a) }, 'Edit'), ' ',
            a.status === 'ACTIVE' ? h('button', { class: 'btn sm primary', onclick: () => { S.dist = { adId: a.id, selected: new Set(), q: '' }; go('distribute'); } }, 'Distribute') : null));
      }) : h('tr', {}, h('td', { colspan: 6, class: 'empty-cell' }, 'No advertisements yet.')))))));
}

function adForm(a) {
  const edit = !!a;
  const types = Store.db.settings.adTypes[biz()] || DEFAULT_AD_TYPES;
  const state = { v: a ? { ...a } : { businessId: biz(), name: '', postUrl: '', type: types[0], description: '', status: 'ACTIVE', createdAt: new Date().toISOString() } };
  const v = state.v;
  const touched = {}, errEls = {};
  const saveBtn = h('button', { class: 'btn primary' }, 'Save');
  state.check = () => {
    const e = validateAd(v);
    Object.keys(errEls).forEach(k => { errEls[k].textContent = touched[k] ? errText(e[k], k === 'name' ? 'adName' : k) : ''; });
    saveBtn.disabled = Object.keys(e).length > 0;
  };
  const opt = { touched, errEls };
  const body = h('div', {},
    h('div', { class: 'muted small mb' }, 'Profile: ', h('b', {}, B().short)),
    makeField(state, 'name', 'Advertisement name *', h('input', { value: v.name, maxlength: LIMITS.adName, placeholder: 'Kiriwaththuduwa House for Sale' }), opt),
    makeField(state, 'postUrl', 'Facebook post URL *', h('input', { value: v.postUrl, placeholder: 'https://www.facebook.com/NUVIEngineering/posts/…' }),
      { ...opt, hint: 'Tracking parameters (fbclid…) are removed on save. The post content is never read.' }),
    h('div', { class: 'grid3' },
      h('label', { class: 'field' }, h('span', {}, 'Type'),
        h('select', { onchange: e => { v.type = e.target.value; } }, types.map(t => h('option', { selected: t === v.type }, t)))),
      h('label', { class: 'field' }, h('span', {}, 'Status'),
        h('select', { onchange: e => { v.status = e.target.value; } }, ['ACTIVE', 'COMPLETED', 'ARCHIVED'].map(s => h('option', { value: s, selected: s === v.status }, STATUS[s].label)))),
      h('label', { class: 'field' }, h('span', {}, 'Created date'),
        h('input', { type: 'date', value: v.createdAt.slice(0, 10), onchange: e => { if (e.target.value) v.createdAt = new Date(e.target.value + 'T09:00:00').toISOString(); } }))),
    makeField(state, 'description', 'Description (optional)', h('textarea', { rows: 2, maxlength: LIMITS.description, placeholder: 'Two-bedroom house for sale' }, v.description), opt));

  saveBtn.onclick = () => act(async () => {
    Object.keys(errEls).forEach(k => touched[k] = true); state.check();
    if (saveBtn.disabled) return;
    await Store.saveAd(v); m.close(); toast(edit ? 'Advertisement updated.' : 'Advertisement added.'); render();
  });
  const del = async () => {
    if (Store.adHasHistory(a.id)) {
      if (!await confirmBox(`"${a.name}" has campaign history. Archive it instead? History is never lost.`, 'Archive')) return;
      return act(async () => { await Store.saveAd({ ...a, status: 'ARCHIVED' }); m.close(); toast('Advertisement archived.'); render(); });
    }
    if (!await confirmBox(msg('C-DEL-01', { name: a.name }), 'Delete', true)) return;
    act(async () => { await Store.deleteAd(a.id); m.close(); toast('Advertisement deleted.'); render(); });
  };
  const m = modal(edit ? 'Edit advertisement' : 'Add advertisement', body, [
    edit ? h('button', { class: 'btn danger-ghost', onclick: del }, 'Delete') : null, h('span', { class: 'grow' }),
    h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), saveBtn]);
  if (edit) Object.keys(errEls).forEach(k => touched[k] = true);
  state.check();
}

/** FR-040: every group this ad reached, across all campaigns. */
function adDistributionView(a) {
  const hits = [...Store.publishedIndex(a.id).entries()];
  modal(`Where “${a.name}” was shared`, hits.length
    ? h('div', { class: 'list' }, hits.map(([gid, x]) => h('div', { class: 'list-row' },
        h('div', { class: 'grow' }, h('div', { class: 'b' }, (Store.db.groups[gid] || {}).name || x.groupName), h('div', { class: 'muted small' }, `${x.campaignId} · ${fmtDateTime(x.at)}`)),
        badge(x.status))))
    : h('p', { class: 'muted' }, 'Not published in any group yet.'));
}

/* =====================================================================
   4. Distribution setup  (FR-016..018, FR-026 markers, FR-039 chip)
   ===================================================================== */
function viewDistribute() {
  const st = Engine.getState();
  if (st.active) return viewProgress(st);

  const ads = Store.listAds(biz()).filter(a => a.status === 'ACTIVE');
  const d = S.dist;
  if (d.adId && !ads.find(a => a.id === d.adId)) d.adId = '';
  const ad = Store.db.ads[d.adId];
  const groups = Store.listGroups(biz());
  const published = ad ? Store.publishedIndex(ad.id) : new Map();
  const warnDays = Store.db.settings.recentPostWarningDays;

  const countEl = h('b', {});
  const startBtn = h('button', { class: 'btn primary block big' }, '▶ START DISTRIBUTION');
  const listBox = h('div', { class: 'check-grid' });
  const refresh = () => { countEl.textContent = d.selected.size; startBtn.disabled = !ad || d.selected.size === 0; };
  const drawList = () => {
    const q = d.q.trim().toLowerCase();
    listBox.replaceChildren(...groups.filter(g => !q || g.name.toLowerCase().includes(q)).map(g => {
      const inactive = g.status !== 'ACTIVE';
      const pub = published.get(g.id);
      const last = warnDays > 0 ? Store.lastPostedAt(g.id) : null;
      const recent = last && (Date.now() - new Date(last)) / 864e5 < warnDays;
      const cb = h('input', { type: 'checkbox', checked: d.selected.has(g.id), disabled: inactive,
        onchange: e => { e.target.checked ? d.selected.add(g.id) : d.selected.delete(g.id); refresh(); } });
      return h('label', { class: 'list-row check' + (inactive ? ' dim' : '') }, cb,
        h('div', { class: 'grow' }, h('div', { class: 'b' }, g.name),
          h('div', { class: 'muted small' }, [g.category, inactive ? 'Inactive' : ''].filter(Boolean).join(' · ') || ' '),
          pub ? h('div', { class: 'chip ok' }, `✓ already ${pub.status === 'PUBLISHED' ? 'published' : 'approval required'} · ${fmtDate(pub.at)}`) : null,
          recent ? h('div', { class: 'chip warn' }, `⏱ posted ${fmtDate(last)} (within ${warnDays} days)`) : null));
    }));
  };

  startBtn.onclick = () => act(async () => {
    const ordered = groups.filter(g => d.selected.has(g.id)).map(g => g.id);
    await Engine.start({ adId: ad.id, groupIds: ordered });
    S.dist = { adId: '', selected: new Set(), q: '' };
    toast('Campaign started. The first group opened in the distribution tab.');
    go('distribute');
  });

  drawList(); refresh();
  return h('div', {},
    pageTitle('New Distribution', B().short),
    h('div', { class: 'two side-left' },
      h('div', {},
        card(h('h3', {}, '1. Choose advertisement'),
          h('label', { class: 'field' }, h('span', {}, 'Advertisement'),
            h('select', { onchange: e => { d.adId = e.target.value; render(); } },
              h('option', { value: '' }, ads.length ? '— Choose an active advertisement —' : 'No active advertisements'),
              ads.map(a => h('option', { value: a.id, selected: a.id === d.adId }, a.name)))),
          h('label', { class: 'field' }, h('span', {}, 'Facebook post URL'),
            h('input', { value: ad ? ad.postUrl : '', readOnly: true, placeholder: 'Loads from the advertisement' }))),
        card(h('h3', {}, '3. Start'),
          h('div', { class: 'row between mb' }, h('span', {}, 'Selected Groups: ', countEl), h('span', { class: 'muted small' }, ad ? ad.name : 'Choose an advertisement')),
          startBtn,
          h('p', { class: 'muted small' }, 'Groups open one by one in a separate distribution tab. Come back to this tab to record each result.'))),
      card(
        h('div', { class: 'row between wrap gap mb' }, h('h3', { style: 'margin:0' }, '2. Select Facebook groups'),
          h('div', { class: 'row gap' },
            h('button', { class: 'link', onclick: () => { groups.filter(g => g.status === 'ACTIVE').forEach(g => d.selected.add(g.id)); drawList(); refresh(); } }, 'Select All'),
            h('button', { class: 'link', onclick: () => { d.selected.clear(); drawList(); refresh(); } }, 'Deselect All'))),
        h('input', { type: 'search', placeholder: 'Search in list…', value: d.q, oninput: e => { d.q = e.target.value; drawList(); } }),
        listBox,
        h('div', { class: 'muted small' }, 'Inactive groups are greyed out and cannot be selected.'))));
}

/* =====================================================================
   5. Distribution in progress  (FR-019..024, FR-026, FR-033..036, FR-039)
   ===================================================================== */
let gapTimer = null;
function viewProgress(st) {
  clearInterval(gapTimer);
  const c = st.campaign, cur = st.current;
  const paused = c.status === 'PAUSED';
  const dup = st.confirmDuplicate;
  const gap = Store.db.settings.postingGapSeconds;

  const after = res => { if (res && res.completed) { toast('Campaign completed.'); go('summary', { id: res.completed }); } else render(); };
  const doResult = async (status, askReason) => {
    let reason = null;
    if (askReason) { reason = await promptReason(STATUS[status].label); if (reason === null) return; }
    act(async () => after(await Engine.result(status, reason)));
  };

  const pubBtn = h('button', { class: 'btn success block big', disabled: paused || !!dup, onclick: () => doResult('PUBLISHED') }, '✓ Published → Next Group');
  const gapNote = h('div', { class: 'muted small center' });
  if (gap > 0 && !paused && !dup) {
    const tick = () => {
      const left = Math.ceil(gap - (Date.now() - new Date(st.session.openedAt)) / 1000);
      if (left > 0) { pubBtn.disabled = true; gapNote.textContent = `Next available in ${left} s (posting gap)`; }
      else { pubBtn.disabled = false; gapNote.textContent = ''; clearInterval(gapTimer); }
    };
    tick(); gapTimer = setInterval(() => { if (!document.body.contains(pubBtn)) return clearInterval(gapTimer); tick(); }, 1000);
  }

  const chips = ['PUBLISHED', 'APPROVAL_REQUIRED', 'FAILED', 'SKIPPED', 'PENDING'].map(k =>
    h('div', { class: 'count', style: `--c:${STATUS[k].color}` }, h('b', {}, st.counts[k]), h('span', {}, STATUS[k].label)));

  return h('div', {},
    pageTitle('Distribution in Progress', `${c.id} · ${Store.profile(c.businessId).short}`, badge(c.status)),
    dup ? h('div', { class: 'banner warn' },
      h('div', {}, 'This advertisement was already marked as published in ', h('b', {}, dup.groupName), ` on ${fmtDate(dup.at)}. Do you want to continue?`),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary sm', onclick: () => act(async () => { await Engine.confirmDuplicate('continue'); render(); }) }, 'Continue'),
        h('button', { class: 'btn sm', onclick: () => act(async () => after(await Engine.confirmDuplicate('skip'))) }, 'Skip'))) : null,
    paused ? h('div', { class: 'banner info' }, h('div', {}, 'Distribution is paused. The tab will not move.'),
      h('button', { class: 'btn primary sm', onclick: () => act(async () => { await Engine.resume(); render(); }) }, 'Resume')) : null,

    h('div', { class: 'two side-left' },
      h('div', {},
        h('section', { class: 'card current' },
          h('div', { class: 'row between' }, h('div', { class: 'muted small' }, 'Current group'), h('div', { class: 'pos' }, `${cur.index + 1} / ${cur.total}`)),
          h('div', { class: 'cur-name' }, cur.groupName),
          cur.category ? h('div', { class: 'muted small' }, cur.category) : null,
          cur.notes ? h('div', { class: 'note' }, '📝 Note: ', cur.notes) : null,
          h('div', { class: 'row gap wrap mt' },
            h('button', { class: 'btn sm', onclick: () => act(() => Engine.navigate(cur.groupUrl)) }, '↻ Open group tab'),
            h('button', { class: 'btn sm', onclick: () => copyText(c.adUrl) }, '⧉ Copy Ad Link'),
            h('button', { class: 'btn sm', onclick: () => Engine.openOriginal(c.adUrl) }, '↗ Open Original')),
          h('div', { class: 'hint small' }, 'Share the post on Facebook yourself (paste the copied link into a group post, or use Facebook’s Share). Then come back here and record the result.')),
        h('div', { class: 'actions' },
          pubBtn, gapNote,
          h('div', { class: 'grid2' },
            h('button', { class: 'btn warn-ghost', disabled: paused || !!dup, onclick: () => doResult('APPROVAL_REQUIRED', true) }, 'Approval Required'),
            h('button', { class: 'btn danger-ghost', disabled: paused || !!dup, onclick: () => doResult('FAILED', true) }, 'Failed')),
          h('div', { class: 'grid4' },
            h('button', { class: 'btn', disabled: paused || cur.index === 0, onclick: () => act(async () => { await Engine.previous(); render(); }) }, '‹ Prev'),
            h('button', { class: 'btn', disabled: paused || !!dup, onclick: () => doResult('SKIPPED') }, 'Skip'),
            paused ? h('button', { class: 'btn', onclick: () => act(async () => { await Engine.resume(); render(); }) }, 'Resume')
                   : h('button', { class: 'btn', onclick: () => act(async () => { await Engine.pause(); toast('Paused.'); render(); }) }, 'Pause'),
            h('button', { class: 'btn danger-ghost', onclick: async () => {
              if (!await confirmBox(msg('C-STOP-01'), 'Stop', true)) return;
              act(async () => { await Engine.stop(); toast('Stopped. Resume any time from History.'); go('history'); });
            } }, 'Stop')))),
      h('div', {},
        card(h('div', { class: 'muted small' }, 'Advertisement'), h('div', { class: 'b' }, c.adName),
          h('div', { class: 'progress mt' }, h('div', { class: 'bar', style: `width:${st.percentDone}%` })),
          h('div', { class: 'muted small' }, `${st.percentDone}% processed`),
          h('div', { class: 'counts' }, chips)),
        card(h('h3', {}, `All groups in this campaign (${cur.total})`),
          h('div', { class: 'list scroll' }, c.items.map((it, i) => h('div', { class: 'list-row' + (i === cur.index ? ' hl' : '') },
            h('div', { class: 'grow' }, `${i + 1}. `, it.groupName, it.reason ? h('div', { class: 'muted small' }, it.reason) : null), badge(it.status))))))));
}

/* =====================================================================
   6. Campaign summary  (FR-037)
   ===================================================================== */
function viewSummary() {
  const c = Store.db.campaigns[S.params.id];
  if (!c) return viewDistribute();
  return h('div', { class: 'narrow' },
    h('div', { class: 'done' }, h('div', { class: 'done-ico' }, '✓'), h('h2', {}, 'Campaign completed'), h('div', { class: 'muted' }, `${c.id} · ${c.adName}`)),
    campaignBreakdown(c),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn', onclick: () => go('history') }, 'View History'),
      h('button', { class: 'btn primary', onclick: () => go('dashboard') }, 'Back to Dashboard')));
}

function campaignBreakdown(c) {
  return h('div', {}, FINAL_STATUSES.concat(['PENDING']).map(k => {
    const items = c.items.filter(i => i.status === k);
    if (!items.length && k === 'PENDING') return null;
    return h('details', { class: 'card', open: items.length > 0 && k !== 'PUBLISHED' },
      h('summary', {}, badge(k), ` ${items.length} group${items.length === 1 ? '' : 's'}`),
      items.length ? h('ul', { class: 'plain' }, items.map(i => h('li', {}, i.groupName, i.reason ? h('span', { class: 'muted small' }, ' — ', i.reason) : null))) : h('div', { class: 'muted small' }, 'None'));
  }));
}

/* =====================================================================
   7. Campaign history  (FR-027..029, FR-025 resume, FR-038)
   ===================================================================== */
function campaignTable(camps) {
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl clickable' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Campaign'), h('th', {}, 'Advertisement'), h('th', {}, 'Started'), h('th', {}, 'Published'), h('th', {}, 'Status'))),
    h('tbody', {}, camps.map(c => h('tr', { onclick: () => go('campaign', { id: c.id }) },
      h('td', { class: 'b nowrap' }, c.id), h('td', {}, c.adName), h('td', { class: 'nowrap' }, fmtDateTime(c.startedAt)),
      h('td', {}, `${c.items.filter(i => i.status === 'PUBLISHED').length} / ${c.items.length}`), h('td', {}, badge(c.status)))))));
}

function viewHistory() {
  const camps = Store.listCampaigns(biz());
  return h('div', {},
    pageTitle('Campaign History', B().short),
    card(camps.length ? campaignTable(camps) : h('div', { class: 'empty' }, 'No campaigns yet. Start one from Distribution.')));
}

function viewCampaign() {
  const c = Store.db.campaigns[S.params.id];
  if (!c) return viewHistory();
  const session = Store.db.session;
  const reuse = () => {
    if (session) return toast(msg('E-CAM-01', { campaignId: session.campaignId }), 'error');
    const ad = Store.db.ads[c.adId];
    if (!ad || ad.status !== 'ACTIVE') return toast(msg('E-CAM-02') + ' Set it to Active in Advertisements first.', 'error');
    S.dist = { adId: ad.id, selected: new Set(c.items.map(i => i.groupId).filter(id => Store.db.groups[id] && Store.db.groups[id].status === 'ACTIVE')), q: '' };
    toast('Same groups pre-selected. A new campaign will be created.');
    go('distribute');
  };
  const editStatus = it => {
    if (session) return toast(msg('E-CAM-01', { campaignId: session.campaignId }), 'error');
    let s = it.status;
    const reason = h('input', { maxlength: LIMITS.reason, value: it.reason || '', placeholder: 'Reason (optional)' });
    const m = modal(`Update status · ${it.groupName}`, h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'New status'),
        h('select', { onchange: e => { s = e.target.value; } }, FINAL_STATUSES.map(k => h('option', { value: k, selected: k === it.status }, STATUS[k].label)))),
      h('label', { class: 'field' }, h('span', {}, 'Reason'), reason),
      h('div', { class: 'muted small' }, 'e.g. Approval Required → Published once the admin approves. Every change is dated.'),
      h('div', { class: 'muted small mt' }, 'History: ', it.log.map(l => `${STATUS[l.s].label} ${fmtDateTime(l.at)}`).join(' → '))), [
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: () => act(async () => { await Engine.updateItemStatus(c.id, it.groupId, s, reason.value.trim()); m.close(); toast('Status updated.'); render(); }) }, 'Save')]);
  };
  const canResume = ['PAUSED', 'STOPPED'].includes(c.status);
  return h('div', {},
    h('button', { class: 'link mb', onclick: () => go('history') }, '‹ Back to history'),
    pageTitle(c.id, c.adName, badge(c.status),
      canResume ? h('button', { class: 'btn primary', onclick: () => act(async () => { const r = await Engine.resume(c.id); r && r.completed ? go('summary', { id: c.id }) : go('distribute'); }) }, '▶ Resume') : null,
      h('button', { class: 'btn', onclick: reuse }, '⟲ Reuse groups')),
    h('div', { class: 'two side-left' },
      card(h('div', { class: 'kv' },
        h('span', {}, 'Profile'), h('b', {}, Store.profile(c.businessId).short),
        h('span', {}, 'Started'), h('b', {}, fmtDateTime(c.startedAt)),
        h('span', {}, 'Completed'), h('b', {}, fmtDateTime(c.completedAt)),
        h('span', {}, 'Groups'), h('b', {}, `${c.items.filter(i => i.status === 'PUBLISHED').length} published / ${c.items.length} selected`))),
      card(h('h3', {}, 'Group-by-group results'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Group'), h('th', {}, 'Status'), h('th', {}, 'Reason'), h('th', {}, 'Last change'), h('th', {}))),
          h('tbody', {}, c.items.map((it, i) => {
            const last = it.log[it.log.length - 1];
            return h('tr', {}, h('td', {}, i + 1), h('td', { class: 'b' }, it.groupName), h('td', {}, badge(it.status)),
              h('td', { class: 'small' }, it.reason || '—'), h('td', { class: 'small nowrap' }, last ? fmtDateTime(last.at) : '—'),
              h('td', { class: 'right' }, FINAL_STATUSES.includes(it.status) && !session ? h('button', { class: 'link small', onclick: () => editStatus(it) }, 'Change') : null));
          })))))));
}

/* =====================================================================
   8. Settings  (FR-041..043) — Profiles, Users, Lists, Backup
   ===================================================================== */
function viewSettings() {
  const tab = S.params.tab || 'profiles';
  const tabs = [['profiles', 'Profiles'], ['account', 'My account'], ['lists', 'Lists & posting gap'], ['backup', 'Backup & data']];
  const body = { profiles: settingsProfiles, account: settingsAccount, lists: settingsLists, backup: settingsBackup }[tab]();
  return h('div', {},
    pageTitle('Settings', 'Applies to all profiles'),
    h('div', { class: 'seg' }, tabs.map(([k, t]) => h('button', { class: 'seg-btn' + (k === tab ? ' on' : ''), onclick: () => go('settings', { tab: k }) }, t))),
    body);
}

/* --- Profiles: add more businesses in the future --- */
function settingsProfiles() {
  return card(
    h('div', { class: 'row between mb' }, h('div', {}, h('h3', { style: 'margin:0' }, 'Profiles'),
      h('div', { class: 'muted small' }, 'Each profile has its own groups, advertisements and campaigns. They never mix.')),
      h('button', { class: 'btn primary', onclick: () => profileForm() }, '+ Add profile')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Profile'), h('th', {}, 'Full name'), h('th', {}, 'Groups'), h('th', {}, 'Ads'), h('th', {}))),
      h('tbody', {}, Store.profiles().map(p => h('tr', {},
        h('td', {}, h('div', { class: 'row gap' }, profileTag(p), h('b', {}, p.short))),
        h('td', {}, p.name),
        h('td', {}, Object.values(Store.db.groups).filter(g => g.businessId === p.id).length),
        h('td', {}, Object.values(Store.db.ads).filter(a => a.businessId === p.id).length),
        h('td', { class: 'right' }, h('button', { class: 'btn sm', onclick: () => profileForm(p) }, 'Edit'))))))));
}

function profileForm(p) {
  const edit = !!p;
  const used = Store.profiles().map(x => x.color);
  const state = { v: p ? { ...p } : { name: '', short: '', tag: '', color: PROFILE_COLORS.find(c => !used.includes(c)) || '#0f766e' } };
  const v = state.v;
  const touched = {}, errEls = {};
  const types = h('textarea', { rows: 4, placeholder: 'One per line' }, (p ? Store.db.settings.adTypes[p.id] || [] : DEFAULT_AD_TYPES).join('\n'));
  const saveBtn = h('button', { class: 'btn primary' }, 'Save');
  state.check = () => {
    const e = validateProfile(v);
    Object.keys(errEls).forEach(k => { errEls[k].textContent = touched[k] ? errText(e[k], k === 'name' ? 'profileName' : k) : ''; });
    saveBtn.disabled = Object.keys(e).length > 0;
  };
  const opt = { touched, errEls };
  const swatches = h('div', { class: 'swatches' });
  const drawSw = () => swatches.replaceChildren(...PROFILE_COLORS.map(c =>
    h('button', { type: 'button', class: 'swatch' + (c === v.color ? ' on' : ''), style: `background:${c}`, title: c, onclick: () => { v.color = c; drawSw(); } })));
  drawSw();

  const body = h('div', {},
    makeField(state, 'name', 'Full name *', h('input', { value: v.name, placeholder: 'NUVI Marketing (Pvt) Ltd' }), opt),
    h('div', { class: 'grid2' },
      makeField(state, 'short', 'Short name *', h('input', { value: v.short, placeholder: 'NUVI Marketing' }), opt),
      makeField(state, 'tag', 'Tag (2–4 letters) *', h('input', { value: v.tag, maxlength: 4, placeholder: 'MKT', style: 'text-transform:uppercase' }), opt)),
    h('div', { class: 'field' }, h('span', {}, 'Colour'), swatches),
    h('label', { class: 'field' }, h('span', {}, 'Advertisement types for this profile'), types));

  saveBtn.onclick = () => act(async () => {
    Object.keys(errEls).forEach(k => touched[k] = true); state.check();
    if (saveBtn.disabled) return;
    const saved = await Store.saveProfile(v);
    const t = [...new Set(types.value.split('\n').map(x => x.trim()).filter(Boolean))];
    Store.db.settings.adTypes[saved.id] = t.length ? t : ['Other'];
    if (!edit) Store.db.meta.lastBusinessId = saved.id;
    await Store.save();
    m.close(); toast(edit ? 'Profile updated.' : `Profile "${saved.short}" added and selected.`); render();
  });
  const m = modal(edit ? 'Edit profile' : 'Add profile', body, [
    edit ? h('button', { class: 'btn danger-ghost', onclick: async () => {
      if (Store.profileHasData(p.id)) return toast(msg('E-PRF-01'), 'error');
      if (!await confirmBox(msg('C-DEL-01', { name: p.short }), 'Delete', true)) return;
      act(async () => { await Store.deleteProfile(p.id); m.close(); toast('Profile deleted.'); render(); });
    } }, 'Delete') : null,
    h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), saveBtn]);
  if (edit) Object.keys(errEls).forEach(k => touched[k] = true);
  state.check();
}

/* --- My account (Supabase Auth) --- */
function settingsAccount() {
  const me = Auth.current();
  return card(
    h('div', { class: 'mb' }, h('h3', { style: 'margin:0' }, 'My account'),
      h('div', { class: 'muted small' }, 'You can sign in with this account on any computer that has the extension installed.')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('tbody', {},
      h('tr', {}, h('td', { class: 'b' }, 'Name'), h('td', {}, me.name), h('td', { class: 'right' }, h('button', { class: 'btn sm', onclick: changeNameForm }, 'Change name'))),
      h('tr', {}, h('td', { class: 'b' }, 'Email'), h('td', {}, me.email), h('td', {})),
      h('tr', {}, h('td', { class: 'b' }, 'Password'), h('td', {}, '••••••••'), h('td', { class: 'right' }, h('button', { class: 'btn sm', onclick: changePasswordForm }, 'Change password')))))),
    h('p', { class: 'muted small mt' }, 'To add or remove users, or to reset a forgotten password: Supabase dashboard → Authentication → Users.'));
}

function simpleForm(title, fields, onSave, saveLabel = 'Save') {
  const v = {};
  const err = h('div', { class: 'err' });
  const body = h('div', {}, fields.map(([k, label, type]) =>
    h('label', { class: 'field' }, h('span', {}, label), h('input', { type: type || 'text', oninput: e => { v[k] = e.target.value; err.textContent = ''; } }))), err);
  const m = modal(title, body, [
    h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    h('button', { class: 'btn primary', onclick: async () => {
      try { await onSave(v); m.close(); render(); } catch (e) { err.textContent = e instanceof AppError ? e.message : msg('E-SYS-01'); }
    } }, saveLabel)]);
}

function changeNameForm() {
  simpleForm('Change name', [['name', 'Your name']],
    async v => { await Auth.updateName(v.name); toast('Name updated.'); });
}
function changePasswordForm() {
  simpleForm('Change password', [['current', 'Current password', 'password'], ['next', 'New password (min 6)', 'password'], ['confirm', 'Confirm new password', 'password']],
    async v => { await Auth.changePassword(v.current, v.next, v.confirm); toast('Password changed.'); });
}

/* --- Lists & posting gap --- */
function settingsLists() {
  const s = Store.db.settings;
  const cats = h('textarea', { rows: 7 }, s.categories.join('\n'));
  const num = (v, min) => h('input', { type: 'number', min, value: v });
  const gap = num(s.postingGapSeconds, 0), recent = num(s.recentPostWarningDays, 0), remind = num(s.backupReminderDays, 1);
  const lines = ta => [...new Set(ta.value.split('\n').map(x => x.trim()).filter(Boolean))];
  const save = () => act(async () => {
    const c = lines(cats);
    if (!c.includes('Other')) c.push('Other');
    s.categories = c;
    s.postingGapSeconds = Math.max(0, +gap.value || 0);
    s.recentPostWarningDays = Math.max(0, +recent.value || 0);
    s.backupReminderDays = Math.max(1, +remind.value || 7);
    await Store.save(); toast('Settings saved.'); render();
  });
  return h('div', {},
    h('div', { class: 'two' },
      card(h('h3', {}, 'Group categories'),
        h('p', { class: 'muted small' }, 'Keep it short — only main categories. One per line. Category is optional on a group.'),
        cats),
      card(h('h3', {}, 'Posting gap (avoid Facebook spam limits)'),
        h('label', { class: 'field' }, h('span', {}, 'Minimum wait between groups, seconds (0 = off)'), gap),
        h('label', { class: 'field' }, h('span', {}, 'Warn if a group got any NUVI ad within N days (0 = off)'), recent),
        h('label', { class: 'field' }, h('span', {}, 'Backup reminder after N days'), remind),
        h('p', { class: 'muted small' }, 'Advertisement types are set per profile in Settings → Profiles.'))),
    h('button', { class: 'btn primary', onclick: save }, 'Save settings'));
}

/* --- Backup & data --- */
function settingsBackup() {
  const last = Store.db.meta.lastBackupAt;
  return h('div', { class: 'two' },
    card(h('h3', {}, 'Backup & restore'),
      h('p', { class: 'muted small' }, 'All data lives only in this browser. Uninstalling the extension or clearing browser data deletes it — back up first. User logins are not included in the backup.'),
      h('div', { class: 'muted small mb' }, 'Last backup: ', h('b', {}, last ? fmtDateTime(last) : 'never')),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn primary', onclick: doBackup }, '⬇ Back up now'),
        h('button', { class: 'btn', onclick: doRestore }, '⬆ Restore backup'))),
    card(h('h3', {}, 'Danger zone'),
      h('p', { class: 'muted small' }, 'Reset deletes the groups, advertisements and campaigns of every profile. Your login is not affected.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn danger-ghost', onclick: () => resetData(false) }, 'Reset all data'),
        h('button', { class: 'btn', onclick: () => resetData(true) }, 'Reload demo data')),
      h('p', { class: 'muted small mt' }, `Version ${APP_VERSION} · storage: ${HAS_CHROME_STORAGE ? 'chrome.storage.local' : 'browser localStorage'}`)));
}

async function doBackup() {
  await act(async () => {
    const data = Store.exportAll();
    download(`nuvi-distribution-backup-${todayStamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
    Store.db.meta.lastBackupAt = new Date().toISOString();
    await Store.save(); toast('Backup downloaded.'); render();
  });
}

async function doRestore() {
  if (Store.db.session) return toast(msg('E-BAK-03'), 'error');
  const file = await pickFile('.json,application/json');
  if (!file) return;
  let obj;
  try { obj = JSON.parse(await file.text()); Store.checkBackup(obj); }
  catch (e) { return toast(e instanceof AppError ? e.message : msg('E-BAK-01'), 'error'); }
  if (!await confirmBox(msg('C-RST-01'), 'Replace data', true)) return;
  act(async () => { await Store.importAll(obj); toast('Backup restored.'); go('dashboard'); });
}

async function resetData(withDemo) {
  if (!withDemo) {
    if (!await confirmBox('Reset ALL data? Groups, advertisements and campaigns of every profile will be deleted.', 'Continue', true)) return;
    if (!await confirmBox('Are you absolutely sure? This cannot be undone.', 'Reset everything', true)) return;
  } else if (!await confirmBox('Replace current data with the demo data?', 'Load demo')) return;
  act(async () => { await Store.resetAll(withDemo); toast(withDemo ? 'Demo data loaded.' : 'All data reset.'); go('dashboard'); });
}

/* ---------- Boot ---------- */
(async () => {
  await Store.load();
  // Re-draw when the user signs in or out (also when a session expires).
  await Auth.init(() => { if (!document.querySelector('.modal-wrap')) render(); });
  render();
  // Keep the page in sync if data is changed in another tab.
  if (HAS_CHROME_STORAGE) {
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== 'local' || (!changes.session && !changes.campaigns)) return;
      const fresh = await chrome.storage.local.get(STORE_KEYS);
      if (JSON.stringify(fresh.session) !== JSON.stringify(Store.db.session) ||
          JSON.stringify(fresh.campaigns) !== JSON.stringify(Store.db.campaigns)) {
        Store.db = { ...Store.db, ...fresh };
        if (!document.querySelector('.modal-wrap')) render();
      }
    });
  } else {
    window.addEventListener('storage', e => { if (e.key === LS_KEY && !document.querySelector('.modal-wrap')) Store.load().then(render); });
  }
})();
