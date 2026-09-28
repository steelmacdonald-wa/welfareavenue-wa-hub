#!/usr/bin/env python3
"""Build the public donation page (wave161): build/give/src.html -> build/give/index.html.
Same as build/f/make.py: injects the Welfare Avenue lockup (the paths of build/src/117_wave117.seg), the project URL and
the publishable (anon) key from /tmp/anon.key (public by design: every page of the Hub carries it). The output is what
site_files path 'give/index.html' holds and host-sync deploys; _redirects sends /give and /give/* (the thank-you after
Stripe) to it."""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
seg = open(os.path.join(HERE, '..', 'src', '117_wave117.seg'), encoding='utf8').read()
def const(name):
    m = re.search(name + r"\s*=\s*'([^']*)'", seg)
    if not m: sys.exit('missing ' + name)
    return m.group(1)
vb = const('VB_LOCKUP')
svg = ('<svg class="lockup" viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Welfare Avenue, building pathways in our community">'
       '<path fill="currentColor" fill-rule="evenodd" d="' + const('PRIMARY_D') + '"/><path fill="currentColor" d="' + const('LOCKUP_TAG_D') + '"/>'
       '<path fill="#DCA527" d="' + const('LOCKUP_GOLD_D') + '"/></svg>')
key = open('/tmp/anon.key').read().strip()
src = open(os.path.join(HERE, 'src.html'), encoding='utf8').read()
out = src.replace('%%LOCKUP_SVG%%', svg).replace('%%SUPABASE_URL%%', 'https://zwnmulmnvopclzcvytce.supabase.co').replace('%%ANON_KEY%%', key)
assert '%%' not in out, 'a placeholder is left'
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf8').write(out)
print('build/give/index.html', len(out.encode('utf8')), 'bytes')
