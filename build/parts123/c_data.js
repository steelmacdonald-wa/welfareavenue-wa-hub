
  /* ---------- state ---------- */
  var R = {
    loaded: 0, loading: null, ver: 1,
    types: [], reqs: [], sugs: [], mail: [], notes: {}, logs: {}, bodies: {}, cfg: null, cfgDraft: null, bot: null, botErr: null,
    view: 'new',
    nw: { d: null, type: null, q: '', drafts: {}, sent: null },
    tm: { d: null, state: 'open', kind: 'all', mine: false },
    all: { d: '', state: 'open', q: '' },
    sheet: null
  };
  var MAILCOLS = 'id, internal_date, from_email, from_name, subject, title, summary, kind, department, amount, due_date, status, filed, attachments, notify, team_state, team_done_by, team_done_at, assignee, request_id';
  var JEV_SINCE = '2026-09-25T17:00:00Z';

  /* ---------- who and where ---------- */
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []; } catch (e) { return []; } }
  function me() {
    var email = ''; try { email = lower((typeof USER !== 'undefined' && USER && USER.email) || ''); } catch (e) { email = ''; }
    var name = ''; try { name = (typeof who === 'function') ? String(who() || '') : ''; } catch (e) { name = ''; }
    var m = members().filter(function (x) { return email && lower(x.email) === email; })[0] || null;
    return { email: email, name: name || (m && m.name) || (email ? email.split('@')[0] : 'staff'), dept: m ? m.department : null };
  }
  function role() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function isAdmin() { return role() === 'admin'; }
  function isLeader() { var r = role(); return r === 'admin' || r === 'leader'; }
  function allowedTeams() { var a = null; try { a = typeof wa40Allowed === 'function' ? wa40Allowed() : null; } catch (e) { a = null; } return T.order.filter(function (d) { return !a || a.indexOf(d) >= 0; }); }
  function teamLabel(d) { return (T.labels && T.labels[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; }
  function teamShort(d) { return (T.short && T.short[d]) || teamLabel(d); }
  function teamColor(d) { return (typeof DEPT_COLOR !== 'undefined' && DEPT_COLOR[d]) || '#6f6b64'; }
  function tint(hex, a) { var h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); if (h.length !== 6 || isNaN(n)) return 'rgba(16,63,57,' + a + ')'; return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function cv(hex) { return '--c:' + hex + ';--cb:' + tint(hex, 0.13); }
  function homeTeam() { var ds = allowedTeams(); var mine = me().dept; if (R.tm.d && ds.indexOf(R.tm.d) >= 0) return R.tm.d; if (mine && ds.indexOf(mine) >= 0) return mine; return ds[0] || T.order[0]; }
  function nameByEmail(em) { em = lower(em); var m = members().filter(function (x) { return lower(x.email) === em; })[0]; return m ? m.name : null; }
  function teamMembers(d) { return members().filter(function (m) { return m.department === d && m.active !== false; }); }

  /* ---------- request helpers ---------- */
  function typeOf(key) { if (!key) return null; for (var i = 0; i < R.types.length; i++) if (R.types[i].key === key) return R.types[i]; return null; }
  function typesFor(d) { return R.types.filter(function (t) { return t.department === d && t.enabled !== false; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0) || String(a.label).localeCompare(String(b.label)); }); }
  function typeLabel(r) { var t = typeOf(r.type_key); return t ? t.label : (r.type_key ? cap(String(r.type_key).replace(/-/g, ' ')) : 'General request'); }
  function typeIcon(key) { return TYPE_ICON[key] || 'spark'; }
  function statusesOf(r) { var t = typeOf(r.type_key); return (t && Array.isArray(t.statuses) && t.statuses.length) ? t.statuses.slice() : DEFAULT_STATUSES.slice(); }
  function stepOf(r) { var s = statusesOf(r); if (r.done) return s.length; var cur = lower(r.status), i = -1; s.forEach(function (x, k) { if (lower(x) === cur) i = k; }); return i < 0 ? 0 : i; }
  function pct(r) { var s = statusesOf(r); if (r.done) return 100; return Math.max(8, Math.round((stepOf(r) + 1) / s.length * 100)); }
  function statusText(r) { return r.done ? 'Done' : cap(r.status || statusesOf(r)[0]); }
  function pillCls(r) { if (r.done) return 'done'; return stepOf(r) === 0 ? 'new' : 'prog'; }
  function neededOf(r) {
    if (r.needed_by) return r.needed_by;
    var d = r.details;
    if (d && typeof d === 'object' && !Array.isArray(d)) { for (var k in d) { if (/needed by|send date|which event date|first day/i.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(String(d[k]))) return d[k]; } }
    return null;
  }
  function whoAsked(r) {
    var s = String(r.requested_by || '');
    var m = s.match(/^Meeting AI \(accepted by (.+)\)$/); if (m) return m[1] + ' (from a meeting)';
    var c = s.match(/^Chat \((.+)\)$/); if (c) return (nameByEmail(c[1].indexOf('@') > 0 ? c[1] : c[1] + '@welfareavenue.com') || c[1]) + ' (Ask the Hub)';
    return s || (r.requested_email ? (nameByEmail(r.requested_email) || r.requested_email) : 'someone');
  }
  function isMine(r) {
    var m = me(); var by = lower(r.requested_by);
    if (m.email && lower(r.requested_email) === m.email) return true;
    if (!m.name) return false;
    var n = lower(m.name);
    return by === n || by.indexOf('accepted by ' + n) >= 0;
  }
  function withMe(x) {
    var a = lower(x.assignee); if (!a) return false;
    var n = lower(me().name); if (!n) return false;
    return a === n || a.split(' ')[0] === n.split(' ')[0];
  }
  function urgentOrLate(r) { if (r.done) return false; if (r.priority === 'urgent') return true; var n = daysUntil(neededOf(r)); return n !== null && n < 0; }
  function mailOpen(m) { return !m.team_state || m.team_state === 'open'; }
  function mailRecent(m) { var d = asDate(m.internal_date); return !d || (now() - d.getTime()) < 30 * 86400000; }
  function chanFor(d, t) {
    if (t && t.channel) return String(t.channel).replace(/^#/, '');
    var c = (R.cfg && R.cfg.channels && R.cfg.channels[d]) || DEFAULT_CHANNELS[d] || [];
    if (R.bot && R.bot.teams && R.bot.teams[d] && R.bot.teams[d].channel && !(t && t.channel)) return R.bot.teams[d].channel;
    return c[0] || null;
  }
  function cfgOf(v) {
    v = v || {};
    var ch = {};
    T.order.forEach(function (d) {
      var x = v.channels && v.channels[d];
      var arr = (Array.isArray(x) ? x : (x ? [x] : [])).map(function (s) { return String(s || '').replace(/^#/, '').trim(); }).filter(Boolean);
      ch[d] = arr.length ? arr : (DEFAULT_CHANNELS[d] || []).slice();
    });
    return { channels: ch, post_requests: v.post_requests !== false, thread_updates: v.thread_updates !== false, dm_requester: v.dm_requester !== false, email_mode: Object.assign({}, v.email_mode || {}) };
  }

  /* one team's inbox: requests, emails the Hub inbox filed for the team, asks spotted in meetings */
  function teamItems(d, state) {
    var out = [];
    R.reqs.forEach(function (r) { if (r.department !== d) return; if (state === 'open' ? !r.done : r.done) out.push({ k: 'r', x: r, at: r.created_at, hot: urgentOrLate(r), soon: !r.done && (daysUntil(neededOf(r)) !== null && daysUntil(neededOf(r)) <= 3) }); });
    R.mail.forEach(function (m) {
      if (m.department !== d) return;
      var open = mailOpen(m) && mailRecent(m);
      if (state === 'open' ? open : !open) out.push({ k: 'm', x: m, at: m.internal_date, hot: false, soon: !!(m.due_date && daysUntil(m.due_date) !== null && daysUntil(m.due_date) <= 3 && open) });
    });
    if (state === 'open') R.sugs.forEach(function (s) { if (s.department === d) out.push({ k: 's', x: s, at: s.created_at, hot: false, soon: false }); });
    out.sort(function (a, b) {
      if (a.hot !== b.hot) return a.hot ? -1 : 1;
      if (a.soon !== b.soon) return a.soon ? -1 : 1;
      return String(b.at || '').localeCompare(String(a.at || ''));
    });
    return out;
  }
  function counts() {
    var mine = R.reqs.filter(function (r) { return !r.done && isMine(r); }).length;
    var d = homeTeam();
    return { mine: mine, inbox: d ? teamItems(d, 'open').length : 0, d: d };
  }

  /* ---------- loading ---------- */
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }
  async function load(force) {
    if (R.loading) return R.loading;
    if (R.loaded && !force && now() - R.loaded < 45000) return;
    R.loading = (async function () {
      var since = new Date(now() - 120 * 86400000).toISOString();
      var a = await Promise.all([
        q(db.from('request_types').select('*').order('sort').order('label')),
        q(db.from('dept_requests').select('*').order('created_at', { ascending: false }).limit(800)),
        q(db.from('request_suggestions').select('*').eq('status', 'pending').order('id', { ascending: false }).limit(60)),
        q(db.from('hub_mail').select(MAILCOLS).eq('status', 'filed').gte('internal_date', since).order('internal_date', { ascending: false }).limit(300)),
        q(db.from('hub_settings').select('value').eq('key', 'team_inbox').maybeSingle())
      ]);
      if (a[0].data) R.types = a[0].data.filter(function (t) { return t.enabled !== false; });
      if (a[1].data) R.reqs = a[1].data;
      if (a[2].data) R.sugs = a[2].data.filter(function (s) { return s.status === 'pending'; });
      if (a[3].data) R.mail = a[3].data.filter(function (m) { return m.department && m.kind !== 'noise' && m.status === 'filed' && ((m.filed || {}).type !== 'inbox'); });
      R.cfg = cfgOf(a[4].data && a[4].data.value);
      try { REQ_TYPES = R.types; REQ_CACHE = R.reqs; } catch (e) { /* older waves read these */ }
      R.loaded = now(); R.ver++;
    })();
    try { await R.loading; } catch (e) { R.loaded = R.loaded || now(); } finally { R.loading = null; }
  }
  async function loadThread(k, id) {
    var key = k + id;
    if (k === 'r') {
      var a = await Promise.all([
        q(db.from('request_notes').select('*').eq('request_id', id).order('created_at')),
        q(db.from('change_log').select('field, old_value, new_value, changed_by, changed_at').eq('entity_type', 'request').eq('entity_id', String(id)).order('changed_at').limit(80))
      ]);
      R.notes[id] = (a[0].data || []).filter(function (n) { return String(n.request_id) === String(id); });
      R.logs[key] = a[1].data || [];
    } else {
      var b = await q(db.from('change_log').select('field, old_value, new_value, changed_by, changed_at').eq('entity_type', 'hub_mail').eq('entity_id', String(id)).order('changed_at').limit(40));
      R.logs[key] = b.data || [];
    }
  }
  async function fx(body) {
    var r = await db.functions.invoke('team-inbox', { body: body });
    if (r && r.error) {
      var msg = r.error.message || String(r.error);
      try { var ctx = r.error.context; if (ctx && typeof ctx.json === 'function') { var j = await ctx.json(); if (j && j.error) msg = j.error; } } catch (e) { /* keep the first message */ }
      throw new Error(msg);
    }
    if (r && r.data && r.data.error) throw new Error(r.data.error);
    return (r && r.data) || {};
  }
  async function logChange(entity, id, field, oldV, newV) {
    try { await db.from('change_log').insert({ entity_type: entity, entity_id: String(id), field: field, old_value: oldV == null ? null : String(oldV), new_value: newV == null ? null : String(newV).slice(0, 400), changed_by: me().name }); } catch (e) { /* audit only */ }
    var key = (entity === 'request' ? 'r' : 'm') + id;
    if (R.logs[key]) R.logs[key].push({ field: field, old_value: oldV, new_value: newV, changed_by: me().name, changed_at: new Date().toISOString() });
  }
  function bump() { R.ver++; try { REQ_CACHE = R.reqs; } catch (e) { /* fine */ } }

  /* ---------- changes ---------- */
  async function createRequest(p) {
    var m = me(), t = p.type;
    var row = {
      type_key: t ? t.key : null, department: p.d, title: p.title, details: p.details,
      status: t ? (t.default_status || statusesOf({ type_key: t.key })[0]) : 'requested',
      requested_by: m.name, requested_email: m.email || null, needed_by: p.needed || null,
      priority: p.urgent ? 'urgent' : 'normal', source: p.source || 'requests', done: false
    };
    if (p.mail_id) row.mail_id = p.mail_id;
    if (p.requested_by) row.requested_by = p.requested_by;
    if (p.requested_email !== undefined) row.requested_email = p.requested_email;
    if (p.assignee) row.assignee = p.assignee;
    var r = await db.from('dept_requests').insert(row).select('*').single();
    if (r && r.error) throw r.error;
    var saved = (r && r.data && r.data.id) ? r.data : Object.assign({ id: -now(), created_at: new Date().toISOString() }, row);
    if (!saved.created_at) saved.created_at = new Date().toISOString();
    R.reqs.unshift(saved); bump();
    await logChange('request', saved.id, 'created', null, row.title);
    return saved;
  }
  async function patchReq(r, patch, okText, failText, logs) {
    var old = {}; Object.keys(patch).forEach(function (k) { old[k] = r[k]; });
    patch.updated_at = new Date().toISOString(); patch.updated_by = me().name;
    Object.assign(r, patch); bump(); repaint();
    var res = await q(db.from('dept_requests').update(patch).eq('id', r.id));
    if (res.error) { Object.assign(r, old); bump(); repaint(); toastS(failText || 'Could not save that'); return false; }
    for (var i = 0; i < (logs || []).length; i++) await logChange('request', r.id, logs[i][0], logs[i][1], logs[i][2]);
    if (okText) toastS(okText);
    repaint();
    return true;
  }
  function setStatus(r, st) {
    var s = statusesOf(r), last = lower(s[s.length - 1]) === lower(st);
    if (lower(st) === lower(r.status) && !r.done) return;
    var patch = { status: st };
    var logs = [['status', r.status, st]];
    if (last && !r.done) { patch.done = true; patch.done_at = new Date().toISOString(); logs.push(['done', 'false', 'true']); }
    if (!last && r.done) { patch.done = false; patch.done_at = null; logs.push(['done', 'true', 'false']); }
    return patchReq(r, patch, last ? 'Marked done' : 'Status: ' + cap(st), 'Could not change the status', logs);
  }
  function setDone(r, done) {
    return patchReq(r, { done: done, done_at: done ? new Date().toISOString() : null }, done ? 'Marked done' : 'Reopened', 'Could not save that', [['done', String(!done), String(done)]]);
  }
  function assign(r, name) {
    return patchReq(r, { assignee: name || null }, name ? 'Now with ' + name : 'Unassigned', 'Could not assign it', [['assignee', r.assignee || null, name || null]]);
  }
  async function addNote(r, text) {
    var m = me();
    var row = { request_id: r.id, author: m.name, email: m.email || null, body: text };
    var res = await q(db.from('request_notes').insert(row).select('*').single());
    if (res.error) { toastS('Could not add the note'); return false; }
    var saved = (res.data && res.data.id) ? res.data : Object.assign({ id: -now(), created_at: new Date().toISOString() }, row);
    if (!saved.created_at) saved.created_at = new Date().toISOString();
    (R.notes[r.id] = R.notes[r.id] || []).push(saved);
    toastS('Note added' + (r.slack && r.slack.ts ? ' and posted in the Slack thread' : ''));
    return true;
  }
  async function mailSet(m, opts) {
    var old = { team_state: m.team_state, assignee: m.assignee, request_id: m.request_id, team_done_by: m.team_done_by, team_done_at: m.team_done_at };
    if (opts.state) { m.team_state = opts.state; m.team_done_by = opts.state === 'open' ? null : me().name; m.team_done_at = opts.state === 'open' ? null : new Date().toISOString(); }
    if (opts.clear) m.assignee = null; else if (opts.assignee) m.assignee = opts.assignee;
    if (opts.request_id) m.request_id = opts.request_id;
    bump(); repaint();
    var res = await q(db.rpc('team_inbox_mail', { p_id: m.id, p_state: opts.state || null, p_assignee: opts.assignee || null, p_request_id: opts.request_id || null, p_clear_assignee: !!opts.clear, p_by: me().name }));
    if (res.error) { Object.assign(m, old); bump(); repaint(); toastS('Could not save that'); return false; }
    var key = 'm' + m.id; if (R.logs[key]) R.logs[key].push({ field: 'team inbox', new_value: (opts.state ? 'state ' + opts.state : '') + (opts.assignee ? ' assigned ' + opts.assignee : '') + (opts.clear ? ' unassigned' : '') + (opts.request_id ? ' request ' + opts.request_id : ''), changed_by: me().name, changed_at: new Date().toISOString() });
    return true;
  }
  async function convertMail(m) {
    var staffSender = /@welfareavenue\.com$/i.test(m.from_email || '');
    var details = {};
    details['From'] = (m.from_name ? m.from_name + ' ' : '') + '<' + (m.from_email || '') + '>';
    if (m.summary) details['Summary'] = m.summary;
    if (m.subject) details['Email subject'] = m.subject;
    if (m.amount != null) details['Amount'] = '$' + Number(m.amount).toLocaleString('en-CA', { maximumFractionDigits: 2 });
    var saved = await createRequest({
      d: m.department, type: null, title: clip(m.title || m.subject || 'Email request', 150), details: details,
      needed: m.due_date || null, urgent: false, source: 'email', mail_id: m.id,
      requested_by: m.from_name || m.from_email || 'Hub inbox', requested_email: staffSender ? lower(m.from_email) : null,
      assignee: m.assignee || null
    });
    await mailSet(m, { state: 'request', request_id: saved.id > 0 ? saved.id : null });
    m.request_id = saved.id; bump();
    return saved;
  }
  async function acceptSug(s) {
    var m = me(), by = m.name, iso = new Date().toISOString();
    if (s.kind === 'refine' && s.target_request_id) {
      var tgt = R.reqs.filter(function (r) { return String(r.id) === String(s.target_request_id); })[0];
      if (!tgt) { var f = await q(db.from('dept_requests').select('*').eq('id', s.target_request_id).maybeSingle()); tgt = f.data; }
      if (!tgt) { toastS('The request it updates is gone'); return false; }
      var add = (s.details || s.title || '') + (s.quote ? '\n"' + s.quote + '"' : '');
      var det = tgt.details;
      if (det && typeof det === 'object' && !Array.isArray(det)) { det = Object.assign({}, det); det['Update from a meeting, ' + fmtDay(iso)] = add; }
      else det = (det ? String(det) + '\n\n' : '') + 'Update from a meeting: ' + add;
      var u = await q(db.from('dept_requests').update({ details: det, updated_at: iso, updated_by: by }).eq('id', tgt.id));
      if (u.error) { toastS('Could not apply it'); return false; }
      tgt.details = det;
      await q(db.from('request_suggestions').update({ status: 'accepted', request_id: tgt.id, decided_by: by, decided_at: iso }).eq('id', s.id));
      await logChange('request', tgt.id, 'refined', null, clip(s.title, 200));
      toastS('Added onto the open request');
    } else {
      var t = typeOf(s.type_key);
      var details = {};
      if (s.details) details['What was asked'] = s.details;
      if (s.quote) details['From the meeting'] = '"' + s.quote + '"';
      var saved;
      try {
        saved = await createRequest({ d: s.department, type: t, title: s.title, details: details, source: 'meeting', requested_by: 'Meeting AI (accepted by ' + by + ')', assignee: s.assignee || null });
      } catch (e) { toastS('Could not file it'); return false; }
      await q(db.from('request_suggestions').update({ status: 'accepted', request_id: saved.id > 0 ? saved.id : null, decided_by: by, decided_at: iso }).eq('id', s.id));
      toastS('Filed to ' + teamLabel(s.department));
    }
    R.sugs = R.sugs.filter(function (x) { return x.id !== s.id; }); bump(); repaint();
    return true;
  }
  async function dismissSug(s) {
    var r = await q(db.from('request_suggestions').update({ status: 'dismissed', decided_by: me().name, decided_at: new Date().toISOString() }).eq('id', s.id));
    if (r.error) { toastS('Could not dismiss it'); return; }
    R.sugs = R.sugs.filter(function (x) { return x.id !== s.id; }); bump(); repaint();
    toastS('Dismissed');
  }
