#!/usr/bin/env python3
"""wave116 (24/09/26): build-time team rename and split.

Runs on the assembled candidate after brand_remap. Rewrites the labels
and workstream lists that earlier waves hard code so the whole build
speaks the new names without touching 115 frozen segments:
  - Operations Montreal / Program Development / Operations Toronto
  - Fundraising & Finances (was Fundraising & Grants), with a Finance
    workstream
  - wave71's canonical workstreams: Program development leaves Ops
    Montreal and becomes its own team's list
Idempotent: every replacement is a no-op on a patched build. Skip with
NO_TEAMS_REMAP=1.
"""
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "candidate.html"
if os.environ.get("NO_TEAMS_REMAP"):
    sys.exit(0)

with open(OUT, "r", encoding="utf-8") as f:
    html = f.read()
orig = html

REPLACE = [
    # wave116k: the profile page help texts
    ("personpage: '<p>One person: their AI bio, fiscal-year stats, current plate, finished work, and training and onboarding progress.</p>'", "personpage: '<p>One person: role, main responsibilities and the job description, the projects they lead, open and finished tasks, hours on the hub, meetings, training and onboarding.</p>'"),
    ("fl = ['Read the bio', 'See their plate', 'Check their training'];", "fl = ['Read the responsibilities', 'See their plate and projects', 'Check hours and training'];"),
    ("secs = sec(mBar(75), 'Live, not a profile form',\n          'The bio, plate, stats and training progress all come from real Hub data, so the page is always current.');", "secs = sec(mBar(75), 'Live, not a profile form',\n          'Responsibilities and the job description link come from the HR drive; tasks, projects, hours, meetings and training come from live Hub data, so the page is always current.');"),
    # tab buttons and selects in the base
    ("Ops &amp; Program Dev &middot; Montreal", "Operations Montreal"),
    ("Ops &amp; Program Dev &middot; Toronto", "Operations Toronto"),
    ('<option value="opsmtl">Ops &amp; Program Dev - Montreal</option>', '<option value="opsmtl">Operations Montreal</option>'),
    ('<option value="opsto">Ops &amp; Program Dev - Toronto</option>', '<option value="opsto">Operations Toronto</option>'),
    ('<option value="fundraising">Fundraising &amp; Grants</option>', '<option value="fundraising">Fundraising &amp; Finances</option>'),
    # transcript upload labels (the value is what transcripts.department stores; txDeptKey maps both spellings)
    ('<option value="Ops &amp; Program Dev - Montreal">Ops &amp; Program Dev - Montreal</option>', '<option value="Operations Montreal">Operations Montreal</option>'),
    ('<option value="Ops &amp; Program Dev - Toronto">Ops &amp; Program Dev - Toronto</option>', '<option value="Operations Toronto">Operations Toronto</option>'),
    ('<option value="Fundraising &amp; Grants">Fundraising &amp; Grants</option>', '<option value="Fundraising &amp; Finances">Fundraising &amp; Finances</option>'),
    # section titles
    ('title: "Operations &amp; Program Development - Montreal"', 'title: "Operations Montreal"'),
    ('title: "Operations &amp; Program Development - Toronto / Ontario"', 'title: "Operations Toronto"'),
    ('title: "Fundraising &amp; Grants"', 'title: "Fundraising &amp; Finances"'),
    # label maps in later waves
    ("fundraising: 'Fundraising and Grants'", "fundraising: 'Fundraising and Finances'"),
    ("fundraising: 'Fundraising & Grants'", "fundraising: 'Fundraising & Finances'"),
    ("opsmtl: 'Ops Montreal', opsto: 'Ops Toronto'", "opsmtl: 'Operations Montreal', opsto: 'Operations Toronto'"),
    # wave93 finance meeting tag
    ("Finance (Fundraising & Grants)", "Finance (Fundraising & Finances)"),
    ("Finance (Fundraising &amp; Grants)", "Finance (Fundraising &amp; Finances)"),
    # wave116d/f: the old Strategy page is the Department goals page (Organizational goals and Goal alignment are their own pages)
    ("if (head) head.textContent = 'Strategy';", "if (head) head.textContent = 'Department goals';"),
    ("el.innerHTML = el.innerHTML.replace('Goals', 'Strategy');", "el.innerHTML = el.innerHTML.replace('Goals', 'Department goals');"),
    ("goals: 'Strategy',", "goals: 'Department goals',"),
    ("<h2>How Strategy works</h2>", "<h2>How Department goals work</h2>"),
    ("Set one on the Strategy page", "Set one on the Department goals page"),
    ("goals: 'Projects, quarterly goals and the map of how they connect.',", "goals: 'Every team\\'s quarterly goals, SMART, with tasks and comments.',"),
    # wave116g: ClickUp is gone from the executive dashboard
    ("overdue tasks, Slack check-in hours and ClickUp movement per department.", "overdue tasks and the workload per department."),
    ("overview: 'Decisions across Welfare Avenue: what is open, what was decided, and your part in it.',", "overview: 'The executive view: the numbers, major announcements, and the decisions that sit with Ian, Shima, Suhaib and Steel.',"),
    ("<p>The organization at a glance: stat tiles, your plate, requests waiting on you or your department, and the open executive decisions list.</p>", "<p>The organization at a glance: stat tiles, major announcements, your plate, requests waiting on you or your department, and the executive decisions list.</p>"),
    # wave71 canonical workstreams
    (
        "      ['Inventory', 'Supplies, storage, and reordering.'],\n"
        "      ['Program development', \"Shima's team: new programs and partnerships.\"]\n"
        "    ],\n"
        "    opsto: [\n",
        "      ['Inventory', 'Supplies, storage, and reordering.']\n"
        "    ],\n"
        "    progdev: [\n"
        "      ['General', 'Work that is not tied to one programme.'],\n"
        "      ['Beneficiary programs', 'Programmes for the people we serve: employment, feedback, referrals.'],\n"
        "      ['Research and data', 'Surveys, evaluation and the numbers behind the programmes.'],\n"
        "      ['Community team', 'Community leads, partnerships and outreach.']\n"
        "    ],\n"
        "    opsto: [\n",
    ),
    (
        "      ['Grants', 'Applications, reports, and funder relationships.']\n"
        "    ],\n",
        "      ['Grants', 'Applications, reports, and funder relationships.'],\n"
        "      ['Finance', 'Bookkeeping, statements, budgets and forecasts.']\n"
        "    ],\n",
    ),
]

counts = []
for old, new in REPLACE:
    n = html.count(old)
    counts.append((old[:48].replace("\n", " "), n))
    if n:
        html = html.replace(old, new)

if html != orig:
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
changed = sum(1 for _, n in counts if n)
print("teams_remap: %d/%d patterns applied" % (changed, len(counts)))
missing = [k for k, n in counts if n == 0]
if missing and os.environ.get("TEAMS_REMAP_VERBOSE"):
    for k in missing:
        print("  (already patched or absent) " + k)
