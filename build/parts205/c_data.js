
  /* ---------- loading ---------- */
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }
  function isActiveOrg(g) { return g && g.department === 'org' && !g.retired_at && g.number != null; }
  function loadAll(force) {
    if (S.loading && !force) return S.loading;
    if (S.loaded && !force) return Promise.resolve();
    if (typeof db === 'undefined' || !db) return Promise.resolve();
    S.loading = Promise.all([
      q(db.from('goals').select('*').order('number', { ascending: true })),
      q(db.from('goal_owners').select('*').order('sort')),
      q(db.from('goal_milestones').select('*').order('sort')),
      q(db.from('goal_paths').select('*').order('sort')),
      q(db.from('projects').select('id,name,department,status,goal_id,milestone_id,checkpoint_id,leads,parent_id,workstream,banked_at').order('sort')),
      q(db.from('strategy_plan').select('*')),
      q(db.from('strategy_docs').select('*').order('sort')),
      q(db.from('goal_comments').select('*').order('created_at', { ascending: true })),
      q(db.from('goal_wins').select('id,goal_id')),
      q(db.from('charitable_activities').select('*').order('sort')),
      q(db.from('goal_activities').select('*').order('sort')),
      q(db.from('goal_year_targets').select('*').order('sort')),
      q(db.from('goal_checkpoints').select('*').order('quarter'))
    ]).then(function (r) {
      var all = (r[0].data || []);
      S.err = r[0].error ? (r[0].error.message || String(r[0].error)) : null;
      S.goals = all.filter(isActiveOrg).sort(function (a, b) { return (a.number || 99) - (b.number || 99); });
      S.retired = all.filter(function (g) { return !!g.retired_at; });
      S.allGoals = all;
      S.owners = (r[1].data || []).filter(function (o) { return !o.removed_at; });
      S.milestones = (r[2].data || []).filter(function (m) { return !m.archived_at; });
      S.paths = (r[3].data || []).filter(function (p) { return !p.archived_at; });
      S.projects = (r[4].data || []).filter(function (p) { return !p.banked_at; });
      S.plan = {}; (r[5].data || []).forEach(function (x) { S.plan[x.key] = x.value; });
      S.docs = (r[6].data || []).filter(function (d) { return !d.archived_at; });
      S.comments = r[7].data || [];
      S.wins = {}; (r[8].data || []).forEach(function (w) { S.wins[w.goal_id] = (S.wins[w.goal_id] || 0) + 1; });
      S.acts = r[9].data || []; S.gacts = (r[10].data || []).filter(function (a) { return !a.archived_at; });
      S.targets = (r[11].data || []).filter(function (t) { return !t.archived_at; }); S.checkpoints = (r[12].data || []).filter(function (c) { return !c.archived_at; });
      S.goals.forEach(baseGoal); S.milestones.forEach(function (m) { baseRow('milestone', m, ['body', 'status', 'fy']); }); S.paths.forEach(function (p) { baseRow('path', p, ['body']); });
      ['activity', 'target', 'checkpoint'].forEach(function (e) { ENTS[e].list().forEach(function (row) { baseRow(e, row, ENTS[e].fields); }); });
      S.loaded = Date.now(); S.loading = null;
    });
    return S.loading;
  }
  var GOAL_FIELDS = ['title', 'detail', 'why', 'measure', 'baseline', 'target_fy29', 'target_fy31', 'status', 'due_date', 'activities_note'];
  /* every kind of row the page edits: its list in S and the fields autosave sends (wave207 adds activity, target, checkpoint) */
  var ENTS = {
    goal: { list: function () { return S.goals; }, fields: GOAL_FIELDS },
    milestone: { list: function () { return S.milestones; }, fields: ['body', 'status', 'fy'] },
    path: { list: function () { return S.paths; }, fields: ['body'] },
    activity: { list: function () { return S.gacts; }, fields: ['reason'] },
    target: { list: function () { return S.targets; }, fields: ['body', 'owners'] },
    checkpoint: { list: function () { return S.checkpoints; }, fields: ['body', 'status', 'due_date'] }
  };
  function key(e, id, f) { return e + ':' + id + ':' + f; }
  function baseGoal(g) { baseRow('goal', g, GOAL_FIELDS); }
  function baseRow(e, row, fields) { fields.forEach(function (f) { var k = key(e, row.id, f); if (!S.dirty[k]) S.base[k] = str(row[f]); }); }
  function goalOf(e, id) {
    if (e === 'goal') return byId(S.goals, id);
    var row = rowOf(e, id);
    return row ? byId(S.goals, row.goal_id) : null;
  }
  function rowOf(e, id) { return ENTS[e] ? byId(ENTS[e].list(), id) : null; }
  function msOf(gid) { return S.milestones.filter(function (m) { return String(m.goal_id) === String(gid); }).sort(function (a, b) { return (a.fy < b.fy ? -1 : a.fy > b.fy ? 1 : 0) || (a.sort - b.sort) || (a.id - b.id); }); }
  function pathsOf(gid) { return S.paths.filter(function (p) { return String(p.goal_id) === String(gid); }).sort(function (a, b) { return (a.sort - b.sort) || (a.id - b.id); }); }
  function ownersOf(gid) { return S.owners.filter(function (o) { return String(o.goal_id) === String(gid); }).sort(function (a, b) { return (b.is_lead ? 1 : 0) - (a.is_lead ? 1 : 0) || (a.sort - b.sort); }); }
  function projOf(gid) { return S.projects.filter(function (p) { return String(p.goal_id) === String(gid); }); }
  function commentsOf(gid, mid) { return S.comments.filter(function (c) { return String(c.goal_id) === String(gid) && (mid === undefined || String(c.milestone_id || '') === String(mid || '')); }); }
  function progress(gid) {
    var ms = msOf(gid).filter(function (m) { return m.fy !== 'FY30' && m.fy !== 'FY31'; });
    var done = ms.filter(function (m) { return m.status === 'done'; }).length;
    var y = currentFy(), yr = ms.filter(function (m) { return m.fy === y; }), yd = yr.filter(function (m) { return m.status === 'done'; }).length;
    return { total: ms.length, done: done, pct: ms.length ? Math.round(done / ms.length * 100) : 0, fy: y, yTotal: yr.length, yDone: yd };
  }
  function currentFy() { var d = new Date(), y = d.getFullYear() + (d.getMonth() >= 9 ? 1 : 0); return 'FY' + String(y).slice(2); }   /* the fiscal year starts October 1 */
  function rpc(fn, args) {
    return Promise.resolve(db.rpc(fn, args)).then(function (r) {
      if (r && r.error) throw new Error(r.error.message || String(r.error));
      return r ? r.data : null;
    });
  }
  function errText(e) { var m = String((e && e.message) || e || 'Something went wrong'); return m.replace(/^Error:\s*/, ''); }

  /* ---------- autosave: one field at a time, debounced, with the per-field check ---------- */
  function fieldEl(k) { return document.querySelector('#w205 [data-w205k="' + k + '"]') || document.querySelector('#w205drawer [data-w205k="' + k + '"]'); }
  function parseKey(k) { var p = k.split(':'); return { e: p[0], id: p[1], f: p.slice(2).join(':') }; }
  function schedule(k, ms) {
    clearTimeout(S.timers[k]);
    S.timers[k] = setTimeout(function () { save(k); }, ms == null ? SAVE_MS : ms);
    savedState(k);
  }
  function flushAll() { Object.keys(S.timers).forEach(function (k) { if (S.dirty[k]) { clearTimeout(S.timers[k]); save(k); } }); }
  function save(k) {
    var el = fieldEl(k), P = parseKey(k);
    if (!el) { delete S.dirty[k]; return Promise.resolve(); }
    if (S.conflict[k]) return Promise.resolve();   /* waits for the person to choose */
    if (S.inflight[k]) { S.inflight[k].again = true; return S.inflight[k].p; }
    var val = el.value, old = S.base[k] == null ? '' : S.base[k];
    if (val === old) { delete S.dirty[k]; savedState(k); return Promise.resolve(); }
    var rec = { again: false };
    rec.p = rpc('strategy_save', { p_entity: P.e, p_id: Number(P.id), p_field: P.f, p_value: val, p_old: old }).then(function (res) {
      delete S.inflight[k];
      if (res && res.conflict) {
        S.conflict[k] = { current: str(res.current), by: res.by || nameOf(res.by_email) || 'Someone', at: res.at, mine: val };
        S.base[k] = str(res.current);
        paintConflict(k); savedState(k);
        return;
      }
      if (!res || res.ok === false) throw new Error((res && res.error) || 'Not saved');
      S.base[k] = val; delete S.errors[k];
      var row = rowOf(P.e, P.id); if (row) { row[P.f] = P.f === 'due_date' ? (val || null) : val; row.updated_by = myEmail(); }
      S.savedAt[goalKey(P)] = Date.now();
      var cur = fieldEl(k);
      if (cur && cur.value === val) delete S.dirty[k];
      savedState(k);
      afterSave(P);
      if (rec.again || (cur && cur.value !== val)) schedule(k, 250);
    }).catch(function (e) {
      delete S.inflight[k];
      S.errors[k] = errText(e);
      savedState(k);
      paintFieldError(k);
    });
    S.inflight[k] = rec;
    savedState(k);
    return rec.p;
  }
  function goalKey(P) { var g = goalOf(P.e, P.id); return g ? String(g.id) : ''; }
  function savedState(k) {
    var P = parseKey(k), gid = goalKey(P); if (!gid) return;
    var box = document.querySelector('#w205 [data-w205saved="' + gid + '"]'); if (!box) return;
    var keys = Object.keys(S.dirty).filter(function (x) { return goalKey(parseKey(x)) === gid; });
    var busy = Object.keys(S.inflight).some(function (x) { return goalKey(parseKey(x)) === gid; });
    var errs = Object.keys(S.errors).filter(function (x) { return goalKey(parseKey(x)) === gid; });
    var conf = Object.keys(S.conflict).some(function (x) { return goalKey(parseKey(x)) === gid; });
    box.className = 'w205saved' + (errs.length ? ' err' : busy || keys.length ? ' busy' : '');
    box.textContent = errs.length ? 'Not saved' : conf ? 'Check the note' : busy ? 'Saving…' : keys.length ? 'Editing…' : (S.savedAt[gid] ? 'Saved' : '');
    if (!errs.length && !busy && !keys.length && S.savedAt[gid]) box.title = 'Saved ' + fmtWhen(S.savedAt[gid]); else box.removeAttribute('title');
  }
  function paintFieldError(k) {
    var el = fieldEl(k); if (!el) return;
    var host = el.parentNode, old = host.querySelector('.w205err[data-for="' + k + '"]'); if (old) old.remove();
    if (S.errors[k]) { var d = document.createElement('div'); d.className = 'w205err'; d.setAttribute('data-for', k); d.setAttribute('role', 'alert'); d.textContent = 'Not saved: ' + S.errors[k]; el.insertAdjacentElement('afterend', d); }
  }
  /* "Ian just changed this": their words and yours, side by side; nothing is lost either way */
  function paintConflict(k) {
    var el = fieldEl(k); if (!el) return;
    var host = el.parentNode, old = host.querySelector('.w205conf[data-for="' + k + '"]'); if (old) old.remove();
    var c = S.conflict[k]; if (!c) return;
    var d = document.createElement('div'); d.className = 'w205conf'; d.setAttribute('data-for', k); d.setAttribute('role', 'status');
    d.innerHTML = '<b>' + E(c.by) + ' just changed this.</b> ' + (c.current ? 'Their version:' : 'They cleared it.') +
      (c.current ? '<span class="theirs" data-w198skip>' + E(c.current) + '</span>' : '') +
      '<div class="acts"><button type="button" class="w205btn sm pri" data-w205keep="' + E(k) + '">Keep mine</button>' +
      '<button type="button" class="w205btn sm" data-w205theirs="' + E(k) + '">Use theirs</button>' +
      '<small style="color:' + MUTED + ';align-self:center">Your words stay in the box until you choose.</small></div>';
    el.insertAdjacentElement('afterend', d);
  }
  function resolveConflict(k, keepMine) {
    var c = S.conflict[k]; if (!c) return;
    delete S.conflict[k];
    var el = fieldEl(k);
    var note = document.querySelector('#w205 .w205conf[data-for="' + k + '"]'); if (note) note.remove();
    if (keepMine) { S.dirty[k] = true; save(k); }
    else { if (el) { el.value = c.current; grow(el); } S.base[k] = c.current; delete S.dirty[k]; var P = parseKey(k), row = rowOf(P.e, P.id); if (row) row[P.f] = c.current; savedState(k); afterSave(P); }
  }
  /* the at-a-glance table and the progress bar follow the fields */
  function afterSave(P) {
    try {
      var g = goalOf(P.e, P.id); if (!g) return;
      if (P.e === 'goal' && ['title', 'measure', 'baseline', 'target_fy29', 'target_fy31'].indexOf(P.f) >= 0) paintGlance();
      if (P.e === 'milestone' && P.f === 'status') { paintProgress(g.id); var ms = byId(S.milestones, P.id), box = document.querySelector('#w205 [data-w205ms="' + P.id + '"]'); if (box && ms) box.classList.toggle('done', ms.status === 'done'); paintGlance(); }
      if (P.e === 'goal' && P.f === 'status') { var sel = fieldEl(key('goal', g.id, 'status')); if (sel) sel.className = 'w205stsel s-' + stKey(g.status); }
      if (P.e === 'milestone' && P.f === 'fy') repaintGoal(g.id, true);
      if (P.e === 'checkpoint' || P.e === 'target') { afterYearSave(P); paintYear(); }
      if (P.e === 'activity') { paintActs(g.id); paintCoverage(); paintGlance(); }
    } catch (e) { /* cosmetic */ }
  }
  function stKey(s) { return String(s || 'not started').replace(/ (\w)/g, function (m, c) { return c.toUpperCase(); }).replace(/[^A-Za-z]/g, ''); }
  function grow(el) { if (!el || el.tagName !== 'TEXTAREA') return; el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }

  /* ---------- live: other people's saves and who is here ---------- */
  function onRemoteRow(e, row, kind) {
    var fields = ENTS[e].fields;
    var by = nameOf(row.updated_by);
    var mine = lower(row.updated_by) === myEmail();
    var list = ENTS[e].list();
    var cur = byId(list, row.id);
    if (e === 'goal') {
      if (!isActiveOrg(row)) { if (cur || row.retired_at) { S.loaded = 0; loadAll(true).then(paintSoon); } return; }
      if (!cur) { S.loaded = 0; loadAll(true).then(paintSoon); return; }
      ['approval', 'approved_at', 'owner', 'number'].forEach(function (f) { cur[f] = row[f]; });
    }
    if (e !== 'goal' && (row.archived_at || !cur)) {
      if (row.archived_at) { var i = list.indexOf(cur); if (i >= 0) list.splice(i, 1); }
      else list.push(row);
      if (row.archived_at || !cur) { baseRow(e, row, fields); repaintGoal(row.goal_id, true); if (e === 'activity') { paintActs(row.goal_id); paintCoverage(); paintGlance(); } if (e === 'target' || e === 'checkpoint') paintYear(); if (S.drawer && S.drawer.kind === 'acts') paintDrawer(); return; }
    }
    fields.forEach(function (f) {
      var k = key(e, row.id, f), v = str(row[f]);
      if (v === str(S.base[k])) { if (cur) cur[f] = row[f]; return; }   /* our own save coming back */
      var el = fieldEl(k);
      var busy = el && (document.activeElement === el || S.dirty[k] || S.inflight[k]) && el.value !== v;
      if (busy && !mine) {
        /* they are typing here: keep their words, show the other person's */
        S.conflict[k] = { current: v, by: by, at: row.updated_at, mine: el.value };
        S.base[k] = v; paintConflict(k); savedState(k);
      } else {
        S.base[k] = v; if (cur) cur[f] = row[f];
        if (el && el.value !== v) { el.value = v; grow(el); if (!mine) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); el.title = 'Changed by ' + by + ' ' + fmtWhen(row.updated_at); } }
        afterSave({ e: e, id: row.id, f: f });
      }
      if (cur) cur[f] = row[f];
    });
  }
  function onRemote(table, payload) {
    var row = payload.new || {}, ev = payload.eventType;
    if (!row || !row.id) return;
    if (table === 'goals') onRemoteRow('goal', row, ev);
    else if (table === 'goal_milestones') onRemoteRow('milestone', row, ev);
    else if (table === 'goal_paths') onRemoteRow('path', row, ev);
    else if (table === 'goal_activities') onRemoteRow('activity', row, ev);
    else if (table === 'goal_year_targets') onRemoteRow('target', row, ev);
    else if (table === 'goal_checkpoints') onRemoteRow('checkpoint', row, ev);
    else if (table === 'goal_owners') {
      var o = byId(S.owners, row.id);
      if (row.removed_at) { if (o) S.owners.splice(S.owners.indexOf(o), 1); }
      else if (o) Object.assign(o, row); else S.owners.push(row);
      paintOwners(row.goal_id);
    } else if (table === 'goal_comments') {
      var c = byId(S.comments, row.id); if (c) Object.assign(c, row); else S.comments.push(row);
      paintCounts(row.goal_id); paintYear();
      if (S.drawer && S.drawer.kind === 'comments' && String(S.drawer.goal) === String(row.goal_id)) paintDrawer();
    } else if (table === 'projects') {
      var p = byId(S.projects, row.id);
      if (row.banked_at) { if (p) S.projects.splice(S.projects.indexOf(p), 1); }
      else if (p) Object.assign(p, row); else S.projects.push(row);
      S.goals.forEach(function (g) { paintProjects(g.id); });
      paintUnlinked(); paintYear();
      if (S.drawer && S.drawer.kind === 'link') paintDrawer();
    }
  }
  var paintT = null;
  function paintSoon() { clearTimeout(paintT); paintT = setTimeout(function () { if (onPage()) paint(); }, 60); }

  /* presence travels on a Realtime channel anyone holding the page's public key could listen to: it carries the roster id and
     the first name only (as the public website does), never an email; who you are comes from the roster on each side */
  var TAB = 't' + Math.random().toString(36).slice(2, 10);
  function myKey() { var m = me(); return m.id ? 'm' + m.id : TAB; }
  function presenceMeta() {
    var m = me();
    return { mid: m.id || null, name: String(m.name || '').split(' ')[0], goal: S.focus.goal, field: S.focus.field, view: S.view, at: Date.now() };
  }
  function track() { try { if (S.channel && S.live) S.channel.track(presenceMeta()); } catch (e) { /* fine */ } }
  var trackT = null;
  function trackSoon() { clearTimeout(trackT); trackT = setTimeout(track, 250); }
  function readPresence() {
    var st = {}; try { st = S.channel && S.channel.presenceState ? S.channel.presenceState() : {}; } catch (e) { st = {}; }
    var seen = {}, out = [], mine = me().id;
    Object.keys(st || {}).forEach(function (k) {
      (st[k] || []).forEach(function (m) {
        var id = m.mid ? 'm' + m.mid : k; if (!id || k === TAB || (mine && String(m.mid) === String(mine))) return;
        if (!seen[id] || (m.at || 0) > (seen[id].at || 0)) seen[id] = m;
      });
    });
    Object.keys(seen).forEach(function (id) { out.push(seen[id]); });
    out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    S.presence = out;
    paintPresence();
  }
  function goLive() {
    if (S.channel || typeof db === 'undefined' || !db || typeof db.channel !== 'function') return;
    try {
      var ch = db.channel('wa205-strategy', { config: { presence: { key: myKey() } } });
      ['goals', 'goal_milestones', 'goal_paths', 'goal_owners', 'goal_comments', 'projects', 'goal_activities', 'goal_year_targets', 'goal_checkpoints'].forEach(function (t) {
        var opt = { event: '*', schema: 'public', table: t };
        if (t === 'goals') opt.filter = 'department=eq.org';
        ch.on('postgres_changes', opt, function (payload) { try { onRemote(t, payload); } catch (e) { console.warn('wave205 live', e); } });
      });
      ch.on('presence', { event: 'sync' }, readPresence);
      ch.on('presence', { event: 'join' }, readPresence);
      ch.on('presence', { event: 'leave' }, readPresence);
      S.channel = ch;
      ch.subscribe(function (status) {
        S.live = status === 'SUBSCRIBED';
        if (S.live) track();
        paintPresence();
      });
    } catch (e) { console.warn('wave205 realtime', e); S.channel = null; }
  }
  function goQuiet() {
    var ch = S.channel; if (!ch) return;
    S.channel = null; S.live = false; S.presence = [];
    try { if (ch.untrack) ch.untrack(); } catch (e) { /* fine */ }
    try { if (db.removeChannel) db.removeChannel(ch); else if (ch.unsubscribe) ch.unsubscribe(); } catch (e) { /* fine */ }
  }
