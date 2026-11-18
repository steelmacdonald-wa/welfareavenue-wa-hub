# wave353: simple onboarding (live 18/11/26, 05:30 UTC, on Steel's yes)

Steel (17/11/26): "Simplify the onboarding process once they accept their offer. They should be automatically given all the accesses needed. Leave the onboarding meeting and one-on-one up to the HR representative and the manager. Just take it out [...] I just want people to be onboarded and given the onboarding email once [...] they accepted their offer. Their manager [and] the HR representative taking care of it should both get a notification on Slack [...] and then they have the ability to send them their onboarding, which would give them that onboarding email [the Fall Cohort one]."

Branch `claude/simple-onboarding` from af916daa (wave279, the live onboard-run source; onboard-link and /o/ unchanged since c3fd368, checked byte for byte).

## The new flow (app_config `onboard_simple` = on)
1. **Offer sent**: nobody is asked for times (ask_manager answers skipped 'simple'; the hourly job sends no propose links, reminders or grids).
2. **Accept**: the access steps run as before (roster, Google account, Hub access, Groups, drives). Then the flow's manager and the card's owner (the HR person handling the hire) get one `onboard_ready` notice, Slack DM plus Hub: "<name> accepted their offer! [access state]. Send their onboarding when you are ready. Their first meeting and 1-on-1 are yours to set up." With one link, `/o/<mgr token>?send`. Neither known: hr_notify_emails. Remembered in `setup_ticks.ready_told_at`; a notice that does not get through is retried by the hourly job.
3. **Send page** (`/o/<mgr token>?send`, English): who, their access, the first day (offer start if still ahead, else today; editable, from today on), who it goes to and from, one button. A GET never sends (Slack unfurls). Whoever presses first sends; the other sees "Sent". Also callable signed in as `send_onboarding {flow_id, first_day?}` (HR, admins, the hire's manager).
4. **send_onboarding**: claims the flow (two presses send once), sets `setup_ticks.first_day`, skips the `invites` and `manager` steps, runs the rest: the plan from the first day (card to Hired), the team's weekly meeting, the welcome. The other person (manager or owner) is told it went.
5. **The welcome**: `simpleWelcomeTemplate`, the Fall Cohort text without the call and 1-on-1 (1 Google account and video, 2 setup checklist and weekly meeting, 3 documents; "<manager> will be in touch to set up your first meeting"), in the Fall Cohort email's branded look (`brandedWelcome`: cohort by season of the first day). Every welcome (simple or not) now uses the branded HTML; the text part is unchanged.
6. **The hire's offer link** after Accept: "Your Welfare Avenue account is being set up now. <Manager> or HR will send you your welcome email", then once sent, the setup checklist link.

Off (`onboard_simple` absent or not "on"), everything is wave275's as before.

## Not in this wave
- The HR centre card in the Hub page still shows wave275's Propose times / Book the times and "waiting on the manager" wording; the Slack link is the way to send. A card button (`send_onboarding` is already allowed for HR and the manager) is a Hub page change for a later wave.

## Release (on Steel's yes)
1. Push the branch; deploy stubs pinned to the commit: onboard-run, onboard-link (`/o/` published by its own pinned fetch into `site_files`, then host-sync).
2. `build/wa353_simple_onboarding.sql` (the switch on). Undo: `build/wa353_undo.sql` (off), then previous stubs (onboard-run af916daa, onboard-link c3fd368) and /o/ md5 e6cdd6af.
3. Live flows at release: Tanise St-Vil (14, accepted 17/11, manager Ian, owner Steel) and Caline Sawaya (11, accepted 06/11, manager Valex, owner Samson) get the notice from the hourly job; Samuel Aubrey (8) has a plan already and is skipped; Amullya Harikumar (15) is still at offer.

## Tests
node: w271run 251 (6 new w353), w271link 67 (1 new), notify/offer/rig/w279notify unchanged: 416 in all, green. Pages: w271page 158, w275page 135 (its "greys" check is flaky before and after), new `test/w353page.js` 18 (the send page at 390 and 900 px, one POST under a double click, no AI, no em dash).

## Released 18/11/26 (Steel: "Release now")
onboard-run platform v6 and onboard-link platform v5, stubs pinned to f9ba9c0; /o/index.html by pinned fetch (md5 69573115, was e6cdd6af), host-sync rid 9002, served by hub.welfareavenue.com; `onboard_simple` on (change_log). The hourly job run by hand (rid 9003) told Tanise's manager and owner (Ian, Steel) and Caline's (Valex, Samson); Samuel (has a plan) and Amullya (at offer) untouched.

## wave354 (18/11/26): the screens HR and managers use, and Applications
Steel: "ensure the user experience for HR and the manager is as simple as can be" and "revisit how the applications page is laid out [...] simple, clean and easy for any manager or new HR rep".
- Onboarding card (wave275), HR Onboarding page and the manager's Home (wave285), for a simple flow: "Ready to send" tag, whose turn "You or <manager> to send their onboarding", Needs you lists who is ready with **Send their onboarding**, the Home card has the same button; the button opens First day (offer start while ahead, else today) and **Send now**. Gone for simple flows: Propose times, Book the times, Enter their availability, the availability switch, the manager's week and one-off dates, the Canva field, "New hire's times". The timeline says "Onboarding sent". Changing the manager tells the new one on Slack with the send link (onboard-run v12, ask_manager from the card).
- Slack notice, shorter: ":tada: *Name* (Role) accepted their offer. Their accounts are ready. <Send their onboarding>, then set up their first meeting with them. (Ian and Steel both got this; whoever sends first, the other sees it.)"
- Applications (wave197's board): a stage bar (New, Reviewing, Interview, Offer, Hired with counts, the exec dashboard's look) over a clean list of one stage at a time; under it what to do at that stage and how many have waited a month or more; long stages show 15 then "Show all"; a row dragged onto a stage in the bar moves through the board's own gates; List or Board (remembered per browser). Nothing removed: the sheet, Select, filters, Not called yet, Best graded first, Interviews to link, the board.
- Press feedback (scale .97, 160 ms, strong ease-out) on the Hub's onboarding and Applications buttons and the send page; the send form and the Sent box arrive with a 200 ms fade; reduced motion respected.
- Built in the database from the live page plus `build/w354/patch354.json` (17 exact replacements and the segment `build/w354/w354.js`), gated on live 6413f287, now 802da183; `/o/` 19f8291c; `wa275_flow_row` returns simple, ready_told_at, first_day, offer_start (migration wa354_flow_row_simple). Undo: put back 6413f287 (`build/w354/build354.py` without the patch, i.e. the previous site_files content) and /o/ 69573115.
