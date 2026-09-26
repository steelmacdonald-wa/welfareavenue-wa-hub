-- wave146: the monthly security check. security-check reads the Workspace directory, the Drive and the Google audit logs once
-- a month (and when an admin asks) and keeps what it found here. Admins only.

create table if not exists public.security_checks (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  period_start timestamptz,
  period_end timestamptz,
  ran_by text,
  summary jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  ok boolean not null default true,
  note text
);
create index if not exists security_checks_ran on public.security_checks (ran_at desc);

alter table public.security_checks enable row level security;
drop policy if exists security_checks_read on public.security_checks;
create policy security_checks_read on public.security_checks for select to authenticated using (public.is_hub_admin());
revoke all on public.security_checks from anon;
grant select on public.security_checks to authenticated;

comment on table public.security_checks is 'The monthly security check (wave146, security-check): one row per run. summary holds the counts compared month to month (active accounts, without 2-step verification, admins and admins without it, unused 60 days, files anyone with the link can open and the sensitive-looking ones, sharing outside Welfare Avenue in the period, sign-in failures and warnings, apps authorised, admin changes). findings is the list shown in Admin, Security: key, level (high, medium, low, info, ok), title, detail, count, items and the fix. Admins only.';
