
  /* ---------- wave278 (04/11/26, Task 6): the access steps, the leader decision, Re-check, and the welcome copies ----------
     Steel (04/11/26): the Hub itself adds a new hire to their Google Groups, shared drives, weekly meeting and Slack onboarding channel (onboard-run's steps
     groups, drives, meeting, channel). The card shows those four rows through wave271's own step row (O.stepHtml: Retry, and Done for an HR task), numbered
     after wave271's eight; the channel step while pending reads "Waiting for them to join Slack" (the hourly job tries again, so nothing to retry). Above
     them the leader decision from the card row (wa278a's wa275_flow_row: leader true, false or null): "Joining as a member" / "Joining as a leader" with
     Change (set_leader with the other value), "Joining as: not decided yet" with both; while set_leader or recheck_access runs, the Groups and Drives rows
     say "Re-running", then the card reloads and the rows re-paint from onboard-run's answer. Re-check Drives and Groups (recheck_access) shows once either
     row exists. Under them, until the welcome is sent: "Welcome email: from <sender>, copied to <owner> and <n> others" (the sender as Task 4 picks it: who
     pressed Send on the offer, then the candidate's owner, then hub@) and Add people, a picker of active staff from the roster (never the hire, never
     someone who left; the owner always gets a copy), saved by set_welcome_cc. onboard-run checks who may (HR, admins, or the hire's own manager through
     wa275_manager_of) and refuses copies once the welcome is sent; the card only shows. HR's started cards read the flow from the table (wave271's
     columns), without the leader decision or the copies, so they show the rows and Re-check only. */
  var ACCESS = [['groups', 'Google Groups'], ['drives', 'Shared drives'], ['meeting', 'Weekly meeting'], ['channel', 'Slack onboarding channel']];
  var HUB_FROM = 'hub@welfareavenue.com';
  var st278 = document.createElement('style'); st278.id = 'o278css';
  st278.textContent =
    '.o278acc{min-width:0;margin:4px 0;}' +
    '.o278ln{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13.5px;color:' + GROUND + ';margin:8px 0 4px;min-width:0;overflow-wrap:anywhere;}' +
    '.o278ln > span{min-width:0;}' +
    '.o278ln .o271b{min-height:32px;}' +
    '.o278pk{border:1px solid ' + LINE + ';border-radius:10px;padding:8px 10px;margin:6px 0;background:' + CREAM + ';min-width:0;}' +
    '.o278pk label{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;padding:4px 0;color:' + GROUND + ';min-width:0;cursor:pointer;}' +
    '.o278pk label > div{min-width:0;overflow-wrap:anywhere;}' +
    '.o278pk label span{color:' + MUTE + ';font-size:12.5px;}' +
    '.o278pk input{margin-top:3px;flex:none;}';
  document.head.appendChild(st278);
  var CC = {};   /* the open copies pickers: flow id -> { sel: { email: true } } */

  function lower(e) { return String(e || '').trim().toLowerCase(); }
  function hasAccess(x) { return (x.steps || []).some(function (r) { return ACCESS.some(function (a) { return a[0] === r.step; }); }); }
  function rerunning(id) { return !!(S.busy['w278l' + id] || S.busy['w278c' + id]); }
  function accessRow(f, key, label, n) {
    var r = (f.steps || []).filter(function (s) { return s.step === key; })[0];
    if (!r) return '';
    var shown = r;
    /* wave271's row prints a status it has no word for as it is, and offers Retry only for failed or stuck running rows: so neither of these offers one */
    if (rerunning(f.id) && (key === 'groups' || key === 'drives')) shown = Object.assign({}, r, { status: 'Re-running', detail: null });
    else if (key === 'channel' && r.status === 'pending') shown = Object.assign({}, r, { status: 'waiting', detail: 'Waiting for them to join Slack' });
    return O.stepHtml(Object.assign({}, f, { steps: [shown] }), key, label, n);
  }
  function leaderHtml(x, id) {
    if (x.leader === undefined) return '';   /* a row without the decision (HR's started cards): nothing to say */
    var busy = S.busy['w278l' + id] ? ' disabled' : '';
    function b(on, label) { return '<button type="button" class="o271b" data-o278a="leader" data-on="' + on + '" data-f="' + E(id) + '"' + busy + '>' + E(label) + '</button>'; }
    var line = x.leader === true ? 'Joining as a leader' : x.leader === false ? 'Joining as a member' : 'Joining as: not decided yet';
    return '<div class="o278ln" data-o278lead><span>' + E(line) + '</span>' + (x.leader == null ? b(0, 'As a member') + b(1, 'As a leader') : b(x.leader ? 0 : 1, 'Change')) + '</div>';
  }
  /* the staff who may get a copy: active roster rows with an email, never the hire's own row, and not the owner (who always gets one) */
  function staffFor(x) {
    var owner = lower(x.owner_email), hire = lower(x.wa_email);
    return S.people.filter(function (p) {
      var e = lower(p.email);
      return p.active !== false && e && e.indexOf('@') > 0 && e !== owner && e !== hire && !(x.member_id != null && String(p.id) === String(x.member_id));
    });
  }
  function welcomeHtml(x, id) {
    if (x.welcome_sent_at || !Array.isArray(x.welcome_cc)) return '';   /* sent (its copy is under the welcome step), or a row without the copies */
    var owner = lower(x.owner_email), from = x.offer_sent_by || x.owner_email || HUB_FROM;
    var cc = x.welcome_cc.map(lower).filter(function (e) { return e && e !== owner; });
    var all = (owner ? [owner] : []).concat(cc);
    var to = !all.length ? ', with no copies' : ', copied to ' + personName(all[0]) + (all.length > 1 ? ' and ' + (all.length - 1) + (all.length === 2 ? ' other' : ' others') : '');
    var P = CC[id];
    return '<div class="o278ln" data-o278wel><span>' + E('Welcome email: from ' + personName(from) + to) + '</span>'
      + (P ? '' : '<button type="button" class="o271b" data-o278a="ccopen" data-f="' + E(id) + '">Add people</button>') + '</div>'
      + (P ? pickerHtml(x, id, P) : '');
  }
  function pickerHtml(x, id, P) {
    var list = staffFor(x), owner = lower(x.owner_email), busy = S.busy['w278w' + id];
    return '<div class="o278pk" data-o278pk>'
      + '<div class="o271ln">' + E('Tick the staff who get a copy of the welcome email. ' + (owner ? personName(owner) + ' always gets a copy. ' : '') + 'Their copy has no password in it.') + '</div>'
      + (list.length ? list.map(function (p) {
          var e = lower(p.email);
          return '<label><input type="checkbox" data-o278cc="' + E(e) + '" data-f="' + E(id) + '"' + (P.sel[e] ? ' checked' : '') + '><div>' + E(p.name) + ' <span>' + E(p.email) + '</span></div></label>';
        }).join('') : '<div class="o271ln">No one else on the roster.</div>')
      + '<div class="o271btns"><button type="button" class="o271b pri" data-o278a="ccsave" data-f="' + E(id) + '"' + (busy ? ' disabled' : '') + '>' + E(busy ? 'Working...' : 'Save the copies') + '</button>'
      + '<button type="button" class="o271b" data-o278a="ccshut" data-f="' + E(id) + '">Cancel</button></div></div>';
  }
  function accessHtml(x, id) {
    var f = { id: id, steps: x.steps || [], wa_email: x.wa_email, canva_link: x.canva_link };
    var rows = ACCESS.map(function (a, i) { return accessRow(f, a[0], a[1], O.STEPS.length + i + 1); }).join('');
    var again = (x.steps || []).some(function (r) { return r.step === 'groups' || r.step === 'drives'; });
    return '<div class="o278acc" data-o278acc="' + E(id) + '">' + leaderHtml(x, id)
      + (rows ? '<ol class="o271st o278st">' + rows + '</ol>' : '')
      + (again ? '<div class="o271btns"><button type="button" class="o271b" data-o278a="recheck" data-f="' + E(id) + '"' + (rerunning(id) ? ' disabled' : '') + '>Re-check Drives and Groups</button></div>' : '')
      + welcomeHtml(x, id) + '</div>';
  }
  /* a started card on the new path gets the same block, after its rundown ticks */
  var startedMore275 = R.startedMore;
  R.startedMore = function (f) { return startedMore275(f) + (hasAccess(f) || (f.propose_path && f.leader !== undefined) ? accessHtml(f, f.id) : ''); };

  /* ---------- the calls: each one reloads the card, so what shows is onboard-run's answer ---------- */
  async function setLeader(id, on) {
    var key = 'w278l' + id, x = rowOf(id); if (!x || S.busy[key]) return;
    S.busy[key] = true; delete S.note[id]; R.paint();
    try {
      await run('set_leader', { flow_id: Number(id), leader: on });
      delete S.busy[key];
      S.note[id] = { ok: on ? firstOf(x.name) + ' joins as a leader now. The Hub ran Groups and Drives again: the rows say what was added.'
        : firstOf(x.name) + ' joins as a member now. The Hub ran Groups and Drives again, and it never removes access: take them out of any leaders\' group or drive by hand.' };
      await R.load();
    } catch (e) { delete S.busy[key]; S.note[id] = { err: e.message }; R.paint(); }
  }
  async function recheck(id) {
    var key = 'w278c' + id; if (!rowOf(id) || S.busy[key]) return;
    S.busy[key] = true; delete S.note[id]; R.paint();
    try { await run('recheck_access', { flow_id: Number(id) }); delete S.busy[key]; S.note[id] = { ok: 'Drives and Groups were checked again: the rows say what changed.' }; await R.load(); }
    catch (e) { delete S.busy[key]; S.note[id] = { err: e.message }; R.paint(); }
  }
  async function openCc(id) {
    var x = rowOf(id); if (!x) return;
    var sel = {}, owner = lower(x.owner_email);
    (x.welcome_cc || []).forEach(function (e) { e = lower(e); if (e && e !== owner) sel[e] = true; });
    CC[id] = { sel: sel }; delete S.note[id];
    await O.readPeople();
    R.paint();
  }
  async function saveCc(id) {
    var P = CC[id], key = 'w278w' + id; if (!P || !rowOf(id) || S.busy[key]) return;
    var emails = Object.keys(P.sel).filter(function (k) { return P.sel[k]; });
    S.busy[key] = true; delete S.note[id]; R.paint();
    try {
      await run('set_welcome_cc', { flow_id: Number(id), emails: emails });
      delete CC[id]; delete S.busy[key];
      S.note[id] = { ok: emails.length ? 'Saved: ' + emails.length + (emails.length === 1 ? ' person gets' : ' people get') + ' a copy of the welcome email.' : 'Saved: no copies besides the owner\'s.' };
      await R.load();
    } catch (e) { delete S.busy[key]; S.note[id] = { err: e.message }; try { toast(e.message); } catch (x2) { /* no toast */ } R.paint(); }
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest('[data-o278a]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-o278a'), id = b.getAttribute('data-f');
    if (a === 'leader') setLeader(id, b.getAttribute('data-on') === '1');
    else if (a === 'recheck') recheck(id);
    else if (a === 'ccopen') openCc(id);
    else if (a === 'ccsave') saveCc(id);
    else if (a === 'ccshut') { delete CC[id]; R.paint(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute || !t.hasAttribute('data-o278cc')) return;
    var P = CC[t.getAttribute('data-f')]; if (P) P.sel[t.getAttribute('data-o278cc')] = !!t.checked;
  });
})();
