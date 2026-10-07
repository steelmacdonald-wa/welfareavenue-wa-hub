/* =====================================================================
   WA v211 Recruitment, from the HR meeting (06/10/26): "still interested?" texts, the offer letter, the CV read
   =====================================================================
   Numbered wave211 at release (a parallel session shipped the Transcript archive's tasks as wave210 the same day); the
   database objects keep their wa210 names: wa210_stage_moved, trg_wa210_stage, build/data/wa210_recruit.sql, wa210b_call_quo_gates.
   Steel, Valex and Samson (06/10/26): text applicants from the board so a tap on their link moves them to Reviewing;
   moving a card to Offer asks "do we send them the offer now?" and the letter goes with the offer note by email;
   the team is told when a card moves; "let's be able to process every resume, no matter the file type".
   - The sheet at New or Reviewing: Text: still interested? (the exact text first, then send). The board's selection
     bar does the same for several. Cards say Texted Oct 6, or Said yes.
   - Offer: moving a card to Offer opens the offer letter (language, reports to, hours, start, reply by, who signs, the
     note), a preview, then Create the letter and email it (or the letter only). The sheet at Offer and Hired opens it again.
   - From the CV: what the CV says (current role, experience, education, languages, skills, a summary); Read the CV.
   - Slack when a card moves to Interview, Offer or Hired is server-side (recruit-actions stage_moved, trigger).
   Edge: recruit-actions. Hooks: w199.cardBits, w199.sheetBits, w199's selection bar, parts197 moveTo. */
(function () {
  'use strict';
  var GREEN = '#103F39', GOLD = '#DCA527', TEAL = '#2A8C7A', FLAG = '#B3402F';
  var M = { kind: '', id: null, ids: [], data: null, busy: false, err: '', f: null, preview: '' };

  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function btn(label, attrs, kind) { return '<button type="button" class="w197b' + (kind ? ' ' + kind : '') + '" ' + (attrs || '') + '>' + label + '</button>'; }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : false; } catch (e) { return false; } }
  function cands() { try { return (window.w197 && w197.state().cands) || []; } catch (e) { return []; } }
  function cand(id) { return cands().filter(function (x) { return String(x.id) === String(id); })[0] || null; }
  function short(t) { try { return new Date(t).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  function iso(d) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function myName() { try { return (window.USER && (USER.name || USER.full_name)) || ''; } catch (e) { return ''; } }
  function answered(c) { var s = String((c && c.summary) || ''); return s.indexOf('✅ Still interested') === 0 ? 'yes' : (s.indexOf('❌ No longer interested') === 0 ? 'no' : ''); }
  async function fn(body) {
    var r = await db.functions.invoke('recruit-actions', { body: body });
    if (r && r.error) {
      var msg = r.error.message || String(r.error);
      try { if (r.error.context && r.error.context.json) { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } } catch (e) { /* fine */ }
      throw new Error(msg);
    }
    if (r && r.data && r.data.error) throw new Error(r.data.error);
    return r ? r.data : null;
  }
  async function reload(id) { try { await w197.loadCands(true); w197.paintBoard(); var st = w197.state(); if (id && String(st.open) === String(id)) w197.openSheet(id); } catch (e) { /* fine */ } }

  /* ---------- the card and the sheet ---------- */
  function cardBits(c) {
    if (!c) return '';
    var a = answered(c), out = '';
    if (a === 'yes') out += '<span class="w211pill ok">Said yes</span>';
    else if (c.interest_texted_at && (c.status === 'new' || c.status === 'reviewing')) out += '<span class="w211pill">Texted ' + E(short(c.interest_texted_at)) + '</span>';
    if (c.offer_sent_at && (c.status === 'offer' || c.status === 'hired')) out += '<span class="w211pill ok">Offer sent ' + E(short(c.offer_sent_at)) + '</span>';
    else if (c.status === 'offer' && !c.offer_sent_at) out += '<span class="w211pill gold">Offer not sent</span>';
    return out;
  }
  function cvBox(c) {
    var p = c.cv_profile, has = !!(c.cv_path || c.drive_file_id);
    if (!p && !has) return '';
    if (!p) return '<div class="w211cv"><b>The CV</b> ' + (c.cv_read_error ? '<span class="w211err">Could not be read: ' + E(c.cv_read_error) + '</span> ' : '<span class="w197note">Not read yet (the Hub reads new CVs every 15 minutes).</span> ') + btn(c.cv_read_error ? 'Try again' : 'Read the CV now', 'data-w211cv="' + c.id + '"', 'sm') + '</div>';
    var line = function (k, v) { return v ? '<div><small>' + E(k) + '</small> ' + E(v) + '</div>' : ''; };
    return '<div class="w211cv"><b>From the CV</b>' + (p.summary ? '<p>' + E(p.summary) + '</p>' : '') +
      line('Now', p.current_role) + line('Experience', p.years_experience != null ? p.years_experience + ' years' : '') + line('Education', p.education) + line('Languages', (p.languages || []).join(', ')) + line('City', p.city) +
      ((p.skills || []).length ? '<div class="w211sk">' + p.skills.map(function (s) { return '<span>' + E(s) + '</span>'; }).join('') + '</div>' : '') +
      (p.name && c.name && String(p.name).toLowerCase() !== String(c.name).toLowerCase() ? '<p class="w197note">The CV says <b>' + E(p.name) + '</b>. ' + btn('Use this name', 'data-w211name="' + c.id + '"', 'sm link') + '</p>' : '') +
      '<p class="w197note">Read ' + E(short(c.cv_read_at)) + '. ' + btn('Read it again', 'data-w211cv="' + c.id + '"', 'sm link') + '</p></div>';
  }
  function sheetBits(c) {
    if (!c || !staff()) return '';
    var h = '';
    if (c.status === 'new' || c.status === 'reviewing') {
      var a = answered(c);
      h += '<div class="w211box"><b>Still interested?</b> ' + (a === 'yes' ? 'They said yes by text.' : a === 'no' ? 'They said no by text.' : (c.interest_texted_at ? 'Texted ' + E(short(c.interest_texted_at)) + ', no answer yet. ' : 'One text with their own link: a tap on Yes moves them to Reviewing. ')) +
        (a ? '' : btn(c.interest_texted_at ? 'Text again' : 'Text: still interested?', 'data-w211int="' + c.id + '"', 'sm' + (c.interest_texted_at ? '' : ' pri'))) + '</div>';
    }
    if (c.status === 'offer' || c.status === 'hired') {
      h += '<div class="w211box"><b>Offer letter</b> ' + (c.offer_doc_url ? '<a class="w197b sm" href="' + E(c.offer_doc_url) + '" target="_blank" rel="noopener">Open the letter</a> ' : '') +
        (c.offer_sent_at ? 'Emailed ' + E(short(c.offer_sent_at)) + (c.offer_email_to ? ' (' + E(c.offer_email_to) + ')' : '') + '. ' : (c.offer_doc_url ? 'Created, not emailed yet. ' : 'Not sent yet. ')) +
        btn(c.offer_sent_at ? 'Send it again' : 'Send the offer letter', 'data-w211offer="' + c.id + '"', 'sm' + (c.offer_sent_at ? '' : ' pri')) + '</div>';
    }
    var rec = '';
    if (c.impressions) rec += '<div><small>Interview impressions</small><p>' + E(c.impressions) + '</p></div>';
    if (c.accepted_on || c.start_date) rec += '<div><small>Hired</small> ' + (c.accepted_on ? 'accepted ' + E(c.accepted_on) : '') + (c.accepted_on && c.start_date ? ', ' : '') + (c.start_date ? 'starts ' + E(c.start_date) : '') + '</div>';
    if (c.close_reason && (c.status === 'declined' || c.status === 'withdrawn')) rec += '<div><small>Why closed</small> ' + E(c.close_reason) + '</div>';
    if (rec) h += '<div class="w211cv">' + rec + '</div>';
    return h + cvBox(c);
  }

  /* ---------- the panel ---------- */
  function panel(inner) {
    var s = document.getElementById('w211m'); if (!s) { s = document.createElement('div'); s.id = 'w211m'; document.body.appendChild(s); }
    s.innerHTML = '<div class="bk" data-w211a="shut"></div><div class="pn" role="dialog" aria-modal="true" aria-labelledby="w211h">' + btn('Close', 'data-w211a="shut"', 'sm x') + inner + '</div>';
    s.classList.add('open');
  }
  function shut() { var s = document.getElementById('w211m'); if (s) s.classList.remove('open'); M.kind = ''; }

  /* "still interested?" */
  async function askInterest(ids) {
    M = { kind: 'int', ids: ids, data: null, busy: true, err: '' }; paintInt();
    try { M.data = await fn({ action: 'interest_text', ids: ids, dry_run: true }); } catch (e) { M.err = e.message; }
    M.busy = false; paintInt();
  }
  function paintInt() {
    if (M.kind !== 'int') return;
    var d = M.data, ready = d ? (d.texts || []).filter(function (t) { return !t.skip; }) : [], skip = d ? (d.texts || []).filter(function (t) { return t.skip; }) : [];
    panel('<h3 id="w211h">Text: still interested?</h3>' +
      (M.busy && !d ? '<p class="w197note">Preparing the texts…</p>' : '') + (M.err ? '<p class="w211err" role="alert">' + E(M.err) + '</p>' : '') +
      (d ? '<p class="w197note">From the ops line, in their language, with their own link: Yes moves the card to Reviewing, No to Withdrawn. ' + E(d.window || '') + '</p>' +
        (ready.length ? '<ul class="w211txt">' + ready.map(function (t) { return '<li><b>' + E(t.name) + '</b> <small>' + E(t.phone) + ' · ' + (t.lang === 'fr' ? 'French' : 'English') + '</small><p>' + E(t.body) + '</p></li>'; }).join('') + '</ul>' : '<p>Nobody to text.</p>') +
        (skip.length ? '<p class="w197note"><b>Not texted:</b> ' + skip.map(function (t) { return E(t.name) + ' (' + E(t.skip) + ')'; }).join(', ') + '</p>' : '') +
        '<div class="acts">' + (ready.length ? btn(M.busy ? 'Sending…' : 'Send ' + ready.length + (ready.length === 1 ? ' text' : ' texts'), 'data-w211a="intsend"' + (M.busy ? ' disabled' : ''), 'pri') : '') + btn('Cancel', 'data-w211a="shut"') + '</div>' : ''));
  }
  async function sendInt() {
    if (M.busy) return; M.busy = true; paintInt();
    try { var r = await fn({ action: 'interest_text', ids: M.ids, dry_run: false }); shut(); toastS((r.queued || 0) + (r.queued === 1 ? ' text' : ' texts') + ' on the way (9 am to 7 pm)'); await reload(M.ids.length === 1 ? M.ids[0] : null); }
    catch (e) { M.busy = false; M.err = 'Not sent: ' + e.message; paintInt(); }
  }

  /* the offer letter */
  function defaults(c) {
    var d = new Date(); d.setDate(d.getDate() + 7);
    var fr = /\b(Français|French)\b/i.test(String(c.summary || ''));
    return { email: c.email || '', lang: fr ? 'fr' : 'en', reports_to: '', hours: 4, start: '', respond_by: iso(d), signer: myName(), signer_title: '', note: '' };
  }
  function askOffer(id) {
    var c = cand(id); if (!c || !staff()) return;
    M = { kind: 'offer', id: c.id, data: null, busy: false, err: '', f: defaults(c), preview: '' }; paintOffer();
    fn({ action: 'offer_preview', id: c.id, f: M.f }).then(function (r) { if (M.kind !== 'offer' || M.id !== c.id) return; M.data = r; if (!M.f.signer_title && r.signer_title) M.f.signer_title = r.signer_title; if (!M.f.signer) M.f.signer = r.signer; paintOffer(); }).catch(function (e) { M.err = e.message; paintOffer(); });
  }
  function readOffer() {
    ['email', 'lang', 'reports_to', 'hours', 'start', 'respond_by', 'signer', 'signer_title', 'note'].forEach(function (k) { var x = document.getElementById('w211o_' + k); if (x) M.f[k] = x.value; });
  }
  function paintOffer() {
    if (M.kind !== 'offer') return;
    var c = cand(M.id) || {}, f = M.f, d = M.data;
    var inp = function (k, label, type, extra) { return '<label for="w211o_' + k + '">' + label + '</label><input id="w211o_' + k + '" type="' + (type || 'text') + '" value="' + E(f[k]) + '"' + (extra || '') + '>'; };
    var test = d && d.mail_mode !== 'live';
    panel('<h3 id="w211h">Send the offer letter to ' + E(c.name || '') + '?</h3><p class="w197note">' + E((d && d.role) || c.role || '') + '. The letter is saved as a Google Doc in Recruitment > Offer Letters and emailed as a PDF with your note.</p>' +
      (test ? '<p class="w211warn">Email is in test mode: the email goes to the test inboxes (' + E(d.test_to) + '), not to them. Turning email on is an admin setting (CRM).</p>' : '') +
      '<div class="w211two">' + inp('email', 'Their email', 'email') + '<div><label for="w211o_lang">Language</label><select id="w211o_lang"><option value="en"' + (f.lang === 'en' ? ' selected' : '') + '>English</option><option value="fr"' + (f.lang === 'fr' ? ' selected' : '') + '>French</option></select></div></div>' +
      '<div class="w211two">' + inp('reports_to', 'Reports to (optional)') + inp('hours', 'Hours a week', 'number', ' min="1" max="40"') + '</div>' +
      '<div class="w211two">' + inp('start', 'Start date (optional)', 'date') + inp('respond_by', 'Reply by', 'date') + '</div>' +
      '<div class="w211two">' + inp('signer', 'Signed by') + inp('signer_title', 'Their title') + '</div>' +
      '<label for="w211o_note">The offer note (in the letter and the email)</label><textarea id="w211o_note" rows="4" placeholder="A personal line: why them, what comes next">' + E(f.note) + '</textarea>' +
      (M.err ? '<p class="w211err" role="alert">' + E(M.err) + '</p>' : '') +
      '<div class="acts">' + btn('Preview the letter', 'data-w211a="oprev"', 'sm') + '</div>' +
      (M.preview ? '<iframe class="w211prev" title="The offer letter" sandbox="" srcdoc="' + E(M.preview) + '"></iframe>' : '') +
      '<div class="acts">' + btn(M.busy ? 'Working…' : 'Create the letter and email it', 'data-w211a="osend" data-mail="1"' + (M.busy ? ' disabled' : ''), 'pri') + btn('Create the letter only', 'data-w211a="osend" data-mail="0"' + (M.busy ? ' disabled' : '')) + btn('Not now', 'data-w211a="shut"') + '</div>');
  }
  async function previewOffer() {
    readOffer(); M.err = '';
    try { var r = await fn({ action: 'offer_preview', id: M.id, f: M.f }); M.data = r; M.preview = r.html || ''; } catch (e) { M.err = e.message; }
    paintOffer();
  }
  async function sendOffer(mail) {
    if (M.busy) return; readOffer();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(M.f.email || '')) { M.err = 'Their email, please.'; paintOffer(); return; }
    if (!M.f.respond_by) { M.err = 'The reply-by date, please.'; paintOffer(); return; }
    M.busy = true; M.err = ''; paintOffer();
    try {
      var r = await fn({ action: 'offer_send', id: M.id, f: M.f, email: !!mail }); var id = M.id; shut();
      toastS(r.emailed ? (r.emailed.mode === 'live' ? 'Offer letter emailed' : 'Offer letter emailed to the test inboxes (test mode)') : 'Offer letter created in Offer Letters');
      await reload(id);
    } catch (e) { M.busy = false; M.err = e.message; paintOffer(); }
  }

  /* the CV */
  async function readCv(id) {
    toastS('Reading the CV…');
    try { var r = await fn({ action: 'cv_read', id: Number(id) }); toastS(r.ok ? 'CV read' + (r.filled && r.filled.length ? ' (filled in ' + r.filled.join(' and ') + ')' : '') : 'Could not read it: ' + r.error); } catch (e) { toastS('Could not read it: ' + e.message); }
    await reload(id);
  }
  async function useName(id) {
    var c = cand(id); if (!c || !c.cv_profile || !c.cv_profile.name) return;
    try { var r = await db.from('hub_candidates').update({ name: String(c.cv_profile.name).slice(0, 120), updated_at: new Date().toISOString(), updated_by: myName() }).eq('id', c.id); if (r && r.error) throw r.error; c.name = c.cv_profile.name; toastS('Name updated'); w197.paintBoard(); w197.openSheet(c.id); } catch (e) { toastS('Could not save: ' + (e.message || e)); }
  }

  /* the selection bar (w199): several at once */
  function bulkBits(ids) { return staff() ? btn('Text: still interested?', 'data-w211a="intbulk"' + (ids && ids.length ? '' : ' disabled'), 'sm') : ''; }
  function selected() { try { var s = w199.state().sel || {}; return Object.keys(s).filter(function (k) { return s[k]; }).map(Number); } catch (e) { return []; } }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-w211a],[data-w211int],[data-w211offer],[data-w211cv],[data-w211name]') : null; if (!t) return;
    var a = t.getAttribute('data-w211a');
    if (a === 'shut') { shut(); return; }
    if (a === 'intsend') { sendInt(); return; }
    if (a === 'intbulk') { var ids = selected(); if (ids.length) askInterest(ids); return; }
    if (a === 'oprev') { previewOffer(); return; }
    if (a === 'osend') { sendOffer(t.getAttribute('data-mail') === '1'); return; }
    if (t.hasAttribute('data-w211int')) { askInterest([Number(t.getAttribute('data-w211int'))]); return; }
    if (t.hasAttribute('data-w211offer')) { askOffer(t.getAttribute('data-w211offer')); return; }
    if (t.hasAttribute('data-w211cv')) { readCv(t.getAttribute('data-w211cv')); return; }
    if (t.hasAttribute('data-w211name')) { useName(t.getAttribute('data-w211name')); return; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var s = document.getElementById('w211m'); if (s && s.classList.contains('open')) shut(); } });

  var css = document.createElement('style'); css.id = 'w211css';
  css.textContent =
    '.w211pill{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 7px;border-radius:999px;background:rgba(16,63,57,.08);color:#4a5a56;margin:2px 4px 0 0;}.w211pill.ok{background:rgba(42,140,122,.16);color:#1d6b5d;}.w211pill.gold{background:rgba(220,165,39,.24);color:#7a5a0c;}' +
    '.w211box{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(220,165,39,.12);font-size:13.5px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}' +
    '.w211cv{margin:10px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(16,63,57,.14);font-size:13.5px;}.w211cv p{margin:6px 0;}.w211cv small{display:inline-block;min-width:78px;color:#5b6b67;font-weight:600;}.w211sk{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}.w211sk span{font-size:12px;background:rgba(16,63,57,.07);border-radius:6px;padding:2px 7px;}' +
    '.w211err{color:' + FLAG + ';}.w211warn{background:rgba(220,165,39,.2);border-radius:8px;padding:8px 10px;font-size:13.5px;color:#5c4408;}' +
    '#w211m{position:fixed;inset:0;z-index:9100;display:none;}#w211m.open{display:block;}#w211m .bk{position:absolute;inset:0;background:rgba(16,32,30,.4);}' +
    '#w211m .pn{position:absolute;right:0;top:0;bottom:0;width:min(600px,100%);background:#FFFAF2;overflow:auto;padding:18px 16px 28px;box-shadow:-8px 0 24px rgba(0,0,0,.12);}#w211m .x{float:right;}' +
    '#w211m label{display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:' + GREEN + ';margin:12px 0 4px;}' +
    '#w211m input,#w211m select,#w211m textarea{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px 10px;border:1px solid rgba(16,63,57,.25);border-radius:8px;background:#FFFAF2;}' +
    '#w211m .acts{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;}.w211two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}@media (max-width:520px){.w211two{grid-template-columns:1fr;}}' +
    '.w211txt{list-style:none;margin:8px 0;padding:0;}.w211txt li{border-top:1px solid rgba(16,63,57,.1);padding:8px 0;}.w211txt small{color:#5b6b67;}.w211txt p{margin:4px 0 0;font-size:13.5px;background:rgba(16,63,57,.04);border-radius:8px;padding:8px;overflow-wrap:anywhere;}' +
    '.w211prev{width:100%;height:420px;border:1px solid rgba(16,63,57,.18);border-radius:8px;margin-top:10px;background:#FFFAF2;}';
  (document.head || document.documentElement).appendChild(css);

  window.w211 = { cardBits: cardBits, sheetBits: sheetBits, bulkBits: bulkBits, askOffer: askOffer, askInterest: askInterest, state: function () { return M; } };
})();
