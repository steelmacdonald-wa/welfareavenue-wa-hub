/* =====================================================================
   WA v209 Applicants in: add one by hand, every application email, volunteer roles to the Volunteer Manager (06/10/26)
   =====================================================================
   Steel (06/10/26): "I also want to be able to add new applicants via the applications page. Also emails that come through
   the hub as an application should be added directly to the applications page. Volunteer cook, kitchen, driver, server,
   photographer, community lead, and team leader should be redirected to the volunteer manager to applicants received and
   should update both the crm and volunteers records to have that applicant visible in our searches for volunteers."
   - Applications (HR centre): Add an applicant (name, contact, position or role, where they applied, when, what they wrote,
     a link). A volunteer role is said as it is typed and goes to the Volunteer Manager; anything else is a New card, opened
     so the CV can be uploaded. A card for a volunteer role offers Move to the Volunteer Manager.
   - Volunteer Manager > Applicants received (#volunteering/applicants): every volunteer application (CABM, Je Bénévole,
     email, by hand), To handle first; Contacted, Welcome, Not a fit, Withdrawn with a note; In the CRM, In Volunteers;
     Add an applicant. The person is one record in the CRM and the volunteer directory (volunteer_people), tagged
     "volunteer applicant", so the Volunteers search, the CRM and Find volunteers find them.
   - The emails: applications-intake (edge, every 10 minutes) reads CABM, VBM and Je Bénévole emails and files them here.
   Data: volunteer_applications; functions wa209_intake, wa209_volunteer_apply, wa209_move_to_volunteers, wa209_vol_app_status,
   wa209_volunteer_roles. Hooks: w199.barBits and w199.sheetBits call w209. */
(function () {
  'use strict';
  var GREEN = '#103F39', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A';
  var ROLES = [['cook', 'Cook'], ['driver', 'Driver'], ['server', 'Server'], ['dishwasher', 'Dishes'], ['photographer', 'Photographer'], ['community_debrief', 'Community lead'], ['community_talker', 'Community welcome'], ['team_leader', 'Team leader']];
  var SOURCES = [['linkedin', 'LinkedIn'], ['cabm', 'CABM'], ['fcabq', 'Je Bénévole'], ['email', 'Email'], ['referral', 'Referral'], ['website', 'Website'], ['event', 'An event'], ['manual', 'Other']];
  var STATUS = [['received', 'To handle'], ['contacted', 'Contacted'], ['welcomed', 'Welcomed'], ['not_fit', 'Not a fit'], ['withdrawn', 'Withdrawn']];
  var V = { list: null, at: 0, loading: null, tab: 'open', role: '', src: '', q: '', open: {}, busy: false, n: null };

  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function btn(label, attrs, kind) { return '<button type="button" class="w197b' + (kind ? ' ' + kind : '') + '" ' + (attrs || '') + '>' + label + '</button>'; }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : false; } catch (e) { return false; } }
  function lbl(list, k) { var x = list.filter(function (p) { return p[0] === k; })[0]; return x ? x[1] : (k || ''); }
  function roleLabel(k) { if (k === 'volunteer') return 'Volunteer'; var x = lbl(ROLES, k); if (x !== k) return x; try { if (typeof WA_VOL_ROLELABEL !== 'undefined' && WA_VOL_ROLELABEL[k]) return WA_VOL_ROLELABEL[k]; } catch (e) { /* fine */ } return k; }
  function day(s) { if (!s) return ''; try { return new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } }
  function ago(s) { if (!s) return ''; var d = (Date.now() - new Date(s).getTime()) / 86400000; if (d < 1) return 'today'; if (d < 2) return 'yesterday'; if (d < 30) return Math.floor(d) + ' days ago'; if (d < 60) return 'a month ago'; return Math.floor(d / 30) + ' months ago'; }
  function today() { var d = new Date(); var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function msgOf(e) { return (e && (e.message || e.details)) || String(e || 'something went wrong'); }

  /* the same reading of a role as public.wa209_volunteer_roles (the database decides; this only says it as you type) */
  function volRoles(text) {
    var t = lower(text).normalize ? lower(text).normalize('NFD').replace(/[̀-ͯ]/g, '') : lower(text);
    if (!t) return [];
    if (/(coordinat|manager|gestionnaire|director|directeur|directrice|officer|co-lead|co-responsable|assistant|specialist|specialiste|technic|developer|developp|designer|analyst|\bintern\b|stagiaire|relations|marketing|communication|writer|redact|finance|comptab|account|recruit|recrut|\bhr\b|ressources humaines|fundrais|collecte de fonds|website|site web)/.test(t)) return [];
    var r = [];
    if (/(team ?lead|chef d.?equipe|leader d.?equipe|responsable d.?equipe)/.test(t)) r.push('team_leader');
    if (/(cook|cuisin|kitchen)/.test(t) || (/\bchef\b/.test(t) && !/chef d.?equipe/.test(t))) r.push('cook');
    if (/(driver|chauffeu|livreu|livraison)/.test(t)) r.push('driver');
    if (/(\bservers?\b|serveu|\bserving\b|service des repas|service aux repas)/.test(t)) r.push('server');
    if (/(dish|vaisselle|plonge)/.test(t)) r.push('dishwasher');
    if (/photo/.test(t)) r.push('photographer');
    if (/(community lead|community leader|responsable communaut|leader communaut)/.test(t)) r.push('community_debrief');
    if (/(community welcome|community talk|accueil)/.test(t)) r.push('community_talker');
    if (!r.length && /(benevol|volunteer)/.test(t)) r.push('volunteer');
    return r;
  }
  function positions() { try { return (window.w199 && w199.state().pos) || []; } catch (e) { return []; } }
  function depts() { try { return (window.w199 && w199.depts) || []; } catch (e) { return []; } }

  /* ---------- Add an applicant (both pages) ---------- */
  var F = { ctx: 'applications', busy: false, err: '' };
  function formHtml() {
    var vol = F.ctx === 'volunteers';
    var pos = positions();
    var opts = depts().map(function (d) { var ps = pos.filter(function (p) { return p.dept === d[0]; }); return ps.length ? '<optgroup label="' + E(d[1]) + '">' + ps.map(function (p) { return '<option value="' + p.id + '">' + E(p.title) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('');
    return '<div class="bk" data-w209a="shut"></div><div class="pn" role="dialog" aria-modal="true" aria-labelledby="w209h">' + btn('Close', 'data-w209a="shut"', 'sm x') +
      '<h3 id="w209h">Add an applicant</h3><p class="w197note">' + (vol ? 'A volunteer who applied outside the Hub (a call, an event, a referral). They join Applicants received, and the CRM and the volunteer directory, so every search finds them.' : 'Someone who applied outside the Hub’s inboxes (LinkedIn, a referral, an event). Volunteer roles (cook, kitchen, driver, server, dishes, photographer, community lead, team leader) go to the Volunteer Manager instead.') + '</p>' +
      '<label for="w209n">Name</label><input id="w209n" type="text" autocomplete="off" placeholder="First and last name">' +
      '<div class="w209two"><div><label for="w209e">Email</label><input id="w209e" type="email" autocomplete="off"></div><div><label for="w209p">Phone</label><input id="w209p" type="tel" autocomplete="off"></div></div>' +
      (vol ? '<label>What they want to do</label><div class="w209roles" role="group" aria-label="Volunteer roles">' + ROLES.map(function (r) { return '<label class="w209ck"><input type="checkbox" data-w209role="' + r[0] + '"> ' + E(r[1]) + '</label>'; }).join('') + '</div>'
        : '<label for="w209pos">Position</label><select id="w209pos"><option value="">Not one of our positions (write the role below)</option>' + opts + '</select>' +
          '<label for="w209r">Or the role they applied for</label><input id="w209r" type="text" autocomplete="off" placeholder="e.g. Fundraising Co-Lead, Volunteer cook">') +
      '<p class="w209hint" id="w209hint" aria-live="polite"></p>' +
      '<div class="w209two"><div><label for="w209s">Where they applied</label><select id="w209s">' + SOURCES.map(function (s) { return '<option value="' + s[0] + '">' + E(s[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="w209d">Applied on</label><input id="w209d" type="date" value="' + today() + '"></div></div>' +
      '<label for="w209m">' + (vol ? 'What they told us' : 'What they wrote, or your notes') + '</label><textarea id="w209m" rows="4"></textarea>' +
      (vol ? '' : cvField() + '<label for="w209l">LinkedIn or portfolio (optional)</label><input id="w209l" type="url" autocomplete="off" placeholder="https://">') +
      (F.err ? '<p class="w209err" role="alert">' + E(F.err) + '</p>' : '') +
      '<div class="acts">' + btn(F.busy ? 'Adding…' : 'Add the applicant', 'data-w209a="save"' + (F.busy ? ' disabled' : ''), 'pri') + btn('Cancel', 'data-w209a="shut"') + '</div>' +
      (vol ? '' : '<p class="w197note">The Hub puts a copy of the CV in the position’s Resumes folder in Google Drive (Unsorted Resumes when there is no position) and reads it.</p>') + '</div>';
  }
  /* wave211 (Steel, 06/10/26): "If they add applicants manually the link field should be mandatory and be placed in the right
     folder on google drive. Please offer guidance if they don't know where to get the link from the uploaded file in google drive" */
  function resumesFolder() {
    var pid = val('w209pos') || KEEP.w209pos, p = pid ? positions().filter(function (x) { return String(x.id) === String(pid); })[0] : null;
    if (p && p.resumes_id) return { id: p.resumes_id, label: p.title + ' > Resumes' };
    var sv = null; try { sv = w199.state().sync; } catch (e) { sv = null; }
    return sv && sv.unsorted ? { id: sv.unsorted, label: 'Unsorted Resumes' } : null;
  }
  function cvField() {
    var f = resumesFolder();
    return '<label for="w209cv">Their CV in Google Drive (link) <i class="w209req">required</i></label><input id="w209cv" type="url" autocomplete="off" placeholder="https://drive.google.com/file/d/…" aria-describedby="w209cvhelp">' +
      '<p class="w209cvmsg" id="w209cvmsg" aria-live="polite">' + E(F.cvMsg || '') + '</p>' +
      '<details class="w209help" id="w209cvhelp"' + (F.helpOpen ? ' open' : '') + '><summary>Where do I find the link?</summary><ol>' +
      '<li><b>The CV is already in Google Drive:</b> right-click the file (or open it), choose <b>Share</b>, then <b>Copy link</b>, and paste it here.</li>' +
      '<li><b>It came as an email attachment:</b> in Gmail, hover the attachment and click <b>Add to Drive</b> (the triangle icon), then <b>Organize</b> or open it in Drive and Copy link.</li>' +
      '<li><b>It is on your computer:</b> upload it into the position’s Resumes folder' + (f ? ' (' + E(f.label) + ')' : '') + ', then Share > Copy link. Or skip this form: a CV dropped in a Resumes folder becomes a New card by itself within about 10 minutes.</li>' +
      '<li>The link must be to the file, not to a folder. If the Hub says it cannot open it, share the file with hub@welfareavenue.com.</li></ol>' +
      (f ? '<a class="w197b sm" href="https://drive.google.com/drive/folders/' + E(f.id) + '" target="_blank" rel="noopener">Open ' + E(f.label) + '</a>' : '') + '</details>';
  }
  function isVolRole() { var pid = val('w209pos'), title = ''; if (pid) { var p = positions().filter(function (x) { return String(x.id) === pid; })[0]; title = p ? p.title : ''; } return volRoles(title || val('w209r')).length > 0; }
  async function recruit(body) {
    var r = await db.functions.invoke('recruit-actions', { body: body });
    if (r && r.error) { var m = r.error.message || String(r.error); try { if (r.error.context && r.error.context.json) { var j = await r.error.context.json(); if (j && j.error) m = j.error; } } catch (e) { /* fine */ } throw new Error(m); }
    return r ? r.data : null;
  }
  function openForm(ctx) {
    F = { ctx: ctx || 'applications', busy: false, err: '', cvMsg: '', helpOpen: false }; KEEP = {};
    var s = document.getElementById('w209add'); if (!s) { s = document.createElement('div'); s.id = 'w209add'; document.body.appendChild(s); }
    s.innerHTML = formHtml(); s.classList.add('open');
    setTimeout(function () { var n = document.getElementById('w209n'); if (n) try { n.focus(); } catch (e) { /* fine */ } }, 30);
  }
  function shutForm() { var s = document.getElementById('w209add'); if (s) s.classList.remove('open'); }
  function val(id) { var x = document.getElementById(id); return x ? String(x.value || '').trim() : ''; }
  function hint() {
    var h = document.getElementById('w209hint'); if (!h || F.ctx !== 'applications') return;
    var pid = val('w209pos'), title = '';
    if (pid) { var p = positions().filter(function (x) { return String(x.id) === pid; })[0]; title = p ? p.title : ''; }
    var r = volRoles(title || val('w209r'));
    h.innerHTML = r.length ? '<b>' + E(r.map(roleLabel).join(', ')) + '</b> is a volunteer role: this applicant goes to the Volunteer Manager, Applicants received, and into the CRM and the volunteer directory.' : '';
    h.className = 'w209hint' + (r.length ? ' on' : '');
    var rq = document.querySelector('#w209add .w209req'); if (rq) rq.textContent = r.length ? 'not needed for a volunteer role' : 'required';
  }
  async function save() {
    if (F.busy) return;
    var name = val('w209n'); if (!name) { F.err = 'Their name, please.'; repaintForm(); return; }
    var email = val('w209e'), phone = val('w209p');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { F.err = 'That email does not look right.'; repaintForm(); return; }
    var cvUrl = F.ctx === 'volunteers' ? '' : val('w209cv'), volRole = F.ctx !== 'volunteers' && isVolRole();
    if (F.ctx !== 'volunteers' && !volRole) {
      if (!cvUrl) { F.err = 'The link to their CV in Google Drive, please. “Where do I find the link?” shows how.'; F.helpOpen = true; repaintForm(); return; }
      if (!/^https:\/\/(drive|docs)\.google\.com\//.test(cvUrl)) { F.err = 'That is not a Google Drive link. Open the CV in Drive, then Share > Copy link.'; F.helpOpen = true; repaintForm(); return; }
    }
    var src = val('w209s') || 'manual', when = val('w209d'), msg = val('w209m');
    var applied = when ? new Date(when + 'T12:00:00').toISOString() : null;
    F.busy = true; F.err = ''; keep(); repaintForm();
    try {
      var r;
      if (F.ctx === 'volunteers') {
        var roles = Array.prototype.slice.call(document.querySelectorAll('#w209add [data-w209role]:checked')).map(function (x) { return x.getAttribute('data-w209role'); });
        var res = await db.rpc('wa209_volunteer_apply', { p: { name: name, email: email || null, phone: phone || null, roles: roles.length ? roles : ['volunteer'], role_text: roles.length ? roles.map(roleLabel).join(', ') : 'Volunteer',
          source: src, applied_at: applied, message: msg || null, source_ref: 'hub:' + Date.now().toString(36) + ':' + lower(email || name) } });
        if (res && res.error) throw res.error; r = (res && res.data) || {};
      } else {
        if (cvUrl) {   /* the Hub must be able to open the CV before the card is made */
          F.cvMsg = 'Checking the CV link…'; repaintForm();
          var chk = await recruit({ action: 'cv_check', url: cvUrl });
          if (!chk || !chk.ok) { F.busy = false; F.cvMsg = ''; F.err = (chk && chk.error) || 'The Hub could not open that link.'; F.helpOpen = true; repaintForm(); return; }
          F.cvMsg = 'Found: ' + chk.name;
        }
        var lk = [cvUrl, val('w209l')].filter(Boolean);
        var res2 = await db.rpc('wa209_intake', { p: { name: name, email: email || null, phone: phone || null, position_id: val('w209pos') || null, role: val('w209r') || null, source: src, applied_at: applied,
          message: msg || null, links: lk } });
        if (res2 && res2.error) throw res2.error; r = (res2 && res2.data) || {};
        if (cvUrl && r.candidate_id && r.to !== 'volunteers' && !r.duplicate) {
          try { var fc = await recruit({ action: 'file_cv', id: r.candidate_id, url: cvUrl }); r.cvNote = fc && fc.ok ? (fc.filed ? (fc.copied ? 'CV filed in ' + fc.where : 'CV already in ' + fc.where) : (fc.note || '')) : ('CV not filed: ' + ((fc && fc.error) || 'unknown')); }
          catch (x) { r.cvNote = 'CV not filed: ' + (x.message || x); }
        }
      }
      F.busy = false; shutForm();
      try { await db.from('change_log').insert({ entity_type: r.to === 'volunteers' ? 'volunteer_application' : 'candidate', entity_id: String(r.application_id || r.candidate_id || ''), field: 'added_by_hand', old_value: null, new_value: name, changed_by: (typeof USER !== 'undefined' && USER && (USER.name || USER.email)) || null }); } catch (x) { /* audit */ }
      if (r.to === 'volunteers') {
        toastS(name + (r.duplicate ? ' was already in Applicants received' : ' added to Applicants received (Volunteer Manager)'));
        V.at = 0; if (onView()) { await load(true); paint(); } else counts();
      } else {
        toastS(r.duplicate ? name + ' already has a card for this role' : name + ' added to New' + (r.cvNote ? '. ' + r.cvNote : ''));
        try { if (window.w197) { await w197.loadCands(true); w197.paintBoard(); if (r.candidate_id) w197.openSheet(r.candidate_id); } } catch (x) { /* fine */ }
      }
    } catch (e) { F.busy = false; F.err = 'Could not add them: ' + msgOf(e); repaintForm(); }
  }
  var KEEP = {};
  function keep() { ['w209n', 'w209e', 'w209p', 'w209pos', 'w209r', 'w209s', 'w209d', 'w209m', 'w209l', 'w209cv'].forEach(function (id) { var x = document.getElementById(id); if (x) KEEP[id] = x.value; }); KEEP.roles = Array.prototype.slice.call(document.querySelectorAll('#w209add [data-w209role]:checked')).map(function (x) { return x.getAttribute('data-w209role'); }); }
  function repaintForm() {
    var s = document.getElementById('w209add'); if (!s) return; keep(); s.innerHTML = formHtml();
    Object.keys(KEEP).forEach(function (id) { if (id === 'roles') return; var x = document.getElementById(id); if (x && KEEP[id] != null) x.value = KEEP[id]; });
    (KEEP.roles || []).forEach(function (k) { var c = s.querySelector('[data-w209role="' + k + '"]'); if (c) c.checked = true; });
    hint();
  }

  /* ---------- Applications: the bar and the card ---------- */
  function barBits() { return staff() ? btn('Add an applicant', 'data-w209a="add" data-ctx="applications"', 'sm pri') : ''; }
  function sheetBits(c) {
    if (!c || !staff()) return '';
    var title = c.role || '';
    try { var p = c.position_id && positions().filter(function (x) { return String(x.id) === String(c.position_id); })[0]; if (p) title = p.title; } catch (e) { /* fine */ }
    var r = volRoles(title); if (!r.length) return '';
    return '<div class="w209move"><b>' + E(r.map(roleLabel).join(', ')) + ' is a volunteer role.</b> Volunteer applicants are handled in the Volunteer Manager, Applicants received, with their record in the CRM and the volunteer directory.' +
      '<div class="acts">' + btn('Move to the Volunteer Manager', 'data-w209move="' + c.id + '"', 'sm pri') + '</div></div>';
  }
  async function moveCard(id) {
    var c = null; try { c = w197.state().cands.filter(function (x) { return String(x.id) === String(id); })[0]; } catch (e) { c = null; }
    if (!window.confirm('Move ' + ((c && c.name) || 'this applicant') + ' to the Volunteer Manager? The card leaves Applications; their application, contact and message go to Applicants received.')) return;
    try {
      var r = await db.rpc('wa209_move_to_volunteers', { p_id: Number(id) }); if (r && r.error) throw r.error;
      var sh = document.getElementById('w197sheet'); if (sh) sh.classList.remove('open');
      try { var st = w197.state(); st.open = null; st.cands = st.cands.filter(function (x) { return String(x.id) !== String(id); }); w197.paintBoard(); } catch (x) { /* fine */ }
      V.at = 0; counts();
      toastS(((c && c.name) || 'The applicant') + ' moved to Applicants received (Volunteer Manager)');
    } catch (e) { toastS('Could not move them: ' + msgOf(e)); }
  }

  /* ---------- the Volunteer Manager: Applicants received ---------- */
  function onView() { try { return typeof WA_VOL_VIEW !== 'undefined' && WA_VOL_VIEW === 'applicants'; } catch (e) { return false; } }
  async function load(force) {
    if (V.loading) return V.loading;
    if (!force && V.list && Date.now() - V.at < 60000) return V.list;
    V.loading = (async function () {
      try { var r = await db.from('volunteer_applications').select('*').order('applied_at', { ascending: false }).limit(2000); V.list = (r && !r.error && r.data) || []; } catch (e) { V.list = V.list || []; }
      V.at = Date.now(); V.loading = null; V.n = V.list.filter(isOpen).length;
      return V.list;
    })();
    return V.loading;
  }
  function isOpen(a) { return a.status === 'received' || a.status === 'contacted'; }
  async function counts(noLoad) { if (!staff()) return; if (!noLoad) await load(true); try { if (window.WA_APP && typeof WA_APP.renderRail === 'function') WA_APP.renderRail(); } catch (e) { /* fine */ } try { document.dispatchEvent(new CustomEvent('w209count', { detail: V.n })); } catch (e) { /* fine */ } }
  function shown() {
    var q = lower(V.q);
    return (V.list || []).filter(function (a) {
      if (V.tab === 'open' && !isOpen(a)) return false;
      if (V.tab === 'welcomed' && a.status !== 'welcomed') return false;
      if (V.tab === 'closed' && a.status !== 'not_fit' && a.status !== 'withdrawn') return false;
      if (V.role && (a.roles || []).indexOf(V.role) < 0) return false;
      if (V.src && a.source !== V.src) return false;
      if (q && lower([a.name, a.email, a.phone, a.role_text, a.message, (a.roles || []).map(roleLabel).join(' ')].join(' ')).indexOf(q) < 0) return false;
      return true;
    }).sort(function (x, y) { if (V.tab === 'open' && x.status !== y.status) return x.status === 'received' ? -1 : 1; return String(y.applied_at).localeCompare(String(x.applied_at)); });
  }
  function cardHtml(a) {
    var long = String(a.message || '').length > 260, open = !!V.open[a.id];
    var msg = a.message ? '<div class="w209msg">' + E(open || !long ? a.message : String(a.message).slice(0, 240) + '…') + (long ? ' ' + btn(open ? 'Less' : 'More', 'data-w209more="' + a.id + '"', 'sm link') : '') + '</div>' : '';
    var cv = a.cv_url ? '<a class="w197b sm" href="' + E(a.cv_url) + '" target="_blank" rel="noopener">CV</a>' : (a.cv_path ? btn('CV', 'data-w209cv="' + E(a.cv_path) + '"', 'sm') : '');
    var stt = '<span class="w209st ' + E(a.status) + '">' + E(lbl(STATUS, a.status)) + '</span>';
    return '<li class="w209app" data-w209id="' + a.id + '"><div class="w209hd"><b>' + E(a.name) + '</b>' + stt + '</div>' +
      '<div class="w209roles2">' + (a.roles || []).map(function (k) { return '<span class="w209chip">' + E(roleLabel(k)) + '</span>'; }).join('') + (a.role_text && (a.roles || []).length <= 1 ? '<small>' + E(a.role_text) + '</small>' : '') + '</div>' +
      '<p class="w209meta">Applied ' + E(ago(a.applied_at)) + ' (' + E(day(a.applied_at)) + ') · ' + E(lbl(SOURCES, a.source) || a.source) + (a.language ? ' · ' + (a.language === 'fr' ? 'French' : a.language === 'en' ? 'English' : E(a.language)) : '') + '</p>' +
      '<p class="w209ct">' + (a.email ? '<a href="mailto:' + E(a.email) + '">' + E(a.email) + '</a>' : '') + (a.email && a.phone ? ' · ' : '') + (a.phone ? '<a href="tel:' + E(String(a.phone).replace(/[^\d+]/g, '')) + '">' + E(a.phone) + '</a>' : '') + (!a.email && !a.phone ? 'No contact details' : '') + '</p>' +
      msg + (a.handled_by ? '<p class="w209meta">' + E(lbl(STATUS, a.status)) + ' by ' + E(a.handled_by) + ' ' + E(ago(a.handled_at)) + (a.status_note ? ': ' + E(a.status_note) : '') + '</p>' : '') +
      '<div class="w209acts">' + cv + (a.contact_id ? '<a class="w197b sm" href="#crm/c/' + E(a.contact_id) + '">In the CRM</a>' : '') + btn('In Volunteers', 'data-w209vol="' + a.id + '"', 'sm') + '</div>' +
      '<div class="w209do"><input type="text" data-w209note="' + a.id + '" placeholder="A note (optional)" aria-label="A note for ' + E(a.name) + '">' +
      STATUS.filter(function (s) { return s[0] !== a.status && s[0] !== 'received'; }).map(function (s) { return btn(s[0] === 'welcomed' ? 'Welcome' : s[1], 'data-w209st="' + a.id + '" data-s="' + s[0] + '"', 'sm' + (s[0] === 'welcomed' ? ' pri' : '')); }).join('') +
      (a.status !== 'received' ? btn('Back to To handle', 'data-w209st="' + a.id + '" data-s="received"', 'sm link') : '') + '</div></li>';
  }
  function pageHtml() {
    var all = V.list || [], open = all.filter(isOpen).length, wel = all.filter(function (a) { return a.status === 'welcomed'; }).length, cl = all.filter(function (a) { return a.status === 'not_fit' || a.status === 'withdrawn'; }).length;
    var tabs = [['open', 'To handle', open], ['welcomed', 'Welcomed', wel], ['closed', 'Not a fit or withdrawn', cl], ['all', 'All', all.length]];
    var list = V.list ? shown() : null;
    var rolesHere = ROLES.filter(function (r) { return all.some(function (a) { return (a.roles || []).indexOf(r[0]) >= 0; }); });
    var srcHere = SOURCES.filter(function (s) { return all.some(function (a) { return a.source === s[0]; }); });
    return '<div id="w209v"><p class="w209lead">Volunteers who applied (CABM, Je Bénévole, an email to volunteer@ or job@, or added by hand). Each one is already in the CRM and the volunteer directory, tagged volunteer applicant, so Volunteers, the CRM and Find volunteers find them. Reply within two weeks (CABM asks it), then mark them.</p>' +
      '<div class="w209bar"><div class="w209tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (V.tab === t[0]) + '" class="' + (V.tab === t[0] ? 'on' : '') + '" data-w209tab="' + t[0] + '">' + E(t[1]) + ' <em>' + t[2] + '</em></button>'; }).join('') + '</div>' +
      btn('Add an applicant', 'data-w209a="add" data-ctx="volunteers"', 'sm pri') + '</div>' +
      '<div class="w209filt"><input type="search" id="w209q" placeholder="Search a name, email, phone or message" value="' + E(V.q) + '" aria-label="Search the applicants">' +
      '<select id="w209role" aria-label="Role"><option value="">Every role</option>' + rolesHere.map(function (r) { return '<option value="' + r[0] + '"' + (V.role === r[0] ? ' selected' : '') + '>' + E(r[1]) + '</option>'; }).join('') + '</select>' +
      '<select id="w209src" aria-label="Where they applied"><option value="">Every source</option>' + srcHere.map(function (s) { return '<option value="' + s[0] + '"' + (V.src === s[0] ? ' selected' : '') + '>' + E(s[1]) + '</option>'; }).join('') + '</select></div>' +
      (list === null ? '<p class="w197note">Loading the applicants…</p>' : (list.length ? '<ul class="w209list">' + list.map(cardHtml).join('') + '</ul>' : '<p class="w197note">' + (V.tab === 'open' ? 'Nobody waits for an answer.' : 'No one here.') + '</p>')) + '</div>';
  }
  var SUB = 'Volunteers who applied, waiting for a reply';
  function paint() {
    if (!onView()) return;
    var a = document.activeElement, qf = a && a.id === 'w209q';
    try { if (typeof waVolPaint === 'function') waVolPaint(pageHtml()); } catch (e) { /* fine */ }
    masthead();
    if (qf) { var x = document.getElementById('w209q'); if (x) { x.focus(); try { x.setSelectionRange(x.value.length, x.value.length); } catch (e) { /* fine */ } } }
  }
  function masthead() {
    if (!onView()) return;
    var sec = document.getElementById('volunteering'); if (!sec) return;
    var m = sec.querySelector('.w118mast'); if (!m) return;
    var h1 = m.querySelector('h1'), p = m.querySelector(':scope > p');
    if (h1 && h1.textContent !== 'Applicants received') h1.textContent = 'Applicants received';
    if (p && p.textContent !== SUB) p.textContent = SUB;
  }
  function watch() {
    var sec = document.getElementById('volunteering'); if (!sec || sec.getAttribute('data-w209mo')) return;
    sec.setAttribute('data-w209mo', '1'); var t = null;
    try { new MutationObserver(function () { if (!onView()) return; clearTimeout(t); t = setTimeout(masthead, 40); }).observe(sec, { childList: true, subtree: true, characterData: true }); } catch (e) { /* fine */ }
  }
  async function setStatus(id, s) {
    var a = (V.list || []).filter(function (x) { return String(x.id) === String(id); })[0]; if (!a) return;
    var n = document.querySelector('[data-w209note="' + id + '"]'), note = n ? n.value.trim() : '';
    try {
      var r = await db.rpc('wa209_vol_app_status', { p_id: Number(id), p_status: s, p_note: note || null }); if (r && r.error) throw r.error;
      a.status = s; a.status_note = note || a.status_note; a.handled_by = (typeof USER !== 'undefined' && USER && (USER.name || USER.email)) || a.handled_by; a.handled_at = new Date().toISOString();
      V.n = (V.list || []).filter(isOpen).length; paint(); counts(true);
      toastS(a.name + ': ' + (s === 'welcomed' ? 'welcomed' : lbl(STATUS, s).toLowerCase()));
    } catch (e) { toastS('Could not save: ' + msgOf(e)); }
  }
  async function openCv(path) {
    try { var r = await db.storage.from('hub-mail').createSignedUrl(path, 600); if (r && r.data && r.data.signedUrl) window.open(r.data.signedUrl, '_blank', 'noopener'); else toastS('Could not open the CV'); } catch (e) { toastS('Could not open the CV'); }
  }
  function toVolunteers(id) {
    var a = (V.list || []).filter(function (x) { return String(x.id) === String(id); })[0]; if (!a) return;
    try { window.WA26_Q = a.name; } catch (e) { /* fine */ }
    location.hash = '#volunteering/people';
  }

  /* the Volunteer Manager: the view, the chip, the rail item with the count (wave195's pattern) */
  function wrapVol() {
    var ok = true;
    if (typeof waVolRender === 'function') {
      if (!waVolRender.__w209) {
        var vr = waVolRender;
        waVolRender = async function () {
          if (onView()) {
            if (!staff()) { WA_VOL_VIEW = 'calendar'; try { history.replaceState(null, '', '#volunteering'); } catch (e) { /* fine */ } return await vr.apply(this, arguments); }
            watch(); paint(); load().then(paint);
            setTimeout(masthead, 150); setTimeout(masthead, 700);
            return;
          }
          return await vr.apply(this, arguments);
        };
        waVolRender.__w209 = true;
      }
    } else ok = false;
    if (typeof waVolShell === 'function') {
      if (!waVolShell.__w209) {
        var sh = waVolShell;
        waVolShell = function (inner) {
          var html = sh(inner);
          try { if (staff() && html.indexOf('data-vl="applicants"') < 0) html = html.replace('Volunteers</span>', 'Volunteers</span><span class="fchip' + (onView() ? ' on' : '') + '" data-vl="applicants">Applicants' + (V.n ? ' (' + V.n + ')' : '') + '</span>'); } catch (e) { /* fine */ }
          return html;
        };
        waVolShell.__w209 = true;
      }
    } else ok = false;
    return ok;
  }
  function railItem() {
    var A = window.WA_APP && window.WA_APP.apps;
    if (!A || !A.volunteer || typeof A.volunteer.groups !== 'function') return false;
    if (A.volunteer.__w209) return true;
    var g0 = A.volunteer.groups;
    A.volunteer.groups = function () {
      var gs = g0.apply(this, arguments);
      if (!staff()) return gs;
      try {
        var it = { h: '#volunteering/applicants', l: 'Applicants received', ic: 'inbox', page: 'volunteering', n: V.n ? String(V.n) : null };
        var people = gs.filter(function (g) { return /people/i.test(g.label || ''); })[0];
        if (people) { if (!people.items.some(function (x) { return x.h === it.h; })) { var at = people.items.findIndex ? people.items.findIndex(function (x) { return /#volunteering\/people$/.test(x.h); }) : -1; people.items.splice(at >= 0 ? at + 1 : people.items.length, 0, it); } }
        else gs.push({ label: 'People', items: [it] });
      } catch (e) { /* fine */ }
      return gs;
    };
    A.volunteer.__w209 = true;
    return true;
  }
  function arm() { var a = wrapVol(), b = railItem(); return a && b; }
  if (!arm()) { setTimeout(arm, 800); setTimeout(arm, 2500); setTimeout(arm, 6000); }
  document.addEventListener('wa153app', function (e) { if (e && e.detail && e.detail.app === 'volunteer') { railItem(); counts(); } });
  setTimeout(function () { if (staff() && document.body.classList.contains('w153volunteer')) counts(); }, 4500);

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-w209a],[data-w209move],[data-w209tab],[data-w209st],[data-w209more],[data-w209cv],[data-w209vol]') : null; if (!t) return;
    var a = t.getAttribute('data-w209a');
    if (a === 'add') { e.preventDefault(); openForm(t.getAttribute('data-ctx')); return; }
    if (a === 'shut') { shutForm(); return; }
    if (a === 'save') { save(); return; }
    if (t.hasAttribute('data-w209move')) { moveCard(t.getAttribute('data-w209move')); return; }
    if (t.hasAttribute('data-w209tab')) { V.tab = t.getAttribute('data-w209tab'); paint(); return; }
    if (t.hasAttribute('data-w209st')) { setStatus(t.getAttribute('data-w209st'), t.getAttribute('data-s')); return; }
    if (t.hasAttribute('data-w209more')) { var id = t.getAttribute('data-w209more'); V.open[id] = !V.open[id]; paint(); return; }
    if (t.hasAttribute('data-w209cv')) { openCv(t.getAttribute('data-w209cv')); return; }
    if (t.hasAttribute('data-w209vol')) { toVolunteers(t.getAttribute('data-w209vol')); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w209q') { V.q = t.value; paint(); }
    if (t.id === 'w209r') hint();
  });
  document.addEventListener('toggle', function (e) { if (e.target && e.target.id === 'w209cvhelp') F.helpOpen = e.target.open; }, true);   /* wave211: the guidance stays open across repaints */
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w209pos') { repaintForm(); var ps = document.getElementById('w209pos'); if (ps) try { ps.focus(); } catch (x) { /* fine */ } }   /* wave211: the Resumes folder follows the position */
    if (t.id === 'w209role') { V.role = t.value; paint(); }
    if (t.id === 'w209src') { V.src = t.value; paint(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var s = document.getElementById('w209add'); if (s && s.classList.contains('open')) shutForm(); } });

  var css = document.createElement('style'); css.id = 'w209css';
  css.textContent =
    '#w209add{position:fixed;inset:0;z-index:1250;display:none;}#w209add.open{display:block;}#w209add .bk{position:absolute;inset:0;background:rgba(16,32,30,.4);}' +
    '#w209add .pn{position:absolute;right:0;top:0;bottom:0;width:min(520px,100%);background:#FFFAF2;overflow:auto;padding:18px 16px 28px;box-shadow:-8px 0 24px rgba(0,0,0,.12);}#w209add .x{float:right;}' +
    '#w209add label{display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:' + GREEN + ';margin:12px 0 4px;}' +
    '#w209add input[type=text],#w209add input[type=email],#w209add input[type=tel],#w209add input[type=url],#w209add input[type=date],#w209add select,#w209add textarea{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px 10px;border:1px solid rgba(16,63,57,.25);border-radius:8px;background:#FFFAF2;}' +
    '#w209add .acts{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;}.w209two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}@media (max-width:520px){.w209two{grid-template-columns:1fr;}}' +
    '.w209roles{display:flex;flex-wrap:wrap;gap:6px 14px;}#w209add .w209ck{display:inline-flex;align-items:center;gap:6px;text-transform:none;letter-spacing:0;font-weight:500;font-size:14px;color:#1F201E;margin:0;}' +
    '#w209add .w209req{font-style:normal;text-transform:none;letter-spacing:0;color:' + FLAG + ';margin-left:4px;}.w209cvmsg{font-size:13px;color:#1d6b5d;margin:4px 0 0;min-height:0;}' +
    '.w209help{margin:6px 0 4px;font-size:13.5px;}.w209help summary{cursor:pointer;color:#103F39;font-weight:600;}.w209help ol{margin:6px 0 8px;padding-left:20px;}.w209help li{margin:4px 0;}' +
    '.w209hint{font-size:13.5px;margin:8px 0 0;min-height:0;}.w209hint.on{background:rgba(42,140,122,.12);border-radius:8px;padding:8px 10px;color:#1d6b5d;}.w209err{color:' + FLAG + ';font-size:14px;margin:10px 0 0;}' +
    '.w209move{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(42,140,122,.1);font-size:13.5px;}.w209move .acts{margin-top:8px;}' +
    '#w209v .w209lead{font-size:14px;margin:0 0 10px;color:#3c4a47;}.w209bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px;}' +
    '.w209tabs{display:flex;flex-wrap:wrap;gap:6px;}.w209tabs button{font:inherit;font-size:13.5px;border:1px solid rgba(16,63,57,.2);background:transparent;border-radius:999px;padding:5px 12px;cursor:pointer;color:' + GREEN + ';}.w209tabs button.on{background:' + GREEN + ';color:#FFFAF2;border-color:' + GREEN + ';}.w209tabs em{font-style:normal;opacity:.75;margin-left:2px;}' +
    '.w209filt{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px;}.w209filt input{flex:1 1 220px;min-width:0;font:inherit;padding:8px 10px;border:1px solid rgba(16,63,57,.22);border-radius:8px;background:#FFFAF2;}.w209filt select{font:inherit;padding:7px 8px;border:1px solid rgba(16,63,57,.22);border-radius:8px;background:#FFFAF2;max-width:100%;}' +
    '.w209list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;}@media (max-width:640px){.w209list{grid-template-columns:1fr;}}' +
    '.w209app{border:1px solid rgba(16,63,57,.14);border-radius:12px;padding:12px;background:rgba(16,63,57,.03);min-width:0;}.w209hd{display:flex;justify-content:space-between;gap:8px;align-items:baseline;}.w209hd b{font-size:15.5px;}' +
    '.w209st{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap;}.w209st.received{background:rgba(220,165,39,.22);color:#7a5a0c;}.w209st.contacted{background:rgba(42,140,122,.14);color:#1d6b5d;}.w209st.welcomed{background:' + TEAL + ';color:#FFFAF2;}.w209st.not_fit,.w209st.withdrawn{background:rgba(16,63,57,.08);color:#4a5a56;}' +
    '.w209roles2{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0 2px;}.w209chip{font-size:12px;font-weight:600;background:rgba(16,63,57,.08);color:' + GREEN + ';border-radius:6px;padding:2px 7px;}.w209roles2 small{color:#5b6b67;font-size:12px;}' +
    '.w209meta{font-size:12.5px;color:#5b6b67;margin:4px 0;}.w209ct{font-size:13.5px;margin:4px 0;overflow-wrap:anywhere;}.w209msg{font-size:13.5px;white-space:pre-wrap;background:#FFFAF2;border-radius:8px;padding:8px;margin:6px 0;overflow-wrap:anywhere;}' +
    '.w209acts,.w209do{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center;}.w209do input{flex:1 1 160px;min-width:0;font:inherit;font-size:13.5px;padding:6px 8px;border:1px solid rgba(16,63,57,.2);border-radius:8px;background:#FFFAF2;}' +
    '.w197b.link{border:none;text-decoration:underline;padding:2px 4px;}';
  (document.head || document.documentElement).appendChild(css);

  window.w209 = { state: function () { return V; }, load: load, counts: counts, paint: paint, barBits: barBits, sheetBits: sheetBits, openForm: openForm, volRoles: volRoles, moveCard: moveCard, arm: arm };
})();
