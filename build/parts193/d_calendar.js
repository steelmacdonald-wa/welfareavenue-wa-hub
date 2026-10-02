
  /* ---------- the Fundraising calendar (#fund/calendar): events, grant deadlines, reports and next actions ---------- */
  function calAnchor() { if (!F.calAnchor) { var t = today(); F.calAnchor = mk(t.getFullYear(), t.getMonth(), 1); } return F.calAnchor; }
  function monthStart(d) { return mk(d.getFullYear(), d.getMonth(), 1); }
  function addMonths(d, n) { return mk(d.getFullYear(), d.getMonth() + n, 1); }
  function spanDays(f) { var s = parseDay(f.start_date), e = parseDay(f.end_date) || s; if (!s) return 0; return Math.round((e.getTime() - s.getTime()) / 86400000) + 1; }
  /* dated items in a window: grant dates one by one, events of up to four days on their days, longer events as a band */
  function calItems(from, to) {
    var a = ymd(from), b = ymd(to), out = [];
    var inWin = function (d) { return d && d >= a && d <= b; };
    F.grants.forEach(function (g) {
      var tt = grantTitle(g);
      if (F.calLayers.deadlines && g.deadline && OPEN.concat(['watching']).indexOf(g.stage) >= 0 && inWin(g.deadline)) out.push({ id: 'd' + g.id, k: 'deadline', day: g.deadline, title: tt, sub: 'Deadline' + (g.deadline_note ? ' · ' + g.deadline_note : ''), h: '#fund/grants/' + g.id });
      if (F.calLayers.reports) {
        if (g.report_due && ['awarded', 'reporting'].indexOf(g.stage) >= 0 && inWin(g.report_due)) out.push({ id: 'r' + g.id, k: 'report', day: g.report_due, title: tt, sub: 'Report due', h: '#fund/grants/' + g.id });
        if (g.renewal_due && inWin(g.renewal_due)) out.push({ id: 'n' + g.id, k: 'report', day: g.renewal_due, title: tt, sub: 'Renewal', h: '#fund/grants/' + g.id });
        if (g.submitted_on && g.stage === 'submitted' && inWin(g.submitted_on)) out.push({ id: 's' + g.id, k: 'report', day: g.submitted_on, title: tt, sub: 'Submitted', h: '#fund/grants/' + g.id, past: true });
      }
      if (F.calLayers.actions && g.next_action_due && OPEN.concat(['watching', 'awarded', 'reporting']).indexOf(g.stage) >= 0 && inWin(g.next_action_due)) out.push({ id: 'a' + g.id, k: 'action', day: g.next_action_due, title: g.next_action || 'Next step', sub: tt, h: '#fund/grants/' + g.id });
    });
    if (F.calLayers.events) F.events.forEach(function (f) {
      if (!f.start_date || f.status === 'cancelled' || f.precision === 'none') return;
      var n = spanDays(f); if (n > 4) return;
      var s = parseDay(f.start_date);
      for (var i = 0; i < n; i++) { var d = ymd(addDays(s, i)); if (inWin(d)) out.push({ id: 'e' + f.id + '-' + i, k: 'event', day: d, title: f.title, sub: (f.partners ? f.partners + ' · ' : '') + (f.status || ''), h: '#fundevents/' + f.id, past: f.status === 'done' }); }
    });
    out.sort(function (x, y) { return x.day < y.day ? -1 : x.day > y.day ? 1 : (x.k === 'event' ? -1 : 1); });
    return out;
  }
  function calBands(from, to) {
    if (!F.calLayers.events) return [];
    var a = ymd(from), b = ymd(to);
    return F.events.filter(function (f) { if (!f.start_date || f.status === 'cancelled' || f.precision === 'none') return false; if (spanDays(f) <= 4) return false; var e = f.end_date || f.start_date; return f.start_date <= b && e >= a; });
  }
  function evPill(it) {
    var L = LAYERC[it.k], t = today(), past = it.past || (parseDay(it.day) < t);
    return '<div class="w193ev' + (past ? ' past' : '') + '" data-w193go="' + E(it.h) + '" style="--c:' + L[1] + ';--bg:' + L[2] + ';--ink:' + L[3] + '" title="' + E(it.title + (it.sub ? ' · ' + it.sub : '')) + '" tabindex="0" role="button"><span>' + E(it.title) + '</span></div>';
  }
  function calendarHtml() {
    var A = calAnchor(), s = monthStart(A), dow = (s.getDay() + 6) % 7, start = addDays(s, -dow), end = addDays(start, 41), t = today();
    var items = calItems(start, end), byDay = {};
    items.forEach(function (it) { (byDay[it.day] = byDay[it.day] || []).push(it); });
    var counts = {}; calItems(mk(t.getFullYear(), t.getMonth() - 1, 1), mk(t.getFullYear(), t.getMonth() + 12, 1)).forEach(function (it) { counts[it.k] = (counts[it.k] || 0) + 1; });
    var html = '<div class="w193calbar"><a class="w193btn ghost icon" data-w193nav="-1" aria-label="Previous month">' + I('chevl') + '</a><a class="w193btn ghost icon" data-w193nav="1" aria-label="Next month">' + I('chevr') + '</a><h2>' + E(MONTHS[A.getMonth()] + ' ' + A.getFullYear()) + '</h2><a class="w193btn ghost sm" data-w193nav="0">Today</a><span class="sp"></span>'
      + '<a class="w193lnk" data-w193go="#calendar" style="font-size:12.5px">The master calendar</a></div>';
    html += '<div class="w193layers">' + Object.keys(LAYERC).map(function (k) { var L = LAYERC[k], key = k === 'event' ? 'events' : k === 'deadline' ? 'deadlines' : k === 'report' ? 'reports' : 'actions'; return '<a class="w193chip' + (F.calLayers[key] ? '' : ' off') + '" data-w193layer="' + key + '" style="--c:' + L[1] + '" role="switch" aria-checked="' + (F.calLayers[key] ? 'true' : 'false') + '"><i></i>' + E(L[0]) + ' <span class="n">' + (counts[k] || 0) + '</span></a>'; }).join('') + '</div>';
    var bands = calBands(s, addMonths(s, 1));
    if (bands.length) html += '<div class="w193band"><span class="lb">This month</span>' + bands.map(function (f) { return '<a data-w193go="#fundevents/' + f.id + '">' + E(f.title) + (f.start_date ? ' <small>' + E(fmtDate(f.start_date, { month: 'short', day: 'numeric' }) + (f.end_date && f.end_date !== f.start_date ? ' to ' + fmtDate(f.end_date, { month: 'short', day: 'numeric' }) : '')) + '</small>' : '') + '</a>'; }).join('') + '</div>';
    html += '<div class="w193side"><div><div class="w193grid">' + WD.map(function (d) { return '<div class="w193dow">' + d + '</div>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), key = ymd(d), list = byDay[key] || [], out = d.getMonth() !== A.getMonth();
      html += '<div class="w193cell' + (out ? ' out' : '') + (ymd(t) === key ? ' today' : '') + '"><span class="dn">' + d.getDate() + '</span>' + list.slice(0, 4).map(evPill).join('') + (list.length > 4 ? '<span class="w193more">+' + (list.length - 4) + ' more</span>' : '') + '</div>';
    }
    html += '</div></div>';
    var next = dueItems(120).slice(0, 14);
    html += '<div class="w193card"><h3>Up next</h3>' + (next.length ? '<ul class="w193list">' + next.map(function (x) { var L = LAYERC[x.k]; return '<li data-w193go="' + E(x.h) + '"><span class="w193tag" style="--bg:' + L[2] + ';--ink:' + L[3] + '">' + E(fmtDate(x.day, { month: 'short', day: 'numeric' })) + '</span><div class="t"><b>' + E(x.t) + '</b><small>' + E(x.s) + '</small></div></li>'; }).join('') + '</ul>' : '<p class="w193empty">Nothing dated in the next four months.</p>') + '</div></div>';
    return html;
  }
