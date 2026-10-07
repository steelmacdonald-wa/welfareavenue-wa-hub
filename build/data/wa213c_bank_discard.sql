-- wave213c (07/10/26): the due-date check's choices per task. Steel: "members should have the ability to discard a
-- task, complete a task (it's done), or move the task to the task bank". confirm_due_check (new name: changing
-- confirm_due_dates's return type needs a drop) takes, per item:
--   {"id": 12, "due": "2026-10-14"}                  keep it, with this due date (as before)
--   {"id": 12, "action": "done"}  (or "done": true)  done
--   {"id": 12, "action": "bank", "until": "2027-01-05"}  to the task bank until that day (bank_task, as the board does)
--   {"id": 12, "action": "discard"}                  deleted, as the board's Delete does; the whole row is kept in
--                                                    change_log.old_value so it can be put back by hand
-- Each item is its own step: one that fails (a subtask rule, a closed task) is skipped and reported, the rest save.
-- Returns {"saved": n, "skipped": [{"id": .., "why": ..}]}.

create or replace function public.confirm_due_check(p jsonb)
returns jsonb language plpgsql security invoker set search_path to '' as $$
declare v_item jsonb; v_id bigint; v_due date; v_old date; v_n int := 0; v_email text; v_name text;
        v_act text; v_row public.dept_tasks%rowtype; v_skip jsonb := '[]'::jsonb; v_today date;
begin
  v_today := (now() at time zone 'America/Toronto')::date;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select m.name into v_name from public.team_members m where lower(m.email) = v_email and m.active limit 1;
  if v_name is null then raise exception 'not on the team roster'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::bigint;
    if v_id is null then continue; end if;
    v_act := coalesce(nullif(v_item ->> 'action', ''), case when coalesce(v_item ->> 'done', '') = 'true' then 'done' else 'date' end);
    begin
      if not exists (select 1 from public.my_due_date_check() c where c.task_id = v_id) then
        v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'not on your list any more'); continue;
      end if;
      select * into v_row from public.dept_tasks where id = v_id;
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
        delete from public.dept_tasks where id = v_id and done = false;
        if found then
          v_n := v_n + 1;
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('dept_task', v_id::text, 'deleted', to_jsonb(v_row)::text, 'discarded in the due-date check: ' || coalesce(v_row.title, ''), v_name);
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
end $$;
comment on function public.confirm_due_check(jsonb) is 'wave213c (replaces confirm_due_dates, which stays for the older page): saves the due-date check: per task a due date, done, the task bank until a day (bank_task), or discard (deleted; the row kept in change_log). Only the person''s own listed tasks; each item its own step; returns saved and skipped';
grant execute on function public.confirm_due_check(jsonb) to authenticated;
