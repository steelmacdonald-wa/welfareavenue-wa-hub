#!/usr/bin/env python3
"""wave222: build the candidate from the live build by swapping the edited segments (each must sit verbatim in the live file, once).
python3 build/w222_splice.py live.html pulled.json seg [seg...]  -> build/candidate.html"""
import sys, json, base64, hashlib
live = open(sys.argv[1], encoding='utf-8', newline='').read()
rows = {}
for f in sys.argv[2].split(','):
    for r in json.load(open(f)): rows[r['path']] = base64.b64decode(r['content_b64']).decode('utf-8')
out = live
for seg in sys.argv[3:]:
    old = rows['build/src/%s.seg' % seg]; new = open('build/src/%s.seg' % seg, encoding='utf-8', newline='').read()
    assert out.count(old) == 1, seg
    out = out.replace(old, new)
open('build/candidate.html', 'w', encoding='utf-8', newline='').write(out)
print('candidate', hashlib.md5(out.encode('utf-8')).hexdigest(), len(out))
