#!/usr/bin/env python3
"""wave205 (04/10/26): the organizational goals FY27 to FY31, exactly as the approved draft says.

Source of truth: the Claude Doc "29/09/26 - Welfare Avenue Organizational Goals FY27-FY31 (Draft)"
(https://claude.ai/code/artifact/4aa082da-baca-48da-935f-245ecc7e5a70, revision 367, read 04/10/26):
the five goals (SMART, Why, Paths, the milestone tables, owners), the goals at a glance (headline measure,
baseline, FY29 and FY31 targets), the roadmap (four phases, the checkpoint, the FY29 gate) and the
strategy documents ("What our own plans already say", plus the consulting and source links).
Nothing here is invented: milestone cells are split on "; " only, so each item can carry a status and
the projects that serve it. Copy is plain (no em dashes).

Writes wa205_seed.json (read by test/w205drive.js to build its fixture) and wa205_strategy_data.sql
(the data part of the migration, one DO block).

The owners resolve to the roster (team_members): Shima #3, Suhaib #38, Ian #17 (welfareavenue.com
accounts shima.butera@, suhaib.abdillahi@, ian.odhiambo@).
"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))

MEMBER = {'Shima': 3, 'Suhaib': 38, 'Ian': 17}

GOALS = [
    {
        'number': 1, 'title': 'Feed more people, more reliably',
        'detail': 'By Sep 30, 2029, serve 4,000 meals a year (plated meals, food bags and community kitchen portions), counted per service in the Hub, by running all 26 scheduled Montreal services and monthly Toronto services.',
        'why': 'The meal is the mission. FY26 completed 17 Montreal services and cancelled 6.',
        'measure': 'Meals served a year', 'baseline': '2,269 (2025)', 'target_fy29': '4,000', 'target_fy31': '6,000',
        'owners': [('Shima', True, None), ('Suhaib', False, 'Toronto')],
        'owner_text': 'Shima (lead), Suhaib',
        'paths': [
            'Count meals at every service in the Hub from Oct 2026.',
            'A backup lead and minimum crew for every Sunday service.',
            'Grow the community kitchen model piloted with DESTA on 23 Aug 2026.',
            'A monthly Toronto cadence with shelter partners and TYFPC (Cook & Support partnership, Oct 2026 to Jul 2027, with a TMU Cook & Share in Jan 2027), building toward a Toronto food bank with Daily Bread (a 2 to 3 year aim in the 2026 plan).',
        ],
        'milestones': {
            'FY27': 'Meals counted at 100% of services; 3,000 meals',
            'FY28': '3,500 meals; 12 Toronto services',
            'FY29': '4,000 meals; 26 Montreal services, none cancelled for staffing; Toronto food bank open with Daily Bread',
            'FY31': '6,000 meals; weekly Montreal only if the FY29 gate is met',
        },
    },
    {
        'number': 2, 'title': 'Go beyond the meal',
        'detail': 'By Sep 30, 2029, every service offers hygiene kits, 1 in 4 services has a referral partner on site (including housing organizations), and beneficiaries give feedback twice a year.',
        'why': '"Meals and essential support" is in the mission; reintegration is the stated north star. We distributed 280 hygiene products in 2025.',
        'measure': 'Services with non-food support', 'baseline': 'Not tracked', 'target_fy29': '100% hygiene kits; referral partner at 1 in 4', 'target_fy31': '5 beneficiaries in a paid pathways pilot',
        'owners': [('Shima', True, None)],
        'owner_text': 'Shima',
        'paths': [
            'Source kits through partners.',
            'Invite referral partners from our 73 active partners, with housing organizations a priority so we can connect people to housing support, and publish the resource guide (print and digital) from the June 2026 Program Portfolio.',
            'Complete the beneficiary feedback project (0 of 2 tasks done).',
        ],
        'milestones': {
            'FY27': 'Kits at 50% of services; first feedback round',
            'FY28': 'Kits at 100% of services; 2 referral partners committed, at least 1 a housing organization',
            'FY29': 'Referral partner at 1 in 4 services; 2 feedback rounds a year',
            'FY31': 'Grant-funded pathways pilot: 5 beneficiaries in paid roles at $16.25/hr',
        },
    },
    {
        'number': 3, 'title': 'Grow a team that stays',
        'detail': "By Sep 30, 2029, 35% of each year's volunteers serve again the next year, 150 unique volunteers serve a year, and no leader averages more than 6 hours a week.",
        'why': 'Retention fell from 17% (FY25) to 13% (FY26). In FY26, 12 of 42 applicants went on to serve.',
        'measure': 'Volunteers returning next year', 'baseline': '13% (FY26)', 'target_fy29': '35%', 'target_fy31': '50%',
        'owners': [('Ian', True, None), ('Suhaib', False, None)],
        'owner_text': 'Ian (lead), Suhaib',
        'paths': [
            'Follow up with every first-time volunteer within 7 days.',
            'The ambassador tier and role descriptions recommended by 180DC.',
            'Decide the open volunteer recognition budget.',
        ],
        'milestones': {
            'FY27': '20% return; 110 volunteers; half of applicants serve',
            'FY28': '28% return; 130 volunteers',
            'FY29': '35% return; 150 volunteers',
            'FY31': '50% return; 250 volunteers',
        },
    },
    {
        'number': 4, 'title': 'Build money that lasts',
        'detail': 'By Sep 30, 2029, reach $60,000 in annual revenue with no single source above 40%, fund two part-time paid roles, hold 3 months of expenses in reserve, and raise at least $20,000 a year from grants.',
        'why': 'Revenue has stayed between $10,553 and $15,347 since FY23, all recorded as donations. Three months of the FY26 budget ($19,240 in expenses) is $4,810.',
        'measure': 'Annual revenue', 'baseline': '$12,983 (FY25)', 'target_fy29': '$60,000; 2 paid roles; 3-month reserve', 'target_fy31': '$100,000; 6-month reserve',
        'owners': [('Suhaib', True, 'Grants and finance'), ('Ian', False, 'Donor marketing and the Ad Grant')],
        'owner_text': 'Suhaib (lead), Ian',
        'paths': [
            'Grants: Centraide (pending); joint applications with DESTA, and with TYFPC to Maytree (about $5,000).',
            'Donor program: the donor team (Alexis, Danielle) launches monthly giving in FY27, with QR codes at services (decided June 2026).',
            'Corporate Supporter Circle: 2 to 6 companies at $200 to $500 a quarter.',
            'Google Ad Grant: $10,000 a month, unused today.',
            'Flagship events: Flag Football, Rally Paper and the holiday drive grow into flagship events, plus one new signature event by FY28 (the 2027 sports tournament in the events calendar). Every event gets a named lead; none of the 22 planned FY27 events has one today.',
            'Paid roles: funded by grants and wage subsidies, never general donations. Canada Summer Jobs first (MCC estimated about $15,000 a year for two summer roles), then the Trillium ask (up to $100,000, 60% for a full-time Toronto role) for a year-round role.',
        ],
        'milestones': {
            'FY27': '$25,000; donor team launched; 25 recurring donors; first grant; Ad Grant live; first paid roles: 2 Canada Summer Jobs positions for summer 2027 (window may reopen Nov 2026)',
            'FY28': '$40,000; first part-time paid role; 3-month reserve; each flagship event raises $5,000+',
            'FY29': '$60,000; 2 paid roles; $20,000 from grants; 100 recurring donors; each flagship event raises $10,000+',
            'FY31': '$100,000; 6-month reserve; a multi-year funder covering a paid program lead',
        },
    },
    {
        'number': 5, 'title': 'Run on systems, not heroes',
        'detail': 'By Sep 30, 2029, every leadership role has a written description, a 3 to 6 hour expectation and a trained backup; 7 board seats are filled with 4 committees meeting quarterly; and the Hub is the single system of record.',
        'why': 'Many roles turn over each school year, the board has an open HR seat, and the organization is moving from founder-led to board-led.',
        'measure': 'Leadership roles with a written role and trained backup', 'baseline': 'Not tracked', 'target_fy29': '100%', 'target_fy31': 'Toronto runs as a self-led chapter',
        'owners': [('Suhaib', True, None), ('Ian', False, None), ('Shima', False, None)],
        'owner_text': 'Suhaib (lead), Ian, Shima',
        'paths': [
            'Complete the executive transition.',
            'A yearly handover cycle timed to the school year.',
            'Retire Keela into the Hub CRM.',
            "Use MCC's chapter model for Toronto.",
        ],
        'milestones': {
            'FY27': 'Executive transition complete; HR seat filled; Keela retired; every role written',
            'FY28': 'Every role has a backup; a handover pack per team; Toronto lead plus 6 team members',
            'FY29': '7 board seats filled; Toronto self-led with its own fundraising',
            'FY31': 'Decide on a new city (MCC recommended Calgary), only if the FY29 gate is met',
        },
    },
]


def cap(s):
    s = s.strip()
    return s[:1].upper() + s[1:] if s else s


def split_ms(cell):
    return [cap(x) for x in cell.split('; ') if x.strip()]


PLAN = {
    'mission': 'Welfare Avenue is a youth-powered non-profit dedicated to fighting food insecurity and poverty through direct community action. We deliver meals and essential support directly to people where they are.',
    'mission_note': 'The mission adopted in July 2026. Every goal serves it.',
    'window': 'Five goals for FY27 to FY29 (Oct 1, 2026 to Sep 30, 2029), with a gated view to FY31.',
    'why_reset': 'At the July 2026 mid-year check, program impact was behind and the financial cushion had not started. This plan keeps the ambition and adds what was missing: a baseline, owners, yearly milestones, and a named engine (donor team, flagship events, grants, paid roles) behind every number. Targets start from measured baselines. All targets are proposals for board approval.',
    'long_range': "Leadership's long-range target (Oct 2025) is $5 million in revenue and 1 million meals within 10 years, in five cities. This plan is the first five years toward it.",
    'approval': {'meeting': '2026-10-19', 'label': 'Draft for board approval (19 Oct 2026)', 'final_draft': '2026-10-10'},
    'rule': 'One owner, one Hub measure, and no leader asked to exceed 6 hours a week.',
    'roadmap': {
        'title': 'Three years to prove it, then grow through the FY29 gate',
        'phases': [
            {'key': 'FY27', 'name': 'Stabilize', 'dates': 'Oct 2026 to Sep 2027', 'items': ['Count every meal', 'Write every role', 'Donor team launched']},
            {'key': 'FY28', 'name': 'Strengthen', 'dates': 'Oct 2027 to Sep 2028', 'items': ['First paid role', '3-month reserve', 'Toronto monthly']},
            {'key': 'FY29', 'name': 'Scale', 'dates': 'Oct 2028 to Sep 2029', 'items': ['4,000 meals', '$60,000 revenue', 'Two paid roles']},
            {'key': 'FY30 to FY31', 'name': 'Grow', 'dates': 'Oct 2029 to Sep 2031', 'items': ['Weekly Montreal', 'Paid program lead', 'New city decision'], 'gated': True},
        ],
        'checkpoint': {'name': 'Checkpoint, Oct 2027', 'after': 'FY27', 'items': ['Meals counted at every service', 'Executive transition complete', 'First grant awarded']},
        'gate': {'name': 'FY29 gate, Oct 2029', 'after': 'FY29', 'items': ['Reserve held for 12 months', '35% volunteer return', '26 Montreal services delivered', 'Toronto self-led']},
        'gate_rule': 'FY30 and FY31 targets apply only if all four gate criteria are met in October 2029; otherwise FY29 targets carry forward.',
    },
    'cadence': [
        'Quarterly board meetings (Jan, Apr, Jul, Oct): a one-page scorecard, one line per goal.',
        'Every board meeting: the standing strategy block (board item 18).',
        'Each October: a year-end strategy session (board item 13) that resets next year\'s milestones.',
    ],
    'source': {'title': '29/09/26 - Welfare Avenue Organizational Goals FY27 to FY31 (Draft)', 'url': 'https://claude.ai/code/artifact/4aa082da-baca-48da-935f-245ecc7e5a70'},
}

# "What our own plans already say", then the consulting work and the sources the draft names (links as in the doc)
DOCS = [
    {'group': 'Our plans', 'title': 'Leadership strategic planning 2025-2026', 'date': 'Oct 2025', 'url': 'https://docs.google.com/spreadsheets/d/1a1QFjiiKBlXijbgg03JcJScBdtAV1g5kMyOR3aNPf4k',
     'direction': '10-year: $5M revenue, 1M meals; 3-year picture: own kitchen and location, 10 donors over $50K, paid staff', 'status': 'FY26 target of $100,000 vs about $13,000 actual', 'goals': []},
    {'group': 'Our plans', 'title': '5 Year Program Plan', 'date': 'Feb 2026', 'url': 'https://docs.google.com/document/d/1IW5riZxDPdS_4L299kZbgXqp8755CD7o3ltGAZD3wQ4',
     'direction': '5 cities (Montreal, Toronto, Ottawa, Calgary, Vancouver); meals, food banks, case management, research', 'status': 'Concept; no dates or targets', 'goals': []},
    {'group': 'Our plans', 'title': 'Toronto Strategic Implementation Plan', 'date': 'Feb 2026', 'url': 'https://docs.google.com/document/d/1m87ujh7mklNday7jFrKd3C7M294ggdXW4v39RyrNSa4',
     'direction': 'Certified kitchen; food bank with Daily Bread by Nov 2026; research with the City', 'status': 'No kitchen yet; food bank not open', 'goals': []},
    {'group': 'Our plans', 'title': 'Program Portfolio', 'date': 'Jun 2026', 'url': 'https://drive.google.com/file/d/10kMTEmtBV0FE6kQ-tMbei2CqOCb6VZkR',
     'direction': 'Community kitchen, hygiene and clothing, resource guide, 15+ partner organizations', 'status': 'Kitchen piloted 23 Aug 2026', 'goals': []},
    {'group': 'Our plans', 'title': 'Donor Program Outline', 'date': 'Mar 2026', 'url': 'https://docs.google.com/document/d/1LPEKWos7lTSqzCIAVT1-RI2KliphGYOmaUKad1IWeL8',
     'direction': '60 monthly donors at 9 months', 'status': '0 recurring donors; launch not yet evident', 'goals': []},
    {'group': 'Our plans', 'title': 'Fundraising Events Calendar 2026-27', 'date': 'Jun 2026', 'url': 'https://docs.google.com/document/d/1EhSDBvZxp_-Q3jOD8Iiv5G2d2YqNCFm4nRFz8Rre2yQ',
     'direction': '$10K minimum, $20K target a year; a flagship sports tournament in 2027', 'status': '22 events planned, none with a lead', 'goals': []},
    {'group': 'Our plans', 'title': 'Grants Planning', 'date': 'Jun to Aug 2026', 'url': 'https://docs.google.com/document/d/1HgWsFjgQe5UlXgVE5xfQxFF0EigKf3Uqfr0CuJ7uf24',
     'direction': 'Trillium ask up to $100,000, 60% for a full-time Toronto role', 'status': 'Submission not confirmed in the Hub', 'goals': []},
    {'group': 'Our plans', 'title': 'OTF draft', 'date': 'Jun to Aug 2026', 'url': 'https://docs.google.com/document/d/1-vWObCjFTYJrgvVi8q2DQ8GxdNHoa7HE5HwTSH3CByI',
     'direction': 'Trillium ask up to $100,000, 60% for a full-time Toronto role', 'status': 'Submission not confirmed in the Hub', 'goals': []},
    {'group': 'Our plans', 'title': 'MCC National Expansion Blueprint', 'date': 'Apr 2025', 'url': None,
     'direction': 'Toronto chapter model; Calgary in year 5; CSJ about $15,000 a year for 2 summer roles', 'status': 'CSJ not yet applied for', 'goals': []},
    {'group': 'Consulting work', 'title': 'MCC: Statement of work', 'date': '2025', 'url': 'https://drive.google.com/file/d/1gWrotewUaZdD0Gm4FoyyijT05rhFTjDN',
     'direction': 'Management Consulting Concordia, Elevate & Expand (15 Jan to 15 Apr 2025, pro bono): 5-year expansion plan (Toronto in year 2, Calgary in year 5), National Expansion Manual, chapter model, SEO and sponsorship report, Keela workflows', 'status': 'Feeds goals 4 and 5', 'goals': [4, 5]},
    {'group': 'Consulting work', 'title': 'MCC: National Expansion Manual', 'date': '2025', 'url': 'https://drive.google.com/file/d/1p7rUjw87I508QjX2wCADnGSxnOhBfTx0',
     'direction': 'The chapter model and the 5-year expansion plan (Toronto in year 2, Calgary in year 5)', 'status': 'Feeds goals 4 and 5', 'goals': [4, 5]},
    {'group': 'Consulting work', 'title': 'MCC: Final Deliverable', 'date': '2025', 'url': 'https://drive.google.com/file/d/1ef-_2r0qHmKIPc2rvjbG0gFagxEaPWT4',
     'direction': 'Elevate & Expand: the expansion plan, the SEO and sponsorship report and the Keela workflows', 'status': 'Feeds goals 4 and 5', 'goals': [4, 5]},
    {'group': 'Consulting work', 'title': '180DC: Final report', 'date': '26 May 2025', 'url': 'https://drive.google.com/file/d/1-LfKmEsuAH5Ub8ppb_743vakvajkFqOO',
     'direction': '180 Degrees Consulting restructuring (pro bono): 3-tier structure, role descriptions, VP Finance and ambassador roles, KPIs of 65 to 75% volunteer retention after 3 months and budget variance within 10%', 'status': 'Feeds goals 3 and 5', 'goals': [3, 5]},
    {'group': 'Consulting work', 'title': '180DC: Executive deck', 'date': '2025', 'url': 'https://drive.google.com/file/d/1HdjTLlWtWFUt_51pUFiw8SaWAuoMEQYE',
     'direction': 'The restructuring in brief: 3-tier structure, role descriptions, VP Finance and ambassador roles', 'status': 'Feeds goals 3 and 5', 'goals': [3, 5]},
    {'group': 'Sources', 'title': '2026 Outlook & Plan: Strategic Planning', 'date': '2026', 'url': 'https://docs.google.com/document/d/1sPudMzpdS4Q8TIJ7B2f18s5y8IkmIuKBeQJkRUhz2S0',
     'direction': 'A source the goals draft is built on', 'status': 'Listed in the draft\'s sources', 'goals': []},
]

# The retired tier: each department goal and the org goal it served, where the fit is obvious (None = no obvious fit).
DEPT_MAP = {
    23: 4, 40: 4, 44: 4, 27: 4, 29: 4, 43: 4,     # fundraising events, donor program, Rally Paper, the Ad Grant
    30: 5, 31: 5, 32: 5,                         # policies and structure
    33: 3, 34: 3, 35: 3, 36: 3, 37: 3, 38: 3, 39: 3,   # recruiting, onboarding, development, reviews, team life
    66: 1,                                       # the community kitchen pilot
    19: 2, 20: 2, 21: 2, 22: 2,                   # beneficiary feedback, the employment program, the referral brochure, new programs
    24: None, 25: None, 26: None, 28: None,       # brand refresh, website, intro video, photographers: no obvious fit
}
# The three org goals the five replace (superseded: rows kept, archived)
OLD_ORG = {
    41: (4, 'Superseded by goal 4, Build money that lasts (wave205, the FY27 to FY31 goals).'),
    42: (None, 'Retired as an org goal in the FY27 to FY31 plan: follower growth becomes a marketing KPI (wave205).'),
    45: (2, 'Superseded by goal 2, Go beyond the meal (wave205, the FY27 to FY31 goals).'),
}
# Projects that pointed at a retired goal move to the org goal it served; a few unlinked projects get the obvious goal.
# (project id, goal number, milestone fy, milestone text or None)
PROJECT_LINKS = [
    (1, 4, 'FY27', 'Donor team launched'),        # Donor Program (was 41)
    (2, 4, None, None),                           # Fundraising Events (was 41)
    (13, 4, None, None),                          # Holiday Gift Basket Drive 2026 (was 41)
    (14, 4, None, None),                          # General Outreach & Networking (was 41)
    (20, 4, None, None),                          # General Fundraising (was 41)
    (23, 4, 'FY27', 'First grant'),               # Grants Program (was 41)
    (15, 4, 'FY27', 'Ad Grant live'),             # Google Ad Grants (was 42; an explicit path of goal 4)
    (25, 4, None, None),                          # One Bag Challenge (was 42; a fundraiser)
    (12, 4, None, None),                          # Flag Football 2026 (was department goal 23)
    (11, 4, None, None),                          # Rally Paper 2026 (was department goal 29)
    (3, 2, None, None),                           # Survey Project (was department goal 19)
    (4, 2, 'FY27', 'First feedback round'),       # Beneficiary Feedback Project (was department goal 19)
    (10, 5, None, None),                          # Internal Policies (was department goal 30)
    (8, 3, None, None),                           # Onboarding Program (was department goal 34)
    (9, 3, None, None),                           # Recruitment (was department goal 36)
    (24, 1, None, None),                          # Community Kitchen Pilot (unlinked; a named path of goal 1)
    (22, 3, None, None),                          # Volunteer Relations (unlinked; the first-time volunteer follow-up path of goal 3)
]
# Left as they were (pointing at retired goal 42, or unlinked): Brand Refresh (5), Website Redesign (6), WA Intro Video (7),
# and the General projects (16 to 19, 21): the page lists them under "Not linked to a goal yet" with Link a project.


def seed():
    goals = []
    for g in GOALS:
        ms = []
        for fy in ('FY27', 'FY28', 'FY29', 'FY31'):
            for i, body in enumerate(split_ms(g['milestones'][fy])):
                ms.append({'fy': fy, 'sort': i + 1, 'body': body})
        goals.append({k: g[k] for k in ('number', 'title', 'detail', 'why', 'measure', 'baseline', 'target_fy29', 'target_fy31', 'owner_text')} | {
            'owners': [{'member_id': MEMBER[n], 'name': n, 'is_lead': lead, 'focus': focus, 'sort': i + 1} for i, (n, lead, focus) in enumerate(g['owners'])],
            'paths': [{'sort': i + 1, 'body': p} for i, p in enumerate(g['paths'])],
            'milestones': ms,
        })
    return {'goals': goals, 'plan': PLAN, 'docs': DOCS, 'dept_map': DEPT_MAP, 'old_org': OLD_ORG, 'project_links': PROJECT_LINKS}


def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"


def sql(S):
    L = []
    L.append('-- wave205 data: generated by build/data/wa205_seed.py from the approved draft (do not edit by hand)')
    L.append('do $waseed$')
    L.append('declare g1 bigint; g2 bigint; g3 bigint; g4 bigint; g5 bigint; gid bigint; v_mid bigint;')
    L.append('begin')
    L.append("  perform set_config('wa205.seed', '1', true);")
    L.append("  perform set_config('wa205.actor', 'wave205 migration', true);")
    L.append("  if exists (select 1 from public.goals where department = 'org' and number is not null) then raise exception 'wave205 goals already seeded'; end if;")
    for g in S['goals']:
        n = g['number']
        L.append('  insert into public.goals (department, quarter, title, detail, why, measure, baseline, target_fy29, target_fy31, status, due_date, source, sort, number, owner, approval, updated_at, updated_by)')
        L.append("  values ('org', 'FY27 to FY29', %s, %s, %s, %s, %s, %s, %s, 'not started', '2029-09-30', 'wave205: the FY27 to FY31 goals draft (29/09/26)', %d, %d, %s, 'draft', now(), 'wave205 migration') returning id into g%d;" % (
            q(g['title']), q(g['detail']), q(g['why']), q(g['measure']), q(g['baseline']), q(g['target_fy29']), q(g['target_fy31']), n, n, q(g['owner_text']), n))
        for o in g['owners']:
            L.append("  insert into public.goal_owners (goal_id, member_id, is_lead, focus, sort, added_by) values (g%d, %d, %s, %s, %d, 'wave205 migration');" % (n, o['member_id'], 'true' if o['is_lead'] else 'false', q(o['focus']), o['sort']))
        for p in g['paths']:
            L.append("  insert into public.goal_paths (goal_id, sort, body, updated_by) values (g%d, %d, %s, 'wave205 migration');" % (n, p['sort'], q(p['body'])))
        for m in g['milestones']:
            L.append("  insert into public.goal_milestones (goal_id, fy, sort, body, status, updated_by) values (g%d, '%s', %d, %s, 'not started', 'wave205 migration');" % (n, m['fy'], m['sort'], q(m['body'])))
    # the plan and the library
    for k in ('mission', 'mission_note', 'window', 'why_reset', 'long_range', 'approval', 'rule', 'roadmap', 'cadence', 'source'):
        L.append("  insert into public.strategy_plan (key, value, updated_by) values (%s, %s::jsonb, 'wave205 migration');" % (q(k), q(json.dumps(S['plan'][k], ensure_ascii=False))))
    for i, d in enumerate(S['docs']):
        L.append("  insert into public.strategy_docs (title, url, group_label, doc_date, direction, status_note, goals, pinned, sort, added_by) values (%s, %s, %s, %s, %s, %s, '{%s}', true, %d, 'wave205 migration');" % (
            q(d['title']), q(d['url']), q(d['group']), q(d['date']), q(d['direction']), q(d['status']), ','.join(str(x) for x in d['goals']), (i + 1) * 10))
    L.append("  perform set_config('wa205.seed', '', true);")
    # retire: the old org goals (superseded), then the department goals (mapped), keeping status, wins and comments
    for oid, (num, note) in S['old_org'].items():
        L.append("  update public.goals set status_before_retire = status, status = 'archived', retired_at = now(), retired_by = 'wave205 migration', retired_note = %s, superseded_by = %s, maps_to_goal_id = %s, updated_at = now(), updated_by = 'wave205 migration' where id = %d and department = 'org' and retired_at is null;" % (
            q(note), ('g%d' % num) if num else 'null', ('g%d' % num) if num else 'null', oid))
    for did, num in S['dept_map'].items():
        note = ('Department goals are retired as a tier (wave205): this one served goal %d.' % num) if num else 'Department goals are retired as a tier (wave205): no obvious fit with one of the five goals.'
        L.append("  update public.goals set status_before_retire = status, status = 'archived', retired_at = now(), retired_by = 'wave205 migration', retired_note = %s, maps_to_goal_id = %s, updated_at = now(), updated_by = 'wave205 migration' where id = %d and department <> 'org' and retired_at is null;" % (
            q(note), ('g%d' % num) if num else 'null', did))
    L.append("  if (select count(*) from public.goals where retired_at is not null) <> %d then raise exception 'wave205: expected %d retired goals'; end if;" % (len(S['dept_map']) + len(S['old_org']), len(S['dept_map']) + len(S['old_org'])))
    for pid, num, fy, mtxt in S['project_links']:
        if fy:
            L.append("  select id into v_mid from public.goal_milestones where goal_id = g%d and fy = '%s' and body = %s; if v_mid is null then raise exception 'wave205: milestone %s not found'; end if;" % (num, fy, q(mtxt), mtxt.replace("'", "")))
            L.append("  update public.projects set goal_id = g%d, milestone_id = v_mid, updated_at = now() where id = %d;" % (num, pid))
        else:
            L.append("  update public.projects set goal_id = g%d, milestone_id = null, updated_at = now() where id = %d;" % (num, pid))
    L.append("  perform set_config('wa205.actor', '', true);")
    L.append('end $waseed$;')
    return '\n'.join(L) + '\n'


if __name__ == '__main__':
    S = seed()
    json.dump(S, open(os.path.join(D, 'wa205_seed.json'), 'w'), indent=1, ensure_ascii=False)
    open(os.path.join(D, 'wa205_strategy_data.sql'), 'w').write(sql(S))
    n_ms = sum(len(g['milestones']) for g in S['goals'])
    n_p = sum(len(g['paths']) for g in S['goals'])
    print('goals', len(S['goals']), 'milestones', n_ms, 'paths', n_p, 'docs', len(S['docs']), 'retired', len(DEPT_MAP) + len(OLD_ORG), 'project links', len(PROJECT_LINKS))
    for t in [json.dumps(S, ensure_ascii=False)]:
        assert '—' not in t, 'em dash in the seed'
