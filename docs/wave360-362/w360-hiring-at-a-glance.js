/* wave360: Hiring at a glance. A visual path above the HR centre tabs: live counts, what you do, what the Hub does. Additive: it only reads and links. */
(function () {
  if (window.__w360) return; window.__w360 = 1;
  var STEPS = [
    { k: 'new', t: 'New', go: 'applications', gl: 'Open Applications', you: ['Nothing when they applied through CABM: they arrive by themselves.', 'From LinkedIn or a direct email: press Add an applicant and attach their resume.'], hub: ['Picks up the CABM email and its resume.', 'Files the resume under the right position.', 'Posts in the HR Slack channel and tags the hiring managers.'] },
    { k: 'reviewing', t: 'Reviewing', go: 'applications', gl: 'Open Applications', you: ['Read the resume.', 'Decide: interview, or close with a reason.'], hub: ['Keeps the resume, notes and history in one place.'] },
    { k: 'interview', t: 'Interview', go: 'applications', gl: 'Open Applications', you: ['Book and hold the interview.', 'Write your impressions afterwards.'], hub: ['Asks for your impressions before the offer, so nothing is lost.'] },
    { k: 'offer', t: 'Offer', go: 'applications', gl: 'Open Applications', you: ['Fill in who they report to, hours per week, who runs their onboarding, start date and reply-by date.', 'Send the offer.'], hub: ['Writes and sends the offer letter.', 'Records their yes or no.'] },
    { k: 'wait', t: 'Hired', cap: 'to send', go: 'onboarding', gl: 'Open Onboarding', you: ['Press Send their onboarding.', 'Set their first day.'], hub: ['Creates their Welfare Avenue Google account.', 'Gives Hub access, Google Groups and shared drives for their team.', 'Adds them to Slack and their team meeting.', 'Tells their manager and HR rep on Slack.'] },
    { k: 'started', t: 'Onboarding', go: 'onboarding', gl: 'Open Onboarding', you: ['Hold a welcome call about the organization, not about setup.', 'Answer questions in the Slack onboarding channel.'], hub: ['Walks the new person through their checklist.', 'Shows you their progress and what is late.'] }
  ];
  var C = null, OPENPOS = null, sel = -1, at = 0, busy = false;
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() {
    if (document.getElementById('w360css')) return;
    var s = document.createElement('style'); s.id = 'w360css';
    s.textContent = '.w360{background:#FFFAF2;border:1px solid #DEE0D8;border-radius:16px;padding:16px 16px 12px;margin:0 0 16px;color:#1F201E}'
      + '.w360h{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}'
      + '.w360t{font-weight:600;font-size:16px;color:#103F39}.w360s{font-size:13px;color:#6B6966;margin-top:2px}'
      + '.w360a{display:flex;gap:8px;flex-wrap:wrap}'
      + '.w360b{font:inherit;font-size:13px;font-weight:500;padding:8px 13px;border-radius:9px;border:1px solid #DEE0D8;background:transparent;color:#103F39;cursor:pointer;transition:transform 140ms cubic-bezier(.23,1,.32,1),background-color 160ms ease}'
      + '.w360b.p{background:#103F39;color:#FFFAF2;border-color:#103F39}.w360b:active{transform:scale(.97)}'
      + '.w360p{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;background:#ECEBE3;border-radius:12px;padding:5px}'
      + '.w360k{font:inherit;border:0;background:transparent;color:#1F201E;border-radius:9px;padding:10px 4px 9px;text-align:center;cursor:pointer;transition:transform 140ms cubic-bezier(.23,1,.32,1),background-color 160ms ease,color 160ms ease}'
      + '.w360k:active{transform:scale(.97)}.w360k b{display:block;font-size:22px;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums}'
      + '.w360k span{display:block;font-size:12px;color:#6B6966;margin-top:2px;transition:color 160ms ease}'
      + '.w360k.on{background:#103F39;color:#FFFAF2}.w360k.on span{color:#DCA527}'
      + '.w360k.hot:not(.on) b{color:#B3402F}'
      + '.w360d{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 6px 4px}'
      + '.w360d.in{animation:w360in 200ms cubic-bezier(.23,1,.32,1)}@keyframes w360in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}'
      + '.w360w{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;color:#103F39}.w360d>div+div .w360w{color:#6F64AB}'
      + '.w360d ul{margin:0;padding:0;list-style:none;font-size:14px}.w360d li{padding:6px 0;border-top:1px solid #DEE0D8}.w360d li:first-child{border-top:0}'
      + '.w360g{grid-column:1/-1}.w360n{font-size:13px;color:#6B6966;margin:10px 4px 0}.w360n b{color:#1F201E;font-weight:600}'
      + '@media (hover:hover) and (pointer:fine){.w360k:not(.on):hover{background:#DEE0D8}.w360b:not(.p):hover{background:#ECEBE3}}'
      + '@media (max-width:640px){.w360p{grid-template-columns:repeat(3,1fr)}.w360d{grid-template-columns:1fr}}'
      + '@media (prefers-reduced-motion:reduce){.w360d.in{animation:none}.w360k,.w360b{transition:none}}';
    document.head.appendChild(s);
  }
  function n(k) { return C && C[k] != null ? C[k] : '–'; }
  function needs() {
    if (!C) return 'Pick a step to see what you do and what the Hub does.';
    if (C.wait > 0) return '<b>' + C.wait + ' accepted</b> and waiting for their onboarding to be sent. Open Onboarding and press Send their onboarding.';
    if (C['new'] > 0) return '<b>' + C['new'] + ' new</b> ' + (C['new'] === 1 ? 'applicant' : 'applicants') + ' to read.';
    return 'Nothing is waiting on HR right now.';
  }
  function paint(anim) {
    var el = document.getElementById('w360'); if (!el) return;
    var h = '<div class="w360h"><div><div class="w360t">Hiring at a glance</div><div class="w360s">From applicant to teammate. Pick a step to see what you do and what the Hub does.</div></div>'
      + '<div class="w360a"><button type="button" class="w360b" data-w360go="positions">Positions' + (OPENPOS != null ? ' (' + OPENPOS + ' open)' : '') + '</button><button type="button" class="w360b p" data-w360go="applications">Add an applicant</button></div></div><div class="w360p">';
    STEPS.forEach(function (s, i) {
      h += '<button type="button" class="w360k' + (i === sel ? ' on' : '') + (s.k === 'wait' && C && C.wait > 0 ? ' hot' : '') + '" data-w360s="' + i + '" aria-pressed="' + (i === sel) + '"><b>' + E(n(s.k)) + '</b><span>' + E(s.t) + (s.cap ? ', ' + E(s.cap) : '') + '</span></button>';
    });
    h += '</div>';
    if (sel >= 0) {
      var s = STEPS[sel];
      h += '<div class="w360d' + (anim ? ' in' : '') + '"><div><div class="w360w">You do</div><ul>' + s.you.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul></div>'
        + '<div><div class="w360w">The Hub does</div><ul>' + s.hub.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul></div>'
        + '<div class="w360g"><button type="button" class="w360b p" data-w360go="' + s.go + '">' + E(s.gl) + '</button></div></div>';
    } else { h += '<p class="w360n">' + needs() + '</p>'; }
    el.innerHTML = h;
  }
  function tally(rows, key) { var o = {}; (rows || []).forEach(function (r) { if (r.practice) return; o[r[key]] = (o[r[key]] || 0) + 1; }); return o; }
  function count() {
    if (busy || typeof db === 'undefined' || !db) return; busy = true;
    Promise.all([db.from('hub_candidates').select('status,practice'), db.from('hub_onboard_flows').select('status,practice'), db.from('hub_positions').select('stage,gone')]).then(function (r) {
      busy = false; at = Date.now();
      var a = r[0] && !r[0].error ? tally(r[0].data, 'status') : null, f = r[1] && !r[1].error ? tally(r[1].data, 'status') : null;
      C = {};
      if (a) ['new', 'reviewing', 'interview', 'offer'].forEach(function (k) { C[k] = a[k] || 0; });
      if (f) { C.wait = f.waiting || 0; C.started = (f.started || 0) + (f.running || 0); }
      if (r[2] && !r[2].error) OPENPOS = (r[2].data || []).filter(function (p) { return !p.gone && ['requested', 'posted', 'interviewing', 'offer'].indexOf(p.stage) >= 0; }).length;
      paint(false);
    }, function () { busy = false; });
  }
  function ensure() {
    if (String(location.hash || '').indexOf('#hrcentre') !== 0) return;
    var tabs = document.querySelector('.w47tabs'); if (!tabs || !tabs.parentNode) return;
    var el = document.getElementById('w360');
    if (!el || el.nextElementSibling !== tabs) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      css(); el = document.createElement('div'); el.id = 'w360'; el.className = 'w360';
      el.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('[data-w360s],[data-w360go]') : null; if (!t) return;
        if (t.hasAttribute('data-w360go')) { location.hash = '#hrcentre/' + t.getAttribute('data-w360go'); return; }
        var i = +t.getAttribute('data-w360s'); sel = (i === sel ? -1 : i); paint(true);
      });
      tabs.parentNode.insertBefore(el, tabs); paint(false);
    }
    if (Date.now() - at > 60000) count();
  }
  setInterval(ensure, 1200);
  window.addEventListener('hashchange', function () { setTimeout(ensure, 300); });
  setTimeout(ensure, 800);
})();
