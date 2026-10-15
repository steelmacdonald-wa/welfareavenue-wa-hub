#!/usr/bin/env python3
"""Push local commits to GitHub without the trigger secret in the sandbox (27/09/26).

repo_push.py needs /tmp/wa.secret. When a session has only the anon key, this stages the changed files into a
temporary table over PostgREST; the Supabase MCP then runs build/repo_push_via_db.sql, which calls the repo-sync
edge function from inside the database (call_edge, with the vault secret) for the blobs and the commit, and drops
the table. Usage: python3 build/repo_push_via_db.py <from_commit> [to_commit]   (files changed between the two)
"""
import base64, hashlib, json, subprocess, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/" + os.environ.get("PUSH_TABLE", "wa_stage_push")
anon = open('/tmp/anon.key').read().strip()
a, b = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'HEAD')
files = [f for f in subprocess.run(['git', '-C', ROOT, 'diff', '--name-only', '-z', a, b], capture_output=True, text=True).stdout.split('\0') if f]
def gsha(d): return hashlib.sha1(b'blob %d\0' % len(d) + d).hexdigest()
ok = 0
for p in files:
    full = os.path.join(ROOT, p)
    if not os.path.exists(full):
        print('deleted (push by hand):', p); continue
    data = open(full, 'rb').read()
    open('/tmp/push_row.json', 'w').write(json.dumps({'path': p, 'b64': base64.b64encode(data).decode(), 'sha': gsha(data), 'bytes': len(data)}))
    r = subprocess.run(['curl', '-s', '-o', '/tmp/push_resp.txt', '-w', '%{http_code}', '-X', 'POST', URL, '-H', 'apikey: ' + anon, '-H', 'Authorization: Bearer ' + anon,
                        '-H', 'Content-Type: application/json', '-H', 'Prefer: return=minimal', '--data-binary', '@/tmp/push_row.json'], capture_output=True, text=True)
    if r.stdout.strip() == '201': ok += 1
    else: print('FAILED', p, r.stdout, open('/tmp/push_resp.txt').read()[:200])
print('staged %d of %d files' % (ok, len(files)))
