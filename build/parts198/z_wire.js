
  /* ---------- the account menu: Français / English ---------- */
  function menuItem() {
    var m = document.getElementById('w115menu'); if (!m || m.querySelector('.w198lang')) return;
    var so = m.querySelector('#signOutBtn');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'w115item w198lang notranslate'; b.setAttribute('data-w198lang', S.lang === 'fr' ? 'en' : 'fr');
    b.setAttribute('lang', S.lang === 'fr' ? 'en' : 'fr');
    b.innerHTML = (S.lang === 'fr' ? 'English' : 'Français') + '<small>' + (S.lang === 'fr' ? 'EN' : 'FR') + '</small>';
    if (so) m.insertBefore(b, so); else m.appendChild(b);
  }
  (function watchMenu() {
    var m = document.getElementById('w115menu');
    if (!m) { setTimeout(watchMenu, 700); return; }
    menuItem();
    new MutationObserver(function () { if (!m.querySelector('.w198lang')) menuItem(); }).observe(m, { childList: true });
  })();
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w198lang]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    switchTo(b.getAttribute('data-w198lang'));
  }, true);

  window.addEventListener('hashchange', function () { setTimeout(editNote, 400); });
  setInterval(function () { if (S.lang === 'fr') editNote(); }, 2000);

  /* ---------- boot ---------- */
  if (S.lang === 'fr') {
    try { (window.WA_MEMBERS_NAMES || []).forEach(function (n) { S.names[n] = 1; }); } catch (e) { /* fine */ }
    cached(); cachedContent();
    var tries = 0;
    (function waitDb() { if (patchDb()) return; if (++tries < 600) setTimeout(waitDb, 25); })();
    if (typeof initCloud === 'function') { var __ic = initCloud; initCloud = function () { var r = __ic.apply(this, arguments); try { patchDb(); } catch (e) { /* fine */ } return r; }; }
    function begin() { if (document.body) start(); else setTimeout(begin, 20); }
    if (S.d) begin();
    /* once signed in: the names on the roster stay as they are, the dictionary and the content are brought up to date, the language is checked */
    var after = 0;
    (function signedIn() {
      var ok = false; try { ok = typeof USER !== 'undefined' && USER && USER.email && dbOk(); } catch (e) { ok = false; }
      if (!ok) { if (++after < 400) setTimeout(signedIn, 250); return; }
      try { (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).forEach(function (m) { if (m && m.name) { S.names[m.name] = 1; S.names[String(m.name).split(' ')[0]] = 1; } }); } catch (e) { /* fine */ }
      refreshDict(false).then(function (fresh) { if (fresh || !S.on) { S.on = false; if (MO) MO.disconnect(); begin(); } });
      refreshContent();
      syncPref();
      setInterval(flush, 15000);
    })();
  } else {
    (function signedIn() {
      var ok = false; try { ok = typeof USER !== 'undefined' && USER && USER.email && dbOk(); } catch (e) { ok = false; }
      if (!ok) { setTimeout(signedIn, 400); return; }
      setTimeout(syncPref, 2500);
    })();
  }

  window.w198 = { state: function () { return S; }, same: function (text, en) { text = String(text || '').trim(); if (text === en) return true; if (S.lang !== 'fr' || !S.d) return false; var f = tr(en); return f != null && text === f.trim(); }, tr: tr, core: core, dates: dates, norm: norm, switchTo: switchTo, walk: walk, flush: flush, mapRows: mapRows, unmap: unmap };
})();
