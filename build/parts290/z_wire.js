
  /* ---------- wiring ---------- */
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w290srv')) return;
    var el = document.getElementById('w290srv');
    var id = t.getAttribute('data-w290ev');
    if (id) {
      S.pick[id] = t.checked;
      var l = t.closest('label'); if (l) l.classList.toggle('on', t.checked);
      if (S.err) { S.err = ''; var er = el && el.querySelector('.er'); if (er) er.remove(); }
    } else if (t.name === 'w290role') {
      S.role = t.value;
      t.closest('.roles').querySelectorAll('label').forEach(function (lb) { lb.classList.toggle('on', !!lb.querySelector('input:checked')); });
    } else return;
    if (el) el.__h = html();   /* the page already shows the change; no redraw under the finger */
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#w290srv [data-w290go]');
    if (!b) return;
    e.preventDefault(); go();
  });
  /* wave290b: Sign up (the friendly card and beside Open the serving), and the pop-up */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest('[data-w290signup]');
    if (b) { e.preventDefault(); e.stopPropagation(); sheetOpen(b.getAttribute('data-w290signup'), b); return; }
    if (!SH.open) return;
    if (t.closest('#w290sheet [data-w290x]')) { e.preventDefault(); sheetClose(); return; }
    if (t.closest('#w290sheet [data-w290sgo]')) { e.preventDefault(); sheetGo(); }
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w290sheet')) return;
    var id = t.getAttribute('data-w290sev');
    if (id) {
      SH.pick[id] = t.checked;
      var l = t.closest('label'); if (l) l.classList.toggle('on', t.checked);
      if (SH.err) { SH.err = ''; var er = document.querySelector('#w290sheet .er'); if (er) er.remove(); }
    } else if (t.name === 'w290srole') {
      SH.role = t.value;
      t.closest('.roles').querySelectorAll('label').forEach(function (lb) { lb.classList.toggle('on', !!lb.querySelector('input:checked')); });
    } else return;
    var bd = document.querySelector('#w290sheet .bd'); if (bd) bd.__h = sheetBody();
  });
  document.addEventListener('keydown', trap, true);
  if (typeof renderMyPage === 'function') {
    var __rm290 = renderMyPage;
    renderMyPage = async function () { var r = await __rm290.apply(this, arguments); try { paint(false); } catch (e) { /* fine */ } return r; };
  }
  /* Home redraws its body now and then (wave272, wave262): put the card back. No call unless the card was showing. */
  setInterval(function () {
    try { if (S.data && S.data.show && !document.hidden && onHome() && staff() && !board() && !document.getElementById('w290srv')) paint(false); } catch (e) { /* fine */ }
  }, 2000);
  window.addEventListener('hashchange', function () { if (onHome()) setTimeout(function () { try { paint(false); } catch (e) { /* fine */ } }, 400); });

  /* ---------- test hook ---------- */
  window.w290 = { paint: paint, html: html, nextView: nextView, signupBtn: signupBtn, signup: sheetOpen, closeSignup: sheetClose,
    state: function () { return { data: S.data, pick: S.pick, role: S.role, busy: S.busy, err: S.err, done: S.done, next: NX.data, sheet: { open: SH.open, ev: SH.ev, pick: SH.pick, role: SH.role, err: SH.err, done: SH.done } }; } };
})();
