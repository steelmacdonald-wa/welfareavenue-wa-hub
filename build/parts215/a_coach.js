/* =====================================================================
   WA v215 Hands-on walkthroughs: the HR centre, step by step, on the real page (07/10/26)
   =====================================================================
   Steel (07/10/26): "a walkthrough of the entire HR center to be done in the trainings and learning avenue ... really, really
   comprehensive, every step of the way ... one walkthrough is the entire recruitment process and you're helping whoever is
   going through this walkthrough literally click the buttons of a test subject ... put themselves as a test subject in their
   own email so that they get the offer letter ... Same thing with onboarding and for the other sections as well."
   - The coach: a card in the corner and a gold ring around the button or field to use next. Unlike the page tours (wave122),
     nothing is blocked: the learner clicks the real buttons, and the card moves on by itself when the Hub shows it is done
     (a card moved, a call logged, a letter sent). Every step can be skipped, and the card can be folded out of the way.
     Back, Skip, Next, Fold, End; Esc does not end it (the Hub's own panels use Esc). The run survives a page reload
     (localStorage w215run, per browser).
   - Practice: while a walkthrough that makes records runs, what the learner adds is marked practice (hub_candidates.practice,
     wa_timeoff.practice): never sent to Slack, never texted, never on the calendar, and the offer letter goes to their own
     address even while email is in test mode (recruit-actions v3). The last step clears them (wa215_clear_practice), and an
     admin can clear everyone's from Applications.
   - In the Avenue Academy: the Learning Avenue "The HR centre" (academy_paths hrcentre): the lesson How the HR centre works
     and seven walkthroughs (trainings kind tour, key tour:hrwalk-*). The walkthroughs register in wave122's TOURS so the
     Academy lists and opens them; wave122's startTour hands them to this coach. Finishing one completes the training.
   API: window.w215 = { start, end, owns, practice, defs, state, me }. Definitions: parts215/b_walks.js. */
(function () {
  'use strict';
  if (window.w215) return;
  var GREEN = '#103F39', GOLD = '#DCA527', CREAM = '#FFFAF2', INK = '#1F201E', TEAL = '#2A8C7A';
  var DEFS = {};
  var R = null;   /* the run: { key, i, done:{}, ctx:{}, at } */
  var timer = null, okAt = 0, folded = false;

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function me() { try { return { name: (typeof USER !== 'undefined' && USER && USER.name) || '', email: lower(typeof USER !== 'undefined' && USER && USER.email) }; } catch (e) { return { name: '', email: '' }; } }
  function save() { try { if (R) localStorage.setItem('w215run', JSON.stringify(R)); else localStorage.removeItem('w215run'); } catch (e) { /* fine */ } }
  function q(sel) {
    if (!sel) return null;
    if (typeof sel === 'function') { try { return sel(R.ctx) || null; } catch (e) { return null; } }
    var parts = String(sel).split(' || ');
    for (var i = 0; i < parts.length; i++) { var all = document.querySelectorAll(parts[i]); for (var k = 0; k < all.length; k++) if (vis(all[k])) return all[k]; }
    return null;
  }
  function vis(el) { if (!el || !el.isConnected) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function val(v) { return typeof v === 'function' ? v(R.ctx) : v; }

  /* ---------- the card and the ring ---------- */
  function layer() {
    var c = document.getElementById('w215c');
    if (!c) {
      c = document.createElement('div'); c.id = 'w215c'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-live', 'polite'); c.setAttribute('aria-label', 'Walkthrough');
      document.body.appendChild(c);
      var r = document.createElement('div'); r.id = 'w215r'; r.setAttribute('aria-hidden', 'true'); document.body.appendChild(r);
    }
    return c;
  }
  function paint() {
    if (!R) return;
    var d = DEFS[R.key], st = d.steps[R.i]; if (!st) return;
    var n = d.steps.length, isDone = !!R.done[R.i];
    var c = layer();
    c.className = (folded ? 'fold' : '') + (isDone ? ' ok' : '');
    var body = val(st.p) || '';
    var extra = '';
    if (st.copy) { var cp = val(st.copy); if (cp && cp.text) extra += '<div class="w215cp"><span>' + E(cp.label || 'Copy') + '</span><code>' + E(cp.text) + '</code><button type="button" data-w215a="copy">Copy</button></div>'; }
    if (st.fill) extra += '<button type="button" class="w215b soft" data-w215a="fill">' + E(val(st.fillLabel) || 'Fill it in for me') + '</button>';
    if (st.act) extra += '<button type="button" class="w215b" data-w215a="act">' + E(val(st.actLabel) || 'Do it') + '</button>';
    var wait = st.done ? (isDone ? '<p class="w215st ok">' + (R.hold === R.i ? 'Done.' : 'Done. Moving on…') + '</p>' : '<p class="w215st">' + E(val(st.waitText) || 'Waiting for you to do it on the page…') + '</p>') : '';
    c.innerHTML = '<div class="w215h"><span class="w215k">' + E(d.title) + '</span><span class="w215n">' + (R.i + 1) + ' of ' + n + '</span>' +
      '<button type="button" data-w215a="fold" title="' + (folded ? 'Open the card' : 'Fold the card out of the way') + '" aria-label="' + (folded ? 'Open the card' : 'Fold the card') + '">' + (folded ? '▴' : '▾') + '</button>' +
      '<button type="button" data-w215a="end" title="End the walkthrough" aria-label="End the walkthrough">×</button></div>' +
      '<div class="w215bar"><i style="width:' + Math.round(100 * (R.i + (isDone ? 1 : 0)) / n) + '%"></i></div>' +
      (folded ? '<p class="w215ft">' + E(st.t) + '</p>' :
        '<h4>' + E(st.t) + '</h4><div class="w215p">' + body + '</div>' + extra + wait +
        '<div class="w215f">' + (R.i > 0 ? '<button type="button" class="w215b soft" data-w215a="back">Back</button>' : '') + '<span class="sp"></span>' +
        (st.done && !isDone ? '<button type="button" class="w215b link" data-w215a="skip">Skip this step</button>' : '') +
        (!st.done || isDone ? '<button type="button" class="w215b" data-w215a="next">' + (R.i >= n - 1 ? 'Finish' : 'Next') + '</button>' : '') + '</div>');
    ring();
  }
  function ring() {
    var r = document.getElementById('w215r'); if (!r || !R) return;
    var st = DEFS[R.key].steps[R.i], el = st && !folded ? q(st.s) : null;
    if (!el || R.done[R.i]) { r.style.display = 'none'; return; }
    var b = el.getBoundingClientRect(), pad = 6;
    r.style.display = 'block';
    r.style.left = Math.round(b.left - pad) + 'px'; r.style.top = Math.round(b.top - pad) + 'px';
    r.style.width = Math.round(b.width + pad * 2) + 'px'; r.style.height = Math.round(b.height + pad * 2) + 'px';
  }
  function scrollTo(st) {
    var el = q(st.s); if (!el) return;
    var b = el.getBoundingClientRect();
    if (b.top < 70 || b.bottom > innerHeight - 40) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* fine */ } }
  }

  /* ---------- moving through ---------- */
  async function show(i) {
    if (!R) return;
    var d = DEFS[R.key];
    if (i >= d.steps.length) return finish();
    if (i < 0) i = 0;
    R.i = i; okAt = 0; save();
    var st = d.steps[i];
    if (st.hash) { var h = val(st.hash); if (h && location.hash !== h) { location.hash = h; await wait(900); } }
    if (st.go) { try { await st.go(R.ctx); } catch (e) { /* the step still shows */ } await wait(500); }
    if (st.skipIf) { var sk = false; try { sk = !!st.skipIf(R.ctx); } catch (e) { sk = false; } if (sk) return show(i + 1); }
    folded = false;
    paint();
    setTimeout(function () { if (R && R.i === i) scrollTo(st); }, 250);
  }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function tick() {
    if (!R) return;
    var st = DEFS[R.key].steps[R.i]; if (!st) return;
    ring();
    if (st.done && !R.done[R.i]) {
      var ok = false; try { ok = !!st.done(R.ctx); } catch (e) { ok = false; }
      if (ok) { R.done[R.i] = 1; okAt = performance.now(); save(); paint(); }
    } else if (st.done && R.done[R.i]) {
      if (R.hold === R.i) return;   /* came back with Back: stay until Next */
      if (!okAt) okAt = performance.now();   /* done before (a reload): move on after a beat */
      else if (performance.now() - okAt > 1100) { okAt = 0; show(R.i + 1); }
    }
  }
  function start(key) {
    var d = DEFS[key]; if (!d) { toastS('That walkthrough is not available'); return; }
    if (d.avail && !d.avail()) { toastS('That walkthrough is for the HR team'); return; }
    end(true);
    R = { key: key, i: 0, done: {}, ctx: { started: new Date().toISOString() }, at: Date.now() };
    try { if (d.init) d.init(R.ctx); } catch (e) { /* fine */ }
    if (!timer) timer = setInterval(tick, 400);
    show(0);
  }
  function end(silent) {
    var c = document.getElementById('w215c'), r = document.getElementById('w215r');
    if (c) c.remove(); if (r) r.remove();
    var was = R; R = null; save();
    if (timer) { clearInterval(timer); timer = null; }
    if (was && !silent) {
      var d = DEFS[was.key];
      toastS(d && d.practice ? 'Walkthrough ended. Your practice records stay until you clear them (the last step of the walkthrough, or Clear practice on Applications).' : 'Walkthrough ended. Pick it up again from the Avenue Academy.');
    }
  }
  async function finish() {
    var key = R && R.key; end(true);
    var tr = null; try { tr = window.w122 && w122.A && w122.A.byKey ? w122.A.byKey['tour:' + key] : null; } catch (e) { tr = null; }
    if (tr && window.w122 && w122.complete) { try { await w122.complete(tr, { last_step: DEFS[key].steps.length }); return; } catch (e) { /* fine */ } }
    toastS('Walkthrough complete');
  }

  document.addEventListener('click', async function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#w215c [data-w215a]') : null; if (!t || !R) return;
    var a = t.getAttribute('data-w215a'), st = DEFS[R.key].steps[R.i];
    if (a === 'end') { if (window.confirm('End this walkthrough? You can start it again from the Avenue Academy.')) end(false); return; }
    if (a === 'fold') { folded = !folded; paint(); return; }
    if (a === 'back') { R.hold = R.i - 1; show(R.i - 1); return; }
    if (a === 'next' || a === 'skip') { show(R.i + 1); return; }
    if (a === 'copy') { var cp = val(st.copy); try { await navigator.clipboard.writeText(cp.text); toastS('Copied'); } catch (x) { toastS('Select the text and copy it'); } return; }
    if (a === 'fill' && st.fill) { try { await st.fill(R.ctx); } catch (x) { toastS(String((x && x.message) || x)); } return; }
    if (a === 'act' && st.act) { t.disabled = true; try { await st.act(R.ctx); } catch (x) { toastS(String((x && x.message) || x)); } t.disabled = false; return; }
  });
  window.addEventListener('scroll', function () { if (R) ring(); }, { passive: true });
  window.addEventListener('resize', function () { if (R) ring(); });

  /* a run in progress picks up again after a reload (once the page has drawn) */
  setTimeout(function () {
    if (R) return;   /* a walkthrough already started */
    var saved = null; try { saved = JSON.parse(localStorage.getItem('w215run') || 'null'); } catch (e) { saved = null; }
    if (!saved || !DEFS[saved.key] || Date.now() - (saved.at || 0) > 6 * 3600000) { try { localStorage.removeItem('w215run'); } catch (e) { /* fine */ } return; }
    R = saved; R.ctx = R.ctx || {}; if (!timer) timer = setInterval(tick, 400); show(R.i);
  }, 3500);

  var css = document.createElement('style'); css.id = 'w215css';
  css.textContent =
    '#w215c{position:fixed;left:16px;bottom:16px;z-index:9700;width:min(380px,calc(100vw - 32px));max-height:min(72vh,560px);overflow:auto;background:' + CREAM + ';color:' + INK + ';border:2px solid ' + GREEN + ';border-radius:18px;box-shadow:0 24px 60px -18px rgba(16,63,57,.6);padding:12px 14px 14px;font-family:inherit;box-sizing:border-box;}' +
    '#w215c.ok{border-color:' + TEAL + ';}#w215c.fold{max-height:none;padding-bottom:10px;}' +
    '#w215c .w215h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:' + GREEN + ';}#w215c .w215k{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}#w215c .w215n{color:#5b6b67;font-weight:600;}' +
    '#w215c .w215h button{border:1px solid rgba(16,63,57,.25);background:transparent;color:' + GREEN + ';width:28px;height:28px;border-radius:999px;cursor:pointer;font-size:15px;line-height:1;}' +
    '#w215c .w215bar{height:5px;border-radius:999px;background:rgba(16,63,57,.1);margin:8px 0 10px;overflow:hidden;}#w215c .w215bar i{display:block;height:100%;background:' + GOLD + ';transition:width .3s;}' +
    '#w215c h4{margin:0 0 6px;font-size:17px;color:' + GREEN + ';}#w215c .w215p{font-size:14px;line-height:1.5;}#w215c .w215p p{margin:0 0 8px;}#w215c .w215p ul,#w215c .w215p ol{margin:4px 0 8px;padding-left:20px;}#w215c .w215p li{margin:3px 0;}' +
    '#w215c .w215p b{color:' + GREEN + ';}#w215c .w215ft{margin:0;font-size:14px;font-weight:600;}' +
    '#w215c .w215st{font-size:13px;margin:8px 0 0;padding:7px 10px;border-radius:10px;background:rgba(220,165,39,.18);color:#5c4408;}#w215c .w215st.ok{background:rgba(42,140,122,.16);color:#1d6b5d;}' +
    '#w215c .w215cp{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0;padding:8px;border-radius:10px;background:rgba(16,63,57,.06);font-size:12.5px;}#w215c .w215cp code{flex:1 1 100%;overflow-wrap:anywhere;font-size:12px;}#w215c .w215cp button{border:none;background:' + GREEN + ';color:' + CREAM + ';border-radius:999px;padding:4px 10px;cursor:pointer;font-size:12px;}' +
    '#w215c .w215f{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap;}#w215c .sp{flex:1;}' +
    '.w215b{border:none;border-radius:999px;padding:8px 14px;background:' + GREEN + ';color:' + CREAM + ';font:inherit;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;}.w215b.soft{background:rgba(16,63,57,.1);color:' + GREEN + ';}.w215b.link{background:none;color:' + GREEN + ';text-decoration:underline;padding:8px 4px;font-weight:600;}' +
    '#w215r{position:fixed;z-index:9690;pointer-events:none;border:3px solid ' + GOLD + ';border-radius:12px;box-shadow:0 0 0 4px rgba(220,165,39,.28);display:none;animation:w215p 1.6s ease-in-out infinite;}' +
    '@keyframes w215p{0%,100%{box-shadow:0 0 0 4px rgba(220,165,39,.28);}50%{box-shadow:0 0 0 10px rgba(220,165,39,.08);}}' +
    '@media (prefers-reduced-motion: reduce){#w215r{animation:none;}}' +
    '@media (max-width:600px){#w215c{left:8px;right:8px;bottom:8px;width:auto;max-height:46vh;}}' +
    '.w215prac{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:' + GOLD + ';color:' + GREEN + ';border-radius:999px;padding:1px 7px;margin:2px 4px 0 0;}';
  (document.head || document.documentElement).appendChild(css);

  window.w215 = {
    start: start, end: end, defs: DEFS, me: me, q: q,
    owns: function (key) { return !!DEFS[key]; },
    practice: function () { return !!(R && DEFS[R.key] && DEFS[R.key].practice); },
    state: function () { return R; },
    add: function (key, d) { DEFS[key] = d; }
  };
})();
