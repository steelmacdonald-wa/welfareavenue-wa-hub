/* ---------- wave285 b_page.js: HR Centre > Onboarding (Needs you, Everyone by stage), the sub-pages Plan template and Onboarding insights ---------- */
(function () {
  var W = window.w285; if (!W || W.__page) return; W.__page = true;
  var h = W.h, E = h.E, plural = h.plural, first = h.first, fmtDay = h.fmtDay;
  var ST = { seeDone: false, seeBacked: false, open: {}, html: {} };
  var STAGES = [['offer', 'Offer out'], ['accepted', 'Accepted'], ['starting', 'Starting'], ['weeks', 'Weeks 1 to 4'], ['later', '60 and 90 days']];
  var TASK = { slack: ['create their Slack onboarding channel', 'create their Slack onboarding channels'], google: ['make their Google account', 'make their Google accounts'],
    hub: ['invite them to the Hub', 'invite them to the Hub'], welcome: ['send the welcome email', 'send the welcome emails'], meeting: ['add them to their weekly meeting', 'add them to their weekly meetings'],
    channel: ['add them to their Slack onboarding channel', 'add them to their Slack onboarding channels'], invites: ['send the calendar invites', 'send the calendar invites'] };

  /* ---------- the sub-pages: names and the new Onboarding insights (wave197's page list, read live by its rail and router) ---------- */
  function pages() {
    var P = window.w197 && window.w197.pages; if (!P || P.__w285) return;
    P.__w285 = true;
    P.forEach(function (p) {
      if (p.k === 'onboarding') p.d = 'From offer to full member, one row per person.';
      if (p.k === 'plan') { p.l = 'Plan template'; p.d = 'The plan everyone starts from: every week and step a new person gets. Changes reach everyone still onboarding.'; }
    });
    var at = 0; P.forEach(function (p, i) { if (p.k === 'plan') at = i + 1; });
    if (!P.some(function (p) { return p.k === 'insights'; })) P.splice(at || P.length, 0, { k: 'insights', l: 'Onboarding insights', ic: 'chart', g: 'Growth', tab: 'onboarding', d: 'The onboarding quizzes, and what new members said about their onboarding.' });
  }
  pages();

  /* ---------- where it sits ---------- */
  function pageNow() { var p = document.getElementById('hrcentre'); return p ? p.getAttribute('data-w197') || '' : ''; }
  function onHrc() { var p = document.getElementById('hrcentre'); return !!p && p.classList.contains('active') && String(location.hash || '').indexOf('#hrcentre') === 0; }
  var MINE = [['w285', 'onboarding'], ['w285set', 'plan'], ['w285ins', 'insights']];
  function ensure() {
    var body = document.getElementById('w46body'); if (!body || !h.isHr()) return false;
    var before = body.firstChild;
    MINE.forEach(function (m, i) {
      var el = document.getElementById(m[0]);
      if (!el) { el = document.createElement('div'); el.id = m[0]; el.className = 'w197blk'; el.setAttribute('data-w197s', m[1]); if (ST.html[m[0]]) el.innerHTML = ST.html[m[0]]; }
      var want = i === 0 ? body.firstChild : document.getElementById(MINE[i - 1][0]).nextSibling;
      if (el.parentNode !== body || (i === 0 ? body.firstChild !== el : el.previousSibling !== document.getElementById(MINE[i - 1][0]))) body.insertBefore(el, want);
      if (pageNow() === m[1] && !el.classList.contains('w197on')) el.classList.add('w197on');
    });
    return before !== body.firstChild;
  }
  function set(id, html) { var el = document.getElementById(id); if (!el) return; if (ST.html[id] !== html || el.innerHTML === '') { ST.html[id] = html; el.innerHTML = html; } }

  /* ---------- 1. Needs you ---------- */
  function needs(c) {
    var out = [], O = h.O(), S = h.S() || {}, R = h.R();
    var hrTools = !R || typeof R.hrTools !== 'function' || R.hrTools();
    /* an admin item: the first password, when it is not set (never its value) */
    if (h.isAdmin() && S.pw && !S.pw.set) {
      out.push({ red: false, html: '<p><b>Set the first password.</b><span class="w285sub">Every Google account the Hub makes starts with it, and Google asks the new person to change it. At least 8 characters, with a letter and a digit.</span>' + (O ? O.noteHtml('pw') : '') + '</p>',
        acts: '<input type="password" autocomplete="new-password" aria-label="The first password" data-o271i="pw" data-f="pw"><button type="button" class="w285b pri" data-o271a="pwset" data-f="pw"' + (S.busy && S.busy.pw ? ' disabled' : '') + '>Set</button>' });
    }
    var tasks = {};
    c.people.forEach(function (P) {
      var f = P.flow, nm = '<b>' + E(P.name) + '</b>';
      if (f && f.steps) {
        W.AUTO.forEach(function (a) {
          var r = h.stepRow(f, a[0]); if (!r) return;
          if (r.status === 'failed' || h.stuck(r)) {
            out.push({ red: true, html: '<p>' + nm + ': ' + E(a[1]) + (r.status === 'failed' ? ' failed' : ' is stuck') + (r.detail ? '. <span class="w285sub">' + E(r.detail) + '</span>' : '.') + '</p>',
              acts: '<button type="button" class="w285b" data-o271a="retry" data-f="' + E(P.fid) + '" data-step="' + E(a[0]) + '"' + (S.busy && S.busy['r' + P.fid + a[0]] ? ' disabled' : '') + '>Retry</button>' + openBtn(P, 'su', 'Open') });
          } else if (r.status === 'hr_task') (tasks[a[0]] = tasks[a[0]] || []).push(P);
        });
      }
      if (P.turn && P.turn.who === 'hr' && P.stage !== 'weeks' && P.stage !== 'later' && P.stage !== 'starting') {
        out.push({ red: false, html: '<p>' + nm + ': ' + E(P.turn.t.replace(/^HR to /, '')) + '.</p>', acts: openBtn(P, 'ov', 'Open') });
      } else if (P.turn && P.turn.who === 'mgr' && P.mgr && f && !f.proposed_at && !f.call_at && hrTools) {
        var since = f.accepted_on || h.dayOf(f.offer_sent_at);
        if (since && h.diffDays(h.today(), since) >= 1) {
          out.push({ red: false, html: '<p>' + nm + ': ' + E(first(P.mgr.name)) + ' has not proposed times.<span class="w285sub">' + (f.accepted_on ? 'Accepted ' + E(fmtDay(f.accepted_on)) : 'Offer sent ' + E(fmtDay(f.offer_sent_at))) + '</span></p>',
            acts: (f.propose_path || f.status === 'offered' ? '<button type="button" class="w285b" data-o275a="askmgr" data-f="' + E(P.fid) + '"' + (S.busy && S.busy['m' + P.fid] ? ' disabled' : '') + '>Ask ' + E(first(P.mgr.name)) + ' again</button>' : '') + openBtn(P, 'ov', 'Open') });
        }
      } else if (P.turn && P.turn.who === 'mgr' && f && f.hire_answer === 'no') {
        out.push({ red: false, html: '<p>' + nm + ': ' + E(first(P.name)) + ' said no to the times.</p>', acts: openBtn(P, 'ov', 'Open') });
      }
      if (P.plan && P.plan.behindWeek && (P.stage === 'weeks' || P.stage === 'later')) {
        var ended = P.plan.sections.filter(function (s) { return s.ended && s.done < s.total; }).pop();
        out.push({ red: true, html: '<p>' + nm + ': ' + plural(P.plan.behind, 'step') + ' overdue.' + (ended ? '<span class="w285sub">' + E(ended.label) + ' ended ' + E(fmtDay(ended.end)) + '.</span>' : '') + '</p>',
          acts: (P.email ? '<a class="w285b" href="mailto:' + E(P.email) + '">Message ' + E(first(P.name)) + '</a>' : '') + openBtn(P, 'pl', 'Open') });
      }
    });
    Object.keys(tasks).forEach(function (k) {
      var L = tasks[k], words = TASK[k] || [W.AUTO.filter(function (a) { return a[0] === k; })[0][1].toLowerCase(), W.AUTO.filter(function (a) { return a[0] === k; })[0][1].toLowerCase()];
      var names = L.map(function (P) { return E(P.name); });
      var who = names.length > 3 ? names.slice(0, 3).join(', ') + ' and ' + (names.length - 3) + ' more' : names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
      var open = ST.open['t' + k];
      out.push({ red: false, html: '<p><b>' + who + '</b>: ' + E(L.length === 1 ? words[0] : words[1]) + '.</p>',
        acts: L.length === 1 ? openBtn(L[0], 'su', 'Open') : '<button type="button" class="w285b" data-w285fold="t' + E(k) + '" aria-expanded="' + !!open + '">' + (open ? 'Hide the list' : 'Open the list') + '</button>',
        more: L.length > 1 && open ? L.map(function (P) { return { red: false, html: '<p><b>' + E(P.name) + '</b>: ' + E(words[0]) + '.</p>', acts: openBtn(P, 'su', 'Open') }; }) : null });
    });
    /* a hire asking for help (wave39's onboarding_help, open ones): Dealt with is wave166's own button (onboarding_help_resolve) */
    W.helpAll().forEach(function (q) {
      var P = c.people.filter(function (x) { return x.onb && String(x.onb.id) === String(q.onboarding_id); })[0];
      out.unshift({ red: true, html: '<p><b>' + E(P ? P.name : q.person || 'Someone') + '</b> asked for help' + (q.step ? ' with ' + E(q.step) : '') + (q.note ? ': “' + E(q.note) + '”' : '.') + (q.at ? '<span class="w285sub">' + E(fmtDay(q.at)) + '</span>' : '') + '</p>',
        acts: '<button type="button" class="w285b" data-w166resolve="' + E(q.id) + '">Dealt with</button>' + (P ? openBtn(P, 'ov', 'Open') : '') });
    });
    c.backed.forEach(function (P) {
      var n = removals(P.flow);
      if (n) out.push({ red: false, html: '<p><b>' + E(P.name) + '</b> backed out: take ' + plural(n, 'thing') + ' out by hand.</p>', acts: openBtn(P, 'ov', 'Open') });
    });
    return out;
  }
  /* how many things a flow that backed out left to take out (wave271 draws the list itself, on its card) */
  function removals(f) {
    if (!f || f.practice) return 0;
    var n = 0, st = {}; (f.steps || []).forEach(function (r) { st[r.step] = r.status; });
    if (st.google === 'done' && f.wa_email) n++;
    if (st.roster === 'done' && f.member_id) n++;
    if (f.slack_channel_id) n++;
    if (st.hub === 'done') n++;
    return n;
  }
  function openBtn(P, tab, label) { return '<button type="button" class="w285b" data-w285open="' + E(P.key) + '" data-tab="' + tab + '" data-ctx="hr">' + E(label) + '</button>'; }
  function itemHtml(it) { return '<div class="w285it"><i class="w285dot' + (it.red ? ' r' : '') + '"></i>' + it.html + '<span class="w285acts">' + (it.acts || '') + '</span></div>' + (it.more ? it.more.map(itemHtml).join('') : ''); }

  /* ---------- 2. Everyone, by stage ---------- */
  function rowHtml(P) {
    var g = P.prog || {}, mgr = P.mgr ? E(P.mgr.name) : 'No manager yet';
    return '<div class="w285row" data-w285key="' + E(P.key) + '">'
      + '<div class="w285who"><b>' + E(P.name) + (P.practice ? '<span class="w285tag">Practice</span>' : '') + '</b><small>' + (P.role ? E(P.role) : 'No role on file') + '<span class="m2"> &middot; ' + (P.mgr ? 'Manager: ' + mgr : mgr) + '</span></small></div>'
      + '<div class="w285mgr">' + mgr + '</div>'
      + '<div class="w285turn' + (P.turn.cls ? ' ' + P.turn.cls : '') + '">' + E(P.turn.t) + '</div>'
      + '<div class="w285prog">' + (g.pct != null ? '<div class="w285bar" role="img" aria-label="' + E(g.label) + '"><i style="width:' + Math.max(0, Math.min(100, g.pct)) + '%"></i></div>' : '') + '<div class="w285pct">' + E(g.label || '') + '</div></div>'
      + '<button type="button" class="w285b" data-w285open="' + E(P.key) + '" data-ctx="hr" aria-label="Open ' + E(P.name) + '">Open</button></div>';
  }
  function everyone(c) {
    var ppl = c.people, behind = ppl.filter(function (P) { return P.plan && P.plan.behind && (P.stage === 'weeks' || P.stage === 'later'); }).length;
    var mon = h.today().slice(0, 7), fin = c.finished.filter(function (P) { return P.onb && h.dayOf(P.onb.completed_at).slice(0, 7) === mon; }).length;
    var bits = [ppl.length + ' onboarding'];
    if (behind) bits.push(behind + ' behind');
    if (fin) bits.push(fin + ' finished this month');
    var html = '<p class="w285sum">' + bits.join(' &middot; ') + '</p>';
    if (!ppl.length) html += '<p class="w285none">Nobody is onboarding right now. When someone accepts an offer, they show here.</p>';
    STAGES.forEach(function (s) {
      var L = ppl.filter(function (P) { return P.stage === s[0]; }); if (!L.length) return;
      html += '<div class="w285stg">' + E(s[1]) + ' <span>' + L.length + '</span></div><div class="w285box">' + L.map(rowHtml).join('') + '</div>';
    });
    if (c.finished.length) {
      html += '<p class="w285done">' + (c.finished.length === 1 ? '1 member finished their onboarding.' : c.finished.length + ' members finished their onboarding.') + ' <button type="button" class="w285link" data-w285fold="done" aria-expanded="' + ST.seeDone + '">' + (ST.seeDone ? 'Hide them' : 'See them') + '</button></p>';
      if (ST.seeDone) html += '<div class="w285box w285fin">' + c.finished.map(function (P) { return '<div class="w285it"><p><b>' + E(P.name) + '</b><span class="w285sub">' + E(P.turn.t) + (P.plan && P.plan.total ? ' &middot; ' + E(P.prog.label) : '') + '</span></p><span class="w285acts">' + openBtn(P, 'pl', 'Open') + '</span></div>'; }).join('') + '</div>';
    }
    if (c.backed.length) {
      html += '<p class="w285done">' + (c.backed.length === 1 ? '1 hire backed out in the last 30 days.' : c.backed.length + ' hires backed out in the last 30 days.') + ' <button type="button" class="w285link" data-w285fold="backed" aria-expanded="' + ST.seeBacked + '">' + (ST.seeBacked ? 'Hide them' : 'See them') + '</button></p>';
      if (ST.seeBacked) html += '<div class="w285box w285fin">' + c.backed.map(function (P) { return '<div class="w285it"><p><b>' + E(P.name) + (P.practice ? '<span class="w285tag">Practice</span>' : '') + '</b><span class="w285sub">' + E(P.prog.label || 'Backed out') + '</span></p><span class="w285acts">' + openBtn(P, 'ov', 'Open') + '</span></div>'; }).join('') + '</div>';
    }
    return html;
  }

  /* ---------- the page ---------- */
  function pageHtml() {
    var S = h.S() || {}, c = W.collect('hr', { finished: ST.seeDone });
    var html = '';
    if (S.err) html += '<div class="o271err" style="margin:0 0 14px">' + E(S.err) + '</div>';
    var n = needs(c);
    html += '<section class="w285sec" aria-labelledby="w285hn"><h2 class="w285h" id="w285hn">Needs you</h2>'
      + (!S.loaded && !S.err ? '<p class="w285none">Loading...</p>' : n.length ? '<div class="w285box">' + n.map(itemHtml).join('') + '</div>' : '<p class="w285none">Nothing needs you.</p>') + '</section>';
    html += '<section class="w285sec" aria-labelledby="w285he"><h2 class="w285h" id="w285he">Everyone</h2>' + everyone(c) + '</section>';
    return html;
  }
  /* the Plan template page's settings line: the first password once it is set (admins only) */
  function setHtml() {
    var S = h.S() || {}, O = h.O();
    if (!h.isAdmin() || !S.pw || !S.pw.set) return '';
    var open = ST.open.pw;
    return '<div class="w285box" style="margin:0 0 16px"><div class="w285it"><p><b>First password:</b> set' + (S.pw.set_at ? ' on ' + E(O && O.dayLong ? O.dayLong(S.pw.set_at) : fmtDay(S.pw.set_at)) : '') + '.<span class="w285sub">Every Google account the Hub makes starts with it; only the welcome email carries it.</span>' + (O ? O.noteHtml('pw') : '') + '</p>'
      + '<span class="w285acts">' + (open ? '<input type="password" autocomplete="new-password" aria-label="A new first password" data-o271i="pw" data-f="pw"><button type="button" class="w285b pri" data-o271a="pwset" data-f="pw"' + (S.busy && S.busy.pw ? ' disabled' : '') + '>Set</button><button type="button" class="w285b" data-w285fold="pw">Cancel</button>'
        : '<button type="button" class="w285b" data-w285fold="pw">Change it</button>') + '</span></div></div>';
  }
  function insHtml() {
    if (document.getElementById('w145quiz')) return '';
    return '<div class="w285box"><div class="w285it"><p>No onboarding quiz answers yet. The policy quiz and the 30 day quiz show here, with what new members said about their onboarding, once someone takes one.</p></div></div>';
  }
  var pend = null, busy = false;
  function paint() {
    if (busy) return; busy = true;
    try {
      if (!onHrc() || !document.getElementById('w46body')) return;
      ensure();
      /* the first password box survives a repaint as a property, never in the HTML */
      var pw = document.querySelector('#w285 [data-o271i="pw"],#w285set [data-o271i="pw"]'), typed = pw ? pw.value : '', had = pw && document.activeElement === pw;
      var k = pageNow();
      if (k === 'onboarding') set('w285', pageHtml());
      if (k === 'plan') { var S = h.S(), O = h.O(); if (h.isAdmin() && S && S.pw == null && O && O.readPw && !ST.pwAsked) { ST.pwAsked = true; O.readPw().then(paintSoon); } set('w285set', setHtml()); }
      if (k === 'insights') set('w285ins', insHtml());
      if (typed) { var again = document.querySelector('#w285 [data-o271i="pw"],#w285set [data-o271i="pw"]'); if (again) { again.value = typed; if (had) try { again.focus(); } catch (e) { /* fine */ } } }
      typed = '';
      /* wave271's own copy of the box is not drawn twice */
      var dup = document.querySelector('#o271 [data-o271pw]'); if (dup) dup.remove();
    } finally { busy = false; }
  }
  function paintSoon() { clearTimeout(pend); pend = setTimeout(function () { try { paint(); } catch (e) { /* the next one */ } }, 30); }
  W.paintPage = paint; W.paintPageSoon = paintSoon;
  /* the open help requests: wave39's list (HR) and the lead's card (the manager), one shape: {id, onboarding_id, step, note, at} */
  W.helpAll = function () {
    var out = [], seen = {};
    try { (typeof WA39_HELP !== 'undefined' ? WA39_HELP : []).forEach(function (x) { if (x && (x.status == null || x.status === 'open') && !seen[x.id]) { seen[x.id] = 1; out.push({ id: x.id, onboarding_id: x.onboarding_id, step: x.step_name || '', note: x.note || '', at: x.created_at || null }); } }); } catch (e) { /* none */ }
    try { var L = window.w166 && window.w166.state && window.w166.state().lead; ((L && L.people) || []).forEach(function (p) { (p.help || []).forEach(function (q) { if (q && !seen[q.id]) { seen[q.id] = 1; out.push({ id: q.id, onboarding_id: p.onboarding_id, step: q.step || '', note: q.note || '', at: q.at || null, person: p.name }); } }); }); } catch (e) { /* none */ }
    return out;
  };
  W.helpOf = function (onbId) { return W.helpAll().filter(function (q) { return onbId != null && String(q.onboarding_id) === String(onbId); }); };
  /* after wave166 marks a request dealt with, wave39's list is read again (wave166 refreshes the lead's card itself) */
  window.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w166resolve]'); if (!b) return;
    var id = b.getAttribute('data-w166resolve');
    setTimeout(async function () {
      try { if (typeof WA39_HELP !== 'undefined') WA39_HELP = WA39_HELP.filter(function (x) { return String(x.id) !== String(id); }); } catch (x) { /* fine */ }
      try { if (typeof wa39OnbLoad === 'function') await wa39OnbLoad(); } catch (x) { /* fine */ }
      W.paintAll();
    }, 900);
  }, true);

  /* ---------- wiring ---------- */
  /* wave271's painter: after it, the page (and the panel and Home, see c_panel.js) draw from the same state */
  (function hook(tries) {
    var R = h.R();
    if (!R || typeof R.paint !== 'function') { if ((tries || 0) < 20) setTimeout(function () { hook((tries || 0) + 1); }, 500); return; }
    if (R.paint.__w285) return;
    var orig = R.paint;
    R.paint = function () { var out = orig.apply(this, arguments); try { W.afterPaint(); } catch (e) { /* fine */ } return out; };
    R.paint.__w285 = true;
  })(0);
  W.afterPaint = function () {
    try { if (W.stripOpen) W.stripOpen(); } catch (e) { /* fine */ }
    paintSoon();
    try { if (W.paintPanel) W.paintPanel(); } catch (e) { /* fine */ }
    try { if (W.paintHomeSoon) W.paintHomeSoon(); } catch (e) { /* fine */ }
  };
  W.paintAll = function () { paintSoon(); try { if (W.paintPanel) W.paintPanel(); } catch (e) { /* fine */ } try { if (W.paintHomeSoon) W.paintHomeSoon(); } catch (e) { /* fine */ } };
  function arm(tries) {
    var panel = document.getElementById('hrcentre');
    if (!panel) { if ((tries || 0) < 40) setTimeout(function () { arm((tries || 0) + 1); }, 800); return; }
    if (panel.dataset.w285mo) return; panel.dataset.w285mo = '1';
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (t && t.closest && (t.closest('#w285') || t.closest('#w285set') || t.closest('#w285ins'))) continue;
        paintSoon(); return;
      }
    }).observe(panel, { childList: true, subtree: true });
    new MutationObserver(function () { pages(); paintSoon(); if (pageNow() === 'onboarding') W.loadPositions(); }).observe(panel, { attributes: true, attributeFilter: ['data-w197', 'class'] });
    paintSoon();
  }
  if (typeof startApp === 'function') {
    var __sa285 = startApp;
    startApp = async function () { var out = await __sa285.apply(this, arguments); try { pages(); arm(0); } catch (e) { /* non-fatal */ } return out; };
  }
  arm(0);
  window.addEventListener('hashchange', function () { setTimeout(paintSoon, 150); });

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var fd = t.closest('[data-w285fold]');
    if (fd) {
      var k = fd.getAttribute('data-w285fold');
      if (k === 'done') ST.seeDone = !ST.seeDone; else if (k === 'backed') ST.seeBacked = !ST.seeBacked; else ST.open[k] = !ST.open[k];
      paint();
      var back = document.querySelector('[data-w285fold="' + k + '"]'); if (back) try { back.focus(); } catch (x) { /* fine */ }
      return;
    }
    /* the page's own help, in the words of this page (capture: before wave46's general help) */
  });
  var HELP = {
    onboarding: ['Onboarding', 'From offer to full member, one row per person.', ['<b>Needs you</b>: only what waits on you or on HR, one line and one button each. When it is empty, nothing waits.',
      '<b>Everyone</b>: each person under their stage (Offer out, Accepted, Starting, Weeks 1 to 4, 60 and 90 days), with their manager, whose turn it is and one progress figure. Finished plans are counted under the list.',
      '<b>Open</b>: the person\'s page. Overview has their timeline and the actions (Change time, Change manager, Book the 1-on-1, Edit the welcome email, They backed out). Setup has the Hub\'s twelve steps, Plan has their plan by section with the role trainings, Academy has their trainings.',
      'Onboarding starts when someone accepts an offer. For someone who joined without recruitment, start a plan from their Team profile.',
      'Progress counts real steps only: a group of steps is done when everything in it is done, and a step done in the Avenue Academy counts. Behind means steps whose section has ended are still open.']],
    plan: ['Plan template', 'The plan everyone starts from.', ['Every week and step a new person gets. Changes reach everyone still onboarding: a step moved to another week takes that week\'s due date in every plan in progress.',
      'Edit what people see sets a week\'s title, photo, goals, why it matters and the lesson that opens it. Each step can be edited, retired or linked to the Avenue Academy, so it ticks itself when done there.']],
    insights: ['Onboarding insights', 'How onboarding is going for the people who did it.', ['The policy quiz and the 30 day quiz, read from their Google Forms, and what new members said about their onboarding.']]
  };
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var hb = t.closest('[data-w46help]'); if (!hb || !onHrc()) return;
    var k = pageNow(), x = HELP[k]; if (!x || typeof openModal !== 'function') return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openModal('<h3>' + E(x[0]) + '</h3><div class="w43hm"><p>' + E(x[1]) + '</p>' + x[2].map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</div><div class="m-actions"><button class="btn" id="w285hc">Got it</button></div>');
    var c = document.getElementById('w285hc'); if (c) c.addEventListener('click', function () { try { closeModal(); } catch (x2) { /* fine */ } });
  }, true);
})();
