/* ---------- wave285 d_home.js: the manager's Home (one card per hire), the Team profile, the Applications hint, the walkthroughs ---------- */
(function () {
  var W = window.w285; if (!W || W.__home) return; W.__home = true;
  var h = W.h, E = h.E, first = h.first, fmtDay = h.fmtDay;

  /* ---------- Home: "Your new hires", one card each, in place of the lead's card (#w166lead) and wave275's list (#o275mine) ---------- */
  function onHome() { var x = String(location.hash || ''); return !x || x === '#' || /^#mypage(\/|$)/.test(x); }
  var STAGE = { offer: 'Offer out', accepted: 'Accepted', starting: 'Starting', weeks: 'Weeks 1 to 4', later: '60 and 90 days' };
  function weekSteps(P) {
    var L = P.lead, soon = h.addDays(h.today(), 7);
    return ((L && L.lead_steps) || []).filter(function (s) { return s && !s.done && (!s.due || String(s.due) <= soon); });
  }
  function cardHtml(P) {
    var g = P.prog || {}, t0 = h.today(), wk = weekSteps(P), me = h.meMember(), mine = !!(me && P.mgr && String(P.mgr.id) === String(me.id));
    var act = '';
    if (P.turn.who === 'mgr' && (mine || h.isHr()) && P.flow) act = '<button type="button" class="w285b pri" data-w285open="' + E(P.key) + '" data-ctx="home" data-tab="ov">' + (/book/i.test(P.turn.t) ? 'Book the times' : 'Propose times') + '</button>';
    return '<div class="w285hc" data-w285hkey="' + E(P.key) + '"><div class="top"><div><b>' + E(P.name) + (P.practice ? '<span class="w285tag">Practice</span>' : '') + '</b><small>' + E([P.role, STAGE[P.stage]].filter(Boolean).join(' · ')) + '</small></div>'
      + '<button type="button" class="w285b" data-w285open="' + E(P.key) + '" data-ctx="home" aria-label="Open ' + E(P.name) + '">Open</button></div>'
      + '<div class="w285turn' + (P.turn.cls ? ' ' + P.turn.cls : '') + '">' + E(P.turn.t) + '</div>'
      + '<div class="w285prog" style="max-width:320px">' + (g.pct != null ? '<div class="w285bar"><i style="width:' + Math.max(0, Math.min(100, g.pct)) + '%"></i></div>' : '') + '<div class="w285pct">' + E(g.label || '') + '</div></div>'
      + helpHtml(P)
      + (wk.length || act ? '<div class="wk"><div class="w285lbl">This week, for you</div>' + wk.map(function (s) {
          var late = s.due && String(s.due) < t0;
          return '<label><input type="checkbox" data-w166tick="' + E(s.id) + '"><span>' + E(s.name) + (s.due ? '<em class="' + (late ? 'late' : '') + '">' + (late ? 'was due ' : 'by ') + E(fmtDay(s.due)) + '</em>' : '') + '</span></label>';
        }).join('') + (act ? '<div style="margin-top:6px">' + act + '</div>' : '') + '</div>' : '')
      + '</div>';
  }
  /* a hire asking for help: on their card, with wave166's own Dealt with (onboarding_help_resolve) */
  function helpHtml(P) {
    var L = (P.lead && P.lead.help) || [];
    if (!L.length && P.onb && W.helpOf) L = W.helpOf(P.onb.id);
    return L.map(function (q) {
      return '<div class="w285it" style="padding:8px 0;border:0"><i class="w285dot r"></i><p><b>Asked for help</b>' + (q.step ? ' with ' + E(q.step) : '') + (q.note ? ': “' + E(q.note) + '”' : '.') + (q.at ? '<span class="w285sub">' + E(fmtDay(q.at)) + '</span>' : '') + '</p>'
        + '<span class="w285acts"><button type="button" class="w285b" data-w166resolve="' + E(q.id) + '">Dealt with</button></span></div>';
    }).join('');
  }
  var HP = { t: null, busy: false };
  function paintHome() {
    var body = document.getElementById('mpBody'), el = document.getElementById('w285home');
    if (!body || !onHome()) { if (el) el.remove(); return; }
    var c = W.collect('home'), ppl = c.people;
    if (!ppl.length) { if (el) el.remove(); body.classList.remove('w285on'); return; }
    if (!el) { el = document.createElement('div'); el.id = 'w285home'; el.className = 'mp-sec'; body.insertBefore(el, body.firstChild); }
    var html = '<h3>' + (ppl.length === 1 ? 'Your new hire' : 'Your new hires (' + ppl.length + ')') + '</h3><p>Whose turn it is, what this week needs from you, and Open for the whole picture.</p>' + ppl.map(cardHtml).join('');
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
    if (!body.classList.contains('w285on')) body.classList.add('w285on');
    /* wave275 can draw a card into its hidden list outside its painter: the open panel's card stays the only copy */
    try { W.stripOpen(); } catch (e) { /* fine */ }
  }
  function paintHomeSoon() { clearTimeout(HP.t); HP.t = setTimeout(function () { try { paintHome(); } catch (e) { /* the next one */ } }, 60); }
  W.paintHome = paintHome; W.paintHomeSoon = paintHomeSoon;
  /* a tick on the card: wave166 saves it and disables the box; whatever it answers, the card is drawn again from the lead's card afterwards, so a
     box is never left disabled after a refused save */
  document.addEventListener('change', function (e) {
    var c = e.target; if (!c || !c.closest || !c.closest('#w285home') || !c.getAttribute('data-w166tick')) return;
    [1500, 4000].forEach(function (ms) { setTimeout(function () { var el = document.getElementById('w285home'); if (el) el.__h = ''; paintHome(); }, ms); });
  });
  function watchHome() {
    var body = document.getElementById('mpBody'); if (!body || body.__w285mo) return; body.__w285mo = true;
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) { var t = list[i].target; if (t && t.closest && t.closest('#w285home')) continue; try { W.stripOpen(); } catch (e) { /* fine */ } paintHomeSoon(); return; }
    }).observe(body, { childList: true, subtree: true });
  }
  if (typeof renderMyPage === 'function') {
    var __rm285 = renderMyPage;
    renderMyPage = async function () {
      var r = await __rm285.apply(this, arguments);
      try {
        watchHome(); paintHome(); var L = window.w166; if (L && L.load) Promise.resolve(L.load(false)).then(paintHomeSoon, paintHomeSoon);
        /* the plans themselves (every staff member reads them), so the manager's figure is the rule's, the same as HR's */
        if (typeof wa37Load === 'function' && !(typeof WA37 !== 'undefined' && WA37.loaded)) Promise.resolve(wa37Load(false)).then(paintHomeSoon, paintHomeSoon);
      } catch (e) { /* non-fatal */ }
      return r;
    };
  }
  window.addEventListener('hashchange', function () { setTimeout(function () { try { watchHome(); paintHome(); } catch (e) { /* fine */ } }, 200); });

  /* ---------- the Team profile: the plan's figure with Open, or Start an onboarding plan (HR) ---------- */
  var PROF = { mid: null };
  function profHost() {
    /* wave116k's profile: the bar's own slot (#w116konb); before it is built, wave33's card (wave116k lifts the bar from there) */
    var slot = document.getElementById('w116konb'); if (slot) return slot;
    var sec = document.getElementById('personpage'); return sec ? sec.querySelector('.card') : null;
  }
  function paintProfile() {
    var mid = PROF.mid; if (mid == null) return;
    var m0 = /^#person\/([^/?]+)/.exec(String(location.hash || '')); if (m0 && String(m0[1]) !== String(mid)) return;
    var host = profHost(); if (!host) return;
    var old = document.querySelector('#w116konb .w285pbar') || host.querySelector('.w285pbar'), Wd = h.W37();
    var o = (Wd.onbs || []).filter(function (x) { return String(x.member_id) === String(mid) && x.status === 'active'; })[0]
      || (Wd.onbs || []).filter(function (x) { return String(x.member_id) === String(mid) && x.status === 'completed'; })[0] || null;
    var m = h.memberById(mid), name = (m && m.name) || (o && o.person_name) || '';
    var html = '';
    if (o) {
      var p = W.plan(o.id), done = o.status === 'completed';
      html = '<span style="font-weight:700;color:#103F39;white-space:nowrap">Onboarding' + (done ? ': complete' : '') + '</span>'
        + (p && p.total ? '<span class="w285bar"><i style="width:' + p.pct + '%"></i></span><span style="color:rgba(16,63,57,.64);white-space:nowrap">' + p.done + ' of ' + p.total + ' steps</span>' : '<span style="color:rgba(16,63,57,.64)">No plan steps yet</span>')
        + (h.isHr() ? '<button type="button" class="w285b" data-w285open="' + E(done ? 'done' + o.id : 'm' + mid) + '" data-ctx="hr" data-tab="pl">Open</button>' : '');
    } else if (h.isHr() && W.openPlanOf && W.openPlanOf(mid)) {
      html = '<span style="color:rgba(16,63,57,.64)">They already have an onboarding plan (' + E(W.openPlanOf(mid).status) + '), so a second one cannot be started here.</span>';
    } else if (h.isHr()) {
      var ask = W.askStart && W.askStart[mid], busy = W.panel && W.panel().asked && W.panel().asked[mid];
      html = ask ? '<span>Start ' + E(first(name) ? first(name) + '\'s' : 'their') + ' plan today? Every step of the Plan template is copied in with its due date.</span><button type="button" class="w285b pri" data-w285start="' + E(mid) + '" data-go="1" data-name="' + E(name) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Starting...' : 'Start it today') + '</button><button type="button" class="w285b" data-w285start="' + E(mid) + '" data-go="0">Cancel</button>'
        : '<span style="color:rgba(16,63,57,.64)">No onboarding plan.</span><button type="button" class="w285b" data-w285start="' + E(mid) + '" data-name="' + E(name) + '">Start an onboarding plan</button>';
    }
    if (!html) { if (old) old.remove(); return; }
    var bar = old || document.createElement('div'); bar.className = 'w285pbar w37profbar';
    if (bar.__h !== html) { bar.innerHTML = html; bar.__h = html; }
    if (!old) {
      if (host.id === 'w116konb') host.appendChild(bar);
      else { var stats = host.querySelector('#w33stats'); if (stats) stats.insertAdjacentElement('afterend', bar); else host.insertBefore(bar, host.firstChild); }
    }
  }
  W.paintProfile = paintProfile;
  if (typeof wa37Profile === 'function') {
    wa37Profile = async function (mid) {
      PROF.mid = mid;
      try { if (typeof wa37Load === 'function') await wa37Load(false); paintProfile(); } catch (e) { /* non-fatal */ }
      /* wave116k builds the profile around wave33's (its slot comes a moment later), and who is HR can be known only after the first paint */
      [700, 2000, 4500].forEach(function (ms) { setTimeout(function () { try { paintProfile(); } catch (e) { /* fine */ } }, ms); });
    };
  }

  /* ---------- Applications: "Onboarding starts when they accept", with a link to their row ---------- */
  var NEXT = { offer: 'Onboarding starts when they accept: the Hub makes their accounts and asks their manager for times.', hired: 'Onboarding starts when they accept. Their row is on Onboarding.' };
  function patchSheet() {
    var s = document.getElementById('w197sheet'); if (!s || !s.classList.contains('open')) return;
    var nx = s.querySelector('.next'); if (!nx || nx.getAttribute('data-w285') === '1') return;
    var st = null; try { st = window.w197.state(); } catch (e) { st = null; }
    var c = st && st.cands ? st.cands.filter(function (x) { return String(x.id) === String(st.open); })[0] : null;
    if (!c || !NEXT[c.status]) return;
    nx.setAttribute('data-w285', '1');
    nx.innerHTML = '<b>Next:</b> ' + E(NEXT[c.status]) + ' <button type="button" class="w197b sm pri" data-w197go="onboarding" data-w285cand="' + E(c.id) + '">See their onboarding</button>';
  }
  function hookSheet() {
    var s = document.getElementById('w197sheet'); if (!s || s.__w285) return;
    s.__w285 = true; new MutationObserver(patchSheet).observe(s, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    patchSheet();
  }
  document.addEventListener('click', function (e) {
    setTimeout(hookSheet, 0);
    var b = e.target && e.target.closest && e.target.closest('[data-w285cand]'); if (!b) return;
    var cid = b.getAttribute('data-w285cand'), name = '';
    try { var c = window.w197.state().cands.filter(function (x) { return String(x.id) === String(cid); })[0]; name = c ? c.name : ''; } catch (x) { name = ''; }
    /* wave197 opens Onboarding (data-w197go); then the row is found by its name and opened */
    var tries = 0;
    (function find() {
      var key = null;
      try { var L = W.collect('hr').people; var P = L.filter(function (p) { return (p.cand && String(p.cand.id) === String(cid)) || (p.flow && String(p.flow.candidate_id) === String(cid)) || (name && h.lower(h.plain(p.name)) === h.lower(h.plain(name))); })[0]; key = P ? P.key : null; } catch (x) { key = null; }
      var pg = document.getElementById('hrcentre');
      if (key && pg && pg.getAttribute('data-w197') === 'onboarding' && tries > 1) { var row = document.querySelector('#w285 [data-w285key="' + key.replace(/"/g, '') + '"]'); if (row && row.offsetParent) { try { row.scrollIntoView({ block: 'center' }); } catch (x) { /* fine */ } W.open(key, 'ov', 'hr', row.querySelector('[data-w285open]')); return; } }
      if (++tries < 20) setTimeout(find, 300);
    })();
  });
  if (window.w197 && typeof window.w197.openSheet === 'function' && !window.w197.openSheet.__w285) {
    var __os = window.w197.openSheet;
    window.w197.openSheet = function () { var out = __os.apply(this, arguments); try { hookSheet(); patchSheet(); } catch (e) { /* fine */ } return out; };
    window.w197.openSheet.__w285 = true;
  }

  /* ---------- the walkthroughs and the HR Centre tour point at what is there now ---------- */
  function walks() {
    var w = window.w215; if (!w || !w.defs) return false;
    var D = w.defs, P = function () { return [].slice.call(arguments).map(function (x) { return x.charAt(0) === '<' ? x : '<p>' + x + '</p>'; }).join(''); };
    var L = function (items) { return '<ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; };
    var hr = function () { return h.isHr(); };
    if (D['hrwalk-onboard'] && !D['hrwalk-onboard'].__w285) {
      w.add('hrwalk-onboard', { title: 'HR Centre: onboarding a new person', avail: hr, __w285: true,
        init: function (x) { x.base = (h.W37().onbs || []).map(function (o) { return o.id; }); },
        steps: [
          { t: 'From offer to full member', p: P('Onboarding starts when someone accepts an offer: the Hub makes their accounts, asks the manager for times, and makes the plan when the times are booked. This page follows each person from the offer to the end of their plan.', 'About 3 minutes, look only.') },
          { hash: '#hrcentre/onboarding', s: '#w285 .w285sec', t: 'Needs you', p: P('Only what waits on you or on HR: a step that failed (with Retry), a task the Hub cannot do (a Slack channel), a hire waiting on their manager, someone behind by more than a week. Each line has one button. When nothing waits, it says so.') },
          { s: '#w285 .w285sec + .w285sec || #w285', t: 'Everyone, by stage', p: P('One row per person under Offer out, Accepted, Starting, Weeks 1 to 4, and 60 and 90 days: their manager, whose turn it is in words, and one progress figure for their stage. Finished plans are counted under the list.') },
          { s: '#w285 [data-w285open] || #w285', t: 'Open', p: P('<b>Open</b> shows the person on their own: Overview (their timeline and the actions: Change time, Change manager, Book the 1-on-1, Edit the welcome email, They backed out), Setup (the Hub’s twelve steps, the ones for HR open), Plan (by section, with the role trainings) and Academy (their trainings).', 'Open one if you like, then press Next.') },
          { t: 'Onboarding, in short', p: L(['It starts when they accept: there is nothing to assign.', 'Needs you is the to-do list; Everyone is the picture.', 'Progress counts real steps only: a group of steps is done when everything in it is done, and Academy trainings count.', 'Someone who joined without recruitment gets a plan from their <b>Team profile</b>: Start an onboarding plan.', 'The <b>Plan template</b> page is where the plan everyone starts from is edited; <b>Onboarding insights</b> has the quizzes and what new members said.']) }
        ] });
    }
    var st = D['hrwalk-start'];
    if (st && !st.__w285) { st.__w285 = true; (st.steps || []).forEach(function (s) { if (typeof s.p === 'string') s.p = s.p.replace('Onboarding, Onboarding plan, Training', 'Onboarding, Plan template, Onboarding insights, Training').replace('Training and the onboarding plan', 'Training and the Plan template'); }); if (st.title) st.title = st.title.replace('HR centre', 'HR Centre'); }
    var rc = D['hrwalk-recruit'];
    if (rc && !rc.__w285) { rc.__w285 = true; (rc.steps || []).forEach(function (s) { if (s.t === 'Next: onboarding') s.p = P('At Hired, the card says onboarding starts when they accept, with <b>See their onboarding</b>: their row on the Onboarding page, where the Hub’s steps and their plan follow on their own.'); }); }
    var tr = D['hrwalk-training'];
    if (tr && !tr.__w285) { tr.__w285 = true; (tr.steps || []).forEach(function (s) { if (s.t === 'The onboarding plan') { s.t = 'The Plan template'; if (typeof s.p === 'string') s.p = s.p.replace('The <b>master onboarding</b>', 'The <b>Plan template</b>'); } if (s.t === 'Training and the master onboarding') s.t = 'Training and the Plan template'; }); if (tr.title) tr.title = 'HR Centre: training and the Plan template'; }
    return true;
  }
  function tour() {
    try {
      var TT = window.w122 && window.w122.tours, T = TT && TT.hrcentre; if (!T || !T.steps || T.__w285) return false;
      T.steps.forEach(function (s) { if (typeof s.p === 'string') s.p = s.p.replace('Growth (Onboarding, Onboarding plan, Training)', 'Growth (Onboarding, Plan template, Onboarding insights, Training)'); });
      if (T.__w197) T.__w285 = true;
      return !!T.__w285;
    } catch (e) { return false; }
  }
  [0, 1600, 5200, 9000].forEach(function (ms) { setTimeout(function () { try { walks(); tour(); } catch (e) { /* fine */ } }, ms); });
})();
