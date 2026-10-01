
  /* ---------- who may see it, and the data ---------- */
  function canSee() {
    if (A.can !== null) return Promise.resolve(A.can);
    if (A.canP) return A.canP;
    A.canP = (async function () {
      try { var r = await db.rpc('wa181_can_see'); A.can = !!(r && !r.error && r.data === true); }
      catch (e) { A.can = false; }
      A.canP = null; return A.can;
    })();
    return A.canP;
  }
  async function pageAll(q) {   /* PostgREST answers 1,000 rows a call */
    var out = [], from = 0;
    for (var i = 0; i < 20; i++) {
      var r = await q().range(from, from + 999);
      if (r.error) throw r.error;
      out = out.concat(r.data || []); if (!r.data || r.data.length < 1000) break; from += 1000;
    }
    return out;
  }
  function load(force) {
    if (A.loading) return A.loading;
    if (A.loaded && !force) return Promise.resolve();
    A.loading = (async function () {
      try {
        var res = await Promise.all([
          pageAll(function () { return db.from('hr_people_tenure_v').select('*').order('person_key'); }),
          pageAll(function () { return db.from('hr_slack_accounts').select('slack_id,full_name,display_name,email,title,account_type,created_on,claimed_on,deactivated_on,days_active,messages,team_member_id,person_key,kind,link_by,period_from,period_to').order('slack_id'); }),
          pageAll(function () { return db.from('team_members').select('id,name,department,active,email').order('name'); })
        ]);
        A.rows = res[0]; A.accts = res[1]; A.roster = res[2]; A.err = ''; A.loaded = true;
      } catch (e) { A.err = (e && e.message) || String(e); }
      A.loading = null;
    })();
    return A.loading;
  }

  /* ---------- the numbers ---------- */
  function today() { return todayIso(); }
  function period() {   /* the export's window */
    var f = null, t = null;
    A.accts.forEach(function (a) { if (a.period_from && (!f || a.period_from > f)) f = a.period_from; if (a.period_to && (!t || a.period_to > t)) t = a.period_to; });
    return { from: f, to: t };
  }
  function people() { return A.rows.filter(function (p) { return p.status !== 'never_joined'; }); }
  function endOf(p) {   /* the day counted as their last: today while on the team, else the latest day they can have left */
    if (p.status === 'current') return today();
    if (p.left_by) return p.left_by;
    if (p.accounts > 0 && p.open_accounts > 0 && p.period_to) return p.period_to;   /* still on Slack and used it in the window */
    return null;
  }
  function tenureOf(p) { var e = endOf(p); return p.started_on && e ? months(p.started_on, e) : null; }
  function curFy() { return fyOf(today()); }
  function stats() {
    var all = people(), cur = all.filter(function (p) { return p.status === 'current'; });
    var t = today(), y1 = (Number(t.slice(0, 4)) - 1) + t.slice(4);   /* the last 12 months */
    var joined = all.filter(function (p) { return p.started_on && p.started_on > y1 && p.started_on <= t; });
    var left = all.filter(function (p) { return p.status !== 'current' && p.left_by && p.left_by > y1 && !(p.days_active === 0 && p.left_by === p.period_from); });
    var gone = all.filter(function (p) { return p.status !== 'current' && tenureOf(p) != null; });
    var first = null; all.forEach(function (p) { if (p.started_on && (!first || p.started_on < first)) first = p.started_on; });
    return {
      all: all, cur: cur, since: y1, joined: joined, left: left,
      curMed: median(cur.map(tenureOf).filter(function (x) { return x != null; })),
      goneMed: median(gone.map(tenureOf)),
      first: first,
      noStart: cur.filter(function (p) { return !p.started_on; }).length
    };
  }
  function monthsRange(a, b) { var out = [], y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7)); var ey = Number(b.slice(0, 4)), em = Number(b.slice(5, 7)); while (y < ey || (y === ey && m <= em)) { out.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } } return out; }
  function series() {   /* people on the team at the end of each month, and the month's joiners */
    var all = people().filter(function (p) { return p.started_on; }); var t = today();
    var first = all.reduce(function (a, p) { return !a || p.started_on < a ? p.started_on : a; }, null); if (!first) return [];
    return monthsRange(ym(first), ym(t)).map(function (k) {
      var y = Number(k.slice(0, 4)), m = Number(k.slice(5, 7)); var last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); if (last > t) last = t;
      var on = 0, joined = [], unsure = 0;
      all.forEach(function (p) {
        if (ym(p.started_on) === k) joined.push(p.name);
        var e = endOf(p);
        if (p.started_on <= last && (e === null ? p.status === 'current' : e >= last)) { on++; if (p.status !== 'current' && p.days_active === 0) unsure++; }
      });
      return { k: k, on: on, joined: joined, unsure: unsure };
    });
  }
  function byFy() {
    var all = people(); var t = today(); var fys = {};
    all.forEach(function (p) { if (p.started_on) fys[fyOf(p.started_on)] = 1; });
    return Object.keys(fys).map(Number).sort().map(function (y) {
      var s = y + '-10-01', e = (y + 1) + '-09-30', end = e > t ? t : e;
      var j = all.filter(function (p) { return p.started_on && p.started_on >= s && p.started_on <= e; });
      var l = all.filter(function (p) { return p.status !== 'current' && p.left_by && p.left_by >= s && p.left_by <= e; });
      var on = all.filter(function (p) { var x = endOf(p); return p.started_on && p.started_on <= end && (x === null ? p.status === 'current' : x >= end); });
      return { y: y, joined: j.length, still: j.filter(function (p) { return p.status === 'current'; }).length, left: l.length, on: on.length, running: e > t };
    });
  }
  var BUCKETS = [['Under 3 months', 0, 3], ['3 to 6 months', 3, 6], ['6 to 12 months', 6, 12], ['1 to 2 years', 12, 24], ['2 years or more', 24, 1e9]];
  function buckets(list) { return BUCKETS.map(function (b) { return [b[0], list.filter(function (m) { return m >= b[1] && m < b[2]; }).length]; }); }
  function byTeam() {
    var cur = people().filter(function (p) { return p.status === 'current'; }); var g = {};
    cur.forEach(function (p) { var k = p.department || '_none'; (g[k] = g[k] || []).push(p); });
    var order = ((window.WA_TEAMS && WA_TEAMS.order) || []).concat(['exec', 'finance', '_none']);
    return Object.keys(g).sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); }).map(function (k) {
      return { k: k, label: k === '_none' ? 'Not on the roster' : teamName(k), n: g[k].length, med: median(g[k].map(tenureOf).filter(function (x) { return x != null; })) };
    });
  }
  function acctsOf(p) { var ids = p.slack_ids || []; return A.accts.filter(function (a) { return ids.indexOf(a.slack_id) >= 0 || (p.team_member_id && a.team_member_id === p.team_member_id); }); }
  function flags(p) {
    var f = [], acc = acctsOf(p);
    if (!p.on_roster && p.status === 'current') f.push(['Not on the roster', 'warn']);
    if (p.on_roster && !p.roster_active && p.open_accounts > 0) f.push(['Left on the roster, Slack still open', 'warn']);
    if (p.on_roster && p.roster_active && p.accounts > 0 && p.open_accounts === 0) f.push(['Slack switched off', 'bad']);
    if (p.status === 'quiet') f.push(['Slack open, not used in a year', 'warn']);
    if (p.accounts > 1) f.push([p.accounts + ' Slack accounts', '']);
    if (acc.some(function (a) { return a.link_by === 'name'; })) f.push(['Linked by first name', 'warn']);
    if (p.status === 'current' && !p.started_on) f.push(['No start date', 'bad']);
    return f;
  }
  function look() {
    var all = A.rows;
    var unusedDup = A.accts.filter(function (a) {
      if (a.kind !== 'team' || !a.claimed_on || a.deactivated_on || a.days_active > 0) return false;
      return A.accts.some(function (b) { return b.slack_id !== a.slack_id && b.person_key === a.person_key && b.days_active > 0; });
    });
    return [
      { k: 'offroster', h: 'On Slack this year, not on the roster', p: 'They used Slack in the last year but have no roster row, so the Hub leaves them out of the team. Add them to the roster, or switch their Slack off if they have gone.', list: all.filter(function (p) { return !p.on_roster && p.status === 'current'; }) },
      { k: 'leftopen', h: 'Left on the roster, Slack still open', p: 'The roster says they left; their Slack account is still on. Switch it off, or put them back on the roster.', list: all.filter(function (p) { return p.on_roster && !p.roster_active && p.open_accounts > 0; }) },
      { k: 'off', h: 'On the roster, Slack switched off', p: 'Still on the team in the Hub, but their Slack account was deactivated. Have they left?', list: all.filter(function (p) { return p.on_roster && p.roster_active && p.accounts > 0 && p.open_accounts === 0; }) },
      { k: 'quiet', h: 'Slack open, not used once in a year', p: 'Accounts still on that nobody used in the export’s window. Usually safe to switch off.', list: all.filter(function (p) { return p.status === 'quiet'; }), extra: unusedDup.map(function (a) { var o = all.filter(function (p) { return (p.slack_ids || []).indexOf(a.slack_id) >= 0 || (p.team_member_id && p.team_member_id === a.team_member_id); })[0]; return { a: a, p: o }; }) },
      { k: 'name', h: 'Linked by first name: please confirm', p: 'These Slack accounts were matched to the roster by first name only. Open one to confirm or change it.', list: all.filter(function (p) { return acctsOf(p).some(function (a) { return a.link_by === 'name'; }); }) },
      { k: 'nostart', h: 'On the team, no start date', p: 'No Workspace or Slack date to go on. Set it on the People view (click Started).', list: all.filter(function (p) { return p.status === 'current' && !p.started_on; }) }
    ];
  }
