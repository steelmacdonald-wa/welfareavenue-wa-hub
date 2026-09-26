/* =====================================================================
   WA v133 the org chart, interactive (26/09/26)
   =====================================================================
   Steel: "I want the org chart to be more interactive where we can choose direct reports and move
   things around as executives. Executives should also be able to visualize empty positions."

   - The chart (#orgchart) reads the reporting lines: the board, the executive directors, then each
     team with its lead and everyone under them, nested by who reports to whom. Empty positions show
     as dashed cards (open, hiring or on hold, with a note). Search, a team filter and a switch for the
     open positions. Anyone on staff reads it; click anyone to see who they report to and who reports
     to them, and open their profile.
   - Executives and admins: Rearrange (drag someone onto the person they report to, or onto a team to
     make them its lead, with an Undo), choose a person's direct reports, retitle a seat, add an empty
     position under anyone, fill it, take someone off a seat, remove an empty position, and place
     anyone who is not on the chart yet. The database checks each change and keeps it in the audit
     trail; the roster keeps the chart in step (a new person gets a seat, someone who leaves leaves an
     open position).
   - A person's page says who they report to and who reports to them.
   Data: wa133_org (org_positions, wa_org_editor(), org_move(), org_set_reports(), org_add_opening(),
   org_update(), org_fill(), org_place(), org_vacate(), org_remove(), the roster trigger).
   ===================================================================== */
(function () {
  if (window.__wa133) return; window.__wa133 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', INK = '#1F201E', PURPLE = '#6F64AB';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var STATUS = { open: ['Open', 'rgba(16,63,57,.08)', GREEN], hiring: ['Hiring', 'rgba(220,165,39,.22)', '#6b4d05'], on_hold: ['On hold', 'rgba(121,119,115,.16)', '#5c5a56'] };

  var P = {
    x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>', move: '<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    seat: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.8 7-5.8s6.2 2.2 7 5.8"/>', open: '<circle cx="12" cy="8" r="3.5" stroke-dasharray="3 2.2"/><path d="M5 20c.8-3.6 3.6-5.8 7-5.8s6.2 2.2 7 5.8" stroke-dasharray="3 2.2"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', up: '<path d="M12 19V5M6 11l6-6 6 6"/>', undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>', out: '<path d="M14 4.5h5.5v15H14M10 8l-4 4 4 4M6 12h10"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>', mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>',
    crown: '<path d="M4 17.5h16M5 17.5 4 7.5l4.5 4L12 5l3.5 6.5L20 7.5l-1 10"/>', spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>'
  };
  function I(n, cls) { return '<svg class="w133i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function tabOk(id) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { return true; } }
  function teams() { try { return ((window.WA_TEAMS && WA_TEAMS.order) || (typeof DEPT_ORDER !== 'undefined' ? DEPT_ORDER : [])).filter(function (d) { return d !== 'board'; }); } catch (e) { return []; } }
  function teamLabel(d) { try { return (window.WA_TEAMS && WA_TEAMS.labels && WA_TEAMS.labels[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function teamShort(d) { try { return (window.WA_TEAMS && WA_TEAMS.short && WA_TEAMS.short[d]) || teamLabel(d); } catch (e) { return d || ''; } }
  function teamColor(d) { try { return (typeof DEPT_COLOR !== 'undefined' && DEPT_COLOR[d]) || GREEN; } catch (e) { return GREEN; } }
  function members() { try { return ((typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []).filter(function (m) { return m.active !== false; }); } catch (e) { return []; } }
  function memberById(id) { if (id == null) return null; return members().filter(function (m) { return String(m.id) === String(id); })[0] || null; }
  function avatar(m, size) { try { if (window.w116Avatar) return window.w116Avatar(m, size); } catch (e) { /* fine */ } return '<span class="w133ini" style="width:' + size + 'px;height:' + size + 'px">' + E(String((m && m.name) || '?').slice(0, 1)) + '</span>'; }

  var O = { pos: null, loading: null, at: 0, err: '', canEdit: false, arrange: false, q: '', team: '', showOpen: true, sheet: null, drag: null, online: {}, snackT: null, ver: 0 };
