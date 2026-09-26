/* =====================================================================
   WA v140 Our story, Partners and the Document finder (26/09/26)
   =====================================================================
   Steel: "pour everything we have in the google drive, including shared drives to enhance our Hub.
   That said, don't just add anything... mine for gold (useful content), melt and refine it (take
   what's good out of it), and frame it (put it in current or new pages on the hub)."

   What the mining found, framed in three new pages under Resources:
   - Our story (#ourstory): what Welfare Avenue has done since April 2020, year by year, with the
     milestones at the top; every moment shows where it came from (the document, the post, the words).
     A second tab, Lessons learned (#ourstory/lessons), holds what the team learned, by area.
   - Partners (#partners): every organization WA has worked with (and the ones it approached), with
     what they did, the years, and the moments and documents they appear in.
   - Document finder (#documents): the useful Drive files and Canva designs, found by what they are
     about (a summary, the date it covers, the team, the kind, the organizations in it).
   Leaders (admin or leader role) correct, hide and add; directors read Our story and Partners.
   Data: wa_history, wa_history_years, wa_partners, wa_lessons, wa_documents (wa140_frame and
   wa140_story_data). A source from a board, management, HR or finance document shows to leaders
   and directors only; everyone else sees that it came from a leadership document.
   ===================================================================== */
(function () {
  if (window.__wa140) return; window.__wa140 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', INK = '#1F201E', PURPLE = '#6F64AB', MUTED = '#797773';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var KINDS = {
    milestone: ['Milestone', '#B9851B'], event: ['Event', TEAL], program: ['Program', GREEN], partnership: ['Partnership', PURPLE],
    funding: ['Funding', '#C87A2F'], recognition: ['Recognition', '#8C6A2E'], governance: ['Governance', '#4A4F57'], team: ['Team', '#3A6EA5'],
    media: ['Media', FLAG], expansion: ['Expansion', '#2B6F55']
  };
  var KIND_ORDER = ['milestone', 'event', 'program', 'partnership', 'funding', 'recognition', 'governance', 'team', 'media', 'expansion'];
  var AREAS = [['events', 'Events'], ['volunteers', 'Volunteers'], ['food and meals', 'Food and meals'], ['fundraising', 'Fundraising'], ['partnerships', 'Partnerships'],
    ['marketing', 'Marketing'], ['operations', 'Operations'], ['governance', 'Governance'], ['programs', 'Programs'], ['team', 'Team'], ['other', 'Other']];
  var REL = { partner: 'Partner', sponsor: 'Sponsor', funder: 'Funder', 'donor organisation': 'Donor organization', venue: 'Venue', supplier: 'Supplier', collaborator: 'Collaborator' };
  var STATUS = { active: ['Active', TEAL], past: ['Past', MUTED], prospect: ['Prospect', '#B9851B'], declined: ['Declined', FLAG] };
  var PKINDS = ['nonprofit', 'business', 'school', 'university', 'student club', 'government', 'funder', 'media', 'community group', 'faith group', 'other'];
  var DTEAMS = [['opsmtl', 'Operations Montreal'], ['opsto', 'Operations Toronto'], ['progdev', 'Program Development'], ['marketing', 'Marketing'],
    ['fundraising', 'Fundraising & Finances'], ['hr', 'Human Resources'], ['board', 'Board'], ['leadership', 'Leadership'], ['general', 'General']];
  var DKINDS = [['guide', 'Guides'], ['plan', 'Plans'], ['report', 'Reports'], ['meeting notes', 'Meeting notes'], ['presentation', 'Presentations'], ['proposal', 'Proposals'],
    ['letter', 'Letters'], ['newsletter', 'Newsletters'], ['application', 'Applications'], ['list', 'Lists'], ['posts', 'Posts and posters'], ['other', 'Other']];

  var P = {
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    hand: '<path d="M7 11.5 10.5 8a2 2 0 0 1 2.8 0l.7.7M3 10l4-4 3 1.5M21 10l-4-4-4.5 1.2"/><path d="m7 11.5 4.5 4.5a1.6 1.6 0 0 0 2.3-2.3M13.8 13.7l1.5 1.5a1.6 1.6 0 0 0 2.3-2.3L14 9.4"/>',
    file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 16.5h5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.2A9.7 9.7 0 0 1 12 5c5 0 9 7 9 7a15.6 15.6 0 0 1-3 3.6M6.6 6.6C4.4 8 3 12 3 12s4 7 9 7a8.6 8.6 0 0 0 4.4-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    eye: '<path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    quote: '<path d="M7.5 7.5h-3v5h3.5c0 2.5-1 3.5-3 4M17.5 7.5h-3v5H18c0 2.5-1 3.5-3 4"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/>',
    chev: '<path d="m9 5 7 7-7 7"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m6 15 6-6 6 6"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M16 5.2a3 3 0 0 1 0 5.6M18 14.5a5 5 0 0 1 3 4.8"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1V16h5v-.1c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>'
  };
  function I(n, cls) { return '<svg class="w140i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.spark) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  /* for matching: lower case, accents off (Émilie finds emilie) */
  function fold(s) { try { return lower(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { return lower(s); } }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function nowIso() { return new Date().toISOString(); }
  function yearNow() { try { return Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }).slice(0, 4)) || new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }

  /* ---------- who is looking ---------- */
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function wRole() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function isLeaderUI() { var r = wRole(); return r === 'admin' || r === 'leader'; }
  /* leaders and directors see sources from board and leadership documents */
  function seesLead() { return isLeaderUI() || boardMode(); }
  function myName() {
    try { var em = lower(USER && USER.email); var m = (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (x) { return lower(x.email) === em; })[0]; return (m && m.name) || (USER && USER.name) || (USER && USER.email) || ''; } catch (e) { return ''; }
  }

  /* ---------- dates: a moment's date has a precision (day, month, season, year) ---------- */
  function parts(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null; }
  function fmtWhen(s, prec) {
    var p = parts(s); if (!p) return '';
    if (prec === 'year') return String(p.y);
    if (prec === 'month' || prec === 'season') return MONTHS[p.m - 1] + ' ' + p.y;
    return p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y;
  }
  function fmtSide(s, prec) {
    var p = parts(s); if (!p) return '';
    if (prec === 'year') return '';
    if (prec === 'month' || prec === 'season') return MON[p.m - 1];
    return p.d + ' ' + MON[p.m - 1];
  }
  function fmtRange(h) {
    var a = fmtWhen(h.date_start, h.date_precision);
    if (!h.date_end) return a;
    var b = fmtWhen(h.date_end, h.date_end_precision || h.date_precision || 'day');
    return b && b !== a ? a + ' to ' + b : a;
  }
  /* what someone types (2021-03-20, 2021-03 or 2021) as a start, and as an end */
  function daysIn(y, mo) { return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }
  function readDate(s, isEnd) {
    s = String(s || '').trim();
    var m, y, mo;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
      y = Number(m[1]); mo = Number(m[2]);
      if (mo < 1 || mo > 12 || Number(m[3]) < 1 || Number(m[3]) > daysIn(y, mo)) return null;
      return { d: m[1] + '-' + pad(m[2]) + '-' + pad(m[3]), p: 'day' };
    }
    if ((m = /^(\d{4})-(\d{1,2})$/.exec(s))) {
      y = Number(m[1]); mo = Number(m[2]);
      if (mo < 1 || mo > 12) return null;
      return { d: m[1] + '-' + pad(m[2]) + '-' + (isEnd ? pad(daysIn(y, mo)) : '01'), p: 'month' };
    }
    if ((m = /^(\d{4})$/.exec(s))) return { d: m[1] + (isEnd ? '-12-31' : '-01-01'), p: 'year' };
    return null;
  }
  function asTyped(s, prec) { var p = parts(s); if (!p) return ''; if (prec === 'year') return String(p.y); if (prec === 'month' || prec === 'season') return p.y + '-' + pad(p.m); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  function numbersText(n) {
    if (!n || typeof n !== 'object') return '';
    var out = [], f = function (v) { return Number(v).toLocaleString('en-CA'); };
    if (n.meals) out.push(f(n.meals) + ' meals');
    if (n.people_helped) out.push(f(n.people_helped) + ' people helped');
    if (n.volunteers) out.push(f(n.volunteers) + ' volunteers');
    if (n.attendees) out.push(f(n.attendees) + ' attendees');
    if (n.raised_cad) out.push('$' + f(n.raised_cad) + ' raised');
    if (n.other) out.push(String(n.other));
    return out.join(' · ');
  }

  /* ---------- the data ---------- */
  var S = {
    hist: null, years: null, lessons: null, partners: null, docs: null, loading: {}, at: {}, err: {},
    ui: { tab: 'timeline', kind: '', city: '', q: '', order: 'asc', hidden: false, lArea: '', lq: '', pSet: 'worked', pRel: '', pKind: '', pCity: '', pq: '',
      dq: '', dTeam: '', dYear: '', dKind: '', dReuse: false, dShow: 40 },
    sheet: null
  };
  var LOADERS = {
    hist: function () { return db.from('wa_history').select('*').order('date_start', { ascending: true }).limit(3000); },
    years: function () { return db.from('wa_history_years').select('*').limit(100); },
    lessons: function () { return db.from('wa_lessons').select('*').limit(3000); },
    partners: function () { return db.from('wa_partners').select('*').order('name').limit(3000); },
    docs: function () { return db.from('wa_documents').select('file_id,title,summary,doc_date,year,kind,team,source,location,url,organisations,topics,reusable,resource_title,resource_what,visibility').limit(4000); }
  };
  /* the database decides what each person reads (RLS); the page keeps to the same rule, so nothing
     from a leadership document or a hidden moment can show to someone the database would not show it to */
  function allowed(what, rows) {
    if (isLeaderUI()) return rows;
    if (what === 'docs') return rows.filter(function (d) { return d.visibility !== 'leadership'; });
    if (what === 'hist' || what === 'lessons') return rows.filter(function (r) { return r.status !== 'hidden' && (r.visibility !== 'leadership' || seesLead()); });
    if (what === 'partners') return rows.filter(function (r) { return r.visibility !== 'leadership' || seesLead(); });
    return rows;
  }
  function load(what, force) {
    if (S.loading[what]) return S.loading[what];
    if (S[what] && !force && Date.now() - (S.at[what] || 0) < 120000) return Promise.resolve(S[what]);
    if (typeof db === 'undefined' || !db || !db.from) return Promise.resolve(S[what] || []);
    S.loading[what] = Promise.resolve(LOADERS[what]()).then(function (res) {
      S.loading[what] = null;
      if (res && res.error) { S.err[what] = String(res.error.message || res.error); S[what] = S[what] || []; return S[what]; }
      S.err[what] = ''; S[what] = allowed(what, (res && res.data) || []); S.at[what] = Date.now();
      if (what === 'partners') indexPartners();
      return S[what];
    }).catch(function (e) { S.loading[what] = null; S.err[what] = String((e && e.message) || e); S[what] = S[what] || []; return S[what]; });
    return S.loading[what];
  }

  /* a partner by any of its names */
  var PIDX = {};
  function indexPartners() {
    PIDX = {};
    (S.partners || []).forEach(function (p) {
      [p.name].concat(Array.isArray(p.aka) ? p.aka : []).forEach(function (n) { var k = fold(n); if (k && k.length > 1 && !PIDX[k]) PIDX[k] = p; });
    });
  }
  function partnerFor(name) { var k = fold(name); return k ? (PIDX[k] || null) : null; }
  function namesOf(p) { return [p.name].concat(Array.isArray(p.aka) ? p.aka : []).map(fold).filter(function (x) { return x && x.length > 2; }); }

  /* a source: the document's name, where it sits, and the words */
  function srcLabel(s) {
    var u = String(s.url || '');
    if (s.where === 'Social posts') return /instagram\.com/.test(u) ? 'Instagram post' : /facebook\.com/.test(u) ? 'Facebook post' : /linkedin\.com/.test(u) ? 'LinkedIn post' : 'Our social posts';
    return String(s.name || 'A document').replace(/\.(pdf|docx?|pptx?|xlsx?|txt)$/i, '');
  }
  function srcHtml(list, label) {
    list = Array.isArray(list) ? list : [];
    if (!list.length) return '';
    var lead = seesLead();
    return '<details class="w140src"><summary>' + I('quote') + E(label || plural(list.length, 'source', 'sources')) + '</summary><ul>' + list.map(function (s) {
      var hide = !!s.lead && !lead;
      if (hide) return '<li class="lk">' + I('lock') + '<span>A board or leadership document</span></li>';
      var nm = E(srcLabel(s));
      return '<li>' + (s.url ? '<a href="' + E(s.url) + '" target="_blank" rel="noopener">' + nm + ' ' + I('ext') + '</a>' : '<b>' + nm + '</b>') +
        (s.where && s.where !== 'Social posts' ? '<span class="w">' + E(s.where) + '</span>' : '') + (s.quote ? '<q>' + E(clip(s.quote, 280)) + '</q>' : '') + '</li>';
    }).join('') + '</ul></details>';
  }

  /* the masthead and the host of a page */
  function mastFor(id, crumb, title, blurb) {
    var sec = document.getElementById(id); if (!sec) return null;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w140', id); sec.insertBefore(m, sec.firstChild); }
    var html = '<div class="crumb">' + E(crumb) + '</div><h1>' + E(title) + '</h1><p>' + E(blurb) + '</p>';
    if (m.getAttribute('data-h') !== html) { m.innerHTML = html; m.setAttribute('data-h', html); }
    var h = sec.querySelector(':scope > .w140root');
    if (!h) { h = document.createElement('div'); h.className = 'w140root'; sec.appendChild(h); }
    return h;
  }
  function chip(on, attr, val, label, count, color) {
    return '<button class="w140chip' + (on ? ' on' : '') + '" ' + attr + '="' + E(val) + '">' + (color ? '<i style="background:' + E(color) + '"></i>' : '') + E(label) + (count != null ? ' <em>' + count + '</em>' : '') + '</button>';
  }
  function busy(msg) { return '<div class="w140empty">' + E(msg || 'Loading…') + '</div>'; }
