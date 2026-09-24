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
    # wave116d: the Strategy page is Goal alignment
    ("if (head) head.textContent = 'Strategy';", "if (head) head.textContent = 'Goal alignment';"),
    ("el.innerHTML = el.innerHTML.replace('Goals', 'Strategy');", "el.innerHTML = el.innerHTML.replace('Goals', 'Goal alignment');"),
    ("goals: 'Strategy',", "goals: 'Goal alignment',"),
    ("<h2>How Strategy works</h2>", "<h2>How Goal alignment works</h2>"),
    ("Set one on the Strategy page", "Set one on the Goal alignment page"),
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
