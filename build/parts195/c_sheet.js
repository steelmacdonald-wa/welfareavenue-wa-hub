
  /* ---------- a request, in a sheet: what they asked for, their record, then sign or decline ---------- */
  var SUB = 'Letters and forms volunteers ask us to sign from their profile on welfareavenue.com';
  function escKey(e) { if (e.key === 'Escape' && document.getElementById('w195sheet')) closeSheet(); }
  function closeSheet() {
    var s = document.getElementById('w195sheet'); if (s) s.parentNode.removeChild(s);
    S.det = null; S.preview = null; S.step = ''; S.sheetErr = ''; S.sheetOk = ''; S.mine = null;
    document.removeEventListener('keydown', escKey);
  }
  function sheet(inner) {
    css();
    var s = document.getElementById('w195sheet');
    if (!s) {
      s = document.createElement('div'); s.id = 'w195sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
      document.body.appendChild(s);
      s.addEventListener('click', onSheetClick); s.addEventListener('input', onSheetInput); s.addEventListener('change', onSheetChange);
      document.addEventListener('keydown', escKey);
    }
    var old = s.querySelector('.w195pane'), keep = old ? old.scrollTop : 0;
    s.innerHTML = '<div class="w195pane"><button type="button" class="w195x" data-w195close="1" aria-label="Close">×</button>' + inner + '</div>';
    var p = s.querySelector('.w195pane'); if (p) p.scrollTop = keep;
    return s;
  }
  function dt(k, v) { return '<dt>' + E(k) + '</dt><dd>' + E(v) + '</dd>'; }
  async function open(id) {
    S.det = null; S.items = null; S.note = ''; S.place = 'br'; S.size = 'm'; S.page = ''; S.addPage = true; S.caption = true; S.notify = true;
    S.preview = null; S.stale = false; S.step = ''; S.reason = ''; S.sheetErr = ''; S.sheetOk = ''; S.mine = null;
    sheet('<p class="w195muted">Loading…</p>');
    await fill(id);
  }
  async function fill(id) {
    var r = await rpc('signoff_detail', { p_id: id });
    if (r.error || !r.data) { sheet('<div class="w195warn">' + E(r.error ? msgOf(r.error) : 'That request is gone.') + '</div>'); return; }
    S.det = r.data;
    if (!S.me) { var m = await rpc('signoff_signer_me'); if (!m.error && m.data) S.me = m.data; }
    S.items = (r.data.servings || []).map(function (x) { return { roster_id: x.roster_id, date: x.date, role: x.role_en || x.role, location: x.location, hours: Number(x.hours || 0), on: true }; });
    paintSheet();
  }
  function totText() {
    var on = (S.items || []).filter(function (x) { return x.on; });
    return plural(on.length, 'serving', 'servings') + ', ' + num(on.reduce(function (a, x) { return a + Number(x.hours || 0); }, 0)) + ' hours';
  }
  function servingsHtml() {
    var it = S.items || [];
    if (!it.length) return '<h3>Servings to list</h3><div class="w195warn">No confirmed servings in their dates. Decline with a note, or ask them for other dates.</div>';
    return '<h3>Servings to list</h3><p class="w195muted">Every confirmed serving in their dates, with the roster’s hours (the usual 2 when none were recorded). Untick one to leave it out, or change its hours.</p>' +
      '<div class="w195box"><table><thead><tr><th scope="col"><span class="sr">List</span></th><th scope="col">Date</th><th scope="col">Role</th><th scope="col">Where</th><th scope="col">Hours</th></tr></thead><tbody>' +
      it.map(function (x, i) {
        return '<tr' + (x.on ? '' : ' class="off"') + '><td><input type="checkbox" data-w195on="' + i + '"' + (x.on ? ' checked' : '') + ' aria-label="List ' + E(fmtDay(x.date)) + '"></td><td>' + E(fmtDay(x.date)) + '</td><td>' + E(x.role || '') + '</td>' +
          '<td>' + E(x.location || '') + '</td><td><input type="number" min="0.25" max="24" step="0.25" value="' + E(num(x.hours)) + '" data-w195h="' + i + '" aria-label="Hours on ' + E(fmtDay(x.date)) + '"></td></tr>';
      }).join('') + '</tbody></table><div class="w195tot" id="w195tot">' + E(totText()) + '</div></div>';
  }
  function placementHtml() {
    return '<h3>Where your signature goes on their form</h3><p class="w195muted">Open their form to see where it asks for a signature, then pick the spot. The preview shows it before you sign.</p><div class="w195box">' +
      '<div class="w195row2"><span class="w195k">Page</span><label><input type="radio" name="w195pg" value=""' + (S.page === '' ? ' checked' : '') + '> The last page</label>' +
      '<label><input type="radio" name="w195pg" value="n"' + (S.page !== '' ? ' checked' : '') + '> Page</label><input type="number" min="1" max="200" id="w195pgn" aria-label="Page number" value="' + E(S.page || '1') + '"></div>' +
      '<div class="w195row2"><span class="w195k">Where</span>' + PLACES.map(function (p) { return '<label><input type="radio" name="w195pl" value="' + p[0] + '"' + (S.place === p[0] ? ' checked' : '') + '> ' + E(p[1]) + '</label>'; }).join('') + '</div>' +
      '<div class="w195row2"><span class="w195k">Size</span>' + SIZES.map(function (z) { return '<label><input type="radio" name="w195sz" value="' + z[0] + '"' + (S.size === z[0] ? ' checked' : '') + '> ' + E(z[1]) + '</label>'; }).join('') + '</div>' +
      '<div class="w195row2"><label><input type="checkbox" id="w195cap"' + (S.caption ? ' checked' : '') + '> Your name, title, the date and the reference under the signature</label></div>' +
      '<div class="w195row2"><label><input type="checkbox" id="w195add"' + (S.addPage ? ' checked' : '') + '> Add our hours confirmation page after their form</label></div></div>';
  }
  function placement() {
    var p = PLACES.filter(function (x) { return x[0] === S.place; })[0] || PLACES[0], z = SIZES.filter(function (x) { return x[0] === S.size; })[0] || SIZES[1];
    var o = { x: p[2], y: p[3], w: z[2], caption: !!S.caption };
    if (S.page !== '') o.page = Math.max(0, (Number(S.page) || 1) - 1);
    return o;
  }
  function bodyFor(action) {
    var q = S.det.request, b = { action: action, id: q.id };
    if (q.kind !== 'recognition') b.items = (S.items || []).filter(function (x) { return x.on; }).map(function (x) { return { roster_id: x.roster_id, hours: Number(x.hours) }; });
    else b.note = S.note || '';
    if (q.kind === 'form') { b.placement = placement(); b.add_page = !!S.addPage; }
    if (action === 'sign') b.notify = !!S.notify;
    return b;
  }
  function ready() { var me = S.me || {}; return !!(me.has_signature && me.name && me.title); }
  function actionsHtml() {
    var d = S.det, q = d.request, me = S.me || {}, fn = d.first_name || first(d.name) || 'They';
    if (S.step === 'confirm') {
      return '<div class="w195confirm" role="alertdialog" aria-label="Sign this request"><p><b>Sign as ' + E(me.name) + ', ' + E(q.lang === 'fr' ? (me.title_fr || me.title) : me.title) + '?</b> ' +
        E(fn) + ' gets the signed PDF on their profile' + E(S.notify ? ', and an email that it is ready.' : '. No email goes out.') + '</p>' +
        '<div class="w195row2"><label><input type="checkbox" id="w195notify"' + (S.notify ? ' checked' : '') + '> Email ' + E(fn) + ' that it is ready</label></div>' +
        '<div class="w195acts"><button type="button" class="w195btn" data-w195sign="1"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Signing…' : 'Yes, sign it') + '</button>' +
        '<button type="button" class="w195btn ghost" data-w195step="">Not yet</button></div></div>';
    }
    if (S.step === 'decline') {
      return '<div class="w195confirm"><p><b>Decline this request?</b> ' + E(fn) + ' sees your note on their profile. Say why in a few words, and what would work instead if anything.</p>' +
        '<label class="sr" for="w195reason">Your note to them</label><textarea id="w195reason" maxlength="500" placeholder="For example: this form is for hours with another organization.">' + E(S.reason) + '</textarea>' +
        '<div class="w195acts"><button type="button" class="w195btn flag" data-w195decline="1"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Declining…' : 'Decline the request') + '</button>' +
        '<button type="button" class="w195btn ghost" data-w195step="">Back</button></div></div>';
    }
    var none = q.kind !== 'recognition' && !(S.items || []).some(function (x) { return x.on; });
    var why = !ready() ? 'Add your signature, name and title in My signature first' : none ? 'List at least one serving' : '';
    return '<div class="w195acts"><button type="button" class="w195btn ghost" data-w195preview="1"' + (S.previewBusy || none ? ' disabled' : '') + '>' + (S.previewBusy ? 'Drawing…' : 'Preview') + '</button>' +
      '<button type="button" class="w195btn" data-w195step="confirm"' + (why ? ' disabled title="' + E(why) + '"' : '') + '>Sign and send</button>' +
      '<button type="button" class="w195btn flag" data-w195step="decline">Decline</button></div>' + (why && !none ? '<p class="w195muted">' + E(why) + '.</p>' : '');
  }
  function paintSheet() {
    var d = S.det; if (!d) return;
    var q = d.request, waiting = q.status === 'requested', fn = d.first_name || first(d.name);
    var h = '<p class="w195k">' + E(kindL(q.kind)) + (q.lang === 'fr' ? ' · the letter is in French' : '') + '</p><h2>' + E(d.name || 'A volunteer') + '</h2>' +
      '<p><span class="w195st ' + E(q.status) + '">' + E(STATUS[q.status] || q.status) + '</span> <span class="w195muted">asked ' + E(fmtDay(q.created_at, true)) + '</span></p>' +
      (S.sheetOk ? '<div class="w195ok" role="status">' + E(S.sheetOk) + '</div>' : '') + (S.sheetErr ? '<div class="w195warn" role="alert">' + E(S.sheetErr) + '</div>' : '');
    h += '<h3>What they asked for</h3><div class="w195box"><dl>' + dt('Kind', kindL(q.kind)) +
      dt('For', q.for_org || 'Not said: the letter is addressed to whom it may concern') + (q.purpose ? dt('What for', q.purpose) : '') +
      (q.kind !== 'recognition' ? dt('Dates', q.period_from || q.period_to ? (q.period_from ? fmtDay(q.period_from) : 'their first serving') + ' to ' + (q.period_to ? fmtDay(q.period_to) : 'today') : 'All their servings') : '') +
      (q.notes ? '<dt>Their note</dt><dd class="w195q">' + E(q.notes) + '</dd>' : '') +
      (q.kind === 'form' ? '<dt>Their form</dt><dd>' + E(q.form_name || 'Their form') + (q.form_bytes ? ' <span class="w195muted">(' + Math.max(1, Math.round(q.form_bytes / 1024)) + ' KB)</span>' : '') +
        ' <button type="button" class="w195link" data-w195form="1">Open it</button></dd>' : '') +
      dt('Email', d.email || 'None on file') + '</dl></div>';
    h += '<h3>Their record</h3><div class="w195box">' + E(plural(Number(d.all_count || 0), 'confirmed serving', 'confirmed servings') + ', about ' + num(d.all_hours) + ' hours' +
      (d.first ? ', from ' + fmtDay(d.first) + ' to ' + fmtDay(d.last) : '') + '.') + ((d.roles || []).filter(Boolean).length ? ' <span class="w195muted">' + E(d.roles.filter(Boolean).join(', ')) + '</span>' : '') +
      (d.request.person_id ? ' <a class="w195link" href="#volunteering/people" data-w195person="' + Number(d.request.person_id) + '">Their volunteer record</a>' : '') + '</div>';
    if (q.status === 'signed') {
      h += '<h3>Signed</h3><div class="w195box"><dl>' + dt('Signed', fmtDay(q.signed_at, true) + (q.signer_name ? ' by ' + q.signer_name + (q.signer_title ? ', ' + q.signer_title : '') : '')) +
        dt('Reference', q.reference || '') + (q.kind !== 'recognition' ? dt('Listed', plural(Number(q.servings || 0), 'serving', 'servings') + ', ' + num(q.hours) + ' hours') : '') +
        dt('Emailed', q.emailed_at ? fmtDay(q.emailed_at, true) : 'Not emailed') + '</dl></div><div class="w195acts"><button type="button" class="w195btn" data-w195letter="1">Open the signed PDF</button></div>';
    } else if (q.status === 'declined') {
      h += '<h3>Declined</h3><div class="w195box"><dl>' + dt('When', fmtDay(q.declined_at, true)) + (q.declined_by ? dt('By', q.declined_by) : '') +
        '<dt>Our note to them</dt><dd class="w195q">' + E(q.decline_reason || '') + '</dd></dl></div>';
    } else if (waiting && !d.can_sign) {
      h += '<div class="w195box">Only a signer can sign or decline. Admins, the Operations leads and the people an admin assigns sign these letters.</div>';
    } else if (waiting) {
      if (!ready()) h += '<div class="w195warn">Add your signature, name and title before you sign. <button type="button" class="w195link" data-w195mine="1">Open My signature</button></div>';
      if (q.kind !== 'recognition') h += servingsHtml();
      if (q.kind === 'recognition') {
        h += '<h3>Your words</h3><p class="w195muted">The letter already says when ' + E(fn || 'they') + ' started, their servings, hours and roles. Add a few lines of your own if you like: what they bring, a moment that stood out. A blank line starts a new paragraph.</p>' +
          '<label class="sr" for="w195note">Your words</label><textarea id="w195note" maxlength="1500">' + E(S.note) + '</textarea>';
      }
      if (q.kind === 'form') h += placementHtml();
      h += actionsHtml();
      if (S.preview) {
        h += '<h3 id="w195pv">Preview</h3><p class="w195muted"><span id="w195stale">' + (S.stale ? STALE : '') + '</span>Marked PREVIEW; the signed copy carries its reference instead. ' +
          '<a href="' + E(S.preview.url) + '" target="_blank" rel="noopener">Open it in a new tab</a></p><iframe src="' + E(S.preview.url) + '" title="Preview of the PDF"></iframe>';
      }
    }
    sheet(h);
  }
  /* a change after the preview: say so where the preview is, without drawing the sheet again */
  var STALE = '<b>Before your last change.</b> Preview again to see it. ';
  function stale() {
    if (!S.preview || S.stale) return;
    S.stale = true;
    var n = document.getElementById('w195stale'); if (n) n.innerHTML = STALE;
  }
  async function preview() {
    if (S.previewBusy || !S.det) return;
    S.previewBusy = true; S.sheetErr = ''; S.sheetOk = ''; paintSheet();
    var r = await call(bodyFor('preview'));
    S.previewBusy = false;
    if (r.ok && r.data.url) {
      S.preview = { url: r.data.url, pages: r.data.pages }; S.stale = false; paintSheet();
      var f = document.getElementById('w195pv'); if (f) { try { f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* fine */ } }
    } else { S.sheetErr = words(r.error); paintSheet(); }
  }
  function mailWords(m) {
    m = m || {};
    if (m.skipped) return 'No email sent.';
    var st = String(m.status || '');
    if (st === 'sent' || st === 'queued') return 'The volunteer was emailed.';
    if (/test/.test(st) || /test/i.test(String(m.note || ''))) return 'The Hub’s email is in test mode, so the email went to the test recipients.';
    return 'The email did not go out (' + (m.note || m.error || st || 'no reason given') + '); the PDF is on their profile.';
  }
  async function sign() {
    if (S.busy || !S.det) return;
    var id = S.det.request.id;
    S.busy = true; S.sheetErr = ''; paintSheet();
    var r = await call(bodyFor('sign'));
    S.busy = false;
    if (r.ok && r.data.ok) {
      T('Signed: ' + r.data.reference);
      S.step = ''; S.preview = null; S.sheetOk = 'Signed. Reference ' + r.data.reference + '. ' + mailWords(r.data.email);
      await fill(id); load(); counts();
    } else { S.step = 'confirm'; S.sheetErr = words(r.error); paintSheet(); }
  }
  async function decline() {
    if (S.busy || !S.det) return;
    var reason = String(S.reason || '').trim(), id = S.det.request.id, fn = first(S.det.name) || 'They';
    if (reason.length < 3) { S.sheetErr = 'Say why in a few words: the volunteer sees it.'; paintSheet(); return; }
    S.busy = true; S.sheetErr = ''; paintSheet();
    var r = await rpc('signoff_decline', { p_id: id, p_reason: reason });
    S.busy = false;
    if (r.error) { S.sheetErr = msgOf(r.error); paintSheet(); return; }
    T('Declined'); S.step = ''; S.sheetOk = 'Declined. ' + fn + ' sees your note on their profile.';
    await fill(id); load(); counts();
  }
  async function openFile(action) {
    var w = null;
    try { w = window.open('about:blank', '_blank'); if (w) w.opener = null; } catch (e) { w = null; }
    var r = await call({ action: action, id: S.det.request.id });
    if (r.ok && r.data.url) { if (w) w.location.href = r.data.url; else window.location.href = r.data.url; }
    else { try { if (w) w.close(); } catch (e) { /* fine */ } T(words(r.error)); }
  }
  function onSheetClick(e) {
    var t = e.target;
    if (t && t.id === 'w195sheet') { closeSheet(); return; }
    var el = t && t.closest ? t.closest('button, a[data-w195person]') : null; if (!el) return;
    if (el.hasAttribute('data-w195close')) closeSheet();
    else if (el.hasAttribute('data-w195form')) openFile('form_url');
    else if (el.hasAttribute('data-w195letter')) openFile('letter_url');
    else if (el.hasAttribute('data-w195preview')) preview();
    else if (el.hasAttribute('data-w195step')) {
      S.step = el.getAttribute('data-w195step'); S.sheetErr = ''; paintSheet();
      var f = document.getElementById(S.step === 'decline' ? 'w195reason' : S.step === 'confirm' ? 'w195notify' : ''); if (f) { try { f.focus(); } catch (x) { /* fine */ } }
    }
    else if (el.hasAttribute('data-w195sign')) sign();
    else if (el.hasAttribute('data-w195decline')) decline();
    else if (el.hasAttribute('data-w195mine')) openMine();
    else if (el.hasAttribute('data-w195person')) closeSheet();
    else mineClick(el);
  }
  function onSheetInput(e) {
    var t = e.target; if (!t) return;
    if (t.hasAttribute('data-w195h') && S.items) {
      var i = Number(t.getAttribute('data-w195h')), v = Number(t.value);
      if (S.items[i] && isFinite(v) && v > 0 && v <= 24) { S.items[i].hours = Math.round(v * 4) / 4; var tot = document.getElementById('w195tot'); if (tot) tot.textContent = totText(); stale(); }
    }
    else if (t.id === 'w195note') { S.note = t.value; stale(); }
    else if (t.id === 'w195reason') S.reason = t.value;
    else if (t.id === 'w195pgn') { S.page = String(Math.max(1, Math.floor(Number(t.value) || 1))); var rb = document.querySelector('#w195sheet input[name="w195pg"][value="n"]'); if (rb) rb.checked = true; stale(); }
    else mineInput(t);
  }
  function onSheetChange(e) {
    var t = e.target; if (!t) return;
    if (t.hasAttribute('data-w195on') && S.items) { var i = Number(t.getAttribute('data-w195on')); if (S.items[i]) S.items[i].on = t.checked; stale(); paintSheet(); }
    else if (t.name === 'w195pg') { S.page = t.value === 'n' ? String(Math.max(1, Number((document.getElementById('w195pgn') || {}).value) || 1)) : ''; stale(); }
    else if (t.name === 'w195pl') { S.place = t.value; stale(); }
    else if (t.name === 'w195sz') { S.size = t.value; stale(); }
    else if (t.id === 'w195cap') { S.caption = t.checked; stale(); }
    else if (t.id === 'w195add') { S.addPage = t.checked; stale(); }
    else if (t.id === 'w195notify') { S.notify = t.checked; paintSheet(); }
    else mineChange(t);
  }
