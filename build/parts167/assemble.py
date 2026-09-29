#!/usr/bin/env python3
"""Assemble build/parts167/*.js into build/src/167_wave167.seg (non-ASCII escaped); journey_defaults.json (written by
build/data/wa167_journey.py) goes in as the journey's fallback settings."""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
parts = ["a_head.js", "b_data.js", "c_view.js", "d_wire.js"]
src = ''.join(open(os.path.join(D, f), encoding='utf8').read() for f in parts)
defaults = json.dumps(json.load(open(os.path.join(D, 'journey_defaults.json'), encoding='utf8')), ensure_ascii=False, separators=(',', ':'))
assert '/*JOURNEY_DEFAULTS*/null' in src
src = src.replace('/*JOURNEY_DEFAULTS*/null', defaults)
out = []
for ch in src:
    o = ord(ch)
    if o < 128: out.append(ch)
    elif o <= 0xFFFF: out.append('\\u%04x' % o)
    else:
        o -= 0x10000; out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
open(os.path.join(D, '..', 'src', '167_wave167.seg'), 'w').write(''.join(out))
print('167_wave167.seg', len(''.join(out)), 'bytes')
