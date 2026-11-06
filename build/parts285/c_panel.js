/* ---------- wave285 c_panel.js: one person, opened: Overview, Setup, Plan, Academy ----------
   The panel draws wave271's or wave275's card for the person's flow into a detached element (window.o271R.readyCard / startedCard, so the buttons
   and words are theirs, for HR and for a manager alike) and places its parts: the action row and whatever opens under it (Change time, Change manager,
   Book the 1-on-1, the picker, Edit the welcome email, They backed out) on Overview; the twelve automatic steps (window.o271.stepHtml) and the access
   block on Setup. Everything sits inside one element with data-o271flow, so wave271's and wave275's document handlers find their fields there; the
   same card is taken out of wave271's hidden section (#o271) and Home's #o275mine after each paint (W.stripOpen). */
(function () {
  var W = window.w285; if (!W || W.__panel) return; W.__panel = true;
  var h = W.h, E = h.E, plural = h.plural, first = h.first, fmtDay = h.fmtDay;
  var PAN = { key: null, ctx: 'hr', tab: 'ov', from: null, folds: {}, fid: null, ask: {}, asked: {} };
  var TABS = [['ov', 'Overview'], ['su', 'Setup'], ['pl', 'Plan'], ['ac', 'Academy']];

  function root() {
    var r = document.getElementById('w285pan');
    if (!r) {
      r = document.createElement('div'); r.id = 'w285pan';
      r.innerHTML = '<div class="bk" data-w285x="1"></div><div class="pn" role="dialog" aria-modal="true" aria-labelledby="w285pt" tabindex="-1"></div>';
      document.body.appendChild(r);
    }
    return r;
  }
  function person() { return PAN.key ? W.lookup(PAN.ctx, PAN.key) : null; }

  /* ---------- the card's parts ---------- */
  function cardOf(P) {
    var R = h.R(); if (!R || !P || !P.flow || P.kind === 'backed') return null;
    var html = '';
    try { html = P.kind === 'started' ? R.startedCard(P.flow) : R.readyCard(P.flow); } catch (e) { return null; }
    var d = document.createElement('div'); d.innerHTML = html;
    var card = d.firstElementChild; if (!card) return null;
    var kids = [].slice.call(card.children), last = -1, out = { notes: [], lines: [], btns: null, after: [], acc: null };
    kids.forEach(function (k, i) { if (k.classList.contains('o271btns')) last = i; });
    kids.forEach(function (k, i) {
      if (k.classList.contains('o271top')) return;
      if (i === last) { out.btns = k; return; }
      if (last >= 0 && i > last) { out.after.push(k); return; }
      if (k.tagName === 'OL' && k.classList.contains('o271st')) return;   /* the steps: drawn on Setup, one by one */
      if (k.hasAttribute('data-o278acc')) { var ol = k.querySelector('ol'); if (ol) ol.remove(); out.acc = k; return; }
      if (k.hasAttribute('data-o275ticks')) return;   /* the hire's ticks: on Setup */
      if (k.classList.contains('o271okn') || k.classList.contains('o271warn') || k.classList.contains('o271err')) { out.notes.push(k); return; }
      if (/^The other steps run when/.test((k.textContent || '').trim())) return;
      out.lines.push(k);
    });
    return out;
  }
  function outer(list) { return (list || []).map(function (k) { return k.outerHTML; }).join(''); }

  /* ---------- Overview ---------- */
  function timeline(P) {
    var f = P.flow, J = [], t0 = h.today(), p = P.plan;
    if (f || P.cand) {
      var sent = (f && f.offer_sent_at) || (P.cand && P.cand.offer_sent_at);
      J.push({ t: 'Offer sent', d: sent ? fmtDay(sent) : '', on: !!sent });
      J.push({ t: 'Accepted', d: f && f.accepted_on ? fmtDay(f.accepted_on) : '', on: !!(f && f.accepted_on) });
      J.push({ t: f && f.call_at ? 'Times booked' : (f && f.proposed_at ? 'Times proposed' : 'Times booked'), d: f && f.call_at ? 'call ' + fmtDay(f.call_at) : (f && f.proposed_at ? fmtDay(f.proposed_at) : ''), on: !!(f && f.call_at) });
      J.push({ t: 'Day one', d: P.dayOne ? fmtDay(P.dayOne) : '', on: !!(P.dayOne && P.dayOne <= t0) });
    } else if (p && p.start) J.push({ t: 'Plan started', d: fmtDay(p.start), on: p.start <= t0 });
    if (p) p.sections.forEach(function (s) {
      J.push({ t: s.label + (s.total ? ': ' + s.done + ' of ' + s.total + ' done' : ''), d: s.end ? (s.ended ? 'ended ' : 'ends ') + fmtDay(s.end) : '', on: s.ended || s.done >= s.total, late: s.ended && s.done < s.total });
    });
    else if (!P.finished) ['Weeks 1 to 4', '60 days', '90-day review'].forEach(function (t) { J.push({ t: t, d: '', on: false }); });
    var now = false;
    return '<ul class="w285tl">' + J.map(function (x) {
      var cls = x.on ? '' : (!now ? (now = true, 'now') : 'next');
      return '<li class="' + cls + '"><span>' + (cls === 'now' ? '<b>' + E(x.t) + '</b>' : E(x.t)) + (x.late ? ' <em class="late" style="color:#B3402F;margin:0">(open steps)</em>' : '') + '</span>' + (x.d ? '<em>' + E(x.d) + '</em>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function overview(P, C) {
    var html = '<p class="w285now' + (P.turn.cls === 'late' ? ' late' : '') + '">Now: <b>' + E(P.turn.t) + '</b></p>';
    if (C) html += outer(C.notes);
    if (P.kind === 'backed') {
      var src = document.querySelector('#o271 [data-o271backed="' + String(P.fid).replace(/"/g, '') + '"]');
      return html + (src ? src.outerHTML : '<p class="w285line">They backed out' + (P.flow && P.flow.updated_at ? ' on ' + E(fmtDay(P.flow.updated_at)) : '') + '. Nothing else to do here.</p>');
    }
    html += timeline(P);
    var menu = C && C.btns ? C.btns.innerHTML : '';
    if (!P.flow && P.email) menu += '<a class="o271b" href="mailto:' + E(P.email) + '">Message ' + E(first(P.name)) + '</a>';
    if (P.onb && h.isHr() && h.onbById(P.onb.id)) menu += '<button type="button" class="o271b" data-w37open="' + E(P.onb.id) + '">Open the full checklist</button>';
    if (menu) html += '<div class="w285lbl">Actions</div><div class="w285menu">' + menu + '</div>';
    if (C) html += outer(C.after);
    if (C && C.lines.length) html += '<details class="w285fold" data-w285f="more"' + (PAN.folds.more ? ' open' : '') + '><summary><span>More about this onboarding</span><span></span></summary><div class="in">' + outer(C.lines) + '</div></details>';
    if (!P.flow && !P.cand) html += '<p class="w285line mut">They joined without an offer through the Hub, so there are no automatic steps for them.</p>';
    return html;
  }

  /* ---------- Setup ---------- */
  function setup(P, C) {
    var f = P.flow, O = h.O(), S = h.S() || {}, html = '';
    if (f && P.kind !== 'backed' && O && O.stepHtml) {
      var c = W.setupCount(f), open = [], rest = [];
      var line = c.done + ' of ' + c.total + ' done by the Hub' + (c.hr ? ' &middot; ' + c.hr + ' for HR' : '') + (c.failed ? ' &middot; ' + c.failed + ' failed' : '');
      W.AUTO.forEach(function (a, i) {
        var r = h.stepRow(f, a[0]);
        if (!r) { rest.push('<li><div class="ttl">' + (i + 1) + '. ' + E(a[1]) + ' <span class="o271tag">Not run yet</span></div></li>'); return; }
        var shown = r, id = P.fid;
        if ((S.busy && (S.busy['w278l' + id] || S.busy['w278c' + id])) && (a[0] === 'groups' || a[0] === 'drives')) shown = Object.assign({}, r, { status: 'Re-running', detail: null });
        else if (a[0] === 'channel' && r.status === 'pending') shown = Object.assign({}, r, { status: 'waiting', detail: 'Waiting for them to join Slack' });
        var li = O.stepHtml(Object.assign({}, f, { id: id, steps: [shown] }), a[0], a[1], i + 1);
        (r.status === 'failed' || r.status === 'hr_task' || h.stuck(r) ? open : rest).push(li);
      });
      html += '<p class="w285line"><b>' + line + '</b></p>';
      if (open.length) html += '<div class="w285lbl">' + (c.failed ? 'Needs a look' : 'For HR') + '</div><ol class="o271st">' + open.join('') + '</ol>';
      html += '<details class="w285fold" data-w285f="all12"' + (PAN.folds.all12 ? ' open' : '') + '><summary><span>' + (open.length ? 'The other ' + rest.length + ' steps' : 'All ' + rest.length + ' steps') + '</span><span></span></summary><div class="in"><ol class="o271st">' + rest.join('') + '</ol></div></details>';
      if (C && C.acc) html += '<div class="w285lbl">Groups, drives and the welcome</div>' + C.acc.outerHTML;
      var tk = W.ticks(f), mine = {}; tk.forEach(function (r) { mine[r[0]] = 1; });
      html += '<div class="w285lbl">' + E(first(P.name) ? first(P.name) + '\'s own setup' : 'Their own setup') + ': ' + tk.length + ' of ' + W.RUNDOWN.length + '</div>'
        + W.RUNDOWN.map(function (r) { return '<div class="w285step' + (mine[r[0]] ? ' ok' : '') + '"><i>' + (mine[r[0]] ? '&#10003;' : '') + '</i><span>' + E(r[1]) + '</span></div>'; }).join('');
    } else if (P.kind === 'backed') html += '<p class="w285line">They backed out, so the Hub runs nothing more for them.</p>';
    else if (P.cand) html += '<p class="w285line">The Hub makes their accounts when they accept the offer.</p>';
    else html += '<p class="w285line">' + E(first(P.name) || 'They') + ' joined before automatic setup, so the setup steps in their plan count as done.</p>';
    var hrs = (P.onb && typeof WA39_HRS !== 'undefined' ? WA39_HRS : []).filter(function (x) { return P.onb && String(x.onboarding_id) === String(P.onb.id); });
    if (hrs.length && h.isHr()) html += '<div class="w285lbl">HR\'s own checklist</div><div class="w285menu"><button type="button" class="o271b" data-w39hr="' + E(P.onb.id) + '">Open it: ' + hrs.filter(function (x) { return x.done; }).length + ' of ' + hrs.length + ' done</button></div>';
    return html;
  }

  /* ---------- Plan ---------- */
  function startBtn(P) {
    if (!h.isHr() || P.mid == null || P.cand) return '';
    var busy = PAN.asked[P.mid];
    if (PAN.ask[P.mid]) return '<p class="w285line">The plan starts today: every step of the Plan template is copied in with its due date, and what they already did in the Avenue Academy counts.</p><div class="w285menu"><button type="button" class="o271b pri" data-w285start="' + E(P.mid) + '" data-go="1" data-name="' + E(P.name) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Starting...' : 'Start it today') + '</button><button type="button" class="o271b" data-w285start="' + E(P.mid) + '" data-go="0">Cancel</button></div>';
    return '<div class="w285menu"><button type="button" class="o271b pri" data-w285start="' + E(P.mid) + '" data-name="' + E(P.name) + '">Start an onboarding plan</button></div>';
  }
  function planTab(P) {
    var p = P.plan;
    if (!p || !p.total) {
      if (P.flow && !P.onb) return '<p class="w285line">Their plan is made when the times are booked.</p>';
      var active = P.mid != null && (h.W37().onbs || []).some(function (o) { return String(o.member_id) === String(P.mid) && o.status === 'active'; });
      return '<p class="w285line">' + (p ? 'Their plan has no steps yet.' : 'No plan yet.') + '</p>' + (!active ? startBtn(P) : '');
    }
    var html = '<p class="w285line"><b>Plan: ' + p.done + ' of ' + p.total + ' done</b>' + (p.w14.total ? ' &middot; Weeks 1 to 4: ' + p.w14.done + ' of ' + p.w14.total : '') + (p.behind ? ' &middot; <span style="color:#B3402F;font-weight:700">Behind: ' + plural(p.behind, 'step') + '</span>' : '') + '</p>'
      + '<p class="w285line mut">A group of steps counts once everything in it is done; a step done in the Avenue Academy counts.</p>';
    var t0 = h.today();
    p.sections.forEach(function (s) {
      var key = 'pl:' + s.key, open = Object.prototype.hasOwnProperty.call(PAN.folds, key) ? PAN.folds[key] : s.current;
      var lastParent = null, role = false;
      var body = s.leaves.map(function (l) {
        var g = '';
        if (l.child && l.parent && l.parent !== lastParent) g = '<div class="w285grp">' + E(l.parent) + '</div>';
        lastParent = l.child ? l.parent : null;
        if (l.path === 'role60' || l.path === 'role90') role = true;
        var late = !l.done && s.ended;
        return g + '<div class="w285step' + (l.done ? ' ok' : '') + (l.child ? ' kid' : '') + '"><i>' + (l.done ? '&#10003;' : '') + '</i><span>' + E(l.name)
          + (l.academy ? '<em>Avenue Academy</em>' : '') + (l.how === 'setup' ? '<em>done at setup</em>' : l.how === 'academy' ? '<em>done in the Academy</em>' : '') + (late ? '<em class="late">overdue</em>' : '') + '</span></div>';
      }).join('');
      if (role && P.onb) body += '<div class="w285menu" style="margin-top:8px"><button type="button" class="o271b" data-w279open="' + E(P.onb.id) + '">Role trainings</button></div>';
      html += '<details class="w285fold" data-w285f="' + E(key) + '"' + (open ? ' open' : '') + '><summary><span><b>' + E(s.label) + '</b>' + (s.end ? ' &middot; ' + (s.ended ? 'ended ' : 'ends ') + E(fmtDay(s.end)) : '') + '</span><span>' + s.done + ' of ' + s.total + ' done</span></summary><div class="in">' + body + '</div></details>';
    });
    void t0;
    return html;
  }

  /* ---------- Academy ---------- */
  function acadTab(P) {
    var list = null, who = { name: P.name, email: P.email };
    if (P.lead && !(h.academy() && (h.academy().prog || []).length)) list = (P.lead.academy || []).filter(function (a) { return a && a.total; }).map(function (a) { return { title: a.title || a.key, done: Number(a.done) || 0, total: Number(a.total) || 0 }; });
    else list = W.avenues(who);
    if (!list) {
      if (window.w122 && typeof window.w122.load === 'function' && !PAN.acadAsked) { PAN.acadAsked = true; Promise.resolve(window.w122.load()).then(paintPanel, paintPanel); }
      return '<p class="w285line mut">Loading the Avenue Academy...</p>';
    }
    if (!list.length) return '<p class="w285line">No Avenue Academy trainings for them yet.</p>';
    var d = 0, t = 0; list.forEach(function (a) { d += a.done; t += a.total; });
    return '<p class="w285line"><b>Academy trainings ' + d + ' of ' + t + '</b></p><div class="w285box">' + list.map(function (a) {
      return '<div class="w285it"><p><b>' + E(a.title) + '</b></p><span class="w285acts" style="color:rgba(16,63,57,.64);font-size:13.5px">' + a.done + ' of ' + a.total + '</span></div>';
    }).join('') + '</div><p class="w285line mut" style="margin-top:10px">Academy trainings count on their own. They are not the plan\'s figure.</p>';
  }

  /* ---------- the panel ---------- */
  function sub(P) {
    var bits = [P.role || 'No role on file', P.mgr ? 'Manager: ' + P.mgr.name : 'No manager yet'];
    if (P.day) bits.push(P.day <= 90 ? 'Day ' + P.day + ' of 90' : 'Day ' + P.day);
    else if (P.stage === 'starting' && P.dayOne) bits.push('Starts ' + fmtDay(P.dayOne));
    else if (P.stage === 'offer') bits.push('Offer out');
    else if (P.stage === 'accepted') bits.push('Accepted');
    return bits.map(E).join(' &middot; ');
  }
  function html(P) {
    if (!P) return '<div class="ph"><div><h3 id="w285pt">Not on the list</h3><small>This person is no longer onboarding.</small></div><button type="button" class="x" data-w285x="1" aria-label="Close">&times;</button></div>';
    var C = cardOf(P), tab = PAN.tab, body;
    if (tab === 'su') body = setup(P, C); else if (tab === 'pl') body = planTab(P); else if (tab === 'ac') body = acadTab(P); else body = overview(P, C);
    return '<button type="button" class="back" data-w285x="1">&larr; Back</button>'
      + '<div class="ph"><div><h3 id="w285pt">' + E(P.name) + (P.practice ? '<span class="w285tag">Practice</span>' : '') + '</h3><small>' + sub(P) + '</small></div><button type="button" class="x" data-w285x="1" aria-label="Close">&times;</button></div>'
      + '<div class="w285tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" id="w285t' + t[0] + '" aria-selected="' + (t[0] === tab) + '" aria-controls="w285tp" class="' + (t[0] === tab ? 'on' : '') + '" data-w285tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>'
      + '<div id="w285tp" role="tabpanel" aria-labelledby="w285t' + tab + '" class="o271" data-o271flow="' + E(P.fid != null && P.kind !== 'backed' ? P.fid : '') + '">' + body + '</div>';
  }
  /* what the person was doing survives a repaint: focus, the caret, the scroll, the grids' scroll, a password being typed */
  function keyOf(a) {
    if (!a || !a.getAttribute) return null;
    var names = ['data-o271i', 'data-o275i', 'data-o278cc', 'data-o271a', 'data-o275a', 'data-o278a', 'data-w285tab', 'data-w285start', 'data-kind', 'data-step', 'data-f'], sel = '';
    names.forEach(function (n) { var v = a.getAttribute(n); if (v != null) sel += '[' + n + '="' + String(v).replace(/"/g, '\\"') + '"]'; });
    return sel || (a.classList && a.classList.contains('x') ? '.x' : null);
  }
  function paintPanel() {
    if (!PAN.key) return;
    var r = root(), pn = r.querySelector('.pn'), P = person();
    PAN.fid = P && P.fid != null && P.kind !== 'backed' ? P.fid : null;
    W.stripOpen();
    var a = document.activeElement, k = a && pn.contains(a) ? keyOf(a) : null, sel = a && k && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null;
    var top = pn.scrollTop, grids = [].map.call(pn.querySelectorAll('.o271gw,[data-o271grid]'), function (g) { return g.scrollLeft; });
    var pws = {}; [].forEach.call(pn.querySelectorAll('input[type=password]'), function (x) { pws[x.getAttribute('data-o271i') || ''] = x.value; });
    var out = html(P);
    if (pn.__h === out) return;
    pn.innerHTML = out; pn.__h = out;
    [].forEach.call(pn.querySelectorAll('input[type=password]'), function (x) { var v = pws[x.getAttribute('data-o271i') || '']; if (v) x.value = v; });
    pws = null;
    [].forEach.call(pn.querySelectorAll('.o271gw,[data-o271grid]'), function (g, i) { if (grids[i]) g.scrollLeft = grids[i]; });
    pn.scrollTop = top;
    if (k) { var again = null; try { again = pn.querySelector(k); } catch (e) { again = null; } if (again) { try { again.focus({ preventScroll: true }); if (sel) again.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text box */ } } }
  }
  W.paintPanel = paintPanel;
  W.stripOpen = function () {
    if (!PAN.key || PAN.fid == null) return;
    ['o271', 'o275mine'].forEach(function (id) {
      var host = document.getElementById(id); if (!host) return;
      [].forEach.call(host.querySelectorAll('[data-o271flow="' + String(PAN.fid).replace(/"/g, '') + '"]'), function (x) { x.remove(); });
    });
  };
  function open(key, tab, ctx, from) {
    PAN.key = key; PAN.tab = tab || 'ov'; PAN.ctx = ctx || 'hr'; PAN.from = from || null; PAN.folds = {}; PAN.acadAsked = false;
    var r = root(); r.classList.add('open'); document.body.classList.add('w285open');
    var pn = r.querySelector('.pn'); pn.__h = ''; pn.scrollTop = 0;
    paintPanel();
    try { (pn.querySelector('.x') || pn).focus({ preventScroll: true }); } catch (e) { /* fine */ }
    /* what the panel reads: HR's list when HR opens one of their own hires on Home, the plans, the Academy for its tab */
    var P = person(), S = h.S() || {};
    if (P && P.fid != null && h.isHr() && !S.loading && !(S.ready || []).concat(S.started || []).some(function (x) { return String(h.flowId(x)) === String(P.fid); }) && h.R() && h.R().load) Promise.resolve(h.R().load()).then(paintPanel, paintPanel);
    if (!h.W37().loaded && typeof wa37Load === 'function') Promise.resolve(wa37Load(false)).then(paintPanel, paintPanel);
    W.loadPositions();
  }
  function close() {
    if (!PAN.key) return;
    var from = PAN.from, fid = PAN.fid;
    PAN.key = null; PAN.fid = null;
    var r = document.getElementById('w285pan'); if (r) { r.classList.remove('open'); var pn = r.querySelector('.pn'); if (pn) { pn.innerHTML = ''; pn.__h = ''; } }
    document.body.classList.remove('w285open');
    /* the card taken out of wave271's section comes back */
    if (fid != null) { try { var R = h.R(); if (R && R.paint) R.paint(); } catch (e) { /* fine */ } }
    if (from && document.body.contains(from)) { try { from.focus(); } catch (e) { /* fine */ } }
    else if (PAN.key == null) { var again = from && from.getAttribute && document.querySelector('[data-w285open="' + String(from.getAttribute('data-w285open')).replace(/"/g, '') + '"]'); if (again) try { again.focus(); } catch (e) { /* fine */ } }
  }
  W.open = open; W.close = close; W.panel = function () { return PAN; };

  /* ---------- starting a plan for someone who joined without recruitment (the Team profile and the Plan tab): onboarding_assign, as wave46 did ---------- */
  async function startPlan(mid, name) {
    if (PAN.asked[mid]) return;
    PAN.asked[mid] = true; paintPanel(); if (W.paintProfile) W.paintProfile();
    try {
      var r = await db.rpc('onboarding_assign', { p_member_id: Number(mid), p_by: (typeof who === 'function') ? who() : 'HR' });
      if (r && r.error) throw r.error;
      h.toast('Onboarding plan started' + (name ? ' for ' + name : ''));
      try { await wa37Load(true); } catch (e) { /* the next load */ }
    } catch (e) { h.toast('Could not start the plan: ' + String((e && e.message) || e).slice(0, 120)); }
    delete PAN.asked[mid]; delete PAN.ask[mid];
    W.paintAll(); if (W.paintProfile) W.paintProfile();
  }
  W.startPlan = startPlan; W.askStart = PAN.ask;

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var o = t.closest('[data-w285open]');
    if (o) { e.preventDefault(); open(o.getAttribute('data-w285open'), o.getAttribute('data-tab') || 'ov', o.getAttribute('data-ctx') || 'hr', o); return; }
    if (t.closest('[data-w285x]') && t.closest('#w285pan')) { close(); return; }
    var tb = t.closest('#w285pan [data-w285tab]');
    if (tb) { PAN.tab = tb.getAttribute('data-w285tab'); var pn = root().querySelector('.pn'); paintPanel(); pn.scrollTop = 0; var nb = pn.querySelector('[data-w285tab="' + PAN.tab + '"]'); if (nb) try { nb.focus({ preventScroll: true }); } catch (x) { /* fine */ } return; }
    var sb = t.closest('[data-w285start]');
    if (sb && !sb.disabled) {
      var mid = sb.getAttribute('data-w285start'), go = sb.getAttribute('data-go');
      if (go === '1') startPlan(mid, sb.getAttribute('data-name') || '');
      else { if (go === '0') delete PAN.ask[mid]; else PAN.ask[mid] = true; paintPanel(); if (W.paintProfile) W.paintProfile(); }
      return;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (!PAN.key) return;
    if (e.key === 'Escape') {
      if (document.getElementById('w279sheet') || (document.getElementById('modalBack') && getComputedStyle(document.getElementById('modalBack')).display !== 'none')) return;   /* a layer above the panel closes first */
      close(); return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      var a = document.activeElement; if (!a || !a.getAttribute || !a.getAttribute('data-w285tab')) return;
      var i = TABS.map(function (x) { return x[0]; }).indexOf(a.getAttribute('data-w285tab')), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      PAN.tab = n; paintPanel(); var nb = root().querySelector('[data-w285tab="' + n + '"]'); if (nb) try { nb.focus(); } catch (x) { /* fine */ }
    }
  });
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || !d.getAttribute || !d.closest || !d.closest('#w285pan')) return;
    var k = d.getAttribute('data-w285f'); if (k) PAN.folds[k] = d.open;
  }, true);
  /* a layer that opens from the panel (the checklist modal, the role picks) and then changes the plan: the panel follows */
  document.addEventListener('change', function (e) { if (PAN.key && e.target && e.target.closest && (e.target.closest('#w37modal') || e.target.closest('#modalBox'))) setTimeout(paintPanel, 600); }, true);
  window.addEventListener('hashchange', function () { if (PAN.key) close(); });
})();
