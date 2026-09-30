  /* ---------- assigning trainings to the organization (HR, leaders and admins) ---------- */
  var AS = null;   /* the open form: picks, audience, teams, people, include_new, due, note, q, pq */
  /* the Hub's modal sits under the Academy's sheet: lift it while the form is open over a module or an avenue */
  function lift(on) { var b = document.getElementById('modalBack'); if (b) b.classList.toggle('w169top', !!on); }
  function sheetUp() { var el = document.getElementById('w122sheet'); return !!(el && el.classList.contains('on')); }
  function closeForm() { AS = null; lift(false); try { closeModal(); } catch (e) { /* none open */ } }
  function prepare() {
    var p = [];
    try { if (window.w122 && typeof w122.load === 'function') p.push(w122.load()); } catch (e) { /* the light read below */ }
    return Promise.all(p).then(function () { return loadCatalog(); }, function () { return loadCatalog(); });
  }
  function openAssign(preset) {
    if (!canAssign()) { T('Only HR, leaders and admins can assign trainings'); return; }
    var picks = [], ppl = [];
    if (typeof preset === 'string' && /^(t|p):/.test(preset)) picks = [preset];
    else if (preset && typeof preset === 'object') { if (preset.pick) picks = [preset.pick]; if (preset.people) ppl = preset.people.map(lower); }
    AS = { picks: picks, aud: ppl.length ? 'people' : 'everyone', teams: [], people: ppl, include_new: true, due: '', note: '', q: '', pq: '', busy: false, err: '' };
    lift(sheetUp());
    openModal('<h3>Assign a training</h3><p class="w169note">Loading the Avenue Academy…</p>');
    prepare().then(function () { if (AS) paintForm(); });
  }
  function itemsHtml() {
    var q = lower(AS.q).trim(), on = {}; AS.picks.forEach(function (v) { on[v] = 1; });
    function hit(title, sub) { return !q || lower(title + ' ' + sub).indexOf(q) >= 0; }
    function btn(v, ic, cls, title, sub) {
      return '<button type="button" data-w169pick="' + E(v) + '"' + (on[v] ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '><span class="ic' + cls + '">' + (on[v] ? '&#10003;' : ic) + '</span><span class="tx">' + E(title) + '<span>' + E(sub) + '</span></span></button>';
    }
    var paths = (S.paths || []).filter(function (p) { return p.key !== 'tours' && p.active !== false && pathModules(p).length; });
    var h = '', av = paths.filter(function (p) { var mods = pathModules(p); return hit(p.title || p.name, 'Learning Avenue ' + mods.map(function (t) { return t.title; }).join(' ')); });
    if (av.length) h += '<div class="gh">Learning Avenues</div>' + av.map(function (p) {
      var mods = pathModules(p), mins = mods.reduce(function (a, t) { return a + minsOf(t); }, 0);
      return btn('p:' + p.key, 'A', ' av', p.title || p.name, 'Learning Avenue · ' + plural(mods.length, 'module') + (mins ? ' · about ' + mins + ' min' : '') + (p.required ? ' · required for everyone' : ''));
    }).join('');
    var groups = {}, order = [];
    (S.tr || []).filter(assignable).forEach(function (t) { var g = t.path_group || 'In the library'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(t); });
    order.sort(function (a, b) { return (a === 'In the library') - (b === 'In the library') || a.localeCompare(b); });
    order.forEach(function (g) {
      var list = groups[g].filter(function (t) { return hit(t.title, g + ' ' + kindLabel(t)); }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0) || String(a.title).localeCompare(String(b.title)); });
      if (!list.length) return;
      h += '<div class="gh">' + E(g) + '</div>' + list.map(function (t) { return btn('t:' + t.id, E(kindLabel(t).charAt(0)), '', t.title, kindLabel(t) + (minsOf(t) ? ' · ' + minsOf(t) + ' min' : '')); }).join('');
    });
    return h || '<div class="gh">Nothing matches “' + E(AS.q) + '”</div>';
  }
  function pickedHtml() {
    if (!AS.picks.length) return '<span style="color:' + MUTED + '">Nothing picked yet: pick one or more below.</span>';
    return AS.picks.map(function (v) { return '<span class="w169tag">' + E(titleOf(v)) + ' <button type="button" data-w169unpick="' + E(v) + '" aria-label="' + E('Remove ' + titleOf(v)) + '">&times;</button></span>'; }).join('');
  }
  function whoHtml() {
    var ms = members().filter(function (m) { return m.department !== 'board'; });
    if (AS.aud === 'everyone') return '<p class="w169note">The whole team: ' + plural(ms.length, 'person', 'people') + ' with a sign-in. The board is not included.</p>';
    if (AS.aud === 'team') {
      return '<div class="w169chk">' + teams().filter(function (x) { return x.key !== 'board'; }).map(function (x) {
        var on = AS.teams.indexOf(x.key) >= 0;
        return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" data-w169team="' + E(x.key) + '"' + (on ? ' checked' : '') + '> ' + E(x.label) + ' <span style="color:' + MUTED + ';font-weight:500">' + x.n + '</span></label>';
      }).join('') + '</div>';
    }
    return '<input type="search" id="w169apq" placeholder="Search people by name or team" value="' + E(AS.pq) + '" style="margin-top:8px">'
      + '<div class="w169chk w169ppl" id="w169appl">' + peopleHtml() + '</div>';
  }
  /* the people to pick from: the ones picked first, then the search */
  function peopleHtml() {
    var q = lower(AS.pq).trim(), ms = members().filter(function (m) { return m.department !== 'board'; });
    var list = ms.slice().sort(function (a, b) { var sa = AS.people.indexOf(lower(a.email)) >= 0, sb = AS.people.indexOf(lower(b.email)) >= 0; return (sb - sa) || String(a.name).localeCompare(String(b.name)); })
      .filter(function (m) { return AS.people.indexOf(lower(m.email)) >= 0 || !q || lower(m.name + ' ' + teamName(m.department) + ' ' + (m.role || '')).indexOf(q) >= 0; });
    if (!list.length) return '<span class="w169note">Nobody matches “' + E(AS.pq) + '”.</span>';
    return list.map(function (m) {
      var on = AS.people.indexOf(lower(m.email)) >= 0;
      return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" data-w169person="' + E(lower(m.email)) + '"' + (on ? ' checked' : '') + '> ' + E(m.name) + ' <span style="color:' + MUTED + ';font-weight:500">' + E(teamName(m.department)) + '</span></label>';
    }).join('');
  }
  function targetsNow() {
    var ms = targetsOf(AS.aud, AS.teams, AS.people);
    return ms.filter(function (m) { return AS.aud !== 'everyone' || m.department !== 'board'; });
  }
  function summary() {
    if (!AS.picks.length) return 'Pick what to assign.';
    var tg = targetsNow();
    if (!tg.length) return AS.aud === 'team' ? 'Pick at least one team.' : AS.aud === 'people' ? 'Pick at least one person.' : 'Nobody to assign it to.';
    var mods = {}; AS.picks.forEach(function (v) { modulesOf(v).forEach(function (t) { mods[String(t.id)] = t; }); });
    var ids = Object.keys(mods), done = doneSet(), all = 0, some = 0;
    tg.forEach(function (m) {
      var d = ids.filter(function (id) { return done[id + '|' + lower(m.name)] || done[id + '|' + lower(m.email)]; }).length;
      if (ids.length && d >= ids.length) all++; else if (d) some++;
    });
    var what = AS.picks.length === 1 ? titleOf(AS.picks[0]) : plural(AS.picks.length, 'training');
    var s = what + ' (' + plural(ids.length, 'module') + ') to ' + plural(tg.length, 'person', 'people');
    if (AS.due) s += ', due ' + fmtDay(AS.due);
    s += '.';
    if (all) s += ' ' + plural(all, 'person has', 'people have') + ' already done ' + (ids.length === 1 ? 'it' : 'all of it') + ', so ' + (tg.length - all) + ' get' + (tg.length - all === 1 ? 's' : '') + ' it.';
    if (some) s += ' ' + (some === 1 ? 'One person has' : some + ' people have') + ' done part of it: what they finished stays done.';
    if ((AS.aud === 'everyone' || AS.aud === 'team') && AS.include_new) s += ' People who join ' + (AS.aud === 'team' ? 'these teams ' : '') + 'later get it too.';
    return s;
  }
  function paintForm(keep) {
    if (!AS) return;
    var box = document.getElementById('modalBox');
    var act = keep && box && document.activeElement && box.contains(document.activeElement) ? document.activeElement : null;
    var aid = act ? act.id : '', pos0 = act && act.selectionStart != null ? act.selectionStart : null;
    var whatTop = box && box.querySelector('#w169awh') ? box.querySelector('#w169awh').scrollTop : 0;
    var today = todayIso();
    var html = '<h3>Assign a training</h3>'
      + '<p class="m-sub">It shows at the top of their Avenue Academy, under Assigned to you, with your note and the due date. What someone already finished stays done, and nobody is asked twice.</p>'
      + '<div class="w169f">'
      + '<label for="w169aq">What<span class="op">one or more: a Learning Avenue, or modules</span></label>'
      + '<div class="w169picked" id="w169apk">' + pickedHtml() + '</div>'
      + '<input type="search" id="w169aq" placeholder="Search the Avenue Academy" value="' + E(AS.q) + '" style="margin-top:8px">'
      + '<div class="w169what" id="w169awh">' + itemsHtml() + '</div>'
      + '<label>Who it is for</label>'
      + '<div class="w169seg" role="group" aria-label="Who it is for">' + [['everyone', 'Everyone'], ['team', 'Teams'], ['people', 'People']].map(function (x) { return '<button type="button" data-w169aud="' + x[0] + '"' + (AS.aud === x[0] ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + x[1] + '</button>'; }).join('') + '</div>'
      + '<div id="w169awho">' + whoHtml() + '</div>'
      + (AS.aud !== 'people' ? '<label class="w169ck" style="margin-top:10px"><input type="checkbox" id="w169anew"' + (AS.include_new ? ' checked' : '') + '> People who join ' + (AS.aud === 'team' ? 'these teams ' : '') + 'later get it too</label>' : '')
      + '<div class="row2"><div><label for="w169adue">Due<span class="op">optional</span></label><input type="date" id="w169adue" min="' + today + '" value="' + E(AS.due) + '"></div>'
      + '<div><label>&nbsp;</label><div class="w169quick">' + [[7, 'In a week'], [14, 'In two weeks'], [30, 'In 30 days']].map(function (x) { var d = addDays(today, x[0]); return '<button type="button" class="w169pill' + (AS.due === d ? ' gold' : '') + '" data-w169due="' + d + '">' + x[1] + '</button>'; }).join('') + (AS.due ? '<button type="button" class="w169pill" data-w169due="">No due date</button>' : '') + '</div></div></div>'
      + '<label for="w169anote">A note for them<span class="op">optional: why it matters, in a sentence</span></label><textarea id="w169anote" rows="2" maxlength="400" placeholder="For example: We are all using the new CRM from November.">' + E(AS.note) + '</textarea>'
      + '<div class="w169sum" id="w169asum">' + E(summary()) + '</div>'
      + '<p class="w169err" id="w169aerr"' + (AS.err ? '' : ' hidden') + '>' + E(AS.err) + '</p></div>'
      + '<div class="m-actions"><button class="btn" id="w169ago"' + (AS.busy ? ' disabled' : '') + '>' + (AS.busy ? 'Assigning…' : 'Assign') + '</button> <button class="btn ghost" id="w169ax">Cancel</button></div>';
    openModal(html);
    var w = document.getElementById('w169awh'); if (w) w.scrollTop = whatTop;
    if (aid) { var el = document.getElementById(aid); if (el) { el.focus(); if (pos0 != null) try { el.setSelectionRange(pos0, pos0); } catch (e) { /* date inputs */ } } }
  }
  /* small repaints that keep the typing where it is */
  function paintPart(id, html) { var el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; }
  function paintSum() { paintPart('w169asum', E(summary())); paintPart('w169apk', pickedHtml()); }
  function readForm() {
    if (!AS) return;
    var n = document.getElementById('w169anote'), d = document.getElementById('w169adue'), nw = document.getElementById('w169anew');
    if (n) AS.note = n.value; if (d) AS.due = d.value; if (nw) AS.include_new = !!nw.checked;
  }
  function submitAssign() {
    if (!AS || AS.busy) return;
    readForm();
    var err = '';
    if (!AS.picks.length) err = 'Pick what to assign: a Learning Avenue or a module.';
    else if (AS.aud === 'team' && !AS.teams.length) err = 'Pick at least one team.';
    else if (AS.aud === 'people' && !AS.people.length) err = 'Pick at least one person.';
    else if (AS.due && AS.due < todayIso()) err = 'The due date has passed: pick a later one.';
    if (err) { AS.err = err; var e1 = document.getElementById('w169aerr'); if (e1) { e1.hidden = false; e1.textContent = err; } return; }
    AS.busy = true; AS.err = '';
    var b = document.getElementById('w169ago'); if (b) { b.disabled = true; b.textContent = 'Assigning…'; }
    var base = { audience: AS.aud, teams: AS.aud === 'team' ? AS.teams.slice() : [], people: AS.aud === 'people' ? AS.people.slice() : [], include_new: AS.aud === 'people' ? false : !!AS.include_new, due_date: AS.due || null, note: String(AS.note || '').trim() || null };
    var picks = AS.picks.slice(), done = [], people = 0, i = 0;
    function next() {
      if (i >= picks.length) return finish();
      var v = picks[i++], p = Object.assign({}, base, v.indexOf('t:') === 0 ? { training_id: Number(v.slice(2)) } : { path_key: v.slice(2) });
      return q(db.rpc('academy_assign', { p: p })).then(function (r) {
        if (r.error) { throw new Error(String(r.error.message || r.error)); }
        var d = r.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
        done.push(v); people = Math.max(people, Number(d && d.people) || 0);
        return next();
      });
    }
    function finish() {
      var msg = done.length === 1 ? 'Assigned: ' + titleOf(done[0]) + ' to ' + plural(people, 'person', 'people') : 'Assigned ' + plural(done.length, 'training') + ' to ' + plural(people, 'person', 'people');
      closeForm(); T(msg); refreshAll();
    }
    next().catch(function (e) {
      if (!AS) return;
      AS.busy = false;
      AS.picks = AS.picks.filter(function (v) { return done.indexOf(v) < 0; });
      AS.err = (done.length ? 'Assigned ' + done.map(titleOf).join(', ') + '; the rest did not go: ' : 'It did not go: ') + String(e && e.message || e).replace(/^.*?:\s*(?=[A-Z])/, '').slice(0, 180);
      paintForm();
      if (done.length) refreshAll();
    });
  }
  /* after a change: the lists, the Academy, the HR centre's training table */
  function refreshAll() {
    S.listAt = 0; S.mineAt = 0;
    loadList(true).then(function () { paintCards(); });
    loadMine(true);
    try { if (window.w122 && typeof w122.load === 'function') w122.load(true).then(function () { try { w122.paint(); } catch (e) { /* not mounted */ } }); } catch (e) { /* fine */ }
    try { if (typeof wa36Load === 'function') wa36Load(true); } catch (e) { /* fine */ }
  }

  /* ---------- the assignments in the HR centre ---------- */
  function audText(a) {
    if (a.audience === 'everyone') return 'Everyone' + (a.include_new ? ', new people too' : '');
    if (a.audience === 'team') return (a.teams || []).map(teamName).join(', ') + (a.include_new ? ', new people too' : '');
    var n = (a.people || []).length;
    if (n <= 3) { var names = (a.people || []).map(function (em) { var m = members().filter(function (x) { return lower(x.email) === lower(em); })[0]; return m ? first(m.name) : em.split('@')[0]; }); return names.join(', '); }
    return plural(n, 'person', 'people');
  }
  function stateOf(p, a) {
    var total = Number(p.total) || 0, done = Number(p.done) || 0, today = todayIso();
    if (total && done >= total) return { k: 'ok', t: 'Done' };
    var due = p.due || a.due_date;
    if (a.active && due && String(due) < today) return { k: 'late', t: 'Late' + (done ? ': ' + done + ' of ' + total : '') };
    if (done || p.started) return { k: 'go', t: total > 1 ? done + ' of ' + total : 'Started' };
    return { k: 'no', t: 'Not started' };
  }
  function itemHtml(a, compact) {
    var ps = a.people_state || [], n = ps.length, st = ps.map(function (p) { return stateOf(p, a); });
    var ok = st.filter(function (x) { return x.k === 'ok'; }).length, late = st.filter(function (x) { return x.k === 'late'; }).length, go = st.filter(function (x) { return x.k === 'go'; }).length;
    var pct = n ? Math.round(100 * ok / n) : 0, open = !!S.open[a.id], sure = S.sure === a.id;
    var kind = a.path_key ? 'Learning Avenue · ' + plural(Number(a.modules) || 0, 'module') : 'Module';
    var meta = [audText(a), (a.assigned_by ? 'by ' + first(a.assigned_by) : '') + (a.created_at ? ', ' + fmtDay(a.created_at) : ''), a.due_date ? 'due ' + fmtDay(a.due_date) : 'no due date'].filter(Boolean);
    var h = '<div class="w169a' + (a.active ? '' : ' off') + '" data-w169aid="' + E(a.id) + '"><div class="t"><div><b>' + E(a.title || 'A training') + '</b><span class="k">' + E(kind) + '</span></div>'
      + (a.active ? '' : '<span class="w169chip0">Stopped' + (a.ended_at ? ' ' + E(fmtDay(a.ended_at)) : '') + (a.ended_by ? ' by ' + E(first(a.ended_by)) : '') + '</span>') + '</div>'
      + '<div class="m">' + E(meta.join(' · ')) + (late ? ' · <span class="late">' + plural(late, 'person', 'people') + ' late</span>' : '') + '</div>'
      + (a.note && !compact ? '<div class="nt">“' + E(a.note) + '”</div>' : '')
      + '<div class="pb" title="' + ok + ' of ' + n + ' done"><i style="width:' + pct + '%"></i></div>'
      + '<div class="n"><span><b>' + ok + '</b> of ' + plural(n, 'person', 'people') + ' done' + (go ? ' · ' + go + ' on the way' : '') + '</span>'
      + (compact ? '' : '<span class="acts">' + (n ? '<a data-w169who="' + E(a.id) + '" role="button" tabindex="0" aria-expanded="' + open + '">' + (open ? 'Hide who' : 'See who') + '</a>' : '')
        + (a.active ? (sure ? '<span class="sure">Stop it? Nobody who has not started keeps it; what people started stays. <a data-w169stop="' + E(a.id) + '" role="button" tabindex="0" class="stop">Yes, stop it</a> <a data-w169keep="1" role="button" tabindex="0">Keep it</a></span>' : '<a data-w169stopask="' + E(a.id) + '" role="button" tabindex="0" class="stop">Stop</a>') : '') + '</span>')
      + '</div>';
    if (open && !compact) h += '<div class="w169who">' + ps.map(function (p, i) { return '<div><span>' + E(p.name) + ' <span style="color:' + MUTED + ';font-size:11px">' + E(teamName(p.department)) + '</span></span><em class="' + st[i].k + '">' + E(st[i].t) + '</em></div>'; }).join('') + '</div>';
    return h + '</div>';
  }
  function cardHtml(view) {
    var list = S.list, full = view === 'training';
    var act = (list || []).filter(function (a) { return a.active; }), shown = full ? (list || []) : act.slice(0, 3);
    var lead = full
      ? '<p>Every training assigned to everyone, a team or a group of people, with how far people are. Assigned trainings show at the top of each person’s Avenue Academy with the note and the due date, and people who join later get the ones meant for them.</p>'
      : '<p>Give the whole organization, a team or a few people a module or a Learning Avenue, with a due date and a note. It shows at the top of their Avenue Academy, under Assigned to you. Leaders can assign from the Avenue Academy too.</p>';
    var h = '<h3>' + (full ? 'Trainings assigned to the organization' : 'Assign trainings to the organization') + '</h3>'
      + '<div class="w169lead">' + lead + '<span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="w169pill gold" data-w169assign="">Assign a training</button>'
      + (!full && act.length ? '<button type="button" class="w169pill" data-w169tv="training">See every assignment (' + act.length + ')</button>' : '') + '</span></div>';
    if (list === null) h += '<div class="w169empty">Loading the assignments…</div>';
    else if (!shown.length) h += '<div class="w169empty">' + (full && list.length ? 'Nothing is assigned right now.' : 'Nothing is assigned to the organization yet. Assign a training and it shows here with how far people are.') + '</div>';
    else h += '<div class="w169list">' + shown.map(function (a) { return itemHtml(a, !full); }).join('') + '</div>';
    return h;
  }
  /* the two cards: in the Onboarding view after the master onboarding, and first in the Training view */
  function sectionByH3(re) { var body = document.getElementById('w46body'); if (!body) return null; return Array.prototype.filter.call(body.querySelectorAll('.w46sec'), function (s) { var h = s.querySelector(':scope > h3'); return h && re.test(h.textContent || ''); })[0] || null; }
  function placeCard(id, view, anchor, where) {
    var el = document.getElementById(id);
    if (!anchor) { return el; }
    if (!el) { el = document.createElement('div'); el.className = 'w46sec w169card'; el.id = id; }
    var want = where === 'after' ? anchor.nextElementSibling : anchor;
    if (where === 'after' ? el !== want : el.nextElementSibling !== anchor) anchor.insertAdjacentElement(where === 'after' ? 'afterend' : 'beforebegin', el);
    var html = cardHtml(view);
    if (el.getAttribute('data-h') !== html) { el.innerHTML = html; el.setAttribute('data-h', html); }
    return el;
  }
  function paintCards() {
    if (!canAssign()) return;
    var master = sectionByH3(/^Master onboarding/), tr = sectionByH3(/^Trainings across the team$|^Trainings$|^Training$/);
    if (!master && !tr) return;
    if (S.list === null && !S.listP) loadList(false).then(function () { paintCards(); });
    /* wave47 puts its chart in the Training view's first section: that is the Trainings section's, not this card's */
    var cT = document.getElementById('w169cardT');
    if (cT && tr) Array.prototype.forEach.call(cT.querySelectorAll(':scope > .w47chart'), function (ch) { var tiles = tr.querySelector(':scope > .w44tiles'); if (tiles) tiles.insertAdjacentElement('afterend', ch); else tr.appendChild(ch); });
    placeCard('w169cardO', 'onboarding', master, 'after');
    placeCard('w169cardT', 'training', tr, 'before');
  }
  function stopAssign(id) {
    S.sure = null;
    q(db.rpc('academy_assign_end', { p_id: Number(id) })).then(function (r) {
      if (r.error) { T('It did not stop: ' + String(r.error.message || r.error).slice(0, 120)); return; }
      var d = r.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      T('Stopped' + (d && d.removed != null ? ': ' + plural(Number(d.removed) || 0, 'person', 'people') + ' had not started, ' + (Number(d.kept) || 0) + ' keep what they started' : ''));
      refreshAll();
    });
  }
