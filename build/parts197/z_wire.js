
  /* ---------- showing a page ---------- */
  function oldTabOn() { var t = document.querySelector('#w46body .w47tab.on'); return t ? t.getAttribute('data-w47v') : ''; }
  function show(k, quiet) {
    if (!document.getElementById('w46body')) return;
    S.page = k || subNow() || 'overview';
    var p = pageDef(S.page) || PAGES[0];
    if (p.k === 'overview') host('w197ov');
    if (p.k === 'hours') host('w197hours');
    if (p.k === 'applications') host('w197apps');
    tagAll(); apply();
    var want = p.tab && document.querySelector('#w46body .w47tab[data-w47v="' + p.tab + '"]');
    if (want && oldTabOn() !== p.tab) {
      S.self = true; try { want.click(); } finally { S.self = false; }
      /* wave47's tab click writes its own key into the address (replaceState): put this page's back */
      if (String(location.hash || '') !== '#hrcentre/' + S.page) { try { history.replaceState(null, '', '#hrcentre/' + S.page); } catch (e) { /* fine */ } }
      setTimeout(function () { tagAll(); apply(); paintRail(); }, 60);
    }
    if (quiet) return;
    if (p.k === 'overview') { paintOverview(); loadOverview().then(function () { if (S.page === 'overview') paintOverview(); paintRail(); }); }
    if (p.k === 'applications') { if (S.candsAt) paintBoard(); else { var h = host('w197apps'); if (h) h.innerHTML = '<p class="w197note">Loading the applications…</p>'; } loadCands().then(function () { if (S.page === 'applications') paintBoard(); paintRail(); }); }
    if (p.k === 'hours') { paintHours(); loadHours().then(function () { if (S.page === 'hours') paintHours(); }); }
    if (!S.data) loadOverview().then(paintRail);
  }
  var pend = null;
  /* an older wave redrew the page body: put this page's own section back (from what is already loaded) */
  function ensureMine() {
    if (!document.getElementById('w46body')) return;
    if (S.page === 'overview' && !document.getElementById('w197ov')) paintOverview();
    if (S.page === 'hours' && !document.getElementById('w197hours')) paintHours();
    if (S.page === 'applications' && !document.getElementById('w197apps')) { if (S.candsAt) paintBoard(); else show('applications'); }
  }
  function schedule() { clearTimeout(pend); pend = setTimeout(function () { try { if (onHr()) { ensureMine(); tagAll(); apply(); } } catch (e) { /* fine */ } }, 30); }
  function watch() {
    var panel = document.getElementById('hrcentre'); if (!panel || panel.dataset.w197mo) return; panel.dataset.w197mo = '1';
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t && t.closest && (t.closest('#w197ov') || t.closest('#w197hours') || t.closest('#w197apps') || t.closest('.w197acts') || (t.closest('.w118mast') && muts[i].type === 'characterData'))) continue; schedule(); return; }
    }).observe(panel, { childList: true, subtree: true });
  }
  function fixAddress() {
    var h = String(location.hash || ''); if (h.indexOf('#hrcentre') !== 0) return;
    var s = (h.replace(/^#/, '').split('/')[1] || '').split('?')[0];
    if (s && OLD[s]) { try { history.replaceState(null, '', '#hrcentre/' + OLD[s]); } catch (e) { /* fine */ } }
    else if (s && !pageDef(s)) { try { history.replaceState(null, '', '#hrcentre/overview'); } catch (e) { /* fine */ } }
  }
  function onRoute() {
    installRail();
    if (!onHr()) return;
    fixAddress();
    if (S.want && String(location.hash || '') !== '#hrcentre/' + S.want) { try { history.replaceState(null, '', '#hrcentre/' + S.want); } catch (x) { /* fine */ } }
    watch(); show(S.want || subNow());
    setTimeout(paintRail, 80);
  }
  if (typeof wa46Render === 'function') {
    var __r46 = wa46Render;
    wa46Render = async function () { var out = await __r46.apply(this, arguments); try { installRail(); watch(); if (onHr()) { if (S.want && String(location.hash || '') !== '#hrcentre/' + S.want) { try { history.replaceState(null, '', '#hrcentre/' + S.want); } catch (x) { /* fine */ } } show(S.want || subNow()); } paintRail(); } catch (e) { /* fine */ } return out; };
  }
  if (typeof showPanel === 'function') {
    var __sp = showPanel;
    showPanel = function (id) { if (id === 'hrcentre') S.want = subNow(); var out = __sp.apply(this, arguments); try { installRail(); if (id === 'hrcentre') setTimeout(onRoute, 300); setTimeout(appTitles, 400); } catch (e) { /* fine */ } return out; };
  }
  window.addEventListener('hashchange', function () { if (String(location.hash || '').indexOf('#hrcentre') === 0) { fixAddress(); S.want = subNow(); if (document.getElementById('w46body')) { show(subNow()); setTimeout(paintRail, 60); } } else shutSheet(); [150, 700].forEach(function (ms) { setTimeout(appTitles, ms); }); });

  /* every app's title: after the rail repaints */
  (function railWatch() {
    var r = document.getElementById('w153rail');
    if (!r) { setTimeout(railWatch, 800); return; }
    new MutationObserver(function () { clearTimeout(railWatch.t); railWatch.t = setTimeout(function () { try { appTitles(); if (onHr()) mastHr(); } catch (e) { /* fine */ } }, 40); }).observe(r, { childList: true, subtree: true });
  })();

  /* ---------- events ---------- */
  /* an older tab pressed by anything else (a tour, wave169's links, a test): open its page */
  var FROMTAB = { people: 'team', onboarding: 'onboarding', training: 'training', recruitment: 'applications', hours: 'hours', policies: 'policies', discipline: 'discipline', analytics: 'analytics' };
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var ot = t.closest('#w46body .w47tab[data-w47v]');
    if (ot && !S.self) { var nk = FROMTAB[ot.getAttribute('data-w47v')]; if (nk && nk !== S.page) setTimeout(function () { try { history.replaceState(null, '', '#hrcentre/' + nk); } catch (x) { /* fine */ } S.want = nk; show(nk); paintRail(); }, 0); return; }
    var px = t.closest('[data-w197proxy]'); if (px) { var o = document.querySelector('#w153bar .w153btn[data-w153act="' + px.getAttribute('data-w197proxy') + '"]'); if (o) o.click(); return; }
    var mn = t.closest('[data-w197main]'); if (mn) { mainAction(mn.getAttribute('data-w197main')); return; }
    var g = t.closest('[data-w197go]'); if (g) { if (t.closest('#w197sheet')) shutSheet(); go(g.getAttribute('data-w197go')); return; }
    var st = t.closest('#w197sheet [data-w197st]'); if (st && S.open) { moveTo(S.open, st.getAttribute('data-w197st')); return; }
    var cv = t.closest('[data-w197cv]');
    if (cv) { (async function () { try { var s = await db.storage.from('hub-mail').createSignedUrl(cv.getAttribute('data-w197cv'), 600); if (s && s.data && s.data.signedUrl) window.open(s.data.signedUrl, '_blank', 'noopener'); else toastS('Could not open the CV'); } catch (x) { toastS('Could not open the CV'); } })(); return; }
    var a = t.closest('[data-w197a]');
    if (a) {
      var k = a.getAttribute('data-w197a');
      if (k === 'shut') shutSheet();
      else if (k === 'reload') mainAction('reload');
      else if (k === 'closed') { S.showClosed = !S.showClosed; paintBoard(); }
      else if (k === 'mins') saveMins();
      else if (k === 'notes') { var ta = document.querySelector('#w197sheet [data-w197f="notes"]'); var c = S.cands.filter(function (x) { return x.id === S.open; })[0]; if (ta && c) updateCand(c.id, { notes: ta.value.slice(0, 2000) }, 'Notes saved').then(function () { paintBoard(); }); }
      return;
    }
    var cd = t.closest('[data-w197c]'); if (cd) { openSheet(cd.getAttribute('data-w197c')); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w197role') { S.filterRole = t.value; paintBoard(); return; }
    if (t.id === 'w197own') { S.filterOwner = t.value; paintBoard(); return; }
    var f = t.getAttribute && t.getAttribute('data-w197f');
    if (f && S.open && f !== 'notes') {
      var patch = {}; patch[f] = f === 'request_id' ? (t.value ? Number(t.value) : null) : (t.value || null);
      updateCand(S.open, patch, f === 'owner' ? (t.value ? 'Handled by ' + t.value : 'Nobody handling it yet') : (t.value ? 'Linked to the position' : 'Unlinked')).then(function () { paintBoard(); });
    }
  });
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.id === 'w197q') { S.q = t.value; paintBoard(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open) shutSheet(); });
  document.addEventListener('dragstart', function (e) { var c = e.target && e.target.closest && e.target.closest('#w197board .w197cand'); if (!c) return; S.drag = c.getAttribute('data-w197c'); try { e.dataTransfer.setData('text/plain', S.drag); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* fine */ } });
  document.addEventListener('dragover', function (e) { var col = e.target && e.target.closest && e.target.closest('#w197board .w197col'); if (!col || !S.drag) return; e.preventDefault(); Array.prototype.forEach.call(document.querySelectorAll('#w197board .w197col.over'), function (x) { if (x !== col) x.classList.remove('over'); }); col.classList.add('over'); });
  document.addEventListener('dragleave', function (e) { var col = e.target && e.target.closest && e.target.closest('#w197board .w197col'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
  document.addEventListener('drop', function (e) { var col = e.target && e.target.closest && e.target.closest('#w197board .w197col'); if (!col || !S.drag) return; e.preventDefault(); var id = S.drag; S.drag = null; col.classList.remove('over'); moveTo(id, col.getAttribute('data-w197col')); });
  document.addEventListener('dragend', function () { S.drag = null; Array.prototype.forEach.call(document.querySelectorAll('#w197board .w197col.over'), function (x) { x.classList.remove('over'); }); });

  /* ---------- the tour ---------- */
  function addTour() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT || !TT.hrcentre || TT.hrcentre.__w197) return;
      var st = TT.hrcentre.steps, S0 = st[0] || {};
      function step(s, t, p) { return { s: s, t: t, p: p, opt: 1 }; }
      TT.hrcentre.hash = '#hrcentre/overview';
      TT.hrcentre.steps = [
        { s: '#hrcentre > .w118mast', t: 'HR centre', p: 'Each page holds one thing, named in the menu on the left. The title is the page you are on; its main button sits on the right.' },
        step('#w153rail .w153sec', 'The pages', 'Overview first, then People (Team, Hours, Time off, Recognition), Hiring (Applications, Positions, Playbook), Growth (Onboarding, Onboarding plan, Training), Care (Policies, Discipline) and, for HR and admins, Analytics.'),
        step('#w197ov .w197tiles', 'The numbers', 'The team, who is in The Loop this week, new applications, onboarding, overdue trainings and time off to decide. Click one to open its page.'),
        step('#w197ov .w197todo', 'Needs HR', 'Everything waiting on HR, most urgent first, each with Open. When it is empty, nothing is waiting.'),
        { c: 1, t: 'Applications', p: 'A board by stage: New, Reviewing, Interview, Offer, Hired. Drag a card to move it; open it to read what they wrote, open the CV, choose who handles it, link the position and take notes. Declined and withdrawn are kept below the board.' },
        { c: 1, t: 'Hours', p: 'Time given through The Loop against each person’s weekly minimum (below the minimum first), what people shared when they closed the loop, and meeting attendance.' }
      ];
      TT.hrcentre.__w197 = true; TT.hrcentre.__w181 = true;
    } catch (e) { /* fine */ }
  }
  addTour(); setTimeout(addTour, 1500); setTimeout(addTour, 5000);
  installRail(); setTimeout(installRail, 1000);

  window.w197 = { state: function () { return S; }, pages: PAGES, show: show, tagAll: tagAll, apply: apply, hoursBy: hoursBy, minFor: minFor, loadCands: loadCands, loadOverview: loadOverview, paintBoard: paintBoard, openSheet: openSheet, moveTo: moveTo, appTitles: appTitles, groups: hrGroups };
})();
