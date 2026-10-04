  /* ---------- where it goes: a test, one person, a list (a campaign), or a template (and so the automations) ----------
     Every send goes through mail-send: the permission rule and mail_mode decide, as for any email the Hub sends. */
  var STABS = [['test', 'Send me a test', 'mail'], ['person', 'One person', 'person'], ['list', 'A list', 'list'], ['template', 'Save as a template', 'save']];
  function contactMatches(q) {
    q = lower(q); if (q.length < 2) return [];
    return contacts().filter(function (c) {
      if (c.merged_into) return false;
      var hay = lower([c.full_name, (c.emails || []).join(' '), c.primary_email].join(' '));
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    }).slice(0, 8);
  }
  function permLine(c) {
    var c152 = crm(), p = null;
    try { p = c152 && c152.permWhy ? c152.permWhy(c) : null; } catch (e) { p = null; }
    if (!p) return '';
    var kind = SS.d.kind, ok = kind === 'transactional' ? p.trans : kind === 'volunteer' ? p.trans && !/unsubscribed/.test(p.why) : p.news;
    return '<div class="w202perm ' + (ok ? 'ok' : 'no') + '">' + I(ok ? 'check' : 'alert') + ' ' + (ok ? 'They can get it (' + E(p.why) + ').' : 'The permission rule will hold it back: ' + E(p.why) + '.') + '</div>';
  }
  function modeNote() {
    var st = mailSettings(); if (!st) return '';
    return st.mail_mode === 'live' ? '' : '<div class="w155mode test">' + I('alert') + ' Test mode: email goes only to the test recipients (' + E(st.mail_test_recipients || 'none set') + ') until an admin switches the Hub to live in the Email tab.</div>';
  }
  function stopsHtml() {
    var st = stops(); if (!st.length) return '';
    return '<div class="w202stops"><b>' + I('alert') + ' Fix ' + (st.length === 1 ? 'this' : 'these') + ' first:</b><ul>' + st.slice(0, 6).map(function (c) { return '<li>' + (c.i != null ? '<button class="w202lnk" data-w202goto="' + c.i + '">' + E(c.msg) + '</button>' : E(c.msg)) + '</li>'; }).join('') + '</ul></div>';
  }
  function sendHtml() {
    var s = SS.send; if (!s || !SS.d) return '';
    var e = SS.d, blocked = stops().length > 0, h = '';
    if (s.tab === 'test') {
      h = '<p>A test goes to you, <b>' + E(myEmail()) + '</b>, marked as a test, with your own name in it.</p>' + stopsHtml() +
        '<div class="w154acts"><button class="w152btn" data-w202dotest' + (blocked || s.busy ? ' disabled' : '') + '>' + I('mail') + ' Send me a test</button></div>';
    }
    if (s.tab === 'person') {
      var c = s.contact ? contacts().filter(function (x) { return String(x.id) === String(s.contact); })[0] : null;
      h = modeNote() + (c ? '<div class="w202who" data-w198skip><b>' + E(c.full_name || '(no name)') + '</b> <span class="m">' + E(c.primary_email || (c.emails || [])[0] || 'no email address') + '</span>' +
        '<button class="w152btn sm ghost" data-w202whox>Someone else</button></div>' + permLine(c)
        : '<label class="w155lb">Who?<input class="w152in" data-w202who value="' + E(s.q || '') + '" placeholder="A name or an email address" autocomplete="off"></label><div class="w202whol" data-w202whores data-w198skip>' + whoResults(s.q) + '</div>') +
        stopsHtml() + (c ? '<div class="w154acts"><button class="w152btn" data-w202doperson' + (blocked || s.busy ? ' disabled' : '') + '>' + I('send') + ' Send it to ' + E(String(c.full_name || 'them').split(' ')[0]) + '</button></div>' : '');
    }
    if (s.tab === 'list') {
      var ls = lists();
      h = (e.kind === 'transactional' ? '<div class="w155mode test">' + I('alert') + ' A thank-you, reminder or confirmation goes person by person (One person) or through an automation. To send it to a list, change its kind to News, A volunteer call-out or An appeal.</div>'
        : '<p>This makes a campaign draft with this email: the Campaigns tab then checks who on the list can get it, sends you a test and sends it, at Resend’s pace.</p>' +
          (ls.length ? '<label class="w155lb">The list<select class="w152sel" data-w202list><option value="">Pick a list…</option>' + ls.map(function (l) { return '<option value="' + E(l.id) + '"' + (String(l.id) === String(s.list) ? ' selected' : '') + '>' + E(l.name) + '</option>'; }).join('') + '</select></label>'
            : '<p class="m">No list yet: make one in the Lists tab first.</p>') + stopsHtml() +
          '<div class="w154acts"><button class="w152btn" data-w202docamp' + (blocked || s.busy || !s.list ? ' disabled' : '') + '>' + I('list') + ' Make the campaign</button></div>');
    }
    if (s.tab === 'template') {
      var isT = e.one_off === false;
      h = '<p>' + (isT ? 'It is a template: on the studio’s shelf, and in the automations’ list as “Saved email: ' + E(e.name) + '”.' : 'A template stays on the studio’s shelf for the team to use again, and the automations can send it (as a “Saved email”).') + '</p>' +
        '<label class="w155lb">Name<input class="w152in" data-w202t="name" value="' + E(s.t.name) + '" data-w198skip></label>' +
        '<label class="w155lb">When to use it<input class="w152in" data-w202t="description" value="' + E(s.t.description) + '" placeholder="The day after a serving: what the volunteers made possible" data-w198skip></label>' +
        '<div class="w202two"><label class="w155lb half">Shelf<select class="w152sel" data-w202t="category">' + SHELF.map(function (x) { return '<option value="' + x[0] + '"' + (s.t.category === x[0] ? ' selected' : '') + '>' + E(x[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="w155lb half">For<select class="w152sel" data-w202t="audience"><option value="">Anyone</option>' + Object.keys(AUD).map(function (a) { return '<option value="' + a + '"' + (s.t.audience === a ? ' selected' : '') + '>' + E(AUD[a]) + '</option>'; }).join('') + '</select></label></div>' +
        (isT ? '<label class="w202ck"><input type="checkbox" data-w202t="active"' + (s.t.active !== false ? ' checked' : '') + '> On (an automation can send it)</label>' : '') +
        (hasBrackets({ subject: e.subject, preheader: e.preheader, html_body: MAIL202.render(e.design) }) ? '<p class="m">It still has [brackets]: fine for a template people fill in, but an automation would send them as they are.</p>' : '') +
        '<div class="w154acts"><button class="w152btn" data-w202dotpl' + (s.busy ? ' disabled' : '') + '>' + I('save') + (isT ? ' Save the template' : ' Save as a template') + '</button></div>';
    }
    return '<div class="w154card w202send" data-w202sec="send"><div class="w202sh"><h3>' + I('send') + ' Send or save</h3><button class="w202x" data-w202sendx aria-label="Close">' + I('x') + '</button></div>' +
      '<div class="w202stabs" role="tablist">' + STABS.map(function (t) { return '<button role="tab" class="' + (s.tab === t[0] ? 'on' : '') + '" data-w202stab="' + t[0] + '" aria-selected="' + (s.tab === t[0]) + '">' + I(t[2]) + E(t[1]) + '</button>'; }).join('') + '</div>' +
      h + (s.busy ? busyHtml(s.busy) : '') + (s.msg ? '<div class="w154msg">' + E(s.msg) + '</div>' : '') + (s.err ? '<div class="w152err">' + E(s.err) + '</div>' : '') + '</div>';
  }
  function whoResults(q) {
    var rows = contactMatches(q);
    if (!str(q).trim() || str(q).trim().length < 2) return '<p class="m">Type at least two letters.</p>';
    if (!rows.length) return '<p class="m">Nobody in the CRM matches.</p>';
    return rows.map(function (c) { return '<button class="w202whob" data-w202whopick="' + E(c.id) + '"><b>' + E(c.full_name || '(no name)') + '</b><span class="m">' + E(c.primary_email || (c.emails || [])[0] || 'no email address') + '</span></button>'; }).join('');
  }
  function openSend(tab) {
    var e = SS.d; if (!e) return;
    SS.send = { tab: tab || (SS.to ? 'person' : 'test'), q: '', contact: SS.to || null, list: null, busy: '', msg: '', err: '', t: { name: e.name, description: e.description || '', category: e.category || 'other', audience: e.audience || '', active: e.active !== false } };
    loadMailSettings().then(function () { if (SS.send) paint(); });
    paint();
    setTimeout(function () { var el = document.querySelector('.w202send'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
  }
  async function doTest() {
    var s = SS.send; if (!s || stops().length) return;
    s.busy = 'Saving and sending you a test…'; s.err = ''; s.msg = ''; paint();
    var key = await saveNow();
    if (!key) { s.busy = ''; s.err = 'It did not save, so no test went: ' + (SS.saveNote || 'it needs a subject'); paint(); return; }
    var r = await mailFn('test', { template_key: key, to: myEmail() });
    s.busy = ''; if (r.error) s.err = 'The test did not go: ' + r.error; else s.msg = 'Test sent to ' + (r.to || myEmail()) + '. It can take a minute to arrive.'; paint();
  }
  async function doPerson() {
    var s = SS.send; if (!s || !s.contact || stops().length) return;
    var c = contacts().filter(function (x) { return String(x.id) === String(s.contact); })[0]; if (!c) return;
    s.busy = 'Saving and sending it to ' + (c.full_name || 'them') + '…'; s.err = ''; s.msg = ''; paint();
    var key = await saveNow();
    if (!key) { s.busy = ''; s.err = 'It did not save, so nothing went.'; paint(); return; }
    var r = await mailFn('send', { contact_id: c.id, template_key: key });
    s.busy = '';
    if (r.error) s.err = r.error;
    else if (r.status === 'suppressed') s.err = 'Not sent: the permission rule held it back (' + (r.basis || 'no permission') + ').';
    else if (r.status === 'sent') s.msg = 'Sent to ' + (r.to || c.full_name) + '. It is on their timeline in the CRM.';
    else s.err = 'It did not go: ' + (r.error || r.status || 'no answer');
    paint();
  }
  async function doCampaign() {
    var s = SS.send, e = SS.d; if (!s || !s.list || stops().length || e.kind === 'transactional') return;
    s.busy = 'Saving and making the campaign…'; s.err = ''; paint();
    var key = await saveNow();
    if (!key) { s.busy = ''; s.err = 'It did not save, so no campaign was made.'; paint(); return; }
    var row = { name: str(e.name).trim() || e.subject, list_id: Number(s.list), template_key: key, kind: e.kind, subject: e.subject, preheader: e.preheader || null, vars: { studio: true },
      status: 'draft', created_by: myEmail(), updated_by: myEmail(), updated_at: new Date().toISOString() };
    var r; try { r = await db.from('crm_campaigns').insert(row).select().single(); } catch (er) { r = { error: er }; }
    s.busy = '';
    if (!r || r.error || !r.data) { s.err = 'The campaign was not made: ' + msgOf(r && r.error); paint(); return; }
    var c = crm(); try { if (c && c.load) await c.load('campaigns', true); } catch (er) { /* fine */ }
    SS.send = null;
    go('#crm/campaigns/' + r.data.id);
  }
  async function doTemplate() {
    var s = SS.send, e = SS.d; if (!s) return;
    if (!str(s.t.name).trim()) { s.err = 'Give the template a name.'; paint(); return; }
    var was = { one_off: e.one_off, name: e.name, description: e.description, category: e.category, audience: e.audience, active: e.active };
    e.one_off = false; e.name = s.t.name.trim(); e.description = s.t.description; e.category = s.t.category || 'other'; e.audience = s.t.audience || null; e.active = s.t.active !== false;
    s.busy = 'Saving the template…'; s.err = ''; s.msg = ''; paint();
    SS.dirty = true;
    var key = await saveNow();
    s.busy = '';
    if (!key) { Object.keys(was).forEach(function (k) { e[k] = was[k]; }); s.err = 'Not saved: ' + (SS.saveNote || 'it needs a subject'); paint(); return; }
    s.msg = 'Saved as a template: it is on the studio’s shelf, and the automations can send it as “Saved email: ' + e.name + '”.';
    paint();
  }
