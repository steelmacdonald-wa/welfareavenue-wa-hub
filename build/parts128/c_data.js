
  /* ---------- data: what the core already loaded, plus a few reads of our own ---------- */
  var X = { loaded: 0, loading: null, fund: [], goals: [], shout: [], wins: [], vol: [], fundGoals: null, donations: null, board: null };
  async function q(p) { try { var r = await p; return (r && !r.error && r.data) || []; } catch (e) { return []; } }
  function fyStart(d) { d = d || today(); return mk(d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1, 9, 1, 12); }
  function fyEnd(d) { var s = fyStart(d); return mk(s.getFullYear() + 1, 8, 30, 12); }
  async function load(force) {
    if (X.loading) return X.loading;
    if (X.loaded && !force && Date.now() - X.loaded < 60000) return;
    X.loading = (async function () {
      var t = today(), from = ymd(addDays(t, -45)), to = ymd(addDays(t, 60));
      var jobs = [
        q(db.from('fund_events').select('id,title,start_date,end_date,status,raised,target_min,target_max,lead,season,precision').order('start_date')),
        q(db.from('goals').select('id,department,title,status,quarter,due_date,updated_at,parent_goal_id')),
        q(db.from('hub_shoutouts').select('id,created_at,kind,person,member_id,team,text,active').eq('active', true).order('created_at', { ascending: false }).limit(20)),
        q(db.from('goal_wins').select('id,department,win,meeting_date,created_at').order('created_at', { ascending: false }).limit(20)),
        staffOk() ? q(db.from('volunteer_events').select('id,title,code,event_date,status,location,kind').gte('event_date', from).lte('event_date', to).order('event_date')) : Promise.resolve([]),
        staffOk() ? q(db.from('hub_settings').select('value').eq('key', 'fund_goals')) : Promise.resolve([])
      ];
      if (tabOk('finances')) jobs.push(q(db.from('finance_transactions').select('amount,category,txn_date,duplicate_of').eq('category', '4100 Donation').gte('txn_date', ymd(fyStart())).limit(2000)));
      var r = await Promise.all(jobs);
      X.fund = r[0]; X.goals = r[1]; X.shout = r[2]; X.wins = r[3]; X.vol = r[4];
      X.fundGoals = (r[5][0] && r[5][0].value) || X.fundGoals || null;
      X.donations = r[6] ? r[6].filter(function (x) { return !x.duplicate_of && Number(x.amount || 0) > 0 && x.category === '4100 Donation'; }).reduce(function (s, x) { return s + Number(x.amount || 0); }, 0) : null;
      /* the board: only for people who can see it (wave126 answers from board_home) */
      X.board = null;
      try {
        if (window.w126 && (tabOk('governance') || tabOk('committees'))) {
          await window.w126.me(); await window.w126.load();
          var st = window.w126.state();
          if (st && st.data) X.board = { data: st.data, cycle: window.w126.cycle ? window.w126.cycle() : null };
        }
      } catch (e) { X.board = null; }
      X.loaded = Date.now(); X.loading = null;
    })();
    return X.loading;
  }

  /* ---------- the facts ---------- */
  function decisions() {
    var all = []; try { all = (typeof DB_DECISIONS !== 'undefined' ? DB_DECISIONS : []) || []; } catch (e) { all = []; }
    var t = today();
    return all.filter(function (d) { return !d.done; }).map(function (d) {
      var o = dayOfIso(d.opened_at) || dayOfIso(d.updated_at) || t;
      return { d: d, ref: d.id, title: d.title, area: d.area, cat: d.reason_category, move: d.suggested_move, why: d.reason_note, rec: d.recommendation, owner: decider(d), age: Math.max(0, daysBetween(o, t)), conf: !!d.confidential };
    }).sort(function (a, b) { return b.age - a.age; });
  }
  function decider(d) {
    var o = String((d && d.owner) || '').trim();
    if (o === 'Both' || !o) { try { if (typeof window.w116ExecOf === 'function') o = String(window.w116ExecOf(d) || ''); } catch (e) { /* fine */ } if (!o || o === 'Both') o = 'Steel and Suhaib'; }
    return o.replace(/\s*&\s*/g, ' and ');
  }
  function doneGoal(g) { return /\b(closed|done|completed?|achieved|met)\b/i.test(String(g.status || '')) && !/\bincomplete\b/i.test(String(g.status || '')); }
  function onTrackGoal(g) { return doneGoal(g) || /on track/i.test(String(g.status || '')); }
  function sentence(s) { s = String(s || '').trim(); return /[.!?…]$/.test(s) ? s : s + '.'; }
  function tasks() { try { return (typeof DB_TASKS !== 'undefined' ? DB_TASKS : []) || []; } catch (e) { return []; } }
  function updates() { try { return (typeof DB_UPDATES !== 'undefined' ? DB_UPDATES : []) || []; } catch (e) { return []; } }
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []) || []; } catch (e) { return []; } }
  function changes() { try { return (typeof DB_CHANGES !== 'undefined' ? DB_CHANGES : []) || []; } catch (e) { return []; } }
  function openTask(t) { return !t.done; }
  function overdue(t) { var d = parseDay(t.due_date); return !t.done && d && d < today(); }
  function closedWithin(t, days) { if (!t.done) return false; var d = dayOfIso(t.closed_at); return !!d && daysBetween(d, today()) <= days; }
  function teamStats(dept) {
    var ts = tasks().filter(function (t) { return t.department === dept; });
    var ups = updates().filter(function (u) { return u.department === dept; }).map(function (u) { return dayOfIso(u.created_at); }).filter(Boolean).sort(function (a, b) { return b - a; });
    var gs = (X.goals || []).filter(function (g) { return g.department === dept; });
    var leads = members().filter(function (m) { return m.department === dept && /\b(lead|co-lead|director|co-director|head|manager)\b/i.test(m.role || ''); }).map(function (m) { return String(m.name || '').split(' ')[0]; });
    return { dept: dept, open: ts.filter(openTask).length, overdue: ts.filter(overdue).length, closed30: ts.filter(function (t) { return closedWithin(t, 30); }).length, last: ups[0] || null, goals: gs, leads: leads, people: members().filter(function (m) { return m.department === dept; }).length };
  }
  /* the fundraising year: the events' results inside the fiscal year that contains today */
  function fundYear() {
    var s = fyStart(), e = fyEnd(), t = today();
    var inYear = function (f) { var d = parseDay(f.start_date); return d && d >= s && d <= e; };
    var raised = (X.fund || []).filter(inYear).reduce(function (a, f) { return a + Number(f.raised || 0); }, 0);
    /* the plan year comes from the fundraising settings (staff); the board cannot read them, so it falls back to the seeded plan */
    var g = X.fundGoals || {}, planLabel = String(g.plan || '2026-27');
    var fyLabel = s.getFullYear() + '-' + String(s.getFullYear() + 1).slice(2);
    var target = Number(g.target || 20000);
    var planYear = !planLabel || planLabel === fyLabel;
    var missing = (X.fund || []).filter(function (f) { var d = parseDay(f.end_date) || parseDay(f.start_date); return d && d < t && f.precision !== 'season' && ['planned', 'confirmed', 'tentative', 'in progress', 'to confirm'].indexOf(String(f.status || '').toLowerCase()) >= 0 && (f.raised == null || f.raised === ''); });
    return { start: s, end: e, raised: raised, target: target, planYear: planYear, fyLabel: fyLabel, planLabel: planLabel, missing: missing, daysLeft: daysBetween(t, e) };
  }
  function orgGoals() { return (X.goals || []).filter(function (g) { return g.department === 'org'; }); }
  function atRiskGoal(g) { return /delayed|incomplete|at risk|off track|blocked|stuck/i.test(String(g.status || '')); }
  function boardMeetings() { var b = X.board && X.board.data; return b ? (b.meetings || []).filter(function (m) { return m.kind === 'board' && m.meets_at && m.status !== 'held' && m.status !== 'cancelled'; }).map(function (m) { return { m: m, d: dayOfIso(m.meets_at) }; }).filter(function (x) { return x.d && x.d >= today(); }).sort(function (a, b) { return a.d - b.d; }) : []; }
  function boardAtRisk() { var b = X.board && X.board.data; return b ? (b.items || []).filter(function (i) { return i.status === 'at_risk'; }) : []; }
