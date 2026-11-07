  /* =====================================================================
     WA v292 The email history on the Import page (07/11/26): the Scan card, Look at them, Write the summaries, Delete created and untouched
     =====================================================================
     Inside a_import.js's closure (assemble.py puts this file between a_import.js and b_css.js), so it uses E, num, plural, S, run, paint,
     load, loadRun, pri, nextStep, tableHtml, lockPage, focusEl and say, and declares no name a_import.js declares (every name here starts with
     m). The scan is read from crm_mail_scans (admins read it; counts, money and times only). Control actions go to mail-history (start, go,
     pause, resume, cap, summarise, people, exclude); Delete created goes to crm-import (delete_created). People from Look at them reach only this
     admin's browser, and people found in Steel's mailbox only Steel's (mail-history decides). window.w284m is for the drive tests. */
  var M = { scans: [], capMax: 60, look: false, filter: {}, offset: 0, people: null, peopleErr: '', busy: '', msg: '', capIn: '', pop: null };
  var M_PHASE = { count: 'Counting the emails', headers: 'Reading the headers', dedupe: 'Setting copies aside', bounces: 'Reading the bounces', sample: 'Reading a sample',
    waiting: 'Waiting for your go', threads: 'Reading the threads', people: 'Sorting the people', orgs: 'Looking up organisations', done: 'Read',
    summaries: 'Writing the summaries', summarised: 'Summaries written', failed: 'Stopped' };
  var M_BOX = { steel: 'Steel\'s mailbox', hub: 'hub@ (info@ arrives here)' };
  var M_REASON = { personal: 'personal', security: 'security codes', calendar: 'calendar', automated: 'automated', list: 'mailing lists', internal: 'internal',
    duplicate: 'copies', seen: 'seen before', imported: 'already in the Hub', draft: 'drafts', bounce: 'bounces', confidential: 'confidential', help_seeker: 'asking for help',
    staff_hiring: 'job applications' };
  var M_TYPES = ['donor', 'partner', 'volunteer', 'supporter', 'vendor', 'media', 'government', 'other'];
  var M_WORKING = ['count', 'headers', 'dedupe', 'bounces', 'sample', 'threads', 'people', 'orgs', 'summaries'];

  function mMoney(n) { return '$' + Number(n || 0).toFixed(2); }
  function mFn(action, body) {
    if (typeof db === 'undefined' || !db || !db.functions) return Promise.resolve({ error: 'The Hub is not connected.' });
    return Promise.resolve(db.functions.invoke('mail-history', { body: Object.assign({ action: action }, body || {}) })).then(function (r) {
      if (r && r.error) {
        var ctx = r.error.context;
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { return { error: (j && j.error) || r.error.message || 'mail-history did not answer.' }; }, function () { return { error: r.error.message || 'mail-history did not answer.' }; });
        return { error: String(r.error.message || r.error) };
      }
      var d = r && r.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fine */ } }
      if (d && d.error) return { error: String(d.error), data: d };
      return { data: d || {} };
    }, function (e) { return { error: String((e && e.message) || e) }; });
  }
  function mLoad(id) {
    return Promise.all([
      Promise.resolve(db.from('crm_mail_scans').select('*').eq('run_id', id)),
      Promise.resolve(db.from('app_config').select('key,value').in('key', ['mail_history_cap_usd']))
    ]).then(function (res) {
      if (id !== S.run) return;
      M.scans = ((res[0] && res[0].data) || []).slice().sort(function (a, z) { return a.mailbox === 'steel' ? -1 : z.mailbox === 'steel' ? 1 : 0; });
      ((res[1] && res[1].data) || []).forEach(function (x) { if (x.key === 'mail_history_cap_usd' && Number(x.value) > 0) M.capMax = Number(x.value); });
    });
  }
  function mPhaseAll(list) { return M.scans.length > 0 && M.scans.every(function (s) { return list.indexOf(s.phase) >= 0; }); }
  function mSpend() { var n = 0; M.scans.forEach(function (s) { n += Number(s.spend_usd || 0); }); return n; }
  function mEstimate() { var n = 0, any = false; M.scans.forEach(function (s) { if (s.estimate_usd != null) { any = true; n += Number(s.estimate_usd); } }); return any ? n : null; }
  function mCap() { var c = 0; M.scans.forEach(function (s) { c = Math.max(c, Number(s.cap_usd || 0)); }); return c; }
  function mGo() { return M.scans.some(function (s) { return !!s.go_at; }); }
  function mPaused() { return M.scans.some(function (s) { return !!s.paused; }); }

  /* the next step on an email-history run (one primary button): go, then the cards top down, then the summaries */
  function mNext() {
    if (!M.scans.length) return '';
    if (mPhaseAll(['waiting'])) return 'go';
    if (!mPhaseAll(['done', 'summaries', 'summarised'])) return '';
    for (var i = 0; i < MAIL.length; i++) {
      var K = MAIL[i], st = statusOf(K.k);
      if (S.busy[K.k]) return '';
      if (st === 'applied') continue;
      if (st === 'compared' && !S.stale[K.k]) return 'apply:' + K.k;
      return 'compare:' + K.k;
    }
    return mPhaseAll(['done']) ? 'summarise' : '';
  }

  /* ---------- the Scan card ---------- */
  function mBoxHtml(s) {
    var c = s.counts || {}, st = c.by_state || {}, rs = c.by_reason || {};
    var bits = [];
    if (c.listed != null) bits.push(plural(c.listed, 'email listed', 'emails listed'));
    if (st.kept) bits.push(num(st.kept) + ' kept');
    if (c.threads_read) bits.push(plural(c.threads_read, 'thread read', 'threads read'));
    var reasons = Object.keys(rs).filter(function (k) { return Number(rs[k]) > 0; }).sort(function (a, z) { return rs[z] - rs[a]; });
    return '<li class="w284mbox" data-w284b="mbox-' + E(s.mailbox) + '"><div class="w284fh"><b>' + E(M_BOX[s.mailbox] || s.mailbox) + '</b>'
      + '<span class="w284st st-' + (s.phase === 'failed' ? 'failed' : s.phase === 'done' || s.phase === 'summarised' ? 'applied' : 'compared') + '"><i aria-hidden="true"></i>' + E(M_PHASE[s.phase] || s.phase) + (s.paused ? ', paused' : '') + '</span></div>'
      + (bits.length ? '<p class="w284sum">' + E(bits.join('; ')) + '.</p>' : '')
      + (reasons.length ? '<p class="w284note">Set aside: ' + E(reasons.map(function (k) { return (M_REASON[k] || k) + ' ' + num(rs[k]); }).join(', ')) + '.</p>' : '')
      + (s.oldest_at ? '<p class="w284note">Oldest email: ' + E(String(s.oldest_at).slice(0, 10)) + '.</p>' : '')
      + (s.last_error ? '<p class="w284err" role="alert">Last stop: ' + E(s.last_error) + '</p>' : '') + '</li>';
  }
  function mScanHtml() {
    var r = run(); if (!r) return '';
    var purged = !!r.purged_at, est = mEstimate(), go = mGo(), paused = mPaused(), working = M.scans.some(function (s) { return M_WORKING.indexOf(s.phase) >= 0; });
    var money = (est != null ? 'Estimate ' + mMoney(est) + '. ' : '') + 'Spent ' + mMoney(mSpend()) + (go ? ' of a ' + mMoney(mCap()) + ' cap.' : ' (the sample only, before your go).');
    var btns = [];
    if (!purged && !M.busy) {
      if (mPhaseAll(['waiting']) && est != null) btns.push('<button class="' + pri('go') + '" data-w284mgo="1">Start reading</button>');
      if (working && !paused) btns.push('<button class="w284btn soft" data-w284mpause="1">Pause</button>');
      if (paused) btns.push('<button class="w284btn soft" data-w284mresume="1">Resume</button>');
      if (statusOf('mail_interactions') === 'applied' && mPhaseAll(['done', 'summarised'])) btns.push('<button class="' + pri('summarise') + '" data-w284msum="1">Write the summaries</button>');
      btns.push('<button class="w284btn soft" data-w284mlook="1" aria-expanded="' + M.look + '">' + (M.look ? 'Hide the people' : 'Look at them') + '</button>');
    }
    if (M.busy) btns.push('<button class="w284btn soft" aria-disabled="true" aria-busy="true">' + E(M.busy) + '</button>');
    var cap = (!purged && go) ? '<label class="w284row w284mcap"><span>Raise the cap to (US$, at most ' + mMoney(M.capMax) + ')</span><input class="w284in" type="number" min="0" step="1" max="' + M.capMax + '" data-w284mcapin="1" value="' + E(M.capIn) + '">'
      + '<button class="w284btn soft sm" data-w284mcap="1">Set the cap</button></label>' : '';
    return '<section class="w284card w284scan" data-w284b="scan" aria-labelledby="w284h-scan"><div class="w284ch"><h3 id="w284h-scan">Scan</h3></div>'
      + '<p class="w284rule">The scan reads Steel\'s mailbox and hub@ back to April 2020 without a model first (personal, automated and internal mail is set aside), then a sample, then waits for your go before it reads threads with the model. Nothing reaches the CRM until you apply the cards below.</p>'
      + (M.scans.length ? '<ul class="w284files">' + M.scans.map(mBoxHtml).join('') + '</ul>' : '<p class="w284note">No scan found for this run.</p>')
      + '<p class="w284sum">' + E(money) + '</p>' + cap
      + (M.msg ? '<p class="w284err" role="alert">' + E(M.msg) + '</p>' : '')
      + '<div class="w284acts">' + btns.join('') + '</div>'
      + (M.look ? mLookHtml() : '') + '</section>';
  }

  /* ---------- Look at them: 50 people at a time, to this admin's browser only ---------- */
  function mLookHtml() {
    var f = M.filter, d = M.people;
    var filt = '<div class="w284ctl w284mfilt"><label class="w284row"><span>Type</span><select class="w284sel" data-w284mf="type"><option value="">Any</option>'
      + M_TYPES.map(function (t) { return '<option' + (f.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>'
      + '<label class="w284row"><span>In the Hub</span><select class="w284sel" data-w284mf="match"><option value="">Either</option><option value="new"' + (f.match === 'new' ? ' selected' : '') + '>New</option>'
      + '<option value="existing"' + (f.match === 'existing' ? ' selected' : '') + '>Already there</option></select></label>'
      + [['asked_to_stop', 'Asked to stop'], ['bounced', 'Bounced'], ['phone_only', 'Phone only']].map(function (x) {
          return '<label class="w284chk"><input type="checkbox" data-w284mf="' + x[0] + '"' + (f[x[0]] ? ' checked' : '') + '> <span>' + x[1] + '</span></label>'; }).join('') + '</div>';
    if (M.peopleErr) return '<div class="w284mlook" data-w284b="look">' + filt + '<p class="w284err" role="alert">' + E(M.peopleErr) + '</p></div>';
    if (!d) return '<div class="w284mlook" data-w284b="look">' + filt + '<p class="w284note">Reading the people…</p></div>';
    var rows = (d.rows || []).map(function (p) {
      var conf = p.conf == null ? '' : Number(p.conf) < 0.5 ? ', not sure' : ', ' + Math.round(Number(p.conf) * 100) + '% sure';
      var acts = '<button class="w284btn soft sm" data-w284mex="' + E(p.key) + '" data-w284mon="' + (p.excluded ? '0' : '1') + '">' + (p.excluded ? 'Put back' : 'Leave out') + '</button>'
        + (p.optout ? '<button class="w284btn soft sm" data-w284mopt="' + E(p.key) + '" data-w284mon="' + (p.not_optout ? '0' : '1') + '">' + (p.not_optout ? 'It is an opt-out' : 'Not an opt-out') + '</button>' : '');
      return '<tr' + (p.excluded ? ' class="w284mout"' : '') + '><td>' + E(p.name || '') + '</td><td class="w284maddr">' + E(p.key) + '</td><td>' + E((p.type || 'no type') + conf) + '</td>'
        + '<td>' + num(p['in']) + ' in, ' + num(p.out) + ' out</td><td>' + E(String(p.first_at || '').slice(0, 10)) + ' to ' + E(String(p.last_at || '').slice(0, 10)) + '</td>'
        + '<td>' + E(p.organization || '') + '</td><td>' + E(p.match === 'email' || p.match === 'merged' ? 'In the Hub (' + p.match_id + ')' : p.match === 'phone_only' ? 'Phone only (' + p.match_id + ')' : p.match === 'internal' ? 'Staff' : 'New')
        + (p.optout ? ', ' + (p.optout === 'asked_to_stop' ? 'asked to stop' : 'bounced') + (p.not_optout ? ' (not an opt-out)' : '') : '') + '</td><td class="w284macts">' + acts + '</td></tr>';
    }).join('');
    var total = Number(d.total || 0), from = M.offset + 1, to = Math.min(M.offset + 50, total);
    return '<div class="w284mlook" data-w284b="look">' + filt
      + (total ? tableHtml('mail-people', 'People found' + cnt(total) + (total > 50 ? ', ' + num(from) + ' to ' + num(to) : ''), ['Name', 'Address', 'Type', 'Emails', 'First and last', 'Organisation', 'Match', 'Choose'], rows, 'w284mpeople')
        : '<p class="w284note">Nobody matches these filters.</p>')
      + (Number(d.hidden) ? '<p class="w284note">' + plural(d.hidden, 'person', 'people') + ' found in Steel\'s mailbox ' + (Number(d.hidden) === 1 ? 'is' : 'are') + ' shown only to Steel.</p>' : '')
      + '<div class="w284acts">' + (M.offset > 0 ? '<button class="w284btn soft sm" data-w284mpage="-1">Previous 50</button>' : '') + (to < total ? '<button class="w284btn soft sm" data-w284mpage="1">Next 50</button>' : '') + '</div></div>';
  }
  function mPeople() {
    M.people = null; M.peopleErr = ''; paint();
    var f = {}; Object.keys(M.filter).forEach(function (k) { if (M.filter[k]) f[k] = M.filter[k]; });
    return mFn('people', { run_id: S.run, filter: f, offset: M.offset }).then(function (r) {
      if (r.error) { M.peopleErr = 'The people could not load: ' + r.error; } else M.people = r.data;
      paint();
    });
  }
  /* a Leave out or Not an opt-out changes what the cards would do: a compared card asks for a new compare */
  function mStale() { MAIL.forEach(function (K) { if (statusOf(K.k) === 'compared') S.stale[K.k] = true; }); }

  /* ---------- the extra on the cards ---------- */
  function mExtra(kind, b) {
    if (kind !== 'mail_people' || !b || b.status !== 'undone' || (run() && run().purged_at)) return '';
    var r = b.report || {}, dc = r.deleted_created;
    if (dc) return '<p class="w284note">Deleted ' + plural(dc.deleted, 'contact', 'contacts') + ' this batch created and nobody changed; kept ' + num(dc.kept) + '.</p>';
    var q = ((r.lists || {}).quarantined || []).length;
    if (!q) return '';
    return '<div class="w284acts w284mdel"><button class="w284btn soft" data-w284mdel="' + b.id + '" data-w284mn="' + q + '">Delete created and untouched</button></div>';
  }
  function mMore(b) {
    var r = (b && b.report) || {}, m = (r.lists || {}).mail || {}, out = [];
    if (b.kind === 'mail_optouts' && m.suppressions_added != null) out.push('Suppression list: ' + num(m.suppressions_added) + ' added, ' + plural(m.contacts_changed, 'contact', 'contacts') + ' stopped.');
    if (b.kind === 'mail_people') {
      var t = m.by_type || {}, ks = Object.keys(t).filter(function (k) { return Number(t[k]) > 0; }).sort(function (a, z) { return t[z] - t[a]; });
      if (ks.length) out.push('By type: ' + ks.map(function (k) { return k + ' ' + num(t[k]); }).join(', ') + '.');
      if (m.born_opted_out) out.push(plural(m.born_opted_out, 'arrives', 'arrive') + ' opted out.');
      if (m.outbound_only) out.push(plural(m.outbound_only, 'person Welfare Avenue wrote to never answered and is', 'people Welfare Avenue wrote to never answered and are') + ' not added.');
    }
    if (b.kind === 'mail_interactions' && m.first_contacts != null) out.push('First contacts among this run\'s people: ' + num(m.first_contacts) + '.');
    if (r.undo && r.undo.quarantined) out.push(plural(r.undo.quarantined, 'new contact', 'new contacts') + ' tagged email history: review.');
    return out.length ? ' ' + out.join(' ') : '';
  }

  /* ---------- actions ---------- */
  function mStart(label) {
    M.busy = ''; S.err = '';
    mFn('start', { label: label || 'Email history' }).then(function (r) {
      if (r.error) { S.err = 'The scan did not start: ' + r.error + (r.data && r.data.problems ? ' (' + r.data.problems.join('; ') + ')' : ''); paint(); return; }
      S.label = ''; S.run = r.data.run_id; S.runs = null; S.batches = {}; S.files = []; S.stale = {}; S.msg = {}; S.open = {}; S.purgeAsk = false; S.purgeMsg = '';
      M.scans = []; M.look = false; M.people = null; S.want = '.w284runline';
      load();
    });
  }
  function mDo(action, body, busy, done) {
    M.busy = busy; M.msg = ''; paint();
    return mFn(action, Object.assign({ run_id: S.run }, body || {})).then(function (r) {
      M.busy = '';
      if (r.error) M.msg = r.error; else if (done) say(done(r.data || {}));
      return loadRun().then(paint);
    });
  }
  function mConfirm(title, text, yes, onYes, trigger) {
    mClose(true);
    var wrap = document.createElement('div'); wrap.id = 'w284mpop'; wrap.className = 'w284pop';
    wrap.innerHTML = '<div class="w284box" role="dialog" aria-modal="true" aria-labelledby="w284mpt" aria-describedby="w284mpd"><h3 id="w284mpt">' + E(title) + '</h3><p id="w284mpd">' + E(text) + '</p>'
      + '<div class="w284acts"><button class="w284btn ghost" data-w284mno="1">Cancel</button><button class="w284btn" data-w284myes="1">' + E(yes) + '</button></div></div>';
    document.body.appendChild(wrap);
    lockPage(true);
    M.pop = { onYes: onYes, last: trigger || document.activeElement };
    var c = wrap.querySelector('[data-w284mno]'); if (c) c.focus();   /* Cancel first: one stray Enter changes nothing */
    requestAnimationFrame(function () { wrap.classList.add('on'); });
  }
  function mClose(now) {
    var p = document.getElementById('w284mpop');
    if (p) {
      p.id = 'w284mpop-out'; p.setAttribute('aria-hidden', 'true'); p.classList.add('out');
      var gone = function () { if (p.parentNode) p.parentNode.removeChild(p); };
      if (now) gone(); else { p.addEventListener('transitionend', gone, { once: true }); setTimeout(gone, 260); }
    }
    lockPage(false);
    var pop = M.pop; M.pop = null;
    if (pop && pop.last && document.body.contains(pop.last)) focusEl(pop.last);
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var p = t.closest('#w284mpop');
    if (p) {
      if (t.closest('[data-w284myes]') && M.pop) { var f = M.pop.onYes; mClose(); f(); }
      else if (t.closest('[data-w284mno]') || t === p) mClose();
      return;
    }
    if (!t.closest('#w284root')) return;
    var el;
    if ((el = t.closest('[data-w284mgo]'))) {
      var est = mEstimate(), cap = Math.min(Math.round((est || 0) * 1.5 * 100) / 100, M.capMax);
      mConfirm('Start reading the threads?', 'The sample says the rest will cost about ' + mMoney(est) + '. The cap will be ' + mMoney(cap) + ' (one and a half times the estimate, at most ' + mMoney(M.capMax) + '): the scan pauses if it reaches it. A model reads each kept thread for one line per email; nothing reaches the CRM until you apply the cards.',
        'Start reading', function () { mDo('go', {}, 'Starting…', function (d) { return 'The threads are being read. Cap ' + mMoney(d.cap) + '.'; }); }, el);
    }
    else if (t.closest('[data-w284mpause]')) mDo('pause', {}, 'Pausing…', function () { return 'The scan is paused.'; });
    else if (t.closest('[data-w284mresume]')) mDo('resume', {}, 'Resuming…', function () { return 'The scan goes on.'; });
    else if (t.closest('[data-w284mcap]')) {
      var usd = Number(M.capIn);
      if (!(usd > 0)) { M.msg = 'Type the new cap in dollars first.'; paint(); return; }
      mDo('cap', { usd: Math.min(usd, M.capMax) }, 'Setting the cap…', function (d) { M.capIn = ''; return 'The cap is now ' + mMoney(d.cap) + '.'; });
    }
    else if (t.closest('[data-w284msum]')) mDo('summarise', {}, 'Starting the summaries…', function (d) { return plural(d.todo, 'summary', 'summaries') + ' to write.'; });
    else if (t.closest('[data-w284mlook]')) { M.look = !M.look; if (M.look) { M.offset = 0; mPeople(); } else paint(); }
    else if ((el = t.closest('[data-w284mpage]'))) { M.offset = Math.max(0, M.offset + 50 * Number(el.getAttribute('data-w284mpage'))); mPeople(); }
    else if ((el = t.closest('[data-w284mex]')) || (el = t.closest('[data-w284mopt]'))) {
      var what = el.hasAttribute('data-w284mex') ? 'person' : 'optout', key = el.getAttribute(what === 'person' ? 'data-w284mex' : 'data-w284mopt');
      mFn('exclude', { run_id: S.run, key: key, what: what, on: el.getAttribute('data-w284mon') === '1' }).then(function (r) {
        if (r.error) { M.peopleErr = r.error; paint(); return; }
        mStale(); mPeople();
      });
    }
    else if ((el = t.closest('[data-w284mdel]'))) {
      var bid = Number(el.getAttribute('data-w284mdel')), n = Number(el.getAttribute('data-w284mn'));
      mConfirm('Delete created and untouched?', 'This deletes up to ' + plural(n, 'contact', 'contacts') + ' that this batch created and nobody has changed since. Anyone who holds anything else (a gift, a form answer, an email, a list or a Send) is kept. This cannot be undone. Ask Steel before you say yes.',
        'Delete them', function () {
          M.busy = 'Deleting…'; paint();
          fn('delete_created', { batch_id: bid }).then(function (r) {
            M.busy = ''; if (r.error) S.msg.mail_people = r.error; else say('Deleted ' + plural(r.data.deleted, 'contact', 'contacts') + '; kept ' + num(r.data.kept) + '.');
            return loadRun().then(paint);
          });
        }, el);
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.closest || !t.closest('#w284root') || !t.hasAttribute('data-w284mf')) return;
    var k = t.getAttribute('data-w284mf');
    M.filter[k] = t.type === 'checkbox' ? t.checked : t.value;
    M.offset = 0; mPeople();
  });
  document.addEventListener('input', function (ev) { var t = ev.target; if (t && t.hasAttribute && t.hasAttribute('data-w284mcapin')) M.capIn = t.value; });
  document.addEventListener('keydown', function (ev) {
    if (!M.pop) return;
    var p = document.getElementById('w284mpop'); if (!p) return;
    if (ev.key === 'Escape') { ev.preventDefault(); mClose(); return; }
    if (ev.key === 'Tab') {
      var bs = p.querySelectorAll('button'); if (!bs.length) return;
      var first = bs[0], last = bs[bs.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });
  window.w284m = { state: function () { return M; }, next: mNext, more: mMore };
