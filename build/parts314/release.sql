-- 13/11/26 - wave314 release: Manage ads in the Content Studio (Paid), for marketing leads only.
-- One transaction: if any check fails, nothing changes. Made against the live Hub page 095f882d0576184dd23f4b0381247ca9; result 04a6163f23704c9a2c7ec0b845219ff2.
-- Already live before this file: the edge function social-ads-manage (v1), the function wa314_ads_lead / wa314_ads_leads,
-- the table social_ad_actions and hub_settings studio_ads_limits (migration wave314_ads_manage).
-- Safe to paste from Windows: line endings are normalised (v2, 13/11/26).
-- Nobody is messaged by this release. Undo: "13-11-26 - wave314 undo (only if needed).sql".
create table if not exists public.site_files_bak_wa314 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa314 enable row level security;
revoke all on public.site_files_bak_wa314 from anon, authenticated;
grant all on public.site_files_bak_wa314 to service_role;
comment on table public.site_files_bak_wa314 is 'wave314 (13/11/26): index.html before wave314, for its undo. Drop after a week.';
do $bk$ begin
  if not exists (select 1 from public.site_files_bak_wa314) then
    insert into public.site_files_bak_wa314 select path, part, content, updated_at from public.site_files where path = 'index.html';
  end if;
end $bk$;
do $pg$
declare v text; v_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[replace($o1$Open Ads Manager</a></p>';
  }

  /* ---------- Connections: Meta live, and WhatsApp ---------- */$o1$, chr(13), ''), replace($o2$ clicks. Read-only from Meta\u2019s ad accounts; the Hub never changes an ad.</p></div>';$o2$, chr(13), '')];
  news text[] := array[replace($n1$Open Ads Manager</a></p>' + manage314();
  }

  /* =====================================================================
     WA v314 Manage ads, for marketing leads (13/11/26)
     =====================================================================
     Steel, with the Marketing API token: "Please add this functional in content studio", then "All of the above but only
     marketing leads": boost a published post, build a campaign as paused, and pause, resume or change a budget.
     - Shown under Paid (#studio/ads) only to marketing leads (wa314_ads_lead: Ian, KK, Eduardo on 13/11/26); everyone else
       keeps the read-only Paid card.
     - The token's state (who, permissions, expiry), each campaign with Pause / Turn on and its budget, a Boost a post form
       (Facebook or Instagram post, account, goal, place, ages, daily or total budget, dates) with Save as paused or Launch
       (Launch asks once more, naming the most it can spend), and the last actions.
     - Everything goes through social-ads-manage, which checks the lead again and holds the spending limits
       (hub_settings studio_ads_limits). The page never holds the token.
     ===================================================================== */
  var M314 = { lead: null, chk: null, chkErr: '', camps: null, campErr: '', log: [], busy: {}, form: null, confirm: false, budget: {}, msg: '', loading: false };
  var css314 = document.createElement('style'); css314.id = 'wa314css';
  css314.textContent = ''
    + '#w225host .w314 h4{margin:0 0 6px;font-family:' + HEAD + ';font-size:18px;color:' + GREEN + ';}'
    + '#w225host .w314 .tok{font-size:12.5px;border-radius:12px;padding:8px 10px;margin:6px 0 10px;background:rgba(16,63,57,.05);}'
    + '#w225host .w314 .tok.warn{background:rgba(220,165,39,.14);color:#6b4b00;}#w225host .w314 .tok.bad{background:rgba(179,64,47,.08);color:' + FLAG + ';}'
    + '#w225host .w314 .cp{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:10px 2px;border-top:1px solid rgba(16,63,57,.07);}'
    + '#w225host .w314 .cp:first-of-type{border-top:0;}'
    + '#w225host .w314 .cp b{font-size:13.5px;display:block;overflow-wrap:anywhere;}'
    + '#w225host .w314 .cp .m{font-size:12px;color:' + MUTED + ';}'
    + '#w225host .w314 .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center;}'
    + '#w225host .w314 .acts input{width:84px;font:inherit;font-size:16px;padding:4px 8px;border:1px solid rgba(16,63,57,.2);border-radius:8px;}'
    + '#w225host .w314 .st{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap;}'
    + '#w225host .w314 .st.on{background:rgba(42,140,122,.12);color:#1c6b5d;}#w225host .w314 .st.off{background:rgba(16,63,57,.07);color:' + MUTED + ';}#w225host .w314 .st.iss{background:rgba(179,64,47,.1);color:' + FLAG + ';}'
    + '#w225host .w314 .fm{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;margin:8px 0;}'
    + '#w225host .w314 .fm label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:' + MUTED + ';min-width:0;}'
    + '#w225host .w314 .fm .full{grid-column:1/-1;}'
    + '#w225host .w314 .fm select,#w225host .w314 .fm input{font:inherit;font-size:16px;padding:7px 9px;border:1px solid rgba(16,63,57,.2);border-radius:8px;background:#fff;color:' + INK + ';min-width:0;width:100%;box-sizing:border-box;}'
    + '#w225host .w314 .sum{font-size:13px;background:rgba(16,63,57,.05);border-radius:12px;padding:8px 10px;margin:4px 0 10px;}'
    + '#w225host .w314 .btn225.go{background:' + ROSE + ';border-color:' + ROSE + ';color:#FFFAF2;}'
    + '#w225host .w314 .err{color:' + FLAG + ';font-size:12.5px;margin:6px 0;}#w225host .w314 .ok{color:#1c6b5d;font-size:12.5px;margin:6px 0;}'
    + '#w225host .w314 .lg{font-size:12px;color:' + MUTED + ';margin:2px 0;}'
    + '@media (max-width:640px){#w225host .w314 .fm{grid-template-columns:minmax(0,1fr);}#w225host .w314 .cp{grid-template-columns:minmax(0,1fr);}#w225host .w314 .acts{justify-content:flex-start;}}';
  document.head.appendChild(css314);

  function lead314() {
    if (M314.lead !== null) return;
    M314.lead = false;
    Promise.resolve(db.rpc('wa314_ads_lead')).then(function (r) { M314.lead = !!(r && r.data === true); if (M314.lead) { load314(); paint(); } }, function () { /* not a lead */ });
  }
  function load314() {
    if (M314.loading) return; M314.loading = true;
    Promise.all([
      fn('social-ads-manage', { action: 'check' }).then(function (r) { M314.chk = r; M314.chkErr = ''; }, function (e) { M314.chkErr = e.message || String(e); }),
      fn('social-ads-manage', { action: 'campaigns' }).then(function (r) { M314.camps = r.campaigns || []; M314.campErr = ''; }, function (e) { M314.camps = M314.camps || []; M314.campErr = e.message || String(e); }),
      fn('social-ads-manage', { action: 'log' }).then(function (r) { M314.log = r.log || []; }, function () { /* fine */ })
    ]).then(function () { M314.loading = false; paint(); });
  }
  function ymd314(d) { var z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function posts314() { return (S.social || []).filter(function (p) { return (p.platform === 'facebook' || p.platform === 'instagram') && p.published_at; }).slice(0, 40); }
  function newForm314(postId) {
    var accs = (M314.chk && M314.chk.accounts) || [], act = accs.filter(function (a) { return Number(a.status) === 1; })[0] || accs[0];
    var p = posts314()[0], now = new Date();
    M314.form = { post: String(postId || (p ? p.id : '')), account: act ? act.id : '', goal: 'engagement', place: 'montreal', kind: 'daily', amount: '10', start: ymd314(now), end: ymd314(new Date(now.getTime() + 7 * 86400000)), age_min: '18', age_max: '65' };
    M314.confirm = false; M314.msg = '';
  }
  function plan314() {
    var f = M314.form; if (!f) return null;
    var s = f.start === ymd314(new Date()) ? new Date(Date.now() + 10 * 60000) : new Date(f.start + 'T09:00:00');
    var e = new Date(f.end + 'T23:59:00');
    var days = Math.ceil((e.getTime() - s.getTime()) / 86400000), amt = Number(f.amount) || 0;
    var most = f.kind === 'daily' ? amt * days : amt;
    var lim = (M314.chk && M314.chk.limits) || { max_daily: 50, max_total: 300, max_days: 30 };
    var why = '';
    if (!f.post) why = 'Pick a post.'; else if (!f.account) why = 'Pick an ad account.';
    else if (!(days >= 1)) why = 'The end must be after the start.'; else if (days > lim.max_days) why = 'A boost runs at most ' + lim.max_days + ' days.';
    else if (!(amt >= 1)) why = 'Give a budget.'; else if (f.kind === 'daily' && amt > lim.max_daily) why = 'The most a day is ' + money(lim.max_daily, 'CAD') + '.';
    else if (most > lim.max_total) why = 'This could spend ' + money(most, 'CAD') + '; the most for one boost is ' + money(lim.max_total, 'CAD') + '.';
    else if (f.kind === 'total' && amt < days) why = 'The total must be at least $1 a day.';
    return { start: s, end: e, days: days, most: most, why: why };
  }
  function status314(c) {
    var es = String(c.effective_status || c.status || '');
    if (es === 'ACTIVE') return '<span class="st on">Running</span>';
    if (/PAUSED/.test(es)) return '<span class="st off">Paused</span>';
    if (es === 'PENDING_REVIEW' || es === 'IN_PROCESS') return '<span class="st off">In review</span>';
    return '<span class="st iss">' + E(es.toLowerCase().replace(/_/g, ' ')) + '</span>';
  }
  var ACT314 = { boost_live: 'launched a boost', boost_paused: 'built a paused boost', boost_failed: 'tried a boost (it failed)', pause: 'paused', resume: 'turned on', budget: 'changed a budget', limits: 'changed the limits', status_failed: 'tried to change a status', budget_failed: 'tried to change a budget' };
  function manage314() {
    lead314();
    if (!M314.lead) return '';
    var h = '<div style="height:14px"></div><div class="card w314"><div class="row"><h4>Manage ads</h4><span class="sp"></span>'
      + '<a class="btn225 sm" data-w314boost="1">' + I('up') + ' Boost a post</a>'
      + '<a class="btn225 sm" data-w314reload="1"' + (M314.loading ? ' disabled' : '') + '>' + I('refresh') + (M314.loading ? ' Reading…' : ' Refresh') + '</a></div>'
      + '<p class="muted" style="margin:0 0 6px;font-size:12px">Only marketing leads see this. Every change is logged, and the other leads get a Slack message when money starts moving.</p>';
    var c = M314.chk;
    if (M314.chkErr) h += '<div class="tok bad">' + E(M314.chkErr) + '</div>';
    else if (!c) h += '<div class="tok">Checking the ads token…</div>';
    else {
      var exp = c.expires_at ? new Date(c.expires_at) : null, left = exp ? Math.round((exp.getTime() - Date.now()) / 86400000) : null;
      var cls = !c.can_manage || c.valid === false ? 'bad' : left !== null && left < 14 ? 'warn' : '';
      h += '<div class="tok ' + cls + '">' + (c.valid === false ? 'The ads token no longer works: an admin needs a new one. ' : '')
        + (c.can_manage ? 'Connected' + (c.who ? ' as ' + E(c.who) : '') + ', can manage ads.' : 'The token can only read ads (no ads_management).')
        + (exp ? ' It expires ' + E(exp.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })) + (left !== null && left < 14 ? ' (' + left + ' days): ask Steel for a long-lived token.' : '.') : c.can_manage ? ' It does not expire.' : '')
        + ' Limits: ' + E(money(c.limits.max_daily, 'CAD')) + ' a day, ' + E(money(c.limits.max_total, 'CAD')) + ' per boost, ' + c.limits.max_days + ' days.</div>';
    }
    if (M314.msg) h += '<div class="ok">' + E(M314.msg) + '</div>';
    if (M314.form) h += form314();
    if (M314.campErr) h += '<div class="err">' + E(M314.campErr) + '</div>';
    var cs = M314.camps;
    if (cs === null) h += '<div class="empty">Reading the campaigns…</div>';
    else if (!cs.length) h += '<div class="empty">No campaigns running or paused.</div>';
    else h += '<div>' + cs.map(function (cp) {
      var bud = cp.daily != null ? money(cp.daily, cp.currency) + ' a day' : cp.lifetime != null ? money(cp.lifetime, cp.currency) + ' in all' : (cp.adsets.length === 1 && (cp.adsets[0].daily != null || cp.adsets[0].lifetime != null) ? (cp.adsets[0].daily != null ? money(cp.adsets[0].daily, cp.currency) + ' a day' : money(cp.adsets[0].lifetime, cp.currency) + ' in all') : 'budget on its ad sets');
      var kind = cp.daily != null || (cp.adsets.length === 1 && cp.adsets[0].daily != null) ? 'daily' : 'lifetime';
      var busy = M314.busy[cp.id], bv = M314.budget[cp.id];
      return '<div class="cp"><div><b data-w198skip>' + E(clip(cp.name, 90)) + '</b><span class="m">' + status314(cp) + ' ' + E(bud) + ' · ' + E(money(cp.spend7, cp.currency)) + ' spent in 7 days · ' + E(String(cp.objective || '').replace(/^OUTCOME_/, '').toLowerCase()) + '</span></div>'
        + '<div class="acts">' + (bv != null
          ? '<input type="number" min="1" step="1" inputmode="decimal" data-w314bv="' + cp.id + '" value="' + E(bv) + '" aria-label="New ' + (kind === 'daily' ? 'daily' : 'total') + ' budget"><span class="m">' + (kind === 'daily' ? 'a day' : 'in all') + '</span><a class="btn225 sm" data-w314bsave="' + cp.id + '|' + kind + '"' + (busy ? ' disabled' : '') + '>Save</a><a class="btn225 sm" data-w314bx="' + cp.id + '">Cancel</a>'
          : '<a class="btn225 sm" data-w314bed="' + cp.id + '">Budget</a>'
            + (cp.status === 'ACTIVE' ? '<a class="btn225 sm" data-w314st="' + cp.id + '|PAUSED"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Working…' : 'Pause') + '</a>'
              : '<a class="btn225 sm go" data-w314st="' + cp.id + '|ACTIVE"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Working…' : 'Turn on') + '</a>')
            + '<a class="btn225 sm" href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=' + E(String(cp.account_id).replace('act_', '')) + '&selected_campaign_ids=' + E(cp.id) + '" target="_blank" rel="noopener">Ads Manager</a>')
        + '</div></div>';
    }).join('') + '</div>';
    if (M314.log.length) h += '<p class="muted" style="margin:12px 0 4px;font-size:12px;font-weight:700">Recent changes</p>' + M314.log.slice(0, 8).map(function (l) {
      var d = l.detail || {};
      return '<div class="lg">' + E(ago(l.at)) + ': ' + E(l.by_name || l.by_email) + ' ' + E(ACT314[l.action] || l.action) + (d.name ? ' · ' + E(clip(d.name, 60)) : '') + (l.action === 'budget' ? ' (' + E(money(d.before || 0, 'CAD')) + ' → ' + E(money(d.after || 0, 'CAD')) + ')' : '') + (l.error ? ' · ' + E(clip(l.error, 100)) : '') + '</div>';
    }).join('');
    return h + '</div>';
  }
  function form314() {
    var f = M314.form, c = M314.chk || {}, pl = plan314();
    var opt = function (v, l, cur) { return '<option value="' + E(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + E(l) + '</option>'; };
    var posts = posts314();
    var h = '<div class="card" style="margin:8px 0 12px;background:rgba(16,63,57,.03)"><b>Boost a post</b><div class="fm">'
      + '<label class="full">The post<select data-w314f="post">' + (posts.length ? posts.map(function (p) { return opt(p.id, (p.platform === 'facebook' ? 'Facebook' : 'Instagram') + ', ' + niceDate(dayOf(p.published_at), { month: 'short', day: 'numeric' }) + ': ' + clip(p.caption || p.kind || 'post', 70), f.post); }).join('') : '<option value="">No Facebook or Instagram posts in the last year</option>') + '</select></label>'
      + '<label>Ad account<select data-w314f="account">' + ((c.accounts || []).map(function (a) { return opt(a.id, (a.name && a.name !== String(a.id).replace('act_', '') ? a.name : a.id) + (Number(a.status) !== 1 ? ' (not active)' : ''), f.account); }).join('') || '<option value="">None found</option>') + '</select></label>'
      + '<label>Goal<select data-w314f="goal">' + ((c.goals || [{ key: 'engagement', label: 'Engagement' }]).map(function (g) { return opt(g.key, g.label, f.goal); }).join('')) + '</select></label>'
      + '<label>Where<select data-w314f="place">' + ((c.places || [{ key: 'montreal', label: 'Montreal' }]).map(function (g) { return opt(g.key, g.label, f.place); }).join('')) + '</select></label>'
      + '<label>Ages<span style="display:flex;gap:6px;align-items:center"><input type="number" min="18" max="65" data-w314f="age_min" value="' + E(f.age_min) + '" aria-label="Youngest"><span>to</span><input type="number" min="18" max="65" data-w314f="age_max" value="' + E(f.age_max) + '" aria-label="Oldest"></span></label>'
      + '<label>Budget<select data-w314f="kind">' + opt('daily', 'Per day', f.kind) + opt('total', 'In total', f.kind) + '</select></label>'
      + '<label>Amount ($)<input type="number" min="1" step="1" inputmode="decimal" data-w314f="amount" value="' + E(f.amount) + '"></label>'
      + '<label>Start<input type="date" data-w314f="start" value="' + E(f.start) + '" min="' + E(ymd314(new Date())) + '"></label>'
      + '<label>End<input type="date" data-w314f="end" value="' + E(f.end) + '"></label>'
      + '</div>';
    if (pl.why) h += '<div class="err">' + E(pl.why) + '</div>';
    else h += '<div class="sum">' + (f.kind === 'daily' ? E(money(Number(f.amount), 'CAD')) + ' a day for ' + pl.days + ' day' + (pl.days > 1 ? 's' : '') : E(money(Number(f.amount), 'CAD')) + ' over ' + pl.days + ' day' + (pl.days > 1 ? 's' : '')) + ': <b>it can spend up to ' + E(money(pl.most, 'CAD')) + '</b>. Meta reviews every ad before it runs.</div>';
    var busy = M314.busy.boost;
    h += '<div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn225 sm" data-w314go="paused"' + (pl.why || busy ? ' disabled' : '') + '>' + (busy === 'paused' ? 'Building…' : 'Save as paused') + '</a>'
      + '<a class="btn225 sm go" data-w314go="active"' + (pl.why || busy ? ' disabled' : '') + '>' + (busy === 'active' ? 'Launching…' : M314.confirm ? 'Yes, spend up to ' + E(money(pl.most, 'CAD')) : 'Launch now') + '</a>'
      + '<a class="btn225 sm" data-w314fx="1">Cancel</a></div>'
      + (M314.confirm ? '<p class="muted" style="font-size:12px;margin:6px 0 0">Press again to launch. Save as paused instead to check it in Ads Manager first.</p>' : '')
      + '</div>';
    return h;
  }
  function boostGo314(mode) {
    var f = M314.form, pl = plan314(); if (!f || pl.why || M314.busy.boost) return;
    if (mode === 'active' && !M314.confirm) { M314.confirm = true; paint(); return; }
    M314.busy.boost = mode; paint();
    var body = { action: 'boost', social_post_id: Number(f.post), account_id: f.account, goal: f.goal, place: f.place, start: pl.start.toISOString(), end: pl.end.toISOString(), age_min: Number(f.age_min), age_max: Number(f.age_max), launch: mode };
    if (f.kind === 'daily') body.daily = Number(f.amount); else body.total = Number(f.amount);
    fn('social-ads-manage', body).then(function (r) {
      M314.form = null; M314.confirm = false;
      M314.msg = mode === 'active' ? 'Boost launched: Meta reviews it, then it runs. It can spend up to ' + money(r.most, 'CAD') + '.' : 'Built as paused. Turn it on below, or check it in Ads Manager first.';
      toastS(mode === 'active' ? 'Boost launched' : 'Boost saved as paused');
      load314();
    }, function (e) { toastS('Could not boost: ' + (e.message || e)); M314.msg = ''; M314.campErr = 'Boost: ' + (e.message || e); M314.confirm = false; })
      .then(function () { M314.busy.boost = null; paint(); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w225host .w314')) return;
    var el, x;
    if ((el = t.closest('[data-w314reload]'))) { if (!M314.loading) { M314.msg = ''; load314(); paint(); } return; }
    if ((el = t.closest('[data-w314boost]'))) { newForm314(); paint(); return; }
    if ((el = t.closest('[data-w314fx]'))) { M314.form = null; M314.confirm = false; paint(); return; }
    if ((el = t.closest('[data-w314go]'))) { if (!el.hasAttribute('disabled')) boostGo314(el.getAttribute('data-w314go')); return; }
    if ((el = t.closest('[data-w314bed]'))) { x = el.getAttribute('data-w314bed'); var cp = (M314.camps || []).filter(function (c) { return c.id === x; })[0]; M314.budget[x] = cp ? (cp.daily != null ? cp.daily : cp.lifetime != null ? cp.lifetime : (cp.adsets[0] ? (cp.adsets[0].daily != null ? cp.adsets[0].daily : cp.adsets[0].lifetime) : '')) || '' : ''; paint(); return; }
    if ((el = t.closest('[data-w314bx]'))) { delete M314.budget[el.getAttribute('data-w314bx')]; paint(); return; }
    if ((el = t.closest('[data-w314bsave]'))) {
      var sp = el.getAttribute('data-w314bsave').split('|'), id = sp[0], v = Number(M314.budget[id]);
      if (!(v > 0) || M314.busy[id]) return;
      M314.busy[id] = true; paint();
      var b = { action: 'budget', id: id }; if (sp[1] === 'daily') b.daily = v; else b.lifetime = v;
      fn('social-ads-manage', b).then(function (r) { delete M314.budget[id]; M314.msg = 'Budget of ' + clip(r.name, 50) + ' set to ' + money(r.after, 'CAD') + (r.kind === 'daily' ? ' a day.' : ' in all.'); load314(); }, function (er) { toastS('Could not change the budget: ' + (er.message || er)); M314.campErr = er.message || String(er); })
        .then(function () { M314.busy[id] = false; paint(); });
      return;
    }
    if ((el = t.closest('[data-w314st]'))) {
      if (el.hasAttribute('disabled')) return;
      var sp2 = el.getAttribute('data-w314st').split('|');
      M314.busy[sp2[0]] = true; paint();
      fn('social-ads-manage', { action: 'status', id: sp2[0], status: sp2[1] }).then(function (r) { M314.msg = (sp2[1] === 'ACTIVE' ? 'Turned on: ' : 'Paused: ') + clip(r.name, 60); load314(); }, function (er) { toastS('Could not change it: ' + (er.message || er)); M314.campErr = er.message || String(er); })
        .then(function () { M314.busy[sp2[0]] = false; paint(); });
    }
  });
  function field314(t) {
    var k = t.getAttribute('data-w314f'); if (k && M314.form) { M314.form[k] = t.value; M314.confirm = false; return 'f'; }
    var b = t.getAttribute('data-w314bv'); if (b) { M314.budget[b] = t.value; return 'b'; }
    return '';
  }
  document.addEventListener('input', function (e) { var t = e.target; if (!t || !t.closest || !t.closest('#w225host .w314')) return; field314(t); });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w225host .w314')) return;
    if (field314(t) === 'f') {   /* repaint after a choice so the summary and limits follow; keep focus where it was */
      var k = t.getAttribute('data-w314f'); paint();
      var n = document.querySelector('#w225host .w314 [data-w314f="' + k + '"]'); if (n && t.tagName !== 'SELECT') { try { n.focus({ preventScroll: true }); } catch (x) { /* fine */ } }
    }
  });
  window.w314 = { state: function () { return M314; }, reload: load314 };

  /* ---------- Connections: Meta live, and WhatsApp ---------- */$n1$, chr(13), ''), replace($n2$ clicks. ' + (M314.lead ? 'From Meta\u2019s ad accounts; marketing leads manage them below.' : 'Read-only from Meta\u2019s ad accounts.') + '</p></div>';$n2$, chr(13), '')];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'index.html';
  if v is null then raise exception 'index.html not found'; end if;
  if (select count(*) from public.site_files where path = 'index.html') <> 10 then raise exception 'index.html is not in 10 parts'; end if;
  if position('WA v314 ' in v) > 0 then raise exception 'index.html already has wave314'; end if;
  if md5(v) <> '095f882d0576184dd23f4b0381247ca9' then raise notice 'index.html has moved since this file was made (md5 %): the edits apply only if each still matches once', md5(v); end if;
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i];
    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'index.html: edit % matches % times, nothing changed', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v) = '095f882d0576184dd23f4b0381247ca9' and md5(v_new) <> '04a6163f23704c9a2c7ec0b845219ff2' then raise exception 'index.html: unexpected result %', md5(v_new); end if;
  sz := ceil(length(v_new) / 10.0);
  for i in 1..10 loop
    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'index.html part % missing', i; end if;
  end loop;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> md5(v_new) then raise exception 'index.html: post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave314', md5(v), md5(v_new) || ': Manage ads in the Content Studio (Paid), marketing leads only', 'Claude for Steel (13/11/26)');
end $pg$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync, (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5;
