/* =====================================================================
   WA v290 Your servings this year, on Home (06/11/26)
   =====================================================================
   Steel (06/11/26): "I need to build something in the hub where it's essentially on the home page. It's the volunteering
   dates of the year that one has to do before year end. I'm thinking of adding that starting December 1st. Actually, no,
   November 15th is good." His choices the same day: count by the fiscal year (to 30 September), the Montreal team only, a
   thank-you once someone reaches four and then the card leaves, and it sits under the Next serving card ("it should go
   somewhere here").

   Every member volunteers at four servings a year, counted by the fiscal year (wave191p). From 15 November each fiscal year
   (app_config servings_card_from) Home shows a Montreal team member how many they have of the four and the next servings,
   to tick and confirm in one tap. Confirm uses the onboarding's own sign-up, marked as from Home (wa290_home_signup): they
   are Confirmed right away and Operations Montreal gets a Request with the dates; nothing is texted to them. At four of four
   the card says thank you for seven days, then leaves until the next fiscal year. The database decides who sees it and when
   (wa290_home_servings: not Toronto, not the board, not before the start day); the page only draws what it is given.

   #w290srv is the last child of #mpBody, with order 14 in build/parts272/b_home.js: after the Next serving card (wave171,
   also order 14, earlier in the page), before Needs your attention and My tasks. Full width on a computer, one column on a
   phone. Like wave171's card it is drawn after its own fetch and kept in place by renderMyPage and a light check.
   window.w290: paint, state, html. */
(function () {
  'use strict';
  if (window.__wa290) return; window.__wa290 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', PURPLE = '#6F64AB', FLAG = '#A8382A';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var OUT = 'cubic-bezier(.23,1,.32,1)', MUTED = 'rgba(31,32,30,.62)', SURF = 'rgba(16,63,57,.05)', SURF2 = 'rgba(16,63,57,.1)', LINE = 'rgba(16,63,57,.11)';
  var TICK = 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23FFFAF2%27 stroke-width=%272.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27><path d=%27M5 12.5 10 17.5 19 7%27/></svg>")';
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function board() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function onHome() { var h = String(location.hash || ''); return !h || h === '#' || /^#mypage(\/|$)/.test(h); }
  function hm12(s) { var m = String(s || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return ''; var h = Number(m[1]); return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); }
  function day(iso, opts) { try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', Object.assign({ timeZone: 'UTC' }, opts)); } catch (e) { return String(iso || ''); } }
  function fmtDay(iso) { return day(iso, { weekday: 'long', month: 'long', day: 'numeric' }); }
  function fmtMonthDay(iso) { return iso ? day(iso, { month: 'long', day: 'numeric' }) : 'September 30'; }
  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function word(n) { return WORDS[n] || String(n); }
  function Word(n) { var w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); }

  /* data: what wa290_home_servings returned; pick: the servings ticked; done: the last confirmation, shown until the next load */
  var S = { data: null, at: 0, loading: null, busy: false, err: '', pick: {}, role: 'server', done: null };
  var ROLES = [['server', 'Serve'], ['photographer', 'Take photos']];

  var css = ''
    + '#w290srv{background:' + SURF + ';border-radius:18px;padding:16px 18px 14px;box-sizing:border-box;font-family:' + BODY + ';color:' + INK + ';font-size:15.5px;line-height:1.45;}'
    + '#w290srv .k,#w290sheet .k{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + PURPLE + ';}'
    + '#w290srv h3,#w290sheet h3{margin:2px 0 4px;font:500 26px/1.02 ' + HEAD + ';letter-spacing:.01em;text-transform:uppercase;color:' + GREEN + ';}'
    + '#w290srv .bar,#w290sheet .bar{height:8px;border-radius:8px;background:' + SURF2 + ';overflow:hidden;margin:8px 0 10px;max-width:420px;}'
    + '#w290srv .bar i,#w290sheet .bar i{display:block;height:100%;border-radius:8px;background:' + GOLD + ';transition:width 300ms ' + OUT + ';}'
    + '#w290srv p,#w290sheet p{margin:0 0 8px;font-size:14.5px;}'
    + '#w290srv p.sub,#w290sheet p.sub{color:' + MUTED + ';}'
    + '#w290srv .ok,#w290sheet .ok{background:rgba(220,165,39,.2);border-radius:12px;padding:10px 12px;margin:2px 0 10px;font-size:14.5px;color:' + INK + ';outline:0;}'
    + '#w290srv .sl,#w290sheet .sl{margin:2px 0 4px;}'
    + '#w290srv .sv,#w290sheet .sv{display:flex;align-items:center;gap:12px;min-height:48px;padding:6px 0;box-sizing:border-box;border-top:1px solid ' + LINE + ';cursor:pointer;}'
    + '#w290srv .sv:first-child,#w290sheet .sv:first-child{border-top:0;}'
    + '#w290srv .sv input,#w290sheet .sv input{appearance:none;-webkit-appearance:none;width:22px;height:22px;margin:0;flex:none;border-radius:50%;box-shadow:inset 0 0 0 1.75px rgba(31,32,30,.42);background:transparent center/14px 14px no-repeat;cursor:pointer;transition:background-color 160ms ' + OUT + ',box-shadow 160ms ' + OUT + ',transform 120ms ' + OUT + ';}'
    + '#w290srv .sv input:checked,#w290sheet .sv input:checked{background-color:' + GREEN + ';background-image:' + TICK + ';box-shadow:none;}'
    + '#w290srv .sv input:active,#w290sheet .sv input:active{transform:scale(.9);}'
    + '#w290srv .sv input:focus-visible,#w290sheet .sv input:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + '#w290srv .sv.mine,#w290sheet .sv.mine{cursor:default;}#w290srv .sv.mine input,#w290sheet .sv.mine input{cursor:default;opacity:.55;}'
    + '#w290srv .d,#w290sheet .d{display:flex;flex-direction:column;flex:1;min-width:0;}'
    + '#w290srv .d b,#w290sheet .d b{font-weight:600;font-size:15.5px;color:' + INK + ';}'
    + '#w290srv .d small,#w290sheet .d small{font-size:13px;line-height:1.35;color:' + MUTED + ';overflow-wrap:anywhere;}'
    + '#w290srv .st,#w290sheet .st{flex:none;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:3px 8px;background:rgba(220,165,39,.26);color:' + GREEN + ';}'
    + '#w290srv .roles,#w290sheet .roles{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 12px;padding:0;border:0;min-width:0;}'
    + '#w290srv .roles legend,#w290sheet .roles legend{float:left;width:100%;padding:0;margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + MUTED + ';}'
    + '#w290srv .roles label,#w290sheet .roles label{position:relative;display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border-radius:999px;background:' + SURF2 + ';color:' + GREEN + ';font:500 14px ' + BODY + ';cursor:pointer;transition:background-color 160ms ' + OUT + ',color 160ms ' + OUT + ',transform 120ms ' + OUT + ';}'
    + '#w290srv .roles label:active,#w290sheet .roles label:active{transform:scale(.97);}'
    + '#w290srv .roles input,#w290sheet .roles input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none;}'
    + '#w290srv .roles label.on,#w290sheet .roles label.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#w290srv .roles label:has(input:focus-visible),#w290sheet .roles label:has(input:focus-visible){outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + '#w290srv .er,#w290sheet .er{margin:0 0 10px;font-size:14px;color:' + FLAG + ';outline:0;}'
    + '#w290srv .ac,#w290sheet .ac{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;}'
    + '#w290srv .go,#w290sheet .go{min-height:44px;padding:0 20px;border:0;border-radius:999px;background:' + GOLD + ';color:' + GREEN + ';font:700 15px ' + BODY + ';cursor:pointer;transition:transform 120ms ' + OUT + ',filter 160ms ease;}'
    + '#w290srv .go:active,#w290sheet .go:active{transform:scale(.97);}#w290srv .go[disabled],#w290sheet .go[disabled]{opacity:.65;cursor:default;transform:none;}'
    + '#w290srv .go:focus-visible,#w290sheet .go:focus-visible{outline:2px solid ' + GREEN + ';outline-offset:2px;}'
    + '#w290srv .note,#w290sheet .note{flex:1 1 220px;font-size:13px;color:' + MUTED + ';}'
    + '@media (min-width:901px){#w290srv .sl,#w290sheet .sl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:28px;}#w290srv .sl > .sv:nth-child(2),#w290sheet .sl > .sv:nth-child(2){border-top:0;}}'
    + '@media (hover:hover) and (pointer:fine){#w290srv .go:not([disabled]):hover,#w290sheet .go:not([disabled]):hover{filter:brightness(1.06);}#w290srv .roles label:not(.on):hover,#w290sheet .roles label:not(.on):hover{background:rgba(16,63,57,.15);}#w290srv .sv:not(.mine):hover input:not(:checked),#w290sheet .sv:not(.mine):hover input:not(:checked){box-shadow:inset 0 0 0 1.75px ' + GREEN + ';}}'
    + '@media (max-width:900px){#w290srv{padding:14px 16px 12px;}#w290srv h3,#w290sheet h3{font-size:24px;}}'
    + '@media (prefers-reduced-motion:reduce){#w290srv .bar i,#w290sheet .bar i,#w290srv .sv input,#w290sheet .sv input,#w290srv .roles label,#w290sheet .roles label,#w290srv .go,#w290sheet .go{transition:none;}#w290srv .sv input:active,#w290sheet .sv input:active,#w290srv .roles label:active,#w290sheet .roles label:active,#w290srv .go:active,#w290sheet .go:active{transform:none;}}';
  function addCss() { if (document.getElementById('w290css')) return; var st = document.createElement('style'); st.id = 'w290css'; st.textContent = css; document.head.appendChild(st); }
