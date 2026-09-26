
  /* ---------- Ask the Hub: the brand E is the E of THE ---------- */
  function fab() {
    var b = document.getElementById('waChatBtn'); if (!b) return false;
    var ei = b.querySelector('svg.w117ei'); if (!ei) return false;   /* wave117 draws the E; until then, wait */
    var w = b.querySelector(':scope > .w134w');
    if (!w) {
      w = document.createElement('span'); w.className = 'w134w'; w.setAttribute('aria-hidden', 'true');
      w.innerHTML = '<span class="w134a">Ask th</span><span class="w134e"></span><span class="w134b">Hub</span>';
      b.insertBefore(w, b.firstChild);
    }
    var slot = w.querySelector('.w134e');
    if (ei.parentNode !== slot) slot.appendChild(ei);
    if (!b.classList.contains('w134fab')) b.classList.add('w134fab');
    if (b.getAttribute('aria-label') !== 'Ask the Hub') b.setAttribute('aria-label', 'Ask the Hub');
    if (!b.__w134) {
      b.__w134 = true;
      /* if a later wave redraws the button, put the words back around the E */
      try { new MutationObserver(function () { if (!b.querySelector(':scope > .w134w .w117ei')) setTimeout(fab, 0); }).observe(b, { childList: true }); } catch (e) { /* fine */ }
    }
    return true;
  }
