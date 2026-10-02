
  /* ---------- the donor program (#fund/donors): fund_settings.donor_program with the giving totals (fund_giving_summary) ---------- */
  function donorsHtml() {
    var D = setting('donor_program') || {}, G = F.giving || {}, goals = D.goals || {};
    var lead = isLeader();
    var monthly = Number(G.monthly_active || 0), goalN = Number(goals.monthly_donors || 40), pct = Math.max(0, Math.min(100, monthly / goalN * 100));
    var ladder = goals.ladder || [];
    var html = '<div class="w193kpis">'
      + '<a class="w193kpi" data-w193go="#crm/gifts"><small>Monthly donors</small><b class="orange">' + monthly + '</b><span>goal ' + goalN + (goals.by ? ' by ' + E(fmtDate(goals.by)) : '') + '</span></a>'
      + '<a class="w193kpi" data-w193go="#crm/gifts"><small>Monthly giving</small><b>' + E(money(G.monthly_amount || 0)) + '</b><span>a month · goal ' + E(money(goals.monthly_revenue || 400)) + '</span></a>'
      + '<a class="w193kpi" data-w193go="#crm/reports"><small>Raised, FY ' + E(fyLabel()) + '</small><b>' + E(money(G.fy_raised || 0)) + '</b><span>' + E(G.fy_gifts || 0) + ' gifts from ' + E(G.fy_donors || 0) + ' donors</span></a>'
      + '<a class="w193kpi" data-w193go="#crm/reports"><small>Last fiscal year</small><b>' + E(money(G.last_fy_raised || 0)) + '</b><span>' + E(G.last_fy_donors || 0) + ' donors</span></a>'
      + '<a class="w193kpi" data-w193go="#crm/reports"><small>Lapsed donors</small><b class="' + (Number(G.lapsed || 0) > 0 ? 'flag' : '') + '">' + E(G.lapsed || 0) + '</b><span>gave last year, not yet this year</span></a>'
      + '<a class="w193kpi" data-w193go="#crm"><small>Donors on file</small><b>' + E(G.donors_all || 0) + '</b><span>in the CRM' + (G.online_live === false ? ' · online giving is off' : '') + '</span></a>'
      + '</div>';
    html += '<div class="w193hero"><div class="w193card"><h3>' + E(D.name || 'Monthly donor program') + '<span class="sp"></span>' + (lead ? '<a class="w193btn ghost sm" data-w193dgoals="1">' + I('pen') + 'Edit the goals</a>' : '') + '</h3>'
      + '<div class="w193big">' + monthly + '<small>monthly donors of the ' + goalN + ' goal</small></div>'
      + '<div class="w193meter" title="Monthly donors against the goal"><div class="fill" style="width:' + pct.toFixed(1) + '%"></div>' + ladder.filter(function (l) { return Number(l.donors) <= goalN; }).map(function (l) { return '<div class="tick" style="left:' + Math.min(100, Number(l.donors) / goalN * 100) + '%"><span>' + E(l.donors) + ' · ' + E(l.when) + '</span></div>'; }).join('') + '</div>'
      + (ladder.length ? '<p class="w193note">The ladder: ' + ladder.map(function (l) { return E(l.donors) + ' donors at about $' + E(l.avg) + ' (' + E(l.when) + ')'; }).join('; ') + '. Year goal ' + E(money(goals.year_revenue || 3000)) + '.</p>' : '')
      + (D.audience ? '<p class="w193p" style="margin-top:12px"><b>Who we ask:</b> ' + E(D.audience) + '</p>' : '')
      + '<div class="w193acts"><a class="w193btn orange sm" href="https://hub.welfareavenue.com/give" target="_blank" rel="noopener">' + I('ext') + 'The donation page</a><a class="w193btn ghost sm" data-w193go="#crm/gifts">' + I('heart') + 'Gifts in the CRM</a><a class="w193btn ghost sm" data-w193go="#crm/reports">' + I('list') + 'Giving reports</a><a class="w193btn ghost sm" data-w193go="#crm/automations">' + I('bolt') + 'The thank-you automation</a></div></div>'
      + '<div class="w193stack"><div class="w193card"><h3>The tiers</h3><div class="w193tiers">' + (D.tiers || []).map(function (t) { return '<div class="w193tier"><b>' + E(t.label || ('$' + t.amount + ' a month')) + '</b><small>buys</small><p>' + E(t.buys || '') + '</p></div>'; }).join('') + '</div></div>'
      + '<div class="w193card"><h3>The team</h3><div class="w193roles">' + (D.roles || []).map(function (r) { return '<b>' + E(r.who) + '</b><span>' + E(r.role) + '</span>'; }).join('') + '</div></div></div></div>';
    html += '<div class="w193two"><div class="w193card"><h3>The stewardship rhythm' + (lead ? '<span class="sp"></span><span class="lnk">tick what is in place</span>' : '') + '</h3><ul class="w193checks">' + (D.cadence || []).map(function (c, i) { return '<li class="' + (c.done ? 'on' : '') + '"><span class="bx" data-w193dtick="cadence:' + i + '" role="checkbox" aria-checked="' + (c.done ? 'true' : 'false') + '" tabindex="0">' + (c.done ? I('check') : '') + '</span><div><span><b>' + E(c.l) + '</b></span>' + (c.how ? '<div class="w193note" style="margin-top:2px">' + E(c.how) + '</div>' : '') + '</div></li>'; }).join('') + '</ul></div>'
      + '<div class="w193card"><h3>The launch plan' + (lead ? '<span class="sp"></span><span class="lnk">tick what is done</span>' : '') + '</h3><ul class="w193checks">' + (D.launch || []).map(function (c, i) { return '<li class="' + (c.done ? 'on' : '') + '"><span class="bx" data-w193dtick="launch:' + i + '" role="checkbox" aria-checked="' + (c.done ? 'true' : 'false') + '" tabindex="0">' + (c.done ? I('check') : '') + '</span><span>' + E(c.step) + '</span></li>'; }).join('') + '</ul>' + (D.launched ? '<p class="w193note">Launched ' + E(fmtDate(D.launched)) + '.</p>' : '<p class="w193note">Not launched yet' + (lead ? ': set the date with Edit the goals when it goes live' : '') + '.</p>') + '</div></div>';
    html += '<div class="w193card" style="margin-top:14px"><h3>How we grow monthly giving</h3><ul class="w193ul">' + (D.playbook || []).map(function (p) { return '<li>' + E(p) + '</li>'; }).join('') + '</ul>' + (D.sources && D.sources.length ? '<p class="w193note">From ' + E(D.sources.join('; ')) + '.</p>' : '') + '</div>';
    return html;
  }
  async function donorTick(ref) {
    if (!isLeader()) { toastS('Leaders and admins tick these.'); return; }
    var p = String(ref).split(':'), list = p[0], i = Number(p[1]);
    var D = JSON.parse(JSON.stringify(setting('donor_program') || {}));
    var arr = D[list]; if (!arr || !arr[i]) return;
    arr[i].done = !arr[i].done;
    var r = await q(db.from('fund_settings').update({ value: D, updated_by: me().email }).eq('key', 'donor_program'));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    F.settings.donor_program = D; paint();
  }
  async function saveDonorGoals(form) {
    var fd = new FormData(form), D = JSON.parse(JSON.stringify(setting('donor_program') || {}));
    D.goals = D.goals || {};
    D.goals.monthly_donors = Number(fd.get('monthly_donors')) || D.goals.monthly_donors;
    D.goals.monthly_revenue = Number(fd.get('monthly_revenue')) || D.goals.monthly_revenue;
    D.goals.year_revenue = Number(fd.get('year_revenue')) || D.goals.year_revenue;
    D.goals.by = String(fd.get('by') || '') || null;
    D.launched = String(fd.get('launched') || '') || null;
    D.audience = String(fd.get('audience') || '').trim() || D.audience;
    var r = await q(db.from('fund_settings').update({ value: D, updated_by: me().email }).eq('key', 'donor_program'));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    F.settings.donor_program = D; closeSheet(); paint(); toastS('Saved.');
  }
