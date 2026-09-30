# 30/09/26 - wave169: the master onboarding runs the Academy, and trainings are assigned to the organization

Not to be confused with the plans for volunteer texts, WhatsApp links and itineraries (claude/hub-wave169-plan-texts-whatsapp-itineraries.md and claude/hub-wave169b-plan-volunteer-faq-by-text.md), written the same night under the same number and not built yet: build those under the next free number (wave171 or later: wave170 is the inbox assistant and info@).

Steel (29/09/26): "the master onboarding in the hr center that controls the onboarding. I want to make that's synced to what people see on their Avenue Academy page. Also, I want HR to have the ability to assign trainings to the org through that same page in the hr center. Leaders should have that ability on the Avenue Academy page as well".

## The master onboarding is what people see

The master onboarding (HR centre, Onboarding) was already the plan every person gets; what each week looked like in the Avenue Academy (its stop on the journey: title, photo, goals, why it matters, the lesson that opens it) lived elsewhere. Now it is all in one place:

- **Each week says what people see.** Open a week: its photo, title, the three goals, why it matters and the lesson that opens it, exactly as the Academy shows them, with **Edit what people see** (the title, a photo from the Photo library's ready ones, up to three goals, why it matters and the opening lesson, with a live preview). Saving changes the Academy at once (`onboarding_journey_save`).
- **Each step says where it is done.** A step learned in the Academy carries a chip (Academy: Using the Hub; Academy: their team's Learning Avenue), and the lesson that opens a week says so. A step's editor has **Done in the Avenue Academy**: a module, a Learning Avenue, their team's avenue or one they choose; the step then ticks itself when they finish it there. New steps can be Academy steps from the start.
- **Preview what a new person sees** opens the journey as it looks on day one (read only: nothing can be ticked or sent), and **Journey**, next to each person on the onboarding board, shows theirs as they see it today. Closing a preview goes back to the HR centre.
- **The database keeps them in step** (`wa169_sync_assign`): a step moved to another week takes that week's due date in every plan in progress; a step newly linked to the Academy ticks itself for those who already did it; the Learning Avenue Your onboarding is the master's own Academy modules, in the master's order; weeks HR adds (90 DAYS, 6 MONTHS) get their own due dates.

## Assigning trainings to the organization

- **Who**: HR (its access profile), leaders and admins (`wa169_can_assign`, the same rule on the page).
- **What**: one or more modules or Learning Avenues; **to whom**: everyone (the whole team, not the board), teams, or people; with an optional due date and a note. People who join later (or join the team) get it too, unless it was for named people. What someone already finished stays done; nobody is asked twice.
- **Where**: the HR centre's Onboarding view (**Assign trainings to the organization**, after the master onboarding) and its Training view (**Trainings assigned to the organization**: every assignment, how many people are done, on the way or late, **See who** and **Stop**, which removes it from the people who had not started and leaves what people started). Leaders and HR also assign from the Avenue Academy: **Assign a training** at the top, and **Assign** on a module or a Learning Avenue. The HR centre's bulk assign opens the same form.
- **What people see**: **Assigned to you**, at the top of their Academy: each training with its due date (late ones first), who asked and why, how far they are and Start or Continue; a finished one stays two weeks. Up next no longer repeats them.
- **Stopping** keeps the history: the assignment is ended (who and when), its rows nobody started are removed, the rest keep their progress.

## Also

- **HR's own access profile opens the HR centre.** The profile promised "Use the HR centre: onboarding plans, hours, recruitment and policies", but the page answered "for admins and leaders" (Samson); wave46's and wave47's checks now include the HR profile.
- **The Training view was empty.** The Trainings section was titled "Training" while the view looked for "Trainings", so it showed under Onboarding and the Training view had nothing; it is **Trainings across the team** now, in the Training view.
- **On a phone**, the bar at the bottom steps aside while a form is open, so its buttons are never under it (every form in the Hub).
- **Training**: Hub module 7, the HR centre and Academy tours (two stops for the master and assigning, one for Assigned to you), the HR centre's help; the access profiles say it (HR, executive, what a team's lead gets).

## For Steel

- Nothing is assigned yet: the first assignment is HR's or a leader's to make.
- The HR team: Tuna and Valex are admins; Samson (HR profile) now has the HR centre as his profile says.

## Releases

- The page: `74c812c4f1525bcce15a294f96f8115c` to `ff3cd4b1661037903383784d888130d4` (30/09/26, 01:19 UTC; gated deploy, host-sync, the live page checked byte for byte on wa-exec-dashboard.netlify.app and hub.welfareavenue.com; change_log 3649).
- Migrations: `wa169_sync_assign` (20260929110000), `wa169b_training` (20260930090000), `wa169c_grants` (20260930091000). The security advisor has no ERROR findings; the new functions are not executable by anon.
- Checked in the database as the people themselves (then rolled back): Samson (HR profile) can assign, stop and edit what a week shows; Joy (a team member) cannot assign and reads the assignment meant for her.

## Files

- `build/parts169/` (a_head: the look; b_data: the Academy's catalog, the assignments, the journey's settings, the photos; c_master: the master's weeks and steps, the week editor, the step editor; d_assign: the assign form and the HR centre's cards; e_mine: Assigned to you; f_preview: the preview; z_wire: the wiring and the tours) into `build/src/169_wave169.seg`.
- `046` (HR's profile, the Trainings title, the help), `047` (HR's profile), `122` (the hooks: the preview in the plan sheet, Assign at the top, on a module and on a Learning Avenue, Assigned to you on the home, Up next), `parts166` (the plan in a preview), `parts167` (the preview, weeks HR adds, reloading the settings).
- `build/data/wa169_sync_assign.sql` (20260929110000), `wa169b_training.sql` (20260930090000) and `wa169c_grants.sql` (20260930091000: `wa169_can_assign` for signed-in people only, the template's trigger function for its trigger only), each with its `.rec.sql`.
- `test/w169drive.js` (72 checks); `test/boot.js` has a `plain` identity (a team member with no HR or leader access).

## Tests

Before the release, on the build: the drive tests from wave130 to wave169 (37 files, 1,182 checks) passed, after one check in `test/w153drive.js` was brought up to date (it expected the HR profile to get the HR centre's notice); `test/w124drive.js` for staff and a board member, the form pages and the phone sweep passed too. `test/w169drive.js` (72 checks): the master's weeks and steps, the week and step editors (and a refused save), the assign form (search, several trainings, teams, people, a due date, a note, what it sends, a refusal), who can and cannot, the preview (a new person, someone on the board, going back), Assigned to you (the order, late, the avenue's progress, the note, Up next), Assign over a module and a Learning Avenue, and phones. The older wave116 tests (`w116pdrive`, `w116jdrive`, `w127drive`) stop at the same step on the live build as on this one (a tab wave153 hides on computers), so they say nothing about this release.
