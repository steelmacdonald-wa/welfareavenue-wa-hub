/* =====================================================================
   WA v170 Your inbox: the assistant for your own mailbox (30/09/26)
   =====================================================================
   Steel (29/09/26): "review my steel.macdonald@welfareavenue.com emails as well and to start categorizing them in to my
   different folders, sending them to the necessary teams, and helping me draft replies in a reply tool that asks me questions
   to clarify how to respond to individuals the emailed me. It needs to use steel-voice and wa-writing to make sure replies
   sound like me. This is a tool I'd like to roll out to others later".
   His choices: it files mail into his own Gmail labels by itself (every 15 minutes, a switch here); the rest waits for him;
   replies are Gmail drafts he sends himself; owner only; personal mail is left alone; an email he sends to a
   team lands in the team's Hub inbox (and their Slack channel).

   Where: a card on Home for people whose mailbox the assistant works on (mybox_owners, their own row), and the assistant
   itself, full screen (#mypage/inbox): To reply (the reply tool: the email and its thread, "Help me reply" asks what it needs
   to know, drafts the reply in his voice, saves it as a Gmail draft), For a team (the team and the one-line ask, sent to the
   team's Hub inbox), Sorted (what went in which folder, undo), Settings (the schedule, notes per folder, folders whose mail
   also leaves the inbox, the never-read list).
   Data: mybox_owners and mybox_mail (read here, own rows only); everything else through the mybox function.
   ===================================================================== */
(function () {
  if (window.__wa170) return; window.__wa170 = true;
  var GREEN = '#103F39', GOLD = '#DCA527', MUTED = '#797773', FLAG = '#B3402F', TEAL = '#2A8C7A', LINE = '#E7E2D6', CREAM = '#FFFAF2', PURPLE = '#6F64AB', INK = '#1F201E', SAND = '#F4F2EA';
  var HEAD = '"Barlow Condensed", "Arial Narrow", sans-serif';
  var TEAMS = { opsmtl: 'Operations Montreal', progdev: 'Program Development', opsto: 'Operations Toronto', marketing: 'Marketing', fundraising: 'Fundraising', finance: 'Finance', hr: 'Human Resources', board: 'Board & Governance' };
  var TEAM_ORDER = ['opsmtl', 'opsto', 'progdev', 'marketing', 'fundraising', 'finance', 'hr', 'board'];
  var REPLY_P = 0.55;
  var S = { owner: null, ownerAt: 0, ownerP: null, rows: null, rowsAt: 0, rowsP: null, skipped: 0, errors: 0, open: false, tab: 'reply', sel: null, D: {}, showDone: false, poll: null, sortedAt: null, busy: {}, set: null };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function lower(s) { return String(s == null ? '' : s).toLowerCase(); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function initials(n, em) { var s = String(n || em || '?').replace(/[<>"]/g, '').trim(); var p = s.split(/[\s@._-]+/).filter(Boolean); return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  function ago(iso) {
    if (!iso) return '';
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
    var d = Math.round(s / 86400); if (d < 7) return d === 1 ? 'yesterday' : d + ' days ago';
    try { return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }); } catch (e) { return String(iso).slice(0, 10); }
  }
  function when(iso) { try { return new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }); } catch (e) { return String(iso || '').slice(0, 16); } }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function dayOf(iso) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch (e) { return String(iso || '').slice(0, 10); } }
  function phone() { return window.matchMedia ? window.matchMedia('(max-width: 760px)').matches : window.innerWidth <= 760; }
  function gmailUrl(owner, row) { return 'https://mail.google.com/mail/u/' + encodeURIComponent(owner) + '/#all/' + encodeURIComponent(row.thread_id || row.gmail_id); }
  function labelShort(n) { var p = String(n || '').split('/'); return p[p.length - 1]; }

  var CSS = ''
    /* the card on Home */
    + '#w170card{margin:12px 0;}'
    + '#w170card h3{display:flex;align-items:center;gap:8px;}'
    + '#w170card .sub{margin:0 0 10px;font-size:12.5px;color:#4a5551;}'
    + '#w170card .w170tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}'
    + '#w170card .w170tiles button{border:1px solid ' + LINE + ';background:' + CREAM + ';border-radius:14px;padding:12px 14px;text-align:left;cursor:pointer;font:inherit;color:' + INK + ';}'
    + '#w170card .w170tiles button:hover{border-color:rgba(16,63,57,.4);}'
    + '#w170card .w170tiles b{display:block;font-family:' + HEAD + ';font-size:30px;line-height:1;color:' + GREEN + ';}'
    + '#w170card .w170tiles button.hot b{color:#8a6512;}#w170card .w170tiles span{font-size:12px;color:' + MUTED + ';}'
    + '#w170card .w170foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:10px;font-size:12px;color:' + MUTED + ';}'
    + '.w170btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;background:' + GREEN + ';color:' + CREAM + ' !important;font:inherit;font-size:13px;font-weight:700;padding:8px 16px;cursor:pointer;text-decoration:none !important;white-space:nowrap;}'
    + '.w170btn:hover{background:#0b2f2a;}.w170btn[disabled]{opacity:.55;cursor:default;}'
    + '.w170btn.gold{background:' + GOLD + ';color:' + GREEN + ' !important;}.w170btn.gold:hover{background:#c9951f;}'
    + '.w170btn.ghost{background:transparent;color:' + GREEN + ' !important;border:1px solid rgba(16,63,57,.35);}.w170btn.ghost:hover{background:rgba(16,63,57,.07);}'
    + '.w170btn.sm{font-size:12px;padding:6px 12px;}'
    + '.w170lnk{border:0;background:none;padding:0;font:inherit;color:' + GREEN + ';font-weight:700;text-decoration:underline;cursor:pointer;}'
    /* the assistant, full screen */
    + '#w170sheet{position:fixed;inset:0;z-index:2147470000;display:none;}'
    + '#w170sheet.on{display:block;}'
    + '#w170sheet .w170bk{position:absolute;inset:0;background:rgba(16,63,57,.45);}'
    + '#w170sheet .w170sh{position:absolute;inset:18px;background:' + CREAM + ';border-radius:22px;box-shadow:0 30px 80px -30px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden;}'
    + '#w170sheet .w170hd{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:14px 18px;border-bottom:1px solid ' + LINE + ';background:' + CREAM + ';}'
    + '#w170sheet .w170hd .ti .k{display:block;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + GOLD + ';}'
    + '#w170sheet .w170hd h2{margin:0;font-family:' + HEAD + ';font-size:28px;font-weight:700;text-transform:uppercase;color:' + GREEN + ';line-height:1;}'
    + '#w170sheet .w170tabs{display:flex;gap:6px;flex-wrap:wrap;padding:4px;background:rgba(16,63,57,.06);border-radius:999px;}'
    + '#w170sheet .w170tabs button{border:0;background:transparent;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;color:' + GREEN + ';cursor:pointer;}'
    + '#w170sheet .w170tabs button.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#w170sheet .w170tabs .n{display:inline-block;margin-left:6px;font-size:11px;font-weight:800;background:' + GOLD + ';color:' + GREEN + ';border-radius:999px;padding:0 7px;}'
    + '#w170sheet .w170hd .sp{flex:1;}#w170sheet .w170hd .st{font-size:12px;color:' + MUTED + ';}'
    + '#w170sheet .w170xb{border:0;background:rgba(16,63,57,.08);color:' + GREEN + ';width:38px;height:38px;border-radius:50%;font-size:22px;line-height:38px;cursor:pointer;}'
    + '#w170sheet .w170bd{flex:1;display:grid;grid-template-columns:minmax(300px,380px) 1fr;min-height:0;}'
    + '#w170sheet .w170list{border-right:1px solid ' + LINE + ';overflow-y:auto;padding:10px;background:' + SAND + ';}'
    + '#w170sheet .w170main{overflow-y:auto;padding:20px 26px 40px;min-width:0;}'
    + '#w170sheet .w170main.full{grid-column:1 / -1;}'
    + '#w170sheet .w170it{display:flex;gap:10px;width:100%;text-align:left;border:1px solid transparent;background:' + CREAM + ';border-radius:14px;padding:10px 12px;margin:0 0 8px;cursor:pointer;font:inherit;color:' + INK + ';}'
    + '#w170sheet .w170it:hover{border-color:rgba(16,63,57,.25);}#w170sheet .w170it.on{border-color:' + GREEN + ';box-shadow:0 0 0 1px ' + GREEN + ';}'
    + '#w170sheet .w170it.dim{opacity:.62;}'
    + '#w170sheet .w170av{flex:0 0 34px;height:34px;border-radius:50%;background:' + GREEN + ';color:' + CREAM + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;}'
    + '#w170sheet .w170it .tx{flex:1;min-width:0;}#w170sheet .w170it b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '#w170sheet .w170it .s{display:block;font-size:12.5px;color:#3d3c39;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '#w170sheet .w170it .m{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px;font-size:11.5px;color:' + MUTED + ';}'
    + '.w170chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;background:rgba(16,63,57,.08);color:' + GREEN + ';white-space:nowrap;}'
    + '.w170chip.team{background:rgba(111,100,171,.14);color:' + PURPLE + ';}.w170chip.gold{background:rgba(220,165,39,.22);color:#6b4d0e;}.w170chip.flag{background:rgba(179,64,47,.12);color:' + FLAG + ';}'
    + '#w170sheet .w170empty{padding:30px 20px;text-align:center;color:' + MUTED + ';font-size:13.5px;}'
    + '#w170sheet .w170empty b{display:block;font-family:' + HEAD + ';font-size:22px;text-transform:uppercase;color:' + GREEN + ';margin-bottom:4px;}'
    /* the email */
    + '#w170sheet .w170mh h3{margin:0 0 6px;font-size:20px;line-height:1.25;color:' + INK + ';}'
    + '#w170sheet .w170mh .meta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:12.5px;color:' + MUTED + ';}'
    + '#w170sheet .w170mh .meta b{color:' + INK + ';}'
    + '#w170sheet .w170back{display:none;}'
    + '#w170sheet .w170mail{margin:14px 0 0;padding:14px 16px;border-radius:14px;background:rgba(16,63,57,.035);border:1px solid ' + LINE + ';font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;color:#2b2b28;max-height:420px;overflow-y:auto;}'
    + '#w170sheet .w170hist{margin:10px 0 0;}#w170sheet .w170hist summary{cursor:pointer;font-size:12.5px;font-weight:700;color:' + GREEN + ';}'
    + '#w170sheet .w170hist .h{margin:8px 0 0;padding:10px 12px;border-radius:12px;background:rgba(16,63,57,.04);font-size:12.5px;white-space:pre-wrap;color:#3d3c39;}'
    + '#w170sheet .w170hist .h i{display:block;font-style:normal;font-weight:700;color:' + GREEN + ';margin-bottom:4px;}'
    /* the reply tool */
    + '#w170sheet .w170tool{margin:18px 0 0;padding:16px 18px;border-radius:18px;background:' + SAND + ';border:1px solid ' + LINE + ';}'
    + '#w170sheet .w170tool h4{margin:0 0 6px;font-family:' + HEAD + ';font-size:20px;text-transform:uppercase;color:' + GREEN + ';letter-spacing:.3px;}'
    + '#w170sheet .w170tool .gist{font-size:13.5px;color:#2b2b28;margin:0 0 12px;}#w170sheet .w170tool .gist b{color:' + GREEN + ';}'
    + '#w170sheet .w170q{margin:0 0 14px;}#w170sheet .w170q .qq{font-weight:700;font-size:13.5px;color:' + INK + ';margin:0 0 6px;}'
    + '#w170sheet .w170opts{display:flex;flex-wrap:wrap;gap:6px;}'
    + '#w170sheet .w170opts button{border:1px solid rgba(16,63,57,.3);background:' + CREAM + ';color:' + GREEN + ';border-radius:999px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;}'
    + '#w170sheet .w170opts button.on{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}'
    + '#w170sheet .w170tool input[type=text],#w170sheet .w170tool textarea,#w170sheet .w170set input[type=text],#w170sheet .w170set textarea,#w170sheet .w170tool select,#w170sheet .w170set select{width:100%;box-sizing:border-box;border:1px solid #DEE0D8;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;background:' + CREAM + ';color:' + INK + ';}'
    + '#w170sheet .w170tool input[type=text]{margin-top:6px;}'
    + '#w170sheet .w170draft{min-height:260px;line-height:1.55;font-size:14px !important;}'
    + '#w170sheet .w170acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;}'
    + '#w170sheet .w170notes{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:rgba(220,165,39,.14);font-size:12.5px;color:#6b4d0e;}'
    + '#w170sheet .w170notes ul{margin:4px 0 0 18px;padding:0;}'
    + '#w170sheet .w170wait{display:flex;gap:10px;align-items:center;font-size:13.5px;color:' + GREEN + ';font-weight:600;}'
    + '#w170sheet .w170wait i{width:18px;height:18px;border-radius:50%;border:3px solid rgba(16,63,57,.2);border-top-color:' + GREEN + ';animation:w170spin 1s linear infinite;}'
    + '@keyframes w170spin{to{transform:rotate(360deg);}}'
    + '#w170sheet .w170ok{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:rgba(42,140,122,.12);color:' + GREEN + ';font-size:13.5px;}'
    + '#w170sheet .w170err{color:' + FLAG + ';font-size:12.5px;font-weight:600;margin:8px 0 0;}'
    + '#w170sheet label.w170l{display:block;font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:' + GREEN + ';margin:12px 0 4px;}'
    + '#w170sheet label.w170l .op{font-weight:500;letter-spacing:0;text-transform:none;color:' + MUTED + ';margin-left:6px;}'
    + '#w170sheet .w170ck{display:flex;gap:8px;align-items:center;font-size:13px;color:' + INK + ';margin:8px 0 0;}'
    + '#w170sheet .w170ck input{accent-color:' + GREEN + ';}'
    /* sorted and settings */
    + '#w170sheet .w170day{font-size:11px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:' + MUTED + ';margin:16px 0 6px;}'
    + '#w170sheet .w170row{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;padding:9px 12px;border-radius:12px;background:' + CREAM + ';border:1px solid ' + LINE + ';margin:0 0 6px;font-size:13px;}'
    + '#w170sheet .w170row .who{flex:1;min-width:180px;}#w170sheet .w170row .who b{display:block;font-size:13px;}#w170sheet .w170row .who span{font-size:12px;color:' + MUTED + ';}'
    + '#w170sheet .w170sum{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 6px;}'
    + '#w170sheet .w170set{max-width:760px;}#w170sheet .w170set h4{margin:22px 0 6px;font-family:' + HEAD + ';font-size:20px;text-transform:uppercase;color:' + GREEN + ';}'
    + '#w170sheet .w170set p{font-size:13px;color:#3d3c39;margin:4px 0;}'
    + '#w170sheet .w170lab{display:grid;grid-template-columns:minmax(140px,220px) 1fr auto;gap:8px 12px;align-items:center;padding:8px 0;border-bottom:1px solid ' + LINE + ';font-size:13px;}'
    + '#w170sheet .w170lab b{font-size:13px;color:' + INK + ';word-break:break-word;}'
    + '#w170sheet .w170lab label{display:flex;gap:6px;align-items:center;font-size:12px;color:' + MUTED + ';white-space:nowrap;}'
    + '#w170sheet .w170sw{position:relative;display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:' + INK + ';cursor:pointer;}'
    + '#w170sheet .w170sw input{width:42px;height:24px;accent-color:' + GREEN + ';}'
    + '@media (max-width:760px){'
    +   '#w170sheet .w170sh{inset:0;border-radius:0;}'
    +   '#w170sheet .w170hd{padding:12px 14px;}#w170sheet .w170hd h2{font-size:24px;}#w170sheet .w170hd .st{display:none;}'
    +   '#w170sheet .w170tabs{order:5;width:100%;overflow-x:auto;flex-wrap:nowrap;gap:2px;box-sizing:border-box;}#w170sheet .w170tabs button{white-space:nowrap;padding:7px 9px;font-size:12.5px;}#w170sheet .w170tabs .n{margin-left:4px;padding:0 6px;}'
    +   '#w170sheet .w170bd{grid-template-columns:1fr;}'
    +   '#w170sheet .w170list{border-right:0;}'
    +   '#w170sheet.sel .w170list{display:none;}#w170sheet:not(.sel) .w170main:not(.full){display:none;}'
    +   '#w170sheet .w170main{padding:14px 14px 90px;}'
    +   '#w170sheet .w170back{display:inline-flex;margin:0 0 10px;}'
    +   '#w170sheet .w170lab{grid-template-columns:1fr;}'
    +   '#w170card .w170tiles b{font-size:26px;}'
    + '}'
    + 'html.w170lock,html.w170lock body{overflow:hidden !important;}';
  if (!document.getElementById('wa170css')) { var st = document.createElement('style'); st.id = 'wa170css'; st.textContent = CSS; document.head.appendChild(st); }

