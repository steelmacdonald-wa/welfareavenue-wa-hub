
  /* ---------- styles ---------- */
  var css = ''
    /* Admin: the section links are the menu items; the Admin page button stays out of sight (it still carries the access rule) */
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"] .tab[data-tab="adminpanel"]{display:none !important;}'
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"] .w118sub{display:none !important;padding:0 !important;}'
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"].w134on .w118sub{display:block !important;}'
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"] .w118sub a{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;padding:8px 12px;border-radius:10px;font-family:' + BODY + ';font-weight:500;font-size:13.5px;line-height:1.3;color:var(--wa-text);background:none;text-decoration:none;}'
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"] .w118sub a::before{content:"";width:10px;height:10px;border-radius:3px;background:#5C5A56;flex:0 0 auto;}'
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"] .w118sub a:hover{background:rgba(16,63,57,.06);color:' + GREEN + ';}'
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"] .tab[data-tab="adminpanel"].active + .w118sub a.on{background:rgba(16,63,57,.10);color:' + GREEN + ';font-weight:700;}'
    + 'nav.wa-nav #tabBar .tab-group[data-w42g="admin"] .w118sub a:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:1px;}'
    /* Ask the Hub: "ASK TH" and "HUB" open around the brand E */
    + 'html body #waChatBtn.w134fab .w130lbl{display:none !important;}'
    + '#waChatBtn.w134fab .w134w{display:inline-flex;align-items:center;font-family:' + HEAD + ';font-weight:600;font-size:21px;line-height:1;letter-spacing:1.3px;text-transform:uppercase;white-space:nowrap;}'
    + '#waChatBtn.w134fab .w134a,#waChatBtn.w134fab .w134b{display:inline-block;max-width:0;opacity:0;overflow:hidden;transition:max-width .36s cubic-bezier(.65,0,.35,1),opacity .24s ease;}'
    + '#waChatBtn.w134fab .w134a{text-align:right;}'
    + '#waChatBtn.w134fab .w134e{display:inline-flex;align-items:center;transition:margin .36s cubic-bezier(.65,0,.35,1),transform .36s cubic-bezier(.65,0,.35,1);}'
    + 'html body #waChatBtn.w134fab .w117ei{width:auto !important;height:.7em !important;margin:0 !important;display:block;}'
    + 'html body #waChatBtn.w134fab:hover,html body #waChatBtn.w134fab:focus-visible{padding:0 20px !important;}'
    + '#waChatBtn.w134fab:hover .w134a,#waChatBtn.w134fab:focus-visible .w134a{max-width:90px;opacity:1;}'
    + '#waChatBtn.w134fab:hover .w134b,#waChatBtn.w134fab:focus-visible .w134b{max-width:70px;opacity:1;}'
    /* in a word the E sits on the baseline with the capitals (measured: 1.2px lower than centred at 21px) */
    + '#waChatBtn.w134fab:hover .w134e,#waChatBtn.w134fab:focus-visible .w134e{margin:0 .26em 0 .05em;transform:translateY(.056em);}'
    + '#waChatBtn.w134fab:focus-visible .w117ei .bar{transform:scaleX(1);}'
    + '@media (prefers-reduced-motion: reduce){#waChatBtn.w134fab .w134a,#waChatBtn.w134fab .w134b,#waChatBtn.w134fab .w134e{transition:none !important;}}'
    /* Important info: passwords by request */
    + '#infoBody .w134user{color:var(--wa-muted);font-size:12px;}'
    + '#infoBody .w134chip{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;background:rgba(220,165,39,.2);color:#6b4d05;}'
    + '#infoBody .w134chip.no{background:rgba(179,64,47,.12);color:#8a2f22;}'
    + '#infoBody .w134ask{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:4px;}'
    + '#infoBody .w134ask input{font:inherit;font-size:12.5px;padding:5px 9px;border:1px solid #DEE0D8;border-radius:8px;min-width:220px;background:' + CREAM + ';}'
    + '#infoBody .btn.w134go{background:' + GREEN + ';color:' + CREAM + ';border:none;}'
    + '#infoBody .w134req{margin:8px 0 12px;padding:10px 12px;border-radius:12px;background:rgba(220,165,39,.14);border:1px solid rgba(220,165,39,.4);}'
    + '#infoBody .w134req > b{display:block;font-size:12.5px;margin-bottom:6px;color:' + INK + ';}'
    + '#infoBody .w134rq{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-top:1px dashed rgba(16,63,57,.15);}'
    + '#infoBody .w134rq .t{flex:1 1 260px;font-size:13px;}#infoBody .w134rq small{color:var(--wa-muted);margin-left:4px;}'
    + '#infoBody .w134who{border:none;background:none;color:' + GREEN + ';font:inherit;font-size:12px;font-weight:600;text-decoration:underline;cursor:pointer;padding:0 2px;}'
    + '#infoBody .w134acc{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 2px;}'
    + '#infoBody .w134p{display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:3px 4px 3px 10px;border-radius:999px;background:rgba(16,63,57,.07);}'
    + '#infoBody .w134p small{color:var(--wa-muted);}#infoBody .w134none{font-size:12px;color:var(--wa-muted);}'
    + '#infoBody .w134rm{border:none;background:none;cursor:pointer;color:#8a2f22;font-size:11px;padding:0 5px;}'
    + '#infoBody .w134give{display:inline-flex;gap:6px;align-items:center;}#infoBody .w134give select{font:inherit;font-size:12px;padding:4px 6px;border-radius:8px;border:1px solid #DEE0D8;background:' + CREAM + ';}'
    /* wave262: the folds (More, and Other teams under your team), on computers; the phone's sheet lists every page */
    + 'nav.wa-nav #tabBar .w262fold > .w262fh{display:flex;align-items:center;gap:6px;cursor:pointer;width:100%;text-align:left;padding:16px 12px 6px;font-family:' + BODY + ';font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--wa-muted);border:none;background:none;}'
    + 'nav.wa-nav #tabBar .w262fold > .w262fh:hover,nav.wa-nav #tabBar .w262fold > .w262fh:focus-visible{color:' + GREEN + ';}'
    + 'nav.wa-nav #tabBar .w262fold > .w262fh:focus-visible,nav.wa-nav #tabBar .w262tt:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:1px;border-radius:8px;}'
    + 'nav.wa-nav #tabBar .w262ch{display:inline-block;font-size:10px;transition:transform .18s ease;transform:rotate(-90deg);}'
    + 'nav.wa-nav #tabBar.w262more .w262fold .w262ch,nav.wa-nav #tabBar.w262teams .w262tt .w262ch{transform:none;}'
    + 'nav.wa-nav #tabBar .w262tt{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;text-align:left;border:none;background:none;cursor:pointer;padding:7px 12px;margin:2px 0;border-radius:10px;font-family:' + BODY + ';font-size:12.5px;font-weight:600;color:var(--wa-muted);}'
    + 'nav.wa-nav #tabBar .w262tt:hover{background:rgba(16,63,57,.05);color:' + GREEN + ';}'
    + '@media (min-width:901px){'
    +   'body nav.wa-nav #tabBar:not(.w262more) > .tab-group[data-w42g="tools"],body nav.wa-nav #tabBar:not(.w262more) > .tab-group[data-w42g="org"]{display:none !important;}'
    +   'body nav.wa-nav #tabBar.w262more > .w262fold > .w262fh{color:' + GREEN + ';}'
    +   'body nav.wa-nav #tabBar .tab-group.w262tf > .tab-group-p{display:flex !important;flex-direction:column;}'
    +   'body nav.wa-nav #tabBar .tab-group.w262tf > .tab-group-p > .w262tt{order:1;}'
    +   'body nav.wa-nav #tabBar .tab-group.w262tf > .tab-group-p > .w42d.w262other{order:2;}'
    +   'body nav.wa-nav #tabBar:not(.w262teams) .tab-group.w262tf > .tab-group-p > .w42d.w262other:not(.w262here){display:none !important;}'
    + '}'
    + '@media (max-width:900px){nav.wa-nav #tabBar .w262fold,nav.wa-nav #tabBar .w262tt{display:none !important;}}'
    + 'nav.wa-nav #tabBar .tab .w134n{margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:' + GOLD + ';color:' + GREEN + ';font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}';
  if (!document.getElementById('wa134css')) {
    var st = document.createElement('style'); st.id = 'wa134css'; st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- wiring ---------- */
  WA_NAV.layout = LAYOUT;
  WA_NAV.applyLayout = apply;
  if (typeof startApp === 'function') {
    var __sa134 = startApp;
    startApp = async function () {
      var r = await __sa134.apply(this, arguments);
      try {
        apply(); fab(); badgeAtBoot();
        [300, 1200, 3500].forEach(function (ms) { setTimeout(function () { try { apply(); fab(); } catch (e) { /* fine */ } }, ms); });
      } catch (e) { console.warn('wave134 boot', e); }
      return r;
    };
  }
  /* wave262: the folds follow where you are (every arrival goes through showPanel; the team row lights after it draws) */
  if (typeof showPanel === 'function') {
    var __sp262 = showPanel;
    showPanel = function () {
      var r = __sp262.apply(this, arguments);
      try { folds(bar()); requestAnimationFrame(function () { try { folds(bar()); } catch (e) { /* fine */ } }); } catch (e) { /* fine */ }
      return r;
    };
  }
  /* the E can be drawn a little after the button (waves 75 and 117 decorate it on timers) */
  var fabTries = 0, fabIv = setInterval(function () { fabTries++; if (fab() || fabTries > 60) clearInterval(fabIv); }, 300);

  /* ---------- test hook ---------- */
  window.w134 = { apply: apply, ok: ok, layout: LAYOUT, fab: fab, info: renderInfo134, pw: function () { return PW; }, state: function () { return { applied: applied, moves: moves.length }; },
    folds: function () { var b = bar(); return b ? { more: b.classList.contains('w262more'), teams: b.classList.contains('w262teams'), mine: myTeam(b) } : null; }, refold: function () { folds(bar(), true); } };   /* wave262 */
})();
