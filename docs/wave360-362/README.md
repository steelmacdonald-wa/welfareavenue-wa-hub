# Waves 360 to 362: HR centre and the HR drive (26/11/26)

Source: Exec Weekly Meeting and Human Resources meeting, 24/11/26.

## What changed

- **wave360, Hiring at a glance.** A card above the HR centre tabs: six steps from applicant to teammate with live counts, "You do" and "The Hub does" for each. Appended to the end of `index.html` in `site_files` (part 10). Source: `w360-hiring-at-a-glance.js`.
- **wave362, tabs folded.** Recruitment, Onboarding and People stay in view; the other HR centre tabs sit under More. Nothing removed. Source: `w362-hr-tabs-folded.js`.
- **Onboarding for all of HR.** `public.wa_is_hr_team()` (HR & People profile, not blocked) can read `hub_onboard_flows` and `hub_onboard_steps`, and passes `wa275_manager_of`, so HR reps can see and send onboarding. Time off, discipline and policy sign-offs stay with `wa_hr_access`.
- **wave361, Closed roles in Drive.** `fn/jd-drive` v3: inside each department folder, closed and filled positions live in `Closed roles`; the sync reads inside it and never treats it as a position. New action `file_by_stage {position_id?, dry_run?}`. Trigger `wa361_position_filed` on `hub_positions` moves a folder when its stage crosses open and closed.
- **Positions tidy.** `public.hr_positions_tidy(p_dry boolean default true)` closes or fills open positions that are no longer a role: filled on the org chart by an active member, held by an active member, or not on the org chart as hiring with no applicant in progress and no applicant activity in 60 days. It never touches a position with an applicant in progress. Runs on the 1st of each month (pg_cron job `hr-positions-tidy`); `select * from public.hr_positions_tidy(true);` shows what it would do.

## Backups and undo

- Page before wave360: table `site_files_bak_wa360`. Restore part 10 from it, then `select public.call_edge('host-sync');`.
- `jd-drive` before wave361 and a snapshot of positions, files and people: table `fn_bak_wa361`. Move folders back out of `Closed roles` before redeploying the old source: the old sync marks anything inside it as gone.
- Stop the monthly tidy: `select cron.unschedule('hr-positions-tidy');`.
