#!/usr/bin/env python3
"""Build guard (audit, 26/09/26): the sources already carry the brand palette and the team labels.

brand_remap.py and teams_remap.py used to rewrite the assembled page. Their
work is now baked into src/ and parts*/ (bake_remaps.py), so the source is
what ships. This guard runs both remaps on the build in memory and fails if
they would change anything, which means someone added a legacy colour or an
old team label. Fix the source (or run bake_remaps.py) and build again.
"""
import sys
from bake_remaps import bake

path = sys.argv[1]
text = open(path, encoding='utf-8').read()
out = bake(text)
if out != text:
    a, b = text.split('\n'), out.split('\n')
    diff = [i + 1 for i, (x, y) in enumerate(zip(a, b)) if x != y]
    print('check_remaps: %d lines use a legacy colour or an old team label (first at line %s). '
          'Run python3 bake_remaps.py, or use the brand values in the source.' % (len(diff), diff[:5]))
    sys.exit(1)
print('check_remaps: clean (no legacy colours or old team labels)')
