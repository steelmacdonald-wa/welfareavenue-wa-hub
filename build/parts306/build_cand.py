import json,sys,hashlib
sys.path.insert(0,'/tmp/rv'); import importlib, patch306 as P; importlib.reload(P)
live=sys.argv[1] if len(sys.argv)>1 else '/tmp/live/index.html'
s=open(live,encoding='utf-8').read()
import re
hs=[(m.start(),m.group(1)) for m in re.finditer(r'^/\* =+\n   WA (v\d+[a-z]*)\b',s,re.M)]+[(len(s),'END')]
bl={}
for i in range(len(hs)-1):
    if hs[i][1] in ('v225','v153'): bl[hs[i][1]]=(hs[i][0],hs[i+1][0])
assert len(bl)==2
v306=open('/tmp/rv/306_v306.js',encoding='utf-8').read()
if not v306.endswith('\n'): v306+='\n'
n225=P.patch_v225(s[bl['v225'][0]:bl['v225'][1]]); n153=P.patch_v153(s[bl['v153'][0]:bl['v153'][1]])
out=s[:bl['v153'][0]]+n153+s[bl['v153'][1]:bl['v225'][0]]+n225+v306+s[bl['v225'][1]:]
open('/home/claude/src/hub/build/candidate.html','w',encoding='utf-8',newline='').write(out)
print(len(out.encode()), hashlib.md5(out.encode()).hexdigest())
