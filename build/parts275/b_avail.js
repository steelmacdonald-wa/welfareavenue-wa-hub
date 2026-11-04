
  /* ---------- the manager's one-off dates, set by HR or an admin on the card ("Set <manager>'s exceptions", onboard-run availability_for) ----------
     Amended 02/11/26 (Steel): the manager's usual week is wave276's typical week, which they set on the Hub's Home page; only the dates that are not
     like it are kept here (team_members.availability.except). A date with no free hours means not free that day. onboard-run checks again: real dates,
     each once, times on 5-minute marks, each end after its start. */
  function excHtml(id, A) {
    var h = '<div class="o271ln"><b>' + E(A.mname || 'The manager') + '\'s one-off dates.</b> A date that is not like their usual week: not free at all, or other hours. Their usual week is theirs to set on the Hub\'s Home page.</div>';
    if (!A.exc.length) h += '<div class="o271ln">No one-off dates.</div>';
    A.exc.forEach(function (d, i) {
      h += '<div class="o275xd"><div class="o275xr"><label class="o271f" style="margin:0" for="o275x' + E(id) + '_' + i + '">Date</label><input type="date" id="o275x' + E(id) + '_' + i + '" data-o275xi="date" data-x="' + i + '" data-f="' + E(id) + '" value="' + E(d.date) + '">'
        + '<button type="button" class="o271b dng" data-o275x="rmdate" data-x="' + i + '" data-f="' + E(id) + '">Remove this date</button></div>';
      if (!d.free.length) h += '<div class="o271ln">Not free that day.</div>';
      d.free.forEach(function (blk, j) {
        var lab = (d.date || 'This date') + ', free hours ' + (j + 1);
        h += '<div class="o275xr"><input type="time" step="300" data-o275xi="from" data-x="' + i + '" data-b="' + j + '" data-f="' + E(id) + '" value="' + E(blk[0]) + '" aria-label="' + E(lab + ', from') + '"><span>to</span>'
          + '<input type="time" step="300" data-o275xi="to" data-x="' + i + '" data-b="' + j + '" data-f="' + E(id) + '" value="' + E(blk[1]) + '" aria-label="' + E(lab + ', to') + '">'
          + '<button type="button" class="o271b" data-o275x="rmblk" data-x="' + i + '" data-b="' + j + '" data-f="' + E(id) + '">Remove</button></div>';
      });
      h += '<div class="o275xr"><button type="button" class="o271b" data-o275x="addblk" data-x="' + i + '" data-f="' + E(id) + '">Add free hours</button></div></div>';
    });
    return h + '<div class="o271btns"><button type="button" class="o271b" data-o275x="adddate" data-f="' + E(id) + '"' + (A.exc.length >= 120 ? ' disabled' : '') + '>Add a date</button></div>';
  }
  function excClick(b) {
    var id = b.getAttribute('data-f'), A = S.act[id]; if (!A || A.kind !== 'exc') return;
    var act = b.getAttribute('data-o275x'), i = Number(b.getAttribute('data-x')), j = Number(b.getAttribute('data-b'));
    if (act === 'adddate') A.exc.push({ date: '', free: [] });
    else if (act === 'rmdate') A.exc.splice(i, 1);
    else if (act === 'addblk' && A.exc[i]) A.exc[i].free.push(A.exc[i].free.length ? ['18:00', '21:00'] : ['09:00', '17:00']);   /* a first block is a working day; a second, an evening */
    else if (act === 'rmblk' && A.exc[i]) A.exc[i].free.splice(j, 1);
    A.err = '';
    R.paint();
  }
  function excInput(t) {
    var id = t.getAttribute('data-f'), A = S.act[id]; if (!A || A.kind !== 'exc') return;
    var k = t.getAttribute('data-o275xi'), d = A.exc[Number(t.getAttribute('data-x'))]; if (!d) return;
    if (k === 'date') d.date = t.value;
    else { var blk = d.free[Number(t.getAttribute('data-b'))]; if (blk) blk[k === 'from' ? 0 : 1] = t.value; }
  }
  function excProblem(list) {
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || seen[d.date]) return 'Each one-off date needs a date, and each date only once.';
      seen[d.date] = true;
      for (var j = 0; j < d.free.length; j++) {
        var a = hm(d.free[j][0]), z = hm(d.free[j][1]);
        if (isNaN(a) || isNaN(z) || a % 5 || z % 5 || a >= z) return 'Each block of free hours needs a start and an end on 5-minute marks, with the end after the start.';
      }
    }
    return '';
  }
  function excClean(list) { return list.map(function (d) { return { date: d.date, free: d.free.map(function (b) { return [b[0], b[1]]; }) }; }); }
