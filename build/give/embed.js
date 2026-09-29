/* Welfare Avenue: the donation popup for welfareavenue.com (wave161c, 28/09/26; its styles in give/embed.css since wave162).
   Served from https://hub.welfareavenue.com/give/embed.js (host-sync deploys site_files path give/embed.js).
   Add it to any page with <script async src="https://hub.welfareavenue.com/give/embed.js"></script>; it adds nothing
   visible until someone presses a Donate button. It opens the Hub's donation page (hub.welfareavenue.com/give) in a popup
   over the page, like Keela's popup did, and Stripe's payment form opens inside it, so the donor never leaves the site.
   Buttons it opens the popup for: anything with data-wa-donate, links to hub.welfareavenue.com/give, and the website's
   Keela donate buttons (class keela-popup-button with a give-can.keela.co data-src), whose Keela handler is set aside for
   that click; the click still reaches the site's own listeners (analytics). window.WADonate.open() and .close() do the same
   from code. The page inside tells the popup its height and whether a payment is open (postMessage, from the Hub only):
   while a payment is open, a click outside the popup does not close it. Escape and the close button always do. */
(function () {
  'use strict';
  if (window.WADonate) return;
  var HUB = 'https://hub.welfareavenue.com';
  var SRC = HUB + '/give/?embed=1';
  var PICK = '[data-wa-donate],a[href^="' + HUB + '/give"],.keela-popup-button[data-src*="give-can.keela.co"]';
  var back = null, box = null, frame = null, wait = null, xbtn = null, last = null, paying = false, contentH = 0, prevOverflow = '';

  function css() { /* the popup's styles live in a file beside this script, so a strict CSP (no inline styles) allows them */
    if (document.getElementById('wa-dn-css')) return;
    var l = document.createElement('link');
    l.id = 'wa-dn-css'; l.rel = 'stylesheet'; l.href = HUB + '/give/embed.css';
    (document.head || document.documentElement).appendChild(l);
  }
  function small() { return window.innerWidth <= 640; }
  function fit() { /* as tall as the page inside, up to the window (then it scrolls inside, where Stripe's own dialogs stay in view) */
    if (!frame) return;
    var room = small() ? window.innerHeight : Math.max(360, window.innerHeight - 48);
    frame.style.height = (small() ? room : Math.min(Math.max(contentH || 560, 360), room)) + 'px';
  }
  function open(trigger) {
    if (back) return;
    css();
    last = trigger || document.activeElement;
    paying = false; contentH = 0;
    back = document.createElement('div');
    back.className = 'wa-dn-back';
    back.innerHTML = '<span class="wa-dn-trap" tabindex="0"></span><div class="wa-dn-box" role="dialog" aria-modal="true" aria-label="Give to Welfare Avenue">' +
      '<button type="button" class="wa-dn-x" aria-label="Close">&times;</button><div class="wa-dn-wait">Loading…</div>' +
      '<iframe title="Give to Welfare Avenue" allow="payment *" src="' + SRC + '"></iframe></div><span class="wa-dn-trap" tabindex="0"></span>';
    box = back.querySelector('.wa-dn-box'); frame = back.querySelector('iframe'); wait = back.querySelector('.wa-dn-wait'); xbtn = back.querySelector('.wa-dn-x');
    xbtn.addEventListener('click', function () { close(); });
    back.addEventListener('mousedown', function (ev) { if (ev.target === back && !paying) close(); });
    var traps = back.querySelectorAll('.wa-dn-trap'); /* keep the keyboard inside the popup */
    traps[0].addEventListener('focus', function () { frame.focus(); });
    traps[1].addEventListener('focus', function () { xbtn.focus(); });
    var timer = setTimeout(function () { /* the page never answered: offer it in a new tab instead of a blank popup */
      if (wait) wait.innerHTML = '<p class="wa-dn-msg">The giving page did not load here. <a href="' + HUB + '/give" target="_blank" rel="noopener">Open it in a new tab</a>.</p>';
    }, 15000);
    frame.addEventListener('load', function () { setTimeout(function () { if (!contentH) return; clearTimeout(timer); }, 50); });
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(back);
    fit();
    xbtn.focus();
  }
  function close() {
    if (!back) return;
    back.parentNode && back.parentNode.removeChild(back);
    back = box = frame = wait = xbtn = null; paying = false;
    document.documentElement.style.overflow = prevOverflow;
    try { if (last && last.focus) last.focus(); } catch (e) { /* the button is gone */ }
  }

  /* before any other handler: the Donate buttons open the popup */
  window.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest(PICK) : null;
    if (!t) return;
    if (t.tagName === 'A' && (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return; /* a new tab keeps working */
    if (t.classList && t.classList.contains('keela-popup-button')) t.onclick = null; /* Keela's popup gives way to ours */
    ev.preventDefault();
    /* opened once this click is over: adding the popup now would wake Keela's page watcher, which would put its handler
       back on the button before the click reaches it */
    setTimeout(function () { open(t); }, 0);
  }, true);
  window.addEventListener('message', function (ev) {
    if (ev.origin !== HUB || !frame || ev.source !== frame.contentWindow || !ev.data || ev.data.wa !== 'give') return;
    var d = ev.data;
    if (d.type === 'height') { contentH = Number(d.height) || 0; if (wait) { wait.parentNode.removeChild(wait); wait = null; } fit(); }
    else if (d.type === 'state') paying = !!d.paying;
    else if (d.type === 'close' || d.type === 'escape') close();
  });
  document.addEventListener('keydown', function (ev) { if (back && ev.key === 'Escape') close(); });
  window.addEventListener('resize', fit);
  css(); /* ready before the first click */
  window.WADonate = { open: function () { open(document.activeElement); }, close: close };
})();
