#!/usr/bin/env python3
"""Call the loom-pull function as the automation (x-wa-secret): python3 build/loom_call.py <action> [json-extra]
  status | probe | sync  (sync starts a background run; read loom_pull_runs for the outcome)"""
import json, sys, urllib.request
ANON = open('/tmp/anon.key').read().strip(); SEC = open('/tmp/wa.secret').read().strip()
body = {'action': sys.argv[1] if len(sys.argv) > 1 else 'status'}
if len(sys.argv) > 2: body.update(json.loads(sys.argv[2]))
req = urllib.request.Request('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/loom-pull', data=json.dumps(body).encode(), method='POST',
                             headers={'Authorization': 'Bearer ' + ANON, 'apikey': ANON, 'x-wa-secret': SEC, 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=170) as r: print(r.status); print(json.dumps(json.loads(r.read().decode()), indent=1)[:int(sys.argv[3]) if len(sys.argv) > 3 else 30000])
except urllib.error.HTTPError as e: print(e.code, e.read().decode()[:3000])
