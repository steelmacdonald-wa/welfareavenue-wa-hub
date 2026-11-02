
  /* ---------- the grid: a key names it, 'p<flow>' on the picker and 'a<flow>' on a change panel ---------- */
  function gridOf(key) { var id = String(key).slice(1); var o = key.charAt(0) === 'p' ? S.pick[id] : S.act[id]; return o && o.g; }
  function newGrid(key, pv, mode) {
    var g = { key: key, pv: pv, mode: mode, vals: { call: '', one: '' }, hideManager: false, days: [], rows: [] };
    var slots = (pv.grids && (pv.grids.hire || []).concat(pv.grids.manager || [])) || [];
    /* walk the instants and read each one on the Toronto clock: a clock change takes care of itself */
    var cfg = S.cfg, step = cfg.cell * 60000, now = Date.now(), t = Math.ceil(now / step) * step, last = now + cfg.days * 86400000;
    slots.forEach(function (x) { var ms = Date.parse(x); if (ms > last) last = ms + step; });
    var byDate = {}, rows = {};
    for (; t < last; t += step) {
      var w = wall(t);
      if (w.mins < cfg.start * 60 || w.mins + cfg.cell > cfg.end * 60) continue;
      if (!byDate[w.date]) { byDate[w.date] = { date: w.date, at: t, cells: {} }; g.days.push(byDate[w.date]); }
      byDate[w.date].cells[w.mins] = t;
      rows[w.mins] = true;
    }
    g.rows = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    g.hire = setOf(pv.grids && pv.grids.hire); g.manager = setOf(pv.grids && pv.grids.manager);
    g.events = (pv.hub_events || []).map(function (e) { return { from: Date.parse(e.start_at), to: Date.parse(e.end_at), who: e.who || [], summary: e.summary || 'A meeting' }; });
    return g;
  }
  function setOf(a) { var o = {}; (a || []).forEach(function (x) { o[Date.parse(x)] = true; }); return o; }
  function clashes(g, ms, mode) {
    var end = ms + S.cfg.cell * 60000;
    return g.events.filter(function (e) { return e.from < end && e.to > ms && (mode === 'one' ? (e.who.indexOf('hire') >= 0 || (e.who.indexOf('manager') >= 0 && !g.hideManager)) : e.who.indexOf('hire') >= 0); });
  }
  function rowLabel(mins) { var h = Math.floor(mins / 60), mi = mins % 60; return (h % 12 || 12) + ':' + pad2(mi) + (h < 12 ? ' am' : ' pm'); }
  function dayHead(d) {
    var at = new Date(d.at);
    return E(at.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' })) + '<br>' + E(at.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }));
  }
  function tableHtml(g) {
    var call = toInstant(g.vals.call), one = toInstant(g.vals.one);
    var h = '<table class="o271g"><thead><tr><th></th>' + g.days.map(function (d) { return '<th>' + dayHead(d) + '</th>'; }).join('') + '</tr></thead><tbody>';
    g.rows.forEach(function (mins) {
      h += '<tr><th>' + E(rowLabel(mins)) + '</th>';
      g.days.forEach(function (d) {
        var t = d.cells[mins];
        if (t == null) { h += '<td></td>'; return; }
        var cl = ['o271c'], bits = [whenText(t)];
        if (g.hire[t]) { cl.push('h'); bits.push('the new hire marked this'); }
        if (g.mode === 'one' && !g.hideManager && g.manager[t]) { cl.push('m'); bits.push('the manager marked this'); }
        var busy = clashes(g, t, g.mode);
        if (busy.length) { cl.push('busy'); bits.push('in a meeting: ' + busy.map(function (e) { return e.summary; }).join(', ')); }
        var label = '';
        if (t === call) { cl.push('scall'); label = 'Call'; } else if (t === one) { cl.push('sone'); label = '1-1'; }
        h += '<td><button type="button" class="' + cl.join(' ') + '" data-o271cell="' + E(new Date(t).toISOString()) + '" data-g="' + E(g.key) + '" title="' + E(bits.join('; ')) + '" aria-label="' + E(bits.join('; ')) + '">' + label + '</button></td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }
  function legendHtml(g) {
    return '<div class="o271lg"><span><i style="background:rgba(16,63,57,.30)"></i>New hire marked</span>'
      + (g.mode === 'one' && !g.hideManager ? '<span><i style="background:rgba(111,100,171,.34)"></i>Manager marked</span><span><i style="background:' + GREEN + '"></i>Both</span>' : '')
      + '<span><i style="background:repeating-linear-gradient(45deg,#C9C8C1,#C9C8C1 3px,#E6E5DE 3px,#E6E5DE 6px)"></i>In a meeting</span><span>Toronto time</span></div>';
  }
  function gridHtml(g) {
    if (!g.days.length) return '';
    return '<div data-o271lg="' + E(g.key) + '">' + legendHtml(g) + '</div><div class="o271gw" data-o271grid="' + E(g.key) + '">' + tableHtml(g) + '</div>';
  }
  function refreshGrid(g) {
    var box = document.querySelector('[data-o271grid="' + g.key + '"]'); if (box) box.innerHTML = tableHtml(g);   /* the box keeps its scroll on a phone */
    var lg = document.querySelector('[data-o271lg="' + g.key + '"]'); if (lg) lg.innerHTML = legendHtml(g);
  }
  function saidHtml(g, mode) {
    var v = g.vals[mode]; if (!v) return { text: mode === 'call' ? 'Not picked yet' : 'Not picked: it can be booked later', cl: '' };
    var ms = toInstant(v); if (ms == null) return { text: 'That time does not exist on the Toronto clock. Pick another.', cl: 'cl' };
    var busy = clashes(g, ms, mode);
    return { text: whenText(ms) + (busy.length ? '. Clashes with ' + busy.map(function (e) { return e.summary; }).join(', ') : ''), cl: busy.length ? 'cl' : '' };
  }

  /* ---------- the picker and preview ---------- */
  function memberOptions(chosen) {
    return '<option value="">Choose a manager...</option>' + S.people.filter(function (p) { return p.active !== false; }).map(function (p) { return '<option value="' + E(p.id) + '"' + (String(p.id) === String(chosen) ? ' selected' : '') + '>' + E(p.name) + '</option>'; }).join('');
  }
  function startBlock(P) {
    var addr = String(P.addr || '').trim().toLowerCase(), googleOn = !P.skip.google, g = P.g;
    if (!g.vals.call) return 'Pick a time for the onboarding call.';
    if (toInstant(g.vals.call) == null) return 'That call time does not exist on the Toronto clock. Pick another.';
    if (g.vals.one && toInstant(g.vals.one) == null) return 'That 1-on-1 time does not exist on the Toronto clock. Pick another.';
    if (!P.managerId) return 'Choose a manager.';
    if (addr && !ADDR.test(addr)) return 'The new address must be a plain address ending in @welfareavenue.com.';
    if (!addr && googleOn) return 'Type the new address, or turn off the Google account step.';
    if (googleOn && P.takenAddr && P.takenAddr === addr) return addr + ' is already in use. Change the address, or turn off the Google account step.';
    return '';
  }
  function saidBlock(g, mode) { var s = saidHtml(g, mode); return '<div class="o271said ' + s.cl + '" data-o271said="' + mode + '">' + E(s.text) + '</div>'; }
  function pickHtml(x, P) {
    var id = x.flow_id, pv = P.pv, g = P.g, block = startBlock(P);
    var welcomeStep = (pv.steps || []).filter(function (s) { return s.key === 'welcome'; })[0];
    var h = '<div class="o271pn">' + (pv.warnings || []).map(warnBox).join('')
      + '<h3 class="o271h">1. The times</h3>'
      + '<div class="o271md" role="group" aria-label="Which meeting you are picking"><button type="button" class="' + (g.mode === 'call' ? 'on' : '') + '" data-o271a="mode" data-mode="call" data-f="' + E(id) + '">Onboarding call</button><button type="button" class="' + (g.mode === 'one' ? 'on' : '') + '" data-o271a="mode" data-mode="one" data-f="' + E(id) + '">1-on-1</button></div>'
      + (g.hideManager ? '<div class="o271ln">The grid does not show the manager you just chose: these marks are the other manager\'s.</div>' : '')
      + gridHtml(g)
      + '<div class="o271two"><div><label class="o271f">Onboarding call (Toronto time)</label><input type="datetime-local" data-o271i="call" data-f="' + E(id) + '" value="' + E(g.vals.call) + '">' + saidBlock(g, 'call') + '</div>'
      + '<div><label class="o271f">1-on-1 with the manager (Toronto time, optional)</label><input type="datetime-local" data-o271i="one" data-f="' + E(id) + '" value="' + E(g.vals.one) + '">' + saidBlock(g, 'one') + '</div></div>'
      + '<h3 class="o271h">2. The preview</h3>'
      + '<div class="o271two"><div><label class="o271f">New address</label><input type="text" autocomplete="off" data-o271i="addr" data-f="' + E(id) + '" value="' + E(P.addr) + '"></div>'
      + '<div><label class="o271f">Manager</label><select data-o271i="mgr" data-f="' + E(id) + '">' + memberOptions(P.managerId) + '</select><div class="o271said" data-o271said="rule">' + E(ruleLine(P)) + '</div></div></div>'
      + '<label class="o271f">Group session (leave blank to leave the line out)</label><input type="text" data-o271i="group" data-f="' + E(id) + '" value="' + E(P.group) + '">'
      + '<label class="o271f">Welcome email: subject</label><input type="text" style="max-width:none" data-o271i="subj" data-f="' + E(id) + '" value="' + E(P.subject) + '">'
      + '<label class="o271f">Welcome email: text</label><textarea data-o271i="text" data-f="' + E(id) + '">' + E(P.text) + '</textarea>'
      + (welcomeStep && welcomeStep.mode === 'hr_task' ? '<div class="o271ln"><b>HR sends this one for now.</b> The Hub saves your edits and leaves it as a to-do on the card.</div>' : '')
      + '<h3 class="o271h">3. The steps that will run</h3>'
      + (pv.steps || []).map(function (s) {
          var locked = s.key === 'roster', word = s.mode === 'hr_task' ? 'HR does this one' : s.mode === 'practice' ? 'Practice: nothing real changes' : 'The Hub does this';
          return '<label class="o271sw"><input type="checkbox" data-o271skip="' + E(s.key) + '" data-f="' + E(id) + '"' + (P.skip[s.key] ? '' : ' checked') + (locked ? ' disabled' : '') + '> ' + E(s.label) + ' <small>' + E(word) + (locked ? '. Every other step needs it.' : '') + '</small></label>';
        }).join('')
      + (P.err ? '<div class="o271err">' + E(P.err) + '</div>' : '')
      + '<div class="o271said cl" data-o271said="block">' + E(block) + '</div>'
      + '<div class="o271btns"><button type="button" class="o271b pri" data-o271a="start" data-f="' + E(id) + '"' + (block || S.busy['s' + id] ? ' disabled' : '') + '>' + (S.busy['s' + id] ? 'Working through the steps...' : 'Start onboarding') + '</button></div>'
      + '</div>';
    return h;
  }
  function ruleLine(P) {
    if (!P.managerId) return RULE.none;
    if (String(P.managerId) === String(P.pv.manager && P.pv.manager.member_id)) return 'The Hub used: ' + (RULE[P.pv.manager.how] || P.pv.manager.how);
    return RULE.chosen;
  }
  /* an input changed: what depends on it, without redrawing what HR is typing in */
  function liveUpdate(id) {
    var P = S.pick[id]; if (!P) return;
    var root = document.querySelector('[data-o271flow="' + id + '"]'); if (!root) return;
    ['call', 'one'].forEach(function (m) { var el = root.querySelector('[data-o271said="' + m + '"]'); if (el) { var s = saidHtml(P.g, m); el.textContent = s.text; el.className = 'o271said ' + s.cl; } });
    var rule = root.querySelector('[data-o271said="rule"]'); if (rule) rule.textContent = ruleLine(P);
    var block = startBlock(P), bl = root.querySelector('[data-o271said="block"]'); if (bl) bl.textContent = block;
    var b = root.querySelector('[data-o271a="start"]'); if (b && !S.busy['s' + id]) b.disabled = !!block;
  }
  async function openPick(x) {
    var id = x.flow_id;
    if (S.pick[id]) { delete S.pick[id]; paint(); return; }
    S.busy['o' + id] = true; delete S.note[id]; paint();
    try {
      var pv = await run('preview', { flow_id: id });
      var g = newGrid('p' + id, pv, 'call');
      if (x.call_at) g.vals.call = toLocal(x.call_at);
      if (x.one_on_one_at) g.vals.one = toLocal(x.one_on_one_at);
      S.pick[id] = { pv: pv, g: g, addr: pv.address || '', managerId: (pv.manager && pv.manager.member_id) || '', group: '', subject: (pv.welcome && pv.welcome.subject) || '', text: (pv.welcome && pv.welcome.text) || '', skip: {}, takenAddr: pv.address_taken ? String(pv.address || '').toLowerCase() : '', err: '' };
    } catch (e) { S.note[id] = { err: e.message }; }
    delete S.busy['o' + id]; paint();
  }
  /* the address changed: ask again. Only the warnings and the clash change; what HR typed stays */
  async function recheckAddress(id) {
    var P = S.pick[id]; if (!P) return;
    var addr = String(P.addr || '').trim().toLowerCase(); P.addr = addr;
    if (!ADDR.test(addr)) { liveUpdate(id); return; }
    try {
      var pv = await run('preview', { flow_id: Number(id), wa_email: addr });
      if (!S.pick[id] || String(S.pick[id].addr).trim().toLowerCase() !== addr) return;
      P.pv.warnings = pv.warnings; P.pv.address_taken = pv.address_taken;
      P.takenAddr = pv.address_taken ? addr : '';
      paint();
    } catch (e) { P.err = e.message; paint(); }
  }
  async function start(id) {
    var P = S.pick[id], x = S.ready.filter(function (r) { return String(r.flow_id) === String(id); })[0];
    if (!P || !x || S.busy['s' + id] || startBlock(P)) return;
    S.busy['s' + id] = true; P.err = ''; paint();
    var body = {
      flow_id: Number(id), wa_email: String(P.addr || '').trim().toLowerCase(), manager_member_id: Number(P.managerId), call_at: isoOf(P.g.vals.call),
      one_on_one_at: P.g.vals.one ? isoOf(P.g.vals.one) : null, group_session: P.group || null,
      skip: Object.keys(P.skip).filter(function (k) { return P.skip[k]; })
    };
    var w0 = P.pv.welcome || {};
    if (P.subject !== (w0.subject || '') || P.text !== (w0.text || '')) body.welcome = { subject: P.subject, text: P.text };   /* an untouched email stays the Hub's own */
    try {
      await run('start', body);
      delete S.pick[id];
      delete S.busy['s' + id];
      await load();
      toast('Onboarding started');
    } catch (e) { delete S.busy['s' + id]; P.err = e.message; toast(e.message); paint(); }
  }
