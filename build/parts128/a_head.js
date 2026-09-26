/* =====================================================================
   WA v128 the Executive dashboard, rebuilt around executive decisions (25/09/26)
   =====================================================================
   Steel: "the executive dashboard really needs some work... a lot of buttons that click to random
   places... think about executive decision making, highlights and stuff like that. Make it better."

   A new top of the page (#w128), in the order an executive reads it:
   - The brief: two or three plain sentences built from the data (decisions waiting and how long,
     the fiscal year, event results still missing, quiet teams, the next board meeting), and what is
     next (board meeting, fundraising event, serving).
   - The numbers, each a door to the page that explains it: decisions waiting, raised by the events,
     the organizational goals, open and overdue work (opens the folder in place), servings ahead,
     the team, and donations for people who can see the ledger.
   - Needs a decision: the oldest executive calls with who decides, the suggested move and the AI
     recommendation, and Record the decision (the same record as the list below).
   - To watch: decisions waiting over 60 days, past events with no result, overdue work by team,
     teams with no meeting update in three weeks, delayed goals, board items at risk, the year-end.
   - Highlights: event results, shout-outs, goals closed, work closed, new people, servings held.
   - Coming up: the year-end, board meetings and the committee deadline, events and servings.
   - Teams at a glance: each team's lead, open and overdue work, work closed, last update, goals.
   Cleaned up: the "Your plate" card (it pointed to Home) and its "Open the full dashboard" link (it
   pointed back to this page) are gone, the "Decisions waiting" folder is replaced by Needs a decision,
   the old stat strip gives way to the new numbers, and the page help moves to the masthead.
   The full decision list, What's new, and the Overdue tasks and Delivery numbers folders stay.
   ===================================================================== */
(function () {
  if (window.__wa128) return; window.__wa128 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', PURPLE = '#6F64AB', TEAL = '#2A8C7A', INK = '#1F201E';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var TEAMS = ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var P = {
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', chev: '<path d="m9 5 7 7-7 7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>', cal: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>', money: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    board: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M9 4v16M15 4v16"/>', mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    hand: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10V6a1.5 1.5 0 0 1 3 0v6M16 12v-2a1.5 1.5 0 0 1 3 0v4c0 4-3 7-7 7s-5.5-2-7-4.5L3.5 12a1.5 1.5 0 0 1 2.5-1.5L7 12"/>'
  };
  function I(n, cls) { return '<svg class="w128i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function pad(n) { return String(n).padStart(2, '0'); }
  /* dates field by field (the offline harness shims Date) */
  function mk(y, m, d, h) { var x = new Date(0); x.setFullYear(Number(y), Number(m), Number(d)); x.setHours(h == null ? 12 : Number(h), 0, 0, 0); return x; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? mk(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null; }
  function today() { var d = new Date(); return mk(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  function dayOfIso(iso) { if (!iso) return null; var d = new Date(iso); if (isNaN(d.getTime())) return null; return parseDay(d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })); }
  function fmtDay(d, withYear) { if (!d) return ''; return MONTHS[d.getMonth()] + ' ' + d.getDate() + (withYear ? ', ' + d.getFullYear() : ''); }
  function fmtShort(d) { if (!d) return ''; return DAYS[d.getDay()].slice(0, 3) + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); }
  function money(n) { var v = Math.round(Number(n || 0)); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-CA'); }
  function listJoin(a) { a = a.filter(Boolean); if (a.length < 2) return a.join(''); return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function words(n) { return ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n] || String(n); }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  /* wave130: a serving with no title reads "Sunday serving, Montreal", never its code */
  function servName(v) {
    if (v && v.title && String(v.title).trim()) return String(v.title).trim();
    var kind = String((v && v.kind) || 'service').toLowerCase(), d = v ? parseDay(v.event_date) : null;
    var base = kind === 'service' ? (d && d.getDay() === 0 ? 'Sunday serving' : 'Serving') : kind.charAt(0).toUpperCase() + kind.slice(1);
    return base + (v && v.location ? ', ' + v.location : '');
  }
  function tabOk(t) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(t) >= 0; } catch (e) { return true; } }
  function deptLabel(d) { try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function deptColor(d) { try { return (typeof DEPT_COLOR !== 'undefined' && DEPT_COLOR[d]) || GREEN; } catch (e) { return GREEN; } }
  function myFirst() { try { return String((USER && USER.name) || '').split(' ')[0]; } catch (e) { return ''; } }
  function onOverview() { var a = document.querySelector('.panel.active'); return !!(a && a.id === 'overview'); }
