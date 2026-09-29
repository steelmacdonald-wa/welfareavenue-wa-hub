
  /* ---------- Loom videos play in place ("Watch here") ----------
     In onboarding steps, the Academy's lessons and readings, the HR checklists and the leads' card, a Loom link gets a Watch
     here button; the video opens under the paragraph as a Loom embed (loaded only when asked) and closes again. A link next to
     a player that already shows the same video (the Academy's video sheet) is left alone, and so are the Loom card's meeting
     recordings (they are meetings, not trainings). */
  var LOOM_RE = /loom\.com\/(?:share|embed)\/([0-9a-f]{32})/i;
  var SCOPES = '#training, #w122sheet, .modal-back, #w166lead, #hrcentre';
  function loomIdOf(href) { var m = String(href || '').match(LOOM_RE); return m ? m[1].toLowerCase() : ''; }
  function playerNear(a, id) {
    var box = a.closest('.wrap, .w37step, .ds, .prose, .modal-back, .sh') || a.parentElement;
    if (!box) return false;
    return [].slice.call(box.querySelectorAll('iframe')).some(function (f) { return f.src && f.src.indexOf(id) >= 0 && !f.closest('.w166vidwrap'); });
  }
  function upgrade(root) {
    var n = 0;
    (root || document).querySelectorAll('a[href*="loom.com/share/"], a[href*="loom.com/embed/"]').forEach(function (a) {
      if (a.getAttribute('data-w166') || !a.closest(SCOPES) || a.closest('#w162loom') || a.closest('.w166vidwrap') || a.classList.contains('w122lnk')) return;
      var id = loomIdOf(a.getAttribute('href')); if (!id) return;
      a.setAttribute('data-w166', '1');
      if (playerNear(a, id)) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'w166play'; b.setAttribute('data-w166loom', id); b.setAttribute('aria-expanded', 'false');
      b.innerHTML = '&#9654; Watch here';
      a.insertAdjacentElement('afterend', b); n++;
    });
    return n;
  }
  function hostOf(b) {
    /* the block the player goes under: the paragraph, list item or step text holding the link */
    var h = b.closest('p, li, .ds, .w166ask, .w166ls') || b.parentElement;
    return h;
  }
  function toggle(b) {
    var id = b.getAttribute('data-w166loom'); var host = hostOf(b); if (!host) return;
    var next = host.nextElementSibling;
    if (next && next.classList.contains('w166vidwrap') && next.getAttribute('data-id') === id) {
      next.remove(); b.innerHTML = '&#9654; Watch here'; b.setAttribute('aria-expanded', 'false'); return;
    }
    var w = document.createElement('div'); w.className = 'w166vidwrap'; w.setAttribute('data-id', id);
    w.innerHTML = '<iframe src="https://www.loom.com/embed/' + id + '?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true" title="Loom video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    host.insertAdjacentElement('afterend', w);
    b.innerHTML = 'Hide the video'; b.setAttribute('aria-expanded', 'true');
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w166loom]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    try { toggle(b); } catch (err) { /* fine */ }
  }, true);
  var upT = null;
  function soon() { clearTimeout(upT); upT = setTimeout(function () { try { afterDom(); } catch (e) { /* fine */ } }, 120); }
  try { new MutationObserver(function (list) { for (var i = 0; i < list.length; i++) { if (list[i].addedNodes && list[i].addedNodes.length) { soon(); return; } } }).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* fine */ }
