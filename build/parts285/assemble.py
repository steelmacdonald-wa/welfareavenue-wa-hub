#!/usr/bin/env python3
"""Assemble build/parts285/*.js into build/src/285_wave285.seg (non-ASCII escaped, LF)."""
import os
D = os.path.dirname(os.path.abspath(__file__))
parts = ["a_core.js", "b_page.js", "c_panel.js", "d_home.js"]
src = ''.join(open(os.path.join(D, f), encoding='utf8').read().replace('\r\n', '\n') for f in parts)
out = []
for ch in src:
    o = ord(ch)
    if o < 128: out.append(ch)
    elif o <= 0xFFFF: out.append('\\u%04x' % o)
    else:
        o -= 0x10000; out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
s = ''.join(out)
open(os.path.join(D, '..', 'src', '285_wave285.seg'), 'w', newline='\n').write(s)
print('285_wave285.seg', len(s), 'bytes')
