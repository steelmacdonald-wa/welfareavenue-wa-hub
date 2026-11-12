#!/usr/bin/env python3
"""wave310: the Hub page edits. Reads the live page (argv[1]), writes the candidate (argv[2]) and edits.json (the olds and
news the release SQL applies exactly once each)."""
import json, sys, hashlib
live = open(sys.argv[1], encoding='utf-8').read()
seg = open('/home/claude/w310/w310.js', encoding='utf-8').read()
ANCH = "\n/* =====================================================================\n   WA v110 boot veil + self-provisioning"
E = [
  # the segment, before the boot veil (as wave309 did)
  (ANCH, seg.rstrip('\n') + '\n' + ANCH),
  # the CRM's routes: #crm/folders and #crm/insights
  ("sub === 'reports' ? 'reports' : (sub === 'settings' && parts[2] === 'imports') ? 'imports' : 'contacts';",
   "sub === 'reports' ? 'reports' : (sub === 'folders' || sub === 'insights') ? sub : (sub === 'settings' && parts[2] === 'imports') ? 'imports' : 'contacts';   /* wave310: Campaigns and Email insights */"),
  ("    if (sub === 'reports') openReports(parts);\n",
   "    if (sub === 'reports') openReports(parts);\n    if ((sub === 'folders' || sub === 'insights') && window.w310) window.w310.route(parts);   /* wave310 */\n"),
  ("    else if (S.ui.tab === 'imports') paintImports(root);\n",
   "    else if (S.ui.tab === 'imports') paintImports(root);\n    else if ((S.ui.tab === 'folders' || S.ui.tab === 'insights') && window.w310) window.w310.paintCrm(root, S.ui.tab, tabsHtml());   /* wave310 */\n"),
  # the studio's Button block: point it at a form or the donation page
  ("inp(i, 'caption', 'Small line under it', b.caption, { ph: 'Two minutes \\u00b7 your volunteer hours count' }); }",
   "inp(i, 'caption', 'Small line under it', b.caption, { ph: 'Two minutes \\u00b7 your volunteer hours count' }) + (window.w310 ? window.w310.btnPick(i) : ''); }   /* wave310 */"),
  # an automation's own email: the same picker under the button
  ("fld('cta_url', 'Button link', s.cta_url, 'https://welfareavenue.com') + '</div>') +",
   "fld('cta_url', 'Button link', s.cta_url, 'https://welfareavenue.com') + '</div>' + (window.w310 ? window.w310.ctaPick() : '')) +   /* wave310 */"),
  # the form editor: a donate button on the thank-you page
  ("      inp('thank_you', 'Thank-you message (after they send it)', 'Thank you. We have your answers.', true) +\n",
   "      (window.w310 ? window.w310.formDonate(f) : '') +   /* wave310: a donate button on the thank-you */\n      inp('thank_you', 'Thank-you message (after they send it)', 'Thank you. We have your answers.', true) +\n"),
  # the Photo library: the albums, and counts that say "in the library"
  ("    var list = shown(), html = toolbar();\n",
   "    var list = shown(), html = toolbar() + (window.w310 ? window.w310.albumsHtml() : '');   /* wave310: the albums in Google Photos */\n"),
  ("'<div class=\"grp\"><h3>' + E(g.y) + '</h3><span>' + all + ' photo' + (all === 1 ? '' : 's') + '</span></div>",
   "'<div class=\"grp\"><h3>' + E(g.y) + '</h3><span>' + all + ' photo' + (all === 1 ? '' : 's') + ' in the library</span></div>"),
]
out = live
for i, (o, n) in enumerate(E):
    c = out.count(o)
    assert c == 1, ('edit', i, c)
    out = out.replace(o, n)
assert out.endswith('</html>\n')
open(sys.argv[2], 'w', encoding='utf-8').write(out)
json.dump([[o, n] for o, n in E], open('/home/claude/w310/edits.json', 'w'))
print('live', hashlib.md5(live.encode()).hexdigest(), 'candidate', hashlib.md5(out.encode()).hexdigest(), len(out))
