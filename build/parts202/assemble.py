#!/usr/bin/env python3
"""Assemble build/parts202/*.js into build/src/202_wave202.seg (non-ASCII escaped)."""
import os
D = os.path.dirname(os.path.abspath(__file__))
parts = ["a_head.js", "c_blocks.js", "d_checks.js", "e_ai.js", "f_photos.js", "g_home.js", "g2_voices.js", "h_start.js", "i_editor.js", "j_send.js", "k_css.js", "z_wire.js"]
src = ''.join(open(os.path.join(D, f), encoding='utf8').read() for f in parts)
out = []
for ch in src:
    o = ord(ch)
    if o < 128: out.append(ch)
    elif o <= 0xFFFF: out.append('\\u%04x' % o)
    else:
        o -= 0x10000; out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
open(os.path.join(D, '..', 'src', '202_wave202.seg'), 'w').write(''.join(out))
print('202_wave202.seg', len(''.join(out)), 'bytes')
