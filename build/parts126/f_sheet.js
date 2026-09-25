
  /* ---------- the sheet ---------- */
  function sheetEl() {
    var el = document.getElementById('w126sheet');
    if (!el) { el = document.createElement('div'); el.id = 'w126sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
    return el;
  }
  function openSheet(kind, kicker, title, body, foot) {
    var el = sheetEl();
    el.innerHTML = '<div class="bk" data-w126close="1"></div><div class="pane"><div class="ph"><div><div class="kk">' + E(kicker) + '</div><h2>' + E(title) + '</h2></div><span class="sp"></span><button type="button" class="xb" data-w126close="1" aria-label="Close">' + I('x') + '</button></div><div class="pb">' + body + '</div>' + (foot ? '<div class="pf">' + foot + '</div>' : '') + '</div>';
    el.classList.add('on'); B.sheet = kind;
    var f = el.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea,select'); if (f && kind.indexOf('form') >= 0) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function closeSheet() { var el = document.getElementById('w126sheet'); if (el) { el.classList.remove('on'); el.innerHTML = ''; } B.sheet = null; }
  function sheetErr(m) { var e = document.querySelector('#w126sheet .err'); if (e) e.textContent = m || ''; }
  function afterSave(msg) {
    toastS(msg); closeSheet(); repaint();
    /* refresh from the database; the offline copy (no board_home) keeps what was just saved */
    if (B.data && B.data.me && B.data.me.fallback) return Promise.resolve();
    B.loaded = 0; return load(true).then(repaint);
  }
  function repaint() { if (onPage('governance')) govPaint(); if (onPage('committees')) comPaint(); }
  function nowIso() { return new Date().toISOString(); }
  async function run(p) { var r = await p; if (r && r.error) throw r.error; return r; }

  /* log a touchpoint (or change your own) */
  function openLog(key, tp) {
    var c = commByKey(key) || comms()[0]; if (!c) return;
    var t = tp || null, kind = t ? t.kind : 'internal';
    var n = nextMeeting(), meets = boardMeetings().filter(function (m) { return m.status !== 'held' && m.status !== 'cancelled'; });
    var admin = amAdmin(), me0 = meId();
    var who = admin ? '<label>On behalf of<select name="member_id">' + '<option value="">Nobody in particular</option>' + directors().map(function (m) { return '<option value="' + m.id + '"' + (String((t ? t.member_id : me0)) === String(m.id) ? ' selected' : '') + '>' + E(m.full_name || m.name) + (inCommittee(c, m.id) ? '' : ' (not on this committee)') + '</option>'; }).join('') + '</select></label>' : '';
    var body = '<form data-w126logform="' + E(c.key) + '"' + (t ? ' data-id="' + t.id + '"' : '') + '>'
      + '<div class="kinds">' + KINDS.map(function (k) { return '<label><input type="radio" name="kind" value="' + k[0] + '"' + (k[0] === kind ? ' checked' : '') + '><div>' + E(k[1]) + '<span>' + E(k[2]) + '</span></div></label>'; }).join('') + '</div>'
      + '<div class="two"><label>When<input type="date" name="happened_on" value="' + E(t ? t.happened_on : ymd(today())) + '"></label><label>With whom<input type="text" name="with_whom" value="' + E(t ? t.with_whom || '' : '') + '" placeholder="For example: Amanda, the fundraising lead"></label></div>'
      + '<label>What we learned<textarea name="summary" placeholder="The real picture: what is working, what is stuck, what they need">' + E(t ? t.summary || '' : '') + '</textarea></label>'
      + '<label>Recommendation for the board <small>optional unless this is the recommendation</small><textarea name="recommendation" placeholder="What the committee recommends, and why">' + E(t ? t.recommendation || '' : '') + '</textarea></label>'
      + (meets.length ? '<label>For the board meeting<select name="meeting_id"><option value="">None in particular</option>' + meets.map(function (m) { return '<option value="' + m.id + '"' + (String(t ? t.meeting_id : (n && n.id)) === String(m.id) ? ' selected' : '') + '>' + E(m.title) + (m.meets_at ? ', ' + E(fmtDay(dayOfIso(m.meets_at), true)) : '') + '</option>'; }).join('') + '</select></label>' : '')
      + who + '<div class="err" data-w126err="1"></div></form>';
    openSheet('logform', c.name + ' committee', t ? 'Change the entry' : 'Log a touchpoint', body,
      (t ? '<button type="button" class="w126btn danger sm" data-w126tpdel="' + t.id + '">Delete</button>' : '') + '<span class="sp"></span><button type="button" class="w126btn ghost" data-w126close="1">Cancel</button><button type="button" class="w126btn" data-w126logsave="1">' + I('check') + (t ? 'Save' : 'Log it') + '</button>');
  }
  var saving = false;
  async function saveLog() {
    var f = document.querySelector('#w126sheet form[data-w126logform]'); if (!f || saving) return;
    var key = f.getAttribute('data-w126logform'), id = f.getAttribute('data-id');
    var g = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    var kind = (f.querySelector('input[name=kind]:checked') || {}).value || 'note';
    var row = { committee: key, kind: kind, happened_on: g('happened_on') || ymd(today()), with_whom: g('with_whom') || null, summary: g('summary') || null, recommendation: g('recommendation') || null, meeting_id: g('meeting_id') ? Number(g('meeting_id')) : null, updated_at: nowIso() };
    if (!row.summary && !row.recommendation) { sheetErr('Write what you learned, or the recommendation.'); return; }
    if (kind === 'recommendation' && !row.recommendation) { row.recommendation = row.summary; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.happened_on)) { sheetErr('Pick the date.'); return; }
    var sel = f.querySelector('[name=member_id]');
    if (sel) row.member_id = sel.value ? Number(sel.value) : null; else if (!id) row.member_id = meId();
    saving = true;
    try {
      if (id) { await run(db.from('board_touchpoints').update(row).eq('id', Number(id))); var tpl = tps().filter(function (x) { return String(x.id) === String(id); })[0]; if (tpl) Object.assign(tpl, row); }
      else { row.logged_by_name = myName(); await run(db.from('board_touchpoints').insert(row)); }
      if (!id) { /* show it right away, also where the database copy is slow to come back */ D().touchpoints.unshift(Object.assign({ id: -Date.now(), logged_by_email: myEmail(), created_at: nowIso() }, row)); }
      await afterSave(id ? 'Saved' : 'Logged. It counts toward the ' + (commByKey(key) || {}).name + ' committee’s cycle.');
    } catch (e) { sheetErr('Could not save: ' + String((e && e.message) || e).slice(0, 120)); }
    finally { saving = false; }
  }
  async function deleteTp(id) {
    if (!window.confirm('Delete this entry?')) return;
    try { await run(db.from('board_touchpoints').delete().eq('id', Number(id))); B.data.touchpoints = B.data.touchpoints.filter(function (t) { return String(t.id) !== String(id); }); await afterSave('Deleted'); }
    catch (e) { sheetErr('Could not delete it: ' + String((e && e.message) || e).slice(0, 100)); }
  }
  function openTp(id) {
    var t = tps().filter(function (x) { return String(x.id) === String(id); })[0]; if (!t) return;
    var c = commByKey(t.committee) || {}, k = KIND[t.kind] || KIND.note, own = lower(t.logged_by_email) === myEmail() || amAdmin();
    var body = '<dl class="kv"><dt>Committee</dt><dd>' + E(c.name || t.committee) + '</dd><dt>When</dt><dd>' + E(fmtDay(parseDay(t.happened_on), true)) + '</dd>'
      + (t.with_whom ? '<dt>With</dt><dd>' + E(t.with_whom) + '</dd>' : '') + '<dt>Logged by</dt><dd>' + E(memberName(t.member_id) || t.logged_by_name || t.logged_by_email || '') + '</dd></dl>'
      + (t.summary ? '<div>' + E(t.summary).replace(/\n/g, '<br>') + '</div>' : '')
      + (t.recommendation ? '<div class="quote"><b>Recommendation:</b> ' + E(t.recommendation).replace(/\n/g, '<br>') + '</div>' : '');
    openSheet('tp', c.name ? c.name + ' committee' : 'Committee', k[1], body, own ? '<span class="sp"></span><button type="button" class="w126btn ghost" data-w126tpedit="' + t.id + '">' + I('pen') + 'Change it</button>' : '');
  }

  /* a director */
  function openDirector(id) {
    var m = memberById(id); if (!m) return;
    var cs = committeesOf(m.id), my = tps().filter(function (t) { return String(t.member_id) === String(m.id); }), ts = tasksOf(m), r = renewalState(m);
    var body = '<dl class="kv"><dt>Seat</dt><dd>' + E(m.seat || 'Director') + '</dd>' + (m.renewal || r ? '<dt>Term</dt><dd>' + E(r ? r.t : m.renewal) + '</dd>' : '') + (m.note ? '<dt>Note</dt><dd>' + E(m.note) + '</dd>' : '') + '</dl>'
      + '<div><div class="kk" style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted);margin-bottom:6px">Committees</div>' + (cs.length ? cs.map(function (c) { var st = steps(c); return '<div class="w126cm"><div class="row" style="--c:' + E(c.color || GREEN) + '"><b><i></i>' + E(c.name) + (String(c.chair_id) === String(m.id) ? ' <span class="ch">Chair</span>' : '') + '</b><span class="w126dots">' + st.map(function (s) { return '<i class="' + (s.done ? 'on' : '') + '" title="' + E(s.t) + '"></i>'; }).join('') + '</span><small>' + stepsDone(c) + ' of 4</small></div></div>'; }).join('') : '<p class="w126empty">Not on a committee yet.</p>') + '</div>'
      + '<div><div class="kk" style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted);margin-bottom:6px">What ' + E(m.name) + ' logged</div>' + (my.length ? my.slice(0, 8).map(logRowHtml).join('') : '<p class="w126empty">Nothing logged yet.</p>') + '</div>'
      + (ts.length ? '<div><div class="kk" style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted);margin-bottom:6px">Board tasks</div>' + ts.map(function (t) { return '<div class="w126goal"><b>' + E(t.title) + '</b>' + stTag(t.done ? 'done' : 'todo').replace(/>[^<]*<\/span>$/, '>' + E(t.done ? 'Done' : (t.status || 'Open')) + '</span>') + '</div>'; }).join('') + '</div>' : '');
    openSheet('director', m.status === 'active' ? 'Director' : 'Board', m.full_name || m.name, body, amAdmin() ? '<span class="sp"></span><button type="button" class="w126btn ghost" data-w126medit="' + m.id + '">' + I('pen') + 'Edit the seat and term</button>' : '');
  }
  function openMemberEdit(id) {
    var m = memberById(id); if (!m) return;
    var body = '<form data-w126mform="' + m.id + '"><div class="two"><label>Seat<input type="text" name="seat" value="' + E(m.seat || '') + '"></label><label>Status<select name="status">' + ['active', 'adviser', 'resigned', 'former'].map(function (s) { return '<option' + (m.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label></div>'
      + '<div class="two"><label>Term runs to <small>as said, for example Q3 2026</small><input type="text" name="renewal" value="' + E(m.renewal || '') + '"></label><label>Renewal date<input type="date" name="renewal_due" value="' + E(m.renewal_due || '') + '"></label></div>'
      + '<label>Emails they sign in with <small>comma separated</small><input type="text" name="emails" value="' + E((m.emails || []).join(', ')) + '"></label>'
      + '<label>Note<textarea name="note">' + E(m.note || '') + '</textarea></label><div class="err"></div></form>';
    openSheet('mform', 'Director', m.full_name || m.name, body, '<span class="sp"></span><button type="button" class="w126btn ghost" data-w126close="1">Cancel</button><button type="button" class="w126btn" data-w126msave="1">' + I('check') + 'Save</button>');
  }
  async function saveMember() {
    var f = document.querySelector('#w126sheet form[data-w126mform]'); if (!f || saving) return;
    var g = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    var row = { seat: g('seat') || null, status: g('status') || 'active', renewal: g('renewal') || null, renewal_due: g('renewal_due') || null, emails: g('emails').split(/[,\s]+/).map(lower).filter(function (x) { return /@/.test(x); }), note: g('note') || null, updated_at: nowIso(), updated_by: myName() };
    saving = true;
    try { await run(db.from('board_members').update(row).eq('id', Number(f.getAttribute('data-w126mform')))); var m = memberById(f.getAttribute('data-w126mform')); if (m) Object.assign(m, row); await afterSave('Saved'); }
    catch (e) { sheetErr('Could not save: ' + String((e && e.message) || e).slice(0, 120)); }
    finally { saving = false; }
  }

  /* an item under one of the three jobs */
  function openItem(id, job) {
    var it = id ? D().items.filter(function (i) { return String(i.id) === String(id); })[0] : null;
    if (id && !it) return;
    var j = JOB[(it && it.job) || job] || JOBS[0], edit = canEditItems();
    if (!edit && it) {
      var body = '<div>' + stTag(it.status) + '</div>' + (it.detail ? '<div>' + E(it.detail) + '</div>' : '') + '<dl class="kv">' + (it.owner ? '<dt>Owner</dt><dd>' + E(it.owner) + '</dd>' : '') + (it.due ? '<dt>Due</dt><dd>' + E(it.due) + '</dd>' : '') + (it.source ? '<dt>From</dt><dd>' + E(it.source) + '</dd>' : '') + '</dl>';
      openSheet('item', j.t, it.title, body, ''); return;
    }
    var st = (it && it.status) || 'todo';
    var body2 = '<form data-w126iform="' + (it ? it.id : '') + '" data-job="' + j.k + '">'
      + '<label>Title<input type="text" name="title" value="' + E(it ? it.title : '') + '"></label>'
      + '<div><div style="font-size:12.5px;font-weight:700;color:#4a4945;margin-bottom:6px">Where it stands</div><div class="sts">' + Object.keys(ST).map(function (k) { return '<button type="button" data-w126st="' + k + '" class="' + (k === st ? 'on' : '') + '">' + E(ST[k][0]) + '</button>'; }).join('') + '</div><input type="hidden" name="status" value="' + st + '"></div>'
      + '<label>Detail<textarea name="detail">' + E(it ? it.detail || '' : '') + '</textarea></label>'
      + '<div class="two"><label>Owner<input type="text" name="owner" value="' + E(it ? it.owner || '' : '') + '"></label><label>Due<input type="text" name="due" value="' + E(it ? it.due || '' : '') + '" placeholder="For example: Q3 board meeting"></label></div>'
      + (it && it.source ? '<p class="w126empty">From ' + E(it.source) + '.</p>' : '') + '<div class="err"></div></form>';
    openSheet('iform', j.t, it ? 'Update the item' : 'Add an item', body2, (it && amAdmin() ? '<button type="button" class="w126btn danger sm" data-w126idel="' + it.id + '">Delete</button>' : '') + '<span class="sp"></span><button type="button" class="w126btn ghost" data-w126close="1">Cancel</button><button type="button" class="w126btn" data-w126isave="1">' + I('check') + 'Save</button>');
  }
  async function saveItem() {
    var f = document.querySelector('#w126sheet form[data-w126iform]'); if (!f || saving) return;
    var g = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    var id = f.getAttribute('data-w126iform');
    var row = { title: g('title'), status: g('status') || 'todo', detail: g('detail') || null, owner: g('owner') || null, due: g('due') || null, updated_at: nowIso(), updated_by: myName() };
    if (!row.title) { sheetErr('Give it a title.'); return; }
    saving = true;
    try {
      if (id) { await run(db.from('board_items').update(row).eq('id', Number(id))); var it = D().items.filter(function (i) { return String(i.id) === String(id); })[0]; if (it) Object.assign(it, row); }
      else { row.job = f.getAttribute('data-job'); row.sort = 900; row.source = 'Added in the Hub by ' + myName(); await run(db.from('board_items').insert(row)); D().items.push(Object.assign({ id: -Date.now() }, row)); }
      await afterSave('Saved');
    } catch (e) { sheetErr('Could not save: ' + String((e && e.message) || e).slice(0, 120)); }
    finally { saving = false; }
  }
  async function deleteItem(id) {
    if (!window.confirm('Delete this item?')) return;
    try { await run(db.from('board_items').delete().eq('id', Number(id))); B.data.items = B.data.items.filter(function (i) { return String(i.id) !== String(id); }); await afterSave('Deleted'); }
    catch (e) { sheetErr('Could not delete it'); }
  }

  /* a committee's roster */
  function openCommitteeEdit(key) {
    var c = commByKey(key); if (!c) return;
    var ds = directors();
    var body = '<form data-w126cform="' + c.key + '"><label>Chair<select name="chair_id"><option value="">To name</option>' + ds.map(function (m) { return '<option value="' + m.id + '"' + (String(c.chair_id) === String(m.id) ? ' selected' : '') + '>' + E(m.full_name || m.name) + '</option>'; }).join('') + '</select></label>'
      + '<div class="chk"><label><input type="checkbox" name="chair_confirmed"' + (c.chair_confirmed ? ' checked' : '') + '> The board confirmed the chair</label></div>'
      + '<div><div style="font-size:12.5px;font-weight:700;color:#4a4945;margin-bottom:6px">Directors on the committee</div><div class="chk">' + ds.map(function (m) { return '<label><input type="checkbox" name="member" value="' + m.id + '"' + ((c.member_ids || []).map(String).indexOf(String(m.id)) >= 0 ? ' checked' : '') + '>' + E(m.name) + '</label>'; }).join('') + '</div></div>'
      + '<label>Internal leads <small>the team leads the committee meets, comma separated</small><input type="text" name="internal_leads" value="' + E((c.internal_leads || []).join(', ')) + '"></label>'
      + '<label>To recruit <small>the outside professional the committee brings in</small><input type="text" name="external_recruit" value="' + E(c.external_recruit || '') + '"></label>'
      + '<label>What the committee covers<textarea name="purpose">' + E(c.purpose || '') + '</textarea></label><div class="err"></div></form>';
    openSheet('cform', 'Committee', c.name, body, '<span class="sp"></span><button type="button" class="w126btn ghost" data-w126close="1">Cancel</button><button type="button" class="w126btn" data-w126csave="1">' + I('check') + 'Save</button>');
  }
  async function saveCommittee() {
    var f = document.querySelector('#w126sheet form[data-w126cform]'); if (!f || saving) return;
    var key = f.getAttribute('data-w126cform');
    var g = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    var ids = Array.prototype.map.call(f.querySelectorAll('input[name=member]:checked'), function (x) { return Number(x.value); });
    var chair = g('chair_id') ? Number(g('chair_id')) : null;
    if (chair && ids.indexOf(chair) < 0) ids.unshift(chair);
    var row = { chair_id: chair, chair_confirmed: !!(f.querySelector('input[name=chair_confirmed]') || {}).checked, member_ids: ids, internal_leads: g('internal_leads').split(',').map(function (x) { return x.trim(); }).filter(Boolean), external_recruit: g('external_recruit') || null, purpose: g('purpose') || null, updated_at: nowIso(), updated_by: myName() };
    saving = true;
    try { await run(db.from('board_committees').update(row).eq('key', key)); var c = commByKey(key); if (c) Object.assign(c, row); await afterSave('Saved'); }
    catch (e) { sheetErr('Could not save: ' + String((e && e.message) || e).slice(0, 120)); }
    finally { saving = false; }
  }

  /* a board meeting */
  function openMeeting(id) {
    var m = id && id !== 'new' ? D().meetings.filter(function (x) { return String(x.id) === String(id); })[0] : null;
    var d = m && m.meets_at ? new Date(m.meets_at) : null;
    var dv = d ? d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }) : '', tv = d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' }) : '18:00';
    var body = '<form data-w126meetform="' + (m ? m.id : '') + '"><label>Title<input type="text" name="title" value="' + E(m ? m.title : 'Board meeting') + '"></label>'
      + '<div class="two"><label>Date<input type="date" name="date" value="' + E(dv) + '"></label><label>Time (Toronto)<input type="time" name="time" value="' + E(tv) + '"></label></div>'
      + '<div class="two"><label>Kind<select name="kind">' + [['board', 'Board meeting'], ['special', 'Special meeting'], ['agm', 'AGM'], ['strategy', 'Strategy session']].map(function (k) { return '<option value="' + k[0] + '"' + ((m ? m.kind : 'board') === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></label>'
      + '<label>Status<select name="status">' + ['scheduled', 'tentative', 'to schedule', 'held', 'cancelled'].map(function (s) { return '<option' + ((m ? m.status : 'scheduled') === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label></div>'
      + '<div class="two"><label>Agenda link<input type="url" name="agenda_url" value="' + E(m ? m.agenda_url || '' : '') + '"></label><label>Minutes link<input type="url" name="notes_url" value="' + E(m ? m.notes_url || '' : '') + '"></label></div>'
      + '<label>Note<textarea name="note">' + E(m ? m.note || '' : '') + '</textarea></label><div class="err"></div></form>';
    openSheet('meetform', 'Board meetings', m ? 'Change the meeting' : 'Schedule a meeting', body, '<span class="sp"></span><button type="button" class="w126btn ghost" data-w126close="1">Cancel</button><button type="button" class="w126btn" data-w126meetsave="1">' + I('check') + 'Save</button>');
  }
  function torontoIso(date, time) {
    /* the offset for America/Toronto on that date (EDT or EST), without a timezone library */
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); if (!p) return null;
    var t = /^(\d{2}):(\d{2})$/.exec(time || '18:00') || [0, '18', '00'];
    var probe = new Date(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3]), 12, 0, 0));
    var tzHour = Number(probe.toLocaleString('en-US', { timeZone: 'America/Toronto', hour: '2-digit', hour12: false }));
    var off = 12 - tzHour; /* 4 in summer, 5 in winter */
    return p[1] + '-' + p[2] + '-' + p[3] + 'T' + t[1] + ':' + t[2] + ':00-' + pad(off) + ':00';
  }
  async function saveMeeting() {
    var f = document.querySelector('#w126sheet form[data-w126meetform]'); if (!f || saving) return;
    var g = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    var id = f.getAttribute('data-w126meetform');
    var row = { title: g('title') || 'Board meeting', kind: g('kind') || 'board', status: g('status') || 'scheduled', meets_at: g('date') ? torontoIso(g('date'), g('time')) : null, agenda_url: g('agenda_url') || null, notes_url: g('notes_url') || null, note: g('note') || null, updated_at: nowIso(), updated_by: myName() };
    if (!row.meets_at && row.status !== 'to schedule') { sheetErr('Pick the date, or set the status to "to schedule".'); return; }
    saving = true;
    try {
      if (id) { await run(db.from('board_meetings').update(row).eq('id', Number(id))); var m = D().meetings.filter(function (x) { return String(x.id) === String(id); })[0]; if (m) Object.assign(m, row); }
      else { await run(db.from('board_meetings').insert(row)); D().meetings.push(Object.assign({ id: -Date.now() }, row)); }
      normalize(B.data); await afterSave('Saved');
    } catch (e) { sheetErr('Could not save: ' + String((e && e.message) || e).slice(0, 120)); }
    finally { saving = false; }
  }
