drop view public.hr_people_tenure_v;
create or replace view public.hr_people_tenure_v with (security_invoker = true) as
with acc as (
  select a.person_key,
         max(a.team_member_id) as team_member_id,
         (array_agg(a.full_name order by a.claimed_on nulls last, a.created_on))[1] as slack_name,
         (array_agg(a.title order by (a.title is null), a.days_active desc))[1] as slack_title,
         (array_agg(a.email order by a.days_active desc, a.claimed_on nulls last))[1] as slack_email,
         min(a.claimed_on) as joined_slack,
         min(a.created_on) as invited_on,
         count(*) as accounts,
         count(*) filter (where a.deactivated_on is null and a.claimed_on is not null) as open_accounts,
         bool_and(a.claimed_on is null) as never_joined,
         max(a.deactivated_on) as deactivated_on,
         sum(a.days_active)::int as days_active,
         sum(a.messages)::int as messages,
         max(a.period_from) as period_from,
         max(a.period_to) as period_to,
         bool_or(a.link_by = 'name') as linked_by_name,
         array_agg(a.slack_id order by a.claimed_on nulls last) as slack_ids
  from public.hr_slack_accounts a
  where a.kind = 'team'
  group by a.person_key
), people as (
  select coalesce('tm:' || m.id, acc.person_key) as person_key,
         m.id as team_member_id,
         coalesce(m.name, acc.slack_name) as name,
         acc.slack_name,
         m.department,
         coalesce(nullif(m.role, ''), acc.slack_title) as title,
         coalesce(m.email, acc.slack_email) as email,
         m.id is not null as on_roster,
         coalesce(m.active, false) as roster_active,
         m.start_date as roster_start, m.start_source,
         acc.joined_slack, acc.invited_on,
         coalesce(acc.accounts, 0)::int as accounts, coalesce(acc.open_accounts, 0)::int as open_accounts,
         coalesce(acc.never_joined, false) as never_joined,
         acc.deactivated_on, coalesce(acc.days_active, 0) as days_active, coalesce(acc.messages, 0) as messages,
         acc.period_from, acc.period_to, coalesce(acc.linked_by_name, false) as linked_by_name, acc.slack_ids
  from acc full join public.team_members m on m.id = acc.team_member_id
  where m.id is null or m.name !~* '\mtest\M'
), st as (
  select p.*,
    least(p.roster_start, p.joined_slack) as started_on,
    case
      when p.on_roster and p.roster_active then 'current'
      when not p.on_roster and p.never_joined then 'never_joined'
      when p.on_roster and not p.roster_active and p.joined_slack is null and p.accounts > 0 then 'never_joined'
      when not p.on_roster and p.open_accounts > 0 and p.days_active > 0 then 'current'
      when p.open_accounts > 0 and p.days_active = 0 then 'quiet'
      else 'left'
    end as status
  from people p
)
select st.*,
  case
    when st.status not in ('left', 'quiet') or st.accounts = 0 then null
    when st.days_active = 0 and st.period_from is not null then least(coalesce(st.deactivated_on, st.period_from), st.period_from)
    when st.open_accounts > 0 then null
    else st.deactivated_on
  end as left_by
from st;
comment on view public.hr_people_tenure_v is 'wave181: one row per person who has been part of Welfare Avenue (the roster and every team Slack account, two accounts of one person as one row), with started_on (the earliest of the roster''s start date and the day they joined Slack), status (current: on the roster and active, or off the roster with a Slack account used in the export''s window; quiet: a Slack account still open but not used once in the window; left; never_joined: invited, never accepted) and left_by (the latest day they can have left; null while current or when unknown). security_invoker: the Slack side needs wa181_can_see, the roster side follows team_members. The HR centre''s Analytics tab reads it.';
grant select on public.hr_people_tenure_v to authenticated;
revoke all on public.hr_people_tenure_v from anon;
