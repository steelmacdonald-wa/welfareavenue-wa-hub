
  /* ---------- data (row security decides what each person reads; HR, leaders and admins see the HR tables) ---------- */
  async function q(p) { try { var r = await p; return (r && !r.error && r.data) || []; } catch (e) { return []; } }
  async function loadCands(force) {
    if (S.cLoading) return S.cLoading;
    if (!force && S.candsAt && Date.now() - S.candsAt < 60000) return S.cands;
    S.cLoading = (async function () {
      S.cands = await q(db.from('hub_candidates').select('*').order('created_at', { ascending: false }).limit(300));
      S.candsAt = Date.now(); S.cLoading = null; return S.cands;
    })();
    return S.cLoading;
  }
  /* The Loop's sessions (hub_checkins: the person, admins and HR read them, wave192c) */
  async function loadHours(force) {
    if (!force && S.ckAt && Date.now() - S.ckAt < 60000) return;
    var since = new Date(Date.now() - 7 * 86400000 * (S.hoursWeeks + 1)).toISOString();
    var res = await Promise.all([
      q(db.from('hub_checkins').select('email,name,department,started_at,ended_at,minutes,auto_closed').gte('started_at', since).order('started_at', { ascending: false }).limit(3000)),
      q(db.from('hub_settings').select('value').eq('key', 'hours_minimums').limit(1)),
      (async function () { try { var r = await db.rpc('loop_feed', { p_days: 30, p_email: null }); return (r && !r.error && r.data) || []; } catch (e) { return []; } })(),
      q(db.from('slack_hours').select('member_name,week_start,hours,sessions').gte('week_start', since.slice(0, 10)).limit(2000))   /* wave215: Slack check-ins count too (Steel, 07/10/26) */
    ]);
    S.sh = res[3] || [];
    S.ck = res[0]; var mv = res[1][0] && res[1][0].value; if (mv && typeof mv === 'object') S.mins = { member: Number(mv.member) || 3, manager: Number(mv.manager) || 5 };
    S.feed = res[2]; S.ckAt = Date.now();
  }
  /* what Overview counts: one round of small reads */
  async function loadOverview(force) {
    if (S.dLoading) return S.dLoading;
    if (!force && S.data && Date.now() - S.data.at < 60000) return S.data;
    S.dLoading = (async function () {
      var res = await Promise.all([
        loadCands(force),
        q(db.from('wa_timeoff').select('id,name,email,category,start_date,end_date,days,status,created_at').eq('status', 'requested').order('created_at', { ascending: true }).limit(50)),   /* wave212: the requests are 'requested' (was 'pending', so the count was always 0) */
        q(db.from('wa_policies').select('key,title,required,active').eq('active', true)),
        q(db.from('wa_policy_signoffs').select('email,policy_key')),
        q(db.from('onboardings').select('id,member_id,person_name,status,started_at,completed_at').limit(200)),
        q(db.from('training_progress').select('id,person_name,email,status,due_date,assignment_id').neq('status', 'done').limit(3000)),
        loadHours(force)
      ]);
      var d = { at: Date.now(), timeoff: res[1], pol: res[2], sig: res[3], onb: res[4], tp: res[5] };
      S.data = d; S.dLoading = null; return d;
    })();
    return S.dLoading;
  }
  /* sums per person from The Loop: this week (from Monday), last week, the average of the last N full weeks; an open session counts at most eight hours */
  function monday(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
  function sessionMin(c) {
    if (c.minutes != null && c.ended_at) return Number(c.minutes) || 0;
    var start = new Date(c.started_at).getTime(), end = c.ended_at ? new Date(c.ended_at).getTime() : Date.now();
    return Math.max(0, Math.min(480, Math.round((end - start) / 60000)));
  }
  /* full weeks to average over: at most S.hoursWeeks, and only weeks The Loop has run in full (it began 25/09/26) */
  function avgWeeks() {
    var m0 = monday(Date.now()).getTime(), wk = 7 * 86400000, first = null;
    S.ck.forEach(function (c) { if (!first || c.started_at < first) first = c.started_at; });
    if (!first) return 0;
    var fm = monday(first).getTime(); if (new Date(first).getTime() > fm) fm += wk;   /* a week begun part way is not a full week */
    return Math.max(0, Math.min(S.hoursWeeks, Math.floor((m0 - fm) / wk)));
  }
  function hoursBy() {
    var m0 = monday(Date.now()).getTime(), wk = 7 * 86400000, out = {}, aw = avgWeeks(); S.avgW = aw;
    S.ck.forEach(function (c) {
      var em = lower(c.email); if (!em) return;
      var o = out[em] || (out[em] = { email: em, name: c.name, dept: c.department, week: 0, last: 0, past: 0, sessions: 0, open: false, lastAt: null });
      var t = new Date(c.started_at).getTime(), mn = sessionMin(c);
      if (t >= m0) o.week += mn; else if (t >= m0 - wk) o.last += mn;
      if (t < m0 && t >= m0 - wk * aw) o.past += mn;
      o.sessions++; if (!c.ended_at) o.open = true; if (!o.lastAt || c.started_at > o.lastAt) o.lastAt = c.started_at;
    });
    /* wave215 (Steel, 07/10/26: "Slack activity can count toward hours"): the weekly hours hours-pull reads from people's own
       "in" and "out" messages in the Slack check-in channels (slack_hours; the Hub's own Loop posts are never counted there),
       added to the person's Loop time for the same week. o.slackWeek / o.slackPast say how much of it came from Slack. */
    (S.sh || []).forEach(function (r) {
      var mm = members().filter(function (m) { return lower(m.name) === lower(r.member_name) || lower(String(m.name).split(' ')[0]) === lower(String(r.member_name).split(' ')[0]); })[0];
      if (!mm || !mm.email) return;
      var em = lower(mm.email), mins = Math.round(Number(r.hours || 0) * 60); if (!mins) return;
      var o = out[em] || (out[em] = { email: em, name: mm.name, dept: mm.department, week: 0, last: 0, past: 0, sessions: 0, open: false, lastAt: null });
      var t = new Date(String(r.week_start) + 'T12:00:00').getTime();
      if (t >= m0) { o.week += mins; o.slackWeek = (o.slackWeek || 0) + mins; } else if (t >= m0 - wk) { o.last += mins; o.slackLast = (o.slackLast || 0) + mins; }
      if (t < m0 && t >= m0 - wk * aw) { o.past += mins; o.slackPast = (o.slackPast || 0) + mins; }
      o.sessions += Number(r.sessions || 0);
    });
    return out;
  }
  /* managers and up get the higher minimum (the same rule as wave54: lead, leader, director, manager, chair or co- in the role; the operational executives 8h); the board is exempt */
  function isManager(m) { return /\b(lead|leader|director|manager|chair|co-)/i.test(String(m.role || '')); }
  function minFor(m) { if (!m || m.department === 'board') return 0; if (/steel\.macdonald|suhaib\.abdillahi/.test(lower(m.email))) return 8; return isManager(m) ? S.mins.manager : S.mins.member; }
