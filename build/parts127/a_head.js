/* =====================================================================
   WA v127 access profiles: one profile per team, the board, executives and admins, and a page that
   says plainly what each one gives access to (25/09/26)
   =====================================================================
   Steel: "make a role for a marketing team member, a fundraising team member, ... program development,
   operations Montreal, Toronto, a board member access profile, and as well as a executive and admin
   access profile. It's really important that you make it very clear in that page what each role
   provides access to." And: review the security roles and the Hub training whenever the Hub changes.

   - Nine profiles in hub_access_profiles (Marketing, Fundraising, Program Development,
     Operations Montreal, Operations Toronto, HR & People, Board member, Executive, Admin). A team
     profile has a lead option (hub_roles.role = leader). Each page is open to everyone with the
     profile, to its leads only, or to nobody.
   - Admin > Access profiles (#adminpanel/access): a card per profile (who it is for, what it lets you
     do, its pages, what it leaves out, who has it), every page compared across the profiles (admins
     click a cell to change it), the proposed profile for each person with what they would gain and
     lose, and the pages nobody has decided yet (new pages land there after every release).
   - People and access: the Access column picks a profile (or a classic role).
   - Your access (the profile menu): your profile, your pages and what you can do.
   - The database follows the profile for the finances and the board pages (wa_page_ok); other pages
     are menu only, and their data is shared with the team as before. Nothing changes for anyone
     until an admin gives them a profile.
   ===================================================================== */
(function () {
  if (window.__wa127) return; window.__wa127 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', PURPLE = '#6F64AB', INK = '#1F201E';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var FOUNDERS = ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'];
  var DEPTS = ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'];
  var RANK = { viewer: 0, member: 1, leader: 2, admin: 3 };

  /* the pages, grouped the way the menu groups them; 'team' is the team-page router and follows the department pages */
  var GROUPS = [ /* wave134: the same groups as the menu */
    /* wave163: the menu's new shape: Avenue Academy and The Brain at the top, Other Tools, Organization, and the Strategy and CRM apps */
    ['Everyday', ['mypage', 'training', 'overview', 'dashboard', 'requests', 'calendar', 'brain']],
    ['Teams', ['opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'contentcal', 'socialstats', 'studio', 'fundraising', 'fundevents', 'fund', 'finances', 'hr', 'hrcentre']],   /* wave193: fund, the Fundraising app */
    ['Board', ['board', 'governance', 'committees']],
    ['Other Tools', ['importantinfo', 'bank', 'agendas', 'documents', 'transcripts', 'photos', 'create']],
    ['Organization', ['orgchart', 'ourstory', 'hubmail']],
    ['Strategy', ['orggoals', 'goals', 'projects', 'goalmap']],
    ['CRM', ['crm', 'partners']],
    ['Admin', ['adminpanel', 'activity']]
  ];
  var LABEL = {
    mypage: 'Home', calendar: 'Calendar', requests: 'Team Requests', overview: 'Executive dashboard', dashboard: 'Delivery numbers and donations',
    create: 'Create studio', photos: 'Photo library', brain: 'The Brain', importantinfo: 'Important info', ourstory: 'Our story', partners: 'Partners', documents: 'Document finder',
    orggoals: 'Goals and the Strategy Library', goals: 'Department goals (retired)', projects: 'Projects', goalmap: 'Goal alignment', bank: 'The Task Bank',
    opsmtl: 'Operations Montreal', volunteering: 'Volunteer Manager', progdev: 'Program Development', opsto: 'Operations Toronto',
    marketing: 'Marketing, Branding & Web', contentcal: 'Content calendar', socialstats: 'Analytics', studio: 'Content Studio', fundraising: 'Fundraising',
    fundevents: 'Events calendar', fund: 'Fundraising app', finances: 'Finance', hr: 'Human Resources', hrcentre: 'HR centre',
    governance: 'Board overview', committees: 'Committees', board: 'Board team page',
    transcripts: 'Transcript archive', agendas: 'Agendas', hubmail: 'Hub inbox', orgchart: 'Org chart', training: 'Avenue Academy', crm: 'CRM',
    activity: 'Activity', adminpanel: 'Admin', team: 'Team pages'
  };
  /* what the database enforces on top of the menu */
  var LOCK = {
    finances: 'The ledger, budgets and statements follow the profile in the database, not just the menu.',
    governance: 'Board data follows the profile in the database. Directors always see it.',
    committees: 'Board data follows the profile in the database. Directors always see it.',
    adminpanel: 'Only admins can change access, whatever the menu shows.',
    hrcentre: 'Everyone\'s time off, discipline and policy sign-offs stay with the HR access list.',
    agendas: 'Each agenda is visible to the person who made it and the people invited.',
    transcripts: 'Private and leadership transcripts stay limited, whatever the page access.',
    bank: 'Moving work in or out of the bank follows the database: staff who can edit tasks, and a project’s lead or a leader for a whole project.',
    orgchart: 'Only admins and the Executive profile rearrange the chart and its open positions; the database enforces it.',
    crm: 'Contacts, their history and their email permission follow the profile in the database, not just the menu. Directors never see them.',
    fund: 'The grants, the funders, the fact base and the drafts follow the profile in the database (wa_fund_ok), not just the menu. Leaders and admins delete; the scanner and the writer check the same gate.',
    studio: 'Publishing without an approval, the connections and deleting comments follow the database (wa225_publisher: marketing leads and admins); replying to comments and the library follow the marketing team (wa225_marketing).'
  };
  var SHORT = { marketing: 'Marketing', fundraising: 'Fundraising', progdev: 'Program Dev.', opsmtl: 'Montreal ops', opsto: 'Toronto ops', hr: 'HR & People', board: 'Board', executive: 'Executive', admin: 'Admin' };

  var P = {
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="m9 5 7 7-7 7"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M16 7l2.5 2.5M14 9l2 2"/>',
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>',
    alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>', eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    minus: '<path d="M6 12h12"/>', undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>'
  };
  function I(n, cls) { return '<svg class="w127i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function myEmail() { try { return lower(USER && USER.email); } catch (e) { return ''; } }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function mine() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE) || null; } catch (e) { return null; } }
  function myRole() { var m = mine(); return (m && m.role) || ''; }
  function amAdmin() { return FOUNDERS.indexOf(myEmail()) >= 0 || myRole() === 'admin'; }
  function rolesAll() { try { return (typeof WA40_ROLES !== 'undefined' && WA40_ROLES) || []; } catch (e) { return []; } }
  function listJoin(a) { a = a.filter(Boolean); if (a.length < 2) return a.join(''); return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function deptLabel(d) { try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || LABEL[d] || d || ''; } catch (e) { return LABEL[d] || d || ''; } }
  function actor() { try { if (typeof who === 'function') return who(); } catch (e) { /* fine */ } try { return (typeof USER !== 'undefined' && USER && USER.email) || 'admin'; } catch (e) { return 'admin'; } }
  function onAccess() { return (location.hash || '').indexOf('#adminpanel/access') === 0; }
