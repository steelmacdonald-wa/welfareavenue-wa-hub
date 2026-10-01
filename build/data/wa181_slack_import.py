#!/usr/bin/env python3
"""wave181: turn Slack's Member Analytics export (CSV) into SQL for hr_slack_accounts.

  python3 build/data/wa181_slack_import.py <export.csv> <from YYYY-MM-DD> <to YYYY-MM-DD> > out.sql

Each account is linked to its roster person (team_members.id) by the map below (by email first,
then by name where only one person fits; checked by hand on 30/09/26). Unlinked accounts are
people who were on Slack but are not on the roster today. KIND marks accounts that were never
team members (consultants, an organisation's account, a guest)."""
import csv, sys, datetime

LINK = {  # slack_id -> team_members.id
 'U098MAAJKD3': 1, 'U09FT9L4CRY': 21, 'U0B0VPEAX60': 30, 'U0BSJGES45R': 50, 'U0AJKAE3406': 27,
 'U0AFGRFQGJZ': 4, 'U0B0AMWAP6K': 33, 'U09953GHYSV': 32, 'U0ANG0WP56F': 26, 'U09JGQU3AE7': 20,
 'U0B976QLGPL': 43, 'U0BPLTU35LJ': 49, 'U0BN9BTPAF3': 49, 'U0B75EDCR24': 8, 'U057BRKP1R9': 17,
 'U0A7DF871FS': 17, 'U09UW03MJP6': 45, 'U05V9S5SDRA': 29, 'U071ZAJR4CV': 22, 'U0BE514SH9V': 18,
 'U0B59TT2BGT': 16, 'U022GKBSHV2': 39, 'U0AD89B79RC': 11, 'U0B97M9HN3B': 6, 'U0AJT3GCC8M': 10,
 'U0AD52BBW59': 10, 'U088XMU6FH6': 40, 'U0B9PGRFL30': 7, 'U08SNJT0PBQ': 25, 'U08SYN79UE8': 24,
 'U09EBS6QLCD': 12, 'U0AT1BYC9N0': 36, 'U0AFZ65EUGZ': 3, 'U06JLAD6LMU': 23, 'U0B6HSCHMB8': 23,
 'U02308AHH9N': 37, 'U0AQEHR4E31': 38, 'U0223M3FB46': 41, 'U047NTF11KR': 9, 'U0AMTPESHA5': 9,
 'U09KA1MTBGS': 2, 'U09QVV1B2NT': 34, 'U0C3Q4T6UK0': 46, 'U0A1Z43ABD4': 44, 'U0BEGR4QKE1': 19,
 'U0A51EL7AUD': 31, 'U0ASRCNBT2P': 35, 'U0B3N1UU82Z': 28,
}
# linked by first name only (no shared email): worth a confirm
BY_NAME = {'U0B0AMWAP6K', 'U0AD89B79RC', 'U088XMU6FH6', 'U08SYN79UE8', 'U0B75EDCR24', 'U0A51EL7AUD'}
KIND = {  # accounts that were never team members
 'U08JR4L6D5M': 'external', 'U08JR4L7YCF': 'external', 'U08JR4KECG7': 'external', 'U08JR4JS5CP': 'external',  # 180 Degrees Consulting
 'U07BP5Q3CHM': 'external',  # entelosnetwork, an organisation's account
 'U022P38RZJ5': 'external',  # a multi-channel guest
}
# the same person with two accounts and no roster row: group them
SAME = {'U09V6NH1NRE': 'U072R31C4PJ'}  # Haleema Ma (invite never accepted) -> Haleema Masud

def d(s):
    s = (s or '').strip()
    return datetime.datetime.strptime(s, '%b %d, %Y').date().isoformat() if s else None

def q(v):
    if v is None or v == '': return 'null'
    if isinstance(v, int): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
frm, to = sys.argv[2], sys.argv[3]
out = []
for r in rows:
    sid = r['User ID'].strip()
    person = 'tm:%d' % LINK[sid] if sid in LINK else 'slack:' + SAME.get(sid, sid)
    vals = [sid, r['Name'].strip(), r['Display name'].strip(), r['Email'].strip().lower(), r['What I Do'].strip() or None,
            r['Account type'].strip(), d(r['Account created (UTC)']), d(r['Claimed Date (UTC)']), d(r['Deactivated date (UTC)']),
            int(r['Days active'] or 0), int(r['Messages posted'] or 0), int(r['Messages posted in channels'] or 0), int(r['Reactions added'] or 0),
            frm, to, LINK.get(sid), person, KIND.get(sid, 'team'), 'name' if sid in BY_NAME else ('email' if sid in LINK else None)]
    out.append('(' + ','.join(q(v) for v in vals) + ')')
print('insert into public.hr_slack_accounts (slack_id, full_name, display_name, email, title, account_type, created_on, claimed_on, deactivated_on, days_active, messages, channel_messages, reactions, period_from, period_to, team_member_id, person_key, kind, link_by) values')
print(',\n'.join(out))
print('on conflict (slack_id) do update set full_name=excluded.full_name, display_name=excluded.display_name, email=excluded.email, title=excluded.title, account_type=excluded.account_type, created_on=excluded.created_on, claimed_on=excluded.claimed_on, deactivated_on=excluded.deactivated_on, days_active=excluded.days_active, messages=excluded.messages, channel_messages=excluded.channel_messages, reactions=excluded.reactions, period_from=excluded.period_from, period_to=excluded.period_to, imported_at=now();')
