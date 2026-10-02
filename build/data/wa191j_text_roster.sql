-- wa191j_text_roster (01/10/26): put someone on a serving straight from their conversation.
-- The team still invites people from the Quo app too. When one of them answers "yess I'll be there!", the Hub cannot tie
-- that YES to a roster row (it only knows the invitations it sent), so the text waits and someone has to open the serving,
-- find or create the person and set them Confirmed. Now a conversation shows the next three servings with this person's
-- place on each: Coming, Can't make it, or Add as coming. A number the directory does not know gets a volunteer record
-- (linked to its CRM contact when the CRM knows the number, otherwise with the name typed). Their open texts then count as
-- handled (confirmed or declined, as a YES or NO by text would), so the conversation stops waiting. Staff, as on the roster
-- board; logged in change_log; the serving's steps tick themselves. No text is sent: a thank-you is the person's to write.

/* ---------- 1. the thread knows their servings ---------- */
create or replace function public.wa191_recruit_thread(p_phone text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_ph text := public.wa171_digits(p_phone); v jsonb; v_pid bigint; v_cn text; v_role text; v_srv jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph) order by vp.id limit 1;
  if v_pid is null then
    select cc.full_name into v_cn from public.crm_contacts cc where cc.merged_into is null and exists (select 1 from unnest(cc.phones) y where public.wa171_digits(y) = v_ph) order by cc.id limit 1;
  else
    select r.role into v_role from public.event_roster r join public.volunteer_events e on e.id = r.event_id
     where r.person_id = v_pid and r.role is not null and lower(coalesce(r.status, '')) = 'confirmed'
     group by r.role order by count(*) desc, max(e.event_date) desc limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('e', e.id, 'code', e.code, 'd', e.event_date, 't', nullif(btrim(coalesce(e.title, '')), ''),
           'row', (select jsonb_build_object('id', r.id, 'role', r.role, 'st', r.status, 'cs', r.confirm_status) from public.event_roster r
                    where v_pid is not null and r.event_id = e.id and r.person_id = v_pid and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1)))
           order by e.event_date, e.id), '[]'::jsonb)
    into v_srv
    from (select e2.* from public.volunteer_events e2 where e2.kind = 'service' and coalesce(e2.status, '') not in ('cancelled', 'completed')
            and e2.event_date >= (now() at time zone 'America/Toronto')::date order by e2.event_date, e2.id limit 3) e;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', q.id, 'dir', q.direction, 'kind', q.kind, 'st', q.status, 'body', q.body, 'at', q.created_at, 'sent', q.sent_at,
           'h', q.handled, 'by', case when q.direction = 'out' and q.sent_by not in ('automation', 'quo-events', 'system') then q.sent_by end, 'qid', q.quo_id, 'err', left(q.error, 160),
           'ev', (select e.code from public.volunteer_events e where e.id = q.event_id))) order by q.created_at, q.id), '[]'::jsonb)
    into v
    from (select * from public.quo_messages q2 where right(regexp_replace(q2.phone, '\D', '', 'g'), 10) = v_ph and q2.status <> 'dry_run' and q2.kind <> 'confirm_test'
          order by q2.created_at desc, q2.id desc limit 150) q;
  return jsonb_build_object('ph', v_ph, 'p', v_pid,
    'n', (select vp.full_name from public.volunteer_people vp where vp.id = v_pid), 'cn', v_cn, 'role', v_role, 'servings', v_srv,
    'out', public.wa171_opted_out(v_pid, v_ph), 'window_open', public.wa191_sms_window(), 'messages', v);
end $$;
comment on function public.wa191_recruit_thread(text) is 'wave191e/191j: one number''s texts with the ops line as the Hub has them (the last 150, oldest first), the person (or the CRM name when only the CRM knows the number), their usual role, the next three servings with their place on each (servings), whether they stopped texts and whether a reply would go now. Staff only. quo-send thread adds what was typed in the Quo app.';
revoke all on function public.wa191_recruit_thread(text) from public, anon;
grant execute on function public.wa191_recruit_thread(text) to authenticated;

/* ---------- 2. their place on a serving, from the conversation ---------- */
create or replace function public.wa191_text_roster(p_phone text, p_event bigint, p_status text, p_name text default null, p_role text default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_ph text := public.wa171_digits(p_phone); v_pid bigint; v_cid bigint; v_name text; v_role text; v_ev record; v_rid bigint; v_old text;
  v_who text := coalesce(auth.jwt()->>'email', 'staff'); v_new_person boolean := false; v_added boolean := false; v_n int := 0;
  v_cs text := case p_status when 'Confirmed' then 'confirmed' when 'Unavailable' then 'declined' end;
  v_phf text;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  if p_status is null or p_status not in ('Confirmed', 'Unavailable', 'Waiting For Response') then raise exception 'Coming, can''t make it, or waiting?'; end if;
  v_phf := '(' || substr(v_ph, 1, 3) || ') ' || substr(v_ph, 4, 3) || '-' || substr(v_ph, 7, 4);
  select e.id, e.code, e.event_date into v_ev from public.volunteer_events e
   where e.id = p_event and e.kind = 'service' and coalesce(e.status, '') not in ('cancelled', 'completed');
  if v_ev.id is null then raise exception 'That serving is not open.'; end if;

  -- who: the volunteer with this number; else the CRM contact with it (a volunteer record linked to it); else the name typed
  select vp.id, vp.full_name into v_pid, v_name from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph) order by vp.id limit 1;
  if v_pid is null then
    select cc.id, nullif(btrim(coalesce(cc.full_name, '')), '') into v_cid, v_name from public.crm_contacts cc
     where cc.merged_into is null and exists (select 1 from unnest(cc.phones) y where public.wa171_digits(y) = v_ph) order by cc.id limit 1;
    if v_cid is not null then
      select cc.volunteer_id into v_pid from public.crm_contacts cc where cc.id = v_cid;
      if v_pid is null then
        v_pid := nextval('public.volunteer_people_id_seq');
        insert into public.volunteer_profiles (id, roles, needs_review, created_at, joined_note)
        values (v_pid, '{}', false, now(), 'Added from Conversations (wave191j) by ' || v_who);
        update public.crm_contacts set volunteer_id = v_pid, kinds = case when 'volunteer' = any (kinds) then kinds else kinds || array['volunteer'] end, updated_by = v_who, updated_at = now()
         where id = v_cid and volunteer_id is null;
        v_new_person := true;
      end if;
      v_name := coalesce(v_name, nullif(btrim(coalesce(p_name, '')), ''), '(no name)');
    else
      v_name := nullif(btrim(coalesce(p_name, '')), '');
      if v_name is null or length(v_name) < 2 then raise exception 'Type their name first: this number is not in the directory yet.'; end if;
      if length(v_name) > 80 then raise exception 'Keep the name under 80 characters.'; end if;
      insert into public.volunteer_people (full_name, emails, phones, roles, joined_note)
      values (v_name, '{}', array[v_phf], array[coalesce(nullif(p_role, ''), 'server')],
              'Texted the ops line; added from Conversations on ' || to_char(now() at time zone 'America/Toronto', 'DD/MM/YY') || ' by ' || v_who || ' (wave191j)')
      returning id into v_pid;
      v_new_person := true;
    end if;
  end if;

  -- their row on the serving
  select r.id, r.status into v_rid, v_old from public.event_roster r
   where r.event_id = v_ev.id and r.person_id = v_pid and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1;
  if v_rid is null then
    v_role := lower(coalesce(nullif(p_role, ''),
      (select r.role from public.event_roster r join public.volunteer_events e on e.id = r.event_id
        where r.person_id = v_pid and r.role is not null and lower(coalesce(r.status, '')) = 'confirmed'
        group by r.role order by count(*) desc, max(e.event_date) desc limit 1), 'server'));
    if not exists (select 1 from public.volunteer_role_guides g where g.role = v_role) then v_role := 'server'; end if;
    insert into public.event_roster (event_id, person_id, person_name, role, status, confirm_status, confirmed_at, confirm, detail, sort)
    values (v_ev.id, v_pid, v_name, v_role, p_status, v_cs, case when v_cs is not null then now() end,
            case when v_cs is not null then jsonb_build_object('attending', case when v_cs = 'confirmed' then 'yes' else 'no' end, 'via', 'staff', 'by', v_who, 'at', now()) end,
            jsonb_build_object('source', 'text', 'by', v_who, 'at', now(), 'phone', v_phf), 900)
    returning id into v_rid;
    v_added := true;
  else
    update public.event_roster
       set status = p_status, confirm_status = v_cs, confirmed_at = case when v_cs is not null then now() end,
           confirm = case when v_cs is not null then coalesce(confirm, '{}'::jsonb) || jsonb_build_object('attending', case when v_cs = 'confirmed' then 'yes' else 'no' end, 'via', 'staff', 'by', v_who, 'at', now()) else confirm end
     where id = v_rid;
  end if;

  -- the number's texts belong to this person now; a yes or a no handles their open texts
  update public.quo_messages set person_id = v_pid where person_id is null and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_ph;
  if v_cs is not null then
    update public.quo_messages set handled = v_cs
     where direction = 'in' and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_ph
       and coalesce(handled, '') not in ('confirmed', 'declined', 'opted_out', 'opted_in', 'duplicate', 'ignored', 'answered', 'done');
    get diagnostics v_n = row_count;
  end if;

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', v_rid::text, case when v_added then 'added' else 'status' end, case when v_added then null else v_old end,
          v_name || ': ' || p_status || ' on ' || v_ev.code || ' (from Conversations' || case when v_new_person then '; new volunteer record' else '' end || ')', v_who);
  perform public.wa191_autotick(v_ev.id);
  return jsonb_build_object('ok', true, 'person', v_pid, 'name', v_name, 'row', v_rid, 'added', v_added, 'new_person', v_new_person, 'texts', v_n,
    'code', v_ev.code, 'date', v_ev.event_date, 'status', p_status);
end $$;
comment on function public.wa191_text_roster(text, bigint, text, text, text) is 'wave191j: from a conversation, the person behind p_phone is Confirmed, Unavailable or Waiting For Response on the open serving p_event: their row is updated or added (their usual role, or p_role, else server), with confirm_status and confirm.via staff as a YES or NO would set them. A number the directory does not know gets a volunteer record (linked to the CRM contact with that number, else named p_name). Their texts get the person; a yes or a no marks their open texts confirmed or declined. Staff; logged; autotick. Sends nothing.';
revoke all on function public.wa191_text_roster(text, bigint, text, text, text) from public, anon;
grant execute on function public.wa191_text_roster(text, bigint, text, text, text) to authenticated;
