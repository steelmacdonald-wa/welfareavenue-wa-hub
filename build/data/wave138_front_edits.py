#!/usr/bin/env python3
"""wave138 (26/09/26): the older modules learn @mentions. Each edit must match exactly once.
- 116j Settings: the "Send @mentions as you" row (parts138 renders it) after the Slack row, a hook after each paint,
  and "Someone @mentions me in the Hub" in Notifications (notify event comment_mention).
- 116b (task drawer), 051 (task comments window), 016 and 116f (goal comments), parts123 (request notes): names that are
  mentions are highlighted (window.w138Mark on the escaped text).
- parts122 tours: the tasks step says what @ does."""
import os, sys
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDITS = [
  ('src/116j_wave116j.seg',
   "['request_update', 'A request I asked for is done, or someone adds a note to it']];",
   "['request_update', 'A request I asked for is done, or someone adds a note to it'], ['comment_mention', 'Someone @mentions me in the Hub (a Slack message with what they wrote)']];"),
  ('src/116j_wave116j.seg',
   "      body += connRow('C', '#1a73e8', 'Google Calendar',",
   "      body += (window.w138ConnRow ? window.w138ConnRow() : ''); /* wave138: Send @mentions as you */\n      body += connRow('C', '#1a73e8', 'Google Calendar',"),
  ('src/116j_wave116j.seg',
   "    box.innerHTML = settingsHtml();\n    if (J.tab === 'connections' && J.conn && J.conn.google_drive && J.conn.google_drive.enabled) loadFiles();",
   "    box.innerHTML = settingsHtml();\n    try { if (window.w138AfterPaint) window.w138AfterPaint(J.tab); } catch (x) { /* fine */ }\n    if (J.tab === 'connections' && J.conn && J.conn.google_drive && J.conn.google_drive.enabled) loadFiles();"),
  ('src/116b_wave116b.seg',
   "'</div><div class=\"bd\">' + E(c.body) + '</div>' + (c.quote ?",
   "'</div><div class=\"bd\">' + (window.w138Mark ? window.w138Mark(E(c.body)) : E(c.body)) + '</div>' + (c.quote ?"),
  ('src/051_wave51.seg',
   "        + '</div><div class=\"bd\">' + esc(c.body) + '</div>'",
   "        + '</div><div class=\"bd\">' + (window.w138Mark ? window.w138Mark(esc(c.body)) : esc(c.body)) + '</div>'"),
  ('src/016_wave16.seg',
   "          + '<div data-glcb=\"' + c.id + '\">' + esc(c.body) + '</div></div>';",
   "          + '<div data-glcb=\"' + c.id + '\">' + (window.w138Mark ? window.w138Mark(esc(c.body)) : esc(c.body)) + '</div></div>';"),
  ('src/116f_wave116f.seg',
   "<div data-glcb=\"' + E(c.id) + '\">' + E(c.body) + '</div></div>';",
   "<div data-glcb=\"' + E(c.id) + '\">' + (window.w138Mark ? window.w138Mark(E(c.body)) : E(c.body)) + '</div></div>';"),
  ('parts123/e_sheet.js',
   "added a note</span><div class=\"bd\">' + linkify(n.body) + '</div>' }); });",
   "added a note</span><div class=\"bd\">' + (window.w138Mark ? window.w138Mark(linkify(n.body)) : linkify(n.body)) + '</div>' }); });"),
  ('parts122/f_tours.js',
   "'Click a task for its details, comments and history. Drag to reorder it or move it to another group.'",
   "'Click a task for its details, comments and history. Type @ and a name in a comment to bring someone in: they get a Slack message with a link. Drag to reorder a task or move it to another group.'"),
]
bad = 0
for rel, old, new in EDITS:
    p = os.path.join(B, rel); s = open(p, encoding='utf8').read(); n = s.count(old)
    if n != 1:
        print('NO MATCH (%d) in %s: %s' % (n, rel, old[:80])); bad += 1; continue
    open(p, 'w', encoding='utf8').write(s.replace(old, new)); print('ok', rel)
sys.exit(1 if bad else 0)
