-- wave226 (09/10/26): confidential by design. Steel: board meetings and his departure must never be found in Ask the Hub
-- or anywhere in the Hub; tasks from confidential meetings still exist but say only what the work is.
-- Applied: part 1's column (migration wa226_route_system_add, 09/10/26). Parts 1's rule and 2 wait for Steel: the Supabase
-- connector held them for an approval that never reached him (three 3-minute timeouts at about 2 am), so they go to him to
-- paste into the SQL editor (the same statements, safe to run twice).
-- 1. ai_routes.system_add: a standing addition to a route's system prompt, added by the llm router (v1.6).
alter table public.ai_routes add column if not exists system_add text;
comment on column public.ai_routes.system_add is 'Text the llm router (v1.6) adds to the end of the system prompt of every call on this route. wave226: the confidentiality rule on the routes whose words the team reads. Admins change it in SQL (logged in change_log, entity ai_route).';

update public.ai_routes set system_add = $sa$CONFIDENTIALITY (Welfare Avenue, a standing rule for everything you write here): what you write can be read across the whole team, now or later. Keep these out of every title, summary, progress note, mood read, update, description, decision, profile and message: leadership changes (anyone's executive director, co-executive director, chair or president role, a founder or co-executive director stepping back or leaving, succession, who replaces whom), what was said in board meetings, and anyone's personal or HR situation (someone leaving, quitting or being let go and why, performance, discipline, pay, health, family or personal reasons). The work that comes out of those conversations still gets written down, as the work itself in plain, neutral words, without the person's situation or the reason: for example "Prepare role handover notes for Fundraising", never "Coordinate Rami's transition after he steps down" or "Plan for Steel's departure". Never say that something was left out. These rules still hold: board_sensitive and confidential flags are set exactly as before.$sa$,
  updated_at = now(), updated_by = 'wave226'
where task in ('transcript_extract', 'leadership', 'transcript_archive', 'transcript_preview', 'digest', 'profile', 'shoutout', 'draft', 'reel', 'checkin', 'decision', 'goals', 'brain_suggest', 'reason', 'content_ideas');

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'ai_route', task, 'system_add', null, 'wave226: the confidentiality rule added to this route', 'wave226 (assistant, Steel''s request)' from public.ai_routes where system_add is not null;

-- 2. The Hub's words that named someone's departure or the reason for it, said as the work instead (Steel's choice:
--    high level, surface level). The meeting records themselves are not changed.
update public.dept_meta set read = 'Stable but stretched: the team is treating this period of change as a learning opportunity, not a crisis, while pushing hard on Hub automation to reduce manual workload.' where department = 'hr' and read ~* 'transition period';
update public.dept_meta set progress = replace(replace(progress,
    'Rami Al-Silq departure confirmed, Lyiah Lopes stepped down from Toronto team, Tate proposed', 'Tate proposed'),
    'A new urgent push opened to hire an HR consultant after multiple R5VN departures, with', 'A new urgent push opened to hire an HR consultant, with')
  where department = 'hr';
update public.dept_updates set text = 'Steel and Valex coordinating a Fundraising role handover; Toronto team changes in progress. Tate proposed three Toronto university students (Simu from OCAD, Sonya from TMU, Ephrata from UFT) as Student Engagement Coordinators, Suhaib to discuss next steps. Steel requested same-day answer to candidate Alyx on Aug 14, delivered by Amanda, Valex, and Tuna. Leadership meeting agenda includes Valex and Natasha presenting progress on revised S.M.A.R.T. goals for HR.' where id = 181;
update public.dept_updates set text = 'Fundraising role handover underway, coordinated by Steel and Valex. TYFPC sent grant writing and project request to Toronto, to be discussed at Aug 14 meeting. Maytree foundation grant added to pipeline but not yet applied. Amanda and Rami presented fundraising event schedule for FY 27 at Aug 11 leadership meeting.' where id = 182;
update public.dept_tasks set title = 'One-on-one check-in with a Fundraising lead' where id = 520;
update public.dept_tasks set title = 'Coordinate the Fundraising role handover' where id = 561;
update public.dept_tasks set title = 'Work through the Fundraising role handover' where id = 563;
update public.dept_tasks set title = 'Ops Toronto continuity plan', reason_note = 'Status note: Melvina/Mandeep' where id = 15;
update public.task_comments set body = 'Valex will check in with the team member this week.', quote = 'Valex will check in this week.' where id = 93;
update public.task_comments set body = 'Steel and Valex are coordinating the role handover.', quote = 'Steel and Valex coordinating the handover.' where id in (137, 141, 142);
update public.transcripts set ai_summary = replace(ai_summary,
    'Steel reassured team support through transition (potentially until 2027) and urged not to stress about recruitment while treating recent departures as a learning opportunity.',
    'Steel reassured the team of his support and urged them not to stress about recruitment, treating recent changes as a learning opportunity.')
  where id = 255;
update public.change_log set new_value = 'Stable but stretched: the team is treating this period of change as a learning opportunity, not a crisis, while pushing hard on Hub automation to reduce manual workload.' where id = 5225;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values
  ('confidentiality', 'wave226', 'reworded', null, 'Reworded as the work itself, for confidentiality: dept_meta hr (read, progress), dept_updates 181 and 182, dept_tasks 15, 520, 561 and 563, task_comments 93, 137, 141 and 142, the summary of transcript 255', 'wave226 (assistant, Steel''s request)');
