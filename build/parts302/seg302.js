/* =====================================================================
   WA v302 the Finance app, redesigned (09/11/26)
   =====================================================================
   Steel (08/11/26): "do a big revision of the Hub's finance app and look at how we can make it a little bit easier
   to consume", the invoices that come in by email "confirming them against statements", and the Accounting drive's
   Year End folders checked every two weeks (finance-drive, wave300). Design approved 09/11/26 (the Finance canvas:
   Today, Match, Bank, Budget, Files; on a phone, one card at a time).
   - The rail: Today, Match, Bank, Budget, Files; under More: Tasks, Trends, Money map, Year overview, Transactions.
     Every older section stays, one click away. Match and Files are for the team (finance_docs is staff only);
     directors read Today, Bank and Budget (wave301's read policies) and change nothing.
   - Today: In the bank (the latest statement's closing balance, read from the statement by finance-import v7 and
     finance-drive v5), the fiscal year so far, the last closed year against its budget, Needs someone, month by
     month, the latest bank lines.
   - Match: every bill, receipt, reimbursement and money email (finance_docs) against the bank, through
     finance_doc_act (confirm, reject, not_needed, reopen): To confirm, Not at the bank, Problems, Waiting, Matched.
   - Bank: each statement month: opening, in, out, closing, and a check that the lines add up to the statement;
     each line's team and category (the ledger's own save), lines the Hub guessed, the receipt matched to each line.
   - Budget: by category or by team, above wave22's editable tables; Start from FY26 (finance_budget_copy).
   - Files: the Year End folders' health and the proposed names and moves (approve, skip, approve all), carried out
     by finance-drive apply; Check Drive now (finance-drive run).
   - The sections are extra wave94 shells (w94Show shows and hides them), drawn after every waFinRender (this wrapper
     is the outermost); wave164's SECT gives each its title (edited in place); the time-frame pills hide where they do
     not apply. On a phone the page's own tab strip stays (the Hub's bottom bar is the phone menu), in the rail's order.
   - Words: never "AI" (the Hub guessed); vendor names and bank descriptions carry data-w198skip.
   ===================================================================== */
(function () {
  if (window.__wa302) return; window.__wa302 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', INK = '#1F201E', MUTED = '#797773', GOLD = '#DCA527', PURPLE = '#6F64AB', OUTC = '#eb6834', FLAG = '#B3402F', LINE = '#DEE0D8';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var MINE = ['today', 'match', 'bank', 'files'];
  var STAFF_ONLY = ['match', 'files'];
  var TEAMS = [['opsmtl', 'Ops Montreal'], ['progdev', 'Program Development'], ['opsto', 'Ops Toronto'], ['marketing', 'Marketing'], ['fundraising', 'Fundraising'], ['hr', 'HR'], ['board', 'Board'], ['org', 'Org-wide']];
  var MONEY_KINDS = ['bill', 'reimbursement', 'donation', 'notice'];
  var S = { at: 0, loading: null, docs: [], lines: {}, stmts: [], runs: [], qbo: null, bud: [], tasks: null, tx: {}, txBusy: {},
    tab: 'confirm', later: {}, all: false, bankFy: null, bankMonth: null, budBy: 'cat', pick: {}, mail: {}, open: {}, running: false, applyT: null, applying: false, dirty: false, els: {} };

  /* ---------- small helpers ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function phone() { try { return window.matchMedia('(max-width: 640px)').matches; } catch (e) { return false; } }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function me() { try { return typeof who === 'function' ? who() : ''; } catch (e) { return ''; } }
  function q(p) { return Promise.resolve(p).then(function (r) { return r || {}; }, function (e) { return { error: e }; }); }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function todayYmd() { return ymd(new Date()); }
  function fyOf(s) { var y = Number(String(s).slice(0, 4)), m = Number(String(s).slice(5, 7)); return m >= 10 ? y + 1 : y; }
  function fyL(y) { return 'FY' + String(y).slice(-2); }
  function nowFy() { return fyOf(todayYmd()); }
  function fyStart(y) { return (y - 1) + '-10-01'; }
  function fyEnd(y) { return y + '-09-30'; }
  function days(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function D(s) { if (!s) return ''; return MON[Number(String(s).slice(5, 7)) - 1] + ' ' + Number(String(s).slice(8, 10)); }
  function Dy(s) { if (!s) return ''; return D(s) + ', ' + String(s).slice(0, 4); }
  function num(n) { return Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function M(n, sign) { n = Number(n || 0); var s = '$' + num(Math.abs(n)); if (n < 0) return '−' + s; return (sign && n > 0 ? '+' : '') + s; }
  function M0(n) { return '$' + Math.round(Math.abs(Number(n || 0))).toLocaleString('en-CA'); }
  function Mc(n, cur) { var c = String(cur || 'CAD').toUpperCase(); return (c === 'USD' ? 'US$' : c === 'EUR' ? 'EUR ' : '$') + num(n); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function teamLabel(k) { for (var i = 0; i < TEAMS.length; i++) if (TEAMS[i][0] === k) return TEAMS[i][1]; return k || 'Unassigned'; }
  function lastSeg(p) { var a = String(p || '').split(' / '); return a[a.length - 1] || ''; }
  function whoSaid(s) { s = String(s || ''); if (!s) return ''; if (s === 'hub') return 'the Hub'; if (s.indexOf('person:') === 0) s = s.slice(7); if (/@welfareavenue\.com$/i.test(s)) s = s.replace(/@welfareavenue\.com$/i, '').split(/[._-]+/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); try { return window.waWho ? window.waWho(s) : s; } catch (e) { return s; } }
  function guessed(t) { return /^AI \(low/i.test(String(t.allocated_by || '')); }
  function I(n) {
    var P = {
      check: '<path d="m5 12.5 4.2 4L19 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', drive: '<path d="M8.5 4h7l5 8.5-3.5 6h-10l-3.5-6z"/><path d="M8.5 4 12 10.5M15.5 4 9 14.5h11.5M3.5 12.5h7"/>',
      mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m4 7 8 6 8-6"/>', bank: '<path d="M4 9.5 12 5l8 4.5"/><path d="M5.5 10v7M9.5 10v7M14.5 10v7M18.5 10v7M4 19h16"/>',
      link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', chev: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
      alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17v.5"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', spark: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
      folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>', qb: '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7a2.5 2.5 0 0 1-2.5-2.5v-2A2.5 2.5 0 0 1 10 8.5zM14 15.5v-7a2.5 2.5 0 0 1 2.5 2.5v2a2.5 2.5 0 0 1-2.5 2.5z"/>',
      undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H12"/>', tasks: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="m3.5 6.5 1.2 1.2 2-2.2M3.5 12l1.2 1.2 2-2.2M3.5 17.5l1.2 1.2 2-2.2"/>'
    };
    return '<svg class="w302i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>';
  }

  /* ---------- the look ---------- */
  var css = ''
    + '#finances .w302{font-family:' + BODY + ';color:' + INK + ';}'
    + '#finances .w302 .w302i{width:16px;height:16px;flex:none;}'
    + '#finances.w302np #w92pills,#finances.w302np .w92note{display:none !important;}'
    + '#finances .w302 h3.w302h{font-family:' + HEAD + ';text-transform:uppercase;letter-spacing:.6px;font-size:15px;font-weight:700;color:' + GREEN + ';margin:0 0 10px;display:flex;align-items:center;gap:8px;}'
    + '#finances .w302 h3.w302h .n{font-family:' + BODY + ';font-size:11px;letter-spacing:0;background:rgba(16,63,57,.08);border-radius:999px;padding:1px 8px;color:' + GREEN + ';}'
    + '#finances .w302 .w302lede{font-size:13px;color:' + MUTED + ';margin:-2px 0 14px;max-width:70ch;line-height:1.45;}'
    + '#finances .w302card{background:var(--wa-card,' + CREAM + ');border:1px solid rgba(16,63,57,.10);border-radius:14px;padding:16px 18px;margin:0 0 14px;}'
    + '#finances .w302meta{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;}'
    + '#finances .w302chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:' + GREEN + ';background:rgba(16,63,57,.06);border:1px solid transparent;border-radius:999px;padding:5px 11px;font-family:' + BODY + ';line-height:1.2;}'
    + '#finances button.w302chip{cursor:pointer;transition:background .15s ease,transform .12s ease;}'
    + '#finances button.w302chip:hover{background:rgba(16,63,57,.12);}'
    + '#finances button.w302chip:active{transform:scale(.97);}'
    + '#finances .w302chip.gold{background:rgba(220,165,39,.16);color:#6b4e0c;}'
    + '#finances .w302chip.ok{background:rgba(16,63,57,.09);}'
    + '#finances .w302tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 14px;}'
    + '#finances .w302tile{background:var(--wa-card,' + CREAM + ');border:1px solid rgba(16,63,57,.10);border-radius:14px;padding:14px 16px;min-width:0;}'
    + '#finances .w302tile.hero{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}'
    + '#finances .w302tile .k{font-family:' + HEAD + ';text-transform:uppercase;letter-spacing:.7px;font-size:13px;font-weight:700;opacity:.8;}'
    + '#finances .w302tile .v{font-family:' + HEAD + ';font-size:34px;font-weight:700;line-height:1.05;margin:6px 0 4px;font-variant-numeric:tabular-nums;letter-spacing:.2px;}'
    + '#finances .w302tile .s{font-size:12.5px;line-height:1.45;opacity:.85;}'
    + '#finances .w302tile .rows{display:grid;gap:6px;margin-top:8px;font-size:12.5px;}'
    + '#finances .w302tile .row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;}'
    + '#finances .w302tile .row b{font-variant-numeric:tabular-nums;font-weight:700;}'
    + '#finances .w302bar{height:6px;border-radius:3px;background:rgba(16,63,57,.10);overflow:hidden;min-width:40px;}'
    + '#finances .w302bar > i{display:block;height:100%;border-radius:3px;background:' + GREEN + ';transform-origin:left;}'
    + '#finances .w302bar.out > i{background:' + OUTC + ';}'
    + '#finances .w302bar.over > i{background:' + FLAG + ';}'
    + '#finances .w302tile.hero .w302bar{background:rgba(255,250,242,.2);}'
    + '#finances .w302tile.hero .w302bar > i{background:' + GOLD + ';}'
    + '#finances .w302cols{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:start;}'
    + '#finances .w302need{list-style:none;margin:0;padding:0;display:grid;gap:2px;}'
    + '#finances .w302need button{all:unset;box-sizing:border-box;display:grid;grid-template-columns:30px 1fr auto 14px;gap:10px;align-items:center;width:100%;padding:9px 8px;border-radius:10px;cursor:pointer;font-size:13.5px;line-height:1.35;transition:background .15s ease;}'
    + '#finances .w302need button:hover,#finances .w302need button:focus-visible{background:rgba(16,63,57,.06);}'
    + '#finances .w302need button:focus-visible{outline:2px solid ' + GREEN + ';outline-offset:1px;}'
    + '#finances .w302need .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(16,63,57,.08);color:' + GREEN + ';}'
    + '#finances .w302need .ic.gold{background:rgba(220,165,39,.18);color:#7a5a10;}'
    + '#finances .w302need .ic.red{background:rgba(179,64,47,.12);color:' + FLAG + ';}'
    + '#finances .w302need .c{font-family:' + HEAD + ';font-size:20px;font-weight:700;color:' + GREEN + ';font-variant-numeric:tabular-nums;}'
    + '#finances .w302need .w302i:last-child{color:' + MUTED + ';}'
    + '#finances .w302need small{display:block;color:' + MUTED + ';font-size:12px;}'
    + '#finances .w302calm{display:flex;gap:10px;align-items:center;color:' + MUTED + ';font-size:13px;padding:6px 2px;}'
    + '#finances .w302calm .w302i{color:' + GREEN + ';width:20px;height:20px;}'
    + '#finances .w302bars{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;align-items:end;height:150px;padding-top:6px;}'
    + '#finances .w302bars button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px;border-radius:6px;padding:0 1px;}'
    + '#finances .w302bars button:hover{background:rgba(16,63,57,.05);}'
    + '#finances .w302bars button:focus-visible{outline:2px solid ' + GREEN + ';}'
    + '#finances .w302bars .pair{display:flex;gap:2px;align-items:flex-end;height:118px;width:100%;justify-content:center;}'
    + '#finances .w302bars .pair i{display:block;width:42%;max-width:12px;border-radius:3px 3px 0 0;background:' + GREEN + ';min-height:2px;transform-origin:bottom;}'
    + '#finances .w302bars .pair i.o{background:' + OUTC + ';}'
    + '#finances .w302bars span{font-size:10.5px;color:' + MUTED + ';}'
    + '#finances .w302legend{display:flex;gap:14px;font-size:12px;color:' + MUTED + ';margin-top:8px;}'
    + '#finances .w302legend span::before{content:"";display:inline-block;width:9px;height:9px;border-radius:2px;background:' + GREEN + ';margin-right:6px;vertical-align:-1px;}'
    + '#finances .w302legend span.o::before{background:' + OUTC + ';}'
    + '#finances .w302lines{width:100%;border-collapse:collapse;font-size:13px;}'
    + '#finances .w302lines td,#finances .w302lines th{padding:8px 6px;border-bottom:1px solid rgba(16,63,57,.08);text-align:left;vertical-align:middle;}'
    + '#finances .w302lines th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + MUTED + ';}'
    + '#finances .w302lines td.a,#finances .w302lines th.a{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600;}'
    + '#finances .w302lines td.a.in{color:' + GREEN + ';}'
    + '#finances .w302lines td.d{white-space:nowrap;color:' + MUTED + ';font-variant-numeric:tabular-nums;}'
    + '#finances .w302lines td.w{max-width:320px;}'
    + '#finances .w302lines td.w .t{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '#finances .w302lines select{font-family:' + BODY + ';font-size:12px;padding:5px 6px;border:1px solid rgba(16,63,57,.18);border-radius:8px;background:var(--wa-card,' + CREAM + ');max-width:170px;color:' + INK + ';}'
    + '#finances .w302team{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(16,63,57,.07);color:' + GREEN + ';white-space:nowrap;}'
    + '#finances .w302guess{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#7a5a10;background:rgba(220,165,39,.18);border-radius:999px;padding:2px 8px;margin-top:3px;}'
    + '#finances .w302guess:hover{background:rgba(220,165,39,.3);}'
    + '#finances .w302guess:focus-visible{outline:2px solid ' + GREEN + ';}'
    + '#finances .w302rc{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:' + GREEN + ';text-decoration:none;}'
    + '#finances .w302rc:hover{text-decoration:underline;}'
    + '#finances .w302rc.none{color:' + MUTED + ';font-weight:400;}'
    + '#finances .w302seg{display:inline-flex;gap:2px;background:rgba(16,63,57,.07);border-radius:999px;padding:3px;flex-wrap:wrap;}'
    + '#finances .w302seg button{all:unset;cursor:pointer;font-size:12.5px;font-weight:700;color:' + GREEN + ';padding:6px 12px;border-radius:999px;transition:background .15s ease,color .15s ease;display:inline-flex;gap:6px;align-items:center;}'
    + '#finances .w302seg button.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#finances .w302seg button:focus-visible{outline:2px solid ' + GOLD + ';}'
    + '#finances .w302seg button .n{font-size:11px;opacity:.75;font-variant-numeric:tabular-nums;}'
    + '#finances .w302b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:' + BODY + ';font-size:13px;font-weight:700;border-radius:10px;padding:9px 14px;min-height:38px;color:' + GREEN + ';background:rgba(16,63,57,.07);transition:background .15s ease,transform .12s ease,opacity .15s ease;}'
    + '#finances .w302b:hover{background:rgba(16,63,57,.13);}'
    + '#finances .w302b:active{transform:scale(.97);}'
    + '#finances .w302b:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:1px;}'
    + '#finances .w302b.pri{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#finances .w302b.pri:hover{background:#0b302b;}'
    + '#finances .w302b.ghost{background:transparent;color:' + MUTED + ';font-weight:600;}'
    + '#finances .w302b.ghost:hover{background:rgba(16,63,57,.06);color:' + GREEN + ';}'
    + '#finances .w302b[disabled]{opacity:.5;pointer-events:none;}'
    + '#finances .w302docs{display:grid;gap:10px;}'
    + '#finances .w302doc{background:var(--wa-card,' + CREAM + ');border:1px solid rgba(16,63,57,.10);border-radius:14px;padding:14px 16px;transition:opacity .18s ease,transform .18s ease;}'
    + '#finances .w302doc.w302out{opacity:0;transform:translateY(-4px) scale(.995);}'
    + '#finances .w302doc .top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11.5px;color:' + MUTED + ';margin-bottom:8px;}'
    + '#finances .w302doc .top .src{display:inline-flex;gap:5px;align-items:center;font-weight:600;}'
    + '#finances .w302doc .top .src .w302i{width:14px;height:14px;}'
    + '#finances .w302doc .main{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;}'
    + '#finances .w302doc .who b{display:block;font-size:16px;font-weight:700;line-height:1.25;color:' + INK + ';overflow-wrap:anywhere;}'
    + '#finances .w302doc .who span{display:block;font-size:12.5px;color:' + MUTED + ';margin-top:2px;}'
    + '#finances .w302doc .amt{font-family:' + HEAD + ';font-size:24px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;}'
    + '#finances .w302doc .amt small{display:block;font-family:' + BODY + ';font-size:11px;font-weight:600;color:' + MUTED + ';}'
    + '#finances .w302doc .amt.in{color:' + GREEN + ';}'
    + '#finances .w302doc .note{font-size:13px;line-height:1.45;margin:10px 0 0;color:' + INK + ';}'
    + '#finances .w302doc .line{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(16,63,57,.05);font-size:13px;}'
    + '#finances .w302doc .line .w302i{color:' + GREEN + ';}'
    + '#finances .w302doc .line .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '#finances .w302doc .line b{font-variant-numeric:tabular-nums;}'
    + '#finances .w302doc .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center;}'
    + '#finances .w302doc .acts .sp{flex:1;}'
    + '#finances .w302doc .more{font-size:12.5px;color:' + GREEN + ';font-weight:700;display:inline-flex;gap:4px;align-items:center;text-decoration:none;cursor:pointer;background:none;border:0;padding:6px 2px;font-family:' + BODY + ';}'
    + '#finances .w302doc .more:hover{text-decoration:underline;}'
    + '#finances .w302doc .mailbox{margin-top:10px;padding:10px 12px;border-left:3px solid rgba(16,63,57,.2);font-size:12.5px;line-height:1.45;color:' + INK + ';background:rgba(16,63,57,.03);border-radius:0 8px 8px 0;}'
    + '#finances .w302pick{margin-top:10px;display:grid;gap:6px;}'
    + '#finances .w302pick button{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 12px;border:1px solid rgba(16,63,57,.12);border-radius:10px;font-size:13px;transition:background .15s ease,border-color .15s ease;}'
    + '#finances .w302pick button:hover,#finances .w302pick button:focus-visible{background:rgba(16,63,57,.05);border-color:' + GREEN + ';}'
    + '#finances .w302pick button .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '#finances .w302pick button b{font-variant-numeric:tabular-nums;}'
    + '#finances .w302pick small{color:' + MUTED + ';font-size:12px;}'
    + '#finances .w302empty{text-align:center;padding:34px 16px;color:' + MUTED + ';font-size:13.5px;}'
    + '#finances .w302empty .w302i{width:30px;height:30px;color:' + GREEN + ';display:block;margin:0 auto 8px;}'
    + '#finances .w302empty b{display:block;color:' + INK + ';font-size:15px;margin-bottom:4px;}'
    + '#finances .w302sub{font-family:' + HEAD + ';text-transform:uppercase;letter-spacing:.6px;font-size:13px;font-weight:700;color:' + MUTED + ';margin:18px 0 8px;}'
    + '#finances .w302months{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;margin:12px 0 14px;}'
    + '#finances .w302months button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;padding:7px 2px 6px;border-radius:9px;font-size:12px;font-weight:700;color:' + GREEN + ';background:rgba(16,63,57,.05);transition:background .15s ease;}'
    + '#finances .w302months button:hover{background:rgba(16,63,57,.1);}'
    + '#finances .w302months button.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#finances .w302months button:focus-visible{outline:2px solid ' + GOLD + ';}'
    + '#finances .w302months button i{display:block;width:6px;height:6px;border-radius:50%;margin:4px auto 0;background:' + GREEN + ';}'
    + '#finances .w302months button.on i{background:' + GOLD + ';}'
    + '#finances .w302months button.due i{background:transparent;box-shadow:inset 0 0 0 1.5px ' + GOLD + ';}'
    + '#finances .w302months button.future{color:' + MUTED + ';background:transparent;cursor:default;}'
    + '#finances .w302months button.future i{background:rgba(16,63,57,.15);}'
    + '#finances .w302sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px;}'
    + '#finances .w302sum div{background:rgba(16,63,57,.05);border-radius:10px;padding:10px 12px;}'
    + '#finances .w302sum span{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + MUTED + ';}'
    + '#finances .w302sum b{display:block;font-family:' + HEAD + ';font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px;}'
    + '#finances .w302ok{display:flex;gap:8px;align-items:center;font-size:12.5px;color:' + GREEN + ';margin:0 0 10px;}'
    + '#finances .w302ok.bad{color:' + FLAG + ';}'
    + '#finances .w302hl{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between;margin-bottom:6px;}'
    + '#finances .w302bud{display:grid;gap:10px;}'
    + '#finances .w302bud .r{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(80px,2fr) auto;gap:12px;align-items:center;font-size:13px;}'
    + '#finances .w302bud .r .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '#finances .w302bud .r .fig{font-variant-numeric:tabular-nums;white-space:nowrap;color:' + MUTED + ';font-size:12.5px;}'
    + '#finances .w302bud .r .fig b{color:' + INK + ';}'
    + '#finances .w302bud .w302bar{height:8px;}'
    + '#finances #w302budget ~ .w94grid{display:none;}'
    + '#finances .w302fy{background:linear-gradient(135deg,' + GREEN + ',#174f47);color:' + CREAM + ';border-radius:14px;padding:16px 18px;margin:0 0 14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:space-between;}'
    + '#finances .w302fy b{font-family:' + HEAD + ';text-transform:uppercase;letter-spacing:.6px;font-size:18px;display:block;}'
    + '#finances .w302fy p{margin:4px 0 0;font-size:13px;opacity:.85;max-width:60ch;}'
    + '#finances .w302fy .w302b{background:' + GOLD + ';color:' + INK + ';}'
    + '#finances .w302health{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 14px;}'
    + '#finances .w302health .w302card{margin:0;}'
    + '#finances .w302health .mo{display:flex;gap:3px;margin:10px 0;}'
    + '#finances .w302health .mo i{flex:1;height:8px;border-radius:2px;background:rgba(16,63,57,.12);}'
    + '#finances .w302health .mo i.y{background:' + GREEN + ';}'
    + '#finances .w302health .mo i.m{background:' + GOLD + ';}'
    + '#finances .w302health dl{display:grid;grid-template-columns:1fr auto;gap:4px 12px;margin:0;font-size:13px;}'
    + '#finances .w302health dd{margin:0;font-variant-numeric:tabular-nums;font-weight:700;text-align:right;}'
    + '#finances .w302file{display:grid;gap:4px;padding:12px 0;border-bottom:1px solid rgba(16,63,57,.08);transition:opacity .18s ease;}'
    + '#finances .w302file:last-child{border-bottom:0;}'
    + '#finances .w302file.w302out{opacity:.25;}'
    + '#finances .w302file .old{font-size:12px;color:' + MUTED + ';text-decoration:line-through;text-decoration-color:rgba(121,119,115,.5);overflow-wrap:anywhere;}'
    + '#finances .w302file .new{font-size:13.5px;font-weight:700;overflow-wrap:anywhere;}'
    + '#finances .w302file .where{display:inline-flex;gap:5px;align-items:center;font-size:12px;color:' + GREEN + ';font-weight:600;}'
    + '#finances .w302file .why{font-size:12.5px;color:' + MUTED + ';margin:0;}'
    + '#finances .w302file .acts{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;}'
    + '#finances .w302file .st{font-size:12px;font-weight:700;color:' + GREEN + ';}'
    + '#finances .w302file .st.bad{color:' + FLAG + ';}'
    + '#finances .w302busy{display:inline-flex;gap:8px;align-items:center;font-size:12.5px;color:' + GREEN + ';}'
    + '#finances .w302busy::before{content:"";width:12px;height:12px;border-radius:50%;border:2px solid rgba(16,63,57,.25);border-top-color:' + GREEN + ';animation:w302spin .8s linear infinite;}'
    + '@keyframes w302spin{to{transform:rotate(360deg);}}'
    + '@keyframes w302grow{from{transform:scaleY(0);}to{transform:scaleY(1);}}'
    + '@keyframes w302growx{from{transform:scaleX(0);}to{transform:scaleX(1);}}'
    + '@keyframes w302in{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}'
    + '#finances .w302.anim .w302bars .pair i{animation:w302grow .5s cubic-bezier(.2,.8,.2,1) both;}'
    + '#finances .w302.anim .w302bar > i{animation:w302growx .5s cubic-bezier(.2,.8,.2,1) both;}'
    + '#finances .w302.anim .w302tile,#finances .w302.anim .w302card{animation:w302in .28s ease-out both;}'
    + '#w302toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,12px);opacity:0;z-index:9500;background:' + INK + ';color:' + CREAM + ';font-family:' + BODY + ';font-size:13.5px;border-radius:12px;padding:10px 12px 10px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.2);transition:opacity .18s ease,transform .18s ease;pointer-events:none;max-width:min(92vw,520px);}'
    + '#w302toast.on{opacity:1;transform:translate(-50%,0);pointer-events:auto;}'
    + '#w302toast button{all:unset;cursor:pointer;font-weight:700;color:' + GOLD + ';padding:4px 8px;border-radius:8px;}'
    + '#w302toast button:hover{background:rgba(255,250,242,.1);}'
    + '#finances #w94nav .w94tab.w302more{margin-left:10px;}'
    + '#finances #w94nav .w302sep{display:inline-block;width:1px;align-self:stretch;background:rgba(16,63,57,.15);margin:0 4px;}'
    + '@media (max-width:1000px){#finances .w302cols{grid-template-columns:minmax(0,1fr);}#finances .w302tiles{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}#finances .w302tile.hero{grid-column:1 / -1;}}'
    + '@media (max-width:640px){'
    + '#finances .w302tiles,#finances .w302health{grid-template-columns:minmax(0,1fr);}'
    + '#finances .w302sum{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}'
    + '#finances .w302months{grid-template-columns:repeat(6,minmax(0,1fr));}'
    + '#finances .w302seg{flex-wrap:nowrap;overflow-x:auto;max-width:100%;scrollbar-width:none;}#finances .w302seg::-webkit-scrollbar{display:none;}#finances .w302seg button{flex:none;}'
    + '#finances .w302card{padding:14px;}'
    + '#finances .w302doc .acts .w302b{flex:1 1 auto;justify-content:center;min-height:44px;}'
    + '#finances .w302 .hide-s{display:none;}'
    + '#finances .w302lines td.w{max-width:150px;}'
    + '#finances .w302bud .r{grid-template-columns:minmax(0,1fr) auto;}#finances .w302bud .r .w302bar{grid-column:1 / -1;grid-row:2;}'
    + '#finances #w94nav{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;position:sticky;top:var(--w302top,62px);z-index:5;background:var(--wa-card,' + CREAM + ');margin-left:-4px;margin-right:-4px;padding-left:4px;padding-right:4px;}'
    + '#finances #w94nav::-webkit-scrollbar{display:none;}'
    + '#finances #w94nav .w94tab{flex:none;min-height:36px;}'
    + '#w302toast{bottom:calc(84px + env(safe-area-inset-bottom));}'
    + '}'
    + '@media (hover:none){#finances .w302b:hover{background:rgba(16,63,57,.07);}#finances .w302b.pri:hover{background:' + GREEN + ';}}'
    + '@media (prefers-reduced-motion:reduce){#finances .w302 *,#w302toast{animation:none !important;transition:none !important;}}';
  var st = document.createElement('style'); st.id = 'wa302css'; st.textContent = css; document.head.appendChild(st);

  /* ---------- a toast with an Undo ---------- */
  var toastT = null;
  function say(msg, action) {
    var t = document.getElementById('w302toast');
    if (!t) { t = document.createElement('div'); t.id = 'w302toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.innerHTML = '<span>' + E(msg) + '</span>' + (action ? '<button type="button">' + E(action.label) + '</button>' : '');
    if (action) t.querySelector('button').onclick = function () { t.classList.remove('on'); try { action.run(); } catch (e) { /* fine */ } };
    requestAnimationFrame(function () { t.classList.add('on'); });
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, action ? 6500 : 3200);
  }
  function errText(e) { var m = String((e && (e.message || e.error_description || e.details)) || e || ''); return m.replace(/^.*?exception:?\s*/i, '').slice(0, 160) || 'That did not save. Try again.'; }

  /* ---------- data ---------- */
  var DOC_COLS = 'id,source,kind,name,url,hub_mail_id,folder_path,fiscal_year,vendor,doc_date,amount,currency,direction,doc_type,summary,group_key,read_state,read_error,txn_id,match_state,match_note,matched_by,matched_at,suggested_name,suggested_folder_name,suggestion_note,suggestion_state,updated_at,size_bytes,mime';
  var TX_COLS = 'id,txn_date,description,amount,department,category,allocated_by,duplicate_of,statement_id,source';
  function load(force) {
    if (S.loading) return S.loading;
    if (!force && S.at && Date.now() - S.at < 90000) return Promise.resolve();
    if (typeof db === 'undefined') return Promise.resolve();
    var st = staff();
    S.loading = Promise.all([
      st ? q(db.from('finance_docs').select(DOC_COLS).order('doc_date', { ascending: false, nullsFirst: false }).limit(1000)) : {},
      q(db.from('finance_statements').select('id,filename,period_start,period_end,txn_count,dup_count,status,opening_balance,closing_balance').eq('status', 'done').order('period_end', { ascending: false }).limit(90)),
      st ? q(db.from('finance_drive_runs').select('id,started_at,finished_at,caller,action,summary,error').order('id', { ascending: false }).limit(15)) : {},
      q(db.from('finance_budgets').select('fiscal_year,period,scope,key,kind,amount').limit(2000)),
      st ? q(db.rpc('qbo_status')) : {},
      st ? q(db.from('dept_tasks').select('id', { count: 'exact', head: true }).eq('department', 'finance').eq('done', false).is('banked_at', null)) : {}
    ]).then(function (r) {
      S.docs = r[0].data || []; S.stmts = r[1].data || []; S.runs = r[2].data || []; S.bud = r[3].data || [];
      S.qbo = r[4].data || null; S.tasks = typeof r[5].count === 'number' ? r[5].count : null;
      S.at = Date.now(); S.loading = null;
      if (force) { S.tx = {}; S.lines = {}; }
      return linesFor(S.docs.filter(function (d) { return d.txn_id; }).map(function (d) { return d.txn_id; }));
    }, function () { S.loading = null; });
    return S.loading;
  }
  function linesFor(ids) {
    ids = ids.filter(function (id) { return id && !S.lines[id]; });
    if (!ids.length) return Promise.resolve();
    return q(db.from('finance_transactions').select(TX_COLS).in('id', ids.slice(0, 300))).then(function (r) { (r.data || []).forEach(function (t) { S.lines[t.id] = t; }); });
  }
  function needTx(fy) {
    if (S.tx[fy] || S.txBusy[fy] || typeof db === 'undefined') return;
    S.txBusy[fy] = 1;
    q(db.from('finance_transactions').select(TX_COLS).gte('txn_date', fyStart(fy)).lte('txn_date', fyEnd(fy)).order('txn_date', { ascending: false }).order('id', { ascending: false }).limit(3000)).then(function (r) {
      S.tx[fy] = (r.data || []).filter(function (t) { return (t.duplicate_of === null || t.duplicate_of === undefined) && t.txn_date >= fyStart(fy) && t.txn_date <= fyEnd(fy); });
      S.tx[fy].forEach(function (t) { S.lines[t.id] = t; });
      S.txBusy[fy] = 0; paint();
    });
  }
  function counts() {
    var c = { confirm: 0, missing: 0, problems: 0, waiting: 0, matched: 0, settled: 0, files: 0 };
    S.docs.forEach(function (d) { var b = bucket(d); if (b) c[b]++; if (d.suggestion_state === 'pending' || d.suggestion_state === 'failed') c.files++; });
    c.match = c.confirm + c.missing + c.problems;
    return c;
  }
  function bucket(d) {
    if (MONEY_KINDS.indexOf(d.kind) < 0) return null;
    if (d.match_state === 'not_needed') return 'settled';
    if (d.read_state === 'new') return 'waiting';
    if (d.read_state === 'failed' || d.read_state === 'skipped' || d.match_state === 'declined' || d.match_state === 'open') return 'problems';
    if (d.match_state === 'suggested') return 'confirm';
    if (d.match_state === 'missing') return 'missing';
    if (d.match_state === 'not_yet') return 'waiting';
    if (d.match_state === 'matched') return 'matched';
    return null;
  }
  function extra(d) { var x = {}; try { if (/^\s*\{/.test(d.suggestion_note || '')) x = JSON.parse(d.suggestion_note); } catch (e) { x = {}; } return x || {}; }
  function purposeOf(d) {
    var x = extra(d); if (x.purpose) return String(x.purpose);
    var m = /^\d{4}-\d{2}-\d{2} - [^-]+ - (.+?) - (US\$|\$|EUR )/.exec(d.suggested_name || ''); return m ? m[1] : '';
  }
  function kindLabel(d) {
    var t = d.doc_type || '';
    if (t === 'transfer_notice') return 'e-Transfer';
    if (t === 'incoming_funds') return 'Money coming in';
    if (t === 'payment_declined') return 'Payment declined';
    if (t === 'donation_receipt') return 'Donation receipt';
    if (d.kind === 'reimbursement') return 'Reimbursement';
    if (d.kind === 'donation') return 'Donation';
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Bill';
  }
  function stmtFor(key) {
    var best = null;
    S.stmts.forEach(function (s) { if (String(s.period_end).slice(0, 7) === key && (!best || (s.txn_count - s.dup_count) > (best.txn_count - best.dup_count))) best = s; });
    return best;
  }
  function lastStmt() { return S.stmts[0] || null; }
  function receiptsByLine() { var m = {}; S.docs.forEach(function (d) { if (d.txn_id && d.match_state === 'matched') (m[d.txn_id] = m[d.txn_id] || []).push(d); }); return m; }
  function budgetOf(fyLbl, kind) { var s = 0, any = false; S.bud.forEach(function (b) { if (b.fiscal_year === fyLbl && b.period === 'FY' && b.scope === 'category' && b.kind === kind) { s += Number(b.amount || 0); any = true; } }); return any ? s : null; }
  function sumTx(list) { var i = 0, o = 0; (list || []).forEach(function (t) { var a = Number(t.amount); if (a >= 0) i += a; else o += -a; }); return { inn: i, out: o, net: i - o }; }

  /* ---------- where things live on the page ---------- */
  function panel() { return document.getElementById('finances'); }
  function cur() { var t = document.querySelector('#finances .w94tab.on'); if (t) return t.getAttribute('data-w94tab'); try { return window.w94Cur ? window.w94Cur() : 'today'; } catch (e) { return 'today'; } }
  function go(id, sub) {
    if (id === 'match' && sub) S.tab = sub;
    if (id === 'bank' && sub) { S.bankMonth = sub; S.bankFy = fyOf(sub + '-15'); }
    if (location.hash.replace(/^#/, '').split('/')[0] !== 'finances') location.hash = '#finances';
    if (window.w94Show) window.w94Show(id);
    try { var p = panel(); if (p && p.scrollIntoView && window.scrollY > 200) window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* fine */ }
  }
  function shell(id) { return document.querySelector('#finances .w94sec[data-w94sec="' + id + '"]'); }
  function el(id) {
    if (!S.els[id]) { var d = document.createElement('div'); d.className = 'w302'; d.id = 'w302' + id; S.els[id] = d; }
    return S.els[id];
  }
  /* add the four sections and the tabs (again after every redraw of the page), in the rail's order */
  var LABEL = { today: 'Today', match: 'Match', bank: 'Bank', budget: 'Budget', files: 'Files', tasks: 'Tasks', trends: 'Trends', money: 'Money map', overview: 'Year overview', txns: 'Transactions' };
  var ORDER = ['today', 'match', 'bank', 'budget', 'files', '|', 'tasks', 'trends', 'money', 'overview', 'txns'];
  /* on a phone the strip sticks under the app bar (wave153's #w153bar, itself sticky) */
  function barTop() { try { var bar = document.getElementById('w153bar'), h = bar ? Math.round(bar.getBoundingClientRect().height) : 0; if (bar && h > 20 && getComputedStyle(bar).position === 'sticky') document.documentElement.style.setProperty('--w302top', h + 'px'); } catch (e) { /* fine */ } }
  function mount() {
    var p = panel(), nav = document.getElementById('w94nav'); if (!p || !nav) return false;
    barTop();
    var ok = staff(), first = p.querySelector('.w94sec');
    MINE.forEach(function (id) {
      if (STAFF_ONLY.indexOf(id) >= 0 && !ok) return;
      var sh = shell(id);
      if (!sh) { sh = document.createElement('div'); sh.className = 'w94sec'; sh.setAttribute('data-w94sec', id); sh.style.display = 'none'; (first || nav).insertAdjacentElement(first ? 'beforebegin' : 'afterend', sh); }
      if (sh.firstChild !== el(id)) sh.insertBefore(el(id), sh.firstChild);
    });
    var bs = shell('budget');
    if (bs && bs.firstChild !== el('budget')) bs.insertBefore(el('budget'), bs.firstChild);
    if (!nav.getAttribute('data-w302')) {
      nav.setAttribute('data-w302', '1');
      var tabs = {}; nav.querySelectorAll('.w94tab').forEach(function (b) { tabs[b.getAttribute('data-w94tab')] = b; });
      var frag = document.createDocumentFragment();
      ORDER.forEach(function (id) {
        if (id === '|') { var s = document.createElement('span'); s.className = 'w302sep'; s.setAttribute('aria-hidden', 'true'); frag.appendChild(s); return; }
        if (STAFF_ONLY.indexOf(id) >= 0 && !ok) return;
        var b = tabs[id];
        if (!b) { if (MINE.indexOf(id) < 0) return; b = document.createElement('button'); b.className = 'w94tab'; b.setAttribute('data-w94tab', id); b.addEventListener('click', function () { window.w94Show && window.w94Show(id); }); }
        b.textContent = LABEL[id] || b.textContent;
        frag.appendChild(b); delete tabs[id];
      });
      Object.keys(tabs).forEach(function (k) { frag.appendChild(tabs[k]); });
      nav.appendChild(frag);
    }
    return true;
  }

  /* ---------- painting ---------- */
  var painting = false, animated = {};
  function paint() {
    if (painting) return; painting = true;
    try {
      var id = cur(), p = panel(); if (!p) return;
      barTop();
      p.classList.toggle('w302np', MINE.indexOf(id) >= 0);
      if (id === 'today') drawToday(); else if (id === 'match') drawMatch(); else if (id === 'bank') drawBank(); else if (id === 'files') drawFiles(); else if (id === 'budget') drawBudget();
      var box = S.els[id];
      if (box && !animated[id] && box.innerHTML) { animated[id] = 1; box.classList.add('anim'); setTimeout(function () { box.classList.remove('anim'); }, 900); }
    } finally { painting = false; }
    paintRail();
  }
  function paintRail() { try { if (window.w153 && window.w153.paint) window.w153.paint(); } catch (e) { /* fine */ } }
  function loading(box, words) { if (!box.innerHTML) box.innerHTML = '<div class="w302card"><span class="w302busy">' + E(words || 'Loading the books…') + '</span></div>'; }

  /* ---------- Today ---------- */
  function driveChip() {
    var r = (S.runs || []).filter(function (x) { return x.finished_at && !x.error && /^(run|scan)$/.test(x.action); })[0];
    var t = todayYmd(), dd = Number(t.slice(8, 10)), mm = Number(t.slice(5, 7));
    var next = dd < 15 ? MON[mm - 1] + ' 15' : MON[mm % 12] + ' 1';
    var last = r ? D(String(r.finished_at).slice(0, 10)) : 'not yet';
    return staff() ? '<button type="button" class="w302chip" data-w302go="files" title="The Accounting drive is checked on the 1st and the 15th">' + I('drive') + 'Drive checked ' + E(last) + ' · next ' + E(next) + '</button>' : '';
  }
  function qboChip() {
    if (!staff()) return '';
    var qb = S.qbo || {};
    if (qb.connected) return '<span class="w302chip ok" title="QuickBooks Online is connected">' + I('qb') + 'QuickBooks: ' + E(qb.company || 'connected') + (qb.env === 'sandbox' ? ' (test company)' : '') + '</span>';
    var admin = false; try { admin = typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role === 'admin'; } catch (e) { admin = false; }
    return admin ? '<button type="button" class="w302chip gold" data-w302qbo="1" title="Connects the Hub to Welfare Avenue\u2019s QuickBooks Online (admins)">' + I('qb') + 'QuickBooks: connect</button>' : '';
  }
  function needs() {
    var c = counts(), out = [], L = lastStmt(), t = todayYmd(), fy = nowFy();
    if (staff()) {
      if (c.confirm) out.push(['spark', '', c.confirm, c.confirm === 1 ? 'A bank match to confirm' : 'Bank matches to confirm', 'The Hub found the line; say yes or no', 'match:confirm']);
      if (c.missing) out.push(['alert', 'gold', c.missing, c.missing === 1 ? 'A bill with no bank line' : 'Bills with no bank line', 'Paid another way, or still to pay?', 'match:missing']);
      if (c.problems) out.push(['alert', 'red', c.problems, c.problems === 1 ? 'A document needs a look' : 'Documents need a look', 'Unreadable, or a payment that failed', 'match:problems']);
      if (c.files) out.push(['folder', '', c.files, c.files === 1 ? 'A Drive tidy-up to approve' : 'Drive tidy-ups to approve', 'Clearer names and the right folders', 'files']);
    }
    if (L && days(L.period_end, t) > 38) {
      var nm = new Date(L.period_end + 'T12:00:00'); nm.setMonth(nm.getMonth() + 1);
      out.push(['bank', 'gold', '', 'The ' + MONTHS[nm.getMonth()] + ' statement is due', 'Save it in Year End ' + fyOf(ymd(nm)) + ' / Bank Statements; the Hub picks it up', 'bank']);
    }
    var g = (S.tx[fy] || []).filter(guessed).length;
    if (staff() && g) out.push(['spark', 'gold', g, g === 1 ? 'A bank line the Hub guessed' : 'Bank lines the Hub guessed', 'Check the team and category', 'bank']);
    if (staff() && budgetOf(fyL(fy), 'expense') === null) out.push(['tasks', 'gold', '', fyL(fy) + ' has no budget yet', 'Start it from ' + fyL(fy - 1) + ' in a click', 'budget']);
    if (staff() && S.tasks) out.push(['tasks', '', S.tasks, S.tasks === 1 ? 'An open Finance task' : 'Open Finance tasks', 'Bills to pay, receipts to file, approvals', 'tasks']);
    return out;
  }
  function monthBars(fy) {
    var tx = S.tx[fy]; if (!tx) return '<span class="w302busy">Counting the months…</span>';
    var mo = [];
    for (var i = 0; i < 12; i++) { var m = (9 + i) % 12 + 1, y = m >= 10 ? fy - 1 : fy; mo.push({ key: y + '-' + ('0' + m).slice(-2), m: m, i: 0, o: 0 }); }
    var idx = {}; mo.forEach(function (x, k) { idx[x.key] = k; });
    tx.forEach(function (t) { var k = idx[String(t.txn_date).slice(0, 7)]; if (k === undefined) return; var a = Number(t.amount); if (a >= 0) mo[k].i += a; else mo[k].o += -a; });
    var max = 1; mo.forEach(function (x) { max = Math.max(max, x.i, x.o); });
    var tot = sumTx(tx);
    return '<div class="w302bars" role="group" aria-label="' + E(fyL(fy) + ' month by month: ' + M0(tot.inn) + ' in, ' + M0(tot.out) + ' out') + '">' + mo.map(function (x, k) {
      var lbl = MONTHS[x.m - 1] + ': ' + M(x.i) + ' in, ' + M(x.o) + ' out';
      return '<button type="button" data-w302month="' + x.key + '" title="' + E(lbl) + '" aria-label="' + E(lbl) + '"><div class="pair"><i style="height:' + (x.i / max * 100).toFixed(1) + '%;animation-delay:' + (k * 25) + 'ms"></i><i class="o" style="height:' + (x.o / max * 100).toFixed(1) + '%;animation-delay:' + (k * 25 + 12) + 'ms"></i></div><span>' + MON[x.m - 1].charAt(0) + '<span class="hide-s">' + MON[x.m - 1].slice(1) + '</span></span></button>';
    }).join('') + '</div><div class="w302legend"><span>Money in</span><span class="o">Money out</span></div>';
  }
  function drawToday() {
    var box = el('today'), fy = nowFy(), L = lastStmt(), P = S.stmts[1] || null;
    if (!S.at) { loading(box); return; }
    needTx(fy); needTx(fy - 1);
    var t1;
    if (L && L.closing_balance !== null && L.closing_balance !== undefined) {
      var diff = P && P.closing_balance !== null && P.closing_balance !== undefined ? Number(L.closing_balance) - Number(P.closing_balance) : null;
      t1 = '<div class="w302tile hero"><div class="k">In the bank</div><div class="v">' + M(L.closing_balance) + '</div><div class="s">BMO, the ' + E(Dy(L.period_end)) + ' statement' + (diff !== null ? '<br>' + (diff < 0 ? 'Down ' : 'Up ') + M(Math.abs(diff)) + ' since ' + E(D(P.period_end)) : '') + '</div></div>';
    } else {
      t1 = '<div class="w302tile hero"><div class="k">In the bank</div><div class="v">…</div><div class="s">' + (L ? 'The Hub reads the balance from the ' + E(Dy(L.period_end)) + ' statement at the next Drive check.' : 'No statement in the Hub yet.') + '</div></div>';
    }
    var now = S.tx[fy], nowS = sumTx(now), endNow = S.stmts.filter(function (s) { return fyOf(s.period_end) === fy; })[0];
    var t2 = '<div class="w302tile"><div class="k">' + fyL(fy) + ' so far</div>' + (now ? '<div class="v">' + M(nowS.net, true) + '</div><div class="rows"><div class="row"><span>In</span><span></span><b>' + M(nowS.inn) + '</b></div><div class="row"><span>Out</span><span></span><b>' + M(nowS.out) + '</b></div></div><div class="s" style="margin-top:8px">' + (endNow ? 'Oct 1 to the ' + E(D(endNow.period_end)) + ' statement' : 'No statement yet this year') + '</div>' : '<div class="v">…</div>') + '</div>';
    var prev = S.tx[fy - 1], pS = sumTx(prev), bIn = budgetOf(fyL(fy - 1), 'income'), bOut = budgetOf(fyL(fy - 1), 'expense');
    var t3 = '<div class="w302tile"><div class="k">' + fyL(fy - 1) + ' closed</div>' + (prev ? '<div class="v">' + M(pS.net, true) + '</div><div class="rows">'
      + '<div class="row"><span>In</span>' + (bIn ? '<div class="w302bar" title="' + pct(pS.inn, bIn) + '% of the income budget"><i style="width:' + Math.min(100, pct(pS.inn, bIn)) + '%"></i></div>' : '<span></span>') + '<b>' + M0(pS.inn) + (bIn ? ' <small style="font-weight:400;opacity:.7">' + pct(pS.inn, bIn) + '% of ' + M0(bIn) + '</small>' : '') + '</b></div>'
      + '<div class="row"><span>Out</span>' + (bOut ? '<div class="w302bar out' + (pS.out > bOut ? ' over' : '') + '" title="' + pct(pS.out, bOut) + '% of the spending budget"><i style="width:' + Math.min(100, pct(pS.out, bOut)) + '%"></i></div>' : '<span></span>') + '<b>' + M0(pS.out) + (bOut ? ' <small style="font-weight:400;opacity:.7">' + pct(pS.out, bOut) + '% of ' + M0(bOut) + '</small>' : '') + '</b></div>'
      + '</div><div class="s" style="margin-top:8px">Oct 1, ' + (fy - 2) + ' to Sep 30, ' + (fy - 1) + ', against its budget</div>' : '<div class="v">…</div>') + '</div>';
    var nd = needs();
    var needHtml = nd.length ? '<ul class="w302need">' + nd.map(function (n) {
      return '<li><button type="button" data-w302go="' + E(n[5]) + '"><span class="ic ' + n[1] + '">' + I(n[0]) + '</span><span>' + E(n[3]) + '<small>' + E(n[4]) + '</small></span><span class="c">' + E(n[2]) + '</span>' + I('chev') + '</button></li>';
    }).join('') + '</ul>' : '<div class="w302calm">' + I('check') + '<span>Nothing waiting on anyone. Every bill has its bank line and Drive is tidy.</span></div>';
    var barsFy = (S.stmts.filter(function (s) { return fyOf(s.period_end) === fy; }).length >= 3) ? fy : fy - 1;
    var recent = (S.tx[fy] && S.tx[fy].length ? S.tx[fy] : (S.tx[fy - 1] || [])).slice(0, 6);
    var latest = recent.length ? '<table class="w302lines"><tbody>' + recent.map(function (t) {
      var a = Number(t.amount);
      return '<tr><td class="d">' + E(D(t.txn_date)) + '</td><td class="w" data-w198skip><span class="t">' + E(t.description) + '</span></td><td class="hide-s"><span class="w302team">' + E(teamLabel(t.department)) + '</span></td><td class="a' + (a >= 0 ? ' in' : '') + '">' + M(a, true) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<span class="w302busy">Reading the bank…</span>';
    box.innerHTML = '<div class="w302meta">' + driveChip() + qboChip() + '</div>'
      + '<div class="w302tiles">' + t1 + t2 + t3 + '</div>'
      + '<div class="w302cols"><section class="w302card"><h3 class="w302h">Needs someone' + (nd.length ? ' <span class="n">' + nd.length + '</span>' : '') + '</h3>' + needHtml + '</section>'
      + '<section class="w302card"><h3 class="w302h">' + fyL(barsFy) + ' month by month</h3>' + monthBars(barsFy) + '</section></div>'
      + '<section class="w302card"><div class="w302hl"><h3 class="w302h" style="margin:0">Latest at the bank</h3><button type="button" class="w302b ghost" data-w302go="bank">See the month ' + I('chev') + '</button></div>' + latest + '</section>';
  }

  /* ---------- Match ---------- */
  var TABS = [['confirm', 'To confirm'], ['missing', 'Not at the bank'], ['problems', 'Problems'], ['waiting', 'Waiting'], ['matched', 'Matched']];
  var LEDE = {
    confirm: 'The Hub found a bank line that looks right for each of these. Say yes, or tell it that is not the one.',
    missing: 'Bills and receipts with no matching line in the BMO account. Pick the line yourself, or say it was paid another way.',
    problems: 'The Hub could not read these, or a payment failed. Each one says what is wrong.',
    waiting: 'Newer than the latest statement, or not read yet. They match by themselves when the next statement comes in.',
    matched: 'Paired with their bank line. Undo any that are wrong.'
  };
  function lineBox(t, label) {
    if (!t) return '';
    var a = Number(t.amount);
    return '<div class="line">' + I('bank') + '<span class="t" data-w198skip>' + E(label ? label + ' ' : '') + E(D(t.txn_date)) + ' · ' + E(t.description) + '</span><b>' + M(a, true) + '</b></div>';
  }
  function docCard(d) {
    var b = bucket(d), src = d.source === 'email' ? I('mail') + 'Hub inbox' : I('drive') + E(lastSeg(d.folder_path) || 'Drive');
    var dirIn = d.direction === 'in', amt = d.amount !== null && d.amount !== undefined ? Mc(d.amount, d.currency) : '';
    var purpose = purposeOf(d), sub = [purpose, d.doc_date ? Dy(d.doc_date) : ''].filter(Boolean).join(' · ');
    var line = d.txn_id ? S.lines[d.txn_id] : null, acts = '', note = d.match_note || '';
    if (b === 'confirm') acts = '<button type="button" class="w302b pri" data-w302act="confirm" data-id="' + d.id + '">' + I('check') + 'Yes, that’s the one</button><button type="button" class="w302b" data-w302act="reject" data-id="' + d.id + '">Not this one</button><span class="sp"></span><button type="button" class="w302b ghost" data-w302act="not_needed" data-id="' + d.id + '">No bank line needed</button>';
    else if (b === 'missing') acts = '<button type="button" class="w302b pri" data-w302pick="' + d.id + '">Pick the bank line</button><button type="button" class="w302b" data-w302act="not_needed" data-note="Paid another way, not through the BMO account" data-id="' + d.id + '">Paid another way</button>';
    else if (b === 'problems') {
      if (d.match_state === 'declined') acts = '<button type="button" class="w302b pri" data-w302act="not_needed" data-note="Sorted after the declined payment" data-id="' + d.id + '">It’s sorted</button>';
      else acts = '<button type="button" class="w302b" data-w302pick="' + d.id + '">Pick the bank line</button><button type="button" class="w302b ghost" data-w302act="not_needed" data-id="' + d.id + '">No bank line needed</button>';
      if (d.read_state === 'failed') note = 'The Hub could not read this one' + (d.read_error ? ' (' + String(d.read_error).slice(0, 90) + ')' : '') + '. Open it and match it by hand.';
      else if (d.read_state === 'skipped') note = (d.match_note || 'Too large or not a PDF or photo, so the Hub could not read it.');
    } else if (b === 'waiting') acts = '<button type="button" class="w302b ghost" data-w302pick="' + d.id + '">It’s already in: pick the line</button><button type="button" class="w302b ghost" data-w302act="not_needed" data-id="' + d.id + '">No bank line needed</button>';
    else if (b === 'matched') acts = String(d.matched_by || '').indexOf('person:') === 0 ? '<button type="button" class="w302b ghost" data-w302act="reopen" data-id="' + d.id + '">' + I('undo') + 'Undo the match</button>' : '<button type="button" class="w302b ghost" data-w302act="reject" data-id="' + d.id + '">Not this one</button>';
    else if (b === 'settled') acts = '<button type="button" class="w302b ghost" data-w302act="reopen" data-id="' + d.id + '">' + I('undo') + 'Put it back</button>';
    if (b === 'matched' && line) note = (String(d.matched_by || '').indexOf('person:') === 0 ? 'Confirmed by ' + whoSaid(d.matched_by) : 'Matched by the Hub') + (d.currency && d.currency !== 'CAD' ? ': ' + Mc(d.amount, d.currency) + ' came out as ' + M(Math.abs(Number(line.amount))) + ' at the bank.' : '.');
    if (b === 'confirm' && line) note = '';
    if (b === 'settled' && /^No bank line needed \(/.test(note)) note = 'No bank line needed (' + whoSaid(note.replace(/^No bank line needed \(|\)$/g, '')) + ').';
    var src2 = d.url ? '<a class="more" href="' + E(d.url) + '" target="_blank" rel="noopener">' + I('drive') + 'Open in Drive</a>' : '';
    if (d.hub_mail_id) src2 += '<button type="button" class="more" data-w302mail="' + d.hub_mail_id + '">' + I('mail') + (S.open['m' + d.hub_mail_id] ? 'Hide the email' : 'See the email') + '</button>';
    var mail = '';
    if (d.hub_mail_id && S.open['m' + d.hub_mail_id]) {
      var m = S.mail[d.hub_mail_id];
      mail = '<div class="mailbox" data-w198skip>' + (m === 'busy' || !m ? '<span class="w302busy">Opening the email…</span>' : m.error ? 'The email could not be opened.' : '<b>' + E(m.subject || '') + '</b><br>' + E((m.from_name || '') + (m.from_email ? ' <' + m.from_email + '>' : '')) + ' · ' + E(Dy(String(m.internal_date || '').slice(0, 10))) + (m.summary ? '<br><br>' + E(m.summary) : '')) + '</div>';
    }
    var pick = '';
    if (S.pick[d.id]) {
      var pk = S.pick[d.id];
      pick = '<div class="w302pick">' + (pk === 'busy' ? '<span class="w302busy">Looking through the bank…</span>' : !pk.length ? '<small>No bank line within two months of ' + E(Dy(d.doc_date)) + ' looks close. It was likely paid another way.</small>' : '<small>Bank lines near ' + E(Dy(d.doc_date)) + ', closest amount first. Tap the one that paid this.</small>' + pk.map(function (t) {
        return '<button type="button" data-w302use="' + t.id + '" data-id="' + d.id + '"><span>' + E(D(t.txn_date)) + '</span><span class="t" data-w198skip>' + E(t.description) + '</span><b>' + M(Number(t.amount), true) + '</b></button>';
      }).join('')) + '</div>';
    }
    return '<article class="w302doc" data-w302doc="' + d.id + '">'
      + '<div class="top"><span class="src">' + src + '</span><span>·</span><span>' + E(kindLabel(d)) + '</span></div>'
      + '<div class="main"><div class="who"><b data-w198skip>' + E(d.vendor || d.name) + '</b><span data-w198skip>' + E(sub || d.name) + '</span></div><div class="amt' + (dirIn ? ' in' : '') + '">' + E(amt) + (amt ? '<small>' + (dirIn ? 'coming in' : d.direction === 'out' ? 'going out' : 'no money moves') + '</small>' : '') + '</div></div>'
      + (note ? '<p class="note">' + E(note) + '</p>' : '')
      + (line && (b === 'confirm' || b === 'matched') ? lineBox(line, b === 'confirm' ? 'Is it this line?' : '') : '')
      + pick + '<div class="acts">' + acts + '</div>'
      + (src2 ? '<div class="acts" style="margin-top:6px;gap:14px">' + src2 + '</div>' : '') + mail
      + '</article>';
  }
  function drawMatch() {
    var box = el('match');
    if (!staff()) { box.innerHTML = '<div class="w302empty">Matching is for the Finance team.</div>'; return; }
    if (!S.at) { loading(box); return; }
    var c = counts(), tab = S.tab;
    var list = S.docs.filter(function (d) { return bucket(d) === tab; });
    list.sort(function (a, b) { return String(b.doc_date || '').localeCompare(String(a.doc_date || '')); });
    var settled = tab === 'matched' ? S.docs.filter(function (d) { return bucket(d) === 'settled'; }) : [];
    /* on a phone, To confirm is one card at a time (the approved phone flow): answer it and the next one comes up */
    var one = '';
    if (tab === 'confirm' && phone() && !S.all && list.length > 1) {
      var rest = list.filter(function (d) { return !S.later[d.id]; }); if (!rest.length) { S.later = {}; rest = list; }
      var pos = list.indexOf(rest[0]) + 1;
      one = '<div class="w302hl" style="margin-bottom:8px"><span class="w302lede" style="margin:0">' + pos + ' of ' + list.length + '</span><span><button type="button" class="w302b ghost" data-w302later="' + rest[0].id + '">Later</button><button type="button" class="w302b ghost" data-w302all1="1">See all</button></span></div>';
      list = [rest[0]];
    }
    var EMPTY = { confirm: ['Nothing to confirm', 'Every bill with a likely bank line is settled.'], missing: ['Nothing missing', 'Every bill and receipt has found its bank line.'], problems: ['No problems', 'The Hub could read everything.'], waiting: ['Nothing waiting', 'Everything is on a statement already.'], matched: ['Nothing matched yet', 'Matches show here once confirmed.'] };
    box.innerHTML = '<div class="w302hl"><div class="w302seg" role="tablist" aria-label="Match">' + TABS.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '" data-w302tab="' + t[0] + '">' + E(t[1]) + ' <span class="n">' + (c[t[0]] || 0) + '</span></button>';
    }).join('') + '</div></div><p class="w302lede" style="margin-top:10px">' + E(LEDE[tab]) + '</p>'
      + one + (list.length ? '<div class="w302docs">' + list.map(docCard).join('') + '</div>' : '<div class="w302card w302empty">' + I('check') + '<b>' + E(EMPTY[tab][0]) + '</b>' + E(EMPTY[tab][1]) + '</div>')
      + (settled.length ? '<div class="w302sub">No bank line needed (' + settled.length + ')</div><div class="w302docs">' + settled.map(docCard).join('') + '</div>' : '');
  }
  function act(id, action, txn, note) {
    var card = document.querySelector('[data-w302doc="' + id + '"]'), before = S.docs.filter(function (d) { return d.id === id; })[0];
    if (card) card.classList.add('w302out');
    q(db.rpc('finance_doc_act', { p_id: id, p_action: action, p_txn: txn || null, p_note: note || null })).then(function (r) {
      if (r.error) { if (card) card.classList.remove('w302out'); say(errText(r.error)); paint(); return; }
      var row = r.data; if (row && row.id) { S.docs = S.docs.map(function (d) { return d.id === row.id ? Object.assign({}, d, row) : d; }); }
      delete S.pick[id];
      var undo = (action === 'confirm' || action === 'not_needed') ? { label: 'Undo', run: function () { act(id, 'reopen'); } } : null;
      var words = { confirm: 'Matched to the bank line.', reject: 'Noted. The Hub will not suggest that line again.', not_needed: 'Settled: no bank line needed.', reopen: 'Put back.', approve: 'Approved.', dismiss: 'Skipped.', undismiss: 'Back on the list.' }[action] || 'Saved.';
      if (action === 'reject' && row && row.match_state === 'suggested') words = 'Noted. The Hub found another line to check.';
      linesFor([row && row.txn_id]).then(function () { setTimeout(paint, card ? 170 : 0); });
      if (action !== 'approve' && action !== 'dismiss' && action !== 'undismiss') say(words, undo);
      if (before && action === 'approve') schedApply();
    });
  }
  function pickFor(id) {
    var d = S.docs.filter(function (x) { return x.id === id; })[0]; if (!d) return;
    if (S.pick[id]) { delete S.pick[id]; paint(); return; }
    S.pick[id] = 'busy'; paint();
    var base = d.doc_date || todayYmd(), a = new Date(base + 'T12:00:00'), b = new Date(base + 'T12:00:00'); a.setDate(a.getDate() - 20); b.setDate(b.getDate() + 60);
    var qq = db.from('finance_transactions').select(TX_COLS).is('duplicate_of', null).gte('txn_date', ymd(a)).lte('txn_date', ymd(b)).limit(400);
    qq = d.direction === 'in' ? qq.gt('amount', 0) : qq.lt('amount', 0);
    q(qq).then(function (r) {
      var fx = String(d.currency || 'CAD').toUpperCase() !== 'CAD' ? 1.44 : 1, want = Number(d.amount || 0) * fx;
      var taken = {}; S.docs.forEach(function (x) { if (x.txn_id && x.match_state === 'matched' && x.id !== id) taken[x.txn_id] = 1; });
      var lo = ymd(a), hi = ymd(b), sgn = d.direction === 'in' ? 1 : -1;
      var rows = (r.data || []).filter(function (t) { return !taken[t.id] && t.txn_date >= lo && t.txn_date <= hi && Number(t.amount) * sgn > 0 && (t.duplicate_of === null || t.duplicate_of === undefined); });
      rows.forEach(function (t) { S.lines[t.id] = t; t._s = want ? Math.abs(Math.abs(Number(t.amount)) - want) / want : 0; t._s += Math.abs(days(base, t.txn_date)) / 400; });
      rows.sort(function (x, y) { return x._s - y._s; });
      S.pick[id] = rows.slice(0, 8); paint();
    });
  }
  function mailFor(mid) {
    var k = 'm' + mid; S.open[k] = !S.open[k];
    if (S.open[k] && !S.mail[mid]) {
      S.mail[mid] = 'busy';
      q(db.from('hub_mail').select('id,subject,from_name,from_email,internal_date,summary').eq('id', mid).maybeSingle()).then(function (r) { S.mail[mid] = r.data || { error: true }; paint(); });
    }
    paint();
  }

  /* ---------- Bank ---------- */
  function drawBank() {
    var box = el('bank');
    if (!S.at) { loading(box); return; }
    var fys = {}; S.stmts.forEach(function (s) { fys[fyOf(s.period_end)] = 1; }); fys[nowFy()] = 1;
    var list = Object.keys(fys).map(Number).sort().slice(-4);
    var fy = S.bankFy && fys[S.bankFy] ? S.bankFy : nowFy();
    needTx(fy);
    var t = todayYmd(), tk = t.slice(0, 7), months = [];
    for (var i = 0; i < 12; i++) {
      var m = (9 + i) % 12 + 1, y = m >= 10 ? fy - 1 : fy, key = y + '-' + ('0' + m).slice(-2), s = stmtFor(key);
      var state = s ? 'in' : key < tk ? 'due' : 'future';
      months.push({ key: key, m: m, s: s, state: state });
    }
    var sel = S.bankMonth && months.some(function (x) { return x.key === S.bankMonth; }) ? S.bankMonth : null;
    if (!sel) { var withS = months.filter(function (x) { return x.s; }); sel = withS.length ? withS[withS.length - 1].key : months[0].key; }
    var mo = months.filter(function (x) { return x.key === sel; })[0], s0 = mo.s, tx = S.tx[fy];
    var head = '<div class="w302hl"><div class="w302seg" aria-label="Fiscal year">' + list.map(function (y) { return '<button type="button" class="' + (y === fy ? 'on' : '') + '" data-w302fy="' + y + '">' + fyL(y) + '</button>'; }).join('') + '</div>'
      + '<button type="button" class="w302b ghost" data-w302go="txns">Search every transaction ' + I('chev') + '</button></div>'
      + '<div class="w302months" role="tablist" aria-label="Months">' + months.map(function (x) {
        var lbl = MONTHS[x.m - 1] + (x.state === 'in' ? ': statement in' : x.state === 'due' ? ': no statement yet' : '');
        return '<button type="button" role="tab" aria-selected="' + (x.key === sel) + '" class="' + (x.key === sel ? 'on ' : '') + x.state + '" data-w302bm="' + x.key + '" title="' + E(lbl) + '"' + (x.state === 'future' ? ' aria-disabled="true"' : '') + '>' + MON[x.m - 1] + '<i></i></button>';
      }).join('') + '</div>';
    var body = '';
    if (!tx) body = '<span class="w302busy">Reading the bank…</span>';
    else {
      var from = s0 ? s0.period_start : sel + '-01', to = s0 ? s0.period_end : sel + '-31';
      var lines = tx.filter(function (x) { return x.txn_date >= from && x.txn_date <= to; }).sort(function (a, b) { return String(a.txn_date).localeCompare(String(b.txn_date)) || a.id - b.id; });
      var sm = sumTx(lines), rc = receiptsByLine();
      var mname = MONTHS[Number(sel.slice(5, 7)) - 1] + ' ' + sel.slice(0, 4);
      var hasBal = s0 && s0.opening_balance !== null && s0.opening_balance !== undefined && s0.closing_balance !== null && s0.closing_balance !== undefined;
      body = '<h3 class="w302h" style="margin-top:4px">' + E(mname) + (s0 ? ' <span class="n">' + E(D(s0.period_start)) + ' to ' + E(D(s0.period_end)) + '</span>' : '') + '</h3>';
      if (!s0) body += '<p class="w302lede">' + (mo.state === 'due' ? 'No statement for this month in the Hub yet. Save it in Year End ' + fy + ' / Bank Statements and the Hub picks it up at the next Drive check.' : 'This month has not happened yet.') + '</p>';
      body += '<div class="w302sum"><div><span>Opening</span><b>' + (hasBal ? M(s0.opening_balance) : '…') + '</b></div><div><span>In</span><b style="color:' + GREEN + '">' + M(sm.inn) + '</b></div><div><span>Out</span><b style="color:' + OUTC + '">' + M(sm.out) + '</b></div><div><span>Closing</span><b>' + (hasBal ? M(s0.closing_balance) : '…') + '</b></div></div>';
      if (hasBal) {
        var gap = Math.round((Number(s0.opening_balance) + sm.net - Number(s0.closing_balance)) * 100) / 100;
        body += gap === 0 ? '<div class="w302ok">' + I('check') + '<span>Every line adds up to the statement, to the cent.</span></div>' : '<div class="w302ok bad">' + I('alert') + '<span>The lines come to ' + M(Number(s0.opening_balance) + sm.net) + ' but the statement closes at ' + M(s0.closing_balance) + ': ' + M(Math.abs(gap)) + ' ' + (gap > 0 ? 'too much' : 'missing') + '. A line may be missing or counted twice.</span></div>';
      }
      var cats = catList(), ok = staff();
      body += lines.length ? '<div style="overflow-x:auto"><table class="w302lines"><thead><tr><th>Date</th><th>What</th><th class="hide-s">Team</th><th class="hide-s">Category</th><th class="a">Amount</th><th class="hide-s">Receipt</th></tr></thead><tbody>' + lines.map(function (x) {
        var a = Number(x.amount), r = rc[x.id], g = guessed(x);
        var team = ok ? '<select data-w302team="' + x.id + '" aria-label="Team">' + TEAMS.map(function (tm) { return '<option value="' + tm[0] + '"' + (tm[0] === x.department ? ' selected' : '') + '>' + E(tm[1]) + '</option>'; }).join('') + (TEAMS.some(function (tm) { return tm[0] === x.department; }) ? '' : '<option selected>' + E(x.department || '') + '</option>') + '</select>' : '<span class="w302team">' + E(teamLabel(x.department)) + '</span>';
        var cat = ok ? '<select data-w302cat="' + x.id + '" aria-label="Category">' + cats.map(function (c) { return '<option' + (c === x.category ? ' selected' : '') + '>' + E(c) + '</option>'; }).join('') + (cats.indexOf(x.category) < 0 ? '<option selected>' + E(x.category || '') + '</option>' : '') + '</select>' : E(x.category || '');
        var rec = r ? r.map(function (d) { return d.url ? '<a class="w302rc" href="' + E(d.url) + '" target="_blank" rel="noopener">' + I('link') + 'Receipt</a>' : '<span class="w302rc">' + I('mail') + 'Email</span>'; }).join(' ') : (a < 0 ? '<span class="w302rc none">none</span>' : '');
        return '<tr><td class="d">' + E(D(x.txn_date)) + '</td><td class="w"><span class="t" data-w198skip title="' + E(x.description) + '">' + E(x.description) + '</span>' + (g ? (ok ? '<button type="button" class="w302guess" data-w302ok="' + x.id + '" title="The Hub guessed the team and category. Click if they are right.">Guessed · confirm</button>' : '<span class="w302guess">Guessed</span>') : '') + '</td><td class="hide-s">' + team + '</td><td class="hide-s">' + cat + '</td><td class="a' + (a >= 0 ? ' in' : '') + '">' + M(a, true) + '</td><td class="hide-s">' + rec + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="w302empty">No bank lines in this month.</div>';
    }
    box.innerHTML = '<section class="w302card">' + head + body + '</section>';
  }
  function catList() {
    var out = []; function add(c) { if (c && out.indexOf(c) < 0) out.push(c); }
    try { (window.WA_FIN_CATS_IN || []).forEach(add); (window.WA_FIN_CATS_EX || []).forEach(add); } catch (e) { /* fine */ }
    try { if (typeof WA_FIN_CATS_IN !== 'undefined') WA_FIN_CATS_IN.forEach(add); if (typeof WA_FIN_CATS_EX !== 'undefined') WA_FIN_CATS_EX.forEach(add); } catch (e) { /* fine */ }
    S.bud.forEach(function (b) { if (b.scope === 'category') add(b.key); });
    return out;
  }
  function saveLine(id, patch, words) {
    if (!staff()) return;
    patch.allocated_by = me() || 'staff';
    q(db.from('finance_transactions').update(patch).eq('id', id)).then(function (r) {
      if (r.error) { say('That did not save. Try again.'); return; }
      Object.keys(S.tx).forEach(function (k) { (S.tx[k] || []).forEach(function (t) { if (t.id === id) Object.assign(t, patch); }); });
      if (S.lines[id]) Object.assign(S.lines[id], patch);
      try { if (typeof WA_FIN_TX !== 'undefined') WA_FIN_TX.forEach(function (t) { if (t.id === id) Object.assign(t, patch); }); } catch (e) { /* fine */ }
      S.dirty = true; say(words || 'Saved.'); paint();
    });
  }

  /* ---------- Budget (above wave22's editable tables) ---------- */
  function drawBudget() {
    var box = el('budget');
    if (!S.at) { loading(box); return; }
    var cfy = nowFy(), curL = fyL(cfy), prevL = fyL(cfy - 1), html = '';
    var hasCur = S.bud.some(function (b) { return b.fiscal_year === curL && Number(b.amount || 0) !== 0; }), hasPrev = S.bud.some(function (b) { return b.fiscal_year === prevL && Number(b.amount || 0) !== 0; });
    if (!hasCur && staff()) html += '<div class="w302fy"><div><b>The ' + curL + ' budget lives here now</b><p>Start from ' + prevL + '’s lines, then change any line in the tables below. Every change is saved in the Hub and logged.</p></div>' + (hasPrev ? '<button type="button" class="w302b" data-w302copy="1">Start from ' + prevL + '</button>' : '') + '</div>';
    var pageFy = (typeof waFinFYLabel === 'function') ? waFinFYLabel() : curL, tx = [];
    try { tx = (typeof WA_FIN_TX !== 'undefined' ? WA_FIN_TX : []).filter(function (t) { return t.duplicate_of === null || t.duplicate_of === undefined; }); } catch (e) { tx = []; }
    var by = S.budBy, rows = '';
    if (by === 'cat') {
      var cats = {}, kinds = {};
      S.bud.forEach(function (b) { if (b.fiscal_year === pageFy && b.period === 'FY' && b.scope === 'category') { cats[b.key] = (cats[b.key] || 0) + Number(b.amount || 0); kinds[b.key] = b.kind; } });
      var act = {}; tx.forEach(function (t) { act[t.category] = (act[t.category] || 0) + Number(t.amount); });
      Object.keys(act).forEach(function (k) { if (!(k in cats)) { cats[k] = 0; kinds[k] = act[k] >= 0 ? 'income' : 'expense'; } });
      var keys = Object.keys(cats).filter(function (k) { return cats[k] || act[k]; });
      ['income', 'expense'].forEach(function (kind) {
        var ks = keys.filter(function (k) { return kinds[k] === kind; }).sort(function (a, b) { return Math.abs(act[b] || 0) - Math.abs(act[a] || 0); });
        if (!ks.length) return;
        rows += '<div class="w302sub">' + (kind === 'income' ? 'Money in' : 'Money out') + '</div><div class="w302bud">' + ks.map(function (k) {
          var a = Math.abs(act[k] || 0), bg = cats[k] || 0, p = bg ? pct(a, bg) : 0, over = kind === 'expense' && bg && a > bg;
          return '<div class="r"><span class="nm" title="' + E(k) + '">' + E(k.replace(/^\d{4}\s+/, '')) + '</span><div class="w302bar' + (kind === 'expense' ? ' out' : '') + (over ? ' over' : '') + '"><i style="width:' + (bg ? Math.min(100, p) : 0) + '%"></i></div><span class="fig"><b>' + M0(a) + '</b>' + (bg ? ' of ' + M0(bg) + ' · ' + p + '%' : ' · no budget') + '</span></div>';
        }).join('') + '</div>';
      });
    } else {
      var team = {}, tot = 0;
      tx.forEach(function (t) { var a = Number(t.amount); if (a < 0) { team[t.department] = (team[t.department] || 0) - a; tot -= a; } });
      var ts = Object.keys(team).sort(function (a, b) { return team[b] - team[a]; });
      rows = ts.length ? '<div class="w302sub">Money out by team</div><div class="w302bud">' + ts.map(function (k) { return '<div class="r"><span class="nm">' + E(teamLabel(k)) + '</span><div class="w302bar out"><i style="width:' + pct(team[k], tot) + '%"></i></div><span class="fig"><b>' + M0(team[k]) + '</b> · ' + pct(team[k], tot) + '%</span></div>'; }).join('') + '</div>' : '<div class="w302empty">No spending in ' + E(pageFy) + ' yet.</div>';
    }
    html += '<section class="w302card"><div class="w302hl"><h3 class="w302h" style="margin:0">' + E(pageFy) + ' budget against actual</h3><div class="w302seg"><button type="button" class="' + (by === 'cat' ? 'on' : '') + '" data-w302by="cat">By category</button><button type="button" class="' + (by === 'team' ? 'on' : '') + '" data-w302by="team">By team</button></div></div>' + rows
      + '<p class="w302lede" style="margin:14px 0 0">The time frame above picks the year. Edit any line in the tables below.</p></section>';
    box.innerHTML = html;
  }
  function copyBudget() {
    var cfy = nowFy(), to = fyL(cfy), from = fyL(cfy - 1);
    q(db.rpc('finance_budget_copy', { p_from: from, p_to: to })).then(function (r) {
      if (r.error) { say(errText(r.error)); return; }
      say(to + ' started from ' + from + ': ' + r.data + ' lines. Change any of them below.');
      load(true).then(function () { try { if (typeof waFinLoad === 'function') return waFinLoad(true); } catch (e) { /* fine */ } }).then(function () { try { if (typeof waFinRender === 'function') waFinRender(); else paint(); } catch (e) { paint(); } });
    });
  }

  /* ---------- Files ---------- */
  function drawFiles() {
    var box = el('files');
    if (!staff()) { box.innerHTML = '<div class="w302empty">Files is for the Finance team.</div>'; return; }
    if (!S.at) { loading(box); return; }
    var fy = nowFy(), t = todayYmd();
    var health = [fy, fy - 1].map(function (y) {
      var lbl = fyL(y), docs = S.docs.filter(function (d) { return d.fiscal_year === lbl && d.source === 'drive'; });
      var mo = []; for (var i = 0; i < 12; i++) { var m = (9 + i) % 12 + 1, yy = m >= 10 ? y - 1 : y, key = yy + '-' + ('0' + m).slice(-2); mo.push({ key: key, m: m, s: !!stmtFor(key), past: key < t.slice(0, 7) }); }
      var have = mo.filter(function (x) { return x.s; }).length, due = mo.filter(function (x) { return !x.s && x.past; });
      var n = function (k) { return docs.filter(function (d) { return k.indexOf(d.kind) >= 0; }).length; };
      var unread = docs.filter(function (d) { return d.read_state === 'new' || d.read_state === 'failed'; }).length;
      return '<section class="w302card"><h3 class="w302h">' + I('folder') + 'Year End ' + y + '</h3><div class="mo" aria-label="' + E(have + ' of 12 statements') + '">' + mo.map(function (x) { return '<i class="' + (x.s ? 'y' : x.past ? 'm' : '') + '" title="' + E(MONTHS[x.m - 1] + (x.s ? ': statement in' : x.past ? ': missing' : '')) + '"></i>'; }).join('') + '</div>'
        + '<dl><dt>Bank statements</dt><dd>' + have + ' of 12</dd><dt>Bills and receipts</dt><dd>' + n(['bill', 'reimbursement']) + '</dd><dt>Donations</dt><dd>' + n(['donation']) + '</dd>' + (unread ? '<dt>Not read yet</dt><dd>' + unread + '</dd>' : '') + '</dl>'
        + (due.length ? '<p class="w302lede" style="margin:10px 0 0">Missing: ' + E(due.map(function (x) { return MONTHS[x.m - 1]; }).join(', ')) + '.</p>' : '') + '</section>';
    }).join('');
    var pend = S.docs.filter(function (d) { return d.suggestion_state === 'pending' || d.suggestion_state === 'approved' || d.suggestion_state === 'failed'; });
    var G = [
      ['names', 'Clearer names', 'The date, who and how much in the name, so each folder sorts itself.', pend.filter(function (d) { return d.source === 'drive' && d.suggested_name && !d.suggested_folder_name; })],
      ['moves', 'Moves', 'Files sitting in the wrong year or folder.', pend.filter(function (d) { return d.source === 'drive' && d.suggested_folder_name; })],
      ['emails', 'Email bills to save', 'Bills that came by email, saved as PDFs into the year’s BILLS folder so Drive has every one.', pend.filter(function (d) { return d.source === 'email'; })]
    ];
    var groups = G.map(function (g) {
      if (!g[3].length) return '';
      var open = g[3].filter(function (d) { return d.suggestion_state === 'pending' || d.suggestion_state === 'failed'; });
      return '<section class="w302card"><div class="w302hl"><h3 class="w302h" style="margin:0">' + E(g[1]) + ' <span class="n">' + g[3].length + '</span></h3>' + (open.length > 1 ? '<button type="button" class="w302b" data-w302all="' + g[0] + '">Approve all ' + open.length + '</button>' : '') + '</div><p class="w302lede" style="margin:4px 0 4px">' + E(g[2]) + '</p>'
        + g[3].map(fileRow).join('') + '</section>';
    }).join('');
    var skipped = S.docs.filter(function (d) { return d.suggestion_state === 'dismissed'; });
    var r = (S.runs || [])[0];
    var runLine = S.running ? '<span class="w302busy">Checking the Accounting drive. This takes a minute or two.</span>' : r ? '<span class="w302lede" style="margin:0">Last check ' + E(D(String(r.finished_at || r.started_at).slice(0, 10))) + ' (' + E(r.caller === 'automation' ? 'on schedule' : whoSaid(r.caller)) + ')' + (r.error ? ': it stopped early' : '') + '. Next on the ' + (new Date().getDate() < 15 ? '15th' : '1st') + '.</span>' : '';
    box.innerHTML = '<div class="w302hl" style="margin-bottom:12px">' + runLine + '<button type="button" class="w302b" data-w302check="1"' + (S.running ? ' disabled' : '') + '>' + I('drive') + 'Check Drive now</button></div>'
      + '<div class="w302health">' + health + '</div>'
      + (groups || '<div class="w302card w302empty">' + I('check') + '<b>Drive is tidy</b>Nothing waiting for a yes. New proposals show here after each check.</div>')
      + (skipped.length ? '<details class="w302card"><summary style="cursor:pointer;font-weight:700;color:' + GREEN + '">Skipped (' + skipped.length + ')</summary>' + skipped.map(fileRow).join('') + '</details>' : '');
  }
  function fileRow(d) {
    var st = d.suggestion_state, why = /^\s*\{/.test(d.suggestion_note || '') ? '' : String(d.suggestion_note || '').replace(/\s*Failed:.*$/, '');
    var fail = st === 'failed' ? (String(d.suggestion_note || '').match(/Failed:\s*(.*)$/) || [])[1] : '';
    var acts = st === 'approved' ? '<span class="w302busy">' + (S.applying ? 'Saving in Drive…' : 'Approved, saving in a moment…') + '</span>'
      : st === 'dismissed' ? '<button type="button" class="w302b ghost" data-w302act="undismiss" data-id="' + d.id + '">' + I('undo') + 'Put back</button>'
      : '<button type="button" class="w302b pri" data-w302act="approve" data-id="' + d.id + '">' + I('check') + (st === 'failed' ? 'Try again' : 'Approve') + '</button><button type="button" class="w302b ghost" data-w302act="dismiss" data-id="' + d.id + '">Skip</button>' + (d.url ? '<a class="w302b ghost" href="' + E(d.url) + '" target="_blank" rel="noopener">Open</a>' : '');
    return '<div class="w302file" data-w302doc="' + d.id + '">'
      + (d.suggested_name ? '<span class="old" data-w198skip>' + E(d.name) + '</span><span class="new" data-w198skip>' + E(d.suggested_name) + '</span>' : '<span class="new" data-w198skip>' + E(d.name) + '</span>')
      + (d.suggested_folder_name ? '<span class="where">' + I('folder') + E(d.suggested_folder_name) + '</span>' : '')
      + (why ? '<p class="why">' + E(why) + '</p>' : '') + (fail ? '<p class="why" style="color:' + FLAG + '">It did not work last time: ' + E(fail) + '</p>' : '')
      + '<div class="acts">' + acts + '</div></div>';
  }
  function invokeDrive(action) {
    return db.functions.invoke('finance-drive', { body: { action: action } }).then(function (r) { if (r.error) throw r.error; return r.data || {}; });
  }
  function schedApply() {
    clearTimeout(S.applyT);
    S.applyT = setTimeout(function () {
      if (S.applying) { schedApply(); return; }
      S.applying = true; paint();
      invokeDrive('apply').then(function (r) {
        var a = (r && r.apply) || {}; S.applying = false;
        say(a.failed && a.failed.length ? (a.applied || 0) + ' done in Drive; ' + a.failed.length + ' did not work (see Files).' : 'Done in Drive: ' + (a.applied || 0) + (a.applied === 1 ? ' file.' : ' files.'));
        return load(true).then(paint);
      }, function () { S.applying = false; say('Drive did not answer. The approvals are kept; they are carried out at the next check.'); load(true).then(paint); });
    }, 1400);
  }
  function approveAll(key) {
    var pend = S.docs.filter(function (d) { return d.suggestion_state === 'pending' || d.suggestion_state === 'failed'; });
    var list = pend.filter(function (d) { return key === 'emails' ? d.source === 'email' : key === 'moves' ? d.source === 'drive' && d.suggested_folder_name : d.source === 'drive' && d.suggested_name && !d.suggested_folder_name; });
    var chain = Promise.resolve(), n = 0;
    list.forEach(function (d) { chain = chain.then(function () { return q(db.rpc('finance_doc_act', { p_id: d.id, p_action: 'approve' })).then(function (r) { if (!r.error) { n++; d.suggestion_state = 'approved'; } }); }); });
    chain.then(function () { say('Approved ' + n + '. Saving in Drive.'); paint(); schedApply(); });
  }
  function checkNow() {
    if (S.running) return;
    S.running = true; paint();
    invokeDrive('run').then(function (r) {
      S.running = false;
      var sc = (r && r.scan) || {}, add = sc.added || {}, nNew = Object.keys(add).reduce(function (s, k) { return s + add[k]; }, 0);
      var st = (r && r.statements) || {}, imp = (st.imported || []).length;
      say('Drive checked: ' + (nNew ? nNew + ' new file' + (nNew === 1 ? '' : 's') : 'nothing new') + (imp ? ', ' + imp + ' statement' + (imp === 1 ? '' : 's') + ' brought in' : '') + '.');
      return load(true).then(function () { try { if (imp && typeof waFinLoad === 'function') return waFinLoad(true).then(function () { waFinRender(); }); } catch (e) { /* fine */ } paint(); });
    }, function (e) { S.running = false; say('The check did not finish: ' + errText(e)); paint(); });
  }
  function qboStart() {
    db.functions.invoke('qbo-connect', { body: { action: 'start' } }).then(function (r) {
      var u = r && r.data && r.data.url;
      if (!u) { say('QuickBooks is not ready to connect yet.'); return; }
      var w = window.open(u, '_blank', 'noopener'); if (!w) location.assign(u);
      say('QuickBooks opened in a new tab. Come back here when it says connected.');
    }, function () { say('QuickBooks is not ready to connect yet.'); });
  }

  /* ---------- one listener for every button in the four sections ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-w302go],[data-w302act],[data-w302tab],[data-w302later],[data-w302all1],[data-w302pick],[data-w302use],[data-w302mail],[data-w302fy],[data-w302bm],[data-w302month],[data-w302ok],[data-w302by],[data-w302copy],[data-w302all],[data-w302check],[data-w302qbo]') : null;
    if (!t || !panel() || !panel().contains(t)) return;
    var A = function (k) { return t.getAttribute(k); };
    if (A('data-w302go')) { var g = A('data-w302go').split(':'); go(g[0], g[1]); return; }
    if (A('data-w302act')) { t.disabled = true; act(Number(A('data-id')), A('data-w302act'), null, A('data-note')); return; }
    if (A('data-w302tab')) { S.tab = A('data-w302tab'); paint(); return; }
    if (A('data-w302later')) { S.later[Number(A('data-w302later'))] = 1; paint(); return; }
    if (A('data-w302all1')) { S.all = true; paint(); return; }
    if (A('data-w302pick')) { pickFor(Number(A('data-w302pick'))); return; }
    if (A('data-w302use')) { act(Number(A('data-id')), 'confirm', Number(A('data-w302use'))); return; }
    if (A('data-w302mail')) { mailFor(Number(A('data-w302mail'))); return; }
    if (A('data-w302fy')) { S.bankFy = Number(A('data-w302fy')); S.bankMonth = null; paint(); return; }
    if (A('data-w302bm')) { if (t.classList.contains('future')) return; S.bankMonth = A('data-w302bm'); paint(); return; }
    if (A('data-w302month')) { go('bank', A('data-w302month')); return; }
    if (A('data-w302ok')) { var id = Number(A('data-w302ok')); saveLine(id, {}, 'Confirmed: the team and category stay as they are.'); return; }
    if (A('data-w302by')) { S.budBy = A('data-w302by'); paint(); return; }
    if (A('data-w302copy')) { t.disabled = true; copyBudget(); return; }
    if (A('data-w302all')) { t.disabled = true; approveAll(A('data-w302all')); return; }
    if (A('data-w302check')) { checkNow(); return; }
    if (A('data-w302qbo')) { qboStart(); return; }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || !panel() || !panel().contains(t)) return;
    if (t.getAttribute('data-w302team')) saveLine(Number(t.getAttribute('data-w302team')), { department: t.value }, 'Moved to ' + teamLabel(t.value) + '.');
    else if (t.getAttribute('data-w302cat')) saveLine(Number(t.getAttribute('data-w302cat')), { category: t.value }, 'Category saved.');
  });

  /* ---------- wiring ---------- */
  var FIRST = 'wa302.first';
  function after() {
    if (!mount()) return;
    var c = cur();
    try { if (!localStorage.getItem(FIRST)) { localStorage.setItem(FIRST, '1'); if (c === 'overview' || !c) { window.w94Show && window.w94Show('today'); return; } } } catch (e) { /* fine */ }
    if (MINE.indexOf(c) >= 0) window.w94Show && window.w94Show(c);
    else paint();
  }
  if (typeof waFinRender === 'function') {
    var __fr302 = waFinRender;
    waFinRender = function () {
      var r = __fr302.apply(this, arguments);
      try { after(); } catch (e) { /* the older page still works */ }
      return r;
    };
  }
  document.addEventListener('wa94show', function (ev) {
    var id = ev && ev.detail && ev.detail.id;
    try {
      if (S.dirty && MINE.indexOf(id) < 0 && id !== 'budget' && typeof waFinRender === 'function') { S.dirty = false; setTimeout(function () { waFinRender(); }, 0); return; }
      load(false).then(paint); paint();
    } catch (e) { /* fine */ }
  });
  if (typeof showPanel === 'function') {
    var __sp302 = showPanel;
    showPanel = function (id) {
      var r = __sp302.apply(this, arguments);
      try { if (id === 'finances') { load(false).then(paint); } } catch (e) { /* fine */ }
      return r;
    };
  }
  window.w302 = { counts: function () { return S.at ? counts() : null; }, state: function () { return S; }, paint: paint, load: load, go: go, staffOnly: STAFF_ONLY };
})();
