
  /* ---------- wiring ---------- */
  document.addEventListener('wa94show', function (ev) { try { sync(ev && ev.detail && ev.detail.id); } catch (e) { /* fine */ } });
  /* the Finance page redraws itself when its data changes (wave22's waFinRender, wrapped by 90 to 94): draw again after it */
  if (typeof waFinRender === 'function') {
    var __fr164 = waFinRender;
    waFinRender = function () {
      var r = __fr164.apply(this, arguments);
      try { setTimeout(function () { watch(); sync(); }, 0); } catch (e) { /* fine */ }
      return r;
    };
  }
  if (typeof showPanel === 'function') {
    var __sp164 = showPanel;
    showPanel = function (id) {
      var r = __sp164.apply(this, arguments);
      try { if (id === 'finances') setTimeout(function () { sync(); }, 30); } catch (e) { /* fine */ }
      return r;
    };
  }
  /* wave118 puts the masthead back with its default words when the page is drawn again, and copies wave85's line into it:
     keep the section's title and line (the masthead itself is watched; a new masthead is picked up from the page) */
  function check() {
    var m = document.querySelector('#finances > .w118mast'); if (!m) return;
    var h = m.querySelector('h1'), q = m.querySelector(':scope > p'), id = curSec(), t = SECT[id] || SECT.overview;
    var same = function (el, en) { return window.w198 && w198.same ? w198.same(el.textContent, en) : el.textContent === en; };   /* wave198 */
    if ((h && !same(h, t[0])) || (q && !same(q, t[1]))) retitle(id);
  }
  function watchMast() {
    var m = document.querySelector('#finances > .w118mast'); if (!m || m.__w164obs) return;
    m.__w164obs = true;
    try { new MutationObserver(function () { check(); }).observe(m, { childList: true, subtree: true, characterData: true }); } catch (e) { /* fine */ }
  }
  function watch() {
    var p = panel(); if (!p) return;
    watchMast();
    if (p.__w164obs) return;
    p.__w164obs = true;
    try { new MutationObserver(function () { watchMast(); check(); }).observe(p, { childList: true }); } catch (e) { /* fine */ }
  }
  if (typeof startApp === 'function') {
    var __sa164 = startApp;
    startApp = async function () {
      var r = await __sa164.apply(this, arguments);
      try { watch(); if (panel() && panel().classList.contains('active')) sync(); } catch (e) { /* fine */ }
      return r;
    };
  }

  /* ---------- test hook ---------- */
  window.w164 = { state: function () { return F; }, sync: sync, retitle: retitle, tasks: drawTasks, inbox: drawInbox, sect: SECT };
})();
