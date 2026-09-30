  /* ---------- the master onboarding (HR centre): what people see, week by week, and where each step is done ---------- */
  function tmplOf(id) { try { return (WA37.tmpl || []).filter(function (t) { return String(t.id) === String(id); })[0] || null; } catch (e) { return null; } }
  var AVENUE_WORDS = { team: 'their team’s Learning Avenue', any: 'a Learning Avenue they choose' };
  function linkWords(t) {
    if (!t) return '';
    if (t.training_id) { var tr = trById(t.training_id); return tr ? tr.title : 'an Academy module'; }
    if (t.academy_path) { if (AVENUE_WORDS[t.academy_path]) return AVENUE_WORDS[t.academy_path]; var p = pathByKey(t.academy_path); return p ? p.title : t.academy_path; }
    return '';
  }
  function seeHtml(section) {
    var w = weekCfg(section) || {}, lesson = w.lesson ? tmplOf(w.lesson) : null;
    var ph = w.photo ? '<div class="ph" style="background-image:url(\'' + E(photoUrl(w.photo)) + '\');background-position:' + pos(w.fx, w.fy) + '"></div>' : '<div class="ph none">No photo yet</div>';
    return '<div class="w169see" data-w169sec="' + E(section) + '">' + ph + '<div class="tx"><span class="k">What people see in the Academy: ' + E(lab(section)) + '</span><b>' + E(w.title || lab(section)) + '</b>'
      + (w.learn && w.learn.length ? '<ul>' + w.learn.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>' : '<div class="why">No goals yet: people see the steps only.</div>')
      + (w.why ? '<div class="why">Why it matters: ' + E(w.why) + '</div>' : '')
      + (lesson ? '<div class="why">Opens with: ' + E(lesson.name) + '</div>' : '') + '</div>'
      + '<div class="ac"><button type="button" class="w169pill" data-w169week="' + E(section) + '">Edit what people see</button></div></div>';
  }
  function decorateMaster() {
    var host = document.getElementById('w46master'); if (!host) return;
    var bar = host.parentElement && host.parentElement.querySelector('.w169bar');
    if (!bar && host.parentElement) {
      host.insertAdjacentHTML('beforebegin', '<div class="w169bar"><button type="button" class="w169pill gold" data-w169preview="' + SAMPLE_ID + '">Preview what a new person sees</button>'
        + '<span style="font-size:12px;color:' + MUTED + '">The master is the onboarding: what you change here is what people see in the Avenue Academy, at once.</span></div>');
    }
    Array.prototype.forEach.call(host.querySelectorAll('details.w46wk'), function (d) {
      var sm = d.querySelector('summary'); if (!sm) return;
      var section = String((sm.childNodes[0] && sm.childNodes[0].nodeType === 3 ? sm.childNodes[0].textContent : '') || '').trim(); if (!section) return;
      var w = weekCfg(section) || {}, html = seeHtml(section);
      var tt = sm.querySelector('.w169tt'), ttHtml = '<i style="' + (w.photo ? 'background-image:url(\'' + E(photoUrl(w.photo)) + '\')' : '') + '"></i>' + E(w.title || lab(section));
      if (!tt) { sm.childNodes[0].after(document.createRange().createContextualFragment('<span class="w169tt" title="What people see in the Academy">' + ttHtml + '</span>')); }
      else if (tt.getAttribute('data-h') !== ttHtml) { tt.innerHTML = ttHtml; }
      if (tt) tt.setAttribute('data-h', ttHtml); else { var nt = sm.querySelector('.w169tt'); if (nt) nt.setAttribute('data-h', ttHtml); }
      var see = d.querySelector(':scope > .w169see');
      if (!see) sm.insertAdjacentHTML('afterend', html);
      else if (see.getAttribute('data-h') !== html) { see.outerHTML = html; }
      var see2 = d.querySelector(':scope > .w169see'); if (see2) see2.setAttribute('data-h', html);
      /* the steps: done in the Academy, and the lesson that opens the week */
      Array.prototype.forEach.call(d.querySelectorAll('.w46st'), function (row) {
        var ed = row.querySelector('[data-w37e]'); if (!ed) return;
        var t = tmplOf(ed.getAttribute('data-w37e')), nm = row.querySelector('.nm'); if (!t || !nm) return;
        var chip = (t.training_id || t.academy_path ? '<span class="w169chip" title="Ticks itself when they finish it in the Avenue Academy">Academy: ' + E(linkWords(t)) + '</span>' : '')
          + (w.lesson && String(w.lesson) === String(t.id) ? '<span class="w169chip op">Opens the week</span>' : '');
        var cur = nm.querySelector('.w169chips');
        if (!cur) { if (chip) nm.insertAdjacentHTML('beforeend', '<span class="w169chips">' + chip + '</span>'); }
        else if (cur.innerHTML !== chip) cur.innerHTML = chip;
      });
    });
  }

  /* the board: each person's journey as they see it */
  function decorateBoard() {
    var body = document.getElementById('w46body'); if (!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('[data-w46kit]'), function (kit) {
      var row = kit.parentElement; if (!row || row.querySelector('[data-w169preview]')) return;
      var name = kit.getAttribute('data-w46kit'), o = null;
      try { o = (WA37.onbs || []).filter(function (x) { return x.status === 'active' && lower(x.person_name) === lower(name); })[0] || null; } catch (e) { o = null; }
      if (o) kit.insertAdjacentHTML('beforebegin', '<a data-w169preview="' + E(o.id) + '" title="Their onboarding as they see it in the Avenue Academy (read only)">Journey</a> ');
    });
  }

  /* ---------- the week editor: what people see ---------- */
  var WK = null;
  function openWeek(section) {
    if (!canAssign()) { T('Only HR, leaders and admins can change the onboarding'); return; }
    lift(false);
    var w = weekCfg(section) || {};
    WK = { section: section, title: w.title || '', photo: w.photo || '', fx: w.fx, fy: w.fy, photoId: null, learn: (w.learn || []).slice(0, 3), why: w.why || '', lesson: w.lesson || '' };
    while (WK.learn.length < 3) WK.learn.push('');
    paintWeek();
    loadPhotos().then(function (rows) {
      if (!WK) return;
      var hit = rows.filter(function (p) { return p.path_web === WK.photo; })[0]; if (hit) WK.photoId = hit.id;
      paintWeek(true);
    });
  }
  function weekPrev() {
    var bg = WK.photo ? ' style="background-image:url(\'' + E(photoUrl(WK.photo)) + '\');background-position:' + pos(WK.fx, WK.fy) + '"' : '';
    var goals = WK.learn.filter(function (x) { return String(x).trim(); });
    return '<div class="w169prev"><div class="bn"' + bg + '><span class="k">' + E(lab(WK.section)) + '</span><h4>' + E(WK.title || lab(WK.section)) + '</h4></div>'
      + '<div class="bd"><div><h5>By the end of this week you will</h5>' + (goals.length ? '<ul>' + goals.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>' : '<span style="color:' + MUTED + '">No goals yet.</span>') + '</div>'
      + '<div><h5>Why it matters</h5>' + (WK.why ? E(WK.why) : '<span style="color:' + MUTED + '">Not said yet.</span>') + '</div></div></div>';
  }
  function paintWeek(keepFocus) {
    if (!WK) return;
    var steps = [];
    try { steps = (WA37.tmpl || []).filter(function (t) { return t.active !== false && t.section === WK.section && t.training_id; }); } catch (e) { steps = []; }
    var photos = S.photos;
    var html = '<h3>What people see: ' + E(lab(WK.section)) + '</h3>'
      + '<p class="m-sub">This is the week as people see it in the Avenue Academy: its stop on the avenue and the top of the week. The steps come from the master below it.</p>'
      + '<div class="w169f"><label for="w169wt">Title<span class="op">a few words, like Get set up</span></label><input type="text" id="w169wt" maxlength="40" value="' + E(WK.title) + '">'
      + '<label>Photo<span class="op">from the Photo library, the photos ready to use</span></label>'
      + (photos ? '<div class="w169pics">' + photos.map(function (p) { return '<button type="button" class="w169pic' + (String(p.id) === String(WK.photoId) || (!WK.photoId && p.path_web === WK.photo) ? ' on' : '') + '" data-w169pic="' + E(p.id) + '" title="' + E(p.title || '') + '" aria-label="' + E('Use ' + (p.title || 'this photo')) + '" style="background-image:url(\'' + E(PSTORE + (p.path_thumb || p.path_web)) + '\')"></button>'; }).join('') + '</div>' : '<p class="w169note">Loading the Photo library…</p>')
      + '<label>By the end of this week they will<span class="op">up to three</span></label>'
      + WK.learn.map(function (x, i) { return '<input type="text" data-w169learn="' + i + '" maxlength="140" value="' + E(x) + '" placeholder="' + ['Set up their accounts', 'Find their way around the Hub', 'Meet their team'][i] + '" style="margin-top:' + (i ? 6 : 0) + 'px">'; }).join('')
      + '<label for="w169wy">Why it matters<span class="op">one or two sentences</span></label><textarea id="w169wy" rows="3" maxlength="320">' + E(WK.why) + '</textarea>'
      + '<label for="w169wl">The lesson that opens the week<span class="op">an Academy step of this week, shown as Start here</span></label><select id="w169wl"><option value="">None</option>'
      + steps.map(function (t) { return '<option value="' + E(t.id) + '"' + (String(t.id) === String(WK.lesson) ? ' selected' : '') + '>' + E(t.name) + '</option>'; }).join('') + '</select>'
      + '<div id="w169wprev">' + weekPrev() + '</div><p class="w169err" id="w169werr" hidden></p></div>'
      + '<div class="m-actions"><button class="btn" id="w169wsave">Save</button> <button class="btn ghost" id="w169wx">Cancel</button></div>';
    var box = document.getElementById('modalBox');
    var active = keepFocus && document.activeElement && box && box.contains(document.activeElement) ? document.activeElement : null;
    var aid = active ? (active.id || (active.getAttribute('data-w169learn') != null ? 'l' + active.getAttribute('data-w169learn') : '')) : '';
    openModal(html);
    if (aid) { var el = aid.charAt(0) === 'l' && aid.length < 3 ? document.querySelector('#modalBox [data-w169learn="' + aid.slice(1) + '"]') : document.getElementById(aid); if (el) el.focus(); }
  }
  function readWeek() {
    if (!WK) return;
    var t = document.getElementById('w169wt'), y = document.getElementById('w169wy'), l = document.getElementById('w169wl');
    if (t) WK.title = t.value; if (y) WK.why = y.value; if (l) WK.lesson = l.value;
    Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-w169learn]'), function (el) { WK.learn[Number(el.getAttribute('data-w169learn'))] = el.value; });
  }
  function saveWeek() {
    readWeek();
    var err = document.getElementById('w169werr');
    if (!String(WK.title || '').trim()) { if (err) { err.hidden = false; err.textContent = 'Give the week a title.'; } return; }
    var btn = document.getElementById('w169wsave'); if (btn) btn.disabled = true;
    var body = { title: WK.title.trim(), learn: WK.learn.map(function (x) { return String(x || '').trim(); }).filter(Boolean), why: String(WK.why || '').trim(), lesson: WK.lesson || null };
    if (WK.photoId) body.photo_id = WK.photoId;
    q(db.rpc('onboarding_journey_save', { p_section: WK.section, p_week: body })).then(function (r) {
      if (r.error) { if (btn) btn.disabled = false; if (err) { err.hidden = false; err.textContent = 'It did not save: ' + String(r.error.message || r.error).slice(0, 160); } return; }
      var saved = r.data && typeof r.data === 'object' ? r.data : null;
      S.cfg = S.cfg || { v: 1, weeks: {} }; S.cfg.weeks = S.cfg.weeks || {};
      S.cfg.weeks[WK.section] = Object.assign({}, S.cfg.weeks[WK.section] || {}, saved || body, saved ? {} : { photo: WK.photo, fx: WK.fx, fy: WK.fy });
      S.cfgAt = Date.now();
      try { if (window.w167 && typeof w167.reloadCfg === 'function') w167.reloadCfg(S.cfg); } catch (e) { /* the journey reads it next time */ }
      var sec = WK.section; WK = null;
      try { closeModal(); } catch (e) { /* fine */ }
      T('Saved: people see it in the Academy now');
      decorateMaster();
      var d = Array.prototype.filter.call(document.querySelectorAll('#w46master details.w46wk'), function (x) { var s0 = x.querySelector('summary'); return s0 && String(s0.childNodes[0] && s0.childNodes[0].textContent || '').trim() === sec; })[0];
      if (d) d.open = true;
    });
  }

  /* ---------- a step's editor: where it is done (the Avenue Academy) ---------- */
  function academySelect(t) {
    var cur = t ? (t.training_id ? 't:' + t.training_id : (t.academy_path ? 'p:' + t.academy_path : '')) : '';
    var paths = (S.paths || []).filter(function (p) { return ['tours', 'firstweek'].indexOf(p.key) < 0; });
    var mods = (S.tr || []).filter(function (x) { return assignable(x) && String(x.kind || '') !== 'tour'; }).slice().sort(function (a, b) { return String(a.path_group || '~').localeCompare(String(b.path_group || '~')) || String(a.title).localeCompare(String(b.title)); });
    var groups = {}; mods.forEach(function (x) { var g = x.path_group || 'In the library'; (groups[g] = groups[g] || []).push(x); });
    return '<label for="w169ac" style="margin-top:10px">Done in the Avenue Academy<span class="op">the step ticks itself when they finish it there</span></label><select id="w169ac" class="w36sel" style="width:100%">'
      + '<option value="">Not an Academy step (they tick it)</option>'
      + '<optgroup label="A Learning Avenue">' + paths.map(function (p) { return '<option value="p:' + E(p.key) + '"' + (cur === 'p:' + p.key ? ' selected' : '') + '>' + E(p.title) + '</option>'; }).join('')
      + '<option value="p:team"' + (cur === 'p:team' ? ' selected' : '') + '>Their team’s Learning Avenue</option><option value="p:any"' + (cur === 'p:any' ? ' selected' : '') + '>A Learning Avenue they choose</option></optgroup>'
      + Object.keys(groups).map(function (g) { return '<optgroup label="' + E(g) + '">' + groups[g].map(function (x) { return '<option value="t:' + E(x.id) + '"' + (cur === 't:' + x.id ? ' selected' : '') + '>' + E(x.title) + '</option>'; }).join('') + '</optgroup>'; }).join('')
      + '</select>';
  }
  function academyValue() {
    var v = (document.getElementById('w169ac') || {}).value || '';
    return { training_id: v.indexOf('t:') === 0 ? Number(v.slice(2)) : null, academy_path: v.indexOf('p:') === 0 ? v.slice(2) : null };
  }
  function secSelect(id, current) {
    var secs = [];
    try { (WA37.tmpl || []).forEach(function (t) { if (t.active !== false && secs.indexOf(t.section) < 0) secs.push(t.section); }); } catch (e) { /* none */ }
    if (current && secs.indexOf(current) < 0) secs.push(current);
    secs.sort(function (a, b) { return daysOf(a) - daysOf(b) || a.localeCompare(b); });
    return '<select id="' + id + '" class="w36sel">' + secs.map(function (s) { return '<option value="' + E(s) + '"' + (s === current ? ' selected' : '') + '>' + E(s) + '</option>'; }).join('') + '</select>';
  }
  function editStep(tid) {
    var t = tmplOf(tid); if (!t) return;
    loadCatalog().then(function () {
      openModal('<h3>Edit this onboarding step</h3>'
        + '<p class="m-sub">Changes reach everyone at once, onboardings in progress included, and what they see in the Avenue Academy.</p>'
        + '<div class="w169f"><label for="w44en">Step name</label><input type="text" id="w44en" value="' + E(t.name) + '" />'
        + '<label for="w44ed">Instructions<span class="op">links welcome, markdown works</span></label><textarea id="w44ed" rows="6">' + E(t.description || '') + '</textarea>'
        + '<label for="w44el">Add a link<span class="op">appended to the instructions</span></label><input type="text" id="w44el" placeholder="https://..." />'
        + academySelect(t)
        + '<div class="row2" style="margin-top:4px"><div><label for="w44ew">Week</label>' + secSelect('w44ew', t.section) + '</div>'
        + '<div><label for="w44ep">Priority</label><select id="w44ep" class="w36sel"><option value="">Normal</option><option value="high"' + (t.priority === 'high' ? ' selected' : '') + '>Important</option></select></div></div>'
        + '<label for="w44eo">Position<span class="op">smaller numbers first within the week; subtasks keep their parent</span></label><input type="text" id="w44eo" inputmode="numeric" value="' + (t.sort || 0) + '" style="max-width:120px" />'
        + '<p class="w169err" id="w169serr" hidden></p></div>'
        + '<div class="m-actions"><button class="btn" id="w44es">Save</button> <button class="btn ghost" id="w44ec">Cancel</button></div>');
      document.getElementById('w44ec').addEventListener('click', function () { try { wa37Master(); } catch (e) { closeModal(); } });
      document.getElementById('w44es').addEventListener('click', async function () {
        var nm = (document.getElementById('w44en').value || '').trim(), err = document.getElementById('w169serr');
        if (!nm) { err.hidden = false; err.textContent = 'The step needs a name.'; return; }
        var desc = (document.getElementById('w44ed').value || '').trim(), link = (document.getElementById('w44el').value || '').trim();
        if (link) { if (link.indexOf('http') !== 0) link = 'https://' + link; if (desc.indexOf(link) < 0) desc = (desc ? desc + '\n\n' : '') + '[Open the link](' + link + ')'; }
        var srt = parseInt(document.getElementById('w44eo').value, 10), ac = academyValue();
        this.disabled = true;
        var r = await db.from('onboarding_template').update({
          name: nm, description: desc || null, section: document.getElementById('w44ew').value, sort: isNaN(srt) ? (t.sort || 0) : srt,
          priority: document.getElementById('w44ep').value || null, content_pending: false, training_id: ac.training_id, academy_path: ac.academy_path,
          updated_at: new Date().toISOString()
        }).eq('id', tid);
        if (r && r.error) { this.disabled = false; err.hidden = false; err.textContent = 'It did not save: ' + String(r.error.message || r.error).slice(0, 160); return; }
        try { await wa37Load(true); } catch (e) { /* the next load */ }
        T('Saved to the master, every onboarding in progress and the Academy');
        try { wa37Master(); } catch (e) { closeModal(); }
      });
    });
  }
  function addStep(section) {
    var parents = [];
    try { parents = (WA37.tmpl || []).filter(function (t) { return t.section === section && !t.parent_id && t.active !== false; }); } catch (e) { parents = []; }
    loadCatalog().then(function () {
      openModal('<h3>Add a step to ' + E(section) + '</h3>'
        + '<p class="m-sub">Everyone still onboarding gets it at once, unticked (ticked already when it is an Academy module they finished).</p>'
        + '<div class="w169f"><label for="w44an">Step name</label><input type="text" id="w44an" placeholder="What they need to do" />'
        + '<label for="w44ad">Instructions<span class="op">optional, markdown works</span></label><textarea id="w44ad" rows="5"></textarea>'
        + '<label for="w44al">Add a link<span class="op">appended to the instructions</span></label><input type="text" id="w44al" placeholder="https://..." />'
        + academySelect(null)
        + '<div class="row2" style="margin-top:4px"><div><label for="w44aw">Week</label>' + secSelect('w44aw', section) + '</div>'
        + '<div><label for="w44app">Priority</label><select id="w44app" class="w36sel"><option value="">Normal</option><option value="high">Important</option></select></div></div>'
        + '<label for="w44ap">Sits under</label><select id="w44ap" class="w36sel" style="width:100%"><option value="">Top level</option>'
        + parents.map(function (p) { return '<option value="' + E(p.id) + '">' + E(p.name) + '</option>'; }).join('') + '</select>'
        + '<p class="w169err" id="w169serr" hidden></p></div>'
        + '<div class="m-actions"><button class="btn" id="w44as2">Add it</button> <button class="btn ghost" id="w44ac">Cancel</button></div>');
      document.getElementById('w44ac').addEventListener('click', function () { try { wa37Master(); } catch (e) { closeModal(); } });
      document.getElementById('w44as2').addEventListener('click', async function () {
        var nm = (document.getElementById('w44an').value || '').trim(), err = document.getElementById('w169serr');
        if (!nm) { err.hidden = false; err.textContent = 'Give the step a name.'; return; }
        var sec = document.getElementById('w44aw').value, desc = (document.getElementById('w44ad').value || '').trim(), link = (document.getElementById('w44al').value || '').trim();
        if (link) { if (link.indexOf('http') !== 0) link = 'https://' + link; desc = (desc ? desc + '\n\n' : '') + '[Open the link](' + link + ')'; }
        var parent = document.getElementById('w44ap').value || null, maxSort = 0, ac = academyValue();
        try { (WA37.tmpl || []).forEach(function (t) { if (t.section === sec && t.sort > maxSort) maxSort = t.sort; }); } catch (e) { /* none */ }
        this.disabled = true;
        var r = await db.from('onboarding_template').insert({
          id: 'wa' + Math.random().toString(36).slice(2, 10), section: sec, name: nm, description: desc || null, parent_id: parent,
          priority: document.getElementById('w44app').value || null, sort: maxSort + 10, active: true, content_pending: false,
          training_id: ac.training_id, academy_path: ac.academy_path
        });
        if (r && r.error) { this.disabled = false; err.hidden = false; err.textContent = 'It was not added: ' + String(r.error.message || r.error).slice(0, 160); return; }
        try { await wa37Load(true); } catch (e) { /* the next load */ }
        T('Added to the master, every onboarding in progress and the Academy');
        try { wa37Master(); } catch (e) { closeModal(); }
      });
    });
  }
  /* the master's step editor and add form are these from now on (wave44's, with where the step is done) */
  if (typeof wa37EditStep === 'function') wa37EditStep = editStep;
  if (typeof wa37AddStep === 'function') wa37AddStep = addStep;

