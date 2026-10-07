/* =====================================================================
   WA v197 the HR centre, rebuilt for Valex, and page names in every app (03/10/26)
   =====================================================================
   Steel (02/10/26): "The HR center app of the HUB needs a full revamp on how
   it's displayed ... it says HR Center too many times, I think it should say
   just the page name ... that's for all apps." And for the HR centre: buttons
   that are not consistent, sections repeated across pages (last sign-in,
   commitment), pages that hold things unrelated to their name, and "I'd also
   like it to be easy to navigate the recruitment process. The intended purpose
   is to make it easy to manage HR so that Valex can easily navigate this
   center and do more with less time."
   His choices (02/10/26): the layout below; hours from The Loop only (the Slack
   hours table goes; its data stays in the database); French follows in wave198.

   1. Every app: the big title is the page's name (the rail's item), the crumb
      inside the page goes, and on a computer the app bar above the page goes
      (the sidebar already names the app); its buttons (Add a contact, Text
      volunteers) move into the page's header. Phones keep their bar (it holds
      the menu).
   2. The HR centre's rail: Overview; People: Team, Hours, Time off,
      Recognition; Hiring: Applications, Positions, Playbook; Growth:
      Onboarding, Onboarding plan, Training; Care: Policies, Discipline;
      Reports: Analytics (HR and admins). Each address #hrcentre/<page> opens
      exactly that page.
   3. Nothing repeats: the hero, the second intro, and the five sections that
      sat under every page (meeting attendance, quizzes, scope of work, time
      off, Hub engagement) each live on one page. Hub engagement leaves HR
      (the Admin centre's Adoption has sign-ins and use); the Slack scope of
      work becomes what people shared in The Loop.
   4. New: Overview (HR's to-do list and the numbers), Applications as a
      stage board with a candidate sheet, Hours from The Loop (minimums,
      below-minimum first, open sessions counted at most eight hours).
   How it works: the older waves still draw their sections; this wave tags
   each one with the page it belongs to (data-w197s) and shows only the
   current page's (#hrcentre[data-w197]); it clicks the older tab a page
   needs so its data loads. No data model change.
   ===================================================================== */
(function () {
  if (window.__wa197) return; window.__wa197 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var MUTED = 'var(--wa-muted)';
  var FOUNDERS = ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'];
  var STAGES = [['new', 'New'], ['reviewing', 'Reviewing'], ['interview', 'Interview'], ['offer', 'Offer'], ['hired', 'Hired']];
  var CLOSED = [['declined', 'Declined'], ['withdrawn', 'Withdrawn'], ['volunteering', 'Volunteering']];   /* wave218: volunteering = sent to the Volunteer Manager */

  /* the pages: key, label, rail icon, group, the older tab whose data it needs, the line under the title */
  var PAGES = [
    { k: 'overview', l: 'Overview', ic: 'home', g: '', tab: 'people', d: 'What needs HR today, and the numbers that matter. Each line opens the page where you deal with it.' },
    { k: 'team', l: 'Team', ic: 'people', g: 'People', tab: 'people', d: 'Everyone on the roster: their team, role, start date and open tasks. Open a profile for the whole picture.' },
    { k: 'hours', l: 'Hours', ic: 'target', g: 'People', tab: null, d: 'Time given through The Loop against each person’s weekly minimum, what people shared, and who came to their team’s meetings.' },
    { k: 'timeoff', l: 'Time off', ic: 'cal', g: 'People', tab: null, d: 'Requests waiting on a decision, logging time off, and the days taken this fiscal year.' },
    { k: 'recognition', l: 'Recognition', ic: 'star', g: 'People', tab: 'people', d: 'Shout-outs: good work, noticed. They also rotate on the loading screen.' },
    { k: 'applications', l: 'Applications', ic: 'search', g: 'Hiring', tab: 'recruitment', d: 'Every application from hub@ and the job boards, by stage. Drag a card to move it, or open it to read, decide and take notes.' },
    { k: 'positions', l: 'Positions', ic: 'list', g: 'Hiring', tab: 'recruitment', d: 'Every role by department, from the HR drive: its job description, CVs, applications and the people who hold it.' },
    { k: 'playbook', l: 'Playbook', ic: 'book', g: 'Hiring', tab: 'recruitment', d: 'How we recruit: the playbook, interview and offer templates, and the team structure.' },
    { k: 'onboarding', l: 'Onboarding', ic: 'clip', g: 'Growth', tab: 'onboarding', d: 'Who is onboarding and how far along, assigning an onboarding, the quizzes and what new members said.' },
    { k: 'plan', l: 'Onboarding plan', ic: 'layers', g: 'Growth', tab: 'onboarding', d: 'The master onboarding: every week and step new people see. Changes reach everyone still onboarding.' },
    { k: 'training', l: 'Training', ic: 'cap', g: 'Growth', tab: 'training', d: 'Trainings assigned to the organization, how far each person is, and the catalog.' },
    { k: 'policies', l: 'Policies', ic: 'form', g: 'Care', tab: 'policies', d: 'Each policy, who has signed it and who has not.' },
    { k: 'discipline', l: 'Discipline', ic: 'shield', g: 'Care', tab: 'discipline', d: 'Progressive discipline per the handbook: every entry dated and attributed. People can see their own record.' },
    { k: 'analytics', l: 'Analytics', ic: 'chart', g: 'Reports', tab: 'analytics', d: 'Who has been part of Welfare Avenue and for how long: the team over time, retention and who left.', only: 'analytics' }
  ];
  var OLD = { people: 'team', recruitment: 'applications', commitment: 'hours' };   /* older addresses that now open a new page */
  var S = { page: 'overview', cands: [], candsAt: 0, cLoading: null, ck: [], ckAt: 0, feed: [], mins: { member: 3, manager: 5 }, timeoff: [], pol: [], sig: [], onb: [], tp: [], data: null, dLoading: null, drag: null, open: null, filterOwner: '', q: '', showClosed: false, hoursWeeks: 4 };

  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function me() { try { return { email: lower(USER && USER.email), name: (USER && USER.name) || '' }; } catch (e) { return { email: '', name: '' }; } }
  function isAdmin() { if (FOUNDERS.indexOf(me().email) >= 0) return true; try { return !!(WA40_MINE && WA40_MINE.role === 'admin'); } catch (e) { return false; } }
  function canHr() { try { if (typeof window.wa46IsHr === 'function') return window.wa46IsHr(); } catch (e) { /* fine */ } return isAdmin(); }
  function members() { return (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (m) { return m && m.active !== false && m.name && !/\btest\b/i.test(m.name); }); }
  function memberByEmail(em) { em = lower(em); return members().filter(function (m) { return lower(m.email) === em; })[0] || null; }
  function teamLabel(d) { try { return (window.WA_TEAMS && WA_TEAMS.label && WA_TEAMS.label[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function av(m, size) { try { return window.w116Avatar ? window.w116Avatar(m, size) : ''; } catch (e) { return ''; } }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function fmtH(min) { min = Math.round(Number(min) || 0); var h = Math.floor(min / 60), m = min % 60; return h ? h + 'h' + (m ? ' ' + (m < 10 ? '0' : '') + m + 'm' : '') : m + 'm'; }
  function ago(s) { if (!s) return ''; var d = (Date.now() - new Date(s).getTime()) / 86400000; if (d < 1) return 'today'; if (d < 2) return 'yesterday'; if (d < 14) return Math.round(d) + ' days ago'; try { return new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pageDef(k) { return PAGES.filter(function (p) { return p.k === k; })[0] || null; }
  function subNow() { var h = String(location.hash || ''); if (h.indexOf('#hrcentre') !== 0) return null; var s = h.replace(/^#/, '').split('/')[1] || ''; s = s.split('?')[0]; if (OLD[s]) s = OLD[s]; return pageDef(s) ? s : 'overview'; }
  function onHr() { var p = document.getElementById('hrcentre'); return !!p && p.classList.contains('active') && String(location.hash || '').indexOf('#hrcentre') === 0; }
  function seesAnalytics() { return !!document.querySelector('#hrcentre .w47tab[data-w47v="analytics"]'); }
  function btn(label, attrs, kind) { return '<button type="button" class="w197b' + (kind ? ' ' + kind : '') + '" ' + (attrs || '') + '>' + label + '</button>'; }

  var css = document.createElement('style');
  css.id = 'wa197css';
  css.textContent = '' +
    /* ---------- 1. every app: the page's name, no crumb, no bar on a computer ---------- */
    'body.w153app .w118mast .crumb,body.w153app .w116ptop .crumb{display:none!important;}' +
    '@media (min-width:901px){body.w153app #w153bar{display:none!important;}body.w153app .w118adm{display:none!important;}}' +
    '@media (max-width:900px){body.w153app #w153bar .w153bc > span:not(.w153ai){display:none!important;}}' +
    '.w118mast .w197acts{position:absolute;right:0;top:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}' +
    '.w118mast .w197acts .w43help{position:static!important;margin:0!important;}' +
    '.w197pact{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:999px;padding:9px 16px;background:' + GREEN + ';color:' + CREAM + ';font-family:' + BODY + ';font-size:13px;font-weight:700;cursor:pointer;}' +
    '.w197pact:hover{background:#0c332e;}.w197pact svg{width:15px;height:15px;}' +
    '@media (max-width:900px){.w118mast .w197acts{position:static;margin-top:8px;justify-content:flex-start;}.w197pact{display:none;}}' +
    /* ---------- 2. the HR centre: one page at a time ---------- */
    '#hrcentre[data-w197] [data-w197s]:not(.w197on){display:none!important;}' +
    '#hrcentre[data-w197] .w197on.w197blk{display:block!important;}' +
    '#hrcentre[data-w197] .w197x{display:none!important;}' +
    /* a section an older wave has just redrawn stays out of sight until it is tagged (a few milliseconds) */
    '#hrcentre[data-w197] #w46body > :not([data-w197s]):not(.w47tabs){display:none!important;}' +
    '#hrcentre[data-w197] > :not([data-w197s]):not(.w118mast):not(.w197main){display:none!important;}' +
    '#hrcentre[data-w197] > .w197main{background:transparent;box-shadow:none;border:none;padding:0;}' +
    '#hrcentre[data-w197] #w46body{display:block;}' +
    '#hrcentre[data-w197] .w47tabs{display:none!important;}' +
    /* one look for every section */
    '#hrcentre[data-w197] .w197card,#hrcentre[data-w197] #w46body > .w46sec,#hrcentre[data-w197] #w144hr,#hrcentre[data-w197] #w145quiz,#hrcentre[data-w197] #w105to,#hrcentre[data-w197] #w105pol,#hrcentre[data-w197] #w105disc,#hrcentre[data-w197] #w116ppeople,#hrcentre[data-w197] #w181{background:var(--wa-card);border:1px solid rgba(16,63,57,.10);border-radius:18px;padding:20px 22px;margin:0 0 16px;box-shadow:0 10px 26px -22px rgba(16,63,57,.45);font-family:' + BODY + ';}' +
    '#hrcentre[data-w197] #w106polsec,#hrcentre[data-w197] #w106discsec{margin:0;padding:0;border:none;background:none;}' +
    '#hrcentre[data-w197] .w197card h2,#hrcentre[data-w197] #w46body > .w46sec > h3,#hrcentre[data-w197] #w144hr > h2,#hrcentre[data-w197] #w145quiz > h2,#hrcentre[data-w197] #w105to > h2,#hrcentre[data-w197] #w106polsec h2,#hrcentre[data-w197] #w106discsec h2{font-family:' + HEAD + ';font-weight:600;font-size:22px;letter-spacing:.4px;text-transform:uppercase;color:' + GREEN + ';margin:0 0 6px;}' +
    '#hrcentre[data-w197] .w46sec h3.w197sub{font-size:17px;margin:18px 0 6px;}' +
    /* buttons: one family */
    '.w197b,#hrcentre[data-w197] .w144btn,#hrcentre[data-w197] .w145btn,#hrcentre[data-w197] #w105to button,#hrcentre[data-w197] #w106polsec button,#hrcentre[data-w197] #w106discsec button,#hrcentre[data-w197] #w116ppeople .btn,#hrcentre[data-w197] .w169bar button{font-family:' + BODY + '!important;font-size:13px!important;font-weight:700!important;letter-spacing:0!important;text-transform:none!important;border-radius:999px!important;padding:8px 15px!important;cursor:pointer;line-height:1.2!important;}' +
    '#hrcentre[data-w197] #w105pol button,#hrcentre[data-w197] #w105disc button,#hrcentre[data-w197] #w105to button{background:' + GREEN + '!important;color:' + CREAM + '!important;border:1px solid ' + GREEN + '!important;box-shadow:none!important;}' +
    '#hrcentre[data-w197] #w105disc button + button,#hrcentre[data-w197] #w116ppeople .btn{background:transparent!important;color:' + GREEN + '!important;border:1px solid rgba(16,63,57,.25)!important;box-shadow:none!important;}' +
    '#hrcentre[data-w197] #w169cardT .w169lead button,#hrcentre[data-w197] #w169cardT .w169lead .w169btn{background:' + GREEN + '!important;color:' + CREAM + '!important;}' +
    '.w197b{border:1px solid rgba(16,63,57,.22);background:transparent;color:' + GREEN + ';}' +
    '.w197b:hover{background:rgba(16,63,57,.06);}' +
    '.w197b.pri{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}.w197b.pri:hover{background:#0c332e;}' +
    '.w197b.sm{padding:5px 11px!important;font-size:12px!important;}' +
    '.w197b.warn{color:' + FLAG + ';border-color:rgba(179,64,47,.35);}' +
    /* the page head (title and actions) inside the masthead */
    '#hrcentre .w197lead{font-size:13.5px;color:' + MUTED + ';margin:-4px 0 16px;max-width:720px;line-height:1.5;}' +
    /* tiles */
    '.w197tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 16px;}' +
    '.w197tile{background:var(--wa-card);border:1px solid rgba(16,63,57,.10);border-radius:16px;padding:14px 16px;text-align:left;cursor:pointer;font-family:' + BODY + ';color:' + INK + ';}' +
    '.w197tile:hover{border-color:rgba(16,63,57,.35);}' +
    '.w197tile b{display:block;font-family:' + HEAD + ';font-size:34px;line-height:1;color:' + GREEN + ';font-weight:600;}' +
    '.w197tile span{display:block;font-size:12.5px;color:' + MUTED + ';margin-top:6px;line-height:1.3;}' +
    '.w197tile.hot b{color:' + FLAG + ';}' +
    /* the to-do list */
    '.w197todo{list-style:none;margin:0;padding:0;}' +
    '.w197todo li{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(16,63,57,.08);}' +
    '.w197todo li:first-child{border-top:none;}' +
    '.w197todo .n{flex:none;min-width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:' + HEAD + ';font-size:22px;font-weight:600;background:rgba(220,165,39,.18);color:' + GREEN + ';}' +
    '.w197todo .n.ok{background:rgba(42,140,122,.14);}' +
    '.w197todo .t{flex:1;min-width:0;}.w197todo .t b{display:block;font-size:14.5px;color:' + INK + ';}.w197todo .t small{display:block;font-size:12.5px;color:' + MUTED + ';margin-top:2px;line-height:1.4;}' +
    '.w197done{font-size:14px;color:' + TEAL + ';font-weight:700;padding:6px 0;}' +
    '.w197grid2{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px;align-items:start;}' +
    '@media (max-width:1100px){.w197grid2{grid-template-columns:1fr;}}' +
    /* the applications board */
    '.w197bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px;}' +
    '.w197bar input,.w197bar select{font-family:' + BODY + ';font-size:13.5px;padding:8px 13px;border:1px solid rgba(16,63,57,.2);border-radius:999px;background:var(--wa-card);color:' + INK + ';}' +
    '.w197bar input{flex:1;min-width:180px;}' +
    '.w197board{display:grid;grid-template-columns:repeat(5,minmax(210px,1fr));gap:12px;overflow-x:auto;padding-bottom:6px;}' +
    '.w197col{background:rgba(16,63,57,.045);border-radius:16px;padding:10px;min-height:160px;display:flex;flex-direction:column;gap:8px;transition:background .12s;}' +
    '.w197col.over{background:rgba(220,165,39,.18);}' +
    '.w197col h4{margin:2px 4px 4px;font-family:' + HEAD + ';font-size:17px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:' + GREEN + ';display:flex;justify-content:space-between;align-items:center;}' +
    '.w197col h4 small{font-family:' + BODY + ';font-size:12px;font-weight:700;background:var(--wa-card);border-radius:999px;padding:1px 8px;color:' + GREEN + ';}' +
    '.w197cand{background:var(--wa-card);border:1px solid rgba(16,63,57,.10);border-radius:12px;padding:10px 12px;cursor:pointer;font-family:' + BODY + ';text-align:left;width:100%;color:' + INK + ';}' +
    '.w197cand:hover{border-color:rgba(16,63,57,.35);}' +
    '.w197cand[draggable=true]{cursor:grab;}' +
    '.w197cand b{display:block;font-size:14px;line-height:1.25;}' +
    '.w197cand .r{display:block;font-size:12px;color:' + MUTED + ';margin-top:3px;line-height:1.3;}' +
    '.w197cand .m{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;}' +
    '.w197cand .m span{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:rgba(16,63,57,.07);color:' + GREEN + ';}' +
    '.w197cand .m span.who{background:rgba(111,100,171,.14);color:' + PURPLE + ';}' +
    '.w197cand .m span.age{background:rgba(220,165,39,.2);}' +
    '.w197cand .m span.ok{background:rgba(42,140,122,.14);color:' + TEAL + ';}' +
    '.w197closed{margin-top:14px;font-size:13px;color:' + MUTED + ';}' +
    '.w197closed .w197cand{display:inline-block;width:auto;margin:4px 6px 0 0;padding:6px 10px;}' +
    '@media (max-width:900px){.w197board{grid-template-columns:repeat(5,minmax(240px,82vw));scroll-snap-type:x mandatory;}.w197col{scroll-snap-align:start;}}' +
    /* the candidate sheet */
    '#w197sheet{position:fixed;inset:0;z-index:9000;display:none;}' +
    '#w197sheet.open{display:block;}' +
    '#w197sheet .bk{position:absolute;inset:0;background:rgba(31,32,30,.38);}' +
    '#w197sheet .pn{position:absolute;right:0;top:0;bottom:0;width:min(560px,100%);background:' + CREAM + ';box-shadow:-20px 0 40px -20px rgba(16,63,57,.4);overflow-y:auto;padding:24px 26px 40px;font-family:' + BODY + ';color:' + INK + ';}' +
    '#w197sheet h3{font-family:' + HEAD + ';font-size:30px;font-weight:600;color:' + GREEN + ';margin:0 40px 2px 0;line-height:1.05;}' +
    '#w197sheet .x{position:absolute;right:18px;top:18px;}' +
    '#w197sheet .role{font-size:14px;color:' + MUTED + ';margin:0 0 12px;}' +
    '#w197sheet .stg{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 16px;}' +
    '#w197sheet .stg button{font-family:' + BODY + ';font-size:12.5px;font-weight:700;border-radius:999px;padding:7px 12px;border:1px solid rgba(16,63,57,.2);background:transparent;color:' + GREEN + ';cursor:pointer;}' +
    '#w197sheet .stg button.on{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}' +
    '#w197sheet .stg button.cl.on{background:' + FLAG + ';border-color:' + FLAG + ';}' +
    '#w197sheet label{display:block;font-size:11.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:' + MUTED + ';margin:14px 0 5px;}' +
    '#w197sheet select,#w197sheet textarea{width:100%;font-family:' + BODY + ';font-size:14px;padding:9px 12px;border:1px solid rgba(16,63,57,.2);border-radius:12px;background:' + CREAM + ';color:' + INK + ';box-sizing:border-box;}' +
    '#w197sheet textarea{min-height:110px;resize:vertical;}' +
    '#w197sheet .sum{white-space:pre-wrap;font-size:14px;line-height:1.55;background:' + CREAM + ';border:1px solid rgba(16,63,57,.1);border-radius:12px;padding:12px 14px;max-height:280px;overflow:auto;}' +
    '#w197sheet .acts{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px;}' +
    '#w197sheet .ct{font-size:13.5px;line-height:1.6;}#w197sheet .ct a{color:' + GREEN + ';}' +
    '#w197sheet .next{background:rgba(220,165,39,.16);border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.5;margin:14px 0 0;}' +
    /* hours */
    '.w197tbl{width:100%;border-collapse:collapse;font-size:13.5px;}' +
    '.w197tbl th{text-align:left;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:' + MUTED + ';font-weight:700;padding:8px 8px;border-bottom:1px solid rgba(16,63,57,.12);}' +
    '.w197tbl td{padding:9px 8px;border-bottom:1px solid rgba(16,63,57,.07);vertical-align:middle;}' +
    '.w197tbl tr.low td:first-child{box-shadow:inset 3px 0 0 ' + FLAG + ';}' +
    '.w197tbl .bar{height:8px;border-radius:999px;background:rgba(16,63,57,.08);overflow:hidden;min-width:80px;}' +
    '.w197tbl .bar i{display:block;height:100%;background:' + TEAL + ';border-radius:999px;}' +
    '.w197tbl tr.low .bar i{background:' + FLAG + ';}' +
    '.w197pill{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:rgba(42,140,122,.14);color:' + TEAL + ';}' +
    '.w197pill.low{background:rgba(179,64,47,.12);color:' + FLAG + ';}.w197pill.mut{background:rgba(16,63,57,.07);color:' + MUTED + ';}' +
    '.w197mins{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;margin:4px 0 14px;}' +
    '.w197mins input{width:58px;font-family:' + BODY + ';font-size:14px;padding:6px 8px;border:1px solid rgba(16,63,57,.2);border-radius:10px;}' +
    '.w197feed{list-style:none;margin:0;padding:0;}' +
    '.w197feed li{padding:10px 0;border-top:1px solid rgba(16,63,57,.08);font-size:13.5px;line-height:1.5;}' +
    '.w197feed li:first-child{border-top:none;}' +
    '.w197feed li b{color:' + GREEN + ';}.w197feed li small{color:' + MUTED + ';}' +
    '.w197feed ul{margin:4px 0 0 18px;padding:0;}' +
    '.w197note{font-size:12.5px;color:' + MUTED + ';line-height:1.5;margin:10px 0 0;}' +
    '.w197wrap{overflow-x:auto;}' +
    '@media (max-width:700px){.w197tbl .hp{display:none;}#hrcentre[data-w197] .w197card{padding:16px;}}';
  document.head.appendChild(css);
