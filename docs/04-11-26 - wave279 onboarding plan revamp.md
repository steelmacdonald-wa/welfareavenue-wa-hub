# wave279: onboarding plan revamp (released 04/11/26)

Released on Steel's "Yes, release it", 04/11/26 evening (Toronto). Design: `claude/04-11-26 - Onboarding plan revamp, design (wave279).md`. Plan: `docs/superpowers/plans/2026-11-04-onboarding-plan-revamp-wave279.md`. Branch `wave279-onboarding-plan` at af916da (pushed, not merged).

## What changed for people

- The plan after setup is reviewed week by week: Week 1 14 steps, Week 2 12, Week 3 10, Week 4 8, 60 days 8, and a new 90 days with 5. Plans with no setup page keep the four setup steps in Week 1 (18).
- The setup page covers four steps, so they are left off plans that went through setup.
- Avenue Academy trainings for everyone, plus Hub app tours. Each ticks itself when the module is done.
- Role trainings: from day 21, the manager picks 2 or 3 for 60 days and 5 or 6 for 90 days in a pop-up on Home. If nobody picks, the Hub picks on day 29 and day 59 and tells the manager.
- Policies are signed on Home after the policy has been open for 10 minutes.
- Falling-behind messages: the hire and their manager (and HR from the third message) on weekdays at 12:35 UTC, through notify and the notification switches.
- New Google accounts get the position's title as their job title at Accept, so the Gmail signature has it.
- Alyx Denison (plan 4) and Zachee Leonel Ngue (plan 5) restart from 04/11/26: their open steps are due 11/11/26 to 02/02/27. Their roster start dates are unchanged. Their role-pick pop-up comes at day 21 (25/11/26).

## What was released, in order

1. Check: live index.html 2ce7ff2f (wave278), notify v31 pinned bbd53a8, onboard-run v4 pinned c3fd368, all unchanged since this branch's base.
2. Backup: table `public.wa_tmp279_backup` (onboarding_template 62, onboarding_steps 367, onboardings 8, wa_policy_signoffs 7, app_config 172 rows; RLS on, no policies). Drop it when happy.
3. `build/wa279a_rules.sql` (md5 1f96e9dc) and `build/wa279b_template.sql` (md5 34b53317), by pinned fetch at af916da.
4. `onboard_behind_since` and `onboard_role_picks_since` = 2026-11-04; `build/wa279c_restart.sql` (md5 2ceb67bd): change_log 11744 (plan 4) and 11745 (plan 5).
5. notify platform v32 (header v21) and onboard-run platform v5 (header v10), one-line stubs pinned to af916da. Both answer.
6. Page: index.html bcf0c01b (7,980,182 bytes, LF), host-sync rid 23219, served by hub.welfareavenue.com. The candidate equals live plus the wave279 segment changes, nothing else.
7. `onboard_behind_on` = on and `policy_read_minutes` = 10 (change_log rows by 'wave279').

Done ticks the release removed (switched-off steps): Alyx's "Pick a Learning Avenue" and "Your team's Learning Avenue (Avenue Academy)", both ticked 01/10/26.

## Proof

- Dry run `wa279_onboard_tick(true)` after the switch: nobody behind, nothing to send.
- Live step counts: plans 10 to 14 (Fall Cohort, via setup) 14/12/10/8/8/5; plans 4 and 5 18/12/10/8/8/5.
- Signed in as Steel (read only): Home loads with no console errors; the HR onboarding board shows "Academy trainings d of 29" per hire (25 trainings and 4 Academy paths, plus role picks later); the master plan shows all six sections.
- Not seen live: the role-pick pop-up (first one due 25/11 for Alyx and Zachee, day 21 for the Fall Cohort) and the policy timer (Steel has signed every policy). Both are covered by the w279 drive.

## Worth knowing

- People who finished onboarding before today see "Updated since you finished" on their Academy onboarding page with the new steps, each with "Got it" (the wave169 feature). No alert or message was sent for this.

## Undo (in this order)

1. `update app_config set value='off' where key='onboard_behind_on'; update app_config set value='0' where key='policy_read_minutes';`
2. Page: put back index.html 2ce7ff2f (from git at 179c2bb, the same way) and run host-sync.
3. notify and onboard-run: redeploy the stubs pinned to bbd53a8 (notify) and c3fd368 (onboard-run).
4. `build/wa279c_undo.sql`, then `build/wa279b_undo.sql`, then `build/wa279a_undo.sql`.
5. If anything is still off, restore from `wa_tmp279_backup`.
