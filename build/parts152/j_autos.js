  /* ======================= Automations (wave157, 28/09/26) =======================
     Step 5 of the CRM plan: Keela's welcome series and donor follow-up, rebuilt in the Hub. An automation starts for one
     person when something happens (they fill in a form, a tag is added, a gift is recorded, a serving they signed up for
     comes near) and runs its steps: send an email, wait, wait until an email is opened (a yes and a no path), add or
     remove tags, make a task on a team's board, notify team members. The engine is in the database
     (crm_automation_tick every minute); every email goes through mail-send and the permission rule, between 8 am and
     8 pm Toronto, and while the Hub is in test mode only test addresses get one. Automations start as drafts; Try it on
     me runs one on your own contact (a day of waiting is a minute, tags, tasks and notices are only described). */
  P.bolt = '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>';
  P.pause = '<path d="M8.5 5.5v13M15.5 5.5v13"/>';
  P.play = '<path d="M7.5 5v14l11-7z"/>';
  P.bell = '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>';
  var AU = { aid: null, a: null, sub: '', msg: '', err: '', busy: '', confirm: '', problems: null, runs: null, runsFor: null, openRun: null, showTests: true, prev: null, prevFor: null };
  LOADERS.autos = function () { return db.from('crm_automations').select('*').order('created_at', { ascending: true }).order('id', { ascending: true }); };
  LOADERS.astats = function () { return db.from('crm_automation_stats_v').select('*'); };
  LOADERS.depts = function () { return db.from('dept_meta').select('department,label,short_label,sort').order('sort', { ascending: true }); };
  LOADERS.tmembers = function () { return db.from('team_members').select('id,name,email,department,active').eq('active', true).order('name', { ascending: true }).limit(400); };
  var ASTAT = { draft: ['Draft', MUTED], on: ['On', GREEN], paused: ['Paused', '#B9851B'] };
  var RSTAT = { active: ['In it now', TEAL], done: ['Finished', GREEN], stopped: ['Stopped', MUTED], error: ['Needs a look', FLAG], test: ['Test run', PURPLE] };
  var ATRIG = [['form', 'Someone fills in a form'], ['tag', 'A tag is added to a contact'], ['gift', 'A gift is recorded'], ['serving', 'A serving they signed up for is coming']];
  var ASTEP = { send: ['Send an email', 'mail'], wait: ['Wait', 'clock'], wait_open: ['Wait until opened', 'eye'], tag: ['Add or remove tags', 'tag'], task: ['Make a task', 'check'], notify: ['Notify the team', 'bell'], end: ['End here', 'x'] };
  var AKIND = [['transactional', 'About something they did', 'A welcome, a thank-you or a reminder: goes to any working address.'], ['volunteer', 'Volunteer news', 'Anyone with a working address who has not unsubscribed.'],
    ['newsletter', 'Newsletter', 'People who said yes, or gave or served in the last two years.'], ['fundraising', 'Fundraising', 'The same people as a newsletter.']];
  var ASAMPLE = { form_title: 'Volunteer with Welfare Avenue', amount: '$25.00', gift_date: '28 Sep 2026', gift_date_line: ' on 28 Sep 2026', event_day: 'Sunday', event_when: 'Sunday 4 October 2026', event_title: 'the serving on Sunday 4 October', role: 'a server' };
  function autoById(id) { return (S.autos || []).filter(function (a) { return String(a.id) === String(id); })[0] || null; }
  function astat(id) { return (S.astats || []).filter(function (x) { return String(x.automation_id) === String(id); })[0] || {}; }
  function tplLabel(key) { var t = (S.templates || []).filter(function (x) { return x.key === key; })[0]; return t ? t.name : (key || 'a saved email'); }
  function deptLabel(code) { var d = (S.depts || []).filter(function (x) { return x.department === code; })[0]; return d ? (d.label || d.short_label || code) : (code || 'a team'); }
  function memberLabel(em) { var m = (S.tmembers || []).filter(function (x) { return lower(x.email) === lower(em); })[0]; return m ? m.name : em; }
  function csv(v) { return (Array.isArray(v) ? v : String(v || '').split(',')).map(function (x) { return String(x).trim(); }).filter(Boolean); }
  function trigText(t) {
    t = t || {};
    if (t.kind === 'form') { var f = t.form_id ? formById(t.form_id) : null; return t.form_id ? 'When someone fills in “' + (f ? f.title : 'a form that is gone') + '”' : 'When someone fills in any form'; }
    if (t.kind === 'tag') return 'When the tag “' + (t.tag || '…') + '” is added to a contact';
    if (t.kind === 'gift') return 'When a gift' + (Number(t.min_amount) ? ' of $' + Number(t.min_amount) + ' or more' : '') + ' is recorded' + (t.first_only ? ' (a first gift only)' : '');
    if (t.kind === 'serving') return plural(Number(t.days_before) || 2, 'day', 'days') + ' before a ' + (t.location && t.location !== 'any' ? t.location + ' ' : '') + 'serving they are ' + (t.include_unconfirmed ? 'on the roster for' : 'confirmed for');
    return 'Not chosen yet';
  }
  function stepText(s) {
    if (!s) return '';
    if (s.type === 'send') return 'Email: ' + (s.email === 'template' ? tplLabel(s.template_key) : '“' + (s.subject || 'no subject yet') + '”');
    if (s.type === 'wait') return 'Wait ' + plural(Number(s.days) || 0, 'day', 'days');
    if (s.type === 'wait_open') return 'Wait up to ' + plural(Number(s.days) || 0, 'day', 'days') + ' for the email to be opened';
    if (s.type === 'tag') return 'Tags: ' + listJoin(csv(s.add).map(function (x) { return '+' + x; }).concat(csv(s.remove).map(function (x) { return '−' + x; })));
    if (s.type === 'task') return 'A task for ' + deptLabel(s.department) + ': “' + (s.title || '') + '”';
    if (s.type === 'notify') return 'Notify ' + listJoin(csv(s.to).map(memberLabel));
    return 'End';
  }

  /* ---------- the list ---------- */
  function autoRow(a) {
    var st = astat(a.id), sends = (a.steps || []).filter(function (s) { return s.type === 'send'; }).length;
    return '<div class="w156row" role="listitem"><div class="w156nm"><button class="w155cn" data-w157open="' + E(a.id) + '"><b>' + E(a.name) + '</b></button>' +
      '<span class="m">' + E(trigText(a.trigger)) + '</span><span class="m">' + plural((a.steps || []).length, 'step', 'steps') + (sends ? ' · ' + plural(sends, 'email', 'emails') : '') + '</span></div>' +
      '<div>' + lchip(ASTAT, a.status) + '</div>' +
      '<div class="w156meta">' + plural(Number(st.active) || 0, 'person in it now', 'people in it now') + '<span class="m"> · ' + (Number(st.done) || 0) + ' finished · ' + plural(Number(st.emails_sent) || 0, 'email sent', 'emails sent') + '</span>' +
      (Number(st.errors) ? '<span class="w156warn"> · ' + plural(Number(st.errors), 'needs a look', 'need a look') + '</span>' : '') + '</div>' +
      '<div class="w155ra"><button class="w152btn sm ghost" data-w157open="' + E(a.id) + '">' + I('edit') + ' Open</button><button class="w152btn sm ghost" data-w157people="' + E(a.id) + '">' + I('people') + ' People</button></div></div>';
  }
  function autosListHtml() {
    var as = S.autos || [], live = !!(MAIL.st && MAIL.st.settings && MAIL.st.settings.mail_mode === 'live');
    return '<div class="w155grid"><div class="w154card wide"><h3>' + I('bolt') + ' Automations <span class="w155sub">' + plural(as.length, 'automation', 'automations') + '</span></h3>' +
      '<p class="m">An automation runs by itself for each person: when they fill in a form, get a tag or give, or before a serving they signed up for. It sends emails through the permission rule, only between 8 am and 8 pm (Toronto), and it can tag, make a task on a team’s board or notify someone. New ones start as drafts; Try it on me runs one on your own contact first.</p>' +
      (!live ? '<div class="w155cf test">' + I('lock') + ' The Hub is in test mode: an automation that is on still runs, but its emails only reach the test addresses until an admin switches the mode to live in the Email tab.</div>' : '') +
      (AU.msg ? '<div class="w154msg">' + E(AU.msg) + '</div>' : '') + (AU.err ? '<div class="w152err">' + E(AU.err) + '</div>' : '') +
      '<div class="w154acts"><button class="w152btn" data-w157new="1">' + I('plus') + ' New automation</button></div>' +
      (as.length ? '<div class="w155rows" role="list">' + as.map(autoRow).join('') + '</div>' : '<p class="m">No automation yet.</p>') + '</div></div>';
  }

  /* ---------- the editor ---------- */
  function autoCopy(a) {
    var c = JSON.parse(JSON.stringify(a));
    c.trigger = c.trigger || {}; c.settings = c.settings || {};
    c.steps = (c.steps || []).map(function (s) {
      if (s.type === 'tag') { s._add = csv(s.add).join(', '); s._rem = csv(s.remove).join(', '); }
      if (s.type === 'notify') s._to = csv(s.to).join(', ');
      return s;
    });
    return c;
  }
  function nextStepId(a) { var n = 0; a.steps.forEach(function (s) { var m = /^s(\d+)$/.exec(s.id || ''); if (m) n = Math.max(n, Number(m[1])); }); return 's' + (n + 1); }
  function newStep(type, a) {
    var id = nextStepId(a);
    if (type === 'send') return { id: id, type: 'send', email: 'write', kind: 'transactional', subject: '', preheader: '', headline: '', body: 'Hi {{first_name|there}},\n\n', cta_label: '', cta_url: '', from: 'org' };
    if (type === 'wait') return { id: id, type: 'wait', days: 2 };
    if (type === 'wait_open') { var last = a.steps.filter(function (s) { return s.type === 'send'; }).slice(-1)[0]; return { id: id, type: 'wait_open', step: last ? last.id : '', days: 3, yes: 'next', no: 'next' }; }
    if (type === 'tag') return { id: id, type: 'tag', _add: '', _rem: '' };
    if (type === 'task') return { id: id, type: 'task', department: ((S.depts || [])[0] || {}).department || 'opsmtl', title: 'Follow up with {{full_name}}', note: '', due_days: 3 };
    if (type === 'notify') return { id: id, type: 'notify', _to: myEmail(), message: '{{full_name}} just joined “' + (a.name || 'this automation') + '”.' };
    return { id: id, type: 'end' };
  }
  function auSel(attr, list, cur, label) { return '<select class="w152sel" ' + attr + (label ? ' aria-label="' + E(label) + '"' : '') + '>' + list.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(o[0]) === String(cur == null ? '' : cur) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>'; }
  function fld(k, label, v, ph, area, type) {
    return '<label class="w155lb">' + E(label) + (area ? '<textarea class="w152in" data-w157s="' + k + '" rows="' + (area === true ? 5 : area) + '" placeholder="' + E(ph || '') + '">' + E(v || '') + '</textarea>'
      : '<input class="w152in" data-w157s="' + k + '"' + (type ? ' type="' + type + '"' : '') + ' value="' + E(v == null ? '' : v) + '" placeholder="' + E(ph || '') + '">') + '</label>';
  }
  function pathChoices(a, i) { var out = [['next', 'Go on to the next step'], ['end', 'End here']]; a.steps.forEach(function (s, j) { if (j > i + 1) out.push([s.id, 'Jump to step ' + (j + 1) + ': ' + stepText(s)]); }); return out; }
  function stepBody(s, i, a) {
    if (s.type === 'send') {
      var tpls = [['write', 'Write it here (the Welfare Avenue layout)']].concat((S.templates || []).filter(function (t) { return t.key !== 'test' && t.key !== 'newsletter' && t.active; }).map(function (t) { return ['tpl:' + t.key, 'Saved email: ' + t.name]; }));
      var kind = AKIND.filter(function (k) { return k[0] === s.kind; })[0] || AKIND[0];
      return '<div class="w155two"><label class="w155lb">The email' + auSel('data-w157s="_email"', tpls, s.email === 'template' ? 'tpl:' + s.template_key : 'write') + '</label>' +
        '<label class="w155lb">Who can get it' + auSel('data-w157s="kind"', AKIND.map(function (k) { return [k[0], k[1]]; }), s.kind) + '</label></div><p class="m">' + E(kind[2]) + '</p>' +
        (s.email === 'template' ? '<p class="m">The saved email’s own words, with this person’s name' + (a.trigger && a.trigger.kind === 'gift' ? ' and the gift' : a.trigger && a.trigger.kind === 'serving' ? ' and the serving' : '') + ' filled in. Edit it in the Email tab.</p>'
          : fld('subject', 'Subject', s.subject, 'Welcome to Welfare Avenue, {{first_name|friend}}') + fld('preheader', 'Preview text (optional)', s.preheader, 'One line that shows after the subject') +
            fld('headline', 'Headline', s.headline, 'Welcome to our community') + fld('body', 'Message (a blank line starts a new paragraph)', s.body, 'Hi {{first_name|there}},', 7) +
            '<div class="w155two">' + fld('cta_label', 'Button (optional)', s.cta_label, 'See the upcoming servings') + fld('cta_url', 'Button link', s.cta_url, 'https://welfareavenue.com') + '</div>') +
        '<div class="w155two"><label class="w155lb">From' + auSel('data-w157s="from"', [['org', 'Welfare Avenue (info@welfareavenue.com)'], ['custom', 'A team member']], s.from || 'org') + '</label>' +
        (s.from === 'custom' ? '<span class="w157pair">' + fld('from_name', 'Their name', s.from_name, 'Suhaib Abdillahi') + fld('from_email', 'Their address', s.from_email, 'name@welfareavenue.com') + '</span>' : '<span></span>') + '</div>';
    }
    if (s.type === 'wait') return '<div class="w157inline">' + fld('days', 'Days', s.days, '2', false, 'number') + '<p class="m">Then the next step. Waits are counted from the step before.</p></div>';
    if (s.type === 'wait_open') {
      var sends = a.steps.slice(0, i).filter(function (x) { return x.type === 'send'; }).map(function (x) { var j = a.steps.indexOf(x); return [x.id, 'Step ' + (j + 1) + ': ' + stepText(x)]; });
      return '<label class="w155lb">Which email' + auSel('data-w157s="step"', sends.length ? sends : [['', 'Add an email before this step']], s.step) + '</label>' +
        '<div class="w157inline">' + fld('days', 'Wait up to (days)', s.days, '3', false, 'number') + '</div>' +
        '<div class="w155two"><label class="w155lb">If they open it' + auSel('data-w157s="yes"', pathChoices(a, i), s.yes || 'next') + '</label><label class="w155lb">If not' + auSel('data-w157s="no"', pathChoices(a, i), s.no || 'next') + '</label></div>' +
        '<p class="m">Opens are counted when Resend’s open tracking is on for welfareavenue.com, and some mail apps open everything, so treat this as a hint.</p>';
    }
    if (s.type === 'tag') return '<div class="w155two">' + fld('_add', 'Add these tags', s._add, 'welcomed, rally 2026') + fld('_rem', 'Remove these tags', s._rem, 'applicant') + '</div>';
    if (s.type === 'task') return '<div class="w155two"><label class="w155lb">Whose board' + auSel('data-w157s="department"', (S.depts || []).map(function (d) { return [d.department, d.label || d.short_label || d.department]; }), s.department) + '</label>' +
      fld('due_days', 'Due in (days)', s.due_days, '3', false, 'number') + '</div>' + fld('title', 'The task', s.title, 'Book {{full_name}}’s first serving') + fld('note', 'Details (optional)', s.note, 'Phone: {{phone|not given}}', 3) +
      '<p class="m">The task links to their page in the CRM. An email address in these words is written with “at”, so it never reads as a mention.</p>';
    if (s.type === 'notify') return fld('_to', 'Who (team addresses, separated by commas)', s._to, 'name@welfareavenue.com') +
      '<p class="m">' + E(csv(s._to).map(function (em) { var m = (S.tmembers || []).filter(function (x) { return lower(x.email) === lower(em); })[0]; return m ? m.name : em + ' (not on the team list)'; }).join(', ')) + '</p>' +
      fld('message', 'The message', s.message, '{{full_name}} applied to volunteer.', 3) + '<p class="m">It shows in their mentions in the Hub and reaches them on Slack, like an @mention.</p>';
    return '<p class="m">The run stops here, even if steps follow (a path can jump past it).</p>';
  }
  function stepCard(s, i, a) {
    var d = ASTEP[s.type] || [s.type, 'spark'];
    return '<div class="w157step" data-w157si="' + i + '"><div class="w157sh"><b>' + (i + 1) + '</b><span class="w157st">' + I(d[1]) + ' ' + E(d[0]) + '</span><span class="w156sp"></span>' +
      (s.type === 'send' ? '<button class="w152mini" data-w157pv="' + i + '">' + I('eye') + ' Preview</button>' : '') +
      '<button class="w152mini" data-w157mv="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + I('up') + '</button><button class="w152mini" data-w157mv="1" aria-label="Move down"' + (i < a.steps.length - 1 ? '' : ' disabled') + '>' + I('down') + '</button>' +
      '<button class="w152mini" data-w157del="1" aria-label="Remove the step">' + I('trash') + '</button></div>' + stepBody(s, i, a) + '</div>';
  }
  function trigHtml(a) {
    var t = a.trigger || {}, forms = (S.forms || []).map(function (f) { return [String(f.id), f.title + (f.status === 'published' ? '' : ' (' + f.status + ')')]; });
    var body = '';
    if (t.kind === 'form') body = '<label class="w155lb">Which form' + auSel('data-w157t="form_id"', [['', 'Any form']].concat(forms), t.form_id == null ? '' : String(t.form_id)) + '</label>';
    if (t.kind === 'tag') body = '<label class="w155lb">The tag<input class="w152in" data-w157t="tag" value="' + E(t.tag || '') + '" placeholder="volunteer applicant"></label>';
    if (t.kind === 'gift') body = '<div class="w155two"><label class="w155lb">From this amount (optional)<input class="w152in" type="number" data-w157t="min_amount" value="' + E(t.min_amount == null ? '' : t.min_amount) + '" placeholder="Any amount"></label>' +
      '<label class="w156ck w157ck"><input type="checkbox" data-w157t="first_only"' + (t.first_only ? ' checked' : '') + '> Their first gift only</label></div><p class="m">Only gifts dated in the last 7 days start it, so an import of older gifts sends nothing.</p>';
    if (t.kind === 'serving') body = '<div class="w155two"><label class="w155lb">Days before<input class="w152in" type="number" data-w157t="days_before" value="' + E(t.days_before || 2) + '"></label>' +
      '<label class="w155lb">Where' + auSel('data-w157t="location"', [['Montreal', 'Montreal'], ['Toronto', 'Toronto'], ['any', 'Any location']], t.location || 'Montreal') + '</label></div>' +
      '<label class="w156ck"><input type="checkbox" data-w157t="include_unconfirmed"' + (t.include_unconfirmed ? ' checked' : '') + '> Also people still to confirm (TBD, waiting for an answer)</label>';
    return '<h4 class="w156h4">When it starts</h4><div class="w156box">' + auSel('data-w157t="kind"', [['', 'Pick what starts it']].concat(ATRIG), t.kind || '', 'What starts it') + body +
      (t.kind && t.kind !== 'serving' ? '<label class="w156ck"><input type="checkbox" data-w157set="reentry"' + ((a.settings.reentry == null ? t.kind === 'gift' : a.settings.reentry) ? ' checked' : '') + '> The same person can go through it again each time' + (t.kind === 'gift' ? ' (each gift gets its thank-you)' : '') + '</label>' : '') + '</div>';
  }
  function autoConfirmHtml(a) {
    if (AU.confirm === 'problems') return '<div class="w155cf test"><b>Not ready to turn on yet:</b><ul class="w157ul">' + (AU.problems || []).map(function (p) { return '<li>' + E(p) + '</li>'; }).join('') + '</ul><div class="w154acts"><button class="w152btn ghost" data-w157no="1">Back to editing</button></div></div>';
    if (AU.confirm === 'on') {
      var live = !!(MAIL.st && MAIL.st.settings && MAIL.st.settings.mail_mode === 'live');
      return '<div class="w155cf"><b>Turn on “' + E(a.name) + '”?</b> From now on: ' + E(trigText(a.trigger).replace(/^When/, 'when')) + ', that person starts it. Emails go out between 8 am and 8 pm (Toronto) through the permission rule' +
        (live ? '.' : '; while the Hub is in test mode only the test addresses get them.') + ' People who met the trigger before today are not included.' +
        '<div class="w154acts"><button class="w152btn" data-w157onok="1">' + I('play') + ' Turn it on</button><button class="w152btn ghost" data-w157no="1">Not yet</button></div></div>';
    }
    if (AU.confirm === 'delete') return '<div class="w155cf test"><b>Delete this draft?</b><div class="w154acts"><button class="w152btn" data-w157delok="1">' + I('trash') + ' Delete it</button><button class="w152btn ghost" data-w157no="1">Keep it</button></div></div>';
    return '';
  }
  function autoEditorHtml() {
    var a = AU.a, st = astat(a.id);
    var adds = Object.keys(ASTEP).map(function (k) { return '<button class="w152btn sm ghost" data-w157add="' + k + '">' + I(ASTEP[k][1]) + ' ' + E(ASTEP[k][0]) + '</button>'; }).join('');
    return '<div class="w154card"><h3>' + I('bolt') + ' ' + E(a.id ? 'Edit the automation' : 'New automation') + ' ' + lchip(ASTAT, a.status) + '</h3>' +
      (AU.err ? '<div class="w152err">' + E(AU.err) + '</div>' : '') + (AU.msg ? '<div class="w154msg">' + E(AU.msg) + '</div>' : '') + (AU.busy ? '<div class="m">' + E(AU.busy) + '</div>' : '') +
      '<label class="w155lb">Name<input class="w152in" data-w157k="name" value="' + E(a.name || '') + '" placeholder="Welcome new volunteers"></label>' +
      '<label class="w155lb">What it is for (optional)<textarea class="w152in" data-w157k="description" rows="2">' + E(a.description || '') + '</textarea></label>' +
      trigHtml(a) + '<h4 class="w156h4">What happens</h4>' + (a.steps.length ? a.steps.map(function (s, i) { return stepCard(s, i, a); }).join('') : '<p class="m">No step yet: add the first one.</p>') +
      '<div class="w157adds">' + adds + '</div>' +
      '<div class="w154acts"><button class="w152btn" data-w157save="1">' + I('check') + ' Save</button>' +
      (a.id && a.status !== 'on' ? '<button class="w152btn ghost" data-w157on="1">' + I('play') + ' Turn on…</button>' : '') +
      (a.status === 'on' ? '<button class="w152btn ghost" data-w157pause="1">' + I('pause') + ' Pause</button>' : '') +
      (a.id ? '<button class="w152btn ghost" data-w157try="1">' + I('spark') + ' Try it on me</button><button class="w152btn ghost" data-w157people="' + E(a.id) + '">' + I('people') + ' People (' + ((Number(st.active) || 0) + (Number(st.done) || 0) + (Number(st.stopped) || 0) + (Number(st.errors) || 0)) + ')</button>' : '') +
      '<button class="w152btn ghost" data-w157back="1">Back to the automations</button>' +
      (a.id && a.status === 'draft' ? '<button class="w152btn ghost" data-w157dela="1">' + I('trash') + ' Delete the draft</button>' : '') + '</div>' + autoConfirmHtml(a) + '</div>';
  }
  function autoSideHtml() {
    var a = AU.a, p = AU.prev;
    if (p && AU.prevFor === a.id) return '<div class="w154card"><h3>' + I('mail') + ' Preview</h3>' + (p.busy ? busy('Rendering the preview…') : p.err ? '<div class="w152err">' + E(p.err) + '</div>'
      : '<div class="w154pv"><div class="m">From: ' + E(p.from || '') + '<br>Subject: <b>' + E(p.subject || '') + '</b>' + (p.preheader ? '<br>Preview text: ' + E(p.preheader) : '') + '<br>Shown with sample details; each person gets their own name.</div><iframe class="w154frame" sandbox="" title="The email as it will look" srcdoc="' + E(p.html || '') + '"></iframe></div>') +
      '<div class="w154acts"><button class="w152btn sm ghost" data-w157pvclose="1">Back to the outline</button></div></div>';
    return '<div class="w154card w157flow"><h3>' + I('list') + ' In plain words</h3><p class="w157tr">' + E(trigText(a.trigger)) + ':</p><ol class="w157ol">' +
      a.steps.map(function (s, i) {
        var extra = s.type === 'wait_open' ? ' If opened: ' + (s.yes === 'end' ? 'end' : s.yes && s.yes !== 'next' ? 'jump to step ' + (a.steps.map(function (x) { return x.id; }).indexOf(s.yes) + 1) : 'go on') + '. If not: ' + (s.no === 'end' ? 'end' : s.no && s.no !== 'next' ? 'jump to step ' + (a.steps.map(function (x) { return x.id; }).indexOf(s.no) + 1) : 'go on') + '.' : '';
        return '<li>' + E(stepText(s) + '.' + extra) + '</li>';
      }).join('') + '</ol></div>';
  }

  /* ---------- the people in it ---------- */
  function runStepText(r, a) {
    if (r.status !== 'active') return '';
    var s = (a.steps || []).filter(function (x) { return x.id === r.step_id; })[0] || (r.step_id ? null : (a.steps || [])[0]);
    return s ? 'Next: ' + stepText(s) + (r.next_at ? ' · ' + fmtDay(r.next_at) : '') : '';
  }
  function runsHtml(a) {
    var all = AU.runsFor === String(a.id) ? AU.runs : null;
    if (!all) return '<div class="w154card wide">' + busy('Loading the people…') + '</div>';
    var tests = all.filter(function (r) { return r.is_test; }).length;
    var rows = all.filter(function (r) { return AU.showTests || !r.is_test; });
    return '<div class="w154card wide"><h3>' + I('people') + ' People in “' + E(a.name) + '” <span class="w155sub">' + plural(rows.length, 'run', 'runs') + '</span></h3>' +
      (AU.msg ? '<div class="w154msg">' + E(AU.msg) + '</div>' : '') + (AU.err ? '<div class="w152err">' + E(AU.err) + '</div>' : '') +
      '<div class="w154acts">' + (tests ? '<button class="w152btn sm ghost" data-w157tests="1">' + (AU.showTests ? 'Hide' : 'Show') + ' test runs (' + tests + ')</button>' : '') +
      '<button class="w152btn sm ghost" data-w157open="' + E(a.id) + '">' + I('edit') + ' Edit the automation</button><button class="w152btn sm ghost" data-w157back="1">Back to the automations</button></div>' +
      (rows.length ? '<div class="w156subs">' + rows.map(function (r) {
        var c = contact(r.contact_id), open = AU.openRun === String(r.id);
        return '<div class="w156sub"><button class="w156sh" data-w157run="' + E(r.id) + '" aria-expanded="' + open + '"><span>' + E(fmtDay(r.started_at)) + '</span><span class="w156who">' + E(c ? c.full_name : 'Contact ' + r.contact_id) +
          '<span class="m w157next">' + E(runStepText(r, a)) + '</span></span><span>' + lchip(RSTAT, r.is_test ? 'test' : r.status) + '</span></button>' +
          (open ? '<div class="w156sd"><ol class="w157hist">' + (r.history || []).map(function (h) { return '<li><span class="m">' + E(fmtDay(h.at)) + '</span> ' + E(h.note || h.type) + '</li>'; }).join('') + '</ol>' +
            (r.error ? '<div class="w152err">' + E(r.error) + '</div>' : '') + '<div class="w154acts">' + (c ? '<button class="w152btn sm ghost" data-w152open="' + E(r.contact_id) + '">' + I('people') + ' Open their page</button>' : '') +
            (r.status === 'active' || r.status === 'error' ? '<button class="w152btn sm ghost" data-w157stop="' + E(r.id) + '">' + I('x') + ' Stop it for them</button>' : '') + '</div></div>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="m">Nobody has started it yet.</p>') + '</div>';
  }
  /* a contact's page: the automations they are in (wave157) */
  function contactAutosHtml(d) {
    return '<div class="w156more">' + (d.runs || []).map(function (r) {
      var a = autoById(r.automation_id);
      var what = r.status === 'active' ? (a ? runStepText(r, a) : 'In it now') : r.status === 'done' ? 'Finished ' + fmtDay(r.finished_at || r.started_at) : r.status === 'stopped' ? 'Stopped' : 'Needs a look';
      return '<div class="w152kv"><span>' + (a ? '<a href="#crm/automations/' + E(a.id) + '/people">' + E(a.name) + '</a>' : 'An automation') + '</span><span>' + lchip(RSTAT, r.status) + ' <span class="m">' + E(what) + '</span></span></div>';
    }).join('') + '</div>';
  }
  function loadRuns(id) {
    AU.runsFor = String(id); AU.runs = null;
    return Promise.resolve(db.from('crm_automation_runs').select('id,contact_id,status,step_id,next_at,is_test,history,error,started_at,finished_at').eq('automation_id', Number(id)).order('started_at', { ascending: false }).limit(500))
      .then(function (r) { if (AU.runsFor === String(id)) { AU.runs = (r && r.data) || []; if (S.ui.tab === 'automations') paint(); } });
  }

  function paintAutos(root) {
    var need = [];
    ['autos', 'astats', 'forms', 'templates', 'depts', 'tmembers'].forEach(function (k) { if (!S[k]) need.push(load(k)); });
    if (!MAIL.st) need.push(mailFn('settings').then(function (r) { if (r && !r.error) MAIL.st = r; else MAIL.st = MAIL.st || { settings: {} }; }));
    if (need.length) { root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + busy('Loading the automations…'); Promise.all(need).then(function () { if (S.ui.tab === 'automations') paint(); }); return; }
    var html = statsHtml(S.contacts || []) + tabsHtml();
    if (AU.aid && AU.sub === 'people') {
      var ap = autoById(AU.aid);
      if (!ap) { root.innerHTML = html + '<div class="w152empty">That automation is not in the CRM.</div>'; return; }
      if (AU.runsFor !== String(ap.id)) loadRuns(ap.id);
      root.innerHTML = html + '<div class="w155grid">' + runsHtml(ap) + '</div>'; return;
    }
    if (AU.aid && !AU.a) { var k = autoById(AU.aid); if (k) AU.a = autoCopy(k); }
    if (AU.aid && !AU.a) { root.innerHTML = html + '<div class="w152empty">That automation is not in the CRM. <button class="w152mini" data-w157back="1">Back to the automations</button></div>'; return; }
    root.innerHTML = html + (AU.a ? '<div class="w155grid">' + autoEditorHtml() + autoSideHtml() + '</div>' : autosListHtml());
  }
  function openAutos(parts) {
    var id = parts[2] || null, sub = parts[3] || '';
    if (id !== AU.aid) { AU.a = null; AU.confirm = ''; AU.err = ''; AU.openRun = null; AU.prev = null; if (id) AU.msg = ''; }
    AU.aid = id; AU.sub = sub;
  }

  /* ---------- saving ---------- */
  function cleanSteps(steps) {
    return steps.map(function (s) {
      var o = {}; Object.keys(s).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = s[k]; });
      if (s.type === 'tag') { o.add = csv(s._add); o.remove = csv(s._rem); }
      if (s.type === 'notify') o.to = csv(s._to).map(lower);
      if (s.type === 'wait' || s.type === 'wait_open') o.days = Number(s.days) || 0;
      if (s.type === 'task') o.due_days = Math.max(0, Math.round(Number(s.due_days) || 0));
      if (s.type === 'send' && s.email === 'template') { ['subject', 'preheader', 'headline', 'body', 'cta_label', 'cta_url'].forEach(function (k) { delete o[k]; }); }
      if (s.type === 'send' && s.from !== 'custom') { delete o.from_name; delete o.from_email; }
      return o;
    });
  }
  function autoRowOf(a) {
    var t = Object.assign({}, a.trigger || {});
    if (t.kind === 'form') t.form_id = t.form_id ? Number(t.form_id) : null; else delete t.form_id;
    if (t.kind !== 'tag') delete t.tag;
    if (t.kind === 'gift') { t.min_amount = t.min_amount === '' || t.min_amount == null ? null : Number(t.min_amount); t.first_only = !!t.first_only; } else { delete t.min_amount; delete t.first_only; }
    if (t.kind === 'serving') { t.days_before = Number(t.days_before) || 2; t.location = t.location || 'Montreal'; t.include_unconfirmed = !!t.include_unconfirmed; } else { delete t.days_before; delete t.location; delete t.include_unconfirmed; }
    return { name: String(a.name || '').trim(), description: String(a.description || '').trim() || null, trigger: t, steps: cleanSteps(a.steps), settings: Object.assign({}, a.settings || {}), updated_by: actor() };
  }
  function saveAuto() {
    var a = AU.a; if (!a) return Promise.resolve(null);
    AU.err = '';
    if (!String(a.name || '').trim()) { AU.err = 'Give the automation a name.'; paint(); return Promise.resolve(null); }
    var row = autoRowOf(a);
    AU.busy = 'Saving…'; paint();
    var q = a.id ? db.from('crm_automations').update(row).eq('id', a.id).select().single() : db.from('crm_automations').insert(Object.assign({ status: 'draft', created_by: actor() }, row)).select().single();
    return Promise.resolve(q).then(function (r) {
      AU.busy = '';
      if (r && r.error) { AU.err = 'Not saved: ' + (r.error.message || r.error); paint(); return null; }
      var saved = (r && r.data) || null, id = (saved && saved.id) || a.id || null;
      return Promise.all([load('autos', true), load('astats', true)]).then(function () {
        if (id) { AU.aid = String(id); var k = autoById(id); AU.a = autoCopy(k || Object.assign({}, row, { id: id, status: a.status })); try { history.replaceState(null, '', '#crm/automations/' + id); } catch (e) { /* fine */ } }
        return id;
      });
    }).catch(function (e) { AU.busy = ''; AU.err = String((e && e.message) || e); paint(); return null; });
  }
  function checkAndConfirm() {
    saveAuto().then(function (id) {
      if (!id) return;
      var a = AU.a;
      return Promise.resolve(db.rpc('crm_automation_problems', { p_trigger: autoRowOf(a).trigger, p_steps: autoRowOf(a).steps })).then(function (r) {
        var ps = (r && r.data) || [];
        AU.problems = ps; AU.confirm = ps.length ? 'problems' : 'on'; paint();
      });
    });
  }
  function setAutoStatus(status) {
    var a = AU.a; if (!a || !a.id) return;
    AU.busy = status === 'on' ? 'Turning it on…' : 'Pausing it…'; AU.confirm = ''; paint();
    Promise.resolve(db.from('crm_automations').update({ status: status, updated_by: actor() }).eq('id', a.id).select().single()).then(function (r) {
      AU.busy = '';
      if (r && r.error) { AU.err = String(r.error.message || r.error).replace(/^.*?Not ready to turn on:/, 'Not ready to turn on:'); paint(); return; }
      AU.msg = status === 'on' ? 'On: ' + trigText(a.trigger).replace(/^When/, 'when') + ', that person starts it.' : 'Paused: nobody new starts it, and the people in it wait where they are.';
      Promise.all([load('autos', true), load('astats', true)]).then(function () { AU.a = autoCopy(autoById(a.id)); paint(); });
    });
  }
  function tryAuto() {
    saveAuto().then(function (id) {
      if (!id) return;
      AU.busy = 'Starting a test run on your own contact…'; paint();
      Promise.resolve(db.rpc('crm_automation_try', { p_automation_id: Number(id) })).then(function (r) {
        AU.busy = '';
        if (r && r.error) { AU.err = String(r.error.message || r.error); paint(); return; }
        AU.msg = 'A test run started on your own contact: its emails come to ' + myEmail() + ' within a few minutes, a day of waiting counts as a minute, and tags, tasks and notices are only described. Follow it under People.';
        load('astats', true).then(function () { paint(); });
      });
    });
  }
  function newAuto() {
    AU.busy = 'Making a draft…'; paint();
    var row = { name: 'New automation', status: 'draft', trigger: { kind: 'form', form_id: null }, steps: [], settings: {}, created_by: actor(), updated_by: actor() };
    Promise.resolve(db.from('crm_automations').insert(row).select().single()).then(function (r) {
      AU.busy = '';
      if (r && r.error) { AU.err = 'The draft could not be made: ' + (r.error.message || r.error); paint(); return; }
      load('autos', true).then(function () { AU.msg = 'Draft made. Pick what starts it, add the steps, then try it on yourself.'; go('#crm/automations/' + r.data.id); });
    });
  }
  function delAuto() {
    var a = AU.a; if (!a || !a.id) return;
    Promise.resolve(db.from('crm_automations').delete().eq('id', a.id)).then(function (r) {
      AU.confirm = ''; AU.msg = r && r.error ? 'Not deleted: ' + (r.error.message || r.error) : 'Draft deleted.'; AU.a = null;
      load('autos', true).then(function () { go('#crm/automations'); paint(); });
    });
  }
  function stopRun(id) {
    Promise.resolve(db.rpc('crm_automation_stop', { p_run_id: Number(id) })).then(function (r) {
      AU.msg = r && r.error ? '' : 'Stopped for them.'; AU.err = r && r.error ? 'Not stopped: ' + (r.error.message || r.error) : '';
      Promise.all([loadRuns(AU.aid), load('astats', true)]).then(function () { paint(); });
    });
  }
  function previewStep(i) {
    var a = AU.a, s = a && a.steps[i]; if (!s) return;
    var vars = Object.assign({}, ASAMPLE), body = {};
    if (s.email === 'template') body = { template_key: s.template_key, kind: s.kind, vars: vars };
    else body = { template_key: 'newsletter', kind: s.kind, subject: s.subject || '(no subject yet)', preheader: s.preheader || '', vars: Object.assign(vars, { headline: String(s.headline || ''), body_text: String(s.body || ''), body_html: bodyHtml(s.body), cta_label: String(s.cta_label || '').trim() || 'Visit welfareavenue.com', cta_url: String(s.cta_url || '').trim() || 'https://welfareavenue.com' }) };
    if (s.from === 'custom') { body.from_name = s.from_name; body.from_email = s.from_email; }
    var me = (S.contacts || []).filter(function (c) { return c.emails.map(lower).indexOf(myEmail()) >= 0; })[0];
    if (me) body.contact_id = me.id;
    AU.prev = { busy: true }; AU.prevFor = a.id; paint();
    mailFn('preview', body).then(function (r) { AU.prev = r && r.error ? { err: 'The preview did not come back: ' + r.error } : r; paint(); });
  }

  /* ---------- styles ---------- */
  var css157 = document.createElement('style'); css157.id = 'w157css';
  css157.textContent = ''
    + '.w157step{border:1px solid rgba(16,63,57,.14);border-radius:14px;padding:12px;margin:0 0 10px;background:rgba(16,63,57,.025);display:flex;flex-direction:column;gap:6px;}.w157step .w152in,.w157step .w152sel{width:100%;box-sizing:border-box;max-width:none;}'
    + '.w157sh{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto auto;align-items:center;gap:6px;}.w157sh>b{font-family:' + HEAD + ';font-size:18px;color:' + GREEN + ';min-width:18px;}.w157st{display:flex;align-items:center;gap:6px;font-weight:600;color:' + GREEN + ';min-width:0;}'
    + '.w157sh .w152mini{padding:5px 7px;}.w157step .w155lb{margin:0;}.w157step textarea{min-height:64px;}.w157step textarea[data-w157s="body"]{min-height:140px;}.w157inline{display:grid;grid-template-columns:140px minmax(0,1fr);gap:10px;align-items:end;}'
    + '.w157pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;}.w157adds{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 14px;}.w157ck{align-self:end;}'
    + '.w157ul,.w157ol,.w157hist{margin:6px 0 10px 18px;padding:0;}.w157ul li,.w157ol li,.w157hist li{margin:0 0 6px;font-size:13.5px;line-height:1.45;}.w157tr{font-weight:600;color:' + GREEN + ';margin:0 0 4px;font-size:13.5px;}'
    + '.w157next{display:block;font-size:12.5px;font-weight:400;overflow:hidden;text-overflow:ellipsis;}'
    + '@media (max-width:700px){.w157sh{grid-template-columns:auto minmax(0,1fr) auto auto auto;}.w157sh .w156sp{display:none;}.w157inline,.w157pair{grid-template-columns:1fr;}}';
  document.head.appendChild(css157);

  /* ---------- wiring ---------- */
  function stepAt(el) { var box = el.closest('[data-w157si]'); return box ? Number(box.getAttribute('data-w157si')) : -1; }
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('.w152root')) return;
    var a = AU.a;
    if ((el = t.closest('[data-w157new]'))) { e.preventDefault(); newAuto(); return; }
    if ((el = t.closest('[data-w157open]'))) { e.preventDefault(); AU.msg = ''; AU.err = ''; go('#crm/automations/' + el.getAttribute('data-w157open')); return; }
    if ((el = t.closest('[data-w157people]'))) { e.preventDefault(); AU.err = ''; go('#crm/automations/' + el.getAttribute('data-w157people') + '/people'); return; }
    if ((el = t.closest('[data-w157back]'))) { e.preventDefault(); AU.a = null; AU.confirm = ''; AU.prev = null; go('#crm/automations'); return; }
    if ((el = t.closest('[data-w157run]'))) { e.preventDefault(); var rid = el.getAttribute('data-w157run'); AU.openRun = AU.openRun === rid ? null : rid; paint(); return; }
    if ((el = t.closest('[data-w157tests]'))) { e.preventDefault(); AU.showTests = !AU.showTests; paint(); return; }
    if ((el = t.closest('[data-w157stop]'))) { e.preventDefault(); el.disabled = true; stopRun(el.getAttribute('data-w157stop')); return; }
    if (!a) return;
    if ((el = t.closest('[data-w157add]'))) { e.preventDefault(); a.steps.push(newStep(el.getAttribute('data-w157add'), a)); paint(); var cards = document.querySelectorAll('#crm .w157step'); if (cards.length) cards[cards.length - 1].scrollIntoView({ block: 'center' }); return; }
    if ((el = t.closest('[data-w157mv]'))) { e.preventDefault(); var i = stepAt(el), j = i + Number(el.getAttribute('data-w157mv')); if (i < 0 || j < 0 || j >= a.steps.length) return; var tmp = a.steps[i]; a.steps[i] = a.steps[j]; a.steps[j] = tmp; paint(); return; }
    if ((el = t.closest('[data-w157dela]'))) { e.preventDefault(); AU.confirm = 'delete'; paint(); return; }
    if ((el = t.closest('[data-w157del]'))) { e.preventDefault(); var k = stepAt(el); if (k >= 0) a.steps.splice(k, 1); paint(); return; }
    if ((el = t.closest('[data-w157pv]'))) { e.preventDefault(); previewStep(Number(el.getAttribute('data-w157pv'))); return; }
    if ((el = t.closest('[data-w157pvclose]'))) { e.preventDefault(); AU.prev = null; paint(); return; }
    if ((el = t.closest('[data-w157save]'))) { e.preventDefault(); saveAuto().then(function (id) { if (id) { AU.msg = 'Saved.'; paint(); } }); return; }
    if ((el = t.closest('[data-w157on]'))) { e.preventDefault(); checkAndConfirm(); return; }
    if ((el = t.closest('[data-w157onok]'))) { e.preventDefault(); el.disabled = true; setAutoStatus('on'); return; }
    if ((el = t.closest('[data-w157pause]'))) { e.preventDefault(); setAutoStatus('paused'); return; }
    if ((el = t.closest('[data-w157try]'))) { e.preventDefault(); tryAuto(); return; }
    if ((el = t.closest('[data-w157delok]'))) { e.preventDefault(); delAuto(); return; }
    if ((el = t.closest('[data-w157no]'))) { e.preventDefault(); AU.confirm = ''; paint(); return; }
  });
  function onAuto157(e) {
    var t = e.target, a = AU.a; if (!a || !t || !t.closest || !t.closest('.w152root')) return;
    var key, i, s;
    if (t.hasAttribute('data-w157k')) { a[t.getAttribute('data-w157k')] = t.value; return; }
    if (t.hasAttribute('data-w157set')) { a.settings[t.getAttribute('data-w157set')] = t.type === 'checkbox' ? t.checked : t.value; return; }
    if (t.hasAttribute('data-w157t')) {
      key = t.getAttribute('data-w157t'); a.trigger[key] = t.type === 'checkbox' ? t.checked : t.value;
      if (key === 'kind' && e.type === 'change') { a.trigger = { kind: t.value }; if (t.value === 'serving') { a.trigger.days_before = 2; a.trigger.location = 'Montreal'; } paint(); }
      else if (e.type === 'change') paint();
      return;
    }
    if (t.hasAttribute('data-w157s')) {
      i = stepAt(t); if (i < 0) return; s = a.steps[i]; key = t.getAttribute('data-w157s');
      if (key === '_email') { if (t.value === 'write') { s.email = 'write'; delete s.template_key; } else { s.email = 'template'; s.template_key = t.value.slice(4); } paint(); return; }
      s[key] = t.type === 'checkbox' ? t.checked : t.value;
      if (e.type === 'change' && (t.tagName === 'SELECT')) paint();
    }
  }
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.tagName !== 'SELECT' && t.type !== 'checkbox') onAuto157(e); });
  document.addEventListener('change', function (e) { var t = e.target; if (t && (t.tagName === 'SELECT' || t.type === 'checkbox')) onAuto157(e); });
