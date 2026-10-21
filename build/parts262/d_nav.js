
  /* ---------- Ask the Hub finds pages (Steel, 21/10/26) ----------
     "I also want ask the hub to support with navigation when people ask for information. If the page they are looking
     for is something they don't have access to they should be able to request access."
     When a question asks where something is (where, find, open, take me, link, page, how do I get to...), the answer gets a
     "Where to find it" card: up to three pages that match, each with where it sits in the menu and Open, or, for a page the
     person's access does not open, Request access (the same wa_access_requests row and admin ping as Request more access on
     Home, wave110; "Requested" once sent). The model's answer is untouched; the card is drawn under it. No new data. */
  var NAV = [
    ['mypage', 'Home', '#mypage', 'home my page my tasks dashboard home page'],
    ['training', 'Avenue Academy', '#training', 'academy training trainings tours tour course courses onboarding modules learn'],
    ['overview', 'Executive dashboard', '#overview', 'executive dashboard exec dashboard kpis kpi decisions numbers'],
    ['requests', 'Team Requests', '#requests', 'requests request team requests ask another team'],
    ['calendar', 'Calendar', '#calendar', 'calendar schedule meetings dates'],
    ['brain', 'The Brain', '#brain', 'brain the brain how work flows map'],
    ['importantinfo', 'Important info', '#importantinfo', 'important info passwords password logins login accounts credentials links key contacts'],
    ['bank', 'The Task Bank', '#bank', 'task bank bank parked tasks later'],
    ['agendas', 'Agendas', '#agendas', 'agendas agenda meeting agenda'],
    ['documents', 'Document finder', '#documents', 'documents document docs files drive google drive find a document'],
    ['transcripts', 'Transcript archive', '#transcripts', 'transcripts transcript recordings recording loom meeting notes minutes'],
    ['photos', 'Photo library', '#photos', 'photos photo pictures images library'],
    ['orgchart', 'Org chart', '#orgchart', 'org chart organization chart who reports reporting structure staff list'],
    ['ourstory', 'Our story', '#ourstory', 'our story story history mission'],
    ['hubmail', 'Hub inbox', '#hubmail', 'hub inbox inbox hub mail emails to the hub'],
    ['opsmtl', 'Operations Montreal', '#team/opsmtl', 'operations montreal montreal ops mtl operations'],
    ['progdev', 'Program Development', '#team/progdev', 'program development programs progdev'],
    ['opsto', 'Operations Toronto', '#team/opsto', 'operations toronto toronto ops toronto team'],
    ['marketing', 'Marketing, Branding & Web', '#team/marketing', 'marketing team branding web marketing page'],
    ['fundraising', 'Fundraising team page', '#team/fundraising', 'fundraising team fundraising page'],
    ['hr', 'Human Resources team page', '#team/hr', 'human resources team hr team'],
    ['board', 'Board team page', '#team/board', 'board team board and governance team'],
    ['governance', 'Board overview', '#governance', 'board overview board meetings governance directors'],
    ['committees', 'Committees', '#committees', 'committees committee'],
    ['volunteering', 'Volunteer Manager', '#volunteering', 'volunteer manager volunteers volunteer servings serving roster sunday serving texts sign ups signups'],
    ['crm', 'CRM', '#crm', 'crm contacts contact donors donor email campaigns email studio supporters gifts'],
    ['partners', 'Partners', '#partners', 'partners partner sponsors list collaborators organizations'],
    ['fund', 'Fundraising app', '#fund', 'fundraising app fundraising events donor program sponsorship'],
    ['grants', 'Grants', '#fund/grants', 'grants grant funding funders applications grant writer'],
    ['fundevents', 'Events calendar', '#fundevents', 'events calendar fundraising events'],
    ['studio', 'Content Studio', '#studio', 'content studio studio social media posts posting queue approvals comments messages dms hashtags hashtag link pages short links'],
    ['contentcal', 'Content calendar', '#contentcal', 'content calendar post calendar social calendar'],
    ['socialstats', 'Analytics', '#socialstats', 'analytics insights stats statistics reach followers engagement'],
    ['hrcentre', 'HR centre', '#hrcentre', 'hr centre hr center hiring recruitment applicants candidates onboarding time off vacation policies offer letters'],
    ['finances', 'Finance', '#finances', 'finance finances budget budgets expenses reimbursement reimbursements ledger accounting invoices'],
    ['orggoals', 'Goals and the Strategy Library', '#orggoals', 'goals strategy strategic plan organizational goals strategy library'],
    ['projects', 'Projects', '#projects', 'projects project'],
    ['adminpanel', 'Admin centre', '#adminpanel', 'admin admin centre access permissions roles people and access']
  ];
  var NAV_INTENT = /\b(where|find|finding|open|opening|go to|take me|get to|navigate|link to|link for|which page|what page|the page|a page|tab|section|menu|how (do|can) i (get|see|reach|open|find|use|access)|show me|access to|can't see|cannot see|can not see|don't see|do not see|where's)\b/i;
  var NAV_SEEN = { q: '', reqs: null };
  /* words too general to point at one page on their own */
  var NAV_STOP = ['page', 'find', 'team', 'list', 'link', 'links', 'home', 'open', 'where', 'library', 'calendar', 'notes', 'people', 'events', 'access'];
  function navFold(s) { return ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function navAllowed(id) {
    try { var al = (typeof wa40Allowed === 'function' && wa40Allowed()) || []; if (al.indexOf(id) >= 0) return true; } catch (e) { /* below */ }
    var t = document.querySelector('#tabBar .tab[data-tab="' + id + '"]');
    return !!t && t.style.display !== 'none';
  }
  function navMatches(q) {
    if (!q || !NAV_INTENT.test(q)) return [];
    var f = navFold(q), out = [];
    NAV.forEach(function (p) {
      var best = 0;
      /* every phrase of two or more words, then single words, in the page's word list */
      var words = p[3].split(' '), n = words.length;
      for (var len = 4; len >= 1; len--) {
        for (var i = 0; i + len <= n; i++) {
          var ph = words.slice(i, i + len).join(' ');
          if (len === 1 && (ph.length < 4 || NAV_STOP.indexOf(ph) >= 0)) continue;
          if (f.indexOf(' ' + ph + ' ') >= 0 || (len === 1 && f.indexOf(' ' + ph + 's ') >= 0)) { best = Math.max(best, len * 10 + ph.length); }
        }
      }
      if (f.indexOf(' ' + navFold(p[1]).trim() + ' ') >= 0) best = Math.max(best, 100 + p[1].length);
      if (best) out.push({ id: p[0], label: p[1], hash: p[2], score: best });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    var top = out.length ? out[0].score : 0;
    out = out.filter(function (x) { return x.score >= top * 0.7; });
    /* "content calendar" means the Content calendar, not also the Calendar */
    out = out.filter(function (x) { return !out.some(function (y) { return y !== x && y.score >= 100 && navFold(y.label).indexOf(navFold(x.label)) >= 0 && y.label.length > x.label.length; }); });
    return out.slice(0, 3);
  }
  function navWhere(id) {
    var t = document.querySelector('#tabBar .tab[data-tab="' + id + '"]');
    try { if (window.WA_APP && typeof window.WA_APP.owner === 'function') { var a = window.WA_APP.owner(id); if (a && a !== 'hub' && window.WA_APP.apps[a]) return 'Apps, ' + window.WA_APP.apps[a].label; } } catch (e) { /* below */ }
    if (!t) return '';
    var row = t.closest('.w42d'), main = row ? row.querySelector(':scope > .tab') : null;
    if (row && main && main !== t) return 'Teams, ' + (main.textContent || '').trim();
    if (row) return 'Teams';
    var g = t.closest('.tab-group'), k = g ? g.getAttribute('data-w42g') : '';
    if (k === 'tools') return 'More, Other Tools';
    if (k === 'org') return 'More, Organization';
    if (k === 'admin') return 'Admin';
    if (k === 'board') return 'Board';
    return 'the top of the menu';
  }
  async function navRequests() {
    if (NAV_SEEN.reqs) return NAV_SEEN.reqs;
    try {
      var em = String((typeof USER !== 'undefined' && USER && USER.email) || '').toLowerCase();
      var r = await db.from('wa_access_requests').select('wanted, status').eq('email', em).order('id', { ascending: false }).limit(40);
      NAV_SEEN.reqs = (r && r.data) || [];
    } catch (e) { NAV_SEEN.reqs = []; }
    return NAV_SEEN.reqs;
  }
  async function navCard(d, q) {
    if (!d || d.getAttribute('data-w262nav')) return;
    var ms = navMatches(q); if (!ms.length) return;
    d.setAttribute('data-w262nav', '1');
    var reqs = await navRequests();
    var waiting = {}; reqs.forEach(function (r) { if (r.status === 'new' || r.status === 'pending' || !r.status) waiting[r.wanted] = 1; });
    var card = document.createElement('div'); card.className = 'w262nav'; card.setAttribute('data-w198skip', '');
    card.innerHTML = '<b>Where to find it</b>' + ms.map(function (m) {
      var ok = navAllowed(m.id), where = ok ? navWhere(m.id) : '';
      var act = ok ? '<a class="go w226in" href="' + E(m.hash) + '" data-w262go="' + E(m.hash) + '">Open</a>'
        : (waiting['tab:' + m.id] ? '<em class="wait">Requested, waiting for an admin</em>'
          : '<button type="button" class="ask" data-w262ask="' + E(m.id) + '">Request access</button>');
      return '<div class="it"><div><div class="nm">' + E(m.label) + '</div><small>' + E(ok ? (where ? 'In the menu: ' + where : 'Open to you') : 'Not in your access yet') + '</small></div>' + act + '</div>';
    }).join('');
    card.setAttribute('data-q', q.slice(0, 200));
    d.classList.add('w262has'); d.appendChild(card);
    var box = document.getElementById('wacMsgs'); if (box) box.scrollTop = box.scrollHeight;
  }
  async function navAsk(btn) {
    var id = btn.getAttribute('data-w262ask'), card = btn.closest('.w262nav'), q = card ? card.getAttribute('data-q') || '' : '';
    var em = String((typeof USER !== 'undefined' && USER && USER.email) || '').toLowerCase();
    var name = (typeof USER !== 'undefined' && USER && (USER.name || USER.email)) || em;
    var role = (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || 'member';
    var label = (NAV.filter(function (p) { return p[0] === id; })[0] || [id, id])[1];
    btn.disabled = true; btn.textContent = 'Sending\u2026';
    try {
      var ins = await db.from('wa_access_requests').insert({ email: em, name: name, role_now: role, wanted: 'tab:' + id, reason: q ? 'Asked Ask the Hub: ' + q.slice(0, 240) : 'From Ask the Hub' });
      if (ins && ins.error) throw ins.error;
      try { await db.functions.invoke('notify', { body: { event: 'change_request_text', text: ':key: Access request from ' + name + ' (' + em + '): tab:' + id + ' (' + label + '), from Ask the Hub. Review in Admin > Access requests.' } }); } catch (e) { /* best-effort ping, as on Home */ }
      NAV_SEEN.reqs = (NAV_SEEN.reqs || []).concat([{ wanted: 'tab:' + id, status: 'new' }]);
      var s = document.createElement('em'); s.className = 'wait'; s.textContent = 'Requested, waiting for an admin'; btn.replaceWith(s);
      toastS('Request sent to the admins: ' + label);
    } catch (e) { btn.disabled = false; btn.textContent = 'Request access'; toastS('Could not send the request. Try again, or use Request more access on Home.'); }
  }
  var navCss = ''
    + '#waChatPanel .wac-m.bot.w262has{flex-wrap:wrap;}'
    + '#waChatPanel .wac-m.bot .w262nav{flex:1 0 100%;margin-left:42px;max-width:calc(100% - 42px);}'
    + '#waChatPanel .w262nav{margin:8px 0 2px;padding:10px 12px;border-radius:12px;background:' + CREAM + ';border:1px solid rgba(16,63,57,.14);font-size:13px;max-width:100%;box-sizing:border-box;}'
    + '#waChatPanel .w262nav > b{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:' + MUTED + ';margin-bottom:4px;}'
    + '#waChatPanel .w262nav .it{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px dashed rgba(16,63,57,.12);}'
    + '#waChatPanel .w262nav .it:first-of-type{border-top:none;}'
    + '#waChatPanel .w262nav .it > div{flex:1;min-width:0;}'
    + '#waChatPanel .w262nav .nm{display:block;font-weight:700;color:' + GREEN + ';}'
    + '#waChatPanel .w262nav small{display:block;color:' + MUTED + ';font-size:11.5px;}'
    + '#waChatPanel .w262nav .go,#waChatPanel .w262nav .ask{flex:0 0 auto;border-radius:999px;padding:5px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none;}'
    + '#waChatPanel .w262nav .go{background:' + GREEN + ';color:' + CREAM + ';border:none;}'
    + '#waChatPanel .w262nav .ask{background:' + GOLD + ';color:' + INK + ';border:none;}'
    + '#waChatPanel .w262nav .ask[disabled]{opacity:.6;cursor:default;}'
    + '#waChatPanel .w262nav .wait{font-style:normal;flex:0 0 auto;font-size:11.5px;color:#6b4d05;background:rgba(220,165,39,.18);border-radius:999px;padding:4px 10px;}';
  /* the question as it is sent (wave38's input and button), then the answer as it lands (as waves 117 and 226 do) */
  function navNote() { var i = document.getElementById('w38in'); if (i && i.value.trim()) NAV_SEEN.q = i.value.trim(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'w38in') { navWire(); navNote(); } }, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    navWire();   /* the chat panel can be drawn after the Hub starts */
    if (t && t.closest && t.closest('#w38send')) { navNote(); return; }
    var b = t && t.closest && t.closest('[data-w262ask]'); if (b) { e.preventDefault(); navAsk(b); return; }
    var g = t && t.closest && t.closest('[data-w262go]');
    if (g && window.innerWidth < 900) { var p = document.getElementById('waChatPanel'); if (p) p.style.display = 'none'; }
  }, true);
  var navObs = false;
  function navWire() {
    var m = document.getElementById('wacMsgs'); if (!m || navObs || typeof MutationObserver === 'undefined') return;
    navObs = true;
    new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        r.addedNodes.forEach(function (n) {
          if (!n.classList || !n.classList.contains('bot')) return;
          var txt = (n.textContent || '').trim();
          if (/^Thinking\.\.\.$/.test(txt) || n.classList.contains('w117think')) return;
          var q = NAV_SEEN.q; NAV_SEEN.q = '';
          if (q) navCard(n, q);
        });
      });
    }).observe(m, { childList: true });
  }
