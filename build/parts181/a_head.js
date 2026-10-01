/* =====================================================================
   WA v181 The HR centre's Analytics: who has been part of Welfare Avenue, and for how long (30/09/26)
   =====================================================================
   Steel (30/09/26), with Slack's Member Analytics export (29/08/2025 to 29/09/2026): "To help you add start dates, add an
   analytics tab to the hr center, show trends, and know who's been a part of the org and for how long ish (we may have
   deactivated their accounts late)".

   Where: a seventh section in the HR centre, Analytics (#hrcentre/analytics; on a computer it is in the app's rail), for
   HR and admins only (wa181_can_see: the HR access list, the HR profile, admins; leaders who open the HR centre do not get
   the tab). It shows:
   - the headline (on the team now, joined and left this fiscal year, how long people stay, everyone since 2021);
   - the team over time (people on the team each month since May 2021, with the month's joiners; hover for the numbers);
   - each fiscal year (October to September): joined, left, on the team at the year's end, and how many of that year's
     joiners are still here;
   - how long people stay (the current team so far, and the people who left);
   - by team (the current team);
   - everyone who has been part of Welfare Avenue, filterable, with a sheet per person (their Slack accounts, link to the
     roster or mark as not a team member) and a CSV;
   - Worth a look (people on Slack but not on the roster, roster and Slack disagreeing, accounts nobody used in a year,
     links made by first name, people with no start date);
   - Import a new Slack export (the same CSV; the page reads it and wa181_import saves it).
   Honest dates: accounts were switched off late and in batches, so a leaving date is "left by" (the latest day they can
   have left), and someone not active once in the export's window left by its first day.
   Data: hr_people_tenure_v (one row per person), hr_slack_accounts (one per Slack account), wa181_import, wa181_link.
   Start dates on the roster now take the day people joined Slack when it is earlier (start_source slack; wave181c).
   ===================================================================== */
(function () {
  if (window.__wa181) return; window.__wa181 = true;
  var GREEN = '#103F39', GOLD = '#DCA527', MUTED = '#797773', FLAG = '#B3402F', TEAL = '#2A8C7A', LINE = '#E7E2D6', CREAM = '#FFFAF2', PURPLE = '#6F64AB', INK = '#1F201E', SAND = '#F4F2EA';
  var HEAD = '"Barlow Condensed", "Arial Narrow", sans-serif';
  var A = { can: null, canP: null, rows: [], accts: [], roster: [], loaded: false, loading: null, err: '', f: 'current', q: '', team: '', sort: 'start', imp: null };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function lower(s) { return String(s == null ? '' : s).toLowerCase(); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function ym(iso) { return String(iso || '').slice(0, 7); }
  function monLabel(k) { var p = String(k).split('-'); return MON[Number(p[1]) - 1] + ' ' + p[0]; }
  function dayNice(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return Number(p[2]) + ' ' + MON[Number(p[1]) - 1] + ' ' + p[0]; }
  function monthNice(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return MON[Number(p[1]) - 1] + ' ' + p[0]; }
  function months(a, b) { /* whole months between two ISO days */
    if (!a || !b) return null; var x = String(a).split('-').map(Number), y = String(b).split('-').map(Number);
    var m = (y[0] - x[0]) * 12 + (y[1] - x[1]) + (y[2] >= x[2] ? 0 : -1); return Math.max(0, m);
  }
  function dur(m) {
    if (m == null) return '';
    if (m < 1) return 'under a month'; if (m < 12) return plural(m, 'month');
    var y = Math.floor(m / 12), r = m % 12; return y + (y === 1 ? ' year' : ' years') + (r ? ' ' + r + ' mo' : '');
  }
  function fyOf(iso) { var y = Number(String(iso).slice(0, 4)), m = Number(String(iso).slice(5, 7)); return m >= 10 ? y : y - 1; }   /* the fiscal year starting 1 October of that year */
  function fyLabel(y) { return y + '-' + String((y + 1) % 100).padStart(2, '0'); }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : Math.round((s[h - 1] + s[h]) / 2); }
  function teamName(d) { try { return (window.WA_TEAMS && WA_TEAMS.labels[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function teamShort(d) { try { return (window.WA_TEAMS && WA_TEAMS.short[d]) || teamName(d); } catch (e) { return d || ''; } }
  function phone() { return window.matchMedia ? window.matchMedia('(max-width: 760px)').matches : window.innerWidth <= 760; }
  function hrOn() { var pn = document.getElementById('hrcentre'); return !!pn && pn.classList.contains('active'); }
  function curView() { var on = document.querySelector('#w46body .w47tab.on'); return on ? on.getAttribute('data-w47v') : ''; }

  var CSS = ''
    + '#w181{display:none;font-family:inherit;color:' + INK + ';}#w181.on{display:block;}'
    + '#w181 .w181top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 14px;margin:0 0 14px;}'
    + '#w181 .w181top p{margin:0;flex:1 1 360px;font-size:13.5px;line-height:1.5;color:' + MUTED + ';}'
    + '#w181 .w181top .acts{display:flex;gap:8px;flex-wrap:wrap;}'
    + '.w181btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;background:' + GREEN + ';color:' + CREAM + ' !important;font:inherit;font-size:13px;font-weight:700;padding:8px 16px;cursor:pointer;text-decoration:none !important;white-space:nowrap;}'
    + '.w181btn:hover{background:#0b2f2a;}.w181btn[disabled]{opacity:.55;cursor:default;}'
    + '.w181btn.ghost{background:transparent;color:' + GREEN + ' !important;border:1px solid rgba(16,63,57,.35);}.w181btn.ghost:hover{background:rgba(16,63,57,.07);}'
    + '.w181btn.gold{background:' + GOLD + ';color:' + GREEN + ' !important;}.w181btn.sm{font-size:12px;padding:6px 12px;}'
    + '.w181lnk{border:0;background:none;padding:0;font:inherit;color:' + GREEN + ';font-weight:700;text-decoration:underline;cursor:pointer;text-align:left;}'
    + '#w181 .w181tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 16px;}'
    + '#w181 .w181tile{background:' + CREAM + ';border:1px solid ' + LINE + ';border-radius:16px;padding:12px 14px;}'
    + '#w181 .w181tile b{display:block;font-family:' + HEAD + ';font-size:30px;line-height:1.05;color:' + GREEN + ';}'
    + '#w181 .w181tile span{display:block;font-size:12.5px;color:' + INK + ';margin-top:2px;line-height:1.35;}'
    + '#w181 .w181tile small{display:block;font-size:11.5px;color:' + MUTED + ';margin-top:4px;line-height:1.35;}'
    + '#w181 .w181card{background:' + CREAM + ';border:1px solid ' + LINE + ';border-radius:18px;padding:16px 18px;margin:0 0 14px;}'
    + '#w181 .w181card h3{font-family:' + HEAD + ';font-size:22px;font-weight:700;color:' + GREEN + ';margin:0 0 2px;letter-spacing:.2px;}'
    + '#w181 .w181card .sub{font-size:12.5px;color:' + MUTED + ';margin:0 0 12px;line-height:1.45;}'
    + '#w181 .w181two{display:grid;grid-template-columns:1fr 1fr;gap:14px;}#w181 .w181two > .w181card{margin:0;min-width:0;}'
    + '#w181 .w181chart{position:relative;}#w181 .w181chart svg{display:block;width:100%;height:auto;overflow:visible;}'
    + '#w181 .w181tip{position:absolute;pointer-events:none;background:' + INK + ';color:' + CREAM + ';font-size:12px;line-height:1.45;border-radius:10px;padding:7px 10px;white-space:nowrap;transform:translate(-50%,-100%);display:none;z-index:3;}'
    + '#w181 .w181tip b{font-weight:800;}'
    + '#w181 .w181key{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:' + MUTED + ';margin:8px 0 0;}'
    + '#w181 .w181key i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;}'
    + '#w181 table.w181t{width:100%;border-collapse:collapse;font-size:13px;}'
    + '#w181 table.w181t th{text-align:left;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:' + MUTED + ';font-weight:800;padding:6px 8px;border-bottom:1px solid ' + LINE + ';white-space:nowrap;}'
    + '#w181 table.w181t td{padding:8px;border-bottom:1px solid ' + LINE + ';vertical-align:top;}'
    + '#w181 table.w181t td.n,#w181 table.w181t th.n{text-align:right;font-variant-numeric:tabular-nums;}#w181 .w181fy .sm{display:none;}#w181 .w181fy td:first-child{white-space:nowrap;}'
    + '#w181 .w181bars .r{display:grid;grid-template-columns:110px 1fr 40px;align-items:center;gap:8px;margin:0 0 6px;font-size:12.5px;}'
    + '#w181 .w181bars .tr{height:14px;background:' + SAND + ';border-radius:999px;overflow:hidden;}'
    + '#w181 .w181bars .tr i{display:block;height:100%;border-radius:999px;}'
    + '#w181 .w181bars .r b{text-align:right;font-variant-numeric:tabular-nums;}'
    + '#w181 .w181bars h4{font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:' + MUTED + ';margin:10px 0 8px;font-weight:800;}'
    + '#w181 .w181bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px;}'
    + '#w181 .w181bar input[type=search]{flex:1 1 200px;min-width:160px;padding:9px 14px;border:1px solid rgba(16,63,57,.2);border-radius:999px;font:inherit;font-size:13.5px;}'
    + '#w181 .w181bar select{padding:8px 10px;border:1px solid rgba(16,63,57,.2);border-radius:999px;font:inherit;font-size:13px;background:' + CREAM + ';}'
    + '#w181 .w181chip{font-size:12.5px;font-weight:700;color:' + GREEN + ';background:rgba(16,63,57,.07);border:none;border-radius:999px;padding:7px 12px;cursor:pointer;}'
    + '#w181 .w181chip.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#w181 .w181ppl tr[data-w181p]{cursor:pointer;}#w181 .w181ppl tr[data-w181p]:hover td{background:rgba(16,63,57,.035);}'
    + '#w181 .w181ppl td .t{display:block;font-size:12px;color:' + MUTED + ';margin-top:2px;}'
    + '.w181tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.3px;border-radius:999px;padding:2px 8px;margin:0 4px 3px 0;background:rgba(16,63,57,.08);color:' + GREEN + ';white-space:nowrap;}'
    + '.w181tag.warn{background:rgba(220,165,39,.22);color:#6b4d05;}.w181tag.bad{background:rgba(179,64,47,.12);color:' + FLAG + ';}.w181tag.ok{background:rgba(42,140,122,.14);color:#1d6658;}'
    + '#w181 .w181look{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}'
    + '#w181 .w181look > div{background:' + CREAM + ';border:1px solid ' + LINE + ';border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.5;}'
    + '#w181 .w181look b.h{display:block;font-size:13.5px;color:' + GREEN + ';margin:0 0 2px;}'
    + '#w181 .w181look p{margin:0 0 6px;font-size:12.5px;color:' + MUTED + ';}'
    + '#w181 .w181note{font-size:12px;color:' + MUTED + ';margin:8px 0 0;line-height:1.45;}'
    + '#w181 .w181empty{font-size:13px;color:' + MUTED + ';padding:12px 0;}'
    + '.w181sheet h3{font-family:' + HEAD + ';font-size:24px;color:' + GREEN + ';margin:0 0 2px;}'
    + '.w181sheet .sub{font-size:13px;color:' + MUTED + ';margin:0 0 12px;}'
    + '.w181sheet .facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0 0 14px;}'
    + '.w181sheet .facts div{background:rgba(16,63,57,.045);border-radius:10px;padding:8px 10px;font-size:13px;}'
    + '.w181sheet .facts small{display:block;font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;color:' + MUTED + ';font-weight:800;}'
    + '.w181sheet .acc{border:1px solid ' + LINE + ';border-radius:12px;padding:10px 12px;margin:0 0 8px;font-size:13px;line-height:1.5;}'
    + '.w181sheet .acc .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;}'
    + '.w181sheet .acc select{padding:6px 8px;border:1px solid rgba(16,63,57,.25);border-radius:8px;font:inherit;font-size:13px;max-width:100%;}'
    + '.w181sheet .foot{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px;}'
    + '.w181sheet .err{color:' + FLAG + ';font-size:12.5px;margin:6px 0 0;}'
    + '.w181sheet label.f{display:block;font-size:12px;font-weight:700;color:' + INK + ';margin:8px 0 4px;}'
    + '.w181sheet input[type=date],.w181sheet input[type=file]{font:inherit;font-size:13px;}'
    + '@media (max-width:760px){#w181 .w181two{grid-template-columns:1fr;}#w181 .w181tile b{font-size:26px;}'
    + '#w181 table.w181ppl thead{display:none;}#w181 table.w181ppl tr{display:block;border-bottom:1px solid ' + LINE + ';padding:8px 0;}'
    + '#w181 table.w181ppl td{display:block;border:0;padding:2px 4px;}#w181 table.w181ppl td[data-l]:before{content:attr(data-l) ": ";font-size:11px;color:' + MUTED + ';font-weight:700;}'
    + '#w181 .w181bars .r{grid-template-columns:90px 1fr 34px;}#w181 .w181fy{font-size:13px;}#w181 .w181fy th{font-size:10px;letter-spacing:.2px;}#w181 .w181fy th,#w181 .w181fy td{padding:6px 4px;white-space:nowrap;}#w181 .w181fy .lg{display:none;}#w181 .w181fy .sm{display:inline;}#w181 .w181tiles{grid-template-columns:1fr 1fr;}#w181 .w181card{padding:14px 12px;}}';
  var st = document.createElement('style'); st.id = 'w181css'; st.textContent = CSS; document.head.appendChild(st);
