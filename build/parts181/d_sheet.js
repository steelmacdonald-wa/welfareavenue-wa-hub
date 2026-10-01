
  /* ---------- a person's sheet ---------- */
  function personBy(key) { return A.rows.filter(function (p) { return p.person_key === key; })[0]; }
  function openPerson(key) {
    var p = personBy(key); if (!p || typeof openModal !== 'function') return;
    var acc = acctsOf(p).sort(function (a, b) { return String(a.claimed_on || a.created_on || '').localeCompare(String(b.claimed_on || b.created_on || '')); });
    var opts = function (sel) { return '<option value="">Not on the roster</option>' + A.roster.map(function (m) { return '<option value="' + m.id + '"' + (String(sel) === String(m.id) ? ' selected' : '') + '>' + E(m.name) + (m.active === false ? ' (left)' : '') + (m.department ? ' · ' + E(teamShort(m.department)) : '') + '</option>'; }).join(''); };
    var accHtml = acc.length ? acc.map(function (a) {
      var bits = [];
      bits.push(a.claimed_on ? 'Joined Slack ' + dayNice(a.claimed_on) : 'Invited ' + dayNice(a.created_on) + ', never joined');
      bits.push(a.deactivated_on ? 'switched off ' + dayNice(a.deactivated_on) : (a.claimed_on ? 'still on' : ''));
      bits.push(a.days_active + ' active days in the export');
      return '<div class="acc" data-w181acc="' + E(a.slack_id) + '"><b>' + E(a.full_name) + '</b> <span style="color:' + MUTED + '">' + E(a.email || '') + ' · ' + E(a.account_type) + '</span>' +
        (a.link_by === 'name' ? ' <span class="w181tag warn">linked by first name</span>' : '') + (a.kind === 'external' ? ' <span class="w181tag">not a team member</span>' : '') +
        '<div style="color:' + MUTED + ';font-size:12.5px">' + E(bits.filter(Boolean).join(' · ')) + (a.title ? ' · “' + E(a.title) + '”' : '') + '</div>' +
        '<div class="row"><label style="font-size:12px;font-weight:700">Roster person <select data-w181m="' + E(a.slack_id) + '">' + opts(a.team_member_id) + '</select></label>' +
        '<label style="font-size:12px;font-weight:700"><input type="checkbox" data-w181x="' + E(a.slack_id) + '"' + (a.kind === 'external' ? ' checked' : '') + '> Not a team member (a consultant, a guest)</label>' +
        '<button class="w181btn sm" data-w181save="' + E(a.slack_id) + '">Save</button></div></div>';
    }).join('') : '<p style="font-size:13px;color:' + MUTED + '">No Slack account found for them. Their start date comes from the roster.</p>';
    var m = tenureOf(p);
    openModal('<div class="w181sheet"><h3>' + E(p.name) + '</h3><p class="sub">' + E([p.title, p.department ? teamName(p.department) : (p.on_roster ? '' : 'Not on the roster')].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="facts"><div><small>Status</small>' + statusTag(p) + '</div><div><small>Started</small>' + E(p.started_on ? dayNice(p.started_on) : 'not known') + (p.started_on ? '<br><span style="font-size:11.5px;color:' + MUTED + '">' + E(p.joined_slack && p.started_on === p.joined_slack ? 'joined Slack' : (p.start_source === 'manual' ? 'set by HR' : 'Workspace account')) + '</span>' : '') + '</div>' +
      '<div><small>Left</small>' + E(leftCell(p) || (p.status === 'current' ? 'still here' : '')) + '</div><div><small>Time with us</small>' + E(m == null ? 'not known' : timeCell(p)) + '</div></div>' +
      '<b style="font-size:13px;color:' + GREEN + '">Slack accounts</b>' + accHtml + '<p class="err" id="w181serr"></p>' +
      '<div class="foot">' + (p.team_member_id ? '<a class="w181btn ghost sm" href="#person/' + p.team_member_id + '">Open their profile</a>' : '') + '<button class="w181btn ghost sm" data-w181="close">Close</button></div></div>');
  }
  async function saveLink(id) {
    var sel = document.querySelector('[data-w181m="' + id + '"]'), x = document.querySelector('[data-w181x="' + id + '"]'), err = document.getElementById('w181serr');
    var btn = document.querySelector('[data-w181save="' + id + '"]'); if (btn) btn.disabled = true;
    try {
      var r = await db.rpc('wa181_link', { p_slack_id: id, p_member: sel && sel.value ? Number(sel.value) : null, p_kind: x && x.checked ? 'external' : 'team' });
      if (r && r.error) throw r.error;
      T('Saved'); if (typeof closeModal === 'function') closeModal();
      await load(true); paint();
    } catch (e) { if (err) err.textContent = 'Could not save: ' + ((e && e.message) || e); if (btn) btn.disabled = false; }
  }

  /* ---------- the CSV ---------- */
  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadCsv() {
    var head = ['Name', 'Team', 'Title', 'Status', 'On the roster', 'Started', 'Left by', 'Months with us', 'Slack accounts', 'Slack active days (export)', 'Notes'];
    var lines = [head.join(',')].concat(filtered().map(function (p) {
      return [p.name, p.department ? teamName(p.department) : '', p.title || '', p.status, p.on_roster ? 'yes' : 'no', p.started_on || '', p.left_by || '', tenureOf(p) == null ? '' : tenureOf(p), p.accounts, p.days_active, flags(p).map(function (f) { return f[0]; }).join('; ')].map(csvCell).join(',');
    }));
    try {
      var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }); var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = todayIso().split('-').reverse().map(function (x, i) { return i === 2 ? x.slice(2) : x; }).join('-') + ' - Welfare Avenue people and tenure.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { T('Could not make the file'); }
  }

  /* ---------- importing a new export ---------- */
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false, i = 0, c;
    text = String(text || '').replace(/^﻿/, '');
    for (; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r[0] || '').trim(); });
  }
  function slackDay(s) {   /* "Jan 8, 2025" */
    s = String(s || '').trim(); if (!s) return null; var m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/); if (!m) return null;
    var mi = MON.indexOf(m[1].charAt(0).toUpperCase() + m[1].slice(1, 3).toLowerCase()); if (mi < 0) return null;
    return m[3] + '-' + String(mi + 1).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
  }
  function fromExport(text) {
    var rows = parseCsv(text); if (rows.length < 2) return { err: 'The file has no rows.' };
    var h = rows[0].map(function (x) { return x.trim(); }), ix = function (n) { return h.indexOf(n); };
    var need = ['Name', 'User ID', 'Account type', 'Account created (UTC)', 'Days active'];
    var miss = need.filter(function (n) { return ix(n) < 0; }); if (miss.length) return { err: 'This does not look like Slack’s Member Analytics export (missing ' + miss.join(', ') + ').' };
    var g = function (r, n) { var k = ix(n); return k < 0 ? '' : (r[k] || '').trim(); }, num = function (v) { var x = parseInt(String(v).replace(/[^\d]/g, ''), 10); return isNaN(x) ? 0 : x; };
    var out = rows.slice(1).map(function (r) {
      return { slack_id: g(r, 'User ID'), full_name: g(r, 'Name') || g(r, 'Display name'), display_name: g(r, 'Display name'), email: lower(g(r, 'Email')), title: g(r, 'What I Do'), account_type: g(r, 'Account type'),
        created_on: slackDay(g(r, 'Account created (UTC)')), claimed_on: slackDay(g(r, 'Claimed Date (UTC)')), deactivated_on: slackDay(g(r, 'Deactivated date (UTC)')),
        days_active: num(g(r, 'Days active')), messages: num(g(r, 'Messages posted')), channel_messages: num(g(r, 'Messages posted in channels')), reactions: num(g(r, 'Reactions added')) };
    }).filter(function (r) { return /^[UW][A-Z0-9]{6,}$/.test(r.slack_id) && r.full_name; });
    return { rows: out };
  }
  function windowFromName(name) {   /* "Welfare Avenue Member Analytics Aug 29 2025 - Sep 29 2026.csv" */
    var m = String(name || '').match(/([A-Za-z]{3}) (\d{1,2}),? (\d{4})\s*-\s*([A-Za-z]{3}) (\d{1,2}),? (\d{4})/); if (!m) return null;
    return { from: slackDay(m[1] + ' ' + m[2] + ', ' + m[3]), to: slackDay(m[4] + ' ' + m[5] + ', ' + m[6]) };
  }
  function openImport() {
    if (typeof openModal !== 'function') return; A.imp = null;
    openModal('<div class="w181sheet"><h3>Import a new Slack export</h3><p class="sub">In Slack: Tools and settings, Workspace settings, Analytics, Members, then Export to CSV (all members, the dates you want). The Hub keeps each account’s links and updates its dates and activity; new accounts are matched to the roster by email. Earlier Slack join days become start dates (never over one HR set).</p>' +
      '<label class="f" for="w181file">The CSV file</label><input type="file" id="w181file" accept=".csv,text/csv">' +
      '<div id="w181impmore" style="display:none"><label class="f">The dates the export covers</label><input type="date" id="w181ifrom"> to <input type="date" id="w181ito"><p id="w181isum" style="font-size:13px;margin:10px 0 0"></p></div>' +
      '<p class="err" id="w181ierr"></p><div class="foot"><button class="w181btn ghost sm" data-w181="close">Cancel</button><button class="w181btn sm" data-w181="doimport" disabled>Import</button></div></div>');
  }
  function readImportFile(f) {
    var err = document.getElementById('w181ierr'), more = document.getElementById('w181impmore'), go = document.querySelector('[data-w181="doimport"]');
    if (!f) return; if (err) err.textContent = '';
    var rd = new FileReader();
    rd.onload = function () {
      var x = fromExport(rd.result); if (x.err) { if (err) err.textContent = x.err; if (go) go.disabled = true; return; }
      A.imp = x.rows; var w = windowFromName(f.name) || {};
      document.getElementById('w181ifrom').value = w.from || ''; document.getElementById('w181ito').value = w.to || '';
      var known = {}; A.accts.forEach(function (a) { known[a.slack_id] = 1; });
      var nw = x.rows.filter(function (r) { return !known[r.slack_id]; }).length;
      document.getElementById('w181isum').textContent = plural(x.rows.length, 'account') + ' in the file: ' + plural(nw, 'new one') + ', ' + (x.rows.length - nw) + ' already in the Hub.' + (w.from ? '' : ' Fill in the dates the export covers.');
      if (more) more.style.display = ''; if (go) go.disabled = false;
    };
    rd.onerror = function () { if (err) err.textContent = 'Could not read the file.'; };
    rd.readAsText(f);
  }
  async function doImport() {
    var err = document.getElementById('w181ierr'), go = document.querySelector('[data-w181="doimport"]');
    var f = (document.getElementById('w181ifrom') || {}).value, t = (document.getElementById('w181ito') || {}).value;
    if (!A.imp || !A.imp.length) { if (err) err.textContent = 'Pick the file first.'; return; }
    if (!f || !t || t < f) { if (err) err.textContent = 'Fill in the dates the export covers (from, then to).'; return; }
    if (go) go.disabled = true;
    try {
      var r = await db.rpc('wa181_import', { rows: A.imp, p_from: f, p_to: t }); if (r && r.error) throw r.error;
      var d = (r && r.data) || {}; A.imp = null; if (typeof closeModal === 'function') closeModal();
      T('Imported: ' + (d['new'] || 0) + ' new, ' + (d.updated || 0) + ' updated, ' + plural(d.start_dates || 0, 'start date') + ' filled in');
      await load(true); paint();
    } catch (e) { if (err) err.textContent = 'Could not import: ' + ((e && e.message) || e); if (go) go.disabled = false; }
  }
