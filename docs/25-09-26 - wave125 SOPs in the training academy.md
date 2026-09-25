# 25/09/26 - wave125 SOPs in the training academy

Live md5 `2a2151257d72a97b188cb67218947576` (3,201,430 bytes), deployed through the gated pipeline (`wa_stage_qt`, guard on live `7166ec40`, dropped after). SOP rows applied through `build/sql_stage.py` (a staged, md5-checked statement list run in one transaction, then dropped).

## What Steel asked

"If we've done a similar event like the ones listed in the past please provide SOPs. I'm wondering if each department should have SOP on their home page or they should all be hosted in trainings center."

The answer is both, with one home: every SOP lives in the Training academy (one library, searchable, counted in people's progress like any training), each team's overview shows its own SOPs, and the events calendar links every event to its SOP. One copy, three ways in, so nothing drifts.

## The six SOPs

Written from the meeting transcripts, tasks, Drive documents and Slack (three research passes, read-only), for the events on the 2026-27 plan that we have run or played in before:

| SOP | Teams | Linked events |
|---|---|---|
| Flag Football tournament (with the Montreal Flag Football League) | Fundraising, Marketing | Flag Football 2026, 2027 |
| Rally Paper (playing as a charity team) | Fundraising, Marketing | Rally Paper 2026, 2027 |
| Gift Basket Drive | Ops Montreal, Fundraising | Gift Basket Drive 2026 |
| Fundraisers run by student associations (JMCC, CASA) | Fundraising | JMCC offload events, St. Patrick's Party at Reggie's |
| Corporate volunteering days | Fundraising, Ops Montreal | Corporate Volunteering |
| Serving at a partner's festival (Art4All) | Ops Montreal, Fundraising | Art4All |

Each one has: what it is and why, at a glance (when, where, partners, price, lead time, best result), past editions with named credit, who does what, the steps by phase (months out to the post-mortem), the day itself, money, what we learned, what is still to confirm, and the source documents. No SOP for the Thrift Fashion Show (never run; Amanda called it a first), the Women's Day Fundraiser (planned for March 2026 and cancelled), Après-Ski, the Corporate Cook-Off or a sports tournament (none run).

## How it works

- A new academy kind, `sop` (trainings.kind), with its content in `trainings.body` (depts, owner, intro, glance, format, editions, roles, phases, dayof, money, lessons, confirm, links, reviewed, sources). Keys `sop:<slug>`; live ids 84 to 89. Category "Our SOPs".
- The academy home has an "Our SOPs" section after the learning paths (your team's first, each tile shows the next event that uses it), and the library has an SOPs filter.
- The reader: contents pills that jump to each section, the at-a-glance cards, "On the events calendar" (the events that use it, each a link), and "I have read it" for progress. Phone layout stacks everything and the sheet header now puts the title under the actions on every training.
- Editing: leaders, and members of the SOP's teams, edit in plain text (one item per line; `## when | title` starts a phase; `Title | https://link` for documents). Links must be http(s). "Write an SOP" on the academy and on every team card starts a new one for that team. Leaders can retire one.
- Each team overview has an "Our SOPs" card after Projects (`#w122sopcard`), with "+ Write an SOP" for people who can edit.
- The events calendar already carried the SOP link (`fund_events.sop_training_id`); the six SOPs are now linked to nine events.
- Deep links: `#training/t/<id>`, `#training/sops`, `#training/sopnew/<team>`.

## Also changed

- Flag Football partners on the events calendar corrected from "MTL Flag Plus; Poulet Rouge (sponsor)" to the Montreal Flag Football League (MFL), with the 2026 in-kind sponsors (Poulet Rouge declined in May 2026; Flag Plus was a different league, for the December 2023 indoor event).
- The academy and team page tours have an "Our SOPs" step.
- `docs/HUB_RELEASE_CHECKLIST.md`: Steel's standing rule that every Hub change reviews the roles and the Hub training.

## Access

SOPs are trainings: staff read them (RLS `is_wa_staff()`), board viewers do not. Editing in the Hub: leaders and the SOP's teams. The access profiles work (next) will list this on the Admin page.

## Verification

`test/w125drive.js`: 24 checks as Steel (the section, the order, next events, the filter, every section, safe links, the contents jump, read it, edit and save, the phase round trip, a new SOP for HR, the team cards for Fundraising, Marketing and HR, card to SOP, SOP to event and back), 18 as Amanda (no edit rights), 24 at phone width, 3 as a board viewer. Academy drive 35/35, calendar drive 35/35, every tour complete (academy 9/9, team 14/14). Harness 36 pages x3 against the live build with the same fixture: only the academy, the team page (the new card) and the known timing noise (hrcentre, a hidden finance paragraph); only ERR_FAILED errors. Churn zero on seven views.

## For Steel

Each SOP ends with a short "Still to confirm" list (for example the 2025 Flag Football total, the 2026 costs and the vendor's share, the official Rally Paper 2026 placing, what the 2025 Gift Basket Drive cost). Answering those in the SOP keeps them honest; "Update it" is at the bottom of each one.
