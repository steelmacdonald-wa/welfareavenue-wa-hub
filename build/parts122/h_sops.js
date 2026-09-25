
  /* ---------- SOPs (wave125, 25/09/26) ----------
     Steel: "If we've done a similar event like the ones listed in the past please provide SOPs. I'm wondering if
     each department should have SOP on their home page or they should all be hosted in trainings center."
     Both: SOPs live here (one library, searchable, progress counts like any training), each team's overview
     shows its own ("Our SOPs"), and the events calendar links each event to its SOP (fund_events.sop_training_id).
     A trainings row with kind 'sop' carries its content in body: depts, owner, intro, glance [[label, value]],
     format [], editions [[label, when, text]], roles [[role, what]], phases [{when, title, steps []}], dayof [],
     money [], lessons [], confirm [], links [[title, url]], reviewed, sources. Leaders, and members of the SOP's
     teams, edit it in plain text. */
  var SOP_TEAMS = ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'];
  function isSop(t) { return !!t && t.active !== false && kindOf(t) === 'sop'; }
  function sopBody(t) { var b = t && t.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } } return b && typeof b === 'object' ? b : {}; }
  function sopDepts(t) { var b = sopBody(t), d = Array.isArray(b.depts) ? b.depts : (b.dept ? [b.dept] : []); return d.filter(function (x) { return SOP_TEAMS.indexOf(x) >= 0; }); }
  function sopTitle(t) { return String((t && t.title) || '').replace(/^SOP:\s*/i, ''); }
  function teamName(d) { try { return (window.WA_TEAMS && WA_TEAMS.labels && WA_TEAMS.labels[d]) || tabLabel(d); } catch (e) { return d; } }
  function teamShortName(d) { try { return (window.WA_TEAMS && WA_TEAMS.short && WA_TEAMS.short[d]) || teamName(d); } catch (e) { return d; } }
  function canEditSop(t) {
    if (!staffOk() || role() === 'board') return false;
    if (isLeader()) return true;
    var d = me().dept; if (!d) return false;
    if (!t) return true;
    var ds = sopDepts(t); return !ds.length || ds.indexOf(d) >= 0;
  }
  function sopSort(a, b) { return (a.sort || 0) - (b.sort || 0) || String(a.title).localeCompare(String(b.title)); }
  function clip2(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
  function ymdToday() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ---------- the events that use an SOP ---------- */
  var SF = { rows: null, busy: null };
  function sopFundLoad() {
    if (SF.rows) return Promise.resolve(SF.rows);
    if (SF.busy) return SF.busy;
    SF.busy = Promise.resolve(db.from('fund_events').select('id, title, season, precision, start_date, end_date, timing, status, raised, sop_training_id').not('sop_training_id', 'is', null))
      .then(function (r) { SF.rows = ((r && r.data) || []).filter(function (f) { return f && f.sop_training_id != null; }); SF.busy = null; return SF.rows; },
        function () { SF.rows = []; SF.busy = null; return SF.rows; });
    return SF.busy;
  }
  function sopFundFor(t) { return (SF.rows || []).filter(function (f) { return t && String(f.sop_training_id) === String(t.id) && f.status !== 'cancelled'; }).sort(function (a, b) { return String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')); }); }
  function fundDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if (!m) return null; var x = new Date(0); x.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3])); x.setHours(12, 0, 0, 0); return x; }
  function fundWhen2(f) {
    var s = fundDay(f.start_date), e = fundDay(f.end_date);
    if (f.precision === 'day' && s) return MONTHS[s.getMonth()].slice(0, 3) + ' ' + s.getDate() + (e && e.getTime() !== s.getTime() ? ' to ' + (e.getMonth() !== s.getMonth() ? MONTHS[e.getMonth()].slice(0, 3) + ' ' : '') + e.getDate() : '') + ', ' + s.getFullYear();
    if (f.precision === 'month' && s) return MONTHS[s.getMonth()] + ' ' + s.getFullYear();
    if ((f.precision === 'range' || f.precision === 'season') && s) return String(f.timing || '').replace(/\s*\(.*\)\s*$/, '') + (/\d{4}/.test(f.timing || '') ? '' : ' ' + (e || s).getFullYear());
    return f.timing || (f.precision === 'flexible' ? 'Flexible' : 'Not yet scheduled');
  }
  function fundUpcoming(f) { if (f.status === 'done' || f.status === 'cancelled') return false; var e = fundDay(f.end_date) || fundDay(f.start_date); if (!e) return true; var t = new Date(); t.setHours(0, 0, 0, 0); return e >= t; }
  function sopNextHtml(t) {
    var list = sopFundFor(t); if (!list.length) return '';
    var st = { idea: 'Idea', planned: 'Planned', confirmed: 'Confirmed', done: 'Done', cancelled: 'Cancelled' };
    return '<div class="sopnext"><div class="lb">' + ic('clock') + ' On the events calendar</div>' + list.map(function (f) {
      var up = fundUpcoming(f);
      return '<button class="ev' + (up ? ' up' : '') + '" data-w122sopfund="' + E(f.id) + '"><b>' + E(f.title) + '</b><span>' + E(fundWhen2(f)) + ' · ' + E(st[f.status] || f.status || '') + (f.raised != null && f.status === 'done' ? ' · raised $' + Number(f.raised).toLocaleString('en-CA') : '') + '</span>' + ic('arrow') + '</button>';
    }).join('') + '</div>';
  }
  function fillSopNext() {
    var el = document.querySelector('#w122sheet [data-w122sopnext]'); if (!el || !R || !R.t) return;
    if (String(el.getAttribute('data-w122sopnext')) !== String(R.t.id)) return;
    var h = sopNextHtml(R.t); if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
  }

  /* ---------- reading an SOP ---------- */
  function sopUl(items, cls) { return '<ul class="' + (cls || 'bl') + '">' + (items || []).map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>'; }
  function sopSec(id, title, inner) { return '<section class="sops" id="w122sop-' + id + '"><h3>' + E(title) + '</h3>' + inner + '</section>'; }
  function sopHtml(t) {
    var b = sopBody(t), ds = sopDepts(t), toc = [], h = '';
    if (!SF.rows) sopFundLoad().then(fillSopNext);
    var has = function (k) { return Array.isArray(b[k]) && b[k].length; };
    [['format', 'How it works'], ['editions', 'Past editions'], ['roles', 'Who does what'], ['phases', 'Step by step'], ['dayof', 'On the day'], ['money', 'Money'], ['lessons', 'What we learned'], ['links', 'Documents']].forEach(function (x) { if (has(x[0])) toc.push(x); });
    h += '<div class="w122sop">';
    h += '<div class="shero"><div class="chips">' + ds.map(function (d) { return '<span class="tm">' + E(teamShortName(d)) + '</span>'; }).join('')
      + (b.owner ? '<span class="own">' + ic('user') + ' ' + E(b.owner) + '</span>' : '')
      + (b.reviewed ? '<span class="rev">' + ic('check') + ' Reviewed ' + E(fmtDate(String(b.reviewed).slice(0, 10) + 'T12:00:00')) + '</span>' : '') + '</div>'
      + '<p class="intro">' + E(b.intro || t.description || '') + '</p>'
      + (toc.length > 2 ? '<div class="toc">' + toc.map(function (x) { return '<button data-w122sopjump="' + x[0] + '">' + E(x[1]) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    if (has('glance')) h += '<div class="glance">' + b.glance.map(function (g) { return '<div><b>' + E(g[0]) + '</b><span>' + E(g[1]) + '</span></div>'; }).join('') + '</div>';
    h += '<div data-w122sopnext="' + E(t.id) + '">' + sopNextHtml(t) + '</div>';
    if (has('format')) h += sopSec('format', 'How it works', sopUl(b.format));
    if (has('editions')) h += sopSec('editions', 'Past editions', '<div class="eds">' + b.editions.map(function (e) { return '<div class="ed"><div class="yr"><b>' + E(e[0]) + '</b>' + (e[1] ? '<span>' + E(e[1]) + '</span>' : '') + '</div><p>' + E(e[2] || '') + '</p></div>'; }).join('') + '</div>');
    if (has('roles')) h += sopSec('roles', 'Who does what', '<div class="roles">' + b.roles.map(function (r) { return '<div class="ro"><b>' + E(r[0]) + '</b><span>' + E(r[1] || '') + '</span></div>'; }).join('') + '</div>');
    if (has('phases')) h += sopSec('phases', 'Step by step', '<div class="phs">' + b.phases.map(function (p, i) {
      return '<div class="ph"><div class="phh"><span class="n">' + (i + 1) + '</span><div>' + (p.when ? '<span class="wh">' + E(p.when) + '</span>' : '') + '<h4>' + E(p.title || '') + '</h4></div></div>' + sopUl(p.steps, 'ck') + '</div>';
    }).join('') + '</div>');
    if (has('dayof')) h += sopSec('dayof', 'On the day', sopUl(b.dayof, 'ck'));
    if (has('money')) h += sopSec('money', 'Money', sopUl(b.money));
    if (has('lessons')) h += sopSec('lessons', 'What we learned', sopUl(b.lessons, 'ls'));
    if (has('confirm')) h += '<div class="todo"><b>' + ic('flag') + ' Still to confirm</b>' + sopUl(b.confirm) + '</div>';
    if (has('links')) {
      var ls = b.links.filter(function (l) { return safeUrl(l[1]); });
      if (ls.length) h += sopSec('links', 'Documents', '<div class="lnks">' + ls.map(function (l) { return '<a href="' + E(safeUrl(l[1])) + '" target="_blank" rel="noopener">' + ic('file') + '<span>' + E(l[0] || hostOf(l[1])) + '</span>' + ic('ext') + '</a>'; }).join('') + '</div>');
    }
    h += '<p class="src">' + E(b.sources || 'Keep this SOP current: update it after every edition.') + (canEditSop(t) ? ' <button class="w122lnk" data-w122sopedit="1">Update it</button>' : '') + '</p>';
    return h + '</div>';
  }

  /* ---------- writing and editing an SOP (plain text in, structure out) ---------- */
  function linesOf(v) { return String(v || '').split(/\r?\n/).map(function (x) { return x.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim(); }).filter(Boolean); }
  function pairsIn(v, sep) { return linesOf(v).map(function (l) { var i = l.indexOf(sep); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + sep.length).trim()] : [l, '']; }); }
  function pairsOut(a, sep) { return (a || []).map(function (x) { return (x[0] || '') + (x[1] ? sep + x[1] : ''); }).join('\n'); }
  function triplesIn(v) { return linesOf(v).map(function (l) { var p = l.split(' | '); if (p.length >= 3) return [p[0].trim(), p[1].trim(), p.slice(2).join(' | ').trim()]; if (p.length === 2) return [p[0].trim(), '', p[1].trim()]; return ['', '', l]; }); }
  function triplesOut(a) { return (a || []).map(function (x) { return [x[0] || '', x[1] || '', x[2] || ''].join(' | '); }).join('\n'); }
  function linksIn(v) { return linesOf(v).map(function (l) { var i = l.lastIndexOf(' | '); var t = i > 0 ? l.slice(0, i).trim() : ''; var u = i > 0 ? l.slice(i + 3).trim() : l.trim(); return [t || hostOf(u), u]; }).filter(function (x) { return safeUrl(x[1]); }); }
  function linksOut(a) { return (a || []).map(function (x) { return (x[0] ? x[0] + ' | ' : '') + (x[1] || ''); }).join('\n'); }
  function phasesOut(ps) { return (ps || []).map(function (p) { return '## ' + (p.when ? p.when + ' | ' : '') + (p.title || '') + '\n' + (p.steps || []).map(function (s) { return '- ' + s; }).join('\n'); }).join('\n\n'); }
  function phasesIn(v) {
    var out = [], cur = null;
    String(v || '').split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim(); if (!l) return;
      var m = /^#{1,3}\s*(.*)$/.exec(l);
      if (m) { var parts = m[1].split(' | '); cur = { when: parts.length > 1 ? parts[0].trim() : '', title: (parts.length > 1 ? parts.slice(1).join(' | ') : parts[0]).trim(), steps: [] }; out.push(cur); return; }
      if (!cur) { cur = { when: '', title: 'Steps', steps: [] }; out.push(cur); }
      var s = l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim(); if (s) cur.steps.push(s);
    });
    return out.filter(function (p) { return p.title || p.steps.length; });
  }
  function openSopForm(t, dept) { stopTimer(); R = { mode: 'sopform', t: t || null, dept: dept || '', secs: 0, kind: 'sop' }; renderSheet(); }
  function renderSopForm(sh) {
    var t = R.t, isNew = !t, b = t ? sopBody(t) : {};
    var ds = t ? sopDepts(t) : (R.dept && SOP_TEAMS.indexOf(R.dept) >= 0 ? [R.dept] : (me().dept ? [me().dept] : []));
    var ta = function (key, label, hint, val, rows) { return '<label>' + E(label) + (hint ? '<small>' + E(hint) + '</small>' : '') + '<textarea data-sf="' + key + '" rows="' + (rows || 4) + '">' + E(val || '') + '</textarea></label>'; };
    sh.innerHTML = '<div class="hd"><div class="hi"><div class="kk"><span class="kd" style="background:linear-gradient(135deg,#8A5A0B,' + GOLD + ')">' + ic(isNew ? 'plus' : 'edit') + (isNew ? ' New SOP' : ' Edit SOP') + '</span></div><h2>' + (isNew ? 'Write an SOP' : E(sopTitle(t))) + '</h2></div><div class="acts"><button class="xb" data-w122x="1" title="Close (Esc)">' + ic('x') + '</button></div></div>'
      + '<div class="bd"><div class="main"><div class="wrap wide"><div class="form w122sopf">'
      + '<p class="snote" style="margin-top:0">Write it the way you would explain it to the next person running it. One item per line; the formats are shown under each box.</p>'
      + '<div class="row2"><label>Title<input type="text" data-sf="title" value="' + E(t ? sopTitle(t) : '') + '" placeholder="For example: Flag Football tournament"></label>'
      + '<label>Owner<input type="text" data-sf="owner" value="' + E(b.owner || '') + '" placeholder="For example: Fundraising, with Marketing"></label></div>'
      + '<label>One-line summary<small>Shown on the card in the academy and on the team page.</small><input type="text" data-sf="description" value="' + E((t && t.description) || '') + '"></label>'
      + '<div class="teams"><span>Teams</span>' + SOP_TEAMS.map(function (d) { return '<label class="tg"><input type="checkbox" data-sfteam="1" value="' + d + '"' + (ds.indexOf(d) >= 0 ? ' checked' : '') + '>' + E(teamShortName(d)) + '</label>'; }).join('') + '</div>'
      + ta('intro', 'What it is and why we do it', 'A short paragraph.', b.intro, 3)
      + ta('glance', 'At a glance', 'Label: value, one per line. For example: When: a Saturday in August', pairsOut(b.glance, ': '), 5)
      + ta('format', 'How it works', 'Optional. One point per line.', (b.format || []).join('\n'), 3)
      + ta('editions', 'Past editions', 'Year | when | what happened, one per line.', triplesOut(b.editions), 4)
      + ta('roles', 'Who does what', 'Role: what they do, one per line.', pairsOut(b.roles, ': '), 5)
      + ta('phases', 'Step by step', 'Start each phase with ## when | title, then one step per line. For example: ## 5 months out | Lock the partner', phasesOut(b.phases), 14)
      + ta('dayof', 'On the day', 'One step per line.', (b.dayof || []).join('\n'), 5)
      + '<div class="row2">' + ta('money', 'Money', 'One point per line.', (b.money || []).join('\n'), 4) + ta('lessons', 'What we learned', 'One lesson per line.', (b.lessons || []).join('\n'), 4) + '</div>'
      + '<div class="row2">' + ta('confirm', 'Still to confirm', 'Optional. One question per line.', (b.confirm || []).join('\n'), 3) + ta('links', 'Documents', 'Title | https://link, one per line.', linksOut(b.links), 3) + '</div>'
      + '<label style="max-width:180px">Minutes to read<input type="number" min="1" max="120" data-sf="minutes" value="' + E((t && t.minutes) || 6) + '"></label>'
      + '</div></div></div></div>'
      + '<div class="ft">' + (!isNew && isLeader() ? '<button class="w122btn ghost" data-w122retire="1">Retire it</button>' : '') + '<span class="sp"></span><button class="w122btn soft" data-w122sopcancel="1">Cancel</button><button class="w122btn" data-w122sopsave="1">' + ic('check') + (isNew ? ' Add the SOP' : ' Save') + '</button></div>';
    var main = sh.querySelector('.main'); if (main) main.scrollTop = 0;
    var first = sh.querySelector('[data-sf="title"]'); if (first && isNew) { try { first.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function slugOf(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sop'; }
  var sopSaving = false;
  async function saveSopForm() {
    var sh = document.querySelector('#w122sheet .sh'); if (!sh || !R || sopSaving) return;
    var f = {}; sh.querySelectorAll('[data-sf]').forEach(function (el) { f[el.getAttribute('data-sf')] = el.value; });
    var depts = Array.prototype.map.call(sh.querySelectorAll('[data-sfteam]:checked'), function (el) { return el.value; });
    var title = String(f.title || '').trim().replace(/^SOP:\s*/i, '');
    if (!title) { toastS('Give the SOP a title'); return; }
    if (!depts.length) { toastS('Pick at least one team'); return; }
    var old = R.t ? sopBody(R.t) : {};
    var body = Object.assign({}, old, {
      v: 1, depts: depts, owner: String(f.owner || '').trim(), intro: String(f.intro || '').trim(),
      glance: pairsIn(f.glance, ': '), format: linesOf(f.format), editions: triplesIn(f.editions), roles: pairsIn(f.roles, ': '),
      phases: phasesIn(f.phases), dayof: linesOf(f.dayof), money: linesOf(f.money), lessons: linesOf(f.lessons), confirm: linesOf(f.confirm),
      links: linksIn(f.links), reviewed: ymdToday(), edited_by: me().full
    });
    var row = { title: 'SOP: ' + title, description: String(f.description || '').trim() || null, kind: 'sop', category: 'Our SOPs', body: body, minutes: f.minutes ? Math.max(1, Math.min(120, Math.round(Number(f.minutes)))) : null, updated_at: nowIso() };
    sopSaving = true;
    try {
      var res;
      if (R.t) {
        res = await db.from('trainings').update(row).eq('id', R.t.id).select(); if (res.error) throw res.error;
        Object.keys(row).forEach(function (k) { R.t[k] = row[k]; }); applyTrainings(A.trainings); toastS('Saved'); var keep = R.t; openTraining(keep.id);
      } else {
        row.active = true; row.sort = 900; row.source = 'hub'; row.xp = 30; row.key = 'sop:' + slugOf(title) + '-' + Date.now().toString(36);
        res = await db.from('trainings').insert(row).select(); if (res.error) throw res.error;
        var nt = (res.data && res.data[0]) || row; if (!nt.id) nt.id = 'tmp' + Date.now();
        A.trainings.push(nt); applyTrainings(A.trainings); toastS('Added to Our SOPs');
        if (location.hash === '#training/t/' + nt.id) openTraining(nt.id); else location.hash = '#training/t/' + nt.id;
      }
      SC.rows = null; paintSoon(); setTimeout(function () { injectSopCard(true); }, 50);
    } catch (e) { toastS('Could not save: ' + String((e && e.message) || e).slice(0, 80)); }
    finally { sopSaving = false; }
  }

  /* ---------- the academy home: Our SOPs ---------- */
  function sopTile(t) {
    var b = sopBody(t), ds = sopDepts(t), done = isDone(t.id), nx = sopFundFor(t).filter(fundUpcoming)[0];
    return '<button class="w122sopt' + (done ? ' ok' : '') + '" data-w122open="' + E(t.id) + '"><span class="tp"><span class="i">' + ic('list') + '</span>' + ds.slice(0, 2).map(function (d) { return '<span class="tm">' + E(teamShortName(d)) + '</span>'; }).join('') + (done ? '<span class="dn">' + ic('check') + ' Read</span>' : '') + '</span>'
      + '<b>' + E(sopTitle(t)) + '</b><span class="ds">' + E(clip2(t.description || b.intro || '', 140)) + '</span>'
      + '<span class="ft">' + ic('clock') + ' ' + mins(minutesOf(t)) + ((b.phases || []).length ? ' · ' + plural(b.phases.length, 'phase') : '') + (nx ? '<em>Next: ' + E(nx.title) + '</em>' : '') + '</span></button>';
  }
  function sopsHomeHtml() {
    var list = A.trainings.filter(isSop).sort(sopSort), canAdd = canEditSop(null);
    if (!list.length && !canAdd) return '';
    if (!SF.rows && !SF.busy) sopFundLoad().then(paintSoon);
    var mine = me().dept;
    if (mine) list = list.filter(function (t) { return sopDepts(t).indexOf(mine) >= 0; }).concat(list.filter(function (t) { return sopDepts(t).indexOf(mine) < 0; }));
    return '<section class="w122sec" data-sec="sops"><div class="w122sech"><div><h2>Our SOPs</h2><div class="sub">How we run the things we do again and again: step by step, with what we learned last time. Your team’s come first.</div></div><span class="sp"></span>'
      + (canAdd ? '<button class="w122btn soft sm" data-w122sopnew="' + E(mine || '') + '">' + ic('plus') + ' Write an SOP</button>' : '') + '</div>'
      + (list.length ? '<div class="w122sops">' + list.map(sopTile).join('') + '</div>' : '<div class="w122none">No SOPs yet. Write down how your team runs something it does again and again.</div>') + '</section>';
  }

  /* ---------- each team's overview: Our SOPs ---------- */
  var SC = { rows: null, busy: null, at: 0 };
  function sopCardLoad() {
    if (A.loaded) { SC.rows = A.trainings.filter(isSop); SC.at = Date.now(); return Promise.resolve(SC.rows); }
    if (SC.rows && Date.now() - SC.at < 120000) return Promise.resolve(SC.rows);
    if (SC.busy) return SC.busy;
    SC.busy = Promise.resolve(db.from('trainings').select('id, title, description, kind, body, sort, active, category, minutes, key').eq('kind', 'sop').eq('active', true).order('sort'))
      .then(function (r) { SC.rows = ((r && r.data) || []).filter(isSop); SC.at = Date.now(); SC.busy = null; return SC.rows; },
        function () { SC.busy = null; SC.rows = SC.rows || []; return SC.rows; });
    return SC.busy;
  }
  function teamRouteSop() { var h = decodeURIComponent(location.hash || '').replace(/^#/, ''); var p = h.split('/'); if (p[0] !== 'team' || !p[1] || SOP_TEAMS.indexOf(p[1]) < 0) return null; if (p[2] && p[2] !== 'overview') return null; return p[1]; }
  function sopCardHtml(d) {
    var list = (SC.rows || []).filter(function (t) { return sopDepts(t).indexOf(d) >= 0; }).sort(sopSort);
    var body = SC.rows == null ? '<p class="w116empty">Loading…</p>' : list.length
      ? '<div class="w122soprows">' + list.map(function (t) { return '<a class="w122soprow" data-w122sopgo="' + E(t.id) + '" tabindex="0" role="button"><span class="i">' + ic('list') + '</span><span class="tx"><b>' + E(sopTitle(t)) + '</b><span>' + E(clip2(t.description || '', 88)) + '</span></span>' + ic('chev') + '</a>'; }).join('') + '</div>'
      : '<p class="w116empty">No SOPs for this team yet. Write down how the team runs the things it does again and again, so the next person starts from what worked.</p>';
    return '<div class="w116card w122sopcard" id="w122sopcard" data-d="' + d + '"><h3>Our SOPs <span class="lnk" data-w122sopall="1">all SOPs</span></h3>' + body
      + (canEditSop(null) ? '<div class="w116addrow"><a data-w122sopnew="' + d + '">+ Write an SOP</a></div>' : '') + '</div>';
  }
  var sopCardBusy = false;
  function injectSopCard(force) {
    if (sopCardBusy) return;
    var d = teamRouteSop(); if (!d || !staffOk()) return;
    var host = document.getElementById('w116host'); if (!host) return;
    var cols = host.querySelectorAll('.w116grid > .w116col'); var col = cols[1] || cols[0]; if (!col) return;
    var anchor = null;
    Array.prototype.forEach.call(col.children, function (c) { if (c.id === 'w122sopcard') return; var h3 = c.querySelector('h3'); if (h3 && /^projects/i.test(String(h3.textContent || '').trim())) anchor = c; });
    var html = sopCardHtml(d), cur = document.getElementById('w122sopcard');
    var placed = cur && cur.parentNode === col && (anchor ? anchor.nextElementSibling === cur : true);
    if (cur && !force && placed && cur.__h === html) return;
    sopCardBusy = true;
    try {
      if (cur) cur.remove();
      if (anchor) anchor.insertAdjacentHTML('afterend', html); else col.insertAdjacentHTML('beforeend', html);
      var nc = document.getElementById('w122sopcard'); if (nc) nc.__h = html;
    } finally { sopCardBusy = false; }
    if (SC.rows == null && !SC.busy) sopCardLoad().then(function () { injectSopCard(true); });
  }
  var sopCardT = null;
  function watchSopTeam() {
    var sec = document.getElementById('team'); if (!sec || sec.__w122sop) return;
    sec.__w122sop = true;
    try { new MutationObserver(function () { if (sopCardBusy) return; clearTimeout(sopCardT); sopCardT = setTimeout(function () { injectSopCard(false); }, 60); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
  window.addEventListener('hashchange', function () { try { if (teamRouteSop()) { watchSopTeam(); setTimeout(function () { injectSopCard(false); }, 120); } } catch (e) { /* fine */ } });

  /* ---------- clicks that work anywhere (team cards, the events calendar, the SOP sheet) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('[data-w122sopgo]'))) { e.preventDefault(); location.hash = '#training/t/' + el.getAttribute('data-w122sopgo'); return; }
    if ((el = t.closest('[data-w122sopnew]'))) { e.preventDefault(); var dd = el.getAttribute('data-w122sopnew') || ''; if (location.hash === '#training/sopnew/' + dd) { openSopForm(null, dd); } else location.hash = '#training/sopnew/' + dd; return; }
    if ((el = t.closest('[data-w122sopall]'))) { e.preventDefault(); location.hash = '#training/sops'; return; }
    if ((el = t.closest('[data-w122sopfund]'))) { e.preventDefault(); location.hash = '#fundevents/' + el.getAttribute('data-w122sopfund'); return; }
    if (!t.closest('#w122sheet') || !R) return;
    if ((el = t.closest('[data-w122sopedit]'))) { stopTimer(); R.mode = 'sopform'; renderSheet(); return; }
    if ((el = t.closest('[data-w122sopsave]'))) { saveSopForm(); return; }
    if ((el = t.closest('[data-w122sopcancel]'))) { if (R.t) openTraining(R.t.id); else closeSheet(); return; }
    if ((el = t.closest('[data-w122sopjump]'))) {
      var sec2 = document.getElementById('w122sop-' + el.getAttribute('data-w122sopjump')), main = document.querySelector('#w122sheet .main');
      if (sec2 && main) main.scrollTo({ top: sec2.offsetTop - 12, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('.w122soprow[data-w122sopgo]')) { e.preventDefault(); e.target.click(); }
  });
