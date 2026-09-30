  /* ---------- the Avenue Academy: Assigned to you ---------- */
  function acadMe() {
    var m = meRow(), name = m && m.name ? m.name : '', em = '';
    try { em = lower((USER && USER.email) || ''); if (!name) { var full = String((USER && USER.name) || ''); name = full ? full.split(' ')[0] : em.split('@')[0]; } } catch (e) { /* fine */ }
    return { name: name, email: em };
  }
  function doneAt(prog, n, tid) {
    for (var i = 0; i < prog.length; i++) { var p = prog[i]; if (String(p.training_id) === String(tid) && lower(p.person_name) === n) return p.status === 'done' ? (p.done_at || p.updated_at || 'done') : null; }
    return null;
  }
  function rowOf(prog, n, tid) { for (var i = 0; i < prog.length; i++) { var p = prog[i]; if (String(p.training_id) === String(tid) && lower(p.person_name) === n) return p; } return null; }
  /* my assigned trainings, grouped: one card per assignment (a Learning Avenue is one card), and one per training someone
     assigned by hand (the older way) */
  function mineCards() {
    var A = window.w122 && w122.A; if (!A || !A.loaded || !Array.isArray(A.prog)) return null;
    loadCatalog();
    var me = acadMe(), n = lower(me.name); if (!n) return null;
    var prog = A.prog, today = todayIso(), groups = {}, order = [];
    prog.forEach(function (p) {
      if (lower(p.person_name) !== n) return;
      var key = p.assignment_id ? 'a' + p.assignment_id : (p.assigned_by && p.status !== 'done' ? 't' + p.training_id : null);
      if (!key) return;
      if (!groups[key]) { groups[key] = { key: key, aid: p.assignment_id || null, rows: [] }; order.push(key); }
      groups[key].rows.push(p);
    });
    var cards = [];
    order.forEach(function (k) {
      var g = groups[k], a = null;
      if (g.aid) a = (S.mine || []).filter(function (x) { return String(x.id) === String(g.aid); })[0] || null;
      var v = null;
      if (a) v = a.training_id ? 't:' + a.training_id : 'p:' + a.path_key;
      else if (g.rows.length > 1) {
        var grp = null, same = g.rows.every(function (r) { var t = trById(r.training_id); if (!t || !t.path_group) return false; if (grp === null) grp = t.path_group; return t.path_group === grp; });
        var pth = same ? (S.paths || []).filter(function (p) { return p.name === grp; })[0] : null;
        v = pth ? 'p:' + pth.key : 't:' + g.rows[0].training_id;
      } else v = 't:' + g.rows[0].training_id;
      var mods = modulesOf(v); if (!mods.length) return;
      var done = 0, last = null, started = false;
      mods.forEach(function (t) {
        var d = doneAt(prog, n, t.id); if (d) { done++; if (!last || String(d) > String(last)) last = d; }
        else { var r = rowOf(prog, n, t.id); if (r && (r.started_at || Number(r.pct) > 0)) started = true; }
      });
      var complete = done >= mods.length;
      /* a finished card stays two weeks, then leaves the list */
      if (complete && (!last || last === 'done' || String(last).slice(0, 10) < addDays(today, -14))) return;
      var due = null; g.rows.forEach(function (r) { if (r.status !== 'done' && r.due_date && (!due || String(r.due_date) < due)) due = String(r.due_date).slice(0, 10); });
      if (!due && a && a.due_date && !complete) due = String(a.due_date).slice(0, 10);
      var note = (a && a.note) || g.rows.map(function (r) { return r.note; }).filter(Boolean)[0] || '';
      var by = (a && a.assigned_by) || g.rows.map(function (r) { return r.assigned_by; }).filter(Boolean)[0] || '';
      var mins = mods.filter(function (t) { return !doneAt(prog, n, t.id); }).reduce(function (s, t) { return s + minsOf(t); }, 0);
      var nextT = mods.filter(function (t) { return !doneAt(prog, n, t.id); })[0] || mods[0];
      cards.push({ v: v, title: titleOf(v), avenue: v.indexOf('p:') === 0, mods: mods, done: done, total: mods.length, complete: complete, last: last, started: started || done > 0,
        due: due, late: !complete && due && due < today, note: note, by: by, mins: mins, next: nextT });
    });
    cards.sort(function (x, y) { return (x.complete - y.complete) || ((y.late ? 1 : 0) - (x.late ? 1 : 0)) || ((x.due ? 0 : 1) - (y.due ? 0 : 1)) || String(x.due || '').localeCompare(String(y.due || '')) || String(x.title).localeCompare(String(y.title)); });
    return cards;
  }
  function dueText(c) {
    if (c.complete) return 'Done' + (c.last && c.last !== 'done' ? ' ' + fmtDay(c.last) : '');
    if (c.late) return 'Late: it was due ' + fmtDay(c.due);
    if (c.due) { var d = Math.round((new Date(c.due + 'T12:00:00Z') - new Date(todayIso() + 'T12:00:00Z')) / 86400000); return 'Due ' + fmtDay(c.due) + (d === 0 ? ', today' : d === 1 ? ', tomorrow' : d > 1 && d <= 7 ? ', in ' + d + ' days' : ''); }
    return 'No due date';
  }
  function homeHtml() {
    if (S.mine === null || (Date.now() - S.mineAt > 60000 && !S.mineP)) {
      if (!S.mineP) loadMine().then(function () { try { if (window.w122 && typeof w122.paint === 'function') w122.paint(); } catch (e) { /* not mounted */ } });
    }
    var cards = mineCards(); if (!cards || !cards.length) return '';
    var todo = cards.filter(function (c) { return !c.complete; }), late = todo.filter(function (c) { return c.late; }).length;
    var sub = todo.length ? todo.length + ' to do' + (late ? ', ' + late + ' late' : '') + ', from the people you work with.' : 'All done. Thank you!';
    var shown = S.mineAll ? cards : cards.slice(0, 6);
    return '<section class="w122sec" id="w169mine" data-sec="assigned"><div class="w122sech"><div><h2>Assigned to you</h2><div class="sub">' + E(sub) + '</div></div>'
      + (cards.length > 6 ? '<button type="button" class="w169pill" data-w169mineall="1">' + (S.mineAll ? 'Show fewer' : 'Show all ' + cards.length) + '</button>' : '') + '</div>'
      + '<div class="w169g">' + shown.map(function (c) {
        var href = c.avenue ? '#training/p/' + c.v.slice(2) : '#training/t/' + c.v.slice(2);
        var pct = c.total ? Math.round(100 * c.done / c.total) : 0;
        var k = c.avenue ? 'Learning Avenue · ' + c.done + ' of ' + c.total + ' done' : kindLabel(c.mods[0]) + (minsOf(c.mods[0]) ? ' · ' + minsOf(c.mods[0]) + ' min' : '');
        var go = c.complete ? 'Open it again' : (c.started ? 'Continue' : 'Start') + (c.avenue && c.next && !c.complete ? ': ' + String(c.next.title).slice(0, 34) + (String(c.next.title).length > 34 ? '…' : '') : '');
        return '<a class="w169m' + (c.complete ? ' done' : c.late ? ' late' : '') + '" href="' + E(href) + '"><span class="k">' + E(k) + '</span><b>' + E(c.title) + '</b>'
          + '<span class="due">' + E(dueText(c)) + (!c.complete && c.mins ? ' · about ' + c.mins + ' min' : '') + '</span>'
          + (c.note ? '<span class="why">“' + E(c.note) + '”</span>' : '')
          + (c.by ? '<span class="by">From ' + E(first(c.by)) + '</span>' : '')
          + (c.avenue ? '<span class="pb"><i style="width:' + pct + '%"></i></span>' : '')
          + '<span class="go">' + E(go) + '</span></a>';
      }).join('') + '</div></section>';
  }
