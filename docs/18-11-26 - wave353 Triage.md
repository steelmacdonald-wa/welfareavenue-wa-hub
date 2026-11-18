# 18/11/26 - wave353: Triage, tasks and requests one card at a time

Steel, 18/11/26: Ask the Hub and the overdue tasks no longer showed when people opened the Hub. He wants tasks as swipe
cards (right = done, left = a later date: next meeting, in 7 days or a date they pick), with Task bank, Reassign and Move
to a different project on the card. Then: leaders should triage the requests that reach them the same way, route a
request to a person or a team (Amanda pushes a marketing request back to marketing), see where it stands, and the Hub
should learn where each kind of request belongs. He should stop getting the Hub's automated requests.

## Status
- **Database: live** (18/11/26 00:20 Toronto). New functions and tables only, plus one trigger that does nothing until
  someone saves a rule. Nobody sees a change yet.
- **The page: tested, waiting for Steel's go.** Run `build/data/18-11-26 - wave353 release.sql` in the SQL editor. It
  checks every md5 and stops if the live page moved. Undo: `build/data/18-11-26 - wave353 undo (only if needed).sql`.

## Why nothing showed
- The due-date check (wave213) and Ask the Hub's note (wave320) both start from the end of the `startApp` chain. If
  any step in that chain fails on someone's real data, neither starts. The harness, on test data, shows both, so the
  live failure is data-dependent.
- Ask the Hub's note tried three times in its first 52 seconds (at 8, 22 and 52 s) and gave up for the visit whenever
  something covered it. For anyone with late tasks, the due-date check always covered it.
- The data side is fine: `wa237_due_check` returns rows for real people (Amanda 28, Steel 4 tonight).

## What people see
- **Triage opens on its own** once the Hub has loaded (loading screen lifted, signed in, on the roster), not from the
  end of `startApp`. It waits for the Loop's gate, a tour or a lock card, as the old list did. If `wa237_due_check`
  fails, the old list takes over.
- **Task cards** (the same rows as the due-date check, saved through the same `confirm_due_check`):
  - Swipe right, the Done button or → : done.
  - Swipe left, Later or ← : Keep the date (when a meeting set one), Next meeting, In 7 days, or Pick a date.
  - On the card: Reassign (anyone on the roster, own team first, with a due date), Task bank (2 weeks, a month,
    3 months or a day), Move project (`wa353_task_project`; the task follows the project's team and stays on the
    list), Discard.
  - "Is this yours?" cards ask Mine / Not mine first. Lead cards ("Who owns this?") lead with Give it to someone.
  - Each choice waits 5 seconds with Undo before it saves. Skip for now sends a card to the back.
  - Tasks still have to be sorted before it closes, as the due-date check required.
- **Request cards** follow (`wa353_request_deck`): requests assigned to the person, and unowned ones for a team they
  lead. Finance goes to the lead whose role names finance (Suhaib). An admin gets unowned requests only for a team
  with no lead, so Steel now gets none of the Hub's automated ones.
  - Swipe right or Mine: keep it (it becomes theirs, sorted).
  - Swipe left or Send on: a team, a person, or both. "Always send these here from now on" (the team's lead or an
    admin) saves a rule, and the next request of that kind goes there by itself, before anyone is told.
  - "Last time these went to …" with Send there, from earlier routes.
  - Where it stands (the request type's own statuses), Mark done, Open in Requests.
  - "All n like this" applies one choice to every request of the same kind (Amanda's 25 gift-drive sign-ups).
  - Finish later closes once only requests are left. Requests alone open Triage once a day; otherwise they wait on Home.
- **Home:** "Sort your tasks and requests" with the counts and Start, while anything is left.
- **All sorted:** "Ask the Hub what's next" opens the chat with The Hub suggests. After Triage closes, Ask the Hub's
  note is tried every 20 seconds for 10 minutes until nothing covers it (still once a day, still off with Stop these
  notes).

## Tonight's counts (as each person, read only)
| Person | Requests to sort |
|---|---|
| Amanda | 27 (26 hers: 25 gift-drive sign-ups, a grant request, and a marketing website message) |
| Ian | 8 · Kahkashan 7 · Ahmed 5 · Suhaib 2 (reimbursements) · Steel 0 |

## Notifications
Nothing new is sent. Sending a request on announces it the way a new request is announced (notify `request_filed`:
the person, else the team's leads), so the new team knows it is theirs. Status and owner changes go through the
existing `trg_wa123_request_update`, as they do from the Requests page.

## Database (build/data/wa353_triage.sql)
- `wa353_task_project(task, project)`: the caller's own task only; change_log.
- `dept_requests.triaged_at`, `triaged_by`.
- `wa353_request_routes`: every send-on (staff read). `wa353_request_rules`: where a kind goes from now on (staff
  read; written only by `wa353_request_triage`), applied by the BEFORE INSERT trigger `wa353_route_new`.
- `wa353_my_teams()`, `wa353_request_deck()`, `wa353_request_triage(p)`: checks inside (assignee, team lead or admin).
- `site_files_bak_wa353` (made by the release), `wa_stage_353` (the tested segment; drop after release).

## Tested
`test/w353drive.js`: 58 checks on the live page plus the segment, at 1366 px and 390 px with touch: opens on its own,
the old list stays away, every swipe, sheet and button saves the right item, Undo saves nothing, bulk status, the
rule, escaping, no page errors, nothing to sort, and the fallback to the old list.

## Not in this wave
- info@ emails: the Hub learning where emails go (wave170's hand-offs) can reuse these rules next.
- A Requests-page view of the saved rules (to see or switch one off). Today: `wa353_request_rules` in the SQL editor.
- Page tour for Triage, and an Academy line.
