#!/usr/bin/env python3
"""wave126 harness rows: the board, its committees, meetings, items and two touchpoints. Idempotent."""
import json, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'test', 'fixture.json')
f = json.load(open(P))
M = [
    (1, 'Kellian', 'Kellian Debargis', ['kellian.debargis@welfareavenue.com'], 'Chair', 'Q3 2026', '2026-09-30', 'active', None, 10),
    (2, 'Steel', 'Steel MacDonald', ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com'], 'Vice chair', 'Q3 2026', '2026-09-30', 'active', 'Founder.', 20),
    (3, 'Daniela', 'Daniela Nita', ['daniela.nita@welfareavenue.com'], 'Treasurer', 'Q1 2027', '2027-03-31', 'active', None, 30),
    (4, 'Tamara', 'Tamara Angeline Medford Williams', ['consult.tamaraangeline@gmail.com'], 'Director', 'Q1 2027', '2027-03-31', 'active', None, 40),
    (5, 'Mohamed', 'Mohamed Ashr', ['mai307@nyu.edu'], 'Director', 'Q2 2027', '2027-06-30', 'active', 'Renewed July 22.', 50),
    (6, 'Suhaib', 'Suhaib Abdillahi', ['suhaib.abdillahi@welfareavenue.com'], 'Member at Large (co-ED)', None, None, 'active', None, 60),
    (7, 'Rima Naim', 'Rima Naim', [], 'Adviser', None, None, 'adviser', None, 80),
    (8, 'Shanada', 'Shanada', [], 'Director', None, None, 'resigned', 'Resigned July 22, 2026; the seat needs a successor.', 90),
]
f['board_members'] = [{'id': a, 'name': b, 'full_name': c, 'emails': d, 'seat': e, 'renewal': g, 'renewal_due': h, 'status': i, 'note': j, 'sort': k, 'updated_at': '2026-08-01T00:00:00Z', 'updated_by': None} for (a, b, c, d, e, g, h, i, j, k) in M]
def com(key, name, color, chair, members, leads, ext, depts, sort):
    return {'key': key, 'name': name, 'color': color, 'purpose': name + ' purpose.', 'chair_id': chair, 'chair_confirmed': False, 'member_ids': members, 'internal_leads': leads, 'external_recruit': ext, 'depts': depts, 'status': 'created', 'note': None, 'sort': sort, 'updated_at': '2026-08-01T00:00:00Z', 'updated_by': None}
f['board_committees'] = [
    com('fundraising', 'Fundraising', '#1F4A3D', 1, [1, 3], ['Rami', 'Amanda'], 'A fundraising or donor professional', ['fundraising'], 10),
    com('people', 'HR & People', '#6F64AB', 2, [2, 1], ['Valex', 'Natasha'], 'Someone from our HR network', ['hr'], 20),
    com('operations', 'Operations', '#2A6F55', 4, [4, 5], ['Tate', 'Shima', 'Ahmed'], 'An operations or logistics professional', ['opsmtl', 'opsto', 'progdev'], 30),
    com('fiduciary', 'Fiduciary', '#C8961F', 3, [3], ['Suhaib (co-ED)'], 'A finance or accounting professional', ['fundraising'], 40),
]
f['board_meetings'] = [
    {'id': 1, 'meets_at': '2026-04-08T22:00:00Z', 'kind': 'board', 'title': 'Board meeting', 'status': 'held', 'agenda_url': None, 'notes_url': 'https://docs.google.com/document/d/x1', 'note': None},
    {'id': 2, 'meets_at': '2026-07-22T22:00:00Z', 'kind': 'board', 'title': 'Q2 board meeting', 'status': 'held', 'agenda_url': 'https://docs.google.com/document/d/x2', 'notes_url': 'https://docs.google.com/document/d/x3', 'note': 'Committees created.'},
    {'id': 3, 'meets_at': None, 'kind': 'strategy', 'title': 'Fiscal year-end strategy session (board and operations)', 'status': 'to schedule', 'agenda_url': None, 'notes_url': None, 'note': None},
    {'id': 4, 'meets_at': '2026-10-19T22:00:00Z', 'kind': 'board', 'title': 'Q3 board meeting', 'status': 'tentative', 'agenda_url': None, 'notes_url': None, 'note': None},
]
I = [
    ('steward', None, 'Term limits and staggered renewals', 'First term one year, renewals up to two.', 'done', 'Board', None, None, 10),
    ('steward', None, 'Renewals due: Steel and Kellian (Q3 2026)', 'Vote the renewals at the next board meeting.', 'todo', 'Board', 'Q3 board meeting', None, 20),
    ('fiduciary', None, 'Signing officers defined', 'President and Treasurer.', 'done', 'Board', None, None, 10),
    ('fiduciary', None, 'Board and organization insurance (D&O)', 'Directors and officers cover.', 'todo', 'Steel', None, 54, 30),
    ('fiduciary', None, 'Publish the required financial disclosures on the website', 'Compliance.', 'at_risk', 'Fiduciary committee', None, None, 40),
    ('strategy', None, 'Fiscal year-end strategy session with operations', 'The deep dive.', 'todo', 'Steel', 'To schedule', None, 10),
    ('strategy', None, 'Step 1: align on assumptions', 'Demand, demographics, climate, funding.', 'todo', 'Board', None, None, 20),
    ('strategy', None, 'Step 2: decide who we serve', 'Our sweet spot.', 'todo', 'Board', None, None, 30),
    ('strategy', None, 'Step 3: revise the plan together', 'Refresh the plan.', 'todo', 'Board', None, None, 40),
    ('strategy', None, 'A strategy block at every board meeting', 'Everyone’s job.', 'standing', 'Steel', None, None, 60),
]
f['board_items'] = [{'id': i + 1, 'job': a, 'committee': b, 'title': c, 'detail': d, 'status': e, 'owner': g, 'due': h, 'task_id': t, 'source': 'July 22 deck', 'sort': s, 'updated_at': '2026-08-01T00:00:00Z', 'updated_by': None} for i, (a, b, c, d, e, g, h, t, s) in enumerate(I)]
f['board_touchpoints'] = [
    {'id': 1, 'committee': 'operations', 'kind': 'internal', 'happened_on': '2026-08-03', 'with_whom': 'Tate', 'summary': 'Volunteer turnout is the bottleneck on Sundays.', 'recommendation': None, 'member_id': 4, 'meeting_id': 4, 'logged_by_email': 'consult.tamaraangeline@gmail.com', 'logged_by_name': 'Tamara', 'created_at': '2026-08-03T20:00:00Z', 'updated_at': '2026-08-03T20:00:00Z'},
    {'id': 2, 'committee': 'fundraising', 'kind': 'external', 'happened_on': '2026-08-04', 'with_whom': 'A donor relations consultant', 'summary': 'Monthly donors before events.', 'recommendation': 'Launch a monthly donor program before the fall events.', 'member_id': 1, 'meeting_id': 4, 'logged_by_email': 'kellian.debargis@welfareavenue.com', 'logged_by_name': 'Kellian', 'created_at': '2026-08-04T20:00:00Z', 'updated_at': '2026-08-04T20:00:00Z'},
]
json.dump(f, open(P, 'w'), ensure_ascii=False)
print('fixture: board members', len(f['board_members']), 'committees', len(f['board_committees']), 'items', len(f['board_items']), 'touchpoints', len(f['board_touchpoints']))
