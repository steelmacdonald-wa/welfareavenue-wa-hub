-- wave262a: confirm_due_check reads the list once per call (Ian's failed save). Applied first, on its own: the live page benefits at once.
create or replace function public.confirm_due_check(p jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare v_item jsonb; v_id bigint; v_due date; v_old date; v_n int := 0; v_email text; v_name text; v_dept text; v_me_id bigint;
        v_act text; v_row public.dept_tasks%rowtype; v_skip jsonb := '[]'::jsonb; v_today date; v_lead text; v_lead_id bigint; v_new_owner text; v_member bigint;
        v_list bigint[];
begin
  v_today := (now() at time zone 'America/Toronto')::date;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select m.id, m.name, m.department into v_me_id, v_name, v_dept from public.team_members m where lower(m.email) = v_email and m.active limit 1;
  if v_name is null then raise exception 'not on the team roster'; end if;
  /* wave262: the person's list, read once (it was read once per task: 50 tasks ran past the 8 s timeout) */
  select coalesce(array_agg(c.task_id), '{}'::bigint[]) into v_list from public.wa237_due_check() c;
  for v_item in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::bigint;
    if v_id is null then continue; end if;
    v_act := coalesce(nullif(v_item ->> 'action', ''), case when coalesce(v_item ->> 'done', '') = 'true' then 'done' else 'date' end);
    begin
      if not (v_id = any (v_list)) then
        v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'not on your list any more'); continue;
      end if;
      select * into v_row from public.dept_tasks where id = v_id;
      /* wave237: "this is my task" */
      if coalesce(v_item ->> 'mine', '') = 'true' and v_row.owner_unsure then
        update public.dept_tasks set owner_unsure = false, updated_at = now(), updated_by = v_name where id = v_id;
        insert into public.task_assignees (task_id, member_id) values (v_id, v_me_id) on conflict do nothing;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_task', v_id::text, 'owner', v_row.owner, coalesce(v_row.owner, '') || ' (confirmed as theirs in the due-date check)', v_name);
        v_n := v_n + 1;
        if v_act = 'mine' then continue; end if;
      end if;
      if v_act = 'done' then
        update public.dept_tasks set done = true, updated_at = now(), updated_by = v_name where id = v_id and done = false;
        if found then
          v_n := v_n + 1;
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('dept_task', v_id::text, 'done', 'false', 'true (marked done in the due-date check)', v_name);
        end if;
      elsif v_act = 'bank' then
        if coalesce(v_item ->> 'until', '') !~ '^\d{4}-\d{2}-\d{2}$' or (v_item ->> 'until')::date <= v_today then
          v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'the bank needs a day in the future'); continue;
        end if;
        perform public.bank_task(v_id, (v_item ->> 'until')::date, 'Put in the bank from the due-date check');
        v_n := v_n + 1;
      elsif v_act = 'discard' then
        /* wave237: a discarded task closes with the status "Discarded" (nothing is removed; the change log keeps the row as it was) */
        update public.dept_tasks set done = true, status = 'Discarded', closed_at = now(), updated_at = now(), updated_by = v_name where id = v_id and done = false;
        if found then
          v_n := v_n + 1;
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('dept_task', v_id::text, 'discarded', to_jsonb(v_row)::text, 'discarded in the due-date check: ' || coalesce(v_row.title, ''), v_name);
        end if;
      elsif v_act = 'notmine' then
        /* wave237: "this is someone else's task": it goes to the team's lead to re-home, still marked unsure */
        select m.id, m.name into v_lead_id, v_lead from public.team_members m
          where m.active and m.department = v_row.department and m.id <> v_me_id
            and (coalesce(m.role, '') ~* 'director' or exists (select 1 from public.hub_roles r where r.email = lower(m.email) and r.role in ('admin', 'leader')))
          order by case when coalesce(m.role, '') ~* 'director' then 0 else 1 end, m.name limit 1;
        update public.dept_tasks set owner = coalesce(v_lead, (select dm.label from public.dept_meta dm where dm.department = v_row.department), v_row.department), owner_unsure = true, updated_at = now(), updated_by = v_name where id = v_id and done = false;
        if v_lead_id is not null and not exists (select 1 from public.task_assignees a where a.task_id = v_id and a.member_id = v_lead_id) then
          update public.task_assignees set member_id = v_lead_id where task_id = v_id and member_id = v_me_id;
        end if;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_task', v_id::text, 'owner', v_row.owner, coalesce(v_lead, 'the team') || ' (' || v_name || ' said it is not theirs, in the due-date check)', v_name);
        v_n := v_n + 1;
      elsif v_act = 'assign' then
        /* wave237: the lead names the owner (someone on the roster) */
        v_new_owner := nullif(trim(coalesce(v_item ->> 'owner', '')), '');
        select m.id, m.name into v_member, v_new_owner from public.team_members m where m.active and lower(m.name) = lower(v_new_owner) limit 1;
        if v_member is null then v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'pick someone on the roster'); continue; end if;
        update public.dept_tasks set owner = v_new_owner, owner_unsure = false, updated_at = now(), updated_by = v_name where id = v_id and done = false;
        if not exists (select 1 from public.task_assignees a where a.task_id = v_id and a.member_id = v_member) then
          update public.task_assignees set member_id = v_member where ctid = (select a.ctid from public.task_assignees a where a.task_id = v_id limit 1);
          if not found then insert into public.task_assignees (task_id, member_id) values (v_id, v_member); end if;
        end if;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_task', v_id::text, 'owner', v_row.owner, v_new_owner || ' (assigned by ' || v_name || ' in the due-date check)', v_name);
        v_n := v_n + 1;
        if coalesce(v_item ->> 'due', '') ~ '^\d{4}-\d{2}-\d{2}$' and (v_item ->> 'due')::date between v_today - 1 and v_today + 400 then
          update public.dept_tasks set due_date = (v_item ->> 'due')::date, updated_at = now() where id = v_id and done = false;
        end if;
      else
        if coalesce(v_item ->> 'due', '') !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
        v_due := (v_item ->> 'due')::date;
        if v_due < v_today - 1 or v_due > v_today + 400 then
          v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'that date is out of range'); continue;
        end if;
        v_old := v_row.due_date;
        update public.dept_tasks set due_date = v_due, due_confirmed_at = now(), due_confirmed_by = v_email,
               updated_at = now(), updated_by = v_name
          where id = v_id and done = false;
        if found then
          v_n := v_n + 1;
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('dept_task', v_id::text, 'due_date', v_old::text,
                  v_due::text || case when v_old is not distinct from v_due then ' (confirmed)' else ' (set in the due-date check)' end, v_name);
        end if;
      end if;
    exception when others then
      v_skip := v_skip || jsonb_build_object('id', v_id, 'why', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('saved', v_n, 'skipped', v_skip);
end $function$;

comment on function public.confirm_due_check(jsonb) is 'wave213c, wave237, wave262: saves what a person chose in the due-date check: a date, done, to the bank, discard (closes the task with the status Discarded), mine (clears owner_unsure), not mine (the task goes to the team''s lead, still unsure) and, for a lead, assign (names the owner). Their own listed tasks only (the list is read once per call since wave262; the page sends batches of 15); a change_log line each. Access: authenticated.';

revoke execute on function public.confirm_due_check(jsonb) from public, anon, authenticated;
grant execute on function public.confirm_due_check(jsonb) to authenticated;
