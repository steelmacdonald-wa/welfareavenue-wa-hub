
  /* ---------- a started card ---------- */
  function stepHtml(f, key, label, n) {
    var r = (f.steps || []).filter(function (x) { return x.step === key; })[0];
    if (!r) return '<li><div class="ttl">' + n + '. ' + E(label) + '</div></li>';
    var status = r.status, id = f.id;
    var stuck = (status === 'running' || status === 'pending') && Date.now() - Date.parse(r.at) >= STALE_MS;
    var tagClass = status === 'done' ? 'ok' : status === 'failed' ? 'no' : status === 'hr_task' ? 'hr' : '';
    var h = '<li><div class="ttl">' + n + '. ' + E(label) + ' <span class="o271tag ' + tagClass + '">' + E(WORD[status] || status) + '</span>' + (r.practice ? '<span class="o271tag pr">Practice</span>' : '') + '</div>';
    if (r.detail) h += '<div class="dt' + (status === 'failed' ? ' fail' : '') + '">' + (status === 'hr_task' ? 'To do: ' : '') + E(r.detail) + '</div>';
    if (key === 'welcome' && WELCOME_COPY.indexOf(status) >= 0) h += welcomeHtml(f) + (status === 'done' ? '' : canvaCardHtml(f));   /* wave275: a copy stays on the card once it is sent */
    if (status === 'hr_task' && key !== 'google') h += '<div class="row"><button type="button" class="o271b" data-o271a="taskdone" data-f="' + E(id) + '" data-step="' + E(key) + '"' + (S.busy['t' + id + key] ? ' disabled' : '') + '>Done</button></div>';
    if (status === 'failed' || stuck) h += '<div class="row"><button type="button" class="o271b" data-o271a="retry" data-f="' + E(id) + '" data-step="' + E(key) + '"' + (S.busy['r' + id + key] ? ' disabled' : '') + '>Retry</button></div>';
    if (key === 'google' && (status === 'hr_task' || status === 'failed') && R.hrTools()) {   /* "I created it, continue" is HR's (google_manual) */
      h += '<div class="row"><input type="text" autocomplete="off" aria-label="The address you created" placeholder="first.last@welfareavenue.com" data-o271i="gaddr" data-f="' + E(id) + '" value="' + E(gaddrOf(f)) + '">'
        + '<button type="button" class="o271b pri" data-o271a="gmanual" data-f="' + E(id) + '"' + (S.busy['g' + id] ? ' disabled' : '') + '>I created it, continue</button></div>';
    }
    return h + '</li>';
  }
  /* the fresh Canva link under the welcome to-do: Canva's links last 30 days, so HR pastes or replaces it before sending */
  function canvaCardHtml(f) {
    var id = f.id, typed = S.canva[id] != null ? S.canva[id] : (f.canva_link || '');
    return '<div data-o271canva="' + E(id) + '">' + canvaHowHtml()
      + (f.canva_link
        ? '<div class="row"><span class="o271ln"><b>Canva link:</b> ' + E(f.canva_link) + '</span><button type="button" class="o271b" data-o271a="copycanva" data-f="' + E(id) + '">Copy the link</button></div>'
        : '<div class="o271warn">No Canva link yet. Get a fresh one before you send the welcome email.</div>')
      + '<div class="row"><input type="text" autocomplete="off" aria-label="Fresh Canva invite link" placeholder="https://www.canva.com/..." data-o271i="ccanva" data-f="' + E(id) + '" value="' + E(typed) + '">'
      + '<button type="button" class="o271b" data-o271a="canvasave" data-f="' + E(id) + '"' + (S.busy['v' + id] ? ' disabled' : '') + '>Save the link</button></div></div>';
  }
  async function copyCanva(id) {
    var f = flowOf(id); if (!f || !f.canva_link) return;
    try { await navigator.clipboard.writeText(f.canva_link); toast('Copied'); }
    catch (e) { toast('The browser would not copy it. Select the link and copy it yourself.'); }
  }
  async function saveCanva(id) {
    var f = flowOf(id); if (!f || S.busy['v' + id]) return;
    var link = String(S.canva[id] != null ? S.canva[id] : (f.canva_link || '')).trim();
    S.busy['v' + id] = true; delete S.note[id]; paint();
    try { await run('set_canva_link', { flow_id: Number(id), link: link }); delete S.canva[id]; delete S.busy['v' + id]; S.note[id] = { ok: link ? 'The Canva link is saved.' : 'The Canva link is cleared.' }; await load(); }
    catch (e) { delete S.busy['v' + id]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }
  /* what HR edited in the preview, under the welcome to-do, to send by hand */
  /* the email as it reads now, from onboard-run (welcome): HR's wording kept, today's times, manager, address and links filled in. wave275: also once the
     Hub has sent it (a copy on the card) or when sending failed; [first password] stays as it is, since only the sent email has the password */
  var WELCOME_COPY = ['hr_task', 'failed', 'done'];
  function welcomeStatus(f) { var r = (f.steps || []).filter(function (x) { return x.step === 'welcome'; })[0]; return r ? r.status : ''; }
  function welcomeHtml(f) {
    var w = S.welcome[f.id];
    if (!w) return '<div class="dt"><div class="o271ln">Loading the email...</div></div>';
    if (w.err) return '<div class="dt"><div class="o271err">' + E(w.err) + '</div></div>';
    return '<div class="dt">'
      + (w.sent_at ? '<div class="o271ln" data-o271sent><b>Sent ' + E(whenText(w.sent_at)) + '.</b> This copy reads as the email does now.</div>' : '')
      + '<div class="o271ln"><b>Subject:</b> ' + E(w.subject || '') + (w.edited ? ' <small>(your edit)</small>' : '') + '</div><div class="o271pre">' + E(w.text || '') + '</div>'
      + (/\[first password\]|\[premier mot de passe\]/.test(w.text || '') ? '<div class="o271ln" data-o271pwnote>' + (welcomeStatus(f) === 'hr_task'
          ? 'You send this one yourself, and the Hub cannot fill in [first password] for you: ask an admin for the login details and put them in before you send it.'
          : '[first password] stays as it is here: the Hub puts the password in only as the email goes, so nobody reads it on the card.') + '</div>' : '')
      + '<div class="row"><button type="button" class="o271b" data-o271a="copywelcome" data-f="' + E(f.id) + '">Copy the text</button></div>'
      + '</div>';
  }
  async function readWelcomes(flows) {
    S.welcome = {};
    await Promise.all(flows.filter(function (f) { return (f.steps || []).some(function (r) { return r.step === 'welcome' && WELCOME_COPY.indexOf(r.status) >= 0; }); }).map(async function (f) {
      try { S.welcome[f.id] = await run('welcome', { flow_id: Number(f.id) }); } catch (e) { S.welcome[f.id] = { err: e.message }; }
    }));
  }
  async function copyWelcome(id) {
    var w = S.welcome[id]; if (!w || w.err) return;
    var text = [w.subject, w.text].filter(Boolean).join('\n\n');   /* the group session is already a line of the text */
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch (e) { toast('The browser would not copy it. Select the text and copy it yourself.'); }
  }
  /* ---------- wave275: the first password of new Google accounts, for admins (first_password_state and set_first_password refuse everyone else) ---------- */
  /* The page never holds it: the box is type password, its value is never written into the page's HTML (a repaint gives it back as a property only), and
     Set sends it once and empties the box. The line says only whether it is set, and when. */
  function isAdmin() { try { return WA40_MINE.role === 'admin'; } catch (e) { return false; } }
  async function readPw() {
    if (!isAdmin()) { S.pw = null; return; }
    try { S.pw = await run('first_password_state', {}); } catch (e) { S.pw = null; }
  }
  function dayLong(at) { try { return new Date(at).toLocaleDateString('en-CA', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return String(at); } }
  function pwHtml() {
    var P = S.pw; if (!P) return '';
    return '<div class="o271cd" data-o271pw>'
      + '<div class="o271ln" data-o271pwstate><b>First password:</b> ' + (P.set && P.set_at ? 'set on ' + E(dayLong(P.set_at)) : 'not set') + '</div>'
      + '<div class="o271ln">Every Google account the Hub makes starts with it, and Google asks the new person to change it the first time they sign in. Only the welcome email carries it. At least 8 characters, with a letter and a digit.</div>'
      + '<div class="o271btns"><input type="password" autocomplete="new-password" aria-label="' + (P.set ? 'A new first password' : 'The first password') + '" data-o271i="pw" data-f="pw">'
      + '<button type="button" class="o271b" data-o271a="pwset" data-f="pw"' + (S.busy.pw ? ' disabled' : '') + '>Set</button></div>'
      + noteHtml('pw') + '</div>';
  }
  async function setPw() {
    var box = document.querySelector('[data-o271i="pw"]'); if (!box || S.busy.pw) return;
    var typed = box.value;
    S.busy.pw = true; delete S.note.pw; paint();
    try {
      var r = await run('set_first_password', { password: typed });
      var now = document.querySelector('[data-o271i="pw"]'); if (now) now.value = '';
      S.pw = { set: true, set_at: r.set_at };
      S.note.pw = { ok: 'The first password is set.', warnings: r.warnings || [] };
    } catch (e) { S.note.pw = { err: e.message }; }
    typed = '';
    delete S.busy.pw; paint();
  }
  function gaddrOf(f) { if (S.gaddr && S.gaddr[f.id] != null) return S.gaddr[f.id]; return f.wa_email || ''; }
  function nameOf(id) { var p = S.people.filter(function (x) { return String(x.id) === String(id); })[0]; return p ? p.name : 'Not chosen'; }
  function panelHtml(f, A) {
    var id = f.id, g = A.g, h = '<div class="o271pn">', busy = S.busy['a' + id];
    if (A.kind === 'back') {
      h += '<div class="o271ln"><b>Did ' + E(f.name) + ' back out?</b> ' + (f.before
          ? 'This closes their flow and moves the card to Withdrawn. No invites have gone out yet.'
          : 'This cancels their invites, closes the onboarding and moves the card to Withdrawn. It removes nothing from Google, Slack or the Hub: you get a list of what to take out by hand.') + '</div>'
        + '<label class="o271f">Why (optional)</label><input type="text" data-o271i="reason" data-f="' + E(id) + '" value="' + E(A.reason || '') + '">'
        + '<div class="o271btns"><button type="button" class="o271b dngp" data-o271a="actgo" data-f="' + E(id) + '"' + (busy ? ' disabled' : '') + '>Yes, they backed out</button><button type="button" class="o271b" data-o271a="actno" data-f="' + E(id) + '">Cancel</button></div>';
    } else if (A.kind === 'manager') {
      h += '<label class="o271f">New manager</label><select data-o271i="member" data-f="' + E(id) + '">' + memberOptions(A.member) + '</select>'
        + '<div class="o271ln">The Hub moves the 1-on-1 invite to them and tells both managers.</div>'
        + '<div class="o271btns"><button type="button" class="o271b pri" data-o271a="actgo" data-f="' + E(id) + '"' + (busy || !A.member ? ' disabled' : '') + '>Change manager</button><button type="button" class="o271b" data-o271a="actno" data-f="' + E(id) + '">Cancel</button></div>';
    } else {
      var isBook = A.kind === 'book', mode = isBook ? 'one' : (A.which === 'one_on_one' ? 'one' : 'call');
      if (!isBook) {
        h += '<label class="o271f">Which meeting</label><select data-o271i="which" data-f="' + E(id) + '"><option value="call"' + (mode === 'call' ? ' selected' : '') + '>Onboarding call</option>' + (f.one_on_one_at ? '<option value="one_on_one"' + (mode === 'one' ? ' selected' : '') + '>1-on-1</option>' : '') + '</select>';
      }
      if (g) h += '<div style="margin-top:8px">' + gridHtml(g) + '</div>';
      h += '<label class="o271f">' + (isBook ? '1-on-1' : 'New time') + ' (Toronto time)</label><input type="datetime-local" data-o271i="at" data-f="' + E(id) + '" value="' + E(A.at || '') + '">'
        + '<div class="o271ln">' + (isBook ? 'The invite goes out as soon as you book it.' : (mode === 'call' ? 'Google tells the guests, the manager is told, and the plan\'s dates move with it.' : 'Google tells the guests and the manager is told.')) + '</div>'
        + '<div class="o271btns"><button type="button" class="o271b pri" data-o271a="actgo" data-f="' + E(id) + '"' + (busy || !A.at ? ' disabled' : '') + '>' + (isBook ? 'Book the 1-on-1' : 'Change time') + '</button><button type="button" class="o271b" data-o271a="actno" data-f="' + E(id) + '">Cancel</button></div>';
    }
    return h + '</div>';
  }
  function startedCard(f) {
    var id = f.id, A = S.act[id], acting = A && A.kind;
    return '<div class="o271cd" data-o271flow="' + E(id) + '">'
      + '<div class="o271top"><b>' + E(f.name) + '</b><span>' + E(f.role || '') + '</span>' + (f.practice ? '<i class="o271tag pr" style="font-style:normal">Practice</i>' : '') + '<i class="o271tag" style="font-style:normal">' + (f.status === 'started' ? 'Started' : 'Under way') + '</i></div>'
      + '<div class="o271ln">Onboarding call: ' + E(f.call_at ? whenText(f.call_at) : 'not set') + '</div>'
      + '<div class="o271ln">1-on-1: ' + E(f.one_on_one_at ? whenText(f.one_on_one_at) : 'not booked yet') + '</div>'
      + '<div class="o271ln">Manager: ' + E(nameOf(f.manager_member_id)) + (f.wa_email ? ' &middot; Address: ' + E(f.wa_email) : '') + '</div>'
      + R.startedMore(f)   /* wave275: the setup rundown ticks */
      + noteHtml(id)
      + '<ol class="o271st">' + STEPS.map(function (s, i) { return stepHtml(f, s[0], s[1], i + 1); }).join('') + '</ol>'
      + '<div class="o271btns">'
      + '<button type="button" class="o271b" data-o271a="act" data-kind="time" data-f="' + E(id) + '"' + (acting === 'time' ? ' disabled' : '') + '>Change time</button>'
      + '<button type="button" class="o271b" data-o271a="act" data-kind="manager" data-f="' + E(id) + '"' + (acting === 'manager' ? ' disabled' : '') + '>Change manager</button>'
      + (f.one_on_one_at ? '' : '<button type="button" class="o271b" data-o271a="act" data-kind="book" data-f="' + E(id) + '"' + (acting === 'book' ? ' disabled' : '') + '>Book the 1-on-1</button>')
      + '<button type="button" class="o271b dng" data-o271a="act" data-kind="back" data-f="' + E(id) + '"' + (acting === 'back' ? ' disabled' : '') + '>They backed out</button>'
      + '</div>'
      + (A ? R.panelHtml(f, A) : '')
      + '</div>';
  }
  R.startedCard = startedCard; R.panelHtml = panelHtml;
  R.preview = function (id) { return run('preview', { flow_id: Number(id) }); };   /* the picker's marks and meetings; wave275 reads them another way for a manager */
  function flowOf(id) {
    var f = S.started.filter(function (x) { return String(x.id) === String(id); })[0]; if (f) return f;
    var x = S.ready.filter(function (r) { return String(r.flow_id) === String(id); })[0];
    return x ? { id: x.flow_id, name: x.name, before: true } : null;
  }

  /* ---------- the changes ---------- */
  async function openAct(id, kind) {
    var f = flowOf(id); if (!f) return;
    delete S.note[id];
    var A = S.act[id] = { kind: kind, at: '', member: '', which: 'call', reason: '', g: null };
    paint();
    if (kind !== 'book' && kind !== 'time') return;
    /* the marks and meetings for the picker. Typing a time works without them */
    try {
      var pv = await R.preview(Number(id));
      if (S.act[id] !== A) return;
      A.g = newGrid('a' + id, pv, kind === 'book' ? 'one' : 'call');
      paint();
    } catch (e) { if (S.act[id] === A) { S.note[id] = { err: e.message }; paint(); } }
  }
  async function actGo(id) {
    var A = S.act[id], f = flowOf(id); if (!A || !f || S.busy['a' + id]) return;
    var at = null;
    if (A.kind === 'book' || A.kind === 'time') {
      at = isoOf(A.at);
      if (!at) { S.note[id] = { err: 'That time does not exist on the Toronto clock. Pick another.' }; paint(); return; }
    }
    S.busy['a' + id] = true; paint();
    try {
      var note = { ok: 'Done.' };
      if (A.kind === 'book') {
        var bk = await run('book_one_on_one', { flow_id: Number(id), at: at });
        note.ok = bk.practice ? 'Practice: the 1-on-1 time is saved, and no invite was sent.' : bk.mode === 'test' ? 'The 1-on-1 is booked. Email is in test mode, so the invite went only to the test inboxes.' : 'The 1-on-1 is booked and the invite has gone out.';
      }
      else if (A.kind === 'time') { var r = await run('change_time', { flow_id: Number(id), which: A.which, at: at }); note = { ok: 'The time has changed.', warnings: r.warnings || [] }; }
      else if (A.kind === 'manager') { var m = await run('change_manager', { flow_id: Number(id), member_id: Number(A.member) }); note = { ok: 'The manager has changed.', warnings: m.warnings || [] }; }
      else {
        var b = await run('backed_out', { flow_id: Number(id), reason: A.reason || '' });
        delete S.note[id];
        note = (b.warnings || []).length ? { warnings: b.warnings } : null;   /* the list itself is worked out from the flow, on its card */
      }
      delete S.act[id];
      if (note) S.note[id] = note;
      delete S.busy['a' + id];
      await load();
    } catch (e) { delete S.busy['a' + id]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }
  async function retry(id, step) {
    var key = 'r' + id + step; if (S.busy[key]) return;
    S.busy[key] = true; delete S.note[id]; paint();
    try { await run('retry', { flow_id: Number(id), step: step }); delete S.busy[key]; await load(); }
    catch (e) { delete S.busy[key]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }
  async function googleManual(id) {
    var f = flowOf(id); if (!f || S.busy['g' + id]) return;
    S.busy['g' + id] = true; delete S.note[id]; paint();
    try {
      await run('google_manual', { flow_id: Number(id), wa_email: String(gaddrOf(f)).trim().toLowerCase() });
      delete S.busy['g' + id]; if (S.gaddr) delete S.gaddr[id];
      await load();
    } catch (e) { delete S.busy['g' + id]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }
  async function sendLink(id, candidate) {
    if (S.busy['l' + id]) return;
    S.busy['l' + id] = true; delete S.note[id]; paint();
    try { var r = await run('send_grid_link', { candidate_id: Number(candidate) }); var said = linkWord(r); S.note[id] = { ok: said }; toast(said); }
    catch (e) { S.note[id] = { err: e.message }; toast(e.message); }
    delete S.busy['l' + id]; paint();
  }
  function linkWord(r) { return r && r.practice ? 'Practice: no email was sent.' : r && r.mode === 'test' ? 'Email is in test mode, so the availability link went only to the test inboxes.' : 'The availability link has gone out.'; }
  async function saidYes(candidate) {
    if (S.busy['y' + candidate]) return;
    S.busy['y' + candidate] = true; paint();
    try { var r = await run('send_grid_link', { candidate_id: Number(candidate), accepted: true }); toast(linkWord(r)); delete S.note['c' + candidate]; }
    catch (e) { S.note['c' + candidate] = { err: e.message }; toast(e.message); }   /* the mail can fail after the acceptance is saved: the person then shows above, with Send the availability link */
    delete S.busy['y' + candidate]; delete S.yes[candidate];
    await load();
  }
  async function taskDone(id, step) {
    var key = 't' + id + step; if (S.busy[key]) return;
    S.busy[key] = true; delete S.note[id]; paint();
    try { await run('task_done', { flow_id: Number(id), step: step }); delete S.busy[key]; await load(); }
    catch (e) { delete S.busy[key]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }

  /* ---------- the section ---------- */
  /* what a flow that backed out leaves for HR, worked out from the flow and its steps, so a reload keeps it. The same list and words as backed_out in onboard-run. */
  function removeList(f) {
    if (f.practice) return [];
    var st = {}; (f.steps || []).forEach(function (r) { st[r.step] = r.status; });
    var out = [];
    if (st.google === 'done' && f.wa_email) out.push('Google account ' + f.wa_email + ': suspend or delete it in Google Admin.');
    if (st.roster === 'done' && f.member_id) out.push('Roster profile' + (f.wa_email ? ' (' + f.wa_email + ')' : '') + (f.roster_created ? ': Created for this person. Deactivate it by hand in Roster.' : ': Already on the roster before. Check whether it should stay.'));
    if (f.slack_channel_id) out.push('Slack onboarding channel ' + f.slack_channel_id + ': archive it.');
    if (st.hub === 'done') out.push('Hub access' + (f.wa_email ? ' for ' + f.wa_email : '') + ': remove it from Roster.');
    return out;
  }
  function backedHtml(f) {
    var remove = removeList(f);
    return '<div class="o271out" data-o271backed="' + E(f.id) + '"><div class="o271ln"><b>' + E(f.name) + ' backed out.</b>' + (f.practice ? ' <i class="o271tag pr" style="font-style:normal">Practice</i>' : '') + (remove.length ? ' Take these out by hand:' : '') + '</div>'
      + (remove.length ? '<ul>' + remove.map(function (r) { return '<li>' + E(r) + '</li>'; }).join('') + '</ul>' : '<div class="o271ln">Nothing was made for them, so there is nothing to take out.</div>')
      + noteHtml(f.id)
      + '</div>';
  }
  function paint() { return R.paint(); }
  function paintHr() {
    var el = document.getElementById('o271'); if (!el) return;
    var panel = document.getElementById('hrcentre');
    if (S.denied) {
      el.innerHTML = ''; el.setAttribute('data-w197s', 'none'); el.classList.remove('w197on');
      return;
    }
    var active = document.activeElement, keep = active && el.contains(active) && active.getAttribute && active.getAttribute('data-o271i');
    var keepFlow = keep ? active.getAttribute('data-f') : '', sel = keep && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null;
    var html = '<h2>Ready to onboard</h2><p class="o271sub">Everyone who has accepted an offer. Pick the times, check the preview, then press Start onboarding.</p>' + pwHtml();
    if (S.err) html += '<div class="o271err">' + E(S.err) + '</div>';
    if (!S.loaded) html += '<p class="o271sub">Loading...</p>';
    else if (!S.ready.length && !S.started.length && !S.offers.length && !S.backed.length) html += '<p class="o271sub">Nobody is waiting to be onboarded.</p>';
    html += S.ready.map(function (x) { return R.readyCard(x); }).join('');
    if (S.offers.length) html += '<h3 class="o271h">Offers waiting for an answer</h3>' + S.offers.map(offerCard).join('');
    if (S.started.length) html += '<h3 class="o271h">Onboarding started</h3>' + S.started.map(function (f) { return R.startedCard(f); }).join('');
    if (S.backed.length) html += '<h3 class="o271h">Backed out</h3>' + S.backed.map(backedHtml).join('');
    /* each grid keeps its scroll through a repaint */
    var scrolls = {}; Array.prototype.forEach.call(el.querySelectorAll('[data-o271grid]'), function (b) { scrolls[b.getAttribute('data-o271grid')] = b.scrollLeft; });
    var pwBox = el.querySelector('[data-o271i="pw"]'), pwTyped = pwBox ? pwBox.value : '';   /* a first password being typed survives the repaint, as a property, never in the HTML */
    el.innerHTML = html;
    if (pwTyped) { var pwAgain = el.querySelector('[data-o271i="pw"]'); if (pwAgain) pwAgain.value = pwTyped; }
    pwTyped = '';
    Array.prototype.forEach.call(el.querySelectorAll('[data-o271grid]'), function (b) { var v = scrolls[b.getAttribute('data-o271grid')]; if (v) b.scrollLeft = v; });
    if (keep) {
      var again = el.querySelector('[data-o271i="' + keep + '"][data-f="' + keepFlow + '"]');
      if (again) { try { again.focus(); if (sel) again.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text box */ } }
    }
    if (panel && panel.getAttribute('data-w197') === 'onboarding') el.classList.add('w197on');
  }
  R.paint = paintHr;
  function onbSection() { var a = document.querySelector('#w46body > .w46sec [data-w46assign]'); return a ? a.closest('.w46sec') : null; }
  function onPage() { var p = document.getElementById('hrcentre'); return (p && p.getAttribute('data-w197') === 'onboarding') || /^#hrcentre\/onboarding(\?|$)/.test(String(location.hash || '')); }
  function install() {
    var body = document.getElementById('w46body'); if (!body || !hrPage()) return;
    var sec = onbSection(); if (!sec) return;   /* still loading, or a page redraw is on its way */
    var el = document.getElementById('o271');
    if (el && el.parentNode === body && el.nextElementSibling === sec) return;
    if (!el) {
      el = document.createElement('div'); el.id = 'o271'; el.className = 'o271 w197card w197blk'; el.setAttribute('data-w197s', S.denied ? 'none' : 'onboarding');
    }
    body.insertBefore(el, sec);
    paint();
    if (onPage() && !S.loaded) load();
  }
  function arrive() { install(); if (document.getElementById('o271') && onPage()) load(); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var cell = t.closest('[data-o271cell]');
    if (cell) {
      var g = gridOf(cell.getAttribute('data-g')); if (!g) return;
      var key = cell.getAttribute('data-g'), id = key.slice(1), local = toLocal(cell.getAttribute('data-o271cell'));
      if (key.charAt(0) === 'a') {
        var A = S.act[id]; if (A) { A.at = local; g.vals[g.mode] = local; refreshGrid(g); var box = document.querySelector('[data-o271flow="' + id + '"] [data-o271i="at"]'); if (box) box.value = local; var go = document.querySelector('[data-o271flow="' + id + '"] [data-o271a="actgo"]'); if (go) go.disabled = false; }
      } else {
        g.vals[g.mode] = local; refreshGrid(g);
        var inp = document.querySelector('[data-o271flow="' + id + '"] [data-o271i="' + g.mode + '"]'); if (inp) inp.value = local;
        liveUpdate(id);
      }
      return;
    }
    var b = t.closest('[data-o271a]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-o271a'), f = b.getAttribute('data-f');
    if (a === 'link') { sendLink(f, b.getAttribute('data-cand')); return; }
    if (a === 'open') { var x = S.ready.filter(function (r) { return String(r.flow_id) === String(f); })[0]; if (x) openPick(x); return; }
    if (a === 'mode') { var P = S.pick[f]; if (P) { P.g.mode = b.getAttribute('data-mode'); paint(); } return; }
    if (a === 'start') { start(f); return; }
    if (a === 'retry') { retry(f, b.getAttribute('data-step')); return; }
    if (a === 'gmanual') { googleManual(f); return; }
    if (a === 'act') { openAct(f, b.getAttribute('data-kind')); return; }
    if (a === 'actgo') { actGo(f); return; }
    if (a === 'actno') { delete S.act[f]; paint(); return; }
    if (a === 'taskdone') { taskDone(f, b.getAttribute('data-step')); return; }
    if (a === 'copywelcome') { copyWelcome(f); return; }
    if (a === 'copycanva') { copyCanva(f); return; }
    if (a === 'canvasave') { saveCanva(f); return; }
    if (a === 'pwset') { setPw(); return; }
    var cand = b.getAttribute('data-cand');
    if (a === 'yesask') { S.yes[cand] = true; delete S.note['c' + cand]; paint(); return; }
    if (a === 'yesno') { delete S.yes[cand]; paint(); return; }
    if (a === 'yesgo') { saidYes(cand); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var k = t.getAttribute('data-o271i'), id = t.getAttribute('data-f'); if (!k || !id) return;
    var P = S.pick[id], A = S.act[id];
    if (k === 'gaddr') { S.gaddr = S.gaddr || {}; S.gaddr[id] = t.value; return; }
    if (k === 'ccanva') { S.canva[id] = t.value; return; }
    if (A && k === 'reason') { A.reason = t.value; return; }
    if (A && k === 'at') {
      A.at = t.value;
      if (A.g) { A.g.vals[A.g.mode] = t.value; refreshGrid(A.g); }
      var go = document.querySelector('[data-o271flow="' + id + '"] [data-o271a="actgo"]'); if (go) go.disabled = !A.at;
      return;
    }
    if (!P) return;
    if (k === 'call' || k === 'one') { P.g.vals[k] = t.value; refreshGrid(P.g); liveUpdate(id); return; }
    if (k === 'addr') { P.addr = t.value; liveUpdate(id); return; }
    if (k === 'group') { P.group = t.value; return; }
    if (k === 'canva') { P.canva = t.value; liveUpdate(id); return; }
    if (k === 'subj') { P.subject = t.value; return; }
    if (k === 'text') { P.text = t.value; return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var skip = t.getAttribute('data-o271skip'), k = t.getAttribute('data-o271i'), id = t.getAttribute('data-f');
    if (skip && S.pick[id]) { S.pick[id].skip[skip] = !t.checked; if (skip === 'google' && !t.checked) clearClash(id); liveUpdate(id); return; }
    if (!k || !id) return;
    var P = S.pick[id], A = S.act[id];
    if (k === 'addr' && P) { P.addr = t.value; recheckAddress(id); return; }
    if (k === 'mgr' && P) {
      var was = P.managerId;
      P.managerId = t.value;
      var changed = String(P.managerId) !== String(P.pv.manager && P.pv.manager.member_id);
      if (changed !== P.g.hideManager) { P.g.hideManager = changed; paint(); } else liveUpdate(id);
      if (t.value && t.value !== String(was)) saveManager(id, t.value, was);
      return;
    }
    if (k === 'member' && A) { A.member = t.value; paint(); return; }
    if (k === 'which' && A) {
      A.which = t.value; A.at = '';
      if (A.g) { A.g.mode = t.value === 'one_on_one' ? 'one' : 'call'; A.g.vals = { call: '', one: '' }; }
      paint();
    }
  });

  /* ---------- wiring: the section stays above the Onboarding section whenever wave46 redraws ---------- */
  function arm(tries) {
    var panel = document.getElementById('hrcentre');
    if (!panel) { if ((tries || 0) < 40) setTimeout(function () { arm((tries || 0) + 1); }, 800); return; }
    if (panel.dataset.o271mo) return;
    panel.dataset.o271mo = '1';
    new MutationObserver(function () { try { install(); } catch (e) { /* the next redraw */ } }).observe(panel, { childList: true, subtree: true });
    /* wave197 can change page without a hashchange (replaceState): its page attribute says when Onboarding opens */
    new MutationObserver(function (list) { if (list.some(function (m) { return m.oldValue !== 'onboarding'; }) && panel.getAttribute('data-w197') === 'onboarding') { try { arrive(); } catch (e) { /* the next redraw */ } } }).observe(panel, { attributes: true, attributeFilter: ['data-w197'], attributeOldValue: true });
    arrive();
  }
  if (typeof startApp === 'function') {
    var __sa271 = startApp;
    startApp = async function () { var out = await __sa271.apply(this, arguments); try { arm(0); } catch (e) { /* non-fatal */ } return out; };
  }
  window.addEventListener('hashchange', function () { if (onPage()) setTimeout(arrive, 120); });

  /* ---------- test hook ---------- */
  window.o271 = { load: load, toInstant: toInstant, toLocal: toLocal, wall: wall, state: function () { return S; },
    /* wave275 Task 6: what wave275's card reuses (the same words, grid, steps and calls as this wave's) */
    E: E, run: run, whenText: whenText, dayText: dayText, dayLong: dayLong, isoOf: isoOf, pad2: pad2, newGrid: newGrid, gridHtml: gridHtml, refreshGrid: refreshGrid,
    noteHtml: noteHtml, warnBox: warnBox, nameOf: nameOf, flowOf: flowOf, stepHtml: stepHtml, memberOptions: memberOptions, STEPS: STEPS, STALE_MS: STALE_MS, KEEP_DAYS: KEEP_DAYS,
    isAdmin: isAdmin, surelyHr: surelyHr, hrPage: hrPage, readPeople: readPeople, readCfg: readCfg, readPw: readPw, readWelcomes: readWelcomes, pwHtml: pwHtml, paint: paint };
})();
