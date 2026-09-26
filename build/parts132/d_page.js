
  /* ---------- the page: #bank ---------- */
  var BLURB = 'Work that can wait three months or more. It leaves every board, list and count, and comes back on its own on its date.';
  function mast() {
    var sec = document.getElementById('bank'); if (!sec) return;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w132', 'bank'); sec.insertBefore(m, sec.firstChild); }
    var html = '<div class="crumb">Goals and projects</div><h1>The bank</h1><p>' + E(BLURB) + '</p>';
    if (m.getAttribute('data-h') !== html) { m.innerHTML = html; m.setAttribute('data-h', html); }
  }
  function host() {
    var sec = document.getElementById('bank'); if (!sec) return null;
    var h = document.getElementById('w132');
    if (!h) { h = document.createElement('div'); h.id = 'w132'; sec.appendChild(h); }
    return h;
  }
  function statsHtml(all) {
    var t = today(), soon = all.filter(function (x) { var d = parseDay(x.until); return d && daysBetween(t, d) <= 30; }).length;
    var nt = all.filter(function (x) { return x.kind === 'task'; }).length, np = all.length - nt, back = backItems().length;
    var add = canWork() && (B.data ? B.data.can : true);
    return '<div class="w132top">'
      + '<div class="w132st gold"><b>' + all.length + '</b><span>in the bank' + (all.length ? ' (' + [nt ? plural(nt, 'task', 'tasks') : '', np ? plural(np, 'project', 'projects') : ''].filter(Boolean).join(', ') + ')' : '') + '</span></div>'
      + '<div class="w132st"><b>' + soon + '</b><span>coming back in the next 30 days</span></div>'
      + '<div class="w132st"><b>' + back + '</b><span>back in the last two weeks</span></div>'
      + (add ? '<button type="button" class="w132add" data-w132new="1">' + I('plus') + 'Put something in the bank</button>' : '')
      + '</div>';
  }
  function howHtml() {
    return '<details class="w132how"' + (B.howOpen ? ' open' : '') + '><summary>' + I('vault') + 'How the bank works</summary>'
      + '<p>When a piece of work cannot start for three months or more, move it here instead of leaving it on a board: open the task and press <b>Move to the bank</b> (its open subtasks go with it), or bank a whole project from its page (the project, its sub-projects and every open task in them). Pick when it should come back and say why it waits.</p>'
      + '<p>Nothing in the bank shows on boards, lists, counts, alerts, digests or agendas. On the morning of its date it goes back to its team’s board with its owner, subtasks and project, keeps its due date if that is still ahead, and carries <b>back from the bank</b> for two weeks.</p>'
      + '<p>The Hub does the same on its own when a meeting puts something off by three months or more, and Ask the Hub can move a task here when you ask it to. You can bring anything back early, or give it a new date.</p></details>';
  }
  function backHtml(team) {
    var rows = backItems().filter(function (x) { return !team || x.department === team; });
    if (!rows.length) return '';
    return '<div class="w132card w132back" id="w132back"><h3>Back from the bank <span>the last two weeks, now on their boards</span></h3>'
      + rows.slice(0, 12).map(function (x) {
        var d = dayOfIso(x.at);
        return '<div class="w132brow"><span class="ic">' + I(x.kind === 'project' ? 'box' : 'back') + '</span><div style="min-width:0"><div class="t">' + E(x.title) + '</div><div class="m">' + E(teamShort(x.department)) + (x.kind === 'project' ? ' · project' : '') + (x.owner ? ' · ' + E(x.owner) : '') + ' · back ' + E(d ? fmtShort(d) : '') + '</div></div>'
          + '<button type="button" class="w132lnk" data-w132open="' + E(x.kind) + ':' + E(x.id) + '" data-d="' + E(x.department) + '">Open</button></div>';
      }).join('') + '</div>';
  }
  function barHtml(all) {
    var counts = {}; all.forEach(function (x) { counts[x.dept] = (counts[x.dept] || 0) + 1; });
    var chips = '<button type="button" class="w132chip' + (!B.team ? ' on' : '') + '" data-w132team="">All teams <em>' + all.length + '</em></button>'
      + teams().filter(function (d) { return counts[d] || d === B.team; }).map(function (d) {
        return '<button type="button" class="w132chip' + (B.team === d ? ' on' : '') + '" data-w132team="' + E(d) + '"><i style="background:' + E(teamColor(d)) + '"></i>' + E(teamShort(d)) + ' <em>' + (counts[d] || 0) + '</em></button>';
      }).join('');
    return '<div class="w132bar"><div class="w132chips" role="group" aria-label="Teams">' + chips + '</div>'
      + '<label class="w132q">' + I('search') + '<input type="search" id="w132q" placeholder="Search the bank" value="' + E(B.q) + '" aria-label="Search the bank"></label></div>';
  }
  function whyHtml(x) {
    return x.note ? '<div class="why">' + I('note') + '<span>' + E(x.note) + '</span></div>' : '<div class="why none">No reason given.</div>';
  }
  function itemHtml(x) {
    var d = parseDay(x.until), key = x.kind + ':' + x.id, open = !!B.open[key];
    var meta = [];
    meta.push('<span><i class="dot" style="background:' + E(teamColor(x.dept)) + '"></i>' + E(teamShort(x.dept)) + '</span>');
    if (x.kind === 'task') {
      if (x.project) meta.push('<span>' + E(x.project) + '</span>');
      if (x.parent) meta.push('<span>subtask of ' + E(clip(x.parent, 48)) + '</span>');
      if (x.owner) meta.push('<span>' + E(x.owner) + '</span>');
      if (x.subs) meta.push('<span>with ' + plural(x.subs, 'subtask', 'subtasks') + '</span>');
    } else {
      if (x.parent) meta.push('<span>part of ' + E(x.parent) + '</span>');
      meta.push('<span>' + plural(x.tasks, 'open task', 'open tasks') + (x.subs ? ' in it and ' + plural(x.subs, 'sub-project', 'sub-projects') : '') + '</span>');
      if (x.leads && x.leads.length) meta.push('<span>led by ' + E(x.leads.join(', ')) + '</span>');
    }
    var by = [];
    if (x.by) by.push('Put here by ' + E(x.by));
    if (x.at) by.push(E(ago(x.at)));
    if (x.kind === 'task' && x.due) by.push('its due date (' + E(fmtShort(parseDay(x.due))) + ') comes back with it if still ahead');
    var more = '';
    if (open) {
      var bits = '';
      if (x.desc) bits += (window.w116tMarkdown ? window.w116tMarkdown(x.desc) : '<p>' + E(x.desc) + '</p>');
      if (x.kind === 'project' && x.titles && x.titles.length) bits += '<p><b>Tasks waiting with it</b></p><ul>' + x.titles.map(function (tt) { return '<li>' + E(tt) + '</li>'; }).join('') + '</ul>' + (x.tasks > x.titles.length ? '<p>and ' + (x.tasks - x.titles.length) + ' more</p>' : '');
      more = '<div class="more">' + (bits || '<p>No description.</p>') + '</div>';
    }
    var acts = '';
    if (canWork() && (B.data ? B.data.can : true) && (x.kind === 'task' || x.lead)) {
      acts = '<div class="acts"><button type="button" class="w132btn" data-w132date="' + E(key) + '">' + I('cal') + 'New date</button><button type="button" class="w132btn pri" data-w132back="' + E(key) + '">' + I('back') + 'Bring back now</button></div>';
    }
    return '<div class="w132it' + (x.kind === 'project' ? ' proj' : '') + '" data-w132it="' + E(key) + '">'
      + '<span class="ic">' + I(x.kind === 'project' ? 'box' : 'task') + '</span>'
      + '<div style="min-width:0"><button type="button" class="tt" data-w132more="' + E(key) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + E(x.title) + '</button>' + (x.kind === 'project' ? '<span class="kd">Project</span>' : '')
      + '<div class="m">' + meta.join('') + '</div>' + whyHtml(x) + (by.length ? '<div class="by">' + by.join(' · ') + '</div>' : '') + more + '</div>'
      + '<div class="r"><div class="when"><b>' + E(d ? fmtShort(d) : 'Later') + '</b><span>' + E(d ? inDays(d) : '') + '</span></div>' + acts + '</div>'
      + '</div>';
  }
  function monthTitle(k) {
    var p = k.split('-'); var y = Number(p[0]), m = Number(p[1]) - 1, t = today();
    if (y === t.getFullYear() && m === t.getMonth()) return 'Coming back this month';
    var nx = addMonths(mk(t.getFullYear(), t.getMonth(), 1), 1);
    if (y === nx.getFullYear() && m === nx.getMonth()) return 'Coming back next month (' + MONTHS[m] + ')';
    return 'Coming back in ' + MONTHS[m] + ' ' + y;
  }
  function listHtml(all) {
    var q = lower(B.q);
    var shown = all.filter(function (x) {
      if (B.team && x.dept !== B.team) return false;
      if (!q) return true;
      return lower([x.title, x.note, x.project, x.parent, x.owner, x.by, teamLabel(x.dept), (x.titles || []).join(' ')].join(' ')).indexOf(q) >= 0;
    });
    if (!all.length) return '<div class="w132card"><div class="w132empty">' + I('vault') + 'Nothing in the bank. When a piece of work cannot start for three months or more, move it here from its task or project page, and it comes back on its own.</div></div>';
    if (!shown.length) return '<div class="w132card"><div class="w132empty">Nothing in the bank matches' + (B.team ? ' for ' + E(teamShort(B.team)) : '') + (q ? ' “' + E(B.q) + '”' : '') + '.</div></div>';
    var groups = [], by = {};
    shown.forEach(function (x) { var k = String(x.until || '9999-12').slice(0, 7); if (!by[k]) { by[k] = []; groups.push(k); } by[k].push(x); });
    return groups.map(function (k) { return '<div class="w132card w132grp" data-m="' + E(k) + '"><h3>' + E(monthTitle(k)) + ' <span>' + plural(by[k].length, 'item', 'items') + '</span></h3>' + by[k].map(itemHtml).join('') + '</div>'; }).join('');
  }
  function paint() {
    var sec = document.getElementById('bank'); if (!sec) return;
    mast();
    var h = host(); if (!h) return;
    if (!B.data) { h.innerHTML = '<div class="w132load"></div><div class="w132load"></div>'; load().then(paint); return; }
    var all = items();
    var hadFocus = document.activeElement && document.activeElement.id === 'w132q', caret = hadFocus ? document.activeElement.selectionStart : null;
    h.innerHTML = statsHtml(all) + howHtml() + (B.err ? '<div class="w132err">' + E(B.err) + '</div>' : '') + backHtml(B.team) + barHtml(all) + '<div id="w132list">' + listHtml(all) + '</div>';
    if (hadFocus) { var q = document.getElementById('w132q'); if (q) { q.focus(); try { q.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  function paintList() { var el = document.getElementById('w132list'); if (el) el.innerHTML = listHtml(items()); }
  function onPage() { var s = document.getElementById('bank'); return !!(s && s.classList.contains('active')); }
  function paintAll() {
    if (onPage()) paint();
    try { injectCard(true); } catch (e) { /* fine */ }
  }
  function route(h) {
    var p = String(h || '').replace(/^#/, '').split('/');
    var t = p[1] && teams().indexOf(p[1]) >= 0 ? p[1] : '';
    B.team = t;
    try { document.title = 'The bank · Welfare Avenue Hub'; } catch (e) { /* fine */ }
    paint();
    load(!B.data || Date.now() - B.at > 30000).then(function () { if (onPage()) paint(); });
  }
