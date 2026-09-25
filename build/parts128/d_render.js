
  /* ---------- the brief ---------- */
  function briefText() {
    var ds = decisions(), fy = fundYear(), t = today(), s = [];
    var old = ds.filter(function (d) { return d.age > 60; });
    if (ds.length) s.push('<b>' + words(ds.length) + (ds.length === 1 ? ' decision is' : ' decisions are') + ' waiting on the executives</b>' + (old.length ? (old.length === ds.length ? (ds.length === 1 ? ', for ' + old[0].age + ' days.' : ', every one of them for more than 60 days.') : ', ' + words(old.length).toLowerCase() + ' of them for more than 60 days.') : '.'));
    else s.push('<b>No decisions are waiting on the executives.</b>');
    if (fy.daysLeft >= 0 && fy.daysLeft <= 14) s.push('The fiscal year closes on ' + DAYS[fy.end.getDay()] + ' (' + fmtDay(fy.end) + ')' + (fy.raised ? ', with <b>' + money(fy.raised) + '</b> raised by the events this year.' : '.'));
    else if (fy.planYear) s.push('The events have raised <b>' + money(fy.raised) + '</b> of the ' + money(fy.target) + ' target this fiscal year.');
    else if (fy.raised) s.push('The events have raised <b>' + money(fy.raised) + '</b> this fiscal year.');
    if (fy.missing.length) s.push(words(fy.missing.length) + ' past ' + (fy.missing.length === 1 ? 'event still needs its result' : 'events still need their results') + ' (' + listJoin(fy.missing.slice(0, 3).map(function (f) { return f.title; })) + ').');
    var quiet = TEAMS.filter(function (d) { var st = teamStats(d); return !st.last || daysBetween(st.last, t) > 21; });
    if (quiet.length >= 2) s.push(words(quiet.length) + ' teams have had no meeting update in three weeks.');
    var bm = boardMeetings()[0];
    if (bm) s.push('The ' + (bm.m.title || 'board meeting').replace(/^Q(\d) board meeting$/i, 'Q$1 board meeting') + ' is ' + DAYS[bm.d.getDay()] + ', ' + fmtDay(bm.d) + '.');
    return s.join(' ');
  }
  function nextItems() {
    var t = today(), out = [];
    var bm = boardMeetings()[0];
    if (bm) out.push({ k: 'Board', d: bm.d, t: bm.m.title || 'Board meeting', go: '#governance' });
    var fe = (X.fund || []).filter(function (f) { var d = parseDay(f.start_date); return d && d >= t && f.status !== 'idea' && f.status !== 'cancelled' && f.status !== 'done'; })[0];
    if (fe) out.push({ k: 'Fundraising', d: parseDay(fe.start_date), t: fe.title, go: '#fundevents', month: fe.precision === 'month' });
    var ve = (X.vol || []).filter(function (v) { var d = parseDay(v.event_date); return d && d >= t && v.status !== 'cancelled'; })[0];
    if (ve) out.push({ k: 'Serving', d: parseDay(ve.event_date), t: ve.title || ve.code || 'Serving', go: '#volunteering' });
    return out;
  }
  function briefHtml() {
    var t = today(), fy = fundYear();
    var kick = DAYS[t.getDay()] + ', ' + fmtDay(t) + (fy.daysLeft >= 0 && fy.daysLeft <= 30 ? ' · fiscal year ends in ' + plural(fy.daysLeft, 'day') : '');
    var nx = nextItems();
    return '<div class="w128brief"><div class="tx"><div class="kk">' + E(kick) + '</div><p>' + briefText() + '</p>'
      + (staffOk() ? '<a class="lk" data-w128go="#mypage">' + I('list') + 'Your own tasks and requests are on Home</a>' : '') + '</div>'
      + (nx.length ? '<div class="nx"><div class="kk">Next up</div>' + nx.map(function (x) { return '<a class="it" data-w128go="' + E(x.go) + '"><span class="dt"><b>' + (x.month ? E(MONTHS[x.d.getMonth()].slice(0, 3)) : E(String(x.d.getDate()))) + '</b><small>' + (x.month ? 'month' : E(MONTHS[x.d.getMonth()].slice(0, 3))) + '</small></span><span class="w"><small>' + E(x.k) + '</small>' + E(clip(x.t, 48)) + '</span>' + I('chev') + '</a>'; }).join('') + '</div>' : '')
      + '</div>';
  }

  /* ---------- the numbers: each one opens the page that explains it ---------- */
  function tilesHtml() {
    var ds = decisions(), fy = fundYear(), og = orgGoals(), t = today();
    var ts = tasks(), open = ts.filter(openTask).length, od = ts.filter(overdue).length, c30 = ts.filter(function (x) { return closedWithin(x, 30); }).length;
    var tiles = [];
    tiles.push({ acc: true, n: ds.length, l: ds.length === 1 ? 'decision waiting' : 'decisions waiting', s: ds.length ? 'oldest ' + ds[0].age + ' days' : 'nothing waiting', go: '#overview/decisions', ic: 'flag' });
    var pct = fy.planYear && fy.target ? Math.min(100, fy.raised / fy.target * 100) : null;
    tiles.push({ n: money(fy.raised), l: 'raised by the events', s: fy.planYear ? 'of the ' + money(fy.target) + ' target, fiscal ' + fy.fyLabel : 'fiscal ' + fy.fyLabel + (fy.planLabel ? '; the ' + money(fy.target) + ' target starts with ' + fy.planLabel : ''), bar: pct, go: '#fundevents', ic: 'target' });
    if (og.length) { var on = og.filter(onTrackGoal).length, rk = og.filter(atRiskGoal).length; tiles.push({ n: og.length, l: og.length === 1 ? 'organizational goal' : 'organizational goals', s: [on ? on + ' on track or done' : '', og.length - on - rk ? (og.length - on - rk) + ' in progress' : '', rk ? rk + ' at risk' : ''].filter(Boolean).join(', '), go: '#orggoals', ic: 'spark' }); }
    tiles.push({ n: open, l: 'open tasks', s: (od ? od + ' overdue' : 'none overdue') + (c30 ? ', ' + c30 + ' closed in 30 days' : ''), fold: 'overdue', ic: 'list', warn: od > 0 });
    if (staffOk()) { var next30 = (X.vol || []).filter(function (v) { var d = parseDay(v.event_date); return d && d >= t && daysBetween(t, d) <= 30 && v.status !== 'cancelled'; }); var nv = next30[0]; tiles.push({ n: next30.length, l: next30.length === 1 ? 'serving in the next 30 days' : 'servings in the next 30 days', s: nv ? 'next ' + fmtShort(parseDay(nv.event_date)) : 'none planned yet', go: '#volunteering', ic: 'heart' }); }
    if (X.donations != null) tiles.splice(2, 0, { n: money(X.donations), l: 'donations this fiscal year', s: 'from the ledger, since ' + fmtDay(fyStart()), go: '#finances', ic: 'money' });
    var ppl = members().length, joined = changes().filter(function (c) { return c.entity_type === 'member' && c.field === 'invited' && /sent|admin|leader|member/.test(String(c.new_value || '')) && dayOfIso(c.changed_at) && daysBetween(dayOfIso(c.changed_at), t) <= 30; }).length;
    if (ppl && tiles.length < 6) tiles.push({ n: ppl, l: 'people on the team', s: joined ? joined + ' joined the Hub in 30 days' : 'across ' + TEAMS.length + ' teams and the board', go: '#orgchart', ic: 'people' });
    return '<div class="w128kpis">' + tiles.map(function (x) {
      return '<a class="w128k' + (x.acc ? ' acc' : '') + (x.warn ? ' warn' : '') + '" role="button" tabindex="0" ' + (x.fold ? 'data-w128fold="' + x.fold + '"' : 'data-w128go="' + E(x.go) + '"') + '><span class="ic">' + I(x.ic) + '</span><b>' + E(x.n) + '</b><span class="l">' + E(x.l) + '</span><span class="s">' + E(x.s) + '</span>' + (x.bar != null ? '<span class="bar"><i style="width:' + x.bar.toFixed(1) + '%"></i></span>' : '') + '</a>';
    }).join('') + '</div>';
  }

  /* ---------- needs a decision ---------- */
  function decHtml() {
    var ds = decisions(), show = ds.slice(0, 4);
    var h = '<section class="w128box w128dec" id="w128dec"><div class="hd"><h3>' + I('flag') + 'Needs a decision</h3><span class="sp"></span>' + (ds.length ? '<a class="w128lnk" data-w128all="1">All ' + ds.length + ' in the list ' + I('chev') + '</a>' : '') + '</div>';
    if (!ds.length) return h + '<p class="w128empty">Nothing is waiting on the executives. New calls from meetings land here.</p></section>';
    h += show.map(function (x) {
      var hot = x.age > 60 ? ' hot' : x.age > 30 ? ' warm' : '';
      return '<div class="w128d"><span class="age' + hot + '">' + (x.age === 0 ? 'today' : x.age + (x.age === 1 ? ' day' : ' days')) + '</span><div class="tx"><b>' + E(x.title) + '</b>'
        + (x.move ? '<span>Suggested: ' + E(clip(x.move, 170)) + '</span>' : '')
        + (x.rec ? '<span class="rec">' + I('spark') + 'Recommendation: ' + E(clip(x.rec, 170)) + '</span>' : '')
        + '<em>Decides: <b>' + E(x.owner) + '</b>' + (x.area ? ' · ' + E(x.area) : '') + (x.cat ? ' · ' + E(x.cat) : '') + '</em></div>'
        + '<div class="ac">' + (staffOk() ? '<a class="w128btn sm" data-w128decide="' + E(x.ref) + '">' + I('check') + 'Record the decision</a>' : '') + '<a class="w128btn ghost sm" data-w128see="' + E(x.ref) + '">In the list</a></div></div>';
    }).join('');
    if (ds.length > show.length) h += '<p class="w128more">' + plural(ds.length - show.length, 'more decision', 'more decisions') + ' in the list below.</p>';
    return h + '</section>';
  }

  /* ---------- to watch ---------- */
  function watchRows() {
    var t = today(), rows = [], ds = decisions(), fy = fundYear();
    var old = ds.filter(function (d) { return d.age > 60; });
    if (old.length) rows.push({ sev: 'hot', t: '<b>' + plural(old.length, 'decision has', 'decisions have') + ' waited more than 60 days</b>, the oldest ' + old[0].age + ' days: ' + E(sentence(clip(old[0].title, 70))), go: '#overview/decisions' });
    if (fy.missing.length) rows.push({ sev: 'warm', t: '<b>No result recorded</b> for ' + E(listJoin(fy.missing.map(function (f) { return f.title + ' (' + fmtDay(parseDay(f.end_date) || parseDay(f.start_date)) + ')'; }))) + '.', go: '#fundevents' });
    var over = TEAMS.map(teamStats).filter(function (s) { return s.overdue >= 5; }).sort(function (a, b) { return b.overdue - a.overdue; });
    if (over.length) rows.push({ sev: over[0].overdue >= 20 ? 'hot' : 'warm', t: '<b>Overdue work:</b> ' + E(listJoin(over.map(function (s) { return deptLabel(s.dept) + ' ' + s.overdue; }))) + ' tasks past their due date.', go: '#team/' + over[0].dept + '/tasks' });
    var quiet = TEAMS.map(teamStats).filter(function (s) { return !s.last || daysBetween(s.last, t) > 21; });
    if (quiet.length) { var lastAny = quiet.map(function (s) { return s.last; }).filter(Boolean).sort(function (a, b) { return b - a; })[0]; rows.push({ sev: 'warm', t: '<b>No meeting update in three weeks</b> from ' + E(listJoin(quiet.map(function (s) { return deptLabel(s.dept); }))) + (lastAny ? ' (latest ' + fmtDay(lastAny) + ')' : '') + '. Upload their meeting transcripts to keep their pages current.', go: '#transcripts' }); }
    var rg = (X.goals || []).filter(atRiskGoal);
    if (rg.length) rows.push({ sev: 'warm', t: '<b>' + plural(rg.length, 'goal needs', 'goals need') + ' attention:</b> ' + E(listJoin(rg.slice(0, 3).map(function (g) { return clip(g.title, 60) + ' (' + [g.department && g.department !== 'org' ? deptLabel(g.department) : 'organization', String(g.status || '').toLowerCase()].filter(Boolean).join(', ') + ')'; }))) + '.', go: rg.some(function (g) { return g.department === 'org'; }) ? '#orggoals' : '#goals' });
    var br = boardAtRisk();
    if (br.length) rows.push({ sev: 'hot', t: '<b>' + plural(br.length, 'board item is', 'board items are') + ' at risk:</b> ' + E(sentence(listJoin(br.slice(0, 3).map(function (i) { return clip(i.title, 70); })))), go: '#governance' });
    var soon = (X.fund || []).filter(function (f) { var d = parseDay(f.start_date); return d && d >= t && daysBetween(t, d) <= 21 && !f.lead && f.status !== 'idea' && f.status !== 'cancelled'; });
    if (soon.length) rows.push({ sev: 'warm', t: '<b>No lead yet</b> for ' + E(listJoin(soon.map(function (f) { return f.title + ' (' + fmtDay(parseDay(f.start_date)) + ')'; }))) + '.', go: '#fundevents' });
    if (fy.daysLeft >= 0 && fy.daysLeft <= 14) rows.push({ sev: 'info', t: '<b>Year-end ' + fmtDay(fy.end) + ':</b> close the books, record the last event results and set up the ' + (fy.end.getFullYear()) + '-' + String(fy.end.getFullYear() + 1).slice(2) + ' goals.', go: tabOk('finances') ? '#finances' : '#fundevents' });
    return rows;
  }
  function watchHtml() {
    var rows = watchRows();
    return '<section class="w128box w128watch"><div class="hd"><h3>' + I('alert') + 'To watch</h3></div>'
      + (rows.length ? rows.map(function (r) { return '<a class="w128w ' + r.sev + '" data-w128go="' + E(r.go) + '"><i></i><span>' + r.t + '</span>' + I('chev') + '</a>'; }).join('') : '<p class="w128empty">Nothing needs watching right now.</p>')
      + '</section>';
  }

  /* ---------- highlights ---------- */
  function winsRows() {
    var t = today(), rows = [];
    (X.fund || []).filter(function (f) { var d = parseDay(f.end_date) || parseDay(f.start_date); return f.status === 'done' && Number(f.raised || 0) > 0 && d && daysBetween(d, t) <= 75 && d <= t; }).forEach(function (f) {
      var tg = Number(f.target_min || 0); rows.push({ d: parseDay(f.end_date) || parseDay(f.start_date), ic: 'target', t: '<b>' + E(f.title) + ' raised ' + money(f.raised) + '</b>' + (tg ? ' against a ' + money(tg) + ' target' : '') + '.', go: '#fundevents' });
    });
    (X.shout || []).filter(function (s) { var d = dayOfIso(s.created_at); return d && daysBetween(d, t) <= 30; }).slice(0, 3).forEach(function (s) {
      rows.push({ d: dayOfIso(s.created_at), ic: 'hand', t: E(sentence(clip(s.text, 150))), go: s.member_id ? '#person/' + s.member_id : '#orgchart' });
    });
    (X.goals || []).filter(function (g) { var d = dayOfIso(g.updated_at); return doneGoal(g) && d && daysBetween(d, t) <= 45; }).slice(0, 3).forEach(function (g) {
      rows.push({ d: dayOfIso(g.updated_at), ic: 'spark', t: '<b>Goal closed</b>' + (g.department && g.department !== 'org' ? ' by ' + E(deptLabel(g.department)) : '') + ': ' + E(sentence(clip(g.title, 90))), go: g.department === 'org' ? '#orggoals' : '#goals' });
    });
    (X.wins || []).filter(function (w) { var d = parseDay(w.meeting_date) || dayOfIso(w.created_at); return d && daysBetween(d, t) <= 45; }).slice(0, 3).forEach(function (w) {
      rows.push({ d: parseDay(w.meeting_date) || dayOfIso(w.created_at), ic: 'spark', t: '<b>A win' + (w.department ? ' for ' + E(deptLabel(w.department)) : '') + ':</b> ' + E(sentence(clip(w.win, 120))), go: '#goals' });
    });
    var c30 = TEAMS.map(teamStats).filter(function (s) { return s.closed30 > 0; }).sort(function (a, b) { return b.closed30 - a.closed30; });
    var tot = c30.reduce(function (a, s) { return a + s.closed30; }, 0);
    if (tot) rows.push({ d: t, ic: 'check', t: '<b>' + plural(tot, 'task', 'tasks') + ' closed in the last 30 days</b>, most by ' + E(listJoin(c30.slice(0, 2).map(function (s) { return deptLabel(s.dept) + ' (' + s.closed30 + ')'; }))) + '.', go: '#dashboard', fold: 'numbers' });
    var held = (X.vol || []).filter(function (v) { var d = parseDay(v.event_date); return d && d < t && daysBetween(d, t) <= 30 && v.status !== 'cancelled' && v.status !== 'planned'; });
    if (held.length) rows.push({ d: parseDay(held[held.length - 1].event_date), ic: 'heart', t: '<b>' + plural(held.length, 'serving', 'servings') + ' held in the last 30 days.</b>', go: '#volunteering' });
    var joined = changes().filter(function (c) { return c.entity_type === 'member' && c.field === 'invited' && /sent|admin|leader|member/.test(String(c.new_value || '')) && dayOfIso(c.changed_at) && daysBetween(dayOfIso(c.changed_at), t) <= 30; });
    if (joined.length) rows.push({ d: dayOfIso(joined[0].changed_at), ic: 'people', t: '<b>' + plural(joined.length, 'person', 'people') + ' joined the Hub</b> in the last 30 days.', go: '#orgchart' });
    return rows.sort(function (a, b) { return (b.d ? b.d.getTime() : 0) - (a.d ? a.d.getTime() : 0); }).slice(0, 7);
  }
  function winsHtml() {
    var rows = winsRows();
    return '<section class="w128box w128wins"><div class="hd"><h3>' + I('spark') + 'Highlights</h3><span class="sub">the last 30 days or so</span></div>'
      + (rows.length ? rows.map(function (r) { return '<a class="w128h" ' + (r.fold ? 'data-w128fold="' + r.fold + '"' : 'data-w128go="' + E(r.go) + '"') + '><span class="ic">' + I(r.ic) + '</span><span class="tx">' + r.t + (r.d ? '<small>' + E(fmtDay(r.d)) + '</small>' : '') + '</span></a>'; }).join('') : '<p class="w128empty">Wins from meetings, event results and shout-outs show up here.</p>')
      + '</section>';
  }

  /* ---------- coming up ---------- */
  function nextRows() {
    var t = today(), end = addDays(t, 45), rows = [], fy = fundYear();
    var inWin = function (d) { return d && d >= t && d <= end; };
    if (inWin(fy.end)) rows.push({ d: fy.end, k: 'Year-end', t: 'The fiscal year ends', go: tabOk('finances') ? '#finances' : '#fundevents' });
    boardMeetings().filter(function (x) { return inWin(x.d); }).forEach(function (x) { rows.push({ d: x.d, k: 'Board', t: x.m.title || 'Board meeting', go: '#governance' }); });
    try { var cy = X.board && X.board.cycle; if (cy && cy.next) { var due = addDays(dayOfIso(cy.next.meets_at) || t, -7); if (inWin(due)) rows.push({ d: due, k: 'Committees', t: 'Committees meet by this date', go: '#committees' }); } } catch (e) { /* fine */ }
    (X.fund || []).filter(function (f) { return inWin(parseDay(f.start_date)) && f.status !== 'idea' && f.status !== 'cancelled'; }).forEach(function (f) { rows.push({ d: parseDay(f.start_date), k: 'Fundraising', t: f.title + (f.precision === 'month' ? ' (all month)' : ''), go: '#fundevents' }); });
    (X.vol || []).filter(function (v) { return inWin(parseDay(v.event_date)) && v.status !== 'cancelled'; }).slice(0, 4).forEach(function (v) { rows.push({ d: parseDay(v.event_date), k: 'Serving', t: v.title || v.code || 'Serving', go: '#volunteering' }); });
    return rows.sort(function (a, b) { return a.d - b.d; }).slice(0, 8);
  }
  function nextHtml() {
    var rows = nextRows();
    return '<section class="w128box w128next"><div class="hd"><h3>' + I('cal') + 'Coming up</h3><span class="sp"></span><a class="w128lnk" data-w128go="#calendar">Calendar ' + I('chev') + '</a></div>'
      + (rows.length ? rows.map(function (r) { return '<a class="w128n" data-w128go="' + E(r.go) + '"><span class="dt"><b>' + r.d.getDate() + '</b><small>' + E(MONTHS[r.d.getMonth()].slice(0, 3)) + '</small></span><span class="tx"><small>' + E(r.k) + ' · ' + E(DAYS[r.d.getDay()]) + '</small>' + E(clip(r.t, 70)) + '</span>' + I('chev') + '</a>'; }).join('') : '<p class="w128empty">Nothing dated in the next six weeks yet.</p>')
      + '</section>';
  }

  /* ---------- teams at a glance ---------- */
  function teamsHtml() {
    var t = today();
    var cards = TEAMS.filter(function (d) { return tabOk(d); }).map(function (d) {
      var s = teamStats(d), last = s.last ? daysBetween(s.last, t) : null;
      var gOn = s.goals.filter(onTrackGoal).length, gRisk = s.goals.filter(atRiskGoal).length, gAll = s.goals.length;
      return '<a class="w128t" data-w128go="#team/' + E(d) + '" style="--c:' + E(deptColor(d)) + '"><div class="nm"><i></i><b>' + E(deptLabel(d)) + '</b></div>'
        + '<div class="ld">' + (s.leads.length ? 'Led by ' + E(listJoin(s.leads.slice(0, 2))) : plural(s.people, 'person', 'people') + ' on the roster') + '</div>'
        + '<div class="st"><span><b>' + s.open + '</b> open</span><span class="' + (s.overdue ? 'od' : '') + '"><b>' + s.overdue + '</b> overdue</span><span><b>' + s.closed30 + '</b> closed in 30 days</span></div>'
        + '<div class="ft"><span class="' + (last == null || last > 21 ? 'stale' : '') + '">' + I('mic') + (last == null ? 'No meeting update yet' : last === 0 ? 'Updated today' : 'Updated ' + (last === 1 ? 'yesterday' : last + ' days ago')) + '</span>'
        + (gAll ? '<span>' + I('target') + plural(gAll, 'goal') + (gRisk ? ', ' + gRisk + ' at risk' : gOn ? ', ' + gOn + ' on track' : '') + '</span>' : '') + '</div></a>';
    }).join('');
    if (!cards) return '';
    return '<div class="w128sec"><h2>Teams at a glance</h2><span>Open and overdue work, what closed lately, and when each team last had a meeting on the Hub.</span></div><div class="w128teams">' + cards + '</div>';
  }
