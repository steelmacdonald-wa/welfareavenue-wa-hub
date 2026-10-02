
  /* ---------- paint and route ---------- */
  var VIEWS = { pipeline: pipelineHtml, found: foundHtml, funders: fundersHtml, write: writerHtml, playbook: playbookHtml, facts: factsHtml };
  function paint() {
    var h = host(); if (!h) return;
    var active = document.activeElement, keep = null;
    if (active && h.contains(active) && active.matches && active.matches('[data-w193q]')) keep = { sel: '[data-w193q]', pos: active.selectionStart };
    var html;
    if (!staffOk()) html = '<div class="w193card"><p class="w193empty">The Fundraising app is for the staff: the Fundraising team, the executives and the admins.</p></div>';
    else if (F.err && !F.grants.length && !F.funders.length) html = '<div class="w193card"><p class="w193empty">The Fundraising app is not open to you' + (F.err ? ' (' + E(clip(F.err, 120)) + ')' : '') + '. Ask an admin to add it to your access profile.</p></div>';
    else if (F.sec === 'calendar') html = calendarHtml();
    else if (F.sec === 'donors') html = donorsHtml();
    else if (F.sec === 'sops') { var t = F.sub ? byId(F.sops, F.sub) : null; html = t ? sopReaderHtml(t) : sopsHtml(); }
    else if (F.sec === 'grants') html = (VIEWS[F.view] || pipelineHtml)();
    else html = overviewHtml();
    h.innerHTML = html;
    if (keep) { try { var el = h.querySelector(keep.sel); if (el) { el.focus(); if (keep.pos != null) el.setSelectionRange(keep.pos, keep.pos); } } catch (e) { /* fine */ } }
  }
  function route(h) {
    var p = String(h || '').replace(/^#/, '').split('/');
    var sec = p[1] || 'overview', sub = p[2] || '', sub2 = p.slice(3).join('/');
    F.sub = '';
    if (sec === 'grants') {
      F.sec = 'grants';
      if (!sub) F.view = 'pipeline';
      else if (/^\d+$/.test(sub)) { F.view = 'pipeline'; F.sub = sub; }
      else if (GVIEWS.indexOf(sub) >= 0) { F.view = sub; F.sub = sub2; }
      else F.view = 'pipeline';
    } else if (SECTIONS.indexOf(sec) >= 0) { F.sec = sec; F.sub = sub; }
    else F.sec = 'overview';
    if (F.sec === 'calendar' && /^\d{4}-\d{2}$/.test(sub)) { F.calAnchor = mk(Number(sub.slice(0, 4)), Number(sub.slice(5)) - 1, 1); F.sub = ''; }
    if (F.sec !== 'grants' || F.view !== 'pipeline') F.filters.q = F.filters.q && F.lastView === F.sec + '/' + F.view ? F.filters.q : '';
    F.lastView = F.sec + '/' + F.view;
  }
  async function show(h) {
    route(h);
    var hh = host(); if (!hh) return;
    if (!F.loaded) hh.innerHTML = '<div class="w193card"><p class="w193empty">Loading the Fundraising app…</p></div>';
    await loadAll();
    if (F.sec === 'grants' && F.view === 'write') {
      var m = /^new(?:\?grant=(\d+))?$/.exec(F.sub || '');
      if (m) { openDraft(null); F.writer.text = ''; F.writer.notes = ''; if (m[1]) F.writer.grantId = m[1]; try { history.replaceState(null, '', '#fund/grants/write'); } catch (e) { /* fine */ } F.sub = ''; }
      else if (/^\d+$/.test(F.sub || '')) { if (!F.draft || String(F.draft.id) !== String(F.sub)) openDraft(F.sub); }
    }
    paint();
    if (F.sec === 'grants' && F.view === 'pipeline' && F.sub) openGrant(F.sub);
    else if (F.sec === 'grants' && F.view === 'funders' && /^\d+$/.test(F.sub || '')) openFunder(F.sub);
    else if (F.open) closeSheet();
    var run = F.runs[0]; if (run && run.status === 'running') watchRun();
  }

  /* ---------- events ---------- */
  var qT = null;
  function inApp(t) { return !!(t && t.closest && (t.closest('#w193host') || t.closest('#w193sheet') || t.closest('#w193scrim'))); }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!inApp(t)) return;
    var el;
    if ((el = t.closest('[data-w193close]'))) { closeSheet(); return; }
    if ((el = t.closest('[data-w193cancel]'))) { e.preventDefault(); var s = F.sheet; closeSheet(); if (s && s.kind === 'gform' && s.id) openGrant(s.id); else if (s && s.kind === 'fform' && s.id) openFunder(s.id); else if (s && s.kind === 'docform' && s.id) openGrant(s.id); return; }
    if ((el = t.closest('[data-w193go]'))) {
      e.preventDefault();
      var grp = el.getAttribute('data-w193grp'); if (grp) { F.filters.group = grp; lsSet('w193group', grp); }
      var h = el.getAttribute('data-w193go');
      if (/^#fund\/grants\/\d+$/.test(h) && F.sec === 'grants' && F.view === 'pipeline') { openGrant(h.split('/')[2]); try { history.replaceState(null, '', h); } catch (x) { /* fine */ } return; }
      go(h); return;
    }
    if ((el = t.closest('[data-w193anchor]'))) { var a = document.getElementById(el.getAttribute('data-w193anchor')); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if ((el = t.closest('.w193seg [data-w193grp]'))) { F.filters.group = el.getAttribute('data-w193grp'); lsSet('w193group', F.filters.group); paint(); return; }
    if ((el = t.closest('[data-w193watch]'))) { F.filters.watch = el.getAttribute('data-w193watch'); paint(); return; }
    if ((el = t.closest('[data-w193fstatus]'))) { F.filters.fstatus = el.getAttribute('data-w193fstatus'); paint(); return; }
    if ((el = t.closest('[data-w193nav]'))) { var n = Number(el.getAttribute('data-w193nav')); F.calAnchor = n === 0 ? monthStart(today()) : addMonths(calAnchor(), n); paint(); return; }
    if ((el = t.closest('[data-w193layer]'))) { var k = el.getAttribute('data-w193layer'); F.calLayers[k] = !F.calLayers[k]; lsSet('w193layers', JSON.stringify(F.calLayers)); paint(); return; }
    if ((el = t.closest('[data-w193scan]'))) { if (!el.hasAttribute('disabled')) scanNow(); return; }
    if ((el = t.closest('[data-w193foundall]'))) { F.foundAll = !F.foundAll; paint(); return; }
    if ((el = t.closest('[data-w193keep]'))) { el.setAttribute('disabled', '1'); decideFind(el.getAttribute('data-w193keep'), 'keep', null); return; }
    if ((el = t.closest('[data-w193dismiss],[data-w193screen]'))) { var id = el.getAttribute('data-w193dismiss') || el.getAttribute('data-w193screen'); var df = document.querySelector('[data-w193dform="' + id + '"]'); if (df) { df.style.display = ''; df.setAttribute('data-mode', el.hasAttribute('data-w193screen') ? 'screen_out' : 'dismiss'); var ta = df.querySelector('textarea'); if (ta) { ta.placeholder = el.hasAttribute('data-w193screen') ? 'Why this funder is not for us (kept on the funder)' : 'Why (optional, kept with the decision)'; ta.focus(); } } return; }
    if ((el = t.closest('[data-w193dcancel]'))) { var df2 = document.querySelector('[data-w193dform="' + el.getAttribute('data-w193dcancel') + '"]'); if (df2) df2.style.display = 'none'; return; }
    if ((el = t.closest('[data-w193dgo]'))) { var id2 = el.getAttribute('data-w193dgo'), df3 = document.querySelector('[data-w193dform="' + id2 + '"]'); var note = df3 ? (df3.querySelector('textarea') || {}).value : ''; el.setAttribute('disabled', '1'); decideFind(id2, df3 && df3.getAttribute('data-mode') === 'screen_out' ? 'screen_out' : 'dismiss', note); return; }
    if ((el = t.closest('[data-w193gadd]'))) { var fid = el.getAttribute('data-w193gadd'); openGrantForm(null, /^\d+$/.test(fid) ? Number(fid) : null); return; }
    if ((el = t.closest('[data-w193gedit]'))) { openGrantForm(byId(F.grants, el.getAttribute('data-w193gedit'))); return; }
    if ((el = t.closest('[data-w193gdel]'))) { deleteGrant(el.getAttribute('data-w193gdel')); return; }
    if ((el = t.closest('[data-w193fit]'))) { if (!el.hasAttribute('disabled')) scoreFit(el.getAttribute('data-w193fit')); return; }
    if ((el = t.closest('[data-w193fadd]'))) { openFunderForm(null); return; }
    if ((el = t.closest('[data-w193fedit]'))) { openFunderForm(byId(F.funders, el.getAttribute('data-w193fedit'))); return; }
    if ((el = t.closest('[data-w193fdel]'))) { deleteFunder(el.getAttribute('data-w193fdel')); return; }
    if ((el = t.closest('[data-w193fwatch]'))) { toggleWatch(el.getAttribute('data-w193fwatch')); return; }
    if ((el = t.closest('[data-w193fscreen]'))) { toggleScreen(el.getAttribute('data-w193fscreen')); return; }
    if ((el = t.closest('[data-w193docadd]'))) { openDocForm(el.getAttribute('data-w193docadd')); return; }
    if ((el = t.closest('[data-w193doccopy]'))) { var dt = document.querySelector('#w193sheet [data-w193doctext]'); if (dt) { fallbackCopy(dt.textContent); try { if (navigator.clipboard) navigator.clipboard.writeText(dt.textContent); } catch (x) { /* fine */ } toastS('Copied.'); } return; }
    if ((el = t.closest('[data-w193docdel]'))) { deleteDocument(el.getAttribute('data-w193docdel')); return; }
    if ((el = t.closest('[data-w193doc]'))) { openDocument(el.getAttribute('data-w193doc'), F.sheet && F.sheet.kind === 'grant' ? F.sheet.id : null); return; }
    if ((el = t.closest('[data-w193grant]'))) { var gid = el.getAttribute('data-w193grant'); openGrant(gid); if (F.sec === 'grants' && F.view === 'pipeline') { try { history.replaceState(null, '', '#fund/grants/' + gid); } catch (x) { /* fine */ } F.sub = gid; } return; }
    if ((el = t.closest('[data-w193funder]'))) { var fid2 = el.getAttribute('data-w193funder'); openFunder(fid2); if (F.sec === 'grants' && F.view === 'funders') { try { history.replaceState(null, '', '#fund/grants/funders/' + fid2); } catch (x) { /* fine */ } F.sub = fid2; } return; }
    if ((el = t.closest('[data-w193factadd]'))) { openFactForm(null); return; }
    if ((el = t.closest('[data-w193factedit]'))) { openFactForm(byId(F.facts, el.getAttribute('data-w193factedit'))); return; }
    if ((el = t.closest('[data-w193factok]'))) { verifyFact(el.getAttribute('data-w193factok')); return; }
    if ((el = t.closest('[data-w193dgoals]'))) { openDonorGoals(); return; }
    if ((el = t.closest('[data-w193dtick]'))) { donorTick(el.getAttribute('data-w193dtick')); return; }
    if ((el = t.closest('[data-w193wdraft]'))) { if (!el.hasAttribute('disabled')) draftNow(); return; }
    if ((el = t.closest('[data-w193wsave]'))) { if (!el.hasAttribute('disabled')) saveDraft(false); return; }
    if ((el = t.closest('[data-w193wreview]'))) { if (!el.hasAttribute('disabled')) reviewNow(); return; }
    if ((el = t.closest('[data-w193wreviewx]'))) { F.writer.review = null; paint(); return; }
    if ((el = t.closest('[data-w193wcopy]'))) { copyAnswers(); return; }
    if ((el = t.closest('[data-w193wdoc]'))) { saveAsDocument(); return; }
    if ((el = t.closest('[data-w193wfinal]'))) { setDraftStatus('final'); return; }
    if ((el = t.closest('[data-w193wreopen]'))) { setDraftStatus('draft'); return; }
    if ((el = t.closest('[data-w193wdel]'))) { deleteDraft(); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!inApp(t) || !t.matches) return;
    if (t.matches('[data-w193q]')) { F.filters.q = t.value; clearTimeout(qT); qT = setTimeout(paint, 180); return; }
    if (t.matches('[data-w193answer]')) {
      var i = Number(t.getAttribute('data-w193answer')), d = F.draft; if (!d || !d.questions || !d.questions[i]) return;
      d.questions[i].answer = t.value; d.questions[i].words = words(t.value);
      var c = document.querySelector('#w193host [data-w193count="' + i + '"]'); if (c) { var lim = d.questions[i].limit; c.textContent = d.questions[i].words + (lim ? ' of ' + lim : '') + ' words'; c.classList.toggle('over', !!(lim && d.questions[i].words > lim)); }
      return;
    }
    if (t.matches('[data-w193wq],[data-w193wnotes],[data-w193wtitle]')) readWriterForm();
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!inApp(t) || !t.matches) return;
    if (t.matches('[data-w193region]')) { F.filters.region = t.value; paint(); return; }
    if (t.matches('[data-w193owner]')) { F.filters.owner = t.value; paint(); return; }
    if (t.matches('[data-w193fkind]')) { F.filters.fkind = t.value; paint(); return; }
    if (t.matches('[data-w193fit]')) { F.filters.fit = t.value; paint(); return; }
    if (t.matches('[data-w193fcat]')) { F.filters.fcat = t.value; paint(); return; }
    if (t.matches('[data-w193stage]')) { setStage(t.getAttribute('data-w193stage'), t.value); return; }
    if (t.matches('[data-w193wgrant],[data-w193wlang]')) { readWriterForm(); if (t.matches('[data-w193wgrant]')) { var ti = document.querySelector('#w193host [data-w193wtitle]'); var g = F.writer.grantId ? byId(F.grants, F.writer.grantId) : null; if (ti) ti.placeholder = g ? grantTitle(g) : 'Draft'; } }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.closest || !inApp(f)) return;
    e.preventDefault();
    if (f.hasAttribute('data-w193gform')) saveGrant(f);
    else if (f.hasAttribute('data-w193fform')) saveFunder(f);
    else if (f.hasAttribute('data-w193factform')) saveFact(f);
    else if (f.hasAttribute('data-w193docform')) saveDoc(f);
    else if (f.hasAttribute('data-w193logform')) addLog(f);
    else if (f.hasAttribute('data-w193dgform')) saveDonorGoals(f);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && F.open) { e.preventDefault(); closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#w193host [role=button], #w193host [role=checkbox], #w193host [role=switch]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('hashchange', function () { if (!onFund() && F.open) closeSheet(); });
  if (typeof showPanel === 'function') {
    var __sp193 = showPanel;
    showPanel = function (id) { var r = __sp193.apply(this, arguments); try { if (id !== 'fund' && F.open) closeSheet(); } catch (e) { /* fine */ } return r; };
  }

  /* ---------- the page ---------- */
  function tabOk(id) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { return false; } }
  /* whoever opens the app reaches the Events calendar through it: body.w193has takes the page out of their Hub menu (wave153's rule) */
  function markHas() { try { document.body.classList.toggle('w193has', staffOk() && tabOk('fund')); } catch (e) { /* fine */ } }
  var hasT = null;
  function watchHas() {
    var bar = document.getElementById('tabBar'); if (!bar || bar.__w193obs) return;
    bar.__w193obs = true;
    try { new MutationObserver(function () { clearTimeout(hasT); hasT = setTimeout(markHas, 150); }).observe(bar, { attributes: true, subtree: true, attributeFilter: ['style'] }); } catch (e) { /* fine */ }
  }
  function register() {
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    if (!WA_NAV.pages.some(function (p) { return p.id === 'fund'; })) WA_NAV.register({ id: 'fund', label: 'Fundraising', group: 'apps', dot: ORANGE, gate: 'member', onShow: function (h) { show(h); } });
    try { var l = JSON.parse(lsGet('w193layers') || 'null'); if (l && typeof l === 'object') Object.keys(F.calLayers).forEach(function (k) { if (typeof l[k] === 'boolean') F.calLayers[k] = l[k]; }); } catch (e) { /* fine */ }
  }
  if (typeof startApp === 'function') {
    var __sa193 = startApp;
    startApp = async function () {
      var out = await __sa193.apply(this, arguments);
      try {
        register(); addTours(); markHas(); watchHas();
        [400, 1500, 4000].forEach(function (ms) { setTimeout(markHas, ms); });
        var h = decodeURIComponent(location.hash || '').replace(/^#/, '');
        if (h.split('/')[0] === 'fund') { showPanel('fund'); show(h); }
      } catch (e) { console.warn('wave193 boot', e); }
      return out;
    };
  }

  /* ---------- test hook ---------- */
  window.w193 = { state: function () { return F; }, load: loadAll, paint: paint, show: show, route: route, openGrant: openGrant, openFunder: openFunder, openDraft: openDraft, close: closeSheet, md: mdToHtml, questions: parseQuestions, due: dueItems, cal: calItems, sect: SECT, views: GVIEW };
})();
