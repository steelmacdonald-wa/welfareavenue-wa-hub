/* =====================================================================
   WA v271 HR onboarding: what HR sees (01/11/26, Build 1 of the automation)
   =====================================================================
   HR Center > Onboarding gets Ready to onboard, above the existing section: everyone who accepted, with their grid status, the time picker
   (the hire's grid, the manager's over it for the 1-on-1, hub@ meetings greyed), the preview, Start onboarding, and a card with each step's
   result, Retry, "I created it, continue" and the changes after Start. Under the list: offers still out, with the email-reply route, and those who backed
   out with what HR takes out by hand (kept KEEP_DAYS, worked out from the flow and its steps). All writes go through the onboard-run edge function; its refusals are
   shown as they come. wa46Render is private to wave46 (its wraps elsewhere never fire), so this wave keeps its section in place with an
   observer, the pattern wave93 uses. The server decides who sees it: wa271_ready_list refuses anyone but HR and admins.
   Times are America/Toronto wall clock, through Intl only: an instant is never made by adding an offset. */
(function () {
  if (window.__wa271) return; window.__wa271 = true;
  var TZ = 'America/Toronto', GREEN = '#103F39', CREAM = '#FFFAF2', GROUND = '#1F201E', PURPLE = '#6F64AB', GOLD = '#DCA527', RED = '#B3402F', LINE = '#DEE0D8', MUTE = '#797773';
  var E = esc;
  var ADDR = /^[a-z0-9][a-z0-9.-]*@welfareavenue\.com$/;
  var FLOW_COLS = 'id, candidate_id, practice, status, manager_member_id, wa_email, call_at, one_on_one_at, group_session, welcome_subject, welcome_text, onboarding_id, slack_channel_id, roster_created, canva_link, started_at, updated_at, created_at, setup_ticks, welcome_sent_at, accounts_at, proposed_at';   /* named: pw_nonce is withheld from the browser. wave275 Task 6: the last five, for the rundown ticks on a started card */
  var STEP_COLS = 'flow_id, step, status, detail, practice, at';
  var CAND_COLS = 'id, name, role, email, member_id';
  var OFFER_COLS = 'id, name, role, status, offer_sent_at, accepted_on';
  var CANVA_LINK = /^https:\/\/www\.canva\.com\/\S*$/;   /* as in onboard-run */
  var CANVA_HOW = 'Canva links last 30 days, so get a new one for each hire: in Canva, go to Invite people, then Get invite link, then Copy.';
  var STEPS = [['roster', 'Roster profile'], ['google', 'Google account'], ['plan', 'Onboarding plan'], ['invites', 'Calendar invites'], ['manager', 'Tell the manager'], ['hub', 'Hub access'], ['slack', 'Slack channel'], ['welcome', 'Welcome email']];
  var WORD = { done: 'Done', skipped: 'Skipped', failed: 'Failed', waiting: 'Waiting', hr_task: 'For HR', running: 'Running', pending: 'Running' };
  var RULE = { reports_to: 'the position reports to them', team_lead: 'they lead the department', chosen: 'chosen by HR', none: 'HR must choose' };
  var STALE_MS = 10 * 60 * 1000;      /* as in onboard-run: a step left running this long was cut off, so Retry may take it */
  var KEEP_DAYS = 30;                 /* a finished flow stays on the list this long after its call, and one that backed out this long after that; then it lives under Onboarding */

  var S = {
    ready: [], started: [], backed: [], offers: [], people: [], cfg: { days: 14, start: 8, end: 21, cell: 30 }, loaded: false, denied: false, err: '', loading: null,
    pick: {},   /* flow id: the open picker and preview */
    act: {},    /* flow id: the open change panel on a card */
    note: {},   /* flow id, or 'c' and a candidate id: { ok, err, warnings } on a card */
    yes: {},    /* candidate id: asking whether they really said yes by email */
    canva: {},  /* flow id: the Canva link being typed on a card */
    welcome: {}, /* flow id: the welcome email as it reads now, {subject, text, edited, sent_at} or {err} */
    pw: null,   /* wave275: the first password's state, {set, set_at}, for admins only; never the password */
    busy: {}
  };
  /* wave275 Task 6: the doors a later wave wraps (docs/ARCHITECTURE.md section 5). This wave calls its loader, painter, cards, change panel and the picker's
     data through R, so wave275 can add the manager's cards and its own card for a flow on the new path without copying this one. */
  var R = window.o271R = { readyStatuses: ['waiting', 'ready'], startedMore: function () { return ''; },
    hrTools: function () { return true; } };   /* false: the person is not HR (wave275's manager view), so HR's own buttons (the link, the preview, I created it) stay off */

  /* ---------- style ---------- */
  var st = document.createElement('style'); st.id = 'o271css';
  st.textContent =
    '.o271 h2{margin:0 0 4px;}' +
    '.o271 .o271sub{font-size:13px;color:' + MUTE + ';margin:0 0 12px;}' +
    '.o271 h3.o271h{font-size:14px;margin:18px 0 8px;color:' + GREEN + ';}' +
    '.o271cd{border:1px solid ' + LINE + ';border-radius:14px;padding:14px;margin:0 0 10px;background:var(--wa-card,' + CREAM + ');min-width:0;}' +
    '.o271top{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;}' +
    '.o271top b{font-size:15px;color:' + GROUND + ';overflow-wrap:anywhere;}' +
    '.o271top span{font-size:13px;color:' + MUTE + ';overflow-wrap:anywhere;}' +
    '.o271tag{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:1px 9px;background:#ECEBE3;color:' + GROUND + ';}' +
    '.o271tag.pr{background:' + PURPLE + ';color:' + CREAM + ';}' +
    '.o271tag.late{background:' + RED + ';color:' + CREAM + ';}' +
    '.o271tag.ok{background:' + GREEN + ';color:' + CREAM + ';}' +
    '.o271tag.no{background:' + RED + ';color:' + CREAM + ';}' +
    '.o271tag.hr{background:' + GOLD + ';color:' + GROUND + ';}' +
    '.o271chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;}' +
    '.o271ln{font-size:13px;margin:4px 0;color:' + GROUND + ';overflow-wrap:anywhere;}' +
    '.o271warn{font-size:13px;margin:6px 0;padding:7px 10px;border-radius:10px;background:rgba(220,165,39,.16);color:' + GROUND + ';overflow-wrap:anywhere;}' +
    '.o271warn.pr{background:rgba(111,100,171,.16);}' +
    '.o271err{font-size:13px;margin:8px 0;padding:7px 10px;border-radius:10px;background:rgba(179,64,47,.12);color:' + RED + ';font-weight:600;overflow-wrap:anywhere;}' +
    '.o271okn{font-size:13px;margin:8px 0;color:' + GREEN + ';font-weight:600;}' +
    '.o271btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}' +
    '.o271b{font:inherit;font-size:13px;font-weight:600;min-height:36px;padding:6px 12px;border-radius:10px;border:1px solid ' + GREEN + ';background:transparent;color:' + GREEN + ';cursor:pointer;}' +
    '.o271b.pri{background:' + GREEN + ';color:' + CREAM + ';}' +
    '.o271b.dng{border-color:' + RED + ';color:' + RED + ';}' +
    '.o271b.dngp{background:' + RED + ';border-color:' + RED + ';color:' + CREAM + ';}' +
    '.o271b:disabled{opacity:.45;cursor:not-allowed;}' +
    '.o271pn{border-top:1px solid ' + LINE + ';margin-top:12px;padding-top:12px;min-width:0;}' +
    '.o271f{display:block;font-size:12px;font-weight:600;color:' + MUTE + ';margin:10px 0 3px;}' +
    '.o271 input[type=text],.o271 input[type=password],.o271 input[type=datetime-local],.o271 select,.o271 textarea{font:inherit;font-size:14px;width:100%;max-width:420px;box-sizing:border-box;min-height:36px;padding:6px 8px;border:1px solid ' + LINE + ';border-radius:8px;background:' + CREAM + ';color:' + GROUND + ';}' +
    '.o271 textarea{max-width:none;min-height:120px;}' +
    '.o271two{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px;}' +
    '.o271said{font-size:12px;color:' + GREEN + ';margin-top:3px;min-height:15px;}' +
    '.o271said.cl{color:' + RED + ';}' +
    '.o271md{display:inline-flex;border:1px solid ' + GREEN + ';border-radius:10px;overflow:hidden;margin:0 0 8px;}' +
    '.o271md button{font:inherit;font-size:13px;font-weight:600;padding:6px 12px;border:none;background:transparent;color:' + GREEN + ';cursor:pointer;min-height:34px;}' +
    '.o271md button.on{background:' + GREEN + ';color:' + CREAM + ';}' +
    '.o271lg{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:' + MUTE + ';margin:0 0 6px;}' +
    '.o271lg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-2px;border:1px solid ' + LINE + ';}' +
    '.o271gw{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;border:1px solid ' + LINE + ';border-radius:10px;background:' + CREAM + ';}' +
    '.o271gw table.o271g{display:table!important;width:auto!important;max-width:none!important;border-collapse:separate;border-spacing:1px;font-size:11px;}' +
    '.o271g th{font-weight:600;color:' + MUTE + ';padding:2px 3px;text-align:center;white-space:nowrap;text-transform:none;letter-spacing:0;background:' + CREAM + ';}' +
    '.o271g thead th{position:sticky;top:0;z-index:2;}' +
    '.o271g tbody th{position:sticky;left:0;z-index:1;text-align:right;padding-right:6px;}' +
    '.o271g td{padding:0;}' +
    '.o271c{display:block;width:42px;height:24px;padding:0;border:1px solid #ECEBE3;border-radius:4px;background:#F4F2EA;cursor:pointer;font:inherit;font-size:9.5px;font-weight:700;color:' + CREAM + ';line-height:1;}' +
    '.o271c.h{background:rgba(16,63,57,.30);border-color:rgba(16,63,57,.30);}' +
    '.o271c.m{background:rgba(111,100,171,.34);border-color:rgba(111,100,171,.34);}' +
    '.o271c.h.m{background:' + GREEN + ';border-color:' + GREEN + ';}' +
    '.o271c.busy{background:repeating-linear-gradient(45deg,#C9C8C1,#C9C8C1 3px,#E6E5DE 3px,#E6E5DE 6px);border-color:#C9C8C1;}' +
    '.o271c.scall,.o271c.sone{background:' + GOLD + ';border-color:' + GROUND + ';color:' + GROUND + ';}' +
    '.o271st{list-style:none;margin:8px 0 0;padding:0;}' +
    '.o271st li{padding:8px 0;border-top:1px solid #ECEBE3;font-size:13px;min-width:0;}' +
    '.o271st li:first-child{border-top:none;}' +
    '.o271st .ttl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:600;color:' + GROUND + ';}' +
    '.o271st .dt{margin:3px 0 0;color:' + GROUND + ';overflow-wrap:anywhere;}' +
    '.o271st .dt.fail{color:' + RED + ';}' +
    '.o271st .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;}' +
    '.o271st .row input{flex:1 1 200px;min-width:0;}' +
    '.o271sw{display:flex;gap:8px;align-items:center;font-size:13px;padding:5px 0;flex-wrap:wrap;color:' + GROUND + ';}' +
    '.o271sw input{width:18px;height:18px;margin:0;flex:none;}' +
    '.o271sw small{color:' + MUTE + ';}' +
    '.o271out{border:1px solid ' + RED + ';border-radius:14px;padding:14px;margin:0 0 10px;}' +
    '.o271out ul{margin:6px 0;padding-left:18px;font-size:13px;}' +
    '.o271out li{margin:3px 0;overflow-wrap:anywhere;}' +
    '.o271pre{white-space:pre-wrap;font-size:13px;margin:4px 0;padding:8px 10px;border:1px solid ' + LINE + ';border-radius:8px;background:' + CREAM + ';color:' + GROUND + ';overflow-wrap:anywhere;}' +
    '@media (max-width:700px){.o271cd{padding:12px;}.o271c{height:30px;}.o271gw{max-height:62vh;overflow:auto;}.o271 input[type=text],.o271 input[type=datetime-local],.o271 select{max-width:none;}}';
  document.head.appendChild(st);

  /* ---------- times: Toronto wall clock, through Intl only ---------- */
  var PARTS = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  function wall(at) {
    var o = {}; PARTS.formatToParts(new Date(at)).forEach(function (p) { o[p.type] = p.value; });
    var h = Number(o.hour) % 24, mi = Number(o.minute);
    return { y: Number(o.year), mo: Number(o.month), d: Number(o.day), h: h, mi: mi, date: o.year + '-' + o.month + '-' + o.day, mins: h * 60 + mi };
  }
  /* the value for a datetime-local box */
  function toLocal(at) { var w = wall(at); return w.date + 'T' + pad2(w.h) + ':' + pad2(w.mi); }
  /* a typed Toronto wall clock to an instant (ms): ask Intl what wall clock a guess reads as, and move by the difference. null when it cannot be read, or the clock skips that time */
  function toInstant(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v || '')); if (!m) return null;
    var want = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]), guess = want;
    for (var i = 0; i < 3; i++) { var w = wall(guess); var diff = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - want; if (!diff) return guess; guess -= diff; }
    return null;
  }
  var isoOf = function (v) { var ms = toInstant(v); return ms == null ? null : new Date(ms).toISOString(); };
  function whenText(at) { try { return new Date(at).toLocaleString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' Toronto'; } catch (e) { return String(at); } }
  function dayText(d) { try { return new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }); } catch (e) { return String(d); } }

  /* ---------- the edge function: a refusal comes back as its own sentence ---------- */
  async function say(err) {
    try {
      var ctx = err && err.context;
      if (ctx && typeof ctx.json === 'function') {
        var j = await (typeof ctx.clone === 'function' ? ctx.clone() : ctx).json();
        if (j && (j.message || j.error)) return String(j.message || j.error);
      }
    } catch (e) { /* its own message, below */ }
    return String((err && err.message) || err || 'The Hub could not do that. Try again.');
  }
  async function run(action, body) {
    var r;
    try { r = await db.functions.invoke('onboard-run', { body: Object.assign({ action: action }, body || {}) }); }
    catch (e) { throw new Error(await say(e)); }
    if (r && r.error) throw new Error(await say(r.error));
    var d = (r && r.data) || {};
    if (d.error) throw new Error(String(d.message || d.error));
    return d;
  }

  /* ---------- reads ---------- */
  function hrPage() { return typeof window.wa46IsHr === 'function' && window.wa46IsHr(); }
  function surelyHr() { try { return WA40_MINE.role === 'admin' || WA40_MINE.profile === 'hr'; } catch (e) { return false; } }
  /* the flows Start has begun, and the ones that backed out: each kept KEEP_DAYS */
  async function readStarted() {
    var f = await db.from('hub_onboard_flows').select(FLOW_COLS).in('status', ['running', 'started', 'backed_out']);
    if (f.error) throw f.error;
    var cut = Date.now() - KEEP_DAYS * 86400000;
    var flows = (f.data || []).filter(function (x) {
      if (x.status === 'backed_out') return !x.updated_at || Date.parse(x.updated_at) >= cut;
      return x.status === 'running' || !x.call_at || Date.parse(x.call_at) >= cut;
    });
    if (!flows.length) return [];
    var ids = flows.map(function (x) { return x.id; }), cids = flows.map(function (x) { return x.candidate_id; });
    var res = await Promise.all([db.from('hub_onboard_steps').select(STEP_COLS).in('flow_id', ids), db.from('hub_candidates').select(CAND_COLS).in('id', cids)]);
    if (res[0].error) throw res[0].error;
    if (res[1].error) throw res[1].error;
    return flows.map(function (x) {
      var c = (res[1].data || []).filter(function (y) { return String(y.id) === String(x.candidate_id); })[0] || {};
      var rows = (res[0].data || []).filter(function (y) { return String(y.flow_id) === String(x.id); });
      return Object.assign({}, x, { name: c.name || 'Someone', role: c.role || '', email: c.email || '', member_id: c.member_id, steps: rows });
    });
  }
  /* an offer that has gone out with no answer on the card, for those who answer by replying to the email */
  async function readOffers() {
    var r = await db.from('hub_candidates').select(OFFER_COLS).eq('status', 'offer');
    if (r.error) throw r.error;
    return (r.data || []).filter(function (c) { return c.status === 'offer' && c.offer_sent_at && !c.accepted_on; });
  }
  async function readPeople() {
    if (S.people.length) return;
    var r = await db.from('team_members').select('id, name, active, email');   /* wave275: the email names who proposed */
    if (!r.error) S.people = (r.data || []).filter(function (p) { return p.name; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }
  async function readCfg() {
    var r = await db.from('app_config').select('key, value').in('key', ['onboard_grid_days', 'onboard_grid_start', 'onboard_grid_end', 'onboard_grid_cell_min']);
    var map = { onboard_grid_days: 'days', onboard_grid_start: 'start', onboard_grid_end: 'end', onboard_grid_cell_min: 'cell' };
    ((r && r.data) || []).forEach(function (x) { var n = Number(x.value); if (map[x.key] && isFinite(n) && n >= 0 && (n > 0 || x.key === 'onboard_grid_start')) S.cfg[map[x.key]] = n; });
  }
  function load() { return R.load(); }
  function loadHr() {
    if (S.loading) return S.loading;
    S.loading = (async function () {
      try {
        var r = await db.rpc('wa271_ready_list');
        if (r && r.error) throw r.error;
        S.denied = false; S.err = '';
        S.ready = ((r && r.data) || []).filter(function (x) { return R.readyStatuses.indexOf(x.status) >= 0; });   /* wave275 adds offered */
        var begun = await readStarted();
        S.started = begun.filter(function (x) { return x.status !== 'backed_out'; });
        S.backed = begun.filter(function (x) { return x.status === 'backed_out'; });
        S.offers = (await readOffers()).filter(function (c) { return !S.ready.some(function (x) { return String(x.candidate_id) === String(c.id); }); });   /* wave275: an offered flow has its own card */
        await readWelcomes(S.started);
        await Promise.all([readPeople(), readCfg(), readPw()]);
      } catch (e) {
        var msg = String((e && e.message) || e);
        if (/Only HR/i.test(msg) || !surelyHr()) S.denied = true;
        else S.err = 'The Hub could not load this list: ' + msg;
      }
      S.loaded = true; S.loading = null;
      /* a picker or panel for someone who has left the list goes with them */
      Object.keys(S.pick).forEach(function (id) { if (!S.ready.some(function (x) { return String(x.flow_id) === id; })) delete S.pick[id]; });
      Object.keys(S.act).forEach(function (id) { if (!flowOf(id)) delete S.act[id]; });
      paint();
    })();
    return S.loading;
  }
  R.load = loadHr;

  /* ---------- Ready to onboard: one card ---------- */
  function warnBox(w) { return '<div class="o271warn' + (/practice applicant/i.test(w) ? ' pr' : '') + '">' + E(w) + '</div>'; }
  function noteHtml(id) {
    var n = S.note[id]; if (!n) return '';
    return (n.ok ? '<div class="o271okn">' + E(n.ok) + '</div>' : '') + (n.warnings || []).map(warnBox).join('') + (n.err ? '<div class="o271err">' + E(n.err) + '</div>' : '');
  }
  function managerLine(x) {
    if (x.manager_member_id) return 'Manager: ' + E(nameOf(x.manager_member_id)) + ' (' + E(RULE.chosen) + ')';
    var m = x.default_manager;
    if (m && m.member_id) return 'Manager: ' + E(m.name) + ' (' + E(RULE[m.how] || m.how) + ')';
    return 'Manager: ' + E(RULE.none);
  }
  function readyCard(x) {
    var other = Number(x.other_open_rows) || 0, id = x.flow_id, P = S.pick[id];
    return '<div class="o271cd" data-o271flow="' + E(id) + '">'
      + '<div class="o271top"><b>' + E(x.name) + '</b><span>' + E(x.role || '') + '</span>' + (x.practice ? '<i class="o271tag pr" style="font-style:normal">Practice</i>' : '') + '</div>'
      + '<div class="o271chips">'
      + '<span class="o271tag' + (x.grids && x.grids.hire === 'marked' ? ' ok' : '') + '">New hire\'s grid: ' + (x.grids && x.grids.hire === 'marked' ? 'marked' : 'not marked yet') + '</span>'
      + '<span class="o271tag' + (x.grids && x.grids.manager === 'marked' ? ' ok' : '') + '">Manager\'s grid: ' + (x.grids && x.grids.manager === 'marked' ? 'marked' : 'not marked yet') + '</span>'
      + (x.late ? '<span class="o271tag late">Answered after the reply-by date</span>' : '')
      + '</div>'
      + '<div class="o271ln">' + (x.accepted_on ? 'Accepted ' + E(dayText(x.accepted_on)) : '') + (x.offer_start ? ' &middot; The offer suggested ' + E(dayText(x.offer_start)) : '') + '</div>'
      + '<div class="o271ln">' + managerLine(x) + '</div>'
      + (other ? warnBox('This person has ' + other + ' other application' + (other === 1 ? '' : 's') + ' still open. Close ' + (other === 1 ? 'it' : 'them') + ' by hand so they do not get a second account.') : '')
      + noteHtml(id)
      + '<div class="o271btns">' + (R.hrTools() ? '<button type="button" class="o271b" data-o271a="link" data-f="' + E(id) + '" data-cand="' + E(x.candidate_id) + '"' + (S.busy['l' + id] ? ' disabled' : '') + '>Send the availability link</button>'
      + '<button type="button" class="o271b pri" data-o271a="open" data-f="' + E(id) + '"' + (S.busy['o' + id] ? ' disabled' : '') + '>' + (P ? 'Close' : 'Choose times and preview') + '</button>' : '')
      + '<button type="button" class="o271b dng" data-o271a="act" data-kind="back" data-f="' + E(id) + '"' + (S.act[id] ? ' disabled' : '') + '>They backed out</button></div>'
      + (S.act[id] ? R.panelHtml(flowOf(id), S.act[id]) : '')
      + (P ? pickHtml(x, P) : '')
      + '</div>';
  }
  R.readyCard = readyCard;
  /* an offer still out: an answer by email has its own button, and asks first */
  function offerCard(c) {
    var id = c.id, asking = S.yes[id], busy = S.busy['y' + id];
    return '<div class="o271cd" data-o271offer="' + E(id) + '">'
      + '<div class="o271top"><b>' + E(c.name) + '</b><span>' + E(c.role || '') + '</span></div>'
      + '<div class="o271ln">Offer sent ' + E(dayText(c.offer_sent_at)) + '</div>'
      + noteHtml('c' + id)
      + (asking
        ? '<div class="o271ln"><b>Did ' + E(c.name) + ' say yes?</b> The Hub saves that they accepted today and emails them the availability link.</div>'
          + '<div class="o271btns"><button type="button" class="o271b pri" data-o271a="yesgo" data-cand="' + E(id) + '"' + (busy ? ' disabled' : '') + '>Yes, send the link</button><button type="button" class="o271b" data-o271a="yesno" data-cand="' + E(id) + '">Cancel</button></div>'
        : '<div class="o271btns"><button type="button" class="o271b" data-o271a="yesask" data-cand="' + E(id) + '">They said yes by email: send the availability link</button></div>')
      + '</div>';
  }
