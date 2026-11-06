# 06-11-26 - wave285 onboarding pages reshaped

Built on branch `wave285-onboarding-pages` (cut from `b3d0dde`, wave279b, live page md5 0b8e0fa6). Not released, not staged, no live data changed. The spec is `claude/05-11-26 - Onboarding pages reshaped, design (wave285).md`, approved by Steel on 06/11/26 with the three open points on their defaults.

## What changed
- **HR Centre > Onboarding** answers three questions, top to bottom:
  - **Needs you**: failed or stuck automatic steps (Retry), the HR tasks the Hub cannot do grouped by kind ("Adele, Alban, Rana and 2 more: create their Slack onboarding channels", Open the list), a hire waiting on the manager for more than a day (Ask <manager> again, wave275's own button), a hire waiting on HR (choose a manager, choose the times), someone behind by more than a week (Message <first name>, a mailto), the first password when it is not set (admins), and a backed-out hire with things to take out by hand. "Nothing needs you." when empty.
  - **Everyone**: a summary line ("8 onboarding · 1 behind · 1 finished this month"), then one row per person under Offer out, Accepted, Starting, Weeks 1 to 4, 60 and 90 days: name and role, manager, whose turn in words, one figure for the stage, Open. Finished plans and backed-out hires are count lines with See them.
  - **Open**: a side panel (full screen with Back on a phone) with Overview (Now, the journey timeline with dates, the actions menu), Setup (the twelve automatic steps folded to one line, failures and HR tasks open, the access block, the hire's own twelve ticks, HR's own checklist), Plan (by section, folded to "9 of 14 done", the current one open, Role trainings in 60 days, Open the full checklist), Academy ("Academy trainings 18 of 20" and each path).
- **The actions are wave271's and wave275's own.** The panel draws their card for the flow (`window.o271R.readyCard / startedCard`) into a detached element and places its parts; everything sits in one element carrying `data-o271flow`, so their document handlers work unchanged. The card of the open flow is removed from wave271's hidden section after each paint, so the page never holds two copies.
- **One progress rule** (`window.w285.plan`): leaf steps only; a group header is done when its children are and never counts; a setup step (`setup_covered`) counts when the person's setup covered it (no flow: they joined before automatic setup; a flow: all twelve setup ticks in); a step whose Academy training is done counts. Behind = open steps in a section that has ended (day one + 7, 14, 21, 28, 60, 90). It sits behind `wa37Pct` (the Training tab, wave39, wave44, wave46, the profile), wave166's `planStates` as wave167's journey reads it, the checklist's week counts, the Academy's plan header and orgState, the manager's Home card and the panel.
- **Sub-pages**: Onboarding plan is renamed **Plan template** (with the first password on its settings line when set, admins); new **Onboarding insights** holds the quizzes and what new members said.
- **Retired on this page** (hidden, still callable): Ready to onboard and Onboarding started cards (#o271), Who is onboarding rows and tiles, the Assign an onboarding picker, the Welcome kit.
- **Team profile**: the onboarding bar uses the rule and has Open (HR); someone with no plan gets **Start an onboarding plan** (asks first, then `onboarding_assign`, the same RPC the picker used, without the Welcome kit).
- **Applications**: at Offer and Hired the Next hint says "Onboarding starts when they accept" with **See their onboarding**, which opens their row.
- **Manager's Home**: "Your new hires", one card per hire (whose turn, the figure, this week's moments with their ticks, Propose times when it is theirs, Open to the same panel) in place of the lead's card and wave275's list.
- **Words and help**: the HR Centre walkthrough "onboarding a new person" is now a short look-only tour of the new page; the getting-around, recruitment and training walkthroughs and the HR Centre tour name Plan template and Onboarding insights; the page's "How this page works" explains each of the three sub-pages.

## Segments touched
- New: `build/parts285/` (a_core.js, b_page.js, c_panel.js, d_home.js, assemble.py) -> `build/src/285_wave285.seg`, in MANIFEST after 279_wave279, before 164 and 110.
- Small edits where a wrap is impossible (closure-internal counts):
  - `build/parts166/c_plan.js` (-> 166_wave166.seg): the checklist's week counts and header ticks, and syncHead's "x of y steps", ask `window.w285` when it is there.
  - `build/parts122/c_core.js` (-> 122_wave122.seg): orgState's total and done ask `window.w285.plan`.
- No SQL, edge function or table change.

## How to undo
Put back index.html md5 0b8e0fa6 (the live page). Nothing else changed.

## Tests (offline, against build/candidate.html md5 cd81628c, 8,086,989 bytes, all LF)
- `test/w285drive.js` with `test/w285fx.js` (demo, rules, worst, empty, one, forty, home; widths 375, 768, 1280 and a 200% root font): **188 passed, 0 failed**, no page or console errors. Alix-like plan: Weeks 1 to 4 = 24 of 41, plan 24 of 53, W1 9/14, W2 9/12, W3 6/9, W4 0/6, 60 days 0/7, 90 days 0/5, Academy "Your onboarding" 8 of 10 (the same numbers were confirmed on the live tables, read only, for onboarding 4).
- Older drives on the same build: w279drive 113/0, w272drive 152/152 (Home), w215drive 25 passed 2 failed then stops, exactly as on the live page (the offer letter step, not this wave). w271drive and w275drive stop early by design: they drive the Ready to onboard cards, which this wave hides (w271drive 10/2, w275drive 12/2 before a click on a hidden card). Run again with those blocks shown again (`BOOT_INIT`, a style that unhides them): w271drive 149 passed 2 failed (the first password box is no longer in wave271's section, it is in Needs you; the "database refuses" check fails only because the style forces the section visible) then stops at the password box; w275drive 52 passed 1 failed (the same password box) then stops on Home, where the long cards are replaced by one card per hire. No failure points at wave271's or wave275's own logic.
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
