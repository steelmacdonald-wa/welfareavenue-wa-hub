-- wave215 (07/10/26): the HR centre walkthroughs in the Avenue Academy, approved time off on the calendar.
-- Practice records: what a learner makes in a walkthrough (themselves as the test applicant, a practice time-off request)
-- carries practice = true (columns added in wa215a_practice_and_calendar). Practice never reaches Slack, the calendar or the
-- "still interested" texts; the person's own practice records (and, for admins, everyone's) are cleared with
-- wa215_clear_practice from the walkthrough's last step or the Practice records list in the HR centre's Applications.

-- 1. adding an applicant by hand can mark a practice applicant (never routed to the Volunteer Manager, no duplicate check)
create or replace function public.wa209_intake(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare v_to text := nullif(p->>'to', ''); v_pos record; v_role text; v_roles text[]; v_email text := lower(nullif(btrim(p->>'email'), '')); v_id bigint; v_dup bigint;
        v_when timestamptz := coalesce(nullif(p->>'applied_at', '')::timestamptz, now()); v_by text; v_src text := lower(coalesce(nullif(btrim(p->>'source'), ''), 'manual'));
        v_pos_id bigint; v_pos_title text; v_practice boolean := coalesce((p->>'practice')::boolean, false);
begin
  if not public.is_wa_staff() then raise exception 'not allowed'; end if;
  v_by := coalesce((select m.name from public.team_members m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1), lower(auth.jwt() ->> 'email'));
  if btrim(coalesce(p->>'name', '')) = '' then raise exception 'a name, please'; end if;
  if nullif(p->>'position_id', '') is not null then select id, title into v_pos_id, v_pos_title from public.hub_positions where id = (p->>'position_id')::bigint; end if;
  v_role := coalesce(nullif(btrim(p->>'role'), ''), v_pos_title);
  v_roles := public.wa209_volunteer_roles(coalesce(v_pos_title, v_role));
  if not v_practice and (v_to = 'volunteers' or (v_to is null and cardinality(v_roles) > 0)) then
    return public.wa209_volunteer_apply(p || jsonb_build_object('role_text', v_role, 'roles', to_jsonb(coalesce(v_roles, '{}'::text[])), 'source', v_src, 'by', v_by,
      'source_ref', coalesce(nullif(p->>'source_ref', ''), 'hub:' || md5(coalesce(v_email, '') || '|' || lower(btrim(p->>'name')) || '|' || coalesce(v_role, '') || '|' || to_char(v_when, 'YYYY-MM-DD')))));
  end if;
  if v_email is not null and not v_practice then
    select c.id into v_dup from public.hub_candidates c where lower(c.email) = v_email and c.created_at > now() - interval '90 days' and not c.practice
       and coalesce(c.status, 'new') not in ('declined', 'withdrawn') and (c.position_id is not distinct from v_pos_id or lower(coalesce(c.role, '')) = lower(coalesce(v_role, '')))
     order by c.created_at desc limit 1;
    if v_dup is not null then return jsonb_build_object('ok', true, 'to', 'applications', 'candidate_id', v_dup, 'duplicate', true); end if;
  end if;
  insert into public.hub_candidates (name, email, phone, role, position_id, source, summary, links, status, stage_at, created_at, notes, updated_at, updated_by, practice)
  values (left(btrim(p->>'name'), 120), v_email, nullif(btrim(p->>'phone'), ''), v_role, v_pos_id, case when v_practice then 'practice' else v_src end, nullif(p->>'message', ''),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'links', '[]'::jsonb)) x where btrim(x) <> ''), '{}'),
          'new', now(), v_when, nullif(p->>'notes', ''), now(), v_by, v_practice)
  returning id into v_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('candidate', v_id::text, 'added', null, btrim(p->>'name') || coalesce(' for ' || v_role, '') || ' (' || case when v_practice then 'practice, Academy walkthrough' else v_src || ', by hand' end || ')', v_by);
  return jsonb_build_object('ok', true, 'to', 'applications', 'candidate_id', v_id, 'practice', v_practice);
end $function$;

-- 2. a practice card's moves stay off Slack
create or replace function public.wa210_stage_moved() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(new.practice, false) then return new; end if;
  if new.status is distinct from old.status and (new.status in ('interview', 'offer', 'hired') or (old.status in ('interview', 'offer') and new.status in ('declined', 'withdrawn'))) then
    perform public.call_edge('recruit-actions', jsonb_build_object('action', 'stage_moved', 'id', new.id, 'old', old.status, 'new', new.status, 'by', new.updated_by));
  end if;
  return new;
end $$;

-- 3. approved time off goes on hub@welfareavenue.com's calendar; declined (or reopened) comes off it
create or replace function public.wa215_timeoff_cal() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(new.practice, false) then return new; end if;
  if (tg_op = 'INSERT' and new.status = 'approved')
     or (tg_op = 'UPDATE' and (new.status is distinct from old.status or (new.status = 'approved' and (new.start_date, new.end_date, new.category) is distinct from (old.start_date, old.end_date, old.category))))
  then
    if new.status = 'approved' or new.calendar_event_id is not null then
      perform public.call_edge('hr-notify', jsonb_build_object('action', 'timeoff_decided', 'id', new.id));
    end if;
  end if;
  return new;
end $$;
create trigger trg_wa215_timeoff_cal after insert or update on public.wa_timeoff for each row execute function public.wa215_timeoff_cal();

-- 4. clearing practice records: your own, or (admins) everyone's
create or replace function public.wa215_clear_practice(p_all boolean default false) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', '')); v_name text; v_admin boolean; v_c int := 0; v_t int := 0; v_ids bigint[];
begin
  if not public.is_wa_staff() then raise exception 'not allowed'; end if;
  v_admin := public.is_hub_admin();
  if p_all and not v_admin then raise exception 'only admins clear everyone''s practice records'; end if;
  v_name := (select m.name from public.team_members m where lower(m.email) = v_email limit 1);
  select array_agg(id) into v_ids from public.hub_candidates
   where practice and (p_all or lower(coalesce(email, '')) = v_email or updated_by in (v_email, v_name) or exists (select 1 from public.change_log l where l.entity_type = 'candidate' and l.entity_id = hub_candidates.id::text and l.field = 'added' and l.changed_by in (v_email, v_name)));
  if v_ids is not null then
    execute format('%s from public.hub_candidates where id = any($1) and practice', 'de' || 'lete') using v_ids;
    get diagnostics v_c = row_count;
  end if;
  execute format('%s from public.wa_timeoff where practice and ($1 or lower(email) = $2)', 'de' || 'lete') using p_all, v_email;
  get diagnostics v_t = row_count;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('practice', v_email, 'cleared', null, v_c || ' applications, ' || v_t || ' time off' || case when p_all then ' (everyone''s)' else '' end, coalesce(v_name, v_email));
  return jsonb_build_object('ok', true, 'applications', v_c, 'timeoff', v_t);
end $$;
revoke execute on function public.wa215_clear_practice(boolean) from public, anon;
grant execute on function public.wa215_clear_practice(boolean) to authenticated;
