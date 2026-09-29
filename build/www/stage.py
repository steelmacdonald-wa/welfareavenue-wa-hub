#!/usr/bin/env python3
"""Stage the built website (build/www/out) into public.wa_stage_www over PostgREST with the publishable key (wave162).
Text files go as they are (encoding utf8), images as base64; each row carries the md5 of the file's bytes so the SQL
that copies the stage into www_files can check every file before it replaces the live set."""
import base64, hashlib, json, os, sys, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out')
ANON = open('/tmp/anon.key').read().strip()
URL = 'https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/wa_stage_www'
TEXT = ('.html', '.css', '.js', '.svg', '.xml', '.txt', '.json')
rows = []
for root, _, names in os.walk(OUT):
    for n in sorted(names):
        full = os.path.join(root, n); rel = os.path.relpath(full, OUT).replace(os.sep, '/')
        if rel.startswith('og-render') or rel.endswith('.png') and rel.startswith('img/og-'): continue
        raw = open(full, 'rb').read()
        text = rel.endswith(TEXT) or rel in ('_headers', '_redirects')
        rows.append({'path': rel, 'part': 0, 'content': raw.decode('utf8') if text else base64.b64encode(raw).decode(), 'encoding': 'utf8' if text else 'base64', 'md5': hashlib.md5(raw).hexdigest()})
batch, size, sent = [], 0, 0
def post(b):
    req = urllib.request.Request(URL, data=json.dumps(b).encode(), method='POST', headers={'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
    with urllib.request.urlopen(req, timeout=120) as r: return r.status
for r in rows:
    batch.append(r); size += len(r['content'])
    if size > 1500000: post(batch); sent += len(batch); batch, size = [], 0
if batch: post(batch); sent += len(batch)
manifest = {r['path']: r['md5'] for r in rows}
json.dump(manifest, open(os.path.join(HERE, 'staged.json'), 'w'), indent=0, sort_keys=True)
print('staged', sent, 'files,', sum(len(r['content']) for r in rows), 'chars; manifest md5', hashlib.md5(json.dumps(manifest, sort_keys=True).encode()).hexdigest())
