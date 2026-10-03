  /* ---------- the assistant, full screen ---------- */
  function sheetEl() {
    var el = document.getElementById('w170sheet');
    if (!el) { el = document.createElement('div'); el.id = 'w170sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Your inbox assistant'); document.body.appendChild(el); }
    return el;
  }
  function openSheet(tab, gid) {
    S.open = true; S.tab = tab || S.tab || 'reply'; S.sel = gid || null;
    var el = sheetEl(), was = !el.classList.contains('on'); el.classList.add('on'); document.documentElement.classList.add('w170lock');
    render();
    if (was) setTimeout(function () { var b = document.querySelector('#w170sheet .w170tabs button.on') || document.querySelector('#w170sheet .w170xb'); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }, 0);   /* the keyboard starts in the assistant */
    loadOwner(true).then(function (o) {
      if (!o) { render(); return; }
      return loadRows(true).then(function () { if (!S.sel && !phone()) { var l = listFor(S.tab); if (l.length) S.sel = l[0].gmail_id; } render(); ensureDetail(); });
    });
  }
  function closeSheet(keepHash) {
    S.open = false; S.sel = null;
    var el = document.getElementById('w170sheet'); if (el) { el.classList.remove('on'); el.classList.remove('sel'); el.innerHTML = ''; }
    document.documentElement.classList.remove('w170lock');
    stopPoll();
    if (!keepHash && /^#mypage\/inbox/.test(location.hash || '')) { try { history.replaceState(null, '', '#mypage'); } catch (e) { location.hash = '#mypage'; } }
    paintCard();
    var c = document.querySelector('#w170card .w170foot [data-w170open]'); if (c && !keepHash) { try { c.focus({ preventScroll: true }); } catch (e) { /* fine */ } }   /* and comes back to the card */
  }
  function listFor(tab) {
    if (tab === 'reply') return S.showDone ? toReply().concat(repliedDone()) : toReply();
    if (tab === 'team') return S.showDone ? forTeam().concat(teamDone()) : forTeam();
    return [];
  }

  /* ---------- drawing ---------- */
  function headHtml() {
    var o = S.owner || {}, nr = toReply().length, nt = forTeam().length;
    var tabs = [['reply', 'To reply', nr], ['team', 'For a team', nt], ['sorted', 'Sorted', 0], ['settings', 'Settings', 0]];
    return '<header class="w170hd"><div class="ti"><span class="k">Welfare Avenue</span><h2>Your inbox</h2></div>'
      + '<nav class="w170tabs" aria-label="Your inbox">' + tabs.map(function (t) { return '<button type="button" data-w170tab="' + t[0] + '"' + (S.tab === t[0] ? ' class="on" aria-current="page"' : '') + '>' + t[1] + (t[2] ? '<span class="n">' + t[2] + '</span>' : '') + '</button>'; }).join('') + '</nav>'
      + '<span class="sp"></span><span class="st">' + (S.poll ? 'Sorting your new mail…' : (o.last_sort_at ? 'Sorted ' + E(ago(o.last_sort_at)) : 'Not sorted yet')) + '</span>'
      + '<button type="button" class="w170btn ghost sm" data-w170sort' + (S.poll ? ' disabled' : '') + '>' + (S.poll ? 'Sorting…' : 'Check now') + '</button>'
      + '<button type="button" class="w170xb" data-w170x aria-label="Close">&times;</button></header>';
  }
  function itemHtml(x) {
    var who = x.from_name || x.from_email || 'Someone', done = (S.tab === 'reply' && x.reply_state) || (S.tab === 'team' && x.team_state);
    var chips = [];
    if (x.label_name) chips.push('<span class="w170chip" title="' + E(x.label_name) + '">' + E(labelShort(x.label_name)) + '</span>');
    if (S.tab === 'reply') { if (x.reply_state === 'drafted') chips.push('<span class="w170chip gold">Draft saved</span>'); else if (x.reply_state === 'done') chips.push('<span class="w170chip">Replied</span>'); else if (x.reply_state === 'dismissed') chips.push('<span class="w170chip">No reply needed</span>'); }
    if (S.tab === 'team' && x.team) chips.push('<span class="w170chip team">' + E(x.team_state === 'sent' ? 'Sent to ' + (TEAMS[x.team] || x.team) : TEAMS[x.team] || x.team) + '</span>');
    return '<button type="button" class="w170it' + (S.sel === x.gmail_id ? ' on' : '') + (done ? ' dim' : '') + '" data-w170sel="' + E(x.gmail_id) + '"><span class="w170av" aria-hidden="true">' + E(initials(x.from_name, x.from_email)) + '</span>'
      + '<span class="tx"><b>' + E(who) + '</b><span class="s">' + E(x.subject || '(no subject)') + '</span><span class="m"><span>' + E(ago(x.received_at)) + '</span>' + chips.join('') + '</span></span></button>';
  }
  function listHtml() {
    if (S.tab !== 'reply' && S.tab !== 'team') return '';
    var list = listFor(S.tab), done = S.tab === 'reply' ? repliedDone().length : teamDone().length;
    var empty = S.tab === 'reply'
      ? '<div class="w170empty"><b>Nothing waiting on you</b>New mail that needs your own reply shows up here.</div>'
      : '<div class="w170empty"><b>Nothing for a team</b>Mail a team should handle shows up here, with the team the assistant thinks it is for.</div>';
    return '<aside class="w170list" aria-label="' + (S.tab === 'reply' ? 'Mail to reply to' : 'Mail for a team') + '">' + (S.rows === null ? '<div class="w170empty">Loading your inbox…</div>' : (list.length ? list.map(itemHtml).join('') : empty))
      + (done ? '<p style="text-align:center;margin:8px 0"><button type="button" class="w170lnk" data-w170done>' + (S.showDone ? 'Hide the ones you dealt with' : 'Show the ones you dealt with (' + done + ')') + '</button></p>' : '') + '</aside>';
  }
  function mailHead(x, d) {
    var o = S.owner || {};
    return '<button type="button" class="w170btn ghost sm w170back" data-w170back>&larr; Back</button><div class="w170mh"><h3>' + E(x.subject || '(no subject)') + '</h3><div class="meta"><span>From <b>' + E(x.from_name || x.from_email) + '</b>' + (x.from_name ? ' &lt;' + E(x.from_email) + '&gt;' : '') + '</span><span>' + E(when(x.received_at)) + '</span>'
      + (x.label_name ? '<span class="w170chip" title="The folder the assistant filed it in">' + E(x.label_name) + '</span>' : '')
      + '<a class="w170lnk" href="' + E(gmailUrl(o.email, x)) + '" target="_blank" rel="noopener">Open in Gmail</a></div></div>';
  }
  function mailBody(d) {
    if (!d || d.stage === 'loading' || !d.main) return d && d.err ? '<p class="w170err">' + E(d.err) + '</p>' : '<div class="w170mail"><span class="w170wait"><i></i>Opening the email…</span></div>';
    var h = d.history || [];
    return (h.length ? '<details class="w170hist"><summary>Earlier in the thread (' + h.length + ')</summary>' + h.map(function (m) { return '<div class="h"><i>' + E(m.mine ? 'You' : m.from) + ' · ' + E(when(m.date)) + '</i>' + E(m.text) + '</div>'; }).join('') + '</details>' : '')
      + '<div class="w170mail">' + E(d.main.text || '(no text: attachments only)') + (d.main.atts && d.main.atts.length ? '\n\nAttachments: ' + E(d.main.atts.join(', ')) : '') + '</div>'
      + ((d.later || []).some(function (m) { return m.mine; }) ? '<div class="w170ok" style="margin-top:10px">You have already replied in this thread.</div>' : '');
  }
  function replyTool(x, d) {
    var st = d.stage || 'read';
    var h = '<section class="w170tool" aria-live="polite"><h4>Reply</h4>';
    if (x.reply_state === 'drafted' && st !== 'draft' && st !== 'questions' && st !== 'saved') h += '<div class="w170ok" style="margin-bottom:10px">A draft is saved in your Gmail for this one' + (x.drafted_at ? ' (' + E(ago(x.drafted_at)) + ')' : '') + '. <a class="w170lnk" href="' + E(draftUrl((S.owner || {}).email, x)) + '" target="_blank" rel="noopener">Open the draft</a></div>';
    if (st === 'read' || st === 'loading') {
      h += '<p class="gist">The assistant asks what it needs to know, then writes the reply in your voice. You read it, change anything, and it saves as a draft in your Gmail: nothing is sent for you.</p>'
        + '<div class="w170acts"><button type="button" class="w170btn gold" data-w170help' + (st === 'loading' ? ' disabled' : '') + '>Help me reply</button>'
        + '<button type="button" class="w170btn ghost sm" data-w170mark="reply_done">I replied already</button><button type="button" class="w170btn ghost sm" data-w170mark="reply_dismiss">No reply needed</button></div>';
    } else if (st === 'asking') h += '<div class="w170wait"><i></i>Reading the email and working out what to ask you…</div>';
    else if (st === 'questions') {
      h += (d.gist ? '<p class="gist"><b>What they want:</b> ' + E(d.gist) + '</p>' : '')
        + (d.questions.length ? d.questions.map(function (qq, i) {
          var cur = d.answers[i] || '';
          return '<div class="w170q"><div class="qq">' + E(qq.q) + '</div><div class="w170opts" role="group" aria-label="' + E(qq.q) + '">' + qq.options.map(function (op) { return '<button type="button" data-w170ans="' + i + '" data-v="' + E(op) + '"' + (cur === op ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + E(op) + '</button>'; }).join('') + '</div>'
            + '<input type="text" data-w170own="' + i + '" placeholder="Or in your own words" value="' + E(d.custom[i] || '') + '" aria-label="Your own answer"></div>';
        }).join('') : '<p class="gist">Nothing to ask: this one is simple.</p>')
        + '<label class="w170l" for="w170note">Anything else to say<span class="op">optional</span></label><textarea id="w170note" rows="2" placeholder="A detail to include, someone to thank, a date">' + E(d.note || '') + '</textarea>'
        + '<div class="w170acts"><button type="button" class="w170btn gold" data-w170draft>Write my reply</button><button type="button" class="w170btn ghost sm" data-w170reset>Cancel</button></div>';
    } else if (st === 'drafting') h += '<div class="w170wait"><i></i>Writing it the way you would…</div>';
    else if (st === 'draft' || st === 'saving') {
      var others = d.main ? (String(d.main.to || '') + ',' + String(d.main.cc || '')).split(',').filter(function (a) { return /@/.test(a) && lower(a).indexOf(lower((S.owner || {}).email || '#')) < 0; }).length > 1 : false;
      h += '<label class="w170l" for="w170body">Your reply<span class="op">change anything you like</span></label><textarea id="w170body" class="w170draft" rows="12">' + E(d.draft || '') + '</textarea>'
        + ((d.brackets && d.brackets.length) || (d.notes && d.notes.length) ? '<div class="w170notes"><b>Before you send</b><ul>' + (d.brackets || []).map(function (b) { return '<li>Fill in ' + E(b) + '</li>'; }).join('') + (d.notes || []).map(function (n) { return '<li>' + E(n) + '</li>'; }).join('') + '</ul></div>' : '')
        + (d.framework ? '<p class="w170fw">Written with <b>' + E(d.framework.name) + '</b>. Reader: ' + E(d.framework.reader) + '. Register: ' + E(d.framework.register) + '.</p>' : '')
        + (others ? '<label class="w170ck"><input type="checkbox" data-w170all' + (d.replyAll ? ' checked' : '') + '> Reply to everyone on the email</label>' : '')
        + (d.warn ? '<div class="w170warn" role="alert">' + E(d.warn) + '</div>' : '')
        + (d.err ? '<p class="w170err" role="alert">' + E(d.err) + '</p>' : '')
        + '<div class="w170acts"><button type="button" class="w170btn gold" data-w170save' + (st === 'saving' ? ' disabled' : '') + '>' + (st === 'saving' ? 'Saving and checking it in Gmail…' : d.bracketOk ? 'Save it with the [brackets]' : 'Save as a Gmail draft') + '</button>'
        + '<button type="button" class="w170btn ghost sm" data-w170redraft>Write it again</button><button type="button" class="w170btn ghost sm" data-w170change>Change my answers</button></div>';
    } else if (st === 'saved') {
      var sv = d.saved || {}, own = (S.owner || {}).email;
      h += '<div class="w170ok" role="status"><span>' + (sv.updated ? 'Your draft for this email is updated in Gmail' : 'Saved in your Gmail drafts') + ', in the thread' + (sv.to && sv.to.length ? ', to ' + E(sv.to.join(', ')) : '') + '.'
        + '<span class="w170sub">The Hub read it back from Gmail: it is there' + (own ? ', in ' + E(own) : '') + '. Read it once more and send it from Gmail.</span></span></div>'
        + '<div class="w170acts"><a class="w170btn" href="' + E(sv.url || draftUrl(own, x)) + '" target="_blank" rel="noopener">Open the draft in Gmail</a><a class="w170lnk" href="' + E(sv.drafts_url || draftsUrl(own)) + '" target="_blank" rel="noopener" style="font-size:12.5px">All your drafts</a><button type="button" class="w170btn ghost sm" data-w170next>Next email</button></div>';
    }
    if (d.err && st !== 'loading' && st !== 'draft' && st !== 'saving') h += '<p class="w170err">' + E(d.err) + '</p>';
    return h + '</section>';
  }
  function teamTool(x, d) {
    var t = d.team || {}, team = t.team || x.team || '', people = team ? teamPeople(team) : [];
    var h = '<section class="w170tool" aria-live="polite"><h4>Send it to a team</h4>';
    if (x.team_state === 'sent' || t.sent) {
      return h + '<div class="w170ok">In ' + E(TEAMS[x.team] || x.team) + '’s Hub inbox, with your ask. ' + (t.sent && t.sent.person ? E(t.sent.person) + ' got a Slack message about it.' : 'Their Slack channel heard about it.') + '</div>'
        + (x.sent_mail_id || (t.sent && t.sent.mail_id) ? '<div class="w170acts"><a class="w170btn ghost sm" href="#requests/m/' + E(x.sent_mail_id || t.sent.mail_id) + '" data-w170go>See it in their inbox</a></div>' : '') + '</section>';
    }
    h += '<p class="gist">' + (x.team ? 'The assistant thinks this is for <b>' + E(TEAMS[x.team] || x.team) + '</b>. ' : '') + 'It goes to the team’s inbox in the Hub with the line you write, and their Slack channel hears about it. Pick one person on the team and they get the Slack message instead.</p>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="w170l" for="w170team">The team</label><select id="w170team">' + TEAM_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === team ? ' selected' : '') + '>' + E(TEAMS[k]) + '</option>'; }).join('') + '</select></div>'
      + '<div><label class="w170l" for="w170person">For<span class="op">optional</span></label><select id="w170person"><option value="">The whole team</option>' + people.map(function (p) { return '<option value="' + E(lower(p.email)) + '"' + (lower(p.email) === lower(t.person || '') ? ' selected' : '') + '>' + E(p.name) + '</option>'; }).join('') + '</select></div></div>'
      + '<label class="w170l" for="w170ask">What they should do<span class="op">one line, they read it first</span></label><textarea id="w170ask" rows="2" maxlength="300" placeholder="' + (t.loading ? 'Writing a first line for you…' : 'For example: Can you reply to Maria about volunteering on the 12th?') + '">' + E(t.ask || '') + '</textarea>'
      + '<div class="w170acts"><button type="button" class="w170btn gold" data-w170send' + (t.sending ? ' disabled' : '') + '>' + (t.sending ? 'Sending…' : 'Send to ' + E(TEAMS[team] || 'the team')) + '</button>'
      + '<button type="button" class="w170btn ghost sm" data-w170suggest' + (t.loading ? ' disabled' : '') + '>' + (t.loading ? 'Writing…' : 'Suggest the line') + '</button>'
      + '<button type="button" class="w170btn ghost sm" data-w170mark="team_dismiss">Not for a team</button></div>'
      + (t.err ? '<p class="w170err">' + E(t.err) + '</p>' : '');
    return h + '</section>';
  }
  function mainHtml() {
    if (S.tab === 'sorted') return '<main class="w170main full">' + sortedHtml() + '</main>';
    if (S.tab === 'settings') return '<main class="w170main full">' + settingsHtml() + '</main>';
    var x = S.sel ? rowBy(S.sel) : null;
    if (!x) return '<main class="w170main"><div class="w170empty"><b>' + (S.tab === 'reply' ? 'Pick an email' : 'Pick an email') + '</b>' + (S.tab === 'reply' ? 'Open one to read it and write back with the assistant.' : 'Open one to send it to the right team.') + '</div></main>';
    var d = S.D[x.gmail_id] || {};
    return '<main class="w170main">' + mailHead(x, d) + (S.tab === 'reply' ? replyTool(x, d) : teamTool(x, d)) + mailBody(d) + '</main>';
  }
  function sortedHtml() {
    var o = S.owner || {}, rows = (S.rows || []).slice(0, 150), byDay = {}, order = [];
    rows.forEach(function (x) { var k = dayOf(x.received_at); if (!byDay[k]) { byDay[k] = []; order.push(k); } byDay[k].push(x); });
    var labelled = rows.filter(function (x) { return x.label_name; }).length;
    var h = '<div class="w170sum"><span class="w170chip">' + plural(labelled, 'filed in a folder', 'filed in folders') + '</span><span class="w170chip">' + plural(rows.length - labelled, 'left in the inbox', 'left in the inbox') + '</span>'
      + (S.skipped ? '<span class="w170chip gold" title="Personal mail: the assistant keeps nothing but that it left it alone">' + plural(S.skipped, 'personal email left alone', 'personal emails left alone') + '</span>' : '')
      + (S.errors ? '<span class="w170chip flag">' + plural(S.errors, 'could not be sorted', 'could not be sorted') + ' <button type="button" class="w170lnk" data-w170retry style="font-size:11px">Try again</button></span>' : '') + '</div>'
      + '<p style="font-size:12.5px;color:' + MUTED + ';margin:0 0 4px">The last three weeks. A label the assistant added can come off here; nothing else about the email changes.' + (o.last_result ? ' Last run: ' + E(o.last_result) + '.' : '') + '</p>';
    if (!rows.length) return h + '<div class="w170empty"><b>Nothing sorted yet</b>' + (o.auto_sort ? 'New mail is sorted every 15 minutes.' : 'Press Check now, or turn on sorting every 15 minutes in Settings.') + '</div>';
    order.forEach(function (k) {
      h += '<div class="w170day">' + E(k === todayIso() ? 'Today' : new Date(k + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })) + '</div>';
      byDay[k].forEach(function (x) {
        h += '<div class="w170row"><div class="who"><b>' + E(x.from_name || x.from_email) + '</b><span>' + E(x.subject || '(no subject)') + '</span></div>'
          + (x.label_name ? '<span class="w170chip" title="' + E(x.label_name) + '">' + E(x.label_name) + (x.archived ? ', out of the inbox' : '') + '</span><button type="button" class="w170lnk" data-w170unlabel="' + E(x.gmail_id) + '" style="font-size:12px">Take the label off</button>' : '<span class="w170chip" style="background:rgba(16,63,57,.04);color:' + MUTED + '">No folder</span>')
          + (x.team ? '<span class="w170chip team">' + E(TEAMS[x.team] || x.team) + '</span>' : '')
          + (Number(x.reply_p) >= REPLY_P ? '<span class="w170chip gold">' + (x.reply_state ? 'Reply: ' + (x.reply_state === 'drafted' ? 'draft saved' : x.reply_state === 'done' ? 'replied' : 'not needed') : 'Needs your reply') + '</span>' : '')
          + '</div>';
      });
    });
    return h;
  }
  function settingsHtml() {
    var o = S.owner || {}, st = S.set || (S.set = { notes: Object.assign({}, o.label_notes || {}), archive: (o.archive_labels || []).slice(), senders: (o.skip_senders || []).join('\n'), words: (o.skip_words || []).join('\n'), auto: !!o.auto_sort, days: o.days_back || 3 });
    var labels = o.labels || [];
    return '<div class="w170set">'
      + '<h4 style="margin-top:0">Sorting</h4>'
      + '<label class="w170sw"><input type="checkbox" id="w170auto"' + (st.auto ? ' checked' : '') + '> Sort new mail into my folders every 15 minutes</label>'
      + '<p>It only adds a folder (a Gmail label) when it is sure, and leaves everything else in your inbox. Personal mail is left alone, and nothing about it is kept.</p>'
      + '<label class="w170l" for="w170days">Look back<span class="op">for new mail in the inbox</span></label><select id="w170days" style="max-width:220px">' + [1, 2, 3, 5, 7].map(function (n) { return '<option value="' + n + '"' + (Number(st.days) === n ? ' selected' : '') + '>' + plural(n, 'day') + '</option>'; }).join('') + '</select>'
      + '<h4>Your folders</h4><p>Say in a few words what goes in each one, so the sorting gets it right. Tick a folder to also take its mail out of the inbox (off by default).</p>'
      + (labels.length ? labels.map(function (l) {
        return '<div class="w170lab"><b>' + E(l.name) + '</b><input type="text" data-w170lnote="' + E(l.id) + '" maxlength="200" placeholder="' + E(l.examples && l.examples.length ? 'Like: ' + l.examples[0] : 'What goes here') + '" value="' + E(st.notes[l.id] || '') + '" aria-label="' + E('What goes in ' + l.name) + '"><label><input type="checkbox" data-w170arch="' + E(l.id) + '"' + (st.archive.indexOf(l.id) >= 0 ? ' checked' : '') + '> out of the inbox</label></div>';
      }).join('') : '<p style="color:' + MUTED + '">Your folders have not been read yet.</p>')
      + '<div class="w170acts"><button type="button" class="w170btn ghost sm" data-w170relabels>Read my folders again</button>' + (o.labels_at ? '<span style="font-size:12px;color:' + MUTED + '">Read ' + E(ago(o.labels_at)) + '</span>' : '') + '</div>'
      + '<h4>Never read</h4><p>Mail from these senders, or with these words in the subject, is left alone before anything reads it: the assistant keeps only that it skipped it. Some sensitive subjects (health, support groups, family matters) are always left alone.</p>'
      + '<label class="w170l" for="w170snd">Senders or domains<span class="op">one per line</span></label><textarea id="w170snd" rows="3" placeholder="someone@example.com&#10;example.org">' + E(st.senders) + '</textarea>'
      + '<label class="w170l" for="w170wrd">Words in the subject<span class="op">one per line</span></label><textarea id="w170wrd" rows="2">' + E(st.words) + '</textarea>'
      + '<div class="w170acts" style="margin-top:16px"><button type="button" class="w170btn gold" data-w170saveset' + (S.busy.set ? ' disabled' : '') + '>' + (S.busy.set ? 'Saving…' : 'Save') + '</button></div>'
      + guideHtml()
      + '<h4>How it works</h4><p>The Hub reads your mailbox through Welfare Avenue’s Google Workspace, as you, and only for you: nobody else sees this page or your mail. Replies are drafts in your Gmail; you send them. An email reaches a team only when you send it.</p>'
      + '</div>';
  }
  /* wave201: Your writing guide (the owner's own; only they read it, through mybox's voice action) */
  function guideHtml() {
    var g = S.guide;
    if (!g) { loadGuide(); return '<h4>Your writing guide</h4><div class="w170wait"><i></i>Reading your writing guide…</div>'; }
    if (g.err) return '<h4>Your writing guide</h4><p class="w170err">' + E(g.err) + '</p>';
    var txt = g.draft != null ? g.draft : g.voice, words = String(txt || '').split(/\s+/).filter(Boolean).length;
    return '<h4>Your writing guide</h4>'
      + '<p>Every reply the assistant writes for you follows this guide, before the email and your answers. ' + (g.voice ? 'Yours: <b>' + E(g.framework) + '</b>.' : 'You have none yet, so replies use a plain house style: paste yours below.') + ' Figures come only from you, the email, or the Hub’s verified facts (Fundraising, Fact base).</p>'
      + '<details class="w170guide"' + (g.open || !g.voice ? ' open' : '') + '><summary>' + (g.voice ? 'Read or change the guide (' + plural(words, 'word') + ')' : 'Add your guide') + '</summary>'
      + '<textarea id="w170voice" rows="14" maxlength="20000" aria-label="Your writing guide" placeholder="How your replies should sound: your rules, the way you open and close, who you write to and how, words you never use. A first line FRAMEWORK: name says which framework it is.">' + E(txt || '') + '</textarea>'
      + '<div class="w170acts"><button type="button" class="w170btn gold" data-w170saveguide' + (g.busy ? ' disabled' : '') + '>' + (g.busy ? 'Saving…' : 'Save the guide') + '</button>' + (g.draft != null && g.draft !== g.voice ? '<span style="font-size:12px;color:' + MUTED + '">Not saved yet</span>' : '') + '</div></details>';
  }
  function loadGuide() {
    if (S.guideP) return; S.guideP = true;
    fn({ action: 'voice' }).then(function (r) { S.guide = { voice: r.voice || '', framework: r.framework || '', draft: null }; S.guideP = false; render(); },
      function (e) { S.guide = { err: 'Your writing guide could not be read: ' + e.message }; S.guideP = false; render(); });
  }
  function render() {
    var el = document.getElementById('w170sheet'); if (!el || !S.open) return;
    if (S.owner === false) { el.innerHTML = '<div class="w170bk" data-w170x></div><div class="w170sh">' + '<header class="w170hd"><div class="ti"><span class="k">Welfare Avenue</span><h2>Your inbox</h2></div><span class="sp"></span><button type="button" class="w170xb" data-w170x aria-label="Close">&times;</button></header><div class="w170empty"><b>Not on for your mailbox</b>The inbox assistant is on for a few people for now.</div></div>'; return; }
    var lst = el.querySelector('.w170list'), mn = el.querySelector('.w170main');
    var lt = lst ? lst.scrollTop : 0, mt = mn ? mn.scrollTop : 0, sameSel = el.getAttribute('data-sel') === String(S.sel) && el.getAttribute('data-tab') === S.tab;
    el.innerHTML = '<div class="w170bk" data-w170x></div><div class="w170sh">' + headHtml() + '<div class="w170bd">' + listHtml() + mainHtml() + '</div></div>';
    el.classList.toggle('sel', !!S.sel && (S.tab === 'reply' || S.tab === 'team'));
    el.setAttribute('data-sel', String(S.sel)); el.setAttribute('data-tab', S.tab);
    var l2 = el.querySelector('.w170list'), m2 = el.querySelector('.w170main');
    if (l2) l2.scrollTop = lt; if (m2 && sameSel) m2.scrollTop = mt;
  }
  /* the email itself, read from Gmail when it is opened */
  function ensureDetail() {
    var x = S.sel ? rowBy(S.sel) : null; if (!x || (S.tab !== 'reply' && S.tab !== 'team')) return;
    var d = S.D[x.gmail_id] || (S.D[x.gmail_id] = { stage: 'read', answers: {}, custom: {}, note: '' });
    if (d.main) { firstLine(x, d); return; }   /* opened before (in To reply, say): the line for the team is still written */
    if (d.stage === 'loading') return;
    d.stage = 'loading'; d.err = null; render();
    fn({ action: 'open', gmail_id: x.gmail_id }).then(function (r) {
      d.main = r.main; d.history = r.history || []; d.later = r.later || []; d.stage = 'read'; render();
      firstLine(x, d);
    }, function (e) { d.stage = 'read'; d.err = 'The email did not open: ' + e.message; render(); });
  }
  /* For a team: the assistant writes a first line for the team it thinks of, once */
  function firstLine(x, d) {
    if (S.tab === 'team' && S.sel === x.gmail_id && x.team && !x.team_state && !(d.team && (d.team.ask || d.team.loading || d.team.sent || d.team.asked))) suggestAsk(x, x.team);
  }
  function suggestAsk(x, team) {
    var d = S.D[x.gmail_id] || (S.D[x.gmail_id] = { stage: 'read', answers: {}, custom: {}, note: '' });
    d.team = d.team || {}; d.team.team = team; d.team.loading = true; d.team.asked = true; d.team.err = null; render();
    fn({ action: 'suggest_ask', gmail_id: x.gmail_id, team: team }).then(function (r) {
      d.team.loading = false; if (!d.team.ask) d.team.ask = r.ask || ''; if (!d.team.person && r.person) d.team.person = r.person; render();
    }, function (e) { d.team.loading = false; d.team.err = 'No line suggested: ' + e.message; render(); });
  }

