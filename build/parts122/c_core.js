
  /* ---------- state ---------- */
  var A = {
    loaded: 0, loading: null, err: null,
    trainings: [], byId: {}, byKey: {}, cats: [],
    prog: [], paths: null, awards: [], myAwards: {}, awardsOk: true,
    pols: [], signs: {}, acks: {}, acksFor: null,
    ui: { kind: 'all', cat: '', q: '', libN: 24 },
    welcome: 0, lastXp: null, lastLevel: null, evaluated: false, busyAw: false
  };
  var R = null;   /* the open sheet */
  var T = null;   /* the running tour */

  /* ---------- who and what they can see ---------- */
  function me() {
    var p = null; try { p = typeof wa28Me === 'function' ? wa28Me() : null; } catch (e) { p = null; }
    var email = ''; var full = '';
    try { email = String((USER && USER.email) || '').toLowerCase(); full = String((USER && USER.name) || ''); } catch (e) { /* fine */ }
    var name = p && p.name ? p.name : (full ? full.split(' ')[0] : email.split('@')[0]);
    var dept = (p && p.department) || null;
    if (!dept) { try { if (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.department) dept = WA_ME.department; } catch (e) { /* fine */ } }
    return { name: name || 'me', email: email, dept: dept, id: p && p.id ? p.id : null, full: full || name };
  }
  function staffOk() { try { return typeof isStaff === 'function' ? isStaff() : true; } catch (e) { return false; } }
  function role() {
    try { if (typeof MODE !== 'undefined' && MODE === 'board') return 'board'; } catch (e) { /* fine */ }
    try { if (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) return WA40_MINE.role; } catch (e) { /* fine */ }
    return 'member';
  }
  function isLeader() { var r = role(); return r === 'admin' || r === 'leader'; }
  function tabVisible(id) { var b = document.querySelector('#tabBar .tab[data-tab="' + id + '"]'); return !!b && b.style.display !== 'none'; }
  function tabLabel(id) { var b = document.querySelector('#tabBar .tab[data-tab="' + id + '"]'); var t = b ? String(b.textContent || '').replace(/\s+/g, ' ').trim() : ''; if (!t) { try { t = (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[id]) || id; } catch (e) { t = id; } } return t; }
  function deptTab() { var d = me().dept; if (d && tabVisible(d)) return d; for (var i = 0; i < DEPTS.length; i++) if (tabVisible(DEPTS[i])) return DEPTS[i]; return null; }
  function people() { try { return (typeof WA28_PEOPLE !== 'undefined' && WA28_PEOPLE) ? WA28_PEOPLE.filter(function (p) { return p && p.name && p.active !== false; }) : []; } catch (e) { return []; } }
  function personId() { var m = me(); if (m.id) return m.id; var pp = people(); return pp.length ? pp[0].id : null; }
  function projectId() {
    var list = []; try { list = (typeof WA27_PROJECTS !== 'undefined' && WA27_PROJECTS) || []; } catch (e) { list = []; }
    if (!list.length) return null; var d = me().dept;
    var mine = list.filter(function (p) { return p.department === d; });
    return (mine[0] || list[0]).id;
  }

  /* ---------- catalogue helpers ---------- */
  function loomId(t) {
    var cand = [t.ext_id, t.resource_url].map(function (x) { return String(x || ''); });
    for (var i = 0; i < cand.length; i++) {
      var m = cand[i].match(/loom\.com\/(?:share|embed)\/([0-9a-f]{32})/i); if (m) return m[1];
      if (i === 0 && /^[0-9a-f]{32}$/i.test(cand[i]) && (t.source === 'loom' || /loom\.com/.test(String(t.resource_url || '')))) return cand[i];
    }
    return null;
  }
  function kindOf(t) {
    if (!t) return 'read';
    if (t.kind && KIND[t.kind]) return t.kind;
    if (loomId(t) || t.source === 'loom') return 'video';
    if (/^https?:\/\//.test(String(t.resource_url || ''))) return 'doc';
    return 'read';
  }
  function minutesOf(t) {
    if (t.minutes) return t.minutes;
    if (t.duration_sec) return Math.max(1, Math.round(t.duration_sec / 60));
    var k = kindOf(t);
    if (k === 'read') return Math.max(2, Math.ceil(String(t.description || '').length / 900));
    return { video: 5, lesson: 10, doc: 5, tour: 2, sop: 7 }[k] || 5;
  }
  function xpFor(t) {
    if (t.xp) return t.xp;
    var k = kindOf(t), m = minutesOf(t);
    if (k === 'lesson') return 60; if (k === 'tour') return 20; if (k === 'sop') return 30;
    if (k === 'video') return Math.min(60, 20 + Math.round(m / 2));
    return 25;
  }
  function tourKeyOf(t) { var k = String(t && t.key || ''); return k.indexOf('tour:') === 0 ? k.slice(5) : null; }
  function visibleT(t) { if (!t || t.active === false) return false; var tk = tourKeyOf(t); if (kindOf(t) === 'tour') return !!(tk && TOURS[tk] && tourAvail(tk)); return true; }
  function embedOf(t) {
    var lid = loomId(t); if (lid) return 'https://www.loom.com/embed/' + lid + '?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true';
    var u = String(t.resource_url || ''), m;
    if ((m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/))) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    if ((m = u.match(/vimeo\.com\/(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
    if ((m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    return null;
  }
  function previewOf(u) {
    u = String(u || ''); var m;
    if ((m = u.match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]+)/))) return 'https://docs.google.com/' + m[1] + '/d/' + m[2] + '/preview';
    if ((m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    if (/\.supabase\.co\/storage\/v1\/object\/public\/.+\.pdf(\?|$)/i.test(u)) return u;
    return null;
  }
  function hostOf(u) { var m = String(u || '').match(/^https?:\/\/([^/]+)/); return m ? m[1].replace(/^www\./, '') : ''; }
  function coverStyle(t) { var k = KIND[kindOf(t)] || KIND.read; return 'background:linear-gradient(135deg,' + k.c1 + ',' + k.c2 + ')'; }

  /* ---------- load ---------- */
  function applyTrainings(rows) {
    A.trainings = (rows || []).filter(function (t) { return t && t.active !== false; });
    A.byId = {}; A.byKey = {}; var cats = {};
    A.trainings.forEach(function (t) { A.byId[String(t.id)] = t; if (t.key) A.byKey[t.key] = t; if (t.category) cats[t.category] = 1; });
    A.cats = Object.keys(cats).sort();
  }
  function load(force) {
    if (A.loading) return A.loading;
    if (A.loaded && !force && Date.now() - A.loaded < 90000) return Promise.resolve();
    var m = me();
    A.loading = (async function () {
      try {
        var r = await Promise.all([
          db.from('trainings').select('*').eq('active', true).order('sort').order('id'),
          db.from('training_progress').select('*'),
          db.from('academy_paths').select('*').eq('active', true).order('sort'),
          db.from('academy_awards').select('*').order('earned_at', { ascending: false }).limit(600),
          db.from('wa_policies').select('*').eq('active', true).eq('required', true).order('sort'),
          m.email ? db.from('wa_policy_signoffs').select('policy_key, signed_at').eq('email', m.email) : Promise.resolve({ data: [] })
        ]);
        if (r[0].error) throw r[0].error;
        applyTrainings(r[0].data || []);
        A.prog = (r[1] && r[1].data) || [];
        A.paths = (r[2] && !r[2].error && r[2].data && r[2].data.length) ? r[2].data : null;
        A.awardsOk = !(r[3] && r[3].error);
        A.awards = (r[3] && r[3].data) || [];
        A.myAwards = {}; A.awards.forEach(function (a) { if (String(a.person_name).toLowerCase() === m.name.toLowerCase()) A.myAwards[a.award] = a; });
        A.pols = (r[4] && r[4].data) || [];
        A.signs = {}; ((r[5] && r[5].data) || []).forEach(function (s) { A.signs[s.policy_key] = s.signed_at; });
        try { if (typeof wa37Load === 'function') await wa37Load(!!force); } catch (e) { /* optional */ }
        try { if (window.w112Api && !window.w112Api.loaded()) await window.w112Api.load(); } catch (e) { /* optional */ }
        try { await loadAcks(); } catch (e) { /* optional */ }
        A.err = null; A.loaded = Date.now();
      } catch (e) { A.err = String((e && e.message) || e); }
      A.loading = null;
    })();
    return A.loading;
  }

  /* ---------- progress ---------- */
  function rowFor(tid, name) { var n = String(name || me().name).toLowerCase(); for (var i = 0; i < A.prog.length; i++) { var p = A.prog[i]; if (String(p.training_id) === String(tid) && String(p.person_name).toLowerCase() === n) return p; } return null; }
  function mine(tid) { return rowFor(tid); }
  function isDone(tid) { var r = mine(tid); return !!(r && r.status === 'done'); }
  function pctOf(t) { var r = mine(t.id); if (!r) return 0; if (r.status === 'done') return 100; return Math.max(0, Math.min(99, Number(r.pct) || (r.started_at ? 5 : 0))); }
  var KEEP = ['status', 'assigned_by', 'note', 'done_at', 'started_at', 'pct', 'last_step', 'score', 'seconds', 'data'];
  async function saveProg(t, patch, who) {
    var m = me(); var name = who || m.name;
    var cur = rowFor(t.id, name) || {};
    var row = { training_id: t.id, person_name: name };
    if (!who) row.email = m.email; else if (cur.email) row.email = cur.email;
    KEEP.forEach(function (k) { if (cur[k] !== undefined) row[k] = cur[k]; });
    Object.keys(patch || {}).forEach(function (k) { row[k] = patch[k]; });
    if (!row.status) row.status = 'started';
    row.updated_at = nowIso();
    /* optimistic: the local copy is the truth until the next load */
    var found = false;
    for (var i = 0; i < A.prog.length; i++) { var p = A.prog[i]; if (String(p.training_id) === String(t.id) && String(p.person_name).toLowerCase() === String(name).toLowerCase()) { Object.keys(row).forEach(function (k) { p[k] = row[k]; }); found = true; break; } }
    if (!found) A.prog.push(Object.assign({}, row));
    try {
      var res = await db.from('training_progress').upsert(row, { onConflict: 'training_id,person_name' });
      if (res && res.error) throw res.error;
      try { if (typeof WA36_PROG !== 'undefined' && Array.isArray(WA36_PROG)) { var hit = WA36_PROG.filter(function (p) { return String(p.training_id) === String(t.id) && String(p.person_name).toLowerCase() === String(name).toLowerCase(); })[0]; if (hit) Object.keys(row).forEach(function (k) { hit[k] = row[k]; }); else WA36_PROG.push(Object.assign({}, row)); } } catch (e) { /* the classic view catches up on its next load */ }
      return true;
    } catch (e) { toastS('Could not save your progress. Check your connection and try again.'); return false; }
  }

  /* ---------- paths ---------- */
  function pathDefs() { return (A.paths && A.paths.length ? A.paths : DEFAULT_PATHS).slice().sort(function (a, b) { return (a.sort || 100) - (b.sort || 100); }); }
  function pathByKey(k) { return pathDefs().filter(function (p) { return p.key === k; })[0] || null; }
  function pathItems(p) {
    return A.trainings.filter(function (t) { return t.path_group === p.name && visibleT(t); })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0) || (a.id - b.id); });
  }
  function pathOf(t) { if (!t || !t.path_group) return null; return pathDefs().filter(function (p) { return p.name === t.path_group; })[0] || null; }
  function pathState(p) {
    var items = pathItems(p); var done = 0, left = 0, next = null, last = null;
    items.forEach(function (t) { var r = mine(t.id); if (r && r.status === 'done') { done++; if (r.done_at && (!last || r.done_at > last)) last = r.done_at; } else { left += minutesOf(t); if (!next) next = t; } });
    return { p: p, items: items, done: done, total: items.length, pct: items.length ? Math.round(100 * done / items.length) : 0, next: next, minsLeft: left, complete: items.length > 0 && done === items.length, lastDone: last };
  }
  function forMe(p) { var d = me().dept; return !!(p.required || !p.dept || p.dept === d); }

  /* ---------- onboarding ---------- */
  async function loadAcks() {
    var o = orgMine(); if (!o || !o.completed_at) return;
    if (A.acksFor === o.id) return;
    var r = await db.from('onboarding_update_acks').select('*').eq('onboarding_id', Number(o.id));
    A.acks = {}; ((r && r.data) || []).forEach(function (a) { var k = String(a.template_id); if (!A.acks[k] || A.acks[k] < a.template_updated_at) A.acks[k] = a.template_updated_at; });
    A.acksFor = o.id;
  }
  function orgMine() {
    try {
      if (typeof WA37 === 'undefined' || !WA37.onbs) return null;
      var n = me().name.toLowerCase();
      return WA37.onbs.filter(function (o) { return o.status !== 'cancelled' && String(o.person_name || '').toLowerCase() === n; })[0] || null;
    } catch (e) { return null; }
  }
  function orgState() {
    var o = orgMine(); if (!o) return { has: false };
    var map = {}; try { map = wa37StepsFor(o.id) || {}; } catch (e) { map = {}; }
    var weeks = []; try { weeks = wa37Weeks() || []; } catch (e) { weeks = []; }
    var total = 0, done = 0, next = null, nextWeek = null, curWeek = null;
    weeks.forEach(function (w) { (w.steps || []).forEach(function (t) { var s = map[t.id]; if (!s) return; total++; if (s.done) done++; else if (!next) { next = t; nextWeek = w.name; } }); });
    if (next) curWeek = nextWeek;
    var pending = [];
    if (o.completed_at) {
      try { pending = (WA37.tmpl || []).filter(function (t) { if (!t.active || !t.updated_at) return false; if (String(t.updated_at) <= String(o.completed_at)) return false; var ack = A.acks[String(t.id)]; return !(ack && String(ack) >= String(t.updated_at)); }); } catch (e) { pending = []; }
    }
    var complete = o.status === 'completed' || (total > 0 && done === total);
    return { has: true, o: o, total: total, done: done, pct: total ? Math.round(100 * done / total) : (complete ? 100 : 0), next: next, week: curWeek, complete: complete, completedAt: o.completed_at, pending: pending };
  }
  function hubState() {
    var api = window.w112Api;
    if (!api) return { has: false };
    try {
      if (!api.eligible()) return { has: false };
      var steps = api.steps() || [];
      var list = steps.map(function (s) { return { id: s.id, t: s.t, d: s.d, go: s.go, done: !!api.done(s.id), at: (api.row() && api.row().steps && api.row().steps[s.id]) || null }; });
      var done = list.filter(function (s) { return s.done; }).length;
      var row = api.row() || {};
      return { has: list.length > 0, loaded: api.loaded(), list: list, done: done, total: list.length, pct: list.length ? Math.round(100 * done / list.length) : 0, all: list.length > 0 && done === list.length, completedAt: row.completed_at || null };
    } catch (e) { return { has: false }; }
  }
  function polState() {
    var list = A.pols.map(function (p) { return { key: p.key, t: p.title, url: p.url, at: A.signs[p.key] || null }; });
    var signed = list.filter(function (p) { return p.at; }).length;
    return { has: list.length > 0, list: list, signed: signed, total: list.length, pct: list.length ? Math.round(100 * signed / list.length) : 0, all: list.length > 0 && signed === list.length };
  }
  function onbState() {
    var org = orgState(), hub = hubState(), pol = polState();
    var tot = 0, dn = 0;
    if (org.has) { tot += org.total || 1; dn += org.total ? org.done : (org.complete ? 1 : 0); }
    if (hub.has) { tot += hub.total; dn += hub.done; }
    if (pol.has) { tot += pol.total; dn += pol.signed; }
    var all = (!org.has || org.complete) && (!hub.has || hub.all) && (!pol.has || pol.all) && (org.has || hub.has || pol.has);
    var dates = [org.completedAt, hub.completedAt].concat(pol.list.map(function (p) { return p.at; })).filter(Boolean).sort();
    return { org: org, hub: hub, pol: pol, pct: tot ? Math.round(100 * dn / tot) : 0, done: dn, total: tot, all: all, cert: all && org.has, when: dates.length ? dates[dates.length - 1] : null };
  }

  /* ---------- stats, XP, level ---------- */
  function levelOf(xp) {
    var i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
    var floor = LEVELS[i][0], nxt = LEVELS[i + 1] ? LEVELS[i + 1][0] : null;
    return { n: i + 1, name: LEVELS[i][1], floor: floor, next: nxt, nextName: LEVELS[i + 1] ? LEVELS[i + 1][1] : null, pct: nxt ? Math.round(100 * (xp - floor) / (nxt - floor)) : 100, toNext: nxt ? nxt - xp : 0 };
  }
  function streaks(rows) {
    var days = {};
    rows.forEach(function (r) { [r.done_at, r.started_at].forEach(function (d) { var k = d && dayKey(d); if (k) days[k] = 1; }); });
    var keys = Object.keys(days).sort(); var best = 0, run = 0, prev = null;
    keys.forEach(function (k) { var d = new Date(k + 'T12:00:00'); if (prev && Math.round((d - prev) / 86400000) === 1) run++; else run = 1; if (run > best) best = run; prev = d; });
    var cur = 0; var probe = new Date(); probe.setHours(12, 0, 0, 0);
    if (!days[dayKey(probe)]) probe = new Date(probe.getTime() - 86400000);
    while (days[dayKey(probe)]) { cur++; probe = new Date(probe.getTime() - 86400000); }
    return { cur: cur, best: best, days: keys.length };
  }
  function stats() {
    var m = me(); var n = m.name.toLowerCase();
    var rows = A.prog.filter(function (p) { return String(p.person_name).toLowerCase() === n; });
    var doneRows = rows.filter(function (p) { return p.status === 'done' && A.byId[String(p.training_id)]; });
    var s = { rows: rows, done: doneRows.length, videos: 0, tours: 0, lessons: 0, perfect: 0, doneList: [] };
    doneRows.forEach(function (p) { var t = A.byId[String(p.training_id)]; var k = kindOf(t); if (k === 'video') s.videos++; if (k === 'tour') s.tours++; if (k === 'lesson') s.lessons++; if (k === 'lesson' && Number(p.score) === 100) s.perfect++; s.doneList.push({ t: t, r: p }); });
    var st = streaks(rows); s.streak = st.cur; s.bestStreak = st.best; s.activeDays = st.days;
    s.onb = onbState(); s.hubAll = s.onb.hub.has && s.onb.hub.all; s.polTotal = s.onb.pol.total; s.polSigned = s.onb.pol.signed;
    s.paths = pathDefs().map(pathState);
    s.certs = s.paths.filter(function (ps) { return ps.complete; }).map(function (ps) { return { award: 'cert:' + ps.p.key, title: ps.p.cert_title || ps.p.title, detail: ps.p.title, when: ps.lastDone, meta: { path: ps.p.key, color: ps.p.color, icon: ps.p.icon, items: ps.total } }; });
    if (s.onb.cert) s.certs.unshift({ award: 'cert:onboarding', title: 'Welfare Avenue Onboarding', detail: 'Onboarding', when: s.onb.when, meta: { path: 'onboarding', color: GOLD, icon: 'seal' } });
    s.certCount = s.certs.length;
    s.badges = BADGES.filter(function (b) { try { return b.test(s); } catch (e) { return false; } });
    var xp = 0;
    s.doneList.forEach(function (d) { xp += xpFor(d.t) + (kindOf(d.t) === 'lesson' && Number(d.r.score) === 100 ? 20 : 0); });
    if (s.onb.org.has) xp += s.onb.org.complete ? 100 : Math.round((s.onb.org.pct || 0) * 0.6);
    if (s.onb.hub.has) xp += s.onb.hub.all ? 50 : s.onb.hub.done * 8;
    xp += s.polSigned * 10 + s.certCount * 100 + s.badges.length * 15;
    s.xp = xp; s.level = levelOf(xp);
    var req = s.paths.filter(function (ps) { return ps.p.required && ps.total; });
    var rt = 0, rd = 0; req.forEach(function (ps) { rt += ps.total; rd += ps.done; });
    s.reqPct = rt ? Math.round(100 * rd / rt) : 100; s.reqDone = rd; s.reqTotal = rt;
    var assigned = rows.filter(function (p) { return p.assigned_by && A.byId[String(p.training_id)]; });
    s.assigned = assigned.length; s.assignedDone = assigned.filter(function (p) { return p.status === 'done'; }).length;
    return s;
  }
  function earnedList(s) {
    var out = [];
    s.certs.forEach(function (c) { out.push({ award: c.award, kind: 'cert', title: c.title, detail: c.detail, meta: c.meta, when: c.when }); });
    s.badges.forEach(function (b) { out.push({ award: 'badge:' + b.id, kind: 'badge', title: b.t, detail: b.d, meta: { icon: b.icon, color: b.c }, when: null }); });
    for (var n = 2; n <= s.level.n; n++) out.push({ award: 'level:' + n, kind: 'level', title: 'Level ' + n + ': ' + LEVELS[n - 1][1], detail: LEVELS[n - 1][0] + ' XP', meta: { n: n }, when: null });
    return out;
  }
  function certNo(a, when) {
    var code = { onboarding: 'ONB', foundations: 'FND', hub: 'HUB', tours: 'NAV', marketing: 'MKT', branding: 'BRD', ops: 'OPS', keela: 'KLA', governance: 'GOV' }[(a.meta && a.meta.path) || ''] || 'CRT';
    var d = new Date(when || a.earned_at || Date.now());
    return 'WA-' + code + '-' + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '-' + initials(me().full).replace(/[^A-Z]/g, '');
  }
  /* persist what is newly earned; returns the new ones (the celebration list) */
  async function evaluate(opt) {
    opt = opt || {};
    if (!A.loaded) return { fresh: [], s: null };
    var s = stats(); var m = me();
    var earned = earnedList(s);
    var fresh = earned.filter(function (a) { return !A.myAwards[a.award]; });
    var first = !A.evaluated; A.evaluated = true;
    var prevXp = A.lastXp == null ? s.xp : A.lastXp, prevLevel = A.lastLevel == null ? s.level.n : A.lastLevel;
    A.lastXp = s.xp; A.lastLevel = s.level.n;
    if (fresh.length && A.awardsOk && !A.busyAw) {
      var backfill = first && Object.keys(A.myAwards).length === 0;
      var lastAct = null; s.rows.forEach(function (r) { [r.done_at, r.started_at].forEach(function (d) { if (d && (!lastAct || d > lastAct)) lastAct = d; }); });
      var rows = fresh.map(function (a) { return { person_name: m.name, email: m.email, award: a.award, kind: a.kind, title: a.title, detail: a.detail || null, meta: a.meta || {}, earned_at: backfill ? (a.when || lastAct || nowIso()) : nowIso() }; });
      rows.forEach(function (r) { A.myAwards[r.award] = r; A.awards.unshift(r); });
      A.busyAw = true;
      try { var res = await db.from('academy_awards').upsert(rows, { onConflict: 'person_name,award', ignoreDuplicates: true }); if (res && res.error) throw res.error; } catch (e) { /* stays local for this visit; the next visit retries */ }
      A.busyAw = false;
      if (backfill) { if (fresh.length && lsGet('w122welcome:' + m.email) !== '1') A.welcome = fresh.length; return { fresh: [], s: s, backfilled: fresh.length }; }
    }
    if (first && !opt.celebrate) return { fresh: [], s: s };
    return { fresh: fresh, s: s, xpGained: Math.max(0, s.xp - prevXp), levelUp: s.level.n > prevLevel ? s.level : null };
  }
