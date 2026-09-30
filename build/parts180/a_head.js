/* =====================================================================
   WA v180 Announcements that lead to a poll or a short form (30/09/26)
   =====================================================================
   Steel (29/09/26): "I'd also like for leaders to be able ot make announcements that lead to forms or polls that our team can
   answer." His answers (30/09/26): the top of Home plus one Slack post (the team's channel, #general for everyone, #leaders
   for the leaders); polls (one or several choices, named or anonymous) and short forms (up to 8 questions) answered inside
   the Hub, the poster sees the results and who has not answered; leaders post to their own team or everyone, HR and admins
   to anyone. Numbered 180: another session ships wave171 onwards tonight.

   Where: a card at the top of Home (#w180card) with the announcements for this person: a poll answered with a tap, a short
   form in a window, the totals once answered (when the poster allows), and for the poster, leaders, HR and admins "See the
   answers" (the totals, who chose what unless anonymous, the text answers, who has not answered, a CSV). "Post an
   announcement" (leaders, HR, admins; also from What's new on the Executive dashboard) writes it: who it is for, the poll or
   the form, anonymous, the totals, when answers close, pinned, when it comes down, and the one Slack post.
   #announce/<id> (the Slack post's link) opens one on Home; #announce/all opens them all.
   wave180d (30/09/26), Steel: "Actually last question it should be emailed as well": each one is also emailed once to the
   people it is for, from hub@welfareavenue.com with replies to the poster ("Email it to them too", on by default); the link
   in the email opens it on Home, through the sign-in when needed. The poster, leaders, HR and admins see where it went.
   Data: hub_announcements (row security: the people it is for, the poster, leaders, HR, admins), hub_announcement_answers
   (own rows), wa180_answer and wa180_results; team-inbox posts the Slack message and sends the email (event announcement).
   ===================================================================== */
(function () {
  if (window.__wa180) return; window.__wa180 = true;
  var GREEN = '#103F39', GOLD = '#DCA527', MUTED = '#797773', FLAG = '#B3402F', TEAL = '#2A8C7A', LINE = '#E7E2D6', CREAM = '#FFFAF2', PURPLE = '#6F64AB', INK = '#1F201E', SAND = '#F4F2EA';
  var HEAD = '"Barlow Condensed", "Arial Narrow", sans-serif';
  var ALL_TEAMS = ['opsmtl', 'opsto', 'progdev', 'marketing', 'fundraising', 'finance', 'hr', 'exec', 'board'];
  var QTYPES = [['short', 'Short answer'], ['long', 'Paragraph'], ['one', 'One choice'], ['several', 'Several choices'], ['yesno', 'Yes or no'], ['date', 'Date'], ['number', 'Number']];
  var S = { list: null, listAt: 0, listP: null, mine: {}, res: {}, sel: {}, busy: {}, draft: null, errs: {}, just: {} };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function lower(s) { return String(s == null ? '' : s).toLowerCase(); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function initials(n) { var p = String(n || '?').trim().split(/[\s@._-]+/).filter(Boolean); return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  function ago(iso) {
    if (!iso) return '';
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
    var d = Math.round(s / 86400); if (d < 7) return d === 1 ? 'yesterday' : d + ' days ago';
    return dayLabel(iso);
  }
  function dayLabel(iso) { try { return new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? 'UTC' : 'America/Toronto' }); } catch (e) { return String(iso || '').slice(0, 10); } }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function plusDays(n) { var d = new Date(todayIso() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function phone() { return window.matchMedia ? window.matchMedia('(max-width: 760px)').matches : window.innerWidth <= 760; }

  var CSS = ''
    /* the card on Home */
    + '#w180card{margin:12px 0;}'
    + '#w180card .w180hd{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 10px;}'
    + '#w180card .w180hd h3{margin:0;}#w180card .w180hd .sp{flex:1;}'
    + '#w180card .w180cnt{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;background:' + GOLD + ';color:' + GREEN + ';border-radius:999px;padding:2px 9px;}'
    + '.w180btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;background:' + GREEN + ';color:' + CREAM + ' !important;font:inherit;font-size:13px;font-weight:700;padding:8px 16px;cursor:pointer;text-decoration:none !important;white-space:nowrap;}'
    + '.w180btn:hover{background:#0b2f2a;}.w180btn[disabled]{opacity:.55;cursor:default;}'
    + '.w180btn.gold{background:' + GOLD + ';color:' + GREEN + ' !important;}.w180btn.gold:hover{background:#c9951f;}'
    + '.w180btn.ghost{background:transparent;color:' + GREEN + ' !important;border:1px solid rgba(16,63,57,.35);}.w180btn.ghost:hover{background:rgba(16,63,57,.07);}'
    + '.w180btn.sm{font-size:12px;padding:6px 12px;}'
    + '.w180lnk{border:0;background:none;padding:0;font:inherit;color:' + GREEN + ';font-weight:700;text-decoration:underline;cursor:pointer;}'
    + '.w180it{position:relative;background:' + CREAM + ';border:1px solid ' + LINE + ';border-radius:16px;padding:14px 16px;margin:0 0 10px;}'
    + '.w180it.pin{border-color:rgba(220,165,39,.7);box-shadow:inset 4px 0 0 ' + GOLD + ';}'
    + '.w180it .top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:12px;color:' + MUTED + ';}'
    + '.w180av{flex:0 0 26px;width:26px;height:26px;border-radius:50%;background:' + GREEN + ';color:' + CREAM + ';display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;}'
    + '.w180it .who{display:inline-flex;align-items:center;gap:8px;}.w180it .who b{color:' + INK + ';font-size:12.5px;}'
    + '.w180it h4{margin:8px 0 4px;font-size:16.5px;line-height:1.3;color:' + INK + ';}'
    + '.w180it .body{margin:0 0 8px;font-size:13.5px;line-height:1.5;color:#2b2b28;white-space:pre-wrap;word-wrap:break-word;}'
    + '.w180chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;background:rgba(16,63,57,.08);color:' + GREEN + ';white-space:nowrap;}'
    + '.w180chip.gold{background:rgba(220,165,39,.22);color:#6b4d0e;}.w180chip.purple{background:rgba(111,100,171,.14);color:' + PURPLE + ';}.w180chip.flag{background:rgba(179,64,47,.12);color:' + FLAG + ';}.w180chip.teal{background:rgba(42,140,122,.14);color:' + GREEN + ';}'
    + '.w180q{font-weight:700;font-size:14px;color:' + GREEN + ';margin:8px 0 8px;}'
    + '.w180opts{display:flex;flex-wrap:wrap;gap:8px;}'
    + '.w180opt{border:1.5px solid rgba(16,63,57,.3);background:' + CREAM + ';color:' + GREEN + ';border-radius:999px;padding:8px 16px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;}'
    + '.w180opt:hover{border-color:' + GREEN + ';}.w180opt.on{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}.w180opt[disabled]{opacity:.6;cursor:default;}'
    + '.w180acts{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:10px;}'
    + '.w180bars{margin:8px 0 0;}'
    + '.w180bar{margin:0 0 8px;}.w180bar .l{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:' + INK + ';margin:0 0 3px;}.w180bar .l b{color:' + GREEN + ';}'
    + '.w180bar .t{height:10px;border-radius:999px;background:rgba(16,63,57,.08);overflow:hidden;}.w180bar .t i{display:block;height:100%;border-radius:999px;background:' + TEAL + ';}'
    + '.w180bar.me .t i{background:' + GOLD + ';}.w180bar .n{font-size:11.5px;color:' + MUTED + ';margin-top:3px;}'
    + '.w180done{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.5px;color:' + GREEN + ';font-weight:600;margin-top:8px;}'
    + '.w180err{color:' + FLAG + ';font-size:12.5px;font-weight:600;margin:8px 0 0;}'
    + '#w180card .w180more{text-align:center;margin:4px 0 0;}'
    + '#w180card .w180empty{padding:12px 14px;border:1px dashed rgba(16,63,57,.25);border-radius:14px;font-size:13px;color:' + MUTED + ';display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;}'
    /* the windows (answer, results, all, post) */
    + '#modalBox.w180wide{max-width:760px;}'
    + '#modalBox .w180m h3{margin:0 0 4px;font-family:' + HEAD + ';font-size:26px;text-transform:uppercase;color:' + GREEN + ';line-height:1.05;}'
    + '#modalBox .w180m .sub{font-size:12.5px;color:' + MUTED + ';margin:0 0 12px;}'
    + '#modalBox .w180f label.l{display:block;font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:' + GREEN + ';margin:14px 0 5px;}'
    + '#modalBox .w180f label.l .op{font-weight:500;letter-spacing:0;text-transform:none;color:' + MUTED + ';margin-left:6px;}'
    + '#modalBox .w180f label.l .req{color:' + FLAG + ';margin-left:3px;}'
    + '#modalBox .w180f input[type=text],#modalBox .w180f input[type=date],#modalBox .w180f input[type=number],#modalBox .w180f textarea,#modalBox .w180f select{width:100%;box-sizing:border-box;border:1px solid #DEE0D8;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;background:' + CREAM + ';color:' + INK + ';}'
    + '#modalBox .w180f textarea{min-height:64px;resize:vertical;}'
    + '#modalBox .w180seg{display:flex;flex-wrap:wrap;gap:6px;}'
    + '#modalBox .w180seg button{border:1px solid rgba(16,63,57,.3);background:' + CREAM + ';color:' + GREEN + ';border-radius:999px;padding:6px 13px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;}'
    + '#modalBox .w180seg button.on{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}#modalBox .w180seg button[disabled]{opacity:.45;cursor:default;}'
    + '#modalBox .w180ck{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:' + INK + ';margin:8px 0 0;line-height:1.35;}#modalBox .w180ck input{accent-color:' + GREEN + ';margin-top:2px;}'
    + '#modalBox .w180row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}'
    + '#modalBox .w180ed{margin:10px 0 0;padding:12px;border-radius:14px;background:' + SAND + ';border:1px solid ' + LINE + ';}'
    + '#modalBox .w180oped{display:flex;gap:6px;align-items:center;margin:0 0 6px;}#modalBox .w180oped input{flex:1;}'
    + '#modalBox .w180x{border:0;background:rgba(16,63,57,.08);color:' + GREEN + ';width:30px;height:30px;flex:0 0 30px;border-radius:50%;font-size:17px;line-height:30px;cursor:pointer;}'
    + '#modalBox .w180qed{padding:10px 12px;border-radius:12px;background:' + CREAM + ';border:1px solid ' + LINE + ';margin:0 0 8px;}'
    + '#modalBox .w180qed .h{display:flex;gap:8px;align-items:center;}#modalBox .w180qed .h input{flex:1;}#modalBox .w180qed .h select{width:auto;flex:0 0 150px;}'
    + '#modalBox .w180foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center;margin-top:18px;}#modalBox .w180foot .sp{flex:1;}'
    + '#modalBox .w180ans{margin:0 0 14px;}#modalBox .w180ans .qq{font-weight:700;font-size:14px;color:' + INK + ';margin:0 0 6px;}'
    + '#modalBox .w180prog{display:flex;align-items:center;gap:10px;margin:4px 0 12px;font-size:13px;color:' + INK + ';}#modalBox .w180prog .t{flex:1;height:10px;border-radius:999px;background:rgba(16,63,57,.08);overflow:hidden;}#modalBox .w180prog .t i{display:block;height:100%;background:' + GREEN + ';}'
    + '#modalBox .w180rq{margin:0 0 16px;padding:0 0 12px;border-bottom:1px solid ' + LINE + ';}#modalBox .w180rq:last-child{border-bottom:0;}'
    + '#modalBox .w180rq h4{margin:0 0 8px;font-size:14px;color:' + INK + ';}'
    + '#modalBox .w180names{font-size:11.5px;color:' + MUTED + ';margin-top:3px;}'
    + '#modalBox .w180sent{font-size:12.5px;color:' + GREEN + ';background:rgba(16,63,57,.05);border-radius:10px;padding:7px 11px;margin:0 0 12px;line-height:1.45;}#modalBox .w180sent.warn{color:#6b4d0e;background:rgba(220,165,39,.16);}'
    + '#modalBox .w180vals{margin:0;padding:0;list-style:none;}#modalBox .w180vals li{padding:7px 10px;border-radius:10px;background:rgba(16,63,57,.04);margin:0 0 5px;font-size:13px;white-space:pre-wrap;word-wrap:break-word;}#modalBox .w180vals li b{display:block;font-size:11.5px;color:' + GREEN + ';}'
    + '#modalBox details.w180miss summary{cursor:pointer;font-size:13px;font-weight:700;color:' + GREEN + ';}#modalBox details.w180miss p{font-size:12.5px;color:' + INK + ';margin:6px 0 0;}'
    + '#modalBox .w180all .w180it{cursor:pointer;}#modalBox .w180all .w180it:hover{border-color:rgba(16,63,57,.35);}'
    + '@media (max-width:760px){#modalBox .w180row{grid-template-columns:1fr;}#modalBox .w180qed .h{flex-wrap:wrap;}#modalBox .w180qed .h select{flex:1 1 100%;}#w180card .w180hd .w180btn{padding:6px 12px;font-size:12px;}.w180opt{padding:8px 13px;}}';
  if (!document.getElementById('wa180css')) { var st = document.createElement('style'); st.id = 'wa180css'; st.textContent = CSS; document.head.appendChild(st); }

