  /* ======================= Leaving Keela (wave159a, 28/09/26) =======================
     The first part of step 7 of the plan (wave159, leaving Keela): a live checklist at the top of Sources. Each thing Keela does
     today, what the Hub has in its place, whose step is next, and the date that matters: Keela bills quarterly (the next charge in
     app_config keela_next_charge) and cancelling needs keela_notice_days of notice, so every step aims to be done a week before
     that. Read from the Hub: the contacts and gifts from Keela, the forms and automations (drafts, live, on), the email mode, the
     receipt mode and settings. The final export and import, and the donation form, are Steel's steps and read as such. */
  LOADERS.kcfg = function () { return db.from('app_config').select('key,value').in('key', ['mail_mode', 'receipt_mode', 'receipt_signatory_name', 'receipt_next_number', 'keela_next_charge', 'keela_notice_days', 'keela_quarterly_cost', 'keela_donation_form', 'donate_mode', 'donate_webhook']); };
  function kcfg(k) { var r = (S.kcfg || []).filter(function (x) { return x.key === k; })[0]; return r ? String(r.value == null ? '' : r.value) : ''; }
  function kDays(day) { var n = daysSince(day); return n == null ? null : -n; }
  function kChip(state) {
    var d = { done: ['Done', GREEN], doing: ['In progress', TEAL], waiting: ['Waiting on a decision', '#B9851B'], todo: ['To do', FLAG] }[state] || ['?', MUTED];
    return '<span class="w154chip" style="background:' + d[1] + '17;color:' + d[1] + '"><i style="background:' + d[1] + '"></i>' + E(d[0]) + '</span>';
  }
  function keelaSteps() {
    var contacts = (S.contacts || []).filter(function (c) { return c.source === 'keela' || (c.legacy_refs && c.legacy_refs.keela_contact_id); }).length;
    var kg = (S.gifts || []).filter(function (g) { return lower(g.platform) === 'keela'; });
    var lastKg = kg.map(function (g) { return dayOf(g.donated_at); }).sort().pop() || '';
    var forms = S.forms || [], live = forms.filter(function (f) { return f.status === 'live'; });
    var autos = S.autos || [], on = autos.filter(function (a) { return a.status === 'on'; });
    var paste = autos.filter(function (a) { return /\[Paste/i.test(JSON.stringify(a.steps || [])); });
    var mail = kcfg('mail_mode') || 'test', rmode = kcfg('receipt_mode') || 'off';
    var rMissing = []; if (!kcfg('receipt_signatory_name')) rMissing.push('who signs'); if (!/^\d+$/.test(kcfg('receipt_next_number'))) rMissing.push('the numbering');
    var donation = kcfg('keela_donation_form'), page = kcfg('donate_mode') === 'live', built = !!kcfg('donate_webhook');
    return [
      { t: 'Contacts and gifts', k: 'Keela holds the donors, supporters and gifts.', s: S.gifts ? 'doing' : 'doing',
        h: plural(contacts, 'contact', 'contacts') + ' and ' + plural(kg.length, 'gift', 'gifts') + ' from Keela are in the Hub' + (lastKg ? ' (the latest gift from ' + fmtDay(lastKg) + ')' : '') + '.',
        n: 'Last: a final export from Keela (contacts with their subscription status and custom fields, the transactions with the receipts, the form answers that prove consent), imported and checked against Keela’s counts. Steel downloads; the assistant imports.' },
      { t: 'Forms', k: 'Keela’s volunteer, Toronto and newsletter forms on the website.', s: forms.length && live.length === forms.length ? 'done' : live.length ? 'doing' : 'todo',
        h: forms.length ? plural(live.length, 'form is', 'forms are') + ' live of ' + forms.length + ' in the Hub' + (live.length < forms.length ? ' (the others are drafts)' : '') + '.' : 'No form in the Hub yet.',
        n: live.length === forms.length && forms.length ? 'Close the matching Keela forms.' : 'Steel reads the drafts and puts them live in Forms, then the website’s buttons point to hub.welfareavenue.com/f/ and the Keela forms close.' },
      { t: 'Automations', k: 'Keela’s welcome series, donor follow-up and rally follow-up.', s: autos.length && on.length === autos.length ? 'done' : on.length ? 'doing' : 'todo',
        h: plural(on.length, 'automation is', 'automations are') + ' on of ' + autos.length + (paste.length ? '; ' + plural(paste.length, 'draft still needs', 'drafts still need') + ' the words of Keela’s emails' : '') + '.',
        n: paste.length ? 'Paste the words of Keela’s welcome emails into the drafts (or have the assistant copy them from Keela), try each on yourself, then turn them on once the forms are live.' : 'Try each on yourself, then turn them on once the forms are live.' },
      { t: 'Email', k: 'Keela sends the newsletters and campaigns.', s: mail === 'live' ? 'done' : 'todo',
        h: 'The Hub’s email is in ' + (mail === 'live' ? 'live mode.' : 'test mode: only the test addresses get email.'),
        n: mail === 'live' ? 'Send the next newsletter from Campaigns.' : 'Steel switches the mode to live in Email when real sends should start (Resend’s free plan sends up to 100 a day).' },
      { t: 'Tax receipts', k: 'Keela issued 55 receipts (KEE numbers).', s: rmode === 'on' ? 'done' : rMissing.length ? 'waiting' : 'todo',
        h: 'Receipts from the Hub are ' + (rmode === 'on' ? 'on.' : 'off' + (rMissing.length ? ' (missing: ' + listJoin(rMissing) + ').' : ', and ready to turn on.')),
        n: rmode === 'on' ? 'Issue from Receipts; the year-end run in January.' : 'The treasurer reviews a sample PDF and fills the settings with the signature; the treasurer and Steel decide to turn them on.' },
      { t: 'Online donations', k: 'Keela’s donation form on the website.', s: page || donation ? 'done' : built ? 'doing' : 'waiting',
        h: page ? 'The Hub’s donation page is live (hub.welfareavenue.com/give, paid on Stripe).' : donation ? 'Donations go through ' + donation + '.' :
          built ? 'The Hub’s donation page is built (Stripe: once or monthly, where it goes, tributes) and off.' : 'Not decided: Zeffy, if its embedded forms can be fully customized, or another option.',
        n: page || donation ? 'Point the website’s Donate buttons at the new page and take Keela’s form off the website.' :
          built ? 'Steel reads the page and puts it live in Gifts, Online giving; then the website’s Donate buttons point to hub.welfareavenue.com/give.' : 'Steel’s decision (Zeffy); until then Keela’s form stays on the website.' }
    ];
  }
  function keelaHtml() {
    var steps = keelaSteps(), done = steps.filter(function (x) { return x.s === 'done'; }).length;
    var charge = kcfg('keela_next_charge'), notice = Number(kcfg('keela_notice_days')) || 7, cost = kcfg('keela_quarterly_cost');
    var by = charge ? (function () { var t = Date.parse(charge + 'T12:00:00Z') - notice * 86400000; return new Date(t).toISOString().slice(0, 10); })() : '';
    var aim = by ? (function () { var t = Date.parse(by + 'T12:00:00Z') - 7 * 86400000; return new Date(t).toISOString().slice(0, 10); })() : '';
    var left = by ? kDays(by) : null;
    return '<div class="w152card w159k"><h3>Leaving Keela <span>' + done + ' of ' + steps.length + ' done</span></h3>' +
      (charge ? '<p class="w159kd"><b>' + (left != null && left >= 0 ? plural(left, 'day', 'days') + ' to give notice' : 'The notice date has passed') + '</b> Keela’s next charge is on ' + E(fmtDay(charge)) + (cost ? ' ($' + E(cost) + ' a quarter)' : '') +
        '; cancelling needs ' + plural(notice, 'day', 'days') + '’ notice, so by ' + E(fmtDay(by)) + '. The aim is every step below done by ' + E(fmtDay(aim)) + '.</p>' : '') +
      '<div class="w159ks">' + steps.map(function (x) {
        return '<div class="w159kr"><div class="h"><b>' + E(x.t) + '</b>' + kChip(x.s) + '</div><p class="m">' + E(x.k) + '</p><p>' + E(x.h) + '</p><p class="nx">' + I('arrow') + ' ' + E(x.n) + '</p></div>';
      }).join('') + '</div></div>';
  }
  var css159 = document.createElement('style'); css159.id = 'w159css';
  css159.textContent = ''
    + '.w159k{grid-column:1/-1;}.w159kd{font-size:14px;line-height:1.5;margin:0 0 12px;}.w159kd b{color:' + GREEN + ';margin-right:6px;}'
    + '.w159ks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}.w159kr{background:rgba(16,63,57,.04);border-radius:12px;padding:12px 14px;min-width:0;}'
    + '.w159kr .h{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;}.w159kr p{margin:4px 0;font-size:13px;line-height:1.45;}.w159kr .m{color:' + MUTED + ';font-size:12.5px;}'
    + '.w159kr .nx{color:' + INK + ';font-weight:500;}.w159kr .nx .w152i{width:13px;height:13px;vertical-align:-2px;color:' + TEAL + ';}'
    + '@media (max-width:980px){.w159ks{grid-template-columns:repeat(2,minmax(0,1fr));}}@media (max-width:700px){.w159ks{grid-template-columns:1fr;}}';
  document.head.appendChild(css159);
