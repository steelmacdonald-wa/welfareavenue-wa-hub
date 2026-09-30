-- wa173_cook_pickup (30/09/26): cooks confirm how their food reaches the serving.
-- Steel (30/09/26): "cooks need to confirm their pick up address and ensure it's in the pick up areas seen on our old website
-- (there should be a list of neighborhoods) or drop off at our serving location. If they drop off they could come serve as
-- well so we'd just need to know that." The areas and the drop-off are the old website's "Please Note" box (the SOP step
-- "Call cooks to Confirm Availability, Pickup or Drop Off", its screenshot): Cooks that don't live in these areas and still
-- want to cook drop off food at 1500 Rue Berri for 12:00 pm.

insert into public.app_config (key, value, updated_at) values
  ('cook_pickup_areas', E'All downtown Montreal districts\nTown of Mount Royal (TMR)\nLe Plateau\nMile End\nOutremont\nWestmount\nLaurier\nSaint-Henri\nParc-Extension\nGriffintown\nMont-Royal\nVilleray\nCôte-des-Neiges\nThe Village\nLittle Italy', now()),
  ('cook_dropoff_place', '1500 Rue Berri, Montréal, QC H2L 2C4', now()),
  ('cook_dropoff_time', '12:00', now())
on conflict (key) do nothing;

update public.volunteer_role_guides set
  expect_en = array['Cook your dish at home before the serving, as agreed with your team leader.', 'Choose the dish you would prefer to cook below, from our recipes, so the meal is balanced.', 'Tell us below how your food reaches us: we pick it up at home if you live in one of our pickup areas, or you drop it off at the serving by noon (and you are welcome to stay and serve).', 'If we pick up: your driver texts you about 10 minutes before; have the food packed and ready at the door.', 'Tell us if you need containers and we will bring some.'],
  expect_fr = array['Préparez votre plat à la maison avant le service, comme convenu avec votre responsable d''équipe.', 'Choisissez ci-dessous le plat que vous préféreriez cuisiner parmi nos recettes, pour un repas équilibré.', 'Dites-nous ci-dessous comment votre plat nous parvient : nous le prenons chez vous si vous habitez un de nos secteurs de collecte, ou vous le déposez au service avant midi (et vous pouvez rester pour servir).', 'Si nous passons le prendre : votre chauffeur vous texte environ 10 minutes avant; ayez-le emballé et prêt à la porte.', 'Dites-nous si vous avez besoin de contenants et nous en apporterons.'],
  arrive_en = 'Pickup: be ready at the time your driver gives you. Drop-off: at 1500 Rue Berri by 12:00 pm.',
  arrive_fr = 'Collecte : soyez prêt ou prête à l''heure que votre chauffeur vous donne. Dépôt : au 1500, rue Berri avant 12 h.',
  updated_at = now(), updated_by = 'wa173'
where role = 'cook';

create or replace function public.wa173_cook_areas()
 returns text[] language sql stable security definer set search_path to '' as $$
  select coalesce(array(select trim(x) from unnest(string_to_array((select value from public.app_config where key = 'cook_pickup_areas'), E'\n')) x where trim(x) <> ''), '{}');
$$;
comment on function public.wa173_cook_areas() is 'wave173: the neighbourhoods where drivers pick up cooks'' food (app_config cook_pickup_areas, one per line; from the old website).';
revoke all on function public.wa173_cook_areas() from public, anon, authenticated;

-- the page's read: the cook's pickup or drop-off, their address on file, the areas and the drop-off
do $$ declare d text; begin
  d := pg_get_functiondef('public.volunteer_confirm_get(text)'::regprocedure);
  d := replace(d, $x$'details', jsonb_build_object('recipe_id', r.recipe_id,$x$,
    $x$'cook_pickup', case when lower(r.role) = 'cook' then jsonb_build_object('areas', to_jsonb(public.wa173_cook_areas()),
        'dropoff_place', (select value from public.app_config where key = 'cook_dropoff_place'), 'dropoff_time', (select value from public.app_config where key = 'cook_dropoff_time')) end,
    'details', jsonb_build_object('recipe_id', r.recipe_id,
      'pickup', case when r.confirm->>'cook_location' = 'home' then 'pickup' when r.confirm->>'cook_location' = 'drop off' then 'dropoff' end,
      'address', case when lower(r.role) = 'cook' then coalesce(r.confirm->>'address', (select nullif(trim(vp.address), '') from public.volunteer_people vp where vp.id = r.person_id)) end,
      'neighbourhood', r.confirm->>'neighbourhood', 'postal_code', r.confirm->>'postal_code', 'stay_to_serve', r.confirm->'stay_to_serve',$x$);
  if position('cook_pickup' in d) = 0 then raise exception 'volunteer_confirm_get was not patched'; end if;
  execute d;
end $$;
comment on function public.volunteer_confirm_get(text) is 'wave31, wave171, wave172, wave173: what the public confirm page (hub.welfareavenue.com/c/<token>) shows for one roster row: first name, role (both languages), date, place, the format, the state (early: more than 7 days away, confirming opens 7 days before; open; confirmed; declined), the role''s ready photo, what to expect and its links, the role''s own details (a cook''s recipe choices and how their food reaches us: pickup from their address in the pickup areas, or drop-off at the serving and whether they stay to serve; a driver''s car on file; a server''s donations), the same person''s other upcoming servings and, after the serving, the survey. Anonymous by design; the unguessable token is the key. Returns the person''s own address only for a cook (to confirm their pickup); never a phone, an email or anyone else''s name.';

-- the page's write: pickup (address, neighbourhood in the areas, postal code) or drop-off (and stay to serve)
do $$ declare d text; begin
  d := pg_get_functiondef('public.volunteer_confirm_details(text, jsonb)'::regprocedure);
  d := replace(d, $x$  if p ? 'donations' then$x$, $x$  if lower(r.role) = 'cook' and p ? 'pickup' then
    if p->>'pickup' = 'pickup' then
      if nullif(trim(coalesce(p->>'address', '')), '') is null then return jsonb_build_object('ok', false, 'reason', 'address'); end if;
      if not (trim(coalesce(p->>'neighbourhood', '')) = any (public.wa173_cook_areas())) then return jsonb_build_object('ok', false, 'reason', 'area'); end if;
      if nullif(trim(coalesce(p->>'postal_code', '')), '') is not null and upper(replace(p->>'postal_code', ' ', '')) !~ '^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$' then return jsonb_build_object('ok', false, 'reason', 'postal'); end if;
      v_add := v_add || jsonb_build_object('cook_location', 'home', 'address', left(trim(p->>'address'), 160), 'neighbourhood', trim(p->>'neighbourhood'),
        'postal_code', nullif(upper(regexp_replace(trim(coalesce(p->>'postal_code', '')), '^([A-Za-z][0-9][A-Za-z]) ?([0-9][A-Za-z][0-9])$', '\1 \2')), ''), 'stay_to_serve', null);
      update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('pickup_dropoff', 'Pick-up', 'address', left(trim(p->>'address'), 160)) where id = r.id;
      if r.person_id is not null then
        update public.volunteer_people set address = left(trim(concat_ws(', ', trim(p->>'address'), nullif(upper(regexp_replace(trim(coalesce(p->>'postal_code', '')), '^([A-Za-z][0-9][A-Za-z]) ?([0-9][A-Za-z][0-9])$', '\1 \2')), ''))), 200) where id = r.person_id;
      end if;
    elsif p->>'pickup' = 'dropoff' then
      v_add := v_add || jsonb_build_object('cook_location', 'drop off', 'stay_to_serve', case when p ? 'stay_to_serve' then to_jsonb(coalesce((p->>'stay_to_serve')::boolean, false)) else null end);
      update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('pickup_dropoff', 'Drop-off') where id = r.id;
    end if;
  end if;
  if p ? 'donations' then$x$);
  if position('wa173_cook_areas' in d) = 0 then raise exception 'volunteer_confirm_details was not patched'; end if;
  execute d;
end $$;
comment on function public.volunteer_confirm_details(text, jsonb) is 'wave172, wave173: the role''s own answers from the confirm page, any time before the serving: a cook''s recipe (event_roster.recipe_id) and how their food reaches us (pickup: a street address and a neighbourhood from app_config cook_pickup_areas, a postal code if given, kept on the volunteer''s record and as confirm.cook_location home, which the event summary''s pickup route reads; drop-off at app_config cook_dropoff_place by cook_dropoff_time, with whether they stay to serve), a server''s donations, a driver''s car type and model (also volunteer_people.car_type), how a photographer will share, a note (all in event_roster.confirm). Anonymous by design; the token is the key; logged.';

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930140000', 'wa173_cook_pickup', array[$m$insert into public.app_config (key, value, updated_at) values
  ('cook_pickup_areas', E'All downtown Montreal districts\nTown of Mount Royal (TMR)\nLe Plateau\nMile End\nOutremont\nWestmount\nLaurier\nSaint-Henri\nParc-Extension\nGriffintown\nMont-Royal\nVilleray\nCôte-des-Neiges\nThe Village\nLittle Italy', now()),
  ('cook_dropoff_place', '1500 Rue Berri, Montréal, QC H2L 2C4', now()),
  ('cook_dropoff_time', '12:00', now())
on conflict (key) do nothing$m$,$m$update public.volunteer_role_guides set
  expect_en = array['Cook your dish at home before the serving, as agreed with your team leader.', 'Choose the dish you would prefer to cook below, from our recipes, so the meal is balanced.', 'Tell us below how your food reaches us: we pick it up at home if you live in one of our pickup areas, or you drop it off at the serving by noon (and you are welcome to stay and serve).', 'If we pick up: your driver texts you about 10 minutes before; have the food packed and ready at the door.', 'Tell us if you need containers and we will bring some.'],
  expect_fr = array['Préparez votre plat à la maison avant le service, comme convenu avec votre responsable d''équipe.', 'Choisissez ci-dessous le plat que vous préféreriez cuisiner parmi nos recettes, pour un repas équilibré.', 'Dites-nous ci-dessous comment votre plat nous parvient : nous le prenons chez vous si vous habitez un de nos secteurs de collecte, ou vous le déposez au service avant midi (et vous pouvez rester pour servir).', 'Si nous passons le prendre : votre chauffeur vous texte environ 10 minutes avant; ayez-le emballé et prêt à la porte.', 'Dites-nous si vous avez besoin de contenants et nous en apporterons.'],
  arrive_en = 'Pickup: be ready at the time your driver gives you. Drop-off: at 1500 Rue Berri by 12:00 pm.',
  arrive_fr = 'Collecte : soyez prêt ou prête à l''heure que votre chauffeur vous donne. Dépôt : au 1500, rue Berri avant 12 h.',
  updated_at = now(), updated_by = 'wa173'
where role = 'cook'$m$,$m$create or replace function public.wa173_cook_areas()
 returns text[] language sql stable security definer set search_path to '' as $$
  select coalesce(array(select trim(x) from unnest(string_to_array((select value from public.app_config where key = 'cook_pickup_areas'), E'\n')) x where trim(x) <> ''), '{}');
$$$m$,$m$comment on function public.wa173_cook_areas() is 'wave173: the neighbourhoods where drivers pick up cooks'' food (app_config cook_pickup_areas, one per line; from the old website).'$m$,$m$revoke all on function public.wa173_cook_areas() from public, anon, authenticated$m$,$m$do $$ declare d text; begin
  d := pg_get_functiondef('public.volunteer_confirm_get(text)'::regprocedure);
  d := replace(d, $x$'details', jsonb_build_object('recipe_id', r.recipe_id,$x$,
    $x$'cook_pickup', case when lower(r.role) = 'cook' then jsonb_build_object('areas', to_jsonb(public.wa173_cook_areas()),
        'dropoff_place', (select value from public.app_config where key = 'cook_dropoff_place'), 'dropoff_time', (select value from public.app_config where key = 'cook_dropoff_time')) end,
    'details', jsonb_build_object('recipe_id', r.recipe_id,
      'pickup', case when r.confirm->>'cook_location' = 'home' then 'pickup' when r.confirm->>'cook_location' = 'drop off' then 'dropoff' end,
      'address', case when lower(r.role) = 'cook' then coalesce(r.confirm->>'address', (select nullif(trim(vp.address), '') from public.volunteer_people vp where vp.id = r.person_id)) end,
      'neighbourhood', r.confirm->>'neighbourhood', 'postal_code', r.confirm->>'postal_code', 'stay_to_serve', r.confirm->'stay_to_serve',$x$);
  if position('cook_pickup' in d) = 0 then raise exception 'volunteer_confirm_get was not patched'; end if;
  execute d;
end $$$m$,$m$comment on function public.volunteer_confirm_get(text) is 'wave31, wave171, wave172, wave173: what the public confirm page (hub.welfareavenue.com/c/<token>) shows for one roster row: first name, role (both languages), date, place, the format, the state (early: more than 7 days away, confirming opens 7 days before; open; confirmed; declined), the role''s ready photo, what to expect and its links, the role''s own details (a cook''s recipe choices and how their food reaches us: pickup from their address in the pickup areas, or drop-off at the serving and whether they stay to serve; a driver''s car on file; a server''s donations), the same person''s other upcoming servings and, after the serving, the survey. Anonymous by design; the unguessable token is the key. Returns the person''s own address only for a cook (to confirm their pickup); never a phone, an email or anyone else''s name.'$m$,$m$do $$ declare d text; begin
  d := pg_get_functiondef('public.volunteer_confirm_details(text, jsonb)'::regprocedure);
  d := replace(d, $x$  if p ? 'donations' then$x$, $x$  if lower(r.role) = 'cook' and p ? 'pickup' then
    if p->>'pickup' = 'pickup' then
      if nullif(trim(coalesce(p->>'address', '')), '') is null then return jsonb_build_object('ok', false, 'reason', 'address'); end if;
      if not (trim(coalesce(p->>'neighbourhood', '')) = any (public.wa173_cook_areas())) then return jsonb_build_object('ok', false, 'reason', 'area'); end if;
      if nullif(trim(coalesce(p->>'postal_code', '')), '') is not null and upper(replace(p->>'postal_code', ' ', '')) !~ '^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$' then return jsonb_build_object('ok', false, 'reason', 'postal'); end if;
      v_add := v_add || jsonb_build_object('cook_location', 'home', 'address', left(trim(p->>'address'), 160), 'neighbourhood', trim(p->>'neighbourhood'),
        'postal_code', nullif(upper(regexp_replace(trim(coalesce(p->>'postal_code', '')), '^([A-Za-z][0-9][A-Za-z]) ?([0-9][A-Za-z][0-9])$', '\1 \2')), ''), 'stay_to_serve', null);
      update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('pickup_dropoff', 'Pick-up', 'address', left(trim(p->>'address'), 160)) where id = r.id;
      if r.person_id is not null then
        update public.volunteer_people set address = left(trim(concat_ws(', ', trim(p->>'address'), nullif(upper(regexp_replace(trim(coalesce(p->>'postal_code', '')), '^([A-Za-z][0-9][A-Za-z]) ?([0-9][A-Za-z][0-9])$', '\1 \2')), ''))), 200) where id = r.person_id;
      end if;
    elsif p->>'pickup' = 'dropoff' then
      v_add := v_add || jsonb_build_object('cook_location', 'drop off', 'stay_to_serve', case when p ? 'stay_to_serve' then to_jsonb(coalesce((p->>'stay_to_serve')::boolean, false)) else null end);
      update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('pickup_dropoff', 'Drop-off') where id = r.id;
    end if;
  end if;
  if p ? 'donations' then$x$);
  if position('wa173_cook_areas' in d) = 0 then raise exception 'volunteer_confirm_details was not patched'; end if;
  execute d;
end $$$m$,$m$comment on function public.volunteer_confirm_details(text, jsonb) is 'wave172, wave173: the role''s own answers from the confirm page, any time before the serving: a cook''s recipe (event_roster.recipe_id) and how their food reaches us (pickup: a street address and a neighbourhood from app_config cook_pickup_areas, a postal code if given, kept on the volunteer''s record and as confirm.cook_location home, which the event summary''s pickup route reads; drop-off at app_config cook_dropoff_place by cook_dropoff_time, with whether they stay to serve), a server''s donations, a driver''s car type and model (also volunteer_people.car_type), how a photographer will share, a note (all in event_roster.confirm). Anonymous by design; the token is the key; logged.'$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
