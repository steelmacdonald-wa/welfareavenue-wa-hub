#!/usr/bin/env python3
"""Call loom-connect as the build (x-wa-secret): python3 build/loom_connect_call.py <start|status|disconnect>
   or python3 build/loom_connect_call.py finish '<the http://localhost:53682/callback?code=...&state=... address>'"""
import json, sys, urllib.request
ANON = open('/tmp/anon.key').read().strip(); SEC = open('/tmp/wa.secret').read().strip()
body = {'action': sys.argv[1] if len(sys.argv) > 1 else 'status'}
if body['action'] == 'finish': body['url'] = sys.argv[2] if len(sys.argv) > 2 else ''
req = urllib.request.Request('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/loom-connect', data=json.dumps(body).encode(), method='POST',
                             headers={'Authorization': 'Bearer ' + ANON, 'apikey': ANON, 'x-wa-secret': SEC, 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=120) as r: print(r.status, r.read().decode()[:3000])
except urllib.error.HTTPError as e: print(e.code, e.read().decode()[:3000])
