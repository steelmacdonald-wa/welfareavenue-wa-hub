/* Welfare Avenue website (wave162, 28/09/26): the Hub's forms inside the website's pages. Each
   <div data-wa-form="slug[,fallback]"> asks the Hub's form-submit function for the published form (drafts are not
   found, so the page keeps its own message until staff put the form live in the CRM), shows the questions in the
   form's language, and posts the answers back with the signed token, the hidden field and the timing checks that
   form-submit expects. Same protocol as the Hub's own page at hub.welfareavenue.com/f/<slug>. */
(function () {
  'use strict';
  var B = document.body, SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var URL_FN = SUPA + '/functions/v1/form-submit';
  var TX = {
    en: { optional: '(optional)', send: 'Send', sending: 'Sending…', fix: 'Please check the answers marked below.', required: 'Please answer this question.', email: 'Please enter a valid email address.',
      phone: 'Please enter a phone number we can reach.', consent: 'Please tick the box to sign up.', rate: 'Too many tries from here. Please wait a few minutes and send again.',
      expired: 'This page was open a long time, so we refreshed the form. Please check your answers and send again.', server: 'Something went wrong on our side. Please try again in a minute.',
      offline: 'We could not reach Welfare Avenue. Check your connection and try again.', nodates: 'No dates are open right now. Send the form and we will reach out when new ones are set.',
      yes: 'Yes', no: 'No', thanks: 'Thank you!', closed: 'This form is closed for now. You can reach us at ', select: 'Choose…',
      privacy: 'We keep your answers in our volunteer and supporter records, use them only to work with you, and never sell or share them.' },
    fr: { optional: '(facultatif)', send: 'Envoyer', sending: 'Envoi…', fix: 'Veuillez vérifier les réponses indiquées ci-dessous.', required: 'Veuillez répondre à cette question.', email: 'Veuillez entrer une adresse courriel valide.',
      phone: 'Veuillez entrer un numéro où vous joindre.', consent: 'Veuillez cocher la case pour vous inscrire.', rate: 'Trop d’essais depuis cet appareil. Veuillez patienter quelques minutes.',
      expired: 'Cette page était ouverte depuis longtemps; nous avons actualisé le formulaire. Vérifiez vos réponses et envoyez de nouveau.', server: 'Un problème est survenu de notre côté. Veuillez réessayer dans une minute.',
      offline: 'Impossible de joindre Welfare Avenue. Vérifiez votre connexion et réessayez.', nodates: 'Aucune date n’est ouverte pour le moment. Envoyez le formulaire et nous vous écrirons dès que de nouvelles dates seront fixées.',
      yes: 'Oui', no: 'Non', thanks: 'Merci!', closed: 'Ce formulaire est fermé pour le moment. Vous pouvez nous écrire à ', select: 'Choisir…',
      privacy: 'Nous conservons vos réponses dans nos dossiers de bénévoles et de sympathisants, nous les utilisons seulement pour travailler avec vous et ne les vendons ni ne les partageons jamais.' }
  };
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function call(method, slug, body) {
    var opt = { method: method, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(URL_FN + (method === 'GET' ? '?slug=' + encodeURIComponent(slug) : ''), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j || {} }; });
    });
  }
  function Form(box, n) {
    var S = { form: null, org: null, token: '', lang: 'en', errors: {}, sending: false, banner: '' };
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
        render(keep);
      }).catch(function () { /* offline: keep the page's message */ });
    }
    function field(q, keep) {
      var id = pfx + q.id, err = S.errors[q.id], v = keep ? keep[q.id] : undefined;
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
      if (q.type === 'long_text') return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<textarea id="' + id + '" name="' + E(q.id) + '"' + aria + ' maxlength="2000">' + E(v || '') + '</textarea>' + e + '</div>';
      var opts = q.type === 'yes_no' ? [{ v: 'yes', l: t('yes') }, { v: 'no', l: t('no') }] : (q.options || []).map(function (o) { return typeof o === 'string' ? { v: o, l: o } : o; });
      var multi = q.type === 'multi' || q.type === 'serving_dates';
      if (q.type === 'serving_dates' && !opts.length) return '<fieldset class="' + cls + '" data-q="' + E(q.id) + '">' + head('legend') + '<p class="none">' + E(t('nodates')) + '</p></fieldset>';
      if (!multi && opts.length > 8) {
        return '<div class="' + cls + '" data-q="' + E(q.id) + '">' + head('label') + '<select id="' + id + '" name="' + E(q.id) + '"' + aria + '><option value="">' + E(t('select')) + '</option>' +
          opts.map(function (o) { return '<option value="' + E(o.v) + '"' + (v === o.v ? ' selected' : '') + '>' + E(o.l) + '</option>'; }).join('') + '</select>' + e + '</div>';
      }
      var picked = multi ? (Array.isArray(v) ? v : []) : v;
      return '<fieldset class="' + cls + '" data-q="' + E(q.id) + '"' + (err ? ' aria-invalid="true"' : '') + (desc ? ' aria-describedby="' + desc + '"' : '') + '>' + head('legend') +
        '<div class="choices' + (opts.length > 3 && opts.every(function (o) { return String(o.l).length < 28; }) ? ' two' : '') + '">' +
        opts.map(function (o, i) {
          var on = multi ? picked.indexOf(o.v) >= 0 : picked === o.v;
          return '<label class="choice"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + E(q.id) + '" value="' + E(o.v) + '"' + (on ? ' checked' : '') + (i === 0 ? ' id="' + id + '"' : '') + '><span>' + E(o.l) + '</span></label>';
        }).join('') + '</div>' + e + '</fieldset>';
    }
    function render(keep) {
      var f = S.form, c = f.consent || {}, cerr = S.errors._consent, heading = box.getAttribute('data-heading');
      box.innerHTML = '<form novalidate lang="' + S.lang + '">' + (heading !== 'none' ? '<h3>' + E(f.title) + '</h3>' + (f.intro ? '<p class="waf-intro">' + E(f.intro) + '</p>' : '') : '') +
        (S.banner ? '<div class="waf-banner ' + (Object.keys(S.errors).length ? 'warn' : 'info') + '" role="alert">' + E(S.banner) + '</div>' : '') +
        f.questions.map(function (q) { return field(q, keep); }).join('') +
        (c.ask ? '<div class="q consent' + (cerr ? ' bad' : '') + '" data-q="_consent"><label class="choice"><input type="checkbox" id="' + pfx + '_consent" name="_consent"' + (keep && keep._consent ? ' checked' : '') + (cerr ? ' aria-invalid="true" aria-describedby="' + pfx + '_consent_e"' : '') + '><span>' + E(c.label) + (c.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</span></label>' +
          (cerr ? '<p class="err" id="' + pfx + '_consent_e">' + E(cerr) + '</p>' : '') + '<p class="small">' + E((S.org && S.org.address) || 'Welfare Avenue') + ' · ' + E((S.org && S.org.email) || '') + '</p></div>' : '') +
        '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<button type="submit" class="btn waf-send"' + (S.sending ? ' disabled' : '') + '>' + E(S.sending ? t('sending') : t('send')) + '</button>' +
        '<p class="waf-privacy">' + E(t('privacy')) + '</p></form>';
      box.querySelector('form').addEventListener('submit', submit);
    }
    function collect() {
      var form = box.querySelector('form'), out = {};
      S.form.questions.forEach(function (q) {
        if (q.type === 'multi' || q.type === 'serving_dates') out[q.id] = Array.prototype.map.call(form.querySelectorAll('input[name="' + q.id + '"]:checked'), function (i) { return i.value; });
        else if (q.type === 'choice' || q.type === 'yes_no') { var sel = form.querySelector('select[name="' + q.id + '"]'); var r = form.querySelector('input[name="' + q.id + '"]:checked'); out[q.id] = sel ? sel.value : (r ? r.value : ''); }
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
        if (q.type === 'phone' && String(v).replace(/\D/g, '').length < 7) errs[q.id] = t('phone');
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
      S.sending = true; S.banner = ''; render(a);
      call('POST', S.form.slug, { slug: S.form.slug, token: S.token, answers: answers, consent: a._consent, hp: a._hp, lang: S.lang }).then(function (r) {
        S.sending = false;
        if (r.status === 200 && r.body.ok) { thanks(r.body.thank_you || S.form.thank_you); return; }
        if (r.status === 400 && r.body.error === 'invalid') { S.errors = r.body.fields || {}; S.banner = t('fix'); render(a); focusFirst(); return; }
        if (r.status === 400 && r.body.error === 'expired') { S.errors = {}; load(slugs.indexOf(S.form.slug), a); return; }
        if (r.status === 404 || r.status === 410) { box.innerHTML = fallback; return; }
        S.banner = r.status === 429 ? t('rate') : t('server'); S.errors = {}; render(a);
      }).catch(function () { S.sending = false; S.banner = t('offline'); render(a); });
    }
    function thanks(msg) {
      box.innerHTML = '<div class="waf-done" role="status" tabindex="-1"><h3>' + E(t('thanks')) + '</h3><p class="mb0">' + E(msg) + '</p></div>';
      var d = box.querySelector('.waf-done'); try { d.focus(); d.scrollIntoView({ block: 'center' }); } catch (e) { /* fine */ }
    }
    if (SUPA && KEY && window.fetch && slugs.length) load(0);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-wa-form]'), function (box, i) { Form(box, i); });
})();
