#!/usr/bin/env python3
"""wave123 harness rows: request fields, notes, Hub inbox decisions, team inbox settings. Idempotent."""
import json, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'test', 'fixture.json')
f = json.load(open(P))
reqs = f['dept_requests']
by = {r['id']: r for r in reqs}
for r in reqs:
    r.setdefault('priority', 'normal'); r.setdefault('needed_by', None); r.setdefault('slack', None); r.setdefault('mail_id', None)
    rb = r.get('requested_by') or ''
    if 'Steel' in rb: r['requested_email'] = 'steel.macdonald@welfareavenue.com'
    r.setdefault('requested_email', None)
    r.setdefault('source', 'meeting' if rb.startswith('Meeting AI') else 'requests')
if 6 in by:
    by[6]['slack'] = {'channel': 'social-media', 'channel_id': 'C022ALLM1HR', 'ts': '1786000000.000100', 'url': 'https://welfareavenue.slack.com/archives/C022ALLM1HR/p1786000000000100', 'at': '2026-08-04T15:00:00Z'}
    by[6]['status'] = 'received'; by[6]['assignee'] = 'Ian'
extra = [
    {'id': 12, 'type_key': 'design-request', 'department': 'marketing', 'title': 'Poster for the October food drive', 'details': {'Item to design': 'Poster, 11x17 and an Instagram square', 'Context and details': 'For the October 18 food drive at the community centre. Use the new brand colours.', 'Needed by date': '2026-08-09'}, 'status': 'requested', 'requested_by': 'Amanda Zoldak', 'requested_email': 'amanda.zoldak@welfareavenue.com', 'created_at': '2026-08-05T14:20:00+00:00', 'updated_at': None, 'updated_by': None, 'done': False, 'done_at': None, 'assignee': None, 'needed_by': '2026-08-09', 'priority': 'urgent', 'source': 'requests', 'mail_id': None, 'slack': {'error': 'could not post: #social-media (the bot is not in it)', 'at': '2026-08-05T14:20:05Z'}},
    {'id': 13, 'type_key': 'reimbursement', 'department': 'fundraising', 'title': 'Gloves and containers for Sunday', 'details': {'Total amount (CAD)': '48.20', 'Items and prices': 'Gloves 18.20, containers 30.00', 'Date of purchase': '2026-08-02'}, 'status': 'reimbursement sent', 'requested_by': 'Steel MacDonald', 'requested_email': 'steel.macdonald@welfareavenue.com', 'created_at': '2026-08-02T18:00:00+00:00', 'updated_at': '2026-08-04T12:00:00+00:00', 'updated_by': 'Daniela', 'done': True, 'done_at': '2026-08-04T12:00:00+00:00', 'assignee': 'Daniela', 'needed_by': None, 'priority': 'normal', 'source': 'requests', 'mail_id': None, 'slack': None},
    {'id': 14, 'type_key': None, 'department': 'progdev', 'title': 'Meal numbers for the DESTA report', 'details': {'What is needed': 'Meals served per month since January, and volunteers per serving.'}, 'status': 'requested', 'requested_by': 'Steel MacDonald', 'requested_email': 'steel.macdonald@welfareavenue.com', 'created_at': '2026-08-06T10:00:00+00:00', 'updated_at': None, 'updated_by': None, 'done': False, 'done_at': None, 'assignee': 'Shima', 'needed_by': '2026-08-12', 'priority': 'normal', 'source': 'requests', 'mail_id': None, 'slack': {'channel': 'program-development', 'channel_id': 'C099W3SPQ73', 'ts': '1786100000.000200', 'url': 'https://welfareavenue.slack.com/archives/C099W3SPQ73/p1786100000000200', 'at': '2026-08-06T10:00:04Z'}},
]
have = {r['id'] for r in reqs}
for x in extra:
    if x['id'] not in have: reqs.append(x)
f['request_notes'] = [
    {'id': 1, 'request_id': 6, 'author': 'Ian Odhiambo', 'email': 'ian.odhiambo@welfareavenue.com', 'body': 'On it. Do we have photos from the last kitchen day we can use?', 'created_at': '2026-08-04T16:00:00+00:00'},
    {'id': 2, 'request_id': 6, 'author': 'Steel MacDonald', 'email': 'steel.macdonald@welfareavenue.com', 'body': 'Yes, in the photo library under Kitchen.', 'created_at': '2026-08-04T17:30:00+00:00'},
]
cl = f.setdefault('change_log', [])
if not any(c.get('entity_type') == 'request' and c.get('entity_id') == '6' and c.get('field') == 'status' for c in cl):
    cl.append({'id': 99001, 'entity_type': 'request', 'entity_id': '6', 'field': 'status', 'old_value': 'requested', 'new_value': 'received', 'changed_by': 'Ian Odhiambo', 'changed_at': '2026-08-04T15:40:00+00:00', 'board_only': False})
    cl.append({'id': 99002, 'entity_type': 'request', 'entity_id': '6', 'field': 'assignee', 'old_value': None, 'new_value': 'Ian', 'changed_by': 'Ian Odhiambo', 'changed_at': '2026-08-04T15:41:00+00:00', 'board_only': False})
mail = {m['id']: m for m in f['hub_mail']}
for m in f['hub_mail']:
    for k in ('notify', 'team_state', 'team_done_by', 'team_done_at', 'assignee', 'request_id'): m.setdefault(k, None)
if 1 in mail: mail[1]['notify'] = {'department': 'fundraising', 'decision': 'notify', 'p': 0.86, 'why': 'deadline', 'why_conf': 0.8, 'ask': 0.3, 'by': 'jev', 'channel': 'fundraising', 'channel_id': 'C02342H9ZND', 'ts': '1786000500.000300', 'url': 'https://welfareavenue.slack.com/archives/C02342H9ZND/p1786000500000300', 'at': '2026-08-06T13:02:00Z'}
if 2 in mail: mail[2]['notify'] = {'department': 'marketing', 'decision': 'file', 'p': 0.31, 'why': 'fyi', 'why_conf': 0.7, 'ask': 0.2, 'by': 'jev', 'at': '2026-08-05T20:02:00Z'}
if 6 not in mail:
    f['hub_mail'].append({'id': 6, 'gmail_id': 'g6', 'internal_date': '2026-08-06T09:00:00+00:00', 'from_email': 'events@ymca-example.org', 'from_name': 'Dana (YMCA)', 'subject': 'Can your team make a flyer for our joint drive?', 'title': 'YMCA asks for a flyer for the joint clothing drive', 'summary': 'The YMCA wants a co-branded flyer for the September 14 clothing drive, with both logos, by August 20.', 'kind': 'update', 'department': 'marketing', 'amount': None, 'due_date': '2026-08-20', 'status': 'filed', 'filed': {'type': 'update', 'id': 900, 'department': 'marketing'}, 'attachments': [{'filename': 'ymca-logo.png'}], 'links': [], 'error': None, 'reason': 'model', 'body_text': 'Hi Welfare Avenue team,\n\nCould your marketing team make a co-branded flyer for our joint clothing drive on September 14? Both logos please. We would need it by August 20.\n\nThanks,\nDana', 'notify': {'department': 'marketing', 'decision': 'notify', 'p': 0.78, 'why': 'act', 'why_conf': 0.74, 'ask': 0.88, 'by': 'jev', 'channel': 'social-media', 'channel_id': 'C022ALLM1HR', 'ts': '1786010000.000400', 'url': 'https://welfareavenue.slack.com/archives/C022ALLM1HR/p1786010000000400', 'at': '2026-08-06T09:01:00Z'}, 'team_state': None, 'team_done_by': None, 'team_done_at': None, 'assignee': None, 'request_id': None, 'undone_at': None, 'undone_by': None, 'confidence': 0.9, 'snippet': 'Could your marketing team make a co-branded flyer'})
hs = f['hub_settings']
if not any(h['key'] == 'team_inbox' for h in hs):
    hs.append({'key': 'team_inbox', 'value': {'channels': {'opsmtl': ['operations-mtl'], 'progdev': ['program-development'], 'opsto': ['toronto-operations', 'general-toronto'], 'marketing': ['social-media'], 'fundraising': ['fundraising'], 'hr': ['human-resources'], 'board': ['board-of-directors']}, 'post_requests': True, 'thread_updates': True, 'dm_requester': True, 'email_mode': {}}, 'updated_at': '2026-09-25T17:00:00Z', 'updated_by': 'wa123'})
for t in f['request_types']:
    t.setdefault('channel', 'grants' if t.get('key') == 'grant-info' else None)
    t.setdefault('channel_mode', 'brief' if t.get('key') == 'time-off' else 'full')
json.dump(f, open(P, 'w'), ensure_ascii=False)
print('fixture: dept_requests', len(reqs), 'notes', len(f['request_notes']), 'hub_mail', len(f['hub_mail']))
