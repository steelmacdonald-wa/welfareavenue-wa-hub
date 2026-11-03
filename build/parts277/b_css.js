
  /* ---------- the look: one card of rows on hairlines, motion only on what the person touches ---------- */
  (function () {
    if (document.getElementById('wa277css')) return;
    var C = '#w277conn ', M = '#w277modal ';
    var css = document.createElement('style'); css.id = 'wa277css';
    css.textContent = ''
      + '#w277conn{font-family:' + BODY + ';color:' + INK + ';max-width:1100px;font-size:14.5px;line-height:1.45;}'
      + C + '*{box-sizing:border-box;}'
      + C + '.w277note{margin:0 0 10px;color:' + MUTED + ';font-size:13.5px;}'
      + C + '.w277bar{display:flex;align-items:center;gap:12px;margin:0 0 12px;color:' + MUTED + ';font-size:13.5px;}' + C + '.w277bar span{flex:1;min-width:0;}'
      + C + '.w277flash{border:1px solid ' + LINE + ';border-radius:14px;padding:10px 14px;margin:0 0 12px;background:' + SURF + ';}' + C + '.w277flash.bad{border-color:' + FLAG + ';background:none;color:' + FLAG + ';}'
      /* the attention strip: flag on a hairline, no fill */
      + '#w277attn{border:1px solid ' + FLAG + ';border-radius:18px;padding:4px 16px;margin:0 0 14px;}'
      + '#w277attn .w277arow{display:flex;align-items:center;gap:12px;min-height:46px;}' + '#w277attn .w277arow + .w277arow{border-top:1px solid ' + LINE + ';}'
      + '#w277attn b{font-family:' + HEAD + ';font-weight:600;font-size:18px;color:' + GREEN + ';letter-spacing:.01em;}' + '#w277attn .why{flex:1;min-width:0;color:' + FLAG + ';}'
      /* the card and its rows */
      + C + '.w277card{background:' + CARD + ';border:1px solid ' + LINE + ';border-radius:18px;margin:0 0 14px;overflow:hidden;}'
      + C + '.w277item + .w277item{border-top:1px solid ' + LINE + ';}'
      + C + '.w277row{display:grid;grid-template-columns:minmax(28px,max-content) minmax(160px,220px) auto minmax(0,1fr) auto;grid-template-areas:"mk nm pl ch ac";align-items:center;gap:6px 12px;min-height:48px;padding:8px 16px;cursor:pointer;transition:transform 160ms ' + OUT + ',background-color 120ms ease;}'
      + C + '.w277row:active:not(:has(.w277btn:active)){transform:scale(.97);}'
      + C + '.w277mk{grid-area:mk;display:flex;}' + C + '.w277nm{grid-area:nm;min-width:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}'
      + C + '.w277pl{grid-area:pl;}' + C + '.w277ch{grid-area:ch;display:flex;flex-wrap:wrap;gap:4px 12px;color:' + MUTED + ';font-size:12.5px;}' + C + '.w277act{grid-area:ac;display:flex;justify-content:flex-end;}'
      + C + '.w277m{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;color:#FFFAF2;font:700 12px ' + HEAD + ';letter-spacing:.02em;flex:none;}'
      + C + '.w277m.sm{width:20px;height:20px;border-radius:6px;font-size:10px;}' + C + '.w277m.sm + .w277m.sm{margin-left:3px;}'
      + C + '.w277nm b{font-family:' + HEAD + ';font-weight:600;font-size:19px;color:' + GREEN + ';letter-spacing:.01em;line-height:1.1;}' + C + '.w277nm small{color:' + MUTED + ';font-size:13px;overflow-wrap:anywhere;}'
      /* pills: a quiet tint, the word carries the meaning; a change crossfades */
      + C + '.w277pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:600;white-space:nowrap;background:' + SURF + ';color:' + MUTED + ';transition:opacity 150ms ease;}'
      + C + '.w277pill.ok{color:' + GREEN + ';background:' + SURF2 + ';}' + C + '.w277pill.warn{color:' + WARN + ';background:rgba(220,165,39,.16);}' + C + '.w277pill.flag{color:' + FLAG + ';background:rgba(179,64,47,.08);}'
      + C + '.w277pill.fresh{animation:w277fade 150ms ease;}' + '@keyframes w277fade{from{opacity:0;}to{opacity:1;}}'
      + C + '.w277chev{width:18px;height:18px;color:' + MUTED + ';transition:transform 180ms ' + OUT + ';}' + C + '[aria-expanded="true"] .w277chev{transform:rotate(90deg);}'
      /* buttons */
      + '#w277conn .w277btn,#w277modal .w277btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;border-radius:999px;padding:0 16px;font:600 13.5px ' + BODY + ';border:1px solid rgba(16,63,57,.2);background:' + CARD + ';color:' + GREEN + ';cursor:pointer;text-decoration:none;white-space:nowrap;transition:transform 160ms ' + OUT + ',background-color 120ms ease,opacity 120ms ease;}'
      + '#w277conn .w277btn:active,#w277modal .w277btn:active{transform:scale(.97);}'
      + '#w277conn .w277btn.gold,#w277modal .w277btn.gold{background:' + GOLD + ';border-color:' + GOLD + ';color:' + GREEN + ';}'
      + '#w277conn .w277btn.bad,#w277modal .w277btn.bad{color:' + FLAG + ';border-color:rgba(179,64,47,.35);}'
      + '#w277conn .w277btn.sm{min-height:30px;padding:0 12px;font-size:12.5px;}'
      + '#w277conn .w277btn[disabled]{opacity:.55;cursor:default;transform:none;}'
      + '#w277conn :focus-visible,#w277modal :focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
      /* the disclosure: grid rows from 0fr to 1fr, opens in 180ms, closes in 120ms */
      + C + '.w277disc{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows 120ms ' + OUT + ',opacity 120ms ease;}'
      + C + '.w277disc.open{grid-template-rows:1fr;opacity:1;transition:grid-template-rows 180ms ' + OUT + ',opacity 180ms ease;}'
      + C + '.w277disc > .w277in{overflow:hidden;min-height:0;}'
      + C + '.w277body{padding:2px 16px 16px 56px;display:flex;flex-direction:column;gap:10px;font-size:13.5px;}'
      + C + '.w277body p{margin:0;}' + C + '.w277body ol{margin:0;padding-left:20px;color:' + MUTED + ';}' + C + '.w277body .muted{color:' + MUTED + ';}' + C + '.w277body .flag{color:' + FLAG + ';}'
      + C + '.w277facts{display:flex;flex-wrap:wrap;gap:4px 18px;}'
      + C + '.w277line{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}'
      + C + '.w277line code{background:' + SURF + ';border-radius:6px;padding:2px 6px;font-size:12px;overflow-wrap:anywhere;}'
      + C + '.w277keys{display:flex;flex-wrap:wrap;gap:8px;}' + C + '.w277keys input,' + C + '.w277adv input{flex:1 1 180px;min-width:0;min-height:36px;border:1px solid rgba(16,63,57,.2);border-radius:10px;padding:0 12px;font:14px ' + BODY + ';background:' + CARD + ';color:' + INK + ';}'
      + C + '.w277chips{display:flex;flex-wrap:wrap;gap:6px;}' + C + '.w277chips span{border-radius:999px;padding:2px 9px;font-size:12px;background:' + SURF + ';}' + C + '.w277chips span.miss{color:' + FLAG + ';background:rgba(179,64,47,.08);}'
      + C + '.w277adv{border-top:1px solid ' + LINE + ';padding-top:8px;}' + C + '.w277adv summary{cursor:pointer;color:' + MUTED + ';font-weight:600;}' + C + '.w277adv[open] > *:not(summary){margin-top:8px;}'
      + C + '.w277test{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;}' + C + '.w277test b{font-family:' + HEAD + ';font-weight:600;font-size:19px;color:' + GREEN + ';}' + C + '.w277test span{flex:1;min-width:200px;color:' + MUTED + ';font-size:13.5px;}'
      + C + '.w277pre{white-space:pre-wrap;font-size:12.5px;background:' + SURF + ';border-radius:10px;padding:10px 12px;margin:0 16px 14px;}'
      + C + '.w277extra{margin-top:14px;}'
      + C + '.w277empty{padding:18px;color:' + MUTED + ';}' + C + '.w277empty a{color:' + GREEN + ';font-weight:700;cursor:pointer;}'
      /* the modal, inside the Hub's #modalBox or on its own back */
      + '#w277modal{font-family:' + BODY + ';color:' + INK + ';max-width:420px;}' + M + 'p{margin:0 0 16px;font-size:15px;line-height:1.45;}' + M + '.w277mb{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;}'
      + '.w277back{position:fixed;inset:0;background:rgba(16,63,57,.35);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;}' + '.w277back > #w277modal{background:' + CARD + ';border-radius:18px;padding:20px;}'
      /* hover only on a mouse */
      + '@media (hover:hover) and (pointer:fine){' + C + '.w277row:hover{background:' + SURF + ';}' + '#w277conn .w277btn:hover,#w277modal .w277btn:hover{background:' + SURF2 + ';}' + '#w277conn .w277btn.gold:hover,#w277modal .w277btn.gold:hover{background:' + GOLD + ';filter:brightness(1.05);}}'
      /* reduced motion: opacity stays, the height jumps */
      + '@media (prefers-reduced-motion:reduce){' + C + '.w277disc,' + C + '.w277disc.open{transition:opacity 120ms ease;}' + C + '.w277row,' + C + '.w277btn,' + C + '.w277chev{transition:none;}' + C + '.w277row:active,' + C + '.w277btn:active{transform:none;}}'
      /* wide: the rows share the card's columns (subgrid) so names, pills and chips line up; without subgrid, a fixed name column */
      + '@supports not (grid-template-columns:subgrid){' + C + '.w277row{grid-template-columns:minmax(28px,max-content) minmax(160px,220px) auto minmax(0,1fr) auto;}}'
      + '@supports (grid-template-columns:subgrid){@media (min-width:621px){'
      + C + '.w277card[role="list"]{display:grid;grid-template-columns:minmax(28px,max-content) minmax(140px,1fr) auto minmax(0,1.2fr) auto;column-gap:12px;}'
      + C + '.w277card[role="list"] > .w277item{display:grid;grid-template-columns:subgrid;grid-column:1 / -1;}'
      + C + '.w277card[role="list"] .w277row{grid-template-columns:subgrid;grid-template-areas:none;grid-column:1 / -1;}'
      + C + '.w277card[role="list"] .w277disc{grid-column:1 / -1;}'
      + C + '.w277row > .w277mk{grid-area:auto;grid-column:1;grid-row:1;}' + C + '.w277row > .w277nm{grid-area:auto;grid-column:2;grid-row:1;}' + C + '.w277row > .w277pl{grid-area:auto;grid-column:3;grid-row:1;}' + C + '.w277row > .w277ch{grid-area:auto;grid-column:4;grid-row:1;}' + C + '.w277row > .w277act{grid-area:auto;grid-column:5;grid-row:1;}'
      + '}}'
      /* 620: the chips wrap under the name, the action stays on the right */
      + '@media (max-width:620px){' + C + '.w277row{grid-template-columns:minmax(28px,max-content) minmax(0,1fr) auto auto;grid-template-areas:"mk nm pl ac" ". ch ch ch";}' + C + '.w277body{padding-left:16px;}}'
      /* 480: two lines, the action full width */
      + '@media (max-width:480px){' + C + '.w277row{grid-template-columns:minmax(28px,max-content) minmax(0,1fr) auto;grid-template-areas:"mk nm pl" ". ch ch" "ac ac ac";padding:10px 10px;}' + C + '.w277row.quiet{grid-template-areas:"mk nm pl" ". ch ch";}' + C + '.w277row.quiet .w277act{display:none;}' + C + '.w277act{justify-content:stretch;}' + C + '.w277act .w277btn{width:100%;}' + '#w277attn .w277arow{flex-wrap:wrap;padding:8px 0;}' + '#w277attn .w277arow .w277btn{width:100%;}}';
    document.head.appendChild(css);
  })();
