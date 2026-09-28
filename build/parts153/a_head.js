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
   ===================================================================== */
(function () {
  if (window.__wa153) return; window.__wa153 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#797773', TEAL = '#2A8C7A', FLAG = '#B3402F', ORANGE = '#c87a2f', SLATE = '#5C5A56', PURPLE = '#6F64AB';
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
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'
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
    hub: { id: 'hub', label: 'Hub', color: GREEN, ic: 'home', blurb: 'Teams, meetings, goals and everything else', pages: [] },
    crm: { id: 'crm', label: 'CRM', color: TEAL, ic: 'people', blurb: 'Contacts, gifts, email', pages: ['crm'], home: '#crm',
      groups: function () {
        return [{ label: 'Contacts', items: [
          { h: '#crm', l: 'Contacts', ic: 'people', page: 'crm' },
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
      actions: [{ k: 'add', l: 'Add a contact', ic: 'plus' }]
    },
    hr: { id: 'hr', label: 'HR centre', color: FLAG, ic: 'clip', blurb: 'People records, onboarding, hours, policies', pages: ['hrcentre'], home: '#hrcentre',
      groups: function () {
        /* the page's own tabs once it has drawn (they depend on the person: the People view needs the HR access list); the known list before */
        var IC = { people: 'people', onboarding: 'clip', training: 'cap', recruitment: 'star', hours: 'chart', policies: 'form', discipline: 'shield' };
        var known = [['people', 'People'], ['onboarding', 'Onboarding'], ['training', 'Training'], ['recruitment', 'Recruitment'], ['hours', 'Commitment'], ['policies', 'Policies'], ['discipline', 'Discipline']];
        var drawn = Array.prototype.map.call(document.querySelectorAll('#hrcentre .w47tab[data-w47v]'), function (b) {
          var k = b.getAttribute('data-w47v'), t = (b.childNodes[0] && b.childNodes[0].nodeType === 3 ? b.childNodes[0].textContent : b.textContent) || k;
          return [k, String(t).replace(/\d+$/, '').trim() || k];
        });
        /* the page drawn with no tabs is its notice (the HR centre is for admins and leaders): the rail says just the page */
        var pn = document.getElementById('hrcentre'), notice = !drawn.length && !!pn && pn.classList.contains('active') && /for admins and leaders/i.test(pn.textContent || '');
        if (notice) return [{ label: 'HR centre', items: [{ h: '#hrcentre', l: 'HR centre', ic: 'clip', page: 'hrcentre' }] }];
        var list = drawn.length >= 3 ? drawn : known;
        return [{ label: 'HR centre', items: list.map(function (x) { return { h: '#hrcentre/' + x[0], l: x[1], ic: IC[x[0]] || 'star', page: 'hrcentre', sec: x[0] }; }) }];
      }
    },
    finance: { id: 'finance', label: 'Finance', color: ORANGE, ic: 'coins', blurb: 'The ledger, budgets and trends', pages: ['finances'], home: '#finances',
      groups: function () {
        return [{ label: 'Finances', items: [
          { h: '#finances', l: 'Overview', ic: 'home', page: 'finances', sec: 'overview' },
          { h: '#finances', l: 'Trends', ic: 'chart', page: 'finances', sec: 'trends' },
          { h: '#finances', l: 'Money map', ic: 'coins', page: 'finances', sec: 'money' },
          { h: '#finances', l: 'Budget', ic: 'list', page: 'finances', sec: 'budget' },
          { h: '#finances', l: 'Transactions', ic: 'db', page: 'finances', sec: 'txns' }
        ] }];
      }
    },
    admin: { id: 'admin', label: 'Admin centre', color: SLATE, ic: 'shield', blurb: 'Access, security, the AI models, the Hub itself', pages: ['adminpanel', 'activity'], home: '#adminpanel/people',
      groups: function () {
        return [{ label: 'Admin', items: adminSections() }, { label: 'Audit', items: [{ h: '#activity', l: 'Activity', ic: 'list', page: 'activity' }] }];
      }
    }
  };
  var ORDER = ['hub', 'crm', 'hr', 'finance', 'admin'];

  /* ---------- who can open what: the menu already knows (a hidden tab is a page this person cannot open) ---------- */
  function tab(id) { var b = document.getElementById('tabBar'); return b ? b.querySelector('.tab[data-tab="' + id + '"]') : null; }
  function allowed(id) { var t = tab(id); return !!t && t.style.display !== 'none' && !!document.getElementById(id); }
  function appOk(id) {
    if (boardMode() || !staffOk()) return false;
    var a = APPS[id]; if (!a) return false;
    if (id === 'hub') return true;
    return a.pages.some(allowed);
  }
  function items(app) {
    var a = APPS[app]; if (!a || !a.groups) return [];
    return a.groups().map(function (g) { return { label: g.label, items: g.items.filter(function (it) { return allowed(it.page); }) }; }).filter(function (g) { return g.items.length; });
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
