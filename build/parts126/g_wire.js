
  /* ---------- access: leaders and admins by role; directors, advisers and board viewers once board_me() answers ---------- */
  function tabOk(id) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { return true; } }
  function enrolAllowed() {
    try {
      if (typeof wa40Allowed !== 'function' || wa40Allowed.__w126) return;
      var __al = wa40Allowed;
      wa40Allowed = function () {
        var a = __al.apply(this, arguments) || [];
        if (wRole() === 'blocked') return a;
        var see = isLeaderUI() || (B.me && (B.me.board || B.me.leader || B.me.admin)) || boardMode();
        if (!see) return a.filter(function (x) { return x !== 'governance' && x !== 'committees'; });
        var add = []; if (a.indexOf('governance') < 0) add.push('governance'); if (a.indexOf('committees') < 0) add.push('committees');
        return add.length ? a.concat(add) : a;
      };
      Object.keys(__al).forEach(function (k) { try { wa40Allowed[k] = __al[k]; } catch (e) { /* fine */ } });
      wa40Allowed.__w126 = true;
    } catch (e) { /* fine */ }
  }

  /* ---------- the menu: inside Board & Governance, or (for the board, who has no team row) after the Executive dashboard ---------- */
  function placeTabs() {
    try {
      var bar = document.getElementById('tabBar'); if (!bar) return;
      var gv = bar.querySelector('.tab[data-tab="governance"]'), cm = bar.querySelector('.tab[data-tab="committees"]');
      if (!gv || !cm) return;
      var br = bar.querySelector('.tab[data-tab="board"]'), row = br && br.closest ? br.closest('.w42d') : null, sub = row ? row.querySelector('.w42sub') : null;
      if (sub && tabOk('board') && br.style.display !== 'none') {
        if (gv.parentNode !== sub || sub.firstElementChild !== gv) sub.insertBefore(gv, sub.firstElementChild);
        if (gv.nextElementSibling !== cm) sub.insertBefore(cm, gv.nextElementSibling);
        gv.classList.add('w116tool'); cm.classList.add('w116tool');
        var ov = sub.querySelector('[data-w116="#team/board"],[data-w116go="#team/board"],a[data-w42a="overview"]'); if (ov && !ov.__w126) { ov.__w126 = true; ov.textContent = 'Team page'; ov.setAttribute('data-w126go', '#team/board'); }
      } else {
        var anchor = bar.querySelector('.tab[data-tab="overview"]');
        if (anchor && anchor.parentNode && anchor.nextElementSibling !== gv) anchor.parentNode.insertBefore(gv, anchor.nextElementSibling);
        if (gv.parentNode && gv.nextElementSibling !== cm) gv.parentNode.insertBefore(cm, gv.nextElementSibling);
        gv.classList.remove('w116tool'); cm.classList.remove('w116tool');
      }
      gv.style.display = tabOk('governance') ? '' : 'none';
      cm.style.display = tabOk('committees') ? '' : 'none';
    } catch (e) { /* fine */ }
  }
  var navT = null;
  function watchNav() {
    var bar = document.getElementById('tabBar'); if (!bar || bar.__w126obs) return;
    bar.__w126obs = true;
    try { new MutationObserver(function () { if (navT) return; navT = setTimeout(function () { navT = null; placeTabs(); }, 150); }).observe(bar, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
  /* the Board & Governance team page gets the two pages in its switcher */
  function teamPills() {
    try {
      var h = decodeURIComponent(location.hash || ''); if (h.indexOf('#team/board') !== 0) return;
      var seg = document.querySelector('#team .w116seg'); if (!seg || seg.querySelector('[data-w126go="#committees"]')) return;
      if (!(isLeaderUI() || (B.me && (B.me.board || B.me.leader)))) return;
      seg.insertAdjacentHTML('afterbegin', '<a data-w126go="#governance">Board overview</a><a data-w126go="#committees">Committees</a>');
    } catch (e) { /* fine */ }
  }
  var tpT = null;
  function watchTeam() {
    var sec = document.getElementById('team'); if (!sec || sec.__w126obs) return;
    sec.__w126obs = true;
    try { new MutationObserver(function () { clearTimeout(tpT); tpT = setTimeout(teamPills, 60); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
  function register() {
    enrolAllowed();
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    if (!WA_NAV.pages.some(function (p) { return p.id === 'governance'; })) WA_NAV.register({ id: 'governance', label: 'Board overview', dot: GREEN, gate: 'leader', onShow: function (h) { routeGov(h); } });
    if (!WA_NAV.pages.some(function (p) { return p.id === 'committees'; })) WA_NAV.register({ id: 'committees', label: 'Committees', dot: PURPLE, gate: 'leader', onShow: function (h) { routeCom(h); } });
    placeTabs(); watchNav();
  }

  /* ---------- routes ---------- */
  function routeGov(h) { var p = String(h || '').split('/'); try { document.title = 'Board overview · Welfare Avenue Hub'; } catch (e) { /* fine */ } govShow(p.slice(1).join('/')); }
  function routeCom(h) { var p = String(h || '').split('/'); try { document.title = 'Committees · Welfare Avenue Hub'; } catch (e) { /* fine */ } comShow(p[1] || ''); }
  function go(h) { closeSheet(); if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }

  /* the Board & Governance row, and links to its old overview, open the board overview (window capture runs before wave116's) */
  window.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (!(isLeaderUI() || (B.me && (B.me.board || B.me.leader)))) return;
    var b = t.closest('#tabBar .tab[data-tab="board"]');
    var a = !b && t.closest('[data-w116="#team/board"],[data-w116go="#team/board"]');
    if (a && a.hasAttribute('data-w126go')) return;
    if (!b && !a) return;
    e.preventDefault(); e.stopImmediatePropagation();
    document.body.classList.remove('wa-mob-open');
    try { document.querySelectorAll('#tabBar .tab-group.open').forEach(function (x) { x.classList.remove('open'); }); } catch (x) { /* fine */ }
    go('#governance');
  }, true);

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('[data-w126go]'))) { if (el.hasAttribute('data-w116') || el.hasAttribute('data-w116go')) return; e.preventDefault(); go(el.getAttribute('data-w126go')); return; }
    var inPage = !!t.closest('#w126gov') || !!t.closest('#w126com'), inSheet = !!t.closest('#w126sheet');
    if (!inPage && !inSheet) return;
    if ((el = t.closest('[data-w126close]'))) { closeSheet(); return; }
    if ((el = t.closest('[data-w126st]'))) { var f = el.closest('form'); if (f) { f.querySelectorAll('[data-w126st]').forEach(function (x) { x.classList.toggle('on', x === el); }); var inp = f.querySelector('input[name=status]'); if (inp) inp.value = el.getAttribute('data-w126st'); } return; }
    if ((el = t.closest('[data-w126logsave]'))) { saveLog(); return; }
    if ((el = t.closest('[data-w126tpdel]'))) { deleteTp(el.getAttribute('data-w126tpdel')); return; }
    if ((el = t.closest('[data-w126tpedit]'))) { var tp = tps().filter(function (x) { return String(x.id) === String(el.getAttribute('data-w126tpedit')); })[0]; if (tp) openLog(tp.committee, tp); return; }
    if ((el = t.closest('[data-w126msave]'))) { saveMember(); return; }
    if ((el = t.closest('[data-w126medit]'))) { openMemberEdit(el.getAttribute('data-w126medit')); return; }
    if ((el = t.closest('[data-w126isave]'))) { saveItem(); return; }
    if ((el = t.closest('[data-w126idel]'))) { deleteItem(el.getAttribute('data-w126idel')); return; }
    if ((el = t.closest('[data-w126csave]'))) { saveCommittee(); return; }
    if ((el = t.closest('[data-w126meetsave]'))) { saveMeeting(); return; }
    if ((el = t.closest('[data-w126tp]'))) { openTp(el.getAttribute('data-w126tp')); return; }
    if ((el = t.closest('[data-w126dir]'))) { openDirector(el.getAttribute('data-w126dir')); return; }
    if (inSheet) return;
    if ((el = t.closest('[data-w126log]'))) { openLog(el.getAttribute('data-w126log')); return; }
    if ((el = t.closest('[data-w126cedit]'))) { openCommitteeEdit(el.getAttribute('data-w126cedit')); return; }
    if ((el = t.closest('[data-w126meet]'))) { e.preventDefault(); openMeeting(el.getAttribute('data-w126meet')); return; }
    if ((el = t.closest('[data-w126item]'))) { openItem(el.getAttribute('data-w126item')); return; }
    if ((el = t.closest('[data-w126newitem]'))) { openItem(null, el.getAttribute('data-w126newitem')); return; }
    if ((el = t.closest('[data-w126done]'))) { var k = el.getAttribute('data-w126done'); B.openDone[k] = !B.openDone[k]; govPaint(); return; }
    if ((el = t.closest('[data-w126all]'))) { var c = commByKey(el.getAttribute('data-w126all')); if (c) openSheet('log', c.name + ' committee', 'The log', tps().filter(function (x) { return x.committee === c.key; }).map(logRowHtml).join('') || '<p class="w126empty">Nothing logged yet.</p>', ''); return; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && B.sheet) { e.preventDefault(); closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#w126gov [role=button], #w126com [role=button], #w126sheet .w126lg[role=button]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('hashchange', function () {
    if (B.sheet) closeSheet();
    try { if ((location.hash || '').indexOf('#team/board') === 0) { watchTeam(); setTimeout(teamPills, 150); } } catch (e) { /* fine */ }
  });
  if (typeof showPanel === 'function') {
    var __sp126 = showPanel;
    showPanel = function (id) {
      var out = __sp126.apply(this, arguments);
      try { if (id !== 'governance' && id !== 'committees' && B.sheet) closeSheet(); if (id === 'team') { watchTeam(); setTimeout(teamPills, 150); } } catch (e) { /* fine */ }
      return out;
    };
  }
  if (typeof startApp === 'function') {
    var __sa126 = startApp;
    startApp = async function () {
      var out = await __sa126.apply(this, arguments);
      try {
        register(); watchTeam();
        [400, 1500, 3500].forEach(function (ms) { setTimeout(placeTabs, ms); });
        loadMe().then(function () { try { if (typeof wa40Enforce === 'function') wa40Enforce(); } catch (e) { /* fine */ } placeTabs(); teamPills(); });
        var h = decodeURIComponent(location.hash || '').replace(/^#/, ''), root = h.split('/')[0];
        if (root === 'governance') { loadMe().then(function () { showPanel('governance'); routeGov(h); }); }
        else if (root === 'committees') { loadMe().then(function () { showPanel('committees'); routeCom(h); }); }
      } catch (e) { console.warn('wave126 boot', e); }
      return out;
    };
  }
