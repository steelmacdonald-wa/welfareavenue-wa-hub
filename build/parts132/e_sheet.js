
  /* ---------- the sheet: move to the bank, put something new in, a new date ---------- */
  var lastFocus = null;
  function sheetEl() { var el = document.getElementById('w132sheet'); if (!el) { el = document.createElement('div'); el.id = 'w132sheet'; document.body.appendChild(el); } return el; }
  function dateChoices() {
    var t = today(), out = [];
    var m3 = addMonths(t, 3), m6 = addMonths(t, 6);
    out.push({ k: '3m', t: 'In 3 months', d: m3 });
    out.push({ k: '6m', t: 'In 6 months', d: m6 });
    /* the new year, when it falls between the two and is not too close */
    var ny = mk(t.getFullYear() + 1, 0, 1), dn = daysBetween(t, ny);
    if (dn >= 60 && Math.abs(daysBetween(ny, m3)) > 10 && Math.abs(daysBetween(ny, m6)) > 10) out.push({ k: 'ny', t: 'In the new year', d: ny });
    out.sort(function (a, b) { return a.d.getTime() - b.d.getTime(); });
    return out;
  }
  function openSheet(cfg) {
    lastFocus = document.activeElement;
    var ch = dateChoices();
    cfg.pick = cfg.pick || (cfg.kind === 'date' ? 'custom' : '3m');
    cfg.custom = cfg.custom || (cfg.kind === 'date' && cfg.until ? cfg.until : ymd(addMonths(today(), 4)));
    cfg.choices = ch;
    B.sheet = cfg; renderSheet(true);
  }
  function chosenDate() {
    var s = B.sheet; if (!s) return '';
    if (s.pick === 'custom') return s.custom || '';
    var c = (s.choices || []).filter(function (x) { return x.k === s.pick; })[0];
    return c ? ymd(c.d) : '';
  }
  function projectOptions(dept, cur) {
    var ps = projects().filter(function (p) { return (p.status || 'active') === 'active' && p.department === dept && !isGeneralList(p); });
    return '<option value="">No project (the team’s general list)</option>' + ps.map(function (p) { return '<option value="' + E(p.id) + '"' + (String(cur) === String(p.id) ? ' selected' : '') + '>' + E(p.name) + '</option>'; }).join('');
  }
  function sheetBody() {
    var s = B.sheet, t = today(), html = '';
    if (s.kind === 'new') {
      html += '<div><div class="lb">What can wait</div><input type="text" id="w132ntitle" maxlength="250" placeholder="For example: plan the spring volunteer drive" value="' + E(s.title || '') + '"></div>'
        + '<div class="two"><div><div class="lb">Team</div><select id="w132nteam">' + teams().map(function (d) { return '<option value="' + E(d) + '"' + (s.dept === d ? ' selected' : '') + '>' + E(teamLabel(d)) + '</option>'; }).join('') + '</select></div>'
        + '<div><div class="lb">Project</div><select id="w132nproj">' + projectOptions(s.dept, s.project || '') + '</select></div></div>';
    }
    if (s.kind === 'task') {
      var subs = treeIds(s.task.id).length - 1;
      html += '<p class="ex">It leaves every board, list, count and alert' + (subs ? ', with its ' + plural(subs, 'open subtask', 'open subtasks') : '') + ', and goes back to the ' + E(teamShort(s.task.department)) + ' board on the day you pick, with its owner' + (s.task.due_date ? ' and its due date if that is still ahead' : '') + '.</p>';
    }
    if (s.kind === 'project') {
      html += '<p class="ex">The project' + (s.subs ? ', its ' + plural(s.subs, 'sub-project', 'sub-projects') : '') + ' and ' + (s.count ? 'its ' + plural(s.count, 'open task', 'open tasks') : 'everything in it') + ' leave every board and list, and come back together on the day you pick.</p>';
    }
    if (s.kind === 'new') html += '<p class="ex">It goes straight to the bank and lands on the team’s board on the day you pick.</p>';
    if (s.kind === 'date') html += '<p class="ex">It stays in the bank until then' + (s.until ? ' (it was coming back on ' + E(fmtDay(parseDay(s.until), true)) + ')' : '') + '.</p>';
    html += '<div><div class="lb">Comes back</div><div class="opts" role="radiogroup" aria-label="When it comes back">'
      + (s.kind === 'date' ? '' : s.choices.map(function (c) { return '<button type="button" class="opt' + (s.pick === c.k ? ' on' : '') + '" role="radio" aria-checked="' + (s.pick === c.k ? 'true' : 'false') + '" data-w132pick="' + c.k + '"><b>' + E(c.t) + '</b><span>' + E(fmtDay(c.d, c.d.getFullYear() !== t.getFullYear())) + '</span></button>'; }).join(''))
      + '<button type="button" class="opt' + (s.pick === 'custom' ? ' on' : '') + '" role="radio" aria-checked="' + (s.pick === 'custom' ? 'true' : 'false') + '" data-w132pick="custom"><b>' + (s.kind === 'date' ? 'On this day' : 'Pick a day') + '</b><span>' + E(s.pick === 'custom' && s.custom ? fmtDay(parseDay(s.custom), true) : 'any day') + '</span></button></div>'
      + (s.pick === 'custom' ? '<input type="date" class="pick" id="w132day" min="' + E(ymd(addDays(t, 1))) + '" max="' + E(ymd(addDays(t, 1095))) + '" value="' + E(s.custom || '') + '" aria-label="The day it comes back">' : '') + '</div>';
    if (s.kind !== 'date') html += '<div><div class="lb">Why it waits</div><input type="text" id="w132why" maxlength="280" placeholder="For example: after the gala in March, or once the grant decision is in" value="' + E(s.note || '') + '"></div>';
    var d = parseDay(chosenDate()), soft = '';
    if (d && daysBetween(t, d) < 60 && daysBetween(t, d) > 0) soft = 'The bank is for work that waits three months or more. For anything sooner, a due date keeps it on the board.';
    html += '<div class="soft" id="w132soft">' + E(soft) + '</div><div class="err" id="w132err">' + E(s.err || '') + '</div>';
    return html;
  }
  function renderSheet(first) {
    var s = B.sheet; if (!s) { closeSheet(); return; }
    var el = sheetEl();
    var title = s.kind === 'project' ? 'Move the project to the bank' : s.kind === 'new' ? 'Put something in the bank' : s.kind === 'date' ? 'A new date' : 'Move to the bank';
    var sub = s.kind === 'task' ? s.task.title : s.kind === 'project' ? s.project.name : s.kind === 'date' ? s.title : '';
    var go = s.kind === 'date' ? 'Save the date' : s.kind === 'new' ? 'Put it in the bank' : 'Move to the bank';
    if (first || !el.querySelector('.pane')) {
      el.innerHTML = '<div class="bk" data-w132close="1"></div><div class="pane" role="dialog" aria-modal="true"><div class="ph"></div><div class="bd"></div><div class="ft"></div></div>';
    }
    el.querySelector('.pane').setAttribute('aria-label', title);
    el.querySelector('.ph').innerHTML = '<div style="min-width:0"><div class="kk">' + I('vault') + 'The bank</div><h2>' + E(title) + '</h2>' + (sub ? '<div class="sub">' + E(sub) + '</div>' : '') + '</div><span class="sp"></span><button type="button" class="xb" data-w132close="1" aria-label="Close">' + I('x') + '</button>';
    el.querySelector('.bd').innerHTML = sheetBody();
    el.querySelector('.ft').innerHTML = '<button type="button" class="w132btn" data-w132close="1">Cancel</button><button type="button" class="w132btn pri" data-w132go="1"' + (s.busy ? ' disabled' : '') + '>' + I(s.kind === 'date' ? 'cal' : 'vault') + E(s.busy ? 'Saving…' : go) + '</button>';
    el.classList.add('on');
    if (first) setTimeout(function () { var f = el.querySelector(s.kind === 'new' ? '#w132ntitle' : s.kind === 'date' ? '#w132day' : '#w132why') || el.querySelector('.xb'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }, 40);
  }
  /* keep what was typed before a repaint */
  function readSheet() {
    var s = B.sheet; if (!s) return;
    var g = function (id) { var x = document.getElementById(id); return x ? x.value : null; };
    var v;
    if ((v = g('w132ntitle')) !== null) s.title = v;
    if ((v = g('w132nteam')) !== null) s.dept = v;
    if ((v = g('w132nproj')) !== null) s.project = v;
    if ((v = g('w132why')) !== null) s.note = v;
    if ((v = g('w132day')) !== null && v) s.custom = v;
  }
  function closeSheet() {
    var el = document.getElementById('w132sheet'); if (el) { el.classList.remove('on'); el.innerHTML = ''; }
    B.sheet = null;
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    lastFocus = null;
  }
  function sheetErr(msg) { var s = B.sheet; if (!s) return; s.err = msg; s.busy = false; renderSheet(false); }
  async function submitSheet() {
    var s = B.sheet; if (!s || s.busy) return;
    readSheet();
    var until = chosenDate(), d = parseDay(until), t = today();
    if (!d) return sheetErr('Pick the day it comes back.');
    if (daysBetween(t, d) <= 0) return sheetErr('Pick a day after today.');
    if (daysBetween(t, d) > 1095) return sheetErr('Pick a day in the next three years.');
    var note = String(s.note || '').trim();
    if (s.kind === 'new' && !String(s.title || '').trim()) return sheetErr('Say what can wait.');
    s.busy = true; s.err = ''; renderSheet(false);
    try {
      if (s.kind === 'task') await bankTask(s.task, until, note);
      else if (s.kind === 'project') await bankProject(s.project, until, note);
      else if (s.kind === 'new') await addToBank({ title: String(s.title).trim(), dept: s.dept, project: s.project, until: until, note: note, owner: myName() });
      else if (s.kind === 'date') await redate(s.itemKind, s.id, until);
      closeSheet();
    } catch (e) { sheetErr(errText(e)); }
  }
