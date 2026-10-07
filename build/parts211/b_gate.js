/* =====================================================================
   WA v211b Stage gates: what a card needs before it can move on (Steel, 06/10/26)
   =====================================================================
   "When candidates have been moved from New to Reviewing it should require the user to add someone as handling the
   candidate. From New or Reviewing to Interview it should ask for the call log (which can be pulled from QUO to get the
   transcript) status, handled filled, interview time and date." and "I'd also like to enforce mandatory fields when
   moving them from one stage to the other".
   Forward moves need everything the stages before them need (New straight to Offer asks for all of it):
     Reviewing  Handled by
     Interview  + the position, a call logged (picked from Quo with its summary and transcript, or logged by hand),
                  the interview's day and time
     Offer      + their email, the interview has happened, interview impressions
     Hired      + the offer letter (or "the offer was made another way"), the day they accepted, the start date
     Declined / Withdrawn  a reason, always
   Moving a card back a stage asks nothing. When nothing is missing the card just moves. The form only shows what is
   missing; the card moves when it is complete. Used by parts197 moveTo (drag, sheet buttons) and w199's selection bar.
   Columns (wa210b): hub_candidates.close_reason, accepted_on, start_date, impressions; hub_candidate_calls.quo_call_id,
   summary, transcript, duration. Edge: recruit-actions quo_calls, quo_log. */
(function () {
  'use strict';
  var RANK = { 'new': 0, reviewing: 1, interview: 2, offer: 3, hired: 4, declined: -1, withdrawn: -1 };
  var LABEL = { 'new': 'New', reviewing: 'Reviewing', interview: 'Interview', offer: 'Offer', hired: 'Hired', declined: 'Declined', withdrawn: 'Withdrawn' };
  var REASONS = {
    declined: ['Not the right fit for the role', 'Did not reply after we reached out', 'Not available when we need them', 'The position was filled', 'Did not meet the requirements', 'Other'],
    withdrawn: ['Took another role', 'No longer interested', 'Not available anymore', 'Did not reply after we reached out', 'Other']
  };
  var OUT = [['reached', 'Reached'], ['voicemail', 'Left a voicemail'], ['no_answer', 'No answer'], ['wrong_number', 'Wrong number']];
  var G = { c: null, st: '', ids: null, resolve: null, v: {}, err: '', quo: null, quoBusy: false, quoErr: '', busy: false, outside: false };

  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function btn(label, attrs, kind) { return '<button type="button" class="w197b' + (kind ? ' ' + kind : '') + '" ' + (attrs || '') + '>' + label + '</button>'; }
  function members() { return (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (m) { return m && m.active !== false && m.name && !/\btest\b/i.test(m.name); }); }
  function P() { try { return w199.state(); } catch (e) { return { pos: [], calls: [] }; } }
  function cands() { try { return (window.w197 && w197.state().cands) || []; } catch (e) { return []; } }
  function myName() { try { return (typeof USER !== 'undefined' && USER && (USER.name || USER.full_name)) || ''; } catch (e) { return ''; } }
  function myEmail() { try { return String((typeof USER !== 'undefined' && USER && USER.email) || '').toLowerCase(); } catch (e) { return ''; } }
  function callsOf(id) { return (P().calls || []).filter(function (k) { return String(k.candidate_id) === String(id); }); }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function local(t) { if (!t) return ''; var d = new Date(t); if (isNaN(d)) return ''; return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function when(t) { try { return new Date(t).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function closed(st) { return st === 'declined' || st === 'withdrawn'; }

  /* what is missing for a move; [] means it can move now */
  function missing(c, st, v) {
    v = v || {};
    if (!c || !st || c.status === st) return [];
    if (closed(st)) return v.reason ? [] : ['reason'];
    var from = RANK[c.status || 'new'], to = RANK[st];
    if (to == null || (from != null && from >= 0 && to <= from)) return [];   /* back a stage */
    var get = function (k) { return v[k] != null && v[k] !== '' ? v[k] : c[k]; };
    var out = [];
    if (to >= 1 && !get('owner')) out.push('owner');
    if (to >= 2) {
      if (!get('position_id')) out.push('position_id');
      if (!callsOf(c.id).length) out.push('call');
      if (!get('interview_at')) out.push('interview_at');
    }
    if (to >= 3) {
      if (!validEmail(get('email'))) out.push('email');
      var iv = get('interview_at'); if (iv && new Date(iv).getTime() > Date.now()) out.push('interview_done');
      if (String(get('impressions') || '').trim().length < 15) out.push('impressions');
    }
    if (to >= 4) {
      if (!c.offer_doc_url && !c.offer_sent_at && !v.offer_outside) out.push('offer');
      if (!get('accepted_on')) out.push('accepted_on');
      if (!get('start_date')) out.push('start_date');
    }
    return out;
  }
  var WHAT = {
    owner: 'who handles them', position_id: 'the position', call: 'a call logged', interview_at: 'the interview day and time',
    email: 'their email', interview_done: 'the interview to have happened', impressions: 'interview impressions',
    offer: 'the offer letter', accepted_on: 'the day they accepted', start_date: 'the start date', reason: 'a reason'
  };
  function says(list) { var w = list.map(function (k) { return WHAT[k] || k; }); return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : (w[0] || ''); }

  /* one card: resolves with the extra fields for the move, or null when cancelled */
  function gate(c, st) {
    if (!c) return Promise.resolve(null);
    if (!missing(c, st, {}).length && !closed(st)) return Promise.resolve({});
    return new Promise(function (res) {
      if (G.resolve) { try { G.resolve(null); } catch (e) { /* fine */ } }
      G = { c: c, st: st, ids: null, resolve: res, v: {}, err: '', quo: null, quoBusy: false, quoErr: '', busy: false, outside: false };
      paint();
    });
  }

  function field(k) {
    var c = G.c, v = G.v;
    if (k === 'owner') {
      var ppl = members().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
      return '<label for="w211g_owner">Handled by <i>required</i></label><select id="w211g_owner" data-w211gf="owner"><option value="">Choose who handles them</option>' + ppl.map(function (m) { return '<option' + (v.owner === m.name ? ' selected' : '') + '>' + E(m.name) + '</option>'; }).join('') + '</select>';
    }
    if (k === 'position_id') {
      var deps = (window.w199 && w199.depts) || [];
      var pos = P().pos || [];
      var opts = deps.map(function (d) { var ps = pos.filter(function (p) { return p.dept === d[0]; }); return ps.length ? '<optgroup label="' + E(d[1]) + '">' + ps.map(function (p) { return '<option value="' + p.id + '"' + (String(v.position_id) === String(p.id) ? ' selected' : '') + '>' + E(p.title) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('');
      return '<label for="w211g_pos">Position <i>required</i></label><select id="w211g_pos" data-w211gf="position_id"><option value="">Which position is this for?' + (c.role ? ' (they wrote: ' + E(String(c.role).slice(0, 40)) + ')' : '') + '</option>' + opts + '</select>';
    }
    if (k === 'call') {
      var q = G.quo, list = '';
      if (q && q.calls) {
        list = q.calls.length ? '<ul class="w211gq">' + q.calls.map(function (k2) {
          return '<li><div><b>' + E(when(k2.at)) + '</b> <small>' + E(k2.direction === 'incoming' ? 'they called' : 'we called') + ' · ' + (k2.answered ? Math.max(1, Math.round(k2.duration / 60)) + ' min' : 'not answered') + ' · ' + E(k2.line || '') + '</small>' +
            (k2.summary ? '<p>' + E(String(k2.summary).slice(0, 260)) + '</p>' : '') + '</div>' +
            (k2.logged ? '<span class="w211pill ok">Logged</span>' : btn('Use this call', 'data-w211gq="' + E(k2.id) + '"', 'sm pri')) + '</li>';
        }).join('') + '</ul>' : '<p class="w197note">No calls with ' + E(q.phone || 'their number') + ' in Quo in the last 60 days.</p>';
        if (q.note) list = '<p class="w197note">' + E(q.note) + '</p>';
      }
      return '<label>Call log <i>required</i></label><div class="w211gbox">' +
        '<p class="w197note" style="margin:0 0 6px">Pick the call from Quo (its summary and transcript are saved on the application), or log it by hand.</p>' +
        btn(G.quoBusy ? 'Looking in Quo…' : (q ? 'Look again' : 'Find their calls in Quo'), 'data-w211ga="quo"' + (G.quoBusy ? ' disabled' : ''), 'sm' + (q ? '' : ' pri')) +
        (G.quoErr ? '<p class="w211err" role="alert">' + E(G.quoErr) + '</p>' : '') + list +
        '<div class="w211gman"><span>Or log it:</span>' + OUT.map(function (o) { return btn(E(o[1]), 'data-w211go="' + o[0] + '"', 'sm'); }).join('') + '</div>' +
        '<input type="text" id="w211g_callnote" placeholder="What was said (optional)"></div>';
    }
    if (k === 'interview_at' || k === 'interview_done') {
      return '<label for="w211g_iv">Interview day and time <i>required</i></label><input type="datetime-local" id="w211g_iv" data-w211gf="interview_at" value="' + E(local(v.interview_at || c.interview_at)) + '">' +
        (k === 'interview_done' ? '<p class="w197note" style="margin:4px 0 0">The interview is booked for ' + E(when(c.interview_at)) + ', which has not happened yet. Change it if it happened at another time.</p>' : '');
    }
    if (k === 'email') return '<label for="w211g_email">Their email <i>required</i></label><input type="email" id="w211g_email" data-w211gf="email" value="' + E(v.email != null ? v.email : (c.email || '')) + '" placeholder="For the offer letter">';
    if (k === 'impressions') return '<label for="w211g_imp">Interview impressions <i>required</i></label><textarea id="w211g_imp" data-w211gf="impressions" rows="4" placeholder="How the interview went, why an offer (a few lines)">' + E(v.impressions != null ? v.impressions : (c.impressions || '')) + '</textarea>';
    if (k === 'offer') return '<label>Offer letter <i>required</i></label><div class="w211gbox">No offer letter in the Hub yet. ' + btn('Create the offer letter', 'data-w211ga="offer"', 'sm pri') + '<label class="w211gck"><input type="checkbox" data-w211gf="offer_outside"' + (G.v.offer_outside ? ' checked' : '') + '> The offer was made another way</label></div>';
    if (k === 'accepted_on') return '<label for="w211g_acc">The day they accepted <i>required</i></label><input type="date" id="w211g_acc" data-w211gf="accepted_on" max="' + today() + '" value="' + E(v.accepted_on || c.accepted_on || '') + '">';
    if (k === 'start_date') return '<label for="w211g_start">Start date <i>required</i></label><input type="date" id="w211g_start" data-w211gf="start_date" value="' + E(v.start_date || c.start_date || '') + '">';
    if (k === 'reason') {
      var rs = REASONS[G.st] || REASONS.declined;
      return '<label for="w211g_reason">Why <i>required</i></label><select id="w211g_reason" data-w211gf="reason"><option value="">Choose a reason</option>' + rs.map(function (r) { return '<option' + (G.v.reason === r ? ' selected' : '') + '>' + E(r) + '</option>'; }).join('') + '</select>' +
        '<label for="w211g_rnote">A note (' + (G.v.reason === 'Other' ? '<i>required</i>' : 'optional') + ')</label><input type="text" id="w211g_rnote" data-w211gf="reason_note" value="' + E(G.v.reason_note || '') + '">';
    }
    return '';
  }

  function paint() {
    var s = document.getElementById('w211g'); if (!s) { s = document.createElement('div'); s.id = 'w211g'; document.body.appendChild(s); }
    var c = G.c, st = G.st, h = '';
    if (G.ids) {   /* several cards (the selection bar) */
      var ready = G.ids.filter(function (x) { return !missing(x, st, closed(st) ? G.v : {}).length; });
      var held = G.ids.filter(function (x) { return missing(x, st, closed(st) ? G.v : {}).length; });
      h = '<h3 id="w211gh">Move ' + G.ids.length + (G.ids.length === 1 ? ' application' : ' applications') + ' to ' + E(LABEL[st]) + '</h3>' +
        (closed(st) ? field('reason') : '') +
        (!closed(st) && held.length ? '<p class="w197note">' + held.length + ' cannot move yet. Open each card to fill in what is missing:</p><ul class="w211gheld">' + held.map(function (x) { return '<li><button type="button" class="w197b sm link" data-w211gopen="' + x.id + '">' + E(x.name || 'Someone') + '</button> <small>needs ' + E(says(missing(x, st, {}))) + '</small></li>'; }).join('') + '</ul>' : '') +
        (G.err ? '<p class="w211err" role="alert">' + E(G.err) + '</p>' : '') +
        '<div class="acts">' + (closed(st) || ready.length ? btn(closed(st) ? 'Move ' + G.ids.length : 'Move the ' + ready.length + ' ready', 'data-w211ga="go"', 'pri') : '') + btn('Cancel', 'data-w211ga="cancel"') + '</div>';
    } else {
      var need = missing(c, st, G.v), all = need.slice();
      /* keep a field on screen once it is filled, so the person sees what they gave */
      ['owner', 'position_id', 'call', 'interview_at', 'email', 'impressions', 'offer', 'accepted_on', 'start_date', 'reason'].forEach(function (k) { if (G.shown && G.shown[k] && all.indexOf(k) < 0 && !(k === 'interview_at' && all.indexOf('interview_done') >= 0)) all.push(k); });
      G.shown = G.shown || {}; all.forEach(function (k) { G.shown[k === 'interview_done' ? 'interview_at' : k] = 1; });
      var order = ['owner', 'position_id', 'call', 'interview_at', 'interview_done', 'email', 'impressions', 'offer', 'accepted_on', 'start_date', 'reason'];
      all.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      h = '<h3 id="w211gh">' + E(c.name || 'Someone') + ' to ' + E(LABEL[st]) + '</h3>' +
        '<p class="w197note">' + (closed(st) ? 'Closing an application needs a reason.' : (need.length ? 'Before it moves: ' + E(says(need)) + '.' : 'All set.')) + '</p>' +
        all.map(field).join('') +
        (G.err ? '<p class="w211err" role="alert">' + E(G.err) + '</p>' : '') +
        '<div class="acts">' + btn(G.busy ? 'Saving…' : 'Move to ' + E(LABEL[st]), 'data-w211ga="go"' + (G.busy ? ' disabled' : ''), 'pri') + btn('Cancel', 'data-w211ga="cancel"') + '</div>';
    }
    s.innerHTML = '<div class="bk" data-w211ga="cancel"></div><div class="pn" role="dialog" aria-modal="true" aria-labelledby="w211gh">' + btn('Close', 'data-w211ga="cancel"', 'sm x') + h + '</div>';
    s.classList.add('open');
  }
  function readForm() {
    var s = document.getElementById('w211g'); if (!s) return;
    s.querySelectorAll('[data-w211gf]').forEach(function (x) { var k = x.getAttribute('data-w211gf'); G.v[k] = x.type === 'checkbox' ? x.checked : String(x.value || '').trim(); });
  }
  function close(val) { var s = document.getElementById('w211g'); if (s) s.classList.remove('open'); var r = G.resolve; G.resolve = null; if (r) r(val); }

  function patchOf() {
    var c = G.c, v = G.v, p = {}, st = G.st;
    if (closed(st)) { p.close_reason = v.reason + (v.reason_note ? ': ' + v.reason_note : ''); return p; }
    if (v.owner && v.owner !== c.owner) p.owner = v.owner;
    if (v.position_id && String(v.position_id) !== String(c.position_id)) { p.position_id = Number(v.position_id); var pp = (P().pos || []).filter(function (x) { return String(x.id) === String(v.position_id); })[0]; if (pp) p.role = pp.title; }
    if (v.interview_at) { var d = new Date(v.interview_at); if (!isNaN(d) && d.toISOString() !== c.interview_at) p.interview_at = d.toISOString(); }
    if (v.email && v.email !== c.email) p.email = v.email.toLowerCase();
    if (v.impressions && v.impressions !== c.impressions) p.impressions = v.impressions.slice(0, 4000);
    if (v.accepted_on) p.accepted_on = v.accepted_on;
    if (v.start_date) p.start_date = v.start_date;
    return p;
  }
  function go() {
    readForm(); G.err = '';
    if (G.ids) {
      if (closed(G.st) && !G.v.reason) { G.err = 'Choose a reason.'; paint(); return; }
      if (closed(G.st) && G.v.reason === 'Other' && !G.v.reason_note) { G.err = 'Say why in the note.'; paint(); return; }
      var ok = G.ids.filter(function (x) { return !missing(x, G.st, closed(G.st) ? G.v : {}).length; }).map(function (x) { return Number(x.id); });
      close({ ids: ok, patch: closed(G.st) ? { close_reason: G.v.reason + (G.v.reason_note ? ': ' + G.v.reason_note : '') } : {} });
      return;
    }
    if (G.st && closed(G.st) && G.v.reason === 'Other' && !G.v.reason_note) { G.err = 'Say why in the note.'; paint(); return; }
    var need = missing(G.c, G.st, G.v);
    if (G.v.email && !validEmail(G.v.email)) { G.err = 'That email does not look right.'; paint(); return; }
    if (G.v.start_date && G.v.accepted_on && G.v.start_date < G.v.accepted_on) { G.err = 'The start date is before the day they accepted.'; paint(); return; }
    if (need.length) { G.err = 'Still needed: ' + says(need) + '.'; paint(); var f = document.querySelector('#w211g [data-w211gf], #w211g [data-w211ga="quo"]'); if (f) { try { f.focus(); } catch (e) { /* fine */ } } return; }
    close(patchOf());
  }

  async function fn(body) {
    var r = await db.functions.invoke('recruit-actions', { body: body });
    if (r && r.error) { var msg = r.error.message || String(r.error); try { if (r.error.context && r.error.context.json) { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } } catch (e) { /* fine */ } throw new Error(msg); }
    if (r && r.data && r.data.error) throw new Error(r.data.error);
    return r ? r.data : null;
  }
  async function findQuo() {
    readForm(); G.quoBusy = true; G.quoErr = ''; paint();
    try { G.quo = await fn({ action: 'quo_calls', id: G.c.id }); } catch (e) { G.quoErr = 'Quo: ' + e.message; }
    G.quoBusy = false; paint();
  }
  function addCall(row) { var p = P(); p.calls = [row].concat(p.calls || []); try { w197.paintBoard(); } catch (e) { /* fine */ } }
  async function useQuo(callId) {
    readForm(); G.quoErr = ''; G.quoBusy = true; paint();
    try {
      var r = await fn({ action: 'quo_log', id: G.c.id, call_id: callId, stage: G.c.status || 'new' });
      if (r && r.call && !r.already) addCall(r.call);
      if (G.quo && G.quo.calls) G.quo.calls.forEach(function (k) { if (k.id === callId) k.logged = true; });
      toastS('Call logged' + (r && r.call && r.call.transcript ? ' with its transcript' : ''));
    } catch (e) { G.quoErr = 'Could not log it: ' + e.message; }
    G.quoBusy = false; paint();
  }
  async function logByHand(outcome) {
    readForm();
    var nt = document.getElementById('w211g_callnote');
    var row = { candidate_id: Number(G.c.id), outcome: outcome, note: nt && nt.value.trim() ? nt.value.trim().slice(0, 500) : null, by_email: myEmail(), by_name: myName(), stage: G.c.status || 'new', called_at: new Date().toISOString() };
    try {
      var r = await db.from('hub_candidate_calls').insert(row).select('*').single(); if (r && r.error) throw r.error;
      addCall((r && r.data && r.data.id) ? r.data : row);
      try { await db.from('change_log').insert({ entity_type: 'candidate', entity_id: String(G.c.id), field: 'call', old_value: null, new_value: outcome, changed_by: row.by_name }); } catch (x) { /* audit */ }
      toastS('Call logged');
    } catch (e) { G.quoErr = 'Could not log the call: ' + (e.message || e); }
    paint();
  }

  /* several at once (w199's selection bar) */
  function bulkGate(ids, st) {
    var list = cands().filter(function (c) { return ids.indexOf(Number(c.id)) >= 0 && c.status !== st; });
    if (!list.length) return Promise.resolve({ ids: [], patch: {} });
    if (!closed(st) && list.every(function (c) { return !missing(c, st, {}).length; })) return Promise.resolve({ ids: list.map(function (c) { return Number(c.id); }), patch: {} });
    return new Promise(function (res) {
      if (G.resolve) { try { G.resolve(null); } catch (e) { /* fine */ } }
      G = { c: null, st: st, ids: list, resolve: res, v: {}, err: '', quo: null, quoBusy: false, quoErr: '', busy: false };
      paint();
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#w211g [data-w211ga],#w211g [data-w211gq],#w211g [data-w211go],#w211g [data-w211gopen]') : null; if (!t) return;
    var a = t.getAttribute('data-w211ga');
    if (a === 'cancel') { close(null); return; }
    if (a === 'go') { go(); return; }
    if (a === 'quo') { findQuo(); return; }
    if (a === 'offer') { var id = G.c.id; close(null); try { w211.askOffer(id); } catch (x) { /* fine */ } return; }
    if (t.hasAttribute('data-w211gq')) { useQuo(t.getAttribute('data-w211gq')); return; }
    if (t.hasAttribute('data-w211go')) { logByHand(t.getAttribute('data-w211go')); return; }
    if (t.hasAttribute('data-w211gopen')) { var cid = t.getAttribute('data-w211gopen'); close(null); try { w197.openSheet(cid); } catch (x) { /* fine */ } return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w211g') || !t.hasAttribute('data-w211gf')) return;
    readForm(); if (t.getAttribute('data-w211gf') === 'reason' || t.getAttribute('data-w211gf') === 'offer_outside') paint();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var s = document.getElementById('w211g'); if (s && s.classList.contains('open')) close(null); } });

  var css = document.createElement('style'); css.id = 'w211gcss';
  css.textContent =
    '#w211g{position:fixed;inset:0;z-index:9200;display:none;}#w211g.open{display:block;}#w211g .bk{position:absolute;inset:0;background:rgba(16,32,30,.4);}' +
    '#w211g .pn{position:absolute;right:0;top:0;bottom:0;width:min(560px,100%);background:#FFFAF2;overflow:auto;padding:18px 16px 28px;box-shadow:-8px 0 24px rgba(0,0,0,.12);}#w211g .x{float:right;}' +
    '#w211g label{display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#103F39;margin:14px 0 4px;}#w211g label i{font-style:normal;text-transform:none;letter-spacing:0;color:#B3402F;font-weight:600;margin-left:4px;}' +
    '#w211g input,#w211g select,#w211g textarea{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px 10px;border:1px solid rgba(16,63,57,.25);border-radius:8px;background:#FFFAF2;}' +
    '#w211g input[type=checkbox]{width:auto;margin-right:6px;}#w211g .w211gck{text-transform:none;letter-spacing:0;font-weight:500;font-size:14px;display:flex;align-items:center;margin-top:8px;}' +
    '#w211g .acts{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;}.w211gbox{padding:10px 12px;border-radius:10px;border:1px solid rgba(16,63,57,.14);}' +
    '.w211gq{list-style:none;margin:8px 0;padding:0;}.w211gq li{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;border-top:1px solid rgba(16,63,57,.1);padding:8px 0;}.w211gq small{color:#5b6b67;}.w211gq p{margin:4px 0 0;font-size:13px;}' +
    '.w211gman{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0 6px;font-size:13.5px;}.w211gheld{margin:6px 0;padding-left:18px;}.w211gheld small{color:#5b6b67;}';
  (document.head || document.documentElement).appendChild(css);

  window.w211g = { missing: missing, gate: gate, bulkGate: bulkGate, says: says, state: function () { return G; } };
})();
