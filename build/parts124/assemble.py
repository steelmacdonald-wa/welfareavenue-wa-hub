#!/usr/bin/env python3
"""Assemble build/parts124/*.js into build/src/124_wave124.seg (non-ASCII escaped)."""
import os
D = os.path.dirname(os.path.abspath(__file__))
parts = ["a_head.js", "b_css.js", "c_data.js", "d_cal.js", "e_fund.js", "e2_media.js", "f_sheet.js", "h_tours.js", "g_wire.js"]
src = ''.join(open(os.path.join(D, f), encoding='utf8').read() for f in parts)
out = []
for ch in src:
    o = ord(ch)
    if o < 128: out.append(ch)
    elif o <= 0xFFFF: out.append('\\u%04x' % o)
    else:
        o -= 0x10000; out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
open(os.path.join(D, '..', 'src', '124_wave124.seg'), 'w').write(''.join(out))
print('124_wave124.seg', len(''.join(out)), 'bytes')
