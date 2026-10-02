-- wa193_release (02/10/26): run at deploy time, after the page ships (the Fundraising app, wave193).
-- Steel's choice (02/10/26): the app opens for the Fundraising, Executive and Admin profiles. The page is 'fund'; the database
-- follows it (wa_fund_ok() = is_wa_staff() and wa_page_ok('fund')) on every fund_* table and in both functions.
-- 1. access
update public.hub_access_profiles set pages = pages || '{"fund":"all"}'::jsonb where key in ('fundraising', 'executive', 'admin');
update public.hub_access_profiles set pages = pages || '{"fund":"none"}'::jsonb where key not in ('fundraising', 'executive', 'admin');
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'access_profile', key, 'pages', null, 'fund: ' || (pages ->> 'fund') || ' (wave193, the Fundraising app)', 'wave193' from public.hub_access_profiles;

-- 2. the page tour in the Avenue Academy (wave122's engine; w122.tours.fund is registered by the page)
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
values ('Hub tours', 'Page tour: Fundraising app', 'Events, donors, grants and the money they bring: the pipeline, Found for you, the funders, the grant writer, the playbook and the fact base, the calendar, the donor program and the event SOPs.', 'hub', 'Hub page tours', 40, true, 'tour', 'tour:fund', $j${"tour": "fund", "tab": "fund"}$j$::jsonb, 3, 20)
on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, body = excluded.body, minutes = excluded.minutes, path_group = excluded.path_group, sort = excluded.sort, category = excluded.category, kind = excluded.kind, active = true, updated_at = now();

-- 3. the Hub module (wave190's shape: Goal, the parts, Try it, Done when)
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
values ('General', 'Hub module 10: the Fundraising app', $d$Goal: Know where the money work lives in the Hub, and how the grants pipeline, the scanner and the writer fit together.

**One app for the money**

The Fundraising app (the 9 dots, then Fundraising) holds the events and their calendar, the donor program, the event SOPs, and the grants. It opens for the Fundraising team, the executives and the admins; the database follows the same rule.

**The grants pipeline**

Every opportunity and application has a row with a stage: watching (a future cycle), found (the scanner found it), screened (the go decision and the fit score), relationship, drafting, submitted, awarded, reporting, and the closed ones (declined, not eligible, dropped, closed). Open a row for its sheet: the dates, the fit, the links, the documents on file and everything that happened. Change the stage from the sheet; the Hub logs it.

**Found for you**

Every Monday morning the scanner re-reads the funder pages on the watchlist and runs its web searches. What is new lands in Found for you and is posted to #grants. Keep puts it in the pipeline at Found, Dismiss sets it aside, Not for us also stops the funder being proposed. Scan now runs it today.

**The writer and the fact base**

Paste the funder's questions, pick the grant, and the assistant drafts every answer from the fact base and our past applications, in our voice, within the word limits. It uses verified facts as written, warns about the ones that need a check, and never states a figure in conflict (it leaves a [confirm: ...] placeholder). Ask for a program officer's review, copy the answers into the funder's form, and keep the final as a past application so the writer learns from it.

**The playbook**

How we win grants is the approach in one page: the fit screen, the proposal sections, the budget, the writing rules, why applications fail, and the pipeline discipline (eight to twelve applications a year, three in the pipeline for every one we need to win). Score the fit on a grant runs the screen for you.

Try it: open the Fundraising app, open a grant from the pipeline and read its sheet, then look at Found for you and the fact base.

Done when: you can say what the stages mean, where the scanner's finds land, and what the writer will and will not say.$d$, 'hub', 'Using the Hub', 929, true, 'read', 'hub:module10-fund', $j${"tours": ["fund"]}$j$::jsonb, 3, null)
on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, body = excluded.body, minutes = excluded.minutes, path_group = excluded.path_group, sort = excluded.sort, category = excluded.category, kind = excluded.kind, active = true, updated_at = now();

-- 4. the reading in Fundraising and grants: the approach, pointing at the playbook page
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
values ('Fundraising', 'How we win grants: the approach', $d$Goal: Know the approach before you screen, write or submit a grant.

**Funders decide, so we think like them**

A program officer reads forty applications against the criteria on their page. We win when we answer exactly what they ask, in their words, with numbers we can prove, and when we only apply where we fit.

**The fit screen before any writing**

The hard gates first (are we eligible, on every line), then seven weighted dimensions: eligibility, alignment, geography, amount, capacity, relationship, odds. Seventy and up is a go; 55 to 69 is conditional (one question to the program officer settles it); under 55 we pass and keep the time. The Hub scores a grant for you from its sheet.

**What a winning application has**

A need stated as a community problem (never our lack of money), with a number and its year; the change we will make, outputs kept apart from outcomes; a plan with dates; a budget that agrees with the narrative; who we are, briefly, with proof. Every claim traces to the fact base.

**The pipeline discipline**

Eight to twelve applications a year, three in the pipeline for every one we need to win, a next step with a date on every open grant, and a thank-you and a report on every award.

Try it: read the playbook in the Fundraising app (Grants, Playbook), then score the fit of one grant from its sheet and compare the verdict with your own.

Done when: you can name the hard gates, the seven dimensions and what separates an output from an outcome.$d$, 'hub', 'Fundraising and grants', 135, true, 'read', 'fund:playbook', $j${"tours": ["fund"]}$j$::jsonb, 4, null)
on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, body = excluded.body, minutes = excluded.minutes, path_group = excluded.path_group, sort = excluded.sort, category = excluded.category, kind = excluded.kind, active = true, updated_at = now();

-- 5. the Monday scan (09:30 Toronto is 13:30 UTC in the fall; the cron runs on UTC): the function chains its own steps
select cron.unschedule(jobid) from cron.job where jobname = 'wa-grant-scan';
select cron.schedule('wa-grant-scan', '30 13 * * 1', $$select public.call_edge('grant-scan', '{"action":"scan","trigger":"schedule"}'::jsonb)$$);

-- 6. the record
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('site_deploy', 'wave193', 'release', null, 'the Fundraising app: grants (the pipeline, the scanner, the writer, the playbook, the fact base), the donor program, the calendar and the event SOPs; the Events calendar moves into the app for whoever opens it', 'wave193');
