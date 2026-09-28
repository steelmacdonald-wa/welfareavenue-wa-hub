#!/usr/bin/env python3
"""Stage edge function sources for fn-deploy (wave161): python3 build/fn_stage.py <name> [<name> ...]
Posts fn/<name>/index.ts into the temporary anon-insert table public.wa_stage_fn (name, source) over PostgREST with the
publishable key in /tmp/anon.key, and prints each source's md5 and its verify_jwt from fn/<name>/meta.json, so the deploy
call can check the md5 before calling fn-deploy:
  select md5(source) = '<md5>', public.wa_tmp_call_edge_jwt_long('fn-deploy', jsonb_build_object('action', 'deploy', 'name',
         name, 'source', source, 'verify_jwt', <true|false>)) from public.wa_stage_fn where name = '<name>';"""
import hashlib, json, sys, urllib.request
ANON = open('/tmp/anon.key').read().strip()
URL = 'https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/wa_stage_fn'
rows = []
for name in sys.argv[1:]:
    src = open('fn/%s/index.ts' % name, encoding='utf8').read()
    meta = json.load(open('fn/%s/meta.json' % name))
    rows.append({'name': name, 'source': src})
    print(name, hashlib.md5(src.encode('utf8')).hexdigest(), 'verify_jwt', str(meta.get('verify_jwt', True)).lower(), len(src), 'chars')
req = urllib.request.Request(URL, data=json.dumps(rows).encode(), method='POST', headers={'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
with urllib.request.urlopen(req, timeout=60) as r: print('staged', len(rows), r.status)
