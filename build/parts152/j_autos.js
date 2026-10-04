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
  var AU = { sel: null, dirty: false, ins: null, rowMenu: null, edMenu: false, newFolder: null, newFolders: [], closed: {}, renaming: null, cto: '', aid: null, a: null, sub: '', msg: '', err: '', busy: '', confirm: '', problems: null, runs: null, runsFor: null, openRun: null, showTests: true, prev: null, prevFor: null };
  LOADERS.autos = function () { return db.from('crm_automations').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).order('id', { ascending: true }); };
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

  /* ---------- the list (wave196: folders, your own order, drag and drop) ----------
     Steel (02/10/26): "reshape how the automation page is to make it easier to move round automations in the CRM and make
     the user interface really easy to use". Automations sit in folders (crm_automations.folder) in the order the team
     drags them into (sort_order, saved in one call by crm_automations_arrange); each row also has Move up, Move down, Move
     to a folder and Duplicate for the keyboard and phones. */
  function autoOrder() {
    return (S.autos || []).slice().sort(function (x, y) {
      var a = x.sort_order == null ? 1e9 : Number(x.sort_order), b = y.sort_order == null ? 1e9 : Number(y.sort_order);
      return a - b || String(x.created_at || '').localeCompare(String(y.created_at || '')) || Number(x.id) - Number(y.id);
    });
  }
  /* the folders in the order of their first automation, then the empty ones made here; '' is "not in a folder" */
  function autoGroups() {
    var order = autoOrder(), names = [], by = {};
    order.forEach(function (a) { var f = String(a.folder || ''); if (!by[f]) { by[f] = []; names.push(f); } by[f].push(a); });
    (AU.newFolders || []).forEach(function (f) { if (!by[f]) { by[f] = []; names.push(f); } });
    if (!by['']) { by[''] = []; }
    names = names.filter(function (f) { return f !== ''; });
    names.push('');
    return names.map(function (f) { return { name: f, items: by[f] }; });
  }
  function autoRow(a, gi, ri, n) {
    var st = astat(a.id), sends = (a.steps || []).filter(function (s) { return s.type === 'send'; }).length, menu = AU.rowMenu === String(a.id);
    var folders = autoGroups().map(function (g) { return g.name; }).filter(Boolean);
    return '<div class="w156row w196row" role="listitem" draggable="true" data-w196row="' + E(a.id) + '">' +
      '<span class="w196grip" title="Drag to move" aria-hidden="true">' + I('grip') + '</span>' +
      '<div class="w156nm"><button class="w155cn" data-w157open="' + E(a.id) + '"><b>' + E(a.name) + '</b></button>' +
      '<span class="m">' + E(trigText(a.trigger)) + '</span><span class="m">' + plural((a.steps || []).length, 'step', 'steps') + (sends ? ' · ' + plural(sends, 'email', 'emails') : '') + '</span></div>' +
      '<div class="w196chip">' + lchip(ASTAT, a.status) + '</div>' +
      '<div class="w156meta">' + plural(Number(st.active) || 0, 'person in it now', 'people in it now') + '<span class="m"> · ' + (Number(st.done) || 0) + ' finished · ' + plural(Number(st.emails_sent) || 0, 'email sent', 'emails sent') + '</span>' +
      (Number(st.errors) ? '<span class="w156warn"> · ' + plural(Number(st.errors), 'needs a look', 'need a look') + '</span>' : '') + '</div>' +
      '<div class="w155ra"><button class="w152btn sm ghost" data-w157open="' + E(a.id) + '">' + I('edit') + ' Open</button><button class="w152btn sm ghost" data-w157people="' + E(a.id) + '">' + I('people') + ' People</button>' +
      '<span class="w196mw"><button class="w152btn sm ghost w196more" data-w196rowmenu="' + E(a.id) + '" aria-expanded="' + menu + '" aria-label="More for ' + E(a.name) + '">' + I('more') + '</button>' +
      (menu ? '<div class="w196menu" role="menu">' +
        '<button role="menuitem" data-w196mv="-1" data-w196id="' + E(a.id) + '"' + (gi === 0 && ri === 0 ? ' disabled' : '') + '>' + I('up') + ' Move up</button>' +
        '<button role="menuitem" data-w196mv="1" data-w196id="' + E(a.id) + '"' + (ri === n - 1 && gi === autoGroups().length - 1 ? ' disabled' : '') + '>' + I('down') + ' Move down</button>' +
        '<label class="w196mf">Move to a folder<select class="w152sel" data-w196tofolder="' + E(a.id) + '"><option value="__">Choose…</option>' +
          folders.concat(a.folder ? [''] : []).filter(function (f) { return f !== String(a.folder || ''); }).map(function (f) { return '<option value="' + E(f) + '">' + E(f || 'Not in a folder') + '</option>'; }).join('') +
          '<option value="__new">A new folder…</option></select></label>' +
        '<button role="menuitem" data-w196dupa="' + E(a.id) + '">' + I('copy') + ' Duplicate</button>' +
      '</div>' : '') + '</span></div></div>';
  }
  function groupHtml(g, gi, all) {
    var closed = !!(AU.closed || {})[g.name], ren = AU.renaming === g.name && g.name;
    var head = g.name
      ? '<div class="w196gh" data-w196drop="' + E(g.name) + '">' + '<button class="w196gt" data-w196fold="' + E(g.name) + '" aria-expanded="' + !closed + '">' + I(closed ? 'chevr' : 'chevd') + I('folder') +
          (ren ? '' : '<b>' + E(g.name) + '</b>') + '</button>' +
          (ren ? '<input class="w152in w196ren" data-w196renin="' + E(g.name) + '" value="' + E(g.name) + '" aria-label="The folder’s name"><button class="w152btn sm" data-w196renok="' + E(g.name) + '">Save</button><button class="w152btn sm ghost" data-w196renno="1">Cancel</button>'
            : '<span class="w155sub">' + plural(g.items.length, 'automation', 'automations') + '</span><span class="w156sp"></span><button class="w152mini" data-w196rename="' + E(g.name) + '">' + I('edit') + ' Rename</button>' +
              (g.items.length ? '<button class="w152mini" data-w196unfold="' + E(g.name) + '" title="Its automations go back to Not in a folder">' + I('x') + ' Remove the folder</button>' : '<button class="w152mini" data-w196unfold="' + E(g.name) + '">' + I('x') + ' Remove</button>')) + '</div>'
      : (all.length > 1 ? '<div class="w196gh none" data-w196drop=""><span class="w196gt">' + I('list') + '<b>Not in a folder</b></span><span class="w155sub">' + plural(g.items.length, 'automation', 'automations') + '</span></div>' : '');
    if (!g.name && all.length > 1 && !g.items.length) return '<section class="w196grp" data-w196g="">' + head + '<div class="w196zone" data-w196drop="">Drag an automation here to take it out of its folder</div></section>';
    return '<section class="w196grp' + (closed ? ' shut' : '') + '" data-w196g="' + E(g.name) + '">' + head +
      (closed ? '' : g.items.length ? '<div class="w155rows" role="list">' + g.items.map(function (a, ri) { return autoRow(a, gi, ri, g.items.length); }).join('') + '</div>'
        : '<div class="w196zone" data-w196drop="' + E(g.name) + '">Drag an automation here, or use More › Move to a folder</div>') + '</section>';
  }
  function autosListHtml() {
    var as = S.autos || [], live = !!(MAIL.st && MAIL.st.settings && MAIL.st.settings.mail_mode === 'live'), groups = autoGroups();
    return '<div class="w155grid"><div class="w154card wide"><h3>' + I('bolt') + ' Automations <span class="w155sub">' + plural(as.length, 'automation', 'automations') + '</span></h3>' +
      '<p class="m">An automation runs by itself for each person: when they fill in a form, get a tag or give, or before a serving they signed up for. It sends emails through the permission rule, only between 8 am and 8 pm (Toronto), and it can tag, make a task on a team’s board or notify someone. New ones start as drafts; Try it on me runs one on your own contact first.</p>' +
      (!live ? '<div class="w155cf test">' + I('lock') + ' The Hub is in test mode: an automation that is on still runs, but its emails only reach the test addresses until an admin switches the mode to live in the Email tab.</div>' : '') +
      (AU.msg ? '<div class="w154msg">' + E(AU.msg) + '</div>' : '') + (AU.err ? '<div class="w152err">' + E(AU.err) + '</div>' : '') +
      '<div class="w154acts"><button class="w152btn" data-w157new="1">' + I('plus') + ' New automation</button>' +
      (AU.newFolder != null ? '<span class="w196nf"><input class="w152in" data-w196nfin="1" value="' + E(AU.newFolder) + '" placeholder="Volunteers, Donors, Newsletter…" aria-label="The new folder’s name"><button class="w152btn sm" data-w196nfok="1">Make it</button><button class="w152btn sm ghost" data-w196nfno="1">Cancel</button></span>'
        : '<button class="w152btn ghost" data-w196nf="1">' + I('folder') + ' New folder</button>') +
      (as.length > 1 ? '<span class="m w196hint">' + I('grip') + ' Drag an automation by its handle to move it, or into a folder.</span>' : '') + '</div>' +
      (as.length || groups.length > 1 ? '<div class="w196groups">' + groups.map(function (g, gi) { return groupHtml(g, gi, groups); }).join('') + '</div>' : '<p class="m">No automation yet.</p>') + '</div></div>';
  }
  /* save the order and folders of everything on the page (one call); the page shows it at once */
  function arrange(list, note) {
    var items = list.map(function (x, i) { return { id: Number(x.a.id), folder: x.folder || null, sort: (i + 1) * 10 }; });
    items.forEach(function (it) { var a = autoById(it.id); if (a) { a.sort_order = it.sort; a.folder = it.folder; } });
    AU.err = ''; AU.msg = note || ''; paint();
    return Promise.resolve(db.rpc('crm_automations_arrange', { p_items: items })).then(function (r) {
      if (r && r.error) { AU.msg = ''; AU.err = 'Not moved: ' + (r.error.message || r.error); load('autos', true).then(paint); }
    }).catch(function (e) { AU.msg = ''; AU.err = 'Not moved: ' + String((e && e.message) || e); load('autos', true).then(paint); });
  }
  function flatList() { var out = []; autoGroups().forEach(function (g) { g.items.forEach(function (a) { out.push({ a: a, folder: g.name }); }); }); return out; }
  /* move one automation: before or after another one, or to the end of a folder */
  function moveAuto(id, target) {
    var list = flatList(), from = list.map(function (x) { return String(x.a.id); }).indexOf(String(id));
    if (from < 0) return;
    var it = list.splice(from, 1)[0], at = list.length;
    if (target.beside != null) {
      var k = list.map(function (x) { return String(x.a.id); }).indexOf(String(target.beside));
      if (k < 0) return;
      it.folder = list[k].folder; at = target.after ? k + 1 : k;
    } else {
      it.folder = target.folder || '';
      var last = -1; list.forEach(function (x, i) { if (x.folder === it.folder) last = i; });
      at = last >= 0 ? last + 1 : list.length;
      if (last < 0 && it.folder) { var firstNone = list.map(function (x) { return x.folder; }).indexOf(''); at = firstNone >= 0 ? firstNone : list.length; }
    }
    list.splice(at, 0, it);
    if (it.folder) AU.newFolders = (AU.newFolders || []).filter(function (f) { return f !== it.folder; });
    arrange(list, '“' + it.a.name + '” moved' + (it.folder ? ' (in ' + it.folder + ')' : '') + '.');
  }
  function moveAutoBy(id, d) {
    var list = flatList(), i = list.map(function (x) { return String(x.a.id); }).indexOf(String(id)), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    var it = list[i], other = list[j];
    if (it.folder !== other.folder) { it.folder = other.folder; } else { list[i] = other; list[j] = it; }
    AU.rowMenu = null;
    arrange(list, '\u201c' + it.a.name + '\u201d moved ' + (d < 0 ? 'up' : 'down') + (it.folder ? ' (in ' + it.folder + ')' : '') + '.');
  }
  function setFolder(id, folder) { moveAuto(id, { folder: folder }); }
  function renameFolder(from, to) {
    to = String(to || '').trim(); if (!to || to === from) { AU.renaming = null; paint(); return; }
    var list = flatList().map(function (x) { if (x.folder === from) x.folder = to; return x; });
    AU.newFolders = (AU.newFolders || []).map(function (f) { return f === from ? to : f; });
    AU.renaming = null; if ((AU.closed || {})[from]) { AU.closed[to] = true; delete AU.closed[from]; }
    arrange(list, 'Folder renamed to ' + to + '.');
  }
  function removeFolder(name) {
    AU.newFolders = (AU.newFolders || []).filter(function (f) { return f !== name; });
    var list = flatList(), had = false;
    list.forEach(function (x) { if (x.folder === name) { x.folder = ''; had = true; } });
    if (!had) { paint(); return; }
    /* its automations go to the top of Not in a folder, in their order */
    var moved = list.filter(function (x) { return x.folder === '' && autoById(x.a.id) && String(autoById(x.a.id).folder || '') === name; });
    var rest = list.filter(function (x) { return moved.indexOf(x) < 0; });
    var firstNone = rest.map(function (x) { return x.folder; }).indexOf('');
    if (firstNone < 0) firstNone = rest.length;
    arrange(rest.slice(0, firstNone).concat(moved, rest.slice(firstNone)), 'The folder ' + name + ' is gone; its automations are now not in a folder.');
  }
  function dupAuto(id) {
    var a = autoById(id); if (!a) return;
    AU.busy = 'Duplicating…'; AU.rowMenu = null; paint();
    var row = { name: a.name + ' (copy)', description: a.description || null, status: 'draft', trigger: a.trigger || {}, steps: a.steps || [], settings: a.settings || {}, folder: a.folder || null, sort_order: (Number(a.sort_order) || 0) + 5, created_by: actor(), updated_by: actor() };
    Promise.resolve(db.from('crm_automations').insert(row).select().single()).then(function (r) {
      AU.busy = '';
      if (r && r.error) { AU.err = 'Not duplicated: ' + (r.error.message || r.error); paint(); return; }
      load('autos', true).then(function () { var list = flatList(); arrange(list, 'Duplicated as a draft: “' + row.name + '”, right under the original.'); });
    });
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
      var tpls = [['write', 'Write it here (the Welfare Avenue layout)']].concat((S.templates || []).filter(function (t) { return t.key !== 'test' && t.key !== 'newsletter' && t.active && !t.one_off && !(window.w202 && window.w202.hasBrackets && window.w202.hasBrackets(t)); }).map(function (t) { return ['tpl:' + t.key, 'Saved email: ' + t.name]; }));
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
  /* ---------- the editor as a flow (wave196) ----------
     The trigger and each step are cards in a column, joined by lines with a + to add a step anywhere; drag a card by its
     handle to move it; click a card to edit it in the panel on the right (a sheet from the bottom on a phone). A step can
     be duplicated, copied (then pasted with any +, in this or another automation) or copied straight to another one.
     Wait until opened shows its two paths on the card. After a move, a path that would point back, or a wait that would
     watch an email after it, is put right and said so. */
  var STEPC = { send: TEAL, wait: '#B9851B', wait_open: PURPLE, tag: '#3E7C3A', task: GREEN, notify: '#C2662D', end: MUTED };
  function clip() { try { var c = JSON.parse(localStorage.getItem('wa196clip') || 'null'); return c && c.step && c.step.type ? c : null; } catch (e) { return null; } }
  function setClip(s, from) { try { localStorage.setItem('wa196clip', JSON.stringify({ step: s, from: from || '', at: Date.now() })); } catch (e) { /* fine */ } }
  function stepIdx(a, id) { return a.steps.map(function (x) { return x.id; }).indexOf(id); }
  function pathText(a, v) { if (!v || v === 'next') return 'go on'; if (v === 'end') return 'end'; var j = stepIdx(a, v); return j >= 0 ? 'step ' + (j + 1) : 'a step that is gone'; }
  /* what a card warns about before it is turned on (the database check still decides) */
  function stepWarn(s, i, a) {
    if (s.type === 'send' && s.email !== 'template' && !String(s.subject || '').trim()) return 'No subject yet';
    if (s.type === 'send' && s.email === 'template' && !s.template_key) return 'No email chosen';
    if (s.type === 'wait_open') { var j = stepIdx(a, s.step); if (j < 0 || j >= i || a.steps[j].type !== 'send') return 'Pick an email before it'; }
    if (s.type === 'task' && !String(s.title || '').trim()) return 'No task written';
    if (s.type === 'notify' && !csv(s._to).length) return 'Nobody to notify';
    if (s.type === 'tag' && !csv(s._add).length && !csv(s._rem).length) return 'No tag yet';
    return '';
  }
  function stepTitle(s) {
    if (s.type === 'send') return s.email === 'template' ? tplLabel(s.template_key) : (String(s.subject || '').trim() || 'An email with no subject yet');
    return stepText(s);
  }
  function insHtml(at, a) {
    var open = AU.ins === at, c = clip();
    return '<div class="w196link' + (open ? ' open' : '') + '"><button class="w196plus" data-w196ins="' + at + '" aria-expanded="' + open + '" aria-label="Add a step here" title="Add a step here">' + I('plus') + '</button>' +
      (open ? '<div class="w196addm" role="menu"><p>Add a step here</p>' + Object.keys(ASTEP).map(function (k) { return '<button role="menuitem" data-w157add="' + k + '" data-w196at="' + at + '"><i style="background:' + STEPC[k] + '">' + I(ASTEP[k][1]) + '</i>' + E(ASTEP[k][0]) + '</button>'; }).join('') +
        (c ? '<button role="menuitem" class="paste" data-w196paste="' + at + '"><i style="background:' + GOLD + '">' + I('paste') + '</i>Paste: ' + E(ASTEP[c.step.type] ? ASTEP[c.step.type][0] : 'a step') + (c.from ? ' <span class="m">from ' + E(c.from) + '</span>' : '') + '</button>' : '') + '</div>' : '') + '</div>';
  }
  function flowCard(s, i, a) {
    var d = ASTEP[s.type] || [s.type, 'spark'], sel = AU.sel === i, w = stepWarn(s, i, a);
    var paths = s.type === 'wait_open' ? '<div class="w196paths"><span class="y">' + I('eye') + ' Opened: ' + E(pathText(a, s.yes)) + '</span><span class="n">' + I('x') + ' Not opened: ' + E(pathText(a, s.no)) + '</span></div>' : '';
    var jumpIn = a.steps.some(function (x) { return x.type === 'wait_open' && (x.yes === s.id || x.no === s.id); });
    return '<div class="w157step w196card' + (sel ? ' sel' : '') + (AU.dragStep === i ? ' dragging' : '') + '" data-w157si="' + i + '" data-w196sel="' + i + '" draggable="true" tabindex="0" role="button" aria-pressed="' + sel + '" aria-label="Step ' + (i + 1) + ': ' + E(d[0]) + '">' +
      '<span class="w196grip" title="Drag to move" aria-hidden="true">' + I('grip') + '</span>' +
      '<span class="w196ic" style="background:' + (STEPC[s.type] || MUTED) + '">' + I(d[1]) + '</span>' +
      '<span class="w196tx"><span class="k">' + (i + 1) + ' · ' + E(d[0]) + (jumpIn ? ' <span class="w196jin" title="A path jumps here">' + I('arrow') + '</span>' : '') + '</span><b>' + E(stepTitle(s)) + '</b>' + paths +
      (w ? '<span class="w196warn">' + I('alert') + ' ' + E(w) + '</span>' : '') + '</span>' +
      '<span class="w196go" aria-hidden="true">' + I('chevr') + '</span></div>';
  }
  function flowHtml(a) {
    var t = a.trigger || {}, tsel = AU.sel === 't';
    var h = '<div class="w196flow" data-w196flow="1">' +
      '<div class="w196card trig' + (tsel ? ' sel' : '') + '" data-w196sel="t" tabindex="0" role="button" aria-pressed="' + tsel + '"><span class="w196ic">' + I('bolt') + '</span><span class="w196tx"><span class="k">When it starts</span><b>' + E(t.kind ? trigText(t) : 'Pick what starts it') + '</b>' +
        (!t.kind ? '<span class="w196warn">' + I('alert') + ' Not chosen yet</span>' : '') + '</span><span class="w196go" aria-hidden="true">' + I('chevr') + '</span></div>';
    a.steps.forEach(function (s, i) { h += insHtml(i, a) + flowCard(s, i, a); });
    h += insHtml(a.steps.length, a) + '<div class="w196end">' + (a.steps.length ? 'Done: they leave the automation' : 'Add the first step with the +') + '</div></div>';
    return h;
  }
  function panelActs(i, a) {
    var s = a.steps[i], others = (S.autos || []).filter(function (x) { return String(x.id) !== String(a.id); });
    return '<div class="w196pa">' +
      (s.type === 'send' ? '<button class="w152btn sm ghost" data-w157pv="' + i + '">' + I('eye') + ' Preview</button>' : '') +
      '<button class="w152btn sm ghost" data-w196dup="' + i + '">' + I('copy') + ' Duplicate</button>' +
      '<button class="w152btn sm ghost" data-w196copy="' + i + '">' + I('paste') + ' Copy</button>' +
      (others.length ? '<label class="w196cto">Copy to' + auSel('data-w196cto="' + i + '"', [['', 'Another automation…']].concat(others.map(function (x) { return [String(x.id), x.name + (x.status === 'on' ? ' (on)' : '')]; })), '', 'Copy this step to another automation') + '</label>' : '') +
      '<span class="w156sp"></span>' +
      '<button class="w152mini" data-w157mv="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + I('up') + '</button><button class="w152mini" data-w157mv="1" aria-label="Move down"' + (i < a.steps.length - 1 ? '' : ' disabled') + '>' + I('down') + '</button>' +
      '<button class="w152mini danger" data-w157del="1" aria-label="Remove the step">' + I('trash') + ' Remove</button></div>';
  }
  function panelHtml(a) {
    var p = AU.prev;
    if (p && AU.prevFor === a.id) return '<div class="w196panel" data-w196panel="1"><div class="w196ph"><b>' + I('mail') + ' Preview</b><button class="w152mini" data-w157pvclose="1">' + I('x') + ' Close</button></div>' + (p.busy ? busy('Rendering the preview…') : p.err ? '<div class="w152err">' + E(p.err) + '</div>'
      : '<div class="w154pv"><div class="m">From: ' + E(p.from || '') + '<br>Subject: <b>' + E(p.subject || '') + '</b>' + (p.preheader ? '<br>Preview text: ' + E(p.preheader) : '') + '<br>Shown with sample details; each person gets their own name.</div><iframe class="w154frame" sandbox="" title="The email as it will look" srcdoc="' + E(p.html || '') + '"></iframe></div>') +
      '<div class="w154acts"><button class="w152btn sm ghost" data-w157pvclose="1">Back to the step</button></div></div>';
    if (AU.sel === 't') return '<div class="w196panel" data-w196panel="1"><div class="w196ph"><b>' + I('bolt') + ' When it starts</b><button class="w152mini w196x" data-w196close="1" aria-label="Close">' + I('x') + '</button></div>' + trigHtml(a) +
      '<label class="w155lb">What it is for (optional)<textarea class="w152in" data-w157k="description" rows="3" placeholder="So the team knows why it exists">' + E(a.description || '') + '</textarea></label></div>';
    if (typeof AU.sel === 'number' && a.steps[AU.sel]) {
      var i = AU.sel, s = a.steps[i], d = ASTEP[s.type] || [s.type, 'spark'];
      return '<div class="w196panel" data-w196panel="1"><div class="w196ph"><b><span class="w196ic sm" style="background:' + (STEPC[s.type] || MUTED) + '">' + I(d[1]) + '</span> Step ' + (i + 1) + ': ' + E(d[0]) + '</b><button class="w152mini w196x" data-w196close="1" aria-label="Close">' + I('x') + '</button></div>' +
        panelActs(i, a) + (AU.cto ? '<div class="w155cf">' + AU.cto + '</div>' : '') + '<div class="w157step w196body" data-w157si="' + i + '">' + stepBody(s, i, a) + '</div></div>';
    }
    /* nothing chosen: the outline in plain words */
    return '<div class="w196panel quiet w157flow" data-w196panel="1"><div class="w196ph"><b>' + I('list') + ' In plain words</b></div><p class="w157tr">' + E(trigText(a.trigger)) + ':</p><ol class="w157ol">' +
      a.steps.map(function (s, i) {
        var extra = s.type === 'wait_open' ? ' If opened: ' + pathText(a, s.yes) + '. If not: ' + pathText(a, s.no) + '.' : '';
        return '<li>' + E(stepText(s) + '.' + extra) + '</li>';
      }).join('') + '</ol><p class="m">Click a card to change it, drag a card by its handle to move it, and use + to add a step anywhere.</p></div>';
  }
  function autoEditorHtml() {
    var a = AU.a, st = astat(a.id), n = (Number(st.active) || 0) + (Number(st.done) || 0) + (Number(st.stopped) || 0) + (Number(st.errors) || 0), more = AU.edMenu;
    return '<div class="w196ed">' +
      '<div class="w196top"><button class="w196back" data-w157back="1">' + I('arrow') + ' Automations</button>' +
        '<input class="w196name" data-w157k="name" value="' + E(a.name || '') + '" placeholder="Name the automation" aria-label="The automation’s name">' + lchip(ASTAT, a.status) +
        '<span class="w196dirty' + (AU.dirty ? ' on' : '') + '">' + (AU.busy ? E(AU.busy) : AU.dirty ? 'Unsaved changes' : a.id ? 'All changes saved' : '') + '</span>' +
        '<span class="w196tb"><button class="w152btn' + (AU.dirty ? '' : ' ghost') + '" data-w157save="1">' + I('check') + ' Save</button>' +
        (a.id && a.status !== 'on' ? '<button class="w152btn ghost" data-w157on="1">' + I('play') + ' Turn on…</button>' : '') +
        (a.status === 'on' ? '<button class="w152btn ghost" data-w157pause="1">' + I('pause') + ' Pause</button>' : '') +
        (a.id ? '<button class="w152btn ghost" data-w157try="1">' + I('spark') + ' Try it on me</button><button class="w152btn ghost" data-w157people="' + E(a.id) + '">' + I('people') + ' People (' + n + ')</button>' : '') +
        '<span class="w196mw"><button class="w152btn ghost w196more" data-w196edmenu="1" aria-expanded="' + !!more + '" aria-label="More">' + I('more') + '</button>' +
        (more ? '<div class="w196menu right" role="menu">' + (a.id ? '<button role="menuitem" data-w196dupa="' + E(a.id) + '">' + I('copy') + ' Duplicate the automation</button>' : '') +
          (a.id && a.status === 'draft' ? '<button role="menuitem" data-w157dela="1">' + I('trash') + ' Delete the draft</button>' : '') + '</div>' : '') + '</span></span></div>' +
      (AU.err ? '<div class="w152err">' + E(AU.err) + '</div>' : '') + (AU.msg ? '<div class="w154msg">' + E(AU.msg) + '</div>' : '') +
      (AU.confirm === 'leave' ? '<div class="w155cf test"><b>You have changes that are not saved.</b><div class="w154acts"><button class="w152btn" data-w196saveback="1">' + I('check') + ' Save and go back</button><button class="w152btn ghost" data-w196leave="1">Leave without saving</button><button class="w152btn ghost" data-w157no="1">Stay</button></div></div>' : autoConfirmHtml(a)) +
      '<div class="w196cols' + (AU.sel != null || AU.prev ? ' has' : '') + '">' + flowHtml(a) + panelHtml(a) + '</div></div>';
  }
  function autoSideHtml() { return ''; }

  /* ---------- moving steps, and keeping the paths right ---------- */
  function fixPaths(a) {
    var notes = [];
    a.steps.forEach(function (s, i) {
      if (s.type !== 'wait_open') return;
      ['yes', 'no'].forEach(function (k) {
        var v = s[k]; if (!v || v === 'next' || v === 'end') return;
        var j = stepIdx(a, v);
        if (j <= i + 1) { s[k] = 'next'; notes.push('Step ' + (i + 1) + ': the path ' + (k === 'yes' ? 'if opened' : 'if not opened') + ' no longer pointed forward, so it now goes on to the next step.'); }
      });
      var w = stepIdx(a, s.step);
      if (s.step && (w < 0 || w >= i)) {
        var prev = a.steps.slice(0, i).filter(function (x) { return x.type === 'send'; }).slice(-1)[0];
        s.step = prev ? prev.id : '';
        notes.push('Step ' + (i + 1) + ' now watches ' + (prev ? 'the email at step ' + (stepIdx(a, prev.id) + 1) : 'no email (add one before it)') + '.');
      }
    });
    return notes;
  }
  function moveStep(from, to) {
    var a = AU.a; if (!a || from === to || from < 0 || to < 0 || from >= a.steps.length) return;
    var s = a.steps.splice(from, 1)[0];
    if (to > from) to--;
    to = Math.max(0, Math.min(a.steps.length, to));
    a.steps.splice(to, 0, s);
    var notes = fixPaths(a);
    AU.sel = to; AU.dirty = true; AU.err = ''; AU.msg = 'Moved to step ' + (to + 1) + '.' + (notes.length ? ' ' + notes.join(' ') : '');
    paint();
  }
  function cloneStep(s, a) {
    var c = JSON.parse(JSON.stringify(s)); c.id = nextStepId(a);
    if (c.type === 'wait_open') { c.yes = 'next'; c.no = 'next'; }
    return c;
  }
  function insertStep(at, s) {
    var a = AU.a; at = Math.max(0, Math.min(a.steps.length, at));
    a.steps.splice(at, 0, s);
    var notes = fixPaths(a);
    AU.sel = at; AU.ins = null; AU.dirty = true; AU.prev = null; AU.msg = notes.length ? notes.join(' ') : '';
    paint();
    var card = document.querySelector('#crm [data-w196sel="' + at + '"]'); if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' });
  }
  /* copy a step straight into another automation (saved there at once, at its end) */
  function copyStepTo(i, toId) {
    var a = AU.a, target = autoById(toId); if (!a || !target) return;
    var src = cleanSteps([a.steps[i]])[0], tsteps = JSON.parse(JSON.stringify(target.steps || []));
    var c = JSON.parse(JSON.stringify(src)), n = 0;
    tsteps.forEach(function (s) { var m = /^s(\d+)$/.exec(s.id || ''); if (m) n = Math.max(n, Number(m[1])); });
    c.id = 's' + (n + 1);
    if (c.type === 'wait_open') { var lastSend = tsteps.filter(function (x) { return x.type === 'send'; }).slice(-1)[0]; c.step = lastSend ? lastSend.id : ''; c.yes = 'next'; c.no = 'next'; }
    tsteps.push(c);
    AU.cto = 'Copying…'; paint();
    Promise.resolve(db.from('crm_automations').update({ steps: tsteps, updated_by: actor() }).eq('id', target.id).select().single()).then(function (r) {
      if (r && r.error) { AU.cto = ''; AU.err = 'Not copied: ' + (r.error.message || r.error); paint(); return; }
      AU.cto = ''; AU.err = '';
      AU.msg = 'Copied to the end of “' + target.name + '”' + (target.status === 'on' ? ', which is on: people who reach the end of it from now get this step too.' : '.');
      load('autos', true).then(paint);
    });
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
    if (id !== AU.aid) { AU.a = null; AU.confirm = ''; AU.err = ''; AU.openRun = null; AU.prev = null; AU.sel = null; AU.dirty = false; AU.ins = null; AU.edMenu = false; AU.cto = ''; if (id) AU.msg = ''; }
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
      AU.dirty = false;
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
    if ((el = t.closest('[data-w157back]'))) { e.preventDefault(); if (AU.a && AU.dirty) { AU.confirm = 'leave'; paint(); return; } AU.a = null; AU.confirm = ''; AU.prev = null; AU.sel = null; go('#crm/automations'); return; }
    if ((el = t.closest('[data-w157run]'))) { e.preventDefault(); var rid = el.getAttribute('data-w157run'); AU.openRun = AU.openRun === rid ? null : rid; paint(); return; }
    if ((el = t.closest('[data-w157tests]'))) { e.preventDefault(); AU.showTests = !AU.showTests; paint(); return; }
    if ((el = t.closest('[data-w157stop]'))) { e.preventDefault(); el.disabled = true; stopRun(el.getAttribute('data-w157stop')); return; }
    if (!a) return;
    if ((el = t.closest('[data-w157add]'))) { e.preventDefault(); var at = el.hasAttribute('data-w196at') ? Number(el.getAttribute('data-w196at')) : a.steps.length; insertStep(at, newStep(el.getAttribute('data-w157add'), a)); return; }
    if ((el = t.closest('[data-w157mv]'))) { e.preventDefault(); var i = stepAt(el), dv = Number(el.getAttribute('data-w157mv')); if (i < 0 || i + dv < 0 || i + dv >= a.steps.length) return; moveStep(i, dv > 0 ? i + 2 : i - 1); return; }
    if ((el = t.closest('[data-w157dela]'))) { e.preventDefault(); AU.confirm = 'delete'; paint(); return; }
    if ((el = t.closest('[data-w157del]'))) { e.preventDefault(); var k = stepAt(el); if (k >= 0) { a.steps.splice(k, 1); var nts = fixPaths(a); AU.sel = null; AU.prev = null; AU.dirty = true; AU.msg = 'Step ' + (k + 1) + ' removed.' + (nts.length ? ' ' + nts.join(' ') : ''); } paint(); return; }
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
    if (t.hasAttribute('data-w157k')) { a[t.getAttribute('data-w157k')] = t.value; markDirty(); return; }
    if (t.hasAttribute('data-w157set')) { a.settings[t.getAttribute('data-w157set')] = t.type === 'checkbox' ? t.checked : t.value; markDirty(); return; }
    if (t.hasAttribute('data-w157t')) {
      key = t.getAttribute('data-w157t'); a.trigger[key] = t.type === 'checkbox' ? t.checked : t.value; markDirty();
      if (key === 'kind' && e.type === 'change') { a.trigger = { kind: t.value }; if (t.value === 'serving') { a.trigger.days_before = 2; a.trigger.location = 'Montreal'; } paint(); }
      else if (e.type === 'change') paint();
      return;
    }
    if (t.hasAttribute('data-w157s')) {
      i = stepAt(t); if (i < 0) return; s = a.steps[i]; key = t.getAttribute('data-w157s'); markDirty();
      if (key === '_email') { if (t.value === 'write') { s.email = 'write'; delete s.template_key; } else { s.email = 'template'; s.template_key = t.value.slice(4); } paint(); return; }
      s[key] = t.type === 'checkbox' ? t.checked : t.value;
      liveTitle(i);
      if (e.type === 'change' && (t.tagName === 'SELECT')) paint();
    }
  }
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.tagName !== 'SELECT' && t.type !== 'checkbox') onAuto157(e); });
  document.addEventListener('change', function (e) { var t = e.target; if (t && (t.tagName === 'SELECT' || t.type === 'checkbox')) onAuto157(e); });
  /* ---------- wave196: styles for the list and the flow ---------- */
  P.grip = '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>';
  P.more = '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>';
  P.folder = '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>';
  P.chevr = '<path d="m9.5 6 6 6-6 6"/>'; P.chevd = '<path d="m6 9.5 6 6 6-6"/>';
  P.paste = '<rect x="8" y="8" width="11.5" height="12.5" rx="2"/><path d="M5 15.5V5.5a2 2 0 0 1 2-2h8"/>';
  var css196 = document.createElement('style'); css196.id = 'w196css';
  css196.textContent = ''
    /* the list */
    + '.w196groups{display:flex;flex-direction:column;gap:12px;margin-top:6px;}'
    + '.w196grp{border-radius:16px;}.w196grp.dropin{outline:2px dashed ' + GOLD + ';outline-offset:3px;}'
    + '.w196gh{display:flex;align-items:center;gap:8px;padding:6px 4px;border-radius:12px;min-height:36px;}.w196gh.dropin{background:rgba(220,165,39,.16);}'
    + '.w196gh.none{opacity:.85;}'
    + '.w196gt{display:inline-flex;align-items:center;gap:7px;border:none;background:none;padding:4px 6px;border-radius:9px;color:' + GREEN + ';font:700 14px ' + BODY + ';cursor:pointer;}.w196gt:hover{background:rgba(16,63,57,.06);}.w196gt b{font-size:14.5px;}'
    + 'span.w196gt{cursor:default;}span.w196gt:hover{background:none;}'
    + '.w196ren{max-width:240px;}'
    + '.w196zone{border:1.5px dashed rgba(16,63,57,.25);border-radius:12px;padding:14px;text-align:center;color:' + MUTED + ';font-size:13px;}.w196zone.dropin{background:rgba(220,165,39,.14);border-color:' + GOLD + ';color:' + INK + ';}'
    + '.w196row{grid-template-columns:22px minmax(0,1fr) auto auto !important;grid-template-areas:"grip nm chip acts" "grip meta meta meta";align-items:center !important;position:relative;padding:12px 6px !important;border-radius:12px;}'
    + '.w196row:hover{background:rgba(16,63,57,.03);}.w196row>.w196grip{grid-area:grip;align-self:stretch;}.w196row>.w156nm{grid-area:nm;}.w196row>.w196chip{grid-area:chip;}.w196row>.w156meta{grid-area:meta;font-size:13px;}.w196row>.w155ra{grid-area:acts;display:flex;gap:4px;justify-content:flex-end;}'
    + '.w196grip{display:inline-flex;align-items:center;justify-content:center;color:rgba(16,63,57,.38);cursor:grab;}.w196grip .w152i{width:18px;height:18px;}'
    + '.w196row:hover .w196grip,.w196card:hover .w196grip{color:' + GREEN + ';}'
    + '.w196row.dragging,.w196card.dragging{opacity:.4;}'
    + '.w196row.dropb{box-shadow:inset 0 3px 0 ' + GOLD + ';}.w196row.dropa{box-shadow:inset 0 -3px 0 ' + GOLD + ';}'
    + '.w196mw{position:relative;display:inline-flex;}'
    + '.w196more{padding-left:9px !important;padding-right:9px !important;}'
    + '.w196menu{position:absolute;top:calc(100% + 6px);right:0;z-index:30;min-width:230px;background:' + CREAM + ';border:1px solid rgba(16,63,57,.14);border-radius:14px;box-shadow:0 14px 34px rgba(16,63,57,.18);padding:6px;display:flex;flex-direction:column;gap:2px;}'
    + '.w196menu>button{display:flex;align-items:center;gap:8px;border:none;background:none;text-align:left;padding:8px 10px;border-radius:9px;font:500 13px ' + BODY + ';color:' + INK + ';cursor:pointer;}.w196menu>button:hover:not([disabled]){background:rgba(16,63,57,.07);}.w196menu>button[disabled]{opacity:.4;cursor:default;}'
    + '.w196mf{display:flex;flex-direction:column;gap:4px;padding:6px 10px 8px;font:600 11px ' + BODY + ';letter-spacing:.6px;text-transform:uppercase;color:' + MUTED + ';}.w196mf select{width:100%;text-transform:none;letter-spacing:0;}'
    + '.w196nf{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;}.w196nf .w152in{width:240px;}'
    + '.w196hint{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;}.w196hint .w152i{width:15px;height:15px;}'
    /* the editor */
    + '.w196ed{display:flex;flex-direction:column;gap:12px;grid-column:1 / -1;}'
    + '.w196top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--wa-card,#FFFAF2);border:1px solid rgba(16,63,57,.10);border-radius:18px;padding:10px 12px;position:sticky;top:8px;z-index:20;box-shadow:0 6px 18px rgba(16,63,57,.06);}'
    + '.w196back{display:inline-flex;align-items:center;gap:6px;border:none;background:rgba(16,63,57,.06);color:' + GREEN + ';border-radius:999px;padding:7px 12px;font:600 12.5px ' + BODY + ';cursor:pointer;}.w196back .w152i{transform:rotate(180deg);}'
    + '.w196name{flex:1 1 260px;min-width:0;border:1px solid transparent;background:none;border-radius:10px;padding:6px 8px;font:700 19px ' + BODY + ';color:' + GREEN + ';}.w196name:hover{border-color:rgba(16,63,57,.15);}.w196name:focus{outline:none;border-color:' + GOLD + ';background:' + CREAM + ';}'
    + '.w196dirty{font-size:12px;color:' + MUTED + ';}.w196dirty.on{color:#8a5a00;font-weight:700;}'
    + '.w196tb{display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center;margin-left:auto;}'
    + '.w196cols{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start;}'
    + '.w196cols.has{grid-template-columns:minmax(0,1fr) minmax(340px,440px);}'
    + '@media (min-width:1101px){.w196cols:not(.has){grid-template-columns:minmax(0,1fr) minmax(300px,380px);}}'
    + '.w196flow{display:flex;flex-direction:column;align-items:stretch;max-width:560px;width:100%;margin:0 auto;padding:6px 0 30px;}'
    + '.w196card{display:grid;grid-template-columns:18px 38px minmax(0,1fr) 16px;align-items:center;gap:10px;background:' + CREAM + ';border:1.5px solid rgba(16,63,57,.12);border-radius:16px;padding:12px 12px 12px 8px;cursor:pointer;box-shadow:0 2px 8px rgba(16,63,57,.05);transition:border-color .15s,box-shadow .15s;margin:0;}'
    + '.w196card:hover{border-color:rgba(16,63,57,.32);}.w196card.sel{border-color:' + GOLD + ';box-shadow:0 0 0 3px rgba(220,165,39,.25);}'
    + '.w196card:focus-visible{outline:3px solid ' + GOLD + ';outline-offset:2px;}'
    + '.w196card.trig{grid-template-columns:38px minmax(0,1fr) 16px;background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';padding-left:12px;}.w196card.trig .k{color:' + GOLD + ';}.w196card.trig b{color:' + CREAM + ';}.w196card.trig .w196ic{background:rgba(255,250,242,.16);}'
    + '.w196card.trig.sel{box-shadow:0 0 0 3px rgba(220,165,39,.45);}'
    + '.w196ic{width:38px;height:38px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;color:' + CREAM + ';flex:0 0 auto;}.w196ic .w152i{width:19px;height:19px;}.w196ic.sm{width:24px;height:24px;border-radius:8px;vertical-align:middle;margin-right:4px;}.w196ic.sm .w152i{width:14px;height:14px;}'
    + '.w196tx{display:flex;flex-direction:column;gap:2px;min-width:0;}.w196tx .k{font:700 10.5px ' + BODY + ';letter-spacing:1.1px;text-transform:uppercase;color:' + MUTED + ';display:flex;align-items:center;gap:4px;}.w196tx b{font-size:14px;color:' + INK + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.w196go{color:rgba(16,63,57,.35);}.w196card.trig .w196go{color:rgba(255,250,242,.6);}'
    + '.w196jin{display:inline-flex;color:' + PURPLE + ';}.w196jin .w152i{width:13px;height:13px;transform:rotate(90deg);}'
    + '.w196warn{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#8a5a00;}.w196warn .w152i{width:14px;height:14px;}.w196card.trig .w196warn{color:' + GOLD + ';}'
    + '.w196paths{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;}.w196paths span{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 8px;}.w196paths .w152i{width:13px;height:13px;}'
    + '.w196paths .y{background:rgba(42,140,122,.12);color:' + TEAL + ';}.w196paths .n{background:rgba(121,119,115,.14);color:#5d5b57;}'
    + '.w196link{position:relative;display:flex;justify-content:center;height:34px;}.w196link:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;background:rgba(16,63,57,.18);transform:translateX(-1px);}'
    + '.w196link.drop:before{background:' + GOLD + ';width:4px;transform:translateX(-2px);}'
    + '.w196plus{position:relative;z-index:1;align-self:center;width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(16,63,57,.25);background:' + CREAM + ';color:' + GREEN + ';display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;opacity:.75;transition:transform .12s,opacity .12s;}'
    + '.w196plus .w152i{width:15px;height:15px;}.w196plus:hover,.w196link.open .w196plus{opacity:1;transform:scale(1.12);background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}'
    + '.w196link.open{height:auto;flex-direction:column;align-items:center;padding:4px 0 8px;}'
    + '.w196addm{position:relative;z-index:2;margin-top:8px;background:' + CREAM + ';border:1px solid rgba(16,63,57,.14);border-radius:16px;box-shadow:0 14px 34px rgba(16,63,57,.16);padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px;width:min(420px,100%);}'
    + '.w196addm p{grid-column:1 / -1;margin:2px 6px 4px;font:700 11px ' + BODY + ';letter-spacing:1px;text-transform:uppercase;color:' + MUTED + ';}'
    + '.w196addm button{display:flex;align-items:center;gap:8px;border:none;background:none;text-align:left;padding:7px 8px;border-radius:10px;font:600 13px ' + BODY + ';color:' + INK + ';cursor:pointer;}.w196addm button:hover{background:rgba(16,63,57,.07);}'
    + '.w196addm button i{width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:' + CREAM + ';flex:0 0 auto;}.w196addm button i .w152i{width:14px;height:14px;}'
    + '.w196addm .paste{grid-column:1 / -1;border-top:1px solid rgba(16,63,57,.08);border-radius:0 0 10px 10px;}'
    + '.w196card.dropb{box-shadow:0 -4px 0 ' + GOLD + ';}.w196card.dropa{box-shadow:0 4px 0 ' + GOLD + ';}'
    + '.w196card,.w196link,.w196plus,.w196row{scroll-margin-top:130px;scroll-margin-bottom:100px;}'
    + '.w196end{align-self:center;margin-top:2px;font-size:12px;font-weight:600;color:' + MUTED + ';background:rgba(16,63,57,.06);border-radius:999px;padding:5px 12px;}'
    + '.w196panel{position:sticky;top:84px;max-height:calc(100vh - 100px);overflow:auto;background:var(--wa-card,#FFFAF2);border:1px solid rgba(16,63,57,.12);border-radius:18px;padding:14px;box-shadow:0 10px 28px rgba(16,63,57,.08);display:flex;flex-direction:column;gap:10px;}'
    + '.w196panel.quiet{background:rgba(16,63,57,.03);box-shadow:none;}'
    + '.w196ph{display:flex;align-items:center;gap:8px;}.w196ph b{display:inline-flex;align-items:center;gap:4px;font:700 17px ' + HEAD + ';text-transform:uppercase;letter-spacing:.3px;color:' + GREEN + ';flex:1 1 auto;}'
    + '.w196pa{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding-bottom:8px;border-bottom:1px solid rgba(16,63,57,.08);}'
    + '.w196cto{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:' + MUTED + ';}.w196cto select{max-width:200px;}'
    + '.w152mini.danger{color:' + FLAG + ';}'
    + '.w196body{border:none !important;background:none !important;padding:0 !important;margin:0 !important;}'
    + '.w196panel .w155two{grid-template-columns:1fr;}'
    + '@media (max-width:1100px){.w196cols.has{grid-template-columns:minmax(0,1fr);}.w196cols.has .w196panel{position:fixed;left:0;right:0;bottom:0;top:auto;max-height:78vh;border-radius:20px 20px 0 0;z-index:120;box-shadow:0 -14px 40px rgba(16,63,57,.25);padding-bottom:calc(14px + env(safe-area-inset-bottom));}'
    + '.w196cols:not(.has) .w196panel{position:static;max-height:none;}}'
    + '@media (max-width:900px){.w196cols.has .w196panel{bottom:74px;max-height:70vh;}.w196top{position:static;box-shadow:none;}.w196name{font-size:19px;flex-basis:100%;order:2;}.w196tb{margin-left:0;order:4;}.w196dirty{order:3;}'
    + '.w196row{grid-template-columns:18px minmax(0,1fr) auto !important;grid-template-areas:"grip nm chip" "grip meta meta" "grip acts acts";}.w196row>.w155ra{justify-content:flex-start;}.w196addm{grid-template-columns:1fr;}}';
  document.head.appendChild(css196);

  /* ---------- wave196: wiring ---------- */
  function markDirty() {
    AU.dirty = true;
    var d = document.querySelector('#crm .w196dirty'); if (d) { d.textContent = 'Unsaved changes'; d.classList.add('on'); }
    var sv = document.querySelector('#crm .w196tb [data-w157save]'); if (sv) sv.classList.remove('ghost');
  }
  function liveTitle(i) {
    var a = AU.a; if (!a || !a.steps[i]) return;
    var card = document.querySelector('#crm .w196card[data-w196sel="' + i + '"] .w196tx b'); if (card) card.textContent = stepTitle(a.steps[i]);
  }
  function closeMenus() { var ch = false; if (AU.rowMenu) { AU.rowMenu = null; ch = true; } if (AU.edMenu) { AU.edMenu = false; ch = true; } return ch; }
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('.w152root')) return;
    var a = AU.a;
    /* menus close on any click outside them */
    if (!t.closest('.w196mw') && closeMenus() && !t.closest('button,a,select,input,textarea,label,[data-w196sel]')) { paint(); return; }
    if ((el = t.closest('[data-w196rowmenu]'))) { e.preventDefault(); var rid = el.getAttribute('data-w196rowmenu'); AU.rowMenu = AU.rowMenu === rid ? null : rid; paint(); return; }
    if ((el = t.closest('[data-w196edmenu]'))) { e.preventDefault(); AU.edMenu = !AU.edMenu; paint(); return; }
    if ((el = t.closest('[data-w196mv]'))) { e.preventDefault(); moveAutoBy(el.getAttribute('data-w196id'), Number(el.getAttribute('data-w196mv'))); return; }
    if ((el = t.closest('[data-w196dupa]'))) { e.preventDefault(); AU.edMenu = false; dupAuto(el.getAttribute('data-w196dupa')); return; }
    if ((el = t.closest('[data-w196nf]'))) { e.preventDefault(); AU.newFolder = ''; AU.pendingMove = null; paint(); var inp = document.querySelector('#crm [data-w196nfin]'); if (inp) inp.focus(); return; }
    if ((el = t.closest('[data-w196nfno]'))) { e.preventDefault(); AU.newFolder = null; AU.pendingMove = null; paint(); return; }
    if ((el = t.closest('[data-w196nfok]'))) {
      e.preventDefault(); var nm = String((document.querySelector('#crm [data-w196nfin]') || {}).value || '').trim();
      if (!nm) return;
      AU.newFolder = null;
      if (AU.pendingMove) { var pm = AU.pendingMove; AU.pendingMove = null; setFolder(pm, nm); return; }
      if (autoGroups().map(function (g) { return g.name; }).indexOf(nm) < 0) AU.newFolders = (AU.newFolders || []).concat([nm]);
      AU.msg = 'Folder ' + nm + ' made: drag automations into it.'; paint(); return;
    }
    if ((el = t.closest('[data-w196fold]'))) { e.preventDefault(); AU.closed = AU.closed || {}; var fn = el.getAttribute('data-w196fold'); AU.closed[fn] = !AU.closed[fn]; paint(); return; }
    if ((el = t.closest('[data-w196rename]'))) { e.preventDefault(); AU.renaming = el.getAttribute('data-w196rename'); paint(); var ri = document.querySelector('#crm [data-w196renin]'); if (ri) { ri.focus(); ri.select(); } return; }
    if ((el = t.closest('[data-w196renno]'))) { e.preventDefault(); AU.renaming = null; paint(); return; }
    if ((el = t.closest('[data-w196renok]'))) { e.preventDefault(); renameFolder(el.getAttribute('data-w196renok'), (document.querySelector('#crm [data-w196renin]') || {}).value); return; }
    if ((el = t.closest('[data-w196unfold]'))) { e.preventDefault(); removeFolder(el.getAttribute('data-w196unfold')); return; }
    if (!a) return;
    if ((el = t.closest('[data-w196saveback]'))) { e.preventDefault(); AU.confirm = ''; saveAuto().then(function (id) { if (id) { AU.dirty = false; AU.a = null; AU.sel = null; go('#crm/automations'); } }); return; }
    if ((el = t.closest('[data-w196leave]'))) { e.preventDefault(); AU.confirm = ''; AU.dirty = false; AU.a = null; AU.sel = null; AU.prev = null; go('#crm/automations'); return; }
    if ((el = t.closest('[data-w196ins]'))) { e.preventDefault(); var at = Number(el.getAttribute('data-w196ins')); AU.ins = AU.ins === at ? null : at; paint(); return; }
    if ((el = t.closest('[data-w196paste]'))) { e.preventDefault(); var c = clip(); if (c) insertStep(Number(el.getAttribute('data-w196paste')), editable(cloneStep(c.step, a))); return; }
    if ((el = t.closest('[data-w196dup]'))) { e.preventDefault(); var di = Number(el.getAttribute('data-w196dup')); insertStep(di + 1, cloneStep(a.steps[di], a)); AU.msg = 'Duplicated: the copy is step ' + (di + 2) + '.'; paint(); return; }
    if ((el = t.closest('[data-w196copy]'))) { e.preventDefault(); var ci = Number(el.getAttribute('data-w196copy')); setClip(cleanSteps([a.steps[ci]])[0], a.name); AU.msg = 'Step ' + (ci + 1) + ' copied. Use + anywhere, in this automation or another one, and choose Paste.'; paint(); return; }
    if ((el = t.closest('[data-w196close]'))) { e.preventDefault(); AU.sel = null; AU.prev = null; paint(); return; }
    if ((el = t.closest('[data-w196sel]')) && !t.closest('button:not([data-w196sel]),a,select,input,textarea')) {
      e.preventDefault(); var v = el.getAttribute('data-w196sel'); AU.sel = v === 't' ? 't' : Number(v); AU.prev = null; AU.ins = null; AU.cto = ''; paint(); return;
    }
  }, true);
  /* a pasted step comes in the editor's own shape (tags and people as text) */
  function editable(s) {
    if (s.type === 'tag') { s._add = csv(s.add).join(', '); s._rem = csv(s.remove).join(', '); }
    if (s.type === 'notify') s._to = csv(s.to).join(', ');
    return s;
  }
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#crm')) return;
    var card = t.closest('[data-w196sel]');
    if (card && t === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var v = card.getAttribute('data-w196sel'); AU.sel = v === 't' ? 't' : Number(v); AU.prev = null; paint(); var p = document.querySelector('#crm .w196panel input,#crm .w196panel select,#crm .w196panel textarea'); if (p) p.focus(); return; }
    if (e.key === 'Escape' && AU.a && (AU.ins != null || AU.sel != null || AU.edMenu)) { AU.ins = null; AU.edMenu = false; if (!t.closest('.w196panel')) AU.sel = null; paint(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.w152root')) return;
    if (t.hasAttribute('data-w196tofolder')) {
      var id = t.getAttribute('data-w196tofolder'), v = t.value; if (v === '__') return;
      AU.rowMenu = null;
      if (v === '__new') { AU.newFolder = ''; AU.pendingMove = id; paint(); var inp = document.querySelector('#crm [data-w196nfin]'); if (inp) inp.focus(); return; }
      setFolder(id, v); return;
    }
    if (t.hasAttribute('data-w196cto') && AU.a && t.value) { copyStepTo(Number(t.getAttribute('data-w196cto')), t.value); return; }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t || !t.hasAttribute) return;
    if (e.key === 'Enter' && t.hasAttribute('data-w196nfin')) { e.preventDefault(); var b = document.querySelector('#crm [data-w196nfok]'); if (b) b.click(); }
    if (e.key === 'Enter' && t.hasAttribute('data-w196renin')) { e.preventDefault(); renameFolder(t.getAttribute('data-w196renin'), t.value); }
  });
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.hasAttribute && t.hasAttribute('data-w196nfin')) AU.newFolder = t.value; });

  /* ---------- wave196: drag and drop (automations in the list, steps in the flow) ---------- */
  var DR = { kind: '', id: null, from: -1, over: null };
  function clearDrop() { Array.prototype.forEach.call(document.querySelectorAll('#crm .dropb,#crm .dropa,#crm .dropin,#crm .w196link.drop,#crm .dragging'), function (x) { x.classList.remove('dropb', 'dropa', 'dropin', 'drop', 'dragging'); }); }
  document.addEventListener('dragstart', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#crm')) return;
    var row = t.closest('[data-w196row]'), card = t.closest('.w196card[data-w157si]');
    if (row) { DR.kind = 'row'; DR.id = row.getAttribute('data-w196row'); row.classList.add('dragging'); }
    else if (card) { DR.kind = 'step'; DR.from = Number(card.getAttribute('data-w157si')); card.classList.add('dragging'); AU.ins = null; }
    else return;
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', DR.kind + ':' + (DR.id || DR.from)); } catch (x) { /* fine */ }
  });
  function rowTarget(e) {
    var t = e.target; if (!t || !t.closest) return null;
    var row = t.closest('[data-w196row]');
    if (row && row.getAttribute('data-w196row') !== DR.id) { var r = row.getBoundingClientRect(); return { el: row, beside: row.getAttribute('data-w196row'), after: e.clientY > r.top + r.height / 2 }; }
    var zone = t.closest('[data-w196drop]'); if (zone) return { el: zone, folder: zone.getAttribute('data-w196drop') };
    return null;
  }
  function stepTarget(e) {
    var t = e.target; if (!t || !t.closest) return null;
    var link = t.closest('.w196link'); if (link) { var b = link.querySelector('[data-w196ins]'); if (b) return { el: link, at: Number(b.getAttribute('data-w196ins')), link: true }; }
    var card = t.closest('.w196card[data-w157si]');
    if (card) { var i = Number(card.getAttribute('data-w157si')), r = card.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2; return { el: card, at: after ? i + 1 : i, after: after }; }
    if (t.closest('.w196card.trig')) return { el: t.closest('.w196card.trig'), at: 0, after: true };
    return null;
  }
  document.addEventListener('dragover', function (e) {
    if (!DR.kind) return;
    var tg = DR.kind === 'row' ? rowTarget(e) : stepTarget(e); if (!tg) return;
    e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (x) { /* fine */ }
    if (DR.over === tg.el && DR.overAfter === tg.after) return;
    clearDrop(); DR.over = tg.el; DR.overAfter = tg.after;
    if (DR.kind === 'step') { var d = document.querySelector('#crm .w196card[data-w157si="' + DR.from + '"]'); if (d) d.classList.add('dragging'); }
    if (tg.link) tg.el.classList.add('drop'); else if (tg.folder != null) tg.el.classList.add('dropin'); else tg.el.classList.add(tg.after ? 'dropa' : 'dropb');
  });
  document.addEventListener('drop', function (e) {
    if (!DR.kind) return;
    var tg = DR.kind === 'row' ? rowTarget(e) : stepTarget(e), kind = DR.kind, id = DR.id, from = DR.from;
    DR.kind = ''; DR.over = null; clearDrop();
    if (!tg) return;
    e.preventDefault();
    if (kind === 'row') { if (tg.beside != null) moveAuto(id, { beside: tg.beside, after: tg.after }); else moveAuto(id, { folder: tg.folder }); }
    else if (AU.a && tg.at !== from && tg.at !== from + 1) moveStep(from, tg.at);
  });
  document.addEventListener('dragend', function () { DR.kind = ''; DR.over = null; clearDrop(); });
