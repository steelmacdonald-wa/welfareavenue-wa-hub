/* =====================================================================
   WA v306 the Content Studio, rebuilt around five areas (10/11/26)
   =====================================================================
   Steel (10/11/26, after testing it together): "the Content Studio could definitely use a revamp on the layout of it and its
   functionality ... reduce redundancy of different places and areas ... make sure that with our recent marketing and
   fundraising leader meeting and the past marketing meeting, all those updates are added", and "ensure you pull in
   everything important from the website analytics ... Really consider the user experience and the data that really
   matters and how you plan to present it."
   His choices: five areas instead of fourteen places, nothing removed and every old address still works.

   - The rail (parts153 APPS.studio): Today, Plan, Inbox, Results, Toolkit. An item lights for its own address and for the
     addresses in its `also` list (v153 isOn reads it), so #studio/queue lights Plan and #socialstats lights Results.
   - The area tabs (#w306tabs): one row under the masthead of every Studio page, the area's pages in order with their counts.
     It is not a second menu: the rail names the area, the tabs its pages.
       Plan: Calendar #contentcal, Queue #studio/queue, Approvals #studio/approvals
       Inbox: Comments #studio/inbox, Messages #studio/messages, Hashtags #studio/hashtags
       Results: Website #studio/web, Social #socialstats, Paid and organic #studio/ads, Report #studio/report
       Toolkit: Library #studio/library, Link in bio #studio/pages, Short links #studio/links, Connections #studio/connections
   - Today (#studio, replaces wave225's Overview through w225's paint): what needs me first (approvals, posts sent back,
     failures of the last 14 days, comments, messages, hashtags), the week as seven days with the goals, the campaign that is
     on (the drive's money, gifts and the website's donate clicks), and the pulse of the last 28 days (social reach, engaged
     website visitors, link clicks, website actions), each against the 28 days before.
   - Results > Website (#studio/web): web-insights v1 (GA4 read live, cached as totals). What a visit is worth, where people
     come from, what brings them in, what they do (donate clicks by campaign, sign-ups, forms sent), who they are (device,
     new or returning, city), with plain sentences that say what changed, and automated traffic called out.
   - Loading: skeletons until the Studio's data is in, never an empty state that is not true (the Overview used to say every
     platform was Reminder and the comments were not connected while it loaded). wave225's loadAll runs its loads at once.
   - Motion (Emil Kowalski's rules): the tab marker slides 200 ms ease-out between tabs of one area; a section's cards rise
     4 px and fade in once when the section changes, never on a repaint; buttons press to .97; nothing moves for people who
     ask for reduced motion; hover effects only where there is a pointer that hovers.
   ===================================================================== */
(function () {
  if (window.__wa306) return; window.__wa306 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#6b6a66', FLAG = '#B3402F', TEAL = '#2A8C7A', ROSE = '#B4467A', PURPLE = '#6F64AB';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var EASE = 'cubic-bezier(.23,1,.32,1)';
  function W2() { return window.w225 || null; }
  function X() { var w = W2(); return w && w.x ? w.x : null; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { v = Number(v); if (!isFinite(v)) return '–'; var a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (a >= 1e4) return Math.round(v / 1e3) + 'k'; if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'; return String(Math.round(v)); }
  function money(v) { v = Number(v || 0); return '$' + (v >= 1000 ? v.toLocaleString('en-CA', { maximumFractionDigits: 0 }) : String(Math.round(v))); }
  function pct(v, d) { if (!isFinite(v)) return '–'; return (v * 100).toFixed(d == null ? 0 : d) + '%'; }
  function dur(sec) { sec = Math.round(Number(sec) || 0); if (sec < 60) return sec + 's'; var m = Math.floor(sec / 60), s = sec % 60; return m + 'm' + (s ? ' ' + (s < 10 ? '0' : '') + s + 's' : ''); }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function addD(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function hashNow() { try { return decodeURIComponent(location.hash || ''); } catch (e) { return location.hash || ''; } }
  function path(h) { return String(h || '').replace(/^#/, '').split('?')[0]; }
  var reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* fine */ }

  /* ---------- the five areas ---------- */
  var AREAS = [
    { k: 'today', l: 'Today', h: '#studio', tabs: [] },
    { k: 'plan', l: 'Plan', h: '#contentcal', tabs: [['#contentcal', 'Calendar'], ['#studio/queue', 'Queue'], ['#studio/approvals', 'Approvals', 'approvals']] },
    { k: 'inbox', l: 'Inbox', h: '#studio/inbox', tabs: [['#studio/inbox', 'Comments', 'inbox'], ['#studio/messages', 'Messages', 'messages'], ['#studio/hashtags', 'Hashtags', 'hashtags']] },
    { k: 'results', l: 'Results', h: '#studio/web', tabs: [['#studio/web', 'Website'], ['#socialstats', 'Social'], ['#studio/ads', 'Paid and organic'], ['#studio/report', 'Report']] },
    { k: 'toolkit', l: 'Toolkit', h: '#studio/library', tabs: [['#studio/library', 'Library'], ['#studio/pages', 'Link in bio'], ['#studio/links', 'Short links'], ['#studio/connections', 'Connections']] }
  ];
  function areaOf(h) {
    var p = path(h);
    for (var i = 0; i < AREAS.length; i++) for (var j = 0; j < AREAS[i].tabs.length; j++) { var t = path(AREAS[i].tabs[j][0]); if (p === t || p.indexOf(t + '/') === 0) return { area: AREAS[i], tab: j }; }
    if (p === 'studio' || p === 'studio/overview' || p === '') return { area: AREAS[0], tab: -1 };
    return null;
  }
  /* what the rail's items light for (read by v153 isOn) */
  function railAlso(k) { var a = AREAS.filter(function (x) { return x.k === k; })[0]; return a ? a.tabs.map(function (t) { return t[0]; }) : []; }

  /* ---------- the look ---------- */
  var css = document.createElement('style'); css.id = 'wa306css';
  css.textContent = ''
    /* area tabs */
    + '#w306tabs{position:relative;display:flex;gap:2px;align-items:center;margin:2px 0 18px;padding:4px;background:rgba(16,63,57,.06);border-radius:14px;width:max-content;max-width:100%;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;}'
    + '#w306tabs::-webkit-scrollbar{display:none;}'
    + '#w306tabs a{position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border-radius:10px;font:600 13.5px/1 inherit;color:' + GREEN + ';opacity:.72;text-decoration:none;white-space:nowrap;scroll-snap-align:start;transition:opacity .15s ease,transform .16s ' + EASE + ';-webkit-tap-highlight-color:transparent;}'
    + '#w306tabs a[aria-current="page"]{opacity:1;}'
    + '#w306tabs a:active{transform:scale(.97);}'
    + '#w306tabs a:focus-visible{outline:2px solid ' + ROSE + ';outline-offset:1px;}'
    + '#w306tabs a b{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:' + ROSE + ';color:#FFFAF2;font:700 11px/18px inherit;text-align:center;}'
    + '#w306tabs .ind{position:absolute;z-index:0;top:4px;bottom:4px;left:0;width:0;border-radius:10px;background:#FFFAF2;box-shadow:0 1px 2px rgba(16,63,57,.10),0 2px 8px rgba(16,63,57,.08);transition:transform .2s ' + EASE + ',width .2s ' + EASE + ';}'
    + '#w306tabs.noanim .ind{transition:none;}'
    + '@media (hover:hover) and (pointer:fine){#w306tabs a:not([aria-current="page"]):hover{opacity:1;}}'
    /* entering a section */
    + '@keyframes w306in{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}'
    + '#studio.w306today>.w118mast{display:none;}'
    + '#w225host.w306enter>*{animation:w306in .26s ' + EASE + ' both;}'
    + '#w225host.w306enter>*:nth-child(2){animation-delay:.03s;}#w225host.w306enter>*:nth-child(3){animation-delay:.06s;}#w225host.w306enter>*:nth-child(4){animation-delay:.09s;}#w225host.w306enter>*:nth-child(n+5){animation-delay:.12s;}'
    /* skeletons */
    + '@keyframes w306sh{from{background-position:120% 0;}to{background-position:-20% 0;}}'
    + '.w306sk{border-radius:10px;background:linear-gradient(90deg,rgba(16,63,57,.06) 30%,rgba(16,63,57,.11) 50%,rgba(16,63,57,.06) 70%);background-size:300% 100%;animation:w306sh 1.4s linear infinite;}'
    + '.w306skcard{background:' + CREAM + ';border:1px solid rgba(16,63,57,.08);border-radius:18px;padding:18px;margin:0 0 14px;}'
    /* shared */
    + '.w306{--g:' + GREEN + ';--r:' + ROSE + ';color:' + INK + ';}'
    + '.w306 .tnum{font-variant-numeric:tabular-nums;}'
    + '.w306 .card{background:' + CREAM + ';border:1px solid rgba(16,63,57,.10);border-radius:18px;padding:18px 20px;margin:0 0 14px;box-shadow:0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06);}'
    + '.w306 h3{display:flex;align-items:center;gap:8px;margin:0 0 12px;font:600 19px/1.15 ' + HEAD + ';letter-spacing:.2px;color:' + GREEN + ';}'
    + '.w306 h3 .sp{flex:1;}.w306 h3 small{font:500 12.5px/1 inherit;color:' + MUTED + ';letter-spacing:0;}'
    + '.w306 .muted{color:' + MUTED + ';}.w306 .sm{font-size:12.5px;}'
    + '.w306 .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 13px;border-radius:10px;border:1px solid rgba(16,63,57,.18);background:#FFFAF2;color:' + GREEN + ';font:600 13px/1 inherit;cursor:pointer;text-decoration:none;white-space:nowrap;transition:transform .16s ' + EASE + ',background .15s ease,border-color .15s ease;-webkit-tap-highlight-color:transparent;}'
    + '.w306 .btn:active{transform:scale(.97);}.w306 .btn.pri{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}'
    + '.w306 .btn.rose{background:' + ROSE + ';border-color:' + ROSE + ';color:#FFFAF2;}'
    + '@media (hover:hover) and (pointer:fine){.w306 .btn:hover{border-color:' + GREEN + ';}.w306 .btn.pri:hover{background:#0b2f2a;}.w306 .btn.rose:hover{background:#9d3a69;}}'
    + '.w306 .btn:focus-visible,.w306 [tabindex]:focus-visible{outline:2px solid ' + ROSE + ';outline-offset:2px;}'
    + '.w306 .grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:14px;align-items:start;}'
    + '.w306 .grid>div>.card:last-child{margin-bottom:0;}'
    + '@media (max-width:980px){.w306 .grid{grid-template-columns:1fr;}}'
    + '.w306 .up{color:' + TEAL + ';}.w306 .dn{color:' + FLAG + ';}.w306 .flat{color:' + MUTED + ';}'
    + '.w306 .delta{display:inline-flex;align-items:center;gap:3px;font:600 12px/1 inherit;}'
    + '.w306 .seg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:rgba(16,63,57,.06);}'
    + '.w306 .seg button{min-height:30px;padding:0 11px;border:0;border-radius:8px;background:transparent;color:' + GREEN + ';font:600 12.5px/1 inherit;cursor:pointer;opacity:.75;transition:opacity .15s ease,background .15s ease,transform .16s ' + EASE + ';}'
    + '.w306 .seg button[aria-pressed="true"]{background:#FFFAF2;opacity:1;box-shadow:0 1px 2px rgba(16,63,57,.12);}'
    + '.w306 .seg button:active{transform:scale(.97);}'
    /* Today */
    + '.w306 .hello{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 16px;margin:0 0 16px;}'
    + '.w306 .hello h2{margin:0;font:600 30px/1.05 ' + HEAD + ';color:' + GREEN + ';letter-spacing:.2px;}'
    + '.w306 .hello p{margin:4px 0 0;color:' + MUTED + ';font-size:14px;}.w306 .hello .sp{flex:1;}'
    + '.w306 .need{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-top:1px solid rgba(16,63,57,.08);}'
    + '.w306 .need:first-of-type{border-top:0;padding-top:2px;}'
    + '.w306 .need .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(180,70,122,.10);color:' + ROSE + ';}'
    + '.w306 .need .ic.fl{background:rgba(179,64,47,.10);color:' + FLAG + ';}.w306 .need .ic.tl{background:rgba(42,140,122,.12);color:' + TEAL + ';}.w306 .need .ic.gd{background:rgba(220,165,39,.16);color:#8a5a00;}'
    + '.w306 .need .ic svg{width:18px;height:18px;}'
    + '.w306 .need b{display:block;font-size:14px;line-height:1.3;color:' + INK + ';overflow:hidden;text-overflow:ellipsis;}'
    + '.w306 .need small{display:block;margin-top:2px;font-size:12.5px;color:' + MUTED + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.w306 .calm{display:flex;align-items:center;gap:12px;padding:6px 0 2px;color:' + GREEN + ';}'
    + '.w306 .calm i{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(42,140,122,.14);color:' + TEAL + ';font-style:normal;}'
    + '.w306 details.older{margin-top:8px;}.w306 details.older summary{cursor:pointer;font-size:12.5px;color:' + MUTED + ';list-style:none;padding:6px 0;}'
    + '.w306 details.older summary::-webkit-details-marker{display:none;}'
    + '.w306 .week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;}'
    + '.w306 .wd{min-height:96px;border-radius:12px;background:#FFFAF2;border:1px solid rgba(16,63,57,.08);padding:8px;display:flex;flex-direction:column;gap:5px;}'
    + '.w306 .wd.today{border-color:' + ROSE + ';box-shadow:inset 0 0 0 1px ' + ROSE + ';}'
    + '.w306 .wd>span{font:600 11px/1 inherit;letter-spacing:.4px;text-transform:uppercase;color:' + MUTED + ';}.w306 .wd>span em{font-style:normal;color:' + INK + ';font-size:15px;letter-spacing:0;margin-left:3px;}'
    + '.w306 .wd .p{display:flex;gap:5px;align-items:center;padding:4px;border-radius:8px;background:rgba(16,63,57,.05);cursor:pointer;font-size:11.5px;line-height:1.2;overflow:hidden;}'
    + '.w306 .wd .p img,.w306 .wd .p .ph{width:22px;height:22px;border-radius:5px;object-fit:cover;flex:none;background:rgba(16,63,57,.10);}'
    + '.w306 .wd .p span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.w306 .wd .p.dr{opacity:.65;}'
    + '.w306 .wd .add{margin-top:auto;align-self:flex-start;width:26px;height:26px;border-radius:8px;border:1px dashed rgba(16,63,57,.25);background:transparent;color:' + GREEN + ';font-size:16px;line-height:1;cursor:pointer;opacity:.55;transition:opacity .15s ease,transform .16s ' + EASE + ';}'
    + '.w306 .wd .add:active{transform:scale(.94);}@media (hover:hover) and (pointer:fine){.w306 .wd:hover .add{opacity:1;}}'
    + '@media (max-width:700px){.w306 .week{grid-template-columns:1fr;}.w306 .wd.past{display:none;}.w306 .wd{min-height:0;flex-direction:row;flex-wrap:wrap;align-items:center;}.w306 .wd>span{width:84px;}.w306 .wd .add{margin:0 0 0 auto;opacity:1;}}'
    + '.w306 .goals{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}'
    + '.w306 .gl{display:inline-flex;align-items:center;gap:6px;padding:5px 9px 5px 6px;border-radius:999px;background:#FFFAF2;border:1px solid rgba(16,63,57,.10);font:600 12px/1 inherit;}'
    + '.w306 .gl.ok{background:rgba(42,140,122,.10);border-color:rgba(42,140,122,.25);color:' + TEAL + ';}'
    + '.w306 .pulse{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}'
    + '@media (max-width:980px){.w306 .pulse{grid-template-columns:repeat(2,minmax(0,1fr));}}'
    + '.w306 .tile{position:relative;background:#FFFAF2;border:1px solid rgba(16,63,57,.09);border-radius:14px;padding:12px 13px 10px;cursor:pointer;text-decoration:none;color:inherit;display:block;transition:border-color .15s ease,transform .16s ' + EASE + ';}'
    + '.w306 .tile:active{transform:scale(.98);}@media (hover:hover) and (pointer:fine){.w306 .tile:hover{border-color:' + ROSE + ';}}'
    + '.w306 .tile span{display:block;font-size:12px;color:' + MUTED + ';}'
    + '.w306 .tile b{display:block;margin:4px 0 2px;font:600 28px/1 ' + HEAD + ';color:' + GREEN + ';}'
    + '.w306 .tile svg.spark{display:block;width:100%;height:28px;margin-top:6px;}'
    + '.w306 .camp .bar{height:10px;border-radius:6px;background:rgba(16,63,57,.08);overflow:hidden;margin:8px 0 6px;}'
    + '.w306 .camp .bar i{display:block;height:100%;border-radius:6px;background:' + GOLD + ';transform-origin:left;}'
    + '.w306 .camp .facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px;}'
    + '.w306 .camp .facts div{background:#FFFAF2;border-radius:12px;padding:9px 10px;border:1px solid rgba(16,63,57,.08);}'
    + '.w306 .camp .facts b{display:block;font:600 22px/1 ' + HEAD + ';color:' + GREEN + ';}.w306 .camp .facts span{font-size:11.5px;color:' + MUTED + ';}'
    /* Website */
    + '.w306 .bar1{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 14px;}.w306 .bar1 .sp{flex:1;}'
    + '.w306 .live{display:inline-flex;align-items:center;gap:7px;font:600 12.5px/1 inherit;color:' + GREEN + ';padding:7px 10px;border-radius:999px;background:#FFFAF2;border:1px solid rgba(16,63,57,.10);}'
    + '.w306 .live i{width:8px;height:8px;border-radius:50%;background:' + TEAL + ';box-shadow:0 0 0 0 rgba(42,140,122,.5);animation:w306pl 2s ease-out infinite;}'
    + '@keyframes w306pl{0%{box-shadow:0 0 0 0 rgba(42,140,122,.45);}70%{box-shadow:0 0 0 7px rgba(42,140,122,0);}100%{box-shadow:0 0 0 0 rgba(42,140,122,0);}}'
    + '.w306 .heroes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px;}'
    + '@media (max-width:980px){.w306 .heroes{grid-template-columns:repeat(2,minmax(0,1fr));}}'
    + '.w306 .hero{background:' + CREAM + ';border:1px solid rgba(16,63,57,.10);border-radius:16px;padding:14px 15px;}'
    + '.w306 .hero span{display:block;font-size:12.5px;color:' + MUTED + ';}'
    + '.w306 .hero b{display:block;margin:6px 0 6px;font:600 34px/1 ' + HEAD + ';color:' + GREEN + ';}'
    + '.w306 .hero.main{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}.w306 .hero.main b{color:' + CREAM + ';}.w306 .hero.main span{color:rgba(255,250,242,.75);}'
    + '.w306 .hero.main .up{color:#8ee0cc;}.w306 .hero.main .dn{color:#ffb4a6;}.w306 .hero.main .flat{color:rgba(255,250,242,.7);}'
    + '.w306 .says{margin:0;padding:0;list-style:none;display:grid;gap:8px;}'
    + '.w306 .says li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;font-size:14px;line-height:1.45;}'
    + '.w306 .says li i{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:700;}'
    + '.w306 .says li i.g{background:rgba(42,140,122,.14);color:' + TEAL + ';}.w306 .says li i.r{background:rgba(179,64,47,.12);color:' + FLAG + ';}.w306 .says li i.n{background:rgba(16,63,57,.08);color:' + GREEN + ';}'
    + '.w306 svg.chart{display:block;width:100%;height:auto;overflow:visible;}'
    + '.w306 .legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-size:12px;color:' + MUTED + ';}.w306 .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px;}'
    + '.w306 .rows{display:grid;gap:9px;}'
    + '.w306 .rw{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;font-size:13.5px;}'
    + '.w306 .rw .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.w306 .rw .vl{font-weight:600;color:' + GREEN + ';text-align:right;}'
    + '.w306 .rw .tr{grid-column:1/-1;height:7px;border-radius:5px;background:rgba(16,63,57,.07);overflow:hidden;display:flex;}'
    + '.w306 .rw .tr i{display:block;height:100%;}'
    + '.w306 table.t{width:100%;border-collapse:collapse;font-size:13px;}'
    + '.w306 table.t th{font:600 11.5px/1.2 inherit;letter-spacing:.3px;text-transform:uppercase;color:' + MUTED + ';text-align:right;padding:0 0 8px 10px;}'
    + '.w306 table.t th:first-child,.w306 table.t td:first-child{text-align:left;padding-left:0;}'
    + '.w306 table.t td{padding:9px 0 9px 10px;border-top:1px solid rgba(16,63,57,.08);text-align:right;white-space:nowrap;}'
    + '.w306 table.t td:first-child{white-space:normal;max-width:340px;}'
    + '.w306 table.t td small{display:block;color:' + MUTED + ';font-size:11.5px;}'
    + '.w306 .tag{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;font:600 10.5px/1.3 inherit;vertical-align:1px;}'
    + '.w306 .tag.bad{background:rgba(179,64,47,.12);color:' + FLAG + ';}.w306 .tag.good{background:rgba(42,140,122,.13);color:' + TEAL + ';}.w306 .tag.info{background:rgba(16,63,57,.08);color:' + GREEN + ';}'
    + '@media (max-width:700px){.w306 table.t .hm{display:none;}}'
    + '.w306 .funnel{display:grid;gap:8px;}'
    + '.w306 .fs{display:grid;grid-template-columns:150px minmax(0,1fr) 64px;gap:10px;align-items:center;font-size:13px;}'
    + '.w306 .fs .tr{height:26px;border-radius:8px;background:rgba(16,63,57,.06);overflow:hidden;}'
    + '.w306 .fs .tr i{display:block;height:100%;border-radius:8px;background:' + GREEN + ';}'
    + '.w306 .fs:nth-child(2) .tr i{background:' + TEAL + ';}.w306 .fs:nth-child(3) .tr i{background:' + ROSE + ';}.w306 .fs:nth-child(4) .tr i{background:' + GOLD + ';}'
    + '.w306 .fs b{font-weight:600;color:' + GREEN + ';text-align:right;}'
    + '@media (max-width:560px){.w306 .fs{grid-template-columns:100px minmax(0,1fr) 48px;}}'
    + '.w306 .note{margin:0 0 14px;padding:10px 13px;border-radius:12px;background:rgba(220,165,39,.12);color:#6b4a00;font-size:12.5px;line-height:1.45;}'
    + '.w306 .empty{padding:14px 0 4px;color:' + MUTED + ';font-size:13.5px;line-height:1.5;}'
    + '@media (prefers-reduced-motion:reduce){#w225host.w306enter>*,.w306sk,.w306 .live i{animation:none !important;}#w306tabs .ind,.w306 .btn,.w306 .tile,#w306tabs a{transition:none !important;}}';
  document.head.appendChild(css);

  var IC = {
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', chat: '<path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2z"/>', warn: '<path d="M12 4 21 20H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    back: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>', hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7S5 17 5 14v-2a1.5 1.5 0 0 1 3 0"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>', mail: '<path d="M4 6.5h16v11H4z"/><path d="m4 7 8 6 8-6"/>', plug: '<path d="M9 3.5v5M15 3.5v5"/><path d="M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 17v3.5"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v3H3zM12 9v11"/><path d="M12 9S9.5 4 7.5 5.5 9 9 12 9zM12 9s2.5-5 4.5-3.5S15 9 12 9z"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || IC.check) + '</svg>'; }
  function delta(cur, prev, opt) {
    opt = opt || {};
    if (prev === undefined) return '';
    if (prev == null || !isFinite(prev) || prev === 0) return cur ? '<span class="delta flat">new</span>' : '<span class="delta flat">–</span>';
    var d = (cur - prev) / prev; if (opt.lowerBetter) d = -d;
    var cls = Math.abs(d) < 0.03 ? 'flat' : d > 0 ? 'up' : 'dn';
    var shown = (cur - prev) / prev;
    return '<span class="delta ' + cls + '" title="Against the period before">' + (Math.abs(shown) < 0.03 ? '' : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' + (shown > 0 ? IC.up : IC.down) + '</svg>') + Math.abs(Math.round(shown * 100)) + '%</span>';
  }
  function spark(vals, color) {
    vals = (vals || []).map(Number); if (vals.length < 2) return '';
    var w = 120, h = 28, mx = Math.max.apply(null, vals) || 1;
    var pts = vals.map(function (v, i) { return [i / (vals.length - 1) * w, h - 2 - v / mx * (h - 4)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + 'L' + w + ' ' + h + 'L0 ' + h + 'Z" fill="' + (color || ROSE) + '" opacity=".10"/><path d="' + d + '" fill="none" stroke="' + (color || ROSE) + '" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
  }

  /* ---------- the area tabs ---------- */
  var lastTab = null;
  function panelFor(h) { var p = path(h).split('/')[0]; return document.getElementById(p || 'studio'); }
  function tabs() {
    var h = hashNow(), a = areaOf(h);
    var old = document.getElementById('w306tabs');
    if (!a || !a.area.tabs.length) { if (old) old.remove(); lastTab = a ? a.area.k + ':-' : null; return; }
    var panel = panelFor(h); if (!panel) return;
    var c = {}; try { c = W2() && W2().counts ? W2().counts() : {}; } catch (e) { c = {}; }
    var html = a.area.tabs.map(function (t, i) { var n = t[2] ? c[t[2]] : null; return '<a href="' + E(t[0]) + '"' + (i === a.tab ? ' aria-current="page"' : '') + '>' + E(t[1]) + (n ? '<b class="tnum">' + E(n > 99 ? '99+' : n) + '</b>' : '') + '</a>'; }).join('') + '<span class="ind" aria-hidden="true"></span>';
    var nav = old;
    if (!nav || nav.parentNode !== panel) {
      if (nav) nav.remove();
      nav = document.createElement('nav'); nav.id = 'w306tabs'; nav.setAttribute('aria-label', a.area.l);
      var mast = panel.querySelector(':scope > .w118mast') || panel.querySelector(':scope > [class*="mast"]');
      if (mast && mast.nextSibling) panel.insertBefore(nav, mast.nextSibling); else if (mast) panel.appendChild(nav); else panel.insertBefore(nav, panel.firstChild);
    }
    var key = a.area.k + ':' + a.tab, sameArea = lastTab && lastTab.split(':')[0] === a.area.k;
    if (nav.getAttribute('data-h') !== html) { nav.innerHTML = html; nav.setAttribute('data-h', html); }
    nav.setAttribute('aria-label', a.area.l);
    var on = nav.querySelector('a[aria-current="page"]'), ind = nav.querySelector('.ind');
    if (on && ind) {
      nav.classList.toggle('noanim', !sameArea || reduce || lastTab === key);
      if (!sameArea) { ind.style.transform = 'translateX(' + on.offsetLeft + 'px)'; ind.style.width = on.offsetWidth + 'px'; }
      requestAnimationFrame(function () { ind.style.transform = 'translateX(' + on.offsetLeft + 'px)'; ind.style.width = on.offsetWidth + 'px'; try { if (on.scrollIntoView && nav.scrollWidth > nav.clientWidth) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* fine */ } });
    }
    lastTab = key;
  }

  /* ---------- entering a section: cards rise once, never on a repaint ---------- */
  var lastSec = null;
  function entered(sec) {
    try { var st = document.getElementById('studio'); if (st) st.classList.toggle('w306today', sec === 'overview'); } catch (e) { /* fine */ }
    var h = document.getElementById('w225host'); if (!h || reduce) { lastSec = sec; return; }
    if (lastSec === sec) return;
    lastSec = sec;
    h.classList.remove('w306enter'); void h.offsetWidth; h.classList.add('w306enter');
    clearTimeout(entered.t); entered.t = setTimeout(function () { h.classList.remove('w306enter'); }, 420);
  }

  /* ---------- skeletons ---------- */
  function sk(w, hgt, mb) { return '<div class="w306sk" style="width:' + w + ';height:' + hgt + 'px;margin:0 0 ' + (mb == null ? 10 : mb) + 'px"></div>'; }
  function skeleton(sec) {
    var tile = '<div class="w306skcard" style="padding:14px">' + sk('55%', 12) + sk('40%', 28, 8) + sk('100%', 22, 0) + '</div>';
    var card = function (lines) { var s = '<div class="w306skcard">' + sk('38%', 18, 16); for (var i = 0; i < lines; i++) s += sk(i % 3 === 2 ? '72%' : '100%', 40); return s + '</div>'; };
    if (sec === 'overview' || !sec) return '<div class="w306" aria-busy="true" aria-label="Loading">' + sk('34%', 30, 6) + sk('22%', 14, 18) + '<div class="grid"><div>' + card(3) + card(2) + '</div><div>' + card(2) + '<div class="pulse" style="grid-template-columns:1fr 1fr">' + tile + tile + '</div></div></div></div>';
    if (sec === 'web') return '<div class="w306" aria-busy="true" aria-label="Loading">' + '<div class="heroes">' + tile + tile + tile + tile + '</div>' + card(1) + '<div class="grid"><div>' + card(4) + '</div><div>' + card(3) + '</div></div></div>';
    return '<div class="w306" aria-busy="true" aria-label="Loading">' + card(4) + card(3) + '</div>';
  }

  /* ---------- Today ---------- */
  var T = { camp: null, campAt: 0, olderOpen: false };
  function loadCamp() {
    if (T.campBusy || Date.now() - T.campAt < 300000) return;   /* once every five minutes at most, answered or not */
    T.campBusy = true; T.campAt = Date.now();
    Promise.resolve((typeof db !== 'undefined' ? db : window.db) ? (typeof db !== 'undefined' ? db : window.db).rpc('www_campaign_totals', { p_slug: 'gift-basket-drive' }) : null).then(function (r) { T.camp = r && r.data ? r.data : null; }, function () { /* fine */ }).then(function () { T.campBusy = false; if (T.camp) repaint('overview'); });
  }
  function repaint(sec) { var w = W2(); if (!w) return; var s = w.state(); if (!sec || s.sec === sec) { try { w.paint(); } catch (e) { /* fine */ } } }
  function hello() { var h = new Date().getHours(); return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  function today() {
    var w = W2(), x = X(); if (!w || !x) return '';
    var S = w.state(), all = w.posts(), now = Date.now(), t = x.today(), me = x.myEmail();
    var first = String(x.myName() || '').split(' ')[0];
    loadCamp(); if (!WEB.r28) loadWeb(28);
    /* what needs me */
    var needs = [], older = [];
    var pend = all.filter(function (p) { return p.approval_status === 'pending' && ['draft', 'scheduled', 'failed'].indexOf(p.status) >= 0; });
    if (S.pub && pend.length) pend.forEach(function (p) { needs.push({ w: 1, ic: 'check', c: '', t: 'Approve “' + x.titleOf(p) + '”', s: 'From ' + String(p.submitted_by || 'the team').split('@')[0] + (p.scheduled_at ? ' · goes out ' + x.niceWhen(p.scheduled_at) : ' · no date yet'), b: '<a class="btn rose" data-w225go="#studio/approvals?post=' + p.id + '">Review</a>' }); });
    else if (pend.length) needs.push({ w: 5, ic: 'check', c: 'tl', t: pend.length + ' post' + (pend.length > 1 ? 's' : '') + ' waiting for approval', s: 'Ian and KK are pinged on Slack', b: '<a class="btn" data-w225go="#studio/approvals">See them</a>' });
    all.filter(function (p) { return p.approval_status === 'changes' && x.lower(p.submitted_by) === me; }).forEach(function (p) { needs.push({ w: 2, ic: 'back', c: 'gd', t: '“' + x.titleOf(p) + '” was sent back to you', s: clip(p.approval_note || 'Open it to see the note', 90), b: '<a class="btn" data-w225open="' + p.id + '">Fix it</a>' }); });
    all.filter(function (p) { return p.status !== 'cancelled' && x.stateOf(p).attn; }).forEach(function (p) {
      var st = x.stateOf(p), when = new Date(p.scheduled_at || p.updated_at || p.created_at || now).getTime();
      var row = { w: st.cls === 'due' ? 2 : 3, ic: st.cls === 'due' ? 'hand' : 'warn', c: st.cls === 'due' ? 'gd' : 'fl', t: (st.cls === 'due' ? 'Post by hand: ' : '') + '“' + x.titleOf(p) + '”', s: clip(st.note || st.label || '', 110), b: '<a class="btn" data-w225open="' + p.id + '">Open</a>' };
      if (now - when > 14 * 86400000) older.push(row); else needs.push(row);
    });
    var c = w.counts() || {};
    if (c.inbox) { var open = S.comments.filter(function (cm) { return cm.status === 'open' && !cm.from_us; }), newest = open[0]; needs.push({ w: 4, ic: 'chat', c: '', t: c.inbox + ' comment' + (c.inbox > 1 ? 's' : '') + ' to answer', s: newest ? '@' + (newest.author_handle || newest.author_name || 'someone') + ': ' + clip(newest.text, 70) : '', b: '<a class="btn" data-w225go="#studio/inbox">Answer</a>' }); }
    if (c.messages) needs.push({ w: 4, ic: 'mail', c: '', t: c.messages + ' message' + (c.messages > 1 ? 's' : '') + ' waiting for us', s: 'Instagram and Facebook direct messages', b: '<a class="btn" data-w225go="#studio/messages">Answer</a>' });
    if (c.hashtags) needs.push({ w: 6, ic: 'hash', c: 'tl', t: c.hashtags + ' new post' + (c.hashtags > 1 ? 's' : '') + ' under our hashtags', s: 'Have a look before they need attention', b: '<a class="btn" data-w225go="#studio/hashtags">Look</a>' });
    var cx = x.cap(); if (cx && cx.missing && cx.missing.length) needs.push({ w: 3, ic: 'plug', c: 'fl', t: 'The Meta connection is missing ' + cx.missing.length + ' permission' + (cx.missing.length > 1 ? 's' : ''), s: 'Comments or posting may stop working', b: '<a class="btn" data-w225go="#studio/connections">Fix</a>' });
    needs.sort(function (a, b) { return a.w - b.w; });
    var row = function (n) { return '<div class="need"><span class="ic ' + n.c + '">' + ic(n.ic) + '</span><div style="min-width:0"><b>' + E(n.t) + '</b>' + (n.s ? '<small>' + E(n.s) + '</small>' : '') + '</div>' + n.b + '</div>'; };
    var needsCard = '<div class="card"><h3>What needs you' + (needs.length ? ' <small class="tnum">' + needs.length + '</small>' : '') + '</h3>' +
      (needs.length ? needs.slice(0, 7).map(row).join('') + (needs.length > 7 ? '<p class="muted sm" style="margin:8px 0 0">and ' + (needs.length - 7) + ' more</p>' : '') : '<div class="calm"><i>' + ic('check') + '</i><div><b style="display:block">You’re all caught up</b><span class="muted sm">Nothing waits for you in the Studio.</span></div></div>') +
      (older.length ? '<details class="older"' + (T.olderOpen ? ' open' : '') + ' data-w306older><summary>' + older.length + ' older alert' + (older.length > 1 ? 's' : '') + ' from more than two weeks ago</summary>' + older.map(row).join('') + '</details>' : '') + '</div>';
    /* the week */
    var mon = x.weekBounds(0)[0], cells = '', thumbs = function (p) { var th = x.thumbOf(p); return th ? '<img src="' + E(th) + '" alt="" loading="lazy">' : '<i class="ph"></i>'; };
    for (var i = 0; i < 7; i++) {
      var d = addD(mon, i), dd = new Date(d + 'T12:00:00');
      var list = all.filter(function (p) { return p.scheduled_at && x.dayOf(p.scheduled_at) === d && p.status !== 'cancelled'; }).sort(function (a, b) { return String(a.scheduled_at).localeCompare(String(b.scheduled_at)); });
      cells += '<div class="wd' + (d === t ? ' today' : '') + (d < t && !list.length ? ' past' : '') + '"><span>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] + '<em class="tnum">' + dd.getDate() + '</em></span>' +
        list.slice(0, 3).map(function (p) { return '<div class="p' + (p.status === 'draft' ? ' dr' : '') + '" data-w225open="' + p.id + '" title="' + E(x.titleOf(p)) + '">' + thumbs(p) + '<span>' + E(clip(x.titleOf(p), 34)) + '</span></div>'; }).join('') +
        (list.length > 3 ? '<span class="muted sm" style="text-transform:none;letter-spacing:0">+' + (list.length - 3) + ' more</span>' : '') +
        (d >= t ? '<button type="button" class="add" data-w225slotnew="' + d + '|18:00|" aria-label="Plan a post for ' + E(dd.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })) + '">+</button>' : '') + '</div>';
    }
    var gs = x.goalStatus(0), PL = x.PLX;
    var goals = x.PORDER.filter(function (k) { return gs[k].goal > 0; }).map(function (k) { var g = gs[k]; return '<span class="gl' + (g.n >= g.goal ? ' ok' : '') + '">' + x.mark(k) + '<span class="tnum">' + g.n + ' / ' + g.goal + '</span></span>'; }).join('');
    var drafts = all.filter(function (p) { return p.status === 'draft' && !p.scheduled_at && !p.banked_at; }).length;
    var weekCard = '<div class="card"><h3>This week<span class="sp"></span><a class="btn" data-w225go="#contentcal">Calendar</a><a class="btn pri" data-w225new="1">New post</a></h3><div class="week">' + cells + '</div>' +
      (goals ? '<div class="goals"><span class="muted sm" style="align-self:center">Weekly goals</span>' + goals + '</div>' : '') +
      (drafts ? '<p class="muted sm" style="margin:12px 0 0">' + drafts + ' idea' + (drafts > 1 ? 's' : '') + ' and drafts have no date yet. <a data-w225go="#studio/queue" style="cursor:pointer;color:' + ROSE + ';font-weight:700">Give them a slot</a></p>' : '') + '</div>';
    /* the campaign that is on */
    var cp = T.camp, campCard = '';
    if (cp && cp.open) {
      var p1 = cp.goal ? Math.min(1, (cp.raised || 0) / cp.goal) : 0, p2 = cp.gift_goal ? Math.min(1, (cp.gifts_in || 0) / cp.gift_goal) : 0;
      var dc = WEB.r28 && WEB.r28.donate ? WEB.r28.donate.filter(function (r) { return r.campaign === 'gift-basket-drive'; }).reduce(function (s, r) { return s + (r.clicks || 0); }, 0) : null;
      campCard = '<div class="card camp"><h3>' + ic('gift').replace('<svg', '<svg width="18" height="18" style="color:' + GOLD + '"') + E(cp.name || 'The drive') + '</h3>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b style="font:600 26px/1 ' + HEAD + ';color:' + GREEN + '" class="tnum">' + money(cp.raised) + '</b><span class="muted sm tnum">of ' + money(cp.goal) + '</span></div>' +
        '<div class="bar" role="img" aria-label="' + Math.round(p1 * 100) + '% of the goal"><i style="width:' + (p1 * 100).toFixed(1) + '%"></i></div>' +
        '<div class="facts"><div><b class="tnum">' + num(cp.gifts_in || 0) + '</b><span>gifts in, of ' + num(cp.gift_goal || 0) + '</span></div><div><b class="tnum">' + num(cp.donors || 0) + '</b><span>donors online</span></div><div><b class="tnum">' + (dc == null ? '–' : num(dc)) + '</b><span>Give clicks on the site, 28 days</span></div></div>' +
        (p2 ? '<p class="muted sm" style="margin:10px 0 0">Gifts collected: ' + Math.round(p2 * 100) + '% of the ' + num(cp.gift_goal) + ' target.</p>' : '') +
        '<p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="https://welfareavenue.com/gift-basket-drive/" target="_blank" rel="noopener">The drive page</a><a class="btn" data-w225go="#studio/web">Website results</a></p></div>';
    }
    /* the pulse: 28 days against the 28 before */
    var d28 = 28 * 86400000, reachC = 0, reachP = 0, sReach = new Array(28).fill(0);
    S.social.forEach(function (sp) { if (!sp.published_at) return; var age = now - new Date(sp.published_at).getTime(), v = Number(sp.reach || sp.views || 0); if (age < d28) { reachC += v; var ix = 27 - Math.floor(age / 86400000); if (ix >= 0 && ix < 28) sReach[ix] += v; } else if (age < 2 * d28) reachP += v; });
    var clicksC = S.clicks.filter(function (k) { return now - new Date(k.at).getTime() < d28; }).length, sClicks = new Array(28).fill(0);
    S.clicks.forEach(function (k) { var age = now - new Date(k.at).getTime(), ix = 27 - Math.floor(age / 86400000); if (ix >= 0 && ix < 28) sClicks[ix]++; });
    var r = WEB.r28, wt = r && r.totals, wc = wt && wt.cur, wp = wt && wt.prev;
    if (r && r.prev && r.prev.from <= '2026-11-09' && r.to >= '2026-10-02') wp = undefined;   /* the tracking gap (October 2 to November 9): no comparison */
    var acts = function (list) { return (list || []).filter(function (e) { return ['donate_click', 'form_sent', 'newsletter_signup'].indexOf(e.eventName) >= 0; }).reduce(function (s, e) { return s + (e.eventCount || 0); }, 0); };
    var tile = function (go, label, val, dl, sp) { return '<a class="tile" data-w225go="' + go + '"><span>' + label + '</span><b class="tnum">' + val + '</b>' + dl + (sp || '') + '</a>'; };
    var webDaily = r && r.daily ? r.daily.slice(-28).map(function (dd2) { return dd2.engaged; }) : null;
    var pulse = '<div class="card"><h3>The last 28 days<span class="sp"></span><a class="btn" data-w225go="#studio/web">All results</a></h3><div class="pulse">' +
      tile('#socialstats', 'Social reach', reachC ? num(reachC) : '–', reachC && reachP ? delta(reachC, reachP) : (reachC ? '' : '<span class="muted sm">no posts out</span>'), reachC ? spark(sReach, ROSE) : '') +
      tile('#studio/web', 'Engaged website visits', wc ? num(wc.engagedSessions) : (WEB.err28 ? '–' : '<span class="w306sk" style="display:inline-block;width:50px;height:24px;vertical-align:middle"></span>'), wc ? (wp === undefined ? '<span class="muted sm">tracking back since Nov 10</span>' : delta(wc.engagedSessions, wp && wp.engagedSessions)) : '', webDaily ? spark(webDaily, TEAL) : '') +
      tile('#studio/links', 'Short link clicks', num(clicksC), '', clicksC ? spark(sClicks, PURPLE) : '') +
      tile('#studio/web', 'Website actions', r ? num(acts(r.events && r.events.cur)) : '–', r ? '<span class="muted sm">gives, forms, sign-ups</span>' : '', '') +
      '</div></div>';
    /* the best post */
    var top = S.social.filter(function (sp) { return sp.published_at && now - new Date(sp.published_at).getTime() < d28; }).sort(function (a, b) { var ea = Number(a.engagement || 0) || (Number(a.likes || 0) + Number(a.comments || 0) + Number(a.shares || 0) + Number(a.saves || 0)), eb = Number(b.engagement || 0) || (Number(b.likes || 0) + Number(b.comments || 0) + Number(b.shares || 0) + Number(b.saves || 0)); return eb - ea; })[0];
    var topCard = top ? '<div class="card"><h3>Best post this month</h3><div style="display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center">' + ((top.thumb_cached || top.thumb_url) ? '<img src="' + E(top.thumb_cached || top.thumb_url) + '" alt="" loading="lazy" style="width:64px;height:64px;border-radius:12px;object-fit:cover">' : '<i style="width:64px;height:64px;border-radius:12px;background:rgba(16,63,57,.08)"></i>') +
      '<div style="min-width:0"><b style="display:block;font-size:13.5px;line-height:1.35">' + E(clip(top.caption || 'A post', 110)) + '</b><span class="muted sm">' + x.mark(top.platform) + ' <span class="tnum">' + num(top.reach || top.views || 0) + '</span> reach · <span class="tnum">' + num(top.likes || 0) + '</span> likes · <span class="tnum">' + num(top.comments || 0) + '</span> comments</span></div></div>' + (top.url ? '<p style="margin:12px 0 0"><a class="btn" href="' + E(top.url) + '" target="_blank" rel="noopener">Open it</a></p>' : '') + '</div>' : '';
    var line = needs.length ? needs.length + ' thing' + (needs.length > 1 ? 's' : '') + ' need' + (needs.length > 1 ? '' : 's') + ' you' : 'Nothing waits for you';
    var sched = all.filter(function (p) { return p.status === 'scheduled' && p.scheduled_at && new Date(p.scheduled_at).getTime() > now; }).length;
    line += ' · ' + (sched ? sched + ' post' + (sched > 1 ? 's' : '') + ' scheduled ahead' : 'nothing scheduled ahead yet');
    return '<div class="w306"><div class="hello"><div><h2>' + E(hello() + (first ? ', ' + first : '')) + '</h2><p>' + E(new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })) + ' · ' + E(line) + '</p></div></div>' +
      '<div class="grid"><div>' + needsCard + weekCard + '</div><div>' + campCard + pulse + topCard + '</div></div></div>';
  }

  /* ---------- Results > Website ---------- */
  var WEB = { range: 28, data: {}, busy: {}, err: {}, at: {}, r28: null, err28: null, live: null, liveAt: 0 };
  try { var sr = Number(localStorage.getItem('w306range')); if ([7, 28, 90, 365].indexOf(sr) >= 0) WEB.range = sr; } catch (e) { /* fine */ }
  function rangeDates(days) { var to = ymd(new Date()), from = addD(to, -(days - 1)); return [from, to]; }
  function call(body) { var w = W2(); if (w && w.x && w.x.fn) return w.x.fn('web-insights', body); return Promise.reject(new Error('The Studio is not ready')); }
  function loadWeb(days, fresh) {
    days = days || WEB.range; var k = String(days);
    if (WEB.busy[k]) return WEB.busy[k];
    if (!fresh && WEB.at[k] && Date.now() - WEB.at[k] < 60000) return Promise.resolve();   /* one try a minute, answered or not */
    WEB.at[k] = Date.now();
    var rd = rangeDates(days);
    WEB.busy[k] = call({ action: 'report', from: rd[0], to: rd[1], fresh: !!fresh }).then(function (j) {
      if (!j || j.error || !j.totals) throw new Error((j && j.error) || 'No answer from Google Analytics');
      WEB.data[k] = j; WEB.err[k] = null; if (days === 28) { WEB.r28 = j; WEB.err28 = null; }
    }).catch(function (e) { WEB.err[k] = (e && e.message) || String(e); if (days === 28) WEB.err28 = WEB.err[k]; }).then(function () { WEB.busy[k] = null; repaint('web'); repaint('overview'); });
    return WEB.busy[k];
  }
  function loadLive() {
    if (WEB.liveBusy || Date.now() - WEB.liveAt < 60000) return;
    WEB.liveBusy = true; WEB.liveAt = Date.now();
    call({ action: 'realtime' }).then(function (j) { WEB.live = j && j.ok ? j : null; }, function () { WEB.live = null; }).then(function () { WEB.liveBusy = false; if (WEB.live) repaint('web'); });
  }
  var CH = { 'Organic Search': ['Google and other searches', TEAL], 'Direct': ['Typed in or no source', '#8e9a96'], 'Organic Social': ['Social media posts', ROSE], 'Paid Social': ['Paid social', '#d06b9a'], 'Referral': ['Links on other sites', PURPLE], 'Paid Search': ['Paid search ads', GOLD], 'Email': ['Emails', '#3d7bb0'], 'Unassigned': ['Unknown', '#c4c9c6'], 'Organic Video': ['Video', '#e0574a'], 'Cross-network': ['Google campaigns', '#a07d2a'], 'AI Assistant': ['ChatGPT and other chat tools', '#5c8fa8'] };
  function chName(k) { return (CH[k] || [k])[0]; } function chColor(k) { return (CH[k] || [0, '#9aa6a2'])[1]; }
  var PAGE_NAMES = { '/': 'Home', '/fr/': 'Accueil (FR)', '/donate/': 'Donate', '/volunteer/': 'Volunteer', '/join/': 'Join our team', '/gift-basket-drive/': 'Holiday Gift Basket Drive', '/fr/paniers-cadeaux/': 'Paniers-cadeaux (FR)', '/about/': 'About', '/events/': 'Events', '/contact/': 'Contact', '/press/': 'Press', '/toronto/': 'Toronto', '/flag-football/': 'Flag football', '/privacy/': 'Privacy' };
  function pageName(p) { var k = String(p || '').split('?')[0]; return PAGE_NAMES[k] || PAGE_NAMES[k + '/'] || k; }
  function chartArea(daily, acts) {
    if (!daily || daily.length < 2) return '<div class="empty">Not enough days in this range to draw a line.</div>';
    var W = 680, H = 190, pl = 34, pr = 8, pt = 10, pb = 24, iw = W - pl - pr, ih = H - pt - pb;
    var mx = Math.max.apply(null, daily.map(function (d) { return d.sessions || 0; })) || 1;
    var step = Math.pow(10, Math.floor(Math.log10(mx))), nice = Math.ceil(mx / step) * step; if (nice / step <= 2) step = step / 2; mx = Math.max(nice, 1);
    var X = function (i) { return pl + i / (daily.length - 1) * iw; }, Y = function (v) { return pt + ih - v / mx * ih; };
    var line = function (k) { return daily.map(function (d, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(d[k] || 0).toFixed(1); }).join(''); };
    var grid = ''; for (var v = 0; v <= mx; v += step) grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="rgba(16,63,57,.08)"/><text x="' + (pl - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="' + MUTED + '">' + num(v) + '</text>';
    var lab = ''; var every = Math.max(1, Math.round(daily.length / 6));
    daily.forEach(function (d, i) { if (i % every === 0 || i === daily.length - 1) { var dt = new Date(d.day + 'T12:00:00'); lab += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="' + MUTED + '">' + dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + '</text>'; } });
    var dots = ''; var byDay = {}; (acts || []).forEach(function (a) { byDay[a.day] = (byDay[a.day] || 0) + (a.count || 0); });
    daily.forEach(function (d, i) { if (byDay[d.day]) dots += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(d.sessions || 0).toFixed(1) + '" r="4" fill="' + GOLD + '" stroke="#FFFAF2" stroke-width="1.5"><title>' + byDay[d.day] + ' action' + (byDay[d.day] > 1 ? 's' : '') + ' on ' + d.day + '</title></circle>'; });
    var s = line('sessions'), e = line('engaged');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visits and engaged visits per day">' + grid +
      '<path d="' + s + 'L' + X(daily.length - 1).toFixed(1) + ' ' + Y(0) + 'L' + pl + ' ' + Y(0) + 'Z" fill="' + GREEN + '" opacity=".07"/>' +
      '<path d="' + s + '" fill="none" stroke="' + GREEN + '" stroke-opacity=".45" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="' + e + 'L' + X(daily.length - 1).toFixed(1) + ' ' + Y(0) + 'L' + pl + ' ' + Y(0) + 'Z" fill="' + TEAL + '" opacity=".16"/>' +
      '<path d="' + e + '" fill="none" stroke="' + TEAL + '" stroke-width="2.2" stroke-linejoin="round"/>' + dots + lab + '</svg>' +
      '<div class="legend"><span><i style="background:' + GREEN + ';opacity:.5"></i>Visits</span><span><i style="background:' + TEAL + '"></i>Engaged visits (10 seconds or more, two pages, or an action)</span>' + (dots ? '<span><i style="background:' + GOLD + ';border-radius:50%"></i>A day with a gift click, a form sent or a sign-up</span>' : '') + '</div>';
  }
  function bot(r) { return (r.totalUsers || 0) >= 15 && (r.sessions || 0) >= 15 && (r.engaged == null || r.engaged === 0); }
  function web() {
    var k = String(WEB.range), r = WEB.data[k], err = WEB.err[k];
    if (!r && !WEB.busy[k]) loadWeb(WEB.range);
    loadLive();
    var seg = '<div class="seg" role="group" aria-label="Range">' + [[7, '7 days'], [28, '28 days'], [90, '90 days'], [365, '12 months']].map(function (o) { return '<button type="button" data-w306range="' + o[0] + '" aria-pressed="' + (WEB.range === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
    var liveH = WEB.live ? '<span class="live" title="People on welfareavenue.com in the last 30 minutes who accepted cookies"><i></i><span class="tnum">' + num(WEB.live.active) + '</span> on the site now</span>' : '';
    var top = '<div class="bar1">' + seg + '<span class="sp"></span>' + liveH + '<button type="button" class="btn" data-w306fresh="1" aria-label="Read again from Google Analytics">' + ic('refresh').replace('<svg', '<svg width="15" height="15"') + 'Refresh</button></div>';
    if (err && !r) return '<div class="w306">' + top + '<div class="card"><div class="empty">The website numbers could not load: ' + E(clip(err, 200)) + '. <a data-w306fresh="1" style="cursor:pointer;color:' + ROSE + ';font-weight:700">Try again</a></div></div></div>';
    if (!r) return '<div class="w306">' + top + skeleton('web').replace('<div class="w306" aria-busy="true" aria-label="Loading">', '<div aria-busy="true" aria-label="Loading">') + '</div>';
    /* the new site went live on October 2 without the Google tag; it came back on November 10 (wave306 note) */
    var GAP = ['2026-10-02', '2026-11-09'], hits = function (a, b) { return a <= GAP[1] && b >= GAP[0]; };
    var gapCur = hits(r.from, r.to), gapPrev = r.prev && hits(r.prev.from, r.prev.to), noCompare = gapCur || gapPrev;
    var c = (r.totals && r.totals.cur) || {}, p = noCompare ? {} : ((r.totals && r.totals.prev) || {});
    var users = c.totalUsers || 0, engaged = c.engagedSessions || 0, sessions = c.sessions || 0;
    var perUser = users ? (c.userEngagementDuration || 0) / users : 0, perUserP = noCompare ? undefined : p.totalUsers ? (p.userEngagementDuration || 0) / p.totalUsers : null;
    var evC = {}, evP = {}; (r.events && r.events.cur || []).forEach(function (e) { evC[e.eventName] = e; }); (r.events && r.events.prev || []).forEach(function (e) { evP[e.eventName] = e; });
    var ev = function (n, m) { return (evC[n] && evC[n][m || 'eventCount']) || 0; };
    if (noCompare) evP = {};
    var actions = ev('donate_click') + ev('form_sent') + ev('newsletter_signup'), actionsP = ((evP.donate_click || {}).eventCount || 0) + ((evP.form_sent || {}).eventCount || 0) + ((evP.newsletter_signup || {}).eventCount || 0);
    var since = r.events_since || '2026-11-10', before = r.from < since;
    var heroes = '<div class="heroes">' +
      '<div class="hero main"><span>Engaged visits</span><b class="tnum">' + num(engaged) + '</b>' + delta(engaged, p.engagedSessions) + '</div>' +
      '<div class="hero"><span>Visitors</span><b class="tnum">' + num(users) + '</b>' + delta(users, p.totalUsers) + ' <span class="muted sm" style="display:inline">' + pct(c.engagementRate || 0) + ' engaged</span></div>' +
      '<div class="hero"><span>Time with us, per visitor</span><b class="tnum">' + dur(perUser) + '</b>' + delta(perUser, perUserP) + '</div>' +
      '<div class="hero"><span>Actions taken</span><b class="tnum">' + num(actions) + '</b>' + (actionsP ? delta(actions, actionsP) : '<span class="muted sm" style="display:inline">gives, forms, sign-ups</span>') + '</div></div>';
    /* what it says */
    var says = [];
    var chC = (r.channels && r.channels.cur || []).filter(function (x) { return (x.sessions || 0) > 0; }).sort(function (a, b) { return (b.sessions || 0) - (a.sessions || 0); }), chP = {}; if (!noCompare) (r.channels && r.channels.prev || []).forEach(function (x) { chP[x.sessionDefaultChannelGroup] = x; });
    if (!noCompare && p.engagedSessions) { var dd = (engaged - p.engagedSessions) / p.engagedSessions; if (Math.abs(dd) >= 0.1) says.push([dd > 0 ? 'g' : 'r', dd > 0 ? '↑' : '↓', 'Engaged visits are ' + (dd > 0 ? 'up ' : 'down ') + Math.abs(Math.round(dd * 100)) + '% on the ' + (WEB.range === 365 ? 'year' : WEB.range + ' days') + ' before (' + num(p.engagedSessions) + ' then, ' + num(engaged) + ' now).']); }
    var bestCh = chC.filter(function (x) { return (x.sessions || 0) >= Math.max(20, sessions * 0.03); }).map(function (x) { return { k: x.sessionDefaultChannelGroup, rate: (x.engagedSessions || 0) / (x.sessions || 1), n: x.sessions }; }).sort(function (a, b) { return b.rate - a.rate; })[0];
    if (bestCh) says.push(['g', '★', chName(bestCh.k) + ' bring the most engaged visitors: ' + pct(bestCh.rate) + ' of those visits stay and look around.']);
    var soc = chC.filter(function (x) { return x.sessionDefaultChannelGroup === 'Organic Social' || x.sessionDefaultChannelGroup === 'Paid Social'; }).reduce(function (s, x) { return s + (x.sessions || 0); }, 0);
    says.push([soc / (sessions || 1) < 0.1 ? 'r' : 'n', '→', 'Social media sent ' + num(soc) + ' visit' + (soc === 1 ? '' : 's') + ' (' + pct(soc / (sessions || 1)) + ' of all). ' + (soc / (sessions || 1) < 0.1 ? 'Put a Studio short link or the link in bio in every post, so the site gets the people the posts reach.' : 'Keep linking the site from posts.')]);
    var bots = (r.places || []).filter(function (x) { return x.country !== 'Canada' && x.country !== 'United States' && (x.totalUsers || 0) >= 15 && (x.sessions || 0) <= (x.totalUsers || 0) * 1.05; });
    if (bots.length) says.push(['n', '!', num(bots.reduce(function (s, x) { return s + x.totalUsers; }, 0)) + ' visitors from ' + bots.map(function (x) { return x.city; }).join(', ') + ' came once and left at once: most likely automated traffic, not people. Engaged visits leave it out.']);
    var weakLp = (r.landing || []).filter(function (x) { return (x.sessions || 0) >= 10 && (x.engagedSessions || 0) / (x.sessions || 1) < 0.15; })[0];
    if (weakLp) says.push(['r', '↓', pageName(weakLp.landingPage) + ' starts ' + num(weakLp.sessions) + ' visits but ' + pct((weakLp.engagedSessions || 0) / (weakLp.sessions || 1)) + ' stay. ' + (/cart|shop|activity/.test(weakLp.landingPage) ? 'It is an address from the old site: worth a redirect.' : 'Check what people see first there.')]);
    var topClick = (r.clicks || []).filter(function (x) { return x.text; })[0];
    if (topClick) says.push(['g', '\u2605', 'The most clicked: \u201c' + topClick.text + '\u201d (' + num(topClick.count) + ' clicks) on ' + pageName(topClick.page) + '.']);
    if (before) says.push(['n', 'i', 'Gives, sign-ups and forms are counted from ' + new Date(since + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric' }) + ', and since then only visitors who accept cookies are counted at all.']);
    var saysCard = '<div class="card"><h3>What the numbers say</h3><ul class="says">' + says.slice(0, 5).map(function (s) { return '<li><i class="' + s[0] + '">' + E(s[1]) + '</i><span>' + E(s[2]) + '</span></li>'; }).join('') + '</ul></div>';
    var trend = '<div class="card"><h3>Visits, day by day<span class="sp"></span><small class="tnum">' + E(new Date(r.from + 'T12:00:00').toLocaleDateString('en-CA', r.from.slice(0, 4) !== r.to.slice(0, 4) ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })) + ' to ' + E(new Date(r.to + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })) + '</small></h3>' + chartArea(r.daily, r.actions_daily) + '</div>';
    /* where they come from */
    var chMax = Math.max.apply(null, chC.map(function (x) { return x.sessions || 0; }).concat([1]));
    var chH = chC.slice(0, 8).map(function (x) { var k2 = x.sessionDefaultChannelGroup, eng = (x.engagedSessions || 0) / (x.sessions || 1), pr = chP[k2]; return '<div class="rw"><span class="nm">' + E(chName(k2)) + ' <span class="muted sm">' + pct(eng) + ' engaged</span></span><span class="vl tnum">' + num(x.sessions) + (pr ? ' ' + delta(x.sessions, pr.sessions) : '') + '</span><span class="tr"><i style="width:' + ((x.engagedSessions || 0) / chMax * 100).toFixed(1) + '%;background:' + chColor(k2) + '"></i><i style="width:' + (((x.sessions || 0) - (x.engagedSessions || 0)) / chMax * 100).toFixed(1) + '%;background:' + chColor(k2) + ';opacity:.3"></i></span></div>'; }).join('');
    var src = (r.sources || []).slice(0, 8).map(function (x) { return '<tr><td>' + E(x.sessionSource === '(direct)' ? 'Direct' : x.sessionSource) + '<small>' + E(x.sessionMedium === '(none)' ? '' : x.sessionMedium) + '</small></td><td class="tnum">' + num(x.sessions) + '</td><td class="tnum hm">' + pct((x.engagedSessions || 0) / (x.sessions || 1)) + '</td></tr>'; }).join('');
    var camps = (r.campaigns || []).filter(function (x) { return !/^\(/.test(x.sessionCampaignName || ''); }).slice(0, 6).map(function (x) { return '<tr><td>' + E(x.sessionCampaignName) + '<small>' + E(x.sessionSource) + '</small></td><td class="tnum">' + num(x.sessions) + '</td><td class="tnum hm">' + pct((x.engagedSessions || 0) / (x.sessions || 1)) + '</td></tr>'; }).join('');
    var whereCard = '<div class="card"><h3>Where visitors come from</h3><div class="rows">' + (chH || '<div class="empty">No visits in this range.</div>') + '</div>' +
      (src ? '<h3 style="margin-top:18px;font-size:16px">Top sources</h3><table class="t"><thead><tr><th>Source</th><th>Visits</th><th class="hm">Engaged</th></tr></thead><tbody>' + src + '</tbody></table>' : '') +
      '<h3 style="margin-top:18px;font-size:16px">Campaign links</h3>' + (camps ? '<table class="t"><thead><tr><th>Campaign</th><th>Visits</th><th class="hm">Engaged</th></tr></thead><tbody>' + camps + '</tbody></table>' : '<div class="empty">No tagged links brought visits yet. A Studio short link adds the campaign for you, so each post, email or poster shows up here by name. <a data-w225go="#studio/links" style="cursor:pointer;color:' + ROSE + ';font-weight:700">Make a short link</a></div>') + '</div>';
    /* what brings them in */
    var lpH = (r.landing || []).slice(0, 10).map(function (x) { var rate = (x.engagedSessions || 0) / (x.sessions || 1), t = (x.engagedSessions ? (x.userEngagementDuration || 0) / (x.totalUsers || 1) : 0); return '<tr><td>' + E(pageName(x.landingPage)) + (rate < 0.15 && (x.sessions || 0) >= 10 ? '<span class="tag bad">people leave</span>' : rate >= 0.6 && (x.sessions || 0) >= 5 ? '<span class="tag good">holds attention</span>' : '') + '<small>' + E(x.landingPage) + '</small></td><td class="tnum">' + num(x.sessions) + '</td><td class="tnum">' + pct(rate) + '</td><td class="tnum hm">' + dur(t) + '</td></tr>'; }).join('');
    var lpCard = '<div class="card"><h3>The pages people arrive on</h3>' + (lpH ? '<table class="t"><thead><tr><th>Page</th><th>Visits</th><th>Engaged</th><th class="hm">Time</th></tr></thead><tbody>' + lpH + '</tbody></table>' : '<div class="empty">No visits in this range.</div>') + '</div>';
    /* what they do */
    var opened = ev('signup_open'), formsSent = ev('form_sent'), gives = ev('donate_click'), news = ev('newsletter_signup');
    var fMax = Math.max(sessions, 1);
    var fs = function (label, n, sub) { return '<div class="fs"><span>' + E(label) + (sub ? '<small class="muted" style="display:block;font-size:11.5px">' + E(sub) + '</small>' : '') + '</span><span class="tr"><i style="width:' + Math.max(n ? 1.5 : 0, n / fMax * 100).toFixed(1) + '%"></i></span><b class="tnum">' + num(n) + '</b></div>'; };
    var funnel = '<div class="funnel">' + fs('Visits', sessions) + fs('Engaged', engaged, pct(engaged / (sessions || 1)) + ' of visits') + fs('Clicked Give or a sign-up', gives + opened) + fs('Sent a form or signed up', formsSent + news) + '</div>';
    var donH = (r.donate || []).sort(function (a, b) { return (b.clicks || 0) - (a.clicks || 0); }).map(function (x) { return '<tr><td>' + E(x.campaign === 'general' ? 'Donate (general)' : x.campaign === 'gift-basket-drive' ? 'Holiday Gift Basket Drive' : x.campaign) + '</td><td class="tnum">' + num(x.clicks) + '</td><td class="tnum hm">' + (x.value ? money(x.value) : '–') + '</td></tr>'; }).join('');
    var FN = { volunteer: 'Volunteer', benevole: 'Bénévole', 'benevole,volunteer': 'Volunteer', contact: 'Contact', join: 'Join our team', group: 'Group volunteering', groupe: 'Groupe', 'infolettre,newsletter': 'Newsletter', 'gift-drive-give': 'Drive: give', 'gift-drive-group': 'Drive: group', 'gift-drive-sponsor': 'Drive: sponsor', 'gift-drive-volunteer': 'Drive: volunteer' };
    var forms = {}; (r.forms || []).forEach(function (f) { var key = f.form || 'other'; forms[key] = forms[key] || { open: 0, submit: 0, sent: 0, news: 0 }; if (f.event === 'signup_open') forms[key].open += f.count; else if (f.event === 'form_submit') forms[key].submit += f.count; else if (f.event === 'form_sent') forms[key].sent += f.count; else if (f.event === 'newsletter_signup') forms[key].news += f.count; });
    var formH = Object.keys(forms).sort(function (a, b) { return (forms[b].sent + forms[b].news) - (forms[a].sent + forms[a].news); }).map(function (key) { var f = forms[key], s = f.sent + f.news; return '<tr><td>' + E(FN[key] || key.replace(/^\/|\/$/g, '') || 'Other') + '</td><td class="tnum hm">' + num(f.open + f.submit) + '</td><td class="tnum">' + num(s) + '</td></tr>'; }).join('');
    var doCard = '<div class="card"><h3>What visitors do</h3>' + funnel +
      '<h3 style="margin-top:18px;font-size:16px">Give clicks by campaign</h3>' + (donH ? '<table class="t"><thead><tr><th>Campaign</th><th>Clicks</th><th class="hm">Amounts picked</th></tr></thead><tbody>' + donH + '</tbody></table>' : '<div class="empty">' + (before ? 'Counted from November 10.' : 'No Give clicks yet in this range.') + ' Gifts themselves are counted in the Fundraising app from Stripe.</div>') +
      '<h3 style="margin-top:18px;font-size:16px">Forms</h3>' + (formH ? '<table class="t"><thead><tr><th>Form</th><th class="hm">Started</th><th>Sent</th></tr></thead><tbody>' + formH + '</tbody></table>' : '<div class="empty">No forms sent yet in this range.</div>') + '</div>';
    /* who */
    var devTot = (r.devices || []).reduce(function (s, x) { return s + (x.totalUsers || 0); }, 0) || 1;
    var devH = (r.devices || []).sort(function (a, b) { return (b.totalUsers || 0) - (a.totalUsers || 0); }).map(function (x) { var nm = x.deviceCategory === 'mobile' ? 'Phone' : x.deviceCategory === 'desktop' ? 'Computer' : x.deviceCategory === 'tablet' ? 'Tablet' : x.deviceCategory; return '<div class="rw"><span class="nm">' + E(nm) + ' <span class="muted sm">' + pct(x.engagementRate || 0) + ' engaged</span></span><span class="vl tnum">' + pct((x.totalUsers || 0) / devTot) + '</span><span class="tr"><i style="width:' + ((x.totalUsers || 0) / devTot * 100).toFixed(1) + '%;background:' + GREEN + '"></i></span></div>'; }).join('');
    var nv = {}; (r.returning || []).forEach(function (x) { nv[x.newVsReturning] = x.totalUsers || 0; });
    var retH = (nv['new'] || nv.returning) ? '<p class="sm" style="margin:12px 0 0"><b class="tnum">' + num(nv.returning || 0) + '</b> returning and <b class="tnum">' + num(nv['new'] || 0) + '</b> new visitors.</p>' : '';
    var placeH = (r.places || []).slice(0, 8).map(function (x) { var b = bots.indexOf(x) >= 0; return '<div class="rw"><span class="nm">' + E(x.city) + ' <span class="muted sm">' + E(x.country) + '</span>' + (b ? '<span class="tag info">automated</span>' : '') + '</span><span class="vl tnum">' + num(x.totalUsers) + '</span></div>'; }).join('');
    var whoCard = '<div class="card"><h3>Who visits</h3><div class="rows">' + devH + '</div>' + retH + (placeH ? '<h3 style="margin-top:18px;font-size:16px">Where they are</h3><div class="rows">' + placeH + '</div>' : '') + '</div>';
    var popH = (r.pages || []).slice(0, 8).map(function (x) { return '<tr><td>' + E(pageName(x.pagePath)) + '<small>' + E(clip(x.pageTitle, 60)) + '</small></td><td class="tnum">' + num(x.screenPageViews) + '</td><td class="tnum hm">' + dur((x.userEngagementDuration || 0) / (x.screenPageViews || 1)) + '</td></tr>'; }).join('');
    var popCard = popH ? '<div class="card"><h3>Most viewed pages</h3><table class="t"><thead><tr><th>Page</th><th>Views</th><th class="hm">Per view</th></tr></thead><tbody>' + popH + '</tbody></table></div>' : '';
    /* what people click, how far they read, the parts they see, the paths they take (analytics.js since 10/11/26) */
    var AREA = { menu: 'Menu', footer: 'Footer', popup: 'Pop-up form', page: 'Page' };
    var areaName = function (a) { return AREA[a] || (a ? a.replace(/-/g, ' ') : 'Page'); };
    var EVN = { donate_click: 'Give', signup_open: 'Sign-up', contact_click: 'Contact', language_switch: 'Language', link_click: 'Link', button_click: 'Button' };
    var clicks = (r.clicks || []).slice(0, 12);
    var clickH = clicks.map(function (x) { return '<tr><td>' + E(x.text || '(no words)') + '<span class="tag info">' + E(EVN[x.event] || x.event) + '</span><small>' + E(areaName(x.area)) + ' · ' + E(pageName(x.page)) + '</small></td><td class="tnum">' + num(x.count) + '</td><td class="tnum hm">' + num(x.people) + '</td></tr>'; }).join('');
    var areaTot = {}; (r.clicks || []).forEach(function (x) { var a = x.area === 'menu' || x.area === 'footer' || x.area === 'popup' ? x.area : 'page'; areaTot[a] = (areaTot[a] || 0) + (x.count || 0); });
    var areaSum = Object.keys(areaTot).reduce(function (s2, k2) { return s2 + areaTot[k2]; }, 0);
    var areaBar = areaSum ? '<div class="rw" style="margin:0 0 12px"><span class="nm muted sm">Where clicks happen</span><span class="vl"></span><span class="tr">' + ['page', 'menu', 'popup', 'footer'].filter(function (k2) { return areaTot[k2]; }).map(function (k2, i2) { return '<i title="' + E(areaName(k2)) + ' ' + pct(areaTot[k2] / areaSum) + '" style="width:' + (areaTot[k2] / areaSum * 100).toFixed(1) + '%;background:' + [GREEN, ROSE, GOLD, PURPLE][i2] + '"></i>'; }).join('') + '</span></div><div class="legend" style="margin:-6px 0 12px">' + ['page', 'menu', 'popup', 'footer'].filter(function (k2) { return areaTot[k2]; }).map(function (k2, i2) { return '<span><i style="background:' + [GREEN, ROSE, GOLD, PURPLE][i2] + '"></i>' + E(areaName(k2)) + ' ' + pct(areaTot[k2] / areaSum) + '</span>'; }).join('') + '</div>' : '';
    var clickCard = '<div class="card"><h3>What people click</h3>' + (clickH ? areaBar + '<table class="t"><thead><tr><th>Clicked</th><th>Clicks</th><th class="hm">People</th></tr></thead><tbody>' + clickH + '</tbody></table>' : '<div class="empty">Every link and button on the site is counted from November 10, with where it sits on the page. The first clicks show here within a day.</div>') + '</div>';
    var pp = {}; (r.page_people || []).forEach(function (x) { pp[x.page] = x.people; });
    var depthBy = {}; (r.scroll || []).forEach(function (x) { (depthBy[x.page] = depthBy[x.page] || {})[x.pct] = x.people; });
    var depthRows = Object.keys(depthBy).map(function (pg) { var d0 = depthBy[pg], base = Math.max(pp[pg] || 0, d0[25] || 0, 1); return { pg: pg, base: base, d: [25, 50, 75, 100].map(function (m) { return Math.min(1, (d0[m] || 0) / base); }) }; }).filter(function (x) { return x.base >= 3; }).sort(function (a, b) { return b.base - a.base; }).slice(0, 8);
    var secBy = {}; (r.sections || []).forEach(function (x) { (secBy[x.page] = secBy[x.page] || []).push(x); });
    var depthH = depthRows.map(function (x) {
      var half = x.d[1], end = x.d[3];
      var secs = (secBy[x.pg] || []).sort(function (a, b) { return (b.people || 0) - (a.people || 0); });
      var lost = secs.filter(function (s3) { return (s3.people || 0) / x.base < 0.25; }).slice(-2);
      return '<div style="padding:10px 0;border-top:1px solid rgba(16,63,57,.08)"><div class="rw"><span class="nm"><b style="font-weight:600">' + E(pageName(x.pg)) + '</b> <span class="muted sm">' + num(x.base) + ' people</span>' + (half < 0.35 ? '<span class="tag bad">most stop early</span>' : end >= 0.5 ? '<span class="tag good">read to the end</span>' : '') + '</span><span class="vl"></span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:6px">' + x.d.map(function (v, i3) { return '<div title="' + [25, 50, 75, 100][i3] + '% down the page: ' + pct(v) + '" style="height:26px;border-radius:6px;background:rgba(42,140,122,' + (0.08 + v * 0.8).toFixed(2) + ');display:grid;place-items:center;font:600 11px/1 inherit;color:' + (v > 0.55 ? '#FFFAF2' : GREEN) + '">' + pct(v) + '</div>'; }).join('') + '</div>' +
        (lost.length ? '<small class="muted" style="display:block;margin-top:6px">Few people reach: ' + lost.map(function (s3) { return E(s3.section.replace(/-/g, ' ')); }).join(', ') + '</small>' : '') + '</div>';
    }).join('');
    var depthCard = '<div class="card"><h3>How far people read<span class="sp"></span><small>25 · 50 · 75 · 100% down the page</small></h3>' + (depthH || '<div class="empty">Scroll depth and the page sections people see are counted from November 10.</div>') + '</div>';
    var paths = (r.paths || []).slice(0, 10), pMax = Math.max.apply(null, paths.map(function (x) { return x.views || 0; }).concat([1]));
    var fromHome = (r.paths || []).filter(function (x) { return x.from === '/' || x.from === '/fr/'; }).slice(0, 5);
    var pathH = paths.map(function (x) { return '<div class="rw"><span class="nm">' + E(pageName(x.from)) + ' <span class="muted">→</span> <b style="font-weight:600">' + E(pageName(x.to)) + '</b></span><span class="vl tnum">' + num(x.views) + '</span><span class="tr"><i style="width:' + ((x.views || 0) / pMax * 100).toFixed(1) + '%;background:' + PURPLE + '"></i></span></div>'; }).join('');
    var pathCard = '<div class="card"><h3>Paths through the site</h3>' + (pathH ? '<div class="rows">' + pathH + '</div>' + (fromHome.length ? '<p class="sm" style="margin:12px 0 0"><b>From Home, people go to</b> ' + fromHome.map(function (x) { return E(pageName(x.to)) + ' <span class="muted tnum">(' + num(x.views) + ')</span>'; }).join(', ') + '.</p>' : '') : '<div class="empty">The moves from one page to the next show here as people use the new site (the old one was a single page app, so it never recorded them).</div>') + '</div>';
    var gapNote = noCompare ? '<p class="note">The new site had no tracking from October 2 to November 9 (fixed November 10), so ' + (gapCur ? 'this range is missing those weeks' : 'the period before has almost no data') + ' and no comparison is shown. ' + (WEB.range < 365 ? 'Pick 12 months to see the old site\u2019s year, or come back as the new numbers build up.' : '') + '</p>' : '';
    var note = gapNote + ((r.errors && r.errors.length) ? '<p class="note">Some numbers are not available yet from Google Analytics (new event details can take a day to appear).</p>' : '');
    var made = '<p class="muted sm" style="margin:4px 0 0">From Google Analytics, ' + (r.cached ? 'read ' : 'read just now') + (r.cached ? E(agoShort(r.made_at)) : '') + '. Visitors are counted only when they accept cookies on the site.</p>';
    return '<div class="w306">' + top + note + heroes + '<div class="grid"><div>' + saysCard + trend + whereCard + lpCard + pathCard + '</div><div>' + doCard + clickCard + depthCard + whoCard + popCard + '</div></div>' + made + '</div>';
  }
  function agoShort(iso) { var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el = t.closest('[data-w306range],[data-w306fresh]'); if (!el) return;
    e.preventDefault();
    if (el.hasAttribute('data-w306range')) { var v = Number(el.getAttribute('data-w306range')); if (v && v !== WEB.range) { WEB.range = v; try { localStorage.setItem('w306range', String(v)); } catch (x) { /* fine */ } repaint('web'); } return; }
    if (el.hasAttribute('data-w306fresh')) { if (WEB.busy[String(WEB.range)]) return; WEB.err[String(WEB.range)] = null; delete WEB.data[String(WEB.range)]; WEB.liveAt = 0; loadWeb(WEB.range, true); repaint('web'); }
  });
  document.addEventListener('toggle', function (e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-w306older')) T.olderOpen = e.target.open; }, true);

  /* ---------- the tabs follow the address; Studio pages outside wave225 (the calendar, the analytics) get them too ---------- */
  function onHash() { var a = areaOf(hashNow()); if (!a) { var o = document.getElementById('w306tabs'); if (o) o.remove(); return; } tabs(); setTimeout(tabs, 120); setTimeout(tabs, 600); }
  window.addEventListener('hashchange', onHash);
  if (document.readyState !== 'loading') setTimeout(onHash, 0); else document.addEventListener('DOMContentLoaded', onHash);
  /* a repaint of the calendar or the analytics can drop the row: put it back, cheaply */
  setInterval(function () { var a = areaOf(hashNow()); if (a && a.area.tabs.length && !document.getElementById('w306tabs')) tabs(); }, 1500);

  window.w306 = { today: today, web: web, skeleton: skeleton, tabs: tabs, entered: entered, areaOf: areaOf, railAlso: railAlso, AREAS: AREAS, loadWeb: loadWeb, state: function () { return { WEB: WEB, T: T }; } };
})();
