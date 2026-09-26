
  /* ---------- the data: bank_list() ---------- */
  function arr(x) { return Array.isArray(x) ? x : []; }
  function rpc(fn, args) {
    return Promise.resolve(db.rpc(fn, args || {})).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; });
  }
  function norm(d) {
    d = d || {};
    return { tasks: arr(d.tasks), projects: arr(d.projects), back: arr(d.back), today: d.today || ymd(today()), can: d.can_bank !== false, leader: !!d.leader };
  }
  function load(force) {
    if (!staffOk()) { B.data = norm(null); return Promise.resolve(B.data); }
    if (B.loading) return B.loading;
    if (!force && B.data && Date.now() - B.at < 30000) return Promise.resolve(B.data);
    B.loading = rpc('bank_list').then(function (d) {
      B.data = norm(d); B.at = Date.now(); B.err = ''; B.loading = null; B.ver++; return B.data;
    }, function (e) {
      B.loading = null; B.err = errText(e); if (!B.data) B.data = norm(null); B.ver++; return B.data;
    });
    return B.loading;
  }
  /* every task and project in the bank, as one list */
  function items() {
    var d = B.data || norm(null), out = [];
    d.projects.forEach(function (p) {
      out.push({ kind: 'project', id: p.id, title: p.name || 'A project', dept: p.department, until: p.bank_until, note: p.bank_note, by: p.banked_by, at: p.banked_at,
        parent: p.parent, desc: p.description, tasks: Number(p.tasks || 0), subs: Number(p.subprojects || 0), titles: arr(p.task_titles), lead: p.lead !== false, leads: arr(p.leads) });
    });
    d.tasks.forEach(function (t) {
      out.push({ kind: 'task', id: t.id, title: t.title || 'A task', dept: t.department, until: t.bank_until, note: t.bank_note, by: t.banked_by, at: t.banked_at,
        owner: t.owner, project: t.project, parent: t.parent, desc: t.description, subs: Number(t.subtasks || 0), due: t.bank_due, priority: !!t.priority, lead: true });
    });
    out.sort(function (a, b) { return String(a.until || '').localeCompare(String(b.until || '')) || String(a.title).localeCompare(String(b.title)); });
    return out;
  }
  function itemBy(kind, id) { return items().filter(function (x) { return x.kind === kind && String(x.id) === String(id); })[0] || null; }
  function backItems() { return arr((B.data || {}).back); }
  function teamCounts(d) {
    var list = items().filter(function (x) { return x.dept === d; });
    var back = backItems().filter(function (x) { return x.department === d; });
    return { list: list, back: back, tasks: list.filter(function (x) { return x.kind === 'task'; }).length, projects: list.filter(function (x) { return x.kind === 'project'; }).length };
  }
  function errText(e) {
    var m = String((e && (e.message || e.details || e.hint)) || e || '').replace(/^.*?ERROR:\s*/, '');
    if (/staff only/i.test(m)) return 'Your access can look at the bank but not move work in or out of it.';
    if (/not allowed/i.test(m)) return 'That one is not yours to move.';
    if (/after today/i.test(m)) return 'Pick a day after today.';
    if (/three years/i.test(m)) return 'Pick a day in the next three years.';
    if (/not open|not active/i.test(m)) return 'It is already closed or already in the bank. Refresh the page to see where it is.';
    if (/general list/i.test(m)) return 'A team’s general list stays on the board. Move its tasks one by one instead.';
    if (/lead or a leader/i.test(m)) return 'Only the project’s lead or a team leader can do that for a whole project.';
    if (/too late to undo/i.test(m)) return 'Too late to undo. Bring it back from the bank instead.';
    if (/not in the bank/i.test(m)) return 'It is not in the bank any more. Refresh to see where it is.';
    if (/fetch|network|Failed to/i.test(m)) return 'Could not reach the Hub. Nothing changed. Try again.';
    return m || 'Something went wrong. Nothing changed.';
  }

  /* ---------- keeping the rest of the page in step ---------- */
  function treeIds(id) {
    var ids = [String(id)], all = tasks(), grew = true;
    while (grew) {
      grew = false;
      all.forEach(function (t) { if (t.parent_task_id != null && ids.indexOf(String(t.parent_task_id)) >= 0 && ids.indexOf(String(t.id)) < 0 && !t.done) { ids.push(String(t.id)); grew = true; } });
    }
    return ids;
  }
  function dropTasks(ids) {
    var removed = [];
    try {
      removed = DB_TASKS.filter(function (t) { return ids.indexOf(String(t.id)) >= 0; });
      DB_TASKS = DB_TASKS.filter(function (t) { return ids.indexOf(String(t.id)) < 0; });
    } catch (e) { /* fine */ }
    return removed;
  }
  function repaintBoards(dept) {
    try { if (window.w116Board && window.w116Board.refresh) window.w116Board.refresh(); } catch (e) { /* fine */ }
    setTimeout(function () {
      try { if (dept && typeof renderSection === 'function') renderSection(dept); } catch (e) { /* fine */ }
      try { if (typeof renderNeedsMe === 'function') renderNeedsMe(); } catch (e) { /* fine */ }
      try { if (window.w116Route && document.getElementById('team') && document.getElementById('team').classList.contains('active')) window.w116Route(); } catch (e) { /* fine */ }
    }, 40);
  }
  async function refreshProjects() {
    try { if (window.w116LoadProjects) { var rows = await window.w116LoadProjects(true); if (window.w116ProjectsChanged) window.w116ProjectsChanged(rows); } } catch (e) { /* fine */ }
    try { if (typeof wa27Load === 'function') await wa27Load(true); } catch (e) { /* fine */ }
  }
  async function reloadTasks() {
    try { if (typeof loadAll === 'function') await loadAll(); } catch (e) { /* fine */ }
    try { if (typeof renderAllSections === 'function') renderAllSections(); } catch (e) { /* fine */ }
    repaintBoards(null);
  }
  function afterChange() { B.at = 0; return load(true).then(function () { paintAll(); }); }

  /* ---------- the moves ---------- */
  async function bankTask(t, until, note) {
    var ids = treeIds(t.id);
    var res = await rpc('bank_task', { p_id: Number(t.id), p_until: until, p_note: note || null });
    try { if (window.w116Board && window.w116Board.closeDrawer) window.w116Board.closeDrawer(); } catch (e) { /* fine */ }
    var removed = dropTasks(ids);
    repaintBoards(t.department);
    var n = Number((res && res.banked) || 1);
    snack('In the bank until ' + fmtDay(parseDay(until), true) + (n > 1 ? ', with ' + plural(n - 1, 'subtask', 'subtasks') : '') + '. It comes back on its own.',
      [['Undo', function () { return undoMove('task', t.id, removed, t.department); }], ['Open the bank', function () { go('#bank'); }]]);
    afterChange();
    return res;
  }
  async function bankProject(p, until, note) {
    var res = await rpc('bank_project', { p_id: Number(p.id), p_until: until, p_note: note || null });
    await refreshProjects(); await reloadTasks();
    go('#bank');
    var n = Number((res && res.tasks) || 0);
    snack(p.name + ' is in the bank until ' + fmtDay(parseDay(until), true) + ' with ' + plural(n, 'open task', 'open tasks') + '.', [['Undo', function () { return undoMove('project', p.id, null, p.department); }]]);
    afterChange();
    return res;
  }
  async function addToBank(f) {
    var res = await rpc('bank_add_task', { p_department: f.dept, p_title: f.title, p_until: f.until, p_note: f.note || null, p_project_id: f.project ? Number(f.project) : null, p_owner: f.owner || null });
    snack('“' + clip(f.title, 60) + '” is in the bank until ' + fmtDay(parseDay(f.until), true) + '.', []);
    afterChange();
    return res;
  }
  async function undoMove(kind, id, removed, dept) {
    try {
      await rpc('bank_undo', { p_kind: kind, p_id: Number(id) });
      if (kind === 'task' && removed && removed.length) {
        var r = await db.from('dept_tasks').select('*').in('id', removed.map(function (x) { return Number(x.id); }));
        var rows = (r && r.data) || [];
        try { var have = {}; DB_TASKS.forEach(function (t) { have[String(t.id)] = 1; }); rows.forEach(function (row) { if (!have[String(row.id)]) DB_TASKS.push(row); }); } catch (e) { /* fine */ }
        repaintBoards(dept);
      } else { await refreshProjects(); await reloadTasks(); }
      toastS('Back where it was');
      hideSnack();
      afterChange();
    } catch (e) { toastS(errText(e)); }
  }
  async function bringBack(kind, id) {
    var it = itemBy(kind, id);
    var res = await rpc('bank_unbank', { p_kind: kind, p_id: Number(id), p_why: 'brought back early' });
    if (kind === 'project') await refreshProjects();
    await reloadTasks();
    toastS((it ? '“' + clip(it.title, 50) + '”' : 'It') + ' is back on the ' + teamShort(it ? it.dept : '') + ' board');
    afterChange();
    return res;
  }
  async function redate(kind, id, until) {
    var res = await rpc('bank_redate', { p_kind: kind, p_id: Number(id), p_until: until });
    toastS('Comes back on ' + fmtDay(parseDay(until), true));
    afterChange();
    return res;
  }

  /* ---------- the undo bar ---------- */
  var SNACK = { acts: [] };
  function snackEl() { var el = document.getElementById('w132snack'); if (!el) { el = document.createElement('div'); el.id = 'w132snack'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); } return el; }
  function snack(text, acts) {
    var el = snackEl(); SNACK.acts = acts || [];
    el.innerHTML = '<span class="t">' + E(text) + '</span>' + SNACK.acts.map(function (a, i) { return '<button type="button" data-w132sn="' + i + '">' + E(a[0]) + '</button>'; }).join('') + '<button type="button" class="x" data-w132sn="x" aria-label="Dismiss">' + I('x') + '</button>';
    el.classList.add('on');
    clearTimeout(B.snackT); B.snackT = setTimeout(hideSnack, 12000);
  }
  function hideSnack() { var el = document.getElementById('w132snack'); if (el) el.classList.remove('on'); clearTimeout(B.snackT); }
  function go(h) { closeSheet(); if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
