/* =====================================================================
   WA v124 the calendar, the fundraising events calendar and birthdays (25/09/26)
   =====================================================================
   Steel: "set up fundraising events calendar under fundraising and
   finance tab", "a master calendar with all fundraising events, meetings
   (limited to each user and where they are invited), marketing posts
   past and future, volunteering events, etc", and "allow individuals to
   add birthdays to their profile".

   - Calendar (#calendar, under Home in the menu): month and agenda views
     with five layers you switch on and off: fundraising events, your
     meetings (only the ones you are invited to: calendar_my_meetings()
     matches your email, its Workspace aliases and its dotless spelling),
     marketing posts (published on Instagram, Facebook and LinkedIn, and
     planned or scheduled in the content calendar), volunteering events
     and birthdays. Month-long and season-long fundraising events sit in a
     band above the grid. Up next, the month's birthdays, and a sheet for
     every item with its links (join the meeting, the event's board, the
     post, the serving, the person).
   - Events calendar (#fundevents, Fundraising & Finances): the 2026-27
     plan season by season (fund_events, seeded from "Fundraising Events
     Calendar 2026-27"), the goals ($10K minimum, $15K healthy, $20K
     target) with what the events raised, a year strip, the ideas
     backlog, the planning notes, and add, edit and record results.
   - Birthdays (hub_birthdays): month and day only, entered by the person
     on their own profile page, shown on the calendar to everyone, their
     team or only them, as they choose.
   Data: wa124_calendar (fund_events, hub_settings fund_goals,
   hub_birthdays, hub_directory.aliases, my_emails(),
   calendar_my_meetings()); directory-sync v1.4 keeps the aliases.
   ===================================================================== */
(function () {
  if (window.__wa124) return; window.__wa124 = true;
  var T = window.WA_TEAMS || { order: ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'], labels: {}, short: {} };
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var LAYERS = [
    { k: 'fund', l: 'Fundraising events', c: '#C8961F', bg: 'rgba(220,165,39,.18)', ink: '#6b4d05', icon: 'heart' },
    /* wave130: the board's dates (board meetings, the committees' week before, the fiscal year-end); only for those who can read the board */
    { k: 'board', l: 'Board', c: '#4a4944', bg: 'rgba(31,32,30,.09)', ink: INK, icon: 'seat' },
    { k: 'meet', l: 'My meetings', c: GREEN, bg: 'rgba(16,63,57,.10)', ink: GREEN, icon: 'people' },
    { k: 'post', l: 'Marketing posts', c: PURPLE, bg: 'rgba(111,100,171,.14)', ink: '#4a4180', icon: 'megaphone' },
    { k: 'vol', l: 'Volunteering', c: TEAL, bg: 'rgba(42,140,122,.14)', ink: '#1d6b5d', icon: 'pot' },
    { k: 'bday', l: 'Birthdays', c: FLAG, bg: 'rgba(179,64,47,.11)', ink: FLAG, icon: 'cake' }
  ];
  var LAYER = {}; LAYERS.forEach(function (x) { LAYER[x.k] = x; });
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var SEASONS = [
    ['summer-2026', 'Summer 2026', 'Season kickoff'],
    ['fall-2026', 'Fall 2026', 'October to December'],
    ['winter-2027', 'Winter 2027', 'January to March'],
    ['spring-2027', 'Spring and summer 2027', 'April to July, the next cycle starts'],
    ['backlog', 'Ideas and backlog', 'Not yet scheduled']
  ];
  var STATUS = { idea: ['Idea', 'rgba(121,119,115,.14)', '#5c5a56'], planned: ['Planned', 'rgba(220,165,39,.2)', '#6b4d05'], confirmed: ['Confirmed', 'rgba(42,140,122,.16)', '#1d6b5d'], done: ['Done', 'rgba(16,63,57,.1)', GREEN], cancelled: ['Cancelled', 'rgba(179,64,47,.12)', FLAG] };
  var PLATFORM = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok' };

  var P = {
    chevl: '<path d="m15 5-7 7 7 7"/>', chevr: '<path d="m9 5 7 7-7 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
    pot: '<path d="M4 10h16v5.5A4.5 4.5 0 0 1 15.5 20h-7A4.5 4.5 0 0 1 4 15.5z"/><path d="M2.5 10h19M9 6.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5"/>',
    cake: '<path d="M4 20.5h16M5 20.5v-7.5a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 1.5 1.5v7.5"/><path d="M5 15.5c1.2 1 2.3 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0M12 11.5v-3M12 4.5c-.9.9-.9 2 0 2.5.9-.5.9-1.6 0-2.5z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    video: '<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5"/>', grid: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>', spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>',
    doc: '<path d="M6.5 3.5h7L18 8v12.5h-11.5z"/><path d="M13.5 3.5V8H18M9 12.5h6M9 16h6"/>',
    seat: '<path d="M4 9.5 12 5l8 4.5"/><path d="M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20h17"/>', board: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M9 4v16M15 4v9"/>'
  };
  function I(n, cls) { return '<svg class="w124i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  /* dates built field by field (the offline harness swaps Date for a shim that mishandles 3 to 6 arguments) */
  function mk(y, m, d, h) { var x = new Date(0); x.setFullYear(Number(y), Number(m), Number(d)); x.setHours(h == null ? 12 : Number(h), 0, 0, 0); return x; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? mk(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null; }
  function today() { var d = new Date(); return mk(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function monthStart(d) { return mk(d.getFullYear(), d.getMonth(), 1, 12); }
  function addMonths(d, n) { return mk(d.getFullYear(), d.getMonth() + n, 1, 12); }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function fmtTime(d) { return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(/\s?([ap])\.?m\.?/i, function (x, p) { return p.toLowerCase() + 'm'; }); }
  function fmtDate(d, opt) { return d.toLocaleDateString('en-CA', opt || { weekday: 'short', month: 'short', day: 'numeric' }); }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-CA', { maximumFractionDigits: 0 }); }
  function kMoney(n) { n = Number(n || 0); return n >= 1000 ? '$' + (Math.round(n / 100) / 10).toString().replace(/\.0$/, '') + 'K' : money(n); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } }
  function initials(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
