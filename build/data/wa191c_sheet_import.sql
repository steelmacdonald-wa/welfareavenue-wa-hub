-- wa191c_sheet_import (01/10/26): the operations sheet's rosters become the Hub's, so ops can work in the Hub.
-- Steel (01/10/26): "this is the sheet I'm trying to move the team away from" (Reoccurring Volunteers 2026, Google Sheets
-- 1x5fVR1Kzah9CQDKhfN4ClxSSnXJaJstaErkhjBfuIYs); asked how the sheet's rosters should come in: "Replace with the sheet's".
-- The Hub's rosters for WA-26-21 to WA-26-27 were a list copied forward (51 rows, 15 people, the same cook "Confirmed" on six
-- dates); the sheet holds who ops is actually working with.
-- Input: public.wa_stage_sheet191 (the sheet's October to December sections, parsed: date, role, name, phone, email, status,
-- notes; for cooks address, pick-up or drop-off, ingredients delivered, type of food, pick-up time). Staff-only, dropped after.
-- 1. A backup of every roster row on those servings, and of the links of the texts that point at them.
-- 2. Each sheet person is matched to their volunteer record (phone, then email, then name). A person already on the serving's
--    roster is updated in place (their confirmation link and texts stay); everyone else is added. Rows carry detail.source
--    'sheet', so the sign-up text (wa172_queue_signups) never goes to them; the 7-day confirmation does, as for anyone.
-- 3. Incoming texts attached to rows that go are re-attached to the sender's row on the same serving, else their next serving.
-- 4. The copied rows not in the sheet come off.
-- 5. As in the sheet: WA-26-27 (27/12/26) is cancelled; WA-26-22 (18/10/26) is the Oberoi Financial partnership.
-- 6. Logged per serving in change_log; the Hub-done steps are re-checked.

create table if not exists public.event_roster_backup_w191 as select now() as taken_at, r.* from public.event_roster r where false;
comment on table public.event_roster_backup_w191 is 'wave191c: the roster rows of WA-26-21 to WA-26-27 as they were before the operations sheet''s rosters replaced them (01/10/26). No policies; for restoring by hand. Candidate for removal once ops is settled in the Hub.';
alter table public.event_roster_backup_w191 enable row level security;
create table if not exists public.quo_relink_backup_w191 (message_id bigint primary key, old_roster_id bigint, old_event_id bigint, taken_at timestamptz default now());
comment on table public.quo_relink_backup_w191 is 'wave191c: the roster and serving links of the texts that pointed at roster rows of WA-26-21 to WA-26-27 before the sheet import re-attached them (01/10/26). No policies.';
alter table public.quo_relink_backup_w191 enable row level security;

create or replace function public.wa172_queue_signups()
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_mode text; v_days int; v_today date; g record; v_lang text; v_first text; v_list text; v_link text; v_body text; n int := 0; v_first_row bigint; v_event bigint;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_today := (now() at time zone 'America/Toronto')::date;
  for g in
    select public.wa171_roster_phone(er.id) as phone, min(er.person_id) as person_id, min(er.person_name) as person_name,
           array_agg(er.id order by e.event_date, er.id) as ids
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date - v_today > v_days
       and er.created_at >= now() - interval '3 days' and er.created_at < now() - interval '10 minutes'
       and er.signup_noticed_at is null and lower(coalesce(er.status, '')) not in ('unavailable', 'cancelled')
       and coalesce(er.detail->>'source', '') <> 'sheet'   -- wave191c: rows brought in from the operations sheet are not new sign-ups
       and public.wa171_roster_phone(er.id) is not null
     group by 1
  loop
    if public.wa171_opted_out(g.person_id, g.phone) then continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(g.phone) then continue; end if;
    v_lang := public.wa171_lang(g.person_id);
    v_first := coalesce(nullif(split_part(trim(coalesce(g.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
    select string_agg(public.wa171_date_words(e.event_date, v_lang) || ' (' || lower(public.wa171_role_label(er.role, v_lang)) || ')', case when v_lang = 'fr' then ', ' else ', ' end order by e.event_date),
           (array_agg(er.id order by e.event_date))[1], (array_agg(e.id order by e.event_date))[1]
      into v_list, v_first_row, v_event
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = any (g.ids);
    v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || (select confirm_token from public.event_roster where id = v_first_row);
    if v_lang = 'fr' then
      v_body := 'Bonjour ' || v_first || ', merci de votre inscription chez Welfare Avenue! Vous êtes sur la liste pour : ' || v_list || '. Voyez vos services et ajoutez-les à votre agenda : ' || v_link || ' . Nous vous texterons 7 jours avant chacun pour confirmer. Répondez ARRET pour ne plus recevoir de textos.';
    else
      v_body := 'Hi ' || v_first || ', thanks for signing up with Welfare Avenue! You''re on the list for: ' || v_list || '. See your servings and add them to your calendar: ' || v_link || ' . We''ll text you 7 days before each one to confirm. Reply STOP to stop texts.';
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), g.person_id, '+1' || g.phone, v_body, 'queued', v_event, 'automation', 'out', 'signup', v_first_row);
    update public.event_roster set signup_noticed_at = now() where id = any (g.ids);
    n := n + 1;
  end loop;
  return jsonb_build_object('queued', n, 'mode', v_mode);
end $function$;
comment on function public.wa172_queue_signups() is 'wave172: the sign-up text (thanks, you are on the list for these servings, with the link) to people added to a roster in the last 3 days for servings more than sms_confirm_days out; test mode: test phones only. wave191c: never to rows brought in from the operations sheet (detail.source sheet).';

do $imp$
declare v_events bigint[]; v_who text := 'the Hub (wave191c, from the operations sheet)'; rec record;
begin
  select array_agg(id) into v_events from public.volunteer_events where kind = 'service' and code between 'WA-26-21' and 'WA-26-27';
  if v_events is null or array_length(v_events, 1) <> 7 then raise exception 'expected the seven servings WA-26-21 to WA-26-27'; end if;
  if (select count(*) from public.wa_stage_sheet191) = 0 then raise exception 'the staged sheet is empty'; end if;

  /* 1. backups */
  insert into public.event_roster_backup_w191 select now(), r.* from public.event_roster r where r.event_id = any (v_events);
  insert into public.quo_relink_backup_w191 (message_id, old_roster_id, old_event_id)
    select m.id, m.roster_id, m.event_id from public.quo_messages m join public.event_roster r on r.id = m.roster_id where r.event_id = any (v_events)
    on conflict (message_id) do nothing;

  /* 2. the sheet's people, matched */
  create temp table _s on commit drop as
  select s.id sid, (s.j->>'date')::date d, e.id event_id, s.j->>'role' role, trim(s.j->>'name') sheet_name,
         nullif(s.j->>'phone', '') phone, nullif(lower(s.j->>'email'), '') email,
         coalesce(nullif(trim(s.j->>'status'), ''), 'TBD') status, nullif(trim(s.j->>'note'), '') note, s.j, (s.j->>'row')::int sheet_row,
         null::bigint pid, null::bigint rid, null::bigint new_id
    from public.wa_stage_sheet191 s join public.volunteer_events e on e.event_date = (s.j->>'date')::date and e.kind = 'service' and e.id = any (v_events)
   where not coalesce((s.j->>'open_slot')::boolean, false) and nullif(trim(s.j->>'name'), '') is not null;
  update _s set pid = coalesce(
      (select p.id from public.volunteer_people p where _s.phone is not null and exists (select 1 from unnest(p.phones) x where right(regexp_replace(x, '\D', '', 'g'), 10) = _s.phone) order by p.id limit 1),
      (select p.id from public.volunteer_people p where _s.email is not null and exists (select 1 from unnest(p.emails) x where lower(x) = _s.email) order by p.id limit 1),
      (select p.id from public.volunteer_people p where lower(trim(p.full_name)) = lower(_s.sheet_name) order by p.id limit 1));
  update _s set rid = (select r.id from public.event_roster r where r.event_id = _s.event_id
        and ((_s.pid is not null and r.person_id = _s.pid) or (_s.phone is not null and right(regexp_replace(coalesce(r.detail->>'phone', ''), '\D', '', 'g'), 10) = _s.phone) or lower(trim(coalesce(r.person_name, ''))) = lower(_s.sheet_name))
        order by r.id limit 1);
  /* one roster row serves one sheet row */
  update _s set rid = null where sid in (select sid from (select sid, row_number() over (partition by rid order by sheet_row, sid) k from _s where rid is not null) q where k > 1);

  /* 3. update the people already on the serving, add the rest */
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

  /* 4. texts pointing at rows that go: re-attached to the sender's row on that serving, else their next serving */
  update public.quo_messages m set
      roster_id = coalesce(
        (select coalesce(_s.rid, _s.new_id) from _s where _s.event_id = m.event_id and _s.phone = right(regexp_replace(m.phone, '\D', '', 'g'), 10) limit 1),
        (select coalesce(_s.rid, _s.new_id) from _s where _s.phone = right(regexp_replace(m.phone, '\D', '', 'g'), 10) and _s.d >= (m.created_at at time zone 'America/Toronto')::date order by _s.d limit 1)),
      event_id = coalesce(
        (select _s.event_id from _s where _s.event_id = m.event_id and _s.phone = right(regexp_replace(m.phone, '\D', '', 'g'), 10) limit 1),
        (select _s.event_id from _s where _s.phone = right(regexp_replace(m.phone, '\D', '', 'g'), 10) and _s.d >= (m.created_at at time zone 'America/Toronto')::date order by _s.d limit 1),
        m.event_id)
   where m.roster_id in (select r.id from public.event_roster r where r.event_id = any (v_events) and r.id not in (select rid from _s where rid is not null) and r.id not in (select new_id from _s where new_id is not null));

  /* 5. the copied rows not in the sheet come off (the backup above holds them) */
  delete from public.event_roster r where r.event_id = any (v_events) and r.id not in (select rid from _s where rid is not null) and r.id not in (select new_id from _s where new_id is not null);

  /* 6. the servings, as in the sheet */
  update public.volunteer_events set status = 'cancelled' where code = 'WA-26-27' and status <> 'cancelled';
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) select 'volunteer_event', id::text, 'status', 'planned', 'cancelled (the operations sheet: December 27th canceled)', v_who from public.volunteer_events where code = 'WA-26-27';
  update public.volunteer_events set title = 'Oberoi Financial partnership' where code = 'WA-26-22' and coalesce(title, '') = '';
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) select 'volunteer_event', id::text, 'title', null, 'Oberoi Financial partnership (the operations sheet)', v_who from public.volunteer_events where code = 'WA-26-22';

  /* 7. the log, per serving */
  for rec in select e.id, e.code,
              (select count(*) from _s where _s.event_id = e.id and _s.rid is not null) upd,
              (select count(*) from _s where _s.event_id = e.id and _s.new_id is not null) ins,
              (select count(*) from public.event_roster_backup_w191 b where b.event_id = e.id) - (select count(*) from _s where _s.event_id = e.id and _s.rid is not null) del
           from public.volunteer_events e where e.id = any (v_events) loop
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', rec.id::text, 'roster', rec.del || ' copied rows removed', rec.ins || ' added and ' || rec.upd || ' updated from the operations sheet (Reoccurring Volunteers 2026)', v_who);
  end loop;
  perform public.wa191_autotick(e) from unnest(v_events) e;
end $imp$;
