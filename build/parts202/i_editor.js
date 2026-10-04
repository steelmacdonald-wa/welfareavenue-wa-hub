  /* ---------- the editor: settings, the Hub's questions, the checks, the blocks, Ask the Hub, the email beside it ---------- */
  function summary(b) {
    var cut = function (s, n) { s = str(s).replace(/\s+/g, ' ').trim(); return s.length > (n || 60) ? s.slice(0, (n || 60) - 1) + '…' : s; };
    if (b.type === 'hero') return cut((b.lines || []).join(' / ')) || 'No headline yet';
    if (b.type === 'text') return cut(b.text) || 'Empty';
    if (b.type === 'heading') return cut(b.text) || 'Empty';
    if (b.type === 'details') return cut((b.rows || []).map(function (r) { return r.label; }).filter(Boolean).join(', ')) || 'No rows yet';
    if (b.type === 'list') return plural((b.items || []).filter(function (x) { return str(x.text).trim() || str(x.lead).trim(); }).length, 'point', 'points');
    if (b.type === 'button') return cut((b.label || 'A button') + (b.url ? ' → ' + b.url : ' (no link yet)'), 70);
    if (b.type === 'photo') return b.src ? cut(b.caption || b.alt || 'A photo') : 'No photo yet';
    if (b.type === 'photos') return plural((b.items || []).filter(function (x) { return x && x.src; }).length, 'photo', 'photos');
    if (b.type === 'video') return cut(b.title || b.url || 'No link yet');
    if (b.type === 'band') return cut(b.title || b.text) || 'Empty';
    if (b.type === 'quote') return cut(b.quote) || 'Empty';
    if (b.type === 'stats') return cut((b.items || []).map(function (x) { return x.n; }).filter(Boolean).join(' · ')) || 'No numbers yet';
    if (b.type === 'signoff') return cut([b.closing, b.name].filter(Boolean).join(' ')) || 'Sign-off';
    return b.style === 'space' ? 'Space' : 'Gold rule';
  }
  function fv(v) { return E(v == null ? '' : v); }
  function inp(i, path, label, value, o) {
    o = o || {};
    var at = 'data-w202f="' + i + '.' + path + '"';
    var ph = o.ph ? ' placeholder="' + E(o.ph) + '"' : '';
    var ctrl = o.area ? '<textarea class="w152in" ' + at + ' rows="' + (o.rows || 4) + '"' + ph + '>' + fv(value) + '</textarea>' : '<input class="w152in" ' + at + ' value="' + fv(value) + '"' + ph + (o.type ? ' type="' + o.type + '"' : '') + '>';
    return '<label class="w155lb' + (o.half ? ' half' : '') + '">' + E(label) + (o.help ? ' <span class="m">' + E(o.help) + '</span>' : '') + ctrl + '</label>';
  }
  function sel(i, path, label, value, opts) {
    return '<label class="w155lb half">' + E(label) + '<select class="w152sel" data-w202f="' + i + '.' + path + '">' + opts.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function chk(i, path, label, on) { return '<label class="w202ck"><input type="checkbox" data-w202f="' + i + '.' + path + '"' + (on ? ' checked' : '') + '> ' + E(label) + '</label>'; }
  function photoSlot(i, k, p) {
    var at = k == null ? String(i) : i + ',' + k;
    return '<div class="w202slot">' + (p && p.src ? '<img src="' + E(p.src) + '" alt="' + E(p.alt || '') + '">' : '<div class="w202noimg">' + I('image') + '</div>') +
      '<div class="w202slb"><button class="w152btn sm ghost" data-w202pickfor="' + at + '">' + I('image') + (p && p.src ? ' Change' : ' Choose a photo') + '</button>' + (p && p.src ? '<button class="w152btn sm ghost" data-w202rmphoto="' + at + '">' + I('x') + ' Remove</button>' : '') + '</div></div>';
  }
  var TEXTHELP = 'A blank line starts a new paragraph. **bold**, [words](https://link), {{first_name|there}}';
  function blockForm(b, i) {
    var h = '';
    if (b.type === 'hero') {
      h += '<div class="w202two">' + sel(i, 'style', 'Background', b.style, [['cream', 'Cream'], ['green', 'Green card']]) + sel(i, 'doodle', 'Doodle', b.doodle, [['star', 'Star'], ['heart', 'Heart'], ['flowers', 'Flowers'], ['none', 'None']]) + '</div>';
      h += inp(i, 'kicker', 'Small line above', b.kicker, { ph: 'Sunday 12 October · Cabot Square' });
      h += inp(i, 'lines', 'Headline', (b.lines || []).join('\n'), { area: true, rows: 2, help: 'Two short lines; the last one takes the colour', ph: 'Sunday\nneeds you' });
      h += '<div class="w202two">' + sel(i, 'accent', 'Colour of the last line', b.accent, [['gold', 'Gold'], ['purple', 'Purple']]) + '<div class="w155lb half">The E that moves' + chk(i, 'moveE', 'Stretch one E (once per email)', b.moveE !== false) + '</div></div>';
      h += inp(i, 'lead', 'The sentence under it', b.lead, { area: true, rows: 2 });
    }
    if (b.type === 'text') h += inp(i, 'text', 'Text', b.text, { area: true, rows: 7, help: TEXTHELP });
    if (b.type === 'heading') h += inp(i, 'text', 'Heading', b.text);
    if (b.type === 'details' || b.type === 'list' || b.type === 'stats' || b.type === 'band') {
      var field = b.type === 'details' ? 'rows' : b.type === 'band' ? 'links' : 'items', rows = b[field] || [];
      if (b.type === 'band') { h += inp(i, 'title', 'Title', b.title); h += inp(i, 'text', 'Text', b.text, { area: true, rows: 3 }); }
      if (b.type === 'stats') { h += '<div class="w202two">' + sel(i, 'style', 'Background', b.style, [['green', 'Green card'], ['cream', 'Cream with rules']]) + inp(i, 'title', 'Small title', b.title, { half: true, ph: 'Since April 2020' }) + '</div>'; }
      h += '<div class="w202rows">' + rows.map(function (r, k) {
        var a, c;
        if (b.type === 'details') { a = ['label', 'Label', 'When']; c = ['value', 'Value', 'Sunday 12 October, 11 am']; }
        else if (b.type === 'list') { a = ['lead', 'Bold start', 'Cooks:']; c = ['text', 'Text', 'start at 9 am']; }
        else if (b.type === 'stats') { a = ['n', 'Number', '14,000+']; c = ['label', 'What it counts', 'meals served']; }
        else { a = ['label', 'Button words', 'Cooks']; c = ['url', 'Link', 'https://']; }
        return '<div class="w202row"><input class="w152in" data-w202f="' + i + '.' + field + '.' + k + '.' + a[0] + '" value="' + fv(r[a[0]]) + '" placeholder="' + E(a[2]) + '" aria-label="' + E(a[1]) + '">' +
          '<input class="w152in" data-w202f="' + i + '.' + field + '.' + k + '.' + c[0] + '" value="' + fv(r[c[0]]) + '" placeholder="' + E(c[2]) + '" aria-label="' + E(c[1]) + '">' +
          '<button class="w202x sm" data-w202rowdel="' + i + ',' + field + ',' + k + '" aria-label="Remove this row">' + I('x') + '</button></div>';
      }).join('') + '</div>' + ((b.type === 'stats' && rows.length >= 3) ? '' : '<button class="w152btn sm ghost" data-w202rowadd="' + i + ',' + field + '">' + I('plus') + ' Add ' + (b.type === 'details' ? 'a row' : b.type === 'band' ? 'a link' : b.type === 'stats' ? 'a number' : 'a point') + '</button>');
      if (b.type === 'stats') h += inp(i, 'note', 'Small note under the numbers', b.note, { ph: 'Our best estimates from our records, rounded down.' });
    }
    if (b.type === 'button') { h += '<div class="w202two">' + inp(i, 'label', 'Button words', b.label, { half: true }) + inp(i, 'url', 'Link', b.url, { half: true, ph: 'https://welfareavenue.com/volunteer/' }) + '</div>' + inp(i, 'caption', 'Small line under it', b.caption, { ph: 'Two minutes · your volunteer hours count' }); }
    if (b.type === 'photo') { h += photoSlot(i, null, b) + inp(i, 'alt', 'What the photo shows (for screen readers)', b.alt) + inp(i, 'caption', 'Caption', b.caption, { help: 'Optional' }) + inp(i, 'link', 'Link when tapped', b.link, { help: 'Optional', ph: 'https://' }); }
    if (b.type === 'photos') {
      h += '<div class="w202slots">' + [0, 1, 2].map(function (k) { var p = (b.items || [])[k] || {}; return '<div class="w202slotw">' + photoSlot(i, k, p) +
        '<input class="w152in" data-w202f="' + i + '.items.' + k + '.alt" value="' + fv(p.alt) + '" placeholder="What it shows" aria-label="What photo ' + (k + 1) + ' shows">' +
        '<input class="w152in" data-w202f="' + i + '.items.' + k + '.caption" value="' + fv(p.caption) + '" placeholder="Caption (optional)" aria-label="Caption for photo ' + (k + 1) + '"></div>'; }).join('') + '</div>';
    }
    if (b.type === 'video') { h += inp(i, 'url', 'Link to the video', b.url, { ph: 'https://www.instagram.com/reel/...' }) + '<div class="w202two">' + inp(i, 'title', 'Title', b.title, { half: true, ph: 'What is a serving?' }) + inp(i, 'caption', 'Line under it', b.caption, { half: true, ph: 'Tap to watch' }) + '</div><p class="m">Videos never play inside an email: the card links to it.</p>'; }
    if (b.type === 'quote') { h += inp(i, 'quote', 'The quote', b.quote, { area: true, rows: 3 }) + inp(i, 'by', 'Who said it', b.by, { ph: 'A volunteer, fall 2025' }); }
    if (b.type === 'signoff') { h += '<div class="w202two">' + inp(i, 'closing', 'Closing', b.closing, { half: true, ph: 'Warmly,' }) + inp(i, 'name', 'Name', b.name, { half: true }) + '</div>' + inp(i, 'role', 'Under the name', b.role, { ph: 'Welfare Avenue' }) + inp(i, 'ps', 'P.S.', b.ps, { area: true, rows: 2, help: 'Optional' }); }
    if (b.type === 'divider') h += sel(i, 'style', 'Kind', b.style, [['rule', 'A short gold rule'], ['space', 'Just space']]);
    return h;
  }
  function blocksHtml() {
    var bl = SS.d.design.blocks, ro = SS.ro;
    return '<div class="w202blocks" data-w202sec="blocks">' + bl.map(function (b, i) {
      var open = !!SS.open[b.id];
      return '<div class="w202blk' + (open ? ' open' : '') + '" data-w202blk="' + i + '" id="w202b' + i + '">' +
        '<div class="w202bh"><button class="w202bt" data-w202tog="' + i + '" aria-expanded="' + open + '"><b>' + E(MAIL202.LABEL[b.type] || b.type) + '</b><span class="m" data-w198skip>' + E(summary(b)) + '</span></button>' +
        (ro ? '' : '<span class="w202ba"><button class="w202ib" data-w202mv="' + i + ',-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>' + I('up') + '</button><button class="w202ib" data-w202mv="' + i + ',1" aria-label="Move down"' + (i === bl.length - 1 ? ' disabled' : '') + '>' + I('down') + '</button>' +
          '<button class="w202ib" data-w202dup="' + i + '" aria-label="Duplicate">' + I('copy') + '</button><button class="w202ib" data-w202del="' + i + '" aria-label="Remove">' + I('trash') + '</button></span>') + '</div>' +
        (open ? '<div class="w202bf"' + (ro ? ' inert' : '') + '>' + blockForm(b, i) + '</div>' : '') + '</div>';
    }).join('') + '</div>' + (ro ? '' : addHtml());
  }
  function addHtml() {
    return '<div class="w202add" data-w202sec="add"><span class="m">Add a block</span><div class="w202addb">' + MAIL202.TYPES.map(function (t) { return '<button class="w202chipb" data-w202add="' + t + '">' + I('plus') + E(MAIL202.LABEL[t]) + '</button>'; }).join('') + '</div></div>';
  }
  function questionsHtml() {
    var qs = SS.questions || []; if (!qs.length && !SS.notes) return '';
    return '<div class="w154card w202q" data-w202sec="questions"><h3>' + I('spark') + ' The Hub’s questions</h3>' + (SS.notes ? '<p class="m" data-w198skip>' + E(SS.notes) + '</p>' : '') +
      (qs.length ? '<p class="m">Answer what you can, then let the Hub put your answers in. The [brackets] in the email are the same gaps.</p>' + qs.map(function (q) {
        return '<label class="w155lb" data-w198skip>' + E(q.ask) + (q.why ? ' <span class="m">' + E(q.why) + '</span>' : '') + '<input class="w152in" data-w202qa="' + E(q.id) + '" value="' + E(q.answer || '') + '" placeholder="' + E(q.hint ? 'For example: ' + q.hint : '') + '"></label>';
      }).join('') + '<div class="w154acts"><button class="w152btn" data-w202answers' + (SS.busy ? ' disabled' : '') + '>' + I('spark') + ' Put my answers in</button><button class="w152btn ghost" data-w202qx>I’ll fix it myself</button></div>'
        : '<div class="w154acts"><button class="w152btn ghost sm" data-w202qx>Got it</button></div>') + '</div>';
  }
  function checksHtml() {
    var cs = checks(), st = cs.filter(function (c) { return c.lvl === 'stop'; }).length, wn = cs.filter(function (c) { return c.lvl === 'warn'; }).length;
    var head = st ? '<b class="w202cst">' + I('alert') + ' ' + plural(st, 'thing to fix', 'things to fix') + ' before it can go out</b>' : wn ? '<b class="w202cwn">' + I('alert') + ' Ready, with ' + plural(wn, 'thing', 'things') + ' to look at</b>' : '<b class="w202cok">' + I('check') + ' Ready to send</b>';
    return '<div class="w154card w202checks" data-w202sec="checks" id="w202checks">' + head + (cs.length ? '<ul>' + cs.map(function (c) {
      return '<li class="' + c.lvl + '">' + (c.i != null ? '<button class="w202lnk" data-w202goto="' + c.i + '">' + E(c.msg) + '</button>' : E(c.msg)) + '</li>';
    }).join('') + '</ul>' : '') + '</div>';
  }
  function settingsHtml() {
    var e = SS.d, dis = SS.ro ? ' disabled' : '';
    return '<div class="w154card w202set" data-w202sec="settings">' +
      '<label class="w155lb wide">Subject<input class="w152in" data-w202e="subject" value="' + E(e.subject) + '" placeholder="Sunday needs you, {{first_name|friend}}"' + dis + '></label>' +
      '<label class="w155lb wide">Preview line <span class="m">After the subject in the inbox</span><input class="w152in" data-w202e="preheader" value="' + E(e.preheader) + '" placeholder="Servers and drivers wanted for 12 October"' + dis + '></label>' +
      '<label class="w155lb">Kind' + kindSel('data-w202e="kind"' + dis, e.kind) + '</label>' +
      '<label class="w155lb">For<select class="w152sel" data-w202e="audience"' + dis + '><option value="">Anyone</option>' + Object.keys(AUD).map(function (a) { return '<option value="' + a + '"' + (e.audience === a ? ' selected' : '') + '>' + E(AUD[a]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="w155lb">Language' + langSel('data-w202e="lang"' + dis, e.lang) + '</label>' +
      '<p class="m wide">' + E((KIND[e.kind] || KIND.newsletter).s) + ' Every email carries our charity number, postal address, why they got it and an unsubscribe link.</p></div>';
  }
  function saveState() {
    var e = SS.d; if (!e) return '';
    if (SS.ro) return '<span class="w202ss">Read only</span>';
    if (SS.saving) return '<span class="w202ss">Saving…</span>';
    if (SS.saveNote) return '<span class="w202ss warn">' + E(SS.saveNote) + '</span>';
    if (!e.key) return '<span class="w202ss warn">Not saved yet: it needs a subject</span>';
    if (SS.dirty) return '<span class="w202ss">Unsaved changes</span>';
    return '<span class="w202ss ok">' + I('check') + ' Saved' + (SS.savedAt ? ' ' + ago(SS.savedAt) : '') + '</span>';
  }
  function updateSaveState() { var el = document.getElementById('w202ss'); if (el) el.innerHTML = saveState(); }
  function previewDoc() {
    var e = SS.d, d = e.design;
    var html = MAIL202.preview({ html: MAIL202.renderMarked(d), subject: e.subject, preheader: e.preheader, kind: e.kind, cfg: mailSettings() || {} });
    return html.replace('</head>', '<style>[data-w202b]{cursor:pointer;border-radius:6px;}[data-w202b]:hover{outline:2px dashed rgba(220,165,39,.85);outline-offset:4px;}[data-w202b].hl{outline:2px solid #DCA527;outline-offset:4px;}</style></head>');
  }
  function previewHtml() {
    var e = SS.d, st = mailSettings() || {};
    return '<div class="w202pv" data-w202sec="preview"><div class="w202pvh"><div class="m" data-w198skip>From: ' + E((st.mail_from_name || 'Welfare Avenue') + ' <' + (st.mail_from_email || 'info@welfareavenue.com') + '>') +
      '<br>Subject: <b>' + E(MAIL202.fill(e.subject || '(no subject yet)', MAIL202.SAMPLE, false)) + '</b>' + (e.preheader ? '<br>Preview: ' + E(MAIL202.fill(e.preheader, MAIL202.SAMPLE, false)) : '') + '</div>' +
      '<div class="w202dev" role="group" aria-label="Preview size"><button class="' + (SS.device !== 'phone' ? 'on' : '') + '" data-w202dev="desktop" aria-pressed="' + (SS.device !== 'phone') + '">' + I('desktop') + '<span>Computer</span></button><button class="' + (SS.device === 'phone' ? 'on' : '') + '" data-w202dev="phone" aria-pressed="' + (SS.device === 'phone') + '">' + I('phone') + '<span>Phone</span></button></div></div>' +
      '<div class="w202fw' + (SS.device === 'phone' ? ' phone' : '') + '"><iframe id="w202frame" class="w202frame" sandbox="allow-same-origin" title="The email as it will look, with Alex as the reader" srcdoc="' + E(previewDoc()) + '"></iframe></div>' +
      '<p class="m">Shown with Alex as the reader. Click a part of the email to edit it.</p></div>';
  }
  function editorHtml() {
    var e = SS.d; if (!e) return busyHtml('Opening the email…');
    var owner = !SS.ro ? '' : '<div class="w202ro">' + I('alert') + ' <span>' + (e.created_by === 'starter' ? 'This is one of our starters: only admins change it.' : 'This is ' + E(str(e.created_by).split('@')[0]) + '’s email: only they or an admin change it.') + ' Copy it to make it yours.</span><button class="w152btn sm" data-w202copy>' + I('copy') + ' Copy it</button></div>';
    return '<div class="w202 w202ed">' +
      '<div class="w202bar"><button class="w152btn sm ghost" data-w202go="#crm/studio">' + I('back') + ' The studio</button>' +
      '<input class="w202name" data-w202e="name" value="' + E(e.name) + '" aria-label="The email’s name (for the team)"' + (SS.ro ? ' disabled' : '') + ' data-w198skip>' +
      '<span id="w202ss">' + saveState() + '</span><span class="w202sp"></span>' +
      (e.one_off ? '' : '<span class="w202chip g">Template</span>') +
      '<button class="w152btn sm" data-w202sendopen>' + I('send') + ' Send or save…</button></div>' + owner +
      (SS.msg ? '<div class="w154msg">' + E(SS.msg) + (SS.undo ? ' <button class="w152btn sm ghost" data-w202undo>Undo</button>' : '') + '</div>' : '') + (SS.err ? '<div class="w152err">' + E(SS.err) + '</div>' : '') +
      '<div class="w202tabs" role="tablist"><button role="tab" class="' + (SS.tab === 'edit' ? 'on' : '') + '" data-w202tab="edit">Edit</button><button role="tab" class="' + (SS.tab === 'preview' ? 'on' : '') + '" data-w202tab="preview">Preview</button></div>' +
      '<div class="w202cols ed tab-' + SS.tab + '"><div class="w202left">' + sendHtml() + settingsHtml() + questionsHtml() + checksHtml() + blocksHtml() +
      (SS.ro ? '' : '<div class="w154card w202chg" data-w202sec="change"><h3>' + I('spark') + ' Ask the Hub to change it</h3>' +
        '<textarea class="w152in w202say" data-w202say="change" rows="3" placeholder="Make it shorter. Warmer. Put the date first. Write it in French. Add a P.S. about bringing a friend.">' + E(SS.change) + '</textarea>' +
        '<div class="w154acts"><button class="w152btn" data-w202change' + (SS.busy ? ' disabled' : '') + '>' + I('spark') + ' Change it</button></div>' + (SS.busy ? busyHtml(SS.busy) : '') + '</div>') +
      '<div class="w202foot">' + (SS.ro ? '' : '<button class="w152btn sm ghost" data-w202dupe>' + I('copy') + ' Make a copy</button>') +
      (!SS.ro && e.key ? (SS.confirmDel ? '<span class="w202cf">' + (e.one_off ? 'Delete this email?' : 'Remove this template? Automations that use it stop sending it.') + ' <button class="w152btn sm" data-w202delyes>Yes, remove it</button><button class="w152btn sm ghost" data-w202delno>Keep it</button></span>'
        : '<button class="w152btn sm ghost" data-w202rm>' + I('trash') + ' ' + (e.one_off ? 'Delete' : 'Remove the template') + '</button>') : '') + '</div>' +
      '</div><div class="w202right">' + previewHtml() + '</div></div>' + pickerHtml() + '</div>';
  }
  /* ---------- edits ---------- */
  var timers = {};
  function later(name, ms, fn) { clearTimeout(timers[name]); timers[name] = setTimeout(fn, ms); }
  function changed(structural) {
    if (!SS.d || SS.ro) return;
    SS.dirty = true; SS.saveNote = ''; updateSaveState();
    if (structural) { paint(); } else { later('pv', 300, refreshPreview); later('ck', 500, refreshChecks); }
    later('save', 2500, function () { if (SS.dirty) saveNow(); });
  }
  function refreshChecks() { var el = document.getElementById('w202checks'); if (el && SS.d) el.outerHTML = checksHtml(); }
  function refreshPreview() {
    var f = document.getElementById('w202frame'); if (!f || !SS.d) return;
    var y = 0; try { y = f.contentWindow.scrollY || 0; } catch (e) { y = 0; }
    f.setAttribute('data-y', String(y));
    f.srcdoc = previewDoc();
    var pvh = document.querySelector('.w202pvh .m'); if (pvh) { var st = mailSettings() || {}; pvh.innerHTML = 'From: ' + E((st.mail_from_name || 'Welfare Avenue') + ' <' + (st.mail_from_email || 'info@welfareavenue.com') + '>') + '<br>Subject: <b>' + E(MAIL202.fill(SS.d.subject || '(no subject yet)', MAIL202.SAMPLE, false)) + '</b>' + (SS.d.preheader ? '<br>Preview: ' + E(MAIL202.fill(SS.d.preheader, MAIL202.SAMPLE, false)) : ''); }
    var blk = document.querySelectorAll('.w202bt .m'); SS.d.design.blocks.forEach(function (b, i) { if (blk[i]) blk[i].textContent = summary(b); });
  }
  /* the preview's own clicks: a link never opens inside it; a part of the email opens its block */
  function wireFrame(f) {
    try {
      var doc = f.contentDocument; if (!doc || doc.__w202) return; doc.__w202 = true;
      var y = Number(f.getAttribute('data-y') || 0); if (y) f.contentWindow.scrollTo(0, y);
      doc.addEventListener('click', function (ev) {
        var a = ev.target.closest && ev.target.closest('a'); if (a) ev.preventDefault();
        var m = ev.target.closest && ev.target.closest('[data-w202b]'); if (!m) return;
        var i = Number(m.getAttribute('data-w202b')); openBlock(i);
      });
    } catch (e) { /* fine */ }
  }
  function openBlock(i) {
    var b = SS.d && SS.d.design.blocks[i]; if (!b) return;
    SS.open[b.id] = true; if (SS.tab === 'preview') SS.tab = 'edit'; paint();
    setTimeout(function () { var el = document.getElementById('w202b' + i); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); var f = el.querySelector('input,textarea,select'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }, 60);
  }
  function setPath(i, path, value) {
    var b = SS.d.design.blocks[i]; if (!b) return;
    var p = path.split('.'), o = b;
    if (p[0] === 'lines') { b.lines = str(value).split(/\n/).slice(0, 4); return; }
    for (var k = 0; k < p.length - 1; k++) { var key = /^\d+$/.test(p[k]) ? Number(p[k]) : p[k]; if (o[key] == null) o[key] = /^\d+$/.test(p[k + 1]) ? [] : {}; o = o[key]; }
    var last = p[p.length - 1];
    if (last === 'moveE') { o.moveE = !!value; return; }
    o[last] = value;
  }
  function addBlock(type) {
    var bl = SS.d.design.blocks, nb = MAIL202.blank(type);
    if (type === 'signoff') nb.name = myName();
    var openIdx = -1; bl.forEach(function (b, i) { if (SS.open[b.id]) openIdx = i; });
    var at = openIdx >= 0 ? openIdx + 1 : (bl.length && bl[bl.length - 1].type === 'signoff' ? bl.length - 1 : bl.length);
    if (type === 'hero') at = 0;
    bl.splice(at, 0, nb); SS.open = {}; SS.open[nb.id] = true;
    changed(true);
    setTimeout(function () { var el = document.getElementById('w202b' + at); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }
  async function saveNow() {
    var e = SS.d; if (!e || SS.ro) return null;
    if (!str(e.subject).trim()) { SS.saveNote = ''; updateSaveState(); return e.key || null; }
    if (SS.saving) { SS.saveAgain = true; return SS.savingP; }
    SS.saving = true; updateSaveState();
    var html = MAIL202.render(e.design), text = MAIL202.renderText(e.design);
    var payload = { key: e.key || '', name: str(e.name).trim() || str(e.subject).trim(), kind: e.kind, subject: e.subject, preheader: e.preheader || '', html_body: html, text_body: text, design: e.design,
      vars: MAIL202.placeholders(e.subject + ' ' + (e.preheader || '') + ' ' + html), one_off: e.one_off !== false, audience: e.audience || null, category: e.category || null, lang: e.lang || 'en', description: e.description || '', active: e.active !== false };
    SS.savingP = rpc('email_studio_save', { p: payload }).then(function (r) {
      SS.saving = false;
      if (r.error) { SS.saveNote = 'Not saved: ' + words(r.error); updateSaveState(); return null; }
      var data = r.data || {};
      e.key = data.key || e.key; e.updated_at = data.updated_at || new Date().toISOString(); SS.dirty = false; SS.savedAt = Date.now(); SS.saveNote = '';
      if (SS.view === 'edit' && location.hash.indexOf('#crm/studio/e/') === 0 && location.hash !== '#crm/studio/e/' + e.key) setHash('#crm/studio/e/' + e.key);
      reloadTemplates(); updateSaveState();
      if (SS.saveAgain) { SS.saveAgain = false; return saveNow(); }
      return e.key;
    });
    return SS.savingP;
  }
  async function aiChange(mode) {
    var e = SS.d; if (!e) return;
    var qa = (SS.questions || []).map(function (q) { return { ask: q.ask, answer: q.answer }; });
    if (mode === 'change' && !str(SS.change).trim()) { SS.err = 'Tell the Hub what to change.'; paint(); return; }
    if (mode === 'answers' && !qa.some(function (q) { return str(q.answer).trim(); })) { SS.err = 'Answer at least one question first.'; paint(); return; }
    SS.err = ''; SS.busy = mode === 'change' ? 'The Hub is changing your email…' : 'The Hub is putting your answers in…'; paint();
    var r = await aiCall({ mode: mode, design: e.design, subject: e.subject, preheader: e.preheader, instruction: SS.change, qa: qa, audience: e.audience, kind: e.kind, lang: e.lang, photos: [] });
    SS.busy = '';
    if (r.error) { SS.err = r.error; paint(); return; }
    var res = fromAi(r.input, r.photos);
    if (!res.design.blocks.length) { SS.err = 'The Hub sent back an empty email, so nothing changed.'; paint(); return; }
    SS.undo = JSON.parse(JSON.stringify({ design: e.design, subject: e.subject, preheader: e.preheader }));
    res.design.from = e.design.from; res.design.source = e.design.source;
    e.design = res.design; if (res.subject) e.subject = res.subject; if (res.preheader) e.preheader = res.preheader;
    SS.questions = res.questions; SS.notes = res.notes; SS.open = {};
    if (mode === 'change') SS.change = '';
    SS.msg = mode === 'change' ? 'Changed. Not what you wanted? Undo puts it back.' : 'Your answers are in.';
    changed(true);
  }
