
  /* ---------- building the journey around wave166's plan, in place, before the page paints ---------- */
  function part(box, key, html) {
    var el = box.querySelector('[data-w167p="' + key + '"]'); if (!el) return;
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  function paintParts(sh, J) {
    var box = sh.querySelector('.w167box'); if (!box) return;
    part(box, 'hero', heroHtml(J));
    part(box, 'road', roadHtml(J));
    part(box, 'wh', weekHeadHtml(J, J.byName[S.wk]));
    part(box, 'sh', (J.byName[S.wk] && J.byName[S.wk].lesson ? 'Then, this week' : 'This week') + '<span style="font-family:inherit;font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;color:' + MUTED + ';margin-left:10px">Tick each step as you go; steps marked Avenue Academy tick themselves.</span>');
    part(box, 'ppl', pplHtml(J));
    part(box, 'num', numHtml());
    part(box, 'dyk', dykHtml());
  }
  function weekNameOf(d) { var s = d.querySelector('summary'); if (!s) return ''; var t = s.firstChild; return String(t && t.nodeType === 3 ? t.textContent : s.textContent).trim(); }
  function applyWeek(sh) {
    var wrap = sh.querySelector('.onbwrap'); if (!wrap) return;
    [].forEach.call(wrap.querySelectorAll('details.w37week'), function (d) {
      var on = weekNameOf(d) === S.wk;
      if (d.classList.contains('w167on') !== on) d.classList.toggle('w167on', on);
      if (on && !d.open) d.open = true;
    });
  }
  function build(sh, wrap) {
    var W = window.w166; if (!W || typeof W.planStates !== 'function') return;
    try { if (typeof W.decoratePlan === 'function') W.decoratePlan(); } catch (e) { /* fine */ }
    var o = planOnb(); if (!o) return;
    var J = journeyOf(o); if (!J || !J.weeks.length) return;
    var main = wrap.closest('.wrap'); if (!main) return;
    wrap.setAttribute('data-w167', '1');
    sh.classList.add('w167');
    main.classList.add('wide'); main.classList.add('w167j');
    if (S.onb !== o.id) { S.onb = o.id; S.wk = null; }
    if (!S.wk || !J.byName[S.wk]) S.wk = curWeek(J);
    var box = document.createElement('div'); box.className = 'w167box';
    box.innerHTML = '<div data-w167p="hero"></div><div data-w167p="road"></div>'
      + '<section class="w167wk"><div class="w167wh" data-w167p="wh"></div><div class="w167steps"><h3 data-w167p="sh"></h3></div></section>'
      + '<section class="w167sec" data-w167p="ppl"></section><section class="w167sec" data-w167p="num"></section><section class="w167sec" data-w167p="dyk"></section>';
    main.insertBefore(box, main.firstChild);
    var steps = box.querySelector('.w167steps'); steps.appendChild(wrap);
    var help = sh.querySelector('#w166help'); if (help) steps.appendChild(help);
    paintParts(sh, J);
    applyWeek(sh);
    try { if (typeof W.syncHead === 'function') W.syncHead(); } catch (e) { /* fine */ }
    /* after a tick the Academy draws the sheet again: keep the place */
    var m = sh.querySelector('.main');
    if (m && S.restore && Date.now() < S.restore.until && S.restore.onb === o.id) m.scrollTop = S.restore.top;
    S.restore = null;
    celebrateCheck(J);
    Promise.all([loadCfg(), loadPeople(), loadStory()]).then(function () { refresh(); });
  }
  function refresh() {
    var sh = document.querySelector('#w122sheet .sh.w167'); if (!sh || !sh.querySelector('.w167box')) return;
    var o = planOnb(); if (!o) return;
    var J = journeyOf(o); if (!J) return;
    if (!J.byName[S.wk]) S.wk = curWeek(J);
    paintParts(sh, J); applyWeek(sh); celebrateCheck(J);
  }
  function sync() {
    var sh = document.querySelector('#w122sheet .sh'); if (!sh) return;
    var wrap = sh.querySelector('.onbwrap');
    if (!wrap) { if (sh.classList.contains('w167')) sh.classList.remove('w167'); return; }
    if (!wrap.getAttribute('data-w167')) { build(sh, wrap); return; }
    applyWeek(sh);
  }
  function select(wk, scroll) {
    var sh = document.querySelector('#w122sheet .sh.w167'); if (!sh) return;
    S.wk = wk; refresh();
    if (scroll) { var sec = sh.querySelector('.w167wk'); if (sec) try { sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e) { /* fine */ } }
  }
  /* Continue: open the week of the next step and show the step (unfolding it when it sits under a bigger step) */
  function continueNext() {
    var sh = document.querySelector('#w122sheet .sh.w167'); if (!sh) return;
    var o = planOnb(), J = o ? journeyOf(o) : null; if (!J || !J.next) return;
    S.wk = J.nextWk; refresh();
    var tid = String(J.next.t.id), row = sh.querySelector('.onbwrap [data-w166t="' + tid.replace(/"/g, '') + '"]');
    if (row && row.style.display === 'none' && J.next.t.parent_id) {
      var tg = sh.querySelector('.onbwrap [data-w57t="' + String(J.next.t.parent_id).replace(/"/g, '') + '"]'); if (tg) tg.click();
    }
    if (!row) return;
    try { row.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); } catch (e) { /* fine */ }
    row.classList.remove('w167flash'); void row.offsetWidth; row.classList.add('w167flash');
  }

  /* ---------- a week finished, or the whole plan ---------- */
  function celebrateCheck(J) {
    if (window.__w169view) return;   /* wave169: nothing is celebrated in a preview */
    var key = String(J.o.id), prev = S.counts[key], now = { __all: J.complete };
    J.weeks.forEach(function (w) { now[w.name] = w.complete; });
    S.counts[key] = now;
    if (!prev) return;
    if (J.complete && !prev.__all) { celebrate('all', J); return; }
    var w = J.weeks.filter(function (x) { return x.complete && prev[x.name] === false; })[0];
    if (w) celebrate(w.name, J);
  }
  function celebrate(kind, J) {
    var sh = document.querySelector('#w122sheet .sh.w167'); if (!sh || sh.querySelector('.w167cel')) return;
    var mark = 'w167cel:' + J.o.id + ':' + kind; if (lsGet(mark)) return; lsSet(mark, '1');
    var idx = -1; J.weeks.forEach(function (w, i) { if (w.name === kind) idx = i; });
    var w = J.byName[kind], nxt = idx >= 0 ? J.weeks.slice(idx + 1).filter(function (x) { return !x.complete; })[0] : null;
    var title = kind === 'all' ? 'You are onboarded!' : lab(kind) + ' done!';
    var text = kind === 'all' ? 'Every step of your plan is done. Thank you for the care you put into it; your lead and HR can see it too.'
      : 'Every step of ' + ((w && w.meta && w.meta.title) || lab(kind)) + ' is done.' + (nxt ? ' Next stop: ' + ((nxt.meta && nxt.meta.title) || lab(nxt.name)) + '.' : '');
    var el = document.createElement('div'); el.className = 'w167cel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
    el.innerHTML = '<canvas></canvas><div class="cd"><img class="fl" src="' + BR.flowers + '" alt=""><img class="e" src="' + BR.e + '" alt=""><h3>' + E(title) + '</h3><p>' + E(text) + '</p><div class="bt">'
      + (nxt ? '<button type="button" class="w167btn" data-w167wk="' + E(nxt.name) + '" data-w167celx="1">Next stop: ' + E((nxt.meta && nxt.meta.title) || lab(nxt.name)) + '</button>' : '')
      + '<button type="button" class="w167btn green" data-w167celx="1">' + (nxt ? 'Stay here' : 'Keep going') + '</button></div></div>';
    sh.appendChild(el);
    confetti(el.querySelector('canvas'));
  }
  function confetti(cv) {
    if (!cv || reduced()) return;
    var ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return;
    var W0 = cv.width = cv.offsetWidth * (window.devicePixelRatio || 1), H0 = cv.height = cv.offsetHeight * (window.devicePixelRatio || 1);
    var cols = [GOLD, PURPLE, CREAM, TEAL, '#B3A8F5'], ps = [];
    for (var i = 0; i < 140; i++) ps.push({ x: W0 / 2 + (Math.random() - 0.5) * W0 * 0.3, y: H0 * 0.42, vx: (Math.random() - 0.5) * W0 * 0.018, vy: -Math.random() * H0 * 0.022 - H0 * 0.006, r: 4 + Math.random() * 7, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, round: Math.random() < 0.35 });
    var t0 = Date.now();
    (function tick() {
      var t = Date.now() - t0; if (t > 3200 || !cv.isConnected) { try { ctx.clearRect(0, 0, W0, H0); } catch (e) { /* fine */ } return; }
      ctx.clearRect(0, 0, W0, H0);
      ps.forEach(function (p) {
        p.vy += H0 * 0.0006; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t / 3200); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, 6.283); ctx.fill(); } else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      });
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var b;
    if ((b = t.closest('[data-w167celx]'))) {
      e.preventDefault(); e.stopPropagation();
      var cel = b.closest('.w167cel'); var wk = b.getAttribute('data-w167wk');
      if (cel) cel.remove();
      if (wk) select(wk, true);
      return;
    }
    if (t.closest('.w167cel') && !t.closest('.cd')) { e.preventDefault(); e.stopPropagation(); t.closest('.w167cel').remove(); return; }
    if ((b = t.closest('[data-w167wk]'))) { e.preventDefault(); e.stopPropagation(); select(b.getAttribute('data-w167wk'), true); return; }
    if ((b = t.closest('[data-w167go]'))) { e.preventDefault(); e.stopPropagation(); continueNext(); return; }
    if ((b = t.closest('[data-w167person]'))) { e.preventDefault(); e.stopPropagation(); location.hash = '#person/' + b.getAttribute('data-w167person'); return; }
    if ((b = t.closest('[data-w167dyk]'))) { e.preventDefault(); e.stopPropagation(); S.storyI = (S.storyI + 1) % Math.max(1, (S.story || []).length); refresh(); return; }
    if ((b = t.closest('[data-w167story]'))) { e.preventDefault(); e.stopPropagation(); location.hash = '#ourstory'; return; }
  }, true);
  /* Escape closes a celebration first (the Academy closes the sheet on Escape) */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var cel = document.querySelector('#w122sheet .w167cel'); if (!cel) return;
    e.preventDefault(); e.stopPropagation(); cel.remove();
  }, true);
  /* a tick in the plan: the Academy draws the sheet again after it; remember where the person was */
  document.addEventListener('change', function (e) {
    var c = e.target; if (!c || !c.getAttribute || !c.getAttribute('data-w37chk')) return;
    var sh = c.closest && c.closest('#w122sheet .sh.w167'); if (!sh) return;
    var m = sh.querySelector('.main'); S.restore = { top: m ? m.scrollTop : 0, until: Date.now() + 5000, onb: S.onb };
  }, true);
  /* wave166 draws the plan again in place after the Academy ticked steps: the journey follows */
  document.addEventListener('w166replan', function () { try { refresh(); } catch (e) { /* fine */ } });
  function watchSheet() {
    var el = document.getElementById('w122sheet'); if (!el) return false;
    if (el.__w167) return true;
    el.__w167 = true;
    try { new MutationObserver(function () { try { sync(); } catch (e) { /* fine */ } }).observe(el, { childList: true, subtree: true }); } catch (e) { /* fine */ }
    sync();
    return true;
  }
  if (!watchSheet()) {
    try { var mo = new MutationObserver(function () { if (watchSheet()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* fine */ }
  }
  loadCfg();

  /* ---------- test hook ---------- */
  /* wave169: HR changed what people see for a week in the master onboarding: read the settings again and redraw */
  function reloadCfg(v) {
    if (v && typeof v === 'object') { S.cfg = v; S.cfgAt = Date.now(); refresh(); return Promise.resolve(S.cfg); }
    S.cfgAt = 0; return loadCfg().then(function () { refresh(); return S.cfg; });
  }
  window.w167 = { state: function () { return S; }, sync: sync, refresh: refresh, select: select, journeyOf: journeyOf, planOnb: planOnb, celebrate: celebrate, cfg: cfg, peopleFor: peopleFor, continueNext: continueNext, reloadCfg: reloadCfg };
})();
