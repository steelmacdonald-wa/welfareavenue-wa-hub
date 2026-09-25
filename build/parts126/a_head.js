/* =====================================================================
   WA v126 the board: the three jobs of a board, the committees, and each director's progress (25/09/26)
   =====================================================================
   Steel, with the July 22 board deck (slides 16 to 27): "the board section should form itself around
   the 3 board responsibilities, Committees should be it's own section divided by the 4 pillars to
   strategic direction. I want to see how each board member is making progress in that area."
   Board members log their own committee touchpoints; everything else stays read-only for them.

   - Board overview (#governance): the next board meeting and the cycle, the three jobs (steward
     leadership, fiduciary oversight, direction and strategy) with where each item stands, the
     renewals, the finances and the strategy steps, and every director's progress.
   - Committees (#committees): Fundraising, HR & People, Operations and Fiduciary, each with its chair,
     directors, internal leads and the outside professional to recruit, the cycle (chair, internal
     touchpoint, external touchpoint, bring it to the board) for the next board meeting, each director's
     part, and the log. Strategy stays with the whole board.
   Data: wa126_board (board_members, board_committees, board_meetings, board_items, board_touchpoints,
   board_home(), board_me(), can_see_board()). Seen by directors, advisers, board viewers, leaders and admins.
   ===================================================================== */
(function () {
  if (window.__wa126) return; window.__wa126 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var JOBS = [
    { k: 'steward', n: 1, t: 'Steward leadership', d: 'Appoint and support the executive directors, and own succession so there is never a gap.', c: GREEN },
    { k: 'fiduciary', n: 2, t: 'Fiduciary oversight', d: 'Watch the finances, risk and compliance, including board (D&O) insurance.', c: PURPLE },
    { k: 'strategy', n: 3, t: 'Direction and strategy', d: 'Decide where we are going in the next three years, and hold the organization to it.', c: '#2A6F55' }
  ];
  var JOB = {}; JOBS.forEach(function (j) { JOB[j.k] = j; });
  var ORDER = ['fundraising', 'people', 'operations', 'fiduciary'];
  var ST = {
    done: ['Done', 'rgba(16,63,57,.1)', GREEN], in_progress: ['In progress', 'rgba(42,140,122,.15)', '#1d6b5d'], todo: ['To do', 'rgba(121,119,115,.14)', '#5c5a56'],
    at_risk: ['At risk', 'rgba(179,64,47,.13)', FLAG], watch: ['Watch', 'rgba(220,165,39,.2)', '#6b4d05'], standing: ['Every meeting', 'rgba(111,100,171,.14)', '#4a4180']
  };
  var KINDS = [
    ['internal', 'Internal touchpoint', 'Met the team lead to get the real picture from the ground'],
    ['external', 'External working session', 'A 30 to 60 minute session with a professional from our networks'],
    ['meeting', 'Committee meeting', 'The committee met'],
    ['recommendation', 'Recommendation for the board', 'An informed view to bring to the board meeting'],
    ['note', 'Note', 'Anything else worth keeping']
  ];
  var KIND = {}; KINDS.forEach(function (k) { KIND[k[0]] = k; });
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var P = {
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="m9 5 7 7-7 7"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    crown: '<path d="M4 17.5h16M5 17.5 4 7.5l4.5 4L12 5l3.5 6.5L20 7.5l-1 10"/>',
    handshake: '<path d="m3 12 3.5-3.5L10 10l2-2 4 1 5 3.5"/><path d="M8.5 14.5 11 17c.6.6 1.5.6 2.1 0l4.4-4.4M6.5 12.5l2 2M3 12l3.5 3.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', doc: '<path d="M6.5 3.5h7L18 8v12.5h-11.5z"/><path d="M13.5 3.5V8H18M9 12.5h6M9 16h6"/>',
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    cal: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>', money: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>'
  };
  function I(n, cls) { return '<svg class="w126i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function pad(n) { return String(n).padStart(2, '0'); }
  /* dates built field by field (the offline harness swaps Date for a shim that mishandles 3 to 6 arguments) */
  function mk(y, m, d, h) { var x = new Date(0); x.setFullYear(Number(y), Number(m), Number(d)); x.setHours(h == null ? 12 : Number(h), 0, 0, 0); return x; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? mk(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null; }
  function today() { var d = new Date(); return mk(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  function fmtDay(d, withYear) { if (!d) return ''; return MONTHS[d.getMonth()] + ' ' + d.getDate() + (withYear ? ', ' + d.getFullYear() : ''); }
  function fmtWhen(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d.getTime())) return ''; var t = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }).replace(':00', '').replace(/\s?([ap])\.?m\.?/i, function (x, p) { return p.toLowerCase() + 'm'; }); var w = d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Toronto' }); return w + ', ' + t; }
  function dayOfIso(iso) { if (!iso) return null; var d = new Date(iso); if (isNaN(d.getTime())) return null; var s = d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); return parseDay(s); }
  function money(n) { var v = Math.round(Number(n || 0)); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-CA'); }
  function initials(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } }
