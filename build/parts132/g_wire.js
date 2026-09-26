
  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    /* the undo bar */
    if ((el = t.closest('#w132snack [data-w132sn]'))) {
      var k = el.getAttribute('data-w132sn');
      if (k === 'x') { hideSnack(); return; }
      var a = SNACK.acts[Number(k)]; hideSnack(); if (a && a[1]) a[1]();
      return;
    }
    /* the drawer and the project page */
    if ((el = t.closest('#w116dr [data-w132bank]'))) {
      e.preventDefault(); e.stopPropagation();
      var tk = taskById(el.getAttribute('data-w132bank')); if (!tk) return;
      openSheet({ kind: 'task', task: tk });
      return;
    }
    if ((el = t.closest('[data-w132bankproj]'))) {
      e.preventDefault();
      var p = projById(el.getAttribute('data-w132bankproj')); if (!p) return;
      var pc = projectCounts(p);
      openSheet({ kind: 'project', project: p, subs: pc.subs, count: pc.count });
      return;
    }
    if ((el = t.closest('[data-w132goto]'))) { e.preventDefault(); go(el.getAttribute('data-w132goto')); return; }
    /* the sheet */
    var inSheet = !!t.closest('#w132sheet');
    if (inSheet) {
      if ((el = t.closest('[data-w132close]'))) { closeSheet(); return; }
      if ((el = t.closest('[data-w132pick]'))) { readSheet(); B.sheet.pick = el.getAttribute('data-w132pick'); B.sheet.err = ''; renderSheet(false); if (B.sheet.pick === 'custom') { var dd = document.getElementById('w132day'); if (dd) { try { dd.focus(); } catch (x) { /* fine */ } } } return; }
      if ((el = t.closest('[data-w132go]'))) { submitSheet(); return; }
      return;
    }
    /* the page */
    if (!t.closest('#w132')) return;
    if ((el = t.closest('[data-w132new]'))) { var mt = myTeam(); openSheet({ kind: 'new', dept: B.team || (teams().indexOf(mt) >= 0 ? mt : teams()[0]) }); return; }
    if ((el = t.closest('[data-w132team]'))) { var tm = el.getAttribute('data-w132team'); var h = tm ? '#bank/' + tm : '#bank'; if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (x) { /* fine */ } } B.team = tm; paint(); return; }
    if ((el = t.closest('[data-w132more]'))) { var key = el.getAttribute('data-w132more'); B.open[key] = !B.open[key]; paintList(); return; }
    if ((el = t.closest('[data-w132back]'))) {
      var kb = el.getAttribute('data-w132back').split(':'); var it = itemBy(kb[0], kb[1]); if (!it) return;
      el.disabled = true; el.textContent = 'Bringing it back…';
      bringBack(kb[0], kb[1]).catch(function (x) { toastS(errText(x)); el.disabled = false; paintList(); });
      return;
    }
    if ((el = t.closest('[data-w132date]'))) {
      var kd = el.getAttribute('data-w132date').split(':'); var itd = itemBy(kd[0], kd[1]); if (!itd) return;
      openSheet({ kind: 'date', itemKind: kd[0], id: kd[1], title: itd.title, until: itd.until });
      return;
    }
    if ((el = t.closest('[data-w132open]'))) {
      var ko = el.getAttribute('data-w132open').split(':');
      if (ko[0] === 'project') { go('#project/' + ko[1]); return; }
      var tt = taskById(ko[1]);
      if (tt && window.w116Board && window.w116Board.open) { window.w116Board.open(Number(ko[1])); return; }
      go('#team/' + (el.getAttribute('data-d') || '') + '/tasks');
      return;
    }
    if ((el = t.closest('details.w132how summary'))) { setTimeout(function () { var d = document.querySelector('#w132 details.w132how'); B.howOpen = !!(d && d.open); }, 0); }
  }, true);
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w132q') { B.q = t.value; paintList(); return; }
    if (t.id === 'w132day' && B.sheet) { B.sheet.custom = t.value; var d = parseDay(t.value), s = document.getElementById('w132soft'); if (s) s.textContent = d && daysBetween(today(), d) < 60 && daysBetween(today(), d) > 0 ? 'The bank is for work that waits three months or more. For anything sooner, a due date keeps it on the board.' : ''; var sp = document.querySelector('#w132sheet [data-w132pick="custom"] span'); if (sp && d) sp.textContent = fmtDay(d, true); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !B.sheet) return;
    if (t.id === 'w132nteam') { readSheet(); B.sheet.project = ''; renderSheet(false); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && B.sheet) { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
    if (e.key === 'Enter' && B.sheet && e.target && (e.target.id === 'w132why' || e.target.id === 'w132ntitle')) { e.preventDefault(); submitSheet(); }
  }, true);
  window.addEventListener('hashchange', function () { if (B.sheet) closeSheet(); setTimeout(function () { injectCard(false); injectProject(); }, 120); });

  /* ---------- boot ---------- */
  if (typeof showPanel === 'function') {
    var __sp132 = showPanel;
    showPanel = function (id) {
      var out = __sp132.apply(this, arguments);
      try { if (id === 'team') { watchTeam(); setTimeout(function () { injectCard(false); }, 150); } if (id === 'projectpage') { watchProject(); setTimeout(injectProject, 150); } } catch (e) { /* fine */ }
      return out;
    };
  }
  if (typeof startApp === 'function') {
    var __sa132 = startApp;
    startApp = async function () {
      var out = await __sa132.apply(this, arguments);
      try {
        register(); watchDrawer(); watchTeam(); watchProject();
        try { var bar = document.getElementById('tabBar'); if (bar && !bar.__w132) { bar.__w132 = true; var nt = null; new MutationObserver(function () { if (nt) return; nt = setTimeout(function () { nt = null; placeTab(); }, 160); }).observe(bar, { childList: true, subtree: true }); } } catch (e) { /* fine */ }
        [400, 1500].forEach(function (ms) { setTimeout(placeTab, ms); });
        var root = decodeURIComponent(location.hash || '').replace(/^#/, '').split('/')[0];
        if (root === 'bank') { try { applyHash(); } catch (e) { /* fine */ } }
        if (root === 'team') setTimeout(function () { injectCard(false); }, 300);
        if (root === 'project') setTimeout(injectProject, 400);
      } catch (e) { console.warn('wave132 boot', e); }
      return out;
    };
  }

  /* ---------- the page tour (wave122's engine; trainings row tour:bank) and a step on the project tour ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours) return;
      var OPT = { opt: 1 };
      var S = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      if (!W.tours.bank) W.tours.bank = { tab: 'bank', icon: 'box', hash: '#bank', steps: [
        S('#bank > .w118mast', 'The bank', 'Work that cannot start for three months or more waits here, out of every board, list and count, and comes back on its own date.'),
        S('#w132 .w132top', 'At a glance', 'How much is waiting, what comes back in the next 30 days, and what came back lately. Put something new straight in with the button.', OPT),
        S('#w132 details.w132how', 'How it works', 'Move a task from its drawer, or a whole project from its page. The Hub also banks what a meeting puts off.', OPT),
        S('#w132back', 'Back from the bank', 'What came back in the last two weeks. It is on its team’s board again, marked back from the bank.', OPT),
        S('#w132 .w132bar', 'Each team', 'Show one team’s bank, or search for something.', OPT),
        S('#w132 .w132grp', 'By the month it comes back', 'Why each piece waits and who put it here. Bring it back now or give it a new date.', OPT)
      ] };
      var pt = W.tours.project;
      if (pt && Array.isArray(pt.steps) && !pt.steps.some(function (s) { return s && s.s === '#projectpage .w132pbar'; })) {
        pt.steps.splice(Math.min(2, pt.steps.length), 0, S('#projectpage .w132pbar', 'Park it in the bank', 'When the whole project cannot move for three months or more, its lead or a leader can move it to the bank. It comes back with everything in it.', OPT));
      }
    } catch (e) { /* fine */ }
  }
  addTours();

  /* ---------- test hook ---------- */
  window.w132 = { state: function () { return B; }, load: load, items: items, paint: paint, open: openSheet, close: closeSheet, card: injectCard, drawer: injectDrawer, project: injectProject, back: isBackRecent, dates: dateChoices };
})();
