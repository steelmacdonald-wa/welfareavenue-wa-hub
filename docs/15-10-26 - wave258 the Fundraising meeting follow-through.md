# 15/10/26 - wave258: the Fundraising meeting's follow-through

Tonight's Fundraising meeting (Amanda Zoldak, the lead; Alyx Denison and Alexis Walter, new) and Steel: "I'll make those
improvements tonight". Live 15/10/26 about 23:28 Toronto: index.html `432cf4999e3228b970b6e2dd89ceddd3` (on wave257's
`9803ee6f`). Note: a parallel session also released a "wave258" tonight (03:19 UTC, the volunteers' /c/ confirm page and the
`wa258_*` database functions). The two share the number only; no file is shared.

## What changed

1. **Home chips** (build/src/258_wave258.seg, decorating renderMyPage after each render; clicks taken in the capture phase):
   - my open tasks scrolls to My tasks and lights it up;
   - team tasks opens the person's team page (`#team/<team>`);
   - open decisions: for anyone who is not an admin or on the executive team (`team_members.department` exec or the
     Executive profile), the chip counts their own team's open decisions ("2 open decisions for Fundraising") and opens the
     team page at its Executive decisions card, or says "Fundraising has no open decisions right now." Admins and the
     executive team keep the executive view (`#overview`). Who may open the Dashboard is unchanged;
   - incoming requests opens the team page at its requests. Home is drawn once more inside the start when the requests
     arrive after the first paint, so the chip is there.
2. **Requests first on a team page**: when a team has open requests (asked of it by another team, in a meeting or through
   Requests), "Asked of <team> (n)" sits under the title, above the page's tabs, on every team page view; a request opens in
   place (wave123's sheet); asks the Hub heard in meetings but nobody accepted are counted with a link to the team inbox.
3. **Grants has its own page** (`#grants`, WA_NAV.register, in the Fundraising row of the menu through wave116's ADOPT):
   the Grants workstream's tasks (`dept_tasks` fundraising, subsection Grants, plus the grants board's projects) on the
   standard task board (tick, the drawer with comments and To the bank, drag), counts (open, overdue, due this week, no date),
   Overseen by the grants lead (the team member whose role says Grants lead: Suhaib), Add a grants task (the board's quick
   add, filed under fundraising / Grants) and Open the grants pipeline (`#fund/grants`, for people who can open the
   Fundraising app). No new team code. On the Fundraising team page: a Grants tab beside the Events calendar, the Grants
   group of the task board is a pointer ("Grants has its own page now: open Grants"), and the totals (open, overdue, done)
   leave grants out (`window.w116TasksFor` wrapped; `#team/fundraising/grants` and the Grants page keep them). Access:
   Grants follows Fundraising (`wa40Allowed` wrapped; every access profile has `grants` with Fundraising's decision).
   Page tour `w122.tours.grants`, trainings row `tour:grants` (id 245).
4. **The task check** (parts213): one line at the top, "Answer each task to carry on: Done, a new date, or Not mine. The Hub
   opens right after you save.", and "x of n answered" with a bar (a task counts when it has a date still ahead, Done,
   Discard, To the bank with a day ahead, Mine or Not mine, or a lead's owner). Still no way to skip it.
5. **The Academy's Assign** (parts122): the meeting's "Weird, I can't assign Alex to it" was Alyx, who had finished the Golf
   tournament fundraiser training twenty minutes before: her box was greyed out with only a faint "done". The list now says
   "Already finished <date>" in bold, a line above it says who already finished, and the search also reads emails and the
   names people go by (`team_members.nicknames`). The server (`academy_assign`) was fine (checked as Steel, rolled back).
6. **loom-pull v4** (platform version 15): see docs/EDGE_FUNCTIONS.md. A transcript Loom has not finished waits for the
   next pull instead of being filed.

## Data (build/data/wa258_fundraising_follow_through.sql)

`hub_access_profiles.pages.grants` = the profile's Fundraising decision (all but board and marketing: all; those two: none);
`trainings` tour:grants; change_log lines. No new database objects.

## Tests

- test/w258drive.js 42/42 (Amanda, Alexis, an admin, a marketing member, the board, phone width): the chips, decisions to the
  team page, requests above the tabs and the sheet, totals without grants, the pointer, the Grants page (rows, drawer, quick
  add filed under Grants, pipeline), the task check's line and count, Escape still blocked, the Assign list.
- Regression, same on wave257 and this build: w213 21/21, w177 36/36, w217 36/36, w153 46/46, w193 44/44, w256 30/30,
  w257 24/24, w242 31/31, w222 13/13 (one of four runs under heavy parallel load had 12/13, the slow member check; green
  three times alone), w134 29/34, w163 38/40, w124 34/35, w123 49/52 (the same failures on wave257). Tour grants 5/5.
