
  /* ---------- approvals ---------- */
  function apCard(p) {
    var th = thumbOf(p), pub = S.pub, s = stateOf(p);
    var who0 = memberByEmail(p.submitted_by); var whoN = who0 ? who0.name : String(p.submitted_by || '').split('@')[0];
    var caps = (p.platforms || []).map(function (k) { var v = (p.variants || {})[k] || {}; var c = v.caption && String(v.caption).trim() ? v.caption : p.caption; return '<div style="margin:6px 0;font-size:12.5px">' + mark(k) + '<b>' + E(PLX[k] ? PLX[k][0] : k) + (v.kind && v.kind !== 'feed' ? ' ' + E(v.kind) : '') + '</b><div style="white-space:pre-wrap;margin-top:2px">' + E(clip(c || '', 400)) + '</div></div>'; }).join('');
    return '<div class="card"><div class="pl" style="border:none;padding:0" data-w225open="' + p.id + '">' + (th ? '<img src="' + E(th) + '" alt="">' : '<div class="ph">' + I('cal') + '</div>') + '<div style="min-width:0"><b>' + E(titleOf(p)) + '</b><small>' + E(p.scheduled_at ? niceWhen(p.scheduled_at) : 'No date yet') + ' · sent by ' + E(whoN) + (p.submitted_at ? ' ' + E(ago(p.submitted_at)) : '') + '</small></div><span class="pill ' + (p.approval_status === 'pending' ? 'appr' : p.approval_status === 'changes' ? 'bad' : 'ok') + '">' + E(s.label) + '</span></div>' +
      (p.approval_note ? '<div class="muted" style="margin:8px 0;padding:8px 10px;background:rgba(111,100,171,.08);border-radius:10px;color:var(--wa-text)">' + E(p.approval_note) + '</div>' : '') + caps +
      ((p.media || []).length > 1 ? '<div class="row" style="gap:4px;margin:6px 0">' + p.media.slice(0, 8).map(function (m) { return String(m.kind || m.mime || '').indexOf('video') >= 0 ? '<span class="pill">video</span>' : '<img src="' + E(m.url) + '" alt="' + E(m.alt || '') + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px">'; }).join('') + '</div>' : '') +
      '<div class="row" style="margin-top:8px"><a class="btn225 sm" data-w225open="' + p.id + '">' + I('eye') + ' Open</a>' + (p.canva_url ? '<a class="btn225 sm" href="' + E(p.canva_url) + '" target="_blank" rel="noopener" title="The design in Canva">Open in Canva</a>' : '') + (p.format === 'article' ? '<span class="pill">LinkedIn article</span>' : '') + '<span class="sp"></span>' +
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
    var intro = S.pub ? 'You approve posts: open one to check it, then Approve or Send it back with a note. The person who sent it hears about it in the Hub and on Slack.' : 'Scheduling a post sends it here: the approvers hear in the Hub and on Slack, and once approved it goes out at the time you picked. You hear back the same way.';
    /* wave241: who gets the approval pings (hub_settings content_studio.approvers); empty means the marketing leads and admins */
    var aps = ((S.settings || {}).approvers || []).join(', ');
    var apBox = S.pub ? '<div class="card" style="margin:0 0 12px"><div class="row"><b>Approvers</b><input type="text" data-w241approvers placeholder="ian.odhiambo@welfareavenue.com, kahkashan.ansary@welfareavenue.com" value="' + E(aps) + '" style="flex:1;min-width:240px"><a class="btn225 sm pri" data-w241apsave="1">Save</a></div><p class="muted" style="margin:6px 0 0">The people pinged when a post waits (with Approve and Send it back links on Slack). Admins and marketing leads can always approve; empty means all of them are pinged.</p></div>' : '';
    return apBox + '<div class="row" style="margin:0 0 12px"><span class="seg">' + tabs.map(function (t) { return '<a data-w225apr="' + t[0] + '" class="' + (cur[0] === t[0] ? 'on' : '') + '">' + E(t[1]) + '<span class="n">' + t[2].length + '</span></a>'; }).join('') + '</span><span class="sp"></span><span class="muted">' + E(intro) + '</span></div>' +
      (cur[2].length ? cur[2].map(apCard).join('') : '<div class="card"><div class="empty">' + (cur[0] === 'pending' ? 'Nothing waits for an approval.' : cur[0] === 'changes' ? 'Nothing was sent back.' : cur[0] === 'mine' ? 'You have not sent anything for approval.' : 'Nothing approved in the last 30 days.') + '</div></div>');
  }
  /* wave241: the Slack links: #studio/approvals?post=<id>&do=approve|back */
  async function applyApDo() {
    var d = S.apDo; if (!d) return; S.apDo = null;
    var p = posts().filter(function (x) { return String(x.id) === String(d.post); })[0];
    if (!p) { toastS('That post is not here any more'); return; }
    if (p.approval_status !== 'pending') { toastS(p.approval_status === 'approved' ? 'Already approved' + (p.approved_by ? ' by ' + E(String(p.approved_by).split('@')[0]) : '') : 'That post is not waiting for approval'); return; }
    if (!S.pub) { toastS('Only an approver can decide; open the post to read it'); return; }
    S.f.apr = 'pending'; paint();
    if (d.do === 'approve') { await decideFrom('approve', p.id); return; }
    var inp = document.querySelector('#w225host [data-w225apnote="' + p.id + '"]');
    if (inp) { inp.focus(); try { inp.scrollIntoView({ block: 'center' }); } catch (e) { /* fine */ } toastS('Write the note, then Send it back'); }
  }
  async function saveApprovers() {
    var inp = document.querySelector('#w225host [data-w241approvers]'); if (!inp) return;
    var list = inp.value.split(/[,\s;]+/).map(function (x) { return lower(x); }).filter(function (x) { return /@/.test(x); });
    try { var value = Object.assign({}, S.settings || {}, { approvers: list }); var r = await db.rpc('studio_settings_save', { p_key: 'content_studio', p_value: value }); if (r.error) throw r.error; S.settings = value; toastS(list.length ? 'Approvers saved: ' + list.length : 'Approvers cleared: the marketing leads and admins are pinged'); paint(); }
    catch (x) { toastS('Could not save: ' + (x.message || x)); }
  }
  async function decideFrom(dec, id) {
    var inp = document.querySelector('#w225host [data-w225apnote="' + id + '"]'); var note = inp ? inp.value.trim() : '';
    if (dec === 'changes' && !note) { toastS('Write a note so they know what to change'); if (inp) inp.focus(); return; }
    try { var r = await db.rpc('studio_decide', { p_id: Number(id), p_decision: dec, p_note: note || null }); if (r.error) throw r.error; toastS(dec === 'approve' ? 'Approved' : 'Sent back with your note'); await loadAll(true); paint(); }
    catch (x) { toastS('Could not save the decision: ' + (x.message || x)); }
  }
