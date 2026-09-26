#!/usr/bin/env python3
"""Audit wave134 (26/09/26): edge function fixes.

1. Program Development (progdev) was missing from the team lists of 14 functions: the leadership
   pipeline, the upload preview and the request suggestions could never file anything under it,
   and the digests printed "undefined" for it. The old labels (Fundraising and Grants, Ops and
   Program Dev Montreal) are brought in line with the Hub.
2. transcript-requests, finance-import and hub-edit called api.anthropic.com directly (that account
   is out of credit, so they failed); they now go through the llm router like every other AI job.
   transcript-requests no longer marks a meeting as scanned when every model pass failed (it is
   retried on the next run), and n_found counts everything a scan produced.
Run from the repo root: python3 build/data/audit134_fn_edits.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FN = os.path.join(ROOT, 'fn')
problems = []
changed = set()


def read(name):
    return open(os.path.join(FN, name, 'index.ts'), encoding='utf-8').read()


def write(name, s):
    open(os.path.join(FN, name, 'index.ts'), 'w', encoding='utf-8').write(s)
    changed.add(name)


def rep(name, s, old, new, count=1):
    c = s.count(old)
    if c != count:
        problems.append('%s: found %d (expected %d): %s' % (name, c, count, old[:70].replace('\n', ' ')))
        return s
    return s.replace(old, new)


LABELS = [
    ("'Fundraising and Grants'", "'Fundraising and Finances'"),
    ("'Fundraising & Grants'", "'Fundraising & Finances'"),
    ("'Ops and Program Dev Montreal'", "'Operations Montreal'"),
    ("'Ops and Program Dev Toronto'", "'Operations Toronto'"),
]


def add_progdev(name, s):
    """progdev next to opsmtl in DEPTS lists and label maps; the codes listed in prompt text"""
    # multi-line and inline DEPTS arrays
    s2 = re.sub(r"(const DEPTS\s*=\s*\[\s*'opsmtl',)(\s*)(?!'progdev')", lambda m: m.group(1) + m.group(2) + "'progdev'," + m.group(2), s)
    # label maps: an opsmtl entry followed by a line break (object literal on several lines) or inline
    def lab(m):
        return m.group(0) + m.group(2) + "progdev: 'Program Development',"
    if 'progdev:' not in s2:
        s2 = re.sub(r"(opsmtl: '[^']*',)(\s*)(?=opsto:)", lambda m: m.group(1) + m.group(2) + "progdev: 'Program Development'," + m.group(2), s2)
    for old, new in LABELS:
        s2 = s2.replace(old, new)
    s2 = s2.replace('(opsmtl, opsto, marketing, fundraising, hr, board)', '(opsmtl, progdev, opsto, marketing, fundraising, hr, board)')
    s2 = s2.replace('opsmtl, opsto, marketing, fundraising, hr, or board', 'opsmtl, progdev, opsto, marketing, fundraising, hr, or board')
    s2 = s2.replace('one of opsmtl, opsto, marketing, fundraising, hr, board, org', 'one of opsmtl, progdev, opsto, marketing, fundraising, hr, board, org')
    s2 = s2.replace("['opsmtl', 'opsto', 'marketing', 'fundraising', 'hr', 'board', 'org']", "['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board', 'org']")
    return s2


TEAM_FNS = ['weekly-digest', 'daily-alerts', 'slack-digest', 'build-agenda', 'project-slack', 'slack-command',
            'process-leadership', 'transcript-preview', 'transcript-requests', 'finance-import', 'ask', 'hub-edit']

for name in TEAM_FNS:
    s = read(name)
    s2 = add_progdev(name, s)
    if s2 != s:
        write(name, s2)

# ---- the three direct Anthropic callers go through the llm router ----
ROUTER_HEADERS = "{ 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': '%s', 'x-wa-caller': '%s', 'Content-Type': 'application/json' }"

# transcript-requests
name = 'transcript-requests'
s = read(name)
s = rep(name, s, "    const res = await fetch('https://api.anthropic.com/v1/messages', {\n      method: 'POST',\n      headers: {\n        'x-api-key': key,\n        'anthropic-version': '2023-06-01',\n        'Content-Type': 'application/json'\n      },",
        "    /* audit 26/09/26: through the llm router (the direct Anthropic account is out of credit) */\n    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {\n      method: 'POST',\n      headers: " + (ROUTER_HEADERS % ('transcript_extract', 'transcript-requests')) + ",")
s = rep(name, s, "  const key = await getSecret('ANTHROPIC_API_KEY');\n  if (!key) return json({\n    error: 'ANTHROPIC_API_KEY missing'\n  }, 500);\n",
        "  const key = 'hub-router'; /* audit 26/09/26: the llm router holds the model keys */\n")
# count failures per meeting; all passes failing (the model down) leaves the meeting for the next run
s = rep(name, s, "    scannedN++;\n    let n = 0;\n", "    scannedN++;\n    let n = 0, tried = 0, failed = 0; /* audit 26/09/26 */\n    const before = reqFound + cmtFound + dueFound + winFound + menFound;\n")
s = re.sub(r"\n    \} catch \(_\) \{\}\n", "\n    } catch (e) { failed++; console.warn('transcript-requests pass failed', tx.id, String(e).slice(0, 200)); }\n", s)
s = s.replace("      const body = await callModel(key, REQ_SYSTEM,", "      tried++;\n      const body = await callModel(key, REQ_SYSTEM,")
s = s.replace("        const body2 = await callModel(key, CMT_SYSTEM,", "        tried++;\n        const body2 = await callModel(key, CMT_SYSTEM,")
s = s.replace("        const body3 = await callModel(key, DUE_SYSTEM,", "        tried++;\n        const body3 = await callModel(key, DUE_SYSTEM,")
s = s.replace("        const body4 = await callModel(key, WIN_SYSTEM,", "        tried++;\n        const body4 = await callModel(key, WIN_SYSTEM,")
s = s.replace("        const body5 = await callModel(key, MEN_SYSTEM,", "        tried++;\n        const body5 = await callModel(key, MEN_SYSTEM,")
s = rep(name, s, "    await svc.from('transcript_request_scans').upsert({\n      transcript_id: tx.id,\n      n_found: n,\n      scanned_at: new Date().toISOString()\n    });\n  }\n  return json({",
        "    if (tried > 0 && failed === tried) { scannedN--; continue; } /* every pass failed: try this meeting again next run */\n    n = reqFound + cmtFound + dueFound + winFound + menFound - before; /* everything this scan produced */\n    await svc.from('transcript_request_scans').upsert({\n      transcript_id: tx.id,\n      n_found: n,\n      scanned_at: new Date().toISOString()\n    });\n  }\n  return json({")
if s.count("failed++") < 5:
    problems.append('transcript-requests: expected 5 guarded passes, found %d' % s.count('failed++'))
if s.count('tried++') != 5:
    problems.append('transcript-requests: expected 5 tried++, found %d' % s.count('tried++'))
write(name, s)

# finance-import
name = 'finance-import'
s = read(name)
s = rep(name, s, "  const key = await getSecret('ANTHROPIC_API_KEY');\n  const content: unknown[] = [];", "  const content: unknown[] = [];")
s = rep(name, s, "    const res = await fetch('https://api.anthropic.com/v1/messages', {\n      method: 'POST',\n      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },",
        "    /* audit 26/09/26: through the llm router (route finance_import, Claude models, which read PDF statements) */\n    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {\n      method: 'POST',\n      headers: " + (ROUTER_HEADERS % ('finance_import', 'finance-import')) + ",")
write(name, s)

# hub-edit
name = 'hub-edit'
s = read(name)
s = rep(name, s, "    const key = await getSecret('ANTHROPIC_API_KEY');\n    let lastErr = '';", "    let lastErr = '';")
s = rep(name, s, "      const res = await fetch('https://api.anthropic.com/v1/messages', {\n        method: 'POST',\n        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },",
        "      /* audit 26/09/26: through the llm router */\n      const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {\n        method: 'POST',\n        headers: " + (ROUTER_HEADERS % ('draft', 'hub-edit')) + ",")
write(name, s)

for n in sorted(changed):
    print('changed', n)
if problems:
    print('PROBLEMS:')
    for p in problems:
        print('  ' + p)
    sys.exit(1)
