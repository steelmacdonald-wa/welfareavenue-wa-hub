/* Welfare Avenue website (wave162, 28/09/26): the menu on phones, the French hint, the next servings and
   events (from the Hub, with the build's copy as the first paint), the photo viewer and the press videos.
   No inline scripts or styles: the Content-Security-Policy allows neither. */
(function () {
  'use strict';
  var B = document.body, LANG = B.getAttribute('data-lang') || 'en', SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var T = {
    en: { serving: 'Sunday serving', sign: 'Sign up', none: 'New dates will be posted soon. Sign up and we will tell you when they are set.', event: 'Fundraiser', more: 'Details', close: 'Close', prev: 'Previous', next: 'Next', menu: 'Menu', photo: 'Photo' },
    fr: { serving: 'Repas du dimanche', sign: 'S’inscrire', none: 'Les prochaines dates seront publiées bientôt. Inscrivez-vous et nous vous écrirons dès qu’elles seront fixées.', event: 'Collecte de fonds', more: 'Détails', close: 'Fermer', prev: 'Précédente', next: 'Suivante', menu: 'Menu', photo: 'Photo' }
  }[LANG === 'fr' ? 'fr' : 'en'];
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function ls(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; }

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
  var boxes = document.querySelectorAll('[data-upcoming]');
  if (boxes.length) {
    var seed = {};
    try { seed = JSON.parse((document.getElementById('upcoming-seed') || {}).textContent || '{}'); } catch (e) { seed = {}; }
    Array.prototype.forEach.call(boxes, function (b) { paint(b, seed); });
    if (SUPA && KEY && window.fetch) {
      fetch(SUPA + '/rest/v1/rpc/www_upcoming?p_limit=8', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && (d.servings || d.events)) Array.prototype.forEach.call(boxes, function (b) { paint(b, d); }); })
        .catch(function () { /* the build's copy stays */ });
    }
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
