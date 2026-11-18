/* =====================================================================
   WA v354 Simple onboarding on the cards, and Applications made simple (18/11/26)
   =====================================================================
   Steel (18/11/26): "ensure the user experience for HR and the manager is as simple as can be" (simple onboarding, wave353: no
   onboarding call or 1-on-1; once the offer is accepted the manager and the HR owner send the onboarding), and "revisit how the
   applications page is laid out [...] the list can get long especially under the new applicants [...] simple, clean and easy for any
   manager or new HR rep".
   1. Onboarding (wave275's card, wave285's page, Home): a flow with simple on (wa275_flow_row.simple) reads "Ready to send" with one
      button, Send their onboarding, which opens a first day (the offer's start date while ahead, else today) and Send. No times, no
      availability, no Canva field, no manager's week. Needs you lists who is ready; the manager's Home card has the same button.
   2. Applications: one stage at a time as a clean list (the stage bar on top carries the counts and says what to do at that stage),
      long stages show 15 and Show all, a row can be dragged onto a stage in the bar, and the board stays one click away (Board).
   Everything the page did before still works: the sheet, the gates on each move, Select, the filters, the board.
   ===================================================================== */
(function () {
  if (window.w354) return;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', SOFT = '#5C6B66', LINE = 'rgba(16,63,57,.10)', FLAG = '#B3402F';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif", HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var EASE = 'cubic-bezier(.23,1,.32,1)';
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function today() { var p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; }); return p.year + '-' + p.month + '-' + p.day; }
  function dayWords(d) { try { return new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Toronto' }); } catch (e) { return String(d); } }
  function short(d) { try { return new Date(/T/.test(d) ? d : String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }); } catch (e) { return String(d); } }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return v; }

  var css = document.createElement('style'); css.id = 'w354css';
  css.textContent = ''
    /* every button of these pages answers the press (feedback, under 160ms, never on a disabled one) */
    + '.o271b,.w285b,.w197b,.w354b,.w354seg button{transition:transform 160ms ' + EASE + ',background-color 160ms ease,color 160ms ease;}'
    + '.o271b:active:not(:disabled),.w285b:active:not(:disabled),.w197b:active:not(:disabled),.w354b:active:not(:disabled){transform:scale(.97);}'
    /* the send form on the onboarding card */
    + '.w354f{background:rgba(16,63,57,.05);border:1px solid ' + LINE + ';border-radius:14px;padding:14px 16px;margin:10px 0 4px;font-family:' + BODY + ';font-size:14px;color:' + INK + ';transition:opacity 200ms ease-out,transform 200ms ' + EASE + ';}'
    + '@starting-style{.w354f{opacity:0;transform:translateY(4px);}}'
    + '.w354f label{display:block;font-weight:600;margin:0 0 6px;}.w354f input[type=date]{font:inherit;font-size:15px;padding:8px 10px;border:1px solid rgba(16,63,57,.25);border-radius:10px;background:#fff;max-width:100%;}'
    + '.w354f p{margin:8px 0 0;color:' + SOFT + ';font-size:13px;line-height:1.5;}.w354f .go{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}'
    + '.w354f .err{color:' + FLAG + ';font-weight:600;}'
    + '@media (prefers-reduced-motion:reduce){.w354f{transition:opacity 150ms ease;}@starting-style{.w354f{transform:none;}}}'
    /* Applications: the stage bar */
    + '#w354apps{font-family:' + BODY + ';margin:0 0 14px;}'
    + '#w354apps .w354seg{display:flex;gap:4px;padding:4px;background:rgba(16,63,57,.06);border-radius:14px;overflow-x:auto;scrollbar-width:none;}'
    + '#w354apps .w354seg::-webkit-scrollbar{display:none;}'
    + '#w354apps .w354seg button{flex:1 1 0;min-width:96px;border:0;background:transparent;border-radius:11px;padding:9px 12px 8px;cursor:pointer;text-align:left;font:inherit;color:' + SOFT + ';}'
    + '#w354apps .w354seg button b{display:block;font:600 24px/1 ' + HEAD + ';color:' + GREEN + ';letter-spacing:.01em;}'
    + '#w354apps .w354seg button span{display:block;font-size:12.5px;font-weight:600;margin-top:3px;white-space:nowrap;}'
    + '#w354apps .w354seg button[aria-selected=true]{background:#fff;color:' + GREEN + ';box-shadow:0 1px 2px rgba(16,63,57,.10),0 4px 14px rgba(16,63,57,.06);}'
    + '#w354apps .w354seg button.drop{background:rgba(220,165,39,.22);}'
    + '@media (hover:hover) and (pointer:fine){#w354apps .w354seg button:hover:not([aria-selected=true]){background:rgba(255,255,255,.55);}}'
    + '#w354apps .w354seg button.dim b{color:rgba(16,63,57,.35);}'
    /* wave356: Closed is its own category, set apart from the flow */
    + '#w354apps .w354seg .w354sep{flex:0 0 1px;align-self:stretch;margin:6px 4px;background:rgba(16,63,57,.16);}'
    + '#w354apps .w354seg button.cl{flex:0 1 auto;}#w354apps .w354seg button.cl b{color:' + SOFT + ';}'
    + '#hrcentre[data-w354v=list] #w197apps .w197closed > button[data-w197a=closed]{display:none!important;}'
    + '#hrcentre[data-w354v=list]:not([data-w354s=closed]) #w197apps .w197closed > div{display:none!important;}'
    + '#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197board{display:none!important;}'
    + '#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197closed{margin-top:0;}'
    + '#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197closed > div{background:#fff;border:1px solid ' + LINE + ';border-radius:18px;padding:4px 0;box-shadow:0 1px 2px rgba(16,63,57,.04);}'
    + '#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197closed .w197cand{display:grid!important;grid-template-columns:minmax(180px,1fr) minmax(0,2fr);column-gap:18px;row-gap:2px;width:100%!important;margin:0!important;border:0!important;border-top:1px solid ' + LINE + '!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:13px 18px!important;text-align:left;}'
    + '#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197closed .w197cand:first-of-type{border-top:0!important;}'
    + '#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197closed .w197cand > b,#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197closed .w197cand > .r{grid-column:1;}'
    + '#hrcentre[data-w354v=list][data-w354s=closed] #w197apps .w197closed .w197cand > :not(b):not(.r){grid-column:2;grid-row:1 / span 3;align-self:center;}'
    + '#hrcentre[data-w354v=list] #w197apps .w354cap > .w197cand:nth-of-type(n+16){display:none!important;}'
    /* wave356: the sheet's stage, as the flow from New to Hired, with closing set apart */
    + '#w197sheet .w356flow{display:flex;gap:0;margin:6px 0 4px;padding:0;background:none;}'
    + '#w197sheet .w356flow button{all:unset;box-sizing:border-box;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;position:relative;padding:2px 2px 4px;font:600 12.5px ' + BODY + ';color:' + SOFT + ';text-align:center;-webkit-tap-highlight-color:transparent;}'
    + '#w197sheet .w356flow button:before{content:"";position:absolute;top:15px;right:50%;width:100%;height:2px;background:rgba(16,63,57,.14);z-index:0;}'
    + '#w197sheet .w356flow button:first-child:before{display:none;}'
    + '#w197sheet .w356flow button.done:before,#w197sheet .w356flow button.on:before{background:' + GREEN + ';}'
    + '#w197sheet .w356flow i{position:relative;z-index:1;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 15px/1 ' + HEAD + ';font-style:normal;background:#fff;border:2px solid rgba(16,63,57,.22);color:' + SOFT + ';transition:transform 160ms ' + EASE + ',background-color 160ms ease;}'
    + '#w197sheet .w356flow button.done i{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}'
    + '#w197sheet .w356flow button.on i{background:' + GOLD + ';border-color:' + GOLD + ';color:' + GREEN + ';box-shadow:0 0 0 4px rgba(220,165,39,.22);}'
    + '#w197sheet .w356flow button.on span{color:' + GREEN + ';}#w197sheet .w356flow button.done span{color:' + GREEN + ';}'
    + '#w197sheet .w356flow button:active i{transform:scale(.92);}'
    + '#w197sheet .w356flow button:focus-visible i{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + '#w197sheet .w356flow.shut button i{background:#fff;border-color:rgba(16,63,57,.18);color:rgba(16,63,57,.4);box-shadow:none;}#w197sheet .w356flow.shut button:before{background:rgba(16,63,57,.12);}#w197sheet .w356flow.shut button span{color:rgba(16,63,57,.5);}'
    + '#w197sheet .w356cl{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0 2px;padding:10px 12px;border-radius:12px;background:rgba(16,63,57,.04);font:13px ' + BODY + ';color:' + SOFT + ';}'
    + '#w197sheet .w356cl > span{margin-right:4px;}#w197sheet .w356cl > span b{color:' + FLAG + ';}'
    + '#w197sheet .w356cl button{font-size:12.5px!important;padding:5px 11px!important;}'
    + '@media (prefers-reduced-motion:reduce){#w197sheet .w356flow button:active i{transform:none;}}'
    + '#w354apps .w354tip{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:10px 2px 0;font-size:13.5px;color:' + SOFT + ';line-height:1.45;}'
    + '#w354apps .w354tip b{color:' + GREEN + ';}#w354apps .w354tip > span:first-child{flex:1 1 320px;min-width:0;}#w354apps .w354tip i{font-style:normal;color:' + FLAG + ';font-weight:600;}'
    + '#w354apps .w354view{display:inline-flex;padding:3px;background:rgba(16,63,57,.06);border-radius:10px;}'
    + '#w354apps .w354view button{border:0;background:transparent;border-radius:8px;padding:5px 12px;font:600 12.5px ' + BODY + ';color:' + SOFT + ';cursor:pointer;}'
    + '#w354apps .w354view button[aria-pressed=true]{background:#fff;color:' + GREEN + ';box-shadow:0 1px 2px rgba(16,63,57,.10);}'
    /* Applications as a list: only the chosen stage, rows instead of cards */
    + '#hrcentre[data-w354v=list] #w197apps .w197board{display:block!important;overflow:visible!important;grid-template-columns:none!important;}'
    + '#hrcentre[data-w354v=list] #w197apps .w197col{display:none!important;}'
    + '#hrcentre[data-w354v=list][data-w354s=new] #w197apps .w197col[data-w197col=new],#hrcentre[data-w354v=list][data-w354s=reviewing] #w197apps .w197col[data-w197col=reviewing],'
    + '#hrcentre[data-w354v=list][data-w354s=interview] #w197apps .w197col[data-w197col=interview],#hrcentre[data-w354v=list][data-w354s=offer] #w197apps .w197col[data-w197col=offer],'
    + '#hrcentre[data-w354v=list][data-w354s=hired] #w197apps .w197col[data-w197col=hired]{display:block!important;width:auto!important;min-width:0!important;max-width:none!important;background:#fff!important;border:1px solid ' + LINE + '!important;border-radius:18px!important;padding:4px 0!important;box-shadow:0 1px 2px rgba(16,63,57,.04)!important;}'
    + '#hrcentre[data-w354v=list] #w197apps .w197col > h4{display:none!important;}'
    + '#hrcentre[data-w354v=list] #w197apps .w197cand{display:grid!important;grid-template-columns:minmax(180px,1fr) minmax(0,2fr);column-gap:18px;row-gap:2px;align-items:start;width:100%!important;margin:0!important;border:0!important;border-radius:0!important;border-top:1px solid ' + LINE + '!important;box-shadow:none!important;background:transparent!important;padding:13px 18px!important;text-align:left;transition:background-color 160ms ease;}'
    + '#hrcentre[data-w354v=list] #w197apps .w197cand:first-of-type{border-top:0!important;}'
    + '#hrcentre[data-w354v=list] #w197apps .w197cand > b{grid-column:1;font-size:15px;}'
    + '#hrcentre[data-w354v=list] #w197apps .w197cand > .r{grid-column:1;}'
    + '#hrcentre[data-w354v=list] #w197apps .w197cand > :not(b):not(.r){grid-column:2;grid-row:1 / span 3;align-self:center;}'
    + '@media (hover:hover) and (pointer:fine){#hrcentre[data-w354v=list] #w197apps .w197cand:hover{background:rgba(16,63,57,.035)!important;}}'
    + '#hrcentre[data-w354v=list] #w197apps .w197col.w354cap .w197cand:nth-of-type(n+16){display:none!important;}'
    + '#hrcentre[data-w354v=list] #w197apps .w354more{display:block;width:100%;border:0;border-top:1px solid ' + LINE + ';background:transparent;padding:12px 18px;font:600 13.5px ' + BODY + ';color:' + GREEN + ';text-align:left;cursor:pointer;}'
    + '#hrcentre[data-w354v=list] #w197apps .w354empty{padding:22px 18px;color:' + SOFT + ';font-size:14px;}'
    + '#hrcentre:not([data-w354v=list]) #w197apps .w354more,#hrcentre:not([data-w354v=list]) #w197apps .w354empty{display:none;}'
    + '@media (max-width:700px){#hrcentre[data-w354v=list] #w197apps .w197cand{grid-template-columns:1fr;}#hrcentre[data-w354v=list] #w197apps .w197cand > :not(b):not(.r){grid-column:1;grid-row:auto;}}';
  document.head.appendChild(css);

  /* =================== 1. onboarding: the send button and form =================== */
  var ON = { open: {}, day: {}, busy: {}, err: {} };
  function defaultDay(x) { var d = String(x.first_day || x.offer_start || '').slice(0, 10), t = today(); return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= t ? d : t; }
  function ready(x) { return !!(x.ready_told_at || x.accounts_at); }
  function lines(x) {
    var f = first(x.name) || 'them';
    if (!x.accepted_on) return ['Offer sent ' + (x.offer_sent_at ? short(x.offer_sent_at) : '') + '; waiting for ' + f + ' to accept'];
    return ['Accepted ' + short(x.accepted_on), ready(x) ? 'Their accounts are set up. Ready for their onboarding email.' : 'The Hub is setting up their accounts.'];
  }
  function buttons(x, hr, S) {
    var id = x.flow_id, A = S && S.act ? S.act[id] : null, b = [];
    if (x.accepted_on) b.push('<button type="button" class="o271b pri" data-w354a="open" data-f="' + E(id) + '"' + (ON.open[id] ? ' disabled' : '') + '>Send their onboarding</button>');
    if (!x.welcome_sent_at) b.push('<button type="button" class="o271b" data-o275a="open" data-kind="welcome" data-f="' + E(id) + '"' + (A && A.kind === 'welcome' ? ' disabled' : '') + '>Edit the welcome email</button>');
    if (hr) b.push('<button type="button" class="o271b" data-o275a="open" data-kind="mgr" data-f="' + E(id) + '"' + (A && A.kind === 'mgr' ? ' disabled' : '') + '>Change manager</button>');
    b.push('<button type="button" class="o271b dng" data-o271a="act" data-kind="back" data-f="' + E(id) + '"' + (A && A.kind === 'back' ? ' disabled' : '') + '>They backed out</button>');
    return '<div class="o271btns">' + b.join('') + '</div>' + (x.accepted_on && ON.open[id] ? form(x) : '');
  }
  function form(x) {
    var id = x.flow_id, t = today(), d = ON.day[id] || defaultDay(x), busy = ON.busy[id], f = first(x.name) || 'them';
    return '<div class="w354f" data-w354f="' + E(id) + '"><label for="w354d' + E(id) + '">First day</label>'
      + '<input type="date" id="w354d' + E(id) + '" data-w354day="' + E(id) + '" min="' + E(t) + '" value="' + E(d) + '"' + (busy ? ' disabled' : '') + '>'
      + '<p>' + E(f) + ' gets the welcome email with their login, their setup checklist, their weekly meeting and their documents. Their plan starts on ' + E(dayWords(d)) + '. Set up their first meeting with them yourself.</p>'
      + (ON.err[id] ? '<p class="err" role="alert">' + E(ON.err[id]) + '</p>' : '')
      + '<div class="go"><button type="button" class="o271b pri" data-w354a="go" data-f="' + E(id) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Sending…' : 'Send now') + '</button>'
      + '<button type="button" class="o271b" data-w354a="cancel" data-f="' + E(id) + '"' + (busy ? ' disabled' : '') + '>Cancel</button></div></div>';
  }
  function repaint() { try { if (window.o271R && window.o271R.paint) window.o271R.paint(); } catch (e) { /* fine */ } try { if (window.w285 && window.w285.paintAll) window.w285.paintAll(); } catch (e) { /* fine */ } }
  async function send(id) {
    var O = window.o271, R = window.o271R; if (!O || !O.run || ON.busy[id]) return;
    var t = today(), d = ON.day[id];
    var row = rowOf(id);
    if (!d) d = row ? defaultDay(row) : t;
    if (d < t) { ON.err[id] = 'Pick a first day from today on.'; repaint(); return; }
    ON.busy[id] = true; ON.err[id] = ''; repaint();
    try {
      var r = await O.run('send_onboarding', { flow_id: Number(id), first_day: d });
      delete ON.open[id]; delete ON.day[id];
      toastS(r && r.repeated ? 'It had already gone out.' : 'Sent. ' + (row ? first(row.name) : 'They') + ' has their onboarding email.');
      try { if (R && R.load) await R.load(); } catch (e) { /* the next visit loads */ }
    } catch (e) { ON.err[id] = String((e && e.message) || e); }
    delete ON.busy[id]; repaint();
  }
  function rowOf(id) { try { var S = window.o271.state(); return (S.ready || []).filter(function (x) { return String(x.flow_id) === String(id); })[0] || null; } catch (e) { return null; } }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var pre = t.closest('[data-w354pre]');
    if (pre) { ON.open[pre.getAttribute('data-w354pre')] = true; return; }   /* Needs you and Home: open the panel with the form already open (their own handler opens it) */
    var a = t.closest('[data-w354a]'); if (!a) return;
    e.preventDefault(); var id = a.getAttribute('data-f'), k = a.getAttribute('data-w354a');
    if (k === 'open') { ON.open[id] = true; ON.err[id] = ''; repaint(); setTimeout(function () { var i = document.querySelector('[data-w354a="go"][data-f="' + String(id).replace(/"/g, '') + '"]'); if (i) try { i.focus({ preventScroll: true }); } catch (x) { /* fine */ } }, 60); }
    else if (k === 'cancel') { delete ON.open[id]; delete ON.err[id]; repaint(); }
    else if (k === 'go') send(id);
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute || !t.hasAttribute('data-w354day')) return;
    ON.day[t.getAttribute('data-w354day')] = t.value; repaint();
  }, true);

  /* =================== 2. Applications =================== */
  var STAGES = [['new', 'New', 'Read each one. Move the ones worth a call to Reviewing; close the rest.'],
    ['reviewing', 'Reviewing', 'Call them. When an interview is booked, move them to Interview.'],
    ['interview', 'Interview', 'After the interview, add your impressions, then move them to Offer or close.'],
    ['offer', 'Offer', 'The offer is out. When they accept, the Hub sets up their accounts and tells you on Slack.'],
    ['hired', 'Hired', 'They are on the team. Onboarding takes it from here.']];
  var AP = { v: store('w354v') === 'board' ? 'board' : 'list', s: store('w354s') || '', all: {} };
  function onApps() { var p = document.getElementById('hrcentre'); return !!p && p.getAttribute('data-w197') === 'applications' && !!document.getElementById('w197apps'); }
  function closedCount() { var b = document.querySelector('#w197apps .w197closed > button[data-w197a="closed"]'); var m = b && /(\d+)/.exec(b.textContent || ''); return m ? Number(m[1]) : 0; }
  function counts() {
    var out = { closed: closedCount() };
    STAGES.forEach(function (s) { var c = document.querySelector('#w197apps .w197col[data-w197col="' + s[0] + '"]'); out[s[0]] = c ? c.querySelectorAll('.w197cand').length : 0; });
    return out;
  }
  function stageNow(n) {
    if (AP.s === 'closed' && n.closed) return 'closed';
    if (AP.s && STAGES.some(function (s) { return s[0] === AP.s; })) return AP.s;
    var firstWith = STAGES.filter(function (s) { return n[s[0]] > 0; })[0];
    return firstWith ? firstWith[0] : 'new';
  }
  var painting = false;
  function paintApps() {
    if (painting) return; painting = true;
    try {
      var p = document.getElementById('hrcentre'), apps = document.getElementById('w197apps');
      if (onApps()) loadDone();
      if (!onApps()) { if (p) { p.removeAttribute('data-w354v'); p.removeAttribute('data-w354s'); } var old = document.getElementById('w354apps'); if (old) old.remove(); return; }
      var n = counts(), s = stageNow(n), st = s === 'closed' ? ['closed', 'Closed', 'Declined, withdrawn, sent to volunteering, or onboarded (hires 30 days on with their onboarding complete). Open someone to read their file, or move them back into the flow.'] : STAGES.filter(function (x) { return x[0] === s; })[0];
      /* Closed: the board's own closed list, opened */
      if (s === 'closed' && AP.v === 'list') { try { var W = w197.state(); if (!W.showClosed) { W.showClosed = true; painting = false; w197.paintBoard(); return; } } catch (x) { /* fine */ } }
      /* how many in this stage have waited a month or more (the card's "N days here") */
      var waited = 0;
      [].forEach.call(document.querySelectorAll('#w197apps .w197col[data-w197col="' + s + '"] .w197cand .age'), function (a) { var d = parseInt(a.textContent, 10); if (d >= 30) waited++; });
      if (p.getAttribute('data-w354v') !== AP.v) p.setAttribute('data-w354v', AP.v);
      if (p.getAttribute('data-w354s') !== s) p.setAttribute('data-w354s', s);
      var nav = document.getElementById('w354apps');
      if (!nav) { nav = document.createElement('div'); nav.id = 'w354apps'; apps.parentNode.insertBefore(nav, apps); }
      if (nav.getAttribute('data-w197s') !== 'applications') nav.setAttribute('data-w197s', 'applications');   /* wave197 shows a block of this sub-page only with w197on */
      if (!nav.classList.contains('w197on')) nav.classList.add('w197on');
      else if (nav.nextElementSibling !== apps) apps.parentNode.insertBefore(nav, apps);
      var html = '<div class="w354seg" role="tablist" aria-label="Stages">' + STAGES.map(function (x) {
          var on = AP.v === 'list' && x[0] === s;
          return '<button type="button" role="tab" aria-selected="' + on + '" data-w354st="' + x[0] + '" class="' + (n[x[0]] ? '' : 'dim') + '"><b>' + n[x[0]] + '</b><span>' + x[1] + '</span></button>';
        }).join('') + '<span class="w354sep" aria-hidden="true"></span><button type="button" role="tab" aria-selected="' + (AP.v === 'list' && s === 'closed') + '" data-w354st="closed" class="cl' + (n.closed ? '' : ' dim') + '"><b>' + n.closed + '</b><span>Closed</span></button></div>'
        + '<div class="w354tip"><span>' + (AP.v === 'list' ? '<b>' + E(st[1]) + ':</b> ' + E(st[2]) + (waited && (s === 'new' || s === 'reviewing') ? ' <i>' + waited + ' ' + (waited === 1 ? 'has' : 'have') + ' waited a month or more.</i>' : '') + (s === 'closed' ? '' : ' Open someone to decide, or drag them onto a stage above.') : 'Every stage side by side. Drag a card to move it.') + '</span>'
        + '<span class="w354view" role="group" aria-label="View"><button type="button" data-w354v="list" aria-pressed="' + (AP.v === 'list') + '">List</button><button type="button" data-w354v="board" aria-pressed="' + (AP.v === 'board') + '">Board</button></span></div>';
      if (nav.__h !== html) { nav.innerHTML = html; nav.__h = html; }
      /* the chosen stage: 15 rows, then Show all; an empty stage says so */
      var col = s === 'closed' ? document.querySelector('#w197apps .w197closed > div') : document.querySelector('#w197apps .w197col[data-w197col="' + s + '"]');
      if (col) {
        var k = col.querySelectorAll('.w197cand').length, cap = k > 15 && !AP.all[s];
        col.classList.toggle('w354cap', cap);
        var more = col.querySelector('.w354more'), empty = col.querySelector('.w354empty');
        if (cap && !more) { more = document.createElement('div'); more.className = 'w354more'; more.setAttribute('role', 'button'); more.tabIndex = 0; col.appendChild(more); }
        if (more) { if (cap) more.textContent = 'Show all ' + k + ' (' + (k - 15) + ' more)'; else more.remove(); }
        if (!k && !empty && s !== 'closed') { empty = document.createElement('div'); empty.className = 'w354empty'; empty.textContent = 'No one at this stage' + (document.getElementById('w197q') && document.getElementById('w197q').value ? ' for this search.' : '.'); col.appendChild(empty); }
        else if (k && empty) empty.remove();
      }
    } finally { painting = false; }
  }
  var pend = false;
  function soon() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; paintApps(); }); }
  new MutationObserver(function (m) { if (painting) return; if (m.some(function (r) { return !r.target.closest || !r.target.closest('#w354apps'); })) soon(); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-w197'] });
  window.addEventListener('hashchange', function () { setTimeout(soon, 60); });
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest('[data-w354st]');
    if (b) { AP.s = b.getAttribute('data-w354st'); store('w354s', AP.s); if (AP.v !== 'list') { AP.v = 'list'; store('w354v', 'list'); } soon(); return; }
    var v = t.closest('[data-w354v]');
    if (v && v.closest('#w354apps')) { AP.v = v.getAttribute('data-w354v'); store('w354v', AP.v); soon(); return; }
    var m = t.closest('.w354more');
    if (m) { var p = document.getElementById('hrcentre'); AP.all[p ? p.getAttribute('data-w354s') : ''] = true; soon(); }
  });
  document.addEventListener('keydown', function (e) { var t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('w354more')) { e.preventDefault(); t.click(); } });
  /* a row dropped onto a stage moves it, through the board's own move (its gates ask what each stage needs) */
  document.addEventListener('dragover', function (e) { var b = e.target && e.target.closest && e.target.closest('[data-w354st]'); if (!b || !window.w197 || b.getAttribute('data-w354st') === 'closed') return; e.preventDefault(); b.classList.add('drop'); });
  document.addEventListener('dragleave', function (e) { var b = e.target && e.target.closest && e.target.closest('[data-w354st]'); if (b) b.classList.remove('drop'); });
  document.addEventListener('drop', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w354st]'); if (!b || !window.w197) return;
    e.preventDefault(); b.classList.remove('drop');
    var id = null; try { id = (w197.state() || {}).drag; } catch (x) { /* fine */ }
    if (id == null) { try { id = e.dataTransfer.getData('text/plain'); } catch (x) { /* fine */ } }
    if (id != null && id !== '') { try { w197.moveTo(id, b.getAttribute('data-w354st')); } catch (x) { /* fine */ } }
  });
  /* wave356: the sheet's stage. New to Hired as one flow (done, here, ahead); Declined, Withdrawn and Volunteering set apart as closing it.
     The buttons keep data-w197st inside .stg, so wave197's handler (and its gates) and the walkthroughs work as before. */
  function flow(c, ST, CL) {
    var st = c && c.status || 'new', at = ST.map(function (p) { return p[0]; }).indexOf(st), shut = at < 0;
    var h = '<div class="stg w356flow' + (shut ? ' shut' : '') + '" role="list" aria-label="Where they are">' + ST.map(function (p, i) {
      var cls = shut ? '' : i < at ? 'done' : i === at ? 'on' : '';
      return '<button type="button" role="listitem" data-w197st="' + p[0] + '" class="' + cls + '"' + (i === at ? ' aria-current="step"' : '') + ' title="' + (i === at ? 'Here now' : 'Move to ' + E(p[1])) + '"><i>' + (cls === 'done' ? '\u2713' : (i + 1)) + '</i><span>' + E(p[1]) + '</span></button>';
    }).join('') + '</div>';
    var name = shut ? (CL.filter(function (p) { return p[0] === st; })[0] || [st, st])[1] : '';
    h += '<div class="stg w356cl">' + (shut ? '<span>Closed: <b>' + E(name) + '</b>. Pick a step above to bring them back.</span>' : '<span>Not moving forward?</span>')
      + CL.filter(function (p) { return p[0] !== st; }).map(function (p) { return '<button type="button" data-w197st="' + p[0] + '" class="cl">' + E(p[0] === 'volunteering' ? 'Send to volunteering' : p[1]) + '</button>'; }).join('') + '</div>';
    return h;
  }
  /* wave357 (18/11/26, Steel: "Those that have been in hired for over 30 days should be put into closed as long as they have their onboarding complete"):
     a hire 30 days past Hired (stage_at, else the day they accepted) whose onboarding is complete shows under Closed as Onboarded. Their stage stays
     Hired: nothing is written, no Slack goes out. */
  var DONE = null, doneLoading = false;
  function loadDone() {
    if (doneLoading || DONE || typeof db === 'undefined') return; doneLoading = true;
    db.from('onboardings').select('member_id,status').eq('status', 'completed').limit(1000).then(function (r) {
      DONE = {}; ((r && r.data) || []).forEach(function (o) { if (o.member_id != null) DONE[o.member_id] = true; });
      doneLoading = false; try { if (window.w197 && onApps()) w197.paintBoard(); } catch (e) { /* fine */ }
    }, function () { doneLoading = false; });
  }
  function doneHire(c) {
    if (!c || c.status !== 'hired' || !DONE || c.member_id == null || !DONE[c.member_id]) return false;
    var t = c.stage_at || c.accepted_on; if (!t) return false;
    return (Date.now() - new Date(/T/.test(t) ? t : t + 'T12:00:00Z').getTime()) / 86400000 > 30;
  }
  var REASON = { declined: 'Declined', withdrawn: 'Withdrawn', volunteering: 'Sent to volunteering' };
  function closedCard(c, html) {
    var role = ''; try { role = window.w199 ? w199.roleOf(c) : (c.role || ''); } catch (e) { role = c.role || ''; }
    var why = doneHire(c) ? 'Onboarded' : (REASON[c.status] || c.status || 'Closed');
    return String(html).replace('</b>', '</b><span class="r">' + E(role) + '</span><span class="m"><span class="' + (doneHire(c) ? 'ok' : 'cl') + '">' + E(why) + '</span>' + (c.close_reason ? '<span>' + E(String(c.close_reason).slice(0, 60)) + '</span>' : '') + '</span>');
  }
  window.w354 = { doneHire: doneHire, closedCard: closedCard, flow: flow, lines: lines, buttons: buttons, defaultDay: defaultDay, state: function () { return { ON: ON, AP: AP }; }, paintApps: paintApps };
  setTimeout(soon, 400);
})();
