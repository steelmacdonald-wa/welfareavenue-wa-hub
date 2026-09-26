# 25/09/26 - wave126 the board section: the three jobs, the committees, each director's progress

Live md5 `0ca52b1193d0b632e6dd9fcb0908b8a9` (3,302,005 bytes), deployed through the gated pipeline (`wa_stage_qu`, guard on live `2a215125`, dropped after). Migration `wa126_board`; page tours are trainings 90 and 91.

## What Steel asked

With the July 22 board deck (PDF pages 18 to 29, slides 16 to 27): "the board section should form itself around the 3 board responsibilities, Committees should be it's own section divided by the 4 pillars to strategic direction. I want to see how each board member is making progress in that area." His answers: the four pillars are the four committees; board members log their own progress; the SOPs first, then this.

Sources: the deck (foundations in place, why formalize, Rima Naim's advice, the three jobs, from reporting to engaging, how a committee works, recruiting beyond the board, strategy starts with shared assumptions, the proposed committees, cadence, next steps) and the July 22 minutes (the "Board Meeting Notes - July 2026" doc): Kellian chaired; Shanada resigned; a hard quarter financially; the by-laws and articles go to the next meeting; the four committees were created and meet twice between board meetings (once with the team, once with outside people); Mohamed renewed to Q2 2027 (4 to 0); the Q3 meeting is tentatively October 19 at 6pm, plus a special meeting in September. The "Welfare Avenue - Facts" doc is not in the Drive the Hub can see, so seats come from the board circle list and the deck.

## Board overview (#governance)

- The menu: Board & Governance now opens the board overview; its flyout starts with Board overview and Committees, and the old team overview is "Team page". Board viewers (who have no team row) get both pages right after the Executive dashboard. A switcher on both pages: Overview, Committees, Directors, Team page, Agendas, Board tasks.
- The next board meeting (with a countdown), when the committees should have met (a week before), the last meeting and its minutes, and the strategy session. Leaders can reschedule a meeting (Toronto time).
- The three jobs, one card each with its description from the deck, "n of m done", and its items by urgency (at risk, in progress, to do, watch, every meeting; done tucked away). Directors and leaders update an item's status, owner, due and detail, or add one; admins delete.
  - Steward leadership: terms and renewals (Steel and Kellian due Q3 2026, Daniela and Tamara Q1 2027, Mohamed Q2 2027), the open seat.
  - Fiduciary oversight: the fiscal year so far (in, out, net, last year) from the ledger, a warning when statements are more than 45 days old, what the events raised against the 2026-27 goal, and the items (signing officers, by-laws and articles, D&O insurance, the website disclosures, the hard quarter, the Ontario Trillium application).
  - Direction and strategy: the three steps (align on assumptions, decide who we serve, revise the plan), the strategy session, and the organizational goals.
- The directors: one card each with their committees (chair marked) and how far each committee is this cycle, what they logged, their board tasks, and their term. A director's sheet shows it all; admins edit the seat, term, sign-in emails and status. Advisers and past directors are listed underneath.

## Committees (#committees)

- How a committee works (chair, internal touchpoint, external touchpoint, bring it to the board) and this cycle: from the last board meeting held to the next one, with the committee deadline a week before.
- Fundraising, HR & People, Operations and Fiduciary, each with its chair ("proposed" until the board confirms), directors, internal leads and the outside professional to recruit; the four steps for this cycle with dates and who; each director's part this cycle; the log; "Log a touchpoint"; a link to the team; Edit for leaders and the committee's chair.
- Log a touchpoint: internal touchpoint, external working session, committee meeting, recommendation for the board, or a note, with the date, who with, what we learned, the recommendation and the board meeting it feeds. You can change or delete your own entries; admins can log on someone's behalf.
- Strategy: the whole board, the cadence, and recruiting beyond the board.

## Who sees and does what

- The pages: directors and advisers (`board_members.emails`), the board circle, board viewers, leaders and admins (`can_see_board()`). Staff members do not see them.
- Each director's progress (the Directors section and "each director this cycle"): the board and admins only, not every leader.
- Board members may now write in three places, and only there: their own touchpoints (RLS: `member_id` must be their own), the status of the three jobs' items, and the roster of a committee they chair. Everything else stays read-only for board viewers.
- Board viewers get aggregates only through `board_home()` (security definer): the ledger totals, never transactions; board tasks that are not confidential.

## Also

- A tab placement loop for board viewers, where the calendar pages and the board pages each moved their tab next to the Executive dashboard, is fixed (the calendar now sits after the board pages). The loop had also been blocking the person links on the Executive dashboard for board viewers.
- Page tours for both pages; the Hub release checklist is followed (access map, tours, tests).

## Verification

`test/w126drive.js`: 35 checks as Steel (admin and director), 31 as a board viewer (Tamara), 25 as a leader (Ian: no director progress), 3 as a member (Amanda: no access), 34 at phone width. RLS checked with Mohamed's JWT (his own touchpoint allowed, on someone else's behalf refused) and a staff member's (no board data). Harness 36 pages x3 against the live build with the same fixture: only the two new pages, the menu, the board team page switcher and known noise. Churn zero on ten views, including a board viewer on the Executive dashboard. Tours: governance 7/7 and committees 7/7 for Steel and for a board viewer; academy 35/35, calendar, SOPs and Requests drives green. (`test/w116drive.js` stops at the profile editor on the live build too: the first-run popovers cover the button; it goes on the browser test list.)

## For Steel

- Confirm the chairs at the next meeting and tick "the board confirmed the chair" on each committee (they show as proposed).
- Steel and Kellian's renewals are due Q3 2026 (this month); the October 19 meeting can vote them.
- The seats and titles (Kellian chair, Steel vice chair, Daniela treasurer) come from the board circle list; edit them on a director's sheet if any are off.
- The internal leads come from the July deck; update them on each committee as the teams change.
