
  /* ---------- the side sheet: a grant, a funder, a document, and the forms ---------- */
  function sheetEl() {
    var s = document.getElementById('w193sheet');
    if (!s) {
      var sc = document.createElement('div'); sc.className = 'w193scrim'; sc.id = 'w193scrim'; sc.setAttribute('data-w193close', '1'); document.body.appendChild(sc);
      s = document.createElement('div'); s.id = 'w193sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); document.body.appendChild(s);
    }
    return s;
  }
  function showSheet(title, sub, body) {
    var s = sheetEl(), sc = document.getElementById('w193scrim');
    s.innerHTML = '<div class="hd"><h2>' + title + (sub ? '<small>' + sub + '</small>' : '') + '</h2><button type="button" class="x" data-w193close="1" aria-label="Close">' + I('x') + '</button></div><div class="bd">' + body + '</div>';
    s.classList.add('open'); if (sc) sc.classList.add('open');
    F.open = true;
    try { var f = s.querySelector('input,select,textarea,button:not(.x)'); if (f && window.innerWidth > 900) f.focus(); } catch (e) { /* fine */ }
  }
  function closeSheet() {
    var s = document.getElementById('w193sheet'), sc = document.getElementById('w193scrim');
    if (s) s.classList.remove('open'); if (sc) sc.classList.remove('open');
    F.open = null; F.sheet = null;
    if (/^#fund\/grants\/\d+$/.test(location.hash) || /^#fund\/grants\/funders\/\d+$/.test(location.hash)) { try { history.replaceState(null, '', location.hash.replace(/\/\d+$/, '')); } catch (e) { /* fine */ } F.sub = ''; }
  }
  function kv(rows) { return '<div class="w193kv">' + rows.filter(function (r) { return r[1] !== '' && r[1] != null; }).map(function (r) { return '<small>' + E(r[0]) + '</small><div>' + (r[2] ? r[1] : E(r[1])) + '</div>'; }).join('') + '</div>'; }
  function linkHtml(l) { var u = safeUrl(l.url || l); if (!u) return ''; return '<a class="w193lnk" href="' + E(u) + '" target="_blank" rel="noopener">' + I('ext') + ' ' + E(l.label || u.replace(/^https?:\/\//, '').slice(0, 60)) + '</a>'; }
  function gateIcon(r) { return r === 'pass' ? '<span class="ok">' + I('check') + '</span>' : r === 'fail' ? '<span class="no">' + I('x') + '</span>' : '<span class="unk">' + I('warn') + '</span>'; }
  function fitSection(g) {
    var fit = g.fit || {}, gates = Array.isArray(g.gates) ? g.gates : [], dims = Array.isArray(fit.dimensions) ? fit.dimensions : [];
    var html = '<div class="w193sec"><h4>The fit' + (g.fit_score ? ' <span class="w193fit ' + fitClass(g.fit_score) + '">' + g.fit_score + '</span>' + (fit.verdict ? ' <span class="w193pill" data-st="' + (fit.verdict === 'go' ? 'awarded' : fit.verdict === 'conditional' ? 'screened' : 'declined') + '">' + E(fit.verdict) + '</span>' : '') : '') + '<span class="sp"></span>' + (canEdit() ? '<a class="w193btn ghost sm" data-w193fit="' + g.id + '"' + (F.busy.fit ? ' disabled' : '') + '>' + I('target') + (F.busy.fit ? 'Scoring…' : g.fit_score ? 'Score it again' : 'Score the fit') + '</a>' : '') + '</h4>';
    if (!g.fit_score && !gates.length) html += '<p class="w193empty">Not scored yet. Score the fit runs the playbook’s screen: the hard gates, then eligibility, alignment, geography, amount, capacity, relationship and odds (70 and up: go; 55 to 69: conditional).</p>';
    if (fit.scanner_note) html += '<p class="w193note" style="margin:0 0 8px"><b>The scanner:</b> ' + E(fit.scanner_note) + '</p>';
    if (gates.length) html += '<ul class="w193gates" style="list-style:none;margin:0 0 8px;padding:0">' + gates.map(function (x) { return '<li>' + gateIcon(x.result) + '<span><b>' + E(x.gate) + '</b>' + (x.note ? ': ' + E(x.note) : '') + '</span></li>'; }).join('') + '</ul>';
    if (dims.length) html += '<div class="w193dims">' + dims.map(function (d) { return '<span>' + E(String(d.name || '').replace(/^\w/, function (c) { return c.toUpperCase(); })) + ' <span style="color:var(--wa-muted)">(' + E(d.weight) + ')</span></span><b>' + E(d.score) + '/5</b>' + (d.note ? '<small>' + E(d.note) + '</small>' : ''); }).join('') + '</div>';
    if (fit.first_step) html += '<p class="w193p" style="margin:8px 0 0;font-size:13.5px"><b>First step:</b> ' + E(fit.first_step) + (fit.hours ? ' <span style="color:var(--wa-muted)">(about ' + E(fit.hours) + ' volunteer hours)</span>' : '') + '</p>';
    if (fit.scored_at) html += '<p class="w193note">Scored ' + E(fmtWhen(fit.scored_at)) + (fit.by ? ' by ' + E(String(fit.by).split('@')[0]) : '') + '.</p>';
    return html + '</div>';
  }
  function grantSheetHtml(g) {
    var f = funderOf(g) || {}, log = F.log[g.id], docs = F.docs.filter(function (d) { return String(d.grant_id) === String(g.id) || (!d.grant_id && d.funder_id && String(d.funder_id) === String(g.funder_id)); }), drafts = F.drafts.filter(function (d) { return String(d.grant_id) === String(g.id); });
    var links = Array.isArray(g.links) ? g.links : [];
    var html = '<div class="w193acts" style="margin:0 0 14px">' + (canEdit() ? '<select data-w193stage="' + g.id + '" aria-label="Stage" style="font-family:inherit;font-size:13px;padding:8px 10px;border:1px solid rgba(16,63,57,.18);border-radius:10px;background:var(--wa-card)">' + STAGES.map(function (s) { return '<option value="' + s[0] + '"' + (g.stage === s[0] ? ' selected' : '') + '>' + E(s[1]) + '</option>'; }).join('') + '</select><a class="w193btn ghost sm" data-w193gedit="' + g.id + '">' + I('pen') + 'Edit</a><a class="w193btn sm" data-w193go="#fund/grants/write/new?grant=' + g.id + '">' + I('pen') + 'Write answers</a>' : '') + '<a class="w193btn ghost sm" data-w193funder="' + g.funder_id + '">' + I('db') + 'The funder</a></div>';
    html += kv([
      ['Funder', f.name || ''], ['Program', g.program], ['Our project', g.title || ''], ['Ask', g.amount_ask != null ? money(g.amount_ask) : (f.amount_min || f.amount_max ? 'They give ' + (f.amount_min && f.amount_max ? kMoney(f.amount_min) + ' to ' + kMoney(f.amount_max) : 'up to ' + kMoney(f.amount_max || f.amount_min)) : '')], ['Awarded', g.amount_awarded != null ? money(g.amount_awarded) : ''],
      ['Deadline', g.deadline ? fmtDate(g.deadline) + ' (' + dueText(g.deadline) + ')' + (g.deadline_note ? ' · ' + g.deadline_note : '') : (g.deadline_note || (f.cycle ? 'Cycle: ' + f.cycle : ''))],
      ['Submitted', g.submitted_on ? fmtDate(g.submitted_on) : ''], ['Decided', g.decided_on ? fmtDate(g.decided_on) + (g.decision_note ? ': ' + g.decision_note : '') : (g.decision_note || '')],
      ['Report due', g.report_due ? fmtDate(g.report_due) + ' (' + dueText(g.report_due) + ')' : ''], ['Renewal', g.renewal_due ? fmtDate(g.renewal_due) : ''],
      ['Next step', g.next_action ? g.next_action + (g.next_action_due ? ' · ' + fmtDate(g.next_action_due) + ' (' + dueText(g.next_action_due) + ')' : '') : ''],
      ['Owner', g.owner_name || g.owner_email || ''], ['Partner', g.partner || ''], ['For', g.program_area || ''], ['Project', g.project_id ? '<a class="w193lnk" data-w193go="#project/' + g.project_id + '">The project board</a>' : '', true], ['Hours spent', g.hours_spent != null ? String(g.hours_spent) : ''], ['Source', [g.source, g.source_ref].filter(Boolean).join(', ')]
    ]);
    if (links.length || f.url || f.portal) html += '<div class="w193sec"><h4>Links</h4><div style="display:flex;flex-direction:column;gap:6px;font-size:13.5px">' + links.map(linkHtml).join('') + (f.url ? linkHtml({ label: f.name + ' (website)', url: f.url }) : '') + (f.portal ? linkHtml({ label: 'The application portal', url: f.portal }) : '') + '</div></div>';
    html += fitSection(g);
    if (f.eligibility || f.funds_what || f.fit_note) html += '<div class="w193sec"><h4>About the funder</h4>' + (f.funds_what ? '<p class="w193p" style="font-size:13.5px"><b>They fund:</b> ' + E(f.funds_what) + '</p>' : '') + (f.eligibility ? '<p class="w193p" style="font-size:13.5px"><b>Eligibility:</b> ' + E(f.eligibility) + '</p>' : '') + (f.fit_note ? '<p class="w193p" style="font-size:13.5px"><b>Fit:</b> ' + E(f.fit_note) + '</p>' : '') + (f.relationship ? '<p class="w193p" style="font-size:13.5px"><b>Our history:</b> ' + E(f.relationship) + '</p>' : '') + '</div>';
    if (g.notes) html += '<div class="w193sec"><h4>Notes</h4><p class="w193p" style="white-space:pre-wrap;font-size:13.5px">' + E(g.notes) + '</p></div>';
    html += '<div class="w193sec"><h4>Applications and letters on file<span class="sp"></span>' + (canEdit() ? '<a class="w193btn ghost sm" data-w193docadd="' + g.id + '">' + I('plus') + 'Add text</a>' : '') + '</h4>' + (docs.length ? '<ul class="w193list">' + docs.map(function (d) { return '<li data-w193doc="' + d.id + '"><div class="t"><b>' + E(d.title) + '</b><small>' + E(d.kind) + (d.doc_date ? ' · ' + E(fmtDate(d.doc_date)) : '') + (d.words ? ' · ' + E(d.words) + ' words' : '') + '</small></div>' + I('chevr') + '</li>'; }).join('') + '</ul>' : '<p class="w193empty">Nothing on file for this grant yet. Add the application text so the writer can learn from it.</p>') + '</div>';
    if (drafts.length) html += '<div class="w193sec"><h4>Drafts</h4><ul class="w193list">' + drafts.map(function (d) { return '<li data-w193go="#fund/grants/write/' + d.id + '"><div class="t"><b>' + E(d.title) + '</b><small>' + E((d.questions || []).length) + ' answers · ' + E(d.status) + '</small></div><span class="when">' + E(fmtWhen(d.updated_at)) + '</span></li>'; }).join('') + '</ul></div>';
    html += '<div class="w193sec"><h4>What happened</h4>' + (canEdit() ? '<form class="w193form" data-w193logform="' + g.id + '" style="margin:0 0 10px"><div class="row" style="grid-template-columns:120px 1fr"><select name="kind"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="report">Report</option></select><input type="text" name="text" placeholder="What happened, in a line" required maxlength="1000"></div><div class="acts" style="margin-top:8px"><button type="submit" class="w193btn sm">Add</button></div></form>' : '')
      + (log === undefined ? '<p class="w193empty">Loading…</p>' : log.length ? '<ul class="w193list w193log">' + log.map(function (l) { return '<li><span class="k">' + E(l.kind) + '</span><div class="t"><span>' + E(l.text) + '</span><small>' + E(fmtWhen(l.at)) + (l.who ? ' · ' + E(String(l.who).split('@')[0]) : '') + '</small></div></li>'; }).join('') + '</ul>' : '<p class="w193empty">Nothing logged yet.</p>') + '</div>';
    if (canDelete()) html += '<div class="w193acts" style="margin-top:18px"><a class="w193btn warn sm" data-w193gdel="' + g.id + '">Delete this grant</a></div>';
    return html;
  }
  async function openGrant(id) {
    var g = byId(F.grants, id); if (!g) { toastS('That grant is not here any more.'); return; }
    F.sheet = { kind: 'grant', id: g.id };
    showSheet(E(grantTitle(g)), (g.title && g.program ? E(g.program) + ' · ' : '') + stagePill(g.stage) + ' ' + fitHtml(g.fit_score), grantSheetHtml(g));
    if (F.log[g.id] === undefined) { await loadLog(g.id); if (F.sheet && F.sheet.kind === 'grant' && String(F.sheet.id) === String(g.id)) refreshSheet(); }
  }
  function refreshSheet() {
    var s = F.sheet; if (!s) return;
    if (s.kind === 'grant') { var g = byId(F.grants, s.id); if (g) { var bd = document.querySelector('#w193sheet .bd'); if (bd) bd.innerHTML = grantSheetHtml(g); var h = document.querySelector('#w193sheet .hd h2'); if (h) h.innerHTML = E(grantTitle(g)) + '<small>' + (g.title && g.program ? E(g.program) + ' · ' : '') + stagePill(g.stage) + ' ' + fitHtml(g.fit_score) + '</small>'; } }
    if (s.kind === 'funder') { var f = byId(F.funders, s.id); if (f) openFunder(f.id); }
  }
  async function setStage(id, stage) {
    var g = byId(F.grants, id); if (!g || g.stage === stage) return;
    var r = await q(db.rpc('fund_grant_stage', { p_grant: Number(id), p_stage: stage, p_note: null }));
    if (r.error) { toastS('Could not move it: ' + (r.error.message || r.error)); refreshSheet(); return; }
    if (stage === 'awarded' && g.amount_awarded == null && g.amount_ask != null) await q(db.from('fund_grants').update({ amount_awarded: g.amount_ask, updated_by: me().email }).eq('id', id));
    await loadAll(true); await loadLog(id);
    toastS('Moved to ' + (STAGE[stage] || {}).l + (['awarded', 'declined', 'not_eligible', 'dropped'].indexOf(stage) >= 0 ? '. Add a line on the decision below.' : '.'));
    if (onFund()) paint(); refreshSheet();
  }
  async function scoreFit(id) {
    if (F.busy.fit) return;
    F.busy.fit = true; refreshSheet();
    var r = await fn('grant-write', { action: 'fit', grant_id: Number(id) });
    F.busy.fit = false;
    if (!r || r.ok === false || r.error) { toastS('The score did not come back: ' + (r && r.error ? r.error : 'try again')); refreshSheet(); return; }
    await loadAll(true); await loadLog(id);
    toastS('Fit ' + r.fit_score + ' (' + (r.fit && r.fit.verdict ? r.fit.verdict : '') + ').');
    if (onFund()) paint(); refreshSheet();
  }
  async function addLog(form) {
    var fd = new FormData(form), id = form.getAttribute('data-w193logform'), text = String(fd.get('text') || '').trim(); if (!text) return;
    var r = await q(db.from('fund_grant_log').insert({ grant_id: Number(id), who: me().email, kind: String(fd.get('kind') || 'note'), text: text }));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    await loadLog(id); await loadAll(true); refreshSheet();
  }
  async function deleteGrant(id) {
    var g = byId(F.grants, id); if (!g) return;
    var ok = true; try { ok = window.confirm('Delete "' + grantTitle(g) + '" and its log? This cannot be undone.'); } catch (e) { ok = true; }
    if (!ok) return;
    var r = await q(db.from('fund_grants').delete().eq('id', id));
    if (r.error) { toastS('Could not delete: ' + (r.error.message || r.error)); return; }
    closeSheet(); await loadAll(true); paint(); toastS('Deleted.');
  }

  /* ---------- a document (the text of a past application) ---------- */
  async function openDocument(id, back) {
    var d = byId(F.docs, id); if (!d) return;
    F.sheet = { kind: 'doc', id: id };
    showSheet(E(d.title), E(d.kind) + (d.doc_date ? ' · ' + E(fmtDate(d.doc_date)) : '') + (d.words ? ' · ' + E(d.words) + ' words' : ''), '<p class="w193empty">Loading…</p>');
    var r = await q(db.from('fund_documents').select('text, source_url, source, created_by').eq('id', id).maybeSingle());
    if (!F.sheet || F.sheet.kind !== 'doc' || String(F.sheet.id) !== String(id)) return;
    var bd = document.querySelector('#w193sheet .bd'); if (!bd) return;
    var t = r.data || {};
    bd.innerHTML = '<div class="w193acts" style="margin:0 0 12px">' + (back ? '<a class="w193btn ghost sm" data-w193grant="' + back + '">' + I('chevl') + 'Back to the grant</a>' : '') + (t.source_url && safeUrl(t.source_url) ? '<a class="w193btn ghost sm" href="' + E(t.source_url) + '" target="_blank" rel="noopener">' + I('ext') + 'The original</a>' : '') + '<a class="w193btn ghost sm" data-w193doccopy="' + id + '">' + I('copy') + 'Copy the text</a>' + (canDelete() ? '<a class="w193btn warn sm" data-w193docdel="' + id + '">Delete</a>' : '') + '</div>'
      + (t.source ? '<p class="w193note" style="margin:0 0 10px">Source: ' + E(t.source) + '</p>' : '')
      + '<div class="w193p" style="white-space:pre-wrap;font-size:13.5px;line-height:1.6" data-w193doctext="1">' + E(t.text || '(no text)') + '</div>';
  }
  async function deleteDocument(id) {
    var ok = true; try { ok = window.confirm('Delete this document? The writer will no longer learn from it.'); } catch (e) { ok = true; }
    if (!ok) return;
    var r = await q(db.from('fund_documents').delete().eq('id', id));
    if (r.error) { toastS('Could not delete: ' + (r.error.message || r.error)); return; }
    closeSheet(); await loadAll(true); paint(); toastS('Deleted.');
  }

  /* ---------- a funder ---------- */
  function funderSheetHtml(f) {
    var gs = F.grants.filter(function (g) { return g.funder_id === f.id; }).sort(grantSort), docs = F.docs.filter(function (d) { return String(d.funder_id) === String(f.id); });
    var fit = FIT[f.fit] || FIT.unknown;
    var html = '<div class="w193acts" style="margin:0 0 14px">' + (canEdit() ? '<a class="w193btn ghost sm" data-w193fedit="' + f.id + '">' + I('pen') + 'Edit</a><a class="w193btn sm" data-w193gadd="' + f.id + '">' + I('plus') + 'Add a grant here</a>' + (!f.screened_out ? '<a class="w193btn ghost sm" data-w193fwatch="' + f.id + '">' + I('search') + (f.watch ? 'Stop watching' : 'Watch it') + '</a>' : '') + '<a class="w193btn ' + (f.screened_out ? 'ghost' : 'warn') + ' sm" data-w193fscreen="' + f.id + '">' + (f.screened_out ? 'Back in play' : 'Screen out') + '</a>' : '') + '</div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px"><span class="w193tag">' + E(KINDS[f.kind] || f.kind) + '</span><span class="w193tag">' + E(REGIONS[f.region] || f.region) + '</span><span class="w193tag" style="--bg:' + fit[1] + ';--ink:' + fit[2] + '">' + E(fit[0]) + '</span>' + (f.watch && !f.screened_out ? '<span class="w193tag">' + I('search') + 'on the watchlist</span>' : '') + (f.screened_out ? '<span class="w193pill" data-st="not_eligible">Screened out</span>' : '') + '</div>';
    if (f.screened_out && f.screened_reason) html += '<p class="w193p" style="font-size:13.5px"><b>Why not for us:</b> ' + E(f.screened_reason) + '</p>';
    if (f.fit_note) html += '<p class="w193p" style="font-size:13.5px"><b>Fit:</b> ' + E(f.fit_note) + '</p>';
    html += kv([['Website', f.url && safeUrl(f.url) ? linkHtml({ label: f.url.replace(/^https?:\/\//, ''), url: f.url }) : '', true], ['Portal', f.portal && safeUrl(f.portal) ? linkHtml({ label: f.portal.replace(/^https?:\/\//, ''), url: f.portal }) : '', true], ['Contact', f.contact || ''], ['They fund', f.funds_what || ''], ['Eligibility', f.eligibility || ''], ['Cycle', f.cycle || ''], ['Next deadline', f.next_deadline ? fmtDate(f.next_deadline) + ' (' + dueText(f.next_deadline) + ')' : ''], ['Amounts', f.amount_min || f.amount_max ? (f.amount_min && f.amount_max ? money(f.amount_min) + ' to ' + money(f.amount_max) : 'up to ' + money(f.amount_max || f.amount_min)) : ''], ['Our history', f.relationship || ''], ['Also called', (f.aliases || []).join(', ')], ['Source', f.source || '']]);
    if (f.notes) html += '<div class="w193sec"><h4>Notes</h4><p class="w193p" style="white-space:pre-wrap;font-size:13.5px">' + E(f.notes) + '</p></div>';
    html += '<div class="w193sec"><h4>Grants with this funder</h4>' + (gs.length ? '<ul class="w193list">' + gs.map(function (g) { return '<li data-w193grant="' + g.id + '"><div class="t"><b>' + E(g.program) + (g.title ? ': ' + E(g.title) : '') + '</b><small>' + E(amountText(g)) + (g.deadline ? ' · ' + E(fmtDate(g.deadline)) : '') + (g.decided_on ? ' · decided ' + E(fmtDate(g.decided_on)) : '') + '</small></div>' + stagePill(g.stage) + '</li>'; }).join('') + '</ul>' : '<p class="w193empty">None yet.</p>') + '</div>';
    if (docs.length) html += '<div class="w193sec"><h4>On file</h4><ul class="w193list">' + docs.map(function (d) { return '<li data-w193doc="' + d.id + '"><div class="t"><b>' + E(d.title) + '</b><small>' + E(d.kind) + (d.doc_date ? ' · ' + E(fmtDate(d.doc_date)) : '') + '</small></div>' + I('chevr') + '</li>'; }).join('') + '</ul></div>';
    var srcs = F.sources.filter(function (s) { return String(s.funder_id) === String(f.id); });
    if (srcs.length) html += '<div class="w193sec"><h4>The scanner reads</h4><ul class="w193list static">' + srcs.map(function (s) { return '<li><div class="t"><b>' + E(s.name) + '</b><small>' + (s.last_checked ? 'checked ' + E(fmtWhen(s.last_checked)) : 'not read yet') + (s.last_error ? ' · <span style="color:' + FLAG + '">' + E(clip(s.last_error, 80)) + '</span>' : '') + (s.last_summary ? ' · ' + E(clip(s.last_summary, 140)) : '') + '</small></div></li>'; }).join('') + '</ul></div>';
    if (canDelete() && !gs.length) html += '<div class="w193acts" style="margin-top:18px"><a class="w193btn warn sm" data-w193fdel="' + f.id + '">Delete this funder</a></div>';
    return html;
  }
  function openFunder(id) {
    var f = byId(F.funders, id); if (!f) { toastS('That funder is not here any more.'); return; }
    F.sheet = { kind: 'funder', id: f.id };
    showSheet(E(f.name), E(KINDS[f.kind] || f.kind) + ' · ' + E(REGIONS[f.region] || f.region), funderSheetHtml(f));
  }
  async function toggleWatch(id) {
    var f = byId(F.funders, id); if (!f) return;
    var r = await q(db.from('fund_funders').update({ watch: !f.watch, updated_by: me().email }).eq('id', id));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    await loadAll(true); if (onFund()) paint(); openFunder(id); toastS(!f.watch ? 'On the watchlist.' : 'Off the watchlist.');
  }
  async function toggleScreen(id) {
    var f = byId(F.funders, id); if (!f) return;
    if (!f.screened_out) { var c = JSON.parse(JSON.stringify(f)); c.screened_out = true; c.watch = false; openFunderForm(c); toastS('Say why it is not for us, then Save.'); return; }
    var r = await q(db.from('fund_funders').update({ screened_out: false, updated_by: me().email }).eq('id', id));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    await loadAll(true); if (onFund()) paint(); openFunder(id); toastS('Back in play.');
  }
  async function deleteFunder(id) {
    var f = byId(F.funders, id); if (!f) return;
    var ok = true; try { ok = window.confirm('Delete "' + f.name + '"?'); } catch (e) { ok = true; }
    if (!ok) return;
    var r = await q(db.from('fund_funders').delete().eq('id', id));
    if (r.error) { toastS('Could not delete: ' + (r.error.message || r.error)); return; }
    closeSheet(); await loadAll(true); paint(); toastS('Deleted.');
  }

  /* ---------- forms ---------- */
  function inp(name, label, value, type, extra) { return '<label>' + E(label) + '</label><input type="' + (type || 'text') + '" name="' + name + '" value="' + E(value == null ? '' : value) + '"' + (extra || '') + '>'; }
  function sel(name, label, value, opts) { return '<label>' + E(label) + '</label><select name="' + name + '">' + opts.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>'; }
  function ta(name, label, value, ph) { return '<label>' + E(label) + '</label><textarea name="' + name + '" placeholder="' + E(ph || '') + '">' + E(value == null ? '' : value) + '</textarea>'; }
  function num(v) { v = String(v == null ? '' : v).replace(/[$,\s]/g, ''); return v === '' ? null : (isFinite(Number(v)) ? Number(v) : null); }
  function str(v) { v = String(v == null ? '' : v).trim(); return v === '' ? null : v; }
  function openGrantForm(g, funderId) {
    var isNew = !g; g = g || { funder_id: funderId || '', stage: funderId ? 'screened' : 'watching', links: [] };
    var funders = F.funders.slice().sort(function (a, b) { return (a.screened_out ? 1 : 0) - (b.screened_out ? 1 : 0) || String(a.name).localeCompare(String(b.name)); });
    var ms = members().filter(function (m) { return m.email; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var links = (Array.isArray(g.links) ? g.links : []).map(function (l) { return (l.label ? l.label + ' | ' : '') + (l.url || ''); }).join('\n');
    var body = '<form class="w193form" data-w193gform="' + (g.id || '') + '">'
      + sel('funder_id', 'Funder', g.funder_id, [['', 'Choose the funder…']].concat(funders.map(function (f) { return [f.id, f.name + (f.screened_out ? ' (screened out)' : '')]; }))) + '<p class="hint">Missing? Add the funder first (Funders, Add a funder).</p>'
      + inp('program', 'Program or call', g.program, 'text', ' required maxlength="300" placeholder="Seed Grant, Community Fund, Employee giving…"')
      + inp('title', 'Our project (optional)', g.title, 'text', ' maxlength="200" placeholder="Community kitchen 2027"')
      + '<div class="row">' + sel('stage', 'Stage', g.stage, STAGES.map(function (s) { return [s[0], s[1]]; })) + '<div>' + inp('fit_score', 'Fit score (0 to 100)', g.fit_score, 'number', ' min="0" max="100"') + '</div></div>'
      + '<div class="row"><div>' + inp('amount_ask', 'Our ask ($)', g.amount_ask, 'text', ' inputmode="decimal"') + '</div><div>' + inp('amount_awarded', 'Awarded ($)', g.amount_awarded, 'text', ' inputmode="decimal"') + '</div></div>'
      + '<div class="row"><div>' + inp('deadline', 'Deadline', g.deadline, 'date') + '</div><div>' + inp('deadline_note', 'Deadline note', g.deadline_note, 'text', ' maxlength="200" placeholder="rolling, expected March…"') + '</div></div>'
      + '<div class="row"><div>' + inp('submitted_on', 'Submitted on', g.submitted_on, 'date') + '</div><div>' + inp('decided_on', 'Decided on', g.decided_on, 'date') + '</div></div>'
      + inp('decision_note', 'Decision note', g.decision_note, 'text', ' maxlength="500"')
      + '<div class="row"><div>' + inp('report_due', 'Report due', g.report_due, 'date') + '</div><div>' + inp('renewal_due', 'Renewal due', g.renewal_due, 'date') + '</div></div>'
      + '<div class="row"><div>' + inp('next_action', 'Next step', g.next_action, 'text', ' maxlength="300"') + '</div><div>' + inp('next_action_due', 'By', g.next_action_due, 'date') + '</div></div>'
      + sel('owner_email', 'Owner', lower(g.owner_email || ''), [['', 'Nobody yet']].concat(ms.map(function (m) { return [lower(m.email), m.name || m.email]; })))
      + '<div class="row"><div>' + inp('partner', 'Partner', g.partner, 'text', ' maxlength="200"') + '</div><div>' + inp('program_area', 'What the money is for', g.program_area, 'text', ' maxlength="200" placeholder="kitchen equipment, Sunday servings…"') + '</div></div>'
      + inp('hours_spent', 'Hours spent', g.hours_spent, 'text', ' inputmode="decimal"')
      + ta('links', 'Links (one per line: Label | URL)', links, 'The call | https://…')
      + ta('notes', 'Notes', g.notes, '')
      + '<div class="acts"><button type="submit" class="w193btn">' + (isNew ? 'Add the grant' : 'Save') + '</button><a class="w193btn ghost" data-w193cancel="1">Cancel</a></div></form>';
    F.sheet = { kind: 'gform', id: g.id || null };
    showSheet(isNew ? 'Add a grant' : 'Edit the grant', isNew ? 'An opportunity or an application' : E(grantTitle(g)), body);
  }
  async function saveGrant(form) {
    var fd = new FormData(form), id = form.getAttribute('data-w193gform'), old = id ? byId(F.grants, id) : null;
    var owner = lower(fd.get('owner_email')), om = members().filter(function (m) { return lower(m.email) === owner; })[0];
    var links = String(fd.get('links') || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { var p = l.split('|').map(function (x) { return x.trim(); }); var url = p.length > 1 ? p[1] : p[0]; return safeUrl(url) ? { label: p.length > 1 ? p[0] : '', url: url } : null; }).filter(Boolean);
    var rec = { funder_id: num(fd.get('funder_id')), program: str(fd.get('program')), title: str(fd.get('title')), fit_score: num(fd.get('fit_score')), amount_ask: num(fd.get('amount_ask')), amount_awarded: num(fd.get('amount_awarded')), deadline: str(fd.get('deadline')), deadline_note: str(fd.get('deadline_note')), submitted_on: str(fd.get('submitted_on')), decided_on: str(fd.get('decided_on')), decision_note: str(fd.get('decision_note')), report_due: str(fd.get('report_due')), renewal_due: str(fd.get('renewal_due')), next_action: str(fd.get('next_action')), next_action_due: str(fd.get('next_action_due')), owner_email: owner || null, owner_name: om ? om.name : null, partner: str(fd.get('partner')), program_area: str(fd.get('program_area')), hours_spent: num(fd.get('hours_spent')), links: links, notes: str(fd.get('notes')), updated_by: me().email };
    if (!rec.funder_id) { toastS('Choose the funder.'); return; }
    if (!rec.program) { toastS('Name the program or call.'); return; }
    var stage = String(fd.get('stage') || 'watching'), r, gid = id ? Number(id) : null;
    if (old) {
      r = await q(db.from('fund_grants').update(rec).eq('id', id));
      if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
      if (stage !== old.stage) { var rs = await q(db.rpc('fund_grant_stage', { p_grant: gid, p_stage: stage, p_note: null })); if (rs.error) toastS('Saved, but the stage did not move: ' + (rs.error.message || rs.error)); }
    } else {
      rec.stage = stage; rec.created_by = me().email; rec.source = 'hub';
      r = await q(db.from('fund_grants').insert(rec).select('id').single());
      if (r.error || !r.data) { toastS('Could not add it: ' + (r.error && (r.error.message || r.error) || '')); return; }
      gid = r.data.id;
      await q(db.from('fund_grant_log').insert({ grant_id: gid, who: me().email, kind: 'note', text: 'Added to the pipeline at ' + (STAGE[stage] || {}).l.toLowerCase() + '.' }));
    }
    await loadAll(true); if (onFund()) paint();
    toastS(old ? 'Saved.' : 'Added.');
    openGrant(gid);
  }
  function openFunderForm(f) {
    var isNew = !f; f = f || { kind: 'foundation', region: 'quebec', fit: 'unknown', watch: true, aliases: [] };
    var body = '<form class="w193form" data-w193fform="' + (f.id || '') + '">'
      + inp('name', 'Name', f.name, 'text', ' required maxlength="200"')
      + inp('aliases', 'Also called (comma separated)', (f.aliases || []).join(', '), 'text', ' maxlength="400"')
      + '<div class="row">' + sel('kind', 'Kind', f.kind, Object.keys(KINDS).map(function (k) { return [k, KINDS[k]]; })) + sel('region', 'Region', f.region, Object.keys(REGIONS).map(function (k) { return [k, REGIONS[k]]; })) + '</div>'
      + '<div class="row"><div>' + inp('url', 'Website', f.url, 'url', ' placeholder="https://"') + '</div><div>' + inp('portal', 'Application portal', f.portal, 'url', ' placeholder="https://"') + '</div></div>'
      + inp('contact', 'Contact', f.contact, 'text', ' maxlength="300" placeholder="Name, role, email"')
      + ta('funds_what', 'What they fund', f.funds_what) + ta('eligibility', 'Eligibility', f.eligibility)
      + '<div class="row"><div>' + inp('cycle', 'Cycle', f.cycle, 'text', ' maxlength="200" placeholder="rolling; spring and fall; once a year in March"') + '</div><div>' + inp('next_deadline', 'Next deadline', f.next_deadline, 'date') + '</div></div>'
      + '<div class="row"><div>' + inp('amount_min', 'Amounts from ($)', f.amount_min, 'text', ' inputmode="decimal"') + '</div><div>' + inp('amount_max', 'to ($)', f.amount_max, 'text', ' inputmode="decimal"') + '</div></div>'
      + '<div class="row">' + sel('fit', 'Fit', f.fit, Object.keys(FIT).map(function (k) { return [k, FIT[k][0]]; })) + '<div>' + inp('fit_note', 'Why', f.fit_note, 'text', ' maxlength="500"') + '</div></div>'
      + ta('relationship', 'Our history with them', f.relationship) + ta('notes', 'Notes', f.notes)
      + '<label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13.5px;margin-top:14px"><input type="checkbox" name="watch"' + (f.watch ? ' checked' : '') + ' style="width:auto"> The scanner watches this funder’s page</label>'
      + '<label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13.5px"><input type="checkbox" name="screened_out"' + (f.screened_out ? ' checked' : '') + ' style="width:auto"> Not for us (screened out)</label>'
      + inp('screened_reason', 'Why not for us', f.screened_reason, 'text', ' maxlength="500"')
      + '<div class="acts"><button type="submit" class="w193btn">' + (isNew ? 'Add the funder' : 'Save') + '</button><a class="w193btn ghost" data-w193cancel="1">Cancel</a></div></form>';
    F.sheet = { kind: 'fform', id: f.id || null };
    showSheet(isNew ? 'Add a funder' : 'Edit the funder', isNew ? 'A foundation, a program, a company' : E(f.name), body);
  }
  async function saveFunder(form) {
    var fd = new FormData(form), id = form.getAttribute('data-w193fform');
    var rec = { name: str(fd.get('name')), aliases: String(fd.get('aliases') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean), kind: String(fd.get('kind')), region: String(fd.get('region')), url: str(fd.get('url')), portal: str(fd.get('portal')), contact: str(fd.get('contact')), funds_what: str(fd.get('funds_what')), eligibility: str(fd.get('eligibility')), cycle: str(fd.get('cycle')), next_deadline: str(fd.get('next_deadline')), amount_min: num(fd.get('amount_min')), amount_max: num(fd.get('amount_max')), fit: String(fd.get('fit')), fit_note: str(fd.get('fit_note')), relationship: str(fd.get('relationship')), notes: str(fd.get('notes')), watch: fd.get('watch') === 'on', screened_out: fd.get('screened_out') === 'on', screened_reason: str(fd.get('screened_reason')), updated_by: me().email };
    if (!rec.name) { toastS('Name the funder.'); return; }
    if (rec.screened_out) rec.watch = false;
    var r, fid = id ? Number(id) : null;
    if (id) r = await q(db.from('fund_funders').update(rec).eq('id', id));
    else { rec.created_by = me().email; rec.source = 'hub'; r = await q(db.from('fund_funders').insert(rec).select('id').single()); if (r.data) fid = r.data.id; }
    if (r.error) { toastS(/duplicate|unique/i.test(String(r.error.message)) ? 'A funder with that name is already here.' : 'Could not save: ' + (r.error.message || r.error)); return; }
    await loadAll(true); if (onFund()) paint(); toastS(id ? 'Saved.' : 'Added.');
    if (fid) openFunder(fid);
  }
  function openFactForm(f) {
    var isNew = !f; f = f || { category: 'numbers', status: 'needs_check', sort: 100 };
    var body = '<form class="w193form" data-w193factform="' + (f.id || '') + '">'
      + inp('key', 'Key (short, letters and dashes)', f.key, 'text', (isNew ? ' required' : ' readonly') + ' maxlength="60" placeholder="meals-2025"')
      + sel('category', 'Category', f.category, FACT_CATS)
      + inp('title', 'Title', f.title, 'text', ' required maxlength="200"')
      + ta('body', 'The fact, in our words', f.body) + ta('body_fr', 'In French (optional)', f.body_fr)
      + inp('source', 'Source', f.source, 'text', ' maxlength="300" placeholder="Impact Tracker 2025; the Hub"')
      + '<div class="row">' + sel('status', 'Status', f.status, Object.keys(FACT_ST).map(function (k) { return [k, FACT_ST[k][0]]; })) + '<div>' + inp('sort', 'Order', f.sort, 'number') + '</div></div>'
      + ta('notes', 'Notes (what to check, what the sources disagree on)', f.notes)
      + '<div class="acts"><button type="submit" class="w193btn">' + (isNew ? 'Add the fact' : 'Save') + '</button><a class="w193btn ghost" data-w193cancel="1">Cancel</a></div></form>';
    F.sheet = { kind: 'factform', id: f.id || null };
    showSheet(isNew ? 'Add a fact' : 'Edit the fact', isNew ? 'Something the writer may say about us' : E(f.title), body);
  }
  async function saveFact(form) {
    var fd = new FormData(form), id = form.getAttribute('data-w193factform');
    var rec = { category: String(fd.get('category')), title: str(fd.get('title')), body: str(fd.get('body')), body_fr: str(fd.get('body_fr')), source: str(fd.get('source')), status: String(fd.get('status')), sort: num(fd.get('sort')) == null ? 100 : num(fd.get('sort')), notes: str(fd.get('notes')), updated_by: me().email };
    if (!rec.title || !rec.body) { toastS('A title and the fact itself.'); return; }
    if (rec.status === 'verified') { rec.verified_on = ymd(today()); rec.verified_by = me().email; }
    var r;
    if (id) r = await q(db.from('fund_facts').update(rec).eq('id', id));
    else { rec.key = fold(fd.get('key')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); if (!rec.key) { toastS('Give it a key.'); return; } r = await q(db.from('fund_facts').insert(rec)); }
    if (r.error) { toastS(/duplicate|unique/i.test(String(r.error.message)) ? 'That key is taken.' : 'Could not save: ' + (r.error.message || r.error)); return; }
    closeSheet(); await loadAll(true); paint(); toastS(id ? 'Saved.' : 'Added.');
  }
  function openDocForm(grantId) {
    var g = byId(F.grants, grantId);
    var body = '<form class="w193form" data-w193docform="' + (grantId || '') + '">'
      + inp('title', 'Title', g ? grantTitle(g) + ' application' : '', 'text', ' required maxlength="200"')
      + '<div class="row">' + sel('kind', 'Kind', 'application', [['application', 'Application'], ['loi', 'Letter of intent'], ['letter', 'Letter'], ['budget', 'Budget'], ['confirmation', 'Confirmation'], ['report', 'Report'], ['answers', 'Standard answers'], ['other', 'Other']]) + '<div>' + inp('doc_date', 'Date', ymd(today()), 'date') + '</div></div>'
      + sel('lang', 'Language', 'en', [['en', 'English'], ['fr', 'French']])
      + inp('source_url', 'Where the original lives (optional)', '', 'url', ' placeholder="https://docs.google.com/…"')
      + '<label>The text</label><textarea name="text" required style="min-height:220px" placeholder="Paste the questions and answers as sent"></textarea>'
      + '<div class="acts"><button type="submit" class="w193btn">Keep it</button><a class="w193btn ghost" data-w193cancel="1">Cancel</a></div></form>';
    F.sheet = { kind: 'docform', id: grantId };
    showSheet('Add a past application', g ? E(grantTitle(g)) : '', body);
  }
  async function saveDoc(form) {
    var fd = new FormData(form), gid = num(form.getAttribute('data-w193docform')), g = gid ? byId(F.grants, gid) : null, text = str(fd.get('text'));
    if (!text) return;
    var r = await q(db.from('fund_documents').insert({ grant_id: gid, funder_id: g ? g.funder_id : null, title: str(fd.get('title')) || 'Document', kind: String(fd.get('kind')), lang: String(fd.get('lang')), doc_date: str(fd.get('doc_date')), text: text, words: words(text), source_url: str(fd.get('source_url')), source: 'added in the Hub', created_by: me().email }));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    if (gid) await q(db.from('fund_grant_log').insert({ grant_id: gid, who: me().email, kind: 'note', text: 'Added a document: ' + (str(fd.get('title')) || 'Document') + '.' }));
    await loadAll(true); if (onFund()) paint(); toastS('Kept: the writer learns from it.');
    if (gid) { await loadLog(gid); openGrant(gid); } else closeSheet();
  }
  function openDonorGoals() {
    var D = setting('donor_program') || {}, g = D.goals || {};
    var body = '<form class="w193form" data-w193dgform="1">'
      + '<div class="row"><div>' + inp('monthly_donors', 'Monthly donors (goal)', g.monthly_donors, 'number') + '</div><div>' + inp('monthly_revenue', 'Monthly giving (goal, $)', g.monthly_revenue, 'number') + '</div></div>'
      + '<div class="row"><div>' + inp('year_revenue', 'Year revenue (goal, $)', g.year_revenue, 'number') + '</div><div>' + inp('by', 'By', g.by, 'date') + '</div></div>'
      + inp('launched', 'Launched on', D.launched, 'date')
      + ta('audience', 'Who we ask', D.audience)
      + '<div class="acts"><button type="submit" class="w193btn">Save</button><a class="w193btn ghost" data-w193cancel="1">Cancel</a></div></form>';
    F.sheet = { kind: 'dgform' };
    showSheet('The program’s goals', 'Leaders and admins', body);
  }
