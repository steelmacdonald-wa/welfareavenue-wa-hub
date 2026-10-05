/* =====================================================================
   WA v208 Interviews on the application: the transcript, its review, the JD and the MCC framework (05/10/26)
   =====================================================================
   Steel (05/10/26): "when an interview comes in through the transcript archive it should be linked to the
   applicant's profile to view the interview. It should also fill in the strengths, weaknesses and insights
   from the interview. It should also compare the interviewee's answers to the job description and the MCC
   framework on hiring."
   - interview-review (edge) matches a transcript titled "... Interview" to its applicant (by name, and the
     position), then reads it against the position's JD (from the HR drive) and the MCC hiring framework
     (CMP X WA National Expansion Manual: the nine qualities, the profile for the role's level, the five
     recruitment philosophies). Rows: hub_candidate_interviews (RLS follows the transcript's own).
   - The applicant's sheet shows the interview (read it, the recording), the summary, strengths, weaknesses,
     insights, the JD requirement by requirement, the MCC qualities against the level's profile, the follow-ups
     and a suggested next step. Review again; change the level; unlink.
   - The board: cards say "Interview reviewed"; "Interviews to link (n)" lists the interviews no applicant
     could be matched to, with suggestions, to link by hand or mark "not an applicant".
   Hooks: w199.sheetBits, w199.cardBits, w199.barBits call w208 (parts199). */
(function () {
  'use strict';
  var I = { rows: [], tx: {}, at: 0, loading: null, body: {}, showTx: {}, busy: {}, poll: null, linkOpen: false };
  var QUAL = [['quick_learner', 'Quick learner'], ['self_starter', 'Self-starter'], ['experience', 'Experience'], ['intelligence', 'Intelligence'], ['integrity', 'Integrity'], ['energy', 'Energy'], ['problem_solver', 'Problem-solver'], ['vision', 'Vision'], ['referrals', 'Referrals']];
  var PHIL = [['active', 'Recruitment is active'], ['lean', 'Lean teams'], ['iie', 'Integrity, intelligence, energy'], ['referrals', 'Referrals over experience'], ['learn', 'Ability to learn']];
  var LEVELS = [['board', 'Board of Directors'], ['csuite', 'C-Suite'], ['staff', 'Directors and below (HQ)'], ['chapter_president', 'Chapter President'], ['chapter_vp', 'Chapter Vice-President'], ['ambassador', 'Brand Ambassador']];
  var VERDICT = { strong: ['Strong', 'ok'], partial: ['Partly', 'mid'], gap: ['Gap', 'lo'], not_covered: ['Not covered', 'mut'] };
  var JDREAD = { pdf: 'The JD is a PDF, which the review cannot read: it compared with the position\'s title only.', no_jd: 'This position has no JD in Drive yet: the review compared with its title only.', no_position: 'This application is not linked to a position: the review compared with the role they wrote.', other: 'The JD is not a Google Doc or Word file: the review compared with the title only.' };

  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function btn(label, attrs, kind) { return '<button type="button" class="w197b' + (kind ? ' ' + kind : '') + '" ' + (attrs || '') + '>' + label + '</button>'; }
  function day(s) { if (!s) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(String(s))) s = s + 'T12:00:00'; try { return new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } }
  function cands() { try { return (window.w197 && w197.state().cands) || []; } catch (e) { return []; } }
  function lbl(list, k) { var x = list.filter(function (p) { return p[0] === k; })[0]; return x ? x[1] : k; }
  function rowsOf(cid) { return I.rows.filter(function (r) { return r.status === 'linked' && String(r.candidate_id) === String(cid); }); }
  function unmatched() { return I.rows.filter(function (r) { return r.status === 'unmatched'; }); }
  function txOf(r) { return I.tx[r.transcript_id] || { title: 'Interview', meeting_date: null }; }
  function reopen(cid) { try { var st = window.w197 && w197.state(); if (st && cid && String(st.open) === String(cid)) w197.openSheet(cid); } catch (e) { /* fine */ } }
  function repaint() { try { if (window.w197) w197.paintBoard(); } catch (e) { /* fine */ } }

  async function q(p) { try { var r = await p; return (r && !r.error && r.data) || []; } catch (e) { return []; } }
  async function fn(body) {
    var r = await db.functions.invoke('interview-review', { body: body });
    if (r && r.error) {
      var msg = r.error.message || String(r.error);
      try { if (r.error.context && r.error.context.json) { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } } catch (e) { /* fine */ }
      throw new Error(msg);
    }
    if (r && r.data && r.data.error) throw new Error(r.data.error);
    return r ? r.data : null;
  }
  async function load(force) {
    if (I.loading) return I.loading;
    if (!force && I.at && Date.now() - I.at < 60000) return I;
    I.loading = (async function () {
      var rows = await q(db.from('hub_candidate_interviews').select('*').order('created_at', { ascending: false }).limit(1000));
      var ids = rows.map(function (r) { return r.transcript_id; });
      var ts = ids.length ? await q(db.from('transcripts').select('id,title,meeting_date,source_url,speakers').in('id', ids)) : [];
      I.rows = rows; I.tx = {}; ts.forEach(function (t) { I.tx[t.id] = t; });
      I.at = Date.now(); I.loading = null;
      return I;
    })();
    return I.loading;
  }
  /* while a review is being written, look again every 8 seconds (only while its sheet is open) */
  function watch(cid) {
    if (I.poll) return;
    I.poll = setInterval(async function () {
      var st = null; try { st = window.w197 && w197.state(); } catch (e) { st = null; }
      var open = st && st.open;
      var waiting = open && rowsOf(open).some(function (r) { return r.analysis_status === 'pending' || r.analysis_status === 'running'; });
      if (!waiting) { clearInterval(I.poll); I.poll = null; return; }
      await load(true); repaint(); reopen(open);
    }, 8000);
  }

  /* ---------- the card ---------- */
  function cardBits(c) {
    if (!c) return '';
    var rs = rowsOf(c.id); if (!rs.length) return '';
    var done = rs.filter(function (r) { return r.analysis_status === 'done'; })[0];
    if (done) { var a = done.analysis || {}, mc = a.mcc || {}; return '<span class="w208pill" title="The interview is reviewed: open the application to read it">Interview reviewed' + (a.jd_fit && a.jd_fit.score ? ' · JD ' + E(a.jd_fit.score) + '/5' : '') + (mc.profile_score ? ' · MCC ' + E(mc.profile_score) + '/5' : '') + '</span>'; }
    if (rs.some(function (r) { return r.analysis_status === 'failed'; })) return '<span class="w208pill lo">Interview linked (review failed)</span>';
    return '<span class="w208pill mut">Interview linked</span>';
  }

  /* ---------- the board bar: interviews no applicant was matched to ---------- */
  function barBits() {
    if (!I.at) { load().then(function () { if (unmatched().length) repaint(); }); return ''; }
    var n = unmatched().length; if (!n) return '';
    return btn('Interviews to link (' + n + ')', 'data-w208a="linklist"', 'sm w208tolink');
  }
  function candOptions(sel) {
    var cs = cands().slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    return '<option value="">Choose the applicant…</option>' + cs.map(function (c) { return '<option value="' + c.id + '"' + (String(sel) === String(c.id) ? ' selected' : '') + '>' + E(c.name || 'Someone') + ' · ' + E((window.w199 ? w199.roleOf(c) : c.role) || '') + '</option>'; }).join('');
  }
  function linkListHtml() {
    var us = unmatched();
    return '<div class="bk" data-w208a="linkshut"></div><div class="pn" role="dialog" aria-modal="true" aria-label="Interviews to link">' + btn('Close', 'data-w208a="linkshut"', 'sm x') +
      '<h3>Interviews to link</h3><p class="w197note">Interview transcripts in the archive that no applicant could be matched to by name. Link each one to its applicant and the Hub reviews it against the JD and the MCC framework.</p>' +
      (us.length ? '<ul class="w208ul">' + us.map(function (r) {
        var t = txOf(r), sg = (r.suggestions || []).filter(function (s) { return cands().some(function (c) { return String(c.id) === String(s.id); }); });
        return '<li><b>' + E(t.title) + '</b><small>' + E(day(t.meeting_date)) + (t.speakers && t.speakers.length ? ' · ' + E(t.speakers.join(', ')) : '') + ' · ' + E(r.match_note || '') + '</small>' +
          (sg.length ? '<div class="w208sg">Could be: ' + sg.map(function (s) { return btn(E(s.name), 'data-w208link="' + r.transcript_id + '" data-c="' + s.id + '"', 'sm'); }).join('') + '</div>' : '') +
          '<div class="w208row"><select data-w208pick="' + r.transcript_id + '" aria-label="The applicant for ' + E(t.title) + '">' + candOptions() + '</select>' + btn('Link', 'data-w208a="linkpick" data-t="' + r.transcript_id + '"', 'sm pri') + btn('Not an applicant', 'data-w208a="notapp" data-t="' + r.transcript_id + '"', 'sm') + '</div></li>';
      }).join('') + '</ul>' : '<p class="w197note">Every interview is linked.</p>') + '</div>';
  }
  function openLinkList() { var s = document.getElementById('w208links'); if (!s) { s = document.createElement('div'); s.id = 'w208links'; document.body.appendChild(s); } s.innerHTML = linkListHtml(); s.classList.add('open'); I.linkOpen = true; }
  function shutLinkList() { var s = document.getElementById('w208links'); if (s) s.classList.remove('open'); I.linkOpen = false; }

  /* ---------- the sheet ---------- */
  function score5(n) { n = Number(n || 0); return '<span class="w208dots" aria-label="' + (n ? n + ' of 5' : 'not covered') + '">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('') + '</span>'; }
  function points(list) { return '<ul class="w208pts">' + (list || []).map(function (p) { return typeof p === 'string' ? '<li>' + E(p) + '</li>' : '<li><b>' + E(p.point) + '</b>' + (p.evidence ? '<small>' + E(p.evidence) + '</small>' : '') + '</li>'; }).join('') + '</ul>'; }
  function reviewHtml(r) {
    var a = r.analysis || {}, jf = a.jd_fit || {}, mc = a.mcc || {}, needs = mc.needs || [];
    var lv = r.level || mc.level || 'staff';
    var qs = QUAL.map(function (qq) { var x = (mc.qualities || []).filter(function (y) { return y.quality === qq[0]; })[0] || {}; return { k: qq[0], l: qq[1], s: Number(x.score || 0), ev: x.evidence || '', need: needs.indexOf(qq[0]) >= 0 }; });
    qs.sort(function (x, y) { return (y.need ? 1 : 0) - (x.need ? 1 : 0); });
    return '<div class="w208rev">' +
      (a.summary ? '<p class="w208sum">' + E(a.summary) + '</p>' : '') +
      '<div class="w208two"><div><h5>Strengths</h5>' + points(a.strengths) + '</div><div><h5>Weaknesses</h5>' + points(a.weaknesses) + '</div></div>' +
      (a.insights && a.insights.length ? '<h5>Insights</h5>' + points(a.insights) : '') +
      '<h5>Against the job description' + (jf.score ? ' <span class="w208sc">' + score5(jf.score) + ' ' + E(jf.score) + '/5</span>' : '') + '</h5>' +
      (a.jd && JDREAD[a.jd.read] ? '<p class="w197note" style="margin:0 0 4px">' + E(JDREAD[a.jd.read]) + '</p>' : (a.jd && /^unreadable/.test(a.jd.read || '') ? '<p class="w197note" style="margin:0 0 4px">The JD could not be read from Drive: the review compared with the title only.</p>' : (a.jd && a.jd.name ? '<p class="w197note" style="margin:0 0 4px">Compared with ' + E(a.jd.name) + '.</p>' : ''))) +
      (jf.summary ? '<p>' + E(jf.summary) + '</p>' : '') +
      ((jf.requirements || []).length ? '<ul class="w208req">' + jf.requirements.map(function (x) { var v = VERDICT[x.verdict] || [x.verdict, 'mut']; return '<li><span class="w208v ' + v[1] + '">' + E(v[0]) + '</span><b>' + E(x.requirement) + '</b>' + (x.evidence ? '<small>' + E(x.evidence) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '<h5>Against the MCC hiring framework' + (mc.profile_score ? ' <span class="w208sc">' + score5(Math.round(mc.profile_score)) + ' ' + E(mc.profile_score) + '/5</span>' : '') + '</h5>' +
      '<div class="w208row"><label for="w208lv' + r.transcript_id + '" class="w208in">Level</label><select id="w208lv' + r.transcript_id + '" data-w208lv="' + r.transcript_id + '">' + LEVELS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === lv ? ' selected' : '') + '>' + E(l[1]) + '</option>'; }).join('') + '</select><small>The profile for this level needs the qualities marked ●' + (mc.covered != null && needs.length ? ' (' + E(mc.covered) + ' of ' + needs.length + ' came up in the interview)' : '') + '.</small></div>' +
      (mc.summary ? '<p>' + E(mc.summary) + '</p>' : '') +
      '<table class="w208q"><tbody>' + qs.map(function (x) { return '<tr class="' + (x.need ? 'need' : '') + '"><th>' + (x.need ? '<span title="Needed for this level">●</span> ' : '') + E(x.l) + '</th><td>' + (x.s ? score5(x.s) : '<span class="w208nc">Not covered</span>') + '</td><td><small>' + E(x.ev) + '</small></td></tr>'; }).join('') + '</tbody></table>' +
      ((mc.philosophies || []).length ? '<h5>The recruitment philosophies</h5><ul class="w208pts">' + mc.philosophies.map(function (p) { return '<li><b>' + E(lbl(PHIL, p.philosophy)) + '</b><small>' + E(p.note) + '</small></li>'; }).join('') + '</ul>' : '') +
      ((a.follow_ups || []).length ? '<h5>To follow up</h5>' + points(a.follow_ups) : '') +
      (a.next_step ? '<div class="next"><b>Suggested next step:</b> ' + E(a.next_step) + '</div>' : '') +
      '<p class="w197note">Read ' + E(day(r.analysed_at)) + (r.analysis_model ? ' by ' + E(String(r.analysis_model).replace(/^[a-z-]+\//, '')) : '') + '. A suggestion from the transcript: the decision stays with the hiring team.</p></div>';
  }
  function oneHtml(r, cid) {
    var t = txOf(r), tid = r.transcript_id, st = r.analysis_status, busy = I.busy[tid];
    var head = '<div class="w208head"><b>' + E(t.title) + '</b><small>' + E(day(t.meeting_date)) + (r.match_how === 'auto' ? ' · linked by the Hub (' + E(String(r.match_note || '').replace(/^Matched by /, '')) + ')' : (r.match_how === 'manual' ? ' · linked by hand' : '')) + '</small></div>' +
      '<div class="acts">' + btn(I.showTx[tid] ? 'Hide the interview' : 'Read the interview', 'data-w208a="tx" data-t="' + tid + '"', 'sm pri') +
      (t.source_url && /^https?:/.test(t.source_url) && !/app\.plaud\.ai\/?$/.test(t.source_url) ? '<a class="w197b sm" href="' + E(t.source_url) + '" target="_blank" rel="noopener">The recording</a>' : '') +
      btn(busy ? 'Reviewing…' : (st === 'done' ? 'Review again' : 'Review it'), 'data-w208a="again" data-t="' + tid + '"' + (busy || st === 'running' ? ' disabled' : ''), 'sm') +
      btn('Unlink', 'data-w208a="unlink" data-t="' + tid + '" data-c="' + cid + '"', 'sm') + '</div>';
    var tx = I.showTx[tid] ? '<div class="w208tx" tabindex="0" aria-label="The interview transcript">' + (I.body[tid] == null ? 'Loading the transcript…' : E(I.body[tid] || 'The transcript is empty.')) + '</div>' : '';
    var body;
    if (st === 'done' && r.analysis) body = reviewHtml(r);
    else if (st === 'failed') body = '<p class="w208err">The review did not work: ' + E(r.analysis_error || 'unknown') + '. Try Review it again.</p>';
    else if (st === 'pending' || st === 'running' || busy) { body = '<p class="w197note w208wait">Reading the interview against the job description and the MCC framework. This takes about a minute.</p>'; watch(cid); }
    else body = '<p class="w197note">Not reviewed yet.</p>';
    return '<div class="w208one">' + head + tx + body + '</div>';
  }
  /* at the top of the sheet: the interview is further down */
  function topBits(c) {
    if (!c || !I.at) return '';
    var rs = rowsOf(c.id); if (!rs.length) return '';
    var r = rs.filter(function (x) { return x.analysis_status === 'done'; })[0] || rs[0], a = r.analysis || {};
    var lab = r.analysis_status === 'done' ? 'The interview and its review' + (a.jd_fit && a.jd_fit.score ? ' (JD ' + a.jd_fit.score + '/5' + (a.mcc && a.mcc.profile_score ? ', MCC ' + a.mcc.profile_score + '/5' : '') + ')' : '') : 'The interview';
    return '<div class="w208jump">' + btn(E(lab) + ' \u2193', 'data-w208a="jump"', 'sm') + '</div>';
  }
  function sheetBits(c) {
    if (!c) return '';
    if (!I.at) { load().then(function () { reopen(c.id); }); return ''; }
    var rs = rowsOf(c.id);
    var us = unmatched();
    if (!rs.length) {
      if (['interview', 'offer', 'hired'].indexOf(c.status) < 0 && !us.length) return '';
      return '<label>Interview</label><p class="w197note" style="margin:0 0 6px">No interview transcript linked yet. An interview in the transcript archive titled "… Interview" links here by itself when the name matches.</p>' +
        (us.length ? '<div class="w208row"><select id="w208pick1" data-w208c="' + c.id + '" aria-label="Link an interview from the archive"><option value="">Link an interview from the archive…</option>' + us.map(function (r) { var t = txOf(r); return '<option value="' + r.transcript_id + '">' + E(t.title) + ' · ' + E(day(t.meeting_date)) + '</option>'; }).join('') + '</select>' + btn('Link', 'data-w208a="linkhere" data-c="' + c.id + '"', 'sm pri') + '</div>' : '');
    }
    return '<label>Interview' + (rs.length > 1 ? 's <small>' + rs.length + '</small>' : '') + '</label>' + rs.map(function (r) { return oneHtml(r, c.id); }).join('');
  }

  /* ---------- actions ---------- */
  async function act(body, msg, cid) {
    var tid = body.transcript_id; I.busy[tid] = true; reopen(cid);
    try {
      var r = await fn(body);
      if (body.action === 'analyse' && r && r.ok === false) throw new Error(r.error || 'the review did not work');
      if (msg) toastS(msg);
    } catch (e) { toastS('Could not do that: ' + (e.message || e)); }
    I.busy[tid] = false;
    await load(true); repaint(); if (I.linkOpen) openLinkList(); reopen(cid);
  }
  async function showTx(tid, cid) {
    I.showTx[tid] = !I.showTx[tid]; reopen(cid);
    if (I.showTx[tid] && I.body[tid] == null) {
      var r = await q(db.from('transcripts').select('id,body').eq('id', tid).limit(1));
      I.body[tid] = r[0] ? String(r[0].body || '') : ''; reopen(cid);
    }
  }
  function nameOf(cid) { var c = cands().filter(function (x) { return String(x.id) === String(cid); })[0]; return c ? c.name : 'the applicant'; }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-w208a],[data-w208link]') : null; if (!t) return;
    var a = t.getAttribute('data-w208a'), tid = Number(t.getAttribute('data-t') || t.getAttribute('data-w208link') || 0);
    var st = null; try { st = window.w197 && w197.state(); } catch (x) { st = null; }
    var cid = (st && st.open) || null;
    if (t.hasAttribute('data-w208link')) { var c1 = t.getAttribute('data-c'); act({ action: 'link', transcript_id: tid, candidate_id: Number(c1) }, 'Linked to ' + nameOf(c1) + '. The review takes about a minute.', cid); return; }
    if (a === 'jump') { var one = document.querySelector('#w197sheet .w208one'); if (one) { try { one.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { one.scrollIntoView(); } } return; }
    if (a === 'linklist') { openLinkList(); return; }
    if (a === 'linkshut') { shutLinkList(); return; }
    if (a === 'linkpick') { var sel = document.querySelector('[data-w208pick="' + tid + '"]'); if (!sel || !sel.value) { toastS('Choose the applicant first'); return; } act({ action: 'link', transcript_id: tid, candidate_id: Number(sel.value) }, 'Linked to ' + nameOf(sel.value) + '. The review takes about a minute.', cid); return; }
    if (a === 'notapp') { act({ action: 'unlink', transcript_id: tid, not_applicant: true }, 'Marked: not an applicant', cid); return; }
    if (a === 'linkhere') { var s2 = document.getElementById('w208pick1'); var c2 = t.getAttribute('data-c'); if (!s2 || !s2.value) { toastS('Choose the interview first'); return; } act({ action: 'link', transcript_id: Number(s2.value), candidate_id: Number(c2) }, 'Interview linked. The review takes about a minute.', c2); return; }
    if (a === 'tx') { showTx(tid, cid); return; }
    if (a === 'again') { act({ action: 'analyse', transcript_id: tid }, 'The interview is reviewed', cid); return; }
    if (a === 'unlink') { if (!window.confirm('Unlink this interview from ' + nameOf(t.getAttribute('data-c')) + '? Its review is cleared; the transcript stays in the archive.')) return; act({ action: 'unlink', transcript_id: tid }, 'Unlinked', cid); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var lv = t.getAttribute('data-w208lv');
    if (lv) { var st = null; try { st = window.w197 && w197.state(); } catch (x) { st = null; } act({ action: 'analyse', transcript_id: Number(lv), level: t.value }, 'Reviewed again for ' + lbl(LEVELS, t.value), st && st.open); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && I.linkOpen) shutLinkList(); });
  window.addEventListener('hashchange', function () { if (/^#hrcentre\/applications/.test(String(location.hash || ''))) load(); else shutLinkList(); });

  var css = document.createElement('style'); css.id = 'w208css';
  css.textContent =
    '.w208pill{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 7px;border-radius:999px;background:rgba(42,140,122,.14);color:#1d6b5d;margin:2px 4px 0 0;}.w208pill.mut{background:rgba(16,63,57,.07);color:#4a5a56;}.w208pill.lo{background:rgba(179,64,47,.12);color:#8f2f22;}' +
    '.w208jump{margin:4px 0 2px;}' +
    '.w208tolink{border-color:#DCA527 !important;}' +
    '.w208one{border:1px solid rgba(16,63,57,.14);border-radius:12px;padding:10px 12px;margin:4px 0 10px;background:rgba(16,63,57,.035);}' +
    '.w208head b{display:block;font-size:14.5px;}.w208head small{color:#5b6b67;font-size:12.5px;}' +
    '.w208tx{max-height:320px;overflow:auto;white-space:pre-wrap;font-size:13px;line-height:1.5;background:#FFFAF2;border-radius:8px;padding:10px;margin:6px 0;}' +
    '.w208rev h5{font-family:\'Barlow Condensed\',\'Arial Narrow\',sans-serif;font-size:15px;letter-spacing:.02em;text-transform:uppercase;color:#103F39;margin:12px 0 4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}' +
    '.w208sum{font-size:14px;margin:6px 0;}.w208two{display:grid;grid-template-columns:1fr 1fr;gap:12px;}@media (max-width:640px){.w208two{grid-template-columns:1fr;}}' +
    '.w208pts{margin:0;padding-left:18px;font-size:13.5px;}.w208pts li{margin:3px 0;}.w208pts small,.w208req small{display:block;color:#5b6b67;font-size:12.5px;}' +
    '.w208req{list-style:none;margin:0;padding:0;font-size:13.5px;}.w208req li{padding:5px 0;border-top:1px solid rgba(16,63,57,.08);}.w208req li:first-child{border-top:none;}' +
    '.w208v{display:inline-block;min-width:76px;font-size:11.5px;font-weight:700;border-radius:6px;padding:1px 6px;margin-right:6px;text-align:center;}.w208v.ok{background:rgba(42,140,122,.16);color:#1d6b5d;}.w208v.mid{background:rgba(220,165,39,.2);color:#7a5a0c;}.w208v.lo{background:rgba(179,64,47,.14);color:#8f2f22;}.w208v.mut{background:rgba(16,63,57,.07);color:#4a5a56;}' +
    '.w208dots{display:inline-flex;gap:3px;vertical-align:middle;}.w208dots i{width:9px;height:9px;border-radius:50%;background:rgba(16,63,57,.14);}.w208dots i.on{background:#DCA527;}' +
    '.w208sc{font-family:\'Space Grotesk\',sans-serif;text-transform:none;font-size:13px;color:#1F201E;letter-spacing:0;}' +
    '.w208q{width:100%;border-collapse:collapse;font-size:13px;}.w208q th{text-align:left;font-weight:500;white-space:nowrap;padding:4px 8px 4px 0;vertical-align:top;}.w208q td{padding:4px 6px 4px 0;vertical-align:top;}.w208q tr{border-top:1px solid rgba(16,63,57,.08);}.w208q tr.need th{font-weight:700;color:#103F39;}.w208q small{color:#5b6b67;}.w208nc{font-size:11.5px;color:#7a8783;}' +
    '@media (max-width:560px){.w208q td:last-child{display:none;}}' +
    '.w208row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0;}.w208row select{max-width:100%;}.w208row small{color:#5b6b67;}.w208in{margin:0 !important;font-weight:600;}' +
    '.w208err{color:#8f2f22;font-size:13.5px;}.w208wait{font-style:italic;}' +
    '#w208links{position:fixed;inset:0;z-index:1200;display:none;}#w208links.open{display:block;}#w208links .bk{position:absolute;inset:0;background:rgba(16,32,30,.4);}' +
    '#w208links .pn{position:absolute;right:0;top:0;bottom:0;width:min(560px,100%);background:#FFFAF2;overflow:auto;padding:18px 16px;box-shadow:-8px 0 24px rgba(0,0,0,.12);}#w208links .x{float:right;}' +
    '.w208ul{list-style:none;margin:0;padding:0;}.w208ul li{border-top:1px solid rgba(16,63,57,.1);padding:10px 0;}.w208ul li small{display:block;color:#5b6b67;font-size:12.5px;}.w208sg{margin:6px 0;font-size:13px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;}';
  (document.head || document.documentElement).appendChild(css);

  window.w208 = { state: function () { return I; }, load: load, cardBits: cardBits, barBits: barBits, sheetBits: sheetBits, topBits: topBits, openLinkList: openLinkList, levels: LEVELS, qualities: QUAL };
})();
