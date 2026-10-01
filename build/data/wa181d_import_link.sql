-- wave181d (30/09/26): HR keeps the Slack picture current from the Analytics tab: a new export is imported in the page
-- (wa181_import), and an account is linked to its roster person or marked as not a team member (wa181_link).
alter table public.hr_slack_accounts drop constraint hr_slack_accounts_link_by_check;
alter table public.hr_slack_accounts add constraint hr_slack_accounts_link_by_check check (link_by in ('email', 'name', 'hr'));
comment on column public.hr_slack_accounts.link_by is 'How the account was linked to the roster: email (the same address, or an obvious second address), name (first name only, worth a confirm) or hr (linked or confirmed by HR in the Analytics tab).';
create or replace function public.wa181_import(rows jsonb, p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare n_new int := 0; n_upd int := 0; n_link int := 0; n_start int := 0; r jsonb; tm bigint; ex boolean; who text;
begin
  if not public.wa181_can_see() then raise exception 'Only HR and admins can import the Slack export'; end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then raise exception 'No rows in the file'; end if;
  if jsonb_array_length(rows) > 2000 then raise exception 'Too many rows (2,000 at most)'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'The export''s dates are not right'; end if;
  who := coalesce(public.wa_email(), 'hr');
  for r in select * from jsonb_array_elements(rows) loop
    if coalesce(r->>'slack_id', '') !~ '^[UW][A-Z0-9]{6,}$' or coalesce(r->>'full_name', '') = '' then continue; end if;
    select true into ex from public.hr_slack_accounts where slack_id = r->>'slack_id';
    if coalesce(ex, false) then
      update public.hr_slack_accounts set full_name = left(r->>'full_name', 200), display_name = left(r->>'display_name', 200),
        email = lower(left(r->>'email', 200)), title = nullif(left(r->>'title', 200), ''), account_type = left(coalesce(r->>'account_type', 'Member'), 60),
        created_on = (r->>'created_on')::date, claimed_on = (r->>'claimed_on')::date, deactivated_on = (r->>'deactivated_on')::date,
        days_active = coalesce((r->>'days_active')::int, 0), messages = coalesce((r->>'messages')::int, 0),
        channel_messages = coalesce((r->>'channel_messages')::int, 0), reactions = coalesce((r->>'reactions')::int, 0),
        period_from = p_from, period_to = p_to, imported_at = now()
      where slack_id = r->>'slack_id';
      n_upd := n_upd + 1;
    else
      select m.id into tm from public.team_members m where lower(m.email) = lower(r->>'email') and r->>'email' <> '' limit 1;
      insert into public.hr_slack_accounts (slack_id, full_name, display_name, email, title, account_type, created_on, claimed_on, deactivated_on,
        days_active, messages, channel_messages, reactions, period_from, period_to, team_member_id, person_key, kind, link_by)
      values (r->>'slack_id', left(r->>'full_name', 200), left(r->>'display_name', 200), lower(left(r->>'email', 200)), nullif(left(r->>'title', 200), ''),
        left(coalesce(r->>'account_type', 'Member'), 60), (r->>'created_on')::date, (r->>'claimed_on')::date, (r->>'deactivated_on')::date,
        coalesce((r->>'days_active')::int, 0), coalesce((r->>'messages')::int, 0), coalesce((r->>'channel_messages')::int, 0), coalesce((r->>'reactions')::int, 0),
        p_from, p_to, tm, case when tm is null then 'slack:' || (r->>'slack_id') else 'tm:' || tm end,
        case when r->>'account_type' ilike '%guest%' then 'external' else 'team' end, case when tm is null then null else 'email' end);
      n_new := n_new + 1; if tm is not null then n_link := n_link + 1; end if;
    end if;
    ex := null; tm := null;
  end loop;
  with s as (select team_member_id id, min(claimed_on) j from public.hr_slack_accounts where kind = 'team' and team_member_id is not null and claimed_on is not null group by 1),
  ch as (select m.id, m.start_date old_date, s.j from public.team_members m join s on s.id = m.id
         where coalesce(m.start_source, 'google') <> 'manual' and (m.start_date is null or s.j < m.start_date)),
  up as (update public.team_members m set start_date = ch.j, start_source = 'slack' from ch where m.id = ch.id returning m.id, ch.old_date, ch.j),
  lg as (insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
         select 'team_member', up.id::text, 'start_date', up.old_date::text, up.j::text || ' (joined Slack)', who from up returning 1)
  select count(*) into n_start from lg;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('hr_slack_accounts', 'import', 'slack_export', null, n_new || ' new, ' || n_upd || ' updated, ' || n_start || ' start dates; ' || p_from || ' to ' || p_to, who);
  return jsonb_build_object('new', n_new, 'updated', n_upd, 'linked', n_link, 'start_dates', n_start);
end $$;
comment on function public.wa181_import(jsonb, date, date) is 'wave181d: imports Slack''s Member Analytics export (rows parsed by the HR centre''s Analytics tab) for HR and admins (wa181_can_see): existing accounts get their new counts and dates (their roster link and kind are kept), new accounts are linked to the roster by email, then earlier Slack join days become start dates (never over a manual one). Logs each start date and the import in change_log.';
revoke all on function public.wa181_import(jsonb, date, date) from public, anon;
grant execute on function public.wa181_import(jsonb, date, date) to authenticated;

create or replace function public.wa181_link(p_slack_id text, p_member bigint, p_kind text) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare a public.hr_slack_accounts; nm text; who text;
begin
  if not public.wa181_can_see() then raise exception 'Only HR and admins can change this'; end if;
  if p_kind not in ('team', 'external') then raise exception 'Unknown kind'; end if;
  select * into a from public.hr_slack_accounts where slack_id = p_slack_id;
  if a.slack_id is null then raise exception 'No such Slack account'; end if;
  if p_member is not null and not exists (select 1 from public.team_members where id = p_member) then raise exception 'No such person on the roster'; end if;
  who := coalesce(public.wa_email(), 'hr');
  update public.hr_slack_accounts set team_member_id = p_member, kind = p_kind,
    link_by = case when p_member is null then null else 'hr' end,
    person_key = case when p_member is null then 'slack:' || slack_id else 'tm:' || p_member end
  where slack_id = p_slack_id;
  select name into nm from public.team_members where id = p_member;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('hr_slack_accounts', p_slack_id, 'link', coalesce(a.team_member_id::text, '') || ' ' || a.kind, coalesce(nm, 'not on the roster') || ' ' || p_kind, who);
  return jsonb_build_object('ok', true);
end $$;
comment on function public.wa181_link(text, bigint, text) is 'wave181d: HR or an admin (wa181_can_see) links a Slack account to its roster person (or unlinks it with null) and says whether it counts as a team member (team) or not (external: a consultant, a guest, an organisation''s account). Saving sets link_by to hr (HR confirmed it), which also clears a link made by first name from Worth a look. Logged in change_log. Start dates are not changed here.';
revoke all on function public.wa181_link(text, bigint, text) from public, anon;
grant execute on function public.wa181_link(text, bigint, text) to authenticated;
