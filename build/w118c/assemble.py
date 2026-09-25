#!/usr/bin/env python3
"""Assemble src/118c_wave118c.seg from build/w118c/*.js (wave118c, 25/09/26).
The photo_label spec (build/data/photo_label_spec.json) is embedded as SPEC.
Fails on any non-ASCII character or em dash."""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.dirname(HERE)
parts = ['01_head.js', '02_data.js', '03_page.js', '04_drawer.js', '05_upload.js', '06_handoffs.js', '07_wire.js']
src = ''.join(open(os.path.join(HERE, p), encoding='utf-8').read() for p in parts)
spec = json.dumps(json.load(open(os.path.join(BUILD, 'data', 'photo_label_spec.json'))), ensure_ascii=True, separators=(',', ':'))
assert src.count('@@SPEC@@') == 1
src = src.replace('@@SPEC@@', spec)
bad = [(i, c) for i, c in enumerate(src) if ord(c) > 127]
if bad:
    sys.exit('non-ASCII at %s' % bad[:5])
if not src.endswith('\n'):
    src += '\n'
out = os.path.join(BUILD, 'src', '118c_wave118c.seg')
open(out, 'w', encoding='utf-8', newline='').write(src)
r = subprocess.run(['node', '-e', "const s=require('fs').readFileSync(process.argv[1],'utf8'); new Function(s); console.log('syntax OK')", out], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip()[:400])
print(out, len(src.encode()), 'bytes', src.count('\n'), 'lines')
if r.returncode:
    sys.exit(1)
