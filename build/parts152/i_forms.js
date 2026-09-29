  /* ======================= Forms (wave156, 28/09/26) =======================
     The CRM's own forms, so new volunteers and subscribers land in the Hub directly (Keela has no API or webhooks).
     Steel, 28/09/26: the forms live at hub.welfareavenue.com/f/<slug>; the volunteer applications and the newsletter
     sign-up come first; the Toronto form's birth date and health questions are replaced; built-in spam checks.
     A form is a list of questions, each saved to a place in the CRM (the contact's name, email, phone, city or language,
     their volunteer roles, a sign-up for each serving date they pick, a custom field, or the timeline note), plus the
     email permission question whose words are kept with a ticked box. Staff with the CRM build, preview, put live and
     close forms, and read every answer with what the Hub did with it. The public page and form-submit do the rest. */
  P.form = '<path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>';
  P.up = '<path d="m6 14 6-6 6 6"/>'; P.down = '<path d="m6 10 6 6 6-6"/>'; P.eye = '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>';
  SOURCES.hub_form = ['Hub forms', 'People who filled in a form on hub.welfareavenue.com/f/.'];
  var FORM_HOST = 'https://hub.welfareavenue.com/f/';
  var CONSENT_DEFAULT = 'Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.';
  var FM = { fid: null, f: null, sub: '', msg: '', err: '', busy: '', confirm: '', subs: null, subsFor: null, showSpam: false, showTests: false, openSub: null, counts: null };
  LOADERS.forms = function () { return db.from('crm_forms').select('*').order('created_at', { ascending: true }); };
  LOADERS.fstats = function () { return db.from('crm_form_stats_v').select('*'); };
  LOADERS.cfields = function () { return db.from('crm_fields').select('*').order('sort', { ascending: true }).order('id', { ascending: true }); };
  LOADERS.fevents = function () { return db.from('volunteer_events').select('id,event_date,status,kind,location,title').eq('status', 'planned').gte('event_date', today()).order('event_date', { ascending: true }).limit(24); };
  var FKIND = { volunteer: ['Volunteer application', TEAL], newsletter: ['Newsletter sign-up', PURPLE], general: ['General', MUTED] };
  /* wave168: every form's page opens with a photo from the Photo library behind the logo and the title (crm_forms.cover_photo_id;
     none uses the kind's default, as form-submit does) */
  var COVER_KIND = { volunteer: 9, newsletter: 3, general: 26 };
  var PSTORE = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
  var LOCKUP_IMG = PSTORE + 'brand/logo-lockup-cream-600.png';
  var EYEBROW = { en: { volunteer: 'Volunteer with us', newsletter: 'Stay in touch', general: 'Welfare Avenue' }, fr: { volunteer: 'Bénévolat', newsletter: 'Restez au courant', general: 'Welfare Avenue' } };
  function photoById(id) { return (S.wphotos || []).filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function coverOf(f) { return (f && f.cover_photo_id ? photoById(f.cover_photo_id) : null) || photoById(COVER_KIND[f && f.kind] || 26); }
  function loadPhotos168() {
    if (S.wphotos || S.wphotosBusy) return;
    S.wphotosBusy = true;
    Promise.resolve(db.from('wa_photos').select('id,key,title,alt_text,path_web,path_thumb,focal_x,focal_y,orientation,usage,scene,is_pick,taken_on').eq('usage', 'ready')).then(function (r) {
      var rows = ((r && r.data) || []).filter(function (p) { return p.path_web && p.orientation !== 'portrait'; });
      rows.sort(function (a, b) { return (b.is_pick ? 1 : 0) - (a.is_pick ? 1 : 0) || String(b.taken_on || '').localeCompare(String(a.taken_on || '')); });
      S.wphotos = rows; S.wphotosBusy = false; if (FM.f) paint();
    }).catch(function () { S.wphotos = []; S.wphotosBusy = false; });
  }
  function coverPickHtml(f) {
    loadPhotos168();
    var cur = f.cover_photo_id ? photoById(f.cover_photo_id) : null, shown = coverOf(f);
    var h = '<h4 class="w156h4">Cover photo</h4><div class="w156box w168cov">';
    if (shown) h += '<div class="w168now"><span class="im" style="background-image:url(\'' + E(PSTORE + (shown.path_thumb || shown.path_web)) + '\')"></span><div><b>' + E(shown.title || '') + '</b><span class="m">' + (cur ? 'Chosen for this form' : 'The default for ' + (f.kind === 'volunteer' ? 'a volunteer' : f.kind === 'newsletter' ? 'a newsletter' : 'a general') + ' form') + '</span>'
      + (cur ? '<button class="w152btn ghost" data-w168cov="">Use the default</button>' : '') + '</div></div>';
    if (!S.wphotos) return h + '<p class="m">Loading the Photo library…</p></div>';
    return h + '<div class="w168grid" role="list">' + S.wphotos.map(function (p) {
      return '<button type="button" role="listitem" class="w168th' + (shown && p.id === shown.id ? ' on' : '') + '" data-w168cov="' + E(p.id) + '" title="' + E(p.title || '') + '" aria-label="' + E('Use ' + (p.title || 'this photo')) + '" style="background-image:url(\'' + E(PSTORE + (p.path_thumb || p.path_web)) + '\')"></button>';
    }).join('') + '</div><p class="m">From the Photo library, the photos ready to use. It sits behind the logo and the title at the top of the page.</p></div>';
  }
  var FSTAT = { draft: ['Draft', MUTED], published: ['Live', GREEN], closed: ['Closed', FLAG] };
  var SUBST = { processed: ['In the CRM', GREEN], received: ['Received', '#B9851B'], error: ['Needs a look', FLAG], spam: ['Spam', MUTED], test: ['Test', PURPLE] };
  var QTYPES = [['text', 'Short answer'], ['long_text', 'Long answer'], ['email', 'Email'], ['phone', 'Phone'], ['choice', 'One choice'], ['multi', 'Several choices'], ['yes_no', 'Yes or no'], ['date', 'Date'], ['number', 'Number'], ['serving_dates', 'Serving dates (MTL volunteering)']];
  var FTYPE_OF = { text: 'text', long_text: 'long_text', email: 'text', phone: 'text', choice: 'choice', multi: 'multi', yes_no: 'yes_no', date: 'date', number: 'number' };
  var FTYPE_NAME = { text: 'Short answer', long_text: 'Long answer', number: 'Number', date: 'Date', choice: 'One choice', multi: 'Several choices', yes_no: 'Yes or no' };
  var CONTACT_TO = { 'contact.first_name': 'First name', 'contact.last_name': 'Last name', 'contact.email': 'Email', 'contact.phone': 'Phone', 'contact.city': 'City', 'contact.province': 'Province', 'contact.postal_code': 'Postal code', 'contact.address': 'Address', 'contact.language': 'Language (en or fr)' };
  var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDay(d) { var p = String(d || '').split('-').map(Number); if (p.length < 3) return String(d || ''); var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); return DAYL[dt.getUTCDay()] + ' ' + p[2] + ' ' + MONL[p[1] - 1] + ' ' + p[0]; }
  function formById(id) { return (S.forms || []).filter(function (f) { return String(f.id) === String(id); })[0] || null; }
  function fstat(id) { return (S.fstats || []).filter(function (x) { return String(x.form_id) === String(id); })[0] || {}; }
  function fieldByKey(k) { return (S.cfields || []).filter(function (f) { return f.key === k; })[0] || null; }
  function slugify(s, sep) { var x = fold(s).replace(/[^a-z0-9]+/g, sep || '-').replace(new RegExp('^\\' + (sep || '-') + '+|\\' + (sep || '-') + '+$', 'g'), ''); return x.slice(0, 40) || 'q'; }
  function optsOf(q) { return (Array.isArray(q.options) ? q.options : []).map(function (o) { return typeof o === 'string' ? { v: o, l: o } : { v: String(o.v != null ? o.v : o.value || ''), l: String(o.l != null ? o.l : o.label || o.v || '') }; }).filter(function (o) { return o.v !== ''; }); }
  function optsText(q) { return optsOf(q).map(function (o) { return o.v === o.l ? o.l : o.v + ' | ' + o.l; }).join('\n'); }
  function parseOpts(text) {
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var i = l.indexOf('|'); if (i < 0) return l;
      var v = l.slice(0, i).trim(), lab = l.slice(i + 1).trim(); return v && lab && v !== lab ? { v: v, l: lab } : (lab || v);
    });
  }
  function valueText(v, type) {
    if (v == null) return '';
    if (type === 'yes_no' || typeof v === 'boolean') return v === true || v === 'yes' ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  }
  function toLabel(to) {
    if (!to) return 'Kept with the answer only';
    if (CONTACT_TO[to]) return 'Their ' + CONTACT_TO[to].toLowerCase().replace(' (en or fr)', '');
    if (to === 'volunteer.roles') return 'Their volunteer roles';
    if (to === 'volunteer.dates') return 'A sign-up for each date (to confirm)';
    if (to === 'note') return 'The note on their timeline';
    if (/^field:/.test(to)) { var f = fieldByKey(to.slice(6)); return 'Field: ' + (f ? f.label : to.slice(6)); }
    return to;
  }
  /* where a question of this type can be saved */
  function toChoices(q, kind) {
    var t = q.type, out = [['', 'Kept with the answer only']];
    var add = function (k) { out.push([k, toLabel(k)]); };
    if (t === 'email') add('contact.email');
    if (t === 'phone') add('contact.phone');
    if (t === 'text') ['contact.first_name', 'contact.last_name', 'contact.city', 'contact.province', 'contact.postal_code', 'contact.address', 'note'].forEach(add);
    if (t === 'long_text') ['note', 'contact.address'].forEach(add);
    if (t === 'choice') add('contact.language');
    if (t === 'multi' && kind === 'volunteer') add('volunteer.roles');
    if (t === 'serving_dates') add('volunteer.dates');
    var ft = FTYPE_OF[t];
    if (ft) (S.cfields || []).filter(function (f) { return !f.archived_at && f.type === ft; }).forEach(function (f) { add('field:' + f.key); });
    if (ft) out.push(['__new', 'A new field on the contact, named after the question']);
    if (q.to && !out.some(function (o) { return o[0] === q.to; })) out.push([q.to, toLabel(q.to)]);
    return out;
  }

  /* ---------- the list ---------- */
  function formRow(f) {
    var st = fstat(f.id), live = f.status === 'published', addr = 'hub.welfareavenue.com/f/' + f.slug;
    return '<div class="w156row" role="listitem"><div class="w156nm"><button class="w155cn" data-w156open="' + E(f.id) + '"><b>' + E(f.title) + '</b></button>' +
      '<span class="m">' + E((FKIND[f.kind] || FKIND.general)[0]) + '</span><span class="m w156lk">' + (live || f.status === 'closed' ? '<a href="' + E(FORM_HOST + f.slug) + '" target="_blank" rel="noopener">' + E(addr) + '</a>' : E(addr)) + '</span></div>' +
      '<div>' + lchip(FSTAT, f.status) + '</div>' +
      '<div class="w156meta">' + plural(Number(st.submissions) || 0, 'answer', 'answers') + (Number(st.last_7_days) ? '<span class="m"> · ' + Number(st.last_7_days) + ' this week</span>' : '') + (Number(st.errors) ? '<span class="w156warn"> · ' + plural(Number(st.errors), 'needs a look', 'need a look') + '</span>' : '') + '</div>' +
      '<div class="w155ra"><button class="w152btn sm ghost" data-w156open="' + E(f.id) + '">' + I('edit') + ' Open</button><button class="w152btn sm ghost" data-w156answers="' + E(f.id) + '">' + I('list') + ' Answers</button>' +
      (live ? '<button class="w152btn sm ghost" data-w152copy="' + E(FORM_HOST + f.slug) + '">' + I('copy') + ' Copy the link</button>' : '') + '</div></div>';
  }
  function fieldsCard() {
    var fs = S.cfields || [], used = {};
    (S.forms || []).forEach(function (f) { (f.questions || []).forEach(function (q) { if (/^field:/.test(q.to || '')) (used[q.to.slice(6)] = used[q.to.slice(6)] || []).push(f.title); }); });
    return '<div class="w154card"><h3>' + I('tag') + ' Custom fields <span class="w155sub">' + plural(fs.filter(function (f) { return !f.archived_at; }).length, 'field', 'fields') + '</span></h3>' +
      '<p class="m">What a contact has that the CRM has no column for. A form question saves into one; so did Keela. They show on a contact’s page under More about them.</p>' +
      (fs.length ? '<div class="w156fl">' + fs.map(function (f) {
        var n = FM.counts ? (FM.counts[String(f.id)] || 0) : null;
        return '<div class="w156fr' + (f.archived_at ? ' arch' : '') + '"><span><b>' + E(f.label) + '</b><span class="m"> · ' + E(FTYPE_NAME[f.type] || f.type) + (used[f.key] ? ' · in ' + E(listJoin(uniq(used[f.key]))) : '') + '</span></span>' +
          '<span class="m">' + (n == null ? '' : plural(n, 'contact', 'contacts')) + '</span><button class="w152mini" data-w156arch="' + E(f.id) + '">' + (f.archived_at ? 'Bring back' : 'Archive') + '</button></div>';
      }).join('') + '</div>' : '<p class="m">No custom field yet.</p>') + '</div>';
  }
  function formsListHtml() {
    var fs = S.forms || [];
    return '<div class="w155grid"><div class="w154card"><h3>' + I('form') + ' Forms <span class="w155sub">' + plural(fs.length, 'form', 'forms') + '</span></h3>' +
      '<p class="m">A form at hub.welfareavenue.com/f/ writes straight into the CRM: the person, their volunteer record and the dates they pick, their answers, and their email permission with the words they agreed to. Drafts are only seen here.</p>' +
      (FM.msg ? '<div class="w154msg">' + E(FM.msg) + '</div>' : '') + (FM.err ? '<div class="w152err">' + E(FM.err) + '</div>' : '') +
      '<div class="w154acts"><button class="w152btn" data-w156new="1">' + I('plus') + ' New form</button></div>' +
      (fs.length ? '<div class="w155rows" role="list">' + fs.map(formRow).join('') + '</div>' : '<p class="m">No form yet.</p>') + '</div>' + fieldsCard() + '</div>';
  }

  /* ---------- the editor ---------- */
  function editCopy(f) {
    var c = JSON.parse(JSON.stringify(f));
    c.questions = (c.questions || []).map(function (q) { q._opts = optsText(q); return q; });
    c.consent = c.consent || {}; c.settings = c.settings || {};
    c._tags = (c.settings.tags || []).join(', ');
    return c;
  }
  function qHtml(q, i, n, kind) {
    var hasOpts = q.type === 'choice' || q.type === 'multi';
    var types = QTYPES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === q.type ? ' selected' : '') + '>' + E(t[1]) + '</option>'; }).join('');
    var tos = toChoices(q, kind).map(function (o) { return '<option value="' + E(o[0]) + '"' + (o[0] === (q.to || '') ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('');
    return '<div class="w156q" data-w156qi="' + i + '"><div class="w156qh"><b>' + (i + 1) + '</b>' +
      '<select class="w152sel" data-w156qk="type" aria-label="Kind of answer">' + types + '</select>' +
      '<label class="w156ck"><input type="checkbox" data-w156qk="required"' + (q.required ? ' checked' : '') + '> Required</label><span class="w156sp"></span>' +
      '<button class="w152mini" data-w156qmv="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + I('up') + '</button><button class="w152mini" data-w156qmv="1" aria-label="Move down"' + (i < n - 1 ? '' : ' disabled') + '>' + I('down') + '</button>' +
      '<button class="w152mini" data-w156qdel="1" aria-label="Remove the question">' + I('trash') + '</button></div>' +
      '<input class="w152in" data-w156qk="label" value="' + E(q.label) + '" placeholder="The question, as people will read it" aria-label="The question">' +
      '<input class="w152in" data-w156qk="help" value="' + E(q.help || '') + '" placeholder="A line of help under it (optional)" aria-label="Help">' +
      (hasOpts ? '<textarea class="w152in" data-w156qk="_opts" rows="4" placeholder="One choice per line. To save a code instead of the words: code | words" aria-label="Choices">' + E(q._opts || '') + '</textarea>' : '') +
      (q.type === 'serving_dates' ? '<p class="m">People see the planned servings of MTL volunteering from today on; each date they tick becomes a sign-up on that event’s roster, to be confirmed by the team.</p>' : '') +
      '<label class="w155lb">Saves to<select class="w152sel" data-w156qk="to">' + tos + '</select></label></div>';
  }
  function editorHtml156() {
    var f = FM.f, live = f.status === 'published', closed = f.status === 'closed', st = fstat(f.id);
    var kinds = Object.keys(FKIND).map(function (k) { return '<option value="' + k + '"' + (k === f.kind ? ' selected' : '') + '>' + E(FKIND[k][0]) + '</option>'; }).join('');
    var inp = function (k, label, ph, area, extra) { return '<label class="w155lb">' + E(label) + (area ? '<textarea class="w152in" data-w156k="' + k + '" rows="3" placeholder="' + E(ph || '') + '">' + E(f[k] || '') + '</textarea>' : '<input class="w152in" data-w156k="' + k + '" value="' + E(f[k] || '') + '" placeholder="' + E(ph || '') + '"' + (extra || '') + '>') + '</label>'; };
    var vol = f.kind === 'volunteer';
    return '<div class="w154card"><h3>' + I('form') + ' ' + E(f.id ? 'Edit the form' : 'New form') + ' ' + lchip(FSTAT, f.status) + '</h3>' +
      (FM.err ? '<div class="w152err">' + E(FM.err) + '</div>' : '') + (FM.msg ? '<div class="w154msg">' + E(FM.msg) + '</div>' : '') + (FM.busy ? '<div class="m">' + E(FM.busy) + '</div>' : '') +
      inp('title', 'Title', 'Volunteer with Welfare Avenue') +
      '<label class="w155lb">Web address<span class="w156url">hub.welfareavenue.com/f/<input class="w152in" data-w156k="slug" value="' + E(f.slug) + '"' + (live ? ' disabled title="Live forms keep their address; close the form to change it"' : '') + ' aria-label="The last part of the web address"></span></label>' +
      '<div class="w155two"><label class="w155lb">Kind<select class="w152sel" data-w156k="kind">' + kinds + '</select></label>' +
      '<label class="w155lb">Language<select class="w152sel" data-w156k="lang"><option value="en"' + (f.lang === 'en' ? ' selected' : '') + '>English</option><option value="fr"' + (f.lang === 'fr' ? ' selected' : '') + '>French</option></select></label></div>' +
      inp('intro', 'What it is for (under the title)', 'A sentence or two', true) + coverPickHtml(f) +
      (vol ? '<div class="w156box"><label class="w156ck"><input type="checkbox" data-w156set="volunteer_record"' + (f.settings.volunteer_record ? ' checked' : '') + '> Add them to MTL volunteering (a volunteer record to review, and sign-ups for the dates they pick)</label>' +
        '<div class="w155two"><label class="w155lb">City written on new contacts<input class="w152in" data-w156set="city" value="' + E(f.settings.city || '') + '" placeholder="Montreal"></label>' +
        '<label class="w155lb">Tags to add<input class="w152in" data-w156k="_tags" value="' + E(f._tags || '') + '" placeholder="toronto"></label></div></div>' :
        '<label class="w155lb">Tags to add<input class="w152in" data-w156k="_tags" value="' + E(f._tags || '') + '" placeholder="newsletter"></label>') +
      '<h4 class="w156h4">Questions</h4>' + f.questions.map(function (q, i) { return qHtml(q, i, f.questions.length, f.kind); }).join('') +
      '<div class="w154acts"><button class="w152btn ghost" data-w156qadd="text">' + I('plus') + ' Add a question</button></div>' +
      '<h4 class="w156h4">Email permission</h4><div class="w156box"><label class="w156ck"><input type="checkbox" data-w156c="ask"' + (f.consent.ask ? ' checked' : '') + '> Ask for permission to email them (a box they tick themselves)</label>' +
      (f.consent.ask ? '<label class="w156ck"><input type="checkbox" data-w156c="required"' + (f.consent.required ? ' checked' : '') + '> They must tick it to send the form (a newsletter sign-up)</label>' +
        '<label class="w155lb">The words next to the box<textarea class="w152in" data-w156c="label" rows="2">' + E(f.consent.label || '') + '</textarea></label><p class="m">A ticked box records express consent with these words and the date (CASL). The page shows Welfare Avenue’s address and email beside it.</p>' : '') + '</div>' +
      inp('thank_you', 'Thank-you message (after they send it)', 'Thank you. We have your answers.', true) +
      '<div class="w154acts"><button class="w152btn" data-w156save="1">' + I('check') + ' Save</button>' +
      (f.id && !live ? '<button class="w152btn ghost" data-w156pub="1">' + I('send') + ' Put it live…</button>' : '') +
      (live ? '<button class="w152btn ghost" data-w152copy="' + E(FORM_HOST + f.slug) + '">' + I('copy') + ' Copy the link</button><a class="w152btn ghost" href="' + E(FORM_HOST + f.slug) + '" target="_blank" rel="noopener">' + I('ext') + ' Open the live page</a><button class="w152btn ghost" data-w156close="1">Stop taking answers…</button>' : '') +
      (f.id ? '<button class="w152btn ghost" data-w156answers="' + E(f.id) + '">' + I('list') + ' Answers (' + (Number(st.submissions) || 0) + ')</button>' : '') +
      '<button class="w152btn ghost" data-w156back="1">Back to the forms</button>' +
      (f.id && f.status === 'draft' && !Number(st.submissions) ? '<button class="w152btn ghost" data-w156del="1">' + I('trash') + ' Delete the draft</button>' : '') + '</div>' + confirmHtml(f) + '</div>';
  }
  function confirmHtml(f) {
    if (FM.confirm === 'publish') return '<div class="w155cf"><b>Put “' + E(f.title) + '” live?</b> Anyone with the link can fill it in at ' + E('hub.welfareavenue.com/f/' + f.slug) + ', and each answer goes straight into the CRM.' +
      '<div class="w154acts"><button class="w152btn" data-w156pubok="1">' + I('send') + ' Put it live</button><button class="w152btn ghost" data-w156no="1">Not yet</button></div></div>';
    if (FM.confirm === 'close') return '<div class="w155cf test"><b>Stop taking answers?</b> The page will say the form is closed. You can put it live again later.<div class="w154acts"><button class="w152btn" data-w156closeok="1">Close the form</button><button class="w152btn ghost" data-w156no="1">Keep it open</button></div></div>';
    if (FM.confirm === 'delete') return '<div class="w155cf test"><b>Delete this draft?</b> It has no answers.<div class="w154acts"><button class="w152btn" data-w156delok="1">' + I('trash') + ' Delete it</button><button class="w152btn ghost" data-w156no="1">Keep it</button></div></div>';
    return '';
  }
  /* ---------- the preview: the questions as people will see them ---------- */
  function bandHtml168(f) {
    var c = coverOf(f), ey = (EYEBROW[f.lang] || EYEBROW.en)[f.kind] || 'Welfare Avenue';
    var bg = c ? ' style="background-image:url(\'' + E(PSTORE + c.path_web) + '\');background-position:' + Math.round(100 * (c.focal_x == null ? 0.5 : c.focal_x)) + '% ' + Math.round(100 * (c.focal_y == null ? 0.5 : c.focal_y)) + '%"' : '';
    return '<div class="w156sheet"><div class="w156band"' + bg + '><div class="w168top"><img src="' + LOCKUP_IMG + '" alt="Welfare Avenue"><img class="w168star" src="' + PSTORE + 'brand/doodle-star-gold.png" alt=""></div>'
      + '<div class="w168ey">' + E(ey) + '</div><div class="w156t">' + E(f.title || 'Untitled form') + '</div></div>';
  }
  function previewHtml156() {
    var f = FM.f, evs = S.fevents || [];
    var one = function (q) {
      var head = '<div class="w156pl">' + E(q.label || 'Question') + (q.required ? '<span class="w156req">*</span>' : ' <span class="m">(optional)</span>') + '</div>' + (q.help ? '<div class="m">' + E(q.help) + '</div>' : '');
      if (q.type === 'long_text') return head + '<textarea class="w152in" disabled rows="2"></textarea>';
      if (q.type === 'yes_no') return head + '<div class="w156pc"><span class="w156pr">Yes</span><span class="w156pr">No</span></div>';
      if (q.type === 'choice' || q.type === 'multi') { var os = optsOf({ options: parseOpts(q._opts) }); return head + '<div class="w156pc">' + (os.length ? os.map(function (o) { return '<span class="' + (q.type === 'multi' ? 'w156pb' : 'w156pr') + '">' + E(o.l) + '</span>'; }).join('') : '<span class="m">No choices yet</span>') + '</div>'; }
      if (q.type === 'serving_dates') {
        var loc = (f.settings && f.settings.serving_location) || 'Montreal';
        var open = evs.filter(function (e) { return lower(e.kind) === 'service' && String(e.location || '') === loc; }).slice(0, 12);
        return head + '<div class="w156pc">' + (open.length ? open.map(function (e) { return '<span class="w156pb">' + E(longDay(e.event_date)) + '</span>'; }).join('') : '<span class="m">No planned serving from today on: the page says new dates are coming.</span>') + '</div>';
      }
      return head + '<input class="w152in" disabled>';
    };
    return '<div class="w154card w156pv"><h3>' + I('eye') + ' Preview</h3>' + (f.status !== 'published' ? '<p class="m">Not live yet: only the team sees this form.</p>' : '<p class="m">Live at <a href="' + E(FORM_HOST + f.slug) + '" target="_blank" rel="noopener">hub.welfareavenue.com/f/' + E(f.slug) + '</a>.</p>') +
      bandHtml168(f) + '<div class="w156page"><i class="w156rule"></i>' + (f.intro ? '<p>' + E(f.intro) + '</p>' : '') +
      f.questions.map(function (q) { return '<div class="w156pq">' + one(q) + '</div>'; }).join('') +
      (f.consent && f.consent.ask ? '<div class="w156pq w156pcons"><span class="w156pb">' + E(f.consent.label || CONSENT_DEFAULT) + (f.consent.required ? '<span class="w156req">*</span>' : '') + '</span></div>' : '') +
      '<span class="w156send">' + (f.lang === 'fr' ? 'Envoyer' : 'Send') + '</span></div></div></div>';
  }

  /* ---------- the answers ---------- */
  function subsHtml(f) {
    var all = FM.subsFor === String(f.id) ? FM.subs : null;
    if (!all) return '<div class="w154card wide">' + busy('Loading the answers…') + '</div>';
    var spam = all.filter(function (s) { return s.status === 'spam'; }).length, tests = all.filter(function (s) { return s.is_test; }).length;
    var rows = all.filter(function (s) { return (FM.showSpam || s.status !== 'spam') && (FM.showTests || !s.is_test); });
    var nameOf = function (s) {
      var c = s.contact_id ? contact(s.contact_id) : null; if (c) return E(c.full_name);
      var d = s.display || [], em = d.filter(function (x) { return /mail/i.test(x.label || ''); })[0];
      return E((em && em.value) || (s.status === 'spam' ? 'A bot, most likely' : '(no name)'));
    };
    var did = function (s) {
      var r = s.result || {}, bits = [];
      if (r.created) bits.push('a new contact'); else if (r.contact_id) bits.push('added to an existing contact');
      if (r.volunteer_created) bits.push('a new volunteer record to review'); else if (r.volunteer_id) bits.push('their volunteer record updated');
      var ro = (r.roster || []).filter(function (x) { return !x.already; }); if (ro.length) bits.push('signed up for ' + ro.map(function (x) { return fmtDay(x.date); }).join(', '));
      if (r.consent) bits.push('email permission recorded');
      return bits.length ? 'The Hub: ' + bits.join('; ') + '.' : '';
    };
    return '<div class="w154card wide"><h3>' + I('list') + ' Answers to “' + E(f.title) + '” <span class="w155sub">' + plural(rows.length, 'answer', 'answers') + '</span></h3>' +
      '<div class="w154acts">' + (spam ? '<button class="w152btn sm ghost" data-w156spam="1">' + (FM.showSpam ? 'Hide' : 'Show') + ' spam (' + spam + ')</button>' : '') +
      (tests ? '<button class="w152btn sm ghost" data-w156tests="1">' + (FM.showTests ? 'Hide' : 'Show') + ' tests (' + tests + ')</button>' : '') +
      '<button class="w152btn sm ghost" data-w156open="' + E(f.id) + '">' + I('edit') + ' Edit the form</button><button class="w152btn sm ghost" data-w156back="1">Back to the forms</button></div>' +
      (rows.length ? '<div class="w156subs">' + rows.map(function (s) {
        var open = FM.openSub === String(s.id);
        return '<div class="w156sub"><button class="w156sh" data-w156sub="' + E(s.id) + '" aria-expanded="' + open + '"><span>' + E(fmtDay(s.created_at)) + '</span><span class="w156who">' + nameOf(s) + '</span><span>' + lchip(SUBST, s.is_test ? 'test' : s.status) + '</span></button>' +
          (open ? '<div class="w156sd">' + (s.display || []).map(function (x) { return '<div class="w154kv"><span>' + E(x.label) + '</span><span>' + E(x.value) + '</span></div>'; }).join('') +
            (s.error ? '<div class="w152err">' + E(s.status === 'spam' ? 'Held as spam: ' + s.error : 'What went wrong: ' + s.error) + '</div>' : '') + (did(s) ? '<p class="m">' + E(did(s)) + '</p>' : '') +
            (s.contact_id && contact(s.contact_id) ? '<button class="w152btn sm ghost" data-w152open="' + E(s.contact_id) + '">' + I('people') + ' Open their page</button>' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="m">No answer yet.</p>') + '</div>';
  }
  function loadSubs(id) {
    FM.subsFor = String(id); FM.subs = null;
    return Promise.resolve(db.from('crm_form_submissions').select('id,status,display,consent,result,error,created_at,contact_id,is_test').eq('form_id', Number(id)).order('created_at', { ascending: false }).limit(500))
      .then(function (r) { if (FM.subsFor === String(id)) { FM.subs = (r && r.data) || []; if (S.ui.tab === 'forms') paint(); } });
  }
  function loadFieldCounts() {
    return pageAll(function (a, b) { return db.from('crm_contact_fields').select('contact_id,field_id').order('field_id', { ascending: true }).order('contact_id', { ascending: true }).range(a, b); }, function (r) { return r.contact_id + ':' + r.field_id; })
      .then(function (res) { var m = {}; ((res && res.data) || []).forEach(function (r) { m[String(r.field_id)] = (m[String(r.field_id)] || 0) + 1; }); FM.counts = m; if (S.ui.tab === 'forms') paint(); });
  }

  function paintForms(root) {
    var need = [];
    if (!S.forms) need.push(load('forms')); if (!S.fstats) need.push(load('fstats')); if (!S.cfields) need.push(load('cfields')); if (!S.fevents) need.push(load('fevents'));
    if (need.length) { root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + busy('Loading the forms…'); Promise.all(need).then(function () { if (S.ui.tab === 'forms') paint(); }); return; }
    if (!FM.counts) { FM.counts = {}; loadFieldCounts(); }
    var html = statsHtml(S.contacts || []) + tabsHtml();
    if (FM.fid && !FM.f) { var k = formById(FM.fid); if (k) FM.f = editCopy(k); }
    if (FM.fid && FM.sub === 'answers') {
      var fa = formById(FM.fid);
      if (!fa) { root.innerHTML = html + '<div class="w152empty">That form is not in the CRM.</div>'; return; }
      if (FM.subsFor !== String(fa.id)) loadSubs(fa.id);
      root.innerHTML = html + '<div class="w155grid">' + subsHtml(fa) + '</div>'; return;
    }
    if (FM.fid && !FM.f) { root.innerHTML = html + '<div class="w152empty">That form is not in the CRM. <button class="w152mini" data-w156back="1">Back to the forms</button></div>'; return; }
    root.innerHTML = html + (FM.f ? '<div class="w155grid">' + editorHtml156() + previewHtml156() + '</div>' : formsListHtml());
  }
  function openForms(parts) {
    var id = parts[2] || null, sub = parts[3] || '';
    if (id !== FM.fid) { FM.f = null; FM.confirm = ''; FM.err = ''; FM.openSub = null; if (id) FM.msg = ''; }
    FM.fid = id; FM.sub = sub;
  }

  /* ---------- saving ---------- */
  function cleanQuestions(qs) {
    var seen = {};
    return qs.map(function (q) {
      var id = String(q.id || '').trim() || slugify(q.label, '_');
      id = id.replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 40) || 'q';
      var base = id, n = 2; while (seen[id]) { id = base + '_' + n; n++; } seen[id] = 1;
      var out = { id: id, type: q.type, label: String(q.label || '').trim(), required: !!q.required, to: q.to || '' };
      if (String(q.help || '').trim()) out.help = String(q.help).trim();
      if (q.type === 'choice' || q.type === 'multi') out.options = parseOpts(q._opts);
      if (!out.to) delete out.to;
      return out;
    });
  }
  function newFields(f) {
    /* a question saved to "a new field": create it (key from the question), then point the question at it */
    var jobs = [], keys = {}; (S.cfields || []).forEach(function (x) { keys[x.key] = 1; });
    f.questions.forEach(function (q) {
      if (q.to !== '__new') return;
      var ft = FTYPE_OF[q.type]; if (!ft) { q.to = ''; return; }
      var key = slugify(q.label, '_').replace(/^[^a-z]+/, '').slice(0, 36) || 'field'; if (!/^[a-z]/.test(key)) key = 'f_' + key;
      var base = key, n = 2; while (keys[key]) { key = base + '_' + n; n++; } keys[key] = 1;
      var row = { key: key, label: String(q.label || key).trim().slice(0, 120), type: ft, options: (ft === 'choice' || ft === 'multi') ? parseOpts(q._opts) : [], created_by: actor(), updated_by: actor(), help: 'Made from the form “' + (f.title || '') + '”.' };
      jobs.push(Promise.resolve(db.from('crm_fields').insert(row).select().single()).then(function (r) {
        if (r && r.error) throw new Error('The field “' + row.label + '” could not be made: ' + (r.error.message || r.error));
        q.to = 'field:' + key;
      }));
    });
    return Promise.all(jobs);
  }
  function saveForm() {
    var f = FM.f; if (!f) return Promise.resolve(null);
    FM.err = '';
    if (!String(f.title || '').trim()) { FM.err = 'Give the form a title.'; paint(); return Promise.resolve(null); }
    f.slug = String(f.slug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(f.slug)) { FM.err = 'The web address takes lower-case letters, numbers and dashes (2 to 61 characters).'; paint(); return Promise.resolve(null); }
    if (f.questions.some(function (q) { return !String(q.label || '').trim(); })) { FM.err = 'Every question needs its words.'; paint(); return Promise.resolve(null); }
    if (f.questions.some(function (q) { return (q.type === 'choice' || q.type === 'multi') && !parseOpts(q._opts).length; })) { FM.err = 'A question with choices needs at least one choice.'; paint(); return Promise.resolve(null); }
    FM.busy = 'Saving…'; paint();
    return newFields(f).then(function () {
      var tags = String(f._tags || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
      var row = { slug: f.slug, title: String(f.title).trim(), intro: String(f.intro || '').trim() || null, lang: f.lang === 'fr' ? 'fr' : 'en', kind: FKIND[f.kind] ? f.kind : 'general',
        questions: cleanQuestions(f.questions), consent: f.consent.ask ? { ask: true, required: !!f.consent.required, label: String(f.consent.label || '').trim() || CONSENT_DEFAULT } : { ask: false },
        thank_you: String(f.thank_you || '').trim() || null, settings: Object.assign({}, f.settings, { tags: tags }), cover_photo_id: f.cover_photo_id ? Number(f.cover_photo_id) : null, updated_by: actor() };
      if (row.kind !== 'volunteer') delete row.settings.volunteer_record;
      var q = f.id ? db.from('crm_forms').update(row).eq('id', f.id).select().single() : db.from('crm_forms').insert(Object.assign({ status: 'draft', created_by: actor() }, row)).select().single();
      return Promise.resolve(q).then(function (r) {
        FM.busy = '';
        if (r && r.error) { FM.err = /duplicate|unique|23505/i.test(String(r.error.message || r.error.code || '')) ? 'That web address is taken by another form.' : 'Not saved: ' + (r.error.message || r.error); paint(); return null; }
        var saved = (r && r.data) || null, savedId = (saved && saved.id) || f.id || null;
        return Promise.all([load('forms', true), load('cfields', true)]).then(function () {
          if (savedId) { FM.fid = String(savedId); FM.f = editCopy(formById(savedId) || Object.assign({}, row, { id: savedId, status: f.status })); try { history.replaceState(null, '', '#crm/forms/' + savedId); } catch (e) { /* fine */ } }
          return savedId;
        });
      });
    }).catch(function (e) { FM.busy = ''; FM.err = String((e && e.message) || e); paint(); return null; });
  }
  function setStatus(status) {
    var f = FM.f; if (!f || !f.id) return;
    FM.busy = status === 'published' ? 'Putting it live…' : 'Closing it…'; FM.confirm = ''; paint();
    saveForm().then(function (id) {
      if (!id) { FM.busy = ''; paint(); return; }
      return Promise.resolve(db.from('crm_forms').update({ status: status, updated_by: actor() }).eq('id', id).select().single()).then(function (r) {
        FM.busy = '';
        if (r && r.error) { FM.err = String(r.error.message || r.error).replace(/^.*?(A form needs|A newsletter sign-up needs)/, '$1'); paint(); return; }
        FM.msg = status === 'published' ? 'Live at hub.welfareavenue.com/f/' + f.slug + '. Copy the link to share it.' : 'Closed: the page now says it takes no more answers.';
        load('forms', true).then(function () { FM.f = editCopy(formById(id)); paint(); });
      });
    });
  }
  function newForm() {
    FM.busy = 'Making a draft…'; paint();
    var n = (S.forms || []).length + 1, slug = 'new-form-' + n;
    while ((S.forms || []).some(function (f) { return f.slug === slug; })) { n++; slug = 'new-form-' + n; }
    var row = { slug: slug, title: 'New form', kind: 'general', lang: 'en', status: 'draft', created_by: actor(), updated_by: actor(),
      questions: [{ id: 'first_name', type: 'text', label: 'First name', required: true, to: 'contact.first_name' }, { id: 'last_name', type: 'text', label: 'Last name', required: false, to: 'contact.last_name' }, { id: 'email', type: 'email', label: 'Email', required: true, to: 'contact.email' }],
      consent: { ask: true, required: false, label: CONSENT_DEFAULT }, thank_you: 'Thank you. We have your answers.', settings: { tags: [] } };
    Promise.resolve(db.from('crm_forms').insert(row).select().single()).then(function (r) {
      FM.busy = '';
      if (r && r.error) { FM.err = 'The draft could not be made: ' + (r.error.message || r.error); paint(); return; }
      load('forms', true).then(function () { FM.msg = 'Draft made. Name it, pick where each answer goes, then put it live.'; go('#crm/forms/' + r.data.id); });
    });
  }
  function delForm() {
    var f = FM.f; if (!f || !f.id) return;
    Promise.resolve(db.from('crm_forms').delete().eq('id', f.id)).then(function (r) {
      FM.confirm = ''; FM.msg = r && r.error ? 'Not deleted: ' + (r.error.message || r.error) : 'Draft deleted.'; FM.f = null;
      load('forms', true).then(function () { go('#crm/forms'); paint(); });
    });
  }
  function archField(id) {
    var fd = (S.cfields || []).filter(function (x) { return String(x.id) === String(id); })[0]; if (!fd) return;
    Promise.resolve(db.from('crm_fields').update({ archived_at: fd.archived_at ? null : new Date().toISOString(), updated_by: actor(), updated_at: new Date().toISOString() }).eq('id', fd.id)).then(function (r) {
      if (r && r.error) FM.err = 'Not changed: ' + (r.error.message || r.error);
      load('cfields', true).then(function () { paint(); });
    });
  }

  /* ---------- styles ---------- */
  var css156 = document.createElement('style'); css156.id = 'w156css';
  css156.textContent = ''
    + '.w156row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:start;padding:12px 0;border-top:1px solid rgba(16,63,57,.08);}.w156row>.w155ra{grid-column:1/-1;justify-content:flex-start;}.w156meta{grid-column:1/-1;font-size:13.5px;}'
    + '.w156nm{display:flex;flex-direction:column;min-width:0;}.w156lk{overflow-wrap:anywhere;}.w156nm a{color:' + GREEN + ';}.w156warn{color:' + FLAG + ';font-weight:600;}'
    + '.w156fl{display:flex;flex-direction:column;}.w156fr{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid rgba(16,63,57,.07);font-size:13.5px;}.w156fr.arch{opacity:.55;}'
    + '.w156q{border:1px solid rgba(16,63,57,.14);border-radius:14px;padding:12px;margin:0 0 10px;background:rgba(16,63,57,.025);display:flex;flex-direction:column;gap:8px;}.w156q .w152in,.w156q .w152sel{width:100%;box-sizing:border-box;}'
    + '.w156qh{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto auto;align-items:center;gap:6px;}.w156qh>b{font-family:' + HEAD + ';font-size:18px;color:' + GREEN + ';min-width:18px;}.w156qh .w152sel{width:100%;max-width:none;min-width:0;}.w156sp{display:none;}.w156qh .w152mini{padding:5px;}'
    + '.w156q textarea[data-w156qk],.w154card .w155lb textarea[data-w156k],.w154card .w155lb textarea[data-w156c]{min-height:72px;}'
    + '.w156ck{display:flex;align-items:center;gap:7px;font-size:13.5px;margin:0 0 8px;cursor:pointer;}.w156ck input{width:16px;height:16px;accent-color:' + GREEN + ';}.w156qh .w156ck{margin:0;}'
    + '.w156box{border:1px dashed rgba(16,63,57,.2);border-radius:12px;padding:10px 12px;margin:0 0 12px;}.w156h4{font-family:' + HEAD + ';font-size:17px;letter-spacing:.4px;text-transform:uppercase;color:' + GREEN + ';margin:18px 0 8px;}'
    + '.w156url{display:flex;align-items:center;gap:4px;font-size:14px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--wa-muted,' + MUTED + ');}.w156url .w152in{flex:1;min-width:0;}'
    + '.w156sheet{border-radius:16px;overflow:hidden;border:1px solid rgba(16,63,57,.12);background:rgba(16,63,57,.05);}.w156band{position:relative;background:' + GREEN + ' center/cover no-repeat;color:' + CREAM + ';padding:12px 16px 30px;min-height:150px;display:flex;flex-direction:column;}'
    + '.w156band:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,63,57,.5),rgba(16,63,57,.92));}.w156band > *{position:relative;}'
    + '.w168top{display:flex;align-items:center;justify-content:space-between;}.w168top img{height:30px;width:auto;}.w168top .w168star{height:30px;transform:rotate(12deg);}'
    + '.w168ey{margin-top:auto;padding-top:18px;font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:' + GOLD + ';}.w156band .w156t{color:' + CREAM + ';font-size:26px;}'
    + '.w168cov .w168now{display:flex;gap:10px;align-items:center;margin:0 0 10px;}.w168cov .w168now .im{flex:0 0 96px;height:60px;border-radius:10px;background:' + GREEN + ' center/cover;}.w168cov .w168now b{display:block;font-size:13.5px;}.w168cov .w168now .w152btn{margin-top:6px;}'
    + '.w168grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;max-height:232px;overflow-y:auto;padding:2px;}'
    + '.w168th{aspect-ratio:3/2;border:2px solid transparent;border-radius:9px;background:' + GREEN + ' center/cover;cursor:pointer;padding:0;}.w168th:hover{border-color:' + GOLD + ';}.w168th.on{border-color:' + GOLD + ';box-shadow:0 0 0 2px ' + GREEN + ';}.w168th:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:1px;}'
    + '.w156page{background:' + CREAM + ';margin:-18px 12px 12px;border-radius:14px;padding:18px;box-shadow:0 6px 18px rgba(16,63,57,.08);position:relative;}.w156t{font-family:' + HEAD + ';font-weight:700;font-size:24px;text-transform:uppercase;color:' + GREEN + ';line-height:1.05;}'
    + '.w156rule{display:block;width:44px;height:3px;border-radius:3px;background:' + GOLD + ';margin:8px 0 10px;}.w156page p{font-size:13.5px;margin:0 0 12px;color:#3d3c39;}'
    + '.w156pq{margin:0 0 12px;}.w156pl{font-weight:600;font-size:13.5px;margin-bottom:4px;}.w156req{color:' + FLAG + ';margin-left:2px;}.w156pc{display:flex;flex-wrap:wrap;gap:6px;}'
    + '.w156pr,.w156pb{border:1px solid rgba(16,63,57,.18);border-radius:10px;padding:6px 10px;font-size:13px;background:' + CREAM + ';}.w156pr:before{content:"\\25CB  ";color:' + MUTED + ';}.w156pb:before{content:"\\2610  ";color:' + MUTED + ';}'
    + '.w156pcons .w156pb{border-style:dashed;display:block;}.w156send{display:inline-block;background:' + GOLD + ';color:' + INK + ';font-weight:600;border-radius:999px;padding:8px 20px;font-size:14px;}.w156page .w152in[disabled]{background:' + CREAM + ';}'
    + '.w156subs{display:flex;flex-direction:column;}.w156sub{border-top:1px solid rgba(16,63,57,.08);}.w156sh{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:10px 4px;font-size:14px;}'
    + '.w156sh:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;border-radius:8px;}.w156who{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.w156sd{padding:4px 4px 12px;}'
    + '.w156more .w152kv{grid-template-columns:minmax(110px,42%) minmax(0,1fr);margin-bottom:4px;}.w156more .w152kv>span:first-child{color:var(--wa-muted,' + MUTED + ');}'
    + '@media (max-width:700px){.w156sh{grid-template-columns:minmax(0,1fr) auto;}.w156sh>span:first-child{grid-column:1/-1;font-size:12px;color:' + MUTED + ';}}';
  document.head.appendChild(css156);

  /* ---------- wiring ---------- */
  function qAt(el) { var box = el.closest('[data-w156qi]'); return box ? Number(box.getAttribute('data-w156qi')) : -1; }
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('.w152root')) return;
    var f = FM.f;
    if ((el = t.closest('[data-w156new]'))) { e.preventDefault(); newForm(); return; }
    if ((el = t.closest('[data-w156open]'))) { e.preventDefault(); FM.msg = ''; go('#crm/forms/' + el.getAttribute('data-w156open')); return; }
    if ((el = t.closest('[data-w156answers]'))) { e.preventDefault(); FM.msg = ''; go('#crm/forms/' + el.getAttribute('data-w156answers') + '/answers'); return; }
    if ((el = t.closest('[data-w156back]'))) { e.preventDefault(); FM.f = null; FM.confirm = ''; go('#crm/forms'); return; }
    if ((el = t.closest('[data-w156arch]'))) { e.preventDefault(); archField(el.getAttribute('data-w156arch')); return; }
    if ((el = t.closest('[data-w156sub]'))) { e.preventDefault(); var sid = el.getAttribute('data-w156sub'); FM.openSub = FM.openSub === sid ? null : sid; paint(); return; }
    if ((el = t.closest('[data-w156spam]'))) { e.preventDefault(); FM.showSpam = !FM.showSpam; paint(); return; }
    if ((el = t.closest('[data-w156tests]'))) { e.preventDefault(); FM.showTests = !FM.showTests; paint(); return; }
    if (!f) return;
    if ((el = t.closest('[data-w156qadd]'))) { e.preventDefault(); f.questions.push({ id: '', type: 'text', label: '', required: false, to: '', _opts: '' }); paint(); var qs = document.querySelectorAll('#crm [data-w156qi] [data-w156qk="label"]'); if (qs.length) qs[qs.length - 1].focus(); return; }
    if ((el = t.closest('[data-w156qmv]'))) { e.preventDefault(); var i = qAt(el), j = i + Number(el.getAttribute('data-w156qmv')); if (i < 0 || j < 0 || j >= f.questions.length) return; var tmp = f.questions[i]; f.questions[i] = f.questions[j]; f.questions[j] = tmp; paint(); return; }
    if ((el = t.closest('[data-w156qdel]'))) { e.preventDefault(); var k = qAt(el); if (k >= 0) f.questions.splice(k, 1); paint(); return; }
    if ((el = t.closest('[data-w168cov]'))) { e.preventDefault(); var cv = el.getAttribute('data-w168cov'); f.cover_photo_id = cv ? Number(cv) : null; paint(); return; }
    if ((el = t.closest('[data-w156save]'))) { e.preventDefault(); saveForm().then(function (id) { if (id) { FM.msg = 'Saved.'; paint(); } }); return; }
    if ((el = t.closest('[data-w156pub]'))) { e.preventDefault(); FM.confirm = 'publish'; paint(); return; }
    if ((el = t.closest('[data-w156pubok]'))) { e.preventDefault(); el.disabled = true; setStatus('published'); return; }
    if ((el = t.closest('[data-w156close]'))) { e.preventDefault(); FM.confirm = 'close'; paint(); return; }
    if ((el = t.closest('[data-w156closeok]'))) { e.preventDefault(); el.disabled = true; setStatus('closed'); return; }
    if ((el = t.closest('[data-w156del]'))) { e.preventDefault(); FM.confirm = 'delete'; paint(); return; }
    if ((el = t.closest('[data-w156delok]'))) { e.preventDefault(); delForm(); return; }
    if ((el = t.closest('[data-w156no]'))) { e.preventDefault(); FM.confirm = ''; paint(); return; }
  });
  function onForm156(e) {
    var t = e.target, f = FM.f; if (!f || !t || !t.closest || !t.closest('.w152root')) return;
    var key, i;
    if (t.hasAttribute('data-w156k')) {
      key = t.getAttribute('data-w156k'); f[key] = t.value;
      if (key === 'kind' && e.type === 'change') { if (t.value === 'volunteer' && f.settings.volunteer_record == null) f.settings.volunteer_record = true; paint(); }
      else if (key === 'lang' && e.type === 'change') paint();
      else if (key === 'title' || key === 'intro') previewSoon156();
      return;
    }
    if (t.hasAttribute('data-w156set')) { key = t.getAttribute('data-w156set'); f.settings[key] = t.type === 'checkbox' ? t.checked : t.value; return; }
    if (t.hasAttribute('data-w156c')) { key = t.getAttribute('data-w156c'); f.consent[key] = t.type === 'checkbox' ? t.checked : t.value; if (key === 'ask' && t.checked && !f.consent.label) f.consent.label = CONSENT_DEFAULT; if (t.type === 'checkbox') paint(); return; }
    if (t.hasAttribute('data-w156qk')) {
      i = qAt(t); if (i < 0) return; key = t.getAttribute('data-w156qk'); var q = f.questions[i];
      q[key] = t.type === 'checkbox' ? t.checked : t.value;
      if (key === 'type') { q.to = (toChoices(q, f.kind).filter(function (o) { return o[0] === q.to; })[0] || [''])[0]; if (q.type === 'email') q.to = 'contact.email'; if (q.type === 'phone') q.to = 'contact.phone'; if (q.type === 'serving_dates') q.to = 'volunteer.dates'; }
      if (key === 'type' || (key === 'to' && e.type === 'change') || key === 'required') paint();
      else if (key === 'label' || key === '_opts' || key === 'help') previewSoon156();
    }
  }
  var pv156 = null;
  function previewSoon156() { clearTimeout(pv156); pv156 = setTimeout(function () { var pv = document.querySelector('#crm .w156pv'); if (pv && FM.f) pv.outerHTML = previewHtml156(); }, 350); }
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.tagName !== 'SELECT' && t.type !== 'checkbox') onForm156(e); });
  document.addEventListener('change', function (e) { var t = e.target; if (t && (t.tagName === 'SELECT' || t.type === 'checkbox')) onForm156(e); });
