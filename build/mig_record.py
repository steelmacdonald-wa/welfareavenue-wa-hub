#!/usr/bin/env python3
"""Append the migration record to a SQL file, so the staged run applies it and records it in one go:
  python3 build/mig_record.py <file.sql> <version YYYYMMDDHHMMSS> <name>  ->  <file>.rec.sql
The statements are split exactly as build/sql_stage.py splits them (trailing ';' dropped in the record) and
recorded in supabase_migrations.schema_migrations with dollar quoting ($m$)."""
import re, sys
path, version, name = sys.argv[1], sys.argv[2], sys.argv[3]
assert re.fullmatch(r'\d{14}', version) and re.fullmatch(r'[a-z0-9_]+', name)
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
body = [s[:-1].rstrip() if s.endswith(';') else s for s in stmts]
assert not any('$m$' in s for s in body), 'a statement contains $m$'
rec = ("insert into supabase_migrations.schema_migrations (version, name, statements) values ('" + version + "', '" + name + "', array[" +
       ','.join('$m$' + s + '$m$' for s in body) + "]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;\n")
out = path[:-4] + '.rec.sql' if path.endswith('.sql') else path + '.rec.sql'
open(out, 'w', encoding='utf8').write(src.rstrip() + '\n\n-- the record\n' + rec)
print(out, len(body), 'statements recorded')
