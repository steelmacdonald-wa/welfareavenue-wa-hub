#!/usr/bin/env python3
"""wave124 harness rows: fundraising events, goals, birthdays, posts. Idempotent."""
import json, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'test', 'fixture.json')
f = json.load(open(P))
def ev(i, title, season, prec, s, e, timing, partners, tmin, tmax, notes, status, proj=None, raised=None, result=None, sort=100):
    return {'id': i, 'title': title, 'plan': '2026-27', 'season': season, 'precision': prec, 'start_date': s, 'end_date': e, 'timing': timing, 'partners': partners, 'target_min': tmin, 'target_max': tmax, 'target_note': None, 'notes': notes, 'status': status, 'lead': None, 'project_id': proj, 'raised': raised, 'result_note': result, 'sop_training_id': None, 'sort': sort, 'source': 'plan', 'created_by': None, 'updated_by': None, 'created_at': '2026-08-01T00:00:00Z', 'updated_at': '2026-08-01T00:00:00Z'}
f['fund_events'] = [
    ev(1, 'Flag Football 2026', 'summer-2026', 'day', '2026-08-08', None, 'August', 'MTL Flag Plus; Poulet Rouge (sponsor)', 4000, None, '12 teams signed within two weeks.', 'planned', 12, None, None, 10),
    ev(2, 'Rally Paper 2026', 'summer-2026', 'day', '2026-08-22', '2026-08-23', 'August', 'JMCC, plus student organizations', None, None, 'Multi-organization collaboration.', 'planned', 11, None, None, 20),
    ev(3, 'Thrift Fashion Show', 'fall-2026', 'month', '2026-08-01', '2026-08-31', 'August', 'Co-host a larger organization', 3000, 4000, 'Feeds the Gift Basket Drive.', 'planned', None, None, None, 30),
    ev(4, 'Gift Basket Drive 2026', 'fall-2026', 'month', '2026-12-01', '2026-12-31', 'December', 'Operations-led', None, None, 'Runs near Christmas.', 'planned', 13, None, None, 40),
    ev(5, 'JMCC offload events', 'fall-2026', 'range', '2026-07-01', '2026-10-31', 'July to October', 'JMCC', 2500, None, 'Usually two events.', 'confirmed', None, None, None, 50),
    ev(6, "St. Patrick's Party at Reggie's", 'winter-2027', 'day', '2027-03-17', None, 'March 17', 'Co-host a club', None, None, 'Book early January.', 'planned', None, None, None, 60),
    ev(7, 'Corporate Volunteering', 'winter-2027', 'flexible', None, None, 'Flexible', 'Corporate partners', None, None, 'Ties in with the kitchen.', 'planned', None, None, None, 100),
    ev(8, 'Flag Football 2025', 'summer-2026', 'day', '2026-07-12', None, 'July', 'MTL Flag Plus', 3000, None, 'Last year.', 'done', None, 2600, '11 teams.', 5),
    ev(9, 'Auction', 'backlog', 'none', None, None, 'Not yet scheduled', None, None, None, None, 'idea', None, None, None, 220),
    ev(10, 'Tabling at Montreal events', 'backlog', 'none', None, None, 'Not yet scheduled', None, None, None, 'A table at city events.', 'idea', None, None, None, 270),
]
f['hub_birthdays'] = [
    {'email': 'ian.odhiambo@welfareavenue.com', 'month': 8, 'day': 14, 'share': 'everyone', 'updated_at': '2026-08-01T00:00:00Z'},
    {'email': 'kahkashan.ansary@welfareavenue.com', 'month': 8, 'day': 6, 'share': 'everyone', 'updated_at': '2026-08-01T00:00:00Z'},
    {'email': 'suhaib.abdillahi@welfareavenue.com', 'month': 9, 'day': 2, 'share': 'team', 'updated_at': '2026-08-01T00:00:00Z'},
]
hs = f['hub_settings']
if not any(h['key'] == 'fund_goals' for h in hs):
    hs.append({'key': 'fund_goals', 'value': {'plan': '2026-27', 'source': 'Fundraising Events Calendar 2026-27', 'minimum': 10000, 'healthy': 15000, 'target': 20000, 'notes': ['$10,000 to $15,000 a year runs Welfare Avenue at its current level.', '$20,000 is the year over year target.'], 'planning': ['Collaboration is the default.', 'Cap each season at three to four events.']}, 'updated_at': '2026-09-25T17:00:00Z', 'updated_by': 'wa124'})
f['social_posts'] = [
    {'id': 1, 'platform': 'instagram', 'url': 'https://instagram.com/p/x1', 'kind': 'image', 'caption': 'Thank you to everyone who came out to Flag Football!', 'published_at': '2026-08-09T15:00:00Z', 'views': 1200, 'likes': 88, 'comments': 6},
    {'id': 2, 'platform': 'linkedin', 'url': 'https://www.linkedin.com/feed/update/x2', 'kind': 'post', 'caption': 'Big news: the community kitchen pilot starts August 23.', 'published_at': '2026-08-04T14:00:00Z', 'views': 460, 'likes': 16, 'comments': 0},
]
f['content_posts'] = [
    {'id': 1, 'title': 'Community kitchen pilot recap', 'platforms': ['instagram', 'facebook'], 'format': 'carousel', 'scheduled_at': '2026-08-25T16:00:00Z', 'status': 'scheduled', 'published_at': None, 'campaign': 'Kitchen', 'owner': 'Joy'},
]
ev_hub = [e for e in (f.get('hub_events') or []) if e.get('id') != 'w124meet1']  # w124meet1 duplicated ev4 (the Marketing Meeting)
def meet(i, summary, start, end, organizer, emails, dept, link=None):
    return {'id': i, 'calendar_id': 'hub', 'recurring_event_id': None, 'summary': summary, 'description': '', 'location': '', 'start_at': start, 'end_at': end, 'all_day': False, 'status': 'confirmed', 'organizer': organizer, 'attendees': [], 'attendee_emails': emails, 'meet_link': link, 'html_link': None, 'department': dept, 'updated_at': '2026-08-01T00:00:00Z', 'synced_at': '2026-08-01T00:00:00Z'}
for row in [
    meet('w124meet2', 'Weekly Fundraising Meeting', '2026-08-13T23:30:00Z', '2026-08-14T00:15:00Z', 'amanda.zoldak@welfareavenue.com', ['amanda.zoldak@welfareavenue.com', 'hub@welfareavenue.com'], 'fundraising'),
    meet('w124board1', 'Board of Directors Meeting', '2026-08-19T23:00:00Z', '2026-08-20T00:30:00Z', 'suhaib.abdillahi@welfareavenue.com', ['consult.tamaraangeline@gmail.com', 'suhaib.abdillahi@welfareavenue.com', 'hub@welfareavenue.com'], 'board', 'https://meet.google.com/brd-mtng-xyz'),
]:
    if not any(e.get('id') == row['id'] for e in ev_hub): ev_hub.append(row)
f['hub_events'] = ev_hub
json.dump(f, open(P, 'w'), ensure_ascii=False)
print('fixture: fund_events', len(f['fund_events']), 'birthdays', len(f['hub_birthdays']), 'hub_events', len(f['hub_events']))
