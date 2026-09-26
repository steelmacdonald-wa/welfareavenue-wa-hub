#!/usr/bin/env python3
"""Bake the build-time remaps into the sources (audit, 26/09/26).

Until wave133, build.sh assembled candidate.html and then rewrote it with
brand_remap.py (legacy colours to the brand palette) and teams_remap.py
(old team labels to the new ones). The shipped page therefore differed
from src/: a search of the sources missed 1,532 colour values and 36
label texts. This script applies both remaps once to every src/*.seg and
every build/parts*/*.js, re-assembles the parts, and checks that the
parts still produce exactly the baked segments. After it, build.sh only
checks that the remaps would change nothing (see check_remaps.py).

Usage: python3 bake_remaps.py          (writes the sources)
       python3 bake_remaps.py --dry    (reports what would change)
"""
import glob
import importlib.util
import os
import re
import subprocess
import sys

B = os.path.dirname(os.path.abspath(__file__))
DRY = '--dry' in sys.argv


def load_remaps():
    spec = importlib.util.spec_from_file_location('br', os.path.join(B, 'brand_remap.py'))
    br = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(br)
    src = open(os.path.join(B, 'teams_remap.py'), encoding='utf-8').read()
    start = re.search(r'\nREPLACE = \[', src).start() + 1
    end = src.index('\ncounts = []')
    ns = {}
    exec(src[start:end], ns)
    return br.remap, ns['REPLACE']


REMAP, REPLACE = load_remaps()


def bake(text):
    text = REMAP(text)
    for old, new in REPLACE:
        if old in text:
            text = text.replace(old, new)
    return text


def main():
    changed = []
    files = sorted(glob.glob(os.path.join(B, 'src', '*.seg'))) + sorted(glob.glob(os.path.join(B, 'parts*', '*.js')))
    for f in files:
        t = open(f, encoding='utf-8').read()
        n = bake(t)
        if n != t:
            changed.append(os.path.relpath(f, B))
            if not DRY:
                open(f, 'w', encoding='utf-8').write(n)
    print('%d files %s' % (len(changed), 'would change' if DRY else 'baked'))
    if DRY:
        for c in changed:
            print('  ' + c)
        return
    # the parts must still assemble into exactly the baked segments
    bad = []
    for d in sorted(glob.glob(os.path.join(B, 'parts*'))):
        asm = os.path.join(d, 'assemble.py')
        if not os.path.exists(asm):
            continue
        num = os.path.basename(d)[5:]
        segs = glob.glob(os.path.join(B, 'src', num + '_*.seg'))
        before = {s: open(s, encoding='utf-8').read() for s in segs}
        subprocess.run([sys.executable, asm], check=True, capture_output=True)
        for s in segs:
            if open(s, encoding='utf-8').read() != before[s]:
                bad.append(os.path.relpath(s, B))
    print('parts reassemble identically' if not bad else 'PARTS DIFFER: ' + ', '.join(bad))


if __name__ == '__main__':
    main()
