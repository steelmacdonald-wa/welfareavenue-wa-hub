-- wave347 database part: the count form lives in the Program Builder (editable), can be lent to a server, and shows live.

create table if not exists public.pb_forms (key text primary key, title text not null, def jsonb not null, updated_at timestamptz not null default now(), updated_by text);
alter table public.pb_forms enable row level security;
revoke all on public.pb_forms from anon, authenticated;
grant select on public.pb_forms to authenticated;
grant all on public.pb_forms to service_role;
drop policy if exists pb_forms_staff_read on public.pb_forms;
create policy pb_forms_staff_read on public.pb_forms for select to authenticated using ((select public.is_wa_staff()));
comment on table public.pb_forms is 'wave347: the forms the Program Development team edits in Program Builder (count = the people count on a lead''s page). Written through pb_form_save.';
alter table public.pb_tally add column if not exists extra jsonb;
comment on column public.pb_tally.extra is 'wave347: answers to the count form''s added questions (key -> option, or a list of options).';

insert into public.pb_forms (key, title, def, updated_by) values ('count', 'The count', $j${"fields":[
 {"k":"age","core":true,"active":true,"m":false,"en":"Age","fr":"Âge","o":[{"v":"child","en":"Child","fr":"Enfant","active":true},{"v":"youth","en":"Youth","fr":"Jeune","active":true},{"v":"adult","en":"Adult","fr":"Adulte","active":true},{"v":"senior","en":"Senior","fr":"Aîné·e","active":true}]},
 {"k":"sex","core":true,"active":true,"m":false,"en":"Sex","fr":"Sexe","o":[{"v":"man","en":"Man","fr":"Homme","active":true},{"v":"woman","en":"Woman","fr":"Femme","active":true},{"v":"non_binary","en":"Other","fr":"Autre","active":true}]},
 {"k":"bg","core":true,"active":true,"m":false,"en":"Indigenous","fr":"Autochtone","o":[{"v":"indigenous","en":"Yes","fr":"Oui","active":true},{"v":"non_indigenous","en":"No","fr":"Non","active":true}]},
 {"k":"meal","core":true,"active":true,"m":false,"en":"Meal","fr":"Repas","o":[{"v":"standard","en":"Standard","fr":"Standard","active":true},{"v":"special","en":"Special request","fr":"Demande spéciale","active":true}]},
 {"k":"also","core":false,"active":false,"m":true,"en":"Also received","fr":"A aussi reçu","o":[{"v":"clothing","en":"Clothing","fr":"Vêtements","active":true},{"v":"hygiene_kit","en":"Hygiene kit","fr":"Trousse d’hygiène","active":true},{"v":"resource_guide","en":"Resource guide","fr":"Guide de ressources","active":true}]}
]}$j$::jsonb, 'wave347') on conflict (key) do nothing;

create or replace function public.pb_can_edit() returns boolean language sql stable security definer set search_path to '' as $f$
  select coalesce(public.is_wa_staff(), false) and (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false)
    or exists (select 1 from public.team_members m where m.active and m.department = 'progdev' and lower(m.email) = lower(coalesce(auth.jwt()->>'email', ''))))
$f$;
revoke all on function public.pb_can_edit() from public, anon;
grant execute on function public.pb_can_edit() to authenticated, service_role;

-- the form as a lead's page needs it: switched-on questions and options only
create or replace function public.pb_form_public(p_key text) returns jsonb language sql stable security definer set search_path to '' as $f$
  select jsonb_build_object('fields', coalesce((select jsonb_agg(jsonb_build_object('k', f->>'k', 'en', f->>'en', 'fr', f->>'fr', 'm', coalesce((f->>'m')::boolean, false),
      'o', (select coalesce(jsonb_agg(jsonb_build_array(o->>'v', o->>'en', o->>'fr') order by oi), '[]'::jsonb) from jsonb_array_elements(f->'o') with ordinality x(o, oi) where coalesce((o->>'active')::boolean, true))) order by fi)
    from jsonb_array_elements(d.def->'fields') with ordinality y(f, fi) where coalesce((f->>'active')::boolean, true)), '[]'::jsonb))
  from public.pb_forms d where d.key = p_key
$f$;
revoke all on function public.pb_form_public(text) from public, anon, authenticated;
grant execute on function public.pb_form_public(text) to service_role;

create or replace function public.pb_form_get(p_key text) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  return (select jsonb_build_object('key', d.key, 'title', d.title, 'def', d.def, 'updated_at', d.updated_at,
            'updated_by', coalesce((select split_part(m.name, ' ', 1) from public.team_members m where lower(m.email) = lower(d.updated_by) limit 1), d.updated_by), 'can', public.pb_can_edit())
          from public.pb_forms d where d.key = p_key);
end $f$;
revoke all on function public.pb_form_get(text) from public, anon;
grant execute on function public.pb_form_get(text) to authenticated, service_role;

create or replace function public.pb_form_save(p_key text, p_def jsonb) returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_who text := lower(coalesce(auth.jwt()->>'email', 'staff')); old jsonb; f jsonb; o jsonb; of jsonb; keys text[] := '{}'; vals text[]; n int := 0; v_out jsonb := '[]'::jsonb; v_o jsonb; k text; v text;
        core jsonb := '{"age":["child","youth","adult","senior"],"sex":["man","woman","non_binary"],"bg":["indigenous","non_indigenous"],"meal":["standard","special"]}'::jsonb;
begin
  if not public.pb_can_edit() then raise exception 'Only the Program Development team, leads and admins change this form.'; end if;
  select def into old from public.pb_forms where key = p_key;
  if old is null then raise exception 'No such form.'; end if;
  if p_def is null or jsonb_typeof(p_def->'fields') <> 'array' then raise exception 'The form needs its questions.'; end if;
  if jsonb_array_length(p_def->'fields') > 12 then raise exception 'At most 12 questions: the count has to stay quick.'; end if;
  for f in select value from jsonb_array_elements(p_def->'fields') loop
    k := lower(btrim(coalesce(f->>'k', '')));
    if k !~ '^[a-z][a-z0-9_]{1,23}$' then raise exception 'A question is missing its short name.'; end if;
    if k = any (keys) then raise exception 'Two questions share the short name %.', k; end if;
    keys := keys || k;
    if btrim(coalesce(f->>'en', '')) = '' then raise exception 'Every question needs its English words.'; end if;
    if length(f->>'en') > 60 or length(coalesce(f->>'fr', '')) > 60 then raise exception 'Keep a question under 60 characters: %', left(f->>'en', 30); end if;
    if jsonb_typeof(f->'o') <> 'array' or jsonb_array_length(f->'o') < 1 or jsonb_array_length(f->'o') > 8 then raise exception '"%" needs between 1 and 8 choices.', f->>'en'; end if;
    vals := '{}'; v_o := '[]'::jsonb;
    for o in select value from jsonb_array_elements(f->'o') loop
      v := lower(btrim(coalesce(o->>'v', '')));
      if v !~ '^[a-z][a-z0-9_]{0,23}$' then raise exception 'A choice under "%" is missing its short name.', f->>'en'; end if;
      if v = any (vals) then raise exception 'Two choices under "%" share a short name.', f->>'en'; end if;
      vals := vals || v;
      if btrim(coalesce(o->>'en', '')) = '' or length(o->>'en') > 40 or length(coalesce(o->>'fr', '')) > 40 then raise exception 'Every choice under "%" needs English words, under 40 characters.', f->>'en'; end if;
      v_o := v_o || jsonb_build_object('v', v, 'en', btrim(o->>'en'), 'fr', nullif(btrim(coalesce(o->>'fr', '')), ''), 'active', coalesce((o->>'active')::boolean, true));
    end loop;
    if core ? k then
      if (select array_agg(x order by x) from unnest(vals) x) is distinct from (select array_agg(x order by x) from jsonb_array_elements_text(core->k) x) then
        raise exception 'The choices of "%" feed the dashboard and past reports: their words can change, the list cannot.', f->>'en';
      end if;
    end if;
    v_out := v_out || jsonb_build_object('k', k, 'core', core ? k, 'active', case when core ? k then true else coalesce((f->>'active')::boolean, true) end,
      'm', case when core ? k then false else coalesce((f->>'m')::boolean, false) end, 'en', btrim(f->>'en'), 'fr', nullif(btrim(coalesce(f->>'fr', '')), ''), 'o', v_o);
    n := n + 1;
  end loop;
  for k in select jsonb_object_keys(core) loop
    if not (k = any (keys)) then raise exception 'Age, sex, Indigenous and meal stay on the form: the dashboard and funders'' reports are built on them.'; end if;
  end loop;
  update public.pb_forms set def = jsonb_build_object('fields', v_out), updated_at = now(), updated_by = v_who where key = p_key;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('pb_forms', p_key, 'def', left(old::text, 300), n || ' questions', v_who);
  return public.pb_form_get(p_key);
end $f$;
revoke all on function public.pb_form_save(text, jsonb) from public, anon;
grant execute on function public.pb_form_save(text, jsonb) to authenticated, service_role;

-- who may count at a serving: the person given The count (a community lead, or a server it was lent to) and the team leader;
-- when nobody has been given it, the team leader and every community lead, as before.
create or replace function public.pb_may_count(p_roster bigint) returns boolean language sql stable security definer set search_path to '' as $f$
  select case when lower(coalesce(r.role, '')) = 'team_leader' or coalesce(r.detail->>'cl_job', '') = 'count' then true
              when exists (select 1 from public.event_roster x where x.event_id = r.event_id and coalesce(x.detail->>'cl_job', '') = 'count'
                             and lower(coalesce(x.status, '')) not in ('cancelled', 'unavailable') and coalesce(x.confirm_status, '') <> 'declined') then false
              else lower(coalesce(r.role, '')) in ('community_debrief', 'community_talker') end
  from public.event_roster r where r.id = p_roster
$f$;
revoke all on function public.pb_may_count(bigint) from public, anon, authenticated;
grant execute on function public.pb_may_count(bigint) to service_role;

create or replace function public.volunteer_tally_get(p_token text, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; v_n int; v_mine int;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, lower(coalesce(er.role, '')) as role, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, e.start_time, e.location into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or not coalesce(public.pb_may_count(r.id), false) then return null; end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return null; end if;
  select count(*), count(*) filter (where roster_id = r.id) into v_n, v_mine from public.pb_tally where event_id = r.event_id;
  return jsonb_build_object('open', public.wa298_tally_open(r.event_date, r.start_time), 'preview', coalesce(p_preview, false),
    'day', r.event_date, 'start', coalesce(r.start_time, '12:00'::time), 'count', v_n, 'mine', v_mine, 'city', public.wa298_city(r.location),
    'form', public.pb_form_public('count'));   -- wave347: the questions, as the Program Builder has them
end $function$;

create or replace function public.volunteer_tally_add(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; x jsonb; v_added int := 0; v_n int; v_id bigint; v_form jsonb; f jsonb; v_ex jsonb; v_k text; v_ok text[];
begin
  if p_token is null or length(p_token) < 12 or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 60 then
    return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  select er.id, lower(coalesce(er.role, '')) as role, er.person_name, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, e.start_time, e.location into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or not coalesce(public.pb_may_count(r.id), false) then return jsonb_build_object('ok', false); end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return jsonb_build_object('ok', false, 'reason', 'not_on_it'); end if;
  if not public.wa298_tally_open(r.event_date, r.start_time) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  v_form := public.pb_form_public('count');
  for x in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(x) <> 'object' then continue; end if;
    if coalesce(x->>'cid', '') !~ '^[A-Za-z0-9_-]{4,40}$' then continue; end if;
    if coalesce(x->>'undo', '') = '1' then
      delete from public.pb_tally where roster_id = r.id and client_id = x->>'cid';
      continue;
    end if;
    if coalesce(x->>'age', 'unknown') not in ('child', 'youth', 'adult', 'senior', 'unknown')
       or coalesce(x->>'sex', 'unknown') not in ('man', 'woman', 'non_binary', 'unknown')
       or coalesce(x->>'bg', 'unknown') not in ('indigenous', 'non_indigenous', 'unknown')
       or coalesce(x->>'meal', 'standard') not in ('standard', 'special') then continue; end if;
    -- wave347: the added questions; anything that is not one of the form's choices is left out
    v_ex := null;
    if jsonb_typeof(x->'ex') = 'object' then
      for f in select value from jsonb_array_elements(coalesce(v_form->'fields', '[]'::jsonb)) loop
        v_k := f->>'k';
        if v_k in ('age', 'sex', 'bg', 'meal') or not (x->'ex') ? v_k then continue; end if;
        select coalesce(array_agg(o->>0), '{}') into v_ok from jsonb_array_elements(f->'o') o;
        if coalesce((f->>'m')::boolean, false) and jsonb_typeof(x->'ex'->v_k) = 'array' then
          v_ex := coalesce(v_ex, '{}'::jsonb) || jsonb_build_object(v_k, (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(x->'ex'->v_k) t where t = any (v_ok)));
        elsif jsonb_typeof(x->'ex'->v_k) = 'string' and (x->'ex'->>v_k) = any (v_ok) then
          v_ex := coalesce(v_ex, '{}'::jsonb) || jsonb_build_object(v_k, x->'ex'->>v_k);
        end if;
      end loop;
    end if;
    insert into public.pb_tally (event_id, served_on, city, age_group, sex, background, meal, source, roster_id, by_name, client_id, extra)
    values (r.event_id, r.event_date, public.wa298_city(r.location), coalesce(x->>'age', 'unknown'), coalesce(x->>'sex', 'unknown'), coalesce(x->>'bg', 'unknown'),
      coalesce(x->>'meal', 'standard'), 'hub', r.id, r.person_name, x->>'cid', v_ex)
    on conflict (roster_id, client_id) where client_id is not null do nothing
    returning id into v_id;
    if v_id is not null then v_added := v_added + 1; v_id := null; end if;
  end loop;
  select count(*) into v_n from public.pb_tally where event_id = r.event_id;
  return jsonb_build_object('ok', true, 'added', v_added, 'count', v_n);
end $function$;

-- the live count for one event (the next Montreal or Toronto serving when none is named), for Program Builder
create or replace function public.pb_count_live(p_event bigint default null) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare e record; v_today date := (now() at time zone 'America/Toronto')::date;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  if p_event is not null then select * into e from public.volunteer_events where id = p_event;
  else select * into e from public.volunteer_events where kind in ('service', 'meal') and status <> 'cancelled' and event_date >= v_today - 1 order by (event_date < v_today), event_date limit 1; end if;
  if e.id is null then return jsonb_build_object('event', null); end if;
  return jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'code', e.code, 'date', e.event_date, 'start', coalesce(e.start_time, '12:00'::time), 'city', public.wa298_city(e.location)),
    'open', public.wa298_tally_open(e.event_date, e.start_time),
    'counters', (select coalesce(jsonb_agg(jsonb_build_object('name', r.person_name, 'role', r.role, 'given', coalesce(r.detail->>'cl_job', '') = 'count') order by (coalesce(r.detail->>'cl_job', '') = 'count') desc, r.role, r.person_name), '[]'::jsonb)
                   from public.event_roster r where r.event_id = e.id and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable') and coalesce(r.confirm_status, '') <> 'declined' and coalesce(public.pb_may_count(r.id), false)),
    'total', (select count(*) from public.pb_tally t where t.event_id = e.id),
    'last_at', (select max(recorded_at) from public.pb_tally t where t.event_id = e.id),
    'by', jsonb_build_object(
      'age', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select age_group k, count(*) n from public.pb_tally where event_id = e.id group by 1) a),
      'sex', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select sex k, count(*) n from public.pb_tally where event_id = e.id group by 1) a),
      'bg', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select background k, count(*) n from public.pb_tally where event_id = e.id group by 1) a),
      'meal', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select meal k, count(*) n from public.pb_tally where event_id = e.id group by 1) a)),
    'extra', (select coalesce(jsonb_object_agg(fk, cnt), '{}'::jsonb) from (
                select fk, jsonb_object_agg(val, n) cnt from (
                  select kv.key fk, v.val, count(*) n from public.pb_tally t, jsonb_each(coalesce(t.extra, '{}'::jsonb)) kv,
                         lateral (select jsonb_array_elements_text(case when jsonb_typeof(kv.value) = 'array' then kv.value else jsonb_build_array(kv.value) end) val) v
                   where t.event_id = e.id group by 1, 2) q group by fk) z),
    'by_counter', (select coalesce(jsonb_object_agg(coalesce(by_name, 'someone'), n), '{}'::jsonb) from (select by_name, count(*) n from public.pb_tally where event_id = e.id group by 1) c));
end $f$;
revoke all on function public.pb_count_live(bigint) from public, anon;
grant execute on function public.pb_count_live(bigint) to authenticated, service_role;
