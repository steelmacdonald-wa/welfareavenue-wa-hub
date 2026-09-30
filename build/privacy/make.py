#!/usr/bin/env python3
"""Build the privacy notice (wave175b): build/privacy/src.html -> build/privacy/index.html, with the confirm page's
styles and the lockup. site_files path 'privacy/index.html'; Netlify serves it at /privacy/."""
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
assert "'" not in svg and '\n' not in svg
c = open(os.path.join(HERE, '..', 'c', 'src.html'), encoding='utf8').read()
style = c[c.index('<style>') + len('<style>'):c.index('</style>')].strip('\n')
key = open('/tmp/anon.key').read().strip()
src = open(os.path.join(HERE, 'src.html'), encoding='utf8').read()
out = (src.replace('%%STYLE%%', style).replace('%%LOCKUP_SVG%%', svg).replace('%%LOCKUP_INLINE%%', svg)
       .replace('%%SUPABASE_URL%%', 'https://zwnmulmnvopclzcvytce.supabase.co').replace('%%ANON_KEY%%', key)
       .replace('%%ST%%', 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/'))
assert '%%' not in out, 'a placeholder is left'
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf8').write(out)
print('build/privacy/index.html', len(out.encode('utf8')), 'bytes')
