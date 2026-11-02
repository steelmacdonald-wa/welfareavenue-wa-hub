
  /* ---------- ask: one clear sentence and a primary button, in the Hub modal (never confirm or prompt) ---------- */
  function ask(text, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false, prev = document.activeElement;
      var html = '<div id="w277modal" role="dialog" aria-modal="true" aria-labelledby="w277mt"><p id="w277mt">' + E(text) + '</p><div class="w277mb">'
        + '<button type="button" class="w277btn" data-w277cancel>Cancel</button>'
        + '<button type="button" class="w277btn ' + (danger ? 'bad' : 'gold') + '" data-w277ok>' + E(okLabel || 'Go ahead') + '</button></div></div>';
      var hub = typeof openModal === 'function' && typeof closeModal === 'function' && document.getElementById('modalBox') && document.getElementById('modalBack');
      var back, box;
      if (hub) { openModal(html); back = document.getElementById('modalBack'); box = document.getElementById('modalBox'); }
      else { back = document.createElement('div'); back.className = 'w277back'; back.innerHTML = html; document.body.appendChild(back); box = back; }
      function finish(v) {
        if (done) return; done = true;
        box.removeEventListener('click', onClick); back.removeEventListener('click', onBack); document.removeEventListener('keydown', onKey, true);
        if (hub) { try { if (document.getElementById('w277modal')) closeModal(); } catch (e) { /* fine */ } } else if (back.parentNode) back.parentNode.removeChild(back);
        try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* fine */ }
        resolve(v);
      }
      function onClick(e) { var t = e.target && e.target.closest ? e.target.closest('[data-w277ok],[data-w277cancel]') : null; if (t) { e.preventDefault(); finish(t.hasAttribute('data-w277ok')); } }
      function onBack(e) { if (e.target === back) finish(false); }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } }
      box.addEventListener('click', onClick); back.addEventListener('click', onBack); document.addEventListener('keydown', onKey, true);
      setTimeout(function () { var b = document.querySelector(danger ? '#w277modal [data-w277cancel]' : '#w277modal [data-w277ok]'); if (b) try { b.focus(); } catch (e) { /* fine */ } }, 0);
    });
  }
