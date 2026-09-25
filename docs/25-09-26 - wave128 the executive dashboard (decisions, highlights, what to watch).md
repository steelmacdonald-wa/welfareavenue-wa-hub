# 25/09/26 - wave128 the Executive dashboard: decisions, highlights, what to watch

Live md5 `69fa79a50da416c5ddb2ad97fb77c2ea` (3,442,268 bytes), deployed through the gated pipeline (`wa_stage_qw`, guard on live `b81eb277`, dropped after). No migration.

## What Steel asked

"The executive dashboard really needs some work... a lot of buttons that click to random places... think about executive decision making, highlights and stuff like that. Make it better."

## What was wrong

- "Open the full dashboard" on the Executive dashboard pointed back to the same page.
- A "Your plate" card sent people to Home from the executive view.
- "Decisions waiting" (a folder) repeated the decision list below it.
- The four numbers at the top opened nothing, and nothing on the page said what needed attention.

## The new top of the page (`#w128`)

- **The brief:** two or three plain sentences built from the data. How many decisions wait and for how long, the fiscal year (and its close on September 30), event results still missing, teams without a meeting update in three weeks, the next board meeting. Beside it, what is next: the board meeting, the next fundraising event, the next serving.
- **The numbers**, each one a door: decisions waiting (to the list), raised by the events (Events calendar, against the target once the 2026-27 plan starts), donations from the ledger (Finances, only for people who can see it), organizational goals, open and overdue tasks (opens the Overdue folder in place), servings in the next 30 days, the team.
- **Needs a decision:** the four oldest executive calls with how long they have waited, who decides, the suggested move and the AI recommendation. Record the decision (the same record as the list) or find it in the list. Board viewers read; they do not record.
- **To watch:** decisions waiting more than 60 days, past events with no result, overdue work by team, teams with no meeting update in three weeks, goals delayed or incomplete, board items at risk, events coming up without a lead, the year-end.
- **Highlights:** event results, shout-outs, goals closed, wins from meetings, tasks closed in 30 days, servings held, people who joined.
- **Coming up:** the next six weeks: the year-end, the committee deadline and board meetings, fundraising events, servings.
- **Teams at a glance:** each team's leads, open and overdue work, work closed in 30 days, when it last had a meeting on the Hub, and its goals. A card opens the team page.

Below it, unchanged: What's new, the Overdue tasks and Delivery numbers folders, and the full decision list (filters, add, edit, decided). The page help sits in the masthead; the masthead says what the page is for.

## What it would say today (live data, September 25)

Five decisions are waiting, four of them for more than 60 days (the oldest, Board-level insurance, 95 days). The fiscal year closes Wednesday with $2,800 raised by the events (Flag Football, against $4,000). Rally Paper 2026 has no result recorded. Five teams have had no meeting update since August 24 or earlier. Marketing has 36 overdue tasks and Fundraising & Finances 13. The Q3 board meeting is October 19, and committees should meet by October 12.

## Release checklist

- Access: no new page. The ledger tile follows the profile (wave127); the board sees what its RLS allows (no servings, no team cards); decisions are recorded by staff only.
- Training: the Executive dashboard tour is rewritten (13 steps: the brief, the numbers, needs a decision, to watch, highlights, coming up, teams, then the sections below).

## Verification

`test/w128drive.js`: admin 21 checks, board viewer 15, a Toronto member on a profile 21, phone width 22 (the new top under the masthead, the old parts gone, the brief, next up, every number opens something, four decisions, record and cancel, in the list, the overdue folder in place, a team card, the events calendar, the tour). A preview against a snapshot of live data (September 25). Harness 36 pages x3 against the live build: only the Executive dashboard and known noise. Churn zero for staff, a board viewer and a profiled member. Tour 13/13; the board drives green.
