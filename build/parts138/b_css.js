  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.id = 'w138css';
  css.textContent =
    '#w138pick{position:fixed;z-index:2147483400;width:280px;max-width:calc(100vw - 16px);background:' + CREAM + ';border:1px solid rgba(16,63,57,.16);border-radius:14px;box-shadow:0 2px 6px rgba(16,63,57,.10),0 14px 34px rgba(16,63,57,.18);padding:6px;font-family:' + BODY + ';display:none;box-sizing:border-box;}' +
    '#w138pick.on{display:block;animation:w138in .12s ease-out;}' +
    '@keyframes w138in{from{opacity:0;transform:translateY(-3px);}to{opacity:1;transform:none;}}' +
    '#w138pick .hd{font-family:' + HEAD + ';font-size:11.5px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:' + MUTED + ';padding:4px 8px 6px;}' +
    '#w138pick .it{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;cursor:pointer;color:' + INK + ';}' +
    '#w138pick .it.on{background:rgba(220,165,39,.18);}' +
    '#w138pick .it b{display:block;font-size:13.5px;font-weight:600;line-height:1.2;}' +
    '#w138pick .it small{display:block;font-size:11.5px;color:' + MUTED + ';line-height:1.3;}' +
    '#w138pick .it .nomail{color:' + FLAG + ';}' +
    '#w138pick .ft{font-size:11px;color:' + MUTED + ';padding:6px 8px 3px;border-top:1px solid rgba(16,63,57,.08);margin-top:4px;}' +
    '.w138av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;flex:0 0 auto;font-family:' + HEAD + ';font-weight:600;}' +
    '.w138av img{width:100%;height:100%;object-fit:cover;display:block;}' +
    '.w138hint{display:flex;align-items:flex-start;gap:7px;font-family:' + BODY + ';font-size:12px;line-height:1.45;color:' + GREEN + ';background:rgba(16,63,57,.05);border-radius:9px;padding:6px 9px;margin:6px 0 2px;text-transform:none;letter-spacing:0;font-weight:400;}' +
    '.w138hint svg{width:14px;height:14px;flex:0 0 auto;margin-top:2px;}' +
    '.w138hint .lnk{font-weight:700;text-decoration:underline;cursor:pointer;white-space:nowrap;}' +
    '.w138hint .warn{color:' + FLAG + ';}' +
    '.w138at{color:' + GREEN + ';background:rgba(220,165,39,.16);border-radius:5px;padding:0 3px;font-weight:600;white-space:nowrap;}' +
    '.w116js .w138row .ic{font-size:19px;}' +
    '.w116js .w138btn{font-family:' + BODY + ';font-size:12.5px;font-weight:700;border:none;border-radius:10px;padding:8px 12px;cursor:pointer;background:' + GREEN + ';color:' + CREAM + ';white-space:nowrap;}' +
    '.w116js .w138btn.ghost{background:transparent;color:' + GREEN + ';border:1px solid rgba(16,63,57,.25);}' +
    '.w116js .w138btn[disabled]{opacity:.55;cursor:default;}' +
    '.w116js .w138rec{margin:0 0 4px 52px;}' +
    '.w116js .w138rec .t{font-family:' + HEAD + ';font-size:11.5px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:' + MUTED + ';margin:2px 0 4px;}' +
    '.w116js .w138rec .r{display:flex;gap:8px;align-items:baseline;font-size:12.5px;color:' + INK + ';padding:4px 0;border-top:1px solid rgba(16,63,57,.06);}' +
    '.w116js .w138rec .r:first-of-type{border-top:none;}' +
    '.w116js .w138rec .r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '.w116js .w138rec .r em{font-style:normal;font-size:11.5px;white-space:nowrap;color:#1f6b5d;}' +
    '.w116js .w138rec .r em.no{color:' + FLAG + ';}' +
    '.w116js .w138rec .r em.wait{color:' + MUTED + ';}' +
    '.w116js .w138banner{font-size:12.5px;line-height:1.45;border-radius:10px;padding:8px 11px;margin:0 0 10px;background:rgba(42,140,122,.12);color:#1f6b5d;}' +
    '.w116js .w138banner.err{background:rgba(179,64,47,.10);color:' + FLAG + ';}' +
    '.w116js #w138conn .row{border-top:1px solid rgba(16,63,57,.08);}' +
    '@media (pointer:coarse){#w138pick .ft{display:none;}}' +
    '@media (max-width:640px){.w116js .w138rec{margin-left:0;}#w138pick{width:calc(100vw - 16px);}.w116js .w138row{grid-template-columns:40px minmax(0,1fr);}.w116js .w138row .w138btn{grid-column:2;justify-self:start;}}';
  document.head.appendChild(css);
  var SLACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1-4.3A7.5 7.5 0 1 1 20 12.5z"/><circle cx="12.3" cy="12.3" r="2.6"/><path d="M14.9 12.3v.9a1.6 1.6 0 0 0 3.2 0v-.9"/></svg>';

