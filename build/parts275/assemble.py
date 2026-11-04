#!/usr/bin/env python3
"""Assemble build/parts275/*.js into build/src/275_wave275.seg (non-ASCII escaped)."""
import os
D = os.path.dirname(os.path.abspath(__file__))
parts = ["a_card.js", "b_avail.js", "c_access.js"]   # wave278: c_access.js closes the wrapper that a_card.js opens
src = ''.join(open(os.path.join(D, f), encoding='utf8').read() for f in parts)
out = []
for ch in src:
    o = ord(ch)
    if o < 128: out.append(ch)
    elif o <= 0xFFFF: out.append('\\u%04x' % o)
    else:
        o -= 0x10000; out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
s = ''.join(out)
open(os.path.join(D, '..', 'src', '275_wave275.seg'), 'w', newline='\n').write(s)
print('275_wave275.seg', len(s), 'bytes')
