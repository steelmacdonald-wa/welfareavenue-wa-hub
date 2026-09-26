#!/usr/bin/env python3
"""Write docs/DATA_MODEL.md from the schema comments (build/data/wa134_comments.sql and later *_comments.sql).

The comments live in the database (COMMENT ON), where agents read them; this makes the same text readable in
the repo, grouped by area as the comments file groups it. Run: python3 build/gen_data_model.py
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sorted(glob.glob(os.path.join(ROOT, 'build', 'data', '*_comments.sql')))
sections = []          # [(title, [(kind, name, text)])]
cur = None
pat = re.compile(r"^comment on (table|view|column|function) (public\.[^ ]+(?: ?\([^)]*\))?) is '(.*)';$")
for f in files:
    lines = open(f, encoding='utf-8').read().split('\n')
    for i, line in enumerate(lines):
        if line.startswith('-- ') and i > 0 and lines[i - 1].startswith('-- ----') and i + 1 < len(lines) and lines[i + 1].startswith('-- ----'):
            cur = (line[3:].strip(), []); sections.append(cur); continue
        if line.startswith('-- added with'):
            cur = ('Added with wave134', []); sections.append(cur); continue
        m = pat.match(line)
        if m:
            if cur is None:
                cur = ('Other', []); sections.append(cur)
            cur[1].append((m.group(1), m.group(2).replace('public.', ''), m.group(3).replace("''", "'")))
out = ['# Welfare Avenue Hub: the data model', '',
       'Generated from the schema comments by `build/gen_data_model.py` (26/09/26). The comments themselves live in the database (`COMMENT ON`), so an agent reading the schema sees the same text. When a table or column changes, update its comment in the same migration and regenerate this file.', '',
       '## Conventions', '',
       '- **Team code**: one of `opsmtl`, `progdev`, `opsto`, `marketing`, `fundraising`, `hr`, `board`. `dept_meta` is the list, with each team\'s `label`, `short_label`, `sort` and `color`. No foreign key enforces the code yet.',
       '- **People**: `team_members.id` is the person key for staff and the board; `volunteer_people.id` for volunteers. Many older columns hold a display name (usually a first name) or an email instead; the comments say which.',
       '- **Done**: `dept_tasks.done` (with `closed_at`) is the truth; `dept_tasks.status` is a legacy free-text label.',
       '- **Confidentiality**: `board_only`, `confidential`, `visibility` (NULL, empty, department, leadership, private) and, for tasks and projects, `banked_at` (the bank). Edge functions use the service role and must apply these filters themselves.',
       '- **Service role**: edge functions and cron jobs; they bypass row-level security.',
       '- **Audit trail**: `change_log` (who changed what); job runs are also written there today.', '']
for title, items in sections:
    if not items:
        continue
    out.append('## ' + title)
    out.append('')
    tables = [x for x in items if x[0] in ('table', 'view')]
    cols = [x for x in items if x[0] == 'column']
    fns = [x for x in items if x[0] == 'function']
    for kind, name, text in tables:
        out.append('### `' + name + '`' + (' (view)' if kind == 'view' else ''))
        out.append('')
        out.append(text)
        mine = [c for c in cols if c[1].split('.')[0] == name]
        if mine:
            out.append('')
            for _, cname, ctext in mine:
                out.append('- `' + cname.split('.', 1)[1] + '`: ' + ctext)
        out.append('')
    orphan_cols = [c for c in cols if c[1].split('.')[0] not in [t[1] for t in tables]]
    if orphan_cols:
        for _, cname, ctext in orphan_cols:
            out.append('- `' + cname + '`: ' + ctext)
        out.append('')
    if fns:
        out.append('Functions:')
        out.append('')
        for _, fname, ftext in fns:
            out.append('- `' + fname + '`: ' + ftext)
        out.append('')
open(os.path.join(ROOT, 'docs', 'DATA_MODEL.md'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('docs/DATA_MODEL.md', sum(len(s[1]) for s in sections), 'comments in', len(sections), 'sections')
