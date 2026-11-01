# Builds ask/index.html from ask_src.html: puts the brand kit's logo paths (content-images/brand) into the page.
import json, sys, os, hashlib
here = os.path.dirname(os.path.abspath(__file__))
paths = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'paths.json')))
src = open(os.path.join(here, 'ask_src.html'), encoding='utf-8').read()
for k in ('E', 'MARK', 'WORD'):
    src = src.replace('__%s_VB__' % k, paths[k]['vb']).replace('__%s_D__' % k, paths[k]['d'])
# ASCII only: non-ASCII in the script becomes \\uXXXX, elsewhere an HTML entity
a = src.index('<script>'); b = src.rindex('</script>')
def jsesc(t): return ''.join(ch if ord(ch) < 128 else '\\u%04x' % ord(ch) for ch in t)
def htesc(t): return ''.join(ch if ord(ch) < 128 else '&#%d;' % ord(ch) for ch in t)
src = htesc(src[:a]) + jsesc(src[a:b]) + htesc(src[b:])
assert '__' + 'E_' not in src and '__MARK' not in src and '__WORD' not in src, 'placeholder left'
os.makedirs(os.path.join(here, 'ask'), exist_ok=True)
open(os.path.join(here, 'ask', 'index.html'), 'w', encoding='utf-8').write(src)
bad = [c for c in src if ord(c) > 127]
print('ask/index.html', len(src.encode('utf-8')), 'bytes, md5', hashlib.md5(src.encode('utf-8')).hexdigest(), 'non-ascii', len(bad))
