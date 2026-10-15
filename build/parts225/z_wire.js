
  /* ---------- paint and route ---------- */
  var KEEP = ['data-w250q', 'data-w250rtext', 'data-w225iq', 'data-w225lq', 'data-w225kq', 'data-w225lf', 'data-w225bf', 'data-w225bsoc', 'data-w225rtext', 'data-w225rnote', 'data-w225blabel', 'data-w225burl', 'data-w225apnote', 'data-w230b', 'data-w230p', 'data-w230s', 'data-w230so', 'data-w230tc', 'data-w230ab', 'data-w230st'];
  function paint() {
    if (S.sec === 'calendar') return;
    var h = host(); if (!h) return;
    var a = document.activeElement, keep = null;
    if (a && h.contains(a)) { for (var i = 0; i < KEEP.length; i++) { if (a.hasAttribute(KEEP[i])) { keep = { attr: KEEP[i], val: a.getAttribute(KEEP[i]), s: a.selectionStart, e: a.selectionEnd }; break; } } }
    /* typed-but-unsent text survives a repaint */
    var held = {}; h.querySelectorAll('[data-w225apnote],[data-w225blabel],[data-w225burl]').forEach(function (el) { var k = ['data-w225apnote', 'data-w225blabel', 'data-w225burl'].filter(function (x) { return el.hasAttribute(x); })[0]; held[k + '=' + el.getAttribute(k)] = el.value; });
    h.querySelectorAll('input[id^="w225"],textarea[id^="w225"],select[id^="w225"],input[id^="w230"],select[id^="w230"]').forEach(function (el) { if (el.value) held['id=' + el.id] = el.value; });
    var html;
    if (!staffOk()) html = '<div class="card"><div class="empty">The Content Studio is for the staff.</div></div>';
    else if (S.err && !S.loaded) html = '<div class="card"><div class="empty">The Content Studio could not load (' + E(clip(S.err, 140)) + '). <a data-w225reload="1" style="cursor:pointer;font-weight:700">Try again</a></div></div>';
    else if (!S.loaded && !W()) html = '<div class="card"><div class="empty">Loading the Content Studio…</div></div>';
    else {
      try {
        html = S.sec === 'queue' ? queueHtml() : S.sec === 'approvals' ? approvalsHtml() : S.sec === 'inbox' ? inboxHtml() : S.sec === 'messages' ? messagesHtml() : S.sec === 'ads' ? adsHtml() : S.sec === 'library' ? libraryHtml() : S.sec === 'pages' ? pagesHtml() : S.sec === 'links' ? linksHtml() : S.sec === 'report' ? reportHtml() : S.sec === 'connections' ? connectHtml() : overviewHtml();
      } catch (e) { console.warn('wave225 paint', e); html = '<div class="card"><div class="empty">Something went wrong drawing this page: ' + E(e.message || e) + '</div></div>'; }
    }
    if (!(S.sec === 'pages' && S.sub === 'edit' && lpPatch(h, html))) h.innerHTML = html;
    Object.keys(held).forEach(function (k) { var p = k.split('='), el = h.querySelector('[' + p[0] + '="' + p.slice(1).join('=') + '"]'); if (el && held[k] !== el.value) el.value = held[k]; });
    if (keep) { try { var el = h.querySelector('[' + keep.attr + (keep.val ? '="' + keep.val + '"' : '') + ']'); if (el) { el.focus(); if (keep.s != null && el.setSelectionRange) el.setSelectionRange(keep.s, keep.e); } } catch (e) { /* fine */ } }
  }
  function route(hh) {
    var raw = String(hh || '').replace(/^#/, ''), qi = raw.indexOf('?'), path = qi >= 0 ? raw.slice(0, qi) : raw;
    var p = path.split('/'), sec = p[1] || 'overview', sub = p[2] || '';
    S.sec = SECTIONS.indexOf(sec) >= 0 ? sec : 'overview';
    S.sub = sub; S.sub2 = p[3] || '';
    if (S.sec === 'library') { if (LIBT.some(function (x) { return x[0] === sub; })) S.f.lib = sub; else S.sub = S.f.lib || 'templates'; if (S.libEdit && S.libEdit.tab !== S.sub) S.libEdit = null; }
    if (S.sec === 'connections' && qi >= 0) connFlash();
    if (S.sec === 'approvals' && qi >= 0) { try { var qa = new URLSearchParams(raw.slice(qi + 1)); S.apDo = qa.get('post') ? { post: qa.get('post'), do: qa.get('do') === 'back' ? 'back' : 'approve' } : null; } catch (e) { S.apDo = null; } }   /* wave241 */
    if (S.sec === 'library' && S.sub === 'partners' && qi >= 0) { try { var qp = new URLSearchParams(raw.slice(qi + 1)); if (qp.get('partner')) S.f.partner = qp.get('partner'); } catch (e) { /* fine */ } }
  }
  async function show(hh) {
    route(hh || location.hash);
    var h = host(); if (!h) return;
    if (!S.loaded) paint();
    await loadAll();
    if (S.sec === 'connections' && !S.conn) await loadConn();
    if (S.sec === 'pages') { try { await lpLoad(); } catch (e) { /* drawn below */ } }
    if (S.sec === 'messages') { try { await load250(); } catch (e) { /* drawn below */ } }   /* wave251 */
    if (S.sec === 'ads') { try { await loadAds250(); } catch (e) { /* drawn below */ } }   /* wave253 */
    paint();
    try { if (window.w153 && window.w153.paint) window.w153.paint(); } catch (e) { /* fine */ }
    if (S.sec === 'approvals' && S.apDo) { try { await applyApDo(); } catch (e) { /* fine */ } }   /* wave241 */
    if (S.sec === 'library' && S.sub === 'partners') { try { var hadP = !!S.partners; await loadPartnerPosts(); if (!hadP) paint(); } catch (e) { /* fine */ } }
  }
  function reload() { S.loaded = 0; S.conn = null; M250.loaded = 0; M250.ads = null; M250.meta = null; M250.wa = null; return show(location.hash); }

  /* ---------- small actions ---------- */
  function compose(pre) { var w = W(); if (w && w.compose) { w.compose(pre || null); return; } if (window.w121Compose) window.w121Compose(pre || null); else go('#contentcal/new'); }
  function openPost(id) { var w = W(); if (w && w.open && w.open(id)) return; go('#contentcal/' + id); }
  function localIso(d, at) { return new Date(d + 'T' + (at || '18:00') + ':00').toISOString(); }
  async function fillSlot(d, at, id) {
    try {
      var r = await db.from('content_posts').update({ scheduled_at: localIso(d, at), updated_by: myName() || myEmail(), updated_at: new Date().toISOString() }).eq('id', Number(id)); if (r.error) throw r.error;
      var w = W(); if (w) await w.load(true); toastS('Planned for ' + niceDate(d) + ', ' + at + '. Open it to schedule it.');
    } catch (x) { toastS('Could not plan it: ' + (x.message || x)); }
    paint();
  }
  async function removeSlot(id) {
    try { var r = await db.from('content_slots').delete().eq('id', Number(id)); if (r.error) throw r.error; var w = W(); if (w) await w.studio(); } catch (x) { toastS('Could not remove it: ' + (x.message || x)); }
    paint();
  }
  async function saveGoals() {
    var g = {}; document.querySelectorAll('#w225host [data-w225goal]').forEach(function (el) { var v = Math.max(0, Math.min(21, Math.round(Number(el.value) || 0))); g[el.getAttribute('data-w225goal')] = v; });
    try { var value = Object.assign({}, S.settings || {}, { goals: g }); var r = await db.rpc('studio_settings_save', { p_key: 'content_studio', p_value: value }); if (r.error) throw r.error; S.settings = value; toastS('Goals saved'); }
    catch (x) { toastS('Could not save the goals: ' + (x.message || x)); }
    paint();
  }
  async function syncInbox() {
    if (S.busy.sync) return; S.busy.sync = true; paint();
    try {
      var r = await fn('social-inbox', { action: 'sync', days: 45 });
      var rs = await Promise.all([q(db.from('social_comments').select('*').gte('commented_at', new Date(Date.now() - 90 * 86400000).toISOString()).order('commented_at', { ascending: false }).limit(1500)), q(db.from('hub_settings').select('value').eq('key', 'studio_inbox_sync').maybeSingle())]);
      if (rs[0].data) S.comments = rs[0].data; if (rs[1].data) S.inboxLast = rs[1].data.value;
      var added = 0; Object.keys((r && r.platforms) || {}).forEach(function (k) { added += Number(r.platforms[k].added || 0); }); toastS(added ? added + ' new comment' + (added === 1 ? '' : 's') : 'Checked: nothing new');
    } catch (x) { toastS('Could not check: ' + (x.message || x)); }
    S.busy.sync = false; paint(); try { if (window.w153) window.w153.paint(); } catch (e) { /* fine */ }
  }

  /* ---------- events ---------- */
  function inApp(t) { return !!(t && t.closest && t.closest('#w225host')); }
  var tT = null; function soon() { clearTimeout(tT); tT = setTimeout(paint, 200); }
  function arg(el, a) { return el.getAttribute(a) || ''; }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!inApp(t)) return;
    var el = t.closest('a,button,[data-w225open],[data-w225go],[data-w225lcol]'); if (!el) return;
    if (el.hasAttribute('disabled')) { e.preventDefault(); return; }
    var x;
    if (el.hasAttribute('href') && /^https?:/.test(el.getAttribute('href'))) return;
    if ((x = arg(el, 'data-w225open'))) { e.preventDefault(); openPost(x); return; }
    if ((x = arg(el, 'data-w225go'))) { e.preventDefault(); go(x); return; }
    if (el.hasAttribute('data-w225new')) { e.preventDefault(); compose(null); return; }
    if (el.hasAttribute('data-w225reload')) { reload(); return; }
    if ((x = arg(el, 'data-w225slotnew'))) { var sp = x.split('|'); compose({ date: sp[0], time: sp[1], platforms: (sp[2] || '').split(',').filter(Boolean) }); return; }
    if ((x = arg(el, 'data-w225slotx'))) { removeSlot(x); return; }
    if ((x = arg(el, 'data-w225sugadd'))) { var sa = x.split('|'); addSlots([sa[0]], [Number(sa[1])], sa[2]).then(paint, function (er) { toastS('Could not add it: ' + (er.message || er)); }); return; }
    if (el.hasAttribute('data-w225swd')) { var wd = Number(arg(el, 'data-w225swd')), arr = S.keys.swd = S.keys.swd || []; var ix = arr.indexOf(wd); if (ix >= 0) arr.splice(ix, 1); else arr.push(wd); el.classList.toggle('on', ix < 0); return; }
    if (el.hasAttribute('data-w225slotadd')) {
      var pl = (document.getElementById('w225spl') || {}).value || 'all', at = (document.getElementById('w225sat') || {}).value || '';
      if (!(S.keys.swd || []).length) { toastS('Pick the days first'); return; } if (!/^\d{2}:\d{2}$/.test(at)) { toastS('Pick a time'); return; }
      S.keys.sat = at; addSlots(pl === 'all' ? PORDER.slice() : [pl], S.keys.swd.slice().sort(), at).then(paint, function (er) { toastS('Could not add it: ' + (er.message || er)); }); return;
    }
    if (el.hasAttribute('data-w225sug')) { S.suggest = S.suggest ? null : suggestTimes(); paint(); return; }
    if (el.hasAttribute('data-w225goalsave')) { saveGoals(); return; }
    if ((x = arg(el, 'data-w225apr'))) { S.f.apr = x; paint(); return; }
    if (el.hasAttribute('data-w241apsave')) { saveApprovers(); return; }
    if ((x = arg(el, 'data-w225dec'))) { var dp = x.split('|'); el.setAttribute('disabled', '1'); decideFrom(dp[0], dp[1]); return; }
    /* comments */
    if ((x = arg(el, 'data-w225rp'))) { S.reply[x] = S.reply[x] || { text: '' }; paint(); var ta = document.querySelector('#w225host [data-w225rtext="' + x + '"]'); if (ta) ta.focus(); return; }
    if ((x = arg(el, 'data-w225act'))) { var ap = x.split('|'); inboxAct(ap[0], ap[1]); return; }
    if ((x = arg(el, 'data-w225ai'))) { suggestReply(x); return; }
    if ((x = arg(el, 'data-w225rpx'))) { delete S.reply[x]; paint(); return; }
    if ((x = arg(el, 'data-w225send'))) { var rr = S.reply[x]; if (!rr || !String(rr.text || '').trim()) { toastS('Write the reply first'); return; } rr.sending = true; paint(); inboxAct('reply', x, { text: String(rr.text).trim() }); return; }
    if (el.hasAttribute('data-w225ib')) { S.f.inbox = arg(el, 'data-w225ib') || 'open'; lsSet('w225ib', S.f.inbox); paint(); return; }
    if (el.hasAttribute('data-w225ipl')) { S.f.ipl = arg(el, 'data-w225ipl'); paint(); return; }
    if (el.hasAttribute('data-w225sync')) { syncInbox(); return; }
    /* library */
    if ((x = arg(el, 'data-w225lnew'))) { libNew(x); paint(); var f0 = document.querySelector('#w225host [data-w225lf="name"]'); if (f0) f0.focus(); return; }
    if ((x = arg(el, 'data-w225ledit'))) { var le = x.split('|'); libEdit(le[0], le[1]); paint(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if ((x = arg(el, 'data-w225ldel'))) { var ld = x.split('|'); libRemove(ld[0], ld[1]); return; }
    if ((x = arg(el, 'data-w225luse'))) { libUse(x); return; }
    if ((x = arg(el, 'data-w225lcopy'))) { libCopy(x); return; }
    if ((x = arg(el, 'data-w225lcal'))) { var w = W(); if (w && w.filter) w.filter('tag', x); go('#contentcal'); return; }
    if ((x = arg(el, 'data-w225lcol'))) { if (S.libEdit) { S.libEdit.color = x; paint(); } return; }
    if (el.hasAttribute('data-w225lsave')) { libSave(); return; }
    if (el.hasAttribute('data-w225lcancel')) { S.libEdit = null; paint(); return; }
    /* links */
    if (el.hasAttribute('data-w225kmake')) { makeLinkFromForm(); return; }
    if ((x = arg(el, 'data-w225kcopy'))) { copyText(shortUrl(x)); return; }
    if ((x = arg(el, 'data-w225kact'))) { var ka = x.split('|'); linkActive(ka[1], ka[0] === 'on'); return; }
    /* connections */
    if ((x = arg(el, 'data-w225cx'))) { e.preventDefault(); connAct(x); return; }
    if ((x = arg(el, 'data-w225ccopy'))) { copyText(x); return; }
    /* report */
    if (el.hasAttribute('data-w225rcopy')) { copyText(reportSummary()); return; }
    if (el.hasAttribute('data-w225print')) { printReport(); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!inApp(t) || !t.matches) return;
    if (t.matches('[data-w241partner]')) { S.f.partner = t.value; S.partnerPosts = null; S.partnerFor = null; paint(); loadPartnerPosts().then(function () { paint(); }); }   /* wave241 */
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!inApp(t) || !t.matches) return;
    if (t.matches('[data-w225iq]')) { S.f.iq = t.value; soon(); return; }
    if (t.matches('[data-w225lq]')) { S.f.lq = t.value; soon(); return; }
    if (t.matches('[data-w225kq]')) { S.f.kq = t.value; soon(); return; }
    if (t.matches('[data-w225rtext]')) { var id = t.getAttribute('data-w225rtext'); (S.reply[id] = S.reply[id] || {}).text = t.value; return; }
    if (t.matches('[data-w225rnote]')) { S.keys['note-' + t.getAttribute('data-w225rnote')] = t.value; return; }
    if (t.matches('[data-w225lf]')) { if (S.libEdit) { S.libEdit[t.getAttribute('data-w225lf')] = t.value; if (S.libEdit.tab === 'hashtags' && t.getAttribute('data-w225lf') === 'body') soon(); } return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!inApp(t) || !t.matches) return;
    if (t.matches('[data-w225fill]')) { if (!t.value) return; var f = t.getAttribute('data-w225fill').split('|'); fillSlot(f[0], f[1], t.value); return; }
    if (t.matches('[data-w225assign]')) { inboxAct('assign', t.getAttribute('data-w225assign'), { to: t.value }); return; }
    if (t.matches('[data-w225saved]')) {
      var cid = t.getAttribute('data-w225saved'), sn = lib().filter(function (x) { return String(x.id) === t.value; })[0]; if (!sn) return;
      var c = S.comments.filter(function (x) { return String(x.id) === cid; })[0], nm = c ? (c.author_handle ? '@' + c.author_handle : (c.author_name || '').split(' ')[0]) : '';
      var r = S.reply[cid] = S.reply[cid] || {}; r.text = String(sn.body || '').replace(/\{name\}/g, nm || 'there');
      q(db.from('content_snippets').update({ uses: Number(sn.uses || 0) + 1 }).eq('id', sn.id)); paint(); return;
    }
    if (t.matches('[data-w225imine]')) { S.f.imine = !!t.checked; paint(); return; }
    if (t.matches('[data-w225kall]')) { S.f.kall = !!t.checked; paint(); return; }
    if (t.matches('[data-w225lpl]')) { if (!S.libEdit) return; var k = t.getAttribute('data-w225lpl'), pls = S.libEdit.platforms = S.libEdit.platforms || []; var i = pls.indexOf(k); if (t.checked && i < 0) pls.push(k); else if (!t.checked && i >= 0) pls.splice(i, 1); return; }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!inApp(t) || e.key !== 'Enter') return;
    if (t.matches && t.matches('#w225kurl,#w225klabel,#w225kcode,#w225kcamp')) { e.preventDefault(); makeLinkFromForm(); }
  });
  window.addEventListener('beforeunload', function (e) { if (S.lp && S.lp.edit && S.lp.edit.dirty && S.sec === 'pages') { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- the page in the Hub ---------- */
  function tabOk(id) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { return false; } }
  /* whoever opens the app reaches the calendar and the analytics through it: body.w225has takes those out of their Hub menu (wave153's rule) */
  function markHas() { try { document.body.classList.toggle('w225has', staffOk() && tabOk('studio')); } catch (e) { /* fine */ } }
  var hasT = null;
  function watchHas() {
    var bar = document.getElementById('tabBar'); if (!bar || bar.__w225obs) return;
    bar.__w225obs = true;
    try { new MutationObserver(function () { clearTimeout(hasT); hasT = setTimeout(markHas, 150); }).observe(bar, { attributes: true, subtree: true, attributeFilter: ['style'] }); } catch (e) { /* fine */ }
  }
  /* Steel's rule (09/10/26), also before every access profile lists the page (wa225b): the marketing, fundraising and executive
     profiles, admins and team leads get the app; never the board */
  function enrol() {
    try {
      if (typeof wa40Allowed === 'function' && !wa40Allowed.__w225) {
        var __al = wa40Allowed;
        wa40Allowed = function () { var a = __al.apply(this, arguments) || []; var bd = false; try { bd = (typeof MODE !== 'undefined' && MODE === 'board') || role() === 'board'; } catch (x) { /* fine */ } var pk = ''; try { pk = (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.profile) || ''; } catch (x) { /* fine */ } if (!bd && a.indexOf('studio') < 0 && (['marketing', 'fundraising', 'executive', 'admin'].indexOf(pk) >= 0 || role() === 'admin' || role() === 'leader')) a = a.concat(['studio']); return a; };
        Object.keys(__al).forEach(function (k) { try { wa40Allowed[k] = __al[k]; } catch (x) { /* fine */ } });
        wa40Allowed.__w225 = true;
      }
    } catch (e) { /* fine */ }
  }
  function register() {
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    enrol();
    if (!WA_NAV.pages.some(function (p) { return p.id === 'studio'; })) WA_NAV.register({ id: 'studio', label: 'Content Studio', group: 'apps', dot: ROSE, gate: 'leader', onShow: function (h) { show(h); } });
  }
  var toursOk = false;
  if (typeof startApp === 'function') {
    var __sa225 = startApp;
    startApp = async function () {
      var out = await __sa225.apply(this, arguments);
      try {
        register(); toursOk = addTours(); markHas(); watchHas();
        [400, 1500, 4000].forEach(function (ms) { setTimeout(function () { markHas(); if (!toursOk) toursOk = addTours(); }, ms); });
        var h = decodeURIComponent(location.hash || '').replace(/^#/, '');
        if (h.split('/')[0] === 'studio') { try { showPanel('studio'); } catch (x) { /* fine */ } show(h); }
        else setTimeout(function () { if (staffOk() && tabOk('studio') && !S.loaded) loadAll(); if (staffOk() && tabOk('studio') && !M250.loaded) load250().then(function () { try { if (window.w153 && window.w153.paint) window.w153.paint(); } catch (x) { /* fine */ } }, function () { /* fine */ }); }, 6000);   /* the rail's counts (wave251: messages too) */
      } catch (e) { console.warn('wave225 boot', e); }
      return out;
    };
  }

  /* ---------- test hook ---------- */
  window.w225 = {
    counts: counts, state: function () { return S; }, paint: paint, show: show, load: loadAll, route: route, reload: reload,
    html: { overview: overviewHtml, queue: queueHtml, approvals: approvalsHtml, inbox: inboxHtml, messages: messagesHtml, ads: adsHtml, library: libraryHtml, links: linksHtml, report: reportHtml, connections: connectHtml },
    m250: function () { return M250; }, load250: load250, loadAds250: loadAds250,   /* waves 250 to 254 */
    monthStats: monthStats, reportSummary: reportSummary, suggestTimes: suggestTimes, goalStatus: goalStatus, streak: streak, makeLink: makeLink, shortUrl: shortUrl
  };
})();
