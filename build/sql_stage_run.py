#!/usr/bin/env python3
"""Stage a long SQL file into public.<table>(run, n, stmt) under a run number, so a dry run can be repeated without
clearing the table (wave205). Same splitting as sql_stage.py (dollar tags may carry digits here).
  python3 build/sql_stage_run.py <file.sql> <table> <run>
Then (MCP): do $$ declare r record; begin for r in select stmt from public.<table> where run = <run> order by n loop execute r.stmt; end loop; end $$;"""
import json, re, sys, hashlib, urllib.request
path, table, run = sys.argv[1], sys.argv[2], int(sys.argv[3])
ANON = open('/tmp/anon.key').read().strip()
URL = 'https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/' + table
src = open(path, encoding='utf8').read()
stmts, cur, in_dollar, tag = [], [], False, None
for line in src.splitlines(keepends=True):
    if not in_dollar and not cur and (line.strip().startswith('--') or not line.strip()):
        continue
    cur.append(line)
    for m in re.finditer(r'\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$', line):
        t = m.group(0)
        if not in_dollar: in_dollar, tag = True, t
        elif t == tag: in_dollar, tag = False, None
    if not in_dollar and line.rstrip().endswith(';'):
        s = ''.join(cur).strip(); cur = []
        if s.lower() in ('begin;', 'commit;'): continue
        stmts.append(s)
if ''.join(cur).strip(): stmts.append(''.join(cur).strip())
rows = [{'run': run, 'n': i + 1, 'stmt': s} for i, s in enumerate(stmts)]
req = urllib.request.Request(URL, data=json.dumps(rows).encode(), method='POST', headers={'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
with urllib.request.urlopen(req, timeout=120) as r: print('staged run', run, len(rows), 'statements', r.status)
print('md5', hashlib.md5(''.join(s for s in stmts).encode()).hexdigest(), 'chars', sum(len(s) for s in stmts))
