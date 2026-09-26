/* =====================================================================
   WA v132 the bank (26/09/26)
   =====================================================================
   Steel: "store tasks that can't be done in the next three to six months, but kept in a bank to
   resurface later on, like projects as well", and "I also want to give you the option" (the AI).

   - The bank (#bank, under Strategy): everything waiting, by the month it comes back, with why it
     waits and who put it there; what came back in the last two weeks; bring something back now,
     give it a new date, or put something new straight in.
   - Move to the bank: in every task drawer (a task goes with its open subtasks), and on a project
     page (the project, its sub-projects and every open task in them) for the project's lead or a
     leader. An Undo follows every move.
   - A team page shows what the team has in the bank, and a task that came back carries
     "back from the bank" on its board for two weeks.
   - The AI: process-transcript v13 banks what a meeting puts off by three months or more, and Ask
     the Hub can propose moving a task to the bank (bank_task), confirmed on its card.
   Data: wa132_bank (banked_at and friends on dept_tasks and projects; a restrictive read policy so
   no board, list, count or alert ever sees a banked row; bank_list(), bank_task(), bank_add_task(),
   bank_project(), bank_unbank(), bank_redate(), bank_undo(); the 6:05 daily job bank_resurface()).
   ===================================================================== */
(function () {
  if (window.__wa132) return; window.__wa132 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', INK = '#1F201E', VAULT = '#8C6A2E';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var BACK_DAYS = 14;

  var P = {
    vault: '<rect x="3.5" y="5" width="17" height="14.5" rx="2.5"/><circle cx="12" cy="12.2" r="3.2"/><path d="M12 9v.01M15.2 12.2h.01M12 15.4v.01M8.8 12.2h.01M6.5 19.5V21M17.5 19.5V21"/>',
    back: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H12"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    cal: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    chev: '<path d="m9 5 7 7-7 7"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.2 2.4 2.4 4.8-5"/>',
    box: '<path d="M3.5 8 12 3.5 20.5 8v8.5L12 21l-8.5-4.5z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5V21"/>',
    note: '<path d="M5 4.5h14v11l-4.5 4.5H5z"/><path d="M14.5 20v-4.5H19M8.5 9h7M8.5 12.5h4"/>',
    undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>'
  };
  function I(n, cls) { return '<svg class="w132i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function pad(n) { return String(n).padStart(2, '0'); }
  /* dates built field by field (the offline harness swaps Date for a shim that mishandles 3 to 6 arguments) */
  function mk(y, m, d) { var x = new Date(0); x.setFullYear(Number(y), Number(m), Number(d)); x.setHours(12, 0, 0, 0); return x; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? mk(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; }
  /* today in Toronto, as the database counts it */
  function today() {
    try { var s = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); var d = parseDay(s); if (d) return d; } catch (e) { /* fine */ }
    var n = new Date(); return mk(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n, day = d.getDate();
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = mk(y, m + 1, 0).getDate();
    return mk(y, m, Math.min(day, last));
  }
  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  function fmtDay(d, withYear) { if (!d) return ''; return MONTHS[d.getMonth()] + ' ' + d.getDate() + (withYear ? ', ' + d.getFullYear() : ''); }
  function fmtShort(d) { if (!d) return ''; var t = today(); return MON[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== t.getFullYear() ? ', ' + d.getFullYear() : ''); }
  function dayOfIso(iso) { if (!iso) return null; var d = new Date(iso); if (isNaN(d.getTime())) return null; try { return parseDay(d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })); } catch (e) { return mk(d.getFullYear(), d.getMonth(), d.getDate()); } }
  function inDays(d) {
    var n = daysBetween(today(), d);
    if (n <= 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n < 60) return 'in ' + n + ' days';
    var m = Math.round(n / 30.4);
    return 'in about ' + m + ' months';
  }
  function ago(iso) {
    var d = dayOfIso(iso); if (!d) return '';
    var n = daysBetween(d, today());
    if (n <= 0) return 'today'; if (n === 1) return 'yesterday';
    if (n < 45) return n + ' days ago';
    return fmtShort(d);
  }

  /* ---------- who is looking ---------- */
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function wRole() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function isLeaderUI() { var r = wRole(); return r === 'admin' || r === 'leader'; }
  /* who may move work: staff with a working role (a board viewer only reads); the database checks it again */
  function canWork() { var r = wRole(); return staffOk() && !boardMode() && r !== 'viewer' && r !== 'blocked'; }
  function tabOk(id) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { return true; } }
  function myName() {
    try { var em = lower(USER && USER.email); var m = (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (x) { return lower(x.email) === em; })[0]; return (m && m.name) || (USER && USER.name) || ''; } catch (e) { return ''; }
  }
  function myTeam() {
    try { var em = lower(USER && USER.email); var m = (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (x) { return lower(x.email) === em; })[0]; return (m && m.department) || ''; } catch (e) { return ''; }
  }
  /* a project's lead (projects.leads holds first names), or a leader */
  function leadsProject(p) {
    if (!p) return false;
    if (isLeaderUI()) return true;
    var me = lower(myName()), mf = me.split(/\s+/)[0];
    var ls = Array.isArray(p.leads) ? p.leads : [];
    return !!mf && ls.some(function (l) { l = lower(l); return l === me || l === mf || l.split(/\s+/)[0] === mf; });
  }

  /* ---------- teams ---------- */
  function teams() { try { return (window.WA_TEAMS && WA_TEAMS.order) || (typeof DEPT_ORDER !== 'undefined' ? DEPT_ORDER : []); } catch (e) { return []; } }
  function teamLabel(d) { try { return (window.WA_TEAMS && WA_TEAMS.labels && WA_TEAMS.labels[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function teamShort(d) { try { return (window.WA_TEAMS && WA_TEAMS.short && WA_TEAMS.short[d]) || teamLabel(d); } catch (e) { return d || ''; } }
  function teamColor(d) { try { return (typeof DEPT_COLOR !== 'undefined' && DEPT_COLOR[d]) || GREEN; } catch (e) { return GREEN; } }

  /* ---------- the tasks and projects the page already holds ---------- */
  function tasks() { try { return (typeof DB_TASKS !== 'undefined' && DB_TASKS) || []; } catch (e) { return []; } }
  function taskById(id) { return tasks().filter(function (t) { return String(t.id) === String(id); })[0] || null; }
  function projects() { try { return (window.w116Projects ? window.w116Projects() : (typeof WA27_PROJECTS !== 'undefined' ? WA27_PROJECTS : [])) || []; } catch (e) { return []; } }
  function projById(id) { return projects().filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  /* a team's general list (the catch-all project each team has) never goes to the bank */
  var GENERAL = ['general ops toronto', 'general ops montreal', 'general hr', 'general marketing', 'general fundraising', 'general governance', 'general program development', 'general programs'];
  function isGeneralList(p) { return !!p && GENERAL.indexOf(lower(p.name)) >= 0; }
  function isBackRecent(t) { if (!t || !t.resurfaced_at || t.done) return false; var at = new Date(t.resurfaced_at).getTime(); return !isNaN(at) && Date.now() - at < BACK_DAYS * 86400000; }
  window.w132Back = isBackRecent;

  var B = { data: null, loading: null, at: 0, ver: 0, err: '', team: '', q: '', open: {}, sheet: null, snackT: null };
