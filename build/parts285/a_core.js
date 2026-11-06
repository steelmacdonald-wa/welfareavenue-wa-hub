/* =====================================================================
   WA v285 The onboarding pages reshaped (06/11/26)
   =====================================================================
   Steel (05/11/26): "the onboarding pages really need to be revamped, it's too messy and information is everywhere. Please reshape it to make
   sense", with the journey from applicant through onboarding to full member as the backbone; and Alyx showed 20% while she was about 80% done.
   The design is claude/05-11-26 - Onboarding pages reshaped, design (wave285).md (approved 06/11/26 with "Yes, build it", the three open points on
   their defaults: finished plans leave the list as a count line; the "Assign an onboarding to..." picker and the Welcome kit retire, and a plan for
   someone who skipped recruitment starts from their Team profile; behind = open steps whose section has ended).

   HR Centre > Onboarding answers three questions, top to bottom (b_page.js):
     1. Needs you: what waits on the person looking, or on HR, one line and one button each ("Nothing needs you" when empty).
     2. Everyone, by stage: one row per person under Offer out, Accepted, Starting, Weeks 1 to 4, 60 and 90 days: name and role, manager, whose turn
        in words, one progress figure for their stage, Open. Finished plans are a count line with a link.
     3. One person, opened (c_panel.js): a side panel (a full screen on a phone) with Overview, Setup, Plan and Academy.
   The panel's actions are wave271's and wave275's own: their card is drawn (window.o271R) into a detached element and its parts are placed in the
   tabs, inside one element that carries data-o271flow, so every button, picker and field keeps the handlers those waves put on the document. The
   card of the flow that is open is taken out of wave271's hidden section after each paint, so the page never holds two copies of one card.
   Quizzes and feedback move to a new sub-page, Onboarding insights; the plan editor is renamed Plan template; the first password box moves to
   Needs you when unset and to the Plan template page when set; the manager's Home gets one card per hire (d_home.js).

   The progress rule (this file), one function for every count: only real steps count; a group header (a step whose template has children in the
   same plan) is done when all its children are done and never counts by itself; a setup step (onboarding_template.setup_covered) counts as done
   when the person's setup covered it (no flow: they joined before automatic setup and had their accounts already; a flow: its twelve setup ticks
   are all in); a step whose Academy training (training_id) is done in training_progress counts as done. Behind = open steps whose section has
   ended (the section ends on day one + 7, 14, 21, 28, 60 or 90 days). wa37Pct and wave166's planStates (as wave167's journey reads it) follow it.
   Page only: no edge function, table or SQL changes. Built from build/parts285 (assemble.py). */
(function () {
  if (window.w285) return;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', INK = '#1F201E';
  var LINE = 'rgba(16,63,57,.12)', SOFT = 'rgba(16,63,57,.64)';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif", HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var TZ = 'America/Toronto';
  /* the plan's sections: their order, the day they end (day one + n) and their name */
  var SEC = { 'WEEK 1': [1, 7, 'Week 1'], 'WEEK 2': [2, 14, 'Week 2'], 'WEEK 3': [3, 21, 'Week 3'], 'WEEK 4': [4, 28, 'Week 4'], '60 DAYS': [5, 60, '60 days'], '90 DAYS': [6, 90, '90 days'], '6 MONTHS': [7, 182, '6 months'] };
  var EARLY = { 'WEEK 1': 1, 'WEEK 2': 1, 'WEEK 3': 1, 'WEEK 4': 1 };
  /* the hire's own setup (onboard-link SETUP, twelve steps, as parts275 RUNDOWN): ticks are setup_ticks.rd_<key> */
  var RUNDOWN = [['google', 'Their Google account'], ['chrome', 'Chrome'], ['bookmarks', 'Gmail and Calendar'], ['drive', 'Drive'], ['groups', 'Groups'], ['hub', 'The Hub'], ['slack', 'Slack'],
    ['canva', 'Canva'], ['academy', 'The Academy'], ['jd', 'The job description'], ['weekly', 'The weekly meeting'], ['phone', 'The phone apps']];
  /* the twelve automatic steps (wave271's eight and wave278's four), in the words of this wave */
  var AUTO = [['roster', 'Roster profile'], ['google', 'Google account'], ['plan', 'Plan'], ['invites', 'Calendar invites'], ['manager', 'Tell the manager'], ['hub', 'Hub access'],
    ['slack', 'Slack channel'], ['welcome', 'Welcome email'], ['groups', 'Google Groups'], ['drives', 'Shared drives'], ['meeting', 'Weekly meeting'], ['channel', 'Slack onboarding channel']];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- small helpers ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function plain(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function first(name) { return plain(name).split(' ')[0] || ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function torDate(ms) {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); } catch (e) { return new Date(ms).toISOString().slice(0, 10); }
  }
  function today() { return torDate(Date.now()); }
  function dOf(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  /* a date column stays as it is; an instant becomes its Toronto date */
  function dayOf(v) { if (!v) return ''; var s = String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; var t = Date.parse(s); return isNaN(t) ? '' : torDate(t); }
  function addDays(s, n) { var t = dOf(s); return isNaN(t) ? '' : new Date(t + n * 86400000).toISOString().slice(0, 10); }
  function diffDays(a, b) { var x = dOf(a), y = dOf(b); return isNaN(x) || isNaN(y) ? NaN : Math.round((x - y) / 86400000); }
  function fmtDay(v) { var s = dayOf(v), t = dOf(s); if (isNaN(t)) return ''; var d = new Date(t); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function secName(k) { return (SEC[k] && SEC[k][2]) || String(k || '').charAt(0) + String(k || '').slice(1).toLowerCase(); }
  function secRank(k) { return (SEC[k] && SEC[k][0]) || 9; }
  function secEnd(start, k) { return start ? addDays(start, (SEC[k] && SEC[k][1]) || 90) : ''; }
  function toastS(t) { try { toast(t); } catch (e) { /* no toast */ } }

  function O() { return window.o271 || null; }
  function R() { return window.o271R || null; }
  function S271() { try { var o = O(); return o ? o.state() : null; } catch (e) { return null; } }
  function W37() { return (typeof WA37 !== 'undefined' && WA37) ? WA37 : { onbs: [], steps: [], tmpl: [], loaded: false }; }
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []; } catch (e) { return []; } }
  function memberById(id) { if (id == null || id === '') return null; var s = S271(), all = members().concat((s && s.people) || []); for (var i = 0; i < all.length; i++) if (all[i] && String(all[i].id) === String(id)) return all[i]; return null; }
  function memberByName(n) { n = lower(plain(n)); if (!n) return null; return members().filter(function (m) { return m && lower(m.name) === n; })[0] || null; }
  function meEmail() { try { return lower(USER && USER.email); } catch (e) { return ''; } }
  function meMember() { var em = meEmail(); if (!em) return null; return members().filter(function (m) { return m && lower(m.email) === em; })[0] || null; }
  function isHr() { try { return typeof window.wa46IsHr === 'function' && !!window.wa46IsHr(); } catch (e) { return false; } }
  function isAdmin() { try { var o = O(); if (o && o.isAdmin) return !!o.isAdmin(); return WA40_MINE.role === 'admin'; } catch (e) { return false; } }
  function teamLabel(d) { try { return (window.WA_TEAMS && WA_TEAMS.label && WA_TEAMS.label[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }

  /* ---------- positions: the person's title and who they report to (org_positions, read once) ---------- */
  var POS = { rows: null, loading: null };
  function loadPositions() {
    if (POS.rows || POS.loading) return POS.loading || Promise.resolve();
    if (typeof db === 'undefined' || !db || typeof db.from !== 'function') return Promise.resolve();
    POS.loading = Promise.resolve(db.from('org_positions').select('id, member_id, title, reports_to, department')).then(function (r) {
      POS.rows = (r && !r.error && r.data) || [];
    }).catch(function () { POS.rows = []; }).then(function () { POS.loading = null; try { window.w285.paintAll(); } catch (e) { /* not ready */ } });
    return POS.loading;
  }
  function seatOf(mid) { if (!POS.rows || mid == null) return null; return POS.rows.filter(function (p) { return String(p.member_id) === String(mid); })[0] || null; }
  function bossOf(mid) {
    var s = seatOf(mid); if (!s || s.reports_to == null) return null;
    var up = POS.rows.filter(function (p) { return String(p.id) === String(s.reports_to); })[0];
    return up && up.member_id != null ? memberById(up.member_id) : null;
  }

  /* ---------- the Academy: what a person finished (wave122's data, the same match as wave166's ctxFor) ---------- */
  function academy() { try { var A = window.w122 && window.w122.A; return A && A.loaded ? A : null; } catch (e) { return null; } }
  function doneSet(who) {
    var A = academy(), out = {}; if (!A || !who) return out;
    var n = lower(who.name), em = lower(who.email);
    (A.prog || []).forEach(function (p) { if (p && p.status === 'done' && ((n && lower(p.person_name) === n) || (em && lower(p.email) === em))) out[String(p.training_id)] = true; });
    return out;
  }
  /* the person's avenues: each active path, its trainings and how many are done (tours count on the tours path only) */
  function avenues(who) {
    var A = academy(); if (!A) return null;
    var done = doneSet(who), by = {};
    (A.trainings || []).forEach(function (t) { if (!t || t.active === false || (t.body && t.body.planned)) return; (by[t.path_group] = by[t.path_group] || []).push(t); });
    return (A.paths || []).filter(function (p) { return p && p.active !== false; }).map(function (p) {
      var items = (by[p.name] || []).filter(function (t) { return t.kind !== 'tour' || p.key === 'tours'; });
      return { key: p.key, title: p.title || p.name, required: !!p.required, done: items.filter(function (t) { return done[String(t.id)]; }).length, total: items.length, sort: p.sort == null ? 1e9 : Number(p.sort) };
    }).filter(function (p) { return p.total > 0; }).sort(function (a, b) { return (b.required - a.required) || (a.sort - b.sort); });
  }

  /* ---------- flows and setup ---------- */
  function ticks(flow) { var t = flow && flow.setup_ticks && typeof flow.setup_ticks === 'object' ? flow.setup_ticks : {}; return RUNDOWN.filter(function (r) { var v = t['rd_' + r[0]]; return v != null && v !== false; }); }
  function flowId(f) { return f ? (f.flow_id != null ? f.flow_id : f.id) : null; }
  function flowsAll() { var s = S271(); if (!s) return []; return (s.ready || []).concat(s.started || [], s.mineList || [], s.backed || []); }
  /* the person's flow: by the plan it made, else by the member (never a practice flow; a name only when neither side has a member id) */
  function flowForOnb(onb) {
    if (!onb) return null;
    var all = flowsAll().filter(function (f) { return f && !f.practice; });
    return all.filter(function (f) { return f.onboarding_id != null && String(f.onboarding_id) === String(onb.id); })[0]
      || all.filter(function (f) {
        if (f.status === 'backed_out') return false;
        if (onb.member_id != null && f.member_id != null) return String(f.member_id) === String(onb.member_id);
        return onb.member_id == null && f.member_id == null && !!lower(plain(f.name)) && lower(plain(f.name)) === lower(onb.person_name);
      })[0] || null;
  }
  /* when automatic setup began (app_config onboard_v2_since, read once; every staff member can read it) */
  var V2 = { at: null, asked: false, failed: false };
  function loadV2() {
    if (V2.asked) return; if (typeof db === 'undefined' || !db || typeof db.from !== 'function') return;
    V2.asked = true;
    Promise.resolve(db.from('app_config').select('key, value').eq('key', 'onboard_v2_since')).then(function (r) {
      var row = r && !r.error && (r.data || [])[0], t = row ? Date.parse(String(row.value).replace(/^"|"$/g, '')) : NaN;
      if (!isNaN(t)) V2.at = t; else V2.failed = true;
    }).catch(function () { V2.failed = true; V2.asked = false; }).then(function () { CACHE.gen++; try { window.w285.paintAll(); } catch (e) { /* not ready */ } });
  }
  /* the person's setup covered the plan's setup steps:
     - their roster profile was made before automatic setup began (they joined before it, so they had their accounts already), from data every
       staff member reads (team_members.created_at and onboard_v2_since), never from what happens to be in memory;
     - or their flow's twelve setup ticks are all in.
     Anything not known counts as not covered. */
  function setupCovered(onb, flow) {
    var f = flow === undefined ? flowForOnb(onb) : flow;
    if (f && ticks(f).length >= RUNDOWN.length) return true;
    loadV2();
    var m = onb && onb.member_id != null ? memberById(onb.member_id) : null, made = m && m.created_at ? Date.parse(m.created_at) : NaN;
    if (V2.at != null && !isNaN(made)) return made < V2.at;
    return false;
  }

  /* ---------- the progress rule ---------- */
  var TM = { src: null, map: {}, byName: {} };
  function tmplMap() {
    var W = W37();
    if (TM.src !== W.tmpl) {
      TM.src = W.tmpl; TM.map = {}; TM.byName = {};
      (W.tmpl || []).forEach(function (t) { if (t && t.active !== false) { TM.map[String(t.id)] = t; TM.byName[lower(t.name) + '|' + t.section] = TM.byName[lower(t.name) + '|' + t.section] || t; } });
    }
    return TM.map;
  }
  function onbById(id) { return (W37().onbs || []).filter(function (o) { return String(o.id) === String(id); })[0] || null; }
  function personOfOnb(onb) {
    var m = onb && onb.member_id != null ? memberById(onb.member_id) : null;
    if (!m && onb) m = memberByName(onb.person_name);
    return { name: (onb && onb.person_name) || (m && m.name) || '', email: (m && m.email) || '' };
  }
  /* the sections of a plan from its leaves: [{key, label, done, total, end, ended, current, leaves}] and the totals */
  function shape(leaves, start, extra) {
    var by = {}, keys = [], t0 = today();
    leaves.forEach(function (x) { if (!by[x.section]) { by[x.section] = []; keys.push(x.section); } by[x.section].push(x); });
    keys.sort(function (a, b) { return secRank(a) - secRank(b) || String(a).localeCompare(String(b)); });
    var out = { total: 0, done: 0, w14: { done: 0, total: 0 }, behind: 0, behindDays: 0, sections: [], start: start || '', day: start ? diffDays(t0, start) + 1 : null };
    var cur = null;
    keys.forEach(function (k) {
      var L = by[k], d = L.filter(function (x) { return x.done; }).length, end = secEnd(start, k), ended = !!end && t0 > end;
      var sec = { key: k, label: secName(k), done: d, total: L.length, end: end, ended: ended, leaves: L, current: false };
      out.total += L.length; out.done += d;
      if (EARLY[k]) { out.w14.total += L.length; out.w14.done += d; }
      if (ended && d < L.length) { out.behind += L.length - d; out.behindDays = Math.max(out.behindDays, diffDays(t0, end)); }
      if (!cur && !ended && d < L.length) cur = sec;
      out.sections.push(sec);
    });
    if (!cur) cur = out.sections.filter(function (s) { return s.done < s.total; })[0] || null;
    if (cur) cur.current = true;
    out.pct = out.total ? Math.round(100 * out.done / out.total) : 0;
    out.w14.pct = out.w14.total ? Math.round(100 * out.w14.done / out.w14.total) : 0;
    out.behindWeek = out.behindDays > 7;
    return Object.assign(out, extra || {});
  }
  /* one leaf, the same rule wherever its facts come from */
  function leafOf(t, done0, acad, cover) {
    var a = t && t.training_id != null && !!acad[String(t.training_id)], c = !!(t && t.setup_covered && cover);
    return { done: !!done0 || a || c, how: done0 ? 'ticked' : a ? 'academy' : c ? 'setup' : '' };
  }
  /* a plan from the tables (WA37): HR, managers and the hire (every staff member reads them) */
  function planOf(onbId, flow) {
    var onb = typeof onbId === 'object' ? onbId : onbById(onbId); if (!onb) return null;
    var tm = tmplMap(), W = W37();
    var rows = (W.steps || []).filter(function (s) { return String(s.onboarding_id) === String(onb.id) && tm[String(s.template_id)]; });
    var inPlan = {}; rows.forEach(function (s) { inPlan[String(s.template_id)] = s; });
    var kids = {};
    rows.forEach(function (s) { var t = tm[String(s.template_id)]; if (t.parent_id != null && inPlan[String(t.parent_id)]) (kids[String(t.parent_id)] = kids[String(t.parent_id)] || []).push(s); });
    var who = personOfOnb(onb), acad = doneSet(who), cover = setupCovered(onb, flow);
    var leaves = [], heads = {};
    rows.forEach(function (s) {
      var t = tm[String(s.template_id)];
      if (kids[String(t.id)]) return;
      var L = leafOf(t, s.done, acad, cover), p = t.parent_id != null ? tm[String(t.parent_id)] : null;
      leaves.push({ id: s.id, tid: t.id, name: t.name, section: t.section, done: L.done, how: L.how, due: s.due_date || null, academy: !!(t.training_id || t.academy_path),
        path: t.academy_path || null, parent: p && inPlan[String(p.id)] ? p.name : null, psort: Number(p && inPlan[String(p.id)] ? p.sort : t.sort) || 0, sort: Number(t.sort) || 0, child: !!(p && inPlan[String(p.id)]) });
    });
    Object.keys(kids).forEach(function (h) { heads[h] = kids[h].every(function (s) { return leafOf(tm[String(s.template_id)], s.done, acad, cover).done; }); });
    leaves.sort(function (a, b) { return secRank(a.section) - secRank(b.section) || a.psort - b.psort || (a.child - b.child) || a.sort - b.sort; });
    return shape(leaves, dayOf(onb.started_at), { onbId: onb.id, heads: heads, src: 'tables', status: onb.status });
  }
  /* a plan from the lead's card (onboarding_lead_view: steps in order, a child after its header; ticks as the database says). The lead's card has
     no template facts, so they come from the template rows when the page has them (by name and section); without them the figure counts the ticks
     only and says so (src 'lead', exact false). */
  function planFromLead(p) {
    if (!p) return null;
    tmplMap();
    var st = p.steps || [], leaves = [], lastTop = null, known = !!(W37().tmpl || []).length;
    var onb = onbById(p.onboarding_id) || { id: p.onboarding_id, member_id: p.member_id, person_name: p.name };
    var acad = doneSet({ name: p.name, email: p.email }), cover = known ? setupCovered(onb) : false;
    st.forEach(function (s, i) {
      var nx = st[i + 1], head = !s.child && nx && nx.child && nx.section === s.section;
      if (!s.child) lastTop = s;
      if (head) return;
      var t = TM.byName[lower(s.name) + '|' + s.section] || null, L = leafOf(t, s.done, acad, cover);
      leaves.push({ id: s.id, tid: t ? t.id : null, name: s.name, section: s.section, done: L.done, how: L.how, due: s.due || null, academy: !!s.academy, path: t ? t.academy_path || null : null,
        parent: s.child && lastTop ? lastTop.name : null, child: !!s.child });
    });
    var start = dayOf(p.started_at) || (p.day != null ? addDays(today(), 1 - Number(p.day)) : '');
    return shape(leaves, start, { onbId: p.onboarding_id, src: 'lead', exact: known });
  }
  /* the plan for an onboarding: the tables when they hold it, else the lead's card. One answer per onboarding per pass (the cache clears on the
     next tick and whenever the arrays it reads are replaced) */
  function leadPerson(onbId) { try { var L = window.w166 && window.w166.state && window.w166.state().lead; return ((L && L.people) || []).filter(function (p) { return String(p.onboarding_id) === String(onbId); })[0] || null; } catch (e) { return null; } }
  var CACHE = { gen: 0, key: null, map: {}, t: null };
  function cacheKey() {
    var W = W37(), A = academy(), s = S271(), L = null; try { L = window.w166 && window.w166.state && window.w166.state().lead; } catch (e) { L = null; }
    return [CACHE.gen, W.steps, W.tmpl, W.onbs, A && A.prog, s && s.ready, s && s.started, s && s.mineList, L, members()];
  }
  function sameKey(a, b) { if (!a || !b || a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function plan(onbId, flow) {
    var k = cacheKey();
    if (!sameKey(k, CACHE.key)) { CACHE.key = k; CACHE.map = {}; }
    if (!CACHE.t) CACHE.t = setTimeout(function () { CACHE.t = null; CACHE.map = {}; }, 0);
    var ck = String(onbId) + (flow === undefined ? '' : '|' + (flow ? flowId(flow) : 'none'));
    if (Object.prototype.hasOwnProperty.call(CACHE.map, ck)) return CACHE.map[ck];
    var W = W37(), has = (W.steps || []).some(function (s) { return String(s.onboarding_id) === String(onbId); }), out;
    if (has && onbById(onbId)) out = planOf(onbId, flow);
    else { var lp = leadPerson(onbId); out = lp ? planFromLead(lp) : (onbById(onbId) ? planOf(onbId, flow) : null); }
    CACHE.map[ck] = out;
    return out;
  }
  /* for wave166's checklist and syncHead and wave122's Academy (parts166/c_plan.js and parts122/c_core.js ask, see the notes there) */
  function secCount(onbId, key) { var p = plan(onbId); if (!p) return null; var s = p.sections.filter(function (x) { return x.key === key; })[0]; return s ? { done: s.done, total: s.total } : { done: 0, total: 0 }; }
  /* why a step reads done: { done, header, how: 'ticked' | 'academy' | 'setup' | '' } (null when the plan is not in the tables) */
  function stepWhy(onbId, tid) {
    var p = plan(onbId); if (!p || p.src !== 'tables') return null;
    if (p.heads && Object.prototype.hasOwnProperty.call(p.heads, String(tid))) return { done: p.heads[String(tid)], header: true, how: '' };
    var l = p.sections.reduce(function (a, s) { return a.concat(s.leaves); }, []).filter(function (x) { return String(x.tid) === String(tid); })[0];
    return l ? { done: l.done, header: false, how: l.how } : null;
  }
  function stepDone(onbId, tid) { var w = stepWhy(onbId, tid); return w ? w.done : null; }
  /* the first open real step (never a header, never a covered step): { tid, section } */
  function firstOpen(onbId) {
    var p = plan(onbId); if (!p || p.src !== 'tables') return null;
    for (var i = 0; i < p.sections.length; i++) for (var j = 0; j < p.sections[i].leaves.length; j++) { var l = p.sections[i].leaves[j]; if (!l.done) return { tid: l.tid, section: p.sections[i].key }; }
    return null;
  }

  /* wa37Pct: every older caller that shows a figure (the Training tab, wave39, wave44) counts with the same rule. The decisions that write
     (wave37's "completed" on the last tick, wave122's certificate) keep the raw count, wa37PctRaw: never more generous than before. */
  if (typeof wa37Pct === 'function') {
    var __pct37 = wa37Pct;
    window.wa37PctRaw = __pct37;
    wa37Pct = function (onbId) {
      try { var p = plan(onbId); if (p) return { done: p.done, total: p.total, pct: p.pct }; } catch (e) { /* the older count */ }
      return __pct37(onbId);
    };
  }
  /* ---------- when a plan is complete (the decisions that write: wave37's "completed", wave122's certificate and XP) ----------
     Complete when the raw count is (every row ticked in the table), or when the rule's facts are all known and every real step is done:
     the plan's rows are in the tables, a step counted at setup was counted from data (setupCovered never counts from what is unknown), and a
     step counted in the Academy was counted from training_progress rows this viewer loaded (the Academy's data is loaded). Anything else: raw only. */
  function completeKnown(onbId) {
    try {
      var raw = typeof __pct37 === 'function' ? __pct37(onbId) : null;
      if (raw && raw.total > 0 && raw.done === raw.total) return true;
      var onb = onbById(onbId), W = W37();
      if (!onb || !(W.steps || []).some(function (s) { return String(s.onboarding_id) === String(onbId); })) return false;
      var p = planOf(onb); if (!p || p.src !== 'tables' || !p.total || p.done < p.total) return false;
      var leaves = p.sections.reduce(function (a, s) { return a.concat(s.leaves); }, []);
      if (leaves.some(function (l) { return l.how === 'academy'; }) && !academy()) return false;
      if (leaves.some(function (l) { return l.how === 'setup'; }) && !setupCovered(onb)) return false;
      return true;
    } catch (e) { return false; }
  }
  /* the rows a completed plan still has open in the table, and why the rule counted them: headers whose steps are all done, steps setup covered,
     steps finished in the Academy. wave37's tick handler writes them done (its own write, onboarding_steps) before it marks the plan completed. */
  function derivedRows(onbId) {
    var onb = onbById(onbId), W = W37(); if (!onb) return [];
    var p = planOf(onb); if (!p || p.src !== 'tables') return [];
    var mine = (W.steps || []).filter(function (s) { return String(s.onboarding_id) === String(onbId); }), out = [];
    mine.forEach(function (s) {
      if (s.done) return;
      var tid = String(s.template_id);
      if (p.heads && Object.prototype.hasOwnProperty.call(p.heads, tid)) { if (p.heads[tid]) out.push({ id: s.id, by: 'Hub: done when its steps were' }); return; }
      var l = p.sections.reduce(function (a, x) { return a.concat(x.leaves); }, []).filter(function (x) { return String(x.tid) === tid; })[0];
      if (l && l.done && l.how === 'setup') out.push({ id: s.id, by: 'Hub: done at setup' });
      else if (l && l.done && l.how === 'academy') out.push({ id: s.id, by: 'Hub: done in the Avenue Academy' });
    });
    return out;
  }

  /* wave166's planStates as other waves read it (wave167's journey: its ring, its week counts and the next step): headers out, the rule's done */
  (function wrap166(tries) {
    var W = window.w166;
    if (!W || typeof W.planStates !== 'function') { if ((tries || 0) < 20) setTimeout(function () { wrap166((tries || 0) + 1); }, 500); return; }
    if (W.planStates.__w285) return;
    var orig = W.planStates;
    W.planStates = function (onb) {
      var weeks = orig.apply(this, arguments) || [];
      try {
        var p = onb ? plan(onb.id) : null; if (!p || p.src !== 'tables') return weeks;
        var leafDone = {}; p.sections.forEach(function (s) { s.leaves.forEach(function (l) { leafDone[String(l.tid)] = l.done; }); });
        return weeks.map(function (wk) {
          return Object.assign({}, wk, { steps: wk.steps.filter(function (x) { return !(p.heads && Object.prototype.hasOwnProperty.call(p.heads, String(x.t.id))); })
            .map(function (x) { var d = leafDone[String(x.t.id)]; return d == null ? x : Object.assign({}, x, { done: d }); }) });
        }).filter(function (wk) { return wk.steps.length; });
      } catch (e) { return weeks; }
    };
    W.planStates.__w285 = true;
  })(0);

  /* ---------- the people: one row per person, from the flows (wave271 and wave275) and the plans (WA37 or the lead's card) ---------- */
  function stepRow(f, key) { return ((f && f.steps) || []).filter(function (r) { return r.step === key; })[0] || null; }
  /* a step left running was cut off (wave271's rule); the Slack onboarding channel waits for them to join Slack (the hourly job tries again), so it is never stuck */
  function stuck(r) { var o = O(); return !!r && r.step !== 'channel' && (r.status === 'running' || r.status === 'pending') && r.at && Date.now() - Date.parse(r.at) >= ((o && o.STALE_MS) || 600000); }
  function setupCount(f) {
    var c = { done: 0, hr: 0, failed: 0, waiting: 0, total: AUTO.length };
    AUTO.forEach(function (a) {
      var r = stepRow(f, a[0]);
      if (!r) { c.waiting++; return; }
      if (r.status === 'done' || r.status === 'skipped') c.done++;
      else if (r.status === 'hr_task') c.hr++;
      else if (r.status === 'failed' || stuck(r)) c.failed++;
      else c.waiting++;
    });
    return c;
  }
  function mgrOfFlow(f) {
    if (!f) return null;
    var id = f.manager_member_id != null ? f.manager_member_id : (f.default_manager && f.default_manager.member_id);
    if (id == null) return null;
    var m = memberById(id), nm = (m && m.name) || f.manager_name || (f.default_manager && f.default_manager.name) || '';
    return { id: id, name: nm || 'Their manager' };
  }
  /* who: the list's people. ctx 'hr' (every flow and plan HR sees) or 'home' (the signed-in manager's own hires) */
  function collect(ctx, opt) {
    var S = S271() || {}, W = W37(), out = [], by = {}, me = meMember();
    function keyFor(mid, name, fid) { return mid != null ? 'm' + mid : fid != null ? 'f' + fid : 'n' + lower(plain(name)).replace(/[^a-z0-9]+/g, '-'); }
    /* the same person: the same member, or the plan their flow made; by name only when neither has a member id, and never a practice flow */
    function find(mid, name, onbId, practice) {
      for (var i = 0; i < out.length; i++) {
        var P = out[i];
        if (mid != null && P.mid != null && String(P.mid) === String(mid)) return P;
        if (onbId != null && P.flow && P.flow.onboarding_id != null && String(P.flow.onboarding_id) === String(onbId)) return P;
        if (!practice && !P.practice && mid == null && P.mid == null && lower(plain(name)) && lower(plain(P.name)) === lower(plain(name))) return P;
      }
      return null;
    }
    function add(P) { if (by[P.key]) P.key += '-' + out.length; by[P.key] = P; out.push(P); return P; }
    function addFlow(x, kind) {
      var fid = flowId(x), mid = x.member_id != null ? x.member_id : null;
      var had = find(mid, x.name, x.onboarding_id, !!x.practice);
      if (had && had.flow) { if (kind === 'started' || had.kind !== 'started') { had.flow = x; had.kind = kind; had.fid = fid; } return had; }
      var P = had || add({ key: keyFor(mid, x.name, fid), name: plain(x.name) || 'Someone', mid: mid });
      P.flow = x; P.kind = kind; P.fid = fid; P.role = P.role || x.role || ''; P.email = P.email || x.email || ''; P.practice = !!x.practice;
      return P;
    }
    if (ctx === 'home') {
      if (S.mine) { (S.ready || []).forEach(function (x) { addFlow(x, 'ready'); }); (S.started || []).forEach(function (x) { addFlow(x, 'started'); }); }
      else (S.mineList || []).forEach(function (x) { addFlow(x, /^(running|started)$/.test(x.status) ? 'started' : 'ready'); });
      var L = null; try { L = window.w166 && window.w166.state && window.w166.state().lead; } catch (e) { L = null; }
      ((L && L.people) || []).forEach(function (p) {
        var P = find(p.member_id, p.name, p.onboarding_id) || add({ key: keyFor(p.member_id, p.name, null), name: plain(p.name) || 'Someone', mid: p.member_id, kind: 'plan' });
        P.lead = p; P.mid = P.mid != null ? P.mid : p.member_id; P.role = P.role || p.title || teamLabel(p.department); P.email = P.email || p.email || '';
        var o = onbById(p.onboarding_id); P.onb = o || { id: p.onboarding_id, member_id: p.member_id, person_name: p.name, status: 'active', started_at: p.started_at };
        if (!P.mgr && me) P.mgr = { id: me.id, name: me.name };
      });
    } else {
      (S.ready || []).forEach(function (x) { addFlow(x, 'ready'); });
      (S.started || []).forEach(function (x) { addFlow(x, 'started'); });
      (S.offers || []).forEach(function (c) {
        if (find(c.member_id, c.name, null)) return;
        add({ key: 'c' + c.id, name: plain(c.name) || 'Someone', role: c.role || '', kind: 'offer', cand: c, mid: c.member_id != null ? c.member_id : null });
      });
      (W.onbs || []).forEach(function (o) {
        if (!o || o.status !== 'active') return;
        var P = find(o.member_id, o.person_name, o.id);
        if (!P) P = add({ key: keyFor(o.member_id, o.person_name, null), name: plain(o.person_name) || 'Someone', mid: o.member_id, kind: 'plan' });
        if (!P.onb) P.onb = o;
        if (P.mid == null) P.mid = o.member_id;
      });
    }
    /* each person's facts */
    out.forEach(function (P) {
      var m = P.mid != null ? memberById(P.mid) : memberByName(P.name);
      if (m) { P.email = P.email || m.email || ''; if (!P.role) P.role = (seatOf(m.id) && seatOf(m.id).title) || m.role || teamLabel(m.department); }
      else if (!P.role && seatOf(P.mid)) P.role = seatOf(P.mid).title;
      if (P.flow && !P.onb && P.flow.onboarding_id != null) P.onb = onbById(P.flow.onboarding_id) || null;
      if (P.flow) P.mgr = mgrOfFlow(P.flow) || P.mgr || null;
      if (!P.mgr && P.mid != null) { var b = bossOf(P.mid); if (b) P.mgr = { id: b.id, name: b.name }; }
      derive(P, me);
    });
    var order = { offer: 1, accepted: 2, starting: 3, weeks: 4, later: 5 };
    out.sort(function (a, b) { return (order[a.stage] || 9) - (order[b.stage] || 9) || (b.plan && a.plan ? (b.plan.behind - a.plan.behind) : 0) || a.name.localeCompare(b.name); });
    var finished = ctx === 'home' ? [] : (W.onbs || []).filter(function (o) { return o && o.status === 'completed'; }).map(function (o) {
      return { key: 'done' + o.id, name: plain(o.person_name) || 'Someone', mid: o.member_id, onb: o, kind: 'plan', stage: 'done', finished: true, role: '', mgr: null };
    });
    /* the finished plans are counted always and worked out only when their list is open (or one of them is) */
    if (opt && opt.finished) finished.forEach(function (P) { var m = P.mid != null ? memberById(P.mid) : null; if (m) { P.email = m.email || ''; P.role = (seatOf(m.id) && seatOf(m.id).title) || m.role || teamLabel(m.department); } derive(P, me); });
    var backed = ctx === 'home' ? [] : (S.backed || []).map(function (f) { var P = { key: 'b' + flowId(f), name: plain(f.name) || 'Someone', role: f.role || '', flow: f, fid: flowId(f), kind: 'backed', stage: 'backed', mgr: mgrOfFlow(f), practice: !!f.practice }; derive(P, me); return P; });
    return { people: out, finished: finished, backed: backed };
  }
  function lookup(ctx, key) {
    var c = collect(ctx, { finished: /^done/.test(String(key)) });
    return c.people.concat(c.finished, c.backed).filter(function (P) { return P.key === key; })[0] || null;
  }

  /* ---------- stage, whose turn, the one figure ---------- */
  function derive(P, me) {
    var f = P.flow, t0 = today(), hr = isHr(), mine = !!(me && P.mgr && String(P.mgr.id) === String(me.id));
    var hireF = first(P.name) || 'the new hire', mgrF = P.mgr ? (first(P.mgr.name) || 'The manager') : '';
    P.plan = P.onb ? plan(P.onb.id, f || undefined) : null;
    var dayOne = f && f.call_at ? dayOf(f.call_at) : (P.onb ? dayOf(P.onb.started_at) : '');
    P.dayOne = dayOne;
    if (P.stage === 'done' || P.stage === 'backed') { /* set by collect */ }
    else if (P.kind === 'offer') P.stage = 'offer';
    else if (P.kind === 'ready') P.stage = (f.status === 'offered' || !f.accepted_on) ? 'offer' : 'accepted';
    else if (dayOne && dayOne > t0) P.stage = 'starting';
    else if (!dayOne) P.stage = 'starting';
    else P.stage = diffDays(t0, dayOne) + 1 <= 30 ? 'weeks' : 'later';
    P.day = dayOne && dayOne <= t0 ? diffDays(t0, dayOne) + 1 : null;
    var who = '', txt = '', late = false;
    if (P.stage === 'backed') { txt = 'Backed out'; }
    else if (P.stage === 'done') { txt = 'Finished' + (P.onb && P.onb.completed_at ? ' ' + fmtDay(P.onb.completed_at) : ''); }
    else if (P.stage === 'offer') {
      if (P.kind === 'offer') { txt = 'Waiting on ' + hireF + ' to accept'; who = 'hire'; }
      else if (!P.mgr) { txt = 'HR to choose a manager'; who = 'hr'; }
      else if (!f.proposed_at) { txt = (mine ? 'You' : mgrF) + ' to propose times'; who = 'mgr'; }
      else { txt = 'Waiting on ' + hireF + ' to accept'; who = 'hire'; }
    } else if (P.stage === 'accepted') {
      var grid = !!(f.grids && f.grids.hire === 'marked'), live = !!(f.proposed_at && !f.hire_answer), ask = f.ask_availability !== false;
      var M = mine ? 'You' : mgrF;
      if (!P.mgr) { txt = 'HR to choose a manager'; who = 'hr'; }
      else if (!f.propose_path && !f.proposed_at && f.status !== 'offered') { txt = grid ? 'HR to choose the times and start' : 'Waiting on ' + hireF + ' to mark their times'; who = grid ? 'hr' : 'hire'; }
      else if (f.hire_answer === 'no') { if (grid || !ask) { txt = M + ' to book ' + (grid ? 'from their times' : 'new times'); who = 'mgr'; } else { txt = 'Waiting on ' + hireF + ' to mark their times'; who = 'hire'; } }
      else if (live) { txt = 'Waiting on ' + hireF + ' to say yes to the times'; who = 'hire'; }
      else if (f.hire_answer === 'yes') { txt = 'The Hub is booking the times'; who = 'hub'; }
      else { txt = M + (ask ? ' to propose times' : ' to book the times'); who = 'mgr'; }
    } else if (P.stage === 'starting') {
      var sc = f ? setupCount(f) : null;
      if (sc && sc.failed) { txt = 'HR: ' + plural(sc.failed, 'setup step') + ' failed'; who = 'hr'; }
      else if (f) { txt = hireF + ': setup ' + ticks(f).length + ' of ' + RUNDOWN.length; who = 'hire'; }
      else { txt = 'Starts ' + fmtDay(dayOne); who = 'hire'; }
    } else {
      var p = P.plan;
      if (!p || !p.total) { txt = 'No plan steps yet'; who = 'hr'; }
      else if (p.behind) { txt = 'Behind: ' + plural(p.behind, 'step') + ' overdue'; late = true; who = 'hire'; }
      else if (p.done >= p.total) { txt = 'Every step done'; who = 'hr'; }
      else { txt = 'On track'; who = 'hire'; }
    }
    P.turn = { t: txt, who: who, cls: late ? 'late' : ((who === 'hr' && hr) || (who === 'mgr' && (mine || (hr && !P.mgr)))) ? 'your' : '' };
    /* the one figure for the stage */
    var g = { label: '', pct: null };
    if (P.stage === 'offer') g.label = P.kind === 'offer' ? (P.cand && P.cand.offer_sent_at ? 'Offer sent ' + fmtDay(P.cand.offer_sent_at) : 'Offer out') : (f.offer_sent_at ? 'Offer sent ' + fmtDay(f.offer_sent_at) : 'Offer out');
    else if (P.stage === 'accepted') g.label = f.accepted_on ? 'Accepted ' + fmtDay(f.accepted_on) : 'Accepted';
    else if (P.stage === 'starting') { if (f) { var n = ticks(f).length; g.pct = Math.round(100 * n / RUNDOWN.length); g.label = 'Setup ' + n + ' of ' + RUNDOWN.length; } else g.label = dayOne ? 'Starts ' + fmtDay(dayOne) : ''; }
    else if (P.stage === 'weeks') { if (P.plan && P.plan.w14.total) { g.pct = P.plan.w14.pct; g.label = 'Weeks 1 to 4: ' + P.plan.w14.done + ' of ' + P.plan.w14.total; } else if (P.plan && P.plan.total) { g.pct = P.plan.pct; g.label = 'Plan: ' + P.plan.done + ' of ' + P.plan.total; } else g.label = 'No plan steps'; }
    else if (P.stage === 'later' || P.stage === 'done') { if (P.plan && P.plan.total) { g.pct = P.plan.pct; g.label = 'Plan: ' + P.plan.done + ' of ' + P.plan.total; } else g.label = 'No plan steps'; }
    else if (P.stage === 'backed') g.label = f && f.updated_at ? 'Backed out ' + fmtDay(f.updated_at) : '';
    /* the lead's card without the template rows: the figure is the ticks only, and says so */
    if (P.plan && P.plan.src === 'lead' && P.plan.exact === false && /: \d+ of \d+$/.test(g.label)) g.label += ' ticked';
    P.prog = g;
    return P;
  }

  /* ---------- the look: one sheet for the page, the panel and Home ---------- */
  var css = document.createElement('style'); css.id = 'w285css';
  css.textContent = '' +
    /* the old blocks of this sub-page step aside (their functions stay: the panel draws from them) */
    '#hrcentre[data-w197="onboarding"] #o271,#hrcentre[data-w197="onboarding"] #w46body > .w46sec[data-w197s~="onboarding"],#hrcentre[data-w197="onboarding"] #w145quiz{display:none!important;}' +
    '#hrcentre[data-w197="insights"] #w145quiz{display:block!important;}' +
    '#hrcentre[data-w197] #w285,#hrcentre[data-w197] #w285set,#hrcentre[data-w197] #w285ins{background:transparent;border:0;box-shadow:none;padding:0;}' +
    '#w285,#w285set,#w285ins,#w285pan,#w285home{font-family:' + BODY + ';color:var(--wa-ink,' + INK + ');}' +
    '#w285 .w285sec{margin:0 0 28px;min-width:0;}' +
    '.w285h{font:600 22px/1.15 ' + HEAD + ';text-transform:uppercase;letter-spacing:.02em;color:' + GREEN + ';margin:0 0 10px;}' +
    '.w285box{background:var(--wa-card,#FFFAF2);border:1px solid ' + LINE + ';border-radius:14px;overflow:hidden;min-width:0;}' +
    '.w285it{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid ' + LINE + ';min-width:0;}' +
    '.w285it:first-child{border-top:0;}' +
    '.w285it > p{margin:0;flex:1 1 auto;min-width:0;font-size:14px;line-height:1.45;overflow-wrap:anywhere;}' +
    '.w285it > p b{color:' + GREEN + ';}' +
    '.w285it .w285sub{display:block;color:' + SOFT + ';font-size:13px;}' +
    '.w285dot{width:8px;height:8px;border-radius:4px;background:' + GOLD + ';flex:none;}.w285dot.r{background:' + FLAG + ';}' +
    '.w285acts{display:flex;gap:8px;flex-wrap:wrap;flex:none;justify-content:flex-end;align-items:center;}' +
    '.w285acts input{font:14px ' + BODY + ';padding:6px 10px;border:1px solid rgba(16,63,57,.25);border-radius:8px;min-width:0;width:180px;max-width:100%;}' +
    '.w285b{border:1px solid ' + GREEN + ';color:' + GREEN + ';background:var(--wa-card,#FFFAF2);border-radius:8px;padding:6px 12px;font:600 13px/1.2 ' + BODY + ';cursor:pointer;white-space:nowrap;text-decoration:none!important;display:inline-flex;align-items:center;justify-content:center;min-height:32px;box-sizing:border-box;}' +
    '.w285b:hover{background:rgba(16,63,57,.06);}.w285b.pri{background:' + GREEN + ';color:' + CREAM + ';}.w285b.pri:hover{background:#0c332e;}.w285b[disabled]{opacity:.5;cursor:default;}' +
    '.w285b:focus-visible,.w285link:focus-visible,.w285tabs button:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}' +
    '.w285none{margin:0;color:' + SOFT + ';font-size:14px;}' +
    '.w285sum{color:' + SOFT + ';font-size:14px;margin:-4px 0 12px;}' +
    '.w285stg{font:700 11px/1.2 ' + BODY + ';letter-spacing:.12em;text-transform:uppercase;color:' + SOFT + ';margin:18px 0 6px;display:flex;gap:8px;}.w285stg span{color:' + GREEN + ';}' +
    '.w285row{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.8fr) minmax(96px,150px) auto;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid ' + LINE + ';min-width:0;}' +
    '.w285row:first-child{border-top:0;}.w285row:hover{background:rgba(220,165,39,.06);}' +
    '.w285who{min-width:0;}.w285who b{display:block;color:' + GREEN + ';font-size:14.5px;overflow-wrap:anywhere;}' +
    '.w285who small{display:block;color:' + SOFT + ';font-size:13px;overflow-wrap:anywhere;}.w285who .m2{display:none;}' +
    '.w285mgr{color:' + SOFT + ';font-size:13px;min-width:0;overflow-wrap:anywhere;}' +
    '.w285turn{font-size:14px;min-width:0;overflow-wrap:anywhere;}.w285turn.your{color:' + GREEN + ';font-weight:700;}.w285turn.late{color:' + FLAG + ';font-weight:700;}' +
    '.w285prog{min-width:0;}.w285bar{height:6px;background:rgba(16,63,57,.1);border-radius:3px;overflow:hidden;}.w285bar i{display:block;height:100%;background:' + GREEN + ';}' +
    '.w285pct{font-size:12px;color:' + SOFT + ';margin-top:4px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}' +
    '.w285tag{display:inline-block;font:700 10.5px/1.5 ' + BODY + ';letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:0 7px;margin-left:6px;vertical-align:1px;background:#6F64AB;color:' + CREAM + ';}' +
    '.w285done{color:' + SOFT + ';font-size:14px;margin:14px 0 0;}.w285link{background:none;border:0;padding:0;color:' + GREEN + ';font:inherit;font-weight:600;text-decoration:underline;cursor:pointer;}' +
    '.w285fin{margin:8px 0 0;}' +
    '@media (max-width:760px){' +
      '.w285row{grid-template-columns:minmax(0,1fr) auto;row-gap:3px;padding:12px 14px;}' +
      '.w285row .w285who{grid-column:1;grid-row:1;}.w285row .w285turn{grid-column:1;grid-row:2;}.w285row .w285prog{grid-column:1;grid-row:3;}.w285row .w285mgr{display:none;}.w285who .m2{display:inline;}' +
      '.w285row > .w285b{grid-column:2;grid-row:1 / span 3;align-self:center;}' +
      '.w285it{flex-wrap:wrap;padding:12px 14px;}.w285it > p{flex-basis:calc(100% - 20px);}.w285it .w285acts{width:100%;justify-content:flex-start;padding-left:20px;}' +
    '}' +
    /* the panel */
    '#w285pan{position:fixed;inset:0;z-index:9000;display:none;}#w285pan.open{display:block;}' +
    '#w285pan .bk{position:absolute;inset:0;background:rgba(31,32,30,.28);}' +
    '#w285pan .pn{position:absolute;top:0;right:0;bottom:0;width:min(560px,100%);background:' + CREAM + ';box-shadow:-12px 0 40px rgba(0,0,0,.14);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:22px 24px 64px;box-sizing:border-box;animation:w285in .3s cubic-bezier(.2,.8,.2,1);}' +
    '@keyframes w285in{from{transform:translateX(102%);}to{transform:none;}}' +
    '@media (prefers-reduced-motion:reduce){#w285pan .pn{animation:none;}}' +
    'body.w285open .modal-back,body.w285open #modalBack{z-index:9600!important;}' +
    '#w285pan .ph{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;min-width:0;}' +
    '#w285pan .ph > div{min-width:0;}' +
    '#w285pan h3{font:600 28px/1.05 ' + HEAD + ';text-transform:uppercase;color:' + GREEN + ';margin:0;overflow-wrap:anywhere;}' +
    '#w285pan .ph small{display:block;color:' + SOFT + ';font-size:13px;margin-top:4px;overflow-wrap:anywhere;}' +
    '#w285pan .x{border:0;background:none;font:400 26px/1 ' + BODY + ';cursor:pointer;color:' + GREEN + ';padding:2px 6px;flex:none;min-width:40px;min-height:40px;}' +
    '#w285pan .back{display:none;border:0;background:none;color:' + GREEN + ';font:600 14px ' + BODY + ';padding:4px 0;margin:0 0 8px;cursor:pointer;}' +
    '.w285tabs{display:flex;gap:18px;border-bottom:1px solid ' + LINE + ';margin:16px 0 14px;overflow-x:auto;scrollbar-width:none;}' +
    '.w285tabs button{border:0;background:none;padding:9px 0;font:500 14px ' + BODY + ';color:' + SOFT + ';cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;}' +
    '.w285tabs button.on{color:' + GREEN + ';border-bottom-color:' + GOLD + ';}' +
    '#w285pan .w285now{font-size:14.5px;margin:0 0 12px;overflow-wrap:anywhere;}#w285pan .w285now b{color:' + GREEN + ';}#w285pan .w285now.late b{color:' + FLAG + ';}' +
    '.w285tl{list-style:none;margin:0 0 14px;padding:0;}' +
    '.w285tl li{display:flex;gap:12px;padding:7px 0;font-size:14px;min-width:0;}' +
    '.w285tl li:before{content:"";width:10px;height:10px;border-radius:5px;border:2px solid ' + GREEN + ';margin-top:4px;flex:none;background:' + GREEN + ';box-sizing:border-box;}' +
    '.w285tl li.now:before{background:' + GOLD + ';border-color:' + GOLD + ';}.w285tl li.next:before{background:transparent;}' +
    '.w285tl li > span{min-width:0;overflow-wrap:anywhere;}.w285tl li > em{font-style:normal;color:' + SOFT + ';font-size:13px;margin-left:auto;white-space:nowrap;padding-left:8px;}' +
    '.w285lbl{font:700 11px/1.2 ' + BODY + ';letter-spacing:.12em;text-transform:uppercase;color:' + SOFT + ';margin:16px 0 8px;}' +
    '.w285menu{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 6px;}' +
    '.w285menu .o271b{margin:0;}#w285pan a.o271b,#w285pan a.w285b,#w285 a.w285b{text-decoration:none!important;}' +
    '.w285line{font-size:14px;margin:0 0 10px;color:var(--wa-ink,' + INK + ');overflow-wrap:anywhere;}' +
    '.w285line.mut{color:' + SOFT + ';font-size:13px;}' +
    '.w285fold{border-top:1px solid ' + LINE + ';margin:10px 0 0;}' +
    '.w285fold > summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:10px;padding:11px 0;font-size:14px;min-width:0;}' +
    '.w285fold > summary::-webkit-details-marker{display:none;}' +
    '.w285fold > summary b{color:' + GREEN + ';}.w285fold > summary span{color:' + SOFT + ';white-space:nowrap;}' +
    '.w285fold > summary:after{content:"+";color:' + GREEN + ';font-weight:700;margin-left:6px;}.w285fold[open] > summary:after{content:"\\2212";}' +
    '.w285fold > summary > span:first-child{min-width:0;overflow-wrap:anywhere;white-space:normal;color:inherit;}' +
    '.w285fold .in{padding:0 0 12px;}' +
    '.w285step{display:flex;gap:10px;padding:6px 0;font-size:13.5px;min-width:0;align-items:flex-start;}' +
    '.w285step i{flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid rgba(16,63,57,.4);margin-top:1px;box-sizing:border-box;font-style:normal;font-size:10px;line-height:13px;text-align:center;color:' + CREAM + ';}' +
    '.w285step.ok i{background:' + GREEN + ';border-color:' + GREEN + ';}' +
    '.w285step.ok > span{color:' + SOFT + ';}' +
    '.w285step.kid{padding-left:24px;}.w285step > span{min-width:0;overflow-wrap:anywhere;}' +
    '.w285step em{font-style:normal;font-size:11px;color:' + SOFT + ';margin-left:6px;}.w285step em.late{color:' + FLAG + ';font-weight:700;}' +
    '.w285grp{font-size:12.5px;font-weight:700;color:' + GREEN + ';margin:8px 0 2px;overflow-wrap:anywhere;}' +
    '#w285pan .o271st{margin:0;}#w285pan .o271st li{min-width:0;}' +
    '#w285pan input,#w285pan select,#w285pan textarea{max-width:100%;box-sizing:border-box;}' +
    '#w285pan .o271gw{max-width:100%;overflow-x:auto;}' +
    '@media (max-width:700px){#w285pan .pn{width:100%;padding:14px 16px 64px;box-shadow:none;}#w285pan .back{display:inline-block;}#w285pan h3{font-size:24px;}}' +
    /* Home: one card per hire */
    '#mypage.w272 #mpBody > #w285home{order:5;grid-column:1 / -1;}' +
    '#mpBody.w285on > #w166lead,#mpBody.w285on > #o275mine{display:none!important;}' +
    '#w285home h3{margin:0 0 4px;font:500 22px/1.05 ' + HEAD + ';letter-spacing:.01em;text-transform:uppercase;color:' + GREEN + ';}' +
    '#w285home > p{margin:0 0 10px;font-size:13.5px;color:' + SOFT + ';}' +
    '.w285hc{min-width:0;}.w285hc + .w285hc{border-top:1px solid ' + LINE + ';margin-top:12px;padding-top:12px;}' +
    '.w285hc .top{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;min-width:0;}' +
    '.w285hc .top > div{min-width:0;}.w285hc .top b{display:block;color:' + GREEN + ';font-size:15px;overflow-wrap:anywhere;}.w285hc .top small{display:block;color:' + SOFT + ';font-size:13px;overflow-wrap:anywhere;}' +
    '.w285hc .w285turn{margin:6px 0 6px;}' +
    '.w285hc .wk{margin:8px 0 0;font-size:13.5px;}.w285hc .wk .w285lbl{margin:8px 0 4px;}' +
    '.w285hc label{display:flex;gap:8px;align-items:flex-start;padding:4px 0;min-width:0;cursor:pointer;}.w285hc label input{margin-top:3px;flex:none;}.w285hc label span{min-width:0;overflow-wrap:anywhere;}' +
    '.w285hc label em{font-style:normal;color:' + SOFT + ';font-size:12px;margin-left:6px;}.w285hc label em.late{color:' + FLAG + ';font-weight:700;}' +
    /* the profile bar */
    '.w285pbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:2px 0 10px;max-width:620px;font-size:13px;}' +
    '.w285pbar .w285bar{flex:1 1 120px;min-width:100px;max-width:260px;}';
  document.head.appendChild(css);

  window.w285 = {
    /* the rule and the facts */
    planOf: planOf, planFromLead: planFromLead, plan: plan, secCount: secCount, stepDone: stepDone, stepWhy: stepWhy, firstOpen: firstOpen, completeKnown: completeKnown, derivedRows: derivedRows, setupCovered: setupCovered, ticks: ticks, setupCount: setupCount,
    collect: collect, lookup: lookup, derive: derive, avenues: avenues, doneSet: doneSet, loadPositions: loadPositions, leadPerson: leadPerson,
    /* the helpers the other parts share */
    h: { E: E, lower: lower, plain: plain, first: first, plural: plural, today: today, dayOf: dayOf, addDays: addDays, diffDays: diffDays, fmtDay: fmtDay, secName: secName, secRank: secRank,
      toast: toastS, O: O, R: R, S: S271, W37: W37, memberById: memberById, meMember: meMember, isHr: isHr, isAdmin: isAdmin, flowId: flowId, stepRow: stepRow, stuck: stuck,
      onbById: onbById, flowForOnb: flowForOnb, academy: academy },
    RUNDOWN: RUNDOWN, AUTO: AUTO, SEC: SEC,
    paintAll: function () { /* b_page.js, c_panel.js and d_home.js fill this in */ }
  };
})();
