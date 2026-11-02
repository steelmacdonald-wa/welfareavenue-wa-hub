
  /* ---------- styles (the Hub's colour tokens from 000_head_base) ---------- */
  var HEADF = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var css = ''
    /* the grid */
    + '.w276gw{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;margin:6px 0 4px;}'
    + '.w276g{display:grid;grid-template-columns:52px repeat(7,minmax(36px,1fr));gap:0 3px;min-width:318px;user-select:none;-webkit-user-select:none;}'
    + '.w276tc,.w276day{display:flex;flex-direction:column;}'
    + '.w276dh{height:22px;font-size:11.5px;font-weight:700;color:var(--wa-green);text-align:center;line-height:22px;}'
    + '.w276tl{height:16px;margin-top:2px;font-size:10.5px;color:var(--wa-muted);text-align:right;padding-right:6px;line-height:12px;white-space:nowrap;}'
    + '.w276c{position:relative;display:block;height:16px;margin:2px 0 0;padding:0;border:1px solid var(--wa-line);border-radius:4px;background:var(--wa-card);cursor:pointer;overflow:hidden;font:inherit;touch-action:manipulation;}'
    + '.w276c.w276hr{margin-top:3px;}'
    + '.w276c:hover{border-color:var(--wa-green);}'
    + '.w276c:focus-visible{outline:2px solid var(--wa-gold);outline-offset:1px;}'
    + '.w276c[aria-pressed="true"]{background:var(--wa-green);border-color:var(--wa-green);}'
    + '.w276c.w276x{background-image:repeating-linear-gradient(135deg,var(--wa-gold-soft) 0 4px,transparent 4px 8px);}'
    + '.w276c.w276x[aria-pressed="true"]{background-image:repeating-linear-gradient(135deg,var(--wa-gold) 0 3px,transparent 3px 8px);}'
    + '.w276ro .w276c{cursor:help;}'
    + '.w276ro .w276c .w276h{position:absolute;inset:0;background:var(--wa-green);pointer-events:none;}'
    + '.w276ro .w276c.w276x::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--wa-gold);pointer-events:none;}'
    /* the pop-up, wave177's look: a centred card, a bottom sheet under 700px */
    + '#w276back,#w276pback{position:fixed;inset:0;z-index:2147482990;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(16,32,30,.48);}'
    + '#w276pop,#w276prop{position:relative;width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;border-radius:20px;background:var(--wa-card);border-top:6px solid var(--wa-gold);padding:22px 22px 18px;color:var(--wa-text);box-shadow:0 24px 60px rgba(0,0,0,.28);}'
    + '#w276prop{width:min(480px,100%);}'
    + '#w276pop [hidden],#w276prop [hidden],#w276panel [hidden]{display:none !important;}'
    + '#w276pop .x,#w276prop .x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;background:transparent;color:var(--wa-muted);font-size:22px;line-height:1;cursor:pointer;padding:0;}'
    + '#w276pop .x:hover,#w276prop .x:hover{background:var(--wa-paper);}'
    + '#w276pop .k,#w276prop .k,#w276panel .k{display:block;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:var(--wa-green);font-weight:800;margin:0 36px 0 0;}'
    + '#w276pop h2,#w276prop h2{font-family:' + HEADF + ';font-size:28px;line-height:1.08;margin:4px 36px 6px 0;color:var(--wa-green);text-transform:uppercase;letter-spacing:.3px;outline:none;}'
    + '#w276pop .lead{margin:0 0 12px;font-size:14px;}'
    + '#w276pop .from{margin:0 0 8px;}'
    + '#w276pop .from label{display:block;font-weight:700;font-size:13px;margin:0 0 4px;}'
    + '#w276pop .from input{font:inherit;font-size:14px;padding:7px 10px;border:1px solid var(--wa-line);border-radius:10px;background:var(--wa-card);color:var(--wa-text);}'
    + '#w276pop .help,#w276prop .help,#w276panel .help{font-size:12.5px;color:var(--wa-muted);margin:4px 0 0;line-height:1.45;}'
    + '#w276pop .legend{font-size:12.5px;color:var(--wa-muted);margin:8px 0 0;display:flex;align-items:center;gap:6px;}'
    + '#w276pop .legend .sw{display:inline-block;width:18px;height:12px;border:1px solid var(--wa-line);border-radius:3px;background-image:repeating-linear-gradient(135deg,var(--wa-gold-soft) 0 4px,transparent 4px 8px);}'
    + '#w276hours{font-weight:700;font-size:14px;margin:8px 0 0;color:var(--wa-green);}'
    + '#w276note{margin:8px 0 0;padding:10px 12px;border-radius:12px;background:var(--wa-paper);font-size:13.5px;line-height:1.45;}'
    + '#w276note p{margin:0;}#w276note p + p{margin-top:6px;}'
    + '#w276err,#w276perr{font-size:12.5px;color:var(--wa-flag);margin:10px 0 0;}'
    + '#w276pop .row,#w276prop .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px;}'
    + '#w276pop .row button,#w276prop .row button{border:0;border-radius:999px;padding:11px 20px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;flex:1 1 160px;}'
    + '#w276pop button.yes,#w276prop button.yes{background:var(--wa-green);color:var(--wa-card);}'
    + '#w276pop button.no,#w276prop button.no{background:transparent;color:var(--wa-green);border:1.5px solid var(--wa-line);}'
    + '#w276pop button[disabled],#w276prop button[disabled]{opacity:.55;cursor:default;}'
    + '#w276prop .slot{font-weight:700;font-size:16px;margin:4px 0 10px;}'
    + '#w276prop p{margin:0 0 6px;font-size:14px;line-height:1.45;}'
    + '@media (max-width:700px){'
    + '#w276back,#w276pback{align-items:flex-end;padding:0;}'
    + '#w276pop,#w276prop{width:100%;max-height:92vh;border-radius:20px 20px 0 0;padding:20px 16px calc(18px + env(safe-area-inset-bottom));}'
    + '#w276pop h2,#w276prop h2{font-size:24px;}'
    + '}'
    /* the Agenda panel */
    + '#w276panel{background:var(--wa-card);border:1px solid var(--wa-line);border-radius:16px;padding:16px 18px;margin:0 0 16px;color:var(--wa-text);}'
    + '#w276panel .hd{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;justify-content:space-between;}'
    + '#w276panel h3{font-family:' + HEADF + ';font-size:24px;line-height:1.1;margin:0;color:var(--wa-green);text-transform:uppercase;letter-spacing:.3px;}'
    + '#w276panel .acts{display:flex;gap:8px;flex-wrap:wrap;}'
    + '#w276panel .b1,#w276panel .b2{border-radius:999px;padding:8px 16px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;}'
    + '#w276panel .b1{background:var(--wa-green);color:var(--wa-card);border:0;}'
    + '#w276panel .b2{background:transparent;color:var(--wa-green);border:1.5px solid var(--wa-line);}'
    + '#w276panel button[disabled]{opacity:.55;cursor:default;}'
    + '#w276panel .st{margin:6px 0 0;font-size:13px;color:var(--wa-muted);}'
    + '#w276panel .lk{border:0;background:none;padding:0;font:inherit;color:var(--wa-green);text-decoration:underline;cursor:pointer;}'
    + '#w276miss{margin:4px 0 0;font-size:13px;}'
    + '#w276panel .body{display:flex;flex-wrap:wrap;gap:18px;margin-top:10px;}'
    + '#w276panel .map{flex:2 1 360px;min-width:0;}'
    + '#w276panel .side{flex:1 1 220px;min-width:0;}'
    + '#w276panel h4{margin:0 0 6px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--wa-green);}'
    + '#w276cell{font-size:13px;margin:4px 0 0;min-height:1.2em;}'
    + '#w276best{list-style:none;margin:0;padding:0;}'
    + '#w276best li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:10px 0;border-top:1px solid var(--wa-line);}'
    + '#w276best li:first-child{border-top:0;padding-top:2px;}'
    + '#w276best .w{font-weight:700;font-size:14px;flex:1 1 100%;}'
    + '#w276best .n{font-size:12.5px;color:var(--wa-muted);flex:1 1 auto;}';
  if (!document.getElementById('w276css')) {
    var st276 = document.createElement('style'); st276.id = 'w276css'; st276.textContent = css; document.head.appendChild(st276);
  }

  /* ---------- the Agenda route: #team/<code>/agenda ----------
     wave116's mountAgenda is private, so this looks for #w116agHost after each route (every 300 ms, 10 times) and
     paints when the panel is missing, sits elsewhere, or shows another team (a leader of two teams moving between
     them without a reload). */
  var ROUTE = { timer: null, tries: 0, code: null };
  function agendaCode() { var m = /^#team\/([a-z]+)\/agenda/.exec(String(location.hash || '')); return m ? m[1] : null; }
  function look() {
    var code = agendaCode();
    if (!code || code !== ROUTE.code) return;
    var host = document.getElementById('w116agHost'), panel = document.getElementById('w276panel');
    var good = host && panel && panel.getAttribute('data-dept') === code && panel.nextElementSibling === host;
    if (host && !good && W276.agenda.busy !== code) paintAgenda(code);
    if (ROUTE.tries++ < 10) ROUTE.timer = setTimeout(look, 300);
  }
  function routeAgenda() {
    clearTimeout(ROUTE.timer);
    ROUTE.code = agendaCode(); ROUTE.tries = 0;
    if (!ROUTE.code) { W276.agenda.dept = null; W276.agenda.tok++; W276.agenda.busy = null; return; }
    look();
  }

  /* ---------- wiring ---------- */
  if (typeof startApp === 'function') {
    var __sa276 = startApp;
    startApp = async function () {
      var r = await __sa276.apply(this, arguments);
      try { loadCfg(); autoPop(1500); routeAgenda(); } catch (e) { console.warn('wave276 boot', e); }
      return r;
    };
  }
  if (typeof renderMyPage === 'function') {
    var __rm276 = renderMyPage;
    renderMyPage = async function () {
      var r = await __rm276.apply(this, arguments);
      try { autoPop(1500); } catch (e) { console.warn('wave276 home', e); }
      return r;
    };
  }
  if (typeof window.w116Route === 'function') {
    var __wr276 = window.w116Route;
    window.w116Route = function () { var r = __wr276.apply(this, arguments); try { routeAgenda(); } catch (e) { /* fine */ } return r; };
  }
  window.addEventListener('hashchange', function () {
    try { routeAgenda(); if (onHome()) autoPop(1500); } catch (e) { console.warn('wave276 route', e); }
  });

  /* ---------- test hook ---------- */
  window.w276 = { paintAgenda: paintAgenda, openPop: openPop, best: best, slot: slot, unslot: unslot, hours: hours, windowLabel: windowLabel, closePop: closePop, state: function () { return W276; } };
})();
