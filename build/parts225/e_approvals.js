
  /* ---------- approvals ---------- */
  function apCard(p) {
    var th = thumbOf(p), pub = S.pub, s = stateOf(p);
    var who0 = memberByEmail(p.submitted_by); var whoN = who0 ? who0.name : String(p.submitted_by || '').split('@')[0];
    var caps = (p.platforms || []).map(function (k) { var v = (p.variants || {})[k] || {}; var c = v.caption && String(v.caption).trim() ? v.caption : p.caption; return '<div style="margin:6px 0;font-size:12.5px">' + mark(k) + '<b>' + E(PLX[k] ? PLX[k][0] : k) + (v.kind && v.kind !== 'feed' ? ' ' + E(v.kind) : '') + '</b><div style="white-space:pre-wrap;margin-top:2px">' + E(clip(c || '', 400)) + '</div></div>'; }).join('');
    return '<div class="card"><div class="pl" style="border:none;padding:0" data-w225open="' + p.id + '">' + (th ? '<img src="' + E(th) + '" alt="">' : '<div class="ph">' + I('cal') + '</div>') + '<div style="min-width:0"><b>' + E(titleOf(p)) + '</b><small>' + E(p.scheduled_at ? niceWhen(p.scheduled_at) : 'No date yet') + ' · sent by ' + E(whoN) + (p.submitted_at ? ' ' + E(ago(p.submitted_at)) : '') + '</small></div><span class="pill ' + (p.approval_status === 'pending' ? 'appr' : p.approval_status === 'changes' ? 'bad' : 'ok') + '">' + E(s.label) + '</span></div>' +
      (p.approval_note ? '<div class="muted" style="margin:8px 0;padding:8px 10px;background:rgba(111,100,171,.08);border-radius:10px;color:var(--wa-text)">' + E(p.approval_note) + '</div>' : '') + caps +
      ((p.media || []).length > 1 ? '<div class="row" style="gap:4px;margin:6px 0">' + p.media.slice(0, 8).map(function (m) { return String(m.kind || m.mime || '').indexOf('video') >= 0 ? '<span class="pill">video</span>' : '<img src="' + E(m.url) + '" alt="' + E(m.alt || '') + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px">'; }).join('') + '</div>' : '') +
      '<div class="row" style="margin-top:8px"><a class="btn225 sm" data-w225open="' + p.id + '">' + I('eye') + ' Open</a><span class="sp"></span>' +
      (pub && p.approval_status === 'pending' ? '<input type="text" data-w225apnote="' + p.id + '" placeholder="Note (needed to send it back)" style="min-width:200px;flex:1"><a class="btn225 sm bad" data-w225dec="changes|' + p.id + '">Send it back</a><a class="btn225 sm pri" data-w225dec="approve|' + p.id + '">' + I('check') + ' Approve' + (p.scheduled_at ? ' and schedule' : '') + '</a>' : '') + '</div></div>';
  }
  function approvalsHtml() {
    var all = posts().filter(function (p) { return ['draft', 'scheduled', 'failed', 'published', 'posted'].indexOf(p.status) >= 0; });
    var pend = all.filter(function (p) { return p.approval_status === 'pending' && ['draft', 'scheduled', 'failed'].indexOf(p.status) >= 0; });
    var back = all.filter(function (p) { return p.approval_status === 'changes' && ['draft', 'scheduled', 'failed'].indexOf(p.status) >= 0; });
    var mine = all.filter(function (p) { return lower(p.submitted_by) === myEmail(); });
    var done = all.filter(function (p) { return p.approval_status === 'approved' && p.approved_at && Date.now() - new Date(p.approved_at).getTime() < 30 * 86400000; }).sort(function (a, b) { return String(b.approved_at).localeCompare(String(a.approved_at)); });
    var tabs = [['pending', 'Waiting', pend], ['changes', 'Sent back', back], ['mine', 'Mine', mine], ['approved', 'Approved, 30 days', done]];
    var cur = tabs.filter(function (t) { return t[0] === S.f.apr; })[0] || tabs[0];
    var intro = S.pub ? 'You approve posts: open one to check it, then Approve or Send it back with a note. The person who sent it hears about it in the Hub and on Slack.' : 'Marketing leads and admins approve posts before they go out. Send a post for approval from the composer; you hear back in the Hub and on Slack.';
    return '<div class="row" style="margin:0 0 12px"><span class="seg">' + tabs.map(function (t) { return '<a data-w225apr="' + t[0] + '" class="' + (cur[0] === t[0] ? 'on' : '') + '">' + E(t[1]) + '<span class="n">' + t[2].length + '</span></a>'; }).join('') + '</span><span class="sp"></span><span class="muted">' + E(intro) + '</span></div>' +
      (cur[2].length ? cur[2].map(apCard).join('') : '<div class="card"><div class="empty">' + (cur[0] === 'pending' ? 'Nothing waits for an approval.' : cur[0] === 'changes' ? 'Nothing was sent back.' : cur[0] === 'mine' ? 'You have not sent anything for approval.' : 'Nothing approved in the last 30 days.') + '</div></div>');
  }
  async function decideFrom(dec, id) {
    var inp = document.querySelector('#w225host [data-w225apnote="' + id + '"]'); var note = inp ? inp.value.trim() : '';
    if (dec === 'changes' && !note) { toastS('Write a note so they know what to change'); if (inp) inp.focus(); return; }
    try { var r = await db.rpc('studio_decide', { p_id: Number(id), p_decision: dec, p_note: note || null }); if (r.error) throw r.error; toastS(dec === 'approve' ? 'Approved' : 'Sent back with your note'); await loadAll(true); paint(); }
    catch (x) { toastS('Could not save the decision: ' + (x.message || x)); }
  }
