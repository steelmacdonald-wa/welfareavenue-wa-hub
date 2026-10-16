/* =====================================================================
   WA v213 The due-date check (06/10/26)
   WA v237 Tasks set right: the owner questions in the due-date check, Mine / Not mine and Who owns this? (Steel, 14/10/26)
   =====================================================================
   Steel (06/10/26), after wave210 showed 52 of 62 recent meeting tasks had no due date: "I'd rather a pop up when the
   user gets on to the hub that they should [set] their due dates for the tasks or confirm the due dates provided make
   sense" (new and existing open tasks); then "it should pop with the best assumptions of due dates and allow the user
   to make edits if needed but they [should not] be able to exit until they confirm their due dates. Also overdue tasks
   should also pop to ask if items are done and if they aren't to push the due date to a realistic date".

   - On opening the Hub, a pop-up (#w213pop) lists the person's open tasks that are overdue, have no due date, or
     carry a date a meeting set that nobody confirmed (my_due_date_check(): owner by first name, or assigned).
   - Each comes filled with the best guess: their team's next meeting from the Hub calendar, or the one after when
     the next is less than two days away (a date the meeting set stays as it is). Next meeting / Following meeting
     buttons and a date field change it. An overdue task asks Done or Still open (push to a date).
   - It cannot be closed (no x, no Escape, no click outside) until Save; if saving fails it says so and, only then,
     offers "Try again later" so a fault never locks anyone out. confirm_due_dates() writes each change with a
     change_log line; the pop-up comes back next visit only for what is still overdue or undated.
   wave213c (07/10/26): each task can also be Done, sent To the bank (until a day; bank_task) or Discarded (deleted, the
   row kept in change_log); saved through confirm_due_check (confirm_due_dates stays for pages still open).
   Never on top of another window: it waits for the meeting pop-up (#w177pop) or a modal to close.
   wave237 (14/10/26): the owner questions. Steel: "if confirmations are needed, put it in the pop-up that people get when they
   open the hub [...] have them just confirm, okay, this is my task. No, this is someone else's task [...] hopefully we can avoid
   that without it prompting people to clarify tasks as much." A task whose owner a meeting left unsure (dept_tasks.owner_unsure)
   opens with "Is this yours?": Mine (then the usual date choices) or Not mine (it goes to the team's lead to re-home). A team's
   lead also sees the team's tasks nobody on the roster owns and names the owner. The list comes from wa237_due_check().
   wave238 (14/10/26): it also waits for the Loop's Welcome back gate (#w238loop).
   wave258 (15/10/26, the Fundraising meeting: a new member got stuck on "this tab that only shows the tasks" and did not know how
   to leave): one plain line at the top says what to do to carry on, and "x of n answered" shows how far along you are. Still no
   way to skip it. */
(function () {
  'use strict';
  if (window.__wa213) return; window.__wa213 = true;
  var S = { rows: null, pick: {}, act: {}, bank: {}, mine: {}, who: {}, busy: false, err: '', failed: 0, shown: false, gone: false };
  var GREEN = '#103F39', GOLD = '#DCA527', CREAM = '#FFFAF2', FLAG = '#B3402F';

  var css = ''
    + '#w213pop{position:fixed;inset:0;z-index:100000;background:rgba(16,24,22,.55);display:flex;align-items:center;justify-content:center;padding:16px;}'
    + '#w213pop .dlg{background:' + CREAM + ';border-radius:14px;max-width:760px;width:100%;max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden;}'
    + '#w213pop .hd{padding:18px 22px 10px;border-bottom:1px solid var(--wa-line,#e4e0d4);}'
    + '#w213pop h2{margin:0 0 6px;font-family:"Barlow Condensed","Arial Narrow",sans-serif;font-size:26px;letter-spacing:.2px;color:' + GREEN + ';}'
    + '#w213pop .lead{margin:0;font-size:13.5px;color:#444;line-height:1.45;}'
    + '#w213pop .bd{overflow-y:auto;padding:4px 22px 10px;}'
    + '#w213pop h3{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#6b6a65;margin:16px 0 6px;font-weight:700;}'
    + '#w213pop .row{border:1px solid var(--wa-line,#e4e0d4);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#FFFAF2;}'
    + '#w213pop .row.isdone .t{opacity:.6;}'
    + '#w213pop .row.a-discard .t{text-decoration:line-through;}'
    + '#w213pop .hint{font-size:12px;color:#6b6a65;}'
    + '#w213pop .hint.warn{color:' + FLAG + ';}'
    + '#w213pop .bk{font-size:12.5px;display:inline-flex;gap:6px;align-items:center;}'
    + '#w213pop .t{font-weight:600;font-size:13.5px;color:#1F201E;}'
    + '#w213pop .m{font-size:12px;color:#6b6a65;margin-top:2px;}'
    + '#w213pop .ctl{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin-top:8px;}'
    + '#w213pop .ctl input[type=date]{font:inherit;font-size:13px;border:1px solid var(--wa-line,#d8d4c8);border-radius:7px;padding:4px 6px;background:#FFFAF2;}'
    + '#w213pop .chip{border:1px solid var(--wa-line,#d8d4c8);background:#FFFAF2;border-radius:14px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer;color:#333;}'
    + '#w213pop .chip.on{background:' + GREEN + ';border-color:' + GREEN + ';color:#FFFAF2;}'
    + '#w213pop .seg{display:inline-flex;border:1px solid var(--wa-line,#d8d4c8);border-radius:8px;overflow:hidden;}'
    + '#w213pop .seg button{border:0;background:#FFFAF2;font:inherit;font-size:12.5px;padding:4px 10px;cursor:pointer;}'
    + '#w213pop .seg button.on{background:' + GREEN + ';color:#FFFAF2;}'
    + '#w213pop .ft{padding:12px 22px;border-top:1px solid var(--wa-line,#e4e0d4);display:flex;gap:10px;align-items:center;flex-wrap:wrap;}'
    + '#w213pop .save{background:' + GOLD + ';color:#1F201E;border:0;border-radius:9px;padding:9px 18px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;}'
    + '#w213pop .save[disabled]{opacity:.6;cursor:default;}'
    + '#w213pop .later{background:none;border:0;color:#555;text-decoration:underline;font:inherit;font-size:12.5px;cursor:pointer;}'
    + '#w213pop .err{color:' + FLAG + ';font-size:12.5px;flex-basis:100%;}'
    + '#w213pop .note{font-size:12px;color:#6b6a65;margin-left:auto;}'
    + '#w213pop .ask{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:8px;font-size:12.5px;color:#444;}'
    + '#w213pop .ask .q{font-weight:700;color:' + GREEN + ';}'
    + '#w213pop .how{margin:0 0 8px;background:' + GREEN + ';color:' + CREAM + ';border-radius:9px;padding:9px 12px;font-size:13.5px;font-weight:600;line-height:1.4;}'
    + '#w213pop .prog{display:flex;align-items:center;gap:10px;margin:10px 0 0;font-size:12.5px;color:#444;}'
    + '#w213pop .prog b{color:' + GREEN + ';white-space:nowrap;}'
    + '#w213pop .prog .bar{flex:1;height:6px;border-radius:3px;background:rgba(16,63,57,.12);overflow:hidden;}'
    + '#w213pop .prog .bar i{display:block;height:100%;background:' + GOLD + ';}'
    + '#w213pop .prog.all b{color:' + GREEN + ';}'
    + '#w213pop select{font:inherit;font-size:13px;border:1px solid var(--wa-line,#d8d4c8);border-radius:7px;padding:4px 6px;background:#FFFAF2;max-width:100%;}'
    + '@media (max-width:640px){#w213pop{padding:0;align-items:stretch;}#w213pop .dlg{max-height:100vh;border-radius:0;}#w213pop .note{margin-left:0;flex-basis:100%;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function day(s, wk) { if (!s) return ''; try { return new Date(s + 'T12:00:00').toLocaleDateString(undefined, wk ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' }); } catch (e) { return s; } }
  function team(k) { try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[k]) || k || ''; } catch (e) { return k || ''; } }
  /* wave213d (Steel, 07/10/26): a friendlier, clearer title than "Check your due dates" */
  function hello() { try { var n = (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.name) ? String(WA_ME.name).trim().split(/\s+/)[0] : ''; return n ? 'Hi ' + n + ', ' : 'Hi, '; } catch (e) { return 'Hi, '; } }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : false; } catch (e) { return false; } }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function busyElsewhere() {
    var p = document.getElementById('w177pop'); if (p && p.offsetParent !== null && getComputedStyle(p).display !== 'none') return true;
    var l = document.getElementById('w238loop'); if (l && l.getBoundingClientRect().width > 0) return true;   /* wave238: the Loop's gate first */
    var m = document.getElementById('modalBack'); if (m && m.style.display === 'flex') return true;
    return false;
  }

  async function load() {
    try {
      var r = await db.rpc('wa237_due_check');
      if (!r || r.error || !Array.isArray(r.data)) { r = await db.rpc('my_due_date_check'); if (r && r.error) return null; }   /* the old list, for a database still on wave213 */
      return (r && Array.isArray(r.data)) ? r.data : [];
    } catch (e) { return null; }
  }
  /* wave237: the people a lead can give a task to (the task's team first, active members only) */
  function teamPeople(dept) {
    var all = (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || [];
    var act = all.filter(function (m) { return m && m.name && m.active !== false; });
    var own = act.filter(function (m) { return m.department === dept; }), rest = act.filter(function (m) { return m.department !== dept; });
    return own.concat(rest);
  }
  function isUnsure(r) { return r.owner_unsure === true && !r.for_lead; }
  function isLead(r) { return r.for_lead === true; }
  function mineOf(id) { return S.mine[id] === undefined ? null : S.mine[id]; }

  /* wave213c (Steel, 07/10/26): "members should have the ability to discard a task, complete a task (it's done), or
     move the task to the task bank". Each task: Keep (with its date), Done, To the bank (until a day), Discard. */
  var ACTS = [['keep', 'Keep'], ['done', 'Done'], ['bank', 'To the bank'], ['discard', 'Discard']];
  function plusDays(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function actOf(id) { return S.act[id] || 'keep'; }

  function rowHtml(r) {
    var id = r.task_id, isOver = r.why === 'overdue', v = S.pick[id], a = actOf(id);
    var meta = [team(r.department)];
    if (isLead(r)) meta.push('owner: ' + (r.owner || 'nobody yet'));
    if (isOver) meta.push('was due ' + day(r.due_date));
    else if (r.why === 'meeting_set') meta.push('the meeting set ' + day(r.due_date));
    else if (r.why === 'owner_check' && r.due_date) meta.push('due ' + day(r.due_date));
    if (r.meeting_title) meta.push('from ' + r.meeting_title + (r.meeting_date ? ' (' + day(r.meeting_date) + ')' : ''));
    var h = '<div class="row a-' + a + (a === 'done' || a === 'discard' ? ' isdone' : '') + (isUnsure(r) ? ' unsure' : '') + '" data-w213row="' + id + '"><div class="t">' + E(r.title || 'Untitled') + '</div>'
      + '<div class="m">' + E(meta.filter(Boolean).join(' · ')) + '</div>';
    /* wave237: a lead names the owner of a task nobody owns */
    if (isLead(r)) {
      var who = S.who[id] || '';
      h += '<div class="ask"><span class="q">Who owns this?</span>'
        + '<span class="seg" role="group" aria-label="What to do with it"><button type="button" data-w213act="' + id + '" data-a="assign" class="' + (a === 'assign' ? 'on' : '') + '" aria-pressed="' + (a === 'assign') + '">Give it to</button>'
        + '<button type="button" data-w213act="' + id + '" data-a="done" class="' + (a === 'done' ? 'on' : '') + '" aria-pressed="' + (a === 'done') + '">Done</button>'
        + '<button type="button" data-w213act="' + id + '" data-a="discard" class="' + (a === 'discard' ? 'on' : '') + '" aria-pressed="' + (a === 'discard') + '">Discard</button></span>';
      if (a === 'assign') {
        h += '<select data-w213who="' + id + '" aria-label="Who owns ' + E(r.title || 'this task') + '"><option value="">Pick someone\u2026</option>' + teamPeople(r.department).map(function (m) { return '<option value="' + E(m.name) + '"' + (who === m.name ? ' selected' : '') + '>' + E(m.name) + (m.department && m.department !== r.department ? ' (' + E(team(m.department)) + ')' : '') + '</option>'; }).join('') + '</select>'
          + '<input type="date" aria-label="Due date for ' + E(r.title || 'this task') + '" data-w213date="' + id + '" value="' + E(v) + '">';
      } else if (a === 'discard') h += '<span class="hint warn">It will be deleted, like Delete on the task.</span>';
      else h += '<span class="hint">Marked done.</span>';
      return h + '</div></div>';
    }
    /* wave237: "Is this yours?" comes first; the date choices follow a Mine */
    if (isUnsure(r)) {
      var mine = mineOf(id);
      h += '<div class="ask"><span class="q">Is this yours?</span><span class="seg" role="group" aria-label="Is this your task">'
        + '<button type="button" data-w213mine="' + id + '" data-v="1" class="' + (mine === true ? 'on' : '') + '" aria-pressed="' + (mine === true) + '">Mine</button>'
        + '<button type="button" data-w213mine="' + id + '" data-v="0" class="' + (mine === false ? 'on' : '') + '" aria-pressed="' + (mine === false) + '">Not mine</button></span>'
        + (mine === false ? '<span class="hint">It goes to your team\u2019s lead to give to the right person.</span>' : '') + '</div>';
      if (mine !== true) return h + '</div>';
    }
    h += '<div class="ctl">'
      + '<span class="seg" role="group" aria-label="What to do with it">' + ACTS.map(function (x) {
          return '<button type="button" data-w213act="' + id + '" data-a="' + x[0] + '" class="' + (a === x[0] ? 'on' : '') + '" aria-pressed="' + (a === x[0]) + '">' + (x[0] === 'keep' && isOver ? 'Keep, push to' : x[1]) + '</button>';
        }).join('') + '</span>';
    if (a === 'keep') {
      h += '<input type="date" aria-label="Due date for ' + E(r.title || 'this task') + '" data-w213date="' + id + '" value="' + E(v) + '">'
        + '<button type="button" class="chip' + (v === r.next_meeting ? ' on' : '') + '" data-w213set="' + id + '" data-d="' + E(r.next_meeting) + '">Next meeting · ' + E(day(r.next_meeting, true)) + '</button>'
        + '<button type="button" class="chip' + (v === r.following_meeting ? ' on' : '') + '" data-w213set="' + id + '" data-d="' + E(r.following_meeting) + '">Following · ' + E(day(r.following_meeting, true)) + '</button>';
    } else if (a === 'bank') {
      h += '<label class="bk">Back on <input type="date" aria-label="Back from the bank on" data-w213bank="' + id + '" value="' + E(S.bank[id]) + '"></label><span class="hint">It leaves your boards and comes back by itself on that day.</span>';
    } else if (a === 'discard') {
      h += '<span class="hint warn">It will be deleted, like Delete on the task.</span>';
    } else {
      h += '<span class="hint">Marked done.</span>';
    }
    return h + '</div></div>';
  }

  function counts() {
    var c = { keep: 0, done: 0, bank: 0, discard: 0, assign: 0, notmine: 0, open: 0 };
    (S.rows || []).forEach(function (r) {
      var id = r.task_id;
      if (isLead(r)) { c[actOf(id) === 'keep' ? 'assign' : actOf(id)]++; return; }
      if (isUnsure(r)) { var m = mineOf(id); if (m === null) { c.open++; return; } if (m === false) { c.notmine++; return; } }
      c[actOf(id)]++;
    });
    return c;
  }
  /* wave258: is this task answered enough to save? (the same rules save() checks) */
  function answered(r) {
    var id = r.task_id, a = actOf(id), today = new Date(); today.setHours(0, 0, 0, 0);
    function future(d, strict) { if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; var t = new Date(d + 'T12:00:00'); return strict ? t > today : t >= today; }
    if (isLead(r)) return a === 'done' || a === 'discard' || !!S.who[id];
    if (isUnsure(r)) { var m = mineOf(id); if (m === null) return false; if (m === false) return true; }
    if (a === 'done' || a === 'discard') return true;
    if (a === 'bank') return future(S.bank[id], true);
    return future(S.pick[id], false);
  }
  function progressHtml() {
    var rows = S.rows || [], n = rows.length, x = rows.filter(answered).length, pct = n ? Math.round(x / n * 100) : 0;
    return '<div class="prog' + (x === n ? ' all' : '') + '" role="status" aria-live="polite"><b>' + (x === n ? 'All ' + n + ' answered. Save, and you are in.' : x + ' of ' + n + ' answered') + '</b><span class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></div>';
  }
  function saveLabel() {
    var c = counts(), bits = [];
    if (c.keep) bits.push(c.keep + (c.keep === 1 ? ' date' : ' dates'));
    if (c.done) bits.push(c.done + ' done');
    if (c.bank) bits.push(c.bank + ' to the bank');
    if (c.discard) bits.push(c.discard + ' discarded');
    if (c.assign) bits.push(c.assign + ' given an owner');
    if (c.notmine) bits.push(c.notmine + ' not yours');
    return 'Save: ' + (bits.join(', ') || 'your answers');
  }

  function html() {
    var rows = S.rows || [];
    var unsure = rows.filter(isUnsure);
    var lead = rows.filter(isLead);
    var plain = rows.filter(function (r) { return !isUnsure(r) && !isLead(r); });
    var over = plain.filter(function (r) { return r.why === 'overdue'; });
    var none = plain.filter(function (r) { return r.why === 'no_date'; });
    var set = plain.filter(function (r) { return r.why === 'meeting_set'; });
    var bits = [];
    if (unsure.length) bits.push(unsure.length + (unsure.length === 1 ? ' task to confirm as yours' : ' tasks to confirm as yours'));
    if (over.length) bits.push(over.length + (over.length === 1 ? ' overdue task' : ' overdue tasks'));
    if (none.length) bits.push(none.length + (none.length === 1 ? ' task' : ' tasks') + ' with no due date');
    if (set.length) bits.push(set.length + (set.length === 1 ? ' task' : ' tasks') + ' with a date a meeting set');
    if (lead.length) bits.push(lead.length + (lead.length === 1 ? ' task of your team' : ' tasks of your team') + ' with no owner yet');
    var h = '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="w213h"><div class="hd"><p class="how">Answer each task to carry on: Done, a new date, or Not mine. The Hub opens right after you save.</p><h2 id="w213h">' + E(hello()) + 'let’s get your tasks on track</h2>'
      + '<p class="lead">You have ' + E(bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : bits.join('')) + '. '
      + (unsure.length ? 'A meeting gave you a task without being sure it was yours: say if it is. ' : '')
      + 'We’ve suggested a due date for each one, usually your team’s next meeting. For each task, keep it with a date that works, mark it done, move it to the task bank for later, or discard it.'
      + (lead.length ? ' For your team’s tasks nobody owns yet, name who takes them.' : '') + ' Then save, and you’re all set.</p>' + progressHtml() + '</div><div class="bd">';
    if (unsure.length) h += '<h3>Is this yours? A meeting was not sure</h3>' + unsure.map(rowHtml).join('');
    if (over.length) h += '<h3>Overdue: is it done, or does it need a new date?</h3>' + over.map(rowHtml).join('');
    if (none.length) h += '<h3>No due date yet: here’s our suggestion</h3>' + none.map(rowHtml).join('');
    if (set.length) h += '<h3>Dates a meeting set: do they still work?</h3>' + set.map(rowHtml).join('');
    if (lead.length) h += '<h3>Your team’s tasks with no owner yet: who takes them?</h3>' + lead.map(rowHtml).join('');
    h += '</div><div class="ft"><button type="button" class="save" data-w213save="1"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Saving…' : E(saveLabel())) + '</button>'
      + (S.failed ? '<button type="button" class="later" data-w213later="1">Try again later</button>' : '')
      + '<span class="note">You can change any of this later on the task itself.</span>'
      + (S.err ? '<p class="err" role="alert">' + E(S.err) + '</p>' : '') + '</div></div>';
    return h;
  }

  function paint() {
    var el = document.getElementById('w213pop');
    if (!el) { el = document.createElement('div'); el.id = 'w213pop'; document.body.appendChild(el); wire(el); }
    var sc = el.querySelector('.bd'), top = sc ? sc.scrollTop : 0;
    el.innerHTML = html();
    var sc2 = el.querySelector('.bd'); if (sc2) sc2.scrollTop = top;
  }
  function close() { var el = document.getElementById('w213pop'); if (el) el.remove(); S.gone = true; document.removeEventListener('keydown', trapKey, true); }
  function trapKey(e) {
    if (!document.getElementById('w213pop')) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); }
  }

  function wire(el) {
    el.addEventListener('click', function (e) {
      var t = e.target, b;
      if (t === el) { e.stopPropagation(); return; }   /* a click outside does not close it */
      if ((b = t.closest('[data-w213set]'))) { S.pick[b.getAttribute('data-w213set')] = b.getAttribute('data-d'); paint(); return; }
      if ((b = t.closest('[data-w213act]'))) { S.act[b.getAttribute('data-w213act')] = b.getAttribute('data-a'); S.err = ''; paint(); return; }
      if ((b = t.closest('[data-w213mine]'))) { S.mine[b.getAttribute('data-w213mine')] = b.getAttribute('data-v') === '1'; S.err = ''; paint(); return; }
      if (t.closest('[data-w213save]')) { save(); return; }
      if (t.closest('[data-w213later]')) { close(); toastS('Your due dates are still to check: they will come back next time.'); return; }
    });
    el.addEventListener('change', function (e) {
      var i = e.target.closest('[data-w213date]'); if (i) { S.pick[i.getAttribute('data-w213date')] = i.value; paint(); return; }
      var k = e.target.closest('[data-w213bank]'); if (k) { S.bank[k.getAttribute('data-w213bank')] = k.value; paint(); return; }
      var w = e.target.closest('[data-w213who]'); if (w) { S.who[w.getAttribute('data-w213who')] = w.value; S.err = ''; paint(); }
    });
    document.addEventListener('keydown', trapKey, true);
  }

  async function save() {
    if (S.busy) return;
    var items = [], missing = 0, past = 0, bankBad = 0, unanswered = 0, nobody = 0, today = new Date(); today.setHours(0, 0, 0, 0);
    (S.rows || []).forEach(function (r) {
      var id = r.task_id, a = actOf(id), mine = null;
      /* wave237: the lead's rows: an owner, or done, or discard */
      if (isLead(r)) {
        if (a === 'done') { items.push({ id: id, action: 'done' }); return; }
        if (a === 'discard') { items.push({ id: id, action: 'discard' }); return; }
        if (!S.who[id]) { nobody++; return; }
        var dd = S.pick[id]; items.push({ id: id, action: 'assign', owner: S.who[id], due: dd && /^\d{4}-\d{2}-\d{2}$/.test(dd) && new Date(dd + 'T12:00:00') >= today ? dd : undefined }); return;
      }
      /* wave237: "Is this yours?" has to be answered; Not mine needs nothing else */
      if (isUnsure(r)) {
        mine = mineOf(id);
        if (mine === null) { unanswered++; return; }
        if (mine === false) { items.push({ id: id, action: 'notmine' }); return; }
      }
      if (a === 'done') { items.push(mine ? { id: id, action: 'done', mine: true } : { id: id, action: 'done' }); return; }
      if (a === 'discard') { items.push(mine ? { id: id, action: 'discard', mine: true } : { id: id, action: 'discard' }); return; }
      if (a === 'bank') {
        var u = S.bank[id];
        if (!u || !/^\d{4}-\d{2}-\d{2}$/.test(u) || new Date(u + 'T12:00:00') <= today) { bankBad++; return; }
        items.push(mine ? { id: id, action: 'bank', until: u, mine: true } : { id: id, action: 'bank', until: u }); return;
      }
      var v = S.pick[id];
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) { missing++; return; }
      if (new Date(v + 'T12:00:00') < today) { past++; return; }
      items.push(mine ? { id: id, due: v, mine: true } : { id: id, due: v });
    });
    if (unanswered) { S.err = unanswered === 1 ? 'One task is waiting for Mine or Not mine.' : unanswered + ' tasks are waiting for Mine or Not mine.'; paint(); return; }
    if (nobody) { S.err = nobody === 1 ? 'One of your team’s tasks has nobody picked: choose who takes it, or Done or Discard.' : nobody + ' of your team’s tasks have nobody picked: choose who takes each, or Done or Discard.'; paint(); return; }
    if (missing) { S.err = missing === 1 ? 'One task has no date: pick one, or choose Done, To the bank or Discard.' : missing + ' tasks have no date: pick one for each, or choose Done, To the bank or Discard.'; paint(); return; }
    if (past) { S.err = past === 1 ? 'One date is already past: push it to a date that is still ahead.' : past + ' dates are already past: push them to dates that are still ahead.'; paint(); return; }
    if (bankBad) { S.err = 'A task going to the bank needs a day in the future to come back on.'; paint(); return; }
    S.busy = true; S.err = ''; paint();
    try {
      var r = await db.rpc('confirm_due_check', { p: items });
      if (r && r.error) throw new Error(r.error.message || 'could not save');
      var res = (r && r.data) || {}, skipped = Array.isArray(res.skipped) ? res.skipped : [];
      var c = counts(), bits = [];
      if (c.keep) bits.push(c.keep + (c.keep === 1 ? ' due date' : ' due dates'));
      if (c.done) bits.push(c.done + ' done');
      if (c.bank) bits.push(c.bank + ' to the bank');
      if (c.discard) bits.push(c.discard + ' discarded');
      if (c.assign) bits.push(c.assign + ' given an owner');
      if (c.notmine) bits.push(c.notmine + ' passed to your lead');
      close();
      toastS('Saved: ' + bits.join(', ') + '.' + (skipped.length ? ' ' + skipped.length + (skipped.length === 1 ? ' task' : ' tasks') + ' could not be changed (' + String(skipped[0].why || '') + ').' : ''));
      try { if (typeof loadAll === 'function') { await loadAll(); if (typeof renderAllSections === 'function') renderAllSections(); if (typeof renderDashboard === 'function') renderDashboard(); if (typeof renderNeedsMe === 'function') renderNeedsMe(); } } catch (e2) { /* the pages refresh on their next load */ }
    } catch (e) {
      S.busy = false; S.failed++; S.err = 'That did not save (' + (e && e.message ? e.message : 'no answer') + '). Try Save again.'; paint();
    }
  }

  async function start() {
    if (S.shown || S.gone) return;
    if (!staff()) return;
    var rows = await load();
    if (!rows || !rows.length) return;
    S.rows = rows; S.pick = {}; S.act = {}; S.bank = {}; S.mine = {}; S.who = {};
    rows.forEach(function (r) { S.pick[r.task_id] = (r.why === 'meeting_set' || (r.why === 'owner_check' && r.due_date)) ? r.due_date : r.suggested; S.bank[r.task_id] = plusDays(90); if (r.for_lead) S.act[r.task_id] = 'assign'; });
    var tries = 0;
    (function wait() {
      if (S.shown || S.gone) return;
      if (busyElsewhere() && tries++ < 120) { setTimeout(wait, 1000); return; }
      S.shown = true; paint();
      try { var f = document.querySelector('#w213pop [data-w213save]'); if (f) f.focus(); } catch (e) { /* fine */ }
    })();
  }

  if (typeof startApp === 'function') {
    var __sa = startApp;
    startApp = async function () { await __sa.apply(this, arguments); setTimeout(function () { start(); }, 5000); };   /* wave238: after the Loop's gate and the meeting pop-up have had their moment */
  }
  window.w213 = { start: start, state: function () { return S; } };
})();
