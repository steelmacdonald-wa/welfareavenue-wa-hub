-- Welfare Avenue Hub: wave275 (275a), Task 1, 02/11/26. The database foundation for one streamlined onboarding, on top of wave271 (live).
-- From the offer onward there is one flow: the offer going out starts the flow (status offered) with the manager the offer named, the manager proposes times from their
-- availability, the hire accepts (confirming weekly hours) and says yes or no, and Accept moves the same flow on to waiting. This file only gives the database what the
-- rest of the wave needs: the new columns, the offer-sent trigger, a changed Accept trigger, the manager check, the manager's cards, the availability rules and
-- the three notification kinds. Nothing here sends anything, creates an account or books a time.
-- Design: claude/02-11-26 - One streamlined onboarding, design (wave275).md. Proved offline first: node test/w271sql.mjs (PGlite, with test/w275sql.sql). Safe to run twice.
-- Needs wa271a_onboard.sql, wa271b_remind.sql and wa271d_min_hours.sql first. Does not touch hub_onboard_flows rows that exist (the three live flows keep their status and path).
-- Undo: build/wa275a_undo.sql (before build/wa271a_undo.sql).
-- The release setting onboard_v2_since is NOT set here: it is set at release (a flow created before it stays on the wave271 path).

-- 1. the offer (hub_candidates): the weekly hours the offer asks for, the manager it names, and when the hire confirmed the hours
alter table public.hub_candidates add column if not exists offer_hours int check (offer_hours is null or offer_hours in (4, 6, 8));
alter table public.hub_candidates add column if not exists onboard_manager_id bigint references public.team_members (id) on delete set null;
alter table public.hub_candidates add column if not exists hours_confirmed_at timestamptz;
create index if not exists hub_candidates_onboard_manager_idx on public.hub_candidates (onboard_manager_id) where onboard_manager_id is not null;   -- its foreign key, as the release checklist asks
comment on column public.hub_candidates.offer_hours is 'wave275: the minimum hours a week the offer asks for (4, 6 or 8), from the "Hours a week" field of the offer panel. Written by recruit-actions when the offer goes out; read by the Accept page ("I confirm I can give at least N hours a week") and the HR card. Null: an offer from before wave275, which shows Accept without the hours line.';
comment on column public.hub_candidates.onboard_manager_id is 'wave275: the person (team_members.id) who will manage this hire, set in the offer panel (the position''s manager by default, or the one HR picks). Written by recruit-actions when the offer goes out; the offer-sent trigger copies it to the flow as manager_member_id. Null: not chosen yet, so HR picks on the card.';
comment on column public.hub_candidates.hours_confirmed_at is 'wave275: when the candidate ticked "I confirm I can give at least N hours a week" and pressed Accept. Written by the offer page with the service key; read by HR on the card (wa271_ready_list). Null: not confirmed, or an acceptance from before wave275.';

-- 2. the flow: it can start at the offer, and carries the manager's proposal, the hire's answer and the setup record
alter table public.hub_onboard_flows add column if not exists proposed_call_at timestamptz;
alter table public.hub_onboard_flows add column if not exists proposed_one_on_one_at timestamptz;
alter table public.hub_onboard_flows add column if not exists proposed_by text;
alter table public.hub_onboard_flows add column if not exists proposed_at timestamptz;
alter table public.hub_onboard_flows add column if not exists hire_answer text check (hire_answer is null or hire_answer in ('yes', 'no'));
alter table public.hub_onboard_flows add column if not exists hire_answered_at timestamptz;
alter table public.hub_onboard_flows add column if not exists setup_ticks jsonb not null default '{}'::jsonb;
alter table public.hub_onboard_flows add column if not exists welcome_sent_at timestamptz;
alter table public.hub_onboard_flows add column if not exists accounts_at timestamptz;
alter table public.hub_onboard_flows add column if not exists ask_availability boolean not null default true;
alter table public.hub_onboard_flows drop constraint if exists hub_onboard_flows_status_check;
alter table public.hub_onboard_flows add constraint hub_onboard_flows_status_check check (status in ('offered', 'waiting', 'ready', 'running', 'started', 'backed_out'));
comment on column public.hub_onboard_flows.status is 'offered (wave275: the offer went out, the manager can propose times; the hire has not accepted), waiting (accepted, grid not done or not picked, or times proposed and the hire has not answered), ready (times picked), running (Start onboarding is working), started (done, leaves the Ready list), backed_out (the hire withdrew after accepting).';
comment on column public.hub_onboard_flows.proposed_call_at is 'wave275: the onboarding call time the manager (or HR) proposed. At least onboard_propose_lead_hours ahead when proposed. Written by onboard-link (the mgr link) and onboard-run with the service key. Null: nothing proposed. It becomes call_at when the hire presses Yes and the Hub books it.';
comment on column public.hub_onboard_flows.proposed_one_on_one_at is 'wave275: the manager 1-on-1 time proposed with the call. Written like proposed_call_at. Null: nothing proposed. It becomes one_on_one_at when booked.';
comment on column public.hub_onboard_flows.proposed_by is 'wave275: the email of whoever proposed the times (the manager, or HR on their behalf). Null until proposed.';
comment on column public.hub_onboard_flows.proposed_at is 'wave275: when the times were proposed. The manager''s reminder (onboard_remind_hours) counts from the offer, not from here. Null until proposed.';
comment on column public.hub_onboard_flows.hire_answer is 'wave275: the hire''s answer to the proposed times, yes or no. A no is answered by the manager or HR from the card. Written by onboard-link with the service key. Null until answered (and for every flow from before wave275).';
comment on column public.hub_onboard_flows.hire_answered_at is 'wave275: when the hire pressed Yes or No. Null until then.';
comment on column public.hub_onboard_flows.setup_ticks is 'wave275: the hire''s own ticks on the setup rundown, a json object keyed by step with true or the time it was ticked. Written by onboard-link with the service key; the card shows how many are done. Holds no secrets. {} until the first tick.';
comment on column public.hub_onboard_flows.welcome_sent_at is 'wave275: when the single welcome email (times, login and the setup rundown) went to the hire. Written by onboard-run with the service key. Null until sent, and for a flow from the wave271 path.';
comment on column public.hub_onboard_flows.accounts_at is 'wave275: when the at-Accept steps (roster, Google account, Hub access) finished. Written by onboard-run with the service key. Null until then, and for a flow from the wave271 path.';
comment on column public.hub_onboard_flows.ask_availability is 'wave275: true (the default), the hire is asked for their availability when they say no; false, availability was already communicated, so a no shows "thanks, the manager will be in touch" and HR or the manager enters the hire''s times on the card. Set from the card.';
grant select (proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at, hire_answer, hire_answered_at, setup_ticks, welcome_sent_at, accounts_at, ask_availability)
  on public.hub_onboard_flows to authenticated;   -- as every column but pw_nonce (271a); row security keeps it to HR and admins; the service key has it all

-- 3. people's weekly availability, on the roster. The shape is checked by wa275_availability_ok (below); the page and the functions only ever store what passes it.
alter table public.team_members add column if not exists availability jsonb;
alter table public.team_members add column if not exists availability_at timestamptz;
comment on column public.team_members.availability is 'wave275: this person''s one-off dates for onboarding calls and 1-on-1s, as {"except": [{"date": "2026-11-11", "free": []}], "tz": "America/Toronto"}. Times are HH:MM on 5-minute marks; an except day replaces that weekday (empty free = unavailable that day). Their usual week is not here: it is wave276''s typical week (hub_team_avail, saved on Home), and wa275_availability_of joins the two (Steel, 02/11/26). A weekly key is never written by the Hub and never read. Checked by wa275_availability_ok. Set by the person through wa275_availability_set, by HR through onboard-run (availability_for), or from the mgr link. Null: no one-off dates. Note: team_members is readable by staff, so a staff member can read this column directly; it holds nothing but free times.';
comment on column public.team_members.availability_at is 'wave275: when the one-off dates (availability) were last saved. Not the week''s save time: that is hub_team_avail.updated_at (wa275_availability_of availability_at).';

-- 3a. the shape check: one block list ...
create or replace function public.wa275_blocks_ok(p_blocks jsonb)
returns boolean language plpgsql immutable set search_path to '' as $function$
declare e jsonb; s text; t text;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then return false; end if;
  for e in select x.value from jsonb_array_elements(p_blocks) x loop
    if jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2 then return false; end if;
    if jsonb_typeof(e -> 0) <> 'string' or jsonb_typeof(e -> 1) <> 'string' then return false; end if;
    s := e ->> 0; t := e ->> 1;
    if s !~ '^([01][0-9]|2[0-3]):[0-5][05]$' or t !~ '^([01][0-9]|2[0-3]):[0-5][05]$' then return false; end if;   -- HH:MM on 5-minute marks
    if substr(t, 1, 2)::int * 60 + substr(t, 4, 2)::int <= substr(s, 1, 2)::int * 60 + substr(s, 4, 2)::int then return false; end if;   -- the end is after the start
  end loop;
  return true;
end $function$;
revoke all on function public.wa275_blocks_ok(jsonb) from public, anon;
grant execute on function public.wa275_blocks_ok(jsonb) to authenticated, service_role;
comment on function public.wa275_blocks_ok(jsonb) is 'wave275: true when the value is a list of [start, end] blocks, each "HH:MM" on a 5-minute mark (00:00 to 23:55) with the end after the start. An empty list is fine. Never raises. Used by wa275_availability_ok. Pure (reads nothing); executable by authenticated and the service key because a check constraint runs with the rights of whoever writes the row.';

-- 3b. ... and the whole availability value
create or replace function public.wa275_availability_ok(p_availability jsonb)
returns boolean language plpgsql immutable set search_path to '' as $function$
declare k text; e jsonb; d text;
begin
  if p_availability is null then return true; end if;   -- nothing saved
  if jsonb_typeof(p_availability) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(p_availability) loop
    if k not in ('weekly', 'except', 'tz') then return false; end if;
  end loop;
  if p_availability ? 'tz' and p_availability -> 'tz' <> '"America/Toronto"'::jsonb then return false; end if;
  if p_availability ? 'weekly' then
    if jsonb_typeof(p_availability -> 'weekly') <> 'object' then return false; end if;
    for k in select jsonb_object_keys(p_availability -> 'weekly') loop
      if k not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') then return false; end if;
      if not public.wa275_blocks_ok(p_availability -> 'weekly' -> k) then return false; end if;
    end loop;
  end if;
  if p_availability ? 'except' then
    if jsonb_typeof(p_availability -> 'except') <> 'array' then return false; end if;
    for e in select x.value from jsonb_array_elements(p_availability -> 'except') x loop
      if jsonb_typeof(e) <> 'object' or not (e ? 'date') or not (e ? 'free') or (select count(*) from jsonb_object_keys(e)) <> 2 then return false; end if;
      if jsonb_typeof(e -> 'date') <> 'string' then return false; end if;
      d := e ->> 'date';
      if d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
      begin
        if d::date::text <> d then return false; end if;   -- a real calendar day (2026-02-30 is refused)
      exception when others then return false; end;
      if not public.wa275_blocks_ok(e -> 'free') then return false; end if;
    end loop;
  end if;
  return true;
end $function$;
revoke all on function public.wa275_availability_ok(jsonb) from public, anon;
grant execute on function public.wa275_availability_ok(jsonb) to authenticated, service_role;
comment on function public.wa275_availability_ok(jsonb) is 'wave275: true when the value is a valid availability (or null): only the keys weekly, except and tz; weekly keys only mon..sun, each a list of [start, end] blocks (wa275_blocks_ok); except entries {date: a real YYYY-MM-DD day, free: [blocks]} with nothing else (empty free = unavailable that day); tz, when present, America/Toronto. Never raises. The check constraint team_members_availability_check. Pure (reads nothing); executable by authenticated and the service key because a check constraint runs with the rights of whoever writes the row, so the browser''s own roster edits need it.';

alter table public.team_members drop constraint if exists team_members_availability_check;
alter table public.team_members add constraint team_members_availability_check check (public.wa275_availability_ok(availability));

-- 3c. (amended 02/11/26, Steel: the manager's week is wave276's typical week) the person's week from hub_team_avail, as blocks. Internal: no access check of its
--     own, so only the definer functions below call it. Needs wave276 (hub_team_avail, hub_team_avail_ask), which is live; this file does not create them.
create or replace function public.wa275_week_of(p_member bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_email text; v_cell int; v_at timestamptz; v_stale boolean; v_weekly jsonb := '{}'::jsonb;
  v_days text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_slot int; v_wd int; v_min int; v_cur_wd int := -1; v_s int; v_e int; v_list jsonb := '[]'::jsonb;
  hm constant text := 'FM00';
begin
  select lower(trim(coalesce(m.email, ''))) into v_email from public.team_members m where m.id = p_member;
  v_cell := coalesce((select case when trim(c.value) ~ '^[0-9]{1,3}$' and trim(c.value)::int > 0 then trim(c.value)::int end from public.app_config c where c.key = 'avail_cell_min'), 30);
  -- each team's current week: the newest saved row (a save time) whose effective_from is today or earlier, as wa_avail_mine reads it
  select max(r.updated_at) into v_at from (
    select distinct on (h.department) h.updated_at from public.hub_team_avail h
     where coalesce(v_email, '') <> '' and lower(trim(h.email)) = v_email and h.effective_from <= current_date and h.updated_at is not null
     order by h.department, h.effective_from desc, h.id desc) r;
  -- the union of the teams' cells, each [start, start + cell), joined where they touch or overlap
  for v_slot in
    select distinct x::int from (
      select distinct on (h.department) h.slots from public.hub_team_avail h
       where coalesce(v_email, '') <> '' and lower(trim(h.email)) = v_email and h.effective_from <= current_date and h.updated_at is not null
       order by h.department, h.effective_from desc, h.id desc) r, unnest(r.slots) x
     where x >= 0 and x < 7 * 1440 order by 1
  loop
    v_wd := v_slot / 1440; v_min := v_slot % 1440;
    if v_wd <> v_cur_wd or v_min > v_e then
      if v_cur_wd >= 0 then v_list := v_list || jsonb_build_array(jsonb_build_array(to_char(v_s / 60, hm) || ':' || to_char(v_s % 60, hm), to_char(least(v_e, 1440) / 60, hm) || ':' || to_char(least(v_e, 1440) % 60, hm))); end if;
      if v_wd <> v_cur_wd then
        if v_cur_wd >= 0 then v_weekly := v_weekly || jsonb_build_object(v_days[v_cur_wd + 1], v_list); end if;
        v_list := '[]'::jsonb; v_cur_wd := v_wd;
      end if;
      v_s := v_min; v_e := v_min + v_cell;
    else
      v_e := greatest(v_e, v_min + v_cell);
    end if;
  end loop;
  if v_cur_wd >= 0 then
    v_list := v_list || jsonb_build_array(jsonb_build_array(to_char(v_s / 60, hm) || ':' || to_char(v_s % 60, hm), to_char(least(v_e, 1440) / 60, hm) || ':' || to_char(least(v_e, 1440) % 60, hm)));
    v_weekly := v_weekly || jsonb_build_object(v_days[v_cur_wd + 1], v_list);
  end if;
  -- current: saved on or after the latest ask (on or before today) for any of their teams, as wa_avail_due counts it; stale otherwise, or with nothing saved
  v_stale := coalesce(v_email, '') = '' or not exists (
    select 1 from (select h.department, max(h.updated_at) as last_saved from public.hub_team_avail h
                    where lower(trim(h.email)) = v_email and h.updated_at is not null group by h.department) t
     where t.last_saved >= coalesce((select max(k.ask_date) from public.hub_team_avail_ask k where k.department = t.department and k.ask_date <= current_date), '-infinity'::date));
  if v_weekly = '{}'::jsonb then
    return jsonb_build_object('weekly', '{"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]],"wed":[["09:00","17:00"]],"thu":[["09:00","17:00"]],"fri":[["09:00","17:00"]]}'::jsonb,
                              'no_week', true, 'stale', true, 'availability_at', v_at);
  end if;
  return jsonb_build_object('weekly', v_weekly, 'no_week', false, 'stale', v_stale, 'availability_at', v_at);
end $function$;
revoke all on function public.wa275_week_of(bigint) from public, anon, authenticated;
comment on function public.wa275_week_of(bigint) is 'wave275 (amended 02/11/26): one roster person''s usual week for onboarding, from wave276''s typical week, as {weekly: {mon..sun: [["HH:MM","HH:MM"]]}, no_week, stale, availability_at}. The rows are hub_team_avail for their roster email (lower case): for each team, the newest row saved (updated_at set) with effective_from today or earlier; the teams'' cells (weekday * 1440 + minute, weekday 0 Monday, Toronto wall time, avail_cell_min minutes each) are joined into blocks where they touch. No cells: Monday to Friday 09:00 to 17:00 with no_week and stale true. stale: no team whose last save is on or after its latest hub_team_avail_ask date on or before today (or that has no ask). availability_at: the newest save of the current rows. No access check of its own: wa275_availability_of and wa275_flow_row call it. Not callable from the browser.';

-- 4. the offer going out starts the flow (only when offer_sent_at goes from empty to a time; touching it again, or setting it again, starts nothing new)
create or replace function public.wa275_offer_sent()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  insert into public.hub_onboard_flows (candidate_id, practice, status, manager_member_id)
  values (new.id, new.practice, 'offered', new.onboard_manager_id)
  on conflict (candidate_id) do nothing;
  return new;
end $function$;
revoke all on function public.wa275_offer_sent() from public, anon, authenticated;
comment on function public.wa275_offer_sent() is 'wave275: trigger function. When hub_candidates.offer_sent_at goes from empty to a time, creates the candidate''s onboarding flow in status offered (practice copied, manager_member_id = onboard_manager_id) once; if a flow exists already (a candidate who accepted on the wave271 path) it does nothing. Not callable.';
drop trigger if exists wa275_offer_sent on public.hub_candidates;
create trigger wa275_offer_sent after update of offer_sent_at on public.hub_candidates
  for each row when (old.offer_sent_at is null and new.offer_sent_at is not null) execute function public.wa275_offer_sent();

-- 4a. accepting moves that flow on (the proposal and the manager stay); with no flow it makes a waiting one, as in wave271
create or replace function public.wa271_cand_accepted()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  update public.hub_onboard_flows set status = 'waiting', updated_at = now() where candidate_id = new.id and status = 'offered';
  if not found then
    insert into public.hub_onboard_flows (candidate_id, practice, status) values (new.id, new.practice, 'waiting')
    on conflict (candidate_id) do nothing;
  end if;
  return new;
end $function$;
revoke all on function public.wa271_cand_accepted() from public, anon, authenticated;
comment on function public.wa271_cand_accepted() is 'wave271, wave275: trigger function. When hub_candidates.accepted_on goes from empty to a date, moves the candidate''s flow from offered to waiting (keeping the manager and the proposal), or, when the candidate has no flow (an offer from before wave275), creates a waiting one (practice copied) once. A flow in any other status is left alone. Not callable.';

-- 5. who may act on a flow: its manager (by roster email, whatever their Hub role), HR, an admin or the service key. Only a flow that exists.
create or replace function public.wa275_manager_of(p_flow bigint)
returns boolean language sql stable security definer set search_path to '' as $function$
  select coalesce(
    exists (select 1 from public.hub_onboard_flows f where f.id = p_flow)
    and (
      coalesce(auth.role(), '') = 'service_role' or public.wa_is_hr() or public.is_hub_admin()
      or exists (select 1 from public.hub_onboard_flows f join public.team_members m on m.id = f.manager_member_id and m.active
                  where f.id = p_flow
                    and nullif(lower(trim(coalesce(m.email, ''))), '') is not null
                    and lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', ''))))
    ), false)
$function$;
revoke all on function public.wa275_manager_of(bigint) from public, anon;
grant execute on function public.wa275_manager_of(bigint) to authenticated, service_role;
comment on function public.wa275_manager_of(bigint) is 'wave275: true when the signed-in person may act on this onboarding flow: their roster email (an active team_members row, compared in lower case) is the flow''s manager''s email, or they are HR (wa_is_hr) or an admin (is_hub_admin), or this is the service key. False for a flow that does not exist, a flow with no manager (unless HR or admin), a signed-out visitor and null. The checked door for the card actions of a plain member who manages a hire.';

-- 6. the card row, once, for the HR list and the manager's list (so they never drift). Internal: the two list functions check who is asking.
create or replace function public.wa275_flow_row(p_flow bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'flow_id', f.id,
    'candidate_id', c.id,
    'status', f.status,
    'practice', f.practice,
    'name', c.name,
    'role', c.role,
    'email', c.email,
    'accepted_on', c.accepted_on,
    'offer_respond_by', c.offer_respond_by,
    'offer_start', c.offer_start,
    'late', coalesce(c.accepted_on > c.offer_respond_by, false),
    'grids', jsonb_build_object(
      'hire', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'hire' and cardinality(g.slots) > 0) then 'marked' else 'none' end,
      'manager', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'manager' and cardinality(g.slots) > 0) then 'marked' else 'none' end),
    'call_at', f.call_at,
    'one_on_one_at', f.one_on_one_at,
    'manager_member_id', f.manager_member_id,
    'manager_name', m.name,
    'default_manager', case when public.wa271_can() then public.wa271_default_manager(c.id) end,   -- HR only; null for a manager (the function raises for anyone else)
    'other_open_rows', (select count(*) from public.hub_candidates o
                         where o.id <> c.id and nullif(lower(trim(coalesce(c.email, ''))), '') is not null
                           and lower(trim(coalesce(o.email, ''))) = lower(trim(c.email))
                           and o.status not in ('declined', 'withdrawn')),
    'offer_hours', c.offer_hours,
    'hours_confirmed_at', c.hours_confirmed_at,
    'proposed_call_at', f.proposed_call_at,
    'proposed_one_on_one_at', f.proposed_one_on_one_at,
    'proposed_by', f.proposed_by,
    'proposed_at', f.proposed_at,
    'hire_answer', f.hire_answer,
    'hire_answered_at', f.hire_answered_at,
    'ask_availability', f.ask_availability,
    'setup_ticks', f.setup_ticks,
    'welcome_sent_at', f.welcome_sent_at,
    'accounts_at', f.accounts_at,
    'manager_availability_at', w.week -> 'availability_at',
    'manager_no_week', coalesce(w.week -> 'no_week', 'true'::jsonb),
    'manager_week_stale', coalesce(w.week -> 'stale', 'true'::jsonb))
  from public.hub_onboard_flows f
  left join lateral (select public.wa275_week_of(f.manager_member_id) as week) w on f.manager_member_id is not null
  join public.hub_candidates c on c.id = f.candidate_id
  left join public.team_members m on m.id = f.manager_member_id
  where f.id = p_flow
$function$;
revoke all on function public.wa275_flow_row(bigint) from public, anon, authenticated;
comment on function public.wa275_flow_row(bigint) is 'wave275: one flow as the card list shows it (jsonb): everything wave271''s Ready list gave (flow_id, candidate_id, status, practice, name, role, email, accepted_on, offer dates, late, grids, call_at, one_on_one_at, manager_member_id, default_manager, other_open_rows) plus manager_name, offer_hours, hours_confirmed_at, the proposal (proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at), the answer (hire_answer, hire_answered_at), ask_availability, setup_ticks, welcome_sent_at, accounts_at, and the manager''s week (amended 02/11/26: wa275_week_of, wave276''s typical week): manager_availability_at (when it was saved), manager_no_week and manager_week_stale. default_manager is HR''s only (null for a manager). Does no access check of its own: only wa271_ready_list and wa275_my_cards call it, after theirs. Not callable from the browser.';

-- 6a. the Ready to onboard list, now built from the shared row (HR, admins and the service key). It also lists offered flows: a card runs from the offer.
create or replace function public.wa271_ready_list()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.wa271_can() then raise exception 'Only HR can see the onboarding list'; end if;
  return coalesce((
    select jsonb_agg(public.wa275_flow_row(x.id) order by x.accepted_on, x.id) from (
      select f.id, c.accepted_on
        from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id
       where f.status not in ('started', 'backed_out')
         and c.status not in ('declined', 'withdrawn')
         and not exists (select 1 from public.onboardings p join public.team_members m on m.id = p.member_id
                          where p.completed_at is null and p.id is distinct from f.onboarding_id
                            and (m.id = c.member_id or (nullif(lower(trim(coalesce(c.email, ''))), '') is not null and lower(trim(coalesce(m.email, ''))) = lower(trim(c.email)))))) x
  ), '[]'::jsonb);
end $function$;
revoke all on function public.wa271_ready_list() from public, anon;
grant execute on function public.wa271_ready_list() to authenticated, service_role;
comment on function public.wa271_ready_list() is 'wave271, wave275: the HR Center Ready to onboard list as jsonb: every flow not started or backed out, on a card not declined or withdrawn, for someone with no other open plan, offered flows included (status offered, accepted_on null). Each row is wa275_flow_row: name, role, personal email, offer dates, late, grid statuses, the default manager, other_open_rows, and (wave275) offer_hours, hours_confirmed_at, the proposal, the hire''s answer and manager_availability_at. HR, admins and the service key only; raises for anyone else.';

-- 6b. the signed-in manager's own cards: flows whose manager is this person (active roster row with their email), not backed out, not declined or withdrawn
create or replace function public.wa275_my_cards()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  return coalesce((
    select jsonb_agg(public.wa275_flow_row(x.id) order by x.created_at, x.id) from (
      select f.id, f.created_at
        from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id
       where f.status <> 'backed_out'
         and c.status not in ('declined', 'withdrawn')
         and f.manager_member_id in (select m.id from public.team_members m
                                      where m.active and nullif(lower(trim(coalesce(m.email, ''))), '') is not null
                                        and lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', ''))))) x
  ), '[]'::jsonb);
end $function$;
revoke all on function public.wa275_my_cards() from public, anon;
grant execute on function public.wa275_my_cards() to authenticated, service_role;
comment on function public.wa275_my_cards() is 'wave275: the onboarding cards of the hires the signed-in person manages, as a jsonb list in the same row shape as wa271_ready_list (wa275_flow_row), oldest first. The person is the active team_members row with their sign-in email; the flows are those whose manager_member_id is that row, not backed out, on a card not declined or withdrawn. A plain member sees only their own hires; the default_manager field is null for them. Empty for a signed-out visitor, someone not on the roster, and the service key.';

-- 7. availability: a person sets their own one-off dates, and HR, an admin, the person or the service key read the whole of it (the week from wave276, the
--    dates from the roster row). Amended 02/11/26 (Steel): the week is wave276's typical week, set on Home; nothing here stores a week.
create or replace function public.wa275_availability_set(p_availability jsonb)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if v_email = '' then raise exception 'Sign in to set your availability'; end if;
  if not exists (select 1 from public.team_members m where m.active and lower(trim(coalesce(m.email, ''))) = v_email) then
    raise exception 'Only people on the team can set their availability';
  end if;
  if p_availability is not null and jsonb_typeof(p_availability) = 'object' and p_availability ? 'weekly' then
    raise exception 'Your typical week is set on the Hub''s Home page now. Here you can only add or remove one-off dates';
  end if;
  if p_availability is null or jsonb_typeof(p_availability) <> 'object' or not public.wa275_availability_ok(p_availability) then
    raise exception 'That availability is not valid: use real dates, times as HH:MM on 5-minute marks, and each end after its start';
  end if;
  update public.team_members set availability = jsonb_build_object('except', coalesce(p_availability -> 'except', '[]'::jsonb), 'tz', 'America/Toronto'), availability_at = now()
   where active and lower(trim(coalesce(email, ''))) = v_email;
end $function$;
revoke all on function public.wa275_availability_set(jsonb) from public, anon;
grant execute on function public.wa275_availability_set(jsonb) to authenticated, service_role;
comment on function public.wa275_availability_set(jsonb) is 'wave275 (amended 02/11/26): the signed-in person (the active team_members row with their sign-in email) saves their own one-off dates, {except: [{date, free}], tz}, and the time it was saved (availability_at). Their usual week is wave276''s typical week, set on Home, so a weekly key is refused with a plain sentence. Refuses a signed-out visitor, someone not on the roster, and anything wa275_availability_ok refuses, each with a plain message. HR sets someone else''s through onboard-run (availability_for) with the service key; the mgr link saves the manager''s own.';

create or replace function public.wa275_availability_of(p_member bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', ''))); v_m public.team_members; v_w jsonb;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.wa_is_hr() or public.is_hub_admin()
          or (v_email <> '' and exists (select 1 from public.team_members m where m.id = p_member and lower(trim(coalesce(m.email, ''))) = v_email))) then
    raise exception 'Only HR, an admin or the person themselves can read availability';
  end if;
  select * into v_m from public.team_members where id = p_member;
  if not found then raise exception 'That person is not on the roster'; end if;
  v_w := public.wa275_week_of(p_member);
  return jsonb_build_object(
    'availability', jsonb_build_object('weekly', v_w -> 'weekly',
                                       'except', case when jsonb_typeof(v_m.availability -> 'except') = 'array' then v_m.availability -> 'except' else '[]'::jsonb end,
                                       'tz', 'America/Toronto'),
    'availability_at', v_w -> 'availability_at',
    'stale', v_w -> 'stale',
    'no_week', v_w -> 'no_week',
    'except_at', v_m.availability_at);
end $function$;
revoke all on function public.wa275_availability_of(bigint) from public, anon;
grant execute on function public.wa275_availability_of(bigint) to authenticated, service_role;
comment on function public.wa275_availability_of(bigint) is 'wave275 (amended 02/11/26): {availability: {weekly, except, tz}, availability_at, stale, no_week, except_at} for one roster person, the one read of a manager''s availability (onboard-run''s propose and book rules, onboard-link''s mgr page, the card''s picker). weekly is wave276''s typical week (wa275_week_of: their current hub_team_avail rows, the teams joined, cells as blocks), or Monday to Friday 09:00 to 17:00 with no_week true when they have saved none; except is their one-off dates from team_members.availability (a weekly key there is never read); availability_at is when the week was saved, except_at when the dates were; stale is true with no week, or when no team''s week was saved on or after that team''s latest ask. HR, admins, the person themselves and the service key only; raises for anyone else, and for someone who is not on the roster.';

-- 7a. one key of a flow's setup_ticks, merged into what is there (never the whole object rewritten from a stale copy). p_if_unset: only while that key is empty
--     (absent or json null), which is how onboard-run claims a send (hire_times) so two calls at once send once.
create or replace function public.wa275_tick_set(p_flow bigint, p_key text, p_value jsonb, p_if_unset boolean default false)
returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if p_key is null or p_key !~ '^[a-z_]{1,40}$' then raise exception 'wa275_tick_set: the key must be 1 to 40 of a to z and _'; end if;
  update public.hub_onboard_flows
     set setup_ticks = coalesce(setup_ticks, '{}'::jsonb) || jsonb_build_object(p_key, p_value), updated_at = now()
   where id = p_flow and (not coalesce(p_if_unset, false) or setup_ticks ->> p_key is null);
  return found;
end $function$;
revoke all on function public.wa275_tick_set(bigint, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.wa275_tick_set(bigint, text, jsonb, boolean) to service_role;
comment on function public.wa275_tick_set(bigint, text, jsonb, boolean) is 'wave275: sets one key of hub_onboard_flows.setup_ticks to p_value (a json null clears it), merged into the object that is there, and returns true when the row was written. With p_if_unset true it writes only while that key is absent or null: onboard-run claims the hire_times email with it (key hire_times_at) and clears the key when new times are proposed. Keys are 1 to 40 of a to z and _. The service key only (onboard-run and onboard-link); never the browser.';

-- 7b. (Task 3) the onboarding plan when the hire's Yes books the times. onboarding_assign (wa271a 10) checks is_wa_staff(), which is false for the service
--     key, and the hire has no sign-in; this is the same plan, made for onboard-run with the service key only. Keep the two in step.
create or replace function public.wa275_plan_assign(p_member_id bigint, p_by text, p_start date)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_name text;
begin
  if p_start is null then raise exception 'wa275_plan_assign: day one (p_start) is needed'; end if;
  select name into v_name from public.team_members where id = p_member_id;
  if v_name is null then raise exception 'member not found'; end if;
  insert into public.onboardings (member_id, person_name, assigned_by, started_at)
  values (p_member_id, v_name, p_by, p_start) returning id into v_id;
  insert into public.onboarding_steps (onboarding_id, template_id, due_date)
  select v_id, t.id, public.onb_due(t.section, p_start) from public.onboarding_template t where t.active on conflict do nothing;
  insert into public.hr_setup_steps (onboarding_id, template_id)
  select v_id, t.id from public.hr_setup_template t where t.active on conflict do nothing;
  perform public.wa166_onb_sync(v_id);
  return v_id;
end $function$;
revoke all on function public.wa275_plan_assign(bigint, text, date) from public, anon, authenticated;
grant execute on function public.wa275_plan_assign(bigint, text, date) to service_role;
comment on function public.wa275_plan_assign(bigint, text, date) is 'wave275: starts the HR onboarding plan for a roster member when the new hire''s Yes books their times (onboard-run book, with the service key). The same plan as onboarding_assign: the onboardings row with day one p_start, the onboarding_template steps with due dates counted from it, the hr_setup_template steps, and wa166_onb_sync. onboarding_assign stays the one the page and HR''s Start use (it checks staff); this one has no sign-in to check, so only the service key may call it.';

-- 8. settings (HR can change them) ; onboard_v2_since is deliberately absent: it is set at release
insert into public.app_config (key, value) values
  ('onboard_auto_hub', 'on'), ('onboard_propose_lead_hours', '48'), ('onboard_yes_lead_hours', '24')
on conflict (key) do nothing;

-- 9. the three notification kinds, in People and HR after wave271's three
insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, example_title, example_body, example_url, hub, slack, email, channel_only, audience, sender, active, updated_at) values
('onboard_propose', 'people', 'People and HR', 60, 'A new hire I manage needs times proposed',
 'When an offer goes out for someone you will manage, and again after onboard_remind_hours (48 by default) if no times have been proposed. You pick the onboarding call and your 1-on-1 from your own availability.',
 'Who is joining and in what role, and your link to propose times for the onboarding call and your 1-on-1. The link needs no sign-in.',
 'Propose times for Alex Tremblay', 'Alex Tremblay (Program Coordinator) has been sent an offer. Please propose a time for their onboarding call and your 1-on-1. It takes a minute. Propose times.', '#hrcentre/onboarding',
 true, true, false, false, 'the new hire''s manager', 'onboard-run, notify', true, now()),
('onboard_answer', 'people', 'People and HR', 70, 'A new hire answered the times I proposed',
 'When a new hire presses Yes or No on the times proposed for their onboarding call. A yes means the call and the 1-on-1 are booked. A no means a person picks other times from the card.',
 'Who answered, whether it was a yes or a no, and a link to their card in Onboarding.',
 'Alex Tremblay said no to the times', 'Alex Tremblay (Program Coordinator) said no to the times proposed. Open their card to pick other times.', '#hrcentre/onboarding',
 true, true, false, false, 'the new hire''s manager and the HR notify list', 'onboard-link, notify', true, now()),
('onboard_ready', 'people', 'People and HR', 80, 'A new hire I manage has finished their setup',
 'When a new hire has ticked every step on their setup rundown (their Welfare Avenue account, Gmail and Calendar, the Hub, Slack and the rest), so you know they are ready before the onboarding call.',
 'Who is ready and in what role, the date of their onboarding call, and a link to their card in Onboarding.',
 'Alex Tremblay is set up', 'Alex Tremblay (Program Coordinator) has finished their setup. Their onboarding call is on Monday, November 2, 2026 at 10:00 a.m. Open their card.', '#hrcentre/onboarding',
 true, true, false, false, 'the new hire''s manager', 'onboard-link, notify', true, now())
on conflict (key) do update set grp = excluded.grp, grp_title = excluded.grp_title, sort = excluded.sort, title = excluded.title, blurb = excluded.blurb, says = excluded.says,
  example_title = excluded.example_title, example_body = excluded.example_body, example_url = excluded.example_url, hub = excluded.hub, slack = excluded.slack, email = excluded.email,
  channel_only = excluded.channel_only, audience = excluded.audience, sender = excluded.sender, active = excluded.active, updated_at = now();
