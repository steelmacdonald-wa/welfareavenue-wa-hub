
  /* ---------- the sheet: one request or one email ---------- */
  var lastFocus = null;
  function sheetEl() {
    var s = document.getElementById('w123sheet');
    if (!s) {
      s = document.createElement('div'); s.id = 'w123sheet';
      s.innerHTML = '<div class="bk" data-w123close></div><div class="pane" role="dialog" aria-modal="true" aria-label="Details"><div class="in"></div></div>';
      document.body.appendChild(s);
    }
    return s;
  }
  function findReq(id) { return R.reqs.filter(function (r) { return String(r.id) === String(id); })[0] || null; }
  function findMail(id) { return R.mail.filter(function (m) { return String(m.id) === String(id); })[0] || null; }
  async function openSheet(k, id, inPlace) {
    if (!R.sheet) lastFocus = document.activeElement;
    R.sheet = { k: k, id: String(id), inPlace: !!inPlace, busy: true };
    var s = sheetEl(); s.classList.add('on');
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) { /* fine */ }
    renderSheet();
    if (!R.loaded) await load();
    if (k === 'r' && !findReq(id)) { var f = await q(db.from('dept_requests').select('*').eq('id', id).maybeSingle()); if (f.data) { R.reqs.push(f.data); bump(); } }
    if (k === 'm' && !findMail(id)) { var g = await q(db.from('hub_mail').select(MAILCOLS).eq('id', id).maybeSingle()); if (g.data) { R.mail.push(g.data); bump(); } }
    await loadThread(k, id);
    if (!R.sheet || R.sheet.id !== String(id)) return;
    R.sheet.busy = false;
    renderSheet();
    setTimeout(function () { var x = document.querySelector('#w123sheet .x'); if (x) { try { x.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }, 30);
  }
  function closeSheet(fromRoute) {
    var s = document.getElementById('w123sheet');
    var was = R.sheet; R.sheet = null;
    if (s) { s.classList.remove('on'); var inn = s.querySelector('.in'); if (inn) inn.innerHTML = ''; }
    try { document.documentElement.style.overflow = ''; } catch (e) { /* fine */ }
    if (!fromRoute && was && !was.inPlace) {
      var h = decodeURIComponent(location.hash || '');
      if (/^#requests\/(r|m)\//.test(h)) { try { history.replaceState(null, '', baseHash()); } catch (e) { /* fine */ } if (onPage()) paint(); }
    }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    lastFocus = null;
    injectCard(true);
  }
  function baseHash() {
    if (R.view === 'mine') return '#requests/mine';
    if (R.view === 'team') return '#requests/team/' + (R.tm.d || homeTeam());
    if (R.view === 'all') return '#requests/all';
    if (R.view === 'settings') return '#requests/settings';
    if (R.nw.sent) return '#requests/new';
    return '#requests/new' + (R.nw.d ? '/' + R.nw.d + (R.nw.type ? '/' + R.nw.type : '') : '');
  }
  function renderSheet() {
    var s = document.getElementById('w123sheet'); if (!s || !R.sheet) return;
    var inn = s.querySelector('.in'); if (!inn) return;
    var keep = null, ta = inn.querySelector('textarea[data-w123note]');
    if (ta && ta.value) keep = ta.value;
    var html;
    if (R.sheet.k === 'r') { var r = findReq(R.sheet.id); html = r ? sheetReq(r) : (R.sheet.busy ? loadingSheet() : missingSheet('That request is not in the Hub any more.')); }
    else { var m = findMail(R.sheet.id); html = m ? sheetMail(m) : (R.sheet.busy ? loadingSheet() : missingSheet('That email is not in the team inbox. Leaders can find every email on the Hub inbox page.')); }
    inn.innerHTML = html;
    if (keep) { var t2 = inn.querySelector('textarea[data-w123note]'); if (t2) t2.value = keep; }
  }
  function closeBtn() { return '<button type="button" class="x" data-w123close aria-label="Close">' + I('x') + '</button>'; }
  function loadingSheet() { return '<div class="top"><span class="sp"></span>' + closeBtn() + '</div><p class="w123empty">Loading…</p>'; }
  function missingSheet(t) { return '<div class="top"><span class="sp"></span>' + closeBtn() + '</div><p class="w123empty">' + E(t) + '</p>'; }
  function linkify(v) {
    var s = String(v == null ? '' : v);
    if (/^https?:\/\/\S+$/i.test(s.trim())) return '<a class="w123lnk" href="' + E(s.trim()) + '" target="_blank" rel="noopener">' + E(clip(s.trim(), 70)) + '</a>';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return E(fmtLong(s.trim()));
    return E(s).replace(/(https?:\/\/[^\s<]+)/g, function (u) { return '<a class="w123lnk" href="' + u + '" target="_blank" rel="noopener">' + clip(u, 60) + '</a>'; });
  }
  function detailsHtml(det) {
    if (det == null || det === '' || (typeof det === 'object' && !Array.isArray(det) && !Object.keys(det).length)) return '<p class="w123sub" style="margin:0">No details were given.</p>';
    if (typeof det === 'string') return '<div class="prose">' + linkify(det) + '</div>';
    if (Array.isArray(det)) return '<div class="prose">' + linkify(det.join('\n')) + '</div>';
    return '<dl>' + Object.keys(det).map(function (k) { return '<dt>' + E(k) + '</dt><dd>' + linkify(det[k]) + '</dd>'; }).join('') + '</dl>';
  }
  function assigneeOptions(d, cur) {
    var team = teamMembers(d).map(function (m) { return m.name; });
    var rest = members().filter(function (m) { return m.department !== d && m.active !== false; }).map(function (m) { return m.name; }).sort();
    var has = function (n) { return lower(n) === lower(cur); };
    var o = '<option value="">Nobody yet</option>';
    if (team.length) o += '<optgroup label="' + E(teamShort(d)) + '">' + team.map(function (n) { return '<option value="' + E(n) + '"' + (has(n) ? ' selected' : '') + '>' + E(n) + '</option>'; }).join('') + '</optgroup>';
    if (rest.length) o += '<optgroup label="Everyone else">' + rest.map(function (n) { return '<option value="' + E(n) + '"' + (has(n) ? ' selected' : '') + '>' + E(n) + '</option>'; }).join('') + '</optgroup>';
    if (cur && !team.concat(rest).some(has)) o += '<option value="' + E(cur) + '" selected>' + E(cur) + '</option>';
    return o;
  }
  function slackBlock(r) {
    var s = r.slack || {};
    if (s.ts) return '<div class="w123slk"><span class="w123ico">' + I('hash') + '</span><div>Posted in <b>#' + E(s.channel) + '</b> ' + E(ago(s.at)) + (s.url ? ' &middot; <a class="w123lnk" href="' + E(s.url) + '" target="_blank" rel="noopener">open the thread in Slack</a>' : '') + '<br><span class="w123sub" style="font-size:12.5px;margin:0">Status changes, hand-offs and notes are added to the thread.</span></div></div>';
    var old = r.created_at && String(r.created_at) < JEV_SINCE;
    var txt = s.error ? 'Not posted: ' + clip(s.error, 180) : s.skipped ? cap(s.skipped) : old ? 'Filed before requests were posted to Slack.' : (asDate(r.created_at) && now() - asDate(r.created_at).getTime() < 120000 ? 'Posting in Slack…' : 'Not posted in Slack.');
    return '<div class="w123slk' + (s.error ? ' bad' : '') + '"><span class="w123ico">' + I(s.error ? 'alert' : 'hash') + '</span><div>' + E(txt) + (r.id > 0 && staffOk() && !r.done ? ' <a class="w123lnk" data-w123repost="' + E(r.id) + '">Post it now</a>' : '') + '</div></div>';
  }
  var LOGTXT = {
    status: function (l) { return 'Status: <b>' + E(cap(l.new_value)) + '</b>'; },
    done: function (l) { return String(l.new_value) === 'true' ? '<b>Marked done</b>' : '<b>Reopened</b>'; },
    assignee: function (l) { return l.new_value ? 'Handed to <b>' + E(l.new_value) + '</b>' : 'Unassigned'; },
    refined: function (l) { return 'Updated from a meeting: ' + E(clip(l.new_value, 120)); },
    slack: function (l) { return 'Slack: ' + E(clip(l.new_value, 140)); }
  };
  function timelineHtml(r) {
    var ev = [];
    ev.push({ at: r.created_at, first: 1, h: '<b>' + E(whoAsked(r)) + '</b> asked ' + E(teamLabel(r.department)) + (r.source === 'email' ? ' (from an email)' : r.source === 'meeting' ? ' (from a meeting)' : '') });
    (R.logs['r' + r.id] || []).forEach(function (l) { var f = LOGTXT[l.field]; if (!f) return; ev.push({ at: l.changed_at, h: f(l) + (l.changed_by && l.field !== 'slack' ? ' <span class="w">by ' + E(l.changed_by) + '</span>' : '') }); });
    (R.notes[r.id] || []).forEach(function (n) { ev.push({ at: n.created_at, note: true, h: '<b>' + E(n.author) + '</b> <span class="w">added a note</span><div class="bd">' + (window.w138Mark ? window.w138Mark(linkify(n.body)) : linkify(n.body)) + '</div>' }); });
    ev.sort(function (a, b) { if (a.first || b.first) return a.first ? -1 : 1; return String(a.at || '').localeCompare(String(b.at || '')); });
    return '<ol class="w123tl">' + ev.map(function (e) { return '<li' + (e.note ? ' class="note"' : '') + '>' + e.h + ' <span class="w">' + E(fmtWhen(e.at)) + '</span></li>'; }).join('') + '</ol>';
  }
  function sheetReq(r) {
    var d = r.department, s = statusesOf(r), cur = stepOf(r), need = neededOf(r), st = staffOk();
    var late = need && !r.done && daysUntil(need) < 0;
    var out = '<div class="top">' + teamChip(d) + '<span class="w123pill">' + I(typeIcon(r.type_key)) + E(typeLabel(r)) + '</span>' + (r.priority === 'urgent' && !r.done ? '<span class="w123pill urg">' + I('bolt') + 'Urgent</span>' : '') + (r.done ? '<span class="w123pill done">' + I('check') + 'Done</span>' : '') + '<span class="sp"></span>' + closeBtn() + '</div>'
      + '<h2>' + E(r.title) + '</h2>'
      + '<div class="meta"><span>Asked by <b>' + E(whoAsked(r)) + '</b></span><span>' + E(fmtWhen(r.created_at)) + '</span>' + (need ? '<span class="' + (late ? 'late' : '') + '">' + E(r.done ? 'was needed by ' + fmtLong(need) : dueText(need)) + '</span>' : '') + (r.assignee ? '<span>With <b>' + E(r.assignee) + '</b></span>' : '') + '</div>'
      + '<div class="w123steps" role="list">' + s.map(function (x, i) { var cls = (r.done || i < cur) ? 'past' : (i === cur ? 'cur' : ''); return '<div class="st ' + cls + '" role="listitem"' + (st ? ' data-w123setst="' + E(x) + '" title="Set the status to ' + E(cap(x)) + '"' : '') + '><span class="c">' + (cls === 'past' ? I('check') : '') + '</span><span>' + E(cap(x)) + '</span></div>'; }).join('') + '</div>';
    if (st) out += '<div class="ctl"><label>Status <select data-w123st aria-label="Status">' + s.map(function (x) { return '<option value="' + E(x) + '"' + (lower(x) === lower(r.status) ? ' selected' : '') + '>' + E(cap(x)) + '</option>'; }).join('') + '</select></label>'
      + '<label>With <select data-w123as aria-label="Who has it">' + assigneeOptions(d, r.assignee) + '</select></label><span class="sp"></span>'
      + (r.done ? '<button type="button" class="w123btn sm ghost" data-w123reopen>' + I('undo') + 'Reopen</button>' : '<button type="button" class="w123btn sm" data-w123done>' + I('check') + 'Mark done</button>') + '</div>';
    out += '<div class="blk"><h4>What they asked for</h4>' + detailsHtml(r.details) + '</div>';
    if (r.mail_id) out += '<div class="blk"><h4>From the Hub inbox</h4><a class="w123lnk" data-w123openm="' + E(r.mail_id) + '">Open the email it came from</a></div>';
    out += '<div class="blk"><h4>Slack</h4>' + slackBlock(r) + '</div>';
    out += '<div class="blk"><h4>Activity</h4>' + timelineHtml(r)
      + (st ? '<div class="w123compose"><textarea data-w123note rows="2" placeholder="Add a note for the team and the requester. It goes into the Slack thread too." aria-label="Add a note"></textarea><button type="button" class="w123btn" data-w123addnote>Add note</button></div>' : '') + '</div>';
    return out;
  }
  function filedHtml(m) {
    var f = m.filed || {};
    if (f.type === 'task') return 'Filed as a Finance task. <a class="w123lnk" data-w123go="#task/' + E(f.id) + '">Open the task</a>';
    if (f.type === 'transcript') return 'Sent through the meeting pipeline: its tasks, updates and decisions are on the boards. <a class="w123lnk" data-w123go="#tx/' + E(f.id) + '">Open the meeting</a>';
    if (f.type === 'candidate') return 'Added to Recruitment in the HR centre.' + (isLeader() ? ' <a class="w123lnk" data-w123go="#hrcentre/recruitment">Open Recruitment</a>' : '');
    if (f.type === 'update') return 'Filed as an update on the team page. <a class="w123lnk" data-w123go="#team/' + E(m.department) + '">Open the team page</a>';
    return 'Filed by the Hub inbox.';
  }
  function jevBlock(m) {
    var n = m.notify, team = teamLabel(m.department);
    if (!n) {
      var old = String(m.internal_date || '') < JEV_SINCE;
      return '<div class="w123jevbox"><span class="w123ico">' + I('spark') + '</span><div><b>' + (old ? 'Filed before Jev started deciding on team pings' : 'Waiting for Jev') + '</b><br><span class="w123sub" style="margin:0;font-size:13px">' + (old ? 'Emails the Hub inbox files from now on get Jev&rsquo;s call.' : 'Jev decides whether ' + E(team) + ' hears about it now. It takes a minute after the email is filed.') + '</span></div></div>';
    }
    var p = typeof n.p === 'number' ? Math.round(n.p * 100) : null;
    var why = n.why ? WHY[n.why] || n.why : null;
    var head, sub;
    if (n.by === 'setting') { head = n.decision === 'notify' ? 'The team is always pinged' : 'The team is never pinged'; sub = 'That is the team&rsquo;s setting in Slack settings.'; }
    else if (n.decision === 'notify') { head = 'Jev pinged ' + E(team) + (n.channel ? ' in #' + E(n.channel) : ''); sub = (why ? 'Because ' + E(why) + '. ' : '') + (n.url ? '<a class="w123lnk" href="' + E(n.url) + '" target="_blank" rel="noopener">Open it in Slack</a>' : ''); }
    else { head = 'Jev filed it quietly'; sub = (why ? 'It looked like ' + E(why === 'someone needs to act' ? 'something to act on, but not urgent' : why) + '. ' : '') + 'No Slack message: finding it here is enough.'; }
    if (n.by === 'rule') sub += ' Jev did not answer, so the Hub&rsquo;s rule decided (bills, applicants and anything due within ten days get a ping).';
    if (n.error) sub += ' <span style="color:' + FLAG + '">Slack: ' + E(clip(n.error, 140)) + '</span>';
    return '<div class="w123jevbox"><span class="w123ico">' + I('spark') + '</span><div><b>' + head + '</b><br><span style="font-size:13px">' + sub + '</span>'
      + (p !== null ? '<div class="pbar" title="How sure Jev was that the team needed a ping"><i style="width:' + p + '%"></i></div><span style="font-size:11.5px;color:var(--wa-muted)">How sure Jev was the team needed a ping: ' + p + '%</span>' : '') + '</div></div>';
  }
  function mayReadBody(m) {
    if (m.kind === 'application' || m.department === 'hr') { if (isLeader()) return true; return me().dept === 'hr'; }
    return true;
  }
  function sheetMail(m) {
    var k = MAIL_KIND[m.kind] || MAIL_KIND.update, n = m.notify || {}, st = staffOk(), open = mailOpen(m);
    var out = '<div class="top">' + teamChip(m.department) + '<span class="w123pill" style="' + cv(k.c) + ';background:var(--cb);color:var(--c)">' + I(k.icon) + E(k.l) + '</span>' + (!open ? '<span class="w123pill done">' + I('check') + (m.team_state === 'request' ? 'Tracked as a request' : 'Handled') + '</span>' : '') + '<span class="sp"></span>' + closeBtn() + '</div>'
      + '<h2>' + E(m.title || m.subject || 'Email') + '</h2>'
      + '<div class="meta"><span>From <b>' + E(m.from_name || m.from_email || 'someone') + '</b>' + (m.from_name && m.from_email ? ' &lt;' + E(m.from_email) + '&gt;' : '') + '</span><span>' + E(fmtWhen(m.internal_date)) + '</span>'
      + (m.amount != null ? '<span><b>$' + E(Number(m.amount).toLocaleString('en-CA', { maximumFractionDigits: 2 })) + '</b></span>' : '') + (m.due_date ? '<span class="' + (daysUntil(m.due_date) < 0 && open ? 'late' : '') + '">due ' + E(fmtLong(m.due_date)) + '</span>' : '') + (m.assignee ? '<span>With <b>' + E(m.assignee) + '</b></span>' : '') + '</div>'
      + '<div class="blk">' + jevBlock(m) + '</div>';
    if (st) out += '<div class="ctl"><label>With <select data-w123mas aria-label="Who has it">' + assigneeOptions(m.department, m.assignee) + '</select></label><span class="sp"></span>'
      + (m.request_id ? '<a class="w123btn sm ghost" data-w123go="#requests/r/' + E(m.request_id) + '">Open the request</a>' : '<button type="button" class="w123btn sm ghost" data-w123mconv>' + I('inbox') + 'Make it a request</button>')
      + (open ? '<button type="button" class="w123btn sm" data-w123mdone>' + I('check') + 'Mark handled</button>' : '<button type="button" class="w123btn sm ghost" data-w123mopen>' + I('undo') + 'Back to open</button>') + '</div>';
    if (typeof n.ask === 'number' && n.ask >= 0.6 && !m.request_id && open) out += '<div class="w123note" style="margin:14px 0 0">' + I('inbox') + '<div><b>This looks like a request.</b> Make it one to track it to done: it gets statuses, an owner and a Slack thread.</div></div>';
    if (m.summary) out += '<div class="blk"><h4>In short</h4><div class="prose">' + E(m.summary) + '</div></div>';
    out += '<div class="blk"><h4>What the Hub did</h4><div class="prose" style="white-space:normal">' + filedHtml(m) + '</div></div>';
    var atts = Array.isArray(m.attachments) ? m.attachments : [];
    if (atts.length) out += '<div class="blk"><h4>Attachments</h4><div class="prose" style="white-space:normal">' + atts.map(function (a) { return '<span class="w123chip" style="cursor:default">' + I('doc') + E(clip(a.filename || 'file', 40)) + '</span>'; }).join(' ') + (isLeader() ? '<br><a class="w123lnk" data-w123go="#hubmail" style="font-size:12.5px">Open them from the Hub inbox page</a>' : '') + '</div></div>';
    if (mayReadBody(m)) {
      var b = R.bodies[m.id];
      out += '<div class="blk"><h4>The email</h4>' + (b === undefined ? '<a class="w123lnk" data-w123mbody="' + E(m.id) + '">Show the email</a>' : b === null ? '<p class="w123sub" style="margin:0">Loading…</p>' : '<div class="prose" style="background:rgba(16,63,57,.035);border-radius:12px;padding:12px 14px;max-height:420px;overflow:auto">' + linkify(clip(b, 12000)) + '</div>') + '</div>';
    }
    var logs = (R.logs['m' + m.id] || []).filter(function (l) { return l.field !== 'delivery'; });
    if (logs.length) out += '<div class="blk"><h4>Activity</h4><ol class="w123tl">' + logs.map(function (l) { return '<li>' + E(cap(l.field)) + ': ' + E(clip(l.new_value, 160)) + (l.changed_by ? ' <span class="w">by ' + E(l.changed_by) + '</span>' : '') + ' <span class="w">' + E(fmtWhen(l.changed_at)) + '</span></li>'; }).join('') + '</ol></div>';
    return out;
  }
  async function loadBody(id) {
    R.bodies[id] = null; renderSheet();
    var r = await q(db.from('hub_mail').select('body_text, snippet').eq('id', id).maybeSingle());
    R.bodies[id] = (r.data && (r.data.body_text || r.data.snippet)) || 'The email has no text (it may be only attachments).';
    renderSheet();
  }
