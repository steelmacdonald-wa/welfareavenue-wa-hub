
  /* ---------- the pipeline (#fund/grants[/<id>]) ---------- */
  function matches(g, qq) {
    if (!qq) return true;
    var f = funderOf(g) || {};
    var hay = fold([grantTitle(g), g.program, g.title, f.name, (f.aliases || []).join(' '), g.owner_name, g.owner_email, g.partner, g.program_area, g.next_action, g.notes, g.stage].join(' '));
    return qq.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function grantSort(a, b) {
    var da = a.deadline || a.next_action_due || a.report_due || '9999', dbb = b.deadline || b.next_action_due || b.report_due || '9999';
    if (da !== dbb) return da < dbb ? -1 : 1;
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  }
  function grantRow(g) {
    var f = funderOf(g) || {}, closed = ['declined', 'not_eligible', 'dropped', 'closed'].indexOf(g.stage) >= 0;
    var when = g.stage === 'submitted' ? (g.submitted_on ? '<span class="w193due">submitted ' + E(fmtDate(g.submitted_on, { month: 'short', day: 'numeric' })) + '</span>' : '') : ['awarded', 'reporting'].indexOf(g.stage) >= 0 ? dueHtml(g.report_due, 'report') : closed ? (g.decided_on ? '<span class="w193due">' + E(fmtDate(g.decided_on, { month: 'short', day: 'numeric', year: 'numeric' })) + '</span>' : '') : dueHtml(g.deadline);
    var sub = [KINDS[f.kind] || '', g.program_area || '', g.owner_name || (g.owner_email ? g.owner_email.split('@')[0] : ''), g.partner ? 'with ' + g.partner : ''].filter(Boolean).join(' · ');
    return '<div class="w193row' + (closed ? ' closed' : '') + '" data-w193grant="' + g.id + '" tabindex="0" role="button"><div class="nm"><b>' + E(grantTitle(g)) + '</b><small>' + E(sub || (g.title && g.program ? g.program : '')) + '</small></div>' + stagePill(g.stage) + '<div>' + when + '</div><div class="amt">' + E(amountText(g)) + '</div><div class="nx">' + (g.next_action ? '<b>' + E(g.next_action) + '</b>' + (g.next_action_due ? ' · ' + E(dueText(g.next_action_due)) : '') : (g.decision_note && closed ? E(clip(g.decision_note, 60)) : '')) + '</div><div>' + fitHtml(g.fit_score) + '</div></div>';
  }
  function pipelineHtml() {
    var FL = F.filters, qq = fold(FL.q);
    var grp = GROUPS.filter(function (x) { return x[0] === FL.group; })[0];
    var stages = FL.group === 'all' ? STAGES.map(function (s) { return s[0]; }) : grp ? grp[2] : OPEN;
    var list = F.grants.filter(function (g) { return stages.indexOf(g.stage) >= 0 && matches(g, qq) && (!FL.region || (funderOf(g) || {}).region === FL.region) && (!FL.owner || lower(g.owner_email) === FL.owner); });
    var owners = uniq(F.grants.map(function (g) { return lower(g.owner_email); }));
    var html = gTabs() + '<div class="w193bar"><div class="w193seg">' + GROUPS.concat([['all', 'All', []]]).map(function (x) { var n = x[0] === 'all' ? F.grants.length : F.grants.filter(function (g) { return x[2].indexOf(g.stage) >= 0; }).length; return '<a data-w193grp="' + x[0] + '" class="' + (FL.group === x[0] ? 'on' : '') + '">' + E(x[1]) + ' <span class="n">' + n + '</span></a>'; }).join('') + '</div>'
      + '<input type="search" placeholder="Search the grants: funder, program, owner, partner…" value="' + E(FL.q) + '" data-w193q="1" aria-label="Search the grants">'
      + '<select data-w193region="1" aria-label="Region"><option value="">Every region</option>' + Object.keys(REGIONS).map(function (k) { return '<option value="' + k + '"' + (FL.region === k ? ' selected' : '') + '>' + E(REGIONS[k]) + '</option>'; }).join('') + '</select>'
      + (owners.length > 1 ? '<select data-w193owner="1" aria-label="Owner"><option value="">Every owner</option>' + owners.map(function (o) { var g = F.grants.filter(function (x) { return lower(x.owner_email) === o; })[0]; return '<option value="' + E(o) + '"' + (FL.owner === o ? ' selected' : '') + '>' + E(g.owner_name || o.split('@')[0]) + '</option>'; }).join('') + '</select>' : '')
      + '<span class="sp"></span>' + (canEdit() ? '<a class="w193btn sm" data-w193gadd="1">' + I('plus') + 'Add a grant</a>' : '') + '</div>';
    if (!list.length) return html + '<div class="w193card"><p class="w193empty">' + (qq || FL.region || FL.owner ? 'Nothing matches that search.' : FL.group === 'open' ? 'Nothing open right now. The watchlist holds the next cycles; Found for you has the scanner’s finds.' : 'Nothing here yet.') + '</p></div>';
    var byStage = {}; list.forEach(function (g) { (byStage[g.stage] = byStage[g.stage] || []).push(g); });
    STAGES.forEach(function (s) {
      var rows = byStage[s[0]]; if (!rows || !rows.length) return;
      rows.sort(grantSort);
      var ask = rows.reduce(function (a, g) { return a + Number(g.amount_ask || 0); }, 0), won = rows.reduce(function (a, g) { return a + Number(g.amount_awarded || 0); }, 0);
      html += '<div class="w193stage"><h3>' + E(s[1]) + '</h3><span>' + rows.length + (s[0] === 'awarded' || s[0] === 'reporting' || s[0] === 'closed' ? (won ? ' · ' + E(money(won)) + ' awarded' : '') : (ask ? ' · ' + E(kMoney(ask)) + ' asked' : '')) + ' · ' + E(s[2]) + '</span></div><div class="w193rows">' + rows.map(grantRow).join('') + '</div>';
    });
    return html;
  }

  /* ---------- found for you (#fund/grants/found) ---------- */
  function findCard(x) {
    var mf = x.matched_funder_id ? byId(F.funders, x.matched_funder_id) : null, done = x.status !== 'new';
    var meta = [];
    if (x.amount_min || x.amount_max) meta.push('<b>' + E(x.amount_min && x.amount_max ? kMoney(x.amount_min) + ' to ' + kMoney(x.amount_max) : 'up to ' + kMoney(x.amount_max || x.amount_min)) + '</b>');
    if (x.deadline) meta.push('deadline <b>' + E(fmtDate(x.deadline)) + '</b> (' + E(dueText(x.deadline)) + ')'); else if (x.deadline_text) meta.push(E(x.deadline_text));
    if (x.region) meta.push(E(REGIONS[x.region] || x.region));
    if (x.kind) meta.push(E(KINDS[x.kind] || x.kind));
    var src = x.raw && x.raw.source_id ? byId(F.sources, x.raw.source_id) : null;
    return '<div class="w193find' + (done ? ' done' : '') + '" data-w193find="' + x.id + '"><div class="hd">' + fitHtml(x.fit_score, x.fit_note || 'Fit score') + (mf ? '<span class="w193tag" title="Already in Funders">' + I('db') + E(clip(mf.name, 28)) + '</span>' : '<span class="w193tag" style="--bg:rgba(200,122,47,.14);--ink:#8a4d12">New funder</span>') + (done ? '<span class="w193pill" data-st="' + E(x.status) + '">' + E(x.status) + '</span>' : '') + '<span class="sp"></span><span class="w193due">' + E(fmtWhen(x.created_at)) + '</span></div>'
      + '<h4>' + E(x.funder_name) + '<small>' + E(x.program || '') + '</small></h4>'
      + (x.summary ? '<p>' + E(x.summary) + '</p>' : '')
      + (meta.length ? '<div class="meta">' + meta.join('<span>·</span>') + '</div>' : '')
      + (x.eligibility ? '<p class="w193note" style="margin:0"><b>Eligibility:</b> ' + E(clip(x.eligibility, 240)) + '</p>' : '')
      + (x.fit_note ? '<p class="w193note" style="margin:0"><b>Why ' + E(x.fit_score) + ':</b> ' + E(x.fit_note) + '</p>' : '')
      + '<div class="meta">' + (x.url && safeUrl(x.url) ? '<a class="w193lnk" href="' + E(x.url) + '" target="_blank" rel="noopener">' + I('ext') + ' The call</a>' : '') + (src ? '<span>from ' + E(src.name) + '</span>' : '') + (x.decision_note ? '<span>' + E(x.decision_note) + '</span>' : '') + '</div>'
      + (!done && canEdit() ? '<div class="acts"><a class="w193btn sm" data-w193keep="' + x.id + '">' + I('check') + 'Keep</a><a class="w193btn ghost sm" data-w193dismiss="' + x.id + '">Dismiss</a><a class="w193btn warn sm" data-w193screen="' + x.id + '" title="Dismiss, and stop proposing this funder">Not for us</a></div><div class="w193dform" data-w193dform="' + x.id + '" style="display:none"><textarea class="w193reason" placeholder="Why (optional, kept with the decision)" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:13px;padding:8px 10px;border:1px solid rgba(16,63,57,.18);border-radius:10px;min-height:60px"></textarea><div class="acts"><a class="w193btn sm" data-w193dgo="' + x.id + '">Confirm</a><a class="w193btn ghost sm" data-w193dcancel="' + x.id + '">Cancel</a></div></div>' : '') + '</div>';
  }
  function foundHtml() {
    var fresh = F.finds.filter(function (x) { return x.status === 'new'; }).sort(function (a, b) { return Number(b.fit_score || 0) - Number(a.fit_score || 0); });
    var older = F.finds.filter(function (x) { return x.status !== 'new'; }).slice(0, 60);
    var lastRun = F.runs[0] || null, running = lastRun && lastRun.status === 'running';
    var html = gTabs() + '<div class="w193bar"><span class="w193empty">' + (fresh.length ? fresh.length + ' find' + (fresh.length === 1 ? '' : 's') + ' waiting. Keep puts the grant in the pipeline at Found; Not for us also stops the scanner proposing the funder.' : 'Nothing waiting. New finds land here after every scan' + (lastRun && !running ? '; the last one ran ' + E(fmtWhen(lastRun.finished_at || lastRun.started_at)) : '') + '.') + '</span><span class="sp"></span>'
      + '<a class="w193chip' + (F.foundAll ? ' on' : ' off') + '" data-w193foundall="1">Show decided and known</a>'
      + (canEdit() ? '<a class="w193btn sm" data-w193scan="1"' + (F.scanBusy || running ? ' disabled' : '') + '>' + I('refresh') + (running ? 'Scanning…' : 'Scan now') + '</a>' : '') + '</div>';
    if (running) html += '<div class="w193card" style="margin-bottom:14px"><p class="w193empty">' + I('clock') + ' A scan is running (started ' + E(fmtWhen(lastRun.started_at)) + ', step ' + E(lastRun.steps || 1) + '). It reads the funder pages first, then runs the web searches; a few minutes. This page refreshes itself.</p></div>';
    html += fresh.length ? '<div class="w193finds">' + fresh.map(findCard).join('') + '</div>' : '<div class="w193card"><p class="w193empty">The watchlist (' + F.sources.filter(function (s) { return s.active && s.kind !== 'search'; }).length + ' pages) and the ' + F.sources.filter(function (s) { return s.active && s.kind === 'search'; }).length + ' web searches run every Monday morning; Scan now runs them today.</p></div>';
    if (F.foundAll && older.length) html += '<div class="w193stage"><h3>Decided and known</h3><span>the last ' + older.length + '</span></div><div class="w193finds">' + older.map(findCard).join('') + '</div>';
    html += '<div class="w193card" style="margin-top:16px"><h3>The runs</h3>' + (F.runs.length ? '<ul class="w193list w193runs">' + F.runs.map(function (r) { return '<li><span class="w193pill" data-st="' + (r.status === 'ok' ? 'awarded' : r.status === 'running' ? 'drafting' : r.status === 'partial' ? 'screened' : 'declined') + '">' + E(r.status) + '</span><div class="t"><b>' + E(r.summary || (r.status === 'running' ? 'Running…' : r.status)) + '</b><small>' + E(r.trigger === 'schedule' ? 'the Monday schedule' : r.trigger === 'test' ? 'a test' : (r.by_email ? r.by_email.split('@')[0] : 'a person')) + (r.cost ? ' · $' + Number(r.cost).toFixed(2) + ' in model calls' : '') + (r.slack_ts ? ' · posted to Slack' : '') + (r.errors && r.errors.length ? ' · ' + r.errors.length + ' problem' + (r.errors.length > 1 ? 's' : '') + (isAdmin() ? ': ' + E(r.errors.slice(0, 3).map(function (e) { return e.where + ' (' + clip(e.error, 60) + ')'; }).join('; ')) : '') : '') + '</small></div><span class="when">' + E(fmtWhen(r.started_at)) + '</span></li>'; }).join('') + '</ul>' : '<p class="w193empty">No run yet.</p>') + '</div>';
    return html;
  }
  async function scanNow() {
    if (F.scanBusy) return;
    F.scanBusy = true; paint();
    var r = await fn('grant-scan', { action: 'scan', trigger: 'person' });
    F.scanBusy = false;
    if (!r || r.ok === false || r.error) { toastS(r && r.error ? r.error : 'The scan could not start.'); paint(); return; }
    toastS('Scanning: the funder pages first, then the web searches. A few minutes.');
    await loadAll(true); paint();
    watchRun();
  }
  var runT = null;
  function watchRun() {
    clearTimeout(runT);
    runT = setTimeout(async function () {
      await loadAll(true);
      var lastRun = F.runs[0];
      if (onFund()) paint();
      if (lastRun && lastRun.status === 'running' && onFund()) watchRun();
      else if (lastRun && lastRun.status !== 'running') toastS('The scan finished: ' + (lastRun.summary || lastRun.status));
    }, 15000);
  }
  async function decideFind(id, action, note) {
    var r = await q(db.rpc('fund_find_decide', { p_find: Number(id), p_action: action, p_note: note || null }));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    await loadAll(true);
    if (action === 'keep' && r.data) { toastS('Kept: it is in the pipeline at Found.'); go('#fund/grants/' + r.data); return; }
    toastS(action === 'screen_out' ? 'Dismissed, and the funder will not be proposed again.' : 'Dismissed.');
    paint();
  }

  /* ---------- the funders (#fund/grants/funders[/<id>]) ---------- */
  function funderRow(f) {
    var gs = F.grants.filter(function (g) { return g.funder_id === f.id; }), open = gs.filter(function (g) { return OPEN.indexOf(g.stage) >= 0; }).length;
    var fit = FIT[f.fit] || FIT.unknown;
    return '<div class="w193frow' + (f.screened_out ? ' out' : '') + '" data-w193funder="' + f.id + '" tabindex="0" role="button"><div class="nm"><b>' + E(f.name) + '</b><small>' + E([f.funds_what ? clip(f.funds_what, 90) : '', f.aliases && f.aliases.length ? 'also ' + f.aliases.slice(0, 2).join(', ') : ''].filter(Boolean).join(' · ')) + '</small></div><div class="kd">' + E(KINDS[f.kind] || f.kind) + '<br><small>' + E(REGIONS[f.region] || f.region) + '</small></div><div>' + (f.screened_out ? '<span class="w193pill" data-st="not_eligible" title="' + E(f.screened_reason || '') + '">Screened out</span>' : '<span class="w193tag" style="--bg:' + fit[1] + ';--ink:' + fit[2] + '" title="' + E(f.fit_note || '') + '">' + E(fit[0]) + '</span>') + '</div><div>' + (f.watch && !f.screened_out ? '<span class="w193tag">' + I('search') + 'watched</span>' : '') + '</div><div class="cy">' + E(f.next_deadline ? 'next ' + fmtDate(f.next_deadline, { month: 'short', day: 'numeric', year: 'numeric' }) : (f.cycle || '')) + (gs.length ? '<br><small>' + gs.length + ' grant' + (gs.length > 1 ? 's' : '') + (open ? ', ' + open + ' open' : '') + '</small>' : '') + '</div></div>';
  }
  function fundersHtml() {
    var FL = F.filters, qq = fold(FL.q);
    var list = F.funders.filter(function (f) {
      if (FL.watch === 'watch' && (!f.watch || f.screened_out)) return false;
      if (FL.watch === 'out' && !f.screened_out) return false;
      if (FL.watch === 'applied' && !F.grants.some(function (g) { return g.funder_id === f.id && ['drafting', 'submitted', 'awarded', 'declined', 'not_eligible', 'reporting', 'closed'].indexOf(g.stage) >= 0; })) return false;
      if (FL.watch === '' && f.screened_out && !qq) return false;
      if (FL.fkind && f.kind !== FL.fkind) return false;
      if (FL.region && f.region !== FL.region) return false;
      if (FL.fit && f.fit !== FL.fit) return false;
      if (qq) { var hay = fold([f.name, (f.aliases || []).join(' '), f.funds_what, f.eligibility, f.notes, f.relationship, f.contact].join(' ')); if (!qq.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) return false; }
      return true;
    }).sort(function (a, b) { var o = { good: 0, possible: 1, unknown: 2, weak: 3 }; return (a.screened_out ? 1 : 0) - (b.screened_out ? 1 : 0) || o[a.fit] - o[b.fit] || String(a.name).localeCompare(String(b.name)); });
    var html = gTabs() + '<div class="w193bar"><div class="w193seg">' + [['', 'Active'], ['watch', 'Watchlist'], ['applied', 'Applied to'], ['out', 'Screened out']].map(function (x) { return '<a data-w193watch="' + x[0] + '" class="' + (FL.watch === x[0] ? 'on' : '') + '">' + E(x[1]) + '</a>'; }).join('') + '</div>'
      + '<input type="search" placeholder="Search the funders…" value="' + E(FL.q) + '" data-w193q="1" aria-label="Search the funders">'
      + '<select data-w193fkind="1" aria-label="Kind"><option value="">Every kind</option>' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (FL.fkind === k ? ' selected' : '') + '>' + E(KINDS[k]) + '</option>'; }).join('') + '</select>'
      + '<select data-w193region="1" aria-label="Region"><option value="">Every region</option>' + Object.keys(REGIONS).map(function (k) { return '<option value="' + k + '"' + (FL.region === k ? ' selected' : '') + '>' + E(REGIONS[k]) + '</option>'; }).join('') + '</select>'
      + '<select data-w193fit="1" aria-label="Fit"><option value="">Any fit</option>' + Object.keys(FIT).map(function (k) { return '<option value="' + k + '"' + (FL.fit === k ? ' selected' : '') + '>' + E(FIT[k][0]) + '</option>'; }).join('') + '</select>'
      + '<span class="sp"></span>' + (canEdit() ? '<a class="w193btn sm" data-w193fadd="1">' + I('plus') + 'Add a funder</a>' : '') + '</div>';
    html += '<p class="w193note" style="margin:0 0 10px">' + list.length + ' of ' + F.funders.length + ' funders' + (FL.watch === '' ? ' (screened-out funders are under their own tab)' : '') + '.</p>';
    html += list.length ? '<div class="w193rows">' + list.map(funderRow).join('') + '</div>' : '<div class="w193card"><p class="w193empty">Nothing matches.</p></div>';
    return html;
  }
