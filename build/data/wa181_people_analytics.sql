-- wave181 (30/09/26): the HR centre's Analytics tab. Steel: "Here's a slack analytics sheet. To help you add start dates,
-- add an analytics tab to the hr center, show trends, and know who's been a part of the org and for how long ish
-- (we may have deactivated their accounts late)".

create or replace function public.wa181_can_see() returns boolean
language sql stable security definer set search_path to ''
as $$
  select public.wa_is_hr() or public.wa180_is_hr()
      or exists (select 1 from public.hub_roles r where r.email in (public.wa_email(), public.mybox_me()) and r.role = 'admin')
$$;
comment on function public.wa181_can_see() is 'wave181: the signed-in person may read the HR centre''s Analytics (who has been part of Welfare Avenue and for how long): the HR access list (wa_is_hr), the HR access profile (wa180_is_hr) or an admin. Leaders do not.';
revoke all on function public.wa181_can_see() from public, anon;
grant execute on function public.wa181_can_see() to authenticated;

create table public.hr_slack_accounts (
  slack_id text primary key,
  full_name text not null,
  display_name text,
  email text,
  title text,
  account_type text not null,
  created_on date,
  claimed_on date,
  deactivated_on date,
  days_active int not null default 0,
  messages int not null default 0,
  channel_messages int not null default 0,
  reactions int not null default 0,
  period_from date not null,
  period_to date not null,
  team_member_id bigint references public.team_members(id) on delete set null,
  person_key text not null,
  kind text not null default 'team' check (kind in ('team', 'external')),
  link_by text check (link_by in ('email', 'name')),
  imported_at timestamptz not null default now()
);
create index hr_slack_accounts_member on public.hr_slack_accounts(team_member_id);
create index hr_slack_accounts_person on public.hr_slack_accounts(person_key);
comment on table public.hr_slack_accounts is 'wave181: one row per account in the Welfare Avenue Slack, from Slack''s Member Analytics export (Admin, Analytics, Members, export CSV), imported by build/data/wa181_slack_import.py. The account dates go back to 2021; the activity counts cover period_from to period_to only. Read by HR and admins (wa181_can_see); written by imports only (service role, migrations). Use hr_people_tenure_v for one row per person.';
comment on column public.hr_slack_accounts.created_on is 'Day the account was created (for an invited account, the day of the invitation).';
comment on column public.hr_slack_accounts.claimed_on is 'Day the person accepted the invitation and joined Slack; null for an invitation never accepted.';
comment on column public.hr_slack_accounts.deactivated_on is 'Day an admin deactivated the account. Often later than the day the person left: accounts were switched off in batches (21/10/2025 took 22 at once).';
comment on column public.hr_slack_accounts.days_active is 'Days the person was active on Slack between period_from and period_to (the export''s window), not over the account''s life.';
comment on column public.hr_slack_accounts.team_member_id is 'The roster person (team_members) this account belongs to; null for people not on the roster today. Two accounts of one person point at the same row.';
comment on column public.hr_slack_accounts.person_key is 'Groups the accounts of one person: tm:<team_members.id> when linked, else slack:<the main account''s id>.';
comment on column public.hr_slack_accounts.kind is 'team (a volunteer or staff member at some point) or external (a consultant, an organisation''s account, a guest): external accounts are left out of the people counts.';
comment on column public.hr_slack_accounts.link_by is 'How the account was linked to the roster: email (the same address, or an obvious second address) or name (first name only, worth a confirm).';
alter table public.hr_slack_accounts enable row level security;
create policy hr_slack_accounts_read on public.hr_slack_accounts for select to authenticated using (public.wa181_can_see());
revoke all on public.hr_slack_accounts from anon;
grant select on public.hr_slack_accounts to authenticated;

create or replace function public.wa181_keep_start() returns trigger
language plpgsql set search_path to ''
as $$
begin
  if new.start_source = 'google' and old.start_source = 'slack' and old.start_date is not null
     and (new.start_date is null or new.start_date >= old.start_date) then
    new.start_date := old.start_date; new.start_source := old.start_source;
  end if;
  return new;
end $$;
comment on function public.wa181_keep_start() is 'wave181: trigger on team_members: a Workspace date (start_source google, written by directory-sync) never replaces an earlier Slack date (start_source slack). HR''s own date (manual) always wins.';
create trigger wa181_keep_start before update of start_date, start_source on public.team_members for each row execute function public.wa181_keep_start();
comment on column public.team_members.start_date is 'When the person started with Welfare Avenue: the earliest of the Workspace account''s creation (google) and the day they joined Slack (slack, wave181), unless HR sets it by hand (manual). Workspace dates of 17/01/2024 are the day the Workspace was set up, not a start.';
comment on column public.team_members.start_source is 'Where start_date came from: google (Workspace account creation), slack (the day they joined Slack, from the Member Analytics export, wave181) or manual (set by HR).';

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
