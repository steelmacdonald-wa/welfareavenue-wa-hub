
  /* ---------- Requests: grant or decline, in one click ---------- */
  function reqPerson(q) { return personBy(q.email) || { name: q.name || nameFromEmail(q.email), email: lower(q.email), dept: '', row: S.roles[lower(q.email)] || null, pages: [], status: 'invited' }; }
  /* what Grant does for this request, in words, and the change it makes */
  function grantPlan(q) {
    var x = reqPerson(q), w = String(q.wanted || '');
    if (x.status === 'removed') return { ok: false, why: 'They were removed from the Hub; invite them again first.' };
    if (w.indexOf('tab:') === 0) {
      var t = w.slice(4);
      if (x.founder || x.role === 'admin') return { ok: false, why: 'Admins already see every page.' };
      if ((x.pages || []).indexOf(t) >= 0) return { ok: true, noop: true, say: 'They can already open ' + labelOf(t) + '; granting closes the request.' };
      var base = (x.pages || []).slice(); base.push(t);
      return { ok: true, say: 'Adds ' + labelOf(t) + ' to their pages' + (x.assigned ? ' on top of ' + profileName(x.assigned.key, x.lead) + ' (their pages become hand-picked; pick a profile later to go back)' : '') + '.', patch: { tabs: base, role: x.row ? (x.row.role === 'blocked' ? 'member' : x.row.role) : 'member', profile: x.row ? x.row.profile || null : null } };
    }
    if (w === 'role:leader') {
      var tp = x.assigned && isTeamP(x.assigned) ? x.assigned : teamProfile(x.dept);
      if (x.role === 'leader' || x.role === 'admin') return { ok: true, noop: true, say: 'They already lead; granting closes the request.' };
      if (tp) return { ok: true, say: 'Makes them a lead on ' + tp.label + ': ' + (tp.lead_note || 'Agendas, Activity, the HR centre for their team and the board pages') + '.', profile: tp.key, lead: true };
      return { ok: true, say: 'Gives them the classic leader role (every page but Admin). No team profile fits their roster team.', patch: { role: 'leader', tabs: null, profile: null } };
    }
    if (w === 'role:admin') {
      if (x.role === 'admin') return { ok: true, noop: true, say: 'They are already an admin; granting closes the request.' };
      return { ok: true, say: 'Moves them to Admin: every page, and they can change anyone’s access.', profile: 'admin', lead: false };
    }
    return { ok: false, why: 'A free-text request: open their access, make the change, then mark it done.' };
  }
  function requestsHtml() {
    var open = openRequests(), done = (S.requests || []).filter(function (q) { return q.status !== 'new'; });
    var h = '<div class="w131box" style="padding:0">';
    if (!open.length) h += '<p class="w131empty">No request is waiting. People ask from My page (Request more access) or from Your access in their profile menu.</p>';
    open.forEach(function (q) {
      var x = reqPerson(q), plan = grantPlan(q);
      h += '<div class="w131rq" data-w131rq="' + q.id + '">' + avatar(x) + '<div class="tx"><b>' + E(x.name) + '</b> <span class="w131mut" style="font-size:12.5px">' + E(q.email) + '</span>'
        + '<div class="what">' + I('key') + E(reqWhat(q)) + '</div>'
        + (q.reason ? '<p>“' + E(q.reason) + '”</p>' : '')
        + '<small>Asked ' + E(ago(q.created_at)) + '. Today: ' + (x.assigned ? E(profileName(x.assigned.key, x.lead)) : x.hand ? 'hand-picked pages' : E((x.row && x.row.role) || q.role_now || 'member')) + '. ' + E(plan.ok ? plan.say : plan.why) + '</small></div>'
        + '<div class="ac">' + (plan.ok ? '<a class="w131btn sm" data-w131grant="' + q.id + '">' + I('check') + 'Grant</a>' : '<a class="w131btn sm" data-w131open="' + E(pkey(x)) + '">Open their access</a><a class="w131btn sm ghost" data-w131done="' + q.id + '">Mark done</a>')
        + '<a class="w131btn sm ghost" data-w131decline="' + q.id + '">Decline</a></div></div>';
    });
    h += '</div>';
    if (done.length) {
      h += '<div class="w131sec"><h2>Decided</h2><span>The last ' + Math.min(done.length, 20) + '.</span></div><div class="w131box" style="padding:0">' + done.slice(0, 20).map(function (q) {
        var x = reqPerson(q);
        return '<div class="w131rq">' + avatar(x) + '<div class="tx"><b>' + E(x.name) + '</b> <span class="w131mut" style="font-size:12.5px">' + E(reqWhat(q)) + '</span><small>' + E(q.status === 'granted' ? 'Granted' : q.status === 'declined' ? 'Declined' : q.status) + (q.decided_by ? ' by ' + E(String(q.decided_by).split('@')[0].replace(/[._]/g, ' ')) : '') + (q.decided_at ? ', ' + E(ago(q.decided_at)) : '') + '</small></div><div class="ac"><span class="w131rqst ' + E(q.status) + '">' + E(q.status) + '</span></div></div>';
      }).join('') + '</div>';
    }
    return h;
  }
  async function decide(id, grant, manual) {
    var q = (S.requests || []).filter(function (r) { return String(r.id) === String(id); })[0]; if (!q || S.busy) return;
    S.busy = true;
    try {
      if (grant && !manual) {
        var plan = grantPlan(q), x = reqPerson(q);
        if (!plan.ok) throw new Error(plan.why);
        if (!plan.noop) {
          if (plan.profile) {
            var ok = await saveProfile(x.email ? x : { email: lower(q.email), name: q.name, row: S.roles[lower(q.email)] || null }, plan.profile, plan.lead, 'access request #' + q.id);
            if (!ok) throw new Error('could not change the profile');
          } else if (plan.patch) {
            var r = await db.from('hub_roles').upsert(Object.assign({ email: lower(q.email), updated_by: actor(), updated_at: new Date().toISOString() }, plan.patch), { onConflict: 'email' });
            if (r && r.error) throw r.error;
            logChange('hub_role', lower(q.email), plan.patch.tabs ? 'tabs' : 'role', null, q.wanted + ' (access request #' + q.id + ')');
          }
        }
      }
      var up = await db.from('wa_access_requests').update({ status: grant ? 'granted' : 'declined', decided_by: myEmail(), decided_at: new Date().toISOString() }).eq('id', q.id);
      if (up && up.error) throw up.error;
      toastS(grant ? (manual ? 'Marked done' : 'Granted: ' + first(q.name || q.email) + ' sees it the next time they open the Hub') : 'Declined');
      S.busy = false;
      await afterChange(lower(q.email));
    } catch (e) { S.busy = false; toastS('Could not do it: ' + String((e && e.message) || e).slice(0, 100)); }
  }
