/* =====================================================================
   WA v193 the Fundraising app: grants (the pipeline, the scanner, the writer, the playbook, the fact base),
   the donor program, the events calendar and the event SOPs (02/10/26)
   =====================================================================
   Steel (01/10/26): "Using all the data from our google drive, grant conversations on loom, and emails on grants (check
   mine), build out a grant tracker and scanner that looks for grants that Welfare Avenue can win. I'd like you to also
   build a tool that helps with grant writing and the approach we should take to wining grants going forward using
   inditry expert knowledge from resreach. this should be under a new app called Fundraising that holds: Fundraising
   Events, Donor relations (Donor Program), Events Calendar, Fundraising Event Sops (as it's own page), Grants". Then:
   "this is for the hub", "Using our past grant applications for reference on future ones, also for new grants that come
   in they should be sent to the grants channel on slack - i just added the hub to it". His choices (02/10/26): the Events
   calendar moves into the app and the board keeps a read-only copy; the scanner is a watchlist plus an AI web search,
   weekly, posting new finds to #grants; the app opens for the Fundraising, Executive and Admin profiles; the writer
   drafts from a fact base and the past applications.

   - One page, 'fund', with sections by address: #fund (Overview), #fund/calendar, #fund/donors, #fund/sops[/<id>],
     #fund/grants[/<id>] (the pipeline), #fund/grants/found, #fund/grants/funders[/<id>], #fund/grants/write[/<draft>],
     #fund/grants/playbook, #fund/grants/facts. The Events page is wave124's #fundevents, framed by the app.
   - The app frame (parts153) lists the Fundraising app: Overview, Events, Calendar, Donor program, Event SOPs, and the
     Grants group. The Hub menu hides fund and fundevents for staff; directors keep the Events calendar in Strategy.
   - Data: fund_funders, fund_grants, fund_grant_log, fund_scan_runs, fund_scan_finds, fund_sources, fund_facts,
     fund_documents, fund_drafts, fund_settings (wa193_fundraising); fund_events and trainings (kind sop) as before; the
     giving totals through fund_giving_summary(). Functions: grant-scan (the weekly scan, Scan now), grant-write (draft,
     review, fit).
   ===================================================================== */
(function () {
  if (window.__wa193) return; window.__wa193 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#797773', ORANGE = '#c87a2f', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var HUB = 'https://hub.welfareavenue.com';
  var SECTIONS = ['overview', 'calendar', 'donors', 'sops', 'grants'];
  var GVIEWS = ['pipeline', 'found', 'funders', 'write', 'playbook', 'facts'];
  var STAGES = [
    ['watching', 'Watching', 'A future cycle or a funder to keep an eye on'],
    ['found', 'Found', 'The scanner found it; screen it'],
    ['screened', 'Screened', 'The go decision is made and the fit scored'],
    ['relationship', 'Relationship', 'A call, an email or a letter of intent'],
    ['drafting', 'Drafting', 'The application is being written'],
    ['submitted', 'Submitted', 'Sent; waiting for the decision'],
    ['awarded', 'Awarded', 'Won'],
    ['reporting', 'Reporting', 'An active grant with reports due'],
    ['declined', 'Declined', 'Not funded'],
    ['not_eligible', 'Not eligible', 'We did not qualify'],
    ['dropped', 'Dropped', 'We chose not to pursue it'],
    ['closed', 'Closed', 'Finished; nothing left to do']
  ];
  var STAGE = {}; STAGES.forEach(function (s) { STAGE[s[0]] = { l: s[1], d: s[2] }; });
  var OPEN = ['found', 'screened', 'relationship', 'drafting', 'submitted'];
  var ACTIVE = ['found', 'screened', 'relationship', 'drafting', 'submitted', 'awarded', 'reporting'];
  var GROUPS = [['open', 'Open', OPEN], ['watching', 'Watching', ['watching']], ['won', 'Awarded and reporting', ['awarded', 'reporting']], ['closed', 'Closed', ['declined', 'not_eligible', 'dropped', 'closed']]];
  var KINDS = { government_federal: 'Federal', government_provincial: 'Provincial', municipal: 'Municipal', foundation: 'Foundation', community_foundation: 'Community foundation', corporate: 'Corporate', student_fund: 'Student fund', in_kind: 'In kind', network: 'Network', other: 'Other' };
  var REGIONS = { canada: 'Canada', quebec: 'Quebec', montreal: 'Montreal', ontario: 'Ontario', toronto: 'Toronto', international: 'International', other: 'Other' };
  var FIT = { good: ['Good fit', 'rgba(42,140,122,.16)', '#1d6b5d'], possible: ['Possible', 'rgba(220,165,39,.2)', '#6b4d05'], weak: ['Weak', 'rgba(179,64,47,.12)', FLAG], unknown: ['Fit unknown', 'rgba(121,119,115,.14)', '#5c5a56'] };
  var FACT_CATS = [['mission', 'Mission and story'], ['history', 'History'], ['programs', 'Programs'], ['numbers', 'Numbers'], ['people', 'People and governance'], ['partners', 'Partners'], ['budget', 'Budgets and costs'], ['outcomes', 'Outcomes and evaluation'], ['equity', 'Equity and lived experience'], ['need', 'Need data'], ['documents', 'Documents'], ['answers', 'Standard answers'], ['other', 'Other']];
  var FACT_ST = { verified: ['Verified', 'rgba(42,140,122,.16)', '#1d6b5d'], needs_check: ['Needs a check', 'rgba(220,165,39,.2)', '#6b4d05'], conflict: ['In conflict', 'rgba(179,64,47,.12)', FLAG], retired: ['Retired', 'rgba(121,119,115,.14)', '#5c5a56'] };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var P = {
    home: '<path d="M4 11.5 12 4.5l8 7"/><path d="M6.5 10.5V19.5h11v-9"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    clip: '<rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6"/>',
    coins: '<circle cx="9" cy="9" r="5"/><path d="M14.5 10.5a5 5 0 1 1-4 4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    book: '<path d="M5 4.5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5z"/><path d="M19 4.5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    list: '<path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>',
    star: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    chevl: '<path d="m15 5-7 7 7 7"/>', chevr: '<path d="m9 5 7 7-7 7"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    ext: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4.5"/>',
    bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>',
    flag: '<path d="M6 21V3.5"/><path d="M6 4.5h11l-2.3 4.2L17 13H6"/>',
    doc: '<path d="M6.5 3.5h7L18 8v12.5h-11.5z"/><path d="M13.5 3.5V8H18M9 12.5h6M9 16h6"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
    warn: '<path d="M12 4 21 20H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'
  };
  function I(n, cls) { return '<svg class="w193i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.star) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function fold(s) { try { return lower(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { return lower(s); } }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function nl(s) { return E(s).replace(/\n/g, '<br>'); }
  function money(n) { var v = Number(n); if (!isFinite(v)) return ''; return '$' + Math.round(v).toLocaleString('en-CA'); }
  function kMoney(n) { n = Number(n || 0); return n >= 1000 ? '$' + (Math.round(n / 100) / 10).toString().replace(/\.0$/, '') + 'K' : money(n); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function mk(y, m, d) { var x = new Date(0); x.setFullYear(Number(y), Number(m), Number(d)); x.setHours(12, 0, 0, 0); return x; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? mk(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; }
  function today() { var d = new Date(); return mk(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function daysUntil(s) { var d = parseDay(s); if (!d) return null; return Math.round((d.getTime() - today().getTime()) / 86400000); }
  function fmtDate(s, opt) { var d = typeof s === 'string' ? parseDay(s) : s; if (!d) return ''; return d.toLocaleDateString('en-CA', opt || { month: 'short', day: 'numeric', year: 'numeric' }); }
  function fmtWhen(ts) { if (!ts) return ''; var d = new Date(ts); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([ap])\.?m\.?/i, function (x, p) { return p.toLowerCase() + 'm'; }); }
  function fyStart() { var t = today(); return t.getMonth() >= 9 ? mk(t.getFullYear(), 9, 1) : mk(t.getFullYear() - 1, 9, 1); }
  function fyLabel() { var s = fyStart(); return s.getFullYear() + '-' + String(s.getFullYear() + 1).slice(2); }
  function words(s) { s = String(s || '').trim(); return s ? s.split(/\s+/).length : 0; }
  function dueClass(s) { var n = daysUntil(s); if (n === null) return ''; return n < 0 ? 'late' : n <= 14 ? 'soon' : ''; }
  function dueText(s) { var n = daysUntil(s); if (n === null) return ''; if (n === 0) return 'today'; if (n === 1) return 'tomorrow'; if (n < 0) return (-n) + (n === -1 ? ' day ago' : ' days ago'); return 'in ' + n + ' days'; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } }
  function uniq(a) { var o = {}; return a.filter(function (x) { if (!x || o[x]) return false; o[x] = 1; return true; }); }

  /* ---------- who ---------- */
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []; } catch (e) { return []; } }
  function me() {
    var email = ''; try { email = lower((typeof USER !== 'undefined' && USER && USER.email) || ''); } catch (e) { email = ''; }
    var name = ''; try { name = (typeof who === 'function') ? String(who() || '') : ''; } catch (e) { name = ''; }
    var m = members().filter(function (x) { return email && lower(x.email) === email; })[0] || null;
    return { email: email, name: name || (m && m.name) || (email ? email.split('@')[0] : ''), dept: m ? m.department : null, id: m ? m.id : null };
  }
  function role() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function isLeader() { var r = role(); return r === 'admin' || r === 'leader'; }
  function isAdmin() { return role() === 'admin'; }
  function canEdit() { return staffOk(); }   /* the page itself is the gate: whoever opens the app works in it */
  function canDelete() { return isLeader(); }
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }

  /* ---------- state ---------- */
  var F = {
    loaded: 0, loading: null, grants: [], funders: [], finds: [], runs: [], facts: [], docs: [], drafts: [], settings: {}, events: [], sops: [], giving: null, sources: [], goals: null, log: {}, recent: [],
    sec: 'overview', view: 'pipeline', sub: '', open: null, draft: null, busy: {}, calAnchor: null, calLayers: { events: true, deadlines: true, reports: true, actions: true },
    filters: { group: lsGet('w193group') || 'open', q: '', region: '', owner: '', fit: '', watch: '', fkind: '', fstatus: '', fcat: '' }, foundAll: false, err: null, lastView: '', sheet: null, writer: { grantId: null, lang: 'en', text: '', notes: '', result: null, review: null }, scanBusy: false
  };
  function byId(list, id) { return list.filter(function (x) { return String(x.id) === String(id); })[0] || null; }
  function funderOf(g) { return g ? (byId(F.funders, g.funder_id) || g.funder || null) : null; }
  function funderName(g) { var f = funderOf(g); return f ? f.name : (g && g.funder_name) || ''; }
  function stageGroup(st) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][2].indexOf(st) >= 0) return GROUPS[i][0]; return 'closed'; }
  function sopBody(t) { var b = t && t.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } } return b && typeof b === 'object' ? b : {}; }
  function setting(k) { return (F.settings && F.settings[k]) || null; }

  /* ---------- the always-there data ---------- */
  async function loadAll(force) {
    if (F.loading) return F.loading;
    if (F.loaded && !force && Date.now() - F.loaded < 45000) return;
    F.loading = (async function () {
      var a = await Promise.all([
        q(db.from('fund_grants').select('*').order('deadline', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false })),
        q(db.from('fund_funders').select('*').order('name')),
        q(db.from('fund_scan_finds').select('*').order('created_at', { ascending: false }).limit(400)),
        q(db.from('fund_scan_runs').select('*').order('started_at', { ascending: false }).limit(8)),
        q(db.from('fund_facts').select('*').order('sort').order('title')),
        q(db.from('fund_documents').select('id, grant_id, funder_id, title, kind, lang, doc_date, words, source_url, source, created_at').order('doc_date', { ascending: false, nullsFirst: false })),
        q(db.from('fund_drafts').select('*').order('updated_at', { ascending: false }).limit(100)),
        q(db.from('fund_settings').select('*')),
        q(db.from('fund_events').select('*').order('sort').order('start_date')),
        q(db.from('trainings').select('*').eq('kind', 'sop').eq('active', true).order('sort').order('title')),
        q(db.rpc('fund_giving_summary')),
        q(db.from('fund_sources').select('*').order('kind').order('name')),
        q(db.from('hub_settings').select('value').eq('key', 'fund_goals').maybeSingle()),
        q(db.from('fund_grant_log').select('*').order('at', { ascending: false }).limit(12))
      ]);
      F.err = a[0].error ? String(a[0].error.message || a[0].error) : null;
      if (a[0].data) F.grants = a[0].data;
      if (a[1].data) F.funders = a[1].data;
      if (a[2].data) F.finds = a[2].data;
      if (a[3].data) F.runs = a[3].data;
      if (a[4].data) F.facts = a[4].data;
      if (a[5].data) F.docs = a[5].data;
      if (a[6].data) F.drafts = a[6].data;
      if (a[7].data) { F.settings = {}; a[7].data.forEach(function (r) { F.settings[r.key] = r.value; }); }
      if (a[8].data) F.events = a[8].data;
      if (a[9].data) F.sops = a[9].data;
      if (a[10].data && typeof a[10].data === 'object') F.giving = a[10].data;
      if (a[11].data) F.sources = a[11].data;
      F.goals = (a[12].data && a[12].data.value) || F.goals || { minimum: 10000, healthy: 15000, target: 20000 };
      if (a[13].data) F.recent = a[13].data;
      F.loaded = Date.now();
    })();
    try { await F.loading; } finally { F.loading = null; }
  }
  async function loadLog(grantId) {
    var r = await q(db.from('fund_grant_log').select('*').eq('grant_id', grantId).order('at', { ascending: false }).limit(60));
    F.log[grantId] = r.data || [];
    return F.log[grantId];
  }
  async function fn(name, body) {
    try {
      var r = await db.functions.invoke(name, { body: body || {} });
      if (r && r.error) {
        var msg = '';
        try { var ctx = r.error.context; if (ctx && typeof ctx.json === 'function') { var j = await ctx.json(); msg = j && (j.error || j.message) || ''; } } catch (e) { /* fine */ }
        return { ok: false, error: msg || String(r.error.message || r.error) };
      }
      var d = r && r.data; if (d && d.error && !d.ok) return { ok: false, error: d.error };
      return d || { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }
