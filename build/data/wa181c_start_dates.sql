-- wave181c (30/09/26): start dates from Slack. Each roster person linked to a team Slack account gets the day they joined
-- Slack when it is earlier than the date the roster holds (or the roster has none). Dates HR set by hand are never touched.
with s as (
  select team_member_id id, min(claimed_on) j from public.hr_slack_accounts
  where kind = 'team' and team_member_id is not null and claimed_on is not null group by 1
), ch as (
  select m.id, m.start_date old_date, s.j from public.team_members m join s on s.id = m.id
  where coalesce(m.start_source, 'google') <> 'manual' and (m.start_date is null or s.j < m.start_date)
), up as (
  update public.team_members m set start_date = ch.j, start_source = 'slack' from ch where m.id = ch.id
  returning m.id, ch.old_date, ch.j
)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'team_member', up.id::text, 'start_date', up.old_date::text, up.j::text || ' (joined Slack)', 'wave181 (Slack member export)' from up;
