#!/usr/bin/env python3
"""wave140: the Canva designs a reader collected (scratchpad/canva/*.json) into drive_inventory and drive_text,
with phone numbers, emails, chat invite links, door and lock codes and long ID numbers redacted first.
Writes build/data/wa140_canva.sql (not committed: it holds the design text)."""
import glob, hashlib, json, os, re, sys
SRC = sys.argv[1]
OUT = sys.argv[2]
SENS = {'DAGxYqqqDnE': 'board', 'DAGxaVw5azE': 'board', 'DAGoBpQdKIs': 'leadership', 'DAGv5IpWSW0': 'leadership', 'DAGsqab_q3o': 'leadership'}
PHONE = re.compile(r'(?<![\w/])(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}(?!\d)')
EMAIL = re.compile(r'[\w.+\-]+@[\w\-]+\.[\w.\-]+')
CHAT = re.compile(r'https?://(?:chat\.whatsapp\.com|wa\.me|t\.me|discord\.gg)/\S+', re.I)
CODE = re.compile(r'(?i)\b(code|combo|combination|padlock|lock|locker|password|passcode|pin|mot de passe|enter)(\s*(?:#|no\.?|number|is|:|=|-)?\s*:?\s*)([A-Za-z]*\d[\w\-]*(?:\s*[-/]\s*\d+)*)')
MASK_DIGITS = {'DAGlfTq7Gyk'}  # the storage unit guide: door, locker and padlock codes
LONGNUM = re.compile(r'(?<![\w$.,])\d{7,10}(?![\w.,])')
def redact(t):
    n0 = len(t)
    t = CHAT.sub('[link removed]', t)
    t = EMAIL.sub('[email removed]', t)
    t = PHONE.sub('[phone removed]', t)
    t = CODE.sub(lambda m: m.group(1) + m.group(2) + '[code removed]', t)
    t = LONGNUM.sub('[number removed]', t)
    return t
def q(s):
    return "'" + str(s).replace("'", "''") + "'" if s is not None else 'null'
def ts(s):
    return q(s) + '::timestamptz' if s else 'null'
rows, texts, stats = [], [], []
for fp in sorted(glob.glob(os.path.join(SRC, '*.json'))):
    d = json.load(open(fp, encoding='utf8'))
    text = (d.get('text') or '').strip()
    if len(text) < 150: continue
    red = redact(text)
    if d['id'] in MASK_DIGITS: red = re.sub(r'\d', '#', red)
    stats.append((d['id'], len(text), text.count('\n'), sum(red.count(x) for x in ['[phone removed]', '[email removed]', '[link removed]', '[code removed]', '[number removed]'])))
    fid = 'canva:' + d['id']
    sens = SENS.get(d['id'])
    rows.append("(%s, %s, 'application/vnd.canva.design', 'canva', %s, %s, 'Canva', %s, 'gold', 'Canva design, read on 26/09/26', %s, now())" % (
        q(fid), q(d.get('title') or d['id']), ts(d.get('created')), ts(d.get('updated')), q(d.get('url') or ('https://www.canva.com/design/' + d['id'] + '/view')), q(sens)))
    h = hashlib.sha256(re.sub(r'\s+', ' ', red.lower())[:40000].encode()).hexdigest()[:32]
    texts.append("(%s, %s, %d, %s, 'canva', now())" % (q(fid), q(red), len(red), q(h)))
sql = ("insert into public.drive_inventory (file_id, name, mime, source, created_time, modified_time, path, web_url, triage, triage_reason, sensitivity, seen_at) values\n" + ',\n'.join(rows) +
       "\non conflict (file_id) do update set name = excluded.name, created_time = excluded.created_time, modified_time = excluded.modified_time, web_url = excluded.web_url, sensitivity = excluded.sensitivity, seen_at = now();\n\n")
for i in range(0, len(texts), 10):
    sql += ("insert into public.drive_text (file_id, text, chars, hash, method, extracted_at) values\n" + ',\n'.join(texts[i:i + 10]) +
            "\non conflict (file_id) do update set text = excluded.text, chars = excluded.chars, hash = excluded.hash, method = excluded.method, extracted_at = now();\n\n")
open(OUT, 'w', encoding='utf8').write(sql)
print(len(rows), 'designs;', sum(s[1] for s in stats), 'chars;', sum(s[3] for s in stats), 'redactions')
for s in sorted(stats, key=lambda x: -x[3])[:8]: print(s)
