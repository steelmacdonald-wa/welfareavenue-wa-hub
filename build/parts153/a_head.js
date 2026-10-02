/* =====================================================================
   WA v153 the apps: a 9-dot launcher, an app frame with its own rail, and the CRM as the first app (27/09/26)
   =====================================================================
   Steel (wave149): "the app launcher (9-dot, bottom left: Admin centre, HR centre, Finance with the
   finances pages only, then the CRM)". Steel (wave152): "remember the 9 dots for the Finances module, HR
   center module, and CRM module? ... the CRM will need space both at the top for menu and search options,
   as well as on the side for all the options like email marketing, fundraising, etc". And: "Okay go for it
   step 1 first".

   - A dock at the bottom of the menu (a 9-dot button, "Apps") opens the launcher: the Hub, the CRM, the
     HR centre, Finance and the Admin centre. Only the apps this person can open are offered (an app is
     there when one of its pages is), and directors (the board view) get none.
   - Inside an app the menu becomes the app's rail (its pages and sections, the current one marked) with
     "Back to the Hub" in the dock, and an app bar above the page names the app and where you are, with the
     app's quick actions (the CRM: add a contact). The pages themselves are the ones that already exist:
     nothing is rebuilt, the rail and the bar are a frame around them.
   - Steel (27/09/26, after the first cut): "all the pages that are shown on the apps now, they should just
     not be shown on the hub ... I also don't want you to combine things that are on the hub with things
     that are in the apps. They basically be separate." So an app's pages leave the Hub's menu (the CRM, the
     HR centre, Finances, the Admin sections and Activity are reached through the launcher only), an app
     holds nothing but its own pages, and any address of an app's page opens that app's frame; Back to the
     Hub returns to the page you left.
   - Search everything finds contacts too (staff with the CRM), first when you are in the CRM.
   - The CRM gains a Gifts tab (#crm/gifts): every gift with its donor, campaign, platform and receipt.
   - wave193 (02/10/26): the Fundraising app (Overview, Events, Calendar, Donor program, Event SOPs, and the Grants group:
     Pipeline, Found for you, Funders, Writer, Playbook, Fact base), the page #fund with its sections by address.
   ===================================================================== */
(function () {
  if (window.__wa153) return; window.__wa153 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#797773', TEAL = '#2A8C7A', FLAG = '#B3402F', ORANGE = '#c87a2f', SLATE = '#5C5A56', PURPLE = '#6F64AB', FINGOLD = '#B9851B';   /* wave164: Finance has its own colour, apart from Fundraising's orange */
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var KEY_LAST = 'wa153.last';

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function fold(s) { try { return lower(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { return lower(s); } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- icons ---------- */
  var P = {
    grid: '<circle cx="5" cy="5" r="1.9"/><circle cx="12" cy="5" r="1.9"/><circle cx="19" cy="5" r="1.9"/><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/><circle cx="5" cy="19" r="1.9"/><circle cx="12" cy="19" r="1.9"/><circle cx="19" cy="19" r="1.9"/>',
    home: '<path d="M4 11.5 12 4.5l8 7"/><path d="M6.5 10.5V19.5h11v-9"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    merge: '<path d="M6 4v5a5 5 0 0 0 5 5h2a5 5 0 0 1 5 5v1"/><path d="m15 17 3 3 3-3"/><path d="M18 4v5"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    clip: '<rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6"/>',
    coins: '<circle cx="9" cy="9" r="5"/><path d="M14.5 10.5a5 5 0 1 1-4 4"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    back: '<path d="m10 6-6 6 6 6"/><path d="M4 12h16"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chart: '<path d="M4 19h16"/><path d="M7 16V9M12 16V5M17 16v-6"/>',
    mail: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="m4.5 7.5 7.5 6 7.5-6"/>',
    list: '<path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>',
    bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>',
    form: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
    org: '<rect x="9" y="3.5" width="6" height="4" rx="1"/><rect x="3" y="15.5" width="6" height="4" rx="1"/><rect x="15" y="15.5" width="6" height="4" rx="1"/><path d="M12 7.5v4M6 15.5v-4h12v4"/>',
    cap: '<path d="m3 9 9-4 9 4-9 4z"/><path d="M6.5 10.6V15c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.4"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M16 7l2.5 2.5M14 9l2 2"/>',
    star: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    /* wave163: the Strategy app and Partners in the CRM */
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
    flag: '<path d="M6 21V3.5"/><path d="M6 4.5h11l-2.3 4.2L17 13H6"/>',
    layers: '<path d="m12 3.5 8.5 4.3L12 12 3.5 7.8z"/><path d="m3.5 12 8.5 4.2 8.5-4.2"/><path d="m3.5 16.2 8.5 4.3 8.5-4.3"/>',
    tree: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v10M12 11.5H5V17M12 11.5h7V17"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.1-1.1"/>',
    /* wave164: Finance's Tasks */
    check: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="m8.5 12.3 2.4 2.4 4.6-4.9"/>',
    /* wave176: the Volunteer Manager */
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    pot: '<path d="M4 10.5h16l-1.5 8a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
    box: '<path d="m12 3.5 8 4v9l-8 4-8-4v-9z"/><path d="m4 7.5 8 4 8-4M12 11.5v9"/>',
    /* 01/10/26: the Website link (a globe, and the arrow that says it opens elsewhere) */
    /* wave193: the Fundraising app's rail */
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    book: '<path d="M5 4.5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5z"/><path d="M19 4.5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.5 3.6 5.3 3.6 8.5s-1.2 6-3.6 8.5c-2.4-2.5-3.6-5.3-3.6-8.5s1.2-6 3.6-8.5z"/>',
    ext: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4.5"/>'
  };
  function I(n, cls) { return '<svg class="w153i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="' + (n === 'grid' ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.star) + '</svg>'; }

  /* ---------- the apps: which pages each one frames ----------
     an item is {h: hash, l: label, ic: icon, page: the page (tab) it needs, sec: a section switch on that page} */
  var ADMIN_FALLBACK = [['people', 'People and access'], ['access', 'Access profiles'], ['security', 'Security and audit trail'], ['ai', 'AI models'], ['adoption', 'Adoption'], ['accounts', 'Workspace accounts'], ['loading', 'Loading screen and news'], ['change', 'Change the Hub']];
  function adminSections() {
    var A = window.__wa118 && window.__wa118.ADMIN;
    var list = Array.isArray(A) && A.length ? A : ADMIN_FALLBACK;
    return list.map(function (a) { return { h: '#adminpanel/' + a[0], l: a[1], ic: { people: 'people', access: 'key', security: 'shield', ai: 'star', adoption: 'chart', accounts: 'mail', loading: 'bell', change: 'form' }[a[0]] || 'star', page: 'adminpanel' }; });
  }
  var APPS = {
    hub: { id: 'hub', label: 'Hub', color: GREEN, ic: 'home', blurb: 'Teams, tools, the organization and everything else', pages: [] },
    /* wave163: Steel: "Could you add the following pages to an App called strategy" (Organizational goals, Department goals,
       Projects, Goal alignment); a project's own page (#project/...) opens inside it too, with Projects marked */
    strategy: { id: 'strategy', label: 'Strategy', color: PURPLE, ic: 'target', blurb: 'Goals, projects and how they line up', pages: ['orggoals', 'goals', 'projects', 'goalmap', 'project'], home: '#orggoals',
      groups: function () {
        return [{ label: 'Goals and projects', items: [
          { h: '#orggoals', l: 'Organizational goals', ic: 'target', page: 'orggoals' },
          { h: '#goals', l: 'Department goals', ic: 'flag', page: 'goals' },
          { h: '#projects', l: 'Projects', ic: 'layers', page: 'projects' },
          { h: '#goalmap', l: 'Goal alignment', ic: 'tree', page: 'goalmap' }
        ] }];
      }
    },
    /* wave163: Steel: "move partners to the CRM for now" (Partners, collaborators and sponsors: #partners) */
    crm: { id: 'crm', label: 'CRM', color: TEAL, ic: 'people', blurb: 'Contacts, partners, gifts, email', pages: ['crm', 'partners'], home: '#crm',
      groups: function () {
        return [{ label: 'Contacts', items: [
          { h: '#crm', l: 'Contacts', ic: 'people', page: 'crm' },
          { h: '#partners', l: 'Partners', ic: 'link', page: 'partners' },
          { h: '#crm/dupes', l: 'Possible duplicates', ic: 'merge', page: 'crm' },
          { h: '#crm/sources', l: 'Sources', ic: 'db', page: 'crm' },
          { h: '#crm/lists', l: 'Lists', ic: 'list', page: 'crm' },
          { h: '#crm/forms', l: 'Forms', ic: 'form', page: 'crm' }
        ] }, { label: 'Giving', items: [
          { h: '#crm/gifts', l: 'Gifts', ic: 'heart', page: 'crm' }
        ] }, { label: 'Email', items: [
          { h: '#crm/email', l: 'Email', ic: 'mail', page: 'crm' },
          { h: '#crm/campaigns', l: 'Campaigns', ic: 'send', page: 'crm' },
          { h: '#crm/automations', l: 'Automations', ic: 'bolt', page: 'crm' }
        ] }, { label: 'Reports', items: [
          { h: '#crm/reports', l: 'Reports', ic: 'chart', page: 'crm' }
        ] }];
      },
      actions: [{ k: 'add', l: 'Add a contact', ic: 'plus', page: 'crm' }]   /* wave163: on the contacts page only (Partners has its own Add a partner) */
    },
    hr: { id: 'hr', label: 'HR centre', color: FLAG, ic: 'clip', blurb: 'People records, onboarding, hours, policies', pages: ['hrcentre'], home: '#hrcentre',
      groups: function () {
        /* the page's own tabs once it has drawn (they depend on the person: the People view needs the HR access list); the known list before */
        var IC = { people: 'people', onboarding: 'clip', training: 'cap', recruitment: 'star', hours: 'chart', policies: 'form', discipline: 'shield', analytics: 'chart' };   /* wave181: Analytics (HR and admins) */
        var known = [['people', 'People'], ['onboarding', 'Onboarding'], ['training', 'Training'], ['recruitment', 'Recruitment'], ['hours', 'Commitment'], ['policies', 'Policies'], ['discipline', 'Discipline']];
        var drawn = Array.prototype.map.call(document.querySelectorAll('#hrcentre .w47tab[data-w47v]'), function (b) {
          var k = b.getAttribute('data-w47v'), t = (b.childNodes[0] && b.childNodes[0].nodeType === 3 ? b.childNodes[0].textContent : b.textContent) || k;
          var n = String(b.textContent || '').match(/(\d+)\s*$/);   /* wave164: the tab's count moves into the rail (the tabs are hidden on a computer) */
          return [k, String(t).replace(/\d+$/, '').trim() || k, n ? n[1] : null];
        });
        /* the page drawn with no tabs is its notice (the HR centre is for admins and leaders): the rail says just the page */
        var pn = document.getElementById('hrcentre'), notice = !drawn.length && !!pn && pn.classList.contains('active') && /for admins and leaders/i.test(pn.textContent || '');
        if (notice) return [{ label: 'HR centre', items: [{ h: '#hrcentre', l: 'HR centre', ic: 'clip', page: 'hrcentre' }] }];
        var list = drawn.length >= 3 ? drawn : known;
        return [{ label: 'HR centre', items: list.map(function (x) { return { h: '#hrcentre/' + x[0], l: x[1], ic: IC[x[0]] || 'star', page: 'hrcentre', sec: x[0], n: x[2] || null }; }) }];
      }
    },
    /* wave164: Steel: "still shows fundraising and finance being togther. these should be seperate": Finance is an app of its own,
       apart from Fundraising (its own gold), with its own Tasks (department finance) */
    finance: { id: 'finance', label: 'Finance', color: FINGOLD, ic: 'coins', blurb: 'The ledger, the budget and the finance work', pages: ['finances'], home: '#finances',
      groups: function () {
        return [{ label: 'Finance', items: [
          { h: '#finances', l: 'Overview', ic: 'home', page: 'finances', sec: 'overview' },
          { h: '#finances', l: 'Tasks', ic: 'check', page: 'finances', sec: 'tasks' },
          { h: '#finances', l: 'Trends', ic: 'chart', page: 'finances', sec: 'trends' },
          { h: '#finances', l: 'Money map', ic: 'coins', page: 'finances', sec: 'money' },
          { h: '#finances', l: 'Budget', ic: 'list', page: 'finances', sec: 'budget' },
          { h: '#finances', l: 'Transactions', ic: 'db', page: 'finances', sec: 'txns' }
        ] }];
      }
    },
    /* wave176: Steel (30/09/26): "I'd like the MTL Volunteering to be it's own app now, it's big enough that it should be it's own app."
       The Volunteering page (#volunteering and its views: the calendar and each serving, the SOP, volunteers, inventory, recipes) */
    volunteer: { id: 'volunteer', label: 'Volunteer Manager', color: '#3E7C3A', ic: 'heart', blurb: 'MTL servings, rosters, texts and volunteers', pages: ['volunteering'], home: '#volunteering',
      groups: function () {
        return [{ label: 'Servings', items: [
          { h: '#volunteering', l: 'Calendar', ic: 'cal', page: 'volunteering' },
          { h: '#volunteering/sop', l: 'The SOP', ic: 'clip', page: 'volunteering' },
          { h: '#volunteering/recipes', l: 'Recipes', ic: 'pot', page: 'volunteering' },
          { h: '#volunteering/inventory', l: 'Inventory', ic: 'box', page: 'volunteering' }
        ] }, { label: 'People', items: [
          { h: '#volunteering/people', l: 'Volunteers', ic: 'people', page: 'volunteering' }
        ] }];
      },
      actions: [{ k: 'text', l: 'Text volunteers', ic: 'send', page: 'volunteering' }]
    },
    /* wave193: Steel (01/10/26): "a new app called Fundraising that holds: Fundraising Events, Donor relations (Donor Program), Events
       Calendar, Fundraising Event Sops (as it's own page), Grants". One page (#fund) with sections by address, plus wave124's Events page */
    fund: { id: 'fund', label: 'Fundraising', color: ORANGE, ic: 'heart', blurb: 'Events, donors, grants and the money they bring', pages: ['fund', 'fundevents'], need: 'fund', home: '#fund',
      groups: function () {
        var waiting = 0; try { var W = window.w193 && window.w193.state ? window.w193.state() : null; waiting = W ? W.finds.filter(function (x) { return x.status === 'new'; }).length : 0; } catch (e) { waiting = 0; }
        return [{ label: 'Fundraising', items: [
          { h: '#fund', l: 'Overview', ic: 'home', page: 'fund' },
          { h: '#fundevents', l: 'Events', ic: 'cal', page: 'fundevents' },
          { h: '#fund/calendar', l: 'Calendar', ic: 'cal', page: 'fund' },
          { h: '#fund/donors', l: 'Donor program', ic: 'people', page: 'fund' },
          { h: '#fund/sops', l: 'Event SOPs', ic: 'clip', page: 'fund' }
        ] }, { label: 'Grants', items: [
          { h: '#fund/grants', l: 'Pipeline', ic: 'list', page: 'fund' },
          { h: '#fund/grants/found', l: 'Found for you', ic: 'search', page: 'fund', n: waiting || null },
          { h: '#fund/grants/funders', l: 'Funders', ic: 'db', page: 'fund' },
          { h: '#fund/grants/write', l: 'Writer', ic: 'pen', page: 'fund' },
          { h: '#fund/grants/playbook', l: 'Playbook', ic: 'book', page: 'fund' },
          { h: '#fund/grants/facts', l: 'Fact base', ic: 'star', page: 'fund' }
        ] }];
      }
    },
    admin: { id: 'admin', label: 'Admin centre', color: SLATE, ic: 'shield', blurb: 'Access, security, the AI models, the Hub itself', pages: ['adminpanel', 'activity'], home: '#adminpanel/people',
      groups: function () {
        return [{ label: 'Admin', items: adminSections() }, { label: 'Audit', items: [{ h: '#activity', l: 'Activity', ic: 'list', page: 'activity' }] }];
      }
    }
  };
  var ORDER = ['hub', 'strategy', 'volunteer', 'crm', 'fund', 'hr', 'finance', 'admin'];   /* wave193: the Fundraising app, before HR and Finance */
  /* 01/10/26: Steel: "I'd like to add an app in the dashboard that links to our website home page" and "but it opens up in a
     seperate tab". A link, not an app: it frames no pages, so it sits under the apps (the launcher and the phone menu's
     tiles) for everyone who has them, and opens welfareavenue.com in a new tab while the Hub stays where it was */
  var LINKS = [{ id: 'website', label: 'Website', color: GOLD, ic: 'globe', blurb: 'welfareavenue.com, in a new tab', url: 'https://welfareavenue.com/' }];

  /* ---------- who can open what: the menu already knows (a hidden tab is a page this person cannot open) ---------- */
  function tab(id) { var b = document.getElementById('tabBar'); return b ? b.querySelector('.tab[data-tab="' + id + '"]') : null; }
  function allowed(id) { var t = tab(id); return !!t && t.style.display !== 'none' && !!document.getElementById(id); }
  function appOk(id) {
    if (boardMode() || !staffOk()) return false;
    var a = APPS[id]; if (!a) return false;
    if (id === 'hub') return true;
    if (a.need) return allowed(a.need);   /* wave193: the Fundraising app needs its own page; the Events calendar alone (finance staff, wave124) opens no app */
    return a.pages.some(allowed);
  }
  function items(app) {
    var a = APPS[app]; if (!a || !a.groups) return [];
    var gs = a.groups().map(function (g) { return { label: g.label, items: g.items.filter(function (it) { return allowed(it.page); }) }; }).filter(function (g) { return g.items.length; });
    /* wave164: an app with one group named after itself (Finance, the HR centre) shows no group heading: it only repeated the app's name */
    if (gs.length === 1 && fold(gs[0].label).replace(/s$/, '') === fold(a.label).replace(/s$/, '')) gs[0].solo = true;
    return gs;
  }
  function firstHash(app) { var gs = items(app); return gs.length ? gs[0].items[0].h : (APPS[app] && APPS[app].home) || '#mypage'; }

  /* ---------- where we are ---------- */
  function hashNow() { try { return decodeURIComponent(location.hash || ''); } catch (e) { return location.hash || ''; } }
  function pageOf(h) { return String(h || '').replace(/^#/, '').split('/')[0]; }
  /* the app that owns a page (every app page opens its app's frame; the Hub keeps the rest) */
  function ownerOf(pg) { for (var i = 0; i < ORDER.length; i++) { var a = APPS[ORDER[i]]; if (a.pages.indexOf(pg) >= 0) return a.id; } return null; }
  function current() {
    var pg = pageOf(hashNow());
    if (boardMode() || !staffOk()) return null;
    var id = ownerOf(pg);
    return id && appOk(id) ? id : null;
  }
