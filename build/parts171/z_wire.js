
  /* ---------- wiring ---------- */
  function afterEvent() { setTimeout(function () { loadRaw(curEv() || {}); paintCard(); decorateCards(); decorateMast(); }, 260); }
  if (typeof waVolRenderEvent === 'function') {
    var __ev171 = waVolRenderEvent;
    waVolRenderEvent = function () { var out = __ev171.apply(this, arguments); afterEvent(); return out; };
  }
  if (typeof waVolRenderCalendar === 'function') {
    var __cal171 = waVolRenderCalendar;
    waVolRenderCalendar = function () { var out = __cal171.apply(this, arguments); setTimeout(decorateCalendar, 120); return out; };
  }
  if (typeof renderMyPage === 'function') {
    var __rm171 = renderMyPage;
    renderMyPage = async function () { var r = await __rm171.apply(this, arguments); try { paintNext(false); } catch (e) { /* fine */ } return r; };
  }
  /* the roster board repaints itself after a drag or a status change (wave119): put the tags back; the calendar's gaps come late */
  var pend = null;
  function soon() { if (pend) return; pend = setTimeout(function () { pend = null; try { if (onEvent()) { if (!document.getElementById('w171card')) paintCard(); decorateCards(); decorateMast(); } decorateCalendar(); } catch (e) { /* fine */ } }, 180); }
  try {
    var vs = document.getElementById('volunteering');
    if (vs) new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t && t.closest && t.closest('#w171card, #w174card, .w171tag, .w171m1, .w171fmt')) continue; soon(); return; }
    }).observe(vs, { childList: true, subtree: true });
  } catch (e) { /* fine */ }
  /* every 30 seconds while an event page is open (and the tab is visible): a tap on a phone shows up here */
  S.poll = setInterval(tick, 30000);
  /* Home and the Executive dashboard: the card, and back after a repaint */
  setInterval(function () { try { if (staff() && !document.hidden && !document.getElementById('w171next')) paintNext(false); } catch (e) { /* fine */ } }, 2000);
  window.addEventListener('hashchange', function () { setTimeout(function () { paintNext(false); }, 400); });

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b;
    if ((b = t.closest('[data-w171send]'))) { e.preventDefault(); if (!b.disabled) sendModal(); return; }
    if ((b = t.closest('[data-w171go]'))) { e.preventDefault(); sendGo(b); return; }
    if ((b = t.closest('[data-w171test]'))) { e.preventDefault(); S.testSent = null; testModal(); return; }
    if ((b = t.closest('[data-w171tgo]'))) { e.preventDefault(); if (!b.disabled) testGo(b); return; }
    if ((b = t.closest('[data-w171set]'))) { e.preventDefault(); settingsModal(); return; }
    if ((b = t.closest('[data-w171close]'))) { e.preventDefault(); closeModal(); return; }
    if ((b = t.closest('[data-w171fmt]'))) { e.preventDefault(); e.stopPropagation(); loadRaw(curEv() || {}).then(fmtModal); return; }
    if ((b = t.closest('[data-w171fsave]'))) { e.preventDefault(); fmtSave(b); return; }
    if ((b = t.closest('[data-w171gsave]'))) { e.preventDefault(); saveGuide(b); return; }
    if ((b = t.closest('[data-w171svsave]'))) { e.preventDefault(); surveySave(b); return; }
    if ((b = t.closest('[data-w171cooksave]'))) { e.preventDefault(); cookSave(b); return; }
    if ((b = t.closest('[data-w171pic]'))) {
      e.preventDefault(); S.set.photo = Number(b.getAttribute('data-w171pic'));
      document.querySelectorAll('[data-w171pic]').forEach(function (x) { x.classList.toggle('on', x === b); }); return;
    }
    if ((b = t.closest('[data-w171mset]'))) { e.preventDefault(); modeSet(b.getAttribute('data-w171mset'), b); return; }
    if ((b = t.closest('[data-w171mno]'))) { e.preventDefault(); var r0 = document.querySelector('input[name="w171mode"][value="' + (S.mode || 'off') + '"]'); if (r0) r0.checked = true; modeAsk(S.mode); return; }
    if ((b = t.closest('[data-w174drv]'))) { e.preventDefault(); e.stopPropagation(); if (staff()) switchDriver(Number(b.getAttribute('data-w174drv'))); return; }
    if ((b = t.closest('[data-w174st]'))) { e.preventDefault(); saveStart(b); return; }
    if ((b = t.closest('[data-w174read]'))) { e.preventDefault(); readModal(); return; }
    if ((b = t.closest('[data-w174itsave]'))) { e.preventDefault(); itinSave(b); return; }
    if ((b = t.closest('[data-w175save]'))) { e.preventDefault(); signupSave(b); return; }
    if ((b = t.closest('[data-w175ref]'))) { e.preventDefault(); refCheck(); return; }
    if ((b = t.closest('[data-w171open]'))) { e.preventDefault(); location.hash = '#volunteering/e/' + b.getAttribute('data-w171open'); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.name === 'w171mode') { modeAsk(t.value); return; }
    if (t.name === 'w171f') { var k = document.getElementById('w171kit'); if (k) k.style.display = t.value === 'community_kitchen' ? '' : 'none'; document.querySelectorAll('input[name="w171f"]').forEach(function (x) { x.closest('label').classList.toggle('on', x.checked); }); return; }
    if (t.id === 'w171role') { S.set.role = t.value; can().then(paintSettings); return; }
    if (t.id === 'w171tp') { testPhoneSave(t); return; }
    if (t.name === 'w171trole') { S.testRole = t.value; S.testRid = null; testModal(); return; }
    if (t.id === 'w171tp2') { S.testRid = Number(t.value); testModal(); return; }
    if (t.hasAttribute && t.hasAttribute('data-w174q')) { qToggle(t); return; }
  });
  try {
    if (typeof db !== 'undefined' && db && db.auth) db.auth.onAuthStateChange(function (evt) {
      if (evt === 'SIGNED_OUT') { S.can = null; S.next = null; S.msgs = {}; var el = document.getElementById('w171next'); if (el) el.remove(); }
    });
  } catch (e) { /* fine */ }

  /* ---------- the tours: the Texts card on an event, the format, the next serving on Home ---------- */
  function addTour() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT) return;
      var vs = TT.volunteering && TT.volunteering.steps;
      if (vs && !vs.some(function (x) { return x.s === '#w171card'; })) {
        var i = -1; vs.forEach(function (x, k) { if (x.s === '#w119right') i = k; });
        vs.splice(i >= 0 ? i + 1 : vs.length, 0,
          { s: '#w171card', t: 'Texts', p: 'Volunteers get a text from the ops line 7 days before the serving with their own link to confirm. When they tap Confirm (or reply YES), their card turns confirmed here within half a minute. Text to confirm sends it now; replies that need a person show under Replies; Someone added more than 7 days out first gets a text saying they are signed up, with a link to add it to their calendar; after the serving the survey goes to the roles you choose. Each card shows what the volunteer told us (a cook\u2019s recipe, donations, a new driver\u2019s car). Text settings holds the switch, the test phone, the survey, and what each role sees after confirming (its forms and guides).', opt: 1 },
          { s: '#w174card', t: 'Survey and itinerary', p: 'When the serving starts and when each role arrives; which driver is main and which picks up (click the tag on a driver\u2019s card); a preview of each role\u2019s itinerary and survey; and what volunteers said after the serving: overall, the needs people told us about, what slowed things down, the meal, and every answer in full.', opt: 1 },
          { s: '#w119 .mast .w171pill', t: 'The format and who is confirmed', p: 'Home-cooked or community kitchen (click to set it, with the kitchen and the shift), and how many on the list have confirmed, by text or by hand.', opt: 1 });
      }
      var hs = TT.home && TT.home.steps;
      if (hs && !hs.some(function (x) { return x.s === '#w171next'; })) hs.push({ s: '#w171next', t: 'The next serving', p: 'Who has confirmed for the next serving, who confirmed by text, and who we are still waiting on. Open the serving to text them.', opt: 1 });
    } catch (e) { /* fine */ }
  }
  addTour(); setTimeout(addTour, 1500);

  /* ---------- test hook ---------- */
  window.w171 = { state: function () { return S; }, paintCard: paintCard, decorateCards: decorateCards, decorateMast: decorateMast, decorateCalendar: decorateCalendar,
    paintNext: paintNext, nextHtml: nextHtml, paintW174: paintW174, w182: { W8: W8, loadSends: loadSends, sendModal: sendModal8, blockHtml: blockHtml }, w175: W5, w174: W4, driverKinds: driverKinds, readModal: readModal, counts: counts, tagFor: tagFor, tick: tick, sendModal: sendModal, settingsModal: settingsModal, fmtModal: fmtModal, loadMsgs: loadMsgs };
})();
