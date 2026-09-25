
  /* ---------- the sheet: details and the two forms ---------- */
  var lastFocus = null;
  function sheetEl() {
    var s = document.getElementById('w124sheet');
    if (!s) { s = document.createElement('div'); s.id = 'w124sheet'; s.innerHTML = '<div class="bk" data-w124close></div><div class="pane" role="dialog" aria-modal="true" aria-label="Details"></div>'; document.body.appendChild(s); }
    return s;
  }
  function openSheet(html, kind) {
    if (!C.sheet) lastFocus = document.activeElement;
    C.sheet = { kind: kind || 'view' };
    var s = sheetEl(); s.querySelector('.pane').innerHTML = html; s.classList.add('on');
    setTimeout(function () { var f = s.querySelector('.pane input, .pane select, .pane .x'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }, 30);
  }
  function closeSheet() {
    var s = document.getElementById('w124sheet'); if (s) { s.classList.remove('on'); s.querySelector('.pane').innerHTML = ''; }
    C.sheet = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } } lastFocus = null;
  }
  function top(tag) { return '<div class="top">' + (tag || '') + '<span class="sp"></span><button type="button" class="x" data-w124close aria-label="Close">' + I('x') + '</button></div>'; }
  function layerTag(k) { var L = LAYER[k]; return '<span class="tag" style="--bg:' + L.bg + ';--ink:' + L.ink + '">' + I(L.icon) + E(L.l.replace(/^My /, '')) + '</span>'; }
  function kv(icon, html) { return '<span>' + I(icon) + '</span><div>' + html + '</div>'; }
  function openItem(it) {
    if (!it) return;
    if (it.k === 'fund') { openFund(it.ref); return; }
    var r = it.ref, html = top(layerTag(it.k)) + '<h2>' + E(it.title) + '</h2>', rows = [], acts = [];
    var d = parseDay(it.day);
    if (it.k === 'meet') {
      var s = new Date(r.start_at), e = r.end_at ? new Date(r.end_at) : null;
      rows.push(kv('clock', E(fmtDate(s, { weekday: 'long', month: 'long', day: 'numeric' })) + (r.all_day ? ', all day' : ', ' + E(fmtTime(s)) + (e ? ' to ' + E(fmtTime(e)) : ''))));
      if (r.location) rows.push(kv('pin', E(r.location)));
      var att = (r.attendee_emails || []).filter(function (x) { return !/hub@|loom@|admin@|gserviceaccount|\.test-google-a\.com$/i.test(x); });
      var names = att.map(function (x) { var m = memberByEmail(x); return m ? m.name : x.split('@')[0]; });
      if (names.length) rows.push(kv('people', E(names.slice(0, 10).join(', ')) + (names.length > 10 ? ' and ' + (names.length - 10) + ' more' : '')));
      if (r.organizer) { var om = memberByEmail(r.organizer); rows.push(kv('spark', 'Organized by ' + E(om ? om.name : r.organizer))); }
      if (r.meet_link) acts.push('<a class="w124btn" href="' + E(r.meet_link) + '" target="_blank" rel="noopener">' + I('video') + 'Join</a>');
      if (r.html_link) acts.push('<a class="w124btn ghost" href="' + E(r.html_link) + '" target="_blank" rel="noopener">Open in Google Calendar</a>');
      if (r.department) acts.push('<a class="w124btn ghost" data-w124go="#team/' + E(r.department) + '/agenda">Agenda</a>');
      if (r.description) html += '<div class="note">' + E(clip(String(r.description).replace(/<[^>]+>/g, ' '), 600)) + '</div>';
    } else if (it.k === 'post') {
      if (it.planned) {
        rows.push(kv('clock', E(fmtDate(it.at, { weekday: 'long', month: 'long', day: 'numeric' })) + ', ' + E(fmtTime(it.at))));
        rows.push(kv('megaphone', E(it.sub)));
        if (r.campaign) rows.push(kv('target', 'Campaign: ' + E(r.campaign)));
        if (r.owner) rows.push(kv('people', 'Owner: ' + E(r.owner)));
        acts.push('<a class="w124btn" data-w124go="#contentcal/' + E(r.id) + '">Open in the content calendar</a>');
      } else {
        rows.push(kv('clock', 'Published ' + E(fmtDate(it.at, { weekday: 'long', month: 'long', day: 'numeric' })) + ', ' + E(fmtTime(it.at))));
        var stats = [['views', 'views'], ['likes', 'likes'], ['comments', 'comments']].filter(function (x) { return r[x[0]] != null; }).map(function (x) { return Number(r[x[0]]).toLocaleString('en-CA') + ' ' + x[1]; });
        if (stats.length) rows.push(kv('spark', E(stats.join(' · '))));
        if (r.caption) html += '<div class="note">' + E(clip(r.caption, 500)) + '</div>';
        if (r.url) acts.push('<a class="w124btn" href="' + E(r.url) + '" target="_blank" rel="noopener">' + I('link') + 'Open the post</a>');
        acts.push('<a class="w124btn ghost" data-w124go="#socialstats">Analytics</a>');
      }
    } else if (it.k === 'vol') {
      rows.push(kv('clock', E(fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })) + (it.cancelled ? ' (cancelled)' : '')));
      if (r.location) rows.push(kv('pin', E(r.location)));
      if (r.planned_meals) rows.push(kv('pot', E(r.planned_meals) + ' meals planned'));
      acts.push('<a class="w124btn" data-w124go="#volunteering/e/' + E(r.id) + '">Open the event</a>');
    } else if (it.k === 'bday') {
      rows.push(kv('cake', E(fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }))));
      if (it.person) acts.push('<a class="w124btn ghost" data-w124go="#person/' + E(it.person.id) + '">Open their profile</a>');
      if (it.mine) acts.push('<a class="w124btn ghost" data-w124bday="1">Change your birthday</a>');
    }
    html += '<div class="kv">' + rows.join('') + '</div>' + (acts.length ? '<div class="acts">' + acts.join('') + '</div>' : '');
    openSheet(html, 'view');
  }
  function openFund(f) {
    if (!f) return;
    var proj = f.project_id ? C.projects.filter(function (p) { return String(p.id) === String(f.project_id); })[0] : null;
    var rows = [kv('clock', E(fundWhen(f)))];
    if (f.partners) rows.push(kv('people', '<b>Partners:</b> ' + E(f.partners)));
    var tg = targetText(f); if (tg || f.target_note) rows.push(kv('target', E(tg) + (f.target_note ? (tg ? '. ' : '') + E(f.target_note) : '')));
    if (f.raised != null) rows.push(kv('check', 'Raised <b>' + E(money(f.raised)) + '</b>'));
    if (f.lead) rows.push(kv('spark', 'Lead: ' + E(f.lead)));
    var acts = [];
    if (canEditFund()) { acts.push('<a class="w124btn" data-w124fedit="' + f.id + '">' + I('pen') + 'Edit</a>'); if (f.status !== 'done' && f.status !== 'idea' && f.precision !== 'none') acts.push('<a class="w124btn ghost" data-w124fdone="' + f.id + '">' + I('check') + 'Record the result</a>'); }
    if (proj) acts.push('<a class="w124btn ghost" data-w124go="#project/' + proj.id + '">' + I('board') + 'Project board</a>');
    if (f.sop_training_id) acts.push('<a class="w124btn ghost" data-w124go="#training/t/' + f.sop_training_id + '">' + I('doc') + 'SOP</a>');
    if (!onFund()) acts.push('<a class="w124btn ghost" data-w124go="#fundevents">Events calendar</a>');
    var html = top('<span class="tag" style="--bg:' + STATUS[f.status][1] + ';--ink:' + STATUS[f.status][2] + '">' + E(STATUS[f.status][0]) + '</span>' + layerTag('fund')) + '<h2>' + E(f.title) + '</h2>'
      + '<div class="kv">' + rows.join('') + '</div>'
      + (f.result_note ? '<div class="note"><b>Result:</b> ' + E(f.result_note) + '</div>' : '')
      + (f.notes ? '<div class="note">' + E(f.notes) + '</div>' : '')
      + (pastDue(f) ? '<p class="err">The date has passed: record how it went, so the year’s total stays right.</p>' : '')
      + (acts.length ? '<div class="acts">' + acts.join('') + '</div>' : '');
    openSheet(html, 'view');
  }
  function monthVal(d) { return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) : ''; }
  function openFundForm(f, season, doneMode) {
    var isNew = !f; f = f || { title: '', season: season || 'fall-2026', precision: season === 'backlog' ? 'none' : 'month', status: season === 'backlog' ? 'idea' : 'planned' };
    var s = parseDay(f.start_date), e = parseDay(f.end_date);
    var projOpts = '<option value="">None</option>' + C.projects.filter(function (p) { return (p.status || 'active') === 'active'; }).map(function (p) { return '<option value="' + p.id + '"' + (String(p.id) === String(f.project_id) ? ' selected' : '') + '>' + E(p.name) + '</option>'; }).join('');
    var html = top('<span class="tag" style="--bg:' + LAYER.fund.bg + ';--ink:' + LAYER.fund.ink + '">' + I('heart') + (doneMode ? 'Record the result' : isNew ? 'New fundraising event' : 'Edit the event') + '</span>')
      + '<form data-w124fform="' + (f.id || '') + '" novalidate>'
      + (doneMode ? '<h2>' + E(f.title) + '</h2>' : '<label class="f" for="w124ft">Name</label><input type="text" id="w124ft" name="title" maxlength="140" value="' + E(f.title) + '" required>')
      + (doneMode ? '' : '<div class="two"><div><label class="f" for="w124fs">Season</label><select id="w124fs" name="season">' + SEASONS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === f.season ? ' selected' : '') + '>' + E(x[1]) + '</option>'; }).join('') + '</select></div>'
        + '<div><label class="f" for="w124fst">Status</label><select id="w124fst" name="status">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === f.status ? ' selected' : '') + '>' + E(STATUS[k][0]) + '</option>'; }).join('') + '</select></div></div>'
        + '<label class="f" for="w124fp">When</label><select id="w124fp" name="precision">' + [['day', 'On a date'], ['month', 'Sometime in a month'], ['range', 'Across a few months'], ['season', 'Sometime in a season'], ['flexible', 'Flexible'], ['none', 'Not scheduled yet']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === f.precision ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'
        + '<div class="two" data-w124dates><div data-p="day"><label class="f" for="w124fd1">Date</label><input type="date" id="w124fd1" name="d1" value="' + (s ? ymd(s) : '') + '"></div><div data-p="day"><label class="f" for="w124fd2">Until<span class="op">optional</span></label><input type="date" id="w124fd2" name="d2" value="' + (e && s && !sameDay(s, e) ? ymd(e) : '') + '"></div>'
        + '<div data-p="month range season"><label class="f" for="w124fm1">From month</label><input type="month" id="w124fm1" name="m1" value="' + monthVal(s) + '"></div><div data-p="range season"><label class="f" for="w124fm2">To month</label><input type="month" id="w124fm2" name="m2" value="' + monthVal(e) + '"></div></div>'
        + '<label class="f" for="w124fpa">Partners<span class="op">optional</span></label><input type="text" id="w124fpa" name="partners" maxlength="240" value="' + E(f.partners || '') + '">'
        + '<div class="two"><div><label class="f" for="w124fmin">Target from ($)<span class="op">optional</span></label><input type="number" id="w124fmin" name="target_min" min="0" step="100" value="' + E(f.target_min == null ? '' : f.target_min) + '"></div><div><label class="f" for="w124fmax">Target up to ($)<span class="op">optional</span></label><input type="number" id="w124fmax" name="target_max" min="0" step="100" value="' + E(f.target_max == null ? '' : f.target_max) + '"></div></div>'
        + '<div class="two"><div><label class="f" for="w124fl">Lead<span class="op">optional</span></label><input type="text" id="w124fl" name="lead" maxlength="80" value="' + E(f.lead || '') + '" list="w124people"></div><div><label class="f" for="w124fpr">Project board<span class="op">optional</span></label><select id="w124fpr" name="project_id">' + projOpts + '</select></div></div>'
        + '<datalist id="w124people">' + members().filter(function (m) { return m.active !== false; }).map(function (m) { return '<option value="' + E(m.name) + '">'; }).join('') + '</datalist>'
        + '<label class="f" for="w124fn">Notes<span class="op">optional</span></label><textarea id="w124fn" name="notes">' + E(f.notes || '') + '</textarea>')
      + '<div class="two"><div><label class="f" for="w124fr">Raised ($)' + (doneMode ? '' : '<span class="op">once it has happened</span>') + '</label><input type="number" id="w124fr" name="raised" min="0" step="1" value="' + E(f.raised == null ? '' : f.raised) + '"></div><div></div></div>'
      + '<label class="f" for="w124frn">How it went<span class="op">optional</span></label><textarea id="w124frn" name="result_note" placeholder="Turnout, what worked, what to change next time">' + E(f.result_note || '') + '</textarea>'
      + '<p class="err" data-w124ferr style="display:none"></p>'
      + '<div class="acts"><button type="submit" class="w124btn">' + (doneMode ? 'Save the result' : isNew ? 'Add the event' : 'Save') + '</button><button type="button" class="w124btn ghost" data-w124close>Cancel</button>' + (!isNew && !doneMode && isLeader() ? '<button type="button" class="w124btn ghost" data-w124fdel="' + f.id + '" style="margin-left:auto;color:' + FLAG + ' !important">Delete</button>' : '') + '</div>'
      + '<input type="hidden" name="__done" value="' + (doneMode ? '1' : '') + '"></form>';
    openSheet(html, 'form');
    syncDates();
  }
  function syncDates() {
    var sel = document.querySelector('#w124sheet select[name=precision]'); var box = document.querySelector('#w124sheet [data-w124dates]');
    if (!box) return; var p = sel ? sel.value : 'day';
    box.style.display = (p === 'flexible' || p === 'none') ? 'none' : '';
    box.querySelectorAll('[data-p]').forEach(function (el) { el.style.display = el.getAttribute('data-p').split(' ').indexOf(p) >= 0 ? '' : 'none'; });
  }
  function lastOfMonth(v) { var m = /^(\d{4})-(\d{2})$/.exec(v || ''); if (!m) return null; var d = mk(Number(m[1]), Number(m[2]), 0, 12); return ymd(d); }
  function firstOfMonth(v) { var m = /^(\d{4})-(\d{2})$/.exec(v || ''); return m ? m[1] + '-' + m[2] + '-01' : null; }
  async function saveFund(form) {
    var id = form.getAttribute('data-w124fform'), f = id ? fundById(id) : null, fd = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) fd[el.name] = el.value; });
    var err = form.querySelector('[data-w124ferr]'), fail = function (m) { if (err) { err.style.display = ''; err.textContent = m; } };
    var num = function (v) { v = String(v || '').trim(); return v === '' ? null : Number(v); };
    var row = {};
    if (fd.__done === '1') { row.status = 'done'; row.raised = num(fd.raised); row.result_note = String(fd.result_note || '').trim() || null; }
    else {
      row.title = String(fd.title || '').trim(); if (!row.title) { fail('Give the event a name.'); return; }
      row.season = fd.season; row.status = fd.status; row.precision = fd.precision;
      row.partners = String(fd.partners || '').trim() || null; row.lead = String(fd.lead || '').trim() || null;
      row.target_min = num(fd.target_min); row.target_max = num(fd.target_max); row.raised = num(fd.raised);
      row.result_note = String(fd.result_note || '').trim() || null; row.notes = String(fd.notes || '').trim() || null;
      row.project_id = fd.project_id ? Number(fd.project_id) : null;
      if (row.precision === 'day') { if (!fd.d1) { fail('Pick the date.'); return; } row.start_date = fd.d1; row.end_date = fd.d2 && fd.d2 > fd.d1 ? fd.d2 : null; row.timing = MONTHS[parseDay(fd.d1).getMonth()]; }
      else if (row.precision === 'month') { if (!fd.m1) { fail('Pick the month.'); return; } row.start_date = firstOfMonth(fd.m1); row.end_date = lastOfMonth(fd.m1); row.timing = MONTHS[Number(fd.m1.slice(5)) - 1]; }
      else if (row.precision === 'range' || row.precision === 'season') { if (!fd.m1 || !fd.m2) { fail('Pick the first and last month.'); return; } if (fd.m2 < fd.m1) { fail('The last month is before the first.'); return; } row.start_date = firstOfMonth(fd.m1); row.end_date = lastOfMonth(fd.m2); row.timing = MONTHS[Number(fd.m1.slice(5)) - 1].slice(0, 3) + ' to ' + MONTHS[Number(fd.m2.slice(5)) - 1].slice(0, 3); }
      else { row.start_date = null; row.end_date = null; row.timing = row.precision === 'flexible' ? 'Flexible' : 'Not yet scheduled'; }
      if (row.target_min != null && row.target_max != null && row.target_max < row.target_min) { fail('The target range runs backwards.'); return; }
    }
    row.updated_by = me().name; row.updated_at = new Date().toISOString();
    var res;
    if (f) { res = await q(db.from('fund_events').update(row).eq('id', f.id)); if (!res.error) Object.assign(f, row); }
    else { row.created_by = me().name; row.plan = '2026-27'; row.source = 'hub'; row.sort = 100 + C.fund.length; res = await q(db.from('fund_events').insert(row).select('*').single()); if (!res.error) C.fund.push((res.data && res.data.id) ? res.data : Object.assign({ id: -Date.now() }, row)); }
    if (res.error) { fail('It did not save: ' + String(res.error.message || res.error).slice(0, 140)); return; }
    try { await db.from('change_log').insert({ entity_type: 'fund_event', entity_id: String(f ? f.id : 'new'), field: fd.__done === '1' ? 'result' : (f ? 'edited' : 'created'), old_value: null, new_value: (row.title || (f && f.title) || '') + (row.raised != null ? ' raised ' + row.raised : ''), changed_by: me().name }); } catch (e) { /* audit */ }
    closeSheet();
    toastS(fd.__done === '1' ? 'Result saved' : f ? 'Saved' : 'Event added');
    repaintAll();
  }
  async function deleteFund(id) {
    var f = fundById(id); if (!f) return;
    if (typeof confirm === 'function' && !confirm('Delete ' + f.title + '? This cannot be undone.')) return;
    var res = await q(db.from('fund_events').delete().eq('id', f.id));
    if (res.error) { toastS('Could not delete it'); return; }
    C.fund = C.fund.filter(function (x) { return x !== f; });
    closeSheet(); toastS('Deleted'); repaintAll();
  }

  /* ---------- birthdays ---------- */
  function openBdayForm() {
    var b = myBirthday() || { month: '', day: '', share: 'everyone' };
    var html = top('<span class="tag" style="--bg:' + LAYER.bday.bg + ';--ink:' + LAYER.bday.ink + '">' + I('cake') + 'Your birthday</span>') + '<h2>' + (myBirthday() ? 'Change your birthday' : 'Add your birthday') + '</h2>'
      + '<p class="w124empty">Month and day only. It shows on the calendar on the day, to the people you choose.</p>'
      + '<form data-w124bform novalidate><div class="two"><div><label class="f" for="w124bm">Month</label><select id="w124bm" name="month"><option value="">Month</option>' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (Number(b.month) === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>'
      + '<div><label class="f" for="w124bd">Day</label><select id="w124bd" name="day"><option value="">Day</option>' + Array.apply(null, Array(31)).map(function (x, i) { return '<option value="' + (i + 1) + '"' + (Number(b.day) === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>'; }).join('') + '</select></div></div>'
      + '<label class="f">Who sees it on the calendar</label><div class="radios">'
      + [['everyone', 'Everyone at Welfare Avenue', 'It shows on everyone’s calendar on the day.'], ['team', 'My team', 'Only people on your team see it.'], ['me', 'Only me', 'Just a reminder for you.']].map(function (o) { return '<label><input type="radio" name="share" value="' + o[0] + '"' + (b.share === o[0] ? ' checked' : '') + '><div><b>' + o[1] + '</b><span>' + o[2] + '</span></div></label>'; }).join('') + '</div>'
      + '<p class="err" data-w124berr style="display:none"></p>'
      + '<div class="acts"><button type="submit" class="w124btn">Save</button><button type="button" class="w124btn ghost" data-w124close>Cancel</button>' + (myBirthday() ? '<button type="button" class="w124btn ghost" data-w124bdel style="margin-left:auto">Remove it</button>' : '') + '</div></form>';
    openSheet(html, 'form');
  }
  async function saveBday(form) {
    var m = Number(form.month.value), d = Number(form.day.value), share = (form.querySelector('input[name=share]:checked') || {}).value || 'everyone';
    var err = form.querySelector('[data-w124berr]'), fail = function (t) { if (err) { err.style.display = ''; err.textContent = t; } };
    if (!m || !d) { fail('Pick the month and the day.'); return; }
    var max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; if (d > max) { fail(MONTHS[m - 1] + ' has ' + max + ' days.'); return; }
    var em = me().email; if (!em) { fail('Sign in again first.'); return; }
    var row = { email: em, month: m, day: d, share: share, updated_at: new Date().toISOString() };
    var res = await q(db.from('hub_birthdays').upsert(row, { onConflict: 'email' }));
    if (res.error) { fail('It did not save: ' + String(res.error.message || res.error).slice(0, 140)); return; }
    C.bdays = C.bdays.filter(function (b) { return lower(b.email) !== em; }).concat([row]);
    closeSheet(); toastS('Birthday saved: ' + MONTHS[m - 1] + ' ' + d); repaintAll();
  }
  async function deleteBday() {
    var em = me().email; var res = await q(db.from('hub_birthdays').delete().eq('email', em));
    if (res.error) { toastS('Could not remove it'); return; }
    C.bdays = C.bdays.filter(function (b) { return lower(b.email) !== em; });
    closeSheet(); toastS('Birthday removed'); repaintAll();
  }
