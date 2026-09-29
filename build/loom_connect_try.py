#!/usr/bin/env python3
"""Set-up only: start a Loom approval with a variation, print the URL. python3 build/loom_connect_try.py '<variant json>'"""
import json, sys, urllib.request
ANON = open('/tmp/anon.key').read().strip(); SEC = open('/tmp/wa.secret').read().strip()
body = {'action': 'start', 'variant': json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}}
req = urllib.request.Request('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/loom-connect', data=json.dumps(body).encode(), method='POST',
                             headers={'Authorization': 'Bearer ' + ANON, 'apikey': ANON, 'x-wa-secret': SEC, 'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=120) as r: print(json.loads(r.read().decode())['url'])
