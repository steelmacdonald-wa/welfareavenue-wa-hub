
  /* ---------- wiring ---------- */
  if (!document.getElementById('wa272css')) {
    var st272 = document.createElement('style'); st272.id = 'wa272css'; st272.textContent = homeCss + setupCss + dirCss; document.head.appendChild(st272);
  }
  function paint() {
    var page = document.getElementById('mypage'); if (!page) return;
    var dir = board();
    if (!staff() && !dir) return;
    if (dir) { wrapAllowed(); directorTab(); }
    if (classic()) { page.classList.remove('w272', 'w272dir'); paintSetup(); return; }
    page.classList.add('w272'); page.classList.toggle('w272dir', dir);
    if (dir) paintDirector();
    else { paintSentence(); paintNext(); paintApps(); foldTasks(); }
    paintSetup();
  }
  wrapAllowed();
  if (typeof renderMyPage === 'function') {
    var __rm272 = renderMyPage;
    renderMyPage = async function () {
      var r = await __rm272.apply(this, arguments);
      try { paint(); } catch (e) { console.warn('wave272 paint', e); }
      return r;
    };
  }
  if (typeof startApp === 'function') {
    var __sa272 = startApp;
    startApp = async function () {
      var h0 = String(location.hash || '');
      var r = await __sa272.apply(this, arguments);
      wrapAllowed();
      /* a director opening the Hub, or a link to Home, lands on Home; any other link stays where it points */
      if (board()) { directorTab(); if (!h0 || h0 === '#' || /^#mypage/.test(h0) || h0.indexOf('access_token=') >= 0) location.hash = '#mypage'; }
      try { paint(); } catch (e) { console.warn('wave272 boot', e); }
      setTimeout(paintSetup, 2500);
      TIP.timer = setTimeout(tryTip, 25000);
      return r;
    };
  }
  /* wave219 settles after the start: the card follows it */
  window.addEventListener('wa-push', function () { paintSetup(); });
  /* the small note waits for a page that is not Home */
  window.addEventListener('hashchange', function () { if (!onHome()) { clearTimeout(TIP.timer); TIP.timer = setTimeout(tryTip, 6000); } });

  /* ---------- test hook ---------- */
  window.w272 = { paint: paint, paintSetup: paintSetup, setupOpen: openHow, closeHow: closeHow, tryTip: tryTip, closeTip: closeTip, ranked: ranked, todayCount: todayCount, state: function () { return { app: appDone(), push: pushDone(), bip: BIP, standalone: standalone(), done: allDone() }; }, _bip: function (v) { BIP = !!v; paintSetup(); } };
})();
