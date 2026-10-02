-- wa191m_run (01/10/26): the driver and team leader's run, worked out from the real stops.
-- Steel: "The driver's itinerary and start time with the team leader will always depend on how many cooks to pick up
-- from. Remember that they need to go to anywhere between 3-6 addresses of cooks, the storage unit address, and the event
-- at Place Emile Gamelin. After the event they might need to go do dishes after at old brewery and then back to the
-- storage unit"; "we should provide them with a working google maps trajectory link of a starting point, all the stops on
-- the way and how long in order to calculate their starting time." Choices (01/10/26): the Hub picks the faster order
-- (storage unit first, or the cooks first), driving times from free map data (OpenStreetMap), an inventory check at the end.
-- The serving-run edge function places each stop (Photon / Nominatim, cached in geo_cache), asks OSRM for the driving
-- times between every pair, tries every order of the pickups, and stores the result here (volunteer_event_runs.plan):
-- one run per driver part (the only driver and the team leader: every stop; with two drivers, the pickup driver takes the
-- cooks and the main driver and the team leader the storage unit), each stop with its time, the start time worked
-- backwards from being at the serving run_setup_min before it starts, a Google Maps link (from where they are, through
-- every stop), and after the serving: the dishes at the Old Brewery Mission, then the storage unit and the inventory.
-- wa174_times now uses it: the drivers' and team leader's start, and each cook's own pickup time (and reads the operations
-- sheet's Drop-off like wa174_itinerary does). The cron works out every serving of the next 14 days again when its stops
-- change. Applied 02/10/26 in three parts (1-6, then 7-8 and 9).

/* ---------- 1. the minutes and the addresses for the map (Text settings, Itineraries) ---------- */
insert into public.volunteer_itinerary_settings (key, value, updated_at, updated_by) values
  ('storage_address', '888 Rue Saint-Antoine Ouest, Montréal, QC H3C 4G3', now(), 'wave191m'),
  ('serving_address', '1500 Rue Berri, Montréal, QC H2L 2C4', now(), 'wave191m'),
  ('dish_address', '915 Rue Clark, Montréal, QC H2Z 1J2', now(), 'wave191m'),
  ('run_cook_min', '7', now(), 'wave191m'),
  ('run_storage_min', '15', now(), 'wave191m'),
  ('run_setup_min', '30', now(), 'wave191m'),
  ('run_serve_min', '105', now(), 'wave191m'),
  ('run_dish_min', '45', now(), 'wave191m'),
  ('run_close_min', '20', now(), 'wave191m'),
  ('run_drive_factor', '1.25', now(), 'wave191m')
on conflict (key) do nothing;

/* ---------- 2. where an address is (staff read; the serving-run function writes) ---------- */
create table if not exists public.geo_cache (
  q text primary key,
  lat double precision, lng double precision,
  label text, src text,
  approx boolean not null default false,
  ok boolean not null default true,
  at timestamptz not null default now()
);
alter table public.geo_cache enable row level security;
create policy geo_cache_staff_read on public.geo_cache for select to authenticated using (public.is_wa_staff());
comment on table public.geo_cache is 'wave191m: where an address is, for the drivers'' run (q: the cleaned address in lower case, without apartment or door codes; src photon, nominatim, postal; approx when only the street or the postal code was found; ok false when nothing was found, tried again after 7 days). OpenStreetMap data. Staff read; the serving-run edge function writes.';
insert into public.geo_cache (q, lat, lng, label, src, approx, ok) values
  ('888 rue saint-antoine ouest, montréal, qc h3c 4g3', 45.4987962, -73.564256, '888 Rue Saint-Antoine Ouest, Montréal', 'nominatim', false, true),
  ('1500 rue berri, montréal, qc h2l 2c4', 45.5151, -73.5611, '1500 Rue Berri (Place Émilie-Gamelin), Montréal', 'photon', false, true),
  ('915 rue clark, montréal, qc h2z 1j2', 45.5069, -73.558, '915 Rue Clark (Old Brewery Mission), Montréal', 'photon', false, true)
on conflict (q) do nothing;

/* ---------- 3. the worked-out runs ---------- */
create table if not exists public.volunteer_event_runs (
  event_id bigint primary key references public.volunteer_events(id) on delete cascade,
  inputs_hash text not null,
  plan jsonb not null,
  computed_at timestamptz not null default now(),
  computed_by text
);
alter table public.volunteer_event_runs enable row level security;
create policy volunteer_event_runs_staff_read on public.volunteer_event_runs for select to authenticated using (public.is_wa_staff());
comment on table public.volunteer_event_runs is 'wave191m: a serving''s drivers'' run as the serving-run edge function worked it out: plan {v, computed_at, serve, arrive_by, order (storage_first or cooks_first), compared {storage_first, cooks_first: minutes}, runs [{kind both|main|pickup|none, drivers [roster ids], names, with_tl, with_storage, start, at, end, stops [{k storage|cook|kitchen|serving, rid, label, hood, address, arrive, leave, drive_min, approx}], drive_min, total_min, maps_url}], after {leave, stops, end, maps_url}, cook_eta {roster id: HH:MI}, warnings [{rid, name, why}], source osm|estimate}; inputs_hash: wa191_run_inputs''s hash when it was worked out. Staff read; the function writes.';

/* ---------- 4. what a run is made of (the serving-run function reads it with the service role) ---------- */
create or replace function public.wa191_run_inputs(p_event bigint) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare e record; v jsonb; v_cooks jsonb; v_drivers jsonb; v_tl jsonb; v_set jsonb;
begin
  select ev.id, ev.code, ev.event_date, coalesce(ev.start_time, '12:00'::time) st, ev.format, ev.kitchen_place, ev.status
    into e from public.volunteer_events ev where ev.id = p_event;
  if not found then return null; end if;
  select jsonb_object_agg(s.key, s.value) into v_set from public.volunteer_itinerary_settings s
   where s.key in ('storage_address', 'serving_address', 'dish_address', 'run_cook_min', 'run_storage_min', 'run_setup_min', 'run_serve_min', 'run_dish_min', 'run_close_min', 'run_drive_factor');
  -- the cooks whose food we pick up (the same rule as wa174_itinerary), in roster order
  select coalesce(jsonb_agg(jsonb_build_object('rid', c.id, 'name', c.person_name,
           'address', coalesce(c.confirm->>'address', c.detail->>'address'), 'postal', c.confirm->>'postal_code', 'hood', c.confirm->>'neighbourhood')
           order by c.sort nulls last, c.id), '[]'::jsonb)
    into v_cooks
    from public.event_roster c
   where c.event_id = p_event and lower(c.role) = 'cook'
     and lower(coalesce(c.status, '')) not in ('cancelled', 'unavailable') and coalesce(c.confirm_status, '') <> 'declined'
     and (c.confirm->>'cook_location' = 'home' or (c.confirm->>'cook_location' is null and c.detail->>'pickup_dropoff' = 'Pick-up'));
  -- a community kitchen: one pickup at the kitchen instead of the cooks' homes
  if e.format = 'community_kitchen' then
    v_cooks := case when nullif(trim(coalesce(e.kitchen_place, '')), '') is not null
      then jsonb_build_array(jsonb_build_object('rid', null, 'name', 'The kitchen', 'address', e.kitchen_place, 'kitchen', true)) else '[]'::jsonb end;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('rid', d.id, 'name', d.person_name, 'kind', public.wa174_driver_kind(d.id)) order by d.sort nulls last, d.id), '[]'::jsonb)
    into v_drivers from public.event_roster d
   where d.event_id = p_event and lower(d.role) = 'driver'
     and lower(coalesce(d.status, '')) not in ('cancelled', 'unavailable') and coalesce(d.confirm_status, '') <> 'declined';
  select coalesce(jsonb_agg(jsonb_build_object('rid', t.id, 'name', t.person_name) order by t.sort nulls last, t.id), '[]'::jsonb)
    into v_tl from public.event_roster t
   where t.event_id = p_event and lower(t.role) = 'team_leader'
     and lower(coalesce(t.status, '')) not in ('cancelled', 'unavailable') and coalesce(t.confirm_status, '') <> 'declined';
  v := jsonb_build_object('event', jsonb_build_object('id', e.id, 'code', e.code, 'date', e.event_date, 'start', to_char(e.st, 'HH24:MI'), 'format', e.format, 'status', e.status),
         'settings', coalesce(v_set, '{}'::jsonb), 'cooks', v_cooks, 'drivers', v_drivers, 'team_leaders', v_tl);
  return v || jsonb_build_object('hash', md5(v::text));
end $$;
comment on function public.wa191_run_inputs(bigint) is 'wave191m: what a serving''s drivers'' run is made of: the serving (date, start, format), the minutes and the map addresses (volunteer_itinerary_settings), the cooks whose food is picked up (or the community kitchen), the drivers with their part, the team leaders; hash: md5 of it all, so the run is worked out again when any of it changes. The serving-run edge function only (service role).';
revoke all on function public.wa191_run_inputs(bigint) from public, anon, authenticated;
grant execute on function public.wa191_run_inputs(bigint) to service_role;

/* ---------- 5. one person's part of the run (for wa174_times and wa174_itinerary) ---------- */
create or replace function public.wa191_run_for(p_roster bigint) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare r record; p jsonb; x jsonb;
begin
  select er.id, er.event_id, lower(er.role) as role into r from public.event_roster er where er.id = p_roster;
  if not found then return null; end if;
  select plan into p from public.volunteer_event_runs where event_id = r.event_id;
  if p is null then return null; end if;
  if r.role = 'cook' then
    return case when (p->'cook_eta') ? r.id::text then jsonb_build_object('eta', p->'cook_eta'->>r.id::text) end;
  elsif r.role = 'driver' then
    select value into x from jsonb_array_elements(coalesce(p->'runs', '[]'::jsonb)) where value->'drivers' @> to_jsonb(r.id) limit 1;
  elsif r.role = 'team_leader' then
    select value into x from jsonb_array_elements(coalesce(p->'runs', '[]'::jsonb)) where coalesce((value->>'with_tl')::boolean, false) limit 1;
  else
    return null;
  end if;
  if x is null then return null; end if;
  return jsonb_build_object('start', x->>'start', 'at', x->>'at', 'end', x->>'end', 'run', x,
    'after', case when coalesce((x->>'with_storage')::boolean, false) then p->'after' end,
    'order', p->>'order', 'computed_at', p->>'computed_at');
end $$;
comment on function public.wa191_run_for(bigint) is 'wave191m: one roster row''s part of the serving''s worked-out run: a driver''s run (by their roster id), the team leader''s (the run with the storage unit), with start, at, end and after the serving; a cook''s pickup time (eta). Null without a run. Internal (wa174_times, wa174_itinerary).';
revoke all on function public.wa191_run_for(bigint) from public, anon, authenticated;

/* ---------- 6. the run for the Hub (staff) ---------- */
create or replace function public.wa191_run_get(p_event bigint) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v record; v_in jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select * into v from public.volunteer_event_runs where event_id = p_event;
  v_in := public.wa191_run_inputs(p_event);
  return jsonb_build_object('plan', v.plan, 'computed_at', v.computed_at, 'computed_by', v.computed_by,
    'stale', case when v.event_id is null then null else v.inputs_hash <> (v_in->>'hash') end,
    'cooks', jsonb_array_length(coalesce(v_in->'cooks', '[]'::jsonb)),
    'no_address', (select count(*) from jsonb_array_elements(coalesce(v_in->'cooks', '[]'::jsonb)) c where nullif(trim(coalesce(c->>'address', '')), '') is null),
    'drivers', jsonb_array_length(coalesce(v_in->'drivers', '[]'::jsonb)), 'team_leaders', jsonb_array_length(coalesce(v_in->'team_leaders', '[]'::jsonb)));
end $$;
comment on function public.wa191_run_get(bigint) is 'wave191m: a serving''s worked-out run for the Hub: the plan, when and by whom, stale (the stops changed since; the cron works it out again within 15 minutes, or Work it out again), how many cooks to pick up, without an address, drivers, team leaders. Staff only.';
revoke all on function public.wa191_run_get(bigint) from public, anon;
grant execute on function public.wa191_run_get(bigint) to authenticated;

/* ---------- 7. the times: the run's start for drivers and the team leader, each cook's pickup ---------- */
create or replace function public.wa174_times(p_roster bigint) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare r record; s time; st time; en time; v_at text; k text; lead int; dt time; g record; v_run jsonb; v_eta time;
begin
  select er.role, er.confirm, er.detail, coalesce(e.start_time, '12:00'::time) as start_time into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found then return null; end if;
  s := r.start_time;
  lead := coalesce(nullif(public.wa174_set('pickup_lead_min'), '')::int, 75);
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  if lower(r.role) in ('cook', 'driver', 'team_leader') then v_run := public.wa191_run_for(p_roster); end if;
  if lower(r.role) = 'cook' then
    -- dropping off: said on their page, or (not said yet) the operations sheet's Drop-off, as wa174_itinerary reads it
    if r.confirm->>'cook_location' = 'drop off' or (r.confirm->>'cook_location' is null and r.detail->>'pickup_dropoff' = 'Drop-off') then
      dt := coalesce(nullif((select value from public.app_config where key = 'cook_dropoff_time'), '')::time, s);
      st := dt - interval '15 minutes'; v_at := 'dropoff';
      en := case when (r.confirm->>'stay_to_serve')::boolean then s + interval '120 minutes' else dt end;
    else
      v_eta := nullif(v_run->>'eta', '')::time;
      if v_eta is not null then st := v_eta - interval '10 minutes'; en := v_eta;
      else st := s - make_interval(mins => lead); en := s; end if;
      v_at := 'home';
    end if;
  elsif lower(r.role) = 'driver' then
    k := public.wa174_driver_kind(p_roster);
    if nullif(v_run->>'start', '') is not null then
      st := (v_run->>'start')::time; v_at := coalesce(v_run->>'at', 'pickup');
      en := coalesce(nullif(v_run->>'end', '')::time, s + make_interval(mins => coalesce(g.duration_min, 210) - 60));
    else
      if k in ('pickup', 'both') then st := s - make_interval(mins => lead); v_at := 'pickup';
      else st := s - interval '60 minutes'; v_at := 'storage'; end if;
      en := s + make_interval(mins => coalesce(g.duration_min, 210) - 60);
    end if;
  elsif lower(r.role) = 'team_leader' and nullif(v_run->>'start', '') is not null then
    st := (v_run->>'start')::time; v_at := coalesce(v_run->>'at', 'storage');
    en := coalesce(nullif(v_run->>'end', '')::time, st + make_interval(mins => coalesce(g.duration_min, 210)));
  else
    st := s + make_interval(mins => coalesce(g.arrive_offset_min, 0));
    en := st + make_interval(mins => coalesce(g.duration_min, 120));
    v_at := case when lower(r.role) = 'team_leader' then 'storage' else 'serving' end;
  end if;
  return jsonb_build_object('start', public.wa174_hm(st), 'end', public.wa174_hm(en), 'at', v_at, 'serve', public.wa174_hm(s), 'driver_kind', k)
    || case when v_eta is not null then jsonb_build_object('eta', public.wa174_hm(v_eta)) else '{}'::jsonb end
    || case when nullif(v_run->>'start', '') is not null then jsonb_build_object('run', true) else '{}'::jsonb end;
end $$;
comment on function public.wa174_times(bigint) is 'wave174/191m: a roster row''s times: start, end, at (storage, pickup, home, dropoff, serving), the serving''s start, a driver''s part; a cook drops off when their page says so or, not said yet, the operations sheet says Drop-off; with a worked-out run (wa191_run_for) the drivers'' and team leader''s start and end come from it and a cook''s food is ready 10 minutes before their pickup (eta); otherwise the fixed offsets.';

/* ---------- 8. the itinerary carries the run ---------- */
create or replace function public.wa174_itinerary(p_roster bigint) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare r record; g record; v_kind text; v_team jsonb; v_pick jsonb; v_drop jsonb; v_route text; out jsonb; v_times jsonb; v_place text; v_rd jsonb;
begin
  select er.id, er.role, er.event_id, e.location, e.format, e.kitchen_place, e.kitchen_shift, coalesce(e.start_time, '12:00'::time) as start_time
    into r from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found then return null; end if;
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  v_kind := g.itinerary;
  if v_kind is null then return null; end if;
  v_times := public.wa174_times(p_roster);
  v_place := coalesce(nullif(nullif(trim(coalesce(r.location, '')), ''), 'Montreal'), (select value from public.app_config where key = 'cook_dropoff_place'), '1500 Rue Berri, Montréal, QC H2L 2C4');
  select coalesce(jsonb_agg(jsonb_build_object('name', t.person_name, 'role', lower(t.role),
           'role_en', public.wa171_role_label(t.role, 'en'), 'role_fr', public.wa171_role_label(t.role, 'fr'),
           'kind', case when lower(t.role) = 'driver' then public.wa174_driver_kind(t.id) end,
           'phone', public.wa171_roster_phone(t.id), 'me', t.id = r.id)
         order by case lower(t.role) when 'team_leader' then 0 when 'driver' then 1 else 2 end, t.sort nulls last, t.id), '[]'::jsonb) into v_team
    from public.event_roster t
   where t.event_id = r.event_id and lower(t.role) in ('team_leader', 'driver', 'community_debrief')
     and lower(coalesce(t.status, '')) not in ('cancelled', 'unavailable') and coalesce(t.confirm_status, '') <> 'declined';
  out := jsonb_build_object('kind', v_kind, 'serve', public.wa174_hm(r.start_time), 'place', v_place,
    'meet_spot', public.wa174_set('meet_spot'), 'times', v_times, 'team', v_team,
    'notes_en', to_jsonb(string_to_array(coalesce(public.wa174_set('notes_en'), ''), E'\n')), 'notes_fr', to_jsonb(string_to_array(coalesce(public.wa174_set('notes_fr'), ''), E'\n')),
    'format', r.format, 'kitchen_place', case when r.format = 'community_kitchen' then r.kitchen_place end, 'kitchen_shift', case when r.format = 'community_kitchen' then r.kitchen_shift end);
  if v_kind = 'lead_driver' then
    select coalesce(jsonb_agg(jsonb_build_object('name', c.person_name, 'phone', public.wa171_roster_phone(c.id),
             'address', coalesce(c.confirm->>'address', c.detail->>'address'), 'neighbourhood', c.confirm->>'neighbourhood', 'postal_code', c.confirm->>'postal_code',
             'dish', (select x.name from public.recipes x where x.id = c.recipe_id), 'rid', c.id) order by c.sort nulls last, c.id), '[]'::jsonb),
           string_agg(public.wa174_maps(concat_ws(', ', coalesce(c.confirm->>'address', c.detail->>'address'), c.confirm->>'postal_code', 'Montréal')), '/' order by c.sort nulls last, c.id)
      into v_pick, v_route
      from public.event_roster c
     where c.event_id = r.event_id and lower(c.role) = 'cook'
       and lower(coalesce(c.status, '')) not in ('cancelled', 'unavailable') and coalesce(c.confirm_status, '') <> 'declined'
       and (c.confirm->>'cook_location' = 'home' or (c.confirm->>'cook_location' is null and c.detail->>'pickup_dropoff' = 'Pick-up'))
       and coalesce(c.confirm->>'address', c.detail->>'address') is not null;
    select coalesce(jsonb_agg(jsonb_build_object('name', c.person_name, 'stay', c.confirm->'stay_to_serve', 'dish', (select x.name from public.recipes x where x.id = c.recipe_id)) order by c.sort nulls last, c.id), '[]'::jsonb)
      into v_drop
      from public.event_roster c
     where c.event_id = r.event_id and lower(c.role) = 'cook'
       and lower(coalesce(c.status, '')) not in ('cancelled', 'unavailable') and coalesce(c.confirm_status, '') <> 'declined'
       and (c.confirm->>'cook_location' = 'drop off' or (c.confirm->>'cook_location' is null and c.detail->>'pickup_dropoff' = 'Drop-off'));
    out := out || jsonb_build_object('pickups', v_pick, 'dropoffs', v_drop,
      'route_url', case when v_route is not null then 'https://www.google.com/maps/dir/' || v_route || '/' || public.wa174_maps(v_place) end,
      'storage_place', public.wa174_set('storage_place'), 'storage_access', public.wa174_set('storage_access'),
      'dish_place', public.wa174_set('dish_place'), 'audit_url', case when lower(r.role) = 'team_leader' then public.wa174_set('audit_url') end);
    -- wave191m: the worked-out run (stops with times, the Google Maps link, after the serving)
    v_rd := public.wa191_run_for(p_roster);
    if v_rd is not null then
      out := out || jsonb_build_object('run', v_rd->'run', 'after', v_rd->'after', 'run_order', v_rd->>'order', 'run_at', v_rd->>'computed_at');
    end if;
  elsif lower(r.role) = 'dishwasher' then
    out := out || jsonb_build_object('dish_place', public.wa174_set('dish_place'));
  end if;
  return out;
end $$;
comment on function public.wa174_itinerary(bigint) is 'wave174/182/191m: a roster row''s itinerary by role (lead_driver, serve, community; cooks none): times, the team, notes; for team leaders and drivers the pickups (with roster ids), drop-offs, the storage unit and its access, the dishwashing, the audit form, and (wave191m) the worked-out run with each stop''s time and its Google Maps link, and after the serving.';

/* ---------- 9. worked out again when the stops change (every 15 minutes, servings of the next 14 days; serving-run v2 answers
   the cron's 10-second call at once and works in the background) ---------- */
select cron.schedule('wa-serving-run', '7,22,37,52 * * * *',
  $c$select public.call_edge('serving-run', '{"action":"tick"}'::jsonb) where exists (select 1 from public.volunteer_events e where e.kind = 'service' and coalesce(e.status, '') not in ('cancelled', 'completed') and e.event_date between (now() at time zone 'America/Toronto')::date and (now() at time zone 'America/Toronto')::date + 14)$c$);
