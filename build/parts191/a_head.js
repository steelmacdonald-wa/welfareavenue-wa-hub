/* =====================================================================
   WA v191 the Volunteer Manager's flow (01/10/26)
   =====================================================================
   Steel (01/10/26): "our operations team needs the Volunteer manager to be easy to use and make each part of the event
   planning process as seamless as possible. There's a lot of information everywhere and I'd like to clean it up and
   better show the flow of our event planning process. Please do a full review of the volunteer manager to ensure it has
   Apple UI, but with Clickup's robustness and Welfare Avenue's Montreal operations processes in place."

   The review found two systems side by side: the checklist (the master SOP, 63 steps) still described the manual work
   (the Excel sheet, the Canva itinerary, the email drafts, the WhatsApp asks) while the Hub now does most of it (waves 171
   to 182), nothing ticked when it did, no step had ever been ticked on a real serving, past servings stayed "planned", no
   upcoming serving had its format, and the serving page was one long column of cards from eight waves.

   This wave puts the flow first. Montreal's six stages: Plan, Recruit, Confirm, Prepare, Day of, Wrap up.
   - The serving page: a calm header (date, countdown, format, the stage bar), Next up (the three steps that need a person
     now), then one section per stage, each hosting the cards and the steps that belong to it (the plan and the recipes in
     Plan, the roster board in Recruit, the Texts card in Confirm, the itinerary card in Prepare, the day's contacts in
     Day of, the survey and the recap in Wrap up). The current stage is open; the others fold to one line. Every card the
     earlier waves paint keeps its handlers: this wave only places them.
   - Steps the Hub does tick themselves (the database: wa191_autotick from wa191_signal; sop_template.hub_signal) and say
     so; a person's untick is never overridden. The SOP shows each step's stage, the Hub-done badge, and the Hub's
     proposals for outdated wording (approve or dismiss, leaders, HR, admins; wa191_sop_proposal).
   - The Calendar opens on This week (wa191_this_week): the servings by stage with their next step, overdue steps, steps
     with no owner, and the signed-in person's own steps.
   - Finished servings close themselves the day after (wa191_close_past, cron wa-serving-flow).
   - Retired from the page: the Canva itinerary link, "Build the driver and team leader itinerary" and "Check Quo replies"
     (the Hub's itineraries and the Texts card replaced them). The page's title names the view. "Add an event" shows on
     the calendar only (106 patched). Buttons share one style.
   The database decides who may do what (staff read; leaders, HR and admins decide proposals); sms_mode and mail_mode are
   never switched here; nothing is sent by this wave.
   ===================================================================== */
(function () {
  if (window.__wa191) return; window.__wa191 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E', MUTED = '#797773';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var STAGES = [
    { k: 'plan', l: 'Plan', s: 'The date, the format, the meals and the plan', when: 'More than two weeks out' },
    { k: 'recruit', l: 'Recruit', s: 'Fill the roster for every role', when: 'Two weeks out' },
    { k: 'confirm', l: 'Confirm', s: 'Everyone confirms by text', when: 'Seven days out' },
    { k: 'prepare', l: 'Prepare', s: 'Itineraries, the WhatsApp group, the kit', when: 'The days before' },
    { k: 'day_of', l: 'Day of', s: 'The serving', when: 'The day' },
    { k: 'wrap_up', l: 'Wrap up', s: 'The survey, the thanks, the numbers', when: 'After' }
  ];
  var STAGE_IX = {}; STAGES.forEach(function (s, i) { STAGE_IX[s.k] = i; });
  var FORMATS = { home_cooked: 'Home-cooked', community_kitchen: 'Community kitchen' };
  var ROLE_ORDER = ['team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_talker', 'community_debrief'];
  var S = { ev: null, evAt: 0, guides: null, week: null, weekAt: 0, weekFor: null, open: {}, showAll: false, pend: null, laid: null, ticking: false, ticked: {}, sopPend: null };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : false; } catch (e) { return false; } }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function daysTo(iso) { var a = new Date(todayIso() + 'T12:00:00Z').getTime(), b = new Date(String(iso).slice(0, 10) + 'T12:00:00Z').getTime(); return Math.round((b - a) / 86400000); }
  function fmtDay(iso, long) { if (!iso) return ''; try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', long ? { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' } : { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return String(iso); } }
  function fmtDue(iso) { if (!iso) return ''; var d = daysTo(iso); if (d === 0) return 'today'; if (d === 1) return 'tomorrow'; if (d === -1) return 'yesterday'; if (d < 0) return fmtDay(iso); if (d < 7) return fmtDay(iso).split(',')[0]; return fmtDay(iso); }
  function hm12(s) { var m = String(s || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return ''; var h = Number(m[1]); return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); }
  function roleLabel(r) { try { return typeof waVolRoleLabel === 'function' ? waVolRoleLabel(r) : r; } catch (e) { return r; } }
  function one(r) { var ONE = { team_leader: 'Team leader', cook: 'Cook', driver: 'Driver', server: 'Server', dishwasher: 'Dishwasher', photographer: 'Photographer', community_talker: 'Community welcome', community_debrief: 'Community lead' }; return ONE[r] || String(r || 'volunteer').replace(/_/g, ' ').replace(/^./, function (m) { return m.toUpperCase(); }); }
  function isConf(r) { return lower(r.status) === 'confirmed' || r.confirm_status === 'confirmed'; }
  function isDecl(r) { return lower(r.status) === 'unavailable' || r.confirm_status === 'declined'; }
  function isOff(r) { return lower(r.status) === 'cancelled'; }
  function curEv() { var ev = null; try { (WA_VOL_EVENTS || []).forEach(function (e) { if (e.id === WA_VOL_EVENT) ev = e; }); } catch (e) { /* fine */ } return ev; }
  function curD() { try { return (WA_VOL_DETAIL && WA_VOL_DETAIL.id === WA_VOL_EVENT) ? WA_VOL_DETAIL : null; } catch (e) { return null; } }
  function tmpl() { try { return WA_VOL_TMPL || []; } catch (e) { return []; } }
  function stageOf(date, status) {
    if (status === 'cancelled') return 'cancelled'; if (status === 'completed') return 'done';
    var d = daysTo(date);
    if (d < 0) return 'wrap_up'; if (d === 0) return 'day_of'; if (d <= 2) return 'prepare'; if (d <= 7) return 'confirm'; if (d <= 14) return 'recruit'; return 'plan';
  }
  function stageLabel(k) { var s = STAGES[STAGE_IX[k]]; return s ? s.l : k === 'done' ? 'Done' : k === 'cancelled' ? 'Cancelled' : ''; }
  function countdown(ev) { var d = daysTo(ev.event_date); if (ev.status === 'cancelled') return 'Cancelled'; if (ev.status === 'completed') return 'Done'; if (d === 0) return 'Today'; if (d === 1) return 'Tomorrow'; if (d > 1) return d + ' days to go'; if (d === -1) return 'Yesterday'; return Math.abs(d) + ' days ago'; }

  var css = document.createElement('style'); css.id = 'wa191css';
  css.textContent = '' +
    /* one button style for the serving page: the pill (wave171's), in three weights */
    '.w191btn{font-family:' + BODY + ';font-weight:600;font-size:12.5px;line-height:1;padding:9px 14px;border-radius:999px;border:1px solid transparent;cursor:pointer;background:' + GREEN + ';color:' + CREAM + ';display:inline-flex;align-items:center;gap:6px;white-space:nowrap;text-decoration:none;}' +
    '.w191btn.ghost{background:transparent;color:' + GREEN + ';border-color:rgba(16,63,57,.3);}.w191btn.gold{background:' + GOLD + ';color:' + GREEN + ';}.w191btn.quiet{background:rgba(16,63,57,.07);color:' + GREEN + ';}' +
    '.w191btn:hover{filter:brightness(1.06);}.w191btn[disabled]{opacity:.5;cursor:default;}' +
    /* the page's own header */
    '#w191head{background:' + GREEN + ';color:' + CREAM + ';border-radius:22px;padding:22px 24px 18px;margin:6px 0 14px;position:relative;overflow:hidden;font-family:' + BODY + ';}' +
    '#w191head:before{content:"";position:absolute;right:-90px;top:-120px;width:340px;height:340px;border-radius:50%;background:radial-gradient(closest-side,rgba(111,100,171,.45),rgba(111,100,171,0));pointer-events:none;}' +
    '#w191head .k{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:' + GOLD + ';font-weight:700;display:flex;gap:10px;flex-wrap:wrap;align-items:center;position:relative;}' +
    '#w191head .k .fmt{background:rgba(255,250,242,.14);color:' + CREAM + ';border-radius:999px;padding:3px 10px;letter-spacing:.6px;cursor:pointer;border:none;font:inherit;font-size:10.5px;font-weight:800;}#w191head .k .fmt.unset{background:' + GOLD + ';color:' + GREEN + ';}' +
    '#w191head h3{font-family:' + HEAD + ';font-size:40px;line-height:1;margin:8px 0 6px;color:' + CREAM + ';letter-spacing:.3px;font-weight:700;text-transform:uppercase;position:relative;}' +
    '#w191head .meta{font-size:13.5px;color:rgba(255,250,242,.88);display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center;position:relative;}' +
    '#w191head .meta .cd{font-family:' + HEAD + ';font-size:17px;color:' + CREAM + ';}#w191head .meta .cd b{color:' + GOLD + ';font-size:24px;}' +
    '#w191head .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px;position:relative;}' +
    '#w191head .acts .w191btn.ghost{color:' + CREAM + ';border-color:rgba(255,250,242,.35);}#w191head .acts .w191btn.quiet{background:rgba(255,250,242,.14);color:' + CREAM + ';}' +
    '#w191head .more{position:relative;}#w191head .menu{display:none;position:absolute;right:0;top:40px;background:' + CREAM + ';color:' + INK + ';border-radius:14px;box-shadow:0 14px 40px -12px rgba(0,0,0,.45);padding:6px;min-width:220px;z-index:30;}' +
    '#w191head .more.open .menu{display:block;}#w191head .menu button{display:block;width:100%;text-align:left;background:none;border:none;font:inherit;font-size:13px;padding:9px 12px;border-radius:9px;cursor:pointer;color:' + INK + ';}#w191head .menu button:hover{background:rgba(16,63,57,.08);}#w191head .menu button.warn{color:' + FLAG + ';}' +
    /* the stage bar */
    '.w191bar{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:16px;position:relative;}' +
    '.w191bar .st{background:rgba(255,250,242,.10);border-radius:12px;padding:9px 10px 8px;cursor:pointer;border:1px solid transparent;min-width:0;text-align:left;font:inherit;color:' + CREAM + ';}' +
    '.w191bar .st b{display:block;font-family:' + HEAD + ';font-size:16px;letter-spacing:.4px;text-transform:uppercase;line-height:1;}' +
    '.w191bar .st span{display:block;font-size:11px;color:rgba(255,250,242,.75);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.w191bar .st i{display:block;height:4px;border-radius:4px;background:rgba(255,250,242,.18);margin-top:7px;overflow:hidden;}.w191bar .st i:after{content:"";display:block;height:100%;width:var(--p,0%);background:' + GOLD + ';border-radius:4px;}' +
    '.w191bar .st.done i:after{background:' + TEAL + ';width:100%;}.w191bar .st.done span{color:rgba(255,250,242,.65);}' +
    '.w191bar .st.now{background:rgba(255,250,242,.2);border-color:' + GOLD + ';}.w191bar .st.late span{color:#F4C6BD;}.w191bar .st.late i:after{background:' + FLAG + ';}' +
    /* next up */
    '#w191next{margin:0 0 14px;}#w191next .lbl{font-family:' + BODY + ';font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:' + GOLD + ';font-weight:700;margin:0 0 8px;}' +
    '#w191next .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;}' +
    '#w191next .n{background:' + CREAM + ';border:1px solid rgba(16,63,57,.10);border-radius:14px;padding:11px 13px;display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start;box-shadow:0 8px 20px -18px rgba(16,63,57,.6);}' +
    '#w191next .n .tk{width:20px;height:20px;border-radius:50%;border:2px solid rgba(16,63,57,.35);cursor:pointer;margin-top:1px;background:none;padding:0;}#w191next .n .tk:hover{border-color:' + GREEN + ';background:rgba(16,63,57,.08);}' +
    '#w191next .n .go{width:20px;height:20px;border-radius:50%;background:' + GOLD + ';display:flex;align-items:center;justify-content:center;color:' + GREEN + ';font-weight:800;font-size:13px;margin-top:1px;}' +
    '#w191next .n b{display:block;font-size:13.5px;color:' + INK + ';line-height:1.3;}#w191next .n span{display:block;font-size:11.5px;color:' + MUTED + ';margin-top:3px;}#w191next .n span em{font-style:normal;color:' + FLAG + ';font-weight:600;}' +
    '#w191next .n.act{border-color:rgba(220,165,39,.5);background:#FFF8E8;}#w191next .n .w191btn{margin-top:7px;padding:6px 11px;font-size:11.5px;}' +
    /* stage sections */
    '.w191stage{border:1px solid rgba(16,63,57,.10);border-radius:18px;background:' + CREAM + ';margin:0 0 10px;overflow:hidden;font-family:' + BODY + ';}' +
    '.w191stage > .h{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 16px;cursor:pointer;user-select:none;}' +
    '.w191stage > .h .num{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:' + HEAD + ';font-size:17px;font-weight:700;background:rgba(16,63,57,.08);color:' + GREEN + ';}' +
    '.w191stage.now > .h .num{background:' + GOLD + ';color:' + GREEN + ';}.w191stage.done > .h .num{background:' + TEAL + ';color:' + CREAM + ';}.w191stage.late > .h .num{background:' + FLAG + ';color:' + CREAM + ';}' +
    '.w191stage > .h b{font-family:' + HEAD + ';font-size:22px;letter-spacing:.3px;text-transform:uppercase;color:' + GREEN + ';line-height:1;display:block;}' +
    '.w191stage > .h .sub{font-size:12.5px;color:' + MUTED + ';margin-top:3px;display:block;}.w191stage > .h .sub em{font-style:normal;color:' + FLAG + ';font-weight:600;}.w191stage > .h .sub .ok{color:' + TEAL + ';font-weight:600;}' +
    '.w191stage > .h .r{display:flex;align-items:center;gap:10px;font-size:12px;color:' + MUTED + ';white-space:nowrap;}.w191stage > .h .r .chev{transition:transform .2s;color:' + GREEN + ';}.w191stage:not(.open) > .h .r .chev{transform:rotate(-90deg);}' +
    '.w191stage > .b{display:none;padding:2px 16px 16px;border-top:1px solid rgba(16,63,57,.08);}.w191stage.open > .b{display:block;}' +
    '.w191stage .b > .cardy,.w191stage .b > .w31sum{box-shadow:none;border:1px solid rgba(16,63,57,.10);border-radius:14px;padding:14px 16px;margin:12px 0 0;background:#FFFDF8;}' +
    '.w191stage .b > .cardy > h4,.w191stage .b > .w31sum > h4{margin:0 0 8px;font-family:' + HEAD + ';font-size:18px;letter-spacing:.3px;text-transform:uppercase;color:' + GREEN + ';}' +
    '.w191stage .b .w191line{display:flex;gap:6px 10px;flex-wrap:wrap;align-items:center;font-size:13px;color:' + INK + ';margin:12px 0 0;}.w191stage .b .w191line .pill{background:rgba(16,63,57,.07);border-radius:999px;padding:4px 10px;font-size:12px;}.w191stage .b .w191line .pill.short{background:rgba(179,64,47,.1);color:' + FLAG + ';}.w191stage .b .w191line .pill.ok{background:rgba(42,140,122,.12);color:' + TEAL + ';}' +
    '.w191stage .b .w191grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;}' +
    /* steps inside a stage: flat, calm */
    '.w191steps{margin:12px 0 0;}.w191steps .w191grp{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:' + MUTED + ';font-weight:700;margin:14px 0 2px;}.w191steps .w191grp:first-child{margin-top:4px;}' +
    '.w191steps .vl-step{margin:0 !important;padding:9px 0;border-bottom:1px solid rgba(16,63,57,.08);align-items:flex-start;}.w191steps .vl-step:last-child{border-bottom:none;}' +
    '.w191steps .vl-step input[type=checkbox]{width:20px;height:20px;border-radius:50%;margin-top:1px;}' +
    '.w191steps .vl-step .vl-name{font-size:14px;line-height:1.35;color:' + INK + ';}.w191steps .vl-step.done .vl-name{color:' + MUTED + ';text-decoration:line-through;}' +
    '.w191steps .vl-step .w26c,.w191steps .vl-step .w26n,.w191steps .vl-step .w59sel{display:none !important;}' +
    '.w191steps .vl-step .vl-meta{display:flex;gap:6px 8px;flex-wrap:wrap;align-items:center;margin-top:5px;font-size:11.5px;}' +
    '.w191steps .vl-step .vl-meta .w59role{margin:0;}.w191steps .vl-step .vl-meta .vl-in{border-radius:8px;}' +
    '.w191steps .vl-step .vl-meta{display:none;}.w191steps .vl-step.w191x .vl-meta{display:flex;}.w191steps .wa24-sx{display:none;}.w191steps .wa24-sx.w191sx{display:flex;}' +
    '.w191cm{display:block;background:none;border:none;padding:0;margin:3px 0 0;font:inherit;font-size:12px;color:' + MUTED + ';cursor:pointer;text-align:left;}.w191cm em{font-style:normal;color:' + FLAG + ';font-weight:600;}.w191cm .w191cmx{color:' + GREEN + ';font-weight:600;margin-left:6px;opacity:0;transition:opacity .15s;}.vl-step:hover .w191cm .w191cmx,.vl-step.w191x .w191cm .w191cmx{opacity:1;}@media (hover:none){.w191cm .w191cmx{opacity:1;}}' +
    '.w191steps .wa24-sx{margin:2px 0 6px 30px;}.w191steps .wa24-sx .who{display:none;}.w191steps .vl-step .vl-meta .vl-in.w90{width:128px;}' +
    '#w191extra > .cardy{border:1px solid rgba(16,63,57,.10);border-radius:18px;padding:14px 16px;margin:4px 0 10px;background:' + CREAM + ';box-shadow:none;}#w191extra > .cardy > h4{margin:0 0 8px;font-family:' + HEAD + ';font-size:22px;letter-spacing:.3px;text-transform:uppercase;color:' + GREEN + ';}#w191extra .btn,#w119.w191 .w31sum .btn,#w119.w191 .w31sum .w31btn{font-family:' + BODY + ';font-weight:600;font-size:12.5px;padding:9px 14px;border-radius:999px;text-transform:none;letter-spacing:0;}' +
    '.w191steps .vl-step .vl-more{margin-left:8px;}' +
    '.w191hub{display:inline-flex;align-items:center;gap:5px;background:rgba(111,100,171,.12);color:' + PURPLE + ';border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;margin-left:8px;vertical-align:middle;cursor:help;}' +
    '.w191hubnote{display:block;font-size:11.5px;color:' + PURPLE + ';margin-top:3px;}' +
    '.w191wait{display:flex;align-items:center;gap:10px;width:100%;margin:0 0 10px;padding:10px 14px;border-radius:14px;border:1px solid rgba(179,64,47,.3);background:#FFF5F2;cursor:pointer;font-family:' + BODY + ';color:' + INK + ';text-align:left;}' +
    '.w191wait i{width:9px;height:9px;border-radius:50%;background:' + FLAG + ';flex:none;}.w191wait b{flex:1;font-size:13px;}.w191wait span{font-size:12px;color:' + FLAG + ';font-weight:600;white-space:nowrap;}' +
    '.w191steps .vl-step[data-w191hub].done .vl-name{text-decoration:none;color:' + MUTED + ';}' +
    '.w191steps .vl-step[data-w191parent]{display:none !important;}.w191steps .vl-step[data-w191parent] + .wa24-sx{display:none !important;}' +
    '.w191empty{font-size:13px;color:' + MUTED + ';padding:12px 0 2px;}' +
    '#w191team{margin:0 0 14px;}#w191team > .b > .cardy.w191roster{border:none;padding:6px 0 0;margin:0;background:none;}#w191team > .b > .cardy.w191roster > h4{display:none;}#w191team .board{margin-top:8px;}' +
    '.w191stage .b .w191line button.pill{border:none;font:inherit;font-size:12px;cursor:pointer;color:inherit;}.w191stage .b .w191line button.pill:hover{filter:brightness(.96);}' +
    '.w191ctx{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:rgba(111,100,171,.07);font-size:13px;line-height:1.5;color:' + INK + ';}.w191ctx b{display:block;color:' + PURPLE + ';font-size:12px;letter-spacing:.6px;text-transform:uppercase;margin-bottom:2px;}' +
    '#w119.w191 .pc .flag.w191partner{background:rgba(111,100,171,.12);color:' + PURPLE + ';}' +
    '.w191donebox{margin:6px 0 0;}.w191donebox > summary{cursor:pointer;font-size:12.5px;color:' + TEAL + ';font-weight:600;padding:8px 0;list-style:none;display:flex;align-items:center;gap:6px;}.w191donebox > summary::-webkit-details-marker{display:none;}.w191donebox > summary:before{content:"\\2713";display:inline-flex;width:18px;height:18px;border-radius:50%;background:rgba(42,140,122,.14);align-items:center;justify-content:center;font-size:11px;}.w191donebox[open] > summary:after{content:"hide";color:' + MUTED + ';font-weight:500;margin-left:4px;}.w191donebox:not([open]) > summary:after{content:"show";color:' + MUTED + ';font-weight:500;margin-left:4px;}' +
    '.w191hide{display:none !important;}#volunteering > .card:has(> #w119.w191) > p.read,#volunteering > .card:has(> #w191week) > .vl-hero{display:none !important;}' +
    /* legacy pieces this wave retires from the serving page (the data stays; the Hub's tools replaced them) */
    '#w119.w191 > .mast,#w119.w191 > .next,#w119.w191 > .top,#w119.w191 > .grid > #w119left,#w119.w191 .w191hide{display:none !important;}' +
    '#w119.w191 > .grid{display:block;}#w119.w191 > .grid > #w119right{display:block;}#w119.w191 #w119rail{display:none;}' +
    '#w119.w191 .w31sum .row:has(> input[placeholder*="Canva"]),#w119.w191 .w31sum .row:has(> #w33qr),#w119.w191 .w31sum .row:has(> [data-w33it]){display:none !important;}' +
    '#w119.w191 .w31sum .row .b:has(+ .b),#w119.w191 .w31sum .row > span.b{font-size:12px;}' +
    /* roster cards, compact */
    '#w119.w191 .pc .flag{display:inline-block;font-size:10.5px;}#w119.w191 .pc .mv{opacity:.55;}#w119.w191 .pc:hover .mv{opacity:1;}' +
    /* This week on the calendar */
    '#w191week{font-family:' + BODY + ';margin:0 0 18px;}#w191week .lbl{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:' + GOLD + ';font-weight:700;margin:0 0 8px;display:flex;justify-content:space-between;align-items:center;}#w191week .lbl span{color:' + MUTED + ';letter-spacing:0;text-transform:none;font-weight:500;font-size:12px;}' +
    '#w191week .srv{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;}' +
    '#w191week .sv{background:' + CREAM + ';border:1px solid rgba(16,63,57,.10);border-radius:16px;padding:14px 15px;cursor:pointer;box-shadow:0 8px 20px -18px rgba(16,63,57,.6);display:flex;flex-direction:column;gap:7px;}#w191week .sv:hover{box-shadow:0 10px 24px -16px rgba(16,63,57,.7);}' +
    '#w191week .sv .d{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}#w191week .sv .d b{font-family:' + HEAD + ';font-size:20px;text-transform:uppercase;color:' + GREEN + ';letter-spacing:.3px;line-height:1;}#w191week .sv .d span{font-size:12px;color:' + MUTED + ';white-space:nowrap;}' +
    '#w191week .sv .stg{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:' + GREEN + ';}#w191week .sv .stg i{width:8px;height:8px;border-radius:50%;background:' + GOLD + ';display:inline-block;}#w191week .sv .stg.wrap_up i,#w191week .sv .stg.done i{background:' + TEAL + ';}' +
    '#w191week .sv .bars{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px;color:' + MUTED + ';}#w191week .sv .bars b{color:' + INK + ';font-weight:600;}#w191week .sv .bars i{display:block;height:4px;border-radius:4px;background:rgba(16,63,57,.1);margin-top:4px;overflow:hidden;}#w191week .sv .bars i:after{content:"";display:block;height:100%;width:var(--p,0%);background:' + GREEN + ';}' +
    '#w191week .sv .nx{font-size:12.5px;color:' + INK + ';border-top:1px solid rgba(16,63,57,.08);padding-top:7px;}#w191week .sv .nx span{color:' + MUTED + ';}#w191week .sv .nx em{font-style:normal;color:' + FLAG + ';font-weight:600;}' +
    '#w191week .lists{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:10px;}' +
    '#w191week .ls{background:#FFFDF8;border:1px solid rgba(16,63,57,.10);border-radius:14px;padding:12px 14px;}#w191week .ls h5{margin:0 0 6px;font-family:' + HEAD + ';font-size:16px;text-transform:uppercase;letter-spacing:.3px;color:' + GREEN + ';display:flex;justify-content:space-between;}#w191week .ls h5 span{font-family:' + BODY + ';font-size:12px;color:' + MUTED + ';text-transform:none;letter-spacing:0;font-weight:500;}' +
    '#w191week .ls .it{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;font-size:12.5px;padding:5px 0;border-top:1px solid rgba(16,63,57,.06);cursor:pointer;color:' + INK + ';}#w191week .ls .it:first-of-type{border-top:none;}#w191week .ls .it span{color:' + MUTED + ';white-space:nowrap;font-size:11.5px;}#w191week .ls .it em{font-style:normal;color:' + FLAG + ';}#w191week .ls .it small{display:block;color:' + MUTED + ';font-size:11px;}' +
    '#w191week .ls .none{font-size:12.5px;color:' + TEAL + ';padding:4px 0;}' +
    /* the SOP page */
    '.w191stg{display:inline-block;background:rgba(16,63,57,.08);color:' + GREEN + ';border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;margin-right:6px;vertical-align:middle;}' +
    '.w191prop{margin:8px 0 4px 26px;border:1px solid rgba(220,165,39,.5);background:#FFF8E8;border-radius:12px;padding:10px 12px;font-size:12.5px;color:' + INK + ';}.w191prop .k{font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#8A6410;font-weight:800;margin-bottom:4px;}.w191prop b{display:block;margin:2px 0;}.w191prop p{margin:4px 0;color:#4a4a46;}.w191prop .why{color:' + MUTED + ';font-size:11.5px;}.w191prop .acts{display:flex;gap:6px;margin-top:8px;}' +
    '#w191legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 14px;font-family:' + BODY + ';}#w191legend .lg{background:' + CREAM + ';border:1px solid rgba(16,63,57,.10);border-radius:12px;padding:10px 12px;}#w191legend .lg b{display:block;font-family:' + HEAD + ';font-size:16px;text-transform:uppercase;letter-spacing:.3px;color:' + GREEN + ';}#w191legend .lg span{display:block;font-size:11.5px;color:' + MUTED + ';margin-top:2px;}#w191legend .lg small{display:block;font-size:11px;color:' + GREEN + ';margin-top:4px;font-weight:600;}' +
    '#w191sopintro{font-size:13px;color:' + INK + ';margin:0 0 12px;line-height:1.5;}' +
    /* phones */
    '@media (max-width:700px){#w191head{padding:18px 16px 16px;border-radius:18px;}#w191head h3{font-size:32px;}.w191bar{display:flex;overflow-x:auto;gap:6px;padding-bottom:4px;scrollbar-width:none;}.w191bar::-webkit-scrollbar{display:none;}.w191bar .st{flex:0 0 118px;}' +
    '.w191stage > .h{padding:12px 13px;gap:10px;}.w191stage > .h b{font-size:19px;}.w191stage > .b{padding:0 12px 12px;}.w191stage .b > .cardy,.w191stage .b > .w31sum{padding:12px;}#w191next .grid{grid-template-columns:1fr;}#w191week .sv .d b{font-size:18px;}}';
  document.head.appendChild(css);
