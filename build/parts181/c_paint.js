
  /* ---------- painting ---------- */
  function host() {
    var body = document.getElementById('w46body'); if (!body) return null;
    var h = document.getElementById('w181');
    if (!h) { h = document.createElement('div'); h.id = 'w181'; var tabs = body.querySelector('.w47tabs'); if (tabs) tabs.insertAdjacentElement('afterend', h); else body.insertBefore(h, body.firstChild); }
    return h;
  }
  function tile(n, label, small) { return '<div class="w181tile"><b>' + E(n) + '</b><span>' + E(label) + '</span>' + (small ? '<small>' + small + '</small>' : '') + '</div>'; }
  function paint() {
    var h = host(); if (!h) return;
    if (A.err) { h.innerHTML = '<div class="w181card"><h3>Analytics</h3><p class="w181empty">Could not load the numbers: ' + E(A.err) + '</p><button class="w181btn sm" data-w181="reload">Try again</button></div>'; return; }
    if (!A.loaded) { h.innerHTML = '<div class="w181card"><p class="w181empty">Loading who has been part of Welfare Avenue…</p></div>'; return; }
    if (!A.rows.length) { h.innerHTML = '<div class="w181card"><h3>Analytics</h3><p class="w181empty">Nobody to show yet. Import Slack\u2019s member export to see who has been part of Welfare Avenue and for how long.</p><button class="w181btn sm" data-w181="import">Import a Slack export</button></div>'; return; }
    var s = stats(), pr = period(); A.noStart = s.noStart;
    var top = '<div class="w181top"><p>Who has been part of Welfare Avenue, and for how long: the roster and every Slack account since ' + E(monthNice(s.first)) + '. ' +
      (pr.from ? 'Slack’s export covers ' + E(dayNice(pr.from)) + ' to ' + E(dayNice(pr.to)) + '. ' : '') +
      'Accounts were often switched off late, so a leaving date is the latest day they can have left.</p>' +
      '<div class="acts"><button class="w181btn ghost sm" data-w181="csv">Download (CSV)</button><button class="w181btn sm" data-w181="import">Import a new Slack export</button></div></div>';
    var tiles = '<div class="w181tiles">' +
      tile(s.cur.length, 'on the team now', s.cur.filter(function (p) { return !p.on_roster; }).length ? plural(s.cur.filter(function (p) { return !p.on_roster; }).length, 'is', 'are') + ' on Slack but not on the roster' : 'on the roster') +
      tile(s.joined.length, 'joined in the last 12 months', 'by the day they joined Slack or got a Workspace account') +
      tile(s.left.length, 'left in the last 12 months', 'Slack active in the year, then switched off') +
      tile(s.curMed == null ? '–' : dur(s.curMed), 'typical time with us so far', 'the median of the team today') +
      tile(s.goneMed == null ? '–' : dur(s.goneMed), 'typical stay of people who left', 'at most: they may have left earlier') +
      tile(s.all.length, 'people since ' + monthNice(s.first).split(' ')[1], 'on the team at some point, staff and volunteers') +
      '</div>';
    h.innerHTML = top + tiles + overTime() + '<div class="w181two">' + fyTable() + stayCard() + '</div><div style="height:14px"></div>' + teamCard() + lookCard() + peopleCard();
    wireChart();
  }

  function overTime() {
    var ser = series(); if (!ser.length) return '';
    var W = 760, H = 230, L = 34, R = 10, Tp = 12, B = 26, n = ser.length, cw = (W - L - R) / n;
    var max = Math.max(4, Math.max.apply(null, ser.map(function (d) { return Math.max(d.on, d.joined.length); })));
    var step = max > 60 ? 20 : max > 24 ? 10 : 5; var top = Math.ceil(max / step) * step;
    var y = function (v) { return Tp + (H - Tp - B) * (1 - v / top); };
    var grid = ''; for (var g = 0; g <= top; g += step) grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="' + LINE + '" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end" font-size="10" fill="' + MUTED + '">' + g + '</text>';
    var bars = ser.map(function (d, i) { var v = d.joined.length; if (!v) return ''; var x = L + i * cw + cw * 0.18; return '<rect x="' + x.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + (cw * 0.64).toFixed(1) + '" height="' + (y(0) - y(v)).toFixed(1) + '" rx="1.5" fill="' + GOLD + '"/>'; }).join('');
    var pts = ser.map(function (d, i) { return (L + i * cw + cw / 2).toFixed(1) + ',' + y(d.on).toFixed(1); });
    var area = '<path d="M' + (L + cw / 2).toFixed(1) + ',' + y(0) + ' L' + pts.join(' L') + ' L' + (L + (n - 1) * cw + cw / 2).toFixed(1) + ',' + y(0) + ' Z" fill="rgba(16,63,57,.10)"/>';
    var line = '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + GREEN + '" stroke-width="2.2" stroke-linejoin="round"/>';
    var yrs = ser.map(function (d, i) { return d.k.slice(5) === '01' ? '<text x="' + (L + i * cw).toFixed(1) + '" y="' + (H - 8) + '" font-size="10.5" fill="' + MUTED + '">' + d.k.slice(0, 4) + '</text><line x1="' + (L + i * cw).toFixed(1) + '" x2="' + (L + i * cw).toFixed(1) + '" y1="' + y(0) + '" y2="' + (y(0) + 4) + '" stroke="' + MUTED + '"/>' : ''; }).join('');
    var hits = ser.map(function (d, i) { return '<rect class="hit" data-i="' + i + '" x="' + (L + i * cw).toFixed(1) + '" y="' + Tp + '" width="' + cw.toFixed(1) + '" height="' + (H - Tp - B) + '" fill="transparent" pointer-events="all"/>'; }).join('');
    var cur = '<line class="cur" x1="0" x2="0" y1="' + Tp + '" y2="' + y(0) + '" stroke="' + INK + '" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>';
    A.ser = ser; A.serGeom = { L: L, cw: cw, W: W };
    var last = ser[ser.length - 1], peak = ser.reduce(function (a, d) { return d.on > a.on ? d : a; }, ser[0]);
    return '<div class="w181card"><h3>The team over time</h3><p class="sub">People on the team at the end of each month (green) and the month’s joiners (gold). ' + E(last.on) + ' now' + (A.noStart ? ' (' + plural(A.noStart, 'person', 'people') + ' on the team ' + (A.noStart === 1 ? 'has' : 'have') + ' no start date, so ' + (A.noStart === 1 ? 'is' : 'are') + ' left out)' : '') + '; the most was ' + E(peak.on) + ' in ' + E(monLabel(peak.k)) + '. Before September 2025 the line is at most: people not active once in Slack’s export are counted until it starts, since we cannot see when they stopped.</p>' +
      '<div class="w181chart" id="w181over"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="People on the team each month since ' + E(monLabel(ser[0].k)) + '">' + grid + area + bars + line + yrs + cur + hits + '</svg><div class="w181tip"></div></div>' +
      '<div class="w181key"><span><i style="background:' + GREEN + '"></i>On the team</span><span><i style="background:' + GOLD + '"></i>Joined that month</span><span>Hover, tap or use the arrow keys for a month’s numbers</span></div></div>';
  }
  function wireChart() {
    var box = document.getElementById('w181over'); if (!box || box.dataset.w) return; box.dataset.w = '1';
    var svg = box.querySelector('svg'), tip = box.querySelector('.w181tip'), cur = svg.querySelector('.cur'); box.tabIndex = 0;
    function show(i) {
      var d = A.ser[i]; if (!d) return; A.serI = i; var g = A.serGeom; var r = svg.getBoundingClientRect(), sc = r.width / g.W;
      var x = (g.L + i * g.cw + g.cw / 2); cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.style.display = '';
      var j = d.joined.length;
      tip.innerHTML = '<b>' + E(monLabel(d.k)) + '</b><br>On the team: ' + d.on + (d.unsure ? ' (at most)' : '') + '<br>Joined: ' + j + (j && j <= 4 ? ' (' + E(d.joined.join(', ')) + ')' : '');
      tip.style.display = 'block'; var left = x * sc; left = Math.max(80, Math.min(r.width - 80, left)); tip.style.left = left + 'px'; tip.style.top = '6px';
    }
    function hide() { tip.style.display = 'none'; cur.style.display = 'none'; }
    svg.addEventListener('mousemove', function (e) { var t = e.target.closest && e.target.closest('.hit'); if (t) show(Number(t.getAttribute('data-i'))); });
    svg.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('.hit'); if (t) show(Number(t.getAttribute('data-i'))); });
    svg.addEventListener('mouseleave', hide);
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); var i = (A.serI == null ? A.ser.length : A.serI) + (e.key === 'ArrowLeft' ? -1 : 1); show(Math.max(0, Math.min(A.ser.length - 1, i))); } if (e.key === 'Escape') hide(); });
    box.addEventListener('blur', hide);
  }

  function fyTable() {
    var rows = byFy();
    var tr = rows.map(function (r) {
      return '<tr><td>' + E(fyLabel(r.y)) + (r.running ? ' <span class="w181tag lg">so far</span>' : '') + '</td><td class="n">' + r.joined + '</td><td class="n">' + r.left + '</td><td class="n">' + r.on + '</td><td class="n">' + (r.joined ? r.still + ' <span style="color:' + MUTED + '">(' + Math.round(100 * r.still / r.joined) + '%)</span>' : '–') + '</td></tr>';
    }).join('');
    return '<div class="w181card"><h3>Each fiscal year</h3><p class="sub">October to September. Left counts the day an account was switched off, so a batch can land in the year after people stopped (21 October 2025 switched off 22 at once).</p>' +
      '<table class="w181t w181fy"><thead><tr><th>Year</th><th class="n">Joined</th><th class="n">Left by</th><th class="n"><span class="lg">On the team at the end</span><span class="sm">Year end</span></th><th class="n"><span class="lg">Joiners still here</span><span class="sm">Still here</span></th></tr></thead><tbody>' + tr + '</tbody></table></div>';
  }
  function barsHtml(list, color) {
    var max = Math.max(1, Math.max.apply(null, list.map(function (x) { return x[1]; })));
    return list.map(function (x) { return '<div class="r"><span>' + E(x[0]) + '</span><span class="tr"><i style="width:' + (100 * x[1] / max).toFixed(1) + '%;background:' + color + '"></i></span><b>' + x[1] + '</b></div>'; }).join('');
  }
  function stayCard() {
    var all = people(), cur = all.filter(function (p) { return p.status === 'current'; }).map(tenureOf).filter(function (x) { return x != null; });
    var gone = all.filter(function (p) { return p.status !== 'current'; }).map(tenureOf).filter(function (x) { return x != null; });
    return '<div class="w181card w181bars"><h3>How long people stay</h3><p class="sub">From the day they started to today, or to the latest day they can have left.</p>' +
      '<h4>The team today (' + cur.length + ')</h4>' + barsHtml(buckets(cur), GREEN) +
      '<h4>People who left (' + gone.length + ', at most)</h4>' + barsHtml(buckets(gone), GOLD) + '</div>';
  }
  function teamCard() {
    var t = byTeam(); if (!t.length) return '';
    var max = Math.max.apply(null, t.map(function (x) { return x.n; }));
    return '<div class="w181card w181bars"><h3>The team today, by team</h3><p class="sub">People on the team now and the typical (median) time they have been with us.</p>' +
      t.map(function (x) { return '<div class="r" style="grid-template-columns:minmax(120px,190px) 1fr 40px 110px"><span>' + E(x.label) + '</span><span class="tr"><i style="width:' + (100 * x.n / max).toFixed(1) + '%;background:' + (x.k === '_none' ? GOLD : TEAL) + '"></i></span><b>' + x.n + '</b><span style="color:' + MUTED + ';font-size:12px">' + (x.med == null ? '' : dur(x.med)) + '</span></div>'; }).join('') + '</div>';
  }
  function lookCard() {
    var L = look().filter(function (g) { return g.list.length || (g.extra && g.extra.length); }); if (!L.length) return '';
    var nm = function (p) { return '<button class="w181lnk" data-w181p="' + E(p.person_key) + '">' + E(p.name) + '</button>'; };
    return '<div class="w181card"><h3>Worth a look</h3><p class="sub">Where the roster and Slack disagree, and what to tidy. Click a name for their sheet.</p><div class="w181look">' +
      L.map(function (g) {
        var names = g.list.map(nm).join(', ');
        if (g.extra && g.extra.length) names += (names ? '; ' : '') + 'and unused second accounts: ' + g.extra.map(function (x) { return x.p ? '<button class="w181lnk" data-w181p="' + E(x.p.person_key) + '">' + E(x.p.name) + '</button> (' + E(x.a.email || x.a.slack_id) + ')' : E(x.a.full_name); }).join(', ');
        return '<div data-w181look="' + g.k + '"><b class="h">' + E(g.h) + ' (' + (g.list.length + (g.extra ? g.extra.length : 0)) + ')</b><p>' + E(g.p) + '</p>' + names + '</div>';
      }).join('') + '</div></div>';
  }
  var FILTERS = [['current', 'On the team now'], ['left', 'Left'], ['quiet', 'Slack open, unused'], ['never_joined', 'Never joined'], ['all', 'Everyone']];
  function filtered() {
    var q = lower(A.q);
    var rows = A.rows.filter(function (p) {
      if (A.f !== 'all' && p.status !== A.f) return false;
      if (A.team && (p.department || '_none') !== A.team) return false;
      if (q && lower(p.name + ' ' + (p.slack_name || '') + ' ' + (p.title || '') + ' ' + (p.email || '')).indexOf(q) < 0) return false;
      return true;
    });
    var key = A.sort;
    rows.sort(function (a, b) {
      if (key === 'name') return String(a.name).localeCompare(String(b.name));
      if (key === 'long') return (tenureOf(b) || -1) - (tenureOf(a) || -1);
      if (key === 'left') return String(b.left_by || '').localeCompare(String(a.left_by || ''));
      return String(a.started_on || '9').localeCompare(String(b.started_on || '9'));
    });
    return rows;
  }
  function statusTag(p) {
    if (p.status === 'current') return p.on_roster ? '<span class="w181tag ok">On the team</span>' : '<span class="w181tag ok">On Slack</span>';
    if (p.status === 'left') return '<span class="w181tag">Left</span>';
    if (p.status === 'quiet') return '<span class="w181tag warn">Slack unused</span>';
    return '<span class="w181tag">Invited, never joined</span>';
  }
  function leftCell(p) {
    if (p.status === 'current') return '';
    if (p.left_by) return 'by ' + monthNice(p.left_by);
    return p.status === 'never_joined' ? '' : 'not known';
  }
  function timeCell(p) { var m = tenureOf(p); if (m == null) return ''; return (p.status === 'current' ? '' : 'up to ') + dur(m); }
  function peopleCard() {
    var counts = {}; A.rows.forEach(function (p) { counts[p.status] = (counts[p.status] || 0) + 1; }); counts.all = A.rows.length;
    var teams = {}; A.rows.forEach(function (p) { teams[p.department || '_none'] = 1; });
    var rows = filtered();
    var chips = FILTERS.map(function (f) { return '<button class="w181chip' + (A.f === f[0] ? ' on' : '') + '" data-w181f="' + f[0] + '">' + E(f[1]) + ' ' + (counts[f[0]] || 0) + '</button>'; }).join('');
    var tsel = '<select id="w181team" aria-label="Team"><option value="">Every team</option>' + Object.keys(teams).sort().map(function (k) { return '<option value="' + E(k) + '"' + (A.team === k ? ' selected' : '') + '>' + E(k === '_none' ? 'Not on the roster' : teamName(k)) + '</option>'; }).join('') + '</select>';
    var ssel = '<select id="w181sort" aria-label="Sort"><option value="start"' + (A.sort === 'start' ? ' selected' : '') + '>Longest-standing first</option><option value="long"' + (A.sort === 'long' ? ' selected' : '') + '>Longest time with us</option><option value="left"' + (A.sort === 'left' ? ' selected' : '') + '>Most recently left</option><option value="name"' + (A.sort === 'name' ? ' selected' : '') + '>Name</option></select>';
    var body = rows.map(function (p) {
      var fl = flags(p).map(function (f) { return '<span class="w181tag ' + f[1] + '">' + E(f[0]) + '</span>'; }).join('');
      return '<tr data-w181p="' + E(p.person_key) + '" tabindex="0"><td><b>' + E(p.name) + '</b>' + (p.title ? '<span class="t">' + E(p.title) + '</span>' : '') + '</td>' +
        '<td data-l="Team">' + E(p.department ? teamShort(p.department) : '') + '</td><td data-l="Started">' + E(p.started_on ? monthNice(p.started_on) : '') + '</td>' +
        '<td data-l="Left">' + E(leftCell(p)) + '</td><td data-l="Time with us">' + E(timeCell(p)) + '</td><td data-l="Slack, last year" class="n">' + (p.accounts ? p.days_active + ' days' : '') + '</td><td>' + statusTag(p) + fl + '</td></tr>';
    }).join('');
    return '<div class="w181card" id="w181people"><h3>Everyone who has been part of Welfare Avenue</h3><p class="sub">Started is the earliest of their Workspace account and the day they joined Slack. Slack, last year is the days they were active in the export’s window.</p>' +
      '<div class="w181bar">' + chips + '</div><div class="w181bar"><input type="search" id="w181q" placeholder="Search by name, role or email" value="' + E(A.q) + '">' + tsel + ssel + '</div>' +
      (body ? '<table class="w181t w181ppl"><thead><tr><th>Person</th><th>Team</th><th>Started</th><th>Left</th><th>Time with us</th><th class="n">Slack, last year</th><th></th></tr></thead><tbody>' + body + '</tbody></table>' : '<p class="w181empty">Nobody matches.</p>') +
      '<p class="w181note">' + plural(rows.length, 'person', 'people') + '. Click a person for their Slack accounts, to link an account to the roster, or to mark it as not a team member.</p></div>';
  }
  function repaintPeople() {
    var c = document.getElementById('w181people'); if (!c) return paint();
    var d = document.createElement('div'); d.innerHTML = peopleCard(); c.replaceWith(d.firstChild);
  }
