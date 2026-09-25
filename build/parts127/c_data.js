
  /* ---------- state ---------- */
  var A = { profiles: [], byKey: {}, settings: {}, people: [], loaded: false, loading: null, edits: {}, filter: 'change', open: {}, sheet: null, busy: false };

  function applyProfiles(rows) {
    A.profiles = (rows || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    A.byKey = {}; A.profiles.forEach(function (p) { if (!p.pages || typeof p.pages !== 'object') p.pages = {}; if (!Array.isArray(p.can)) p.can = []; A.byKey[p.key] = p; });
  }
  async function load(force) {
    if (A.loading) return A.loading;
    if (A.loaded && !force) return;
    A.loading = (async function () {
      try {
        var r = await Promise.all([
          db.from('hub_access_profiles').select('*').order('sort'),
          db.from('hub_access_settings').select('*').eq('id', 1)
        ]);
        if (r[0] && !r[0].error) applyProfiles(r[0].data || []);
        A.settings = (r[1] && r[1].data && r[1].data[0]) || A.settings || {};
        A.loaded = true;
      } catch (e) { /* keep what we had: nobody changes without the profiles */ }
      A.loading = null;
    })();
    return A.loading;
  }
  async function loadPeople() {
    try {
      var r = await db.from('team_members').select('id,name,email,department,role,active').order('name');
      A.people = (r && r.data) || [];
    } catch (e) { A.people = A.people || []; }
  }

  /* ---------- who has what (the same rules as wa_page_ok in the database) ---------- */
  function rowOf(email) { email = lower(email); return rolesAll().filter(function (r) { return lower(r.email) === email; })[0] || null; }
  function handPicked(row) { return !!(row && Array.isArray(row.tabs) && row.tabs.length); }
  function isTeam(p) { return !!(p && p.tier === 'member'); }
  function profileOf(row) {
    if (!row || !row.profile) return null;
    var p = A.byKey[row.profile]; if (!p) return null;
    if (row.role === 'admin' || row.role === 'blocked' || handPicked(row)) return null;
    if ((RANK[row.role] == null ? -1 : RANK[row.role]) < RANK[p.tier]) return null;
    return p;
  }
  /* the profile that shapes my menu: mine, or the board profile for directors signed in without a staff row */
  function myProfile() {
    if (!A.loaded) return null;
    var m = mine(); if (!m) return null;
    var row = rowOf(myEmail());
    if (row) return profileOf(row);
    if (boardMode() && A.byKey.board) return A.byKey.board;
    return null;
  }
  function leadRole(role) { return role === 'leader' || role === 'admin'; }
  function valueOf(p, tab) { var v = p && p.pages ? p.pages[tab] : undefined; return v === 'all' || v === 'lead' || v === 'none' ? v : undefined; }
  function pagesFor(p, lead) {
    var out = [];
    Object.keys(p.pages || {}).forEach(function (t) { var v = p.pages[t]; if (v === 'all' || (v === 'lead' && lead)) out.push(t); });
    if (DEPTS.some(function (d) { return out.indexOf(d) >= 0; }) && out.indexOf('team') < 0) out.push('team');
    return out;
  }
  function knownTabs() {
    var t = [];
    try { t = (typeof WA40_TABS !== 'undefined' ? WA40_TABS : []).slice(); } catch (e) { t = []; }
    if (t.indexOf('adminpanel') < 0) t.push('adminpanel');
    GROUPS.forEach(function (g) { g[1].forEach(function (x) { if (t.indexOf(x) < 0) t.push(x); }); });
    return t;
  }
  /* pages the Hub has that no profile decides yet (a release added them) */
  function undecided() {
    return knownTabs().filter(function (t) { return t !== 'team' && A.profiles.some(function (p) { return valueOf(p, t) === undefined; }); });
  }
  function boardPerson() { try { var s = window.w126 && window.w126.state ? window.w126.state() : null; return !!(s && s.me && s.me.board); } catch (e) { return false; } }

  /* what a person sees today, without a profile (the classic rules and the additions later waves made) */
  function defaultsFor(role) { try { return ((typeof WA40_DEFAULTS !== 'undefined' && WA40_DEFAULTS[role]) || (typeof WA40_DEFAULTS !== 'undefined' && WA40_DEFAULTS.member) || []).slice(); } catch (e) { return []; } }
  function classicPages(row, email) {
    var role = row ? row.role : (/@welfareavenue\.com$/.test(lower(email)) ? 'member' : 'viewer');
    if (role === 'blocked') return [];
    var a = handPicked(row) ? row.tabs.slice() : defaultsFor(role);
    function add(t) { if (a.indexOf(t) < 0) a.push(t); }
    if (role !== 'viewer') { add('calendar'); add('photos'); }
    if (a.indexOf('marketing') >= 0) { add('socialstats'); add('contentcal'); }
    if (a.indexOf('fundraising') >= 0 || a.indexOf('finances') >= 0) add('fundevents');
    if (leadRole(role)) { add('governance'); add('committees'); }
    if (role !== 'admin') a = a.filter(function (t) { return t !== 'adminpanel'; });
    return a;
  }
  function profilePages(key, lead, row, email) {
    var p = A.byKey[key]; if (!p) return classicPages(row, email);
    if (p.tier === 'admin') return knownTabs();
    var out = pagesFor(p, lead || p.tier === 'leader');
    classicPages(row, email).forEach(function (t) { if (valueOf(p, t) === undefined && out.indexOf(t) < 0 && t !== 'team') out.push(t); });
    return out;
  }
  function roleFor(key, lead) { var p = A.byKey[key]; if (!p) return 'member'; if (p.tier === 'admin') return 'admin'; if (p.tier === 'leader') return 'leader'; if (p.tier === 'viewer') return 'viewer'; return lead ? 'leader' : 'member'; }

  /* ---------- the proposal ---------- */
  function teamProfile(dept) { return A.profiles.filter(function (p) { return isTeam(p) && p.team === dept; })[0] || null; }
  function leadTitle(t) { return /\b(lead|co-lead|director|co-director|head|manager|chair)\b/i.test(String(t || '')); }
  function suggestFor(x) {
    if (!x.email) return null;
    var row = x.row, role = row ? row.role : null;
    if (role === 'blocked') return null;
    if (FOUNDERS.indexOf(x.email) >= 0 || role === 'admin') return { key: 'admin', lead: false, why: role === 'admin' ? 'Admin today' : 'Founder' };
    if (x.dept === 'board') return A.byKey.board ? { key: 'board', lead: false, why: 'On the board, not on the staff team' } : null;
    var tp = teamProfile(x.dept); if (!tp) return null;
    if (role === 'viewer') return null;
    return { key: tp.key, lead: role === 'leader', why: (role === 'leader' ? 'Leads today, ' : '') + 'on the ' + deptLabel(x.dept) + ' roster' };
  }
  function people() {
    var out = [], seen = {};
    (A.people || []).forEach(function (m) {
      var em = lower(m.email);
      var x = { id: m.id, name: m.name || em.split('@')[0], title: m.role || '', dept: m.department || '', email: em, active: m.active !== false, row: em ? rowOf(em) : null };
      if (em) seen[em] = 1;
      out.push(x);
    });
    rolesAll().forEach(function (r) { var em = lower(r.email); if (em && !seen[em]) { seen[em] = 1; out.push({ id: null, name: nameFromEmail(em), title: r.note || '', dept: '', email: em, active: true, row: r, noRoster: true }); } });
    out.forEach(function (x) {
      x.role = x.row ? x.row.role : (x.email ? (/@welfareavenue\.com$/.test(x.email) ? 'member' : 'viewer') : '');
      x.assigned = x.row && x.row.profile && A.byKey[x.row.profile] && !handPicked(x.row) && x.row.role === roleFor(x.row.profile, x.row.role === 'leader') ? A.byKey[x.row.profile] : null;
      /* an admin is on the Admin profile, unless someone hand-picked their pages */
      if (!x.assigned && x.row && x.row.role === 'admin' && !handPicked(x.row) && A.byKey.admin) x.assigned = A.byKey.admin;
      x.current = profileOf(x.row);
      x.sug = suggestFor(x);
      x.today = x.email ? classicPages(x.row, x.email) : [];
      if (x.current) x.today = profilePages(x.current.key, leadRole(x.role), x.row, x.email);
      x.next = x.sug ? profilePages(x.sug.key, x.sug.lead, x.row, x.email) : null;
      x.same = !!(x.sug && x.assigned && x.assigned.key === x.sug.key && x.role === roleFor(x.sug.key, x.sug.lead));
      x.gain = x.next ? x.next.filter(function (t) { return x.today.indexOf(t) < 0 && t !== 'team'; }) : [];
      x.lose = x.next ? x.today.filter(function (t) { return x.next.indexOf(t) < 0 && t !== 'team' && t !== 'adminpanel'; }) : [];
      x.hasRow = !!x.row;
    });
    return out;
  }
  function nameFromEmail(em) { return String(em || '').split('@')[0].split(/[._-]+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); }
  function labelOf(t) { return LABEL[t] || (function () { try { var b = document.querySelector('#tabBar .tab[data-tab="' + t + '"]'); return b ? (b.textContent || '').trim() : t; } catch (e) { return t; } })(); }
  function profileName(key, lead) { var p = A.byKey[key]; if (!p) return key || ''; return p.label + (isTeam(p) && lead ? ' (lead)' : ''); }
