#!/usr/bin/env python3
"""wave136 (26/09/26): content ideas from marketing meetings, in the page.

- Content calendar (121): an idea in the bank is out of the calendar; an idea from a meeting shows where it came
  from, who raised it and what it is for (tray, list and the composer, with Open the meeting); an undated idea can
  be put in the bank from the composer (bank_idea, with Undo); the tray links to what waits in the bank.
- Upload preview (065): a Marketing meeting lists the content ideas it will add.
- The bank page (parts132): content ideas (Marketing) with Bring back now and New date; counts and the team card.
- Tours (parts122, parts132): the Content calendar's Ideas step and the bank's How it works.
Each edit is an exact replacement with an expected count. Run once from the repo root, then re-assemble
parts122 and parts132.
Applied on 26/09/26. Two of the 121 edits (the list row's cap2 line and the tray's heading) were written with a
leading quote the source does not have; they were applied by hand with the quote dropped, so the sources are the record.
"""
import os
import sys

B = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'build')

EDITS = [
    # ---------------- 121: styles ----------------
    ('src/121_wave121.seg',
     "    '#contentcal .tray .empty{font-size:12px;color:var(--wa-muted);text-align:center;padding:16px 6px;border:1px dashed rgba(16,63,57,.2);border-radius:10px;}' +\n",
     "    '#contentcal .tray .empty{font-size:12px;color:var(--wa-muted);text-align:center;padding:16px 6px;border:1px dashed rgba(16,63,57,.2);border-radius:10px;}' +\n"
     "    /* wave136: ideas from meetings, and the bank */\n"
     "    '#contentcal .tr em{display:block;font-style:normal;font-size:10.5px;color:' + GREEN + ';opacity:.85;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +\n"
     "    '#contentcal .tr em i,#contentcal .lr .src i{font-style:normal;background:rgba(220,165,39,.25);color:#6b4d05;border-radius:999px;padding:0 6px;margin-right:4px;}' +\n"
     "    '#contentcal .tray .bnk{display:block;text-align:center;font-size:11.5px;margin-top:8px;color:' + GREEN + ';font-weight:600;text-decoration:underline;cursor:pointer;}' +\n"
     "    '#contentcal .lr .src{font-size:11px;color:' + GREEN + ';opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +\n"
     "    '#w121dr .w136src{background:rgba(220,165,39,.12);border:1px solid rgba(220,165,39,.35);border-radius:12px;padding:9px 12px;margin:0 0 12px;font-size:12.5px;line-height:1.45;}' +\n"
     "    '#w121dr .w136src a{color:' + GREEN + ';font-weight:600;cursor:pointer;}' +\n"
     "    '#w121dr .w136bank{border:1px solid rgba(16,63,57,.15);border-radius:12px;padding:10px 12px;margin:0 0 12px;background:#FFFAF2;}' +\n"
     "    '#w121dr .w136bank label{display:block;font-size:12.5px;font-weight:700;margin:0 0 4px;color:' + GREEN + ';}' +\n"
     "    '#w121dr .w136bank p{font-size:11.5px;color:var(--wa-muted);margin:0 0 8px;line-height:1.4;}' +\n"
     "    '#w121dr .w136bank .r2{display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px;margin-bottom:8px;}' +\n"
     "    '#w121dr .w136bank .ac{display:flex;gap:8px;justify-content:flex-end;}' +\n"
     "    '@media (max-width:520px){#w121dr .w136bank .r2{grid-template-columns:minmax(0,1fr);}}' +\n",
     1),
    # ---------------- 121: loading splits the bank out ----------------
    ('src/121_wave121.seg',
     "      C.posts = (r.data || []).map(function (p) { p.platforms = p.platforms || []; p.media = p.media || []; p.results = p.results || {}; p.live = p.live || {}; return p; });\n",
     "      var all121 = (r.data || []).map(function (p) { p.platforms = p.platforms || []; p.media = p.media || []; p.results = p.results || {}; p.live = p.live || {}; return p; });\n"
     "      /* wave136: an idea in the bank is out of the calendar until its date (the bank page lists it) */\n"
     "      C.banked = all121.filter(function (p) { return !!p.banked_at; });\n"
     "      C.posts = all121.filter(function (p) { return !p.banked_at; });\n"
     "      loadSources();\n",
     1),
    ('src/121_wave121.seg',
     "  async function loadCap() {\n",
     "  /* wave136: the meeting each idea came from */\n"
     "  async function loadSources() {\n"
     "    try {\n"
     "      C.src = C.src || {}; var ids = [];\n"
     "      C.posts.concat(C.banked || []).forEach(function (p) { var s = p.source_transcript_id; if (s && !C.src[s] && ids.indexOf(s) < 0) ids.push(s); });\n"
     "      if (!ids.length) return;\n"
     "      var r = await db.from('transcripts').select('id, title, meeting_date').in('id', ids.slice(0, 200));\n"
     "      ((r && r.data) || []).forEach(function (x) { C.src[x.id] = { title: x.title || null, date: x.meeting_date || null }; });\n"
     "      ids.forEach(function (id) { if (!C.src[id]) C.src[id] = { title: null, date: null }; });\n"
     "      paint(); if (C.edit) paintDrawer();\n"
     "    } catch (e) { /* the ideas still show, without the meeting's name */ }\n"
     "  }\n"
     "  function srcOf(p) { if (!p || !p.source_transcript_id) return null; return (C.src && C.src[p.source_transcript_id]) || { title: null, date: null }; }\n"
     "  function shortDay(ds) { return niceDate(ds, String(ds).slice(0, 4) === today().slice(0, 4) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }); }\n"
     "  function ideaLine(p) {\n"
     "    var bits = [], s = srcOf(p);\n"
     "    if (p.resurfaced_at && (Date.now() - new Date(p.resurfaced_at).getTime()) < 14 * 86400000) bits.push('<i>Back from the bank</i>');\n"
     "    if (p.idea_for) bits.push('For ' + E(shortDay(p.idea_for)));\n"
     "    if (s) bits.push('From ' + (s.title ? E(s.title) : 'a meeting'));\n"
     "    else if (p.suggested_by) bits.push('Idea from ' + E(p.suggested_by));\n"
     "    return bits.join(' \\u00b7 ');\n"
     "  }\n"
     "  window.w121Stale = function () { C.at = 0; };\n"
     "  async function loadCap() {\n",
     1),
    # ---------------- 121: the week at a glance ----------------
    ('src/121_wave121.seg',
     "      '<div><b>' + ideas + '</b><span>ideas without a date</span></div>' +\n",
     "      '<div><b>' + ideas + '</b><span>ideas without a date' + (C.banked && C.banked.length ? ', ' + C.banked.length + ' more in the bank' : '') + '</span></div>' +\n",
     1),
    # ---------------- 121: list rows ----------------
    ('src/121_wave121.seg',
     ": 'No date<span>idea</span>')",
     ": 'No date<span>' + (p.idea_for ? 'for ' + E(shortDay(p.idea_for)) : 'idea') + '</span>')",
     1),
    ('src/121_wave121.seg',
     "'<div class=\"cap2\">' + E(p.caption || p.notes || '') + '</div>' + confLine(p, s)",
     "'<div class=\"cap2\">' + E(p.caption || p.notes || '') + '</div>' + (function () { var il = p.scheduled_at ? '' : ideaLine(p); return il ? '<div class=\"src\">' + il + '</div>' : ''; })() + confLine(p, s)",
     1),
    # ---------------- 121: the Ideas tray ----------------
    ('src/121_wave121.seg',
     "'<h4>Ideas</h4><p>Posts without a date. Drag one onto a day to plan it; drag a planned post here to take it off the calendar.</p>'",
     "'<h4>Ideas</h4><p>Posts without a date. Drag one onto a day to plan it; drag a planned post here to take it off the calendar. Ideas from marketing meetings land here too.</p>'",
     1),
    ('src/121_wave121.seg',
     "(p.platforms || []).map(function (k) { return PL[k] ? PL[k].label : k; }).join(', ') + '</span></div></div>'; }).join('') : '<div class=\"empty\">No ideas waiting.</div>') + (staff() ? '<button class=\"btn mini ghost\" style=\"width:100%;margin-top:6px\" data-w121new=\"idea\">New idea</button>' : '') + '</div>';",
     "(p.platforms || []).map(function (k) { return PL[k] ? PL[k].label : k; }).join(', ') + '</span>' + (function () { var il = ideaLine(p); return il ? '<em>' + il + '</em>' : ''; })() + '</div></div>'; }).join('') : '<div class=\"empty\">No ideas waiting.</div>') + (staff() ? '<button class=\"btn mini ghost\" style=\"width:100%;margin-top:6px\" data-w121new=\"idea\">New idea</button>' : '') + (C.banked && C.banked.length ? '<a class=\"bnk\" href=\"#bank/marketing\">' + C.banked.length + (C.banked.length === 1 ? ' idea waits' : ' ideas wait') + ' in the bank</a>' : '') + '</div>';",
     1),
    # ---------------- 121: the composer ----------------
    ('src/121_wave121.seg',
     "  function paintDrawer() {\n",
     "  /* wave136: where an idea came from, and putting it in the bank */\n"
     "  function ideaBox(e) {\n"
     "    var p = e && e.id ? C.posts.filter(function (x) { return String(x.id) === String(e.id); })[0] : null, h = '';\n"
     "    if (p && (p.source_transcript_id || p.idea_for || p.suggested_by)) {\n"
     "      var s = srcOf(p), bits = [];\n"
     "      if (p.source_transcript_id) bits.push('From the meeting <b>' + E((s && s.title) || 'a meeting') + '</b>' + (s && s.date ? ' (' + E(shortDay(s.date)) + ')' : ''));\n"
     "      if (p.suggested_by) bits.push((bits.length ? 'raised by ' : 'Raised by ') + E(p.suggested_by));\n"
     "      if (p.idea_for) bits.push((bits.length ? 'for ' : 'For ') + E(shortDay(p.idea_for)));\n"
     "      h += '<div class=\"w136src\">' + bits.join(', ') + '.' + (p.source_transcript_id ? ' <a href=\"#tx/' + E(p.source_transcript_id) + '\" data-w136tx=\"1\">Open the meeting</a>' : '') + '</div>';\n"
     "    }\n"
     "    if (e && e.bank) {\n"
     "      h += '<div class=\"w136bank\"><label>Put this idea in the bank</label><p>It leaves the calendar and comes back to the Ideas on the day you pick. The bank page lists it with the rest of the work that can wait.</p>'\n"
     "        + '<div class=\"r2\"><input type=\"date\" id=\"w136until\" value=\"' + E(e.bank.until) + '\" min=\"' + E(addDays(today(), 1)) + '\" aria-label=\"Comes back on\"><input type=\"text\" id=\"w136note\" maxlength=\"300\" placeholder=\"Why it waits (optional), such as For Giving Tuesday\" value=\"' + E(e.bank.note || '') + '\" aria-label=\"Why it waits\"></div>'\n"
     "        + '<div class=\"ac\"><button class=\"btn mini ghost\" data-w136bankx=\"1\">Cancel</button><button class=\"btn mini go\" data-w136bankgo=\"1\"' + (e.bank.busy ? ' disabled' : '') + '>Put it in the bank</button></div></div>';\n"
     "    }\n"
     "    return h;\n"
     "  }\n"
     "  function bankErr(x) {\n"
     "    var m = String((x && (x.message || x.details)) || x || '');\n"
     "    if (/staff only/i.test(m)) return 'Your access can plan posts but not move ideas to the bank.';\n"
     "    if (/after today/i.test(m)) return 'Pick a day after today.';\n"
     "    if (/three years/i.test(m)) return 'Pick a day in the next three years.';\n"
     "    if (/without a date/i.test(m)) return 'Only an idea without a date can go in the bank.';\n"
     "    return 'Could not put it in the bank: ' + m;\n"
     "  }\n"
     "  async function bankIdea() {\n"
     "    var ed = C.edit; if (!ed || !ed.bank || !ed.id) return;\n"
     "    var u = document.getElementById('w136until'), n = document.getElementById('w136note');\n"
     "    if (u) ed.bank.until = u.value; if (n) ed.bank.note = n.value;\n"
     "    if (!ed.bank.until || ed.bank.until <= today()) { toastS('Pick a day after today'); return; }\n"
     "    if (ed.dirty) { try { readForm(); await saveRow(ed.id, rowFromEdit(ed)); ed.dirty = false; } catch (x) { toastS('Could not save the idea first: ' + (x.message || x)); return; } }\n"
     "    ed.bank.busy = true; paintDrawer();\n"
     "    try {\n"
     "      var id = ed.id, until = ed.bank.until;\n"
     "      var r = await db.rpc('bank_idea', { p_id: Number(id), p_until: until, p_note: String(ed.bank.note || '').trim() || null });\n"
     "      if (r.error) throw r.error;\n"
     "      var p = C.posts.filter(function (x) { return String(x.id) === String(id); })[0];\n"
     "      C.posts = C.posts.filter(function (x) { return String(x.id) !== String(id); });\n"
     "      if (p) { p.banked_at = new Date().toISOString(); p.bank_until = until; (C.banked = C.banked || []).push(p); }\n"
     "      closeComposer(true);\n"
     "      C.undo = { id: id, text: 'In the bank until ' + shortDay(until), fn: async function () { var r2 = await db.rpc('bank_undo', { p_kind: 'idea', p_id: Number(id) }); if (r2.error) throw r2.error; await load(true); } };\n"
     "      clearTimeout(C.undoT); C.undoT = setTimeout(function () { C.undo = null; paint(); }, 7000);\n"
     "      paint();\n"
     "    } catch (x) { if (C.edit && C.edit.bank) { C.edit.bank.busy = false; paintDrawer(); } toastS(bankErr(x)); }\n"
     "  }\n"
     "  function paintDrawer() {\n",
     1),
    ('src/121_wave121.seg',
     "      '<div class=\"bd\">' + resultHtml(e) +\n",
     "      '<div class=\"bd\">' + resultHtml(e) + ideaBox(e) +\n",
     1),
    ('src/121_wave121.seg',
     "'<button class=\"lnk del\" data-w121del=\"1\">Delete</button><button class=\"lnk\" data-w121dup=\"1\">Duplicate</button>' : '')",
     "'<button class=\"lnk del\" data-w121del=\"1\">Delete</button><button class=\"lnk\" data-w121dup=\"1\">Duplicate</button>' + (!e.date && e.status === 'draft' && !e.bank ? '<button class=\"lnk\" data-w136bank=\"1\" title=\"Out of the calendar until a day you pick\">Put in the bank</button>' : '') : '')",
     1),
    # ---------------- 121: clicks, typing, undo, the address ----------------
    ('src/121_wave121.seg',
     "    if ((el = t.closest('[data-w121close]'))) { e.preventDefault(); closeComposer(false); return; }\n",
     "    if ((el = t.closest('[data-w121close]'))) { e.preventDefault(); closeComposer(false); return; }\n"
     "    if ((el = t.closest('[data-w136tx]'))) { closeComposer(false); if (C.edit) e.preventDefault(); return; }\n"
     "    if ((el = t.closest('[data-w136bank]'))) { e.preventDefault(); readForm(); var pb = C.posts.filter(function (x) { return String(x.id) === String(ed.id); })[0] || {}; var dflt = pb.idea_for ? addDays(pb.idea_for, -42) : addMonths(today(), 3); if (dflt <= today()) dflt = addMonths(today(), 3); ed.bank = { until: dflt, note: pb.idea_for ? 'For ' + shortDay(pb.idea_for) + (pb.campaign ? ': ' + pb.campaign : '') : '' }; paintDrawer(); var bd0 = document.querySelector('#w121dr .bd'); if (bd0) bd0.scrollTop = 0; return; }\n"
     "    if ((el = t.closest('[data-w136bankx]'))) { e.preventDefault(); ed.bank = null; paintDrawer(); return; }\n"
     "    if ((el = t.closest('[data-w136bankgo]'))) { e.preventDefault(); await bankIdea(); return; }\n",
     1),
    ('src/121_wave121.seg',
     "    if (!C.edit || !t.closest || !t.closest('#w121dr')) return;\n    C.edit.dirty = true;\n",
     "    if (!C.edit || !t.closest || !t.closest('#w121dr')) return;\n    if (C.edit.bank && (t.id === 'w136until' || t.id === 'w136note')) { C.edit.bank[t.id === 'w136until' ? 'until' : 'note'] = t.value; return; } /* wave136 */\n    C.edit.dirty = true;\n",
     1),
    ('src/121_wave121.seg',
     "if (u) { try { await saveRow(u.id, u.patch); toastS('Undone'); }",
     "if (u) { try { if (u.fn) await u.fn(); else await saveRow(u.id, u.patch); toastS('Undone'); }",
     1),
    ('src/121_wave121.seg',
     "if (p) openComposer(p); else toastS('That post is not in the calendar any more'); }",
     "if (p) openComposer(p); else { var bk = (C.banked || []).filter(function (x) { return String(x.id) === sub; })[0]; toastS(bk ? 'That idea waits in the bank until ' + shortDay(bk.bank_until) : 'That post is not in the calendar any more'); } }",
     1),
    # ---------------- 065: the upload preview ----------------
    ('src/065_wave65.seg',
     "      + w65PlanRows(p.mentions, function (m) { return '<div class=\"w65row\"><span>' + w65Esc(m) + '</span></div>'; }) + '</div>';\n",
     "      + w65PlanRows(p.mentions, function (m) { return '<div class=\"w65row\"><span>' + w65Esc(m) + '</span></div>'; }) + '</div>';\n"
     "    /* wave136: a Marketing meeting's content ideas go to the Content calendar's Ideas (the far ones to the bank) */\n"
     "    if ((p.content_ideas || []).length) h += '<div class=\"w65sec\"><h4>Content ideas for the calendar (' + p.content_ideas.length + ')</h4>'\n"
     "      + w65PlanRows(p.content_ideas, function (c) { var far = c.for_date && (Date.parse(c.for_date + 'T12:00:00') - Date.now()) >= 90 * 86400000; return '<div class=\"w65row\"><span>' + w65Esc(c.title) + '</span>' + (c.for_date ? '<span class=\"w65mut\" style=\"margin-left:auto\">for ' + w65Esc(c.for_date) + (far ? ', waits in the bank' : '') + '</span>' : '') + '</div>'; }) + '</div>';\n",
     1),
    # ---------------- parts132: the bank page ----------------
    ('parts132/c_data.js',
     "return { tasks: arr(d.tasks), projects: arr(d.projects), back: arr(d.back),",
     "return { tasks: arr(d.tasks), projects: arr(d.projects), ideas: arr(d.ideas), back: arr(d.back),",
     1),
    ('parts132/c_data.js',
     "    out.sort(function (a, b) { return String(a.until || '').localeCompare(String(b.until || '')) || String(a.title).localeCompare(String(b.title)); });\n",
     "    /* wave136: content ideas the Content calendar put here (Marketing) */\n"
     "    d.ideas.forEach(function (c) {\n"
     "      out.push({ kind: 'idea', id: c.id, title: c.title || 'A content idea', dept: c.department || 'marketing', until: c.bank_until, note: c.bank_note, by: c.banked_by, at: c.banked_at,\n"
     "        desc: c.idea, source: c.source, sourceId: c.source_transcript_id, sourceDate: c.source_date, forDate: c.idea_for, owner: c.suggested_by, campaign: c.campaign, lead: true });\n"
     "    });\n"
     "    out.sort(function (a, b) { return String(a.until || '').localeCompare(String(b.until || '')) || String(a.title).localeCompare(String(b.title)); });\n",
     1),
    ('parts132/c_data.js',
     "    var res = await rpc('bank_unbank', { p_kind: kind, p_id: Number(id), p_why: 'brought back early' });\n    if (kind === 'project') await refreshProjects();\n    await reloadTasks();\n    toastS((it ? '“' + clip(it.title, 50) + '”' : 'It') + ' is back on the ' + teamShort(it ? it.dept : '') + ' board');\n",
     "    var res = await rpc('bank_unbank', { p_kind: kind, p_id: Number(id), p_why: 'brought back early' });\n    if (kind === 'project') await refreshProjects();\n    if (kind === 'idea') { try { if (window.w121Stale) window.w121Stale(); } catch (e) { /* fine */ } toastS((it ? '“' + clip(it.title, 50) + '”' : 'It') + ' is back in the Content calendar’s Ideas'); afterChange(); return res; }\n    await reloadTasks();\n    toastS((it ? '“' + clip(it.title, 50) + '”' : 'It') + ' is back on the ' + teamShort(it ? it.dept : '') + ' board');\n",
     1),
    ('parts132/d_page.js',
     "    var nt = all.filter(function (x) { return x.kind === 'task'; }).length, np = all.length - nt, back = backItems().length;",
     "    var nt = all.filter(function (x) { return x.kind === 'task'; }).length, ni = all.filter(function (x) { return x.kind === 'idea'; }).length, np = all.length - nt - ni, back = backItems().length;",
     1),
    ('parts132/d_page.js',
     "[nt ? plural(nt, 'task', 'tasks') : '', np ? plural(np, 'project', 'projects') : ''].filter(Boolean).join(', ')",
     "[nt ? plural(nt, 'task', 'tasks') : '', np ? plural(np, 'project', 'projects') : '', ni ? plural(ni, 'content idea', 'content ideas') : ''].filter(Boolean).join(', ')",
     1),
    ('parts132/d_page.js',
     "      + '<p>The Hub does the same on its own when a meeting puts something off by three months or more, and Ask the Hub can move a task here when you ask it to. You can bring anything back early, or give it a new date.</p></details>';",
     "      + '<p>The Hub does the same on its own when a meeting puts something off by three months or more, and Ask the Hub can move a task here when you ask it to. You can bring anything back early, or give it a new date.</p>'\n"
     "      + '<p>Content ideas wait here too: an idea from a marketing meeting for three months or more away, or one someone moved from the Content calendar. It comes back to the calendar’s Ideas on its date (six weeks before the date it is for, when it came from a meeting).</p></details>';",
     1),
    ('parts132/d_page.js',
     "        return '<div class=\"w132brow\"><span class=\"ic\">' + I(x.kind === 'project' ? 'box' : 'back') + '</span><div style=\"min-width:0\"><div class=\"t\">' + E(x.title) + '</div><div class=\"m\">' + E(teamShort(x.department)) + (x.kind === 'project' ? ' · project' : '') +",
     "        return '<div class=\"w132brow\"><span class=\"ic\">' + I(x.kind === 'project' ? 'box' : 'back') + '</span><div style=\"min-width:0\"><div class=\"t\">' + E(x.title) + '</div><div class=\"m\">' + E(teamShort(x.department)) + (x.kind === 'project' ? ' · project' : x.kind === 'idea' ? ' · content idea, in the calendar’s Ideas' : '') +",
     1),
    ('parts132/d_page.js',
     "    } else {\n      if (x.parent) meta.push('<span>part of ' + E(x.parent) + '</span>');",
     "    } else if (x.kind === 'idea') {\n"
     "      meta.push('<span>content idea</span>');\n"
     "      if (x.forDate) meta.push('<span>for ' + E(fmtShort(parseDay(x.forDate))) + '</span>');\n"
     "      if (x.campaign) meta.push('<span>' + E(x.campaign) + '</span>');\n"
     "      if (x.owner) meta.push('<span>raised by ' + E(x.owner) + '</span>');\n"
     "      if (x.source) meta.push('<span>from ' + E(clip(x.source, 48)) + '</span>');\n"
     "    } else {\n      if (x.parent) meta.push('<span>part of ' + E(x.parent) + '</span>');",
     1),
    ('parts132/d_page.js',
     "(x.kind === 'project' ? '<span class=\"kd\">Project</span>' : '')",
     "(x.kind === 'project' ? '<span class=\"kd\">Project</span>' : x.kind === 'idea' ? '<span class=\"kd\">Content idea</span>' : '')",
     1),
    ('parts132/g_wire.js',
     "      if (ko[0] === 'project') { go('#project/' + ko[1]); return; }\n",
     "      if (ko[0] === 'project') { go('#project/' + ko[1]); return; }\n"
     "      if (ko[0] === 'idea') { try { if (window.w121Stale) window.w121Stale(); } catch (x) { /* fine */ } go('#contentcal/' + ko[1]); return; }\n",
     1),
    ('parts132/f_hooks.js',
     "'<div class=\"w132trow\"><span>' + (x.kind === 'project' ? 'Project: ' : '') + E(x.title)",
     "'<div class=\"w132trow\"><span>' + (x.kind === 'project' ? 'Project: ' : x.kind === 'idea' ? 'Content idea: ' : '') + E(x.title)",
     1),
    # ---------------- tours ----------------
    ('parts122/f_tours.js',
     "S('#contentcal .tray', 'Ideas', 'Posts without a date. Drag one onto a day to plan it.', OPT),",
     "S('#contentcal .tray', 'Ideas', 'Posts without a date. Ideas raised in marketing meetings land here too, with the meeting they came from. Drag one onto a day to plan it, or open it and put it in the bank until later.', OPT),",
     1),
    ('parts132/g_wire.js',
     "S('#w132 details.w132how', 'How it works', 'Move a task from its drawer, or a whole project from its page. The Hub also banks what a meeting puts off.', OPT),",
     "S('#w132 details.w132how', 'How it works', 'Move a task from its drawer, or a whole project from its page. The Hub also banks what a meeting puts off, and content ideas for later in the year wait here until their time.', OPT),",
     1),
]


def main():
    bad = 0
    for path, old, new, n in EDITS:
        p = os.path.join(B, path)
        s = open(p, encoding='utf-8').read()
        c = s.count(old)
        if c != n:
            print('SKIP (found %d, expected %d): %s :: %s' % (c, n, path, old[:90].replace('\n', ' ')))
            bad += 1
            continue
        open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    print('%d edits, %d problems' % (len(EDITS), bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
