/* =====================================================================
   WA v134 the audit: one menu layout, and Ask the Hub's E (26/09/26)
   =====================================================================
   Steel: "the department section is well formatted because it just has the departments but the
   other sections like strategy and other and admin like maybe regroup those into different
   categories on whatever makes sense" and "ASK THE HUB should have an animation that the E in THE
   should expand instead of the E alone on the left".

   - One place decides the menu: WA_NAV.layout below, applied by WA_NAV.applyLayout(). Home, the
     Executive dashboard and the Calendar sit at the top; Departments stay as they are; then Goals
     and projects, Meetings, Requests and inbox, People, Resources and Admin, whose sections (People
     and access, Security and audit trail, AI models ...) are menu items of their own. Directors
     (the board view) get a Board group. Buttons are moved, never rebuilt, so their wiring holds.
     The older placement code (waves 95, 116d, 116h, 124, 126, 132) defers to the layout when it is
     on, and page crumbs, the access profile editor and the menu tour use the same groups.
   - Ask the Hub: at rest the brand E; on hover or focus "ASK TH" and "HUB" open around it and its
     bars stretch, so the E is the E of THE.
   ===================================================================== */
(function () {
  if (window.__wa134) return; window.__wa134 = true;
  if (!window.WA_NAV) return;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#797773';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- the layout: the one list of where every page sits in the menu ---------- */
  var LAYOUT = {
    top: ['mypage', 'overview', 'calendar'],
    groups: [
      /* directors (the board view) cannot open the Board & Governance team page, so its two pages get a group */
      { key: 'board', label: 'Board', items: ['governance', 'committees'], loose: true },
      /* the team rows are built by wave116 (and flattened by wave127 for people who cannot open a team page) */
      { key: 'departments', label: 'Departments' },
      { key: 'goals', label: 'Goals and projects', items: ['orggoals', 'goals', 'projects', 'goalmap', 'brain', 'bank'] },
      { key: 'meetings', label: 'Meetings', items: ['agendas', 'transcripts'] },
      { key: 'inbox', label: 'Requests and inbox', items: ['requests', 'hubmail'] },
      { key: 'people', label: 'People', items: ['orgchart', 'training'] },
      { key: 'resources', label: 'Resources', items: ['importantinfo', 'photos'] },
      /* Admin's own sections (wave118's links) follow the Admin page button, which the menu keeps out of sight */
      { key: 'admin', label: 'Admin', items: ['adminpanel', 'activity'] }
    ],
    /* the Events calendar sits in the Fundraising row for people who can open that team page, else right after the Calendar */
    afterCalendar: ['fundevents'],
    /* pages the older code hides on purpose (merged into others): kept out of sight at the end */
    hidden: ['dashboard', 'create']
  };
  /* the label each button shows (the older code named a few differently) */
  var LABEL = { transcripts: 'Transcript archive' };
