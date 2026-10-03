#!/usr/bin/env python3
"""Assemble build/parts199/*.js into build/src/199_wave199.seg (non-ASCII escaped)."""
import os
D = os.path.dirname(os.path.abspath(__file__))
parts = ["a_pos.js"]
src = ''.join(open(os.path.join(D, f), encoding='utf8').read() for f in parts)
out = []
for ch in src:
    o = ord(ch)
    if o < 128: out.append(ch)
    elif o <= 0xFFFF: out.append('\\u%04x' % o)
    else:
        o -= 0x10000; out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
s = ''.join(out)
open(os.path.join(D, '..', 'src', '199_wave199.seg'), 'w').write(s)
print('199_wave199.seg', len(s), 'bytes')
