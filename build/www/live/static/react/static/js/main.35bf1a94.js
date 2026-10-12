/* Welfare Avenue: the old website's script lived here until 02/10/26. A browser still showing the old page from its
   cache lands here: it fetches the page again and reloads into the new site, once. */
(function () {
  var key = "wa_old_site_reload:" + window.location.pathname + window.location.search, url = window.location.href, marked = /[?&]wa_r=1(&|$)/.test(window.location.search), store = true;
  try { if (window.sessionStorage.getItem(key)) return; window.sessionStorage.setItem(key, "1"); } catch (e) { store = false; }
  if (!store && marked) return;
  function go() {
    if (store) { window.location.reload(); return; }
    var l = window.location; l.replace(l.pathname + l.search + (l.search ? "&" : "?") + "wa_r=1" + l.hash);
  }
  try { window.fetch(url, { cache: "reload", credentials: "same-origin" }).then(go, go); } catch (e) { go(); }
})();
