
  /* ---------- state ---------- */
  var B = { data: null, loaded: 0, loading: null, me: null, meLoading: null, sheet: null, err: null, openDone: {} };
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function wRole() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function myEmail() { try { return lower((typeof USER !== 'undefined' && USER && USER.email) || ''); } catch (e) { return ''; } }
  function myName() { var n = ''; try { n = typeof who === 'function' ? String(who() || '') : ''; } catch (e) { n = ''; } return n || myEmail().split('@')[0]; }
  function isLeaderUI() { var r = wRole(); return r === 'admin' || r === 'leader'; }
  function isAdminUI() { return wRole() === 'admin'; }

  /* who am I on the board (board_me: director id, board person, leader, admin) */
  function fallbackMe() { return { member_id: null, board: boardMode(), leader: isLeaderUI(), admin: isAdminUI(), fallback: true }; }
  function loadMe(force) {
    if (B.me && !force) return Promise.resolve(B.me);
    if (B.meLoading) return B.meLoading;
    B.meLoading = Promise.resolve(db.rpc('board_me')).then(function (r) {
      var d = r && !r.error ? r.data : null;
      B.me = d && typeof d === 'object' ? d : fallbackMe(); B.meLoading = null; return B.me;
    }, function () { B.me = fallbackMe(); B.meLoading = null; return B.me; });
    return B.meLoading;
  }
  function canSee() { var m = B.me || fallbackMe(); return !!(m.board || m.leader || m.admin); }
  function meId() { var d = B.data; return d && d.me && d.me.member_id != null ? d.me.member_id : (B.me && B.me.member_id != null ? B.me.member_id : null); }
  function amLeader() { var d = B.data; return !!((d && d.me && (d.me.leader || d.me.admin)) || (B.me && (B.me.leader || B.me.admin)) || isLeaderUI()); }
  function amAdmin() { var d = B.data; return !!((d && d.me && d.me.admin) || (B.me && B.me.admin) || isAdminUI()); }
  function canEditItems() { return amLeader() || meId() != null; }
  function canLog() { return amAdmin() || meId() != null; }
  /* each director's progress is for the board itself and the admins, not for every leader */
  function seeDirectors() { return amAdmin() || meId() != null || !!(B.me && B.me.board) || boardMode(); }
  function canEditCommittee(c) { return amLeader() || (meId() != null && c && String(c.chair_id) === String(meId())); }

  /* ---------- loading: board_home(), or the tables when the function is not there (the offline harness) ---------- */
  function load(force) {
    if (B.loading) return B.loading;
    if (B.loaded && !force && Date.now() - B.loaded < 60000) return Promise.resolve(B.data);
    B.loading = (async function () {
      try {
        var r = null; try { r = await db.rpc('board_home'); } catch (e) { r = null; }
        var d = r && !r.error ? r.data : null;
        if (!d || typeof d !== 'object' || !Array.isArray(d.members)) d = await fallbackHome();
        B.data = normalize(d); B.loaded = Date.now(); B.err = null;
      } catch (e) { B.err = String((e && e.message) || e); if (!B.data) B.data = normalize({}); }
      finally { B.loading = null; }
      return B.data;
    })();
    return B.loading;
  }
  function fyStartOf(d) { return d.getMonth() >= 9 ? mk(d.getFullYear(), 9, 1, 12) : mk(d.getFullYear() - 1, 9, 1, 12); }
  async function fallbackHome() {
    var q = function (p) { return Promise.resolve(p).then(function (r) { return (r && !r.error && r.data) || []; }, function () { return []; }); };
    var res = await Promise.all([
      q(db.from('board_members').select('*').order('sort')), q(db.from('board_committees').select('*').order('sort')), q(db.from('board_meetings').select('*')),
      q(db.from('board_items').select('*').order('sort')), q(db.from('board_touchpoints').select('*').order('happened_on', { ascending: false }).limit(400)),
      q(db.from('dept_tasks').select('id, title, owner, status, done, due_date, closed_at, opened_at, confidential').eq('department', 'board')),
      q(db.from('goals').select('id, title, status, progress, quarter, sort').eq('department', 'org')),
      q(db.from('fund_events').select('id, title, start_date, end_date, timing, status, raised')),
      q(db.from('hub_settings').select('key, value').eq('key', 'fund_goals')),
      q(db.from('finance_transactions').select('txn_date, amount, duplicate_of')),
      q(db.from('finance_statements').select('period_end'))
    ]);
    var em = myEmail(), mine = res[0].filter(function (m) { return (m.status === 'active' || m.status === 'adviser') && (m.emails || []).map(lower).indexOf(em) >= 0; })[0];
    var fs = fyStartOf(today()), fe = mk(fs.getFullYear() + 1, 9, 1, 12), ps = mk(fs.getFullYear() - 1, 9, 1, 12);
    var inc = 0, exp = 0, pinc = 0, pexp = 0, last = '';
    res[9].forEach(function (t) { if (t.duplicate_of) return; var d = parseDay(t.txn_date); if (!d) return; var a = Number(t.amount || 0); if (t.txn_date > last) last = t.txn_date; if (d >= fs && d < fe) { if (a > 0) inc += a; else exp -= a; } else if (d >= ps && d < fs) { if (a > 0) pinc += a; else pexp -= a; } });
    var lastSt = res[10].map(function (s) { return s.period_end || ''; }).sort().pop() || null;
    var t0 = today();
    var raised = res[7].filter(function (f) { var s = parseDay(f.start_date); return s && s >= fs && s < fe; }).reduce(function (a, f) { return a + Number(f.raised || 0); }, 0);
    var next = res[7].filter(function (f) { var e = parseDay(f.end_date) || parseDay(f.start_date); return (f.status === 'planned' || f.status === 'confirmed') && e && e >= t0; }).sort(function (a, b) { return String(a.start_date).localeCompare(String(b.start_date)); }).slice(0, 4);
    return {
      me: { member_id: mine ? mine.id : null, leader: isLeaderUI(), admin: isAdminUI(), email: em, fallback: true },
      members: res[0], committees: res[1], meetings: res[2], items: res[3], touchpoints: res[4],
      tasks: res[5].filter(function (t) { return !t.confidential; }), goals: res[6],
      finance: { fy_start: ymd(fs), income: Math.round(inc * 100) / 100, expenses: Math.round(exp * 100) / 100, prev_income: Math.round(pinc * 100) / 100, prev_expenses: Math.round(pexp * 100) / 100, last_txn: last || null, last_statement: lastSt },
      fund: { goals: (res[8][0] || {}).value || null, raised: raised, next: next }
    };
  }
  function normalize(d) {
    d = d || {};
    ['members', 'committees', 'meetings', 'items', 'touchpoints', 'tasks', 'goals'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    d.committees.sort(function (a, b) { return ORDER.indexOf(a.key) - ORDER.indexOf(b.key); });
    d.meetings.sort(function (a, b) { return String(a.meets_at || '9999').localeCompare(String(b.meets_at || '9999')); });
    d.touchpoints.sort(function (a, b) { return String(b.happened_on || '').localeCompare(String(a.happened_on || '')) || (b.id || 0) - (a.id || 0); });
    d.finance = d.finance || {}; d.fund = d.fund || {}; d.me = d.me || {};
    return d;
  }

  /* ---------- lookups ---------- */
  function D() { return B.data || normalize({}); }
  function members() { return D().members; }
  function directors() { return members().filter(function (m) { return m.status === 'active'; }); }
  function memberById(id) { return members().filter(function (m) { return String(m.id) === String(id); })[0] || null; }
  function memberName(id) { var m = memberById(id); return m ? m.name : ''; }
  function comms() { return D().committees; }
  function commByKey(k) { return comms().filter(function (c) { return c.key === k; })[0] || null; }
  function inCommittee(c, id) { return !!c && id != null && ((c.member_ids || []).map(String).indexOf(String(id)) >= 0 || String(c.chair_id) === String(id)); }
  function committeesOf(id) { return comms().filter(function (c) { return inCommittee(c, id); }); }
  function tps() { return D().touchpoints; }

  /* ---------- the cycle: from the last board meeting held to the next one ---------- */
  function boardMeetings() { return D().meetings.filter(function (m) { return m.kind === 'board' || m.kind === 'special' || m.kind === 'agm'; }); }
  function nextMeeting() { var now = Date.now(); return boardMeetings().filter(function (m) { return m.meets_at && new Date(m.meets_at).getTime() >= now - 3 * 3600000 && m.status !== 'cancelled' && m.status !== 'held'; })[0] || null; }
  function lastMeeting() { var now = Date.now(); var held = boardMeetings().filter(function (m) { return m.meets_at && (m.status === 'held' || new Date(m.meets_at).getTime() < now - 3 * 3600000) && m.status !== 'cancelled'; }); return held[held.length - 1] || null; }
  function strategySession() { return D().meetings.filter(function (m) { return m.kind === 'strategy' && m.status !== 'cancelled' && m.status !== 'held'; })[0] || null; }
  function cycleStart() { var l = lastMeeting(); return l ? dayOfIso(l.meets_at) : addDays(today(), -91); }
  function cycleEnd() { var n = nextMeeting(); return n ? dayOfIso(n.meets_at) : null; }
  function committeeDue() { var e = cycleEnd(); return e ? addDays(e, -7) : null; }
  function inCycle(t) { var s = cycleStart(), d = parseDay(t.happened_on); return !!d && (!s || d > s || (t.meeting_id != null && nextMeeting() && String(t.meeting_id) === String(nextMeeting().id))); }
  function cycleTps(c) { return tps().filter(function (t) { return t.committee === c.key && inCycle(t); }); }
  function isRec(t) { return t.kind === 'recommendation' || !!String(t.recommendation || '').trim(); }
  function steps(c) {
    var tp = cycleTps(c);
    var first = function (f) { return tp.filter(f).sort(function (a, b) { return String(a.happened_on).localeCompare(String(b.happened_on)); })[0] || null; };
    var i = first(function (t) { return t.kind === 'internal'; }), x = first(function (t) { return t.kind === 'external'; }), r = first(isRec);
    return [
      { k: 'chair', t: 'Chair', done: !!c.chair_id, note: c.chair_id ? memberName(c.chair_id) + (c.chair_confirmed ? '' : ' (proposed)') : 'No chair yet' },
      { k: 'internal', t: 'Internal touchpoint', done: !!i, note: i ? fmtDay(parseDay(i.happened_on)) + (i.with_whom ? ', with ' + i.with_whom : '') : 'Meet the team lead' },
      { k: 'external', t: 'External touchpoint', done: !!x, note: x ? fmtDay(parseDay(x.happened_on)) + (x.with_whom ? ', with ' + x.with_whom : '') : 'A session with an outside professional' },
      { k: 'board', t: 'Bring it to the board', done: !!r, note: r ? 'Ready for the board' : 'A recommendation for the meeting' }
    ];
  }
  function stepsDone(c) { return steps(c).filter(function (s) { return s.done; }).length; }
  function myCycleTps(id, c) { return tps().filter(function (t) { return String(t.member_id) === String(id) && inCycle(t) && (!c || t.committee === c.key); }); }
  function tasksOf(m) {
    if (!m) return [];
    var re; try { re = new RegExp('(^|[^a-z])' + String(m.name || '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'i'); } catch (e) { return []; }
    return D().tasks.filter(function (t) { return re.test(String(t.owner || '')); });
  }
  function renewalState(m) {
    var d = parseDay(m.renewal_due); if (!d) return null;
    var n = daysBetween(today(), d);
    if (n < 0) return { k: 'past', t: 'Renewal was due ' + (m.renewal || fmtDay(d, true)) };
    if (n <= 60) return { k: 'soon', t: 'Renewal due ' + (m.renewal || fmtDay(d, true)) };
    return { k: 'ok', t: 'Term to ' + (m.renewal || fmtDay(d, true)) };
  }
