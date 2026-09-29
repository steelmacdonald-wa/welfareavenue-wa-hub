/* =====================================================================
   WA v131 People and access, one place (26/09/26)
   =====================================================================
   Steel: "In the admin panel 'People and access' and 'access profiles'
   need to make more sense. Please review, I need setting up and managing
   profiles to be more seamless."

   What was confusing: two sections for one job; a wide table with a
   classic role (admin, leader, member, viewer) and an access profile side
   by side; invites that set a classic role, with the profile picked
   somewhere else; hand-picked pages behind a link; the requests in a
   third card; a comparison table in a box with its own scroll.

   Now one section, Admin > People and access, with three tabs:
   - People: what needs doing first (access requests, people without a
     profile, people not invited, missing emails, inactive people who
     can still sign in), then everyone by team: their sign-in status and
     their profile. Click anyone for their sheet: pick the profile (the
     team's own comes first, with a Lead switch), see the pages it opens
     and what changes, invite, resend, copy a sign-in link, add an email,
     remove. Invite someone (or a whole list) with the profile chosen up
     front, from the team.
   - Profiles: the nine profiles as cards; open one to set its pages
     (Everyone, Leads, Nobody), its words and see who has it; new pages
     to decide; every profile compared, full height; the automatic
     profile for new people.
   - Requests: grant a page (on top of the profile), the lead option or
     Admin in one click, or decline.
   The role is never picked by hand any more: it follows the profile
   (team profile = member, with Lead = leader; Executive = leader; Board
   member = viewer; Admin = admin). The classic view (the old table, the
   roles table and the hand-picked pages) stays one link away.
   Data: hub_roles, team_members, wa_hub_logins(), hub_access_profiles,
   hub_access_settings, wa_access_requests; actions through hub-invite
   (invite, bulk_invite, link, set_email, remove). No schema change.
   ===================================================================== */
(function () {
  if (window.__wa131) return; window.__wa131 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var FOUNDERS = ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'];
  var TEAMS = (window.WA_TEAMS && window.WA_TEAMS.order) || ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'];
  var RANK = { viewer: 0, member: 1, leader: 2, admin: 3 };
  var GROUPS = [ /* wave134: the same groups as the menu */
    /* wave163: the menu's new shape: Avenue Academy and The Brain at the top, Other Tools, Organization, and the Strategy and CRM apps */
    ['Everyday', ['mypage', 'training', 'overview', 'dashboard', 'calendar', 'brain']],
    ['Departments', ['opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'contentcal', 'socialstats', 'fundraising', 'fundevents', 'finances', 'hr', 'hrcentre']],
    ['Board', ['board', 'governance', 'committees']],
    ['Other Tools', ['importantinfo', 'bank', 'agendas', 'documents', 'transcripts', 'photos', 'requests', 'create']],
    ['Organization', ['orgchart', 'ourstory', 'hubmail']],
    ['Strategy', ['orggoals', 'goals', 'projects', 'goalmap']],
    ['CRM', ['crm', 'partners']],
    ['Admin', ['adminpanel', 'activity']]
  ];
  var LABEL = {
    mypage: 'Home', calendar: 'Calendar', requests: 'Requests', overview: 'Executive dashboard', dashboard: 'Delivery numbers and donations',
    create: 'Create studio', photos: 'Photo library', brain: 'The Brain', importantinfo: 'Important info', ourstory: 'Our story', partners: 'Partners', documents: 'Document finder',
    orggoals: 'Organizational goals', goals: 'Department goals', projects: 'Projects', goalmap: 'Goal alignment', bank: 'The Task Bank',
    opsmtl: 'Operations Montreal', volunteering: 'MTL volunteering', progdev: 'Program Development', opsto: 'Operations Toronto',
    marketing: 'Marketing, Branding & Web', contentcal: 'Content calendar', socialstats: 'Analytics', fundraising: 'Fundraising & Finances',
    fundevents: 'Events calendar', finances: 'Finances', hr: 'Human Resources', hrcentre: 'HR centre',
    governance: 'Board overview', committees: 'Committees', board: 'Board team page',
    transcripts: 'Transcript archive', agendas: 'Agendas', hubmail: 'Hub inbox', orgchart: 'Org chart', training: 'Avenue Academy', crm: 'CRM',
    activity: 'Activity', adminpanel: 'Admin', team: 'Team pages'
  };
  var LOCK = {
    finances: 'The ledger, budgets and statements follow the profile in the database, not just the menu.',
    governance: 'Board data follows the profile in the database. Directors always see it.',
    committees: 'Board data follows the profile in the database. Directors always see it.',
    adminpanel: 'Only admins can change access, whatever the menu shows.',
    hrcentre: 'Everyone’s time off, discipline and policy sign-offs stay with the HR access list.',
    agendas: 'Each agenda is visible to the person who made it and the people invited.',
    transcripts: 'Private and leadership transcripts stay limited, whatever the page access.',
    bank: 'Moving work in or out of the bank follows the database: staff who can edit tasks, and a project’s lead or a leader for a whole project.',
    orgchart: 'Only admins and the Executive profile rearrange the chart and its open positions; the database enforces it.',
    crm: 'Contacts, their history and their email permission follow the profile in the database, not just the menu. Directors never see them.'
  };
  var P = {
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="m9 5 7 7-7 7"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M16 7l2.5 2.5M14 9l2 2"/>',
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    inbox: '<path d="M3.5 13.5 6 5.5h12l2.5 8v5h-17z"/><path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>', out: '<path d="M14 4.5h5.5v15H14M10 8l-4 4 4 4M6 12h10"/>',
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.9-3.8 3.7-6 7-6s6.1 2.2 7 6"/>', list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>'
  };
  function I(n, cls) { return '<svg class="w131i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function listJoin(a) { a = (a || []).filter(Boolean); if (a.length <= 1) return a.join(''); return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function initials(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function nameFromEmail(em) { return String(em || '').split('@')[0].split(/[._-]+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); }
  function ago(ts) {
    if (!ts) return '';
    var d = new Date(ts).getTime(); if (isNaN(d)) return '';
    var s = Math.max(0, (Date.now() - d) / 1000);
    if (s < 3600) return 'just now';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    var days = Math.round(s / 86400);
    if (days === 1) return 'yesterday';
    if (days < 45) return days + ' days ago';
    return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function myEmail() { try { return lower((USER && USER.email) || ''); } catch (e) { return ''; } }
  function actor() { try { return (typeof who === 'function' && who()) || myEmail(); } catch (e) { return myEmail(); } }
  function amAdmin() { try { return FOUNDERS.indexOf(myEmail()) >= 0 || !!(typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role === 'admin'); } catch (e) { return false; } }
  function teamLabel(d) { try { return (window.WA_TEAMS && window.WA_TEAMS.labels && window.WA_TEAMS.labels[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function teamColor(d) { try { return (typeof DEPT_COLOR !== 'undefined' && DEPT_COLOR[d]) || GREEN; } catch (e) { return GREEN; } }
  function labelOf(t) { return LABEL[t] || (function () { try { var b = document.querySelector('#tabBar .tab[data-tab="' + t + '"]'); return b ? String(b.textContent || '').trim() : t; } catch (e) { return t; } })(); }
  async function logChange(type, id, field, oldV, newV) {
    try { await db.from('change_log').insert({ entity_type: type, entity_id: String(id), field: field, old_value: oldV == null ? null : String(oldV).slice(0, 500), new_value: newV == null ? null : String(newV).slice(0, 500), changed_by: actor() }); } catch (e) { /* the audit trail is best effort */ }
  }
  async function invoke(body) {
    var r = await db.functions.invoke('hub-invite', { body: body });
    if (r && r.error) {
      var msg = '';
      try { if (r.error.context && r.error.context.json) msg = (await r.error.context.json()).error; } catch (e) { /* fine */ }
      throw new Error(msg || r.error.message || 'failed');
    }
    if (!r || !r.data) throw new Error('no reply from the Hub');
    if (r.data.error) throw new Error(r.data.error);
    return r.data;
  }
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try { var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); return !!ok; } catch (e) { return false; }
  }
  /* the same words as wave113's message, so both views send one message */
  function inviteMessage(name) {
    return 'Hi ' + (first(name) || 'there') + ', you have been added to the Welfare Avenue Hub, the team\'s shared workspace: meetings turn into tasks, goals and decisions, and everyone can see how the work moves.\n\nSign in with your Welfare Avenue Google account at https://wa-exec-dashboard.netlify.app/\n\nThe 60 second tour starts on your first visit, and a short getting-started checklist on your home page walks you through the rest.';
  }
