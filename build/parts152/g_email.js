
  /* ======================= the Email tab (wave154): sending from welfareavenue.com, the templates, the send log, the CASL rule =======================
     Steel (27/09/26 plan, step 2): Resend from welfareavenue.com, branded templates, a CASL footer, suppression that follows each
     contact's permission, a send log on the timeline, test sends to Steel only. Registered charity (713048502RR0001) confirmed
     28/09/26: implied consent applies (two years after a gift or a serving). The tab talks to the mail-send function; nothing
     goes out in test mode except to the test recipients. */
  var MAIL = { st: null, err: '', busy: '', prev: null, edit: null, form: false, ferr: '', msg: '', sendc: null };
  var MSTATUS = { queued: ['Queued', MUTED], sent: ['Sent', TEAL], delivered: ['Delivered', GREEN], delayed: ['Delayed', '#B9851B'], bounced: ['Bounced', FLAG], complained: ['Complaint', FLAG], failed: ['Failed', FLAG], suppressed: ['Not sent', MUTED] };
  var MKIND = { transactional: ['Confirmation', TEAL], newsletter: ['Newsletter', PURPLE], fundraising: ['Appeal', '#B9851B'], test: ['Test', MUTED] };
  var DSTATUS = { verified: ['Verified', GREEN], pending: ['Waiting for the records', '#B9851B'], not_started: ['Waiting for the records', '#B9851B'], failed: ['Records not found', FLAG], temporary_failure: ['Checking again', '#B9851B'] };
  LOADERS.templates = function () { return db.from('crm_email_templates').select('*').order('sort', { ascending: true }); };
  LOADERS.sends = function () { return db.from('crm_email_sends').select('id,contact_id,to_email,template_key,kind,subject,status,is_test,permission_basis,error,sent_at,delivered_at,opened_at,clicked_at,bounced_at,created_at,created_by,meta').order('created_at', { ascending: false }).limit(200); };

  /* the function behind the tab; a refused call comes back as {error} with the function's own words */
  function mailFn(action, body) {
    if (typeof db === 'undefined' || !db || !db.functions) return Promise.resolve({ error: 'offline' });
    return Promise.resolve(db.functions.invoke('mail-send', { body: Object.assign({ action: action }, body || {}) })).then(function (r) {
      if (r && r.error) {
        var ctx = r.error.context;
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { return { error: (j && j.error) || r.error.message || 'The email function refused.' }; }, function () { return { error: r.error.message || 'The email function refused.' }; });
        return { error: r.error.message || 'The email function refused.' };
      }
      return (r && r.data) || {};
    }).catch(function (e) { return { error: String((e && e.message) || e) }; });
  }
  function mchip(map, key) { var d = map[key] || [key || '?', MUTED]; return '<span class="w154chip" style="background:' + d[1] + '17;color:' + d[1] + '"><i style="background:' + d[1] + '"></i>' + E(d[0]) + '</span>'; }
  function testList() { var s = MAIL.st && MAIL.st.settings ? MAIL.st.settings.mail_test_recipients : ''; return String(s || '').toLowerCase().split(/[,;\s]+/).filter(Boolean); }
  function canTest() { return testList().indexOf(myEmail()) >= 0; }
  function mailAdmin() { return MAIL.st ? !!MAIL.st.admin : amAdmin(); }
  function tplByKey(k) { return (S.templates || []).filter(function (t) { return t.key === k; })[0] || null; }
  /* what a contact may receive today, in the words the rule uses (the server checks again before every send) */
  function permWhy(c) {
    var k = c._perm, st = lower(c.email_status);
    var trans = c.emails.length > 0 && st !== 'bounced' && st !== 'complained';
    var news = k === 'express' || k === 'implied';
    var why = k === 'express' ? 'express consent' : k === 'implied' ? 'implied consent until ' + fmtDay(c.implied_consent_until) : k === 'unsub' ? 'unsubscribed' : k === 'bounced' ? 'the address bounces' :
      k === 'none' ? 'no consent' : (c.email_consent === 'implied' ? 'their implied consent ran out' : 'no permission recorded');
    return { news: news, trans: trans, why: why };
  }
  function permLine(c) {
    var w = permWhy(c);
    if (!c.emails.length) return '<div class="w152line m">No email address on file, so nothing can be sent.</div>';
    return '<div class="w152line m w154perm">Newsletters and appeals: <b style="color:' + (w.news ? GREEN : FLAG) + '">' + (w.news ? 'yes' : 'no') + '</b> (' + E(w.why) + ') · Confirmations and reminders: <b style="color:' + (w.trans ? GREEN : FLAG) + '">' + (w.trans ? 'yes' : 'no') + '</b></div>';
  }

  /* ---------- the numbers: who can be emailed today ---------- */
  function permStatsHtml(all) {
    var n = { express: 0, implied: 0, unknown: 0, unsub: 0, bounced: 0 };
    all.forEach(function (c) { if (!c.emails.length) return; var k = c._perm === 'none' ? 'unknown' : c._perm; if (n[k] != null) n[k]++; });
    function st(key, v, label, color) { return '<button class="w152st" data-w154perm="' + key + '"><b style="color:' + color + '">' + Number(v).toLocaleString('en-CA') + '</b><span>' + E(label) + '</span></button>'; }
    return '<div class="w152stats w154stats">' +
      st('express', n.express, 'said yes to our emails (express consent)', GREEN) +
      st('implied', n.implied, 'gave or served in the last two years (implied consent)', TEAL) +
      st('unknown', n.unknown, 'with an address but no permission: confirmations only', MUTED) +
      st('unsub', n.unsub + n.bounced, 'unsubscribed or bouncing: never a newsletter', FLAG) + '</div>';
  }

  /* ---------- the sending card: the domain, the settings, the mode ---------- */
  function hostOf(name) { var d = (MAIL.st && MAIL.st.settings && MAIL.st.settings.mail_domain) || 'welfareavenue.com'; var n = String(name || ''); if (n === d) return '@'; return n.replace(new RegExp('\\.' + d.replace(/\./g, '\\.') + '$'), ''); }
  function dnsHtml(dom) {
    var recs = (dom && dom.records) || [];
    if (!recs.length) return '';
    return '<div class="w154dns"><div class="w154dh"><span>Type</span><span>Host (at Namecheap)</span><span>Value</span><span>Status</span></div>' + recs.map(function (r) {
      var val = String(r.value || ''), st = lower(r.status || 'not_started');
      return '<div class="w154dr"><span><b>' + E(r.type) + '</b>' + (r.priority != null ? '<div class="m">priority ' + E(r.priority) + '</div>' : '') + '<div class="m">' + E(r.record || '') + '</div></span>' +
        '<span><code>' + E(hostOf(r.name)) + '</code> <button class="w152mini" data-w152copy="' + E(hostOf(r.name)) + '" aria-label="Copy the host">' + I('copy') + '</button></span>' +
        '<span><code class="v">' + E(val) + '</code> <button class="w152mini" data-w152copy="' + E(val) + '" aria-label="Copy the value">' + I('copy') + 'Copy</button></span>' +
        '<span>' + mchip(DSTATUS, st) + '</span></div>';
    }).join('') + '</div><p class="w152pnote">Add each record at Namecheap under Advanced DNS (the host is relative to welfareavenue.com; <code>@</code> means the domain itself). Leave the Google MX, SPF and DKIM records as they are. Then Check the domain; verification takes a few minutes once the records are live.</p>';
  }
  function settingsFormHtml(s) {
    return '<div class="w152form w154form">' +
      field('From name', inp('mail_from_name', s.mail_from_name, 'Welfare Avenue')) + field('From address', inp('mail_from_email', s.mail_from_email, 'info@welfareavenue.com'), false, 'on welfareavenue.com') +
      field('Reply-to', inp('mail_reply_to', s.mail_reply_to, 'info@welfareavenue.com')) +
      field('Mode', sel('mail_mode', [['test', 'Test mode: only the test recipients get email'], ['live', 'Live: any contact the rule allows']], s.mail_mode || 'test'), false, 'switching to live is the go-ahead for real sends') +
      field('Test recipients', inp('mail_test_recipients', s.mail_test_recipients, 'name@welfareavenue.com, other@…'), true, 'separated by commas') +
      field('Fundraising without consent', sel('mail_fundraising_exemption', [['off', 'Off: appeals follow the newsletter rule (consent needed)'], ['on', 'On: a registered charity may send appeals without consent (CASL s.6 exemption)']], s.mail_fundraising_exemption || 'off'), true) +
      field('Postal address in the footer', inp('mail_postal_address', s.mail_postal_address, 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9'), true) +
      '</div><div class="w152foot"><span class="w152err">' + E(MAIL.ferr) + '</span><button class="w152btn ghost sm" data-w154cancel="1">Cancel</button><button class="w152btn sm" data-w154savecfg="1">' + I('check') + ' Save the settings</button></div>';
  }
  function sendingCardHtml() {
    var st = MAIL.st, s = (st && st.settings) || {}, adm = mailAdmin();
    var head = '<h3>' + I('mail') + ' Sending from ' + E(s.mail_domain || 'welfareavenue.com') + '</h3>';
    if (!st && !MAIL.err) return '<section class="w154card">' + head + '<div class="w152empty">Checking the engine…</div></section>';
    if (MAIL.err && !st) return '<section class="w154card">' + head + '<div class="w152empty">' + I('alert') + ' The email engine did not answer (' + E(MAIL.err) + '). <button class="w152mini" data-w154retry="1">Try again</button></div></section>';
    var dom = st.domain && !st.domain.error ? st.domain : null;
    var dchip = !st.key_present ? mchip({ k: ['Resend key missing', FLAG] }, 'k') : !st.domain_id ? mchip({ k: ['Not set up yet', MUTED] }, 'k') : dom ? mchip(DSTATUS, lower(dom.status)) : mchip({ k: ['Resend did not answer', FLAG] }, 'k');
    var live = (s.mail_mode || 'test') === 'live';
    var lines = '<div class="w154kv"><span>Domain</span><span>' + dchip + '</span></div>' +
      '<div class="w154kv"><span>From</span><span>' + E(s.mail_from_name || 'Welfare Avenue') + ' &lt;' + E(s.mail_from_email || '') + '&gt;' + (s.mail_reply_to ? '<div class="m">replies to ' + E(s.mail_reply_to) + '</div>' : '') + '</span></div>' +
      '<div class="w154kv"><span>Mode</span><span>' + (live ? mchip({ k: ['Live', GREEN] }, 'k') + ' <span class="m">any contact the rule allows</span>' : mchip({ k: ['Test mode', '#B9851B'] }, 'k') + ' <span class="m">only to ' + E(s.mail_test_recipients || 'nobody yet') + '</span>') + '</span></div>' +
      '<div class="w154kv"><span>Webhook</span><span>' + (st.webhook_id && st.webhook_secret_present ? mchip({ k: ['Connected', GREEN] }, 'k') + ' <span class="m">deliveries, opens, bounces and complaints come back to the log</span>' : mchip({ k: ['Not connected', MUTED] }, 'k')) + '</span></div>' +
      '<div class="w154kv"><span>Last 30 days</span><span>' + plural(st.last30.sent, 'email sent', 'emails sent') + ', ' + plural(st.last30.tests, 'test', 'tests') + (st.last30.bounced ? ', ' + plural(st.last30.bounced, 'bounce', 'bounces') : '') + (st.last30.suppressed ? ', ' + st.last30.suppressed + ' held back by the rule' : '') + (st.last30.failed ? ', ' + st.last30.failed + ' failed' : '') + '</span></div>';
    var acts = [];
    if (adm) {
      if (st.key_present && !st.domain_id) acts.push('<button class="w152btn sm" data-w154act="domain_setup">' + I('spark') + ' Set up the domain in Resend</button>');
      if (st.domain_id) acts.push('<button class="w152btn soft sm" data-w154act="domain_verify">' + I('check') + ' Check the domain</button>');
      if (st.key_present && !(st.webhook_id && st.webhook_secret_present)) acts.push('<button class="w152btn soft sm" data-w154act="webhook_setup">' + I('link') + ' Connect the webhook</button>');
      acts.push('<button class="w152btn ghost sm" data-w154cfg="1">' + I('edit') + ' Change the settings</button>');
      acts.push('<button class="w152btn ghost sm" data-w154act="refresh_consent">' + I('shield') + ' Refresh implied consent</button>');
    }
    return '<section class="w154card">' + head + lines + (MAIL.msg ? '<div class="w154msg">' + E(MAIL.msg) + '</div>' : '') +
      (acts.length ? '<div class="w154acts">' + acts.join('') + '</div>' : '') + (MAIL.busy ? '<div class="w152count">' + E(MAIL.busy) + '…</div>' : '') +
      (MAIL.form && adm ? settingsFormHtml(s) : '') + (dom ? dnsHtml(dom) : '') +
      (!st.key_present ? '<p class="w152pnote">The Resend key (RESEND_API_KEY) is missing from the function secrets, so nothing can be sent or set up. An admin adds it in Supabase; the Hub never stores it.</p>' : '') +
      '</section>';
  }

  /* ---------- the templates ---------- */
  function templatesCardHtml() {
    var list = S.templates || [], adm = mailAdmin();
    var rows = list.map(function (t) {
      var on = MAIL.prev && MAIL.prev.key === t.key, ed = MAIL.edit && MAIL.edit.key === t.key;
      return '<div class="w154tpl' + (t.active ? '' : ' off') + (on ? ' on' : '') + '"><div class="w154tph"><div><b>' + E(t.name) + '</b> ' + mchip(MKIND, t.kind) + (t.active ? '' : ' <span class="m">switched off</span>') + '<div class="m">' + E(t.subject) + '</div></div>' +
        '<div class="w154tpa"><button class="w152mini" data-w154prev="' + E(t.key) + '">' + I('search') + (on ? 'Hide' : 'Preview') + '</button>' +
        (canTest() ? '<button class="w152mini" data-w154test="' + E(t.key) + '">' + I('mail') + 'Send me a test</button>' : '') +
        (adm ? '<button class="w152mini" data-w154edit="' + E(t.key) + '">' + I('edit') + (ed ? 'Close' : 'Edit') + '</button>' : '') + '</div></div>' +
        (ed ? editFormHtml(t) : '') +
        (on ? (MAIL.prev.html ? '<div class="w154pv"><div class="m">Subject: <b>' + E(MAIL.prev.subject) + '</b>' + (MAIL.prev.preheader ? ' · preview text: ' + E(MAIL.prev.preheader) : '') + '</div><iframe class="w154frame" title="Preview of ' + E(t.name) + '" sandbox="" srcdoc="' + E(MAIL.prev.html) + '"></iframe></div>' : '<div class="w152count">' + E(MAIL.prev.error || 'Rendering the preview…') + '</div>') : '') + '</div>';
    }).join('');
    return '<section class="w154card"><h3>' + I('note') + ' Templates <span class="m">' + plural(list.length, 'template', 'templates') + '</span></h3>' +
      '<p class="w152pnote">Each one is wrapped in the brand layout: the logo on green, cream body, gold button, and a footer with the postal address, the charity number, why they got it and the unsubscribe link. <code>{{first_name}}</code> fills in from the contact; <code>{{name|fallback}}</code> falls back when empty.</p>' +
      (rows || '<div class="w152empty">No templates yet.</div>') + '</section>';
  }
  function editFormHtml(t) {
    return '<div class="w152form w154form w154edit">' +
      field('Name', inp('name', t.name), true) + field('Subject', inp('subject', t.subject), true) + field('Preview text', inp('preheader', t.preheader), true, 'the line inboxes show after the subject') +
      field('Body (HTML: h1, h2, p, ul, li, strong, a class="btn")', area('html_body', t.html_body), true) + field('Plain-text version', area('text_body', t.text_body), true, 'what clients without HTML show') +
      '<label class="full"><input type="checkbox" data-f="active"' + (t.active ? ' checked' : '') + '> In use</label>' +
      '</div><div class="w152foot"><span class="w152err">' + E(MAIL.ferr) + '</span><button class="w152btn ghost sm" data-w154cancel="1">Cancel</button><button class="w152btn sm" data-w154savetpl="' + E(t.key) + '">' + I('check') + ' Save the template</button></div>';
  }

  /* ---------- the send log ---------- */
  function sendRow(s) {
    var c = s.contact_id ? contact(s.contact_id) : null, t = tplByKey(s.template_key);
    var who = c ? '<a href="#crm/c/' + E(c.id) + '">' + E(c.full_name) + '</a><div class="m">' + E(s.to_email) + '</div>' : E(s.to_email);
    var marks = [];
    if (s.opened_at) marks.push('opened'); if (s.clicked_at) marks.push('clicked'); if (s.is_test) marks.push('test');
    return '<div class="w154sr"><span>' + E(fmtDay(s.created_at)) + '<div class="m">' + E(String(s.created_by || '').split('@')[0]) + '</div></span><span>' + who + '</span>' +
      '<span>' + E(t ? t.name : (s.template_key || '')) + (s.subject ? '<div class="m">' + E(clip(s.subject, 70)) + '</div>' : '') + '</span>' +
      '<span>' + mchip(MSTATUS, s.status) + (marks.length ? '<div class="m">' + E(marks.join(', ')) + '</div>' : '') + (s.status === 'suppressed' || s.status === 'failed' ? '<div class="m">' + E(s.permission_basis || s.error || '') + '</div>' : '') + '</span></div>';
  }
  function sendsCardHtml() {
    var list = S.sends || [];
    return '<section class="w154card wide"><h3>' + I('clock') + ' Recent emails <span class="m">' + (list.length ? 'the last ' + list.length : '') + '</span></h3>' +
      (list.length ? '<div class="w154sl"><div class="w154sh"><span>When</span><span>To</span><span>Template</span><span>What happened</span></div>' + list.slice(0, 60).map(sendRow).join('') + '</div>'
        : '<div class="w152empty">Nothing sent yet. The first message is a test to the test recipients once the domain is verified.</div>') + '</section>';
  }
  function ruleHtml() {
    return '<section class="w154card wide w154rule"><h3>' + I('shield') + ' How the rule works</h3>' +
      '<p>Canada’s anti-spam law (CASL) decides who gets what, and the Hub applies it before every send. Confirmations, reminders and receipts are not commercial messages, so they go to anyone whose address works. Newsletters and appeals need <b>express consent</b> (they said yes) or <b>implied consent</b>: Welfare Avenue is a registered charity (no. 713048502RR0001), so a gift or a serving gives two years of implied consent from that day. Someone who unsubscribed or whose address bounces never gets a newsletter or an appeal. Every email carries our postal address and an unsubscribe link, and each send sits on the contact’s timeline with what happened to it. Implied consent is refreshed every morning from the gifts and the rosters.</p></section>';
  }
  function paintEmail(root) {
    var u = S.ui;
    if (!S.templates || !S.sends) {
      root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + busy('Loading the email centre…');
      Promise.all([load('templates'), load('sends')]).then(function () { if (u.tab === 'email') paint(); });
      return;
    }
    if (!MAIL.st && !MAIL.busy && !MAIL.err) {
      MAIL.busy = 'Checking the engine';
      mailFn('settings').then(function (r) { MAIL.busy = ''; if (r.error) MAIL.err = r.error; else { MAIL.st = r; MAIL.err = ''; } if (u.tab === 'email') paint(); });
    }
    root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + permStatsHtml(S.contacts || []) +
      '<div class="w154grid">' + sendingCardHtml() + templatesCardHtml() + sendsCardHtml() + ruleHtml() + '</div>';
  }
  function refreshMail(after) {
    return Promise.all([load('sends', true), mailFn('settings')]).then(function (r) { if (!r[1].error) MAIL.st = r[1]; if (after) after(); if (S.ui.tab === 'email') paint(); });
  }
  function mailAct(action) {
    if (MAIL.busy) return;
    MAIL.busy = { domain_setup: 'Setting up the domain in Resend', domain_verify: 'Asking Resend to check the records', webhook_setup: 'Connecting the webhook', refresh_consent: 'Refreshing implied consent' }[action] || 'Working';
    MAIL.msg = ''; paint();
    mailFn(action).then(function (r) {
      MAIL.busy = '';
      if (r.error) { MAIL.msg = r.error; paint(); return; }
      if (action === 'refresh_consent' && r.counts) { MAIL.msg = 'Implied consent refreshed: ' + r.counts.updated + ' contacts updated, ' + r.counts.implied + ' with implied consent today, ' + r.counts.express + ' express.'; load('contacts', true).then(function () { paint(); }); }
      else if (action === 'webhook_setup') MAIL.msg = r.note ? 'The webhook was already connected.' : 'Webhook connected; its secret is in the vault.';
      else if (r.domain) MAIL.msg = 'Domain ' + (r.domain.name || '') + ': ' + ((DSTATUS[lower(r.domain.status)] || [r.domain.status])[0]).toLowerCase() + '.';
      mailFn('settings').then(function (s) { if (!s.error) MAIL.st = s; paint(); });
    });
  }
  function previewTpl(key, contactId) {
    MAIL.prev = { key: key, html: '', subject: '', preheader: '' }; paint();
    mailFn('preview', { template_key: key, contact_id: contactId || undefined }).then(function (r) {
      if (!MAIL.prev || MAIL.prev.key !== key) return;
      if (r.error) MAIL.prev.error = r.error; else { MAIL.prev.html = r.html; MAIL.prev.subject = r.subject; MAIL.prev.preheader = r.preheader; }
      paint();
    });
  }
  function sendTest(key) {
    if (MAIL.busy) return;
    MAIL.busy = 'Sending a test to ' + myEmail(); MAIL.msg = ''; paint();
    mailFn('test', { template_key: key, to: myEmail() }).then(function (r) {
      MAIL.busy = '';
      MAIL.msg = r.error ? 'The test did not go: ' + r.error : 'Test sent to ' + (r.to || myEmail()) + ' (' + (r.status || 'sent') + ').';
      refreshMail();
    });
  }
  function saveSettings() {
    var v = formVals(); MAIL.ferr = '';
    var body = { mail_from_name: v.mail_from_name, mail_from_email: v.mail_from_email, mail_reply_to: v.mail_reply_to, mail_mode: v.mail_mode, mail_test_recipients: v.mail_test_recipients, mail_fundraising_exemption: v.mail_fundraising_exemption, mail_postal_address: v.mail_postal_address };
    MAIL.busy = 'Saving the settings'; paint();
    return mailFn('set_settings', body).then(function (r) {
      MAIL.busy = '';
      if (r.error) { MAIL.ferr = r.error; paint(); return; }
      MAIL.form = false; MAIL.msg = r.changed ? 'Settings saved (' + plural(r.changed, 'change', 'changes') + ').' : 'Nothing changed.';
      mailFn('settings').then(function (s) { if (!s.error) MAIL.st = s; paint(); });
    });
  }
  function saveTemplate(key) {
    var v = formVals(); MAIL.ferr = '';
    if (!String(v.subject || '').trim() || !String(v.html_body || '').trim()) { MAIL.ferr = 'A subject and a body are needed.'; paint(); return Promise.resolve(); }
    MAIL.busy = 'Saving the template'; paint();
    return mailFn('save_template', { key: key, name: v.name, subject: v.subject, preheader: v.preheader, html_body: v.html_body, text_body: v.text_body, active: !!v.active }).then(function (r) {
      MAIL.busy = '';
      if (r.error) { MAIL.ferr = r.error; paint(); return; }
      MAIL.edit = null; MAIL.msg = 'Template saved.';
      if (MAIL.prev && MAIL.prev.key === key) MAIL.prev = null;
      load('templates', true).then(function () { paint(); });
    });
  }
  /* formVals reads [data-f] inside #w152sheet; the Email tab's forms live on the page, so read them there too */
  var __formVals152 = formVals;
  formVals = function () {
    var o = document.querySelector('#w152sheet [data-f]') ? null : document.querySelector('.w152root .w154form');
    if (!o) return __formVals152();
    var v = {};
    o.querySelectorAll('[data-f]').forEach(function (el) { v[el.getAttribute('data-f')] = el.type === 'checkbox' ? el.checked : String(el.value || '').trim(); });
    v._kinds = [];
    return v;
  };

  /* ---------- a contact's page: send them an email ---------- */
  function mailFormHtml(c) {
    var list = (S.templates || []).filter(function (t) { return t.active && t.kind !== 'test'; });
    var cur = MAIL.sendc && MAIL.sendc.id === c.id ? MAIL.sendc : (MAIL.sendc = { id: c.id, key: list.length ? list[0].key : '', html: '', subject: '', err: '', msg: '', busy: '' });
    var t = tplByKey(cur.key), w = permWhy(c), ok = t ? (t.kind === 'transactional' ? w.trans : w.news) : false;
    var mode = MAIL.st && MAIL.st.settings ? MAIL.st.settings.mail_mode : 'test';
    var testOnly = mode !== 'live' && testList().indexOf(lower(c.emails[0])) < 0;
    return '<h2>Send an email</h2><div class="sub">To ' + E(c.full_name) + ' &lt;' + E(c.emails[0] || '') + '&gt;. The Hub checks their permission first and logs the send on their timeline.</div>' +
      '<div class="w152form w154form"><label class="full">Template<select data-f="template_key" data-w154tplsel="' + E(c.id) + '">' + list.map(function (x) { return '<option value="' + E(x.key) + '"' + (x.key === cur.key ? ' selected' : '') + '>' + E(x.name) + ' (' + E((MKIND[x.kind] || [x.kind])[0].toLowerCase()) + ')</option>'; }).join('') + '</select></label></div>' +
      (t ? '<div class="w152line m" style="margin-top:8px">' + (ok ? '<b style="color:' + GREEN + '">Allowed</b>: ' + E(t.kind === 'transactional' ? 'a confirmation or reminder, not a commercial message' : w.why) : '<b style="color:' + FLAG + '">Held back</b>: ' + E(w.why) + '. The Hub will not send a ' + E((MKIND[t.kind] || [t.kind])[0].toLowerCase()) + ' to them.') + '</div>' : '') +
      (testOnly ? '<div class="w152line m">' + I('alert') + ' The Hub is in test mode: this address is not a test recipient, so the send would be refused until an admin switches the Email tab to live.</div>' : '') +
      (cur.html ? '<iframe class="w154frame sheet" title="Preview" sandbox="" srcdoc="' + E(cur.html) + '"></iframe>' : '<div class="w152count">' + E(cur.err || (cur.busy || 'Rendering the preview…')) + '</div>') +
      '<div class="w152foot"><span class="w152err">' + E(cur.msg) + '</span><button class="w152btn ghost" data-w152back="' + E(c.id) + '">Back</button>' +
      '<button class="w152btn" data-w154go="' + E(c.id) + '"' + (!ok || !t || cur.busy ? ' disabled' : '') + '>' + I('mail') + ' Send now</button></div>';
  }
  function mailForm(id) {
    var c = contact(id); if (!c || !c.emails.length) return;
    var open = function () {
      openSheet(mailFormHtml(c), 'mail:' + c.id, true);
      var cur = MAIL.sendc;
      if (cur && cur.key && !cur.html && !cur.busy) {
        cur.busy = 'Rendering the preview';
        mailFn('preview', { template_key: cur.key, contact_id: c.id }).then(function (r) {
          if (!MAIL.sendc || MAIL.sendc.id !== c.id || MAIL.sendc.key !== cur.key) return;
          cur.busy = ''; if (r.error) cur.err = r.error; else { cur.html = r.html; cur.subject = r.subject; }
          if (S.sheet === 'mail:' + c.id) openSheet(mailFormHtml(c), 'mail:' + c.id, true);
        });
      }
    };
    if (!S.templates) load('templates').then(open); else open();
    if (!MAIL.st) mailFn('settings').then(function (r) { if (!r.error) { MAIL.st = r; if (S.sheet === 'mail:' + c.id) openSheet(mailFormHtml(c), 'mail:' + c.id, true); } });
  }
  function sendNow(id) {
    var c = contact(id), cur = MAIL.sendc; if (!c || !cur || cur.id !== c.id || !cur.key) return Promise.resolve();
    cur.busy = 'Sending'; cur.msg = ''; openSheet(mailFormHtml(c), 'mail:' + c.id, true);
    return mailFn('send', { contact_id: c.id, template_key: cur.key }).then(function (r) {
      cur.busy = '';
      if (r.error) { cur.msg = r.error; openSheet(mailFormHtml(c), 'mail:' + c.id, true); return; }
      if (r.status === 'suppressed') { cur.msg = 'Held back by the rule: ' + (r.basis || ''); openSheet(mailFormHtml(c), 'mail:' + c.id, true); return; }
      toastS('Email sent to ' + (r.to || c.emails[0]));
      MAIL.sendc = null; S.sends = null;
      contactSheet(c.id, true);
    });
  }

  /* ---------- styles ---------- */
  var css154 = document.createElement('style'); css154.id = 'w154css';
  css154.textContent = ''
    + '.w154grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start;}'
    + '.w154card{background:var(--wa-card,' + CREAM + ');border-radius:18px;box-shadow:' + SH1 + ';padding:18px 20px;min-width:0;}.w154card.wide{grid-column:1/-1;}'
    + '.w154card h3{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-family:' + HEAD + ';font-size:22px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;color:' + GREEN + ';}.w154card h3 .m{font-family:' + BODY + ';font-size:12.5px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--wa-muted,' + MUTED + ');}'
    + '.w154card .m{color:var(--wa-muted,' + MUTED + ');font-size:12.5px;}.w154card p{font-size:14px;line-height:1.55;margin:0 0 10px;}'
    + '.w154chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap;}.w154chip i{width:7px;height:7px;border-radius:50%;display:inline-block;}'
    + '.w154kv{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px;padding:7px 0;border-top:1px solid rgba(16,63,57,.07);font-size:13.5px;align-items:start;}.w154kv>span:first-child{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted,' + MUTED + ');padding-top:3px;}'
    + '.w154acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}.w154msg{margin-top:10px;padding:9px 12px;border-radius:12px;background:rgba(220,165,39,.14);font-size:13px;}'
    + '.w154form{margin-top:14px;}.w154form textarea{min-height:140px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;}'
    + '.w154dns{margin-top:14px;border:1px solid rgba(16,63,57,.1);border-radius:12px;overflow:hidden;}.w154dh,.w154dr{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1.15fr) minmax(0,2fr) minmax(0,1.05fr);gap:10px;padding:9px 12px;font-size:13px;align-items:center;}.w154dr .w154chip{white-space:normal;text-align:left;line-height:1.25;}'
    + '.w154dh{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted,' + MUTED + ');background:rgba(16,63,57,.04);}.w154dr{border-top:1px solid rgba(16,63,57,.07);}'
    + '.w154dr code{font-size:12px;background:rgba(16,63,57,.06);border-radius:6px;padding:2px 6px;display:inline-block;max-width:100%;overflow-wrap:anywhere;word-break:break-all;}.w154dr>span{min-width:0;}'
    + '.w154tpl{border-top:1px solid rgba(16,63,57,.08);padding:12px 0;}.w154tpl.off{opacity:.65;}.w154tph{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}.w154tph b{font-size:14.5px;}.w154tpa{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}'
    + '.w154pv{margin-top:10px;}.w154frame{width:100%;height:640px;border:1px solid rgba(16,63,57,.12);border-radius:12px;background:' + CREAM + ';margin-top:8px;}.w154frame.sheet{height:520px;}'
    + '.w154sl{border:1px solid rgba(16,63,57,.1);border-radius:12px;overflow:hidden;}.w154sh,.w154sr{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.6fr) minmax(0,1.6fr) minmax(0,1.3fr);gap:10px;padding:9px 12px;font-size:13px;align-items:start;}'
    + '.w154sh{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted,' + MUTED + ');background:rgba(16,63,57,.04);}.w154sr{border-top:1px solid rgba(16,63,57,.07);}.w154sr a{color:' + GREEN + ';font-weight:700;text-decoration:none;}'
    + '.w154rule p{font-size:14px;line-height:1.6;}.w154perm b{font-weight:700;}'
    + '.w154st{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:1px 7px;margin-left:6px;vertical-align:middle;}'
    + '@media (max-width:980px){.w154grid{grid-template-columns:1fr;}.w154dh,.w154dr{grid-template-columns:minmax(0,.8fr) minmax(0,1fr) minmax(0,1.6fr);}.w154dh>span:last-child,.w154dr>span:last-child{display:none;}}'
    + '@media (max-width:700px){.w154sh,.w154sr{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);}.w154sh>span:nth-child(3),.w154sr>span:nth-child(3){display:none;}.w154kv{grid-template-columns:1fr;gap:2px;}.w154frame{height:520px;}}';
  document.head.appendChild(css154);

  /* ---------- wiring for the tab and the contact form ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest) return;
    if (!(t.closest('.w152root') || t.closest('#w152sheet'))) return;
    if ((el = t.closest('[data-w154perm]'))) { e.preventDefault(); var k = el.getAttribute('data-w154perm'); setFilter({ perm: k === 'unknown' ? 'unknown' : k }); go('#crm'); return; }
    if ((el = t.closest('[data-w154retry]'))) { e.preventDefault(); MAIL.err = ''; MAIL.st = null; paint(); return; }
    if ((el = t.closest('[data-w154act]'))) { e.preventDefault(); mailAct(el.getAttribute('data-w154act')); return; }
    if ((el = t.closest('[data-w154cfg]'))) { e.preventDefault(); MAIL.form = !MAIL.form; MAIL.edit = null; MAIL.ferr = ''; paint(); return; }
    if ((el = t.closest('[data-w154cancel]'))) { e.preventDefault(); MAIL.form = false; MAIL.edit = null; MAIL.ferr = ''; paint(); return; }
    if ((el = t.closest('[data-w154savecfg]'))) { e.preventDefault(); saveSettings(); return; }
    if ((el = t.closest('[data-w154prev]'))) { e.preventDefault(); var pk = el.getAttribute('data-w154prev'); if (MAIL.prev && MAIL.prev.key === pk) { MAIL.prev = null; paint(); } else previewTpl(pk); return; }
    if ((el = t.closest('[data-w154test]'))) { e.preventDefault(); sendTest(el.getAttribute('data-w154test')); return; }
    if ((el = t.closest('[data-w154edit]'))) { e.preventDefault(); var ek = el.getAttribute('data-w154edit'); MAIL.edit = MAIL.edit && MAIL.edit.key === ek ? null : { key: ek }; MAIL.form = false; MAIL.ferr = ''; paint(); return; }
    if ((el = t.closest('[data-w154savetpl]'))) { e.preventDefault(); saveTemplate(el.getAttribute('data-w154savetpl')); return; }
    if ((el = t.closest('[data-w154send]'))) { e.preventDefault(); MAIL.sendc = null; mailForm(el.getAttribute('data-w154send')); return; }
    if ((el = t.closest('[data-w154go]'))) { e.preventDefault(); el.disabled = true; sendNow(el.getAttribute('data-w154go')); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-w154tplsel')) return;
    var id = t.getAttribute('data-w154tplsel'), c = contact(id), cur = MAIL.sendc; if (!c || !cur) return;
    cur.key = t.value; cur.html = ''; cur.err = ''; cur.msg = ''; cur.busy = '';
    mailForm(id);
  });
