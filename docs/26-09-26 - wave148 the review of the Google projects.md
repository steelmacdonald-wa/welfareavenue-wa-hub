# 26/09/26 - wave148: the review of the Google projects (waves 143 to 147)

Live md5 `79ba7eedff1a1b1985e2814116fa04ba` (4,074,206 bytes), deployed through the gated pipeline (`wa_stage_ru`, guarded on the live md5 `93349ceb` and dropped after). Data: migration `wa148_hardening`. Functions: `board-pack` v13, `meet-attendance` v6, `forms-flow` v7, `search-console` v2.

An independent review of the five new functions, their tables and rules, and the five page segments looked for ways in, leaks and wrong writes. Nothing was open to anonymous callers, every new table has row level security with read-only grants, and every string from the database or Google is escaped on the page. What it found, and what changed:

| Finding | Risk | Fix |
|---|---|---|
| A team lead can edit a board meeting, so could point the pack's stored file ids at any Drive file; a later Build or Refresh would then write to (or clear the slides of) that file with Steel's delegated account. | Medium | The pack column is now the function's alone (a trigger keeps it for the service role), and before writing the function checks that every file is a Hub file of the right kind in the Board of Directors drive; anything else is forgotten and logged. A refresh never deletes slides the Hub did not make. |
| The HR slide still carried HR's goal titles, and no team's goal titles, board items or decisions went through the people filter. | Low-medium | HR shows counts only (goals done, behind, this quarter); every other title, board item and decision passes the same filter as the updates. The Q3 deck already built had no such title. |
| A quiz signed with a first name only could be matched to the one rostered person with that name, tick their onboarding step and let them read the newcomer's answers. | Low-medium | Quizzes are linked by the Google account or the full name only. Others show the written name, not linked. |
| A sign-up matched on the phone before the email, and two runs at once could add the same person twice. | Low-medium | Email first, then phone; one forms run at a time (a lease), so Sync now and the six-hourly run never overlap. |
| Meet attendance could delete meetings just outside the log's six months, and a failed read could look like an empty window and delete board rows. | Low | The window stays inside what the log keeps, and a failed read stops the run before anything is deleted. |
| Meeting links edited by leaders were drawn as links whatever they held. | Low | A link is drawn only for a web address (https), on the board pack card and the other new cards. |
| Reads without paging would stop at 1,000 rows (the finance totals in the deck, the volunteer list, the filed answers). | Low | Paged. |
| Search Console: any staff member could see which properties each identity sees, and any property with "welfareavenue" in its name could be connected. | Low | The details are for admins; only the Welfare Avenue property itself (domain, then website) is connected. |

## Checks

- A leader's update that tries to change the pack leaves it as it was (tested in the database, rolled back).
- Two forms runs at the same moment: the second is told another run is filing the answers.
- The hardened functions ran once each against live data: nothing lost (the Q3 pack's files all passed the check; 14 of 43 policy quiz answers are linked by full name, down from 18).
- `test/w143drive.js` gains a check that a link which is not a web address is left out (16 checks); w144 to w147 pass unchanged (34, 20, 14, 12). The older drives for the board, the dashboard, Analytics depth, Our story, volunteering and the HR people view pass against the live build; two older drives (w116, w120) fail the same way on the build before these waves (test drift, not these changes).
