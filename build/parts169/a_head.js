/* =====================================================================
   WA v169 The master onboarding runs the Academy, and trainings are assigned to the organization (29/09/26)
   =====================================================================
   Steel (29/09/26): "the master onboarding in the hr center that controls the onboarding. I want to make that's synced to
   what people see on their Avenue Academy page. Also, I want HR to have the ability to assign trainings to the org through
   that same page in the hr center. Leaders should have that ability on the Avenue Academy page as well".

   What changed where:
   - The master onboarding (HR centre, #hrcentre/onboarding; 037, 044, 046, 047, 057 draw it): each week says what people
     see for it in the Academy (the journey's stop: its title, photo, what they will learn, why it matters and the lesson that
     opens it) and edits it in place (onboarding_journey_save into app_config.onboarding_journey, which the journey reads);
     each step says when it is done in the Avenue Academy (a module or a Learning Avenue: training_id, academy_path) and the
     step's editor sets it; "Preview what a new person sees" opens the journey as a new person sees it on day one, and each
     person on the board has "Journey", their own journey as they see it (read only).
   - The database (wa169_sync_assign): a step moved to another week takes that week's due date in every plan in progress; a
     step newly linked to the Academy ticks itself for those who already did it; the Learning Avenue Your onboarding is the
     master's own Academy modules in the master's order; weeks HR adds (90 DAYS, 6 MONTHS) get their own due dates.
   - Assigning trainings (academy_assignments, academy_assign): a module or a Learning Avenue, to everyone (the whole team,
     not the board), teams or people, with an optional due date and a note; people who join later get it too. From the HR
     centre (the Onboarding and Training views: Assign trainings to the organization, with each assignment's progress, See
     who and Stop) and, for leaders, from the Avenue Academy (HR tools, and Assign on a module or a Learning Avenue).
   - What people see (the Academy's home): Assigned to you, with the due date, who asked and why, and how far they are.
   - Elsewhere: the journey (parts167: the preview, weeks HR adds, reloading its settings), the Academy (122: the hooks),
     Hub module 7, the HR centre and Academy tours, the access profiles.
   ===================================================================== */
(function () {
  if (window.__wa169) return; window.__wa169 = true;
  var GREEN = '#103F39', GOLD = '#DCA527', MUTED = '#797773', FLAG = '#B3402F', TEAL = '#2A8C7A', LINE = '#E7E2D6', CREAM = '#FFFAF2', PURPLE = '#6F64AB', INK = '#1F201E';
  var HEAD = '"Barlow Condensed", "Arial Narrow", sans-serif';
  var PSTORE = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
  var BR = { star: PSTORE + 'brand/doodle-star-gold.png', e: PSTORE + 'brand/e-large-gold-600.png', heart: PSTORE + 'brand/doodle-heart-purple.png', ast: PSTORE + 'brand/doodle-asterisk-cream.png' };
  var SAMPLE_ID = 'w169sample';
  var S = { tr: null, paths: null, catAt: 0, catP: null, list: null, listAt: 0, listP: null, cfg: null, cfgAt: 0, cfgP: null, photos: null, photosP: null, mine: null, mineAt: 0, mineP: null, open: {}, busy: false };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function lower(s) { return String(s == null ? '' : s).toLowerCase(); }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function addDays(iso, n) { var d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmtDay(iso) {
    if (!iso) return '';
    try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); }
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function role() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function profile() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.profile) || ''; } catch (e) { return ''; } }
  /* HR (its access profile), leaders and admins: the same rule as wa169_can_assign in the database */
  function canAssign() { var r = role(); return r === 'admin' || r === 'leader' || (profile() === 'hr' && r !== 'blocked' && r !== 'viewer'); }
  function meRow() { try { return (typeof wa28Me === 'function') ? wa28Me() : null; } catch (e) { return null; } }
  function meName() { var m = meRow(); return (m && m.name) || ''; }
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (m) { return m && m.active !== false && m.name && m.email; }); } catch (e) { return []; } }
  function teamName(d) {
    try { return (window.WA_TEAMS && WA_TEAMS.label && WA_TEAMS.label[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || (d === 'exec' ? 'Executive team' : d) || ''; } catch (e) { return d || ''; }
  }
  function teams() {
    var seen = {}, order = (window.WA_TEAMS && WA_TEAMS.order) ? WA_TEAMS.order.slice() : [];
    members().forEach(function (m) { if (m.department) seen[m.department] = (seen[m.department] || 0) + 1; });
    Object.keys(seen).forEach(function (d) { if (order.indexOf(d) < 0) order.push(d); });
    return order.filter(function (d) { return seen[d]; }).map(function (d) { return { key: d, label: teamName(d), n: seen[d] }; });
  }
  /* a week's due date, as the database counts it (onb_due): WEEK n, "90 DAYS", "6 MONTHS" */
  function daysOf(name) {
    var u = String(name || '').toUpperCase().trim(), n = parseInt(u.replace(/[^0-9]/g, ''), 10);
    if (/^WEEK\s+\d+$/.test(u)) return 7 * n;
    if (/^\d+\s+DAYS?$/.test(u)) return n;
    if (/^\d+\s+MONTHS?$/.test(u)) return 30 * n;
    return 90;
  }
  function lab(name) {
    var u = String(name || '').trim(), m = /^WEEK\s+(\d+)$/i.exec(u);
    if (m) return 'Week ' + m[1];
    m = /^(\d+)\s+(DAYS?|MONTHS?)$/i.exec(u); if (m) return m[1] + ' ' + m[2].toLowerCase();
    return u.charAt(0) + u.slice(1).toLowerCase();
  }
  function photoUrl(path) { return /^https?:/.test(String(path || '')) ? String(path) : PSTORE + String(path || '').replace(/^\/+/, ''); }
  function pos(fx, fy) { return Math.round(100 * (fx == null ? 0.5 : fx)) + '% ' + Math.round(100 * (fy == null ? 0.5 : fy)) + '%'; }

  var CSS = ''
    /* the master: what people see, week by week */
    + '#w46master .w169tt{display:inline-flex;align-items:center;gap:6px;margin-left:10px;padding:2px 10px 2px 3px;border-radius:999px;background:rgba(16,63,57,.08);color:' + GREEN + ';font-size:11.5px;font-weight:700;letter-spacing:.2px;vertical-align:middle;}'
    + '#w46master .w169tt i{display:inline-block;width:22px;height:22px;border-radius:50%;background:' + GREEN + ' center/cover no-repeat;}'
    + '#w46master .w169see{display:flex;gap:14px;align-items:stretch;margin:10px 0 12px;padding:10px;border-radius:14px;background:' + CREAM + ';border:1px dashed rgba(16,63,57,.22);}'
    + '#w46master .w169see .ph{flex:0 0 132px;min-height:84px;border-radius:10px;background:' + GREEN + ' center/cover no-repeat;position:relative;overflow:hidden;}'
    + '#w46master .w169see .ph.none{display:flex;align-items:center;justify-content:center;color:rgba(255,250,242,.7);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;}'
    + '#w46master .w169see .tx{flex:1;min-width:0;font-size:12.5px;color:#3d3c39;}'
    + '#w46master .w169see .tx .k{font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:' + TEAL + ';}'
    + '#w46master .w169see .tx b{display:block;font-family:' + HEAD + ';font-size:20px;font-weight:700;text-transform:uppercase;color:' + GREEN + ';line-height:1.05;margin:2px 0 4px;}'
    + '#w46master .w169see .tx ul{margin:2px 0 0 16px;padding:0;}#w46master .w169see .tx li{margin:1px 0;}'
    + '#w46master .w169see .tx .why{margin-top:4px;color:' + MUTED + ';}'
    + '#w46master .w169see .ac{display:flex;flex-direction:column;gap:6px;align-items:flex-end;justify-content:center;}'
    + '.w169pill{display:inline-flex;align-items:center;gap:6px;border:1px solid ' + GREEN + ';background:' + CREAM + ';color:' + GREEN + ' !important;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none !important;font-family:inherit;white-space:nowrap;}'
    + '.w169pill:hover{background:' + GREEN + ';color:' + CREAM + ' !important;}'
    + '.w169pill.gold{border-color:' + GOLD + ';background:' + GOLD + ';color:' + GREEN + ' !important;}.w169pill.gold:hover{background:#c9951f;}'
    + '#w46master .w169chip{display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:1px 8px;border-radius:999px;background:rgba(42,140,122,.12);color:' + TEAL + ';font-size:10.5px;font-weight:700;vertical-align:middle;}'
    + '#w46master .w169chip.op{background:rgba(220,165,39,.2);color:#8a6512;}'
    + '.w169bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;}'
    + '@media (max-width:760px){#w46master .w169see{flex-direction:column;}#w46master .w169see .ph{flex-basis:auto;height:110px;}#w46master .w169see .ac{align-items:flex-start;flex-direction:row;}}'
    /* the week editor and the assign form (in the Hub's modal) */
    + '#modalBox .w169f label{display:block;font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:' + GREEN + ';margin:12px 0 4px;}'
    + '#modalBox .w169f label .op{font-weight:500;text-transform:none;letter-spacing:0;color:' + MUTED + ';margin-left:6px;}'
    + '#modalBox .w169f input[type=text],#modalBox .w169f input[type=search],#modalBox .w169f input[type=date],#modalBox .w169f textarea,#modalBox .w169f select{width:100%;box-sizing:border-box;border:1px solid #DEE0D8;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;background:' + CREAM + ';}'
    + '#modalBox .w169f .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}'
    + '#modalBox .w169pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px;max-height:176px;overflow-y:auto;padding:2px;}'
    + '#modalBox .w169pic{aspect-ratio:3/2;border:2px solid transparent;border-radius:9px;background:' + GREEN + ' center/cover no-repeat;cursor:pointer;padding:0;}'
    + '#modalBox .w169pic.on{border-color:' + GOLD + ';box-shadow:0 0 0 2px ' + GREEN + ';}#modalBox .w169pic:hover{border-color:' + GOLD + ';}'
    + '#modalBox .w169prev{margin:14px 0 4px;border-radius:16px;overflow:hidden;border:1px solid rgba(16,63,57,.14);}'
    + '#modalBox .w169prev .bn{position:relative;min-height:112px;padding:16px 18px;background:' + GREEN + ' center/cover no-repeat;color:' + CREAM + ';display:flex;flex-direction:column;justify-content:flex-end;}'
    + '#modalBox .w169prev .bn:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,63,57,.25),rgba(16,63,57,.9));}'
    + '#modalBox .w169prev .bn > *{position:relative;}#modalBox .w169prev .bn .k{font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + GOLD + ';}'
    + '#modalBox .w169prev .bn h4{margin:2px 0 0;font-family:' + HEAD + ';font-size:26px;font-weight:700;text-transform:uppercase;line-height:1;}'
    + '#modalBox .w169prev .bd{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;padding:12px 16px;background:' + CREAM + ';font-size:12.5px;}'
    + '#modalBox .w169prev .bd h5{margin:0 0 4px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:' + GREEN + ';}#modalBox .w169prev .bd ul{margin:0 0 0 16px;padding:0;}'
    + '#modalBox .w169note{font-size:12px;color:' + MUTED + ';margin:6px 0 0;}'
    + '#modalBox .w169err{color:' + FLAG + ';font-size:12.5px;font-weight:600;margin:8px 0 0;}'
    /* the assign form */
    + '#modalBox .w169what{max-height:220px;overflow-y:auto;border:1px solid #E7E2D6;border-radius:12px;margin-top:6px;background:' + CREAM + ';}'
    + '#modalBox .w169what button{display:flex;width:100%;gap:10px;align-items:center;text-align:left;border:0;border-bottom:1px solid #F1EEE5;background:none;padding:8px 10px;font:inherit;font-size:13px;cursor:pointer;color:' + INK + ';}'
    + '#modalBox .w169what button:hover{background:rgba(16,63,57,.05);}#modalBox .w169what button.on{background:rgba(220,165,39,.18);}'
    + '#modalBox .w169what .ic{flex:0 0 30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:' + CREAM + ';font-size:12px;font-weight:800;background:' + TEAL + ';}'
    + '#modalBox .w169what .ic.av{background:' + GREEN + ';}#modalBox .w169what .tx{flex:1;min-width:0;}#modalBox .w169what .tx span{display:block;font-size:11.5px;color:' + MUTED + ';}'
    + '#modalBox .w169what .gh{padding:6px 10px;font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:' + MUTED + ';background:#FAF8F2;}'
    + '#modalBox .w169seg{display:inline-flex;border:1px solid ' + GREEN + ';border-radius:999px;overflow:hidden;}'
    + '#modalBox .w169seg button{border:0;background:' + CREAM + ';color:' + GREEN + ';padding:6px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;}'
    + '#modalBox .w169seg button.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#modalBox .w169chk{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}'
    + '#modalBox .w169chk label{display:inline-flex !important;align-items:center;gap:6px;margin:0 !important;padding:5px 10px;border:1px solid #DEE0D8;border-radius:999px;background:' + CREAM + ';font-size:12.5px !important;font-weight:600 !important;letter-spacing:0 !important;text-transform:none !important;color:' + INK + ' !important;cursor:pointer;}'
    + '#modalBox .w169chk input{accent-color:' + GREEN + ';}#modalBox .w169chk label.on{border-color:' + GREEN + ';background:rgba(16,63,57,.07);}'
    + '#modalBox .w169ppl{max-height:180px;overflow-y:auto;}'
    + '#modalBox .w169sum{margin:14px 0 0;padding:10px 12px;border-radius:12px;background:rgba(16,63,57,.06);font-size:13px;color:' + GREEN + ';font-weight:600;}'
    + '#modalBox .w169ck{display:flex !important;gap:8px;align-items:center;text-transform:none !important;letter-spacing:0 !important;font-weight:500 !important;font-size:13px !important;color:' + INK + ' !important;}'
    + '#modalBox .w169picked{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;min-height:26px;}'
    + '#modalBox .w169tag{display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 11px;border-radius:999px;background:rgba(220,165,39,.22);color:#6b4d0e;font-weight:700;}'
    + '#modalBox .w169tag button{border:0;background:rgba(16,63,57,.12);color:' + GREEN + ';border-radius:50%;width:20px;height:20px;padding:0;cursor:pointer;font-size:14px;line-height:20px;}'
    + '#modalBox .w169quick{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:38px;}'
    /* over the Academy's sheet (Assign on a module or a Learning Avenue) */
    + '#modalBack.w169top{z-index:2147481000 !important;}'
    /* the assignments card (HR centre) */
    + '.w169card .w169lead{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:0 0 12px;}'
    + '.w169card .w169lead p{margin:0;max-width:640px;font-size:13px;color:#3d3c39;}'
    + '.w169list{display:grid;gap:10px;}'
    + '.w169a{border:1px solid #E7E2D6;border-radius:14px;background:' + CREAM + ';padding:12px 14px;}'
    + '.w169a.off{opacity:.62;}'
    + '.w169a .t{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;}'
    + '.w169a .t b{font-size:14px;color:' + INK + ';}.w169a .t .k{display:inline-block;margin-left:6px;font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:' + TEAL + ';}'
    + '.w169a .m{font-size:12px;color:' + MUTED + ';margin:3px 0 8px;}.w169a .m .late{color:' + FLAG + ';font-weight:700;}'
    + '.w169a .pb{height:8px;border-radius:99px;background:#EFEBE1;overflow:hidden;}.w169a .pb i{display:block;height:100%;background:linear-gradient(90deg,' + TEAL + ',' + GREEN + ');border-radius:99px;}'
    + '.w169a .n{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-top:6px;font-size:12px;color:#3d3c39;}'
    + '.w169a .n .acts{display:flex;gap:8px;}'
    + '.w169a .n a{cursor:pointer;color:' + GREEN + ';font-weight:700;text-decoration:underline;}.w169a .n a.stop{color:' + FLAG + ';}'
    + '.w169who{margin-top:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;}'
    + '.w169who div{display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:12.5px;padding:5px 9px;border-radius:9px;background:#FAF8F2;}'
    + '.w169who em{font-style:normal;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;white-space:nowrap;}'
    + '.w169who em.ok{background:rgba(16,63,57,.1);color:' + GREEN + ';}.w169who em.go{background:rgba(220,165,39,.22);color:#8a6512;}.w169who em.no{background:#EFEBE1;color:' + MUTED + ';}.w169who em.late{background:rgba(179,64,47,.12);color:' + FLAG + ';}'
    + '.w169empty{font-size:13px;color:' + MUTED + ';padding:10px 0;}'
    + '.w169a .nt{font-size:12.5px;font-style:italic;color:#3d3c39;margin:-4px 0 8px;}'
    + '.w169a .sure{font-size:12px;color:' + FLAG + ';font-weight:600;}'
    + '.w169chip0{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.3px;padding:2px 9px;border-radius:999px;background:#EFEBE1;color:' + MUTED + ';}'
    + '#hrcentre .w169card .w169lead p{font-size:13.5px;}'
    /* the Academy: assigned to you */
    + '#w169mine{margin:0 0 26px;}'
    /* a modal open on a phone: the bar at the bottom steps aside, so the form's buttons are never under it */
    + '@media (max-width:900px){body:has(#modalBack[style*="flex"]) #w163bar{display:none !important;}}'
    + '#w169mine .w169g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;}'
    + '#w169mine .w169m{position:relative;display:flex;flex-direction:column;gap:6px;border-radius:18px;padding:14px 16px 14px 18px;background:' + CREAM + ';border:1px solid #E7E2D6;box-shadow:0 10px 26px -20px rgba(16,63,57,.6);text-decoration:none;color:inherit;overflow:hidden;}'
    + '#w169mine .w169m:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:' + GOLD + ';}'
    + '#w169mine .w169m.late:before{background:' + FLAG + ';}#w169mine .w169m.done:before{background:' + TEAL + ';}'
    + '#w169mine .w169m .k{font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:' + TEAL + ';}'
    + '#w169mine .w169m b{font-size:15px;color:' + INK + ';line-height:1.25;}'
    + '#w169mine .w169m .due{font-size:12px;font-weight:700;color:#8a6512;}#w169mine .w169m.late .due{color:' + FLAG + ';}#w169mine .w169m.done .due{color:' + TEAL + ';}'
    + '#w169mine .w169m .why{font-size:12.5px;color:#3d3c39;font-style:italic;}'
    + '#w169mine .w169m .by{font-size:11.5px;color:' + MUTED + ';}'
    + '#w169mine .w169m .pb{height:6px;border-radius:99px;background:#EFEBE1;overflow:hidden;}#w169mine .w169m .pb i{display:block;height:100%;background:' + GREEN + ';}'
    + '#w169mine .w169m .go{align-self:flex-start;margin-top:4px;display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:' + GREEN + ';color:' + CREAM + ';font-size:12.5px;font-weight:700;padding:6px 14px;}'
    + '#w169mine .w169m.done .go{background:rgba(16,63,57,.1);color:' + GREEN + ';}'
    /* the preview banner */
    + '.w169pv{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:0 0 12px;padding:10px 14px;border-radius:14px;background:' + PURPLE + ';color:' + CREAM + ';font-size:13px;}'
    + '.w169pv b{font-weight:800;}.w169pv button{border:0;border-radius:999px;background:' + CREAM + ';color:' + PURPLE + ';font:inherit;font-size:12.5px;font-weight:800;padding:6px 14px;cursor:pointer;}'
    + '#w122sheet .w169pv{margin:10px 18px 0;}'
    + '.w169pvon #w166help,.w169pvon [data-w166help],.w169pvon .w166helpbox{display:none !important;}';
  if (!document.getElementById('wa169css')) { var st = document.createElement('style'); st.id = 'wa169css'; st.textContent = CSS; document.head.appendChild(st); }

