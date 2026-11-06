# 06-11-26 - wave285 onboarding pages reshaped

Built on branch `wave285-onboarding-pages` (cut from `b3d0dde`, wave279b, live page md5 0b8e0fa6). Not released, not staged, no live data changed. The spec is `claude/05-11-26 - Onboarding pages reshaped, design (wave285).md`, approved by Steel on 06/11/26 with the three open points on their defaults.

## What changed
- **HR Centre > Onboarding** answers three questions, top to bottom:
  - **Needs you**: failed or stuck automatic steps (Retry), the HR tasks the Hub cannot do grouped by kind ("Adele, Alban, Rana and 2 more: create their Slack onboarding channels", Open the list), a hire waiting on the manager for more than a day (Ask <manager> again, wave275's own button), a hire waiting on HR (choose a manager, choose the times), someone behind by more than a week (Message <first name>, a mailto), the first password when it is not set (admins), and a backed-out hire with things to take out by hand. "Nothing needs you." when empty.
  - **Everyone**: a summary line ("8 onboarding · 1 behind · 1 finished this month"), then one row per person under Offer out, Accepted, Starting, Weeks 1 to 4, 60 and 90 days: name and role, manager, whose turn in words, one figure for the stage, Open. Finished plans and backed-out hires are count lines with See them.
  - **Open**: a side panel (full screen with Back on a phone) with Overview (Now, the journey timeline with dates, the actions menu), Setup (the twelve automatic steps folded to one line, failures and HR tasks open, the access block, the hire's own twelve ticks, HR's own checklist), Plan (by section, folded to "9 of 14 done", the current one open, Role trainings in 60 days, Open the full checklist), Academy ("Academy trainings 18 of 20" and each path).
- **The actions are wave271's and wave275's own.** The panel draws their card for the flow (`window.o271R.readyCard / startedCard`) into a detached element and places its parts; everything sits in one element carrying `data-o271flow`, so their document handlers work unchanged. The card of the open flow is removed from wave271's hidden section after each paint, so the page never holds two copies.
- **One progress rule** (`window.w285.plan`): leaf steps only; a group header is done when its children are and never counts; a setup step (`setup_covered`) counts when the person's setup covered it: their roster profile (`team_members.created_at`) was made before automatic setup began (`app_config onboard_v2_since`, data every staff member reads), or their flow's twelve setup ticks are all in; anything not known counts as not covered; a step whose Academy training is done counts. Behind = open steps in a section that has ended (day one + 7, 14, 21, 28, 60, 90). It sits behind the figures: `wa37Pct` (the Training tab, wave39, wave44, wave46, the profile), wave166's `planStates` as wave167's journey reads it, the checklist's week counts, the Academy's plan header and orgState, the manager's Home card and the panel. **The decisions that write** (wave37's "completed" on the last tick, wave122's `complete`, which gives the onboarding certificate, and its XP) use `window.w285.completeKnown`: complete when every row is ticked in the table, or when the rule's facts are all known and every real step is done (the plan's rows are in the tables, a setup-covered step was decided from data, an Academy-done step came from training_progress this viewer loaded); anything unknown falls back to the raw count. When wave37 completes a plan by the rule it first writes the rows the rule counted as done in `onboarding_steps` (its existing write), with `done_by` 'Hub: done when its steps were' (a header), 'Hub: done at setup' or 'Hub: done in the Avenue Academy', so the table agrees with what people saw.
- **Sub-pages**: Onboarding plan is renamed **Plan template** (with the first password on its settings line when set, admins); new **Onboarding insights** holds the quizzes and what new members said.
- **Retired on this page** (hidden, still callable): Ready to onboard and Onboarding started cards (#o271), Who is onboarding rows and tiles, the Assign an onboarding picker, the Welcome kit.
- **Team profile**: the onboarding bar uses the rule and has Open (HR); someone with no plan gets **Start an onboarding plan** (HR only; asks first; reads the plans again and refuses when the member already has one that is not completed, since the server allows any staff and has no duplicate guard; then `onboarding_assign`, the same RPC the picker used, without the Welcome kit). A member with a plan in any other state is told so instead of seeing the button.
- **Applications**: at Offer and Hired the Next hint says "Onboarding starts when they accept" with **See their onboarding**, which opens their row.
- **Manager's Home**: "Your new hires", one card per hire (whose turn, the figure, this week's moments with their ticks, a hire's help request with wave166's Dealt with, Propose times when it is theirs, Open to the same panel) in place of the lead's card and wave275's list. The page reads the plans for the manager too, so their figure is the rule's, the same as HR's; without the template rows it counts the ticks and says "ticked".
- **Help requests**: wave39's open requests are in Needs you ("<name> asked for help with <step>", Dealt with through wave166's onboarding_help_resolve) and on the panel's Overview.
- **Words and help**: the HR Centre walkthrough "onboarding a new person" is now a short look-only tour of the new page; the getting-around, recruitment and training walkthroughs and the HR Centre tour name Plan template and Onboarding insights; the page's "How this page works" explains each of the three sub-pages.

## Segments touched
- New: `build/parts285/` (a_core.js, b_page.js, c_panel.js, d_home.js, assemble.py) -> `build/src/285_wave285.seg`, in MANIFEST after 279_wave279, before 164 and 110.
- Small edits where a wrap is impossible (closure-internal counts):
  - `build/parts166/c_plan.js` (-> 166_wave166.seg): the checklist's week counts and syncHead's "x of y steps" ask `window.w285` (in try/catch, falling back to their own count); a step the rule counts (setup-covered, Academy) shows ticked and locked with why ("done at setup"), a header is locked ("done when its steps are").
  - `build/parts122/c_core.js` (-> 122_wave122.seg): orgState's figure and next step ask `window.w285` (the first open real step, never a header or a covered step); `complete` (the certificate) is the raw count or `completeKnown`; XP is full when complete, else the raw count.
  - `build/src/037_wave37.seg` (a raw segment): the tick handler completes on `window.w285.completeKnown` (raw count as the fallback), writes `w285.derivedRows` done first, and reactivates only when neither says complete.
- No SQL, edge function or table change.

## How to undo
Put back index.html md5 0b8e0fa6 (the live page). Nothing else changed.

## Tests (offline, against build/candidate.html md5 f674852a, 8,103,280 bytes, all LF; after the second review fix)
- `test/w285drive.js` with `test/w285fx.js` (demo, rules, worst, empty, one, forty, home; widths 375, 768, 1280 and a 200% root font): **209 passed, 0 failed**, no page or console errors. Since the review it also checks: nothing completes or certifies early in a hire's own view, in HR's view before wave271 loads, or for a flow more than 30 days past its call (and ticking the last open step writes no "completed"); the checklist's locked boxes and their words; help requests in Needs you and on the Home card, with Dealt with; the manager's figure equal to HR's for the same hire; Propose in the panel after wave275 redraws Home; a refused Home tick gives its box back. Alix-like plan: Weeks 1 to 4 = 24 of 41, plan 24 of 53, W1 9/14, W2 9/12, W3 6/9, W4 0/6, 60 days 0/7, 90 days 0/5, Academy "Your onboarding" 8 of 10 (the same numbers were confirmed on the live tables, read only, for onboarding 4).
- Older drives on the same build: w279drive 113/0, w272drive 152/152 (Home); before the review on the first candidate (cd81628c):  w215drive 25 passed 2 failed then stops, exactly as on the live page (the offer letter step, not this wave). w271drive and w275drive stop early by design: they drive the Ready to onboard cards, which this wave hides (w271drive 10/2, w275drive 12/2 before a click on a hidden card). Run again with those blocks shown again (`BOOT_INIT`, a style that unhides them): w271drive 149 passed 2 failed (the first password box is no longer in wave271's section, it is in Needs you; the "database refuses" check fails only because the style forces the section visible) then stops at the password box; w275drive 52 passed 1 failed (the same password box) then stops on Home, where the long cards are replaced by one card per hire. No failure points at wave271's or wave275's own logic.
- Screenshots: `C:\Users\iolui\AppData\Local\Temp\claude\...\scratchpad\w285shots`.

## Break-ui findings, fixed
- The Slack onboarding channel step waiting for the hire to join Slack read as "stuck": five false failures in Needs you and "HR: 1 setup step failed" on every starting row. It is now a wait, as wave278 says.
- The Team profile bar never showed: wave116k builds the profile through a decoy section and HR is known only after the first paint. The bar now paints into wave116k's own slot, and again a moment later.
- Applications' "See their onboarding" opened the panel and the page change closed it at once. It now waits for the Onboarding page.
- The rows' white fallback failed the brand check (no pure white): they use the brand card colour.
- Link-buttons (Message <name>) were underlined by the global link style.
- Nothing overflowed at 375, 768, 1280 or a 200% root font, with the long names, the long unbreakable address, emoji and non-Latin names, 0, 1 and 40 hires.

## Design decisions for Steel
- A plan with no flow (an existing member such as Zachee) counts its four setup steps as done (the spec's rule), so Zachee reads 3 or 4 of 41, not the mockup's 0 of 41.
- "Your turn" accent: only when it waits on the person looking (HR for HR's items, the manager for their own hires). The mockup accented "Shima to propose times" for Steel.
- Backed-out hires: a Needs you line when there is something to take out by hand, and a count line under the list (the spec does not place them).
- "Waiting on the manager" goes to Needs you one day after the offer or the Accept.
- "Message them" is an email link (the Hub has no direct message to send from here).
- A section ends on day one + 7, 14, 21, 28, 60 or 90 days (not the steps' due dates, which carry old dates after a restart).
- A plan-only person's manager is the person their position reports to in the org chart (onboardings has no manager).
- On a phone the row keeps the manager in its second line.
- A manager opening a started hire sees wave271's own buttons, Change manager and the HR task's Done included, as on today's card (onboard-run is the lock).

## Not verified live
Signed in on the real page with live data: the numbers for the real cohort, the panel's actions against the real onboard-run, Home for a real manager, the walkthrough end to end, the Applications link.

## Code review fixes (06/11/26)
1. Setup cover no longer comes from "no flow in memory": it is the roster profile's created_at against onboard_v2_since (or all twelve ticks); unknown counts as not covered. wave37's completion, wave122's certificate and its XP use the raw count. Drive checks: the hire's own view, HR before wave271 loads, a flow more than 30 days past its call; the last tick writes no "completed".
2. Help requests: wave39's open ones in Needs you and on the panel; the lead's card's on the manager's Home card; Dealt with is wave166's own button, and wave39's list is read again after it.
3. wave166's checklist: rule-done steps ticked and locked, labelled "done at setup" or "done when its steps are" (headers locked); the new calls are in try/catch with the old values as the fallback.
4. The manager's figure: the page reads the plans on Home (every staff member can), so it is the rule's; the lead's card alone takes the template facts by name and section, or says "ticked". Drive check: Home and HR show the same figure.
5. The open card is taken out of #o275mine after every Home paint and every change the #mpBody observer sees, not only after R.paint. Drive check: Propose opens in the panel after wave275 redraws Home.
6. Matching: practice flows are never matched to a plan, and a name is used only when neither side has a member id.
7. plan() is cached per pass (cleared on the next tick and when the arrays it reads change); the finished rows are worked out only when See them is open.
8. wave122's next step and week are the rule's first open real step.
9. A Home tick box is redrawn after wave166 answers (1.5 s and 4 s), so a refused save never leaves it disabled.
10. Start an onboarding plan: HR only; hidden, with a line saying so, when the member has a plan that is not completed; the plans are read again just before onboarding_assign.

## Second review fix (06/11/26): plans can complete again
Locking the headers and the setup-covered steps (finding 3) and completing on the raw count only (finding 1) together meant raw done could never reach raw total, so nobody completed or got the certificate. Now `w285.completeKnown(onbId)` decides (raw complete, or the rule complete with its facts known), wave37 and wave122 both use it, and wave37 writes the derived rows done before it marks the plan completed. Drive checks: the last real step completes Cara's plan with 8 headers and 3 setup steps open in the table, and those 11 rows are written first; a hire who finished her real steps (one of them in the Academy) is complete in wave122, but not while her training_progress is not loaded; HR before wave271 (Hana), a flow more than 30 days old (Otto) and one whose cover is unknown (Uma, no created_at) still do not complete.
