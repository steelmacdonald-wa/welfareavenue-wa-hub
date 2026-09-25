#!/usr/bin/env python3
"""Stage a long SQL file statement by statement into public.wa_stage_sqlq (anon insert), so a short MCP call can run it:
  python3 build/sql_stage.py <file.sql> [table]
Then run (MCP):  do $$ declare r record; begin for r in select stmt from public.<table> order by n loop execute r.stmt; end loop; end $$;
Splits on ';' at line ends outside dollar quotes. Skips begin/commit (the DO block is one transaction)."""
import json, re, sys, hashlib, urllib.request
path = sys.argv[1]; table = sys.argv[2] if len(sys.argv) > 2 else 'wa_stage_sqlq'
ANON = open('/tmp/anon.key').read().strip()
URL = 'https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/' + table
src = open(path, encoding='utf8').read()
stmts, cur, in_dollar, tag = [], [], False, None
for line in src.splitlines(keepends=True):
    if not in_dollar and not cur and (line.strip().startswith('--') or not line.strip()):
        continue
    cur.append(line)
    for m in re.finditer(r'\$[A-Za-z_]*\$', line):
        t = m.group(0)
        if not in_dollar: in_dollar, tag = True, t
        elif t == tag: in_dollar, tag = False, None
    if not in_dollar and line.rstrip().endswith(';'):
        s = ''.join(cur).strip(); cur = []
        if s.lower() in ('begin;', 'commit;'): continue
        stmts.append(s)
if ''.join(cur).strip(): stmts.append(''.join(cur).strip())
rows = [{'n': i + 1, 'stmt': s} for i, s in enumerate(stmts)]
req = urllib.request.Request(URL, data=json.dumps(rows).encode(), method='POST', headers={'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
with urllib.request.urlopen(req, timeout=120) as r: print('staged', len(rows), 'statements', r.status)
print('md5', hashlib.md5(''.join(s for s in stmts).encode()).hexdigest(), 'chars', sum(len(s) for s in stmts))
