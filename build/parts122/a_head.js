/* =====================================================================
   WA v122 the Training academy (25/09/26)
   =====================================================================
   Steel: "revamp the trainings and allow for loom videos to be embedded
   in to trainings members open. For non video trainings, build out some
   well designed html trainings like our 8 charitable activities. A
   training on all our partners and how we collaborate with them. Apple
   feel to UI and UX with a robust academy feel to the progress they
   make. The accomplishments members make are super important. Store the
   onboarding in that page. Each training should open up wide enough to
   complete it." Then: "there should be a training for each page of the
   hub that walks them through each section of the page", and "pull
   Onboarding into its own section at the top".

   The Training page (#training) becomes the academy:
   - Onboarding first, in its own section: the person's onboarding plan
     (onboardings / onboarding_steps, the wave37 checklist and its tick
     handler), the Hub first steps (wave112 wa_onboarding via
     window.w112Api) and the policies to sign (wa_policies,
     wa_policy_signoffs), with "updated since you finished" acks.
   - A hero with three rings (onboarding, required learning, level), XP,
     level, streak, certificates and badges; Up next; learning paths
     (academy_paths, path_group) with a certificate at the end; a page
     tour for every page; the library; the trophy case; and what people
     earned recently across Welfare Avenue.
   - Every training opens in a wide sheet: Loom (and YouTube, Vimeo,
     Drive) embedded, HTML lessons from trainings.body with chapters and
     a knowledge check, readable articles for text trainings, documents
     with an inline preview, and tour intros.
   - Page tours: a spotlight coach mark engine walks each page section
     by section (the steps live in TOURS below, next to the DOM they
     point at; the catalogue rows are trainings with kind 'tour').
   - Accomplishments: XP and levels computed from progress, badges and
     certificates persisted in academy_awards (celebrated once, printable
     certificates, optional shout-out to the team), and an Academy card
     on every person page.
   - Leaders: assign any training to people, add or edit a training, and
     the HR training board is one click away. The classic page stays
     reachable ("Classic view").
   Data: wa122_academy migration (trainings kind/key/body/minutes/xp,
   training_progress started_at/pct/last_step/score/seconds/data/email,
   academy_paths, academy_awards). Everything older keeps working
   underneath, hidden while the academy is on.
   ===================================================================== */
(function () {
  if (window.__wa122) return; window.__wa122 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E', STEM = '#2B6F55';
  var SF = "-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Inter','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  var DEPTS = ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'];
  var KIND = {
    video: { l: 'Video', icon: 'play', c1: '#103F39', c2: '#2A8C7A' },
    lesson: { l: 'Lesson', icon: 'book', c1: '#6F64AB', c2: '#9C8FE0' },
    read: { l: 'Reading', icon: 'doc', c1: '#2B6F55', c2: '#5FA589' },
    doc: { l: 'Document', icon: 'file', c1: '#B9851B', c2: '#E4B84F' },
    tour: { l: 'Page tour', icon: 'map', c1: '#1F201E', c2: '#3E4A46' }
  };
  var LEVELS = [[0, 'Newcomer'], [100, 'Explorer'], [250, 'Contributor'], [450, 'Practitioner'], [700, 'Specialist'], [1000, 'Expert'], [1400, 'Mentor'], [1900, 'Leader'], [2500, 'Changemaker']];
  var BADGES = [
    { id: 'first-step', t: 'First step', d: 'Complete your first training.', icon: 'spark', c: GOLD, test: function (s) { return s.done >= 1; } },
    { id: 'welcome', t: 'Welcome aboard', d: 'Finish the Hub first steps.', icon: 'compass', c: TEAL, test: function (s) { return s.hubAll; } },
    { id: 'signed', t: 'Signed and sealed', d: 'Sign every required policy.', icon: 'seal', c: GREEN, test: function (s) { return s.polTotal > 0 && s.polSigned >= s.polTotal; } },
    { id: 'explorer', t: 'Explorer', d: 'Take five page tours.', icon: 'map', c: INK, test: function (s) { return s.tours >= 5; } },
    { id: 'film', t: 'Film club', d: 'Watch five video trainings.', icon: 'play', c: STEM, test: function (s) { return s.videos >= 5; } },
    { id: 'scholar', t: 'Scholar', d: 'Complete ten trainings.', icon: 'book', c: PURPLE, test: function (s) { return s.done >= 10; } },
    { id: 'expert', t: 'Expert', d: 'Complete twenty-five trainings.', icon: 'trophy', c: FLAG, test: function (s) { return s.done >= 25; } },
    { id: 'perfect', t: 'Perfect score', d: 'Ace a knowledge check.', icon: 'star', c: GOLD, test: function (s) { return s.perfect >= 1; } },
    { id: 'roll', t: 'On a roll', d: 'Learn three days in a row.', icon: 'flame', c: '#D9772B', test: function (s) { return s.bestStreak >= 3; } },
    { id: 'habit', t: 'Habit formed', d: 'Learn five days in a row.', icon: 'flame', c: FLAG, test: function (s) { return s.bestStreak >= 5; } },
    { id: 'finisher', t: 'Finisher', d: 'Earn your first certificate.', icon: 'medal', c: PURPLE, test: function (s) { return s.certCount >= 1; } }
  ];
  var DEFAULT_PATHS = [
    { key: 'foundations', name: 'Welfare Avenue foundations', title: 'Welfare Avenue foundations', blurb: 'Who we are, the eight activities we are registered for, and the partners we work with.', dept: null, required: true, cert_title: 'Welfare Avenue Foundations', color: GOLD, icon: 'heart', sort: 10 },
    { key: 'hub', name: 'Using the Hub', title: 'Using the Hub', blurb: 'Eight short modules on how the Hub turns meetings into work.', dept: null, required: true, cert_title: 'Hub Essentials', color: GREEN, icon: 'compass', sort: 20 },
    { key: 'tours', name: 'Hub page tours', title: 'Hub page tours', blurb: 'A guided walkthrough of every page of the Hub, section by section.', dept: null, required: false, cert_title: 'Hub Navigator', color: TEAL, icon: 'map', sort: 30 },
    { key: 'marketing', name: 'Marketing Strategy Package', title: 'Marketing strategy', blurb: 'The marketing strategy built for Welfare Avenue, module by module.', dept: 'marketing', required: false, cert_title: 'Marketing Strategy', color: PURPLE, icon: 'megaphone', sort: 40 },
    { key: 'branding', name: 'Branding', title: 'Our brand', blurb: 'The brand refresh: what changed and why.', dept: 'marketing', required: false, cert_title: 'Brand Ready', color: '#B9851B', icon: 'sparkle', sort: 45 },
    { key: 'ops', name: 'Operations Basics', title: 'Operations basics', blurb: 'Running volunteers and ordering for a serving.', dept: 'opsmtl', required: false, cert_title: 'Operations Basics', color: STEM, icon: 'box', sort: 50 }
  ];

  /* ---------- icons (24px stroke) ---------- */
  var IC = {
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h6M9 19h3"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z"/>',
    seal: '<circle cx="12" cy="10" r="6"/><path d="M8.5 14.8 7 21l5-2.5 5 2.5-1.5-6.2"/><path d="M9.8 10l1.6 1.6 3-3"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5a3 3 0 0 0 3 4.3M16 5.5h3a3 3 0 0 1-3 4.3M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
    flame: '<path d="M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-3.3 2.3-5.3 3.6-7.3.3 1.6 1.1 2.6 2.1 3.1.2-2.9 1.6-5.2 3.8-7.1.3 2.8 1.6 4.4 2.8 6.1 1 1.4 1.7 2.9 1.7 5.2C19.5 18.3 16.2 21 12 21z"/><path d="M12 21c-1.7 0-3-1.2-3-2.9 0-1.7 1.4-2.7 2.3-3.9.9 1.3 3.7 2.3 3.7 4.1 0 1.6-1.3 2.7-3 2.7z"/>',
    medal: '<circle cx="12" cy="15" r="5.5"/><path d="M9 3h6l-1.5 6.8M9 3l1.5 6.8"/><path d="M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
    heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
    megaphone: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17 9a4 4 0 0 1 0 6M7 14l1.5 5h2.5l-1-5"/>',
    box: '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    gift: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7C10.5 4 7.5 4 7.5 5.8S10 7 12 7zM12 7c1.5-3 4.5-3 4.5-1.2S14 7 12 7z"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
    handshake: '<path d="M3 11l4-4 4 2 3-2 3 1 4 3"/><path d="M3 11l5 5c1 1 2.2 1 3 .2l4.8-4.7M13 14l2 2M11 15.5l1.5 1.5M17 9l-4 3"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    bowl: '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M13.5 7c0-1.5 1.5-1.5 1.5-3"/><path d="M8 19.5h8"/>',
    home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    scale: '<path d="M12 4v16M5 20h14M6 7h12"/><path d="M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    print: '<path d="M7 9V3h10v6M7 17H4V9h16v8h-3"/><rect x="7" y="14" width="10" height="7"/>',
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.8L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.8L20 16M20 20v-4h-4"/>'
  };
  function ic(name, cls) { return '<svg class="w122ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[name] || IC.spark) + '</svg>'; }

  /* ---------- small utilities ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function nowIso() { return new Date().toISOString(); }
  function dayKey(d) { var x = new Date(d); if (isNaN(x.getTime())) return null; return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(d) { var x = new Date(d); if (isNaN(x.getTime())) return ''; return MONTHS[x.getMonth()] + ' ' + x.getDate() + ', ' + x.getFullYear(); }
  function fmtShort(d) { var x = new Date(d); if (isNaN(x.getTime())) return ''; return MONTHS[x.getMonth()].slice(0, 3) + ' ' + x.getDate(); }
  function ago(d) {
    var x = new Date(d).getTime(); if (!x) return '';
    var s = Math.max(0, (Date.now() - x) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago'; if (s < 86400 * 2) return 'yesterday';
    if (s < 86400 * 30) return Math.round(s / 86400) + ' days ago'; return fmtShort(d);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function mins(n) { n = Math.round(n || 0); if (n < 60) return n + ' min'; var h = Math.floor(n / 60), m = n % 60; return h + ' h' + (m ? ' ' + m + ' min' : ''); }
  /* the trainings text: escape first, then **bold**, *italic*, [text](url) and bare links */
  function md(s) {
    var t = E(s);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
    t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m0, pre, url) { var short = url.replace(/^https?:\/\/(www\.)?/, ''); if (short.length > 48) short = short.slice(0, 45) + '…'; return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + short + '</a>'; });
    return t;
  }
  /* never show a password written into a training description */
  function redact(s) { return String(s || '').replace(/((?:pass(?:word)?|pwd)\s*[:=]\s*)(\S+)/ig, '$1•••••• (kept in Important info)'); }
  function initials(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } }
  function reduced() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function ring(pct, size, stroke, color, track, inner) {
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0));
    return '<svg class="w122ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (track || 'rgba(16,63,57,.10)') + '" stroke-width="' + stroke + '"/>' +
      '<circle class="arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - p / 100)).toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      (inner || '') + '</svg>';
  }
