/* Welfare Avenue website (wave202, 03/10/26): the Sign up window. Steel, 03/10/26: Sign up opens a window to sign up to the
   site with Google or a code we email them (no password), not the volunteer form. Until accounts are on (the Hub's
   site_accounts_mode test or on), Sign up keeps going to the volunteer form, as the link in the page says (his choice).
   Signed in already: Sign up hides ("My account" shows instead). On the account page the page itself is the sign-in, so
   Sign up just takes you to its form. The window: Google Identity Services (the ID token to Supabase Auth with a nonce, as
   account.js does), or the site-account function's code, checked at /auth/v1/verify; then the account page opens.
   No inline scripts or styles: the site's Content-Security-Policy allows neither. Needs window.WA from site.js. */
(function () {
  'use strict';
  if (!window.fetch || !window.Promise || !document.querySelector) return;
  var B = document.body, LANG = B.getAttribute('data-lang') === 'fr' ? 'fr' : 'en';
  var SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var FN = SUPA + '/functions/v1/site-account';
  var ACCT = LANG === 'fr' ? '/fr/compte/' : '/account/', PRIV = LANG === 'fr' ? '/fr/confidentialite/' : '/privacy/';
  var TX = {
    en: {
      h: 'Sign up or sign in', p: 'Create your Welfare Avenue account in a minute, or sign in to the one you have: your volunteering, your gifts and receipts, and forms that fill in for you.',
      noPass: 'No password needed. Use Google, or we email you a code that works once, for one hour.', test: 'Accounts are being tested with the team for now.',
      or: 'or', emailL: 'Your email', codeBtn: 'Email me a code', sending: 'Sending…', close: 'Close',
      checkT: 'Check your email', checkP: 'We sent a code to {e}. Enter it here, or tap the button in that email.', codeL: 'Code from the email',
      signIn: 'Sign in', signingIn: 'Signing in…', resend: 'Send a new code', resendIn: 'Send a new code ({s})', resent: 'We sent a new code.', other: 'Use another email',
      spam: 'Nothing after a few minutes? Check your spam folder, or write to us at info@welfareavenue.com.', done: 'You are signed in. Opening your account…',
      privacy: 'How we handle your information', gsiErr: 'Google sign-in could not load here. You can use a code by email.',
      errEmail: 'Please enter a valid email address.', errCodeShort: 'Please enter the code from the email.', errCode: 'That code did not work. Check it and try again, or ask for a new one.',
      errRate: 'Too many codes were asked for this address or from here. Please wait a while and try again.', errBusy: 'We are sending a lot of codes right now. Please try again in a little while.',
      errTest: 'Accounts are being tested with the team for now. They open to everyone soon.', errOff: 'Accounts are not open yet.',
      errServer: 'Something went wrong on our side. Please try again in a minute.', errOffline: 'We could not reach Welfare Avenue. Check your connection and try again.',
      errGoogle: 'Google sign-in did not go through. Please try again, or use a code by email.'
    },
    fr: {
      h: 'Inscription ou connexion', p: 'Créez votre compte Welfare Avenue en une minute, ou connectez-vous à celui que vous avez : votre bénévolat, vos dons et vos reçus, et des formulaires qui se remplissent pour vous.',
      noPass: 'Aucun mot de passe. Utilisez Google, ou recevez par courriel un code qui fonctionne une seule fois, pendant une heure.', test: 'Les comptes sont en essai avec l’équipe pour l’instant.',
      or: 'ou', emailL: 'Votre courriel', codeBtn: 'Recevoir un code par courriel', sending: 'Envoi…', close: 'Fermer',
      checkT: 'Vérifiez vos courriels', checkP: 'Nous avons envoyé un code à {e}. Entrez-le ici, ou touchez le bouton dans ce courriel.', codeL: 'Code reçu par courriel',
      signIn: 'Se connecter', signingIn: 'Connexion…', resend: 'Envoyer un nouveau code', resendIn: 'Envoyer un nouveau code ({s})', resent: 'Nous avons envoyé un nouveau code.', other: 'Utiliser un autre courriel',
      spam: 'Rien après quelques minutes? Vérifiez vos courriels indésirables, ou écrivez-nous à info@welfareavenue.com.', done: 'Vous êtes connecté. Ouverture de votre compte…',
      privacy: 'Comment nous traitons vos renseignements', gsiErr: 'La connexion avec Google n’a pas pu se charger ici. Vous pouvez utiliser un code par courriel.',
      errEmail: 'Veuillez entrer une adresse courriel valide.', errCodeShort: 'Veuillez entrer le code reçu par courriel.', errCode: 'Ce code n’a pas fonctionné. Vérifiez-le et réessayez, ou demandez-en un nouveau.',
      errRate: 'Trop de codes ont été demandés pour cette adresse ou depuis cet appareil. Veuillez patienter un peu et réessayer.', errBusy: 'Nous envoyons beaucoup de codes en ce moment. Veuillez réessayer un peu plus tard.',
      errTest: 'Les comptes sont en essai avec l’équipe pour l’instant. Ils ouvriront à tout le monde bientôt.', errOff: 'Les comptes ne sont pas encore ouverts.',
      errServer: 'Un problème est survenu de notre côté. Veuillez réessayer dans une minute.', errOffline: 'Impossible de joindre Welfare Avenue. Vérifiez votre connexion et réessayez.',
      errGoogle: 'La connexion avec Google n’a pas fonctionné. Veuillez réessayer, ou utilisez un code par courriel.'
    }
  }[LANG];
  function t(k) { return TX[k] || k; }
  function f(k, o) { return t(k).replace(/\{(\w+)\}/g, function (m, n) { return o[n] == null ? m : o[n]; }); }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function withMail(s) { return E(s).replace('info@welfareavenue.com', '<a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a>'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function json(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j || {} }; }); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  var S = { cfg: { mode: 'off' }, step: 'start', email: '', err: '', note: '', busy: false, token: '', tokenAt: 0, sentAt: 0, from: null };
  var G = { loading: null, raw: '', ready: false };
  var dlg = null, ticking = null;

  /* ---------- the window ---------- */
  function build() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'signin'; dlg.id = 'wa-signin'; dlg.setAttribute('aria-labelledby', 'si-h');
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) { close(); return; }   // a click on the backdrop
      var a = e.target.closest ? e.target.closest('[data-si]') : null; if (!a) return;
      var act = a.getAttribute('data-si');
      if (act === 'close') close();
      else if (act === 'other') { S.step = 'start'; S.err = ''; S.note = ''; paint(); focus('si-email'); }
      else if (act === 'resend') resend();
    });
    dlg.addEventListener('submit', function (e) {
      e.preventDefault();
      if (e.target.id === 'si-f-email') onEmail(e.target); else if (e.target.id === 'si-f-code') onCode(e.target);
    });
    dlg.addEventListener('close', function () { if (ticking) { clearInterval(ticking); ticking = null; } if (S.from) { try { S.from.focus(); } catch (x) { /* fine */ } } });
    document.body.appendChild(dlg);
    return dlg;
  }
  function focus(id) { var el = document.getElementById(id); if (el) { try { el.focus(); } catch (e) { /* fine */ } } }
  function banner() { return S.err ? '<div class="waf-banner warn" role="alert">' + withMail(S.err) + '</div>' : S.note ? '<div class="waf-banner info" role="status">' + withMail(S.note) + '</div>' : ''; }
  function paint() {
    if (!dlg) return;
    var h = '<div class="si-box"><button type="button" class="si-x" data-si="close" aria-label="' + E(t('close')) + '">&times;</button>';
    if (S.step === 'code') {
      h += '<h2 id="si-h">' + E(t('checkT')) + '</h2><p>' + E(f('checkP', { e: S.email })) + '</p>' + banner() +
        '<form id="si-f-code" class="si-form" novalidate><label for="si-code">' + E(t('codeL')) + '</label>' +
        '<input id="si-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required>' +
        '<button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>' + E(S.busy ? t('signingIn') : t('signIn')) + '</button></form>' +
        '<p class="si-row"><button type="button" class="linkish" data-si="resend" disabled>' + E(f('resendIn', { s: 30 })) + '</button> · ' +
        '<button type="button" class="linkish" data-si="other">' + E(t('other')) + '</button></p><p class="fine mb0">' + withMail(t('spam')) + '</p>';
    } else if (S.step === 'done') {
      h += '<h2 id="si-h">' + E(t('h')) + '</h2><p role="status">' + E(t('done')) + '</p>';
    } else {
      h += '<h2 id="si-h">' + E(t('h')) + '</h2><p>' + E(t('p')) + '</p>' + (S.cfg.mode === 'test' ? '<p class="si-test">' + E(t('test')) + '</p>' : '') + banner() +
        (S.cfg.google_client_id ? '<div id="si-gsi" class="si-gsi"></div><p class="si-or"><span>' + E(t('or')) + '</span></p>' : '') +
        '<form id="si-f-email" class="si-form" novalidate><label for="si-email">' + E(t('emailL')) + '</label>' +
        '<input id="si-email" name="email" type="email" autocomplete="email" maxlength="200" required value="' + E(S.email) + '">' +
        '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>' + E(S.busy ? t('sending') : t('codeBtn')) + '</button></form>' +
        '<p class="fine">' + E(t('noPass')) + '</p><p class="fine mb0"><a href="' + PRIV + '">' + E(t('privacy')) + '</a></p>';
    }
    dlg.innerHTML = h + '</div>';
    if (S.step === 'start' && S.cfg.google_client_id) googleButton();
    if (S.step === 'code') tick();
  }
  function open(from) {
    build(); S.from = from || null; S.step = 'start'; S.err = ''; S.note = ''; S.busy = false;
    paint();
    if (typeof dlg.showModal === 'function') { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } } else dlg.setAttribute('open', '');
    focus('si-email');
    if (!S.token) getToken();   // the code form wants a token at least 2 seconds old: start the clock
  }
  function close() { if (!dlg) return; if (typeof dlg.close === 'function') { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } } else dlg.removeAttribute('open'); }
  function signedIn(sess) {
    window.WA.keep(sess); S.step = 'done'; S.busy = false; paint();
    setTimeout(function () { window.location.href = ACCT; }, 400);
  }

  /* ---------- Google Identity Services (as account.js) ---------- */
  function loadGsi() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (!G.loading) {
      G.loading = new Promise(function (res, rej) {
        var sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
        sc.onload = function () { res(); }; sc.onerror = function () { G.loading = null; rej(new Error('gsi')); };
        document.head.appendChild(sc);
      });
    }
    return G.loading;
  }
  function googleButton() {
    loadGsi().then(function () {
      if (G.ready) return null;
      var a = new Uint8Array(24); window.crypto.getRandomValues(a); G.raw = hex(a.buffer);
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(G.raw)).then(function (h) {
        window.google.accounts.id.initialize({ client_id: S.cfg.google_client_id, callback: onGoogle, nonce: hex(h), ux_mode: 'popup', auto_select: false,
          cancel_on_tap_outside: true, context: 'signup', itp_support: true, use_fedcm_for_prompt: true });
        G.ready = true;
      });
    }).then(function () {
      var el = document.getElementById('si-gsi'); if (!el) return;
      el.innerHTML = '';
      window.google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text: 'signup_with', shape: 'rectangular', logo_alignment: 'left',
        width: Math.max(220, Math.min(360, el.clientWidth || 320)), locale: LANG });
      watchGsi(el);
    }).catch(function () { var el = document.getElementById('si-gsi'); if (el) el.innerHTML = '<p class="fine mb0">' + E(t('gsiErr')) + '</p>'; });
  }
  // wave202b: Google's frame sizes itself once Google accepts the website; if it is still empty after 8 seconds (the website's address
  // not allowed for the client ID, Google unreachable, a blocker), say so and point to the code by email. The note goes if the button
  // turns up later.
  function watchGsi(el) {
    var n = 0, iv = setInterval(function () {
      n++;
      if (!el.isConnected) { clearInterval(iv); return; }
      var f = el.querySelector('iframe'), nx = el.nextElementSibling, note = nx && nx.classList.contains('gsi-note') ? nx : null;
      if (f && parseFloat(f.style.height) > 0) { if (note) note.remove(); clearInterval(iv); return; }
      if (n === 16 && !note) { var p = document.createElement('p'); p.className = 'fine mb0 gsi-note'; p.textContent = t('gsiErr'); el.insertAdjacentElement('afterend', p); }
      if (n >= 120) clearInterval(iv);
    }, 500);
  }
  function onGoogle(resp) {
    if (!resp || !resp.credential || S.busy) return;
    S.busy = true; S.err = ''; S.note = t('signingIn'); paint();
    window.WA.authFetch('token?grant_type=id_token', { provider: 'google', id_token: resp.credential, nonce: G.raw }).then(function (r) {
      if (r.ok && r.body && r.body.access_token) return signedIn(r.body);
      S.busy = false; S.note = ''; S.err = t('errGoogle'); paint();
      return null;
    }, function () { S.busy = false; S.note = ''; S.err = t('errOffline'); paint(); });
  }

  /* ---------- a code by email (the site-account function), checked at /auth/v1/verify ---------- */
  function getToken() {
    return fetch(FN + '?action=token', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }).then(json).then(function (r) {
      if (r.ok && r.body.token) { S.token = r.body.token; S.tokenAt = Date.now(); }
    }, function () { /* the send tries again */ });
  }
  function tokenReady() {
    var p = S.token && Date.now() - S.tokenAt < 3000000 ? Promise.resolve() : getToken();
    return p.then(function () { var age = Date.now() - S.tokenAt; return age < 2300 ? sleep(2300 - age) : null; });
  }
  function postCode(email, hp) {
    return fetch(FN, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'code', email: email, lang: LANG, token: S.token, hp: hp || '' }) }).then(json);
  }
  function sendCode(email, hp) {
    return tokenReady().then(function () { return postCode(email, hp); }).then(function (r) {
      if (r.status === 400 && (r.body.error === 'expired' || r.body.error === 'token')) { S.token = ''; return tokenReady().then(function () { return postCode(email, hp); }); }
      return r;
    });
  }
  function codeError(e) { return { rate: t('errRate'), busy: t('errBusy'), test: t('errTest'), off: t('errOff'), email: t('errEmail') }[e] || t('errServer'); }
  function onEmail(fm) {
    if (S.busy) return;
    var email = String(fm.elements.email.value || '').trim().toLowerCase(), hp = fm.elements.website ? fm.elements.website.value : '';
    S.email = email; S.err = ''; S.note = '';
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { S.err = t('errEmail'); paint(); focus('si-email'); return; }
    S.busy = true; paint();
    sendCode(email, hp).then(function (r) {
      S.busy = false;
      if (r.ok && r.body.ok) { S.step = 'code'; S.sentAt = Date.now(); paint(); focus('si-code'); return; }
      S.err = codeError(r.body.error); paint();
    }, function () { S.busy = false; S.err = t('errOffline'); paint(); });
  }
  function resend() {
    if (S.busy || Date.now() - S.sentAt < 30000) return;
    S.busy = true;
    sendCode(S.email, '').then(function (r) {
      S.busy = false; S.err = ''; S.note = '';
      if (r.ok && r.body.ok) { S.sentAt = Date.now(); S.note = t('resent'); } else S.err = codeError(r.body.error);
      paint(); focus('si-code');
    }, function () { S.busy = false; S.err = t('errOffline'); paint(); });
  }
  function tick() {
    if (ticking) clearInterval(ticking);
    var run = function () {
      var b = dlg && dlg.querySelector('[data-si="resend"]'); if (!b || S.step !== 'code') { clearInterval(ticking); ticking = null; return; }
      var w = 30 - Math.floor((Date.now() - S.sentAt) / 1000);
      b.disabled = w > 0; b.textContent = w > 0 ? f('resendIn', { s: w }) : t('resend');
      if (w <= 0) { clearInterval(ticking); ticking = null; }
    };
    run(); ticking = setInterval(run, 1000);
  }
  function onCode(fm) {
    if (S.busy) return;
    var code = String(fm.elements.code.value || '').replace(/\D/g, '');
    S.err = ''; S.note = '';
    if (code.length < 6) { S.err = t('errCodeShort'); paint(); focus('si-code'); return; }
    S.busy = true; paint();
    window.WA.authFetch('verify', { type: 'email', email: S.email, token: code }).then(function (r) {
      if (r.ok && r.body && r.body.access_token) return signedIn(r.body);
      S.busy = false; S.err = t('errCode'); paint(); focus('si-code');
      return null;
    }, function () { S.busy = false; S.err = t('errOffline'); paint(); });
  }

  /* ---------- the Sign up links ---------- */
  function wire() {
    var links = document.querySelectorAll('[data-signup]');
    if (!links.length || !window.WA || !SUPA || !KEY) return;
    window.WA.config().then(function (cfg) {
      S.cfg = cfg && cfg.mode ? cfg : { mode: 'off' };
      if (S.cfg.mode !== 'test' && S.cfg.mode !== 'on') return null;   // accounts off: Sign up stays the volunteer form
      return window.WA.session().then(function (s) {
        if (s && window.WA.isAccount && window.WA.isAccount(s)) { Array.prototype.forEach.call(links, function (a) { a.hidden = true; }); return; }
        var onAcct = !!document.getElementById('acct');
        Array.prototype.forEach.call(links, function (a) {
          a.setAttribute('href', ACCT); a.setAttribute('aria-haspopup', 'dialog');
          a.addEventListener('click', function (e) {
            if (onAcct) return;   // the account page is the sign-in itself
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // a new tab opens the account page
            e.preventDefault(); open(a);
          });
        });
      });
    }).catch(function () { /* Sign up stays a link */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.WA_SIGNIN = { open: open, close: close };
})();
