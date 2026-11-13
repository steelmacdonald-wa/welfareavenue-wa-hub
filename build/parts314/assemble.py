import hashlib, sys
src = open('/home/claude/live/index.html', encoding='utf-8').read()
assert hashlib.md5(src.encode()).hexdigest() == '095f882d0576184dd23f4b0381247ca9'
code = open('build/parts314/manage.js', encoding='utf-8').read()
edits = [
  ("Open Ads Manager</a></p>';\n  }\n\n  /* ---------- Connections: Meta live, and WhatsApp ---------- */",
   "Open Ads Manager</a></p>' + manage314();\n  }\n" + code + "\n  /* ---------- Connections: Meta live, and WhatsApp ---------- */"),
  (" clicks. Read-only from Meta\\u2019s ad accounts; the Hub never changes an ad.</p></div>';",
   " clicks. ' + (M314.lead ? 'From Meta\\u2019s ad accounts; marketing leads manage them below.' : 'Read-only from Meta\\u2019s ad accounts.') + '</p></div>';"),
]
out = src
for i, (o, n) in enumerate(edits):
    c = out.count(o)
    if c != 1: sys.exit('edit %d matches %d times' % (i, c))
    out = out.replace(o, n)
open('build/candidate.html', 'w', encoding='utf-8').write(out)
print('ok', hashlib.md5(out.encode()).hexdigest(), len(out))
