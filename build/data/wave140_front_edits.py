#!/usr/bin/env python3
"""wave140: the three new pages in the menu (Resources) and in the access-profile matrix."""
def patch(path, pairs):
    s = open(path, encoding='utf8').read()
    for old, new in pairs:
        if new in s and old not in s: continue
        assert s.count(old) == 1, (path, old[:80], s.count(old))
        s = s.replace(old, new)
    open(path, 'w', encoding='utf8').write(s)
patch('build/src/134_wave134.seg', [
  ("      { key: 'resources', label: 'Resources', items: ['importantinfo', 'photos'] },",
   "      { key: 'resources', label: 'Resources', items: ['importantinfo', 'ourstory', 'partners', 'documents', 'photos'] }, /* wave140: Our story, Partners, Document finder */"),
])
for f in ('build/src/127_wave127.seg', 'build/src/131_wave131.seg'):
    patch(f, [
      ("    ['Resources', ['importantinfo', 'photos', 'create']],", "    ['Resources', ['importantinfo', 'ourstory', 'partners', 'documents', 'photos', 'create']],"),
      ("create: 'Create studio', photos: 'Photo library', brain: 'The Brain', importantinfo: 'Important info',",
       "create: 'Create studio', photos: 'Photo library', brain: 'The Brain', importantinfo: 'Important info', ourstory: 'Our story', partners: 'Partners', documents: 'Document finder',"),
    ])
m = open('build/src/MANIFEST.txt', encoding='utf8').read()
if '140_wave140' not in m:
    m = m.replace('138_wave138\n', "138_wave138\n# 140_wave140: Our story, Partners and the Document finder (the Drive mining, framed); registers three Resources pages.\n140_wave140\n")
    open('build/src/MANIFEST.txt', 'w', encoding='utf8').write(m)
print('ok')
