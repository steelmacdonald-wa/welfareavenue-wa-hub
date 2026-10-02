-- wa191n_inventory_check (02/10/26): the team leader's quick check of the storage unit after the serving.
-- Steel (01/10/26): after the serving the team goes "back to the storage unit in which we should be checking into to see
-- what inventory looks like and that all is back in order". Chosen: a quick check on the leader's page (each item all back,
-- running low or missing, and whether everything is back in its place), saved to the Hub's Inventory, with what to restock
-- in the serving's Wrap up.
-- The team leader's own link (event_roster.confirm_token) is the key, as for the survey: volunteer_inventory_get gives the
-- items and the check so far; volunteer_inventory_submit saves it, from the serving's start to three days after (Toronto).
-- Each item running low or missing gets its Reorder note in the Inventory ("Running low (team leader, Oct 4)"); an item
-- the next check finds all back loses a note a check wrote (never one the team typed). One check per serving (the latest
-- answer, who and when); a change_log line. Test links save nothing (the page).

/* ---------- 1. the checks: one per serving (staff read; the team leader's page writes through the function) ---------- */
create table if not exists public.volunteer_inventory_checks (
  event_id bigint primary key references public.volunteer_events(id) on delete cascade,
  roster_id bigint references public.event_roster(id) on delete set null,
  by_name text,
  in_place boolean,
  items jsonb not null default '[]'::jsonb,
  low int not null default 0,
  missing int not null default 0,
  note text,
  lang text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.volunteer_inventory_checks enable row level security;
create policy volunteer_inventory_checks_staff_read on public.volunteer_inventory_checks for select to authenticated using (public.is_wa_staff());
comment on table public.volunteer_inventory_checks is 'wave191n: the team leader''s check of the storage unit after a serving (one per serving, the latest answer): in_place (everything back in its place and the unit locked), items [{id, item, unit, category, state ok|low|missing}] (every item of volunteer_inventory when it was saved), low and missing counts, note, who (roster_id, by_name), when. Staff read; volunteer_inventory_submit writes.';

/* ---------- 2. when the check is open: from the serving's start to three days after (Toronto) ---------- */
create or replace function public.wa191_inv_open(p_date date, p_start time) returns boolean
language sql stable set search_path to '' as $$
  select (now() at time zone 'America/Toronto') >= (p_date + coalesce(p_start, '12:00'::time))
     and (now() at time zone 'America/Toronto')::date <= p_date + 3;
$$;
comment on function public.wa191_inv_open(date, time) is 'wave191n: the storage check is open from the serving''s start to three days after it (Toronto).';

/* ---------- 3. the check for the team leader's page (their link is the key) ---------- */
create or replace function public.volunteer_inventory_get(p_token text, p_preview boolean default false) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare r record; v_items jsonb; v_check jsonb;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, er.role, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, coalesce(e.start_time, '12:00'::time) as start_time into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or lower(coalesce(r.role, '')) <> 'team_leader' then return null; end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'category', regexp_replace(coalesce(i.category, ''), '^\s*\d+\.\s*', ''), 'item', i.item, 'unit', i.unit)
           order by i.sort nulls last, i.id), '[]'::jsonb) into v_items
    from public.volunteer_inventory i where nullif(trim(coalesce(i.item, '')), '') is not null;
  select jsonb_build_object('in_place', c.in_place, 'items', c.items, 'note', c.note, 'low', c.low, 'missing', c.missing, 'at', c.updated_at, 'by', c.by_name) into v_check
    from public.volunteer_inventory_checks c where c.event_id = r.event_id;
  return jsonb_build_object('open', public.wa191_inv_open(r.event_date, r.start_time), 'preview', coalesce(p_preview, false),
    'opens', public.wa174_hm(r.start_time), 'until', (r.event_date + 3)::text, 'items', v_items, 'check', v_check);
end $$;
comment on function public.volunteer_inventory_get(text, boolean) is 'wave191n: the storage check for a team leader''s page (their confirm_token is the key; null for anyone else or a cancelled spot): open (from the serving''s start to three days after), the items of volunteer_inventory (category without its number, item, unit) and the check so far. Anonymous, like volunteer_confirm_get.';
grant execute on function public.volunteer_inventory_get(text, boolean) to anon, authenticated;

/* ---------- 4. saving the check; the Inventory's reorder notes follow ---------- */
create or replace function public.volunteer_inventory_submit(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare r record; v_states jsonb; k text; s text; v_items jsonb := '[]'::jsonb; i record; v_low int := 0; v_missing int := 0; v_note text; v_tag text; v_in boolean;
begin
  if p_token is null or length(p_token) < 12 or p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('ok', false); end if;
  select er.id, er.role, er.person_name, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, coalesce(e.start_time, '12:00'::time) as start_time into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or lower(coalesce(r.role, '')) <> 'team_leader' then return jsonb_build_object('ok', false); end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return jsonb_build_object('ok', false, 'reason', 'not_on_it'); end if;
  if not public.wa191_inv_open(r.event_date, r.start_time) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  v_states := coalesce(p->'items', '{}'::jsonb);
  if jsonb_typeof(v_states) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  for k, s in select e.key, e.value #>> '{}' from jsonb_each(v_states) e loop
    if k !~ '^\d{1,9}$' or coalesce(s, '') not in ('ok', 'low', 'missing') then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  end loop;
  if jsonb_typeof(p->'in_place') is distinct from 'boolean' then return jsonb_build_object('ok', false, 'reason', 'in_place'); end if;
  v_in := (p->>'in_place')::boolean;
  v_note := nullif(left(trim(coalesce(p->>'note', '')), 1000), '');
  v_tag := ' (team leader, ' || to_char(r.event_date, 'FMMon FMDD') || ')';
  for i in select x.id, x.category, x.item, x.unit, x.reorder_needed from public.volunteer_inventory x where nullif(trim(coalesce(x.item, '')), '') is not null order by x.sort nulls last, x.id loop
    s := coalesce(v_states->>(i.id::text), 'ok');
    v_items := v_items || jsonb_build_array(jsonb_build_object('id', i.id, 'item', i.item, 'unit', i.unit, 'category', regexp_replace(coalesce(i.category, ''), '^\s*\d+\.\s*', ''), 'state', s));
    if s = 'low' then
      v_low := v_low + 1;
      update public.volunteer_inventory set reorder_needed = 'Running low' || v_tag, updated_at = now() where id = i.id;
    elsif s = 'missing' then
      v_missing := v_missing + 1;
      update public.volunteer_inventory set reorder_needed = 'Missing' || v_tag, updated_at = now() where id = i.id;
    elsif coalesce(i.reorder_needed, '') ~ '^(Running low|Missing) \(team leader, [^)]*\)$' then
      update public.volunteer_inventory set reorder_needed = null, updated_at = now() where id = i.id;
    end if;
  end loop;
  insert into public.volunteer_inventory_checks as c (event_id, roster_id, by_name, in_place, items, low, missing, note, lang, submitted_at, updated_at)
  values (r.event_id, r.id, r.person_name, v_in, v_items, v_low, v_missing, v_note, nullif(left(coalesce(p->>'lang', ''), 5), ''), now(), now())
  on conflict (event_id) do update set roster_id = excluded.roster_id, by_name = excluded.by_name, in_place = excluded.in_place, items = excluded.items,
    low = excluded.low, missing = excluded.missing, note = excluded.note, lang = excluded.lang, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, changed_at)
  values ('volunteer_inventory_check', r.event_id::text, 'check', null,
    v_low || ' running low, ' || v_missing || ' missing' || case when v_in then ', all back in place' else ', not all back in place' end, 'team leader: ' || coalesce(r.person_name, 'unnamed'), now());
  return jsonb_build_object('ok', true, 'low', v_low, 'missing', v_missing, 'in_place', v_in);
end $$;
comment on function public.volunteer_inventory_submit(text, jsonb) is 'wave191n: a team leader saves the storage check from their page (their confirm_token is the key; from the serving''s start to three days after): p {items {inventory id: ok|low|missing} (an item left out counts as ok), in_place boolean (required), note, lang}. Keeps one check per serving (volunteer_inventory_checks), sets each low or missing item''s Reorder note in volunteer_inventory ("Running low (team leader, Oct 4)"), clears a note a check wrote when the item is back, and logs to change_log. Anonymous, like volunteer_survey_submit.';
grant execute on function public.volunteer_inventory_submit(text, jsonb) to anon, authenticated;
