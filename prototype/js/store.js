/* =====================================================================
   store.js — constants, messages, validation, CSV, storage, login
   NUVI Social Media Advertisement Distribution Manager (prototype)

   Works in two modes:
     • Chrome extension  -> chrome.storage.local
     • Plain web page    -> localStorage (open index.html directly)
   ===================================================================== */

/* ---------- Profiles (businesses) ----------
   Stored as DATA (Store.db.businesses), so more profiles can be added
   from Settings → Profiles. These two are created on first run.        */
const DEFAULT_BUSINESSES = {
  B001: { id: 'B001', name: 'NUVI Engineering (Pvt) Ltd', short: 'NUVI Engineering', tag: 'ENG', color: '#d97706', order: 1 },
  B002: { id: 'B002', name: 'NUVI IT (Pvt) Ltd',          short: 'NUVI IT',          tag: 'IT',  color: '#6d28d9', order: 2 }
};
const PROFILE_COLORS = ['#d97706', '#6d28d9', '#0f766e', '#be123c', '#1d4ed8', '#4d7c0f', '#c2410c', '#0e7490'];

const STATUS = {
  PENDING:           { label: 'Pending',           color: '#94a3b8' },
  IN_PROGRESS:       { label: 'In Progress',       color: '#2563eb' },
  PUBLISHED:         { label: 'Published',         color: '#15803d' },
  SKIPPED:           { label: 'Skipped',           color: '#64748b' },
  APPROVAL_REQUIRED: { label: 'Approval Required', color: '#d97706' },
  FAILED:            { label: 'Failed',            color: '#b91c1c' },
  ACTIVE:            { label: 'Active',            color: '#15803d' },
  INACTIVE:          { label: 'Inactive',          color: '#94a3b8' },
  COMPLETED:         { label: 'Completed',         color: '#2563eb' },
  ARCHIVED:          { label: 'Archived',          color: '#64748b' },
  PAUSED:            { label: 'Paused',            color: '#d97706' },
  STOPPED:           { label: 'Stopped',           color: '#b91c1c' }
};

const ITEM_STATUSES  = ['PENDING', 'IN_PROGRESS', 'PUBLISHED', 'SKIPPED', 'APPROVAL_REQUIRED', 'FAILED'];
const FINAL_STATUSES = ['PUBLISHED', 'SKIPPED', 'APPROVAL_REQUIRED', 'FAILED'];
const SCHEMA_VERSION = 2;
const APP_VERSION = '0.2.0-prototype';
const LIMITS = { groupName: 150, adName: 120, notes: 500, description: 500, reason: 200,
                 csvRows: 1000, groupsPerBusiness: 1000, profileName: 80, profileShort: 30, password: 6 };

/* A small set of main group categories (editable in Settings). */
const DEFAULT_CATEGORIES = ['Property', 'IT & Software', 'Online Selling', 'Business', 'Community', 'Other'];
const DEFAULT_AD_TYPES = ['Product', 'Service', 'Other'];

const DEFAULT_SETTINGS = {
  categories: DEFAULT_CATEGORIES.slice(),
  adTypes: {
    B001: ['House', 'Land', 'Construction', 'Property Project', 'Other'],
    B002: ['Software', 'Website', 'Inventory System', 'Business Software', 'Other']
  },
  postingGapSeconds: 0,      // FR-039 (0 = off)
  recentPostWarningDays: 0,  // FR-039 (0 = off)
  backupReminderDays: 7      // FR-041
};

/* ---------- Messages catalogue (Tech Doc §10) ---------- */
const MESSAGES = {
  'E-REQ-01': 'This field is required.',
  'E-LEN-01': 'Too long. Maximum {max} characters.',
  'E-URL-01': 'Please enter a valid Facebook group link (facebook.com/groups/...).',
  'E-URL-02': 'Please enter a valid Facebook post link.',
  'E-DUP-01': 'This group already exists: {name}.',
  'E-DUP-02': 'An advertisement with this name already exists.',
  'E-DUP-03': 'A profile with this name already exists.',
  'E-LIM-01': 'Group limit reached (1,000 per profile).',
  'E-CSV-01': 'The file is not a valid CSV, or the required columns (group_name, group_url) are missing.',
  'E-CSV-02': 'The file is too large (max 1,000 rows / 1 MB).',
  'E-CAM-01': '{campaignId} is still in progress. Pause or stop it first.',
  'E-CAM-02': 'This advertisement is not active.',
  'E-CAM-03': 'Select at least one group.',
  'E-CAM-04': 'Groups from another profile cannot be used.',
  'E-CAM-05': 'This is the first group, so there is no previous group.',
  'E-CAM-06': 'No distribution is running.',
  'E-CAM-07': 'This campaign cannot be resumed.',
  'E-BAK-01': 'This is not a valid backup file.',
  'E-BAK-02': 'This backup was made by a newer version. Please update the extension first.',
  'E-BAK-03': 'Stop the running distribution before restoring a backup.',
  'E-PRF-01': 'This profile has groups, advertisements or campaigns, so it cannot be deleted.',
  'E-PRF-02': 'At least one profile is needed.',
  'E-AUTH-01': 'Wrong username or password.',
  'E-AUTH-02': 'Password must be at least {max} characters.',
  'E-AUTH-03': 'Passwords do not match.',
  'E-AUTH-04': 'This username is already taken.',
  'E-AUTH-05': 'You cannot remove the user you are signed in as.',
  'E-SYS-01': 'Something went wrong. Please try again.',
  'E-SAVE-01': 'Could not save. Please try again.',
  'W-CAT-01': 'Unknown category "{value}", saved as Other.',
  'C-DEL-01': 'Delete "{name}"? This cannot be undone.',
  'C-STOP-01': 'Stop this distribution? Remaining groups stay Pending, and you can resume later from History.',
  'C-RST-01': 'Replace ALL current data with this backup?',
  'I-COPY-01': 'Advertisement link copied.',
  'I-BAK-01': "It's been {days} days since your last backup."
};

function msg(code, data = {}) {
  const t = MESSAGES[code] || code;
  return t.replace(/\{(\w+)\}/g, (_, k) => (data[k] != null ? data[k] : ''));
}

class AppError extends Error {
  constructor(code, data = {}) { super(msg(code, data)); this.code = code; this.data = data; }
}

/* ---------- Validation & URL rules (Tech Doc §04) ---------- */
const GROUP_RE = /^https?:\/\/(?:(?:www|m|web|mbasic)\.)?facebook\.com\/groups\/([A-Za-z0-9._-]+)\/?(?:[?#].*)?$/i;
const POST_RE  = /^https?:\/\/(?:(?:www|m|web|mbasic)\.)?(?:facebook\.com|fb\.com)\/.+/i;
const TRACKING_PARAMS = ['fbclid', '__cft__', '__tn__', 'mibextid'];

function parseGroupUrl(input) {
  const raw = (input || '').trim();
  if (!raw) return { ok: false, error: 'E-REQ-01' };
  const m = raw.match(GROUP_RE);
  if (!m) return { ok: false, error: 'E-URL-01' };
  const gid = m[1].toLowerCase();
  return { ok: true, url: `https://www.facebook.com/groups/${gid}/`, urlKey: `facebook.com/groups/${gid}` };
}

function parsePostUrl(input) {
  const raw = (input || '').trim();
  if (!raw) return { ok: false, error: 'E-REQ-01' };
  if (!POST_RE.test(raw)) return { ok: false, error: 'E-URL-02' };
  try {
    const u = new URL(raw);
    [...u.searchParams.keys()].forEach(k => {
      if (TRACKING_PARAMS.includes(k) || k.startsWith('__cft__')) u.searchParams.delete(k);
    });
    return { ok: true, url: u.toString() };
  } catch { return { ok: false, error: 'E-URL-02' }; }
}

/** Returns { field: errorCode } for a group form. Empty object = valid. */
function validateGroup(g) {
  const e = {};
  const name = (g.name || '').trim();
  if (!name) e.name = 'E-REQ-01'; else if (name.length > LIMITS.groupName) e.name = 'E-LEN-01';
  const p = parseGroupUrl(g.url);
  if (!p.ok) e.url = p.error;
  else {
    const dup = Object.values(Store.db.groups).find(x =>
      x.businessId === g.businessId && x.urlKey === p.urlKey && x.id !== g.id);
    if (dup) e.url = 'E-DUP-01:' + dup.name;
  }
  if ((g.notes || '').length > LIMITS.notes) e.notes = 'E-LEN-01';
  return e;
}

function validateAd(a) {
  const e = {};
  const name = (a.name || '').trim();
  if (!name) e.name = 'E-REQ-01';
  else if (name.length > LIMITS.adName) e.name = 'E-LEN-01';
  else if (Object.values(Store.db.ads).some(x => x.businessId === a.businessId && x.id !== a.id &&
           x.name.toLowerCase() === name.toLowerCase())) e.name = 'E-DUP-02';
  const p = parsePostUrl(a.postUrl);
  if (!p.ok) e.postUrl = p.error;
  if ((a.description || '').length > LIMITS.description) e.description = 'E-LEN-01';
  return e;
}

function validateProfile(p) {
  const e = {};
  const name = (p.name || '').trim(), short = (p.short || '').trim(), tag = (p.tag || '').trim();
  if (!name) e.name = 'E-REQ-01'; else if (name.length > LIMITS.profileName) e.name = 'E-LEN-01';
  if (!short) e.short = 'E-REQ-01';
  else if (short.length > LIMITS.profileShort) e.short = 'E-LEN-01';
  else if (Object.values(Store.db.businesses).some(b => b.id !== p.id && b.short.toLowerCase() === short.toLowerCase())) e.short = 'E-DUP-03';
  if (!tag) e.tag = 'E-REQ-01'; else if (tag.length > 4) e.tag = 'E-LEN-01';
  return e;
}

/** Turns "E-DUP-01:Homagama Api" style codes into display text. */
function errText(code, field) {
  if (!code) return '';
  const [c, extra] = code.split(':');
  const max = { name: LIMITS.groupName, adName: LIMITS.adName, notes: LIMITS.notes, description: LIMITS.description,
                profileName: LIMITS.profileName, short: LIMITS.profileShort, tag: 4 }[field];
  return msg(c, { name: extra, max });
}

/* ---------- CSV (Tech Doc §06, simplified columns) ---------- */
const CSV_COLUMNS = ['group_name', 'group_url', 'category', 'status', 'notes'];

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function csvEscape(v) {
  v = v == null ? '' : String(v);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** Validates CSV text for one profile. Returns [{line, data, result, reason}] or throws. */
function previewCSV(text, businessId) {
  if (text.length > 1024 * 1024) throw new AppError('E-CSV-02');
  const all = parseCSV(text);
  if (!all.length) throw new AppError('E-CSV-01');
  const header = all[0].map(h => h.trim().toLowerCase());
  const idx = Object.fromEntries(CSV_COLUMNS.map(c => [c, header.indexOf(c)]));
  if (idx.group_name < 0 || idx.group_url < 0) throw new AppError('E-CSV-01');
  const body = all.slice(1);
  if (body.length > LIMITS.csvRows) throw new AppError('E-CSV-02');

  const existing = new Set(Object.values(Store.db.groups).filter(g => g.businessId === businessId).map(g => g.urlKey));
  const seen = new Set();
  const cats = Store.db.settings.categories;
  return body.map((r, i) => {
    const get = c => (idx[c] >= 0 ? (r[idx[c]] || '').trim() : '');
    const data = { name: get('group_name'), url: get('group_url'), category: get('category'), status: get('status'), notes: get('notes') };
    const out = { line: i + 2, data, result: 'VALID', reason: '' };
    if (!data.name || !data.url) { out.result = 'INVALID'; out.reason = 'Missing name or URL'; return out; }
    if (data.name.length > LIMITS.groupName || data.notes.length > LIMITS.notes) { out.result = 'INVALID'; out.reason = 'Too long'; return out; }
    const p = parseGroupUrl(data.url);
    if (!p.ok) { out.result = 'INVALID'; out.reason = 'Not a Facebook group link'; return out; }
    if (existing.has(p.urlKey)) { out.result = 'DUPLICATE'; out.reason = 'Already in this profile'; return out; }
    if (seen.has(p.urlKey)) { out.result = 'DUPLICATE'; out.reason = 'Repeated in this file'; return out; }
    seen.add(p.urlKey);
    data.status = data.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const match = cats.find(c => c.toLowerCase() === data.category.toLowerCase());
    if (data.category && !match) { out.reason = msg('W-CAT-01', { value: data.category }); data.category = 'Other'; }
    else data.category = match || 'Other';
    return out;
  });
}

/* ---------- Dates ---------- */
const pad = n => String(n).padStart(2, '0');
function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function fmtDateTime(iso) { if (!iso) return '—'; const d = new Date(iso); return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function todayStamp() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/* ---------- Migrations (old saved data / old backups) ---------- */
function migrate(db) {
  if (!db.meta.schemaVersion || db.meta.schemaVersion < 2) {
    // v1 -> v2: profiles become data; groups lose "location"; smaller category list.
    db.businesses = db.businesses || structuredClone(DEFAULT_BUSINESSES);
    const map = { 'Location-Based': 'Property', 'Industry': 'IT & Software' };
    db.settings = db.settings || {};
    db.settings.categories = DEFAULT_CATEGORIES.slice();
    delete db.settings.locations;
    Object.values(db.groups || {}).forEach(g => {
      delete g.location;
      g.category = map[g.category] || (DEFAULT_CATEGORIES.includes(g.category) ? g.category : 'Other');
    });
    db.meta.counters.business = db.meta.counters.business || Object.keys(db.businesses).length;
    db.meta.schemaVersion = 2;
  }
  return db;
}

/* ---------- Storage (Tech Doc §05) ---------- */
const STORE_KEYS = ['meta', 'settings', 'businesses', 'groups', 'ads', 'campaigns', 'session', 'users'];
const HAS_CHROME_STORAGE = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
const LS_KEY = 'nuvi-distribution-manager';

const Store = {
  db: null,

  async load() {
    let data = {};
    try {
      if (HAS_CHROME_STORAGE) data = await chrome.storage.local.get(STORE_KEYS);
      else data = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch { data = {}; }
    const isNew = !data.meta;
    this.db = isNew ? seedData() : migrate(data);
    this.db.users = data.users || {};
    this.db.settings = { ...structuredClone(DEFAULT_SETTINGS), ...this.db.settings };
    if (!this.db.businesses[this.db.meta.lastBusinessId]) this.db.meta.lastBusinessId = this.profiles()[0].id;
    await this.save();
  },

  async save() {
    try {
      if (HAS_CHROME_STORAGE) await chrome.storage.local.set(this.db);
      else localStorage.setItem(LS_KEY, JSON.stringify(this.db));
    } catch (e) { console.error(e); throw new AppError('E-SAVE-01'); }
  },

  nextId(kind) {
    const c = this.db.meta.counters;
    c[kind] = (c[kind] || 0) + 1;
    if (kind === 'group') return 'GRP-' + String(c[kind]).padStart(4, '0');
    if (kind === 'ad') return 'AD-' + String(c[kind]).padStart(4, '0');
    if (kind === 'business') return 'B' + String(c[kind]).padStart(3, '0');
    return 'CAM-' + String(c[kind]).padStart(3, '0');
  },

  /* Profiles (businesses) */
  profiles() { return Object.values(this.db.businesses).sort((a, b) => a.order - b.order); },
  profile(id) { return this.db.businesses[id] || { id, name: id, short: id, tag: '?', color: '#64748b' }; },
  profileHasData(id) {
    return [this.db.groups, this.db.ads, this.db.campaigns].some(col => Object.values(col).some(x => x.businessId === id));
  },
  async saveProfile(input) {
    const errs = validateProfile(input);
    const first = Object.keys(errs)[0];
    if (first) throw new AppError(errs[first]);
    let id = input.id;
    if (!id) { do { id = this.nextId('business'); } while (this.db.businesses[id]); }
    const old = this.db.businesses[id] || {};
    this.db.businesses[id] = { ...old, id, name: input.name.trim(), short: input.short.trim(),
      tag: input.tag.trim().toUpperCase(), color: input.color || '#64748b',
      order: old.order || Math.max(0, ...this.profiles().map(p => p.order)) + 1 };
    if (!this.db.settings.adTypes[id]) this.db.settings.adTypes[id] = DEFAULT_AD_TYPES.slice();
    await this.save();
    return this.db.businesses[id];
  },
  async deleteProfile(id) {
    if (this.profileHasData(id)) throw new AppError('E-PRF-01');
    if (this.profiles().length <= 1) throw new AppError('E-PRF-02');
    delete this.db.businesses[id];
    delete this.db.settings.adTypes[id];
    if (this.db.meta.lastBusinessId === id) this.db.meta.lastBusinessId = this.profiles()[0].id;
    await this.save();
  },

  /* Groups */
  listGroups(biz) {
    return Object.values(this.db.groups).filter(g => g.businessId === biz)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async saveGroup(input) {
    const errs = validateGroup(input);
    const first = Object.keys(errs)[0];
    if (first) throw new AppError(errs[first].split(':')[0], { name: errs[first].split(':')[1] });
    if (!input.id && this.listGroups(input.businessId).length >= LIMITS.groupsPerBusiness) throw new AppError('E-LIM-01');
    const p = parseGroupUrl(input.url);
    const now = new Date().toISOString();
    const g = { ...(this.db.groups[input.id] || {}),
      businessId: input.businessId, name: input.name.trim(), url: p.url, urlKey: p.urlKey,
      category: input.category || 'Other', status: input.status || 'ACTIVE', notes: (input.notes || '').trim(),
      id: input.id || this.nextId('group'), updatedAt: now };
    g.createdAt = g.createdAt || now;
    this.db.groups[g.id] = g;
    await this.save();
    return g;
  },
  async deleteGroup(id) { delete this.db.groups[id]; await this.save(); },
  async importGroups(biz, rows) {
    const now = new Date().toISOString();
    rows.forEach(d => {
      const p = parseGroupUrl(d.url);
      const id = this.nextId('group');
      this.db.groups[id] = { id, businessId: biz, name: d.name, url: p.url, urlKey: p.urlKey,
        category: d.category, status: d.status, notes: d.notes, createdAt: now, updatedAt: now };
    });
    await this.save();
    return { added: rows.length };
  },

  /* Advertisements */
  listAds(biz) {
    return Object.values(this.db.ads).filter(a => a.businessId === biz)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async saveAd(input) {
    const errs = validateAd(input);
    const first = Object.keys(errs)[0];
    if (first) throw new AppError(errs[first]);
    const now = new Date().toISOString();
    const a = { ...(this.db.ads[input.id] || {}),
      businessId: input.businessId, name: input.name.trim(), postUrl: parsePostUrl(input.postUrl).url,
      type: input.type, description: (input.description || '').trim(), status: input.status || 'ACTIVE',
      id: input.id || this.nextId('ad'), updatedAt: now };
    a.createdAt = input.createdAt || a.createdAt || now;
    this.db.ads[a.id] = a;
    await this.save();
    return a;
  },
  adHasHistory(id) { return Object.values(this.db.campaigns).some(c => c.adId === id); },
  async deleteAd(id) { delete this.db.ads[id]; await this.save(); },

  /* Campaigns */
  listCampaigns(biz) {
    return Object.values(this.db.campaigns).filter(c => c.businessId === biz)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },
  /** Map groupId -> {at, campaignId} where this ad is PUBLISHED / APPROVAL_REQUIRED (FR-026, FR-040). */
  publishedIndex(adId, excludeCampaignId) {
    const map = new Map();
    Object.values(this.db.campaigns).forEach(c => {
      if (c.adId !== adId || c.id === excludeCampaignId) return;
      c.items.forEach(it => {
        if (it.status !== 'PUBLISHED' && it.status !== 'APPROVAL_REQUIRED') return;
        const at = (it.log[it.log.length - 1] || {}).at || c.startedAt;
        const prev = map.get(it.groupId);
        if (!prev || at > prev.at) map.set(it.groupId, { at, campaignId: c.id, status: it.status, groupName: it.groupName });
      });
    });
    return map;
  },
  /** Latest PUBLISHED time of any ad in a group (FR-039). */
  lastPostedAt(groupId) {
    let last = null;
    Object.values(this.db.campaigns).forEach(c => c.items.forEach(it => {
      if (it.groupId !== groupId || it.status !== 'PUBLISHED') return;
      const at = (it.log[it.log.length - 1] || {}).at;
      if (at && (!last || at > last)) last = at;
    }));
    return last;
  },

  /* Backup / restore (Tech Doc §06). User logins are NOT included in backups. */
  exportAll() {
    const { meta, settings, businesses, groups, ads, campaigns } = this.db;
    return { app: 'nuvi-distribution-manager', schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(), appVersion: APP_VERSION,
      data: structuredClone({ meta, settings, businesses, groups, ads, campaigns }) };
  },
  checkBackup(obj) {
    if (this.db.session) throw new AppError('E-BAK-03');
    if (!obj || obj.app !== 'nuvi-distribution-manager' || !obj.data ||
        !['meta', 'settings', 'groups', 'ads', 'campaigns'].every(k => obj.data[k])) throw new AppError('E-BAK-01');
    if (obj.schemaVersion > SCHEMA_VERSION) throw new AppError('E-BAK-02');
  },
  async importAll(obj) {
    this.checkBackup(obj);
    const users = this.db.users;
    this.db = migrate({ ...structuredClone(obj.data), session: null });
    this.db.users = users;
    this.db.settings = { ...structuredClone(DEFAULT_SETTINGS), ...this.db.settings };
    await this.save();
  },
  async resetAll(withDemo) {
    const users = this.db.users;
    this.db = withDemo ? seedData() : emptyData();
    this.db.users = users;
    await this.save();
  }
};

/* ---------- Login (local only) ----------
   Accounts live in this browser (Store.db.users). Passwords are stored as a
   salted SHA-256 hash, never as plain text. The signed-in user is kept in
   sessionStorage, so closing the browser tab signs out.                  */
const Auth = {
  KEY: 'nuvi-auth-user',
  async hash(password, salt) {
    const bytes = new TextEncoder().encode(salt + ':' + password);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  hasUsers() { return Object.keys(Store.db.users).length > 0; },
  current() {
    let u = null;
    try { u = sessionStorage.getItem(this.KEY); } catch { /* ignore */ }
    return u && Store.db.users[u] ? Store.db.users[u] : null;
  },
  async createUser({ name, username, password, confirm }) {
    username = (username || '').trim().toLowerCase();
    if (!name || !name.trim() || !username) throw new AppError('E-REQ-01');
    if (Store.db.users[username]) throw new AppError('E-AUTH-04');
    if ((password || '').length < LIMITS.password) throw new AppError('E-AUTH-02', { max: LIMITS.password });
    if (password !== confirm) throw new AppError('E-AUTH-03');
    const salt = crypto.getRandomValues(new Uint32Array(4)).join('-');
    Store.db.users[username] = { username, name: name.trim(), salt, hash: await this.hash(password, salt), createdAt: new Date().toISOString() };
    await Store.save();
    return Store.db.users[username];
  },
  async login(username, password) {
    const u = Store.db.users[(username || '').trim().toLowerCase()];
    if (!u || u.hash !== await this.hash(password || '', u.salt)) throw new AppError('E-AUTH-01');
    u.lastLoginAt = new Date().toISOString();
    await Store.save();
    try { sessionStorage.setItem(this.KEY, u.username); } catch { /* ignore */ }
    return u;
  },
  logout() { try { sessionStorage.removeItem(this.KEY); } catch { /* ignore */ } },
  async changePassword(username, current, next, confirm) {
    const u = Store.db.users[username];
    if (u.hash !== await this.hash(current || '', u.salt)) throw new AppError('E-AUTH-01');
    if ((next || '').length < LIMITS.password) throw new AppError('E-AUTH-02', { max: LIMITS.password });
    if (next !== confirm) throw new AppError('E-AUTH-03');
    u.hash = await this.hash(next, u.salt);
    await Store.save();
  },
  async removeUser(username) {
    const me = this.current();
    if (me && me.username === username) throw new AppError('E-AUTH-05');
    delete Store.db.users[username];
    await Store.save();
  }
};

/* ---------- Demo data ---------- */
function emptyData() {
  return {
    meta: { schemaVersion: SCHEMA_VERSION, counters: { business: 2, group: 0, ad: 0, campaign: 0 }, lastBackupAt: null, lastBusinessId: 'B001' },
    settings: structuredClone(DEFAULT_SETTINGS), businesses: structuredClone(DEFAULT_BUSINESSES),
    groups: {}, ads: {}, campaigns: {}, session: null, users: {}
  };
}

function seedData() {
  const db = emptyData();
  const daysAgo = (d, h = 10) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, 0, 0, 0); return t.toISOString(); };
  const groups = [
    ['B001', 'Kiriwaththuduwa Api', '233212924715137', 'Community', 'ACTIVE', ''],
    ['B001', 'Homagama Api', '2744442632268081', 'Community', 'ACTIVE', 'Post link only'],
    ['B001', 'Colombo Api', '853336822316464', 'Community', 'ACTIVE', ''],
    ['B001', 'Kottawa Api', 'kottawaapi', 'Community', 'ACTIVE', ''],
    ['B001', 'Piliyandala Property Group', '410028876612390', 'Property', 'ACTIVE', 'Post link only, no shares'],
    ['B001', 'Broker Mahaththaya', 'brokermahaththaya', 'Property', 'ACTIVE', 'Admin approval needed'],
    ['B001', 'Maharagama Land Sales', '190044557812001', 'Property', 'ACTIVE', ''],
    ['B001', 'පාදුක්ක ඉඩම් විකිණීම', '552310987744120', 'Property', 'ACTIVE', 'Sinhala group — write the caption in Sinhala'],
    ['B001', 'Sri Lanka House & Land', 'srilankahouseandland', 'Property', 'ACTIVE', ''],
    ['B001', 'Kaduwela Buy & Sell', '667120934401876', 'Online Selling', 'ACTIVE', ''],
    ['B001', 'Kesbewa Community', '774400129987321', 'Community', 'INACTIVE', 'Posting paused by admins'],
    ['B001', 'Gampaha Property Hub', 'gampahapropertyhub', 'Property', 'ACTIVE', ''],
    ['B002', 'SL Software Developers', 'slsoftwaredevelopers', 'IT & Software', 'ACTIVE', ''],
    ['B002', 'Small Business Owners Sri Lanka', '301122998877665', 'Business', 'ACTIVE', 'Only on Fridays'],
    ['B002', 'Retail Shop Owners LK', 'retailshopownerslk', 'Business', 'ACTIVE', ''],
    ['B002', 'Web Design Sri Lanka', 'webdesignsrilanka', 'IT & Software', 'ACTIVE', ''],
    ['B002', 'Online Sellers Sri Lanka', '889900112233445', 'Online Selling', 'ACTIVE', 'Personal profiles only'],
    ['B002', 'POS & Inventory Users', 'posinventoryusers', 'IT & Software', 'INACTIVE', '']
  ];
  const gid = {};
  groups.forEach(([b, name, fb, category, status, notes]) => {
    const id = 'GRP-' + String(++db.meta.counters.group).padStart(4, '0');
    gid[name] = id;
    db.groups[id] = { id, businessId: b, name, url: `https://www.facebook.com/groups/${fb.toLowerCase()}/`,
      urlKey: `facebook.com/groups/${fb.toLowerCase()}`, category, status, notes,
      createdAt: daysAgo(30), updatedAt: daysAgo(30) };
  });

  const ads = [
    ['B001', 'Kiriwaththuduwa House for Sale', 'https://www.facebook.com/NUVIEngineering/posts/pfbid02kiriwaththuduwa', 'House', 'Two-bedroom house for sale', 1],
    ['B001', 'Homagama Land Plots', 'https://www.facebook.com/NUVIEngineering/posts/pfbid02homagamaland', 'Land', '10 perch land plots, clear deeds', 6],
    ['B001', 'Construction Services 2026', 'https://www.facebook.com/NUVIEngineering/posts/pfbid02construction', 'Construction', 'House construction packages', 12],
    ['B002', 'Inventory System for Retail Shops', 'https://www.facebook.com/NUVIIT/posts/pfbid02inventory', 'Inventory System', 'Sales & inventory software', 5],
    ['B002', 'Business Website Package', 'https://www.facebook.com/NUVIIT/posts/pfbid02website', 'Website', 'Website design from LKR 45,000', 9]
  ];
  const aid = {};
  ads.forEach(([b, name, postUrl, type, description, d]) => {
    const id = 'AD-' + String(++db.meta.counters.ad).padStart(4, '0');
    aid[name] = id;
    db.ads[id] = { id, businessId: b, name, postUrl, type, description, status: 'ACTIVE', createdAt: daysAgo(d), updatedAt: daysAgo(d) };
  });

  const mkCampaign = (b, adName, d, results) => {
    const id = 'CAM-' + String(++db.meta.counters.campaign).padStart(3, '0');
    const ad = db.ads[aid[adName]];
    let m = 0;
    const at = () => { const t = new Date(daysAgo(d)); t.setMinutes(m += 3); return t.toISOString(); };
    db.campaigns[id] = { id, businessId: b, adId: ad.id, adName: ad.name, adUrl: ad.postUrl, status: 'COMPLETED',
      currentIndex: -1, startedAt: daysAgo(d), completedAt: null,
      items: results.map(([g, s, r]) => {
        const grp = db.groups[gid[g]];
        const log = [{ s: 'IN_PROGRESS', at: at() }, r ? { s, at: at(), r } : { s, at: at() }];
        return { groupId: grp.id, groupName: grp.name, groupUrl: grp.url, status: s, reason: r || null, log };
      }) };
    db.campaigns[id].completedAt = at();
  };
  mkCampaign('B001', 'Homagama Land Plots', 4, [
    ['Homagama Api', 'PUBLISHED'], ['Kottawa Api', 'PUBLISHED'], ['Broker Mahaththaya', 'APPROVAL_REQUIRED', 'Waiting for admin approval'],
    ['Maharagama Land Sales', 'FAILED', 'Group allows only personal profiles'], ['Colombo Api', 'SKIPPED']]);
  mkCampaign('B002', 'Inventory System for Retail Shops', 2, [
    ['Retail Shop Owners LK', 'PUBLISHED'], ['Small Business Owners Sri Lanka', 'PUBLISHED'], ['Online Sellers Sri Lanka', 'FAILED', 'Personal profiles only']]);
  return db;
}
