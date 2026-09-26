
  /* ---------- rearranging: drag a card onto the person it reports to, or onto a team ---------- */
  function dragInfo(el) { var v = el && el.getAttribute('data-w133drag'); if (!v) return null; var i = v.indexOf(':'); return { kind: v.slice(0, i), id: v.slice(i + 1) }; }
  function dropInfo(el) { var v = el && el.getAttribute('data-w133drop'); if (v == null) return null; var i = v.indexOf(':'); return { kind: v.slice(0, i), id: v.slice(i + 1) }; }
  /* what a drop would do, or why it cannot */
  function plan(d, t) {
    var X = ix();
    if (!d || !t) return null;
    if (d.kind === 'pos') {
      var p = X.byId[d.id]; if (!p) return null;
      if (t.kind === 'pos') {
        if (String(t.id) === String(d.id)) return null;
        if (isUnder(X, t.id, d.id)) return { no: 'Someone cannot report to a person who reports to them.' };
        if (String(p.reports_to) === String(t.id)) return null;
        return { act: 'move', p: p, to: Number(t.id) };
      }
      if (t.kind === 'team') {
        if (!t.id) return p.reports_to == null ? null : { act: 'move', p: p, to: null };
        if (!isOpen(p) && seatTeam(p) !== t.id) return { no: seatName(p) + ' is on ' + teamShort(seatTeam(p)) + '. To change their team, use People and access; here you can have them report to anyone on ' + teamShort(t.id) + '.' };
        if (p.reports_to == null && seatTeam(p) === t.id) return null;
        return { act: 'move', p: p, to: null, dept: t.id };
      }
    }
    if (d.kind === 'member') {
      if (t.kind === 'pos') { var s = X.byId[t.id]; if (!s) return null; return isOpen(s) ? { act: 'fill', p: s, mid: Number(d.id) } : { act: 'place', mid: Number(d.id), to: Number(t.id) }; }
      if (t.kind === 'team') return { act: 'place', mid: Number(d.id), to: null };
    }
    return null;
  }
  function clearOver() { document.querySelectorAll('#w133 .over').forEach(function (x) { x.classList.remove('over'); }); }
  document.addEventListener('dragstart', function (e) {
    var el = e.target && e.target.closest && e.target.closest('#w133 [data-w133drag]');
    if (!el || !O.arrange || !O.canEdit) return;
    O.drag = dragInfo(el); el.classList.add('dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', el.getAttribute('data-w133drag')); } catch (x) { /* fine */ }
  });
  document.addEventListener('dragend', function () { O.drag = null; clearOver(); document.querySelectorAll('#w133 .dragging').forEach(function (x) { x.classList.remove('dragging'); }); });
  document.addEventListener('dragover', function (e) {
    if (!O.drag) return;
    var el = e.target && e.target.closest && e.target.closest('#w133 [data-w133drop]'); if (!el) { clearOver(); return; }
    var pl = plan(O.drag, dropInfo(el));
    if (!pl) { clearOver(); return; }
    e.preventDefault();
    if (pl.no) { clearOver(); return; }
    if (!el.classList.contains('over')) { clearOver(); el.classList.add('over'); }
  });
  document.addEventListener('drop', function (e) {
    if (!O.drag) return;
    var el = e.target && e.target.closest && e.target.closest('#w133 [data-w133drop]');
    var d = O.drag; O.drag = null; clearOver();
    if (!el) return;
    e.preventDefault();
    doPlan(plan(d, dropInfo(el)));
  });
  async function doPlan(pl) {
    if (!pl) return;
    if (pl.no) { toastS(pl.no); return; }
    try {
      if (pl.act === 'move') await move(pl.p, pl.to, pl.dept || null, false);
      else if (pl.act === 'fill') await fill(pl.p, pl.mid);
      else if (pl.act === 'place') await place(pl.mid, pl.to);
    } catch (x) { toastS(errText(x)); }
  }
