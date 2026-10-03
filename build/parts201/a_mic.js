/* =====================================================================
   WA v201 (03/10/26): speak instead of typing, in every AI prompt box.
   Steel (03/10/26), on Your inbox's reply tool: "I'd like to use voice to text in prompts here"; asked where, he chose
   "Every AI prompt box". One shared mic, the same everywhere: tap it, talk, and the words appear in the box as you speak
   (the browser's own SpeechRecognition: Chrome, Edge and Safari; not Firefox, where no mic shows); tap again, or press Esc,
   to stop. It listens in the person's Hub language (wave198: Francais is fr-CA, else en-CA).
   The boxes (TARGETS): Ask the Hub (#w38in, which since wave38 replaced wave14's row and its mic), Your inbox (own words,
   anything else to say, the reply itself, the team's line, the writing guide), the content drafter's brief (#cdBrief),
   Suggest a change to the Hub (#w96in, #w96rin), Finance's import guidance (#w90gtext), the agenda's purpose (#w53purpose)
   and the grant writer's notes (data-w193wnotes). The Loop (#w192say) keeps its own Speak button.
   A box is found again by its key when its page draws it anew mid-sentence, so the words keep landing. Each change fires
   the box's input event, so the page keeps what was said as if it were typed. Nothing is recorded or sent anywhere by the
   Hub: the browser turns speech into text (Chrome sends the audio to Google's speech service to do it).
   ===================================================================== */
(function () {
  if (window.__wa201) return;
  window.__wa201 = true;
  var SRC = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var GREEN = '#103F39', GOLD = '#DCA527', CREAM = '#FFFAF2';

  /* every box where people tell the Hub's AI what to do; key: the attribute that tells two boxes of one kind apart */
  var TARGETS = [
    { sel: '#w38in' },
    { sel: '#w170sheet [data-w170own]', key: 'data-w170own' },
    { sel: '#w170note' }, { sel: '#w170body' }, { sel: '#w170ask' }, { sel: '#w170voice' },
    { sel: '#cdBrief' },
    { sel: '#w96in' }, { sel: '#w96rin' },
    { sel: '#w90gtext' },
    { sel: '#w53purpose' },
    { sel: '[data-w193wnotes]' }
  ];
  var MIC = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5.5a3.5 3.5 0 1 0-7 0V11a3.5 3.5 0 0 0 3.5 3.5Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V19H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.09A6 6 0 0 0 18 11Z"/></svg>';
  var STOP = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';
  var L_IDLE = 'Speak instead of typing', L_ON = 'Listening: tap to stop';

  function css() {
    if (document.getElementById('w201css')) return;
    var st = document.createElement('style'); st.id = 'w201css';
    st.textContent = ''
      + '.w201h{display:flow-root;position:relative;height:0;padding:0;border:0;pointer-events:none;z-index:2;}'
      + '.w201mic{pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;width:30px;height:30px;padding:0;border-radius:999px;'
      + 'border:1px solid rgba(16,63,57,.22);background:' + CREAM + ';color:' + GREEN + ';cursor:pointer;box-shadow:0 1px 2px rgba(16,63,57,.12);'
      + 'font:600 12px/1 "Space Grotesk",system-ui,sans-serif;white-space:nowrap;transition:background .15s,color .15s,width .15s;}'
      + '.w201mic:hover{background:rgba(16,63,57,.08);}'
      + '.w201mic:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
      + '.w201h .w201mic{position:absolute;}'
      + '.w201mic.on{width:auto;padding:0 11px 0 9px;background:' + GREEN + ' !important;color:' + CREAM + ' !important;border-color:' + GREEN + ' !important;animation:w201pulse 1.4s ease-out infinite;}'
      + '@media (hover:none){.w201mic:hover{background:' + CREAM + ';}}'
      + '.w201mic .w201t{display:none;}.w201mic.on .w201t{display:inline;}'
      + '@keyframes w201pulse{0%{box-shadow:0 0 0 0 rgba(220,165,39,.65);}70%{box-shadow:0 0 0 8px rgba(220,165,39,0);}100%{box-shadow:0 0 0 0 rgba(220,165,39,0);}}'
      + '.w201in{flex:none;align-self:center;margin:0 0 0 6px;}'
      + '.w201below{display:flex;justify-content:flex-end;margin:4px 0 0;}'
      + '.w201sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}'
      + '@media (prefers-reduced-motion:reduce){.w201mic.on{animation:none;box-shadow:0 0 0 3px rgba(220,165,39,.6);}}';
    document.head.appendChild(st);
  }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function lang() {
    try { var s = window.w198 && window.w198.state && window.w198.state(); if (s && s.lang) return s.lang === 'fr' ? 'fr-CA' : 'en-CA'; } catch (e) { /* fine */ }
    return /^fr/i.test(navigator.language || '') ? 'fr-CA' : 'en-CA';
  }
  function keyOf(el, t) { return el.id ? '#' + el.id : t.sel + '|' + (t.key ? (el.getAttribute(t.key) || '') : ''); }
  function find(key) {
    if (key.charAt(0) === '#' && key.indexOf('|') < 0) return document.getElementById(key.slice(1));
    var i = key.lastIndexOf('|'), sel = key.slice(0, i), v = key.slice(i + 1);
    var t = TARGETS.filter(function (x) { return x.sel === sel; })[0]; if (!t) return null;
    var all = document.querySelectorAll(sel);
    for (var j = 0; j < all.length; j++) if (!t.key || all[j].getAttribute(t.key) === v) return all[j];
    return null;
  }
  function usable(el) { return el && el.isConnected && !el.disabled && !el.readOnly && el.offsetParent !== null; }

  /* ---------- placing the button ---------- */
  function px(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function place(el, btn) {
    var p = el.parentNode, pcs = getComputedStyle(p), cs = getComputedStyle(el);
    var row = /flex/.test(pcs.display) && !/column/.test(pcs.flexDirection);
    if (row) { btn.classList.add('w201in'); p.insertBefore(btn, el.nextSibling); return { mode: 'in', node: btn }; }
    if (/grid/.test(pcs.display)) { var b = document.createElement('div'); b.className = 'w201below'; b.appendChild(btn); p.insertBefore(b, el.nextSibling); return { mode: 'below', node: b }; }
    /* over the box's corner: a zero-height holder right under it, the button lifted into the box (no layout shift, no timers) */
    var h = document.createElement('div'); h.className = 'w201h';
    var mb = px(cs.marginBottom), gap = /flex/.test(pcs.display) ? px(pcs.rowGap) : 0;
    h.style.marginTop = (-(mb + gap)) + 'px'; h.style.marginBottom = mb + 'px';
    h.appendChild(btn); p.insertBefore(h, el.nextSibling);
    var tall = el.tagName === 'TEXTAREA';
    var grip = tall && cs.resize !== 'none' ? 16 : 0;
    function fit() {
      if (!el.isConnected) return;
      h.style.width = el.offsetWidth + 'px';
      h.style.marginLeft = (el.offsetLeft - h.offsetLeft + px(h.style.marginLeft)) + 'px';
      var bh = btn.offsetHeight || 30;
      btn.style.right = (6 + grip) + 'px';
      btn.style.bottom = (tall ? 6 : Math.max(2, (el.offsetHeight - bh) / 2)) + 'px';
    }
    fit();
    el.style.paddingRight = (px(cs.paddingRight) + 36) + 'px';
    if (window.ResizeObserver) { try { new ResizeObserver(fit).observe(el); } catch (e) { /* fine */ } }
    return { mode: 'over', node: h, fit: fit };
  }

  /* ---------- one box ---------- */
  function attach(el, t) {
    if (el.__w201 || el.hasAttribute('data-w201off')) return;
    if (!el.parentNode || el.offsetParent === null) return;   /* drawn hidden: try again when it shows */
    el.__w201 = true;
    var key = keyOf(el, t);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'w201mic'; btn.setAttribute('data-w201mic', key);
    btn.setAttribute('aria-label', L_IDLE); btn.title = L_IDLE + ' (Esc stops)'; btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = MIC + '<span class="w201t">Listening</span>';
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });   /* keep the caret in the box */
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var box = find(key) || el;
      if (REC && REC.key === key) stop(true); else start(box, key);
    });
    var pl = place(el, btn);
    el.__w201node = pl.node;
    if (REC && REC.key === key) paint(btn, true);
  }
  function paint(btn, on) {
    btn.classList.toggle('on', !!on); btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? L_ON : L_IDLE); btn.title = (on ? L_ON : L_IDLE) + ' (Esc stops)';
    btn.innerHTML = (on ? STOP : MIC) + '<span class="w201t">Listening</span>';
  }
  function paintAll() {
    var bs = document.querySelectorAll('[data-w201mic]');
    for (var i = 0; i < bs.length; i++) paint(bs[i], !!(REC && REC.key === bs[i].getAttribute('data-w201mic')));
  }
  function say(msg) { var r = document.getElementById('w201live'); if (r) r.textContent = msg; }

  /* ---------- listening ---------- */
  var REC = null;
  function now() { return (window.performance && performance.now) ? performance.now() : new Date().getTime(); }
  function tidy(s) { return String(s || '').replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim(); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function write(text) {
    var box = find(REC.key) || (REC.el.isConnected ? REC.el : null); if (!box) return;
    REC.el = box;
    var heard = tidy(text); if (!heard) return;
    if (REC.capital) heard = cap(heard);
    var v = REC.before + heard + REC.after;
    var max = Number(box.getAttribute('maxlength')) || 0; if (max > 0 && v.length > max) v = v.slice(0, max);
    if (box.value === v) return;
    box.value = v;
    var caret = Math.min(v.length, (REC.before + heard).length);
    try { box.setSelectionRange(caret, caret); } catch (e) { /* fine */ }
    if (box.tagName === 'TEXTAREA' && !REC.after) box.scrollTop = box.scrollHeight;
    try { box.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* fine */ }
  }
  function start(el, key) {
    if (!SRC) return;
    if (REC) stop(true);
    var rec;
    try { rec = new SRC(); } catch (e) { T('Speaking is not available in this browser'); return; }
    rec.lang = lang(); rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    var v = el.value || '', at = (typeof el.selectionStart === 'number' && document.activeElement === el) ? el.selectionStart : v.length;
    var before = v.slice(0, at), after = v.slice(at);
    if (before && !/\s$/.test(before)) before += ' ';
    if (after && !/^\s/.test(after)) after = ' ' + after;
    REC = { key: key, el: el, rec: rec, before: before, after: after, fin: '', capital: !before.trim() || /[.!?]\s*$/.test(before), user: false, at: now() };
    var mine = REC;
    rec.onresult = function (ev) {
      if (REC !== mine) return;
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i]; if (!r || !r[0]) continue;
        if (r.isFinal) mine.fin += ' ' + r[0].transcript; else interim += ' ' + r[0].transcript;
      }
      write(mine.fin + ' ' + interim);
    };
    rec.onerror = function (ev) {
      if (REC !== mine) return;
      var er = ev && ev.error;
      if (er === 'not-allowed' || er === 'service-not-allowed') T('Allow the microphone for the Hub in your browser, then tap the mic again');
      else if (er === 'no-speech') T('Nothing heard. Tap the mic and speak');
      else if (er === 'audio-capture') T('No microphone found on this device');
      else if (er === 'network') T('Speaking needs an internet connection');
      else if (er && er !== 'aborted') T('Speaking stopped: ' + er);
    };
    rec.onend = function () { if (REC === mine) finish(); };
    try { rec.start(); } catch (e) { REC = null; T('The microphone could not start'); return; }
    mine.timer = setInterval(function () { if (REC !== mine) { clearInterval(mine.timer); return; } gone(); }, 700);
    paintAll(); say(L_ON);
    try { el.focus({ preventScroll: true }); } catch (e) { /* fine */ }
  }
  function stop(user) {
    if (!REC) return;
    REC.user = !!user;
    var r = REC.rec;
    try { r.stop(); } catch (e) { /* stopped */ }
    finish();
  }
  function finish() {
    var m = REC; if (!m) return;
    REC = null;
    if (m.timer) clearInterval(m.timer);
    try { m.rec.onresult = null; m.rec.onend = null; m.rec.onerror = null; } catch (e) { /* fine */ }
    var box = find(m.key) || (m.el.isConnected ? m.el : null);
    if (box) { try { box.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* fine */ } }
    paintAll(); say('Stopped listening');
  }

  /* Esc stops listening (and does not close the sheet or the dialog around the box) */
  window.addEventListener('keydown', function (e) {
    if (REC && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); stop(true); }
  }, true);

  /* ---------- finding the boxes as pages draw them ---------- */
  function scan() {
    if (!SRC) return;
    for (var i = 0; i < TARGETS.length; i++) {
      var t = TARGETS[i], els = document.querySelectorAll(t.sel);
      for (var j = 0; j < els.length; j++) { var el = els[j]; if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') continue; if (!el.__w201) attach(el, t); else if (el.__w201node && !el.__w201node.isConnected) { el.__w201 = false; attach(el, t); } }
    }
    /* a holder whose box is gone goes too; a box drawn hidden loses its button until it shows */
    var hs = document.querySelectorAll('.w201h,.w201below,.w201in');
    for (var k = 0; k < hs.length; k++) {
      var h = hs[k], prev = h.previousElementSibling;
      if (!prev || !prev.__w201) h.remove();
      else h.style.display = prev.offsetParent === null ? 'none' : '';
    }
    gone();
  }
  /* a box that goes away (or is hidden) for more than a second and a half stops the listening */
  function gone() {
    if (!REC) return;
    var b = find(REC.key), vis = !!(b && b.offsetParent !== null) || (REC.el.isConnected && REC.el.offsetParent !== null);
    if (vis) REC.goneAt = 0; else if (!REC.goneAt) REC.goneAt = now(); else if (now() - REC.goneAt > 1500) stop(false);
  }
  var queued = false;
  function soon() { if (queued) return; queued = true; (window.requestAnimationFrame || setTimeout)(function () { queued = false; try { scan(); } catch (e) { /* never break a page */ } }); }
  function boot() {
    if (!SRC || !document.body) return;
    css();
    if (!document.getElementById('w201live')) { var lv = document.createElement('div'); lv.id = 'w201live'; lv.className = 'w201sr'; lv.setAttribute('aria-live', 'polite'); document.body.appendChild(lv); }
    try { new MutationObserver(soon).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* fine */ }
    document.addEventListener('focusin', soon, true);
    document.addEventListener('click', soon, true);
    document.addEventListener('toggle', soon, true);
    soon();
  }
  window.w201 = { supported: !!SRC, targets: TARGETS.map(function (t) { return t.sel; }), scan: scan, state: function () { return REC ? { key: REC.key, lang: REC.rec.lang } : null; }, stop: function () { stop(true); }, lang: lang };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
