/* =====================================================================
   engine.js — distribution engine + tab manager (Tech Doc §07, SAD §06/§08)

   Prototype simplification: the engine runs inside the app page
   instead of the service worker. Every action still loads state from the
   store and saves BEFORE navigating, so it can later be moved to
   background/ unchanged behind chrome.runtime messaging.
   ===================================================================== */

const Engine = (() => {
  const HAS_TABS = typeof chrome !== 'undefined' && !!(chrome.tabs && chrome.tabs.update);
  const iso = () => new Date().toISOString();
  const db = () => Store.db;

  function setItem(it, s, r = null) {
    it.status = s; it.reason = r;
    it.log.push(r ? { s, at: iso(), r } : { s, at: iso() });
  }

  function loadActive(requireStatus) {
    const s = db().session;
    if (!s) throw new AppError('E-CAM-06');
    const c = db().campaigns[s.campaignId];
    if (!c) { db().session = null; throw new AppError('E-CAM-06'); }
    if (requireStatus && c.status !== requireStatus) throw new AppError('E-CAM-07');
    return { s, c };
  }

  /** Forward first, then wrap around (Tech Doc §07). */
  function nextPending(c, from = c.currentIndex) {
    const i = c.items.findIndex((it, k) => k > from && it.status === 'PENDING');
    return i !== -1 ? i : c.items.findIndex(it => it.status === 'PENDING');
  }

  /* ---------- Tab manager ---------- */
  /* The app now runs in its own full browser tab, so the distribution tab is
     always a separate tab: created on the first navigation, then re-used.  */
  async function activeTabId() { return null; }

  /** Moves the ONE distribution tab (FR-019, FR-033). */
  async function navigate(url) {
    const s = db().session;
    if (HAS_TABS) {
      try {
        if (s.tabId == null) throw new Error('no tab');
        await chrome.tabs.update(s.tabId, { url, active: true });
      } catch {
        const t = await chrome.tabs.create({ url });   // tab was closed -> one new tab
        s.tabId = t.id;
      }
    } else {
      window.open(url, 'nuvi-distribution-tab');      // named window = same tab every time
    }
    s.openedAt = iso();
    await Store.save();
  }

  /** Duplicate check before opening the current group (FR-026). */
  async function openCurrentOrAsk(c) {
    const s = db().session;
    const it = c.items[c.currentIndex];
    const hit = Store.publishedIndex(c.adId, c.id).get(it.groupId);
    if (hit) { s.confirmDuplicate = { groupName: it.groupName, at: hit.at }; await Store.save(); return; }
    s.confirmDuplicate = null;
    await navigate(it.groupUrl);
  }

  async function complete(c) {
    c.currentIndex = -1; c.status = 'COMPLETED'; c.completedAt = iso();
    db().session = null;
    await Store.save();
    return { completed: c.id };
  }

  /* ---------- Handlers ---------- */
  async function start({ adId, groupIds }) {
    if (db().session) throw new AppError('E-CAM-01', { campaignId: db().session.campaignId });   // BR-018
    const ad = db().ads[adId];
    if (!ad || ad.status !== 'ACTIVE') throw new AppError('E-CAM-02');
    const groups = [...new Set(groupIds)].map(id => db().groups[id]).filter(Boolean);           // BR-016
    if (!groups.length) throw new AppError('E-CAM-03');
    if (groups.some(g => g.businessId !== ad.businessId)) throw new AppError('E-CAM-04');       // BR-013
    const c = { id: Store.nextId('campaign'), businessId: ad.businessId, adId, adName: ad.name, adUrl: ad.postUrl,
      status: 'IN_PROGRESS', currentIndex: 0, startedAt: iso(), completedAt: null,
      items: groups.map(g => ({ groupId: g.id, groupName: g.name, groupUrl: g.url, status: 'PENDING', reason: null, log: [] })) };
    setItem(c.items[0], 'IN_PROGRESS');
    db().campaigns[c.id] = c;
    db().session = { campaignId: c.id, tabId: await activeTabId(), openedAt: iso(), confirmDuplicate: null };
    await Store.save();
    await openCurrentOrAsk(c);
    return c.id;
  }

  /** status: PUBLISHED | SKIPPED | APPROVAL_REQUIRED | FAILED */
  async function result(status, reason = null) {
    const { s, c } = loadActive('IN_PROGRESS');
    s.confirmDuplicate = null;
    setItem(c.items[c.currentIndex], status, reason ? reason.slice(0, LIMITS.reason) : null);
    const next = nextPending(c);
    if (next === -1) return complete(c);                              // FR-037
    c.currentIndex = next;
    setItem(c.items[next], 'IN_PROGRESS');
    await Store.save();                                               // save BEFORE navigation
    await openCurrentOrAsk(c);
    return null;
  }

  async function confirmDuplicate(decision) {
    const { s, c } = loadActive('IN_PROGRESS');
    if (decision === 'skip') return result('SKIPPED', 'Already published (duplicate warning)');
    s.confirmDuplicate = null;
    await navigate(c.items[c.currentIndex].groupUrl);
    return null;
  }

  async function previous() {
    const { s, c } = loadActive('IN_PROGRESS');
    if (c.currentIndex <= 0) throw new AppError('E-CAM-05');
    setItem(c.items[c.currentIndex], 'PENDING');
    c.currentIndex -= 1;
    setItem(c.items[c.currentIndex], 'IN_PROGRESS');                  // old status stays in the log
    s.confirmDuplicate = null;
    await Store.save();
    await navigate(c.items[c.currentIndex].groupUrl);
  }

  async function pause() {
    const { c } = loadActive('IN_PROGRESS');
    c.status = 'PAUSED';
    await Store.save();
  }

  async function resume(campaignId) {
    let c;
    const s = db().session;
    if (s && (!campaignId || campaignId === s.campaignId)) {
      c = db().campaigns[s.campaignId];
    } else {
      if (s) throw new AppError('E-CAM-01', { campaignId: s.campaignId });
      c = db().campaigns[campaignId];
      if (!c || !['PAUSED', 'STOPPED'].includes(c.status)) throw new AppError('E-CAM-07');
      db().session = { campaignId: c.id, tabId: await activeTabId(), openedAt: iso(), confirmDuplicate: null };
    }
    if (!['PAUSED', 'STOPPED'].includes(c.status)) throw new AppError('E-CAM-07');
    c.status = 'IN_PROGRESS';
    let i = c.items.findIndex(it => it.status === 'IN_PROGRESS');
    if (i === -1) {
      i = nextPending(c, Math.max(-1, c.currentIndex - 1));
      if (i === -1) return complete(c);
      setItem(c.items[i], 'IN_PROGRESS');
    }
    c.currentIndex = i;
    await Store.save();
    await openCurrentOrAsk(c);
    return null;
  }

  async function stop() {
    const { c } = loadActive();
    const it = c.items[c.currentIndex];
    if (it && it.status === 'IN_PROGRESS') setItem(it, 'PENDING');
    c.status = 'STOPPED';
    db().session = null;
    await Store.save();
  }

  /** Opens the master post in a SEPARATE tab (FR-021); re-uses it if still open. */
  async function openOriginal(url) {
    const s = db().session || {};
    if (HAS_TABS) {
      try {
        if (s.originalTabId == null) throw new Error('none');
        await chrome.tabs.update(s.originalTabId, { url, active: true });
      } catch {
        const t = await chrome.tabs.create({ url, active: true });
        if (db().session) { db().session.originalTabId = t.id; await Store.save(); }
      }
    } else {
      window.open(url, 'nuvi-original-ad');
    }
  }

  /** FR-038: change a group's status after the campaign (only when idle). */
  async function updateItemStatus(campaignId, groupId, status, reason) {
    if (db().session) throw new AppError('E-CAM-01', { campaignId: db().session.campaignId });
    const c = db().campaigns[campaignId];
    const it = c.items.find(x => x.groupId === groupId);
    setItem(it, status, reason || null);
    await Store.save();
  }

  /** State object for the panel (Tech Doc §08). */
  function getState() {
    const s = db().session;
    if (!s || !db().campaigns[s.campaignId]) return { active: false };
    const c = db().campaigns[s.campaignId];
    const counts = Object.fromEntries(ITEM_STATUSES.map(k => [k, 0]));
    c.items.forEach(it => counts[it.status]++);
    const it = c.items[c.currentIndex] || {};
    const live = db().groups[it.groupId] || {};                       // FR-035: read live from groups
    return {
      active: true,
      campaign: c,
      session: s,
      current: { index: c.currentIndex, total: c.items.length, groupName: it.groupName, groupUrl: it.groupUrl,
                 location: live.location || '', notes: live.notes || '', category: live.category || '' },
      counts,
      percentDone: Math.round(c.items.filter(x => FINAL_STATUSES.includes(x.status)).length / c.items.length * 100),
      confirmDuplicate: s.confirmDuplicate || null
    };
  }

  return { start, result, confirmDuplicate, previous, pause, resume, stop, openOriginal, updateItemStatus, getState, navigate };
})();
