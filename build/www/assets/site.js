/* Welfare Avenue website (wave162, 28/09/26; www2, 01/10/26; wave194, 02/10/26): the menu on phones, the French hint, the next servings and
   events (from the Hub, with the build's copy as the first paint), the photo viewer, the press videos, and (wave194) the
   account sign-in kept in this browser (window.WA) with the "My account" links.
   No inline scripts or styles: the Content-Security-Policy allows neither. */
(function () {
  'use strict';
  var B = document.body, LANG = B.getAttribute('data-lang') || 'en', SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var T = {
    en: { nextServing: 'Next serving: ', serving: 'Sunday serving', sign: 'Sign up', none: 'New dates will be posted soon. Sign up and we will tell you when they are set.', event: 'Fundraiser', more: 'Details', close: 'Close', prev: 'Previous', next: 'Next', menu: 'Menu', photo: 'Photo',
      apply: 'Apply for this role', jdRead: 'Read the job description', noRoles: 'No roles are open right now. Send a general application and we will reach out when one fits.', dept: { marketing: 'Marketing', hr: 'Human resources', opsmtl: 'Operations, Montreal', opsto: 'Operations, Toronto', fundraising: 'Fundraising', finance: 'Finance', exec: 'Leadership', board: 'Board', tech: 'Technology', programs: 'Programs' } },
    fr: { nextServing: 'Prochain repas : ', serving: 'Repas du dimanche', sign: 'S’inscrire', none: 'Les prochaines dates seront publiées bientôt. Inscrivez-vous et nous vous écrirons dès qu’elles seront fixées.', event: 'Collecte de fonds', more: 'Détails', close: 'Fermer', prev: 'Précédente', next: 'Suivante', menu: 'Menu', photo: 'Photo',
      apply: 'Postuler pour ce poste', jdRead: 'Lire la description du poste', noRoles: 'Aucun poste n’est ouvert pour le moment. Envoyez une candidature générale et nous vous écrirons dès qu’un rôle vous conviendra.', dept: { marketing: 'Marketing', hr: 'Ressources humaines', opsmtl: 'Opérations, Montréal', opsto: 'Opérations, Toronto', fundraising: 'Collecte de fonds', finance: 'Finances', exec: 'Direction', board: 'Conseil d’administration', tech: 'Technologie', programs: 'Programmes' } }
  }[LANG === 'fr' ? 'fr' : 'en'];
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function ls(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  /* wave194 (02/10/26): website accounts. A person's sign-in (Google, or a code we email them) stays in this browser under
     wa_site_auth and is renewed with its refresh token; window.WA is what account.js and forms.js use. A volunteer's or a
     supporter's sign-in carries the wa_volunteer claim (the Hub's access token hook); since wave195b (Steel, 02/10/26) a team
     or board member has a website account too, with their own sign-in, used here only for their own account (isAccount).
     The Hub itself stays for the team and the board. The "My account" links show once accounts are on (the Hub's site_accounts_mode, read at most every ten minutes)
     or when someone is signed in here. */
  var AUTH = 'wa_site_auth', CFG = 'wa_site_cfg';
  function lsj(k, v) {
    try {
      if (v === undefined) { var raw = window.localStorage.getItem(k); return raw ? JSON.parse(raw) : null; }
      if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
    return null;
  }
  function nowS() { return Math.floor(Date.now() / 1000); }
  function claims(tok) {
    try {
      var p = String(tok).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); while (p.length % 4) p += '=';
      return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(p), function (c) { return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')));
    } catch (e) { return null; }
  }
  function authFetch(path, body, token) {
    return fetch(SUPA + '/auth/v1/' + path, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + (token || KEY), 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
  }
  function keep(sess) {
    if (!sess || !sess.access_token) return null;
    var s = { access_token: sess.access_token, refresh_token: sess.refresh_token || null, expires_at: Number(sess.expires_at) || nowS() + Number(sess.expires_in || 3600),
      email: (sess.user && sess.user.email) || null };
    lsj(AUTH, s); return s;
  }
  var renewing = null;
  function session() {
    var s = lsj(AUTH);
    if (!s || !s.access_token) return Promise.resolve(null);
    if ((Number(s.expires_at) || 0) - nowS() > 60) return Promise.resolve(s);
    if (!s.refresh_token) { lsj(AUTH, null); return Promise.resolve(null); }
    if (!renewing) {
      renewing = authFetch('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(function (r) {
        renewing = null;
        if (r.ok && r.body && r.body.access_token) return keep(r.body);
        if (r.status >= 400 && r.status < 500) lsj(AUTH, null); // refused: signed out; a network failure keeps it for later
        return null;
      }, function () { renewing = null; return null; });
    }
    return renewing;
  }
  function rpc(fn, body, s) {
    return fetch(SUPA + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + (s && s.access_token ? s.access_token : KEY),
      'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
  }
  function config(fresh) {
    var c = lsj(CFG);
    if (!fresh && c && c.v && c.at && Date.now() - c.at < 600000) return Promise.resolve(c.v);
    if (!SUPA || !KEY || !window.fetch) return Promise.resolve({ mode: 'off' });
    return rpc('site_account_config', {}).then(function (r) {
      if (r.ok && r.body && r.body.mode) { lsj(CFG, { at: Date.now(), v: r.body }); return r.body; }
      return (c && c.v) || { mode: 'off' };
    }, function () { return (c && c.v) || { mode: 'off' }; });
  }
  function signOut() {
    var s = lsj(AUTH); lsj(AUTH, null);
    return s && s.access_token ? authFetch('logout?scope=local', {}, s.access_token).then(function () { return null; }, function () { return null; }) : Promise.resolve(null);
  }
  function isVolunteer(s) { var c = s && claims(s.access_token); return !!(c && c.wa_volunteer === true); }
  function isAccount(s) { var c = s && claims(s.access_token); return !!(c && c.sub); }   /* anyone signed in here: a volunteer, a supporter, the team or the board */
  window.WA = { session: session, keep: keep, signOut: signOut, forget: function () { lsj(AUTH, null); }, claims: claims, isVolunteer: isVolunteer, isAccount: isAccount,
    authFetch: authFetch, rpc: rpc, config: config };
  var acctLinks = document.querySelectorAll('[data-acct-link]');
  if (acctLinks.length && SUPA && KEY && window.fetch) {
    var showAcct = function () { Array.prototype.forEach.call(acctLinks, function (a) { a.hidden = false; }); };
    if (lsj(AUTH)) showAcct(); else config().then(function (c) { if (c && c.mode === 'on') showAcct(); });
  }

  /* The menu on phones */
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (btn && nav) {
    var setOpen = function (on) { nav.classList.toggle('open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    btn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); btn.focus(); } });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 960) setOpen(false); });
  }

  /* A hint for French browsers on the English pages */
  var hint = document.getElementById('langhint');
  if (hint && LANG === 'en') {
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).join(',').toLowerCase();
    if (/(^|,)fr/.test(langs) && ls('wa_langhint') !== 'no') {
      hint.hidden = false;
      var x = hint.querySelector('button');
      if (x) x.addEventListener('click', function () { hint.hidden = true; ls('wa_langhint', 'no'); });
    }
  }

  /* The next servings and events */
  var MONTHS = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] }[LANG === 'fr' ? 'fr' : 'en'];
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function longDate(iso) {
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    try { return d.toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' }); } catch (e) { return iso; }
  }
  function items(data, show, limit) {
    var t = today(), out = [];
    (data.servings || []).forEach(function (s) { if (s.date >= t) out.push({ date: s.date, what: s.title || T.serving, where: s.city || 'Montreal', kind: 'serving' }); });
    if (show !== 'servings') (data.events || []).forEach(function (e) { var d = String(e.starts_at || '').slice(0, 10); if (d >= t) out.push({ date: d, what: e.title, where: [e.location, e.city].filter(Boolean).join(', '), kind: 'event', url: e.ticket_url }); });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out.slice(0, limit);
  }
  function paint(box, data) {
    var show = box.getAttribute('data-show') || 'all', limit = +(box.getAttribute('data-limit') || 4), sign = box.getAttribute('data-sign') || '';
    var list = items(data, show, limit), ul = box.querySelector('.upcoming'), note = box.querySelector('.upcoming-note');
    if (!ul) return;
    if (!list.length) { ul.innerHTML = ''; if (note) { note.textContent = T.none; note.hidden = false; } return; }
    if (note) note.hidden = true;
    ul.innerHTML = list.map(function (it) {
      var p = it.date.split('-'), link = it.kind === 'serving' ? sign : (it.url || '');
      return '<li><span class="d" aria-hidden="true"><small>' + E(MONTHS[+p[1] - 1]) + '</small><strong>' + (+p[2]) + '</strong></span>' +
        '<span><span class="what">' + E(it.what) + '</span><br><span class="where">' + E(longDate(it.date)) + (it.where ? ' · ' + E(it.where) : '') + '</span></span>' +
        (link ? '<a class="btn small go" href="' + E(link) + '"' + (/^https?:/.test(link) && link.indexOf(location.host) < 0 ? ' rel="noopener"' : '') + '>' + E(it.kind === 'serving' ? T.sign : T.more) + '<span class="sr"> · ' + E(longDate(it.date)) + '</span></a>' : '') + '</li>';
    }).join('');
  }
  /* www2: the next serving's date in the gold tag on Our activities (Edison's featured activity) */
  var nexts = document.querySelectorAll('[data-next]');
  function paintNext(data) {
    var t = today(), s = (data.servings || []).map(function (x) { return x.date; }).filter(function (d) { return d >= t; }).sort()[0];
    if (s) Array.prototype.forEach.call(nexts, function (el) { el.textContent = T.nextServing + longDate(s); });
  }
  var boxes = document.querySelectorAll('[data-upcoming]');
  if (boxes.length || nexts.length) {
    var seed = {};
    try { seed = JSON.parse((document.getElementById('upcoming-seed') || {}).textContent || '{}'); } catch (e) { seed = {}; }
    Array.prototype.forEach.call(boxes, function (b) { paint(b, seed); });
    paintNext(seed);
    if (SUPA && KEY && window.fetch) {
      fetch(SUPA + '/rest/v1/rpc/www_upcoming?p_limit=8', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && (d.servings || d.events)) { Array.prototype.forEach.call(boxes, function (b) { paint(b, d); }); paintNext(d); } })
        .catch(function () { /* the build's copy stays */ });
    }
  }

  /* wave216 (07/10/26): the open roles on the Join our team page, live from the Hub's HR centre (wa216_open_positions:
     positions at Posted or Interviewing, titles only). "Apply for this role" picks it in the form below. */
  var roleBoxes = document.querySelectorAll('[data-open-roles]');
  if (roleBoxes.length && SUPA && KEY && window.fetch) {
    rpc('wa216_open_positions', {}).then(function (r) {
      var list = r.ok && Array.isArray(r.body) ? r.body : null; if (!list) return;
      Array.prototype.forEach.call(roleBoxes, function (box) {
        box.innerHTML = list.length ? '<ul class="open-roles">' + list.map(function (p) {
          return '<li><div><h3>' + E(p.title) + '</h3>' + (T.dept[p.dept] ? '<p class="fine mb0">' + E(T.dept[p.dept]) + '</p>' : '') + '</div><div class="acts">' + (p.jd_url ? '<a class="textlink" href="' + E(p.jd_url) + '" target="_blank" rel="noopener">' + E(T.jdRead) + '</a>' : '') + '<a class="textlink" href="#apply" data-pick="p:' + E(p.id) + '">' + E(T.apply) + '</a></div></li>';
        }).join('') + '</ul>' : '<p>' + E(T.noRoles) + '</p>';
      });
    }, function () { /* the page's own line stays */ });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-pick]') : null; if (!a) return;
      var v = a.getAttribute('data-pick');
      var radio = document.querySelector('#apply input[name="position"][value="' + v + '"]'), sel = document.querySelector('#apply select[name="position"]');
      if (radio) radio.checked = true; else if (sel) sel.value = v;
    });
  }

  /* The photo viewer (photos and posters) */
  var lb = null, group = [], at = 0, opener = null;
  function lbBuild() {
    lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', T.photo);
    lb.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure><button type="button" class="x" aria-label="' + E(T.close) + '">×</button>' +
      '<button type="button" class="prev" aria-label="' + E(T.prev) + '">‹</button><button type="button" class="next" aria-label="' + E(T.next) + '">›</button>';
    document.body.appendChild(lb);
    lb.querySelector('.x').addEventListener('click', lbClose);
    lb.querySelector('.prev').addEventListener('click', function () { lbShow(at - 1); });
    lb.querySelector('.next').addEventListener('click', function () { lbShow(at + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(at - 1); else if (e.key === 'ArrowRight') lbShow(at + 1);
      else if (e.key === 'Tab') { var f = lb.querySelectorAll('button'), first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    });
  }
  function lbShow(i) {
    if (!group.length) return;
    at = (i + group.length) % group.length;
    var b = group[at], img = lb.querySelector('img');
    img.src = b.getAttribute('data-full'); img.alt = b.getAttribute('data-alt') || '';
    var cap = b.getAttribute('data-title') || '', sub = b.getAttribute('data-caption') || '';
    lb.querySelector('figcaption').innerHTML = (cap ? '<b>' + E(cap) + '</b>' : '') + E(sub);
    var multi = group.length > 1;
    lb.querySelector('.prev').hidden = !multi; lb.querySelector('.next').hidden = !multi;
  }
  function lbClose() { lb.classList.remove('open'); document.documentElement.style.overflow = ''; if (opener) opener.focus(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-full]');
    if (!b) return;
    e.preventDefault();
    if (!lb) lbBuild();
    var g = b.closest('[data-lb-group]');
    group = g ? Array.prototype.slice.call(g.querySelectorAll('[data-full]')) : [b];
    opener = b; lbShow(group.indexOf(b));
    lb.classList.add('open'); document.documentElement.style.overflow = 'hidden';
    lb.querySelector('.x').focus();
  });

  /* Press videos load only when asked (no YouTube until then) */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-yt]');
    if (!b) return;
    var id = b.getAttribute('data-yt');
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    f.title = b.getAttribute('aria-label') || 'Video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.setAttribute('allowfullscreen', '');
    b.parentNode.replaceChild(f, b);
  });
})();
