-- 13/11/26 - wave314: managing Meta ads from the Content Studio (marketing leads only).
-- Steel: "All of the above but only marketing leads": boost a post, build a paused campaign, pause / resume / budget.

-- who may manage ads: the named approvers (Ian, KK), and leaders or admins who are in the marketing team
create or replace function public.wa314_ads_lead()
returns boolean language sql stable security definer set search_path to '' as $f$
  select public.is_wa_staff() and (
    public.wa_email() = any (public.wa241_approvers())
    or exists (
      select 1 from public.hub_roles r
      where r.email = public.wa_email() and r.role in ('leader', 'admin')
        and (r.profile = 'marketing'
             or exists (select 1 from public.team_members t where lower(t.email) = r.email and t.active and t.department = 'marketing'))));
$f$;
comment on function public.wa314_ads_lead() is 'wave314 (13/11/26): may manage Meta ads in the Content Studio (boost, paused campaigns, pause/resume, budgets). Marketing leads only: the approvers, and leaders or admins in the marketing team.';
revoke all on function public.wa314_ads_lead() from public, anon;
grant execute on function public.wa314_ads_lead() to authenticated, service_role;

-- the same people as a list, for the Slack notices (service role only)
create or replace function public.wa314_ads_leads()
returns text[] language sql stable security definer set search_path to '' as $f$
  select coalesce(array_agg(distinct e), '{}') from (
    select unnest(public.wa241_approvers()) as e
    union
    select r.email from public.hub_roles r
    where r.role in ('leader', 'admin')
      and (r.profile = 'marketing'
           or exists (select 1 from public.team_members t where lower(t.email) = r.email and t.active and t.department = 'marketing'))
  ) x where e like '%@welfareavenue.com';
$f$;
revoke all on function public.wa314_ads_leads() from public, anon, authenticated;
grant execute on function public.wa314_ads_leads() to service_role;

-- every ads action, kept
create table if not exists public.social_ad_actions (
  id bigserial primary key,
  at timestamptz not null default now(),
  by_email text not null,
  by_name text,
  action text not null,
  account_id text,
  object_id text,
  detail jsonb not null default '{}'::jsonb,
  ok boolean not null default true,
  error text
);
comment on table public.social_ad_actions is 'wave314 (13/11/26): every ads action taken from the Content Studio (boost, pause, resume, budget, limits), written by social-ads-manage. Marketing leads and admins read; nobody writes but the function.';
create index if not exists social_ad_actions_at on public.social_ad_actions (at desc);
alter table public.social_ad_actions enable row level security;
revoke all on public.social_ad_actions from anon, authenticated;
grant select on public.social_ad_actions to authenticated;
grant all on public.social_ad_actions to service_role;
drop policy if exists social_ad_actions_read on public.social_ad_actions;
create policy social_ad_actions_read on public.social_ad_actions for select to authenticated using (public.wa314_ads_lead() or public.is_hub_admin());

-- the spending limits (dollars): a day's budget, one boost's or campaign's total, how many days
insert into public.hub_settings (key, value, updated_at, updated_by)
values ('studio_ads_limits', '{"max_daily": 50, "max_total": 300, "max_days": 30, "notify": true}'::jsonb, now(), 'wave314')
on conflict (key) do nothing;
