-- wa191f_past_rosters (01/10/26): who served on 23 August and 6 September, from the operations sheet.
-- The Hub had only copied cook rows marked TBD for WA-26-18 (23/08/26, community kitchen) and WA-26-19 (06/09/26, Enactus
-- partnership), both completed, so nobody counted as having served that day. The operations sheet ("Reoccurring Volunteers
-- 2026", the August and September tabs) has both rosters with their statuses (23/08: 12 confirmed; 06/09: 17 confirmed).
-- Find volunteers (wave191e) groups people by how often and how lately they served, so without these two days someone who
-- served on 6 September would be invited as a regular "we miss". Same rule as wave191c for the upcoming servings: the sheet's
-- roster replaces the copied rows (kept in event_roster_backup_w191), matched by phone, then email, then name; partner
-- organizations marked; logged per serving. Rows staged in wa_stage_sheet191 with j.set = past191f.
-- Someone the sheet has as confirmed (they served) who is not in the Hub's volunteer directory by phone, email or name, and who
-- left a phone or an email, gets a volunteer record (through volunteer_people, so an existing CRM contact with that email is
-- reused): 13 people, most of them from the Enactus partnership on 6 September. Unmatched people who did not serve stay
-- names on the roster only.

do $imp$
declare v_events bigint[]; v_who text := 'the Hub (wave191f, from the operations sheet)'; rec record; v_pid bigint; n_new int := 0;
begin
  select array_agg(id) into v_events from public.volunteer_events where kind = 'service' and code in ('WA-26-18', 'WA-26-19') and status = 'completed';
  if v_events is null or array_length(v_events, 1) <> 2 then raise exception 'expected the two completed servings WA-26-18 and WA-26-19'; end if;
  if (select count(*) from public.wa_stage_sheet191 where j->>'set' = 'past191f') < 40 then raise exception 'the staged rows are missing'; end if;

  insert into public.event_roster_backup_w191 select now(), r.* from public.event_roster r where r.event_id = any (v_events);

  create temp table _s on commit drop as
  select s.id sid, (s.j->>'date')::date d, e.id event_id, s.j->>'role' role, trim(s.j->>'name') sheet_name,
         nullif(s.j->>'phone', '') phone, nullif(lower(s.j->>'email'), '') email,
         coalesce(nullif(trim(s.j->>'status'), ''), 'TBD') status, nullif(trim(s.j->>'note'), '') note, s.j, (s.j->>'row')::int sheet_row,
         null::bigint pid, null::bigint rid, null::bigint new_id
    from public.wa_stage_sheet191 s join public.volunteer_events e on e.event_date = (s.j->>'date')::date and e.kind = 'service' and e.id = any (v_events)
   where s.j->>'set' = 'past191f' and nullif(trim(s.j->>'name'), '') is not null;
  update _s set pid = coalesce(
      (select p.id from public.volunteer_people p where _s.phone is not null and exists (select 1 from unnest(p.phones) x where right(regexp_replace(x, '\D', '', 'g'), 10) = _s.phone) order by p.id limit 1),
      (select p.id from public.volunteer_people p where _s.email is not null and exists (select 1 from unnest(p.emails) x where lower(x) = _s.email) order by p.id limit 1),
      (select p.id from public.volunteer_people p where lower(trim(p.full_name)) = lower(_s.sheet_name) order by p.id limit 1));
  /* people who served and are not in the directory: a volunteer record each (one per person, even on both days) */
  for rec in select * from _s where pid is null and status = 'Confirmed' and (phone is not null or email is not null)
                and sheet_name !~* '(financial|brewery|mission|inc\.?$|partners?hip|corporate)' order by d, sheet_row, sid loop
    v_pid := coalesce(
      (select p.id from public.volunteer_people p where rec.phone is not null and exists (select 1 from unnest(p.phones) x where right(regexp_replace(x, '\D', '', 'g'), 10) = rec.phone) order by p.id limit 1),
      (select p.id from public.volunteer_people p where rec.email is not null and exists (select 1 from unnest(p.emails) x where lower(x) = rec.email) order by p.id limit 1),
      (select p.id from public.volunteer_people p where lower(trim(p.full_name)) = lower(rec.sheet_name) order by p.id limit 1));
    if v_pid is null then
      insert into public.volunteer_people (full_name, emails, phones, roles, joined_note)
      values (rec.sheet_name, case when rec.email is not null then array[rec.email] else '{}' end,
              case when rec.phone is not null then array['(' || substr(rec.phone, 1, 3) || ') ' || substr(rec.phone, 4, 3) || '-' || substr(rec.phone, 7, 4)] else '{}' end,
              array[rec.role], 'Served on ' || to_char(rec.d, 'DD/MM/YY') || ' (the operations sheet, Reoccurring Volunteers 2026; added by wave191f)')
      returning id into v_pid;
      n_new := n_new + 1;
    end if;
    update _s set pid = v_pid where sid = rec.sid;
  end loop;
  analyze _s;

  update _s set rid = (select r.id from public.event_roster r where r.event_id = _s.event_id
        and ((_s.pid is not null and r.person_id = _s.pid) or (_s.phone is not null and right(regexp_replace(coalesce(r.detail->>'phone', ''), '\D', '', 'g'), 10) = _s.phone) or lower(trim(coalesce(r.person_name, ''))) = lower(_s.sheet_name))
        order by r.id limit 1);
  update _s set rid = null where sid in (select sid from (select sid, row_number() over (partition by rid order by sheet_row, sid) k from _s where rid is not null) q where k > 1);

  update public.event_roster r set
      person_id = coalesce(_s.pid, r.person_id),
      person_name = coalesce((select p.full_name from public.volunteer_people p where p.id = coalesce(_s.pid, r.person_id) and nullif(trim(p.full_name), '') is not null and p.full_name <> '(no name)'), _s.sheet_name),
      role = _s.role, status = _s.status, notes = _s.note, sort = _s.sheet_row,
      detail = coalesce(r.detail, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('source', 'sheet', 'phone', _s.phone, 'email', _s.email,
        'address', _s.j->>'address', 'pickup_dropoff', _s.j->>'pickup', 'ingredients_delivered', _s.j->>'ingredients', 'type_of_food', _s.j->>'food', 'pickup_time', _s.j->>'pickup_time',
        'driver_role', case when _s.role = 'driver' and _s.note ~* 'main driver' then 'main' when _s.role = 'driver' and _s.note ~* 'pick[- ]?ups?' then 'pickup' end,
        'partner', case when _s.pid is null and _s.phone is null and (_s.sheet_name ~* '(financial|brewery|mission|inc\.?$|partners?hip|corporate)') then true end))
    from _s where r.id = _s.rid;
  with ins as (
    insert into public.event_roster (event_id, person_id, person_name, role, status, notes, detail, sort)
    select _s.event_id, _s.pid,
           coalesce((select p.full_name from public.volunteer_people p where p.id = _s.pid and nullif(trim(p.full_name), '') is not null and p.full_name <> '(no name)'), _s.sheet_name),
           _s.role, _s.status, _s.note,
           jsonb_strip_nulls(jsonb_build_object('source', 'sheet', 'phone', _s.phone, 'email', _s.email,
             'address', _s.j->>'address', 'pickup_dropoff', _s.j->>'pickup', 'ingredients_delivered', _s.j->>'ingredients', 'type_of_food', _s.j->>'food', 'pickup_time', _s.j->>'pickup_time',
             'driver_role', case when _s.role = 'driver' and _s.note ~* 'main driver' then 'main' when _s.role = 'driver' and _s.note ~* 'pick[- ]?ups?' then 'pickup' end,
             'partner', case when _s.pid is null and _s.phone is null and (_s.sheet_name ~* '(financial|brewery|mission|inc\.?$|partners?hip|corporate)') then true end,
             'sheet_sid', _s.sid)),
           _s.sheet_row
      from _s where _s.rid is null
    returning id, (detail->>'sheet_sid')::bigint sid
  )
  update _s set new_id = ins.id from ins where ins.sid = _s.sid;
  update public.event_roster set detail = detail - 'sheet_sid' where detail ? 'sheet_sid';

  /* the copied rows not in the sheet come off (the backup above holds them); texts pointing at them keep their serving */
  update public.quo_messages m set roster_id = null
   where m.roster_id in (select r.id from public.event_roster r where r.event_id = any (v_events) and r.id not in (select rid from _s where rid is not null) and r.id not in (select new_id from _s where new_id is not null));
  delete from public.event_roster r where r.event_id = any (v_events) and r.id not in (select rid from _s where rid is not null) and r.id not in (select new_id from _s where new_id is not null);

  for rec in select e.id, e.code,
              (select count(*) from _s where _s.event_id = e.id and _s.rid is not null) upd,
              (select count(*) from _s where _s.event_id = e.id and _s.new_id is not null) ins,
              (select count(*) from _s where _s.event_id = e.id and _s.status = 'Confirmed') conf,
              (select count(*) from public.event_roster_backup_w191 b where b.event_id = e.id) - (select count(*) from _s where _s.event_id = e.id and _s.rid is not null) del
           from public.volunteer_events e where e.id = any (v_events) loop
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', rec.id::text, 'roster', rec.del || ' copied rows removed',
            rec.ins || ' added and ' || rec.upd || ' updated from the operations sheet (Reoccurring Volunteers 2026), ' || rec.conf || ' confirmed: who served that day', v_who);
  end loop;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_people', 'wave191f', 'created', null, n_new || ' volunteer records for people the operations sheet has as having served on 23/08/26 or 06/09/26', v_who);
end $imp$;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261001200500', 'wa191f_past_rosters', array[$m$do $imp$
declare v_events bigint[]; v_who text := 'the Hub (wave191f, from the operations sheet)'; rec record; v_pid bigint; n_new int := 0;
begin
  select array_agg(id) into v_events from public.volunteer_events where kind = 'service' and code in ('WA-26-18', 'WA-26-19') and status = 'completed';
  if v_events is null or array_length(v_events, 1) <> 2 then raise exception 'expected the two completed servings WA-26-18 and WA-26-19'; end if;
  if (select count(*) from public.wa_stage_sheet191 where j->>'set' = 'past191f') < 40 then raise exception 'the staged rows are missing'; end if;

  insert into public.event_roster_backup_w191 select now(), r.* from public.event_roster r where r.event_id = any (v_events);

  create temp table _s on commit drop as
  select s.id sid, (s.j->>'date')::date d, e.id event_id, s.j->>'role' role, trim(s.j->>'name') sheet_name,
         nullif(s.j->>'phone', '') phone, nullif(lower(s.j->>'email'), '') email,
         coalesce(nullif(trim(s.j->>'status'), ''), 'TBD') status, nullif(trim(s.j->>'note'), '') note, s.j, (s.j->>'row')::int sheet_row,
         null::bigint pid, null::bigint rid, null::bigint new_id
    from public.wa_stage_sheet191 s join public.volunteer_events e on e.event_date = (s.j->>'date')::date and e.kind = 'service' and e.id = any (v_events)
   where s.j->>'set' = 'past191f' and nullif(trim(s.j->>'name'), '') is not null;
  update _s set pid = coalesce(
      (select p.id from public.volunteer_people p where _s.phone is not null and exists (select 1 from unnest(p.phones) x where right(regexp_replace(x, '\D', '', 'g'), 10) = _s.phone) order by p.id limit 1),
      (select p.id from public.volunteer_people p where _s.email is not null and exists (select 1 from unnest(p.emails) x where lower(x) = _s.email) order by p.id limit 1),
      (select p.id from public.volunteer_people p where lower(trim(p.full_name)) = lower(_s.sheet_name) order by p.id limit 1));
  /* people who served and are not in the directory: a volunteer record each (one per person, even on both days) */
  for rec in select * from _s where pid is null and status = 'Confirmed' and (phone is not null or email is not null)
                and sheet_name !~* '(financial|brewery|mission|inc\.?$|partners?hip|corporate)' order by d, sheet_row, sid loop
    v_pid := coalesce(
      (select p.id from public.volunteer_people p where rec.phone is not null and exists (select 1 from unnest(p.phones) x where right(regexp_replace(x, '\D', '', 'g'), 10) = rec.phone) order by p.id limit 1),
      (select p.id from public.volunteer_people p where rec.email is not null and exists (select 1 from unnest(p.emails) x where lower(x) = rec.email) order by p.id limit 1),
      (select p.id from public.volunteer_people p where lower(trim(p.full_name)) = lower(rec.sheet_name) order by p.id limit 1));
    if v_pid is null then
      insert into public.volunteer_people (full_name, emails, phones, roles, joined_note)
      values (rec.sheet_name, case when rec.email is not null then array[rec.email] else '{}' end,
              case when rec.phone is not null then array['(' || substr(rec.phone, 1, 3) || ') ' || substr(rec.phone, 4, 3) || '-' || substr(rec.phone, 7, 4)] else '{}' end,
              array[rec.role], 'Served on ' || to_char(rec.d, 'DD/MM/YY') || ' (the operations sheet, Reoccurring Volunteers 2026; added by wave191f)')
      returning id into v_pid;
      n_new := n_new + 1;
    end if;
    update _s set pid = v_pid where sid = rec.sid;
  end loop;
  analyze _s;

  update _s set rid = (select r.id from public.event_roster r where r.event_id = _s.event_id
        and ((_s.pid is not null and r.person_id = _s.pid) or (_s.phone is not null and right(regexp_replace(coalesce(r.detail->>'phone', ''), '\D', '', 'g'), 10) = _s.phone) or lower(trim(coalesce(r.person_name, ''))) = lower(_s.sheet_name))
        order by r.id limit 1);
  update _s set rid = null where sid in (select sid from (select sid, row_number() over (partition by rid order by sheet_row, sid) k from _s where rid is not null) q where k > 1);

  update public.event_roster r set
      person_id = coalesce(_s.pid, r.person_id),
      person_name = coalesce((select p.full_name from public.volunteer_people p where p.id = coalesce(_s.pid, r.person_id) and nullif(trim(p.full_name), '') is not null and p.full_name <> '(no name)'), _s.sheet_name),
      role = _s.role, status = _s.status, notes = _s.note, sort = _s.sheet_row,
      detail = coalesce(r.detail, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('source', 'sheet', 'phone', _s.phone, 'email', _s.email,
        'address', _s.j->>'address', 'pickup_dropoff', _s.j->>'pickup', 'ingredients_delivered', _s.j->>'ingredients', 'type_of_food', _s.j->>'food', 'pickup_time', _s.j->>'pickup_time',
        'driver_role', case when _s.role = 'driver' and _s.note ~* 'main driver' then 'main' when _s.role = 'driver' and _s.note ~* 'pick[- ]?ups?' then 'pickup' end,
        'partner', case when _s.pid is null and _s.phone is null and (_s.sheet_name ~* '(financial|brewery|mission|inc\.?$|partners?hip|corporate)') then true end))
    from _s where r.id = _s.rid;
  with ins as (
    insert into public.event_roster (event_id, person_id, person_name, role, status, notes, detail, sort)
    select _s.event_id, _s.pid,
           coalesce((select p.full_name from public.volunteer_people p where p.id = _s.pid and nullif(trim(p.full_name), '') is not null and p.full_name <> '(no name)'), _s.sheet_name),
           _s.role, _s.status, _s.note,
           jsonb_strip_nulls(jsonb_build_object('source', 'sheet', 'phone', _s.phone, 'email', _s.email,
             'address', _s.j->>'address', 'pickup_dropoff', _s.j->>'pickup', 'ingredients_delivered', _s.j->>'ingredients', 'type_of_food', _s.j->>'food', 'pickup_time', _s.j->>'pickup_time',
             'driver_role', case when _s.role = 'driver' and _s.note ~* 'main driver' then 'main' when _s.role = 'driver' and _s.note ~* 'pick[- ]?ups?' then 'pickup' end,
             'partner', case when _s.pid is null and _s.phone is null and (_s.sheet_name ~* '(financial|brewery|mission|inc\.?$|partners?hip|corporate)') then true end,
             'sheet_sid', _s.sid)),
           _s.sheet_row
      from _s where _s.rid is null
    returning id, (detail->>'sheet_sid')::bigint sid
  )
  update _s set new_id = ins.id from ins where ins.sid = _s.sid;
  update public.event_roster set detail = detail - 'sheet_sid' where detail ? 'sheet_sid';

  /* the copied rows not in the sheet come off (the backup above holds them); texts pointing at them keep their serving */
  update public.quo_messages m set roster_id = null
   where m.roster_id in (select r.id from public.event_roster r where r.event_id = any (v_events) and r.id not in (select rid from _s where rid is not null) and r.id not in (select new_id from _s where new_id is not null));
  delete from public.event_roster r where r.event_id = any (v_events) and r.id not in (select rid from _s where rid is not null) and r.id not in (select new_id from _s where new_id is not null);

  for rec in select e.id, e.code,
              (select count(*) from _s where _s.event_id = e.id and _s.rid is not null) upd,
              (select count(*) from _s where _s.event_id = e.id and _s.new_id is not null) ins,
              (select count(*) from _s where _s.event_id = e.id and _s.status = 'Confirmed') conf,
              (select count(*) from public.event_roster_backup_w191 b where b.event_id = e.id) - (select count(*) from _s where _s.event_id = e.id and _s.rid is not null) del
           from public.volunteer_events e where e.id = any (v_events) loop
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', rec.id::text, 'roster', rec.del || ' copied rows removed',
            rec.ins || ' added and ' || rec.upd || ' updated from the operations sheet (Reoccurring Volunteers 2026), ' || rec.conf || ' confirmed: who served that day', v_who);
  end loop;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_people', 'wave191f', 'created', null, n_new || ' volunteer records for people the operations sheet has as having served on 23/08/26 or 06/09/26', v_who);
end $imp$$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
