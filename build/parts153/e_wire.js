
  /* ---------- wiring ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target : null; if (!t) return;
    var el;
    if ((el = t.closest('[data-w153grid]'))) { ev.preventDefault(); togglePop(); return; }
    if ((el = t.closest('[data-w153app]'))) { ev.preventDefault(); open(el.getAttribute('data-w153app')); return; }
    if ((el = t.closest('[data-w153back]'))) { ev.preventDefault(); close(); return; }
    if ((el = t.closest('[data-w153go]'))) { ev.preventDefault(); go(el.getAttribute('data-w153go'), el.getAttribute('data-w153sec')); return; }
    if ((el = t.closest('[data-w153menu]'))) { ev.preventDefault(); document.body.classList.toggle('wa-mob-open'); return; }
    if ((el = t.closest('[data-w153act]'))) { ev.preventDefault(); act(el.getAttribute('data-w153act')); return; }
    if (S.open && !t.closest('#w153pop') && !t.closest('#w153dock')) closePop();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && S.open) { closePop(); var g = document.querySelector('#w153dock .w153grid'); if (g) { try { g.focus(); } catch (e) { /* fine */ } } } });
  window.addEventListener('hashchange', function () { setTimeout(paint, 0); });
  /* the Finances sections are switched inside the page: follow them in the rail */
  document.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('#finances .w94tab, #hrcentre .w47tab')) setTimeout(paint, 80); });
  if (typeof showPanel === 'function') {
    var __sp153 = showPanel;
    showPanel = function () { var r = __sp153.apply(this, arguments); try { setTimeout(paint, 0); } catch (e) { /* fine */ } return r; };
  }
  function boot() {
    try { paint(); placeholder(); } catch (e) { console.warn('wave153 boot', e); }
    [400, 1500, 4000].forEach(function (ms) { setTimeout(function () { try { paint(); placeholder(); } catch (e) { /* fine */ } }, ms); });
  }
  if (typeof startApp === 'function') {
    var __sa153 = startApp;
    startApp = async function () { var r = await __sa153.apply(this, arguments); boot(); return r; };
  }
  /* a page that draws its sections late (the HR centre rebuilds its tabs) moves the mark in the rail when it settles */
  try {
    var main = document.querySelector('main');
    if (main) new MutationObserver(function () { if (!S.app) return; clearTimeout(S.tm); S.tm = setTimeout(function () { try { if (S.sig !== sig()) paint(); } catch (e) { /* fine */ } }, 220); }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  } catch (e) { /* fine */ }
  /* a page the menu gains or loses later (access changes at boot) moves apps in and out of the launcher */
  try {
    var bar = document.getElementById('tabBar');
    if (bar) new MutationObserver(function () { clearTimeout(S.t); S.t = setTimeout(function () { try { if (S.drawn) paint(); } catch (e) { /* fine */ } }, 200); }).observe(bar, { attributes: true, subtree: true, attributeFilter: ['style'] });
  } catch (e) { /* fine */ }

  /* ---------- the tour (wave122's engine; trainings row tour:apps) ---------- */
  function addTour() {
    try {
      var W = window.w122; if (!W || !W.tours || W.tours.apps) return;
      var T = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      W.tours.apps = { tab: null, icon: 'star', hash: '#mypage', avail: function () { return ORDER.some(function (id) { return id !== 'hub' && appOk(id); }); }, steps: [
        T('#w153dock', 'The apps', 'At the bottom of the menu: the 9 dots open the Hub’s apps. The CRM, the HR centre, Finance and the Admin centre live there now, each a place of its own with its own menu; the Hub’s menu keeps the rest.'),
        T('#w153pop', 'The launcher', 'The Hub, the CRM, the HR centre, Finance and the Admin centre. You only see the apps your access opens.', { go: function () { openPop(); } }),
        T('#w153rail', 'Inside an app', 'The menu becomes the app’s menu: its pages and sections, the one you are on marked. Search everything searches the app first.', { go: function () { closePop(); open('crm'); } }),
        T('#w153bar', 'The app bar', 'The app, where you are in it, and its quick actions (in the CRM: add a contact). On a phone, Menu opens the app’s menu.', { opt: 1 }),
        T('#w153dock .w153back', 'Back to the Hub', 'Back to the Hub returns you to the page you left. A link to an app’s page opens that app; a Hub page in the launcher or the menu takes you out of it.', { go: function () { } }),
        { c: 1, t: 'Coming next', p: 'Email arrived in wave154, lists and campaigns in wave155 (the CRM’s Lists and Campaigns tabs). The rail still saves room for forms and reports; they arrive one wave at a time.', go: function () { close(); } }
      ] };
    } catch (e) { /* fine */ }
  }
  addTour();

  /* ---------- test hook ---------- */
  window.WA_APP = { open: open, close: close, current: function () { return S.app; }, ok: appOk, items: items, apps: APPS };
  window.w153 = { state: function () { return S; }, paint: paint, open: open, close: close, pop: openPop, closePop: closePop, items: items, ok: appOk, allowed: allowed, hits: contactHits, current: current };
})();
