/* =====================================================================
   WA v152 the CRM: every contact in one place (27/09/26)
   =====================================================================
   Steel: "hub.welfareavenue.com: the Hub ... the CRM as an app inside the Hub, hub being the back end",
   "All contacts essentially, email marketing capabilities and automation, details about each contact
   we have", and "CRM visible to all staff".

   A new page under People, CRM (#crm), on the tables of the CRM foundation (migration
   wa150_crm_foundation, 27/09/26): 481 contacts from the old website's volunteer sign-ups (George's
   Django export), the Hub roster and MTL volunteering, with each volunteer's servings from the event
   rosters.
   - Contacts: everyone, with what they have done with us (servings, gifts, organizations), found by
     kind, volunteer role, activity and email permission, or by any name, email or phone.
   - A contact's page (#crm/c/<id>): their details, what they did with Welfare Avenue, their email
     permission (CASL), tags, and one timeline (notes, calls and emails logged here, servings, gifts,
     the old website's history). Staff edit the details (a volunteer's name, emails, phones and address
     are saved on their volunteer record, so MTL volunteering and the CRM stay one record), log what
     happened, tag, and link a person to an organization from Partners.
   - Possible duplicates (#crm/dupes): the same email or phone twice. Keep one (crm_merge_contacts(),
     which also merges two volunteer records through volunteer_merge()) or mark them as different people.
   - Sources (#crm/sources): where the contacts come from, what joins next (the old website's history,
     website messages, Zeffy gifts) and the email permission count before any campaign.
   Data: crm_contacts_v, crm_duplicates_v, crm_interactions, crm_donations, crm_volunteer_history,
   crm_contact_orgs, crm_dupe_dismissals, event_roster, volunteer_events, wa_partners (migration
   wa152_crm). The database follows the page access: staff with the CRM page in their profile
   (wa_page_ok('crm')); directors never see it.
   ===================================================================== */
(function () {
  if (window.__wa152) return; window.__wa152 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', INK = '#1F201E', PURPLE = '#6F64AB', MUTED = '#797773';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* what a contact is to us; the order is the order of the chips */
  var KINDS = {
    volunteer: ['Volunteer', TEAL], donor: ['Donor', '#B9851B'], partner: ['Partner contact', PURPLE], supporter: ['Supporter', '#C87A2F'],
    staff: ['Staff', GREEN], alumni: ['Alumni', '#8C6A2E'], board: ['Board', '#4A4F57']
  };
  var KIND_ORDER = ['volunteer', 'donor', 'partner', 'supporter', 'staff', 'alumni', 'board'];
  /* the kinds someone can give a contact by hand (staff and alumni come from the roster, volunteers from MTL volunteering) */
  var KIND_HAND = ['donor', 'partner', 'supporter', 'board'];
  var ROLES = {
    team_leader: 'Team leader', cook: 'Cook', driver: 'Driver', server: 'Server', dishwasher: 'Dishwasher', photographer: 'Photographer',
    community_talker: 'Community talker', community_debrief: 'Community lead'
  };
  var ROLE_ORDER = ['team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_talker', 'community_debrief'];
  var SOURCES = {
    django_website_export: ['Old website sign-ups', 'Everyone who signed up to volunteer on welfareavenue.com before July 2026 (the Django site).'],
    hub_roster: ['Hub roster', 'Staff and alumni from the Hub roster.'],
    hub_volunteers: ['MTL volunteering', 'Volunteers added in MTL volunteering since the import.'],
    hub: ['Added in the CRM', 'Contacts someone added on this page.'],
    zeffy: ['Zeffy', 'Donors from Zeffy.'],
    website: ['Website forms', 'People who wrote to us or signed up on welfareavenue.com.'],
    keela: ['Keela', 'Contacts from the Keela export.']
  };
  var LANGS = [['', 'Not known'], ['en', 'English'], ['fr', 'French'], ['other', 'Another language']];
  /* the email permission (Canada's anti-spam law, CASL) */
  var PERM = {
    express: ['Express consent', TEAL, 'They said yes to our emails.'],
    implied: ['Implied consent', '#B9851B', 'They gave, volunteered or bought with us in the last two years.'],
    none: ['No consent', FLAG, 'Do not send them newsletters or campaigns.'],
    unknown: ['Not recorded', MUTED, 'No permission on file yet.'],
    unsub: ['Unsubscribed', FLAG, 'They asked for no more emails.'],
    bounced: ['Email bounces', FLAG, 'Their address does not accept email.']
  };
  /* what someone can log on a contact's timeline: [kind, direction, label] */
  var LOGS = { note: ['note', 'internal', 'Note'], call: ['call', 'out', 'Call'], meeting: ['meeting', 'out', 'Meeting'], email_out: ['email', 'out', 'Email we sent'],
    email_in: ['email', 'in', 'Email they sent'], text: ['sms', 'out', 'Text message'] };
  var LOG_ORDER = ['note', 'call', 'meeting', 'email_out', 'email_in', 'text'];
  var AV = [GREEN, TEAL, PURPLE, '#B9851B', '#3A6EA5', '#8C6A2E', '#2B6F55', '#C87A2F'];

  var P = {
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M16 5.2a3 3 0 0 1 0 5.6M18 14.5a5 5 0 0 1 3 4.8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>',
    phone: '<path d="M6.6 3.5h2.8l1.4 4.2-2.1 1.3a11 11 0 0 0 6.3 6.3l1.3-2.1 4.2 1.4v2.8a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
    chat: '<path d="M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z"/>', pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    hand: '<path d="M7 11.5 10.5 8a2 2 0 0 1 2.8 0l.7.7M3 10l4-4 3 1.5M21 10l-4-4-4.5 1.2"/><path d="m7 11.5 4.5 4.5a1.6 1.6 0 0 0 2.3-2.3M13.8 13.7l1.5 1.5a1.6 1.6 0 0 0 2.3-2.3L14 9.4"/>',
    note: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6.5M9 14.5h6.5M9 18h4"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    merge: '<path d="M6 4v5a5 5 0 0 0 5 5h7M14 10l4 4-4 4"/><path d="M6 20v-4"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', chev: '<path d="m9 5 7 7-7 7"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>', tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.5"/>',
    alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>', copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>', shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    hand2: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5M14 11.5V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.6 6.5-6 6.5-2.4 0-3.9-1.1-5.2-3L3.5 14a1.5 1.5 0 0 1 2.4-1.8L8 14.5"/>'
  };
  function I(n, cls) { return '<svg class="w152i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  /* for matching: lower case, accents off (Émilie finds emilie) */
  function fold(s) { try { return lower(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return lower(s); } }
  function digits(s) { return String(s == null ? '' : s).replace(/\D+/g, ''); }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function plural(n, one, many) { return Number(n).toLocaleString('en-CA') + ' ' + (n === 1 ? one : many); }
  function arr(a) { return Array.isArray(a) ? a.filter(function (x) { return x != null && String(x).trim() !== ''; }) : []; }
  function uniq(a) { var seen = {}, out = []; a.forEach(function (x) { var k = lower(x); if (k && !seen[k]) { seen[k] = 1; out.push(x); } }); return out; }
  function initials(n) { var p = String(n || '').replace(/[()]/g, '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function avColor(id) { var n = Math.abs(Number(id) || 0); return AV[n % AV.length]; }
  function money(n) { var v = Number(n) || 0, f = v % 1 ? 2 : 0; try { return v.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: f, maximumFractionDigits: f }); } catch (e) { return '$' + v; } }
  function listJoin(a) { a = (a || []).filter(Boolean); if (a.length <= 1) return a.join(''); return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  /* ---------- dates (the Hub's clock is Montreal time) ---------- */
  function torontoDay(t) { try { return new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); } catch (e) { return new Date(t).toISOString().slice(0, 10); } }
  function today() { return torontoDay(Date.now()); }
  /* a date column (2026-09-14) or a timestamp, as the day it was in Montreal */
  function dayOf(s) {
    s = String(s || ''); if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var t = new Date(s).getTime(); return isNaN(t) ? '' : torontoDay(t);
  }
  function fmtDay(s) { var d = dayOf(s); if (!d) return ''; var p = d.split('-'); return Number(p[2]) + ' ' + MON[Number(p[1]) - 1] + ' ' + p[0]; }
  function daysSince(s) { var d = dayOf(s); if (!d) return null; return Math.round((Date.parse(today() + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 86400000); }
  function ago(s) {
    var n = daysSince(s); if (n == null) return '';
    if (n < 0) return 'in ' + plural(-n, 'day', 'days');
    if (n === 0) return 'today';
    if (n === 1) return 'yesterday';
    if (n < 14) return n + ' days ago';
    if (n < 60) return Math.round(n / 7) + ' weeks ago';
    if (n < 700) return Math.round(n / 30.4) + ' months ago';
    return Math.round(n / 365.25) + ' years ago';
  }
  function addYears(day, n) { var p = String(day || '').split('-'); if (p.length < 3) return ''; return (Number(p[0]) + n) + '-' + p[1] + '-' + (p[1] === '02' && p[2] === '29' ? '28' : p[2]); }

  /* ---------- who is looking ---------- */
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function wRole() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function myEmail() { try { return lower(USER && USER.email); } catch (e) { return ''; } }
  function amAdmin() { return wRole() === 'admin' || ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'].indexOf(myEmail()) >= 0; }
  function actor() { return myEmail() || 'staff'; }

  /* ---------- the data ---------- */
  var COLS = 'id,full_name,first_name,last_name,emails,phones,primary_email,address,city,province,postal_code,country,language,kinds,tags,source,volunteer_id,member_id,' +
    'email_status,email_consent,consent_source,consent_at,implied_consent_until,sms_opt_out,notes,last_activity_at,created_at,updated_at,created_by,updated_by,legacy_refs,' +
    'volunteer_roles,volunteer_tags,volunteer_organization,last_applied,volunteer_needs_review,in_quo,legacy_servings,legacy_hours,hub_servings,last_serving_on,' +
    'donation_total,donation_count,last_donation_at,org_names';
  var S = {
    contacts: null, dupes: null, counts: null, partners: null, gifts: null, loading: {}, at: {}, err: {},
    ui: { tab: 'contacts', kind: '', role: '', act: '', perm: '', q: '', sort: 'recent', show: 60, gq: '', gplat: '', gyear: '', gshow: 60 },
    sheet: null, detail: {}, confirm: null
  };
  /* the API answers at most 1,000 rows a call: read a table page by page until a short page (or nothing new) */
  var PAGE_ROWS = 1000;
  function pageAll(query, key) {
    var rows = [], seen = {};
    function step(from) {
      return Promise.resolve(query(from, from + PAGE_ROWS - 1)).then(function (res) {
        if (!res || res.error) return { data: rows, error: res && res.error };
        var got = res.data || [], fresh = 0;
        got.forEach(function (r) { var k = key(r); if (seen[k]) return; seen[k] = 1; rows.push(r); fresh++; });
        if (got.length < PAGE_ROWS || !fresh || rows.length > 50000) return { data: rows, error: null };
        return step(from + PAGE_ROWS);
      });
    }
    return step(0);
  }
  var LOADERS = {
    contacts: function () { return pageAll(function (a, b) { return db.from('crm_contacts_v').select(COLS).order('id', { ascending: true }).range(a, b); }, function (r) { return String(r.id); }); },
    dupes: function () { return pageAll(function (a, b) { return db.from('crm_duplicates_v').select('*').order('contact_id', { ascending: true }).order('duplicate_id', { ascending: true }).range(a, b); }, function (r) { return r.contact_id + ':' + r.duplicate_id + ':' + r.matched_on + ':' + r.value; }); },
    partners: function () { return db.from('wa_partners').select('id,name,aka,status,visibility').order('name').limit(3000); },
    /* wave153: the Gifts tab */
    gifts: function () { return pageAll(function (a, b) { return db.from('crm_donations').select('id,contact_id,amount,currency,donated_at,platform,campaign,designation,recurring,receipt_number,receipt_issued_at,receipt_url,receipt_source,receipt_eligible,external_id,notes,kind,method,advantage_amount,advantage_desc,in_kind_desc,appraiser,tribute_kind,tribute_name,created_by,updated_by,fee,net_amount,refunded_amount,refunded_at,plan_id').order('donated_at', { ascending: false }).order('id', { ascending: false }).range(a, b); }, function (r) { return String(r.id); }); }
  };
  /* the rows the page works with: a few derived fields for filters, sorting and search */
  function shape(c) {
    c.emails = arr(c.emails); c.phones = arr(c.phones); c.kinds = arr(c.kinds); c.tags = arr(c.tags);
    c.volunteer_roles = arr(c.volunteer_roles); c.volunteer_tags = arr(c.volunteer_tags); c.org_names = arr(c.org_names);
    c._roles = uniq(c.volunteer_roles.concat(c.volunteer_tags.filter(function (t) { return ROLES[t]; })));
    c._served = (Number(c.hub_servings) || 0) + (Number(c.legacy_servings) || 0);
    var acts = [dayOf(c.last_serving_on), dayOf(c.last_activity_at), dayOf(c.last_donation_at)].filter(Boolean).sort();
    c._last = acts.length ? acts[acts.length - 1] : '';
    c._donor = c.kinds.indexOf('donor') >= 0 || Number(c.donation_count) > 0;
    c._partner = c.kinds.indexOf('partner') >= 0 || c.org_names.length > 0;
    c._perm = permKey(c);
    c._digits = c.phones.map(digits).filter(function (d) { return d.length >= 7; });
    c._hay = fold([c.full_name, c.emails.join(' '), c.phones.join(' '), c.city, c.volunteer_organization, c.org_names.join(' '), c.tags.join(' '),
      c._roles.map(function (r) { return ROLES[r] || r; }).join(' '), c.kinds.map(function (k) { return (KINDS[k] || [k])[0]; }).join(' ')].join(' '));
    return c;
  }
  /* the permission that applies today: an opt-out wins, an implied consent runs out */
  function permKey(c) {
    var st = lower(c.email_status);
    if (st === 'unsubscribed' || st === 'complained') return 'unsub';
    if (st === 'bounced') return 'bounced';
    var k = lower(c.email_consent);
    if (k === 'express') return 'express';
    if (k === 'implied') return (!c.implied_consent_until || dayOf(c.implied_consent_until) >= today()) ? 'implied' : 'unknown';
    if (k === 'none') return 'none';
    return 'unknown';
  }
  function load(what, force) {
    if (S.loading[what]) return S.loading[what];
    if (S[what] && !force && Date.now() - (S.at[what] || 0) < 120000) return Promise.resolve(S[what]);
    if (typeof db === 'undefined' || !db || !db.from) return Promise.resolve(S[what] || []);
    S.loading[what] = Promise.resolve(LOADERS[what]()).then(function (res) {
      S.loading[what] = null;
      if (res && res.error) { S.err[what] = String(res.error.message || res.error); S[what] = S[what] || []; return S[what]; }
      S.err[what] = ''; S.at[what] = Date.now();
      var rows = (res && res.data) || [];
      if (what === 'contacts') { rows = rows.filter(function (c) { return c && c.id != null; }).map(shape); indexContacts(rows); }
      S[what] = rows;
      return rows;
    }).catch(function (e) { S.loading[what] = null; S.err[what] = String((e && e.message) || e); S[what] = S[what] || []; return S[what]; });
    return S.loading[what];
  }
  var BY_ID = {};
  function indexContacts(rows) { BY_ID = {}; rows.forEach(function (c) { BY_ID[String(c.id)] = c; }); }
  function contact(id) { return BY_ID[String(id)] || null; }
  /* the pairs to look at: both still in the CRM, one card per pair whatever matched */
  function dupePairs() {
    var by = {};
    (S.dupes || []).forEach(function (d) {
      var a = Math.min(Number(d.contact_id), Number(d.duplicate_id)), b = Math.max(Number(d.contact_id), Number(d.duplicate_id));
      if (!contact(a) || !contact(b)) return;
      var k = a + '-' + b;
      if (!by[k]) by[k] = { a: a, b: b, on: [], values: [] };
      if (by[k].on.indexOf(d.matched_on) < 0) by[k].on.push(d.matched_on);
      if (d.value && by[k].values.indexOf(d.value) < 0) by[k].values.push(d.value);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (x, y) { return (y.on.length - x.on.length) || (x.a - y.a); });
  }

  /* the masthead and the host of the page */
  function mastFor() {
    var sec = document.getElementById('crm'); if (!sec) return null;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w152', 'crm'); sec.insertBefore(m, sec.firstChild); }
    var html = '<div class="crumb">Apps</div><h1>CRM</h1><p>Everyone Welfare Avenue knows (volunteers, donors, partners and the team) in one place, with what they have done with us and when we last heard from them.</p>';
    if (m.getAttribute('data-h') !== html) { m.innerHTML = html; m.setAttribute('data-h', html); }
    var h = sec.querySelector(':scope > .w152root');
    if (!h) { h = document.createElement('div'); h.className = 'w152root'; sec.appendChild(h); }
    return h;
  }
  function busy(msg) { return '<div class="w152empty">' + E(msg || 'Loading…') + '</div>'; }
  function kindChip(k) { var d = KINDS[k] || [k.charAt(0).toUpperCase() + k.slice(1), MUTED]; return '<span class="w152kd" style="background:' + d[1] + '1a;color:' + d[1] + '">' + E(d[0]) + '</span>'; }
  function kindsHtml(c) {
    var ks = c.kinds.slice();
    if (c._donor && ks.indexOf('donor') < 0) ks.push('donor');
    if (c._partner && ks.indexOf('partner') < 0) ks.push('partner');
    ks.sort(function (a, b) { var x = KIND_ORDER.indexOf(a), y = KIND_ORDER.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    return ks.map(kindChip).join('');
  }
  function permChip(key) { var p = PERM[key] || PERM.unknown; return '<span class="w152pm" style="background:' + p[1] + '17;color:' + p[1] + '"><i style="background:' + p[1] + '"></i>' + E(p[0]) + '</span>'; }
  function avatar(c, big) { return '<span class="w152av' + (big ? ' big' : '') + '" style="background:' + avColor(c.id) + '" aria-hidden="true">' + E(initials(c.full_name)) + '</span>'; }
  function roleName(r) { return ROLES[r] || String(r || '').replace(/_/g, ' '); }
