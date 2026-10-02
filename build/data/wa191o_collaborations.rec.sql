-- records wa191o_collaborations (applied 02/10/26 as written, without its header comment); this file only records it
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261002005000', 'wa191o_collaborations', array[$m$-- wa191o_collaborations (02/10/26): servings with a partner organization (Oberoi Financial Group, for one).
-- Steel (01/10/26): "sometimes we have collaborators like Oberoi Financial Group that'll work differently in which we need to
-- ask whether their group is bringing the food, how many are there, will there be enough people or do we need to fill in
-- some people (cooks, servers, drivers, photographers, etc), a team leader and community lead on our end always need to be
-- there. Also, are we doing the kitchen model with Desta partnered with us or will they cook in their own space?"
-- Partners' people: "Either headcount and coordinator or each person by name - allow our team to choose"; "I want to give
-- our operations team [the choice] to take the coordinator route or everyone in their org to complete the form so that this
-- way we get more people in to our system."
-- One collaboration per serving (volunteer_event_partners): the partner (wa_partners, or a name), who makes the food (our
-- cooks, they bring it, they cook with us in DESTA's kitchen, they cook in their own space), the route (a coordinator with
-- a headcount per role, or everyone signs up with the form), the roles they cover. Our team leader and community lead are
-- always ours. The Hub counts what they cover toward each role (the gap is what Find volunteers and Plan the roster fill).
-- Cooking in a kitchen (DESTA's or theirs) makes the serving a community kitchen at that address, so the drivers' run picks
-- the food up there. The form route: a link (signup_token) where each person of the partner gives their name, email or
-- phone and their role; they join the volunteer list (one record with the CRM, tagged with the partner) and the serving as
-- Confirmed, with their own page. Staff save (wa191_partner_save); the form is anonymous (the link is the key).

/* ---------- 1. the collaboration of a serving ---------- */
create table if not exists public.volunteer_event_partners (
  event_id bigint primary key references public.volunteer_events(id) on delete cascade,
  active boolean not null default true,
  partner_id bigint references public.wa_partners(id) on delete set null,
  partner_name text not null,
  food text not null default 'ours' check (food in ('ours', 'they_bring', 'desta_kitchen', 'their_kitchen')),
  kitchen_place text,
  route text not null default 'coordinator' check (route in ('coordinator', 'everyone')),
  coordinator_name text,
  coordinator_email text,
  coordinator_phone text,
  headcount int check (headcount is null or headcount between 0 and 500),
  covers jsonb not null default '{}'::jsonb,
  signup_token text unique,
  signup_open boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.volunteer_event_partners enable row level security;
create policy volunteer_event_partners_staff_read on public.volunteer_event_partners for select to authenticated using (public.is_wa_staff());
comment on table public.volunteer_event_partners is 'wave191o: a serving with a partner organization: the partner (wa_partners or partner_name), food (ours: our cooks; they_bring; desta_kitchen: they cook with us in DESTA''s kitchen; their_kitchen: they cook in their own space; a kitchen makes the serving a community kitchen at kitchen_place), route (coordinator: a contact and a headcount; everyone: each person signs up with the form at hub.welfareavenue.com/c/<signup_token>), covers {role: how many of theirs} (never team_leader or community_debrief: always ours), headcount, note. active false: no longer a collaboration. Staff read; wa191_partner_save writes.';

/* ---------- 2. saving it (staff) ---------- */
create or replace function public.wa191_partner_save(p_event bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_ev record; v_who text; v_pid bigint; v_name text; v_food text; v_route text; v_kitchen text; v_cov jsonb := '{}'::jsonb; k text; v jsonb; n int;
  v_email text; v_phone text; v_tok text; v_old record; v_head int; v_active boolean;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  v_who := coalesce(lower(auth.jwt() ->> 'email'), 'staff');
  select e.id, e.code, e.event_date, e.status, e.format, e.kitchen_place into v_ev from public.volunteer_events e where e.id = p_event and e.kind = 'service';
  if v_ev.id is null then raise exception 'No such serving.'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save.'; end if;
  select * into v_old from public.volunteer_event_partners where event_id = p_event;
  v_active := coalesce((p->>'active')::boolean, true);
  if not v_active then
    if v_old.event_id is not null then
      update public.volunteer_event_partners set active = false, updated_at = now(), updated_by = v_who where event_id = p_event;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('volunteer_event_partner', p_event::text, 'active', v_old.partner_name, 'no longer a collaboration', v_who);
    end if;
    return jsonb_build_object('ok', true, 'active', false);
  end if;
  -- the partner
  v_pid := nullif(p->>'partner_id', '')::bigint;
  if v_pid is not null then select w.name into v_name from public.wa_partners w where w.id = v_pid; if v_name is null then raise exception 'That partner is not in the partners list.'; end if; end if;
  v_name := coalesce(nullif(btrim(coalesce(p->>'partner_name', '')), ''), v_name);
  if v_name is null or length(v_name) < 2 then raise exception 'Which organization?'; end if;
  if length(v_name) > 120 then raise exception 'Keep the organization''s name under 120 characters.'; end if;
  -- the food and the kitchen
  v_food := coalesce(nullif(p->>'food', ''), 'ours');
  if v_food not in ('ours', 'they_bring', 'desta_kitchen', 'their_kitchen') then raise exception 'Who makes the food?'; end if;
  v_kitchen := nullif(btrim(coalesce(p->>'kitchen_place', '')), '');
  if v_kitchen is not null and length(v_kitchen) > 200 then raise exception 'Keep the kitchen address under 200 characters.'; end if;
  if v_food = 'their_kitchen' and v_kitchen is null then raise exception 'Where is their kitchen? The drivers'' run picks the food up there.'; end if;
  -- their people
  v_route := coalesce(nullif(p->>'route', ''), 'coordinator');
  if v_route not in ('coordinator', 'everyone') then raise exception 'A coordinator, or everyone signs up?'; end if;
  v_email := lower(nullif(btrim(coalesce(p->>'coordinator_email', '')), ''));
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'The coordinator''s email does not look right.'; end if;
  v_phone := nullif(public.wa171_digits(coalesce(p->>'coordinator_phone', '')), '');
  if v_phone is not null and length(v_phone) <> 10 then raise exception 'The coordinator''s phone needs 10 digits.'; end if;
  if jsonb_typeof(coalesce(p->'covers', '{}'::jsonb)) <> 'object' then raise exception 'Which roles do they cover?'; end if;
  for k, v in select e.key, e.value from jsonb_each(coalesce(p->'covers', '{}'::jsonb)) e loop
    if k not in ('cook', 'server', 'driver', 'photographer', 'dishwasher', 'community_talker') then raise exception 'Our team leader and community lead are always ours (role %).', k; end if;
    begin n := (v #>> '{}')::int; exception when others then raise exception 'How many for %?', k; end;
    if n < 0 or n > 100 then raise exception 'Between 0 and 100 for %.', k; end if;
    if n > 0 then v_cov := v_cov || jsonb_build_object(k, n); end if;
  end loop;
  v_head := nullif(p->>'headcount', '')::int;
  if v_head is not null and (v_head < 0 or v_head > 500) then raise exception 'The headcount is between 0 and 500.'; end if;
  v_tok := v_old.signup_token;
  if v_route = 'everyone' and v_tok is null then v_tok := encode(extensions.gen_random_bytes(12), 'hex'); end if;
  insert into public.volunteer_event_partners as x (event_id, active, partner_id, partner_name, food, kitchen_place, route, coordinator_name, coordinator_email, coordinator_phone, headcount, covers, signup_token, signup_open, note, updated_at, updated_by)
  values (p_event, true, v_pid, v_name, v_food, v_kitchen, v_route, nullif(left(btrim(coalesce(p->>'coordinator_name', '')), 80), ''), v_email,
          case when v_phone is not null then '(' || substr(v_phone, 1, 3) || ') ' || substr(v_phone, 4, 3) || '-' || substr(v_phone, 7, 4) end,
          v_head, v_cov, v_tok, coalesce((p->>'signup_open')::boolean, true), nullif(left(btrim(coalesce(p->>'note', '')), 1000), ''), now(), v_who)
  on conflict (event_id) do update set active = true, partner_id = excluded.partner_id, partner_name = excluded.partner_name, food = excluded.food, kitchen_place = excluded.kitchen_place,
    route = excluded.route, coordinator_name = excluded.coordinator_name, coordinator_email = excluded.coordinator_email, coordinator_phone = excluded.coordinator_phone,
    headcount = excluded.headcount, covers = excluded.covers, signup_token = coalesce(x.signup_token, excluded.signup_token), signup_open = excluded.signup_open,
    note = excluded.note, updated_at = now(), updated_by = v_who;
  -- cooking in a kitchen: the serving is a community kitchen there (the drivers' run picks the food up at that address)
  if v_food in ('desta_kitchen', 'their_kitchen') then
    update public.volunteer_events set format = 'community_kitchen', kitchen_place = coalesce(v_kitchen, kitchen_place) where id = p_event;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_event_partner', p_event::text, case when v_old.event_id is null then 'added' else 'changed' end, v_old.partner_name,
          v_name || ' on ' || coalesce(v_ev.code, p_event::text) || ': food ' || v_food || ', ' || v_route || ', covers ' || v_cov::text, v_who);
  perform public.wa191_autotick(p_event);
  return (select to_jsonb(x) || jsonb_build_object('ok', true) from public.volunteer_event_partners x where x.event_id = p_event);
end $$;
comment on function public.wa191_partner_save(bigint, jsonb) is 'wave191o: staff set a serving''s collaboration: p {active (false: no longer one), partner_id (wa_partners) or partner_name, food ours|they_bring|desta_kitchen|their_kitchen, kitchen_place (needed for their own kitchen), route coordinator|everyone, coordinator_name, coordinator_email, coordinator_phone, headcount, covers {cook, server, driver, photographer, dishwasher, community_talker: 0 to 100} (never the team leader or the community lead), signup_open, note}. The form route gets its link token once. Cooking in a kitchen makes the serving a community kitchen at kitchen_place. Logged; autotick. Sends nothing.';
grant execute on function public.wa191_partner_save(bigint, jsonb) to authenticated;

/* ---------- 3. the partner's form (the link is the key): what it is for ---------- */
create or replace function public.volunteer_partner_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare x record; v_roles jsonb; v_n int;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select vp.event_id, vp.partner_name, vp.covers, vp.signup_open, vp.active, e.event_date, coalesce(e.start_time, '12:00'::time) as start_time, e.location, e.status, e.code
    into x from public.volunteer_event_partners vp join public.volunteer_events e on e.id = vp.event_id where vp.signup_token = p_token and vp.route = 'everyone';
  if not found or not x.active then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('role', k, 'en', public.wa171_role_label(k, 'en'), 'fr', public.wa171_role_label(k, 'fr')) order by array_position(array['server', 'cook', 'driver', 'photographer', 'dishwasher', 'community_talker'], k)), '[]'::jsonb)
    into v_roles from jsonb_object_keys(coalesce(x.covers, '{}'::jsonb)) k;
  if jsonb_array_length(v_roles) = 0 then v_roles := jsonb_build_array(jsonb_build_object('role', 'server', 'en', public.wa171_role_label('server', 'en'), 'fr', public.wa171_role_label('server', 'fr'))); end if;
  select count(*) into v_n from public.event_roster r where r.event_id = x.event_id and r.detail->>'source' = 'partner form' and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable');
  return jsonb_build_object('partner', x.partner_name, 'event_date', x.event_date, 'start', public.wa174_hm(x.start_time), 'location', coalesce(nullif(x.location, ''), 'Montreal'), 'code', x.code,
    'open', x.signup_open and coalesce(x.status, '') not in ('cancelled', 'completed') and x.event_date >= (now() at time zone 'America/Toronto')::date,
    'roles', v_roles, 'joined', v_n);
end $$;
comment on function public.volunteer_partner_get(text) is 'wave191o: the partner form at hub.welfareavenue.com/c/<signup_token>: the partner''s name, the serving (date, start, place), the roles they cover, whether it is open (open, not cancelled, not past) and how many signed up. No personal data. Anonymous.';
grant execute on function public.volunteer_partner_get(text) to anon, authenticated;

/* ---------- 4. a person of the partner signs up: the volunteer list (one record with the CRM) and the serving ---------- */
create or replace function public.volunteer_partner_join(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare x record; v_first text; v_last text; v_name text; v_email text; v_ph text; v_phf text; v_role text; v_pid bigint; v_cid bigint; v_rid bigint; v_tok text; v_lang text; v_new boolean := false; v_added boolean := false; v_key text; v_n int;
begin
  if p_token is null or length(p_token) < 20 or p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('ok', false); end if;
  select vp.event_id, vp.partner_id, vp.partner_name, vp.covers, vp.signup_open, vp.active, e.event_date, e.status, e.code into x
    from public.volunteer_event_partners vp join public.volunteer_events e on e.id = vp.event_id where vp.signup_token = p_token and vp.route = 'everyone';
  if not found or not x.active then return jsonb_build_object('ok', false); end if;
  if not x.signup_open or coalesce(x.status, '') in ('cancelled', 'completed') or x.event_date < (now() at time zone 'America/Toronto')::date then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  v_first := nullif(btrim(coalesce(p->>'first', '')), ''); v_last := nullif(btrim(coalesce(p->>'last', '')), '');
  if v_first is null or length(v_first) > 60 or length(coalesce(v_last, '')) > 60 then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  v_name := btrim(v_first || ' ' || coalesce(v_last, ''));
  v_email := lower(nullif(btrim(coalesce(p->>'email', '')), ''));
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then return jsonb_build_object('ok', false, 'reason', 'email'); end if;
  v_ph := nullif(public.wa171_digits(coalesce(p->>'phone', '')), '');
  if v_ph is not null and length(v_ph) <> 10 then return jsonb_build_object('ok', false, 'reason', 'phone'); end if;
  if v_email is null and v_ph is null then return jsonb_build_object('ok', false, 'reason', 'contact'); end if;
  v_phf := case when v_ph is not null then '(' || substr(v_ph, 1, 3) || ') ' || substr(v_ph, 4, 3) || '-' || substr(v_ph, 7, 4) end;
  v_role := lower(coalesce(nullif(p->>'role', ''), 'server'));
  if not (coalesce(x.covers, '{}'::jsonb) ? v_role) and not (v_role = 'server' and coalesce(x.covers, '{}'::jsonb) = '{}'::jsonb) then return jsonb_build_object('ok', false, 'reason', 'role'); end if;
  v_lang := case when p->>'lang' = 'fr' then 'fr' else 'en' end;
  select count(*) into v_n from public.event_roster r where r.event_id = x.event_id and r.detail->>'source' = 'partner form';
  if v_n >= 200 then return jsonb_build_object('ok', false, 'reason', 'full'); end if;
  v_key := coalesce((select w.key from public.wa_partners w where w.id = x.partner_id), lower(regexp_replace(x.partner_name, '[^A-Za-z0-9]+', '-', 'g')));
  -- who: the volunteer with this email or phone; else the CRM contact (a volunteer record linked to it); else a new record
  select vp.id into v_pid from public.volunteer_people vp
   where (v_email is not null and exists (select 1 from unnest(vp.emails) y where lower(btrim(y)) = v_email))
      or (v_ph is not null and exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph))
   order by vp.id limit 1;
  if v_pid is null then
    select cc.id into v_cid from public.crm_contacts cc where cc.merged_into is null
       and ((v_email is not null and (lower(cc.primary_email) = v_email or exists (select 1 from unnest(cc.emails) y where lower(btrim(y)) = v_email)))
         or (v_ph is not null and exists (select 1 from unnest(cc.phones) y where public.wa171_digits(y) = v_ph)))
     order by cc.id limit 1;
    if v_cid is not null then
      select cc.volunteer_id into v_pid from public.crm_contacts cc where cc.id = v_cid;
      if v_pid is null then
        v_pid := nextval('public.volunteer_people_id_seq');
        insert into public.volunteer_profiles (id, roles, needs_review, created_at, joined_note)
        values (v_pid, array[v_role], false, now(), 'Signed up with ' || x.partner_name || ' for ' || to_char(x.event_date, 'DD/MM/YY') || ' (partner form, wave191o)');
        update public.crm_contacts set volunteer_id = v_pid, kinds = case when 'volunteer' = any (kinds) then kinds else kinds || array['volunteer'] end,
               tags = case when 'partner:' || v_key = any (coalesce(tags, '{}')) then tags else coalesce(tags, '{}') || array['partner:' || v_key] end,
               organization = coalesce(nullif(btrim(coalesce(organization, '')), ''), x.partner_name), updated_by = 'partner form', updated_at = now()
         where id = v_cid and volunteer_id is null;
        v_new := true;
      end if;
    else
      insert into public.volunteer_people (full_name, emails, phones, roles, tags, organization, joined_note)
      values (v_name, case when v_email is not null then array[v_email] else '{}'::text[] end, case when v_phf is not null then array[v_phf] else '{}'::text[] end,
              array[v_role], array['partner:' || v_key], x.partner_name, 'Signed up with ' || x.partner_name || ' for ' || to_char(x.event_date, 'DD/MM/YY') || ' (partner form, wave191o)')
      returning id into v_pid;
      v_new := true;
    end if;
  end if;
  -- their row on the serving (one per person)
  select r.id, r.confirm_token into v_rid, v_tok from public.event_roster r
   where r.event_id = x.event_id and r.person_id = v_pid and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1;
  if v_rid is null then
    insert into public.event_roster (event_id, person_id, person_name, role, status, confirm_status, confirmed_at, confirm, detail, sort)
    values (x.event_id, v_pid, v_name, v_role, 'Confirmed', 'confirmed', now(), jsonb_build_object('attending', 'yes', 'via', 'partner form', 'at', now(), 'lang', v_lang),
            jsonb_build_object('source', 'partner form', 'partner_id', x.partner_id, 'partner_name', x.partner_name, 'phone', v_phf, 'email', v_email), 950)
    returning id, confirm_token into v_rid, v_tok;
    v_added := true;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('event_roster', v_rid::text, 'added', null, v_name || ': Confirmed as ' || v_role || ' on ' || coalesce(x.code, x.event_id::text) || ' (the ' || x.partner_name || ' form' || case when v_new then '; new volunteer record' else '' end || ')', 'partner form');
  end if;
  return jsonb_build_object('ok', true, 'token', v_tok, 'new', v_new, 'already', not v_added);
end $$;
comment on function public.volunteer_partner_join(text, jsonb) is 'wave191o: a person of the partner signs up with the form (the link is the key; open, not cancelled, not past; 200 at most): p {first, last, email and/or phone (10 digits), role (one the partner covers; server when none), lang}. Finds them by email or phone (the volunteer list, then the CRM), else adds a volunteer record (one record with the CRM; organization the partner, tag partner:<key>), then puts them on the serving as Confirmed (confirm.via partner form; detail.source partner form) unless they already are. Returns their own page''s token. Logged. Sends nothing. Anonymous.';
grant execute on function public.volunteer_partner_join(text, jsonb) to anon, authenticated;
$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
