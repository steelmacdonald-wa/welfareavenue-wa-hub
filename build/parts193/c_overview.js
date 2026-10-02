
  /* ---------- the page frame: one panel (#fund), sections by address ---------- */
  var SECT = {
    overview: ['Fundraising', 'Where the money comes from: events, donors and grants, with what is due next.'],
    calendar: ['Fundraising calendar', 'Events, grant deadlines, reports and next actions, month by month.'],
    donors: ['Donor program', 'Monthly givers: the goals, the tiers, the stewardship rhythm and how giving is going.'],
    sops: ['Event SOPs', 'How we run each fundraising event, step by step, with the lessons from last time.'],
    grants: ['Grants', 'The pipeline, what the scanner found, the funders, the writer, the playbook and the fact base.']
  };
  var GVIEW = { pipeline: ['Grants', 'Every opportunity and application, by stage: what is open, what is due, who owns it.'], found: ['Found for you', 'What the scanner found since the last run: keep what fits, dismiss the rest.'], funders: ['Funders', 'Every funder we know: the watchlist, the ones we applied to, the ones screened out.'], write: ['Grant writer', 'Drafts a funder’s questions from our fact base and past applications; you edit, review and export.'], playbook: ['How we win grants', 'The approach: the fit screen, the proposal, the budget, the writing rules and the pipeline discipline.'], facts: ['Fact base', 'Welfare Avenue in its own words, each fact with its source and whether it is verified. The writer drafts from these.'] };
  function mast(title, blurb) {
    var sec = document.getElementById('fund'); if (!sec) return;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w193', '1'); sec.insertBefore(m, sec.firstChild); }
    var html = '<div class="crumb">Fundraising</div><h1>' + E(title) + '</h1><p>' + E(blurb) + '</p>';
    if (m.getAttribute('data-h') !== html) { m.innerHTML = html; m.setAttribute('data-h', html); }
  }
  function host() {
    var sec = document.getElementById('fund'); if (!sec) return null;
    var t = F.sec === 'grants' ? GVIEW[F.view] || GVIEW.pipeline : SECT[F.sec] || SECT.overview;
    mast(t[0], t[1]);
    try { document.title = t[0] + ' · Welfare Avenue Hub'; } catch (e) { /* fine */ }
    var h = document.getElementById('w193host');
    if (!h) { h = document.createElement('div'); h.id = 'w193host'; sec.appendChild(h); }
    return h;
  }
  function onFund() { var a = document.querySelector('.panel.active'); return !!(a && a.id === 'fund'); }
  function go(h) { closeSheet(); if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
  function gTabs() {
    var waiting = F.finds.filter(function (x) { return x.status === 'new'; }).length;
    var T = [['pipeline', 'Pipeline', '#fund/grants'], ['found', 'Found for you', '#fund/grants/found'], ['funders', 'Funders', '#fund/grants/funders'], ['write', 'Writer', '#fund/grants/write'], ['playbook', 'Playbook', '#fund/grants/playbook'], ['facts', 'Fact base', '#fund/grants/facts']];
    return '<div class="w193tabs">' + T.map(function (t) { return '<a data-w193go="' + t[2] + '" class="' + (F.view === t[0] ? 'on' : '') + '">' + E(t[1]) + (t[0] === 'found' && waiting ? ' <span class="n">(' + waiting + ')</span>' : '') + '</a>'; }).join('') + '</div>';
  }
  function fitClass(n) { n = Number(n); if (!isFinite(n) || n <= 0) return ''; return n >= 70 ? 'go' : n >= 55 ? 'maybe' : 'no'; }
  function fitHtml(n, title) { n = Number(n); if (!isFinite(n) || n <= 0) return ''; return '<span class="w193fit ' + fitClass(n) + '" title="' + E(title || 'Fit score') + '">' + n + '</span>'; }
  function stagePill(st) { var s = STAGE[st] || { l: st }; return '<span class="w193pill" data-st="' + E(st) + '" title="' + E(s.d || '') + '">' + E(s.l) + '</span>'; }
  function dueHtml(s, label) { if (!s) return ''; return '<span class="w193due ' + dueClass(s) + '">' + E((label ? label + ' ' : '') + fmtDate(s, { month: 'short', day: 'numeric' })) + ' <small>(' + E(dueText(s)) + ')</small></span>'; }
  function amountText(g) { if (g.amount_awarded != null && g.amount_awarded !== '') return money(g.amount_awarded) + ' awarded'; if (g.amount_ask != null && g.amount_ask !== '') return money(g.amount_ask); var f = funderOf(g); if (f && (f.amount_max || f.amount_min)) return (f.amount_min && f.amount_max ? kMoney(f.amount_min) + ' to ' + kMoney(f.amount_max) : 'up to ' + kMoney(f.amount_max || f.amount_min)); return ''; }
  function grantTitle(g) { var f = funderName(g), t = g.title || g.program || ''; if (!f) return t; if (!t || lower(t) === lower(f)) return f; return f + ': ' + t; }

  /* ---------- what is due: grants and events with a date, soonest first ---------- */
  function dueItems(days) {
    var t = today(), out = [];
    F.grants.forEach(function (g) {
      if (ACTIVE.indexOf(g.stage) < 0 && g.stage !== 'watching') return;
      if (g.deadline && OPEN.concat(['watching']).indexOf(g.stage) >= 0) out.push({ k: 'deadline', day: g.deadline, t: grantTitle(g), s: 'Deadline' + (g.deadline_note ? ' · ' + g.deadline_note : ''), h: '#fund/grants/' + g.id, g: g });
      if (g.report_due && ['awarded', 'reporting'].indexOf(g.stage) >= 0) out.push({ k: 'report', day: g.report_due, t: grantTitle(g), s: 'Report due', h: '#fund/grants/' + g.id, g: g });
      if (g.renewal_due) out.push({ k: 'report', day: g.renewal_due, t: grantTitle(g), s: 'Renewal', h: '#fund/grants/' + g.id, g: g });
      if (g.next_action_due && OPEN.concat(['watching', 'awarded', 'reporting']).indexOf(g.stage) >= 0) out.push({ k: 'action', day: g.next_action_due, t: g.next_action || 'Next step', s: grantTitle(g), h: '#fund/grants/' + g.id, g: g });
    });
    F.events.forEach(function (f) {
      if (!f.start_date || f.status === 'cancelled' || f.status === 'done') return;
      out.push({ k: 'event', day: f.start_date, t: f.title, s: 'Event' + (f.partners ? ' · ' + f.partners : ''), h: '#fundevents/' + f.id, f: f });
    });
    out = out.filter(function (x) { var n = daysUntil(x.day); return n !== null && n >= -14 && (days == null || n <= days); });
    out.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
    return out;
  }
  var LAYERC = { event: ['Events', ORANGE, 'rgba(200,122,47,.16)', '#8a4d12'], deadline: ['Grant deadlines', GREEN, 'rgba(16,63,57,.12)', GREEN], report: ['Reports and renewals', PURPLE, 'rgba(111,100,171,.16)', '#4a4180'], action: ['Next actions', TEAL, 'rgba(42,140,122,.16)', '#1d6b5d'] };

  /* ---------- the overview ---------- */
  function fyAwarded() { var s = ymd(fyStart()); return F.grants.filter(function (g) { return ['awarded', 'reporting', 'closed'].indexOf(g.stage) >= 0 && g.amount_awarded && (g.decided_on || '') >= s; }).reduce(function (a, g) { return a + Number(g.amount_awarded || 0); }, 0); }
  function fyEvents() { var s = fyStart(), e = mk(s.getFullYear() + 1, 9, 1); return F.events.filter(function (f) { var d = parseDay(f.start_date); return d && d >= s && d < e; }); }
  function overviewHtml() {
    var open = F.grants.filter(function (g) { return OPEN.indexOf(g.stage) >= 0; });
    var ask = open.reduce(function (a, g) { return a + Number(g.amount_ask || 0); }, 0);
    var sub = F.grants.filter(function (g) { return g.stage === 'submitted'; });
    var due = dueItems(30);
    var waiting = F.finds.filter(function (x) { return x.status === 'new'; });
    var awarded = fyAwarded();
    var ev = fyEvents(), raised = ev.reduce(function (a, f) { return a + Number(f.raised || 0); }, 0);
    var goals = F.goals || {}, G = F.giving || {};
    var sc = setting('scanner') || {}, last = sc.last_run, lastRun = F.runs[0] || null;
    var html = '<div class="w193kpis">'
      + '<a class="w193kpi" data-w193go="#fund/grants"><small>Open grants</small><b>' + open.length + '</b><span>' + (ask ? E(kMoney(ask)) + ' asked' : 'in the pipeline') + (sub.length ? ' · ' + sub.length + ' submitted' : '') + '</span></a>'
      + '<a class="w193kpi" data-w193go="#fund/calendar"><small>Due in 30 days</small><b class="' + (due.some(function (x) { return daysUntil(x.day) < 0; }) ? 'flag' : '') + '">' + due.length + '</b><span>deadlines, reports, actions and events</span></a>'
      + '<a class="w193kpi" data-w193go="#fund/grants/found"><small>Found for you</small><b class="orange">' + waiting.length + '</b><span>' + (waiting.length ? 'waiting for a keep or dismiss' : last ? 'nothing new; last scan ' + E(fmtWhen(last.at)) : 'the scanner has not run yet') + '</span></a>'
      + '<a class="w193kpi" data-w193go="#fund/grants"><small>Grants won, FY ' + E(fyLabel()) + '</small><b>' + E(awarded ? money(awarded) : '$0') + '</b><span>' + (F.grants.filter(function (g) { return g.stage === 'reporting'; }).length ? F.grants.filter(function (g) { return g.stage === 'reporting'; }).length + ' active with reports due' : 'cash grants awarded this year') + '</span></a>'
      + '<a class="w193kpi" data-w193go="#fundevents"><small>Events, FY ' + E(fyLabel()) + '</small><b>' + E(money(raised)) + '</b><span>of the ' + E(kMoney(goals.target || 20000)) + ' target · ' + ev.filter(function (f) { return f.status !== 'cancelled' && f.status !== 'idea'; }).length + ' planned</span></a>'
      + '<a class="w193kpi" data-w193go="#fund/donors"><small>Monthly donors</small><b>' + (G.monthly_active != null ? G.monthly_active : '–') + '</b><span>' + (G.monthly_amount ? E(money(G.monthly_amount)) + ' a month · ' : '') + 'goal ' + ((setting('donor_program') || {}).goals || {}).monthly_donors + '</span></a>'
      + '</div>';
    html += '<div class="w193hero"><div class="w193card"><h3>Up next<span class="sp"></span><span class="lnk" data-w193go="#fund/calendar">the calendar</span></h3>'
      + (due.length ? '<ul class="w193list">' + due.slice(0, 9).map(function (x) { var L = LAYERC[x.k]; return '<li data-w193go="' + E(x.h) + '"><span class="w193tag" style="--bg:' + L[2] + ';--ink:' + L[3] + '">' + E(L[0].replace(/s$/, '').replace('Reports and renewal', x.s === 'Renewal' ? 'Renewal' : 'Report')) + '</span><div class="t"><b>' + E(x.t) + '</b><small>' + E(x.s) + '</small></div>' + dueHtml(x.day) + '</li>'; }).join('') + '</ul>' : '<p class="w193empty">Nothing dated in the next 30 days. Add deadlines and next actions on the grants, and the events keep their dates.</p>')
      + '</div><div class="w193stack"><div class="w193card"><h3>Where the grants stand</h3><div style="display:flex;gap:8px;flex-wrap:wrap">'
      + STAGES.filter(function (s) { return F.grants.some(function (g) { return g.stage === s[0]; }); }).map(function (s) { var n = F.grants.filter(function (g) { return g.stage === s[0]; }).length; return '<a class="w193chip off" data-w193go="#fund/grants" data-w193grp="' + stageGroup(s[0]) + '" title="' + E(s[2]) + '">' + E(s[1]) + ' <span class="n">' + n + '</span></a>'; }).join('')
      + '</div><p class="w193note">' + E(F.funders.filter(function (f) { return f.watch && !f.screened_out; }).length) + ' funders on the watchlist, ' + E(F.funders.filter(function (f) { return f.screened_out; }).length) + ' screened out, ' + E(F.docs.length) + ' past applications and letters on file.</p></div>'
      + '<div class="w193card"><h3>The scanner<span class="sp"></span>' + (canEdit() ? '<a class="w193btn ghost sm" data-w193scan="1"' + (F.scanBusy || (lastRun && lastRun.status === 'running') ? ' disabled' : '') + '>' + I('refresh') + (lastRun && lastRun.status === 'running' ? 'Scanning…' : 'Scan now') + '</a>' : '') + '</h3>'
      + (lastRun ? '<p class="w193p" style="font-size:13.5px">' + (lastRun.status === 'running' ? 'A scan is running (started ' + E(fmtWhen(lastRun.started_at)) + ').' : 'Last run ' + E(fmtWhen(lastRun.finished_at || lastRun.started_at)) + ': ' + E(lastRun.summary || lastRun.status)) + '</p>' : '<p class="w193p" style="font-size:13.5px">No run yet.</p>')
      + '<p class="w193note">Every Monday at 9:30 (Toronto) it re-reads ' + E(F.sources.filter(function (s) { return s.active && s.kind !== 'search'; }).length) + ' funder pages and runs ' + E(F.sources.filter(function (s) { return s.active && s.kind === 'search'; }).length) + ' web searches; new finds land in Found for you and are posted to #' + E(sc.slack_channel_name || 'grants') + '.</p></div></div></div>';
    html += '<div class="w193card"><h3>In the app</h3><div class="w193quick">'
      + [['#fund/grants', 'list', 'Pipeline', 'the grants by stage'], ['#fund/grants/found', 'search', 'Found for you', waiting.length ? waiting.length + ' waiting' : 'the scanner’s finds'], ['#fund/grants/write', 'pen', 'Grant writer', 'draft answers from the fact base'], ['#fund/grants/playbook', 'book', 'How we win grants', 'the approach, in one page'], ['#fund/grants/funders', 'db', 'Funders', F.funders.length + ' known'], ['#fund/grants/facts', 'star', 'Fact base', F.facts.length + ' facts'], ['#fundevents', 'heart', 'Events', 'the year’s plan, season by season'], ['#fund/calendar', 'cal', 'Calendar', 'everything with a date'], ['#fund/donors', 'people', 'Donor program', 'monthly giving'], ['#fund/sops', 'clip', 'Event SOPs', F.sops.length + ' on file']].map(function (q) { return '<a data-w193go="' + q[0] + '">' + I(q[1]) + '<span>' + E(q[2]) + '<small>' + E(q[3]) + '</small></span></a>'; }).join('')
      + '</div></div>';
    if (F.recent && F.recent.length) {
      html += '<div class="w193card" style="margin-top:14px"><h3>Recently on the grants</h3><ul class="w193list w193log">' + F.recent.slice(0, 8).map(function (l) { var g = byId(F.grants, l.grant_id); return '<li data-w193go="#fund/grants/' + l.grant_id + '"><span class="k">' + E(l.kind) + '</span><div class="t"><b>' + E(g ? grantTitle(g) : 'Grant ' + l.grant_id) + '</b><small>' + E(clip(l.text, 160)) + (l.who ? ' · ' + E(l.who.split('@')[0]) : '') + '</small></div><span class="when">' + E(fmtWhen(l.at)) + '</span></li>'; }).join('') + '</ul></div>';
    }
    return html;
  }
