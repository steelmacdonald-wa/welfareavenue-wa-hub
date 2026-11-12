#!/usr/bin/env python3
"""wave322: put the One box block into a Hub page, just before WA v110 (which stays last).
Usage: python3 build/parts322/patch322.py <page in> <candidate out>
The page in is the live page, or a candidate that already carries wave320. No other edit is made."""
import hashlib, io, os, sys
src, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
block = io.open(os.path.join(here, '322_v322.js'), encoding='utf-8').read()
assert all(ord(c) < 128 for c in block), 'the block must be ASCII'
assert '—' not in block and '–' not in block
page = io.open(src, encoding='utf-8', newline='').read()
if 'WA v322 ' in page: sys.exit('this page already carries wave322')
V110 = "/* =====================================================================\n   WA v110 boot veil + self-provisioning + access requests (08/08/26)\n"
assert page.count(V110) == 1, 'the WA v110 header was not found exactly once'
page = page.replace(V110, block + V110)
assert page.endswith('</html>\n')
io.open(out, 'w', encoding='utf-8', newline='').write(page)
data = io.open(out, 'rb').read()
print(len(data), hashlib.md5(data).hexdigest())
