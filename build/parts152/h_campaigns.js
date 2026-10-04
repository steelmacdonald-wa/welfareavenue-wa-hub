  /* ======================= Lists and Campaigns (wave155, 27/09/26) =======================
     Step 3 of the plan, re-scoped by the CRM deep dive: lists built from groups of conditions (AND inside a group, OR
     between groups, over contact, volunteering, gifts, email activity and consent), saved live or fixed; campaigns that
     send the newsletter template to a list through mail-send (the CASL rule per person, Resend's pace, a daily cap for the
     free plan). Steel, 27/09/26: anyone with the CRM sends; volunteer call-outs go to everyone not unsubscribed ("Keela's
     way"); the sender is chosen per campaign; nothing reaches anyone but the test recipients while the mode is test. */
  P.list = '<path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>';
  P.send = '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>';
  MSTATUS.sending = ['Sending', TEAL]; MSTATUS.cancelled = ['Cancelled', MUTED]; MKIND.volunteer = ['Volunteer call-out', TEAL];
  var LC = { edit: null, prev: null, pT: null, msg: '', err: '', busy: '', sizes: null, c: null, cprev: null, check: null, confirm: false, cmsg: '', cerr: '', cbusy: '', rcp: null, rcpFor: null, newList: null, cid: null };
  LOADERS.lists = function () { return db.from('crm_lists').select('*').order('updated_at', { ascending: false }); };
  LOADERS.campaigns = function () { return db.from('crm_campaigns').select('*').order('created_at', { ascending: false }).limit(300); };
  LOADERS.cstats = function () { return db.from('crm_campaign_stats_v').select('*'); };
  var CK = { newsletter: ['Newsletter', PURPLE, 'People who said yes, or gave or served in the last two years.'], fundraising: ['Fundraising appeal', '#B9851B', 'The same people as a newsletter (the exemption setting is off).'],
    volunteer: ['Volunteer call-out', TEAL, 'Everyone on the list with a working address who has not unsubscribed.'] };
  var CSTAT = { draft: ['Draft', MUTED], queued: ['Queued', '#B9851B'], sending: ['Sending', TEAL], sent: ['Sent', GREEN], cancelled: ['Stopped', FLAG] };
  function lchip(map, k) { var d = map[k] || [k || '?', MUTED]; return '<span class="w154chip" style="background:' + d[1] + '17;color:' + d[1] + '"><i style="background:' + d[1] + '"></i>' + E(d[0]) + '</span>'; }
  function sizes() {
    if (typeof db === 'undefined' || !db || !db.rpc) return Promise.resolve();
    return Promise.resolve(db.rpc('crm_list_sizes')).then(function (r) { var m = {}; ((r && r.data) || []).forEach(function (x) { m[String(x.list_id)] = Number(x.members) || 0; }); LC.sizes = m; }, function () { LC.sizes = LC.sizes || {}; });
  }
  function listById(id) { return (S.lists || []).filter(function (l) { return String(l.id) === String(id); })[0] || null; }

  /* ---------- the conditions a list can hold ---------- */
  var LF = [
    ['kind', 'Contact type', 'sel', ['is', 'not']], ['role', 'Volunteer role', 'sel', ['is', 'not']], ['tag', 'Tag', 'text', ['has', 'not']],
    ['perm', 'Email permission', 'sel', ['is', 'not']], ['email', 'Email address', 'none', ['has', 'none']],
    ['served', 'Served at an event', 'num', ['ever', 'never', 'within', 'count_gte']], ['gave', 'Gave a gift', 'num', ['ever', 'never', 'within', 'lapsed', 'total_gte', 'count_gte']],
    ['city', 'City', 'text', ['contains', 'not']], ['language', 'Language', 'sel', ['is', 'not']], ['source', 'Came from', 'sel', ['is', 'not']],
    ['added', 'Added to the CRM', 'num', ['within']], ['active', 'Last activity', 'num', ['within']],
    ['opened', 'Opened a Hub email', 'num', ['within']], ['clicked', 'Clicked a Hub email', 'num', ['within']],
    ['review', 'Volunteer record needs a review', 'none', ['is', 'not']], ['search', 'Name, email or organization', 'text', ['contains']]
  ];
  var LOP = { is: 'is', not: 'is not', has: 'has', none: 'has none', ever: 'ever', never: 'never', within: 'in the last … days', count_gte: 'at least … times', lapsed: 'not in the last … days', total_gte: 'at least $… in total', contains: 'contains' };
  function lf(f) { return LF.filter(function (x) { return x[0] === f; })[0] || LF[0]; }
  function lopts(f) {
    if (f === 'kind') return KIND_ORDER.map(function (k) { return [k, (KINDS[k] || [k])[0]]; });
    if (f === 'role') return ROLE_ORDER.map(function (r) { return [r, ROLES[r]]; });
    if (f === 'perm') return [['express', 'Express consent'], ['implied', 'Implied consent'], ['unknown', 'Not recorded'], ['unsub', 'Unsubscribed or bouncing']];
    if (f === 'language') return [['en', 'English'], ['fr', 'French']];
    if (f === 'source') return Object.keys(SOURCES).map(function (k) { return [k, SOURCES[k][0]]; });
    return [];
  }
  function needsValue(k) {
    var d = lf(k.f);
    if (d[2] === 'none') return false;
    if (k.f === 'served' || k.f === 'gave') return ['within', 'lapsed', 'count_gte', 'total_gte'].indexOf(k.op) >= 0;
    return true;
  }
  function defVal(f, op) {
    if (op === 'within' || op === 'lapsed') return f === 'added' ? '30' : f === 'opened' || f === 'clicked' || f === 'active' ? '90' : '365';
    if (op === 'count_gte') return f === 'served' ? '3' : '2';
    if (op === 'total_gte') return '100';
    var o = lopts(f); return o.length ? o[0][0] : '';
  }
  function newCond(f) { var d = lf(f || 'kind'); var op = d[3][0]; return { f: d[0], op: op, v: defVal(d[0], op) }; }
  function condHtml(k, gi, ci) {
    var d = lf(k.f), at = gi + '.' + ci;
    var fs = '<select class="w152sel" data-w155cf="' + at + '" aria-label="Field">' + LF.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === k.f ? ' selected' : '') + '>' + E(x[1]) + '</option>'; }).join('') + '</select>';
    var os = '<select class="w152sel" data-w155co="' + at + '" aria-label="Condition">' + d[3].map(function (o) { return '<option value="' + o + '"' + (o === k.op ? ' selected' : '') + '>' + E(LOP[o]) + '</option>'; }).join('') + '</select>';
    var vs = '';
    if (needsValue(k)) {
      var opts = lopts(k.f);
      if (d[2] === 'sel' && opts.length) vs = '<select class="w152sel" data-w155cv="' + at + '" aria-label="Value">' + opts.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(o[0]) === String(k.v) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>';
      else vs = '<input class="w152in" data-w155cv="' + at + '" aria-label="Value" ' + (d[2] === 'num' ? 'type="number" min="0" ' : 'type="text" ') + 'value="' + E(k.v) + '">';
    }
    return '<div class="w155c">' + fs + os + vs + '<button class="w152mini" data-w155cx="' + at + '" aria-label="Remove this condition">' + I('x') + '</button></div>';
  }
  function cleanGroups(groups) {
    return (groups || []).map(function (g) { return { all: (g.all || []).filter(function (k) { return k && k.f; }).map(function (k) { var o = { f: k.f, op: k.op }; if (needsValue(k)) o.v = String(k.v == null ? '' : k.v); return o; }) }; });
  }
  /* the Contacts tab's filters as one group */
  function groupsFromFilters() {
    var u = S.ui, all = [];
    if (u.kind) all.push({ f: 'kind', op: 'is', v: u.kind });
    if (u.role) all.push({ f: 'role', op: 'is', v: u.role });
    if (u.act === 'served12') all.push({ f: 'served', op: 'within', v: '365' });
    else if (u.act === 'served') all.push({ f: 'served', op: 'ever' });
    else if (u.act === 'never') { all.push({ f: 'kind', op: 'is', v: 'volunteer' }); all.push({ f: 'served', op: 'never' }); }
    else if (u.act === 'review') all.push({ f: 'review', op: 'is' });
    else if (u.act === 'noemail') all.push({ f: 'email', op: 'none' });
    else if (u.act === 'new30') all.push({ f: 'added', op: 'within', v: '30' });
    if (u.perm) all.push({ f: 'perm', op: 'is', v: u.perm });
    if (u.q) all.push({ f: 'search', op: 'contains', v: u.q });
    return [{ all: all }];
  }
  function describe(groups) {
    var gs = cleanGroups(groups);
    if (!gs.length || gs.every(function (g) { return !g.all.length; })) return 'Everyone in the CRM';
    return gs.map(function (g) {
      return g.all.map(function (k) {
        var d = lf(k.f), o = lopts(k.f), lab = o.filter(function (x) { return String(x[0]) === String(k.v); })[0];
        var val = lab ? lab[1] : k.v, op = LOP[k.op] || k.op;
        if (op.indexOf('…') >= 0) return d[1] + ' ' + op.replace('…', val || '…');
        return d[1] + ' ' + op + (needsValue(k) && val ? ' ' + val : '');
      }).join(' and ') || 'everyone';
    }).join('; or ');
  }

  /* ---------- the live count while a list is being built ---------- */
  function previewSoon() {
    clearTimeout(LC.pT);
    LC.pT = setTimeout(function () {
      var ed = LC.edit; if (!ed) return;
      var groups = cleanGroups(ed.groups), token = JSON.stringify(groups);
      LC.prev = { token: token, busy: true, ids: LC.prev && LC.prev.ids };
      paintPrev();
      Promise.resolve(db.rpc('crm_list_preview', { p_filter: { groups: groups } })).then(function (r) {
        if (!LC.edit || JSON.stringify(cleanGroups(LC.edit.groups)) !== token) return;
        if (r && r.error) { LC.prev = { token: token, err: String(r.error.message || r.error) }; paintPrev(); return; }
        var ids = ((r && r.data) || []).map(function (x) { return typeof x === 'object' && x !== null ? (x.crm_list_preview != null ? x.crm_list_preview : x.id) : x; });
        LC.prev = { token: token, ids: ids }; paintPrev();
      }, function (e) { LC.prev = { token: token, err: String((e && e.message) || e) }; paintPrev(); });
    }, 350);
  }
  function prevHtml() {
    var p = LC.prev;
    if (!p || (!p.ids && p.busy)) return '<div class="w155res m">Counting…</div>';
    if (p.err) return '<div class="w155res w152err">The count did not come back: ' + E(p.err) + '</div>';
    var ids = p.ids || [], people = ids.map(contact).filter(Boolean);
    var news = 0, vol = 0, noem = 0;
    people.forEach(function (c) { if (!c.emails.length) { noem++; return; } if (c._perm === 'express' || c._perm === 'implied') news++; if (c._perm !== 'unsub' && c._perm !== 'bounced') vol++; });
    var names = people.slice(0, 8).map(function (c) { return '<button class="w152lnk" data-w152open="' + E(c.id) + '">' + E(c.full_name || '(no name)') + '</button>'; }).join(', ');
    return '<div class="w155res' + (p.busy ? ' busy' : '') + '"><b>' + plural(ids.length, 'person matches', 'people match') + '</b>' +
      '<div class="w155mix"><span><b>' + news.toLocaleString('en-CA') + '</b> can get a newsletter</span><span><b>' + vol.toLocaleString('en-CA') + '</b> can get a volunteer call-out</span><span><b>' + noem.toLocaleString('en-CA') + '</b> have no email</span></div>' +
      (names ? '<div class="m">' + names + (ids.length > 8 ? ' and ' + plural(ids.length - 8, 'other', 'others') : '') + '</div>' : '') + '</div>';
  }
  function paintPrev() { var el = document.querySelector('#crm [data-w155res]'); if (el) el.innerHTML = prevHtml(); }

  /* ---------- the Lists tab ---------- */
  function listRow(l) {
    var n = LC.sizes && LC.sizes[String(l.id)] != null ? LC.sizes[String(l.id)] : (l.kind === 'static' ? (l.member_ids || []).length : null);
    return '<div class="w155row" role="listitem"><div class="w155nm"><b>' + E(l.name) + '</b><span class="m">' + E(l.description || describe((l.filter || {}).groups || [])) + '</span></div>' +
      '<div>' + lchip({ dynamic: ['Live', TEAL], static: ['Fixed', PURPLE] }, l.kind) + '</div><div class="w155n">' + (n == null ? '…' : plural(n, 'person', 'people')) + '</div>' +
      '<div class="w155ra"><button class="w152btn sm ghost" data-w155edit="' + E(l.id) + '">' + I('edit') + ' Open</button><button class="w152btn sm" data-w155mail="' + E(l.id) + '">' + I('mail') + ' Email this list</button></div></div>';
  }
  function builderHtml() {
    var ed = LC.edit;
    if (!ed) return '<div class="w154card"><h3>' + I('list') + ' Build a list</h3><p>A list is a set of conditions: everyone who matches them today. Conditions in one group must all hold (and); a person who matches any group is in (or).</p><p class="m">Live lists follow the data, so a volunteer who serves on Sunday is in the “served in the last year” list on Monday. Fixed lists keep the people they had when saved.</p></div>';
    var gs = ed.groups.map(function (g, gi) {
      return (gi ? '<div class="w155or"><span>or</span></div>' : '') + '<div class="w155g"><div class="w155gh">' + (ed.groups.length > 1 ? 'Group ' + (gi + 1) : 'People who match all of these') +
        (ed.groups.length > 1 ? '<button class="w152mini" data-w155gx="' + gi + '">' + I('x') + ' Remove the group</button>' : '') + '</div>' +
        (g.all.length ? g.all.map(function (k, ci) { return condHtml(k, gi, ci); }).join('<div class="w155and">and</div>') : '<div class="m">No condition yet: everyone in the CRM.</div>') +
        '<button class="w152btn sm ghost" data-w155and="' + gi + '">' + I('plus') + ' And</button></div>';
    }).join('');
    return '<div class="w154card w155b"><h3>' + I('list') + (ed.id ? ' Edit the list' : ' New list') + '</h3>' +
      '<label class="w155lb">Name<input class="w152in" data-w155f="name" value="' + E(ed.name) + '" placeholder="Toronto volunteers who served this year"></label>' +
      '<label class="w155lb">What it is for<input class="w152in" data-w155f="description" value="' + E(ed.description) + '" placeholder="Optional"></label>' +
      gs + '<button class="w152btn sm ghost" data-w155or>' + I('plus') + ' Or: another group</button>' +
      '<div data-w155res>' + prevHtml() + '</div>' +
      (ed.del ? '<div class="w154msg">Delete “' + E(ed.name) + '”? Campaigns that used it keep their history. <button class="w152btn sm danger" data-w155delok>Delete it</button> <button class="w152btn sm ghost" data-w155delno>Keep it</button></div>' : '') +
      (LC.err ? '<div class="w152err">' + E(LC.err) + '</div>' : '') +
      '<div class="w154acts"><button class="w152btn" data-w155save="dynamic">' + I('check') + ' Save as a live list</button><button class="w152btn ghost" data-w155save="static">Save as a fixed list</button>' +
      (ed.id ? '<button class="w152btn ghost" data-w155del>' + I('trash') + ' Delete</button>' : '') + '<button class="w152btn ghost" data-w155cancel>Cancel</button></div></div>';
  }
  function paintLists(root) {
    if (!S.lists || !LC.sizes) { root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + busy('Loading the lists…'); Promise.all([load('lists'), sizes()]).then(function () { if (S.ui.tab === 'lists') paint(); }); return; }
    var ls = S.lists;
    root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + '<div class="w155grid">' +
      '<div class="w154card"><h3>' + I('list') + ' Saved lists <span class="m">' + plural(ls.length, 'list', 'lists') + '</span></h3>' +
      '<div class="w154acts" style="margin:0 0 10px"><button class="w152btn sm" data-w155new>' + I('plus') + ' New list</button><button class="w152btn sm ghost" data-w155fromf>From the Contacts filters</button></div>' +
      (LC.msg ? '<div class="w154msg">' + E(LC.msg) + '</div>' : '') +
      (ls.length ? '<div class="w155rows" role="list">' + ls.map(listRow).join('') + '</div>' : '<p class="m">No list yet. Start with New list, or narrow the Contacts tab and save its filters as a list.</p>') + '</div>' +
      builderHtml() + '</div>';
    if (LC.edit && !LC.prev) previewSoon();
  }
  function saveList(kind) {
    var ed = LC.edit; if (!ed) return;
    var name = String(ed.name || '').trim(); if (!name) { LC.err = 'A list needs a name.'; paint(); return; }
    var groups = cleanGroups(ed.groups);
    var go2 = function (ids) {
      var row = { name: name, description: String(ed.description || '').trim() || null, kind: kind, filter: { groups: groups }, member_ids: kind === 'static' ? ids : [], updated_by: actor(), updated_at: new Date().toISOString() };
      var q = ed.id ? db.from('crm_lists').update(row).eq('id', ed.id).select().single() : db.from('crm_lists').insert(Object.assign({ created_by: actor() }, row)).select().single();
      LC.err = ''; return Promise.resolve(q).then(function (r) {
        if (r && r.error) { LC.err = 'Not saved: ' + (r.error.message || r.error); paint(); return; }
        LC.msg = '“' + name + '” saved as a ' + (kind === 'static' ? 'fixed list of ' + plural(ids.length, 'person', 'people') : 'live list') + '.';
        LC.edit = null; LC.prev = null; LC.sizes = null; return load('lists', true).then(function () { paint(); });
      });
    };
    if (kind !== 'static') { go2([]); return; }
    Promise.resolve(db.rpc('crm_list_preview', { p_filter: { groups: groups } })).then(function (r) {
      var ids = ((r && r.data) || []).map(function (x) { return typeof x === 'object' && x !== null ? (x.crm_list_preview != null ? x.crm_list_preview : x.id) : x; }).map(Number).filter(function (x) { return x; });
      go2(ids);
    });
  }
  function delList() {
    var ed = LC.edit; if (!ed || !ed.id) return;
    Promise.resolve(db.from('crm_lists').delete().eq('id', ed.id)).then(function (r) {
      if (r && r.error) { LC.err = 'Not deleted: ' + (r.error.message || r.error); paint(); return; }
      LC.msg = '“' + ed.name + '” deleted.'; LC.edit = null; LC.prev = null; LC.sizes = null; load('lists', true).then(function () { paint(); });
    });
  }
  function atOf(s) { var p = String(s || '').split('.'); return { g: Number(p[0]), c: Number(p[1]) }; }

  /* ---------- the Campaigns tab ---------- */
  function statsFor(id) { return (S.cstats || []).filter(function (x) { return String(x.campaign_id) === String(id); })[0] || {}; }
  function campById(id) { return (S.campaigns || []).filter(function (x) { return String(x.id) === String(id); })[0] || null; }
  function pct(a, b) { a = Number(a) || 0; b = Number(b) || 0; return b ? Math.round(a * 100 / b) + '%' : '0%'; }
  function myName() { var me = (S.contacts || []).filter(function (c) { return c.emails.map(lower).indexOf(myEmail()) >= 0; })[0]; return me && me.full_name ? me.full_name : myEmail().split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function (x) { return x.toUpperCase(); }); }
  function onDomainMe() { return /@welfareavenue\.com$/.test(myEmail()); }
  function blankCampaign(listId) {
    return { id: null, name: '', list_id: listId || (S.lists && S.lists[0] ? S.lists[0].id : null), kind: 'newsletter', template_key: 'newsletter', from: 'org', from_name: '', from_email: '', subject: '', preheader: '', headline: '', body: '', cta_label: '', cta_url: '' };
  }
  function fromCampaign(k) {
    var v = k.vars || {};
    var from = !k.from_email ? 'org' : (String(k.from_email).toLowerCase() === myEmail() ? 'me' : 'custom');
    var st = tplByKey(k.template_key);   /* wave202: designed in the email studio */
    return { id: k.id, name: k.name || '', list_id: k.list_id, kind: k.kind || 'newsletter', template_key: k.template_key || 'newsletter', from: from, from_name: k.from_name || '', from_email: k.from_email || '', subject: k.subject || '', preheader: k.preheader || '',
      headline: v.headline || '', body: v.body_text || '', cta_label: v.cta_label || '', cta_url: v.cta_url || '', studio: !!(st && st.design), vars: v };
  }
  function bodyHtml(t) { return String(t || '').trim().split(/\n\s*\n/).filter(function (p) { return p.trim(); }).map(function (p) { return '<p>' + E(p.trim()).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function campRow(c) {
    var s = campById(c.id) || c, row = s.vars || {};
    var cs = statsFor(c.id), list = listById(c.list_id), sent = Number(cs.sent) || 0;
    return '<div class="w155cr" role="listitem"><button class="w155cn" data-w155copen="' + E(c.id) + '"><b>' + E(c.name || c.subject || 'Untitled') + '</b><span class="m">' + E(c.subject || '') + '</span></button>' +
      '<div>' + lchip(CSTAT, c.status) + '</div><div class="m">' + E(list ? list.name : 'No list') + '<br>' + E((CK[c.kind] || [c.kind])[0]) + '</div>' +
      '<div class="w155n">' + (c.status === 'draft' ? '<span class="m">not sent</span>' : '<b>' + sent.toLocaleString('en-CA') + '</b> sent · ' + pct(cs.opened, sent) + ' opened · ' + pct(cs.clicked, sent) + ' clicked') + '</div>' +
      '<div class="m">' + E(fmtDay(c.sent_at || c.queued_at || c.updated_at || c.created_at)) + '</div></div>';
  }
  function campListHtml() {
    var cs = S.campaigns || [];
    return '<div class="w154card wide"><h3>' + I('send') + ' Campaigns <span class="m">' + plural(cs.length, 'campaign', 'campaigns') + '</span></h3>' +
      '<div class="w154acts" style="margin:0 0 10px"><button class="w152btn sm" data-w155cnew>' + I('plus') + ' New campaign</button><a class="w152btn sm ghost" href="#crm/studio">' + I('spark') + ' Design one in the email studio</a></div>' +
      (LC.cmsg && !LC.c ? '<div class="w154msg">' + E(LC.cmsg) + '</div>' : '') +
      (cs.length ? '<div class="w155ct" role="list"><div class="w155ch" aria-hidden="true"><span>Campaign</span><span>Status</span><span>List and kind</span><span>Results</span><span>Date</span></div>' + cs.map(campRow).join('') + '</div>'
        : '<p class="m">No campaign yet. A campaign sends one message to a list, person by person, through the CASL rule.</p>') + '</div>';
  }
  function modeLine() {
    var st = MAIL.st && MAIL.st.settings ? MAIL.st.settings : null; if (!st) return '';
    var live = st.mail_mode === 'live';
    return '<div class="w155mode ' + (live ? 'live' : 'test') + '">' + (live ? I('check') + ' Live: a campaign reaches its list.' : I('lock') + ' Test mode: campaigns can be written and tested, and go out once an admin switches the mode to live in the Email tab.') +
      (st.mail_daily_cap ? ' Up to ' + E(st.mail_campaign_daily_cap || st.mail_daily_cap) + ' campaign emails a day (Resend’s free plan).' : '') + '</div>';
  }
  function editorHtml() {
    var c = LC.c, ls = S.lists || [], me = myEmail();
    var listSel = '<select class="w152sel" data-w155k="list_id" aria-label="List"><option value="">Pick a list…</option>' + ls.map(function (l) { var n = LC.sizes && LC.sizes[String(l.id)] != null ? ' (' + plural(LC.sizes[String(l.id)], 'person', 'people') + ')' : ''; return '<option value="' + E(l.id) + '"' + (String(l.id) === String(c.list_id) ? ' selected' : '') + '>' + E(l.name + n) + '</option>'; }).join('') + '</select>';
    var kindSel = '<select class="w152sel" data-w155k="kind" aria-label="Kind">' + Object.keys(CK).map(function (k) { return '<option value="' + k + '"' + (k === c.kind ? ' selected' : '') + '>' + E(CK[k][0]) + '</option>'; }).join('') + '</select>';
    var st = MAIL.st && MAIL.st.settings ? MAIL.st.settings : {};
    var fromSel = '<select class="w152sel" data-w155k="from" aria-label="From"><option value="org"' + (c.from === 'org' ? ' selected' : '') + '>' + E((st.mail_from_name || 'Welfare Avenue') + ' <' + (st.mail_from_email || 'info@welfareavenue.com') + '>') + '</option>' +
      (onDomainMe() ? '<option value="me"' + (c.from === 'me' ? ' selected' : '') + '>' + E(myName() + ' <' + me + '>') + '</option>' : '') + '<option value="custom"' + (c.from === 'custom' ? ' selected' : '') + '>Someone else on the team…</option></select>';
    var f = function (k, label, ph, area) { return '<label class="w155lb">' + E(label) + (area ? '<textarea class="w152in" data-w155k="' + k + '" rows="8" placeholder="' + E(ph || '') + '">' + E(c[k]) + '</textarea>' : '<input class="w152in" data-w155k="' + k + '" value="' + E(c[k]) + '" placeholder="' + E(ph || '') + '">') + '</label>'; };
    return '<div class="w154card"><h3>' + I('send') + (c.id ? ' Edit the campaign' : ' New campaign') + '</h3>' + modeLine() +
      f('name', 'Name (for the team)', 'October volunteer call-out') +
      '<label class="w155lb">Send to' + listSel + '</label>' +
      '<label class="w155lb">Kind of message' + kindSel + '<span class="m">' + E((CK[c.kind] || CK.newsletter)[2]) + '</span></label>' +
      '<label class="w155lb">From' + fromSel + '</label>' +
      (c.from === 'custom' ? '<div class="w155two">' + f('from_name', 'Their name', 'Sama Saqib') + f('from_email', 'Their address', 'name@welfareavenue.com') + '</div>' : '') +
      f('subject', 'Subject', 'Sunday needs you, {{first_name|friend}}') + f('preheader', 'Preview text (the line after the subject in the inbox)', 'Servers and cooks wanted for 12 October') +
      (c.studio ? '<div class="w155studio">' + I('spark') + ' <span>The message was designed in the email studio: <b>' + E((tplByKey(c.template_key) || {}).name || 'the studio’s email') + '</b>. Change its words, photos and button there; the subject and preview line here are what this campaign sends.</span>' +
        '<a class="w152btn sm ghost" href="#crm/studio/e/' + E(c.template_key) + '">' + I('edit') + ' Edit it in the studio</a></div>'
      : f('headline', 'Headline', 'Join us this Sunday') + f('body', 'Message (a blank line starts a new paragraph)', 'Hi {{first_name|there}},\n\nWe are serving at …', true) +
      '<div class="w155two">' + f('cta_label', 'Button', 'Sign up to serve') + f('cta_url', 'Button link', 'https://welfareavenue.com') + '</div>') +
      '<p class="m">{{first_name|there}} becomes each person’s first name. Every email carries the charity number, the postal address, why they got it and an unsubscribe link.</p>' +
      (LC.cerr ? '<div class="w152err">' + E(LC.cerr) + '</div>' : '') + (LC.cmsg ? '<div class="w154msg">' + E(LC.cmsg) + '</div>' : '') + (LC.cbusy ? '<div class="m">' + E(LC.cbusy) + '</div>' : '') +
      '<div class="w154acts"><button class="w152btn ghost" data-w155csave>' + I('check') + ' Save the draft</button><button class="w152btn ghost" data-w155cprev>Preview</button>' +
      '<button class="w152btn ghost" data-w155ctest>' + I('mail') + ' Send me a test</button><button class="w152btn" data-w155csend>' + I('send') + ' Send…</button>' +
      '<button class="w152btn ghost" data-w155cclose>Close</button>' + (c.id ? '<button class="w152btn ghost" data-w155cdel>' + I('trash') + ' Delete the draft</button>' : '') + '</div></div>';
  }
  function checkHtml() {
    var k = LC.check; if (!k) return '';
    if (k.error && k.audience == null) return '<div class="w152err">' + E(k.error) + '</div>';
    var why = Object.keys(k.why || {}).map(function (b) { return '<li>' + E(b) + ': ' + Number(k.why[b]).toLocaleString('en-CA') + '</li>'; }).join('');
    var live = k.mode === 'live';
    return '<div class="w155chk"><b>' + plural(k.eligible || 0, 'person gets it', 'people get it') + '</b> of ' + plural(k.audience || 0, 'person', 'people') + ' on the list' +
      (k.duplicates ? ' (' + plural(k.duplicates, 'shared address', 'shared addresses') + ' counted once)' : '') + '.' +
      (k.held ? '<div class="m">Held back by the rule: ' + plural(k.held, 'person', 'people') + '</div><ul>' + why + '</ul>' : '') +
      (k.per_day ? '<div class="m">At up to ' + k.per_day + ' a day this takes ' + plural(k.days || 1, 'day', 'days') + '.</div>' : '') +
      (LC.confirm ? (live && k.eligible ? '<div class="w155cf"><b>Send it to ' + plural(k.eligible, 'person', 'people') + ' now?</b> The first ones go within the minute; the rest follow at Resend’s pace.<div class="w154acts"><button class="w152btn" data-w155cgo>' + I('send') + ' Send it</button><button class="w152btn ghost" data-w155cno>Not yet</button></div></div>'
        : !live ? '<div class="w155cf test">' + I('lock') + ' The Hub is in test mode, so this campaign cannot go to the list yet. Send yourself a test; an admin switches the mode to live in the Email tab when the team is ready.</div>' : '<div class="w155cf test">Nobody on this list can receive it.</div>') : '') + '</div>';
  }
  function previewPane() {
    var p = LC.cprev;
    return '<div class="w154card"><h3>' + I('mail') + ' Preview</h3>' + checkHtml() +
      (p && p.html ? '<div class="w154pv"><div class="m">From: ' + E(p.from || '') + '<br>Subject: <b>' + E(p.subject || '') + '</b>' + (p.preheader ? '<br>Preview text: ' + E(p.preheader) : '') + '</div><iframe class="w154frame" sandbox="" title="The email as it will look" srcdoc="' + E(p.html) + '"></iframe></div>'
        : p && p.err ? '<div class="w152err">' + E(p.err) + '</div>' : '<p class="m">Preview shows the email in the Welfare Avenue layout, as it will look in an inbox.</p>') + '</div>';
  }
  function reportHtml(k) {
    var cs = statsFor(k.id), list = listById(k.list_id), sent = Number(cs.sent) || 0, elig = Number(k.eligible) || 0, waiting = Number(cs.queued) || 0;
    var tile = function (n, l) { return '<div class="w152st"><b>' + (Number(n) || 0).toLocaleString('en-CA') + '</b><span>' + E(l) + '</span></div>'; };
    var rows = (LC.rcpFor === k.id && LC.rcp) ? LC.rcp : null;
    var bar = elig ? Math.min(100, Math.round(sent * 100 / elig)) : 0;
    return '<div class="w154card wide"><h3>' + I('send') + ' ' + E(k.name || k.subject) + ' ' + lchip(CSTAT, k.status) + '</h3>' +
      '<div class="w154kv"><span>Subject</span><span>' + E(k.subject || '') + '</span></div><div class="w154kv"><span>List</span><span>' + E(list ? list.name : 'the list was deleted') + ' · ' + E((CK[k.kind] || [k.kind])[0]) + '</span></div>' +
      '<div class="w154kv"><span>From</span><span>' + E((k.from_name || (MAIL.st && MAIL.st.settings && MAIL.st.settings.mail_from_name) || 'Welfare Avenue') + ' <' + (k.from_email || (MAIL.st && MAIL.st.settings && MAIL.st.settings.mail_from_email) || 'info@welfareavenue.com') + '>') + '</span></div>' +
      '<div class="w154kv"><span>Sent</span><span>' + (k.queued_at ? 'started ' + E(fmtDay(k.queued_at)) + ' by ' + E(k.updated_by || k.created_by || '') : 'not started') + (k.sent_at ? ', finished ' + E(fmtDay(k.sent_at)) : '') + '</span></div>' +
      '<div class="w155bar" role="progressbar" aria-valuenow="' + bar + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + bar + '%"></i></div><div class="m">' + plural(sent, 'email sent', 'emails sent') + ' of ' + plural(elig, 'person', 'people') + (waiting ? ' · ' + plural(waiting, 'waiting', 'waiting') : '') + '</div>' +
      '<div class="w152stats">' + tile(cs.delivered, 'delivered') + tile(cs.opened, 'opened (' + pct(cs.opened, sent) + ')') + tile(cs.clicked, 'clicked (' + pct(cs.clicked, sent) + ')') + tile(cs.unsubscribed, 'unsubscribed') + '</div>' +
      '<div class="w152stats">' + tile(cs.bounced, 'bounced') + tile(cs.suppressed, 'held back by the rule') + tile(cs.failed, 'failed') + tile(cs.cancelled, 'cancelled') + '</div>' +
      (LC.cmsg ? '<div class="w154msg">' + E(LC.cmsg) + '</div>' : '') +
      '<div class="w154acts">' + ((k.status === 'sending' || k.status === 'queued') && waiting ? '<button class="w152btn ghost" data-w155cstop>Stop what is still waiting</button>' : '') +
      '<button class="w152btn ghost" data-w155cdup>Copy into a new draft</button><button class="w152btn ghost" data-w155cclose>Back to the campaigns</button></div>' +
      '<h3 style="margin-top:18px">Recipients</h3>' + (rows ? (rows.length ? '<div class="w154sl">' + rows.slice(0, 300).map(function (r) {
        var c = contact(r.contact_id);
        return '<div class="w154sr"><span>' + (c ? '<a href="#crm/c/' + E(c.id) + '" data-w152open="' + E(c.id) + '">' + E(c.full_name || r.to_email) + '</a>' : E(r.to_email)) + '</span><span class="m">' + E(r.to_email) + '</span><span>' + mchip(MSTATUS, r.status) +
          (r.opened_at ? ' opened' : '') + (r.clicked_at ? ', clicked' : '') + '</span><span class="m">' + E(r.status === 'suppressed' ? r.permission_basis || '' : fmtDay(r.sent_at || r.created_at)) + '</span></div>';
      }).join('') + '</div>' : '<p class="m">Nobody yet.</p>') : '<p class="m">Loading…</p>') + '</div>';
  }
  function paintCampaigns(root) {
    var need = [];
    if (!S.campaigns) need.push(load('campaigns')); if (!S.cstats) need.push(load('cstats')); if (!S.lists) need.push(load('lists')); if (!S.templates) need.push(load('templates')); if (!LC.sizes) need.push(sizes());
    if (!MAIL.st) need.push(mailFn('settings').then(function (r) { if (r && !r.error) MAIL.st = r; else MAIL.st = MAIL.st || { settings: {} }; }));
    if (need.length) { root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + busy('Loading the campaigns…'); Promise.all(need).then(function () { if (S.ui.tab === 'campaigns') paint(); }); return; }
    var html = statsHtml(S.contacts || []) + tabsHtml();
    if (LC.cid && LC.cid !== 'new' && !LC.c) {
      var k = campById(LC.cid);
      if (k && k.status !== 'draft') {
        if (LC.rcpFor !== k.id) { LC.rcpFor = k.id; LC.rcp = null; Promise.resolve(db.from('crm_email_sends').select('id,contact_id,to_email,status,permission_basis,sent_at,opened_at,clicked_at,created_at').eq('campaign_id', k.id).order('id', { ascending: true }).limit(1000)).then(function (r) { LC.rcp = (r && r.data) || []; if (S.ui.tab === 'campaigns') paint(); }); }
        root.innerHTML = html + '<div class="w155grid">' + reportHtml(k) + '</div>'; return;
      }
      if (k) LC.c = fromCampaign(k);
    }
    if (LC.cid === 'new' && !LC.c) { LC.c = blankCampaign(LC.newList); LC.newList = null; }
    root.innerHTML = html + (LC.c ? '<div class="w155grid">' + editorHtml() + previewPane() + '</div>' : campListHtml());
  }
  function campRowFromEditor() {
    var c = LC.c, st = MAIL.st && MAIL.st.settings ? MAIL.st.settings : {};
    var fromName = c.from === 'me' ? myName() : c.from === 'custom' ? String(c.from_name || '').trim() : '';
    var fromEmail = c.from === 'me' ? myEmail() : c.from === 'custom' ? String(c.from_email || '').trim().toLowerCase() : '';
    return { name: String(c.name || '').trim() || String(c.subject || '').trim() || 'Untitled campaign', list_id: c.list_id ? Number(c.list_id) : null, template_key: c.template_key || 'newsletter', kind: c.kind,
      subject: String(c.subject || '').trim() || null, preheader: String(c.preheader || '').trim() || null,
      vars: c.studio ? Object.assign({}, c.vars || {}, { studio: true }) : { headline: String(c.headline || '').trim(), body_text: String(c.body || ''), body_html: bodyHtml(c.body), cta_label: String(c.cta_label || '').trim() || 'Visit welfareavenue.com', cta_url: String(c.cta_url || '').trim() || 'https://welfareavenue.com' },
      from_name: fromName || null, from_email: fromEmail || null, reply_to: null, updated_by: actor(), updated_at: new Date().toISOString(), _st: st };
  }
  function saveCampaign() {
    var c = LC.c; if (!c) return Promise.resolve(null);
    var row = campRowFromEditor(); delete row._st;
    if (c.from === 'custom' && !/^[^\s@]+@welfareavenue\.com$/i.test(row.from_email || '')) { LC.cerr = 'The sender’s address must be an @welfareavenue.com address.'; paint(); return Promise.resolve(null); }
    var q = c.id ? db.from('crm_campaigns').update(row).eq('id', c.id).select().single() : db.from('crm_campaigns').insert(Object.assign({ status: 'draft', created_by: actor() }, row)).select().single();
    LC.cerr = '';
    return Promise.resolve(q).then(function (r) {
      if (r && r.error) { LC.cerr = 'Not saved: ' + (r.error.message || r.error); paint(); return null; }
      var saved = (r && r.data) || null; if (saved && saved.id) { c.id = saved.id; LC.cid = String(saved.id); try { history.replaceState(null, '', '#crm/campaigns/' + saved.id); } catch (e) { /* fine */ } }
      return load('campaigns', true).then(function () { return c.id; });
    });
  }
  function previewCamp() {
    var row = campRowFromEditor();
    LC.cprev = { busy: true }; LC.cbusy = 'Rendering the preview…'; paint();
    mailFn('preview', { template_key: row.template_key, kind: row.kind, subject: row.subject || 'News from Welfare Avenue', preheader: row.preheader, vars: row.vars, from_name: row.from_name, from_email: row.from_email }).then(function (r) {
      LC.cbusy = ''; LC.cprev = r.error ? { err: 'The preview did not come back: ' + r.error } : r; paint();
    });
  }
  function testCamp() {
    LC.cbusy = 'Saving and sending a test to ' + myEmail() + '…'; LC.cmsg = ''; paint();
    saveCampaign().then(function (id) {
      if (!id) { LC.cbusy = ''; paint(); return; }
      mailFn('campaign_test', { campaign_id: id, to: myEmail() }).then(function (r) { LC.cbusy = ''; if (r.error) LC.cerr = 'The test did not go: ' + r.error; else LC.cmsg = 'Test sent to ' + (r.to || myEmail()) + '.'; paint(); });
    });
  }
  function checkCamp(confirm) {
    if (!LC.c.list_id) { LC.cerr = 'Pick a list first.'; paint(); return; }
    if (!String(LC.c.subject || '').trim()) { LC.cerr = 'Write a subject first.'; paint(); return; }
    LC.cbusy = 'Checking who gets it…'; LC.cmsg = ''; paint();
    saveCampaign().then(function (id) {
      if (!id) { LC.cbusy = ''; paint(); return; }
      mailFn('campaign_check', { campaign_id: id }).then(function (r) { LC.cbusy = ''; LC.check = r; LC.confirm = !!confirm && !r.error; if (r.error) LC.cerr = r.error; paint(); });
    });
  }
  function sendCamp() {
    var id = LC.c && LC.c.id; if (!id) return;
    LC.cbusy = 'Sending…'; paint();
    mailFn('campaign_queue', { campaign_id: id }).then(function (r) {
      LC.cbusy = '';
      if (r.error) { LC.cerr = r.error; LC.confirm = false; paint(); return; }
      LC.cmsg = 'Sending to ' + plural(r.queued || r.eligible || 0, 'person', 'people') + (r.first && r.first.sent ? '; the first ' + r.first.sent + ' went out already' : '') + '.';
      LC.c = null; LC.check = null; LC.confirm = false; LC.cprev = null;
      Promise.all([load('campaigns', true), load('cstats', true)]).then(function () { paint(); });
    });
  }
  function stopCamp(id) {
    mailFn('campaign_cancel', { campaign_id: id }).then(function (r) {
      LC.cmsg = r.error ? 'Not stopped: ' + r.error : 'Stopped: ' + plural(r.cancelled || 0, 'waiting email', 'waiting emails') + ' cancelled.';
      LC.rcpFor = null; Promise.all([load('campaigns', true), load('cstats', true)]).then(function () { paint(); });
    });
  }
  function delCamp() {
    var id = LC.c && LC.c.id; if (!id) { LC.c = null; go('#crm/campaigns'); return; }
    Promise.resolve(db.from('crm_campaigns').delete().eq('id', id)).then(function (r) {
      LC.cmsg = r && r.error ? 'Not deleted: ' + (r.error.message || r.error) : 'Draft deleted.'; LC.c = null; LC.check = null; LC.cprev = null; load('campaigns', true).then(function () { go('#crm/campaigns'); paint(); });
    });
  }
  function openCampaigns(parts) {
    var id = parts[2] || null;
    if (id !== LC.cid) { LC.c = null; LC.check = null; LC.confirm = false; LC.cprev = null; LC.cerr = ''; if (id) LC.cmsg = ''; }
    LC.cid = id;
  }

  /* ---------- styles ---------- */
  var css155 = document.createElement('style'); css155.id = 'w155css';
  css155.textContent = ''
    + '.w155grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:16px;align-items:start;}.w155grid>.wide{grid-column:1/-1;}'
    + '.w155rows{display:flex;flex-direction:column;}.w155row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px 12px;align-items:center;padding:12px 0;border-top:1px solid rgba(16,63,57,.08);}.w155row>.w155ra{grid-column:1/-1;justify-content:flex-start;}'
    + '.w155nm{display:flex;flex-direction:column;min-width:0;}.w155nm b{font-size:14.5px;}.w155nm .m{overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}.w155n{font-size:13.5px;white-space:nowrap;}'
    + '.w155ra{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}'
    + '.w155lb{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--wa-muted,' + MUTED + ');margin:0 0 12px;}.w155lb .w152in,.w155lb .w152sel,.w155lb textarea{font-size:14px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--wa-ink,' + INK + ');width:100%;box-sizing:border-box;}.w155lb .m{text-transform:none;letter-spacing:0;font-weight:500;}.w155lb .w152sel{flex:none;max-width:none;}'
    + '.w155lb textarea{min-height:150px;font-family:inherit;line-height:1.5;}.w155two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}'
    + '.w155g{border:1px solid rgba(16,63,57,.14);border-radius:14px;padding:12px;margin:0 0 6px;background:rgba(16,63,57,.025);}.w155gh{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:' + GREEN + ';margin-bottom:8px;}'
    + '.w155c{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center;}.w155c .w152sel,.w155c .w152in{width:100%;min-width:0;box-sizing:border-box;}'
    + '.w155and{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted,' + MUTED + ');margin:5px 0 5px 4px;}.w155g>.w152btn{margin-top:8px;}'
    + '.w155or{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + PURPLE + ';}.w155or:before,.w155or:after{content:"";flex:1;height:1px;background:rgba(111,100,171,.35);}'
    + '.w155res{margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(16,63,57,.05);font-size:14px;}.w155res.busy{opacity:.6;}.w152lnk{all:unset;cursor:pointer;color:' + GREEN + ';font-weight:600;text-decoration:underline;text-decoration-color:rgba(16,63,57,.3);text-underline-offset:2px;}.w152lnk:hover{text-decoration-color:currentColor;}.w152lnk:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;border-radius:4px;}.w155mix{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0;font-size:13px;}'
    + '.w155ct{border:1px solid rgba(16,63,57,.1);border-radius:12px;overflow:hidden;}.w155ch,.w155cr{display:grid;grid-template-columns:minmax(0,1.8fr) auto minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,.7fr);gap:10px;padding:10px 12px;align-items:center;font-size:13px;}'
    + '.w155ch{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted,' + MUTED + ');background:rgba(16,63,57,.04);}.w155cr{border-top:1px solid rgba(16,63,57,.07);}'
    + '.w155cn{all:unset;cursor:pointer;display:flex;flex-direction:column;min-width:0;}.w155cn b{color:' + GREEN + ';font-size:14px;}.w155cn:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;border-radius:6px;}'
    + '.w155mode{margin:0 0 12px;padding:9px 12px;border-radius:12px;font-size:13px;display:flex;gap:6px;align-items:flex-start;}.w155mode.test{background:rgba(220,165,39,.15);}.w155mode.live{background:rgba(16,63,57,.08);}'
    + '.w155chk{margin:0 0 12px;padding:12px 14px;border-radius:14px;background:rgba(16,63,57,.05);font-size:14px;}.w155chk ul{margin:4px 0 0 18px;padding:0;font-size:13px;}'
    + '.w155cf{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(220,165,39,.18);}.w155cf.test{background:rgba(140,140,140,.12);}'
    + '.w155studio{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px;padding:12px 14px;border-radius:14px;background:rgba(220,165,39,.12);font-size:13.5px;line-height:1.45;}.w155studio>span{flex:1;min-width:220px;}'
    + '.w155bar{height:10px;border-radius:99px;background:rgba(16,63,57,.1);overflow:hidden;margin:12px 0 4px;}.w155bar i{display:block;height:100%;background:' + TEAL + ';border-radius:99px;}'
    + '@media (max-width:980px){.w155grid{grid-template-columns:1fr;}.w155ch,.w155cr{grid-template-columns:minmax(0,1.6fr) auto minmax(0,1.2fr);}.w155ch>span:nth-child(n+4),.w155cr>div:nth-child(n+4){display:none;}}'
    + '@media (max-width:700px){.w155c{grid-template-columns:1fr 1fr;}.w155c>button{justify-self:end;}.w155two{grid-template-columns:1fr;}}';
  document.head.appendChild(css155);

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('.w152root')) return;
    var ed = LC.edit;
    if ((el = t.closest('[data-w155new]'))) { e.preventDefault(); LC.edit = { id: null, name: '', description: '', groups: [{ all: [newCond('kind')] }] }; LC.prev = null; LC.msg = ''; LC.err = ''; paint(); return; }
    if ((el = t.closest('[data-w155fromf]'))) { e.preventDefault(); LC.edit = { id: null, name: '', description: 'From the Contacts filters', groups: groupsFromFilters() }; LC.prev = null; LC.msg = ''; LC.err = ''; paint(); return; }
    if ((el = t.closest('[data-w155edit]'))) { e.preventDefault(); var l = listById(el.getAttribute('data-w155edit')); if (!l) return; var g = (l.filter && Array.isArray(l.filter.groups)) ? l.filter.groups : [{ all: [] }]; LC.edit = { id: l.id, name: l.name, description: l.description || '', groups: JSON.parse(JSON.stringify(g)) }; LC.prev = null; LC.msg = ''; LC.err = ''; paint(); return; }
    if ((el = t.closest('[data-w155mail]'))) { e.preventDefault(); LC.newList = el.getAttribute('data-w155mail'); LC.c = null; go('#crm/campaigns/new'); return; }
    if ((el = t.closest('[data-w155and]')) && ed) { e.preventDefault(); ed.groups[Number(el.getAttribute('data-w155and'))].all.push(newCond('served')); previewSoon(); paint(); return; }
    if ((el = t.closest('[data-w155or]')) && ed) { e.preventDefault(); ed.groups.push({ all: [newCond('kind')] }); previewSoon(); paint(); return; }
    if ((el = t.closest('[data-w155gx]')) && ed) { e.preventDefault(); ed.groups.splice(Number(el.getAttribute('data-w155gx')), 1); if (!ed.groups.length) ed.groups.push({ all: [] }); previewSoon(); paint(); return; }
    if ((el = t.closest('[data-w155cx]')) && ed) { e.preventDefault(); var a = atOf(el.getAttribute('data-w155cx')); ed.groups[a.g].all.splice(a.c, 1); previewSoon(); paint(); return; }
    if ((el = t.closest('[data-w155save]')) && ed) { e.preventDefault(); saveList(el.getAttribute('data-w155save')); return; }
    if ((el = t.closest('[data-w155del]')) && ed) { e.preventDefault(); ed.del = true; paint(); return; }
    if ((el = t.closest('[data-w155delno]')) && ed) { e.preventDefault(); ed.del = false; paint(); return; }
    if ((el = t.closest('[data-w155delok]')) && ed) { e.preventDefault(); delList(); return; }
    if ((el = t.closest('[data-w155cancel]'))) { e.preventDefault(); LC.edit = null; LC.prev = null; LC.err = ''; paint(); return; }
    /* campaigns */
    if ((el = t.closest('[data-w155cnew]'))) { e.preventDefault(); LC.c = null; LC.cmsg = ''; go('#crm/campaigns/new'); return; }
    if ((el = t.closest('[data-w155copen]'))) { e.preventDefault(); LC.cmsg = ''; go('#crm/campaigns/' + el.getAttribute('data-w155copen')); return; }
    if ((el = t.closest('[data-w155cclose]'))) { e.preventDefault(); LC.c = null; LC.check = null; LC.cprev = null; LC.confirm = false; go('#crm/campaigns'); return; }
    if ((el = t.closest('[data-w155csave]')) && LC.c) { e.preventDefault(); LC.cbusy = 'Saving…'; paint(); saveCampaign().then(function (id) { LC.cbusy = ''; if (id) LC.cmsg = 'Draft saved.'; paint(); }); return; }
    if ((el = t.closest('[data-w155cprev]')) && LC.c) { e.preventDefault(); previewCamp(); return; }
    if ((el = t.closest('[data-w155ctest]')) && LC.c) { e.preventDefault(); testCamp(); return; }
    if ((el = t.closest('[data-w155csend]')) && LC.c) { e.preventDefault(); checkCamp(true); return; }
    if ((el = t.closest('[data-w155cgo]')) && LC.c) { e.preventDefault(); el.disabled = true; sendCamp(); return; }
    if ((el = t.closest('[data-w155cno]'))) { e.preventDefault(); LC.confirm = false; paint(); return; }
    if ((el = t.closest('[data-w155cdel]'))) { e.preventDefault(); delCamp(); return; }
    if ((el = t.closest('[data-w155cstop]'))) { e.preventDefault(); stopCamp(LC.cid); return; }
    if ((el = t.closest('[data-w155cdup]'))) { e.preventDefault(); var src = campById(LC.cid); if (!src) return; var copy = fromCampaign(src); copy.id = null; copy.name = (src.name || 'Campaign') + ' (copy)'; LC.c = copy; LC.cid = 'new'; LC.check = null; LC.cprev = null; LC.cmsg = ''; try { history.replaceState(null, '', '#crm/campaigns/new'); } catch (x) { /* fine */ } paint(); return; }
  });
  function onField(e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.w152root')) return;
    var ed = LC.edit, a;
    if (t.hasAttribute('data-w155f') && ed) { ed[t.getAttribute('data-w155f')] = t.value; return; }
    if (t.hasAttribute('data-w155cf') && ed) { a = atOf(t.getAttribute('data-w155cf')); ed.groups[a.g].all[a.c] = newCond(t.value); previewSoon(); paint(); return; }
    if (t.hasAttribute('data-w155co') && ed) { a = atOf(t.getAttribute('data-w155co')); var k = ed.groups[a.g].all[a.c]; k.op = t.value; if (needsValue(k) && (k.v === '' || k.v == null || !/^\d/.test(String(k.v)) && lf(k.f)[2] === 'num')) k.v = defVal(k.f, k.op); previewSoon(); paint(); return; }
    if (t.hasAttribute('data-w155cv') && ed) { a = atOf(t.getAttribute('data-w155cv')); ed.groups[a.g].all[a.c].v = t.value; previewSoon(); return; }
    if (t.hasAttribute('data-w155k') && LC.c) {
      var key = t.getAttribute('data-w155k'); LC.c[key] = t.value;
      if (key === 'kind' || key === 'from' || key === 'list_id') { LC.check = null; LC.confirm = false; if (e.type === 'change') paint(); }
    }
  }
  document.addEventListener('input', onField);
  document.addEventListener('change', function (e) { var t = e.target; if (t && t.tagName === 'SELECT') onField(e); });

