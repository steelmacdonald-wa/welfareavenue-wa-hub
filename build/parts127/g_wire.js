
  /* ---------- Admin > Access profiles: a section of its own ---------- */
  function addSection() {
    try {
      var W = window.__wa118; if (!W || !Array.isArray(W.ADMIN)) return;
      if (!W.ADMIN.some(function (a) { return a[0] === 'access'; })) {
        var at = 0; W.ADMIN.forEach(function (a, i) { if (a[0] === 'people') at = i + 1; });
        W.ADMIN.splice(at || W.ADMIN.length, 0, ['access', 'Access profiles', '#w127card', 'What each profile gives access to: the pages, what the database enforces, and who has which profile.']);
      }
      if (!document.getElementById('wa127sec')) {
        var st = document.createElement('style'); st.id = 'wa127sec';
        st.textContent = '.w118adm[data-sec="access"] ~ .card:not(#w127card){display:none !important;}.w118adm:not([data-sec="access"]) ~ #w127card{display:none !important;}';
        document.head.appendChild(st);
      }
    } catch (e) { /* fine */ }
  }
  addSection();

  /* ---------- the profile menu: Your access ---------- */
  function menuItem() {
    try {
      var m = document.getElementById('w115menu'); if (!m || m.style.display === 'none') return;
      if (m.querySelector('[data-w127mine]')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'w115item'; b.setAttribute('data-w127mine', '1'); b.textContent = 'Your access';
      /* the menu stops clicks from bubbling, so the button carries its own */
      b.addEventListener('click', function (e) { e.preventDefault(); m.style.display = 'none'; load().then(openMine); });
      var ask = m.querySelector('[data-w115act="access"]'), so = document.getElementById('signOutBtn');
      if (ask && ask.parentNode === m) m.insertBefore(b, ask); else if (so && so.parentNode === m) m.insertBefore(b, so); else m.appendChild(b);
    } catch (e) { /* fine */ }
  }
  try { new MutationObserver(function () { menuItem(); }).observe(document.body, { childList: true, subtree: false }); } catch (e) { /* fine */ }
  var menuT = null;
  function watchMenu() { var m = document.getElementById('w115menu'); if (!m || m.__w127) return; m.__w127 = true; try { new MutationObserver(function () { clearTimeout(menuT); menuT = setTimeout(menuItem, 0); }).observe(m, { childList: true, attributes: true, attributeFilter: ['style'] }); } catch (e) { /* fine */ } }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    var inCard = !!t.closest('#w127'), inSheet = !!t.closest('#w127sheet'), inPeople = !!t.closest('#w113card');
    if (!inCard && !inSheet && !inPeople) return;
    if ((el = t.closest('[data-w127close]'))) { closeSheet(); return; }
    if ((el = t.closest('[data-w127prof]'))) { e.preventDefault(); openProfile(el.getAttribute('data-w127prof')); return; }
    if ((el = t.closest('[data-w127pedit]'))) { openEdit(el.getAttribute('data-w127pedit')); return; }
    if ((el = t.closest('[data-w127psave]'))) { saveEdit(el.getAttribute('data-w127psave')); return; }
    if ((el = t.closest('[data-w127doapply]'))) { doApply(); return; }
    if ((el = t.closest('[data-w127ask]'))) { closeSheet(); location.hash = '#mypage'; setTimeout(function () { var b = document.getElementById('w110btn'); if (b) b.click(); }, 700); return; }
    if ((el = t.closest('[data-w127go]'))) { closeSheet(); location.hash = el.getAttribute('data-w127go'); return; }
    if (inSheet || inPeople) return;
    if ((el = t.closest('[data-w127cell]'))) { var kv = el.getAttribute('data-w127cell').split('|'); cycle(kv[0], kv[1]); return; }
    if ((el = t.closest('[data-w127save]'))) { saveMatrix(); return; }
    if ((el = t.closest('[data-w127undo]'))) { A.edits = {}; paint(); return; }
    if ((el = t.closest('[data-w127f]'))) { A.filter = el.getAttribute('data-w127f'); paint(); return; }
    if ((el = t.closest('[data-w127apply]'))) { var em = el.getAttribute('data-w127apply'); openApply((A.cache || []).filter(function (x) { return x.email === em; })); return; }
    if ((el = t.closest('[data-w127applyall]'))) { openApply((A.cache || []).filter(function (x) { return x.sug && !x.same && x.hasRow; })); return; }
    if ((el = t.closest('[data-w127jump]'))) { var tg = document.getElementById(el.getAttribute('data-w127jump')); if (tg && tg.scrollIntoView) tg.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.matches && t.matches('select[data-w127acc]')) { changeAccess(t.getAttribute('data-w127acc'), t.value); return; }
    if (t.matches && t.matches('input[data-w127auto]')) { setAuto(t.checked); return; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && A.sheet) { e.preventDefault(); closeSheet(); } });
  window.addEventListener('hashchange', function () {
    if (A.sheet) closeSheet();
    if (onAccess()) setTimeout(show, 30);
    setTimeout(recheck, 60);
  });
  if (typeof showPanel === 'function') {
    var __sp127 = showPanel;
    showPanel = function (id) {
      var out = __sp127.apply(this, arguments);
      try { if (id === 'adminpanel' && onAccess()) setTimeout(show, 30); } catch (e) { /* fine */ }
      return out;
    };
  }

  /* ---------- the tours: the Admin tour gets a stop here ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours || !W.tours.adminpanel) return;
      var st = W.tours.adminpanel.steps || [];
      if (st.some(function (s) { return s.s === '#w127card'; })) return;
      var at = 0; st.forEach(function (s, i) { if (s.s === '#w113card') at = i + 1; });
      st.splice(at || st.length, 0, { s: '#w127card', t: 'Access profiles', p: 'One profile each: a team (with a lead option), the board, executives or admins. Each card says what it gives, the table compares every page, and the proposal shows who would gain or lose what before you apply it.', opt: 1, hash: '#adminpanel/access' });
      var nav = st.filter(function (s) { return s.s === '#adminpanel nav.w118adm'; })[0];
      if (nav && nav.p.indexOf('access profiles') < 0) nav.p = nav.p.replace('people and access,', 'people and access, access profiles,');
    } catch (e) { /* fine */ }
  }
  addTours();

  /* ---------- boot ---------- */
  window.w127 = {
    state: function () { return A; }, load: load, paint: paint, open: openMine, profile: openProfile,
    accessCell: accessCell, pagesCell: pagesCell, pages: function () { try { return wa40Allowed(); } catch (e) { return []; } },
    mine: function () { var p = myProfile(); return p ? p.key : null; },
    hrOk: function () { var p = myProfile(); if (!p) return null; return tabOk('hrcentre'); }
  };
  wrapAllowed();
  if (typeof startApp === 'function') {
    var __sa127 = startApp;
    startApp = async function () {
      var pre = load();
      var out = await __sa127.apply(this, arguments);
      try {
        await pre;
        addTours(); watchMenu(); watchRows();
        enforce(); recheck();
        [600, 2000].forEach(function (ms) { setTimeout(function () { enforce(); recheck(); }, ms); });
        if (onAccess()) show();
        /* the People and access table picks up the profile column once the profiles are in */
        try { if (amAdmin() && document.getElementById('w113card') && typeof wa40Render === 'function') wa40Render(); } catch (e) { /* fine */ }
      } catch (e) { console.warn('wave127 boot', e); }
      return out;
    };
  }
})();
