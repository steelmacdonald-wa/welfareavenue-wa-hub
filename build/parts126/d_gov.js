
  /* ---------- the masthead and the section nav ---------- */
  function mast(id, crumb, title, blurb) {
    var sec = document.getElementById(id); if (!sec) return;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w126', id); sec.insertBefore(m, sec.firstChild); }
    var html = '<div class="crumb">' + E(crumb) + '</div><h1>' + E(title) + '</h1><p>' + E(blurb) + '</p>';
    if (m.getAttribute('data-h') !== html) { m.innerHTML = html; m.setAttribute('data-h', html); }
  }
  function host(id, hid) {
    var sec = document.getElementById(id); if (!sec) return null;
    var h = document.getElementById(hid);
    if (!h) { h = document.createElement('div'); h.id = hid; sec.appendChild(h); }
    return h;
  }
  function segHtml(on) {
    var a = [['#governance', 'Overview', 'gov'], ['#committees', 'Committees', 'com']];
    if (seeDirectors()) a.push(['#governance/directors', 'Directors', 'dir']);
    if (staffOk() && isTabAllowed('board')) a.push(['#team/board', 'Team page', 'tp']);
    if (staffOk() && isTabAllowed('board')) { a.push(['#team/board/agenda', 'Agendas', 'ag']); a.push(['#team/board/tasks', 'Board tasks', 'tk']); }
    return '<nav class="w126seg" aria-label="Board">' + a.map(function (x) { return '<a data-w126go="' + x[0] + '" class="' + (x[2] === on ? 'on' : '') + '">' + E(x[1]) + '</a>'; }).join('') + '</nav>';
  }
  function isTabAllowed(id) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { return false; } }
  function stTag(s) { var x = ST[s] || ST.todo; return '<span class="w126st" style="background:' + x[1] + ';color:' + x[2] + '">' + E(x[0]) + '</span>'; }

  /* ---------- the next board meeting and the cycle ---------- */
  function meetHtml() {
    var n = nextMeeting(), l = lastMeeting(), s = strategySession(), due = committeeDue(), t = today();
    var nd = n ? dayOfIso(n.meets_at) : null, left = nd ? daysBetween(t, nd) : null;
    var edit = amLeader();
    return '<div class="w126card w126meet">'
      + '<div><div class="lb">Next board meeting' + (edit && n ? '<a class="ed" data-w126meet="' + n.id + '">Edit</a>' : '') + '</div>'
      + (n ? '<b>' + E(n.title) + '</b><span>' + E(fmtWhen(n.meets_at)) + (n.status === 'tentative' ? ' (tentative)' : '') + '</span>' + (left != null ? '<span class="cd">' + (left === 0 ? 'Today' : left === 1 ? 'Tomorrow' : 'In ' + left + ' days') + '</span>' : '')
        : '<b>Not scheduled yet</b><span>Four board meetings a year, plus an AGM.</span>' + (edit ? '<span><a data-w126meet="new">Schedule it</a></span>' : ''))
      + '</div>'
      + '<div><div class="lb">Committees meet by</div>' + (due ? '<b>' + E(fmtDay(due)) + '</b><span>A week before the board meeting, so everyone arrives informed.</span>' : '<b>A week before</b><span>each board meeting.</span>') + '</div>'
      + '<div><div class="lb">Last meeting</div>' + (l ? '<b>' + E(fmtDay(dayOfIso(l.meets_at), true)) + '</b><span>' + E(l.title) + (l.notes_url ? ' · <a href="' + E(l.notes_url) + '" target="_blank" rel="noopener">minutes</a>' : '') + '</span>' : '<b>None yet</b>') + '</div>'
      + '<div><div class="lb">Strategy session' + (edit && s ? '<a class="ed" data-w126meet="' + s.id + '">Edit</a>' : '') + '</div>' + (s ? '<b>' + (s.meets_at ? E(fmtDay(dayOfIso(s.meets_at))) : 'To schedule') + '</b><span>Board and operations: assumptions, who we serve, the plan.</span>' : '<b>Every October</b><span>The fiscal year-end deep dive.</span>') + '</div>'
      + '</div>';
  }

  /* ---------- the three jobs ---------- */
  function itemHtml(it) {
    var task = it.task_id ? D().tasks.filter(function (t) { return String(t.id) === String(it.task_id); })[0] : null;
    var meta = [it.owner, it.due ? 'Due ' + it.due : '', task ? 'Board task: ' + (task.done ? 'done' : (task.status || 'open')) : ''].filter(Boolean).join(' · ');
    return '<div class="w126it' + (it.status === 'done' ? ' done' : '') + '" data-w126item="' + it.id + '" tabindex="0" role="button">' + stTag(it.status) + '<div><b>' + E(it.title) + '</b>' + (it.detail && it.status !== 'done' ? '<span class="d">' + E(clip(it.detail, 150)) + '</span>' : '') + (meta ? '<em>' + E(meta) + '</em>' : '') + '</div></div>';
  }
  function jobItems(k) {
    var rank = { at_risk: 0, in_progress: 1, todo: 2, watch: 3, standing: 4, done: 5 };
    return D().items.filter(function (i) { return i.job === k; }).sort(function (a, b) { return (rank[a.status] - rank[b.status]) || (a.sort || 0) - (b.sort || 0); });
  }
  function stewardExtra() {
    var ds = directors().filter(function (m) { return m.renewal_due || m.renewal; });
    var rows = ds.map(function (m) { var r = renewalState(m); return '<div><b>' + E(m.name) + '</b>' + (r ? '<span class="w126st ' + r.k + '">' + E(r.t) + '</span>' : '<span class="w126st ok">' + E(m.renewal || 'No renewal set') + '</span>') + '</div>'; }).join('');
    var open = members().filter(function (m) { return m.status === 'resigned'; });
    return '<div class="w126x"><h4>Terms and renewals</h4><div class="w126ren">' + (rows || '<p class="w126empty">No terms recorded yet.</p>') + '</div>'
      + (open.length ? '<p>' + E(open.length === 1 ? 'One seat is open' : open.length + ' seats are open') + ' (HR & People).</p>' : '') + '</div>';
  }
  function fiduciaryExtra() {
    var f = D().finance || {}, fs = parseDay(f.fy_start), net = Number(f.income || 0) - Number(f.expenses || 0), pnet = Number(f.prev_income || 0) - Number(f.prev_expenses || 0);
    var ls = parseDay(f.last_statement || f.last_txn), stale = ls ? daysBetween(ls, today()) > 45 : true;
    var fyl = fs ? 'Fiscal ' + fs.getFullYear() + '-' + String(fs.getFullYear() + 1).slice(2) : 'This fiscal year';
    var fund = D().fund || {}, g = fund.goals || {};
    return '<div class="w126x"><h4>' + E(fyl) + (ls ? ', to ' + E(fmtDay(ls)) : '') + '</h4><div class="w126fin">'
      + '<div><b>' + E(money(f.income)) + '</b><span>came in</span></div><div><b>' + E(money(f.expenses)) + '</b><span>went out</span></div><div class="' + (net >= 0 ? 'pos' : 'neg') + '"><b>' + (net >= 0 ? '+' : '') + E(money(net)) + '</b><span>net</span></div></div>'
      + (f.prev_income || f.prev_expenses ? '<p>Last fiscal year: ' + E(money(f.prev_income)) + ' in, ' + E(money(f.prev_expenses)) + ' out (' + (pnet >= 0 ? '+' : '') + E(money(pnet)) + ').</p>' : '')
      + (stale ? '<p class="warn">The statements stop at ' + (ls ? E(fmtDay(ls, true)) : 'no date yet') + ': the newer months are not in the Hub yet.</p>' : '')
      + '<p>Fundraising events raised ' + E(money(fund.raised || 0)) + ' this fiscal year' + (g.target ? '; the 2026-27 goal is ' + E(money(g.minimum || 0)) + ' minimum, ' + E(money(g.target)) + ' target' : '') + '. <a class="w126lnk" data-w126go="#fundevents">Events calendar</a></p></div>';
  }
  function strategyExtra() {
    var steps3 = D().items.filter(function (i) { return i.job === 'strategy' && /^Step \d/i.test(i.title || ''); }).sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
    var goals = D().goals || [];
    var gst = function (s) { s = lower(s); return s === 'on track' || s === 'done' || s === 'complete' ? 'in_progress' : s === 'at risk' || s === 'off track' ? 'at_risk' : s === 'not started' ? 'todo' : 'in_progress'; };
    return '<div class="w126x"><h4>Strategy starts with shared assumptions</h4>'
      + (steps3.length ? '<div class="w126steps3">' + steps3.map(function (s) { var m = /^Step (\d)[:.]?\s*(.*)$/i.exec(s.title) || [0, '', s.title]; return '<div class="' + (s.status === 'done' ? 'done' : '') + '" data-w126item="' + s.id + '"><small>Step ' + E(m[1]) + (s.status === 'done' ? ' · done' : '') + '</small><b>' + E(m[2].replace(/^./, function (c) { return c.toUpperCase(); })) + '</b></div>'; }).join('') + '</div>' : '')
      + '</div>'
      + (goals.length ? '<div class="w126x"><h4>Organizational goals</h4>' + goals.map(function (gl) { return '<div class="w126goal"><b>' + E(gl.title) + '</b>' + stTag(gst(gl.status)).replace(/>[^<]*<\/span>$/, '>' + E(gl.status || '') + '</span>') + '</div>'; }).join('') + '<p><a class="w126lnk" data-w126go="#orggoals">Organizational goals</a></p></div>' : '');
  }
  function jobHtml(j) {
    var list = jobItems(j.k), visible = list.filter(function (i) { return i.status !== 'done' && !(j.k === 'strategy' && /^Step \d/i.test(i.title || '')); }), done = list.filter(function (i) { return i.status === 'done'; });
    var total = list.filter(function (i) { return i.status !== 'standing' && i.status !== 'watch'; }).length, nd = done.length, pct = total ? Math.round(nd / total * 100) : 0;
    var extra = j.k === 'steward' ? stewardExtra() : j.k === 'fiduciary' ? fiduciaryExtra() : strategyExtra();
    var showDone = !!B.openDone[j.k];
    return '<div class="w126card w126job" id="w126job-' + j.k + '" style="--c:' + j.c + '"><div class="jh"><div class="jn"><i>' + j.n + '</i><h3>' + E(j.t) + '</h3></div><p class="jd">' + E(j.d) + '</p>'
      + '<div class="jp"><span>' + nd + ' of ' + total + ' done</span><span class="bar"><i style="width:' + pct + '%"></i></span></div></div>'
      + '<div class="jb">' + (visible.length ? visible.map(itemHtml).join('') : '<p class="w126empty" style="padding:8px">Nothing open.</p>')
      + (done.length ? '<a class="w126tog" data-w126done="' + j.k + '">' + I(showDone ? 'x' : 'check') + (showDone ? 'Hide what is done' : done.length + ' done') + '</a>' + (showDone ? done.map(itemHtml).join('') : '') : '')
      + (canEditItems() ? '<a class="w126tog" data-w126newitem="' + j.k + '">' + I('plus') + 'Add an item</a>' : '')
      + extra + '</div></div>';
  }

  /* ---------- each director's progress ---------- */
  function dirCardHtml(m) {
    var cs = committeesOf(m.id), mine = String(m.id) === String(meId());
    var r = renewalState(m), my = myCycleTps(m.id), recs = my.filter(isRec).length, ts = tasksOf(m), open = ts.filter(function (t) { return !t.done; }).length, dn = ts.filter(function (t) { return t.done; }).length;
    var rows = cs.map(function (c) {
      var n = stepsDone(c);
      return '<div class="row" style="--c:' + E(c.color || GREEN) + '"><b><i></i>' + E(c.name) + (String(c.chair_id) === String(m.id) ? ' <span class="ch">Chair</span>' : '') + '</b><span class="w126dots">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < n ? 'on' : '') + '"></i>'; }).join('') + '</span><small>' + n + ' of 4</small></div>';
    }).join('');
    return '<div class="w126card w126dir" data-w126dir="' + m.id + '" tabindex="0" role="button"><div class="dh"><span class="w126av" style="background:' + (cs[0] ? E(cs[0].color || GREEN) : GREEN) + '">' + E(initials(m.full_name || m.name)) + '</span><div><b>' + E(m.full_name || m.name) + '</b><span>' + E(m.seat || 'Director') + '</span></div>' + (mine ? '<span class="me">You</span>' : '') + '</div>'
      + '<div class="w126cm">' + (rows || '<p class="w126empty">Not on a committee yet.</p>') + '</div>'
      + '<div class="ft">' + (my.length ? '<span class="hl">' + my.length + ' logged this cycle' + (recs ? ', ' + recs + ' recommendation' + (recs === 1 ? '' : 's') : '') + '</span>' : '<span>Nothing logged this cycle</span>')
      + (ts.length ? '<span>' + open + ' open, ' + dn + ' done board tasks</span>' : '') + (r ? '<span>' + E(r.t) + '</span>' : '') + '</div></div>';
  }
  function dirsHtml() {
    var ds = directors(), others = members().filter(function (m) { return m.status !== 'active'; });
    var cs = cycleStart(), ce = cycleEnd();
    return '<div class="w126sec" id="w126dirs"><h2>The directors</h2><span>' + (cs && ce ? 'This cycle: ' + E(fmtDay(cs)) + ' to ' + E(fmtDay(ce)) + '. ' : '') + 'Each committee’s steps, what each director logged, their board tasks and their term.</span></div>'
      + (ds.length ? '<div class="w126dirs">' + ds.map(dirCardHtml).join('') + '</div>' : '<p class="w126empty">No directors recorded yet.</p>')
      + (others.length ? '<div class="w126others">' + others.map(function (m) { return '<span>' + E(m.full_name || m.name) + ': ' + E(m.status === 'adviser' ? m.seat || 'Adviser' : m.status === 'resigned' ? 'resigned' + (m.note ? ' (' + clip(m.note.replace(/;.*$/, ''), 40) + ')' : '') : m.status) + '</span>'; }).join('') + '</div>' : '');
  }

  /* ---------- the page ---------- */
  function govPaint() {
    var h = host('governance', 'w126gov'); if (!h) return;
    mast('governance', 'Board & Governance', 'Board overview', 'Everything the board does ladders up to one of three jobs. Where each one stands, and how each director is progressing on their committees.');
    if (!canSee()) { h.innerHTML = '<div class="w126card"><p class="w126empty">The board pages are for directors, board advisers and leaders.</p></div>'; return; }
    if (!B.data) { h.innerHTML = segHtml('gov') + '<div class="w126card"><p class="w126empty">Loading the board…</p></div>'; return; }
    var html = segHtml(B.dirFocus ? 'dir' : 'gov') + meetHtml()
      + '<div class="w126sec"><h2>The three jobs of a board</h2><span>Everything the board does should ladder up to one of these three.</span></div>'
      + '<div class="w126jobs">' + JOBS.map(jobHtml).join('') + '</div>'
      + (seeDirectors() ? dirsHtml() : '');
    if (h.__h !== html) { h.innerHTML = html; h.__h = html; }
  }
  async function govShow(sub) {
    var h = host('governance', 'w126gov'); if (!h) return;
    B.dirFocus = sub === 'directors';
    await loadMe();
    govPaint();
    if (!canSee()) return;
    await load();
    if (onPage('governance')) {
      govPaint();
      if (sub === 'directors') { var el = document.getElementById('w126dirs'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }
      else if (sub && /^director\/\d+$/.test(sub)) openDirector(sub.split('/')[1]);
      else if (sub && JOB[sub]) { var j = document.getElementById('w126job-' + sub); if (j && j.scrollIntoView) j.scrollIntoView({ block: 'start' }); }
    }
  }
  function onPage(id) { var a = document.querySelector('.panel.active'); return !!(a && a.id === id); }
