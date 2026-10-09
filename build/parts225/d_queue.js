
  /* ---------- the queue and the posting schedule ---------- */
  function slotGroups() {
    /* one row per weekday and time, with the platforms that post then */
    var m = {}; slots().forEach(function (s) { var k = s.weekday + '|' + String(s.at).slice(0, 5); (m[k] = m[k] || { wd: Number(s.weekday), at: String(s.at).slice(0, 5), pls: [], ids: [] }); m[k].pls.push(s.platform); m[k].ids.push(s.id); });
    return Object.keys(m).map(function (k) { m[k].pls.sort(function (a, b) { return PORDER.indexOf(a) - PORDER.indexOf(b); }); return m[k]; });
  }
  function queueHtml14() {
    var t = today(), nowHm = hm(new Date().toISOString()), groups = slotGroups(), all = posts();
    var ideas = all.filter(function (p) { return !p.scheduled_at && p.status === 'draft'; });
    var html = '';
    for (var i = 0; i < 14; i++) {
      var d = addDays(t, i), wd = dowOf(d);
      var dayPosts = all.filter(function (p) { return p.scheduled_at && dayOf(p.scheduled_at) === d && p.status !== 'cancelled'; });
      var taken = {}; dayPosts.forEach(function (p) { taken[hm(p.scheduled_at)] = 1; });
      var free = groups.filter(function (g) { return g.wd === wd && !taken[g.at] && !(i === 0 && g.at <= nowHm); });
      var rows = dayPosts.map(function (p) { return { at: hm(p.scheduled_at), html: postRow(p) }; }).concat(free.map(function (g) {
        return { at: g.at, html: '<div class="slot"><div class="ph">' + E(g.at) + '</div><div>Free slot · ' + g.pls.map(function (k) { return mark(k); }).join('') + ' ' + E(g.pls.map(function (k) { return PLX[k][0]; }).join(', ')) + '</div><div class="row">' +
          (ideas.length ? '<select data-w225fill="' + d + '|' + g.at + '" aria-label="Fill with an idea"><option value="">Fill with an idea…</option>' + ideas.slice(0, 40).map(function (p) { return '<option value="' + p.id + '">' + E(clip(titleOf(p), 50)) + '</option>'; }).join('') + '</select>' : '') +
          '<a class="btn225 sm" data-w225slotnew="' + d + '|' + g.at + '|' + g.pls.join(',') + '">' + I('plus') + ' New post</a></div></div>' };
      })).sort(function (a, b) { return a.at.localeCompare(b.at); });
      if (!rows.length) continue;
      html += '<div class="day">' + E(i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : niceDate(d, { weekday: 'long', month: 'short', day: 'numeric' })) + '</div>' + rows.map(function (r) { return r.html; }).join('');
    }
    return html || '<div class="empty">' + (groups.length ? 'Nothing in the next two weeks.' : 'Set the posting schedule below: the queue then shows the free slots to fill.') + '</div>';
  }
  /* suggested times: our own results, per platform, weekday and hour (engagement over reach), at least two posts a cell */
  function suggestTimes() {
    var out = {}; var by = {};
    S.social.forEach(function (sp) {
      if (!sp.published_at || PORDER.indexOf(sp.platform) < 0) return;
      var d = new Date(sp.published_at), wd = (d.getDay() + 6) % 7, h = d.getHours();
      var base = Number(sp.reach || sp.views || 0), eng = Number(sp.engagement || (Number(sp.likes || 0) + Number(sp.comments || 0) * 2 + Number(sp.shares || 0) * 3 + Number(sp.saves || 0) * 2));
      if (!base) return;
      var k = sp.platform + '|' + wd + '|' + h; (by[k] = by[k] || { pl: sp.platform, wd: wd, h: h, n: 0, rate: 0 }); by[k].n++; by[k].rate += eng / base;
    });
    Object.keys(by).forEach(function (k) { var c = by[k]; if (c.n < 2) return; c.rate = c.rate / c.n; (out[c.pl] = out[c.pl] || []).push(c); });
    Object.keys(out).forEach(function (pl) { out[pl].sort(function (a, b) { return b.rate - a.rate; }); out[pl] = out[pl].slice(0, 3); });
    return out;
  }
  function schedHtml() {
    var mk = S.mk, sug = S.suggest;
    var head = '<div class="sched"><div></div>' + WD.map(function (d) { return '<div class="h">' + d + '</div>'; }).join('');
    var body = PORDER.map(function (k) {
      return '<div class="pn">' + mark(k) + E(PLX[k][0]) + '</div>' + WD.map(function (d, wd) {
        var list = slots().filter(function (s) { return s.platform === k && Number(s.weekday) === wd; }).sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
        var sl = (sug && sug[k] || []).filter(function (c) { return c.wd === wd && !list.some(function (s) { return Number(String(s.at).slice(0, 2)) === c.h; }); });
        return '<div class="c">' + list.map(function (s) { return '<span class="t">' + E(String(s.at).slice(0, 5)) + (mk ? '<a data-w225slotx="' + s.id + '" title="Remove">✕</a>' : '') + '</span>'; }).join('') + sl.map(function (c) { return '<span class="t sug" title="Suggested from our results: ' + Math.round(c.rate * 1000) / 10 + '% engagement over ' + c.n + ' posts">' + pad(c.h) + ':00' + (mk ? '<a data-w225sugadd="' + k + '|' + c.wd + '|' + pad(c.h) + ':00" title="Add it">+</a>' : '') + '</span>'; }).join('') + '</div>';
      }).join('');
    }).join('');
    var add = mk ? '<div class="row" style="margin-top:12px"><select id="w225spl"><option value="all">Every platform</option>' + PORDER.map(function (k) { return '<option value="' + k + '">' + E(PLX[k][0]) + '</option>'; }).join('') + '</select>' +
      '<span class="seg" id="w225swd">' + WD.map(function (d, i) { return '<a data-w225swd="' + i + '" class="' + ((S.keys.swd || []).indexOf(i) >= 0 ? 'on' : '') + '">' + d + '</a>'; }).join('') + '</span><input type="time" id="w225sat" value="' + E(S.keys.sat || '18:00') + '"><a class="btn225 sm pri" data-w225slotadd="1">' + I('plus') + ' Add the time</a><span class="sp"></span><a class="btn225 sm" data-w225sug="1">' + I('bolt') + (sug ? ' Hide the suggestions' : ' Suggest times from our results') + '</a></div>' : '';
    return head + body + '</div>' + add + (sug ? '<p class="muted" style="margin:8px 0 0">Dashed times are the hours our own posts did best (engagement over reach, the last year, at least two posts). ' + (Object.keys(sug).length ? '' : 'Not enough posts yet to suggest anything.') + '</p>' : '');
  }
  function goalsHtml() {
    var g = goals(), mk = S.mk;
    return '<div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' + PORDER.map(function (k) { return '<label style="display:flex;align-items:center;gap:8px;font-size:12.5px">' + mark(k) + '<span style="flex:1">' + E(PLX[k][0]) + '</span><input type="number" min="0" max="21" data-w225goal="' + k + '" value="' + E(g[k] != null ? g[k] : 0) + '" style="width:64px"' + (mk ? '' : ' disabled') + '> a week</label>'; }).join('') + '</div>' + (mk ? '<div class="row" style="margin-top:10px"><span class="sp"></span><a class="btn225 sm pri" data-w225goalsave="1">Save the goals</a></div>' : '');
  }
  function gridHtml() {
    var ig = S.social.filter(function (sp) { return sp.platform === 'instagram' && (sp.kind || '').toLowerCase().indexOf('story') < 0; }).slice(0, 12);
    var next = posts().filter(function (p) { return (p.platforms || []).indexOf('instagram') >= 0 && p.scheduled_at && new Date(p.scheduled_at).getTime() > Date.now() && ['draft', 'scheduled'].indexOf(p.status) >= 0 && (((p.variants || {}).instagram || {}).kind || 'feed') !== 'story'; }).sort(function (a, b) { return String(b.scheduled_at).localeCompare(String(a.scheduled_at)); }).slice(-6);
    var cells = next.map(function (p) { var th = thumbOf(p); return '<div class="next" data-w225open="' + p.id + '" title="' + E(titleOf(p) + ' · ' + niceWhen(p.scheduled_at)) + '">' + (th ? '<img src="' + E(th) + '" alt="">' : '') + '<span>' + E(niceDate(dayOf(p.scheduled_at), { month: 'short', day: 'numeric' })) + '</span></div>'; })
      .concat(ig.map(function (sp) { var u = sp.thumb_cached || sp.thumb_url; return '<div>' + (u ? '<img src="' + E(u) + '" alt="" loading="lazy">' : '') + '</div>'; })).slice(0, 12);
    return cells.length ? '<div class="igg">' + cells.join('') + '</div><p class="muted" style="margin:8px 0 0">Planned posts (outlined, newest first) in front of the last ones on @welfareavenue: how the profile will look.</p>' : '<div class="empty">No Instagram posts yet.</div>';
  }
  function queueHtml() {
    return '<div class="grid2"><div><div class="card"><h3>' + I('cal') + ' The next two weeks <small>planned posts and free slots</small><span class="sp"></span><a class="btn225 sm pri" data-w225new="1">' + I('plus') + ' New post</a></h3>' + queueHtml14() + '</div></div><div>' +
      '<div class="card"><h3>' + I('bolt') + ' Weekly goals</h3>' + goalsHtml() + '</div>' +
      '<div class="card"><h3>' + I('eye') + ' Instagram grid</h3>' + gridHtml() + '</div></div></div>' +
      '<div class="card"><h3>' + I('clock') + ' Posting schedule <small>times in Toronto; Next in the queue in the composer uses them</small></h3>' + schedHtml() + '</div>';
  }
  async function addSlots(pls, wds, at) {
    var rows = []; pls.forEach(function (k) { wds.forEach(function (wd) { if (!slots().some(function (s) { return s.platform === k && Number(s.weekday) === wd && String(s.at).slice(0, 5) === at; })) rows.push({ platform: k, weekday: wd, at: at, created_by: myName() || 'staff' }); }); });
    if (!rows.length) { toastS('Those times are already in the schedule'); return; }
    var r = await db.from('content_slots').insert(rows); if (r.error) throw r.error;
    var w = W(); if (w) await w.studio(); toastS(rows.length === 1 ? 'Added' : rows.length + ' times added');
  }
