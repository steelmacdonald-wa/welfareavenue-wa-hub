/* Welfare Avenue website (wave162, 28/09/26; wave216 07/10/26: a file question, the CV of an application form, uploaded on
   send through form-submit's one-time upload link): the Hub's forms inside the website's pages. Each
   <div data-wa-form="slug[,fallback]"> asks the Hub's form-submit function for the published form (drafts are not
   found, so the page keeps its own message until staff put the form live in the CRM), shows the questions in the
   form's language, and posts the answers back with the signed token, the hidden field and the timing checks that
   form-submit expects. Same protocol as the Hub's own page at hub.welfareavenue.com/f/<slug>.
   wave194 (02/10/26, Steel: forms fill in from a person's account and what they type is saved to it): when accounts are on
   and someone is signed in on this site (window.WA, site.js), the questions that fill a contact field come filled from
   their profile (account_prefill), the answers go with their own sign-in so form-submit saves them to their record, and a
   line above the form says so ("Not you?" signs out). Signed out, with accounts on, the line offers to sign in first and
   come back (/account/?next=).
   wave236 (14/10/26, Steel: the sign-up and application forms pop up over the page instead of taking up room in it): a
   form box with data-wa-popup opens in a pop-up; see Popup() at the end. */
(function () {
  'use strict';
  var B = document.body, SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var URL_FN = SUPA + '/functions/v1/form-submit';
  var PAGE_LANG = B.getAttribute('data-lang') === 'fr' ? 'fr' : 'en';
  var ACCT_URL = PAGE_LANG === 'fr' ? '/fr/compte/' : '/account/', PRIV_URL = PAGE_LANG === 'fr' ? '/fr/confidentialite/' : '/privacy/';
  var TX = {
    en: { maxN: 'Please pick at most {n}.', optional: '(optional)', send: 'Send', sending: 'Sending…', fix: 'Please check the answers marked below.', required: 'Please answer this question.', email: 'Please enter a valid email address.',
      phone: 'Please enter a phone number we can reach.', consent: 'Please tick the box to sign up.', rate: 'Too many tries from here. Please wait a few minutes and send again.',
      expired: 'This page was open a long time, so we refreshed the form. Please check your answers and send again.', server: 'Something went wrong on our side. Please try again in a minute.',
      offline: 'We could not reach Welfare Avenue. Check your connection and try again.', nodates: 'No dates are open right now. Send the form and we will reach out when new ones are set.',
      yes: 'Yes', no: 'No', thanks: 'Thank you!', closed: 'This form is closed for now. You can reach us at ', select: 'Choose…',
      privacy: 'We keep your answers in our volunteer and supporter records, use them only to work with you, and never sell or share them.', privacyLink: 'Privacy',
      acctIn: 'Signed in as {n}. We filled in what we have, and what you change here is saved to your profile.', acctMine: 'My account', acctNot: 'Not you?',
      acctOffer: 'Have an account? {a} and this form fills in for you.', acctSignIn: 'Sign in', saved: 'Your profile is updated too.',
      fileType: 'Please attach a PDF, Word document or photo.', fileBig: 'That file is over {n} MB. Please attach a smaller one.', attached: 'Attached: ', uploading: 'Uploading your file…', fileFail: 'Your file could not be uploaded. Please try again.', jd: 'Job description' },
    fr: { maxN: 'Veuillez en choisir {n} au plus.', optional: '(facultatif)', send: 'Envoyer', sending: 'Envoi…', fix: 'Veuillez vérifier les réponses indiquées ci-dessous.', required: 'Veuillez répondre à cette question.', email: 'Veuillez entrer une adresse courriel valide.',
      phone: 'Veuillez entrer un numéro où vous joindre.', consent: 'Veuillez cocher la case pour vous inscrire.', rate: 'Trop d’essais depuis cet appareil. Veuillez patienter quelques minutes.',
      expired: 'Cette page était ouverte depuis longtemps; nous avons actualisé le formulaire. Vérifiez vos réponses et envoyez de nouveau.', server: 'Un problème est survenu de notre côté. Veuillez réessayer dans une minute.',
      offline: 'Impossible de joindre Welfare Avenue. Vérifiez votre connexion et réessayez.', nodates: 'Aucune date n’est ouverte pour le moment. Envoyez le formulaire et nous vous écrirons dès que de nouvelles dates seront fixées.',
      yes: 'Oui', no: 'Non', thanks: 'Merci!', closed: 'Ce formulaire est fermé pour le moment. Vous pouvez nous écrire à ', select: 'Choisir…',
      privacy: 'Nous conservons vos réponses dans nos dossiers de bénévoles et de sympathisants, nous les utilisons seulement pour travailler avec vous et ne les vendons ni ne les partageons jamais.', privacyLink: 'Confidentialité',
      acctIn: 'Connexion : {n}. Nous avons rempli ce que nous avons, et ce que vous changez ici est enregistré dans votre profil.', acctMine: 'Mon compte', acctNot: 'Ce n’est pas vous?',
      acctOffer: 'Vous avez un compte? {a} et ce formulaire se remplit pour vous.', acctSignIn: 'Connectez-vous', saved: 'Votre profil est aussi à jour.',
      fileType: 'Veuillez joindre un PDF, un document Word ou une photo.', fileBig: 'Ce fichier dépasse {n} Mo. Veuillez en joindre un plus petit.', attached: 'Fichier joint : ', uploading: 'Envoi de votre fichier…', fileFail: 'Votre fichier n’a pas pu être envoyé. Veuillez réessayer.', jd: 'Description du poste' }
  };
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function call(method, slug, body, token) {
    var opt = { method: method, headers: { apikey: KEY, Authorization: 'Bearer ' + (token || KEY) } };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(URL_FN + (method === 'GET' ? '?slug=' + encodeURIComponent(slug) : ''), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j || {} }; });
    });
  }
  /* wave194: the signed-in account, looked up once for every form on the page (at most 2.5 seconds, so a form never waits long) */
  var ACCT = null, MODE = 'off', FORMS = [];
  var acctReady = (function () {
    var W = window.WA;
    if (!W || !SUPA || !KEY || !window.fetch || !document.querySelector('[data-wa-form]')) return Promise.resolve();
    var look = W.config().then(function (c) {
      MODE = (c && c.mode) || 'off';
      if (MODE === 'off') return null;
      return W.session().then(function (s) {
        if (!s || !W.isAccount(s)) return null;
        return W.rpc('account_prefill', { p_lang: PAGE_LANG }, s).then(function (r) {
          var b = r.body || {};
          if (r.ok && b.linked && b.fill) ACCT = { fill: b.fill, name: b.name || '', email: b.fill.email || s.email || '' };
          return null;
        });
      });
    }).catch(function () { return null; });
    return Promise.race([look, new Promise(function (res) { setTimeout(res, 2500); })]);
  })();
  function Form(box, n) {
    var S = { form: null, org: null, token: '', lang: 'en', errors: {}, sending: false, banner: '', files: {}, uploaded: {} };
    var slugs = (box.getAttribute('data-wa-form') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var fallback = box.innerHTML, pfx = 'w' + n + '_';
    function t(k) { return (TX[S.lang] || TX.en)[k] || TX.en[k] || k; }
    function load(i, keep) {
      if (i >= slugs.length) return; // no published form: the page's own message stays
      return call('GET', slugs[i]).then(function (r) {
        if (r.status === 404) return load(i + 1, keep);
        if (r.body && r.body.closed) { S.lang = r.body.lang || S.lang; var mail = (r.body.org && r.body.org.email) || 'info@welfareavenue.com'; box.innerHTML = '<p class="waf-note">' + E(t('closed')) + '<a href="mailto:' + E(mail) + '">' + E(mail) + '</a>.</p>'; return; }
        if (r.status !== 200 || !r.body.form) return;
        S.form = r.body.form; S.org = r.body.org; S.token = r.body.token; S.lang = S.form.lang === 'fr' ? 'fr' : 'en';
        if (keep) S.banner = t('expired');
        return acctReady.then(function () { render(keep); });
      }).catch(function () { /* offline: keep the page's message */ });
    }
    function field(q, keep) {
      var id = pfx + q.id, err = S.errors[q.id], v = keep ? keep[q.id] : (ACCT && q.fill && ACCT.fill[q.fill] != null ? String(ACCT.fill[q.fill]) : undefined);
      var head = function (tag) {
        return '<' + tag + (tag === 'label' ? ' for="' + id + '"' : '') + ' id="' + id + '_l">' + E(q.label) + (q.required ? '<span class="req" aria-hidden="true">*</span>' : ' <span class="opt">' + E(t('optional')) + '</span>') + '</' + tag + '>' +
          (q.help ? '<p class="help" id="' + id + '_h">' + E(q.help) + '</p>' : '');
      };
      var desc = ((q.help ? id + '_h ' : '') + (err ? id + '_e' : '')).trim();
      var aria = (desc ? ' aria-describedby="' + desc + '"' : '') + (err ? ' aria-invalid="true"' : '') + (q.required ? ' aria-required="true"' : '');
      var e = err ? '<p class="err" id="' + id + '_e">' + E(err) + '</p>' : '';
      var cls = 'q' + (err ? ' bad' : '');
      if (q.type === 'text' || q.type === 'email' || q.type === 'phone' || q.type === 'number' || q.type === 'date') {
        var type = { text: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date' }[q.type];
        var ac = q.type === 'email' ? ' autocomplete="email"' : q.type === 'phone' ? ' autocomplete="tel"' : /first/i.test(q.id) ? ' autocomplete="given-name"' : /last/i.test(q.id) ? ' autocomplete="family-name"' : '';
        return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<input id="' + id + '" name="' + E(q.id) + '" type="' + type + '"' + ac + aria + ' value="' + E(v || '') + '" maxlength="200">' + e + '</div>';
      }
      /* wave216: a file (a CV for an application form): the chosen file is kept in S.files so a re-render keeps it, and it is
         uploaded when the form is sent (form-submit action upload gives a one-time link into private storage) */
      if (q.type === 'file') {
        var f0 = S.files[q.id];
        return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<input id="' + id + '" name="' + E(q.id) + '" type="file"' + (q.accept ? ' accept="' + E(q.accept) + '"' : '') + aria + '>' +
          '<p class="waf-file small" data-waf-file="' + E(q.id) + '"' + (f0 ? '' : ' hidden') + '>' + (f0 ? E(t('attached') + f0.name) : '') + '</p>' + e + '</div>';
      }
      if (q.type === 'long_text') return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<textarea id="' + id + '" name="' + E(q.id) + '"' + aria + ' maxlength="2000">' + E(v || '') + '</textarea>' + e + '</div>';
      var opts = q.type === 'yes_no' ? [{ v: 'yes', l: t('yes') }, { v: 'no', l: t('no') }] : (q.options || []).map(function (o) { return typeof o === 'string' ? { v: o, l: o } : o; });
      var multi = q.type === 'multi' || q.type === 'serving_dates';
      if (q.type === 'serving_dates' && !opts.length) return '<fieldset class="' + cls + '" data-q="' + E(q.id) + '">' + head('legend') + '<p class="none">' + E(t('nodates')) + '</p></fieldset>';
      if (!multi && opts.length > 8) {
        return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<select id="' + id + '" name="' + E(q.id) + '"' + aria + '><option value="">' + E(t('select')) + '</option>' +
          opts.map(function (o) { return '<option value="' + E(o.v) + '"' + (v === o.v ? ' selected' : '') + '>' + E(o.l) + '</option>'; }).join('') + '</select>' + e + '</div>';
      }
      var picked = multi ? (Array.isArray(v) ? v : []) : v;
      var mx = multi && q.max ? Number(q.max) : 0, full = mx && picked.length >= mx;   /* wave244: at most q.max choices (the roles: 2) */
      return '<fieldset class="' + cls + '" data-q="' + E(q.id) + '"' + (mx ? ' data-max="' + mx + '"' : '') + (err ? ' aria-invalid="true"' : '') + (desc ? ' aria-describedby="' + desc + '"' : '') + '>' + head('legend') +
        '<div class="choices' + (opts.length > 3 && !opts.some(function (o) { return o.d; }) && opts.every(function (o) { return String(o.l).length < 28; }) ? ' two' : '') + '">' +
        opts.map(function (o, i) {
          var on = multi ? picked.indexOf(o.v) >= 0 : picked === o.v;
          return '<label class="choice"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + E(q.id) + '" value="' + E(o.v) + '"' + (on ? ' checked' : '') + (full && !on ? ' disabled' : '') + (i === 0 ? ' id="' + id + '"' : '') + (o.lead ? ' data-lead="1"' : '') + '><span>' + E(o.l) + (o.u ? ' <a class="jdlink" href="' + E(o.u) + '" target="_blank" rel="noopener">' + E(t('jd')) + '</a>' : '') + (o.d ? '<small class="cd">' + E(o.d) + '</small>' : '') + '</span></label>';
        }).join('') + '</div>' + (q.lead_note ? '<p class="waf-lead" data-waf-lead="' + E(q.id) + '"' + (opts.some(function (o) { return o.lead && picked === o.v; }) ? '' : ' hidden') + '>' + E(q.lead_note) + '</p>' : '') + e + '</fieldset>';
    }
    function acctLine() {
      if (ACCT) return '<p class="waf-acct">' + E(t('acctIn').replace('{n}', ACCT.name || ACCT.email)) + ' <a href="' + ACCT_URL + '">' + E(t('acctMine')) + '</a> · ' +
        '<button type="button" class="linkish" data-waf-out>' + E(t('acctNot')) + '</button></p>';
      if (MODE !== 'on') return '';
      var at = box.closest('[id]'), next = window.location.pathname + (at ? '#' + at.id : ''), parts = t('acctOffer').split('{a}');
      return '<p class="waf-acct">' + E(parts[0]) + '<a href="' + ACCT_URL + '?next=' + encodeURIComponent(next) + '">' + E(t('acctSignIn')) + '</a>' + E(parts[1] || '') + '</p>';
    }
    function limitMax(fs) {
      var n = Number(fs.getAttribute('data-max')) || 0, bs = fs.querySelectorAll('input[type="checkbox"]'), c = 0;
      Array.prototype.forEach.call(bs, function (b) { if (b.checked) c++; });
      Array.prototype.forEach.call(bs, function (b) { if (!b.checked) b.disabled = n > 0 && c >= n; });
    }
    function render(keep) {
      var f = S.form, c = f.consent || {}, cerr = S.errors._consent, heading = box.getAttribute('data-heading');
      box.innerHTML = '<form novalidate lang="' + S.lang + '">' + (heading !== 'none' ? '<h3>' + E(f.title) + '</h3>' + (f.intro ? '<p class="waf-intro">' + E(f.intro) + '</p>' : '') : '') + acctLine() +
        (S.banner ? '<div class="waf-banner ' + (Object.keys(S.errors).length ? 'warn' : 'info') + '" role="alert">' + E(S.banner) + '</div>' : '') +
        f.questions.map(function (q) { return field(q, keep); }).join('') +
        (c.ask ? '<div class="q consent' + (cerr ? ' bad' : '') + '" data-q="_consent"><label class="choice"><input type="checkbox" id="' + pfx + '_consent" name="_consent"' + (keep && keep._consent ? ' checked' : '') + (cerr ? ' aria-invalid="true" aria-describedby="' + pfx + '_consent_e"' : '') + '><span>' + E(c.label) + (c.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</span></label>' +
          (cerr ? '<p class="err" id="' + pfx + '_consent_e">' + E(cerr) + '</p>' : '') + '<p class="small">' + E((S.org && S.org.address) || 'Welfare Avenue') + ' · ' + E((S.org && S.org.email) || '') + '</p></div>' : '') +
        '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<button type="submit" class="btn waf-send"' + (S.sending ? ' disabled' : '') + '>' + E(S.sending ? t('sending') : t('send')) + '</button>' +
        '<p class="waf-privacy">' + E(t('privacy')) + ' <a href="' + PRIV_URL + '">' + E(t('privacyLink')) + '</a></p></form>';
      box.querySelector('form').addEventListener('submit', submit);
      /* wave216d: the leadership note shows only while a leadership role is picked */
      Array.prototype.forEach.call(box.querySelectorAll('[data-waf-lead]'), function (note) {
        var name = note.getAttribute('data-waf-lead');
        Array.prototype.forEach.call(box.querySelectorAll('input[name="' + name + '"]'), function (r) {
          r.addEventListener('change', function () { var on = box.querySelector('input[name="' + name + '"]:checked'); note.hidden = !(on && on.getAttribute('data-lead') === '1'); });
        });
      });
      /* wave244: once the most choices are ticked, the others wait until one is unticked */
      Array.prototype.forEach.call(box.querySelectorAll('fieldset[data-max]'), function (fs) { fs.addEventListener('change', function () { limitMax(fs); }); });
      Array.prototype.forEach.call(box.querySelectorAll('input[type="file"]'), function (inp) {
        inp.addEventListener('change', function () {
          var f0 = inp.files && inp.files[0]; if (!f0) return;
          S.files[inp.name] = f0;
          var line = box.querySelector('[data-waf-file="' + inp.name + '"]'); if (line) { line.textContent = t('attached') + f0.name; line.hidden = false; }
        });
      });
      var out = box.querySelector('[data-waf-out]');
      if (out) out.addEventListener('click', function () { if (window.WA) window.WA.signOut(); ACCT = null; FORMS.forEach(function (fn) { fn(); }); });
    }
    FORMS.push(function () { if (S.form && !S.sending && box.querySelector('form')) render(); });
    function collect() {
      var form = box.querySelector('form'), out = {};
      S.form.questions.forEach(function (q) {
        if (q.type === 'multi' || q.type === 'serving_dates') out[q.id] = Array.prototype.map.call(form.querySelectorAll('input[name="' + q.id + '"]:checked'), function (i) { return i.value; });
        else if (q.type === 'choice' || q.type === 'yes_no') { var sel = form.querySelector('select[name="' + q.id + '"]'); var r = form.querySelector('input[name="' + q.id + '"]:checked'); out[q.id] = sel ? sel.value : (r ? r.value : ''); }
        else if (q.type === 'file') out[q.id] = S.files[q.id] ? S.files[q.id].name : '';
        else { var el = form.querySelector('[name="' + q.id + '"]'); out[q.id] = el ? el.value : ''; }
      });
      var cb = form.querySelector('input[name="_consent"]'); out._consent = !!(cb && cb.checked);
      out._hp = (form.querySelector('input[name="website"]') || {}).value || '';
      return out;
    }
    function validate(a) {
      var errs = {};
      S.form.questions.forEach(function (q) {
        var v = a[q.id], empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
        if (empty) { if (q.required && !(q.type === 'serving_dates' && !(q.options || []).length)) errs[q.id] = t('required'); return; }
        if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())) errs[q.id] = t('email');
        if (q.max && Array.isArray(v) && v.length > Number(q.max)) errs[q.id] = t('maxN').replace('{n}', q.max);
        if (q.type === 'phone' && String(v).replace(/\D/g, '').length < 7) errs[q.id] = t('phone');
        if (q.type === 'file') {
          var f0 = S.files[q.id], ext = (f0.name.match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
          if (q.accept && q.accept.split(',').indexOf(ext) < 0) errs[q.id] = t('fileType');
          else if (q.max_mb && f0.size > q.max_mb * 1048576) errs[q.id] = t('fileBig').replace('{n}', q.max_mb);
        }
      });
      if (S.form.consent && S.form.consent.ask && S.form.consent.required && !a._consent) errs._consent = t('consent');
      return errs;
    }
    function focusFirst() {
      var k = Object.keys(S.errors)[0]; if (!k) return;
      var el = document.getElementById(pfx + k) || box.querySelector('[data-q="' + k + '"] input, [data-q="' + k + '"] textarea, [data-q="' + k + '"] select');
      if (el) { el.focus(); try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* fine */ } }
    }
    function submit(ev) {
      ev.preventDefault(); if (S.sending) return;
      var a = collect();
      S.errors = validate(a);
      if (Object.keys(S.errors).length) { S.banner = t('fix'); render(a); focusFirst(); return; }
      var answers = {}; S.form.questions.forEach(function (q) { answers[q.id] = a[q.id]; });
      var fileQs = S.form.questions.filter(function (q) { return q.type === 'file' && S.files[q.id]; });
      S.sending = true; S.banner = fileQs.length ? t('uploading') : ''; render(a);
      var failed = null;
      var up = fileQs.reduce(function (p, q) {
        return p.then(function () {
          if (failed) return;
          var f0 = S.files[q.id], done = S.uploaded[q.id];
          if (done && done.file === f0) { answers[q.id] = done.id; return; }
          return call('POST', S.form.slug, { action: 'upload', slug: S.form.slug, token: S.token, qid: q.id, name: f0.name, size: f0.size, mime: f0.type }).then(function (r) {
            if (r.status !== 200 || !r.body.url) { failed = r; return; }
            return fetch(r.body.url, { method: 'PUT', headers: { 'Content-Type': r.body.mime || f0.type || 'application/octet-stream' }, body: f0 }).then(function (pr) {
              if (!pr.ok) { failed = { status: 500, body: { error: 'upload' } }; return; }
              S.uploaded[q.id] = { file: f0, id: r.body.upload_id }; answers[q.id] = r.body.upload_id;
            });
          });
        });
      }, Promise.resolve()).catch(function () { failed = { status: 0, body: {} }; });
      up.then(function () {
        if (!failed) return;
        S.sending = false; S.errors = (failed.body && failed.body.fields) || {};
        S.banner = failed.status === 0 ? t('offline') : failed.status === 429 ? t('rate') : failed.body && failed.body.error === 'expired' ? t('expired') : Object.keys(S.errors).length ? t('fix') : t('fileFail');
        if (failed.body && failed.body.error === 'expired') { load(slugs.indexOf(S.form.slug), a); return; }
        render(a); focusFirst();
      });
      up.then(function () { if (failed) return Promise.reject('stop'); })
      .then(function () {
      // wave194: a signed-in account sends its own sign-in, so form-submit saves the answers to that person's record
      return (ACCT && window.WA ? window.WA.session() : Promise.resolve(null)).then(function (s) {
        var tok = s && window.WA.isAccount(s) ? s.access_token : null;
        return call('POST', S.form.slug, { slug: S.form.slug, token: S.token, answers: answers, consent: a._consent, hp: a._hp, lang: S.lang }, tok);
      }).then(function (r) {
        S.sending = false;
        if (r.status === 200 && r.body.ok) { thanks(r.body.thank_you || S.form.thank_you, r.body.saved === true); return; }
        if (r.status === 400 && r.body.error === 'invalid') { S.errors = r.body.fields || {}; S.banner = t('fix'); render(a); focusFirst(); return; }
        if (r.status === 400 && r.body.error === 'expired') { S.errors = {}; load(slugs.indexOf(S.form.slug), a); return; }
        if (r.status === 404 || r.status === 410) { box.innerHTML = fallback; return; }
        S.banner = r.status === 429 ? t('rate') : t('server'); S.errors = {}; render(a);
      }).catch(function () { S.sending = false; S.banner = t('offline'); render(a); });
      }, function () { /* the upload failed: already shown */ })
      .catch(function () { S.sending = false; S.banner = t('offline'); render(a); });
    }
    function thanks(msg, saved) {
      box.innerHTML = '<div class="waf-done" role="status" tabindex="-1"><h3>' + E(t('thanks')) + '</h3><p class="mb0">' + E(msg) + '</p>' + (saved ? '<p class="small">' + E(t('saved')) + '</p>' : '') + '</div>';
      var d = box.querySelector('.waf-done'); try { d.focus(); d.scrollIntoView({ block: 'center' }); } catch (e) { /* fine */ }
    }
    if (SUPA && KEY && window.fetch && slugs.length) load(0);
  }
  /* wave236 (14/10/26, Steel: the sign-up and application forms pop up over the page instead of taking up room in it).
     <div data-wa-form="…" data-wa-popup="Button label" data-wa-popup-note="Optional line"> stays in the page as a short card
     (its fallback's heading, the line and the button); the form itself is built inside a <dialog> whose id is the section's
     id plus "-form" (#apply-form, #groups-form). The pop-up opens on that button, on any link on this page to the section or
     to the pop-up (#apply, #groups, #apply-form…) and when the page is opened at one of those addresses, so links from other
     pages and emails (welfareavenue.com/volunteer/#groups) land on the open form. The × , Escape and a click outside close
     it; what someone typed is kept if they reopen it. A role link on the Join page (data-pick) ticks that role in the form,
     and since wave237 so does "Apply for this role" on a Montreal role card (data-role, a value of the roles question).
     Its styles are forms.css, loaded only on pages with a pop-up. Without JavaScript the card keeps the page's own message. */
  var CSS_V = 'cb125b2b', POPS = {};
  function Popup(box, n) {
    var sec = box.closest('section[id]'), sid = sec ? sec.id : 'waf' + n, fr = PAGE_LANG === 'fr';
    var label = box.getAttribute('data-wa-popup') || (fr ? 'Ouvrir le formulaire' : 'Open the form');
    var note = box.getAttribute('data-wa-popup-note') || '';
    var h = box.querySelector('.waf-fallback h3'), title = h ? h.textContent : label;
    var d = document.createElement('dialog'); d.className = 'waf-dialog'; d.id = sid + '-form'; d.setAttribute('aria-label', title);
    d.innerHTML = '<div class="waf-sheet"><div class="waf-bar"><button type="button" class="waf-x" aria-label="' + E(fr ? 'Fermer' : 'Close') + '">×</button></div>' +
      '<div class="form-card waf-dbody"></div></div>';
    var body = d.querySelector('.waf-dbody');
    body.setAttribute('data-wa-form', box.getAttribute('data-wa-form') || '');
    if (box.hasAttribute('data-heading')) body.setAttribute('data-heading', box.getAttribute('data-heading'));
    body.innerHTML = box.innerHTML;
    document.body.appendChild(d);
    box.removeAttribute('data-wa-form'); box.classList.add('waf-launch');
    box.innerHTML = '<h3>' + E(title) + '</h3>' + (note ? '<p class="waf-note">' + E(note) + '</p>' : '') +
      '<button type="button" class="btn waf-open" aria-haspopup="dialog" aria-controls="' + E(d.id) + '">' + E(label) + '</button>';
    var opener = null, downOut = false;
    function open(from) {
      opener = from && from.focus ? from : document.activeElement;
      if (!d.open) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
      document.documentElement.classList.add('waf-locked');
      var pick = from && from.getAttribute ? from.getAttribute('data-pick') : null;
      if (pick) {
        var r = d.querySelector('input[name="position"][value="' + pick.replace(/["\\]/g, '') + '"]'), s = d.querySelector('select[name="position"]');
        if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } else if (s) s.value = pick;
      }
      /* wave237: "Apply for this role" on a Montreal role card (data-role) ticks that role; the others stay as they are */
      var role = from && from.getAttribute ? from.getAttribute('data-role') : null;
      if (role) {
        var c = d.querySelector('input[name="roles"][value="' + role.replace(/["\\]/g, '') + '"]');
        if (c && !c.checked && !c.disabled) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    }
    function close() { if (!d.open) return; if (typeof d.close === 'function') d.close(); else { d.removeAttribute('open'); done(); } }
    function done() {
      document.documentElement.classList.remove('waf-locked');
      if (opener && opener.focus && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    }
    d.addEventListener('close', done);
    d.querySelector('.waf-x').addEventListener('click', close);
    // a click outside the sheet (on the dimmed page) closes it, but not a text selection dragged out of a field
    d.addEventListener('mousedown', function (e) { downOut = e.target === d; });
    d.addEventListener('click', function (e) { if (e.target === d && downOut) close(); downOut = false; });
    box.querySelector('.waf-open').addEventListener('click', function (e) { open(e.currentTarget); });
    POPS[sid] = open; POPS[d.id] = open;
    return body;
  }
  var boxes = document.querySelectorAll('[data-wa-form]');
  var pops = typeof document.createElement('dialog').showModal === 'function' && !!document.querySelector('[data-wa-form][data-wa-popup]');
  if (pops) { var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/assets/forms.css?v=' + CSS_V; document.head.appendChild(css); }
  Array.prototype.forEach.call(boxes, function (box, i) { Form(pops && box.hasAttribute('data-wa-popup') ? Popup(box, i) : box, i); });
  if (pops) {
    var here = function (u) { return u.hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '') && u.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, ''); };
    document.addEventListener('click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
      var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (x) { return; }
      var go = u.hash && here(u) ? POPS[decodeURIComponent(u.hash.slice(1))] : null; if (!go) return;
      e.preventDefault(); go(a);
    });
    var fromHash = function () { var go = POPS[decodeURIComponent((location.hash || '').slice(1))]; if (go) go(); };
    fromHash(); window.addEventListener('hashchange', fromHash);
  }
})();
