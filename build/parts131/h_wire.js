
  /* ---------- the sheet ---------- */
  var lastFocus = null;
  function sheetEl() {
    var el = document.getElementById('w131sheet');
    if (!el) { el = document.createElement('div'); el.id = 'w131sheet'; document.body.appendChild(el); }
    return el;
  }
  function sheetView() {
    var sh = S.sheet; if (!sh) return null;
    if (sh.kind === 'person') { var x = personBy(sh.key); return x ? personSheet(x) : null; }
    if (sh.kind === 'profile') return profileSheet();
    if (sh.kind === 'invite') return inviteSheet();
    if (sh.kind === 'list') return listSheet();
    if (sh.kind === 'apply') return applySheet();
    if (sh.kind === 'decide') return decideSheet();
    return null;
  }
  function renderSheet() {
    var el = sheetEl(), wasOn = el.classList.contains('on');
    if (wasOn && S.sheet && S.sheet.kind === 'invite' && !S.sheet.res) readInviteForm();
    var v = sheetView(); if (!v) { closeSheet(); return; }
    var head = '<div style="min-width:0"><div class="kk">' + E(v.kicker) + '</div><h2>' + E(v.title) + '</h2>' + (v.sub ? '<div class="sub">' + E(v.sub) + '</div>' : '') + '</div><span class="sp"></span><button type="button" class="xb" data-w131close="1" aria-label="Close">' + I('x') + '</button>';
    if (!wasOn || !el.querySelector('.pane')) {
      lastFocus = document.activeElement;
      el.innerHTML = '<div class="bk" data-w131close="1"></div><div class="pane" role="dialog" aria-modal="true"><div class="ph"></div><div class="bd"></div><div class="ft"></div></div>';
    }
    var pane = el.querySelector('.pane'), bd = el.querySelector('.bd'), st = bd.scrollTop;
    pane.setAttribute('aria-label', v.title);
    el.querySelector('.ph').innerHTML = head; bd.innerHTML = v.body; el.querySelector('.ft').innerHTML = v.foot;
    if (wasOn) bd.scrollTop = st;
    el.classList.add('on');
    if (!wasOn) setTimeout(function () { var f = el.querySelector('.bd input:not([type=checkbox]), .xb'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }, 40);
  }
  function closeSheet() {
    var el = document.getElementById('w131sheet'); if (el) { el.classList.remove('on'); el.innerHTML = ''; }
    S.sheet = null;
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    lastFocus = null;
  }

  /* ---------- the card and the section ---------- */
  var HREF = { people: '#adminpanel/people', profiles: '#adminpanel/access', requests: '#adminpanel/people/requests' };
  function tabFromHash() {
    var p = String(location.hash || '').replace(/^#/, '').split('/');
    if (p[0] !== 'adminpanel') return null;
    if (p[1] === 'access') return 'profiles';
    if (p[1] === 'people') return p[2] === 'requests' ? 'requests' : p[2] === 'profiles' ? 'profiles' : 'people';
    return null;
  }
  /* the sections stay as wave118 and wave127 made them (the classic view needs them); the new card stands in for both */
  var MAST_D = 'Everyone who can sign in: their access profile, their invitations and the access requests, in one place.';
  function sectionFix() {
    try {
      var W = window.__wa118;
      if (W && Array.isArray(W.ADMIN)) W.ADMIN.forEach(function (a) { if (a[0] === 'people') a[3] = MAST_D; });
      var sub = document.querySelector('nav.wa-nav .w118sub'); if (sub) sub.classList.toggle('w131acc', /^#adminpanel\/access/.test(location.hash || ''));
    } catch (e) { /* fine */ }
  }
  function mastFix() {
    if (document.body.classList.contains('w131classic')) return;
    var m = document.querySelector('#adminpanel > .w118mast'); if (!m || !tabFromHash()) return;
    var h = m.querySelector('h1'), p = m.querySelector('p');
    if (h && h.textContent !== 'People and access') h.textContent = 'People and access';
    if (p && p.textContent !== MAST_D) p.textContent = MAST_D;
  }
  function cardEl() {
    var panel = document.getElementById('adminpanel'); if (!panel || !amAdmin()) return null;
    var c = document.getElementById('w131card');
    if (!c) { c = document.createElement('div'); c.id = 'w131card'; c.className = 'w131wrap'; c.innerHTML = '<div id="w131"></div>'; }
    var sw = panel.querySelector(':scope > .w118adm');
    if (sw) { if (sw.nextElementSibling !== c) sw.insertAdjacentElement('afterend', c); }
    else if (c.parentNode !== panel) panel.insertBefore(c, panel.firstChild);
    return c;
  }
  function paint() {
    var c = cardEl(); if (!c) return;
    var host = document.getElementById('w131'); if (!host) return;
    var t = tabFromHash(); if (t) S.tab = t;
    var html;
    if (!S.loaded) html = '<div class="w131box"><p class="w131empty">Loading people and access…</p></div>';
    else {
      var rq = openRequests().length, n = people().filter(function (x) { return x.status !== 'removed'; }).length;
      html = '<div class="w131top"><nav class="w131tabs" aria-label="People and access">'
        + [['people', 'People', n], ['profiles', 'Profiles', S.profiles.length], ['requests', 'Requests', rq]].map(function (x) { return '<a href="' + HREF[x[0]] + '" data-w131tab="' + x[0] + '"' + (S.tab === x[0] ? ' class="on" aria-current="page"' : '') + '>' + x[1] + ' <b' + (x[0] === 'requests' && rq ? ' class="hot"' : '') + '>' + x[2] + '</b></a>'; }).join('')
        + '</nav><span class="sp"></span><a class="w131btn ghost sm" data-w131list="1">' + I('list') + 'Invite a list</a><a class="w131btn" data-w131new="1">' + I('plus') + 'Invite someone</a></div>'
        + (S.tab === 'profiles' ? profilesHtml() : S.tab === 'requests' ? requestsHtml() : peopleHtml());
    }
    mastFix();
    if (host.__h === html) return;
    var q = document.activeElement && document.activeElement.id === 'w131q' ? document.activeElement : null, pos = q ? q.selectionStart : 0;
    host.innerHTML = html; host.__h = html;
    if (q) { var q2 = document.getElementById('w131q'); if (q2) { try { q2.focus({ preventScroll: true }); q2.setSelectionRange(pos, pos); } catch (e) { /* fine */ } } }
  }
  var showing = null;
  async function show() {
    if (!amAdmin() || !tabFromHash()) return;
    sectionFix(); cardEl(); paint();
    if (showing) return showing;
    showing = (async function () { await load(true); paint(); if (S.sheet) renderSheet(); })();
    try { await showing; } finally { showing = null; }
    openFromHash();
  }
  function openFromHash() {
    var p = String(location.hash || '').replace(/^#/, '').split('/');
    if (p[0] === 'adminpanel' && p[1] === 'people' && p[2] === 'p' && p[3]) { var x = personBy(decodeURIComponent(p[3])); if (x && (!S.sheet || S.sheet.key !== pkey(x))) openPerson(pkey(x)); }
  }
  function setClassic(on) {
    document.body.classList.toggle('w131classic', !!on);
    var panel = document.getElementById('adminpanel'), b = document.getElementById('w131back');
    if (on && panel) {
      if (!b) { b = document.createElement('div'); b.id = 'w131back'; b.className = 'w131back'; b.innerHTML = I('undo') + '<span>This is the classic view: the old table, the roles and hand-picked pages. <a class="w131lnk" data-w131classic="0">Back to People and access</a></span>'; }
      var sw = panel.querySelector(':scope > .w118adm'); if (sw) sw.insertAdjacentElement('afterend', b); else panel.insertBefore(b, panel.firstChild);
      try { if (typeof wa40Render === 'function') wa40Render(); } catch (e) { /* fine */ }
      try { if (window.w127 && window.w127.paint) window.w127.paint(); } catch (e) { /* fine */ }
    } else if (b) b.remove();
    if (!on) paint();
    else { try { var W = window.__wa118; if (W && W.admin) { var m = document.querySelector('#adminpanel > .w118mast'); if (m) m.removeAttribute('data-w118cur'); W.admin(); } } catch (e) { /* fine */ } }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    /* admins inviting from a team page get the new invite, with the team's profile */
    var di = t.closest('[data-w113deptinv]');
    if (di && amAdmin() && S.profiles.length) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); openInvite(di.getAttribute('data-w113deptinv')); return; }
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (!t.closest('#w131card, #w131sheet, #w131back')) return;
    var el, v;
    function a(n) { el = t.closest('[' + n + ']'); v = el ? el.getAttribute(n) : null; return !!el; }
    if (a('data-w131close')) { closeSheet(); return; }
    if (a('data-w131tab')) { if (el.tagName !== 'A' || !el.getAttribute('href')) { e.preventDefault(); location.hash = HREF[v] || HREF.people; } return; }
    if (a('data-w131open')) { e.preventDefault(); openPerson(v); return; }
    if (a('data-w131new')) { openInvite(''); return; }
    if (a('data-w131newin')) { openInvite(v); return; }
    if (a('data-w131list')) { openList(); return; }
    if (a('data-w131invall')) { openInviteAll(); return; }
    if (a('data-w131filter')) { S.status = v; S.q = ''; S.team = ''; if (S.tab !== 'people') location.hash = HREF.people; paint(); var l = document.querySelector('#w131card .w131chips'); if (l && l.scrollIntoView) l.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (a('data-w131st')) { S.status = (S.status === v ? '' : v); paint(); return; }
    if (a('data-w131apply')) { openApply(v); return; }
    if (a('data-w131classic')) { setClassic(v !== '0'); return; }
    if (a('data-w131pick')) { if (el.disabled) return; if (S.sheet.kind === 'invite') readInviteForm(); S.sheet.pick = v; S.sheet.lead = false; renderSheet(); return; }
    if (a('data-w131lead')) { var x0 = S.sheet.kind === 'person' ? personBy(S.sheet.key) : null; var cur = x0 ? sheetPick(x0) : invPick(); if (S.sheet.kind === 'invite') readInviteForm(); if (!S.sheet.pick && cur.key) S.sheet.pick = cur.key; S.sheet.lead = !cur.lead; renderSheet(); return; }
    if (a('data-w131save')) { doSave(); return; }
    if (a('data-w131invite')) { inviteFromSheet(); return; }
    if (a('data-w131resend')) { resend(); return; }
    if (a('data-w131link')) { signLink(); return; }
    if (a('data-w131copymsg')) { var ta = document.getElementById('w131msg'); if (ta) copyText(ta.value).then(function (ok) { toastS(ok ? 'Message copied' : 'Select the text and copy it'); }); return; }
    if (a('data-w131setem')) { setEmail(); return; }
    if (a('data-w131rm')) { S.sheet.rm = v === '1'; renderSheet(); return; }
    if (a('data-w131rmgo')) { removeGo(); return; }
    if (a('data-w131hand')) { var xh = personBy(S.sheet.key); closeSheet(); if (xh && typeof wa40TabModal === 'function') { try { wa40TabModal(xh.email); } catch (x) { /* fine */ } } return; }
    if (a('data-w131go')) { closeSheet(); location.hash = v; return; }
    if (a('data-w131prof')) { openProfile(v); return; }
    if (a('data-w131ptab')) { S.ptab = v; renderSheet(); return; }
    if (a('data-w131cell')) { var cv = v.split('|'); cell(cv[0], cv[1]); return; }
    if (a('data-w131psave')) { savePages(); return; }
    if (a('data-w131pundo')) { S.pedits = {}; renderSheet(); return; }
    if (a('data-w131wsave')) { saveWords(); return; }
    if (a('data-w131auto')) { setAuto(!(S.settings || {}).auto_profile); return; }
    if (a('data-w131decide')) { openDecide(); return; }
    if (a('data-w131dcell')) { var dv = v.split('|'), dk = dv[0] + '|' + dv[1], p0 = S.byKey[dv[0]]; S.dedits = S.dedits || {}; if (p0 && valueOf(p0, dv[1]) === dv[2]) delete S.dedits[dk]; else S.dedits[dk] = dv[2]; renderSheet(); return; }
    if (a('data-w131dsave')) { saveDecide(); return; }
    if (a('data-w131applygo')) { applyGo(); return; }
    if (a('data-w131invgo')) { inviteGo(); return; }
    if (a('data-w131invnext')) { openInvite(S.sheet && S.sheet.f ? S.sheet.f.dept : ''); return; }
    if (a('data-w131lreview')) { listReview(); return; }
    if (a('data-w131lback')) { S.sheet.step = 'paste'; S.sheet.rows = []; renderSheet(); return; }
    if (a('data-w131lgo')) { listGo(); return; }
    if (a('data-w131grant')) { decide(v, true); return; }
    if (a('data-w131decline')) { decide(v, false); return; }
    if (a('data-w131done')) { decide(v, true, true); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w131team') { S.team = t.value; paint(); return; }
    if (t.id === 'w131f_dept') { readInviteForm(); S.sheet.pick = null; S.sheet.lead = false; renderSheet(); return; }
    if (t.id === 'w131ldept' && S.sheet) { S.sheet.dept = t.value; return; }
    var lr = t.getAttribute && t.getAttribute('data-w131lrow');
    if (lr && S.sheet && S.sheet.rows) {
      var parts = lr.split('|'), r = S.sheet.rows[Number(parts[0])]; if (!r) return;
      if (parts[1] === 'dept') { var oldT = teamProfile(r.dept); r.dept = t.value; if (!r.key || (oldT && r.key === oldT.key)) { var nt = t.value === 'board' && S.byKey.board ? S.byKey.board : teamProfile(t.value); r.key = nt ? nt.key : ''; r.lead = false; } }
      else { var m = /^([a-z0-9_-]*)(:lead)?$/.exec(t.value) || []; r.key = m[1] || ''; r.lead = !!m[2]; }
      renderSheet();
    }
  });
  var qT = null;
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w131q') { S.q = t.value; clearTimeout(qT); qT = setTimeout(paint, 220); return; }
    if (t.id === 'w131em' && S.sheet) { S.sheet.email = t.value; return; }
    if (t.id === 'w131paste' && S.sheet) { S.sheet.text = t.value; return; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.sheet && document.getElementById('w131sheet') && document.getElementById('w131sheet').classList.contains('on')) { e.preventDefault(); closeSheet(); }
  });
  window.addEventListener('hashchange', function () {
    sectionFix();
    if (tabFromHash()) { S.status = S.tab === tabFromHash() ? S.status : S.status; setTimeout(show, 0); }
    else if (S.sheet) closeSheet();
  });

  /* ---------- the tour and the Admin lesson ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours || !W.tours.adminpanel) return;
      var st = W.tours.adminpanel.steps || [];
      /* the old cards' steps go, every time (wave127 adds its step back at boot) */
      var at = -1;
      for (var i = st.length - 1; i >= 0; i--) { var sel = String(st[i].s || ''); if (sel === '#w113card' || sel === '#w127card' || sel.indexOf('#w113card') === 0 || sel.indexOf('#w127card') === 0 || sel.indexOf('#w110ar') >= 0) { if (at < 0 || i < at) at = i; st.splice(i, 1); } }
      if (st.some(function (s) { return s.s && String(s.s).indexOf('#w131card') === 0; })) return;
      var add = [
        { s: '#w131card .w131tabs', t: 'People and access', p: 'One place for access: People (everyone and their profile), Profiles (what each profile opens) and Requests (people asking for more).', opt: 1, hash: '#adminpanel/people' },
        { s: '#w131card .w131todo || #w131card .w131alldone', t: 'What needs doing', p: 'Access requests, people without a profile, people not invited yet, missing emails and inactive people who can still sign in, each with the button that fixes it.', opt: 1 },
        { s: '#w131card .w131team', t: 'Everyone, by team', p: 'Each person’s sign-in status and profile. Click anyone to pick their profile (their team’s comes first, with a Lead switch), see the pages it opens, invite them, copy a sign-in link or remove them.', opt: 1 },
        { s: '#w131card [data-w131new]', t: 'Invite someone', p: 'Name, email and team: their team’s profile is picked for you, and the Hub emails the invitation from hub@. Invite a list the same way.', opt: 1 },
        { s: '#w131card .w131pgrid', t: 'Profiles', p: 'Open a profile to set its pages (everyone, leads or nobody), its words and see who has it. Every profile is compared below.', opt: 1, hash: '#adminpanel/access' }
      ];
      Array.prototype.splice.apply(st, [at < 0 ? st.length : at, 0].concat(add));
      var nav = st.filter(function (s) { return s.s === '#adminpanel nav.w118adm'; })[0];
      if (nav && nav.p) nav.p = nav.p.replace('people and access, access profiles,', 'people and access,');
    } catch (e) { /* fine */ }
  }

  /* ---------- boot ---------- */
  sectionFix(); addTours();
  if (typeof showPanel === 'function') {
    var __sp131 = showPanel;
    showPanel = function (id) {
      var out = __sp131.apply(this, arguments);
      try { if (id === 'adminpanel') setTimeout(show, 40); else if (S.sheet) closeSheet(); } catch (e) { /* fine */ }
      return out;
    };
  }
  if (typeof startApp === 'function') {
    var __sa131 = startApp;
    startApp = async function () {
      var out = await __sa131.apply(this, arguments);
      try { sectionFix(); addTours(); if (tabFromHash()) show(); } catch (e) { console.warn('wave131 boot', e); }
      return out;
    };
  }
  window.w131 = {
    state: function () { return S; }, paint: paint, show: show, load: load, open: openPerson, profile: openProfile, invite: openInvite,
    people: function () { return people(); }, todos: function () { return todos().map(function (t) { return t.k; }); }, pages: function (key, lead) { return pagesOfProfile(key, lead, null, 'x@welfareavenue.com'); }
  };
})();
