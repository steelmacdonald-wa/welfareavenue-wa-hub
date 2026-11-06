
  /* ---------- wave290b: the Next serving card for everyone, and Sign up ----------
     Steel (06/11/26): "a sign up button that opens a volunteer form. Or whatever makes it seem less for operations", then: two views.
     Operations Montreal keep wave171's card (confirmations, still waiting, Open the serving) with Sign up beside Open the serving.
     Everyone else on Home sees the friendly card: the date, the time and the place, spots still open (by role), whether they are on it,
     and Sign up. Sign up opens the pop-up: the next servings (the one they came from ticked), Serve or Take photos, Confirm my servings
     (wa290_home_signup, as on the servings card). wave171's nextHtml asks nextView(ev, kicker): null keeps its own view, '' hides the
     card while the facts load (its 2 second check draws it again), anything else is the card. */
  var NX = { data: null, at: 0, loading: null };
  var SH = { open: false, ev: null, data: null, at: 0, pick: {}, role: 'server', busy: false, err: '', done: null, opener: null, loading: false };

  async function loadNext(force) {
    if (!force && NX.data && Date.now() - NX.at < 60000) return NX.data;
    if (NX.loading) return NX.loading;
    NX.loading = (async function () {
      try { var r = await db.rpc('wa290_next_serving'); NX.data = (r && !r.error && r.data) ? r.data : { error: true }; }
      catch (e) { NX.data = { error: true }; }
      NX.at = Date.now(); NX.loading = null;
      return NX.data;
    })();
    return NX.loading;
  }
  function onHomePage() { var h = document.getElementById('mypage'); return !!(h && h.classList.contains('active')); }

  function nextView(ev, kick) {
    if (!ev || !onHomePage() || board() || !staff()) return null;
    addNextCss();
    var n = NX.data;
    if (!n) { loadNext(false); return ''; }
    if (n.error || n.ops) return null;
    var same = n.event && Number(n.event.id) === Number(ev.id), x = same ? n.event : {};
    var meta = (x.start ? hm12(x.start) + ' · ' : '') + (x.location || ev.location || 'Montreal') + (x.partner ? ' · with ' + x.partner : '');
    var h = '<div class="k">' + E(kick || 'Next serving') + '</div>'
      + '<h3>' + E(fmtDay(ev.event_date)) + '</h3>'
      + '<p class="w290meta">' + E(meta) + '</p>';
    if (same && n.spots && Number(n.spots.total) > 0) {
      var open = Number(n.spots.open) || 0, conf = Number(n.confirmed) || 0;
      h += '<p class="w290spots">' + (open > 0 ? '<b>' + open + ' spot' + (open === 1 ? '' : 's') + '</b> still open' : '<b>Every spot is filled</b>') + (conf ? ' · ' + conf + ' confirmed so far' : '') + '</p>';
      var roles = (n.spots.roles || []).slice(0, 4);
      if (roles.length) h += '<p class="w290roles">' + roles.map(function (r) { return E(r.label) + ' ' + Number(r.open); }).join(' · ') + '</p>';
    }
    if (same && n.mine) h += '<p class="w290on">You’re on this one. Thank you!</p>';
    return h + signupBtn(ev.id, false, same && n.mine);
  }
  function signupBtn(evId, alt, mine) {
    if (!onHomePage() || board() || !staff()) return '';
    return '<button type="button" class="go w290su' + (alt ? ' alt' : '') + '" data-w290signup="' + Number(evId) + '">' + (mine ? 'Sign up for another' : 'Sign up') + '</button>';
  }

  /* ---------- the Sign up pop-up ---------- */
  async function sheetLoad(force) {
    if (!force && SH.data && Date.now() - SH.at < 30000) return SH.data;
    SH.loading = true;
    try { var r = await db.rpc('wa191_onb_servings'); if (r && !r.error) SH.data = r.data; else SH.err = /Team members only/.test((r && r.error && r.error.message) || '') ? 'Signing up here is for team members.' : 'The servings could not load. Try again in a moment.'; }
    catch (e) { SH.err = 'The servings could not load. Try again in a moment.'; }
    SH.at = Date.now(); SH.loading = false;
    return SH.data;
  }
  function sheetBody() {
    var x = SH.data, ops = (x && x.ops && x.ops.name) || 'the operations team';
    if (!x) return '<p class="sub">' + E(SH.err || 'Loading the next servings…') + '</p>';
    var yr = x.year || {}, target = Number(yr.target || 4) || 4, done = Math.max(0, Number(yr.done || 0));
    var h = '<p class="sub">Your servings this year: <b>' + done + ' of ' + target + '</b>, October to September.</p>';
    if (SH.done) {
      return h + '<div class="ok" role="status"><b>You’re confirmed for ' + E(SH.done.dates || 'your servings') + '.</b> ' + E(ops) + ' has the dates in the Operations Montreal inbox.</div>'
        + '<div class="ac"><button type="button" class="go" data-w290x="done">Done</button></div>';
    }
    var sv = x.servings || [];
    if (!sv.length) return h + '<p class="sub">No servings are open right now. ' + E(ops) + ' adds the next ones soon.</p>';
    h += '<div class="sl" role="group" aria-label="The next servings">' + sv.map(function (s) { return rowHtml(s, SH.pick, 'data-w290sev'); }).join('') + '</div>';
    if (!sv.some(function (s) { return !(s.mine && s.mine.confirmed); })) return h + '<p class="sub">You’re on every open serving. Thank you!</p>';
    h += '<fieldset class="roles"><legend>What would you like to do?</legend>' + ROLES.map(function (r) {
      var on = SH.role === r[0];
      return '<label class="' + (on ? 'on' : '') + '"><input type="radio" name="w290srole" value="' + r[0] + '"' + (on ? ' checked' : '') + '>' + E(r[1]) + '</label>';
    }).join('') + '</fieldset>';
    if (SH.err) h += '<p class="er" role="alert">' + E(SH.err) + '</p>';
    return h + '<div class="ac"><button type="button" class="go" data-w290sgo="1"' + (SH.busy ? ' disabled' : '') + '>' + (SH.busy ? 'Confirming…' : 'Confirm my servings') + '</button>'
      + '<span class="note">You’re confirmed right away, and ' + E(ops) + ' gets the dates.</span></div>';
  }
  function sheetPaint(focusSel) {
    var el = document.getElementById('w290sheet'); if (!el) return;
    var body = el.querySelector('.bd'); if (!body) return;
    var h = sheetBody(); if (body.__h !== h) { body.innerHTML = h; body.__h = h; }
    if (focusSel) { var f = el.querySelector(focusSel); if (f) { if (!f.matches('button,input')) f.setAttribute('tabindex', '-1'); try { f.focus(); } catch (e) { /* fine */ } } }
  }
  async function sheetOpen(evId, opener) {
    addCss(); addNextCss();
    SH.open = true; SH.ev = Number(evId) || null; SH.pick = {}; SH.role = 'server'; SH.err = ''; SH.busy = false; SH.done = null; SH.opener = opener || null;
    var el = document.getElementById('w290sheet');
    if (!el) { el = document.createElement('div'); el.id = 'w290sheet'; document.body.appendChild(el); }
    el.innerHTML = '<div class="scrim" data-w290x="scrim"></div><div class="box" role="dialog" aria-modal="true" aria-labelledby="w290st">'
      + '<button type="button" class="x" data-w290x="x" aria-label="Close">×</button>'
      + '<div class="k">Volunteer at a serving</div><h2 id="w290st" tabindex="-1">Sign up</h2><div class="bd"></div></div>';
    el.className = 'on';
    try { document.documentElement.classList.add('w290lock'); } catch (e) { /* fine */ }
    sheetPaint();
    try { el.querySelector('h2').focus(); } catch (e) { /* fine */ }
    await sheetLoad(false);
    var x = SH.data;
    if (x && SH.ev && (x.servings || []).some(function (s) { return Number(s.id) === SH.ev && !(s.mine && s.mine.confirmed); })) SH.pick[SH.ev] = true;
    if (SH.open) sheetPaint();
  }
  function sheetClose() {
    var el = document.getElementById('w290sheet');
    if (el) { el.className = ''; el.innerHTML = ''; }
    SH.open = false;
    try { document.documentElement.classList.remove('w290lock'); } catch (e) { /* fine */ }
    var back = SH.opener && document.contains(SH.opener) ? SH.opener : document.querySelector('[data-w290signup="' + SH.ev + '"]');
    if (back) { try { back.focus(); } catch (e) { /* fine */ } }
  }
  async function sheetGo() {
    if (SH.busy) return;
    var ids = Object.keys(SH.pick).filter(function (k) { return SH.pick[k]; }).map(Number);
    if (!ids.length) { SH.err = 'Choose at least one serving.'; sheetPaint('.er'); return; }
    SH.busy = true; SH.err = ''; sheetPaint();
    try {
      var r = await db.rpc('wa290_home_signup', { p_events: ids, p_role: SH.role });
      if (r && r.error) throw r.error;
      SH.done = { dates: (r && r.data && r.data.dates) || '' }; SH.pick = {};
      T('You’re confirmed. Thank you!');
      await Promise.all([sheetLoad(true), loadNext(true), load(true)]);
      place();   /* the servings card counts again */
      var nx = document.getElementById('w171next'); if (nx) nx.remove();   /* wave171's 2 second check draws the Next serving card again */
    } catch (e) {
      SH.err = String((e && e.message) || e || '').replace(/^.*?ERROR:\s*/, '').slice(0, 200) || 'Could not confirm. Try again.';
    }
    SH.busy = false;
    sheetPaint(SH.err ? '.er' : '.ok');
  }
  function trap(e) {
    if (!SH.open) return;
    if (e.key === 'Escape') { e.preventDefault(); sheetClose(); return; }
    if (e.key !== 'Tab') return;
    var box = document.querySelector('#w290sheet .box'); if (!box) return;
    var f = [].slice.call(box.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="-1"]')).filter(function (x) { return x.offsetParent !== null || x === document.activeElement; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  var nextCss = ''
    /* the friendly card inside wave171's #w171next (its own k, h3, p and .go stay) */
    + '#mypage.w272 #w171next .w290meta{color:' + MUTED + ';}'
    + '#mypage.w272 #w171next .w290spots{font-size:14.5px;color:' + INK + ';}#mypage.w272 #w171next .w290spots b{color:' + GREEN + ';font-weight:700;}'
    + '#mypage.w272 #w171next .w290roles{font-size:13px;color:' + MUTED + ';}'
    + '#mypage.w272 #w171next .w290on{font-weight:600;color:' + GREEN + ';}'
    + '#mypage.w272 #w171next .w290su{min-height:44px;padding:0 20px;font-size:15px;color:' + GREEN + ';transition:transform 120ms ' + OUT + ',filter 160ms ease;}'
    + '#mypage.w272 #w171next .w290su:active{transform:scale(.97);}'
    + '#mypage.w272 #w171next .w290su.alt{margin-left:8px;background:' + SURF2 + ';color:' + GREEN + ';min-height:auto;padding:7px 14px;font-size:12.5px;}'
    + '#mypage.w272 #w171next .w290su:focus-visible{outline:2px solid ' + GREEN + ';outline-offset:2px;}'
    /* the pop-up */
    + 'html.w290lock{overflow:hidden;}'
    + '#w290sheet{display:none;}#w290sheet.on{display:block;position:fixed;inset:0;z-index:9400;font-family:' + BODY + ';color:' + INK + ';}'
    + '#w290sheet .scrim{position:absolute;inset:0;background:rgba(16,63,57,.42);animation:w290fade 180ms ' + OUT + ';}'
    + '#w290sheet .box{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;box-sizing:border-box;background:' + CREAM + ';border-radius:22px;padding:22px 22px 18px;box-shadow:0 24px 64px rgba(16,63,57,.28);animation:w290in 200ms ' + OUT + ';font-size:15.5px;line-height:1.45;}'
    + '#w290sheet h2{margin:2px 0 8px;font:500 30px/1 ' + HEAD + ';text-transform:uppercase;letter-spacing:.01em;color:' + GREEN + ';outline:0;}'
    + '#w290sheet .k{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + PURPLE + ';}'
    + '#w290sheet .sub{margin:0 0 8px;color:' + MUTED + ';font-size:14.5px;}#w290sheet .sub b{color:' + GREEN + ';}'
    + '#w290sheet .x{position:absolute;right:12px;top:12px;width:44px;height:44px;border:0;border-radius:50%;background:' + SURF2 + ';color:' + GREEN + ';font:400 24px/1 ' + BODY + ';cursor:pointer;}'
    + '#w290sheet .x:focus-visible{outline:2px solid ' + GREEN + ';outline-offset:2px;}'
    + '@keyframes w290fade{from{opacity:0}to{opacity:1}}@keyframes w290in{from{opacity:0;transform:translate(-50%,-48%) scale(.98)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}'
    + '@media (max-width:700px){#w290sheet .box{left:0;right:0;top:auto;bottom:0;width:100%;transform:none;border-radius:22px 22px 0 0;max-height:88vh;padding:20px 16px calc(16px + env(safe-area-inset-bottom));animation:w290up 220ms ' + OUT + ';}'
    + '@keyframes w290up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}}'
    + '@media (hover:hover) and (pointer:fine){#mypage.w272 #w171next .w290su:hover{filter:brightness(1.06);}#w290sheet .x:hover{background:rgba(16,63,57,.15);}}'
    + '@media (prefers-reduced-motion:reduce){#w290sheet .scrim,#w290sheet .box{animation:none;}#mypage.w272 #w171next .w290su{transition:none;}#mypage.w272 #w171next .w290su:active{transform:none;}}';
  function addNextCss() { if (document.getElementById('w290ncss')) return; var st = document.createElement('style'); st.id = 'w290ncss'; st.textContent = nextCss; document.head.appendChild(st); }
