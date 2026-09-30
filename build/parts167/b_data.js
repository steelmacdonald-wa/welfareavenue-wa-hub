
  /* ---------- what the journey reads: its settings, the people around the person, and a moment from our story ---------- */
  function loadCfg() {
    if (S.cfgAt && Date.now() - S.cfgAt < 600000) return Promise.resolve(S.cfg);
    S.cfgAt = Date.now();
    return Promise.resolve(db.from('app_config').select('value').eq('key', 'onboarding_journey')).then(function (r) {
      var v = r && r.data && r.data[0] && r.data[0].value;
      if (v) { try { S.cfg = typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { /* the fallback stays */ } }
      return S.cfg;
    }).catch(function () { return S.cfg; });
  }
  function loadPeople() {
    if (S.pplAt && Date.now() - S.pplAt < 300000) return Promise.resolve(S.ppl);
    S.pplAt = Date.now();
    return Promise.all([
      db.from('team_members').select('id,name,email,department,role,avatar_url').eq('active', true),
      db.from('org_positions').select('id,member_id,title,department,reports_to')
    ]).then(function (r) {
      S.ppl = { members: (r[0] && r[0].data) || [], seats: (r[1] && r[1].data) || [] };
      return S.ppl;
    }).catch(function () { return S.ppl; });
  }
  function loadStory() {
    if (S.story) return Promise.resolve(S.story);
    return Promise.resolve(db.from('wa_history').select('id,date_start,title,summary,highlight,visibility,status').eq('highlight', true)).then(function (r) {
      var rows = ((r && r.data) || []).filter(function (x) { return x && x.title && x.summary && x.status !== 'hidden' && (!x.visibility || x.visibility === 'everyone'); });
      rows.sort(function (a, b) { return String(a.date_start).localeCompare(String(b.date_start)); });
      S.story = rows; S.storyI = rows.length ? Math.floor(Math.random() * rows.length) : 0;
      return rows;
    }).catch(function () { S.story = []; return S.story; });
  }

  /* the person's own plan: the one the Academy's sheet shows */
  function myName() {
    try { var m = (typeof wa28Me === 'function') ? wa28Me() : null; if (m && m.name) return m.name; } catch (e) { /* fine */ }
    try { var full = String((USER && USER.name) || ''), em = String((USER && USER.email) || ''); return full ? full.split(' ')[0] : em.split('@')[0]; } catch (e) { return ''; }
  }
  function planOnb() {
    try {
      if (window.__w169view) return window.__w169view;   /* wave169: HR previews someone's journey, or a new person's */
      if (typeof WA37 === 'undefined' || !WA37.onbs) return null;
      var n = myName().toLowerCase();
      return WA37.onbs.filter(function (o) { return o.status !== 'cancelled' && String(o.person_name || '').toLowerCase() === n; })[0] || null;
    } catch (e) { return null; }
  }
  function seatOf(P, memberId) { return (P.seats || []).filter(function (s) { return String(s.member_id) === String(memberId); }).sort(function (a, b) { return a.id - b.id; })[0] || null; }
  function memberOf(P, id) { return (P.members || []).filter(function (m) { return String(m.id) === String(id); })[0] || null; }
  /* the people around them: their lead (the org chart), their team, our co-executive directors */
  function peopleFor(o) {
    var P = S.ppl; if (!P || !o) return null;
    var me = memberOf(P, o.member_id) || (P.members || []).filter(function (m) { return String(m.name).toLowerCase() === String(o.person_name || '').toLowerCase(); })[0] || null;
    var seat = me ? seatOf(P, me.id) : null, lead = null, leadSeat = null;
    if (seat && seat.reports_to) { leadSeat = (P.seats || []).filter(function (s) { return String(s.id) === String(seat.reports_to); })[0] || null; if (leadSeat && leadSeat.member_id) lead = memberOf(P, leadSeat.member_id); }
    var dept = (me && me.department) || null;
    var team = (P.members || []).filter(function (m) { return dept && m.department === dept && (!me || m.id !== me.id) && (!lead || m.id !== lead.id); })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var eds = (P.seats || []).filter(function (s) { return /co-?ed\b|co-executive/i.test(String(s.title || '')) && s.member_id; }).map(function (s) { var m = memberOf(P, s.member_id); return m ? { m: m, title: s.title } : null; }).filter(Boolean)
      .filter(function (x) { return (!me || x.m.id !== me.id) && (!lead || x.m.id !== lead.id); });
    return { me: me, title: seat ? seat.title : null, dept: dept, lead: lead, leadTitle: leadSeat ? leadSeat.title : null, team: team, eds: eds };
  }

  /* the journey from the plan (wave166's planStates: each week's steps, with what the Academy already finished) */
  function journeyOf(o) {
    var W = window.w166; if (!W || typeof W.planStates !== 'function' || !o) return null;
    var weeks = W.planStates(o) || [], C = cfg(), total = 0, done = 0, next = null, nextWk = null;
    var byName = {};
    weeks.forEach(function (wk) {
      var d = 0, due = null;
      wk.steps.forEach(function (x) {
        total++; if (x.done) { done++; d++; }
        else { if (!next) { next = x; nextWk = wk.name; } if (x.s && x.s.due_date && (!due || String(x.s.due_date) < due)) due = String(x.s.due_date); }
      });
      var anyDue = null; wk.steps.forEach(function (x) { if (x.s && x.s.due_date && (!anyDue || String(x.s.due_date) > anyDue)) anyDue = String(x.s.due_date); });
      var meta = C.weeks[wk.name] || {};
      var lesson = meta.lesson ? wk.steps.filter(function (x) { return String(x.t.id) === String(meta.lesson); })[0] || null : null;
      byName[wk.name] = { name: wk.name, steps: wk.steps, done: d, total: wk.steps.length, complete: d >= wk.steps.length, due: due || anyDue, meta: meta, lesson: lesson };
    });
    var list = Object.keys(byName).sort(function (a, b) { return (daysOf(a) - daysOf(b)) || a.localeCompare(b); }).map(function (k) { return byName[k]; });   /* wave169: in time order, weeks HR adds included */
    return { o: o, weeks: list, byName: byName, total: total, done: done, pct: total ? Math.round(100 * done / total) : 0, next: next, nextWk: nextWk, day: dayN(o.started_at), complete: total > 0 && done >= total };
  }
