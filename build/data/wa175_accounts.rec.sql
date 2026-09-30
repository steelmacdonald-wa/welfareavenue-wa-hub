-- wa175_accounts (30/09/26): volunteers sign in with Google on their own page (hub.welfareavenue.com/me) to see how often
-- they have volunteered, their upcoming servings, sign up for open spots and download a letter of their hours.
-- Steel (30/09/26): "volunteers should be able to sign in with their Google accounts because we'd want them to be able to
-- remember their accounts and the amount of times they've volunteered". His answers: their own page (not the staff Hub);
-- a Google account links by its email when it matches the volunteer's record, otherwise from their personal text link;
-- the account shows servings and hours, upcoming servings, signing up for servings and an hours letter; the text links keep
-- working without signing in.
--
-- Safety: every policy and function in this database treats "authenticated" as someone on the team or the board. A
-- volunteer's Google account must never be that. wa175_access_token_hook (Supabase Auth, Customize Access Token hook,
-- switched on by Steel in the dashboard) gives anyone who is not staff or board the role anon in their token: they can
-- only do what the public confirm page can, plus the volunteer_me functions below, which read their own verified sign-in.
-- The /me page refuses to work (and signs out) while the hook is off.

-- 1. the link between a Google account and a volunteer
create table if not exists public.volunteer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_id bigint not null references public.volunteer_people(id) on delete cascade,
  email text,
  linked_via text not null check (linked_via in ('email', 'link', 'staff')),
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists volunteer_accounts_person on public.volunteer_accounts (person_id);
comment on table public.volunteer_accounts is 'wave175: a volunteer''s Google account (auth.users) linked to their volunteer record: by its email matching volunteer_people.emails (Google-verified), from their personal text link (/c/<token>, which proves who they are), or by staff. One person can have more than one account. Staff read and remove links; volunteers never read this table.';
alter table public.volunteer_accounts enable row level security;
drop policy if exists volunteer_accounts_staff_read on public.volunteer_accounts;
create policy volunteer_accounts_staff_read on public.volunteer_accounts for select to authenticated using ((select public.is_wa_staff()));
drop policy if exists volunteer_accounts_staff_delete on public.volunteer_accounts;
create policy volunteer_accounts_staff_delete on public.volunteer_accounts for delete to authenticated using ((select public.is_wa_staff()));

-- 2. the letters of hours volunteers download, so staff can check a reference
create table if not exists public.volunteer_hour_letters (
  ref text primary key,
  person_id bigint not null references public.volunteer_people(id) on delete cascade,
  full_name text not null,
  servings int not null,
  hours numeric not null,
  first_date date,
  last_date date,
  issued_at timestamptz not null default now()
);
comment on table public.volunteer_hour_letters is 'wave175: every letter of volunteer hours issued from the volunteer page (reference WA-VH-xxxxxx printed on it), so staff can confirm one when a school or employer asks. Staff read.';
alter table public.volunteer_hour_letters enable row level security;
drop policy if exists volunteer_hour_letters_staff_read on public.volunteer_hour_letters;
create policy volunteer_hour_letters_staff_read on public.volunteer_hour_letters for select to authenticated using ((select public.is_wa_staff()));

-- 3. who can sign up themselves, and how many each serving needs (the roster board's targets, wave119)
insert into public.app_config (key, value, updated_at) values
  ('vol_role_targets', '{"team_leader":2,"cook":4,"driver":2,"server":8,"dishwasher":2,"photographer":1,"community_talker":2,"community_debrief":1}', now()),
  ('vol_signup_roles', 'server,cook,dishwasher,photographer,community_talker', now()),
  ('vol_signup_days', '90', now()),
  ('vol_default_hours', '2', now())
on conflict (key) do nothing;

-- 4. the access token hook: staff and board keep "authenticated"; everyone else is anon (a volunteer)
create or replace function public.wa175_access_token_hook(event jsonb)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_claims jsonb; v_email text; v_keep boolean := false;
begin
  v_claims := coalesce(event->'claims', '{}'::jsonb);
  v_email := lower(coalesce(v_claims->>'email', ''));
  begin
    v_keep := v_email <> '' and (
         v_email like '%@welfareavenue.com'
      or exists (select 1 from public.hub_roles r where r.email = v_email and r.role in ('admin', 'leader', 'member', 'viewer'))
      or exists (select 1 from public.board_viewers b where lower(b.email) = v_email)
      or exists (select 1 from public.board_circle c where lower(c.email) = v_email)
      or exists (select 1 from public.board_members m where m.status in ('active', 'adviser') and v_email = any (select lower(e) from unnest(m.emails) e)));
  exception when others then
    v_keep := v_email like '%@welfareavenue.com';
  end;
  if not v_keep then
    v_claims := jsonb_set(v_claims, '{role}', '"anon"') || jsonb_build_object('wa_volunteer', true);
    return jsonb_set(event, '{claims}', v_claims);
  end if;
  return event;
end $$;
comment on function public.wa175_access_token_hook(jsonb) is 'wave175: Supabase Auth Customize Access Token hook (switched on in the dashboard). Anyone signed in who is not on the team (a Welfare Avenue email, or hub_roles admin, leader, member or viewer) or the board (board_viewers, board_circle, active board_members) gets the role anon and wa_volunteer true in their token, so a volunteer''s Google account can never reach what "authenticated" reaches. If the check fails, only Welfare Avenue emails keep their role.';
revoke all on function public.wa175_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.wa175_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

-- 5. helpers
-- the signed-in user, only when their token is a verified Google sign-in
create or replace function public.wa175_me_uid()
 returns uuid language sql stable security definer set search_path to '' as $$
  select u.id from auth.users u where u.id = auth.uid() and u.deleted_at is null and u.banned_until is null;
$$;
create or replace function public.wa175_person()
 returns bigint language sql stable security definer set search_path to '' as $$
  select a.person_id from public.volunteer_accounts a where a.user_id = public.wa175_me_uid() order by a.linked_at limit 1;
$$;
create or replace function public.wa175_hook_on()
 returns boolean language sql stable set search_path to '' as $$
  select coalesce((auth.jwt()->>'wa_volunteer')::boolean, false) or public.is_wa_staff() or public.is_board_viewer();
$$;
revoke all on function public.wa175_me_uid() from public, anon, authenticated;
revoke all on function public.wa175_person() from public, anon, authenticated;

-- 6. the volunteer page's read: who they are, their history, upcoming servings, open spots
create or replace function public.volunteer_me()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_uid uuid; v_email text; v_google boolean; v_pid bigint; p record; v_n int; v_today date; v_hours numeric; v_def numeric;
        v_hist jsonb; v_up jsonb; v_open jsonb; v_roles jsonb; v_first date; v_last date; v_targets jsonb; v_signup text[]; v_days int;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('signed_in', false); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('signed_in', true, 'hook', false); end if;
  select lower(u.email), exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google' and lower(i.identity_data->>'email') = lower(u.email))
    into v_email, v_google from auth.users u where u.id = v_uid;
  v_pid := public.wa175_person();
  -- the first visit: link by the Google-verified email when exactly one volunteer has it
  if v_pid is null and v_google and v_email is not null then
    select count(*) into v_n from public.volunteer_people vp where v_email = any (select lower(trim(e)) from unnest(vp.emails) e);
    if v_n = 1 then
      select vp.id into v_pid from public.volunteer_people vp where v_email = any (select lower(trim(e)) from unnest(vp.emails) e);
      insert into public.volunteer_accounts (user_id, person_id, email, linked_via) values (v_uid, v_pid, v_email, 'email') on conflict (user_id) do nothing;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_people', v_pid::text, 'account', null, 'Google account linked by email', 'volunteer (account)');
    end if;
  end if;
  if v_pid is null then return jsonb_build_object('signed_in', true, 'hook', true, 'linked', false, 'email', v_email); end if;
  update public.volunteer_accounts set last_seen_at = now() where user_id = v_uid;
  select * into p from public.volunteer_people where id = v_pid;
  v_today := (now() at time zone 'America/Toronto')::date;
  v_def := coalesce(nullif((select value from public.app_config where key = 'vol_default_hours'), '')::numeric, 2);
  -- the servings they came to: past services where they were confirmed
  select count(*), coalesce(sum(coalesce(nullif(er.detail->>'hours', '')::numeric, v_def)), 0), min(e.event_date), max(e.event_date)
    into v_n, v_hours, v_first, v_last
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date < v_today and lower(coalesce(er.status, '')) = 'confirmed';
  select coalesce(jsonb_agg(jsonb_build_object('role', x.role, 'role_en', public.wa171_role_label(x.role, 'en'), 'role_fr', public.wa171_role_label(x.role, 'fr'), 'n', x.n) order by x.n desc), '[]'::jsonb) into v_roles
    from (select lower(er.role) as role, count(*) as n from public.event_roster er join public.volunteer_events e on e.id = er.event_id
           where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date < v_today and lower(coalesce(er.status, '')) = 'confirmed' group by 1) x;
  select coalesce(jsonb_agg(jsonb_build_object('date', x.event_date, 'role', x.role, 'role_en', public.wa171_role_label(x.role, 'en'), 'role_fr', public.wa171_role_label(x.role, 'fr'),
           'location', x.location, 'token', x.token, 'survey', x.survey) order by x.event_date desc), '[]'::jsonb) into v_hist
    from (select e.event_date, er.role, coalesce(nullif(e.location, ''), 'Montreal') as location,
                 case when e.event_date >= v_today - 14 then er.confirm_token end as token,
                 case when exists (select 1 from public.volunteer_survey_responses s where s.roster_id = er.id) then 'answered'
                      when e.event_date >= v_today - 14 then 'open' end as survey
            from public.event_roster er join public.volunteer_events e on e.id = er.event_id
           where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date < v_today and lower(coalesce(er.status, '')) = 'confirmed'
           order by e.event_date desc limit 60) x;
  select coalesce(jsonb_agg(jsonb_build_object('date', e.event_date, 'role', er.role, 'role_en', public.wa171_role_label(er.role, 'en'), 'role_fr', public.wa171_role_label(er.role, 'fr'),
           'location', coalesce(nullif(e.location, ''), 'Montreal'), 'format', e.format, 'token', er.confirm_token, 'times', public.wa174_times(er.id),
           'state', case when er.confirm_status = 'confirmed' or lower(coalesce(er.status, '')) = 'confirmed' then 'confirmed'
                         when er.confirm_status = 'declined' or lower(coalesce(er.status, '')) = 'unavailable' then 'declined' else 'waiting' end)
         order by e.event_date), '[]'::jsonb) into v_up
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date >= v_today and lower(coalesce(er.status, '')) <> 'cancelled';
  -- open spots: upcoming services within vol_signup_days, the roles volunteers can take themselves, under the role's target
  v_targets := coalesce(nullif((select value from public.app_config where key = 'vol_role_targets'), '')::jsonb, '{}'::jsonb);
  v_signup := string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'vol_signup_roles'), '')), ' ', ''), ',');
  v_days := coalesce(nullif((select value from public.app_config where key = 'vol_signup_days'), '')::int, 90);
  select coalesce(jsonb_agg(jsonb_build_object('event_id', x.id, 'date', x.event_date, 'location', x.location, 'format', x.format, 'start', x.start_time,
           'roles', x.roles) order by x.event_date), '[]'::jsonb) into v_open
    from (select e.id, e.event_date, coalesce(nullif(e.location, ''), 'Montreal') as location, e.format, public.wa174_hm(coalesce(e.start_time, '12:00'::time)) as start_time,
                 (select coalesce(jsonb_agg(jsonb_build_object('role', r, 'role_en', public.wa171_role_label(r, 'en'), 'role_fr', public.wa171_role_label(r, 'fr'),
                          'left', (v_targets->>r)::int - (select count(*) from public.event_roster o where o.event_id = e.id and lower(o.role) = r and lower(coalesce(o.status, '')) not in ('cancelled', 'unavailable')))
                        order by array_position(v_signup, r)), '[]'::jsonb)
                    from unnest(v_signup) r
                   where v_targets ? r and (v_targets->>r)::int > (select count(*) from public.event_roster o where o.event_id = e.id and lower(o.role) = r and lower(coalesce(o.status, '')) not in ('cancelled', 'unavailable'))) as roles
            from public.volunteer_events e
           where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date > v_today and e.event_date <= v_today + v_days
             and not exists (select 1 from public.event_roster o where o.event_id = e.id and o.person_id = v_pid and lower(coalesce(o.status, '')) <> 'cancelled')) x
   where jsonb_array_length(x.roles) > 0;
  return jsonb_build_object('signed_in', true, 'hook', true, 'linked', true, 'email', v_email,
    'first', split_part(trim(coalesce(p.full_name, '')), ' ', 1), 'name', p.full_name, 'lang', public.wa171_lang(v_pid),
    'servings', v_n, 'hours', v_hours, 'first_date', v_first, 'last_date', v_last, 'roles', v_roles,
    'history', v_hist, 'upcoming', v_up, 'open', coalesce(v_open, '[]'::jsonb));
end $$;
comment on function public.volunteer_me() is 'wave175: the volunteer page (hub.welfareavenue.com/me) for the signed-in volunteer: links their Google account by its verified email on the first visit when exactly one volunteer record has it; then their name, servings (past services where they were confirmed) and hours (event_roster.detail hours, or app_config vol_default_hours), roles, history (the last 14 days with their link for the survey), upcoming servings with their links, and open spots they can take (app_config vol_signup_roles under vol_role_targets, within vol_signup_days). Refuses while the access token hook is off. Only their own record.';
revoke all on function public.volunteer_me() from public;
grant execute on function public.volunteer_me() to anon, authenticated;

-- 7. link from the personal text link
create or replace function public.volunteer_me_link(p_token text)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_uid uuid; v_pid bigint; v_cur bigint; v_email text;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'hook'); end if;
  if p_token is null or length(p_token) < 12 then return jsonb_build_object('ok', false, 'reason', 'token'); end if;
  select person_id into v_pid from public.event_roster where confirm_token = p_token;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'token'); end if;
  v_cur := public.wa175_person();
  if v_cur is not null and v_cur <> v_pid then return jsonb_build_object('ok', false, 'reason', 'other'); end if;
  if v_cur = v_pid then return jsonb_build_object('ok', true, 'already', true); end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  insert into public.volunteer_accounts (user_id, person_id, email, linked_via) values (v_uid, v_pid, v_email, 'link') on conflict (user_id) do nothing;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_people', v_pid::text, 'account', null, 'Google account linked from their text link', 'volunteer (account)');
  return jsonb_build_object('ok', true);
end $$;
comment on function public.volunteer_me_link(text) is 'wave175: links the signed-in Google account to the volunteer of a personal link (/c/<token>): the link proves who they are. Refuses an account already linked to someone else. Logged.';
revoke all on function public.volunteer_me_link(text) from public;
grant execute on function public.volunteer_me_link(text) to anon, authenticated;

-- 8. sign up for an open spot: a roster row like the team adds, then the usual texts (7 days before) apply
create or replace function public.volunteer_me_signup(p_event bigint, p_role text)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pid bigint; e record; v_role text; v_target int; v_have int; v_today date; v_days int; v_name text; v_tok text; v_id bigint; p record;
begin
  v_pid := public.wa175_person();
  if v_pid is null or not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  v_role := lower(trim(coalesce(p_role, '')));
  if not (v_role = any (string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'vol_signup_roles'), '')), ' ', ''), ','))) then
    return jsonb_build_object('ok', false, 'reason', 'role');
  end if;
  v_today := (now() at time zone 'America/Toronto')::date;
  v_days := coalesce(nullif((select value from public.app_config where key = 'vol_signup_days'), '')::int, 90);
  select * into e from public.volunteer_events where id = p_event for update;
  if not found or e.kind <> 'service' or e.status in ('cancelled', 'completed') or e.event_date <= v_today or e.event_date > v_today + v_days then
    return jsonb_build_object('ok', false, 'reason', 'event');
  end if;
  if exists (select 1 from public.event_roster o where o.event_id = e.id and o.person_id = v_pid and lower(coalesce(o.status, '')) <> 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  v_target := ((select value from public.app_config where key = 'vol_role_targets')::jsonb->>v_role)::int;
  select count(*) into v_have from public.event_roster o where o.event_id = e.id and lower(o.role) = v_role and lower(coalesce(o.status, '')) not in ('cancelled', 'unavailable');
  if v_target is null or v_have >= v_target then return jsonb_build_object('ok', false, 'reason', 'full'); end if;
  select * into p from public.volunteer_people where id = v_pid;
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail, sort)
  values (e.id, v_pid, p.full_name, v_role, 'TBD',
          jsonb_strip_nulls(jsonb_build_object('source', 'self sign-up (volunteer page)', 'phone', (p.phones)[1], 'email', (p.emails)[1])),
          coalesce((select max(sort) from public.event_roster where event_id = e.id), 0) + 1)
  returning id, confirm_token into v_id, v_tok;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', v_id::text, 'self sign-up', null, v_role || ' on ' || e.event_date, 'volunteer (account)');
  return jsonb_build_object('ok', true, 'token', v_tok, 'roster_id', v_id);
end $$;
comment on function public.volunteer_me_signup(bigint, text) is 'wave175: the signed-in volunteer takes an open spot: an upcoming service within vol_signup_days, a role in vol_signup_roles, while the role is under its vol_role_targets count; not twice on the same serving. Adds a roster row (status TBD, detail.source self sign-up) so the usual texts apply (a sign-up notice, the confirmation 7 days before). Logged.';
revoke all on function public.volunteer_me_signup(bigint, text) from public;
grant execute on function public.volunteer_me_signup(bigint, text) to anon, authenticated;

-- 9. the letter of hours: the numbers and a reference staff can check
create or replace function public.volunteer_me_letter()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pid bigint; m jsonb; v_ref text; p record;
begin
  v_pid := public.wa175_person();
  if v_pid is null or not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  m := public.volunteer_me();
  if coalesce((m->>'servings')::int, 0) = 0 then return jsonb_build_object('ok', false, 'reason', 'none'); end if;
  select * into p from public.volunteer_people where id = v_pid;
  v_ref := 'WA-VH-' || upper(substr(md5(v_pid::text || clock_timestamp()::text || random()::text), 1, 6));
  insert into public.volunteer_hour_letters (ref, person_id, full_name, servings, hours, first_date, last_date)
  values (v_ref, v_pid, coalesce(p.full_name, ''), (m->>'servings')::int, (m->>'hours')::numeric, (m->>'first_date')::date, (m->>'last_date')::date);
  return jsonb_build_object('ok', true, 'ref', v_ref, 'name', p.full_name, 'servings', (m->>'servings')::int, 'hours', (m->>'hours')::numeric,
    'first_date', m->>'first_date', 'last_date', m->>'last_date', 'roles', m->'roles', 'issued', (now() at time zone 'America/Toronto')::date);
end $$;
comment on function public.volunteer_me_letter() is 'wave175: a letter of volunteer hours for the signed-in volunteer (servings, hours, first and last serving, roles), recorded in volunteer_hour_letters with a reference (WA-VH-xxxxxx) staff can check.';
revoke all on function public.volunteer_me_letter() from public;
grant execute on function public.volunteer_me_letter() to anon, authenticated;

-- 10. tighten what any signed-in account could read, in case the hook is ever off (team and board only)
drop policy if exists policies_read on public.wa_policies;
create policy policies_read on public.wa_policies for select to authenticated using ((select public.is_wa_staff()) or (select public.is_board_viewer()));
drop policy if exists hr_access_read on public.wa_hr_access;
create policy hr_access_read on public.wa_hr_access for select to authenticated using ((select public.is_wa_staff()));
drop policy if exists academy_assignments_read on public.academy_assignments;
create policy academy_assignments_read on public.academy_assignments for select to authenticated using (
  (select public.is_wa_staff()) and (public.wa169_can_assign() or audience = 'everyone'
   or (audience = 'team' and exists (select 1 from public.team_members tm where lower(tm.email) = public.wa_email() and tm.department = any (academy_assignments.teams)))
   or (audience = 'people' and public.wa_email() = any (people))));

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930160000', 'wa175_accounts', array[$m$create table if not exists public.volunteer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_id bigint not null references public.volunteer_people(id) on delete cascade,
  email text,
  linked_via text not null check (linked_via in ('email', 'link', 'staff')),
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz
)$m$,$m$create index if not exists volunteer_accounts_person on public.volunteer_accounts (person_id)$m$,$m$comment on table public.volunteer_accounts is 'wave175: a volunteer''s Google account (auth.users) linked to their volunteer record: by its email matching volunteer_people.emails (Google-verified), from their personal text link (/c/<token>, which proves who they are), or by staff. One person can have more than one account. Staff read and remove links; volunteers never read this table.'$m$,$m$alter table public.volunteer_accounts enable row level security$m$,$m$drop policy if exists volunteer_accounts_staff_read on public.volunteer_accounts$m$,$m$create policy volunteer_accounts_staff_read on public.volunteer_accounts for select to authenticated using ((select public.is_wa_staff()))$m$,$m$drop policy if exists volunteer_accounts_staff_delete on public.volunteer_accounts$m$,$m$create policy volunteer_accounts_staff_delete on public.volunteer_accounts for delete to authenticated using ((select public.is_wa_staff()))$m$,$m$create table if not exists public.volunteer_hour_letters (
  ref text primary key,
  person_id bigint not null references public.volunteer_people(id) on delete cascade,
  full_name text not null,
  servings int not null,
  hours numeric not null,
  first_date date,
  last_date date,
  issued_at timestamptz not null default now()
)$m$,$m$comment on table public.volunteer_hour_letters is 'wave175: every letter of volunteer hours issued from the volunteer page (reference WA-VH-xxxxxx printed on it), so staff can confirm one when a school or employer asks. Staff read.'$m$,$m$alter table public.volunteer_hour_letters enable row level security$m$,$m$drop policy if exists volunteer_hour_letters_staff_read on public.volunteer_hour_letters$m$,$m$create policy volunteer_hour_letters_staff_read on public.volunteer_hour_letters for select to authenticated using ((select public.is_wa_staff()))$m$,$m$insert into public.app_config (key, value, updated_at) values
  ('vol_role_targets', '{"team_leader":2,"cook":4,"driver":2,"server":8,"dishwasher":2,"photographer":1,"community_talker":2,"community_debrief":1}', now()),
  ('vol_signup_roles', 'server,cook,dishwasher,photographer,community_talker', now()),
  ('vol_signup_days', '90', now()),
  ('vol_default_hours', '2', now())
on conflict (key) do nothing$m$,$m$create or replace function public.wa175_access_token_hook(event jsonb)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_claims jsonb; v_email text; v_keep boolean := false;
begin
  v_claims := coalesce(event->'claims', '{}'::jsonb);
  v_email := lower(coalesce(v_claims->>'email', ''));
  begin
    v_keep := v_email <> '' and (
         v_email like '%@welfareavenue.com'
      or exists (select 1 from public.hub_roles r where r.email = v_email and r.role in ('admin', 'leader', 'member', 'viewer'))
      or exists (select 1 from public.board_viewers b where lower(b.email) = v_email)
      or exists (select 1 from public.board_circle c where lower(c.email) = v_email)
      or exists (select 1 from public.board_members m where m.status in ('active', 'adviser') and v_email = any (select lower(e) from unnest(m.emails) e)));
  exception when others then
    v_keep := v_email like '%@welfareavenue.com';
  end;
  if not v_keep then
    v_claims := jsonb_set(v_claims, '{role}', '"anon"') || jsonb_build_object('wa_volunteer', true);
    return jsonb_set(event, '{claims}', v_claims);
  end if;
  return event;
end $$$m$,$m$comment on function public.wa175_access_token_hook(jsonb) is 'wave175: Supabase Auth Customize Access Token hook (switched on in the dashboard). Anyone signed in who is not on the team (a Welfare Avenue email, or hub_roles admin, leader, member or viewer) or the board (board_viewers, board_circle, active board_members) gets the role anon and wa_volunteer true in their token, so a volunteer''s Google account can never reach what "authenticated" reaches. If the check fails, only Welfare Avenue emails keep their role.'$m$,$m$revoke all on function public.wa175_access_token_hook(jsonb) from public, anon, authenticated$m$,$m$grant execute on function public.wa175_access_token_hook(jsonb) to supabase_auth_admin$m$,$m$grant usage on schema public to supabase_auth_admin$m$,$m$create or replace function public.wa175_me_uid()
 returns uuid language sql stable security definer set search_path to '' as $$
  select u.id from auth.users u where u.id = auth.uid() and u.deleted_at is null and u.banned_until is null;
$$$m$,$m$create or replace function public.wa175_person()
 returns bigint language sql stable security definer set search_path to '' as $$
  select a.person_id from public.volunteer_accounts a where a.user_id = public.wa175_me_uid() order by a.linked_at limit 1;
$$$m$,$m$create or replace function public.wa175_hook_on()
 returns boolean language sql stable set search_path to '' as $$
  select coalesce((auth.jwt()->>'wa_volunteer')::boolean, false) or public.is_wa_staff() or public.is_board_viewer();
$$$m$,$m$revoke all on function public.wa175_me_uid() from public, anon, authenticated$m$,$m$revoke all on function public.wa175_person() from public, anon, authenticated$m$,$m$create or replace function public.volunteer_me()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_uid uuid; v_email text; v_google boolean; v_pid bigint; p record; v_n int; v_today date; v_hours numeric; v_def numeric;
        v_hist jsonb; v_up jsonb; v_open jsonb; v_roles jsonb; v_first date; v_last date; v_targets jsonb; v_signup text[]; v_days int;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('signed_in', false); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('signed_in', true, 'hook', false); end if;
  select lower(u.email), exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google' and lower(i.identity_data->>'email') = lower(u.email))
    into v_email, v_google from auth.users u where u.id = v_uid;
  v_pid := public.wa175_person();
  -- the first visit: link by the Google-verified email when exactly one volunteer has it
  if v_pid is null and v_google and v_email is not null then
    select count(*) into v_n from public.volunteer_people vp where v_email = any (select lower(trim(e)) from unnest(vp.emails) e);
    if v_n = 1 then
      select vp.id into v_pid from public.volunteer_people vp where v_email = any (select lower(trim(e)) from unnest(vp.emails) e);
      insert into public.volunteer_accounts (user_id, person_id, email, linked_via) values (v_uid, v_pid, v_email, 'email') on conflict (user_id) do nothing;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_people', v_pid::text, 'account', null, 'Google account linked by email', 'volunteer (account)');
    end if;
  end if;
  if v_pid is null then return jsonb_build_object('signed_in', true, 'hook', true, 'linked', false, 'email', v_email); end if;
  update public.volunteer_accounts set last_seen_at = now() where user_id = v_uid;
  select * into p from public.volunteer_people where id = v_pid;
  v_today := (now() at time zone 'America/Toronto')::date;
  v_def := coalesce(nullif((select value from public.app_config where key = 'vol_default_hours'), '')::numeric, 2);
  -- the servings they came to: past services where they were confirmed
  select count(*), coalesce(sum(coalesce(nullif(er.detail->>'hours', '')::numeric, v_def)), 0), min(e.event_date), max(e.event_date)
    into v_n, v_hours, v_first, v_last
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date < v_today and lower(coalesce(er.status, '')) = 'confirmed';
  select coalesce(jsonb_agg(jsonb_build_object('role', x.role, 'role_en', public.wa171_role_label(x.role, 'en'), 'role_fr', public.wa171_role_label(x.role, 'fr'), 'n', x.n) order by x.n desc), '[]'::jsonb) into v_roles
    from (select lower(er.role) as role, count(*) as n from public.event_roster er join public.volunteer_events e on e.id = er.event_id
           where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date < v_today and lower(coalesce(er.status, '')) = 'confirmed' group by 1) x;
  select coalesce(jsonb_agg(jsonb_build_object('date', x.event_date, 'role', x.role, 'role_en', public.wa171_role_label(x.role, 'en'), 'role_fr', public.wa171_role_label(x.role, 'fr'),
           'location', x.location, 'token', x.token, 'survey', x.survey) order by x.event_date desc), '[]'::jsonb) into v_hist
    from (select e.event_date, er.role, coalesce(nullif(e.location, ''), 'Montreal') as location,
                 case when e.event_date >= v_today - 14 then er.confirm_token end as token,
                 case when exists (select 1 from public.volunteer_survey_responses s where s.roster_id = er.id) then 'answered'
                      when e.event_date >= v_today - 14 then 'open' end as survey
            from public.event_roster er join public.volunteer_events e on e.id = er.event_id
           where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date < v_today and lower(coalesce(er.status, '')) = 'confirmed'
           order by e.event_date desc limit 60) x;
  select coalesce(jsonb_agg(jsonb_build_object('date', e.event_date, 'role', er.role, 'role_en', public.wa171_role_label(er.role, 'en'), 'role_fr', public.wa171_role_label(er.role, 'fr'),
           'location', coalesce(nullif(e.location, ''), 'Montreal'), 'format', e.format, 'token', er.confirm_token, 'times', public.wa174_times(er.id),
           'state', case when er.confirm_status = 'confirmed' or lower(coalesce(er.status, '')) = 'confirmed' then 'confirmed'
                         when er.confirm_status = 'declined' or lower(coalesce(er.status, '')) = 'unavailable' then 'declined' else 'waiting' end)
         order by e.event_date), '[]'::jsonb) into v_up
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.person_id = v_pid and e.kind = 'service' and e.status <> 'cancelled' and e.event_date >= v_today and lower(coalesce(er.status, '')) <> 'cancelled';
  -- open spots: upcoming services within vol_signup_days, the roles volunteers can take themselves, under the role's target
  v_targets := coalesce(nullif((select value from public.app_config where key = 'vol_role_targets'), '')::jsonb, '{}'::jsonb);
  v_signup := string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'vol_signup_roles'), '')), ' ', ''), ',');
  v_days := coalesce(nullif((select value from public.app_config where key = 'vol_signup_days'), '')::int, 90);
  select coalesce(jsonb_agg(jsonb_build_object('event_id', x.id, 'date', x.event_date, 'location', x.location, 'format', x.format, 'start', x.start_time,
           'roles', x.roles) order by x.event_date), '[]'::jsonb) into v_open
    from (select e.id, e.event_date, coalesce(nullif(e.location, ''), 'Montreal') as location, e.format, public.wa174_hm(coalesce(e.start_time, '12:00'::time)) as start_time,
                 (select coalesce(jsonb_agg(jsonb_build_object('role', r, 'role_en', public.wa171_role_label(r, 'en'), 'role_fr', public.wa171_role_label(r, 'fr'),
                          'left', (v_targets->>r)::int - (select count(*) from public.event_roster o where o.event_id = e.id and lower(o.role) = r and lower(coalesce(o.status, '')) not in ('cancelled', 'unavailable')))
                        order by array_position(v_signup, r)), '[]'::jsonb)
                    from unnest(v_signup) r
                   where v_targets ? r and (v_targets->>r)::int > (select count(*) from public.event_roster o where o.event_id = e.id and lower(o.role) = r and lower(coalesce(o.status, '')) not in ('cancelled', 'unavailable'))) as roles
            from public.volunteer_events e
           where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date > v_today and e.event_date <= v_today + v_days
             and not exists (select 1 from public.event_roster o where o.event_id = e.id and o.person_id = v_pid and lower(coalesce(o.status, '')) <> 'cancelled')) x
   where jsonb_array_length(x.roles) > 0;
  return jsonb_build_object('signed_in', true, 'hook', true, 'linked', true, 'email', v_email,
    'first', split_part(trim(coalesce(p.full_name, '')), ' ', 1), 'name', p.full_name, 'lang', public.wa171_lang(v_pid),
    'servings', v_n, 'hours', v_hours, 'first_date', v_first, 'last_date', v_last, 'roles', v_roles,
    'history', v_hist, 'upcoming', v_up, 'open', coalesce(v_open, '[]'::jsonb));
end $$$m$,$m$comment on function public.volunteer_me() is 'wave175: the volunteer page (hub.welfareavenue.com/me) for the signed-in volunteer: links their Google account by its verified email on the first visit when exactly one volunteer record has it; then their name, servings (past services where they were confirmed) and hours (event_roster.detail hours, or app_config vol_default_hours), roles, history (the last 14 days with their link for the survey), upcoming servings with their links, and open spots they can take (app_config vol_signup_roles under vol_role_targets, within vol_signup_days). Refuses while the access token hook is off. Only their own record.'$m$,$m$revoke all on function public.volunteer_me() from public$m$,$m$grant execute on function public.volunteer_me() to anon, authenticated$m$,$m$create or replace function public.volunteer_me_link(p_token text)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_uid uuid; v_pid bigint; v_cur bigint; v_email text;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'hook'); end if;
  if p_token is null or length(p_token) < 12 then return jsonb_build_object('ok', false, 'reason', 'token'); end if;
  select person_id into v_pid from public.event_roster where confirm_token = p_token;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'token'); end if;
  v_cur := public.wa175_person();
  if v_cur is not null and v_cur <> v_pid then return jsonb_build_object('ok', false, 'reason', 'other'); end if;
  if v_cur = v_pid then return jsonb_build_object('ok', true, 'already', true); end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  insert into public.volunteer_accounts (user_id, person_id, email, linked_via) values (v_uid, v_pid, v_email, 'link') on conflict (user_id) do nothing;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_people', v_pid::text, 'account', null, 'Google account linked from their text link', 'volunteer (account)');
  return jsonb_build_object('ok', true);
end $$$m$,$m$comment on function public.volunteer_me_link(text) is 'wave175: links the signed-in Google account to the volunteer of a personal link (/c/<token>): the link proves who they are. Refuses an account already linked to someone else. Logged.'$m$,$m$revoke all on function public.volunteer_me_link(text) from public$m$,$m$grant execute on function public.volunteer_me_link(text) to anon, authenticated$m$,$m$create or replace function public.volunteer_me_signup(p_event bigint, p_role text)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pid bigint; e record; v_role text; v_target int; v_have int; v_today date; v_days int; v_name text; v_tok text; v_id bigint; p record;
begin
  v_pid := public.wa175_person();
  if v_pid is null or not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  v_role := lower(trim(coalesce(p_role, '')));
  if not (v_role = any (string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'vol_signup_roles'), '')), ' ', ''), ','))) then
    return jsonb_build_object('ok', false, 'reason', 'role');
  end if;
  v_today := (now() at time zone 'America/Toronto')::date;
  v_days := coalesce(nullif((select value from public.app_config where key = 'vol_signup_days'), '')::int, 90);
  select * into e from public.volunteer_events where id = p_event for update;
  if not found or e.kind <> 'service' or e.status in ('cancelled', 'completed') or e.event_date <= v_today or e.event_date > v_today + v_days then
    return jsonb_build_object('ok', false, 'reason', 'event');
  end if;
  if exists (select 1 from public.event_roster o where o.event_id = e.id and o.person_id = v_pid and lower(coalesce(o.status, '')) <> 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  v_target := ((select value from public.app_config where key = 'vol_role_targets')::jsonb->>v_role)::int;
  select count(*) into v_have from public.event_roster o where o.event_id = e.id and lower(o.role) = v_role and lower(coalesce(o.status, '')) not in ('cancelled', 'unavailable');
  if v_target is null or v_have >= v_target then return jsonb_build_object('ok', false, 'reason', 'full'); end if;
  select * into p from public.volunteer_people where id = v_pid;
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail, sort)
  values (e.id, v_pid, p.full_name, v_role, 'TBD',
          jsonb_strip_nulls(jsonb_build_object('source', 'self sign-up (volunteer page)', 'phone', (p.phones)[1], 'email', (p.emails)[1])),
          coalesce((select max(sort) from public.event_roster where event_id = e.id), 0) + 1)
  returning id, confirm_token into v_id, v_tok;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', v_id::text, 'self sign-up', null, v_role || ' on ' || e.event_date, 'volunteer (account)');
  return jsonb_build_object('ok', true, 'token', v_tok, 'roster_id', v_id);
end $$$m$,$m$comment on function public.volunteer_me_signup(bigint, text) is 'wave175: the signed-in volunteer takes an open spot: an upcoming service within vol_signup_days, a role in vol_signup_roles, while the role is under its vol_role_targets count; not twice on the same serving. Adds a roster row (status TBD, detail.source self sign-up) so the usual texts apply (a sign-up notice, the confirmation 7 days before). Logged.'$m$,$m$revoke all on function public.volunteer_me_signup(bigint, text) from public$m$,$m$grant execute on function public.volunteer_me_signup(bigint, text) to anon, authenticated$m$,$m$create or replace function public.volunteer_me_letter()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pid bigint; m jsonb; v_ref text; p record;
begin
  v_pid := public.wa175_person();
  if v_pid is null or not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  m := public.volunteer_me();
  if coalesce((m->>'servings')::int, 0) = 0 then return jsonb_build_object('ok', false, 'reason', 'none'); end if;
  select * into p from public.volunteer_people where id = v_pid;
  v_ref := 'WA-VH-' || upper(substr(md5(v_pid::text || clock_timestamp()::text || random()::text), 1, 6));
  insert into public.volunteer_hour_letters (ref, person_id, full_name, servings, hours, first_date, last_date)
  values (v_ref, v_pid, coalesce(p.full_name, ''), (m->>'servings')::int, (m->>'hours')::numeric, (m->>'first_date')::date, (m->>'last_date')::date);
  return jsonb_build_object('ok', true, 'ref', v_ref, 'name', p.full_name, 'servings', (m->>'servings')::int, 'hours', (m->>'hours')::numeric,
    'first_date', m->>'first_date', 'last_date', m->>'last_date', 'roles', m->'roles', 'issued', (now() at time zone 'America/Toronto')::date);
end $$$m$,$m$comment on function public.volunteer_me_letter() is 'wave175: a letter of volunteer hours for the signed-in volunteer (servings, hours, first and last serving, roles), recorded in volunteer_hour_letters with a reference (WA-VH-xxxxxx) staff can check.'$m$,$m$revoke all on function public.volunteer_me_letter() from public$m$,$m$grant execute on function public.volunteer_me_letter() to anon, authenticated$m$,$m$drop policy if exists policies_read on public.wa_policies$m$,$m$create policy policies_read on public.wa_policies for select to authenticated using ((select public.is_wa_staff()) or (select public.is_board_viewer()))$m$,$m$drop policy if exists hr_access_read on public.wa_hr_access$m$,$m$create policy hr_access_read on public.wa_hr_access for select to authenticated using ((select public.is_wa_staff()))$m$,$m$drop policy if exists academy_assignments_read on public.academy_assignments$m$,$m$create policy academy_assignments_read on public.academy_assignments for select to authenticated using (
  (select public.is_wa_staff()) and (public.wa169_can_assign() or audience = 'everyone'
   or (audience = 'team' and exists (select 1 from public.team_members tm where lower(tm.email) = public.wa_email() and tm.department = any (academy_assignments.teams)))
   or (audience = 'people' and public.wa_email() = any (people))))$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
