#!/usr/bin/env python3
"""wave140 (26/09/26): the Drive mining in the Avenue Academy and in who sees what.

Writes build/data/wa140_academy.sql:
  - a new lesson in Welfare Avenue foundations, "Our story since 2020" (lesson:story), from the 18 milestones of
    Our story (all of them visible to everyone), with a knowledge check;
  - the page tours for Our story, Partners and the Document finder (tour:ourstory, tour:partners, tour:documents);
  - lesson 52 (our partners) points to the Partners page; Hub module 8 says the chat assistant knows our story;
  - the access profiles: Our story and Partners for every profile, the Document finder for every profile but Board;
    what leaders can do there; change_log rows.
Links inside a lesson to a Hub page (#ourstory, #partners, #documents) open in the Hub (wave140 front end).
Re-runnable: rows are keyed (on conflict / where not already there).
usage: python3 build/data/wa140_academy.py"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def j(o):
    return q(json.dumps(o, ensure_ascii=False)) + '::jsonb'


def no_dash(o):
    s = json.dumps(o, ensure_ascii=False)
    assert '—' not in s and '–' not in s, 'an em or en dash slipped in'
    return o


STORY = no_dash({
    'v': 1, 'cover': 'gold',
    'summary': 'How Welfare Avenue began in March 2020, how a student project became a registered charity, and how it grew beyond Montreal. Every moment here is in Our story, with where it came from.',
    'chapters': [
        {'id': 'began', 't': 'How it began', 'blocks': [
            {'type': 'lead', 'text': "Welfare Avenue began in March 2020, during Montreal's first COVID-19 lockdown, when our founder started bringing food to people living on the emptied downtown streets."},
            {'type': 'p', 'text': "An awareness video in April brought the first donations and volunteers. Through 2020 the food runs went out every week from the founder's car, backed by friends, community donors and the Vanier College Student Association, our first backer. By the fall the project had its name, a founding team and public volunteer sign-ups, and was feeding up to 200 people a week, with hygiene products and clothing added to the meals."},
            {'type': 'stats', 'items': [
                {'n': '2020', 'l': 'Welfare Avenue begins in Montreal'},
                {'n': '2021', 'l': 'incorporated as a Quebec nonprofit'},
                {'n': '2023', 'l': 'a registered charity'},
                {'n': '2024', 'l': 'our first serving in Toronto'}
            ]},
            {'type': 'callout', 'tone': 'info', 't': 'Why this matters', 'text': 'When you talk to a volunteer, a partner or a donor, our story is the proof: six years of showing up, week after week. Knowing it lets you tell it well, and accurately.'}
        ]},
        {'id': 'grew', 't': 'From a student project to a charity', 'blocks': [
            {'type': 'p', 'text': 'Between 2021 and 2023 the weekly food runs became an organization, with a name people knew, a legal form and the right to issue donation receipts.'},
            {'type': 'steps', 'items': [
                {'t': 'March 2021: our first major event', 'd': 'With Sportira, outside Berri-UQAM metro: food and essentials for hundreds of people.'},
                {'t': 'June 2021: our own tent', 'd': 'Thanks to the supporters and sponsors who were there from the beginning. It became part of every weekend serving downtown.'},
                {'t': 'October 2021: a Quebec nonprofit', 'd': 'Welfare Avenue was incorporated on 1 October 2021, and the work toward charity status began right away.'},
                {'t': 'May 2022: on the news', 'd': 'After our TikTok videos went viral, CBC Montreal featured our student volunteers, the start of a year of coverage with CityNews and CTV.'},
                {'t': 'Fall 2022: clubs on campus', 'd': 'Welfare Avenue clubs opened at Vanier and Marianopolis colleges, to run fundraisers and volunteering on campus.'},
                {'t': '18 October 2023: a registered charity', 'd': 'The Canada Revenue Agency registered Welfare Avenue, so we can issue official donation receipts.'},
                {'t': 'Fall 2023: 180 volunteering events', 'd': 'And 25 fundraisers since we began, celebrated with the whole team.'}
            ]}
        ]},
        {'id': 'beyond', 't': 'Beyond Montreal', 'blocks': [
            {'type': 'p', 'text': 'From 2024 Welfare Avenue grew beyond one city and one kind of event, while the Sunday servings carried on in Montreal.'},
            {'type': 'steps', 'items': [
                {'t': '2024: a club at Concordia', 'd': 'Concordia students joined the fight against poverty and food insecurity through a new Welfare Avenue club.'},
                {'t': '21 September 2024: our first serving in Toronto', 'd': 'Our new student chapter at the University of Toronto Mississauga served 36 meals.'},
                {'t': 'December 2024: two records', 'd': 'With Adaptavist, 15 volunteers cooked more than 250 meals in under six hours. With Scattered, a holiday gift drive brought over 1,500 gifts to children in hospital.'},
                {'t': 'Fall 2025: Toronto relaunches', 'd': 'A new Toronto branch team formed, and we announced the expansion publicly on 14 November.'},
                {'t': 'Holidays 2025: more than 3,000 gifts', 'd': 'Our second Holiday Gift Basket Drive, with Scattered, CEP and business donors, hand-delivered more than 3,000 gifts across Montreal.'},
                {'t': '14 March 2026: a first event in Ottawa', 'd': 'A pilot with University of Ottawa students: about 20 volunteers served warm meals, clothing and food boxes.'},
                {'t': 'August 2026: a new brand and a Community Kitchen', 'd': 'Service is solidarity, not charity. And six volunteer cooks prepared the Sunday Serving meal together in our first Community Kitchen, with DESTA Black Community Network.'}
            ]}
        ]},
        {'id': 'hub', 't': 'Where our story lives', 'blocks': [
            {'type': 'p', 'text': 'Everything in this lesson, and much more, is in the Hub, read from our own documents, posts and designs. Every moment shows where it came from.'},
            {'type': 'cards', 'items': [
                {'icon': 'book', 't': 'Our story', 'd': 'The timeline since 2020, year by year, with the milestones at the top.'},
                {'icon': 'sparkle', 't': 'Lessons learned', 'd': 'What our own events and programs taught us, as advice for next time.'},
                {'icon': 'handshake', 't': 'Partners', 'd': 'Every organization we have worked with, and the ones we approached.'},
                {'icon': 'search', 't': 'Document finder', 'd': 'Any file in our shared drives and Canva, found by what it is about.'}
            ]},
            {'type': 'links', 'items': [
                {'t': 'Open Our story', 'd': 'Resources, then Our story', 'url': '#ourstory'},
                {'t': 'Read the lessons learned', 'd': 'Our story, then Lessons learned', 'url': '#ourstory/lessons'},
                {'t': 'Open Partners', 'd': 'Resources, then Partners', 'url': '#partners'},
                {'t': 'Open the Document finder', 'd': 'Resources, then Document finder', 'url': '#documents'}
            ]},
            {'type': 'callout', 'tone': 'tip', 't': 'Something missing or wrong?', 'text': 'Leaders can correct, hide or add a moment, a partner or a lesson. If you spot a gap, tell your lead. And the chat assistant knows our story too: ask it when something happened.'}
        ]}
    ],
    'quiz': {'pass': 0.8, 'questions': [
        {'q': 'When did Welfare Avenue begin?', 'a': ['March 2020, during the first COVID-19 lockdown', 'October 2021, when it was incorporated', 'October 2023, when it became a charity'], 'c': 0,
         'why': 'It began in March 2020. Incorporation (2021) and charity status (2023) came later.'},
        {'q': 'What does being a registered charity, since 18 October 2023, let us do?', 'a': ['Skip our annual reporting', 'Issue official donation receipts', 'Serve food without a permit'], 'c': 1,
         'why': 'Registration with the Canada Revenue Agency lets us issue official donation receipts.'},
        {'q': 'Where was our first major event, in March 2021?', 'a': ['At the University of Toronto', 'In Ottawa', 'Outside Berri-UQAM metro, with Sportira'], 'c': 2,
         'why': 'With Sportira, outside Berri-UQAM metro, for hundreds of people.'},
        {'q': 'Which city had our first serving outside Montreal, in September 2024?', 'a': ['Toronto', 'Ottawa', 'Quebec City'], 'c': 0,
         'why': 'Our University of Toronto Mississauga chapter served 36 meals on 21 September 2024. Ottawa followed with a pilot in March 2026.'},
        {'q': 'Where do you find every moment of our story, with where it came from?', 'a': ['Only in the board minutes', 'On the Our story page in the Hub', 'Nowhere yet'], 'c': 1,
         'why': 'Resources, then Our story: every moment, year by year, with its sources.'}
    ]}
})

PARTNERS_CALLOUT = no_dash({'type': 'callout', 'tone': 'tip', 't': 'Every partner since 2020',
                            'text': 'The Partners page in the Hub lists every organization we have worked with since 2020, and the ones we approached: what they did with us, the years, and the moments and documents they appear in. Check it, with the Partner Relations sheet, before you reach out.'})
PARTNERS_LINK = {'type': 'link', 't': 'Open Partners in the Hub', 'd': 'Resources, then Partners', 'url': '#partners'}

TOURS = [
    (199, 'tour:ourstory', 'Page tour: Our story', 'ourstory', 35, 'The timeline since 2020, the milestones, where each moment came from, and the lessons learned.'),
    (200, 'tour:partners', 'Page tour: Partners', 'partners', 36, 'Every organization we have worked with or approached, and where each one stands.'),
    (201, 'tour:documents', 'Page tour: Document finder', 'documents', 37, 'Find any file in our shared drives and Canva by what it is about.'),
]

M8 = ('The chat assistant answers questions from the whole Hub: tasks, decisions, transcripts, org knowledge (restricted meetings stay sealed), '
      'and our story since 2020: what happened when, with which partners, what we learned and where it is written down. '
      'Agendas builds a meeting agenda from the board: type the meeting\'s purpose and it pulls the right tasks and topics; you only see agendas you are part of. '
      'And every page has a "How this page works" button with a visual guide: when in doubt, start there.\n\n'
      'Try it: ask the chat assistant "what is overdue in my department?", then "when did we become a registered charity?", and build one agenda with a purpose line.\n\n'
      'Done when: you know where to ask questions, build agendas, and find help.')
no_dash(M8)

sql = ['-- wave140 (26/09/26): generated by build/data/wa140_academy.py; re-runnable']
# the lesson and the tours (trainings.id is an identity column: update the row by its key, or insert it)
def upsert_training(key, cols):
    sets = ', '.join('%s = %s' % (k, v) for k, v in cols.items())
    names = ', '.join(['key'] + list(cols.keys()))
    vals = ', '.join([q(key)] + list(cols.values()))
    return ("do $w$ begin update public.trainings set %s, updated_at = now() where key = %s; "
            "if not found then insert into public.trainings (%s, updated_at) values (%s, now()); end if; end $w$;" % (sets, q(key), names, vals))


sql.append(upsert_training('lesson:story', {
    'title': q('Our story since 2020'), 'kind': q('lesson'), 'category': q('Welfare Avenue'), 'path_group': q('Welfare Avenue foundations'), 'sort': '3', 'minutes': '10', 'xp': '60',
    'source': q('hub'), 'active': 'true',
    'description': q('How a student project that began in March 2020 became a registered charity serving Montreal, Toronto and beyond, and where our whole story lives in the Hub.'),
    'body': j(STORY)}))
for _id, key, title, tab, sort, desc in TOURS:
    sql.append(upsert_training(key, {
        'title': q(title), 'kind': q('tour'), 'category': q('Hub tours'), 'path_group': q('Hub page tours'), 'sort': str(sort), 'minutes': '2', 'xp': '20',
        'source': q('hub'), 'active': 'true', 'description': q(desc), 'body': j({'tour': tab, 'tab': tab})}))
# lesson 52: a callout and a link to the Partners page, after the partner groups in "Who we work with"
sql.append("update public.trainings t set body = jsonb_set(t.body, '{chapters}', (select jsonb_agg(case when c->>'id' = 'who' then jsonb_set(c, '{blocks}', "
           "(select jsonb_agg(b order by n) from (select b, n::numeric as n from jsonb_array_elements(c->'blocks') with ordinality e(b, n) "
           "union all select %s, 2.5 union all select %s, 2.6) z)) else c end order by o) from jsonb_array_elements(t.body->'chapters') with ordinality x(c, o))), updated_at = now() "
           "where t.key = 'lesson:partners' and not (t.body::text like '%%Every partner since 2020%%');"
           % (j(PARTNERS_CALLOUT), j(PARTNERS_LINK)))
# Hub module 8
sql.append("update public.trainings set description = %s, updated_at = now() where id = 46 and title like 'Hub module 8%%' and description not like '%%our story since 2020%%';" % q(M8))
# access profiles
sql.append("update public.hub_access_profiles set pages = pages || jsonb_build_object('ourstory', 'all'), updated_by = 'Hub release (wave140)', updated_at = now() where not (pages ? 'ourstory');")
sql.append("update public.hub_access_profiles set pages = pages || jsonb_build_object('partners', 'all'), updated_by = 'Hub release (wave140)', updated_at = now() where not (pages ? 'partners');")
sql.append("update public.hub_access_profiles set pages = pages || jsonb_build_object('documents', case when key = 'board' then 'none' else 'all' end), updated_by = 'Hub release (wave140)', updated_at = now() where not (pages ? 'documents');")
CAN_EXEC = 'Correct, hide and add moments, partners and lessons in Our story and Partners'
CAN_BOARD = 'Our story and Partners, the leadership moments included (reading only)'
LEAD_ADD = ' A lead also corrects, hides and adds moments, partners and lessons in Our story and Partners.'
sql.append("update public.hub_access_profiles set can = coalesce(can, '[]'::jsonb) || jsonb_build_array(%s::text) where key = 'executive' and not (coalesce(can, '[]'::jsonb) ? %s);" % (q(CAN_EXEC), q(CAN_EXEC)))
sql.append("update public.hub_access_profiles set can = coalesce(can, '[]'::jsonb) || jsonb_build_array(%s::text) where key = 'board' and not (coalesce(can, '[]'::jsonb) ? %s);" % (q(CAN_BOARD), q(CAN_BOARD)))
sql.append("update public.hub_access_profiles set lead_note = coalesce(lead_note, '') || %s where key in ('marketing', 'fundraising', 'progdev', 'opsmtl', 'opsto', 'hr') and coalesce(lead_note, '') <> '' and lead_note not like '%%Our story and Partners%%';" % q(LEAD_ADD))
for key in ['admin', 'executive', 'marketing', 'fundraising', 'progdev', 'opsmtl', 'opsto', 'hr', 'board']:
    docs = 'nobody (directors read Our story and Partners)' if key == 'board' else 'everyone'
    sql.append("insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) select 'access_profile', %s, 'pages', null, %s, 'Hub release (wave140)' "
               "where not exists (select 1 from public.change_log where entity_type = 'access_profile' and entity_id = %s and changed_by = 'Hub release (wave140)' and field = 'pages');"
               % (q(key), q('Our story: everyone; Partners: everyone; Document finder: ' + docs + ' (new pages)'), q(key)))
sql.append("insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) select 'training', 'lesson:story', 'created', null, "
           "'Our story since 2020 (Welfare Avenue foundations), the tours of Our story, Partners and the Document finder, a Partners link in lesson 52 and Hub module 8', 'Hub release (wave140)' "
           "where not exists (select 1 from public.change_log where entity_type = 'training' and entity_id = 'lesson:story' and changed_by = 'Hub release (wave140)');")

out = os.path.join(HERE, 'wa140_academy.sql')
open(out, 'w', encoding='utf-8').write('\n'.join(sql) + '\n')
print('wrote', out, sum(len(s) for s in sql), 'chars,', len(sql) - 1, 'statements')
