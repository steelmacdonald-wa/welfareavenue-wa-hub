#!/usr/bin/env python3
"""wave141: planned trainings in the Avenue Academy (the Slack lists' To Create items).
A training whose body says planned is hidden from learners everywhere; inside its Learning Avenue, leaders see it in
a Planned trainings block with Add the content, which opens the usual edit form; saving it with a link or new text
publishes it (body.planned becomes false). The older training surfaces (WA36) never list planned ones."""
import sys
P122 = 'build/src/122_wave122.seg'
P036 = 'build/src/036_wave36.seg'
def patch(path, pairs):
    s = open(path, encoding='utf8').read()
    for old, new in pairs:
        if new in s and old not in s: continue   # already applied
        assert s.count(old) == 1, (path, old[:80], s.count(old))
        s = s.replace(old, new)
    open(path, 'w', encoding='utf8').write(s)
patch(P122, [
  ("  function visibleT(t) { if (!t || t.active === false) return false; var tk = tourKeyOf(t);",
   "  function visibleT(t) { if (!t || t.active === false) return false; if (t.body && t.body.planned) return false; var tk = tourKeyOf(t);"),
  ("    + '.w122card .cv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55;mix-blend-mode:luminosity;}'",
   "    + '.w122card .cv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55;mix-blend-mode:luminosity;}'\n"
   "    + '.w141plan{margin-top:26px;padding:14px 16px;border:1px dashed rgba(127,127,127,.45);border-radius:14px;background:rgba(220,165,39,.07);}'\n"
   "    + '.w141plan h3{font-size:16px;margin:0 0 4px;display:flex;gap:8px;align-items:center;}.w141plan h3 i{font-style:normal;font-size:12px;background:#DCA527;color:#1F201E;border-radius:10px;padding:1px 8px;}'\n"
   "    + '.w141pl{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid rgba(127,127,127,.18);}.w141pl .n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(220,165,39,.2);flex:none;}'\n"
   "    + '.w141pl .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}.w141pl .tx span{font-size:12.5px;opacity:.75;}'\n"
   "    + '@media (max-width:560px){.w141pl{flex-wrap:wrap;}.w141pl .w122btn{width:100%;justify-content:center;}}'"),
  ("  function isLeader() { var r = role(); return r === 'admin' || r === 'leader'; }",
   "  function isLeader() { var r = role(); return r === 'admin' || r === 'leader'; }\n"
   "  /* planned trainings (wave141): listed in the Slack training lists but never made, or whose link did not come across; leaders fill them in */\n"
   "  function plannedIn(p) { return (A.trainings || []).filter(function (t) { return t.path_group === p.name && t.active !== false && t.body && t.body.planned; }).sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); }); }\n"
   "  function plannedHtml(p) {\n"
   "    if (!isLeader()) return '';\n"
   "    var items = plannedIn(p); if (!items.length) return '';\n"
   "    return '<div class=\"w141plan\" data-w141plan=\"' + E(p.key) + '\"><h3>Planned trainings <i>' + items.length + '</i></h3><p class=\"snote\">Only leaders see these: trainings the team listed in Slack but never made, or whose link did not come across. Add the content and it joins this Learning Avenue for everyone.</p>' +\n"
   "      items.map(function (t) { return '<div class=\"w141pl\"><span class=\"n\">' + ic('plus') + '</span><span class=\"tx\"><b>' + E(t.title) + '</b><span>' + E((t.body && t.body.note) || t.description || 'No content yet.') + '</span></span><button class=\"w122btn soft sm\" data-w141fill=\"' + E(t.id) + '\">' + ic('edit') + ' Add the content</button></div>'; }).join('') + '</div>';\n"
   "  }"),
  ("      }).join('') + '</div></div></div></div>' +\n      '<div class=\"ft\"><div class=\"st\">' + (ps.complete ?",
   "      }).join('') + '</div>' + plannedHtml(p) + '</div></div></div>' +\n      '<div class=\"ft\"><div class=\"st\">' + (ps.complete ?"),
  ("    if ((el = t.closest('[data-w122edit]'))) { openForm(R.t); return; }",
   "    if ((el = t.closest('[data-w122edit]'))) { openForm(R.t); return; }\n"
   "    if ((el = t.closest('[data-w141fill]'))) { var pt = A.byId[String(el.getAttribute('data-w141fill'))]; if (pt) openForm(pt); return; }"),
  ("      if (R.t) { res = await db.from('trainings').update(row).eq('id', R.t.id).select();",
   "      if (R.t && R.t.body && R.t.body.planned && (row.resource_url || (row.description && row.description !== (R.t.description || null)))) row.body = Object.assign({}, R.t.body, { planned: false, filled_at: nowIso(), filled_by: me().name });\n"
   "      if (R.t) { res = await db.from('trainings').update(row).eq('id', R.t.id).select();"),
])
patch(P036, [
  ("    WA36_TRAININGS = (t && t.data) || [];",
   "    WA36_TRAININGS = ((t && t.data) || []).filter(function (x) { return !(x && x.body && x.body.planned); }); /* wave141: planned trainings stay in the Academy, for leaders */"),
])
print('ok')
