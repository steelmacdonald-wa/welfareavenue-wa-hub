-- =====================================================================
-- wave242 (15/10/26): the notification centre and the day's task reminders
-- =====================================================================
-- Steel, 14/10/26 marketing meeting: a notification centre where each person chooses, kind by kind, what reaches them in
-- the Hub and what reaches them on Slack; and reminders for the tasks that are due.
-- 1. wa_notify_prefs.prefs.kinds[kind] = {hub, slack}, saved through wa242_prefs_set (own row only). notify v14, hub-push v3
--    and social-publish v5 read it first; a kind with no entry follows the old rules (the channel, the disabled list). The
--    old `disabled` list is kept in step: a kind whose Slack switch is off is listed there, so the senders that only read
--    that list (team-inbox: a request update; linkpage) follow the choice too.
-- 2. wa242_due_reminders(): weekdays at 8:30 Toronto (cron wa-task-due) each active team member with tasks due today or
--    tomorrow, or overdue (60 days back; on Mondays when that is all they have), gets one message for the day: a Slack DM
--    (notify, event task_due) and a Hub notification (hub-push), each kind's switch respected by those two. A task is
--    theirs when they are an assignee or the named owner (the full name, a unique first name, a nickname), and only when
--    they could open it in the Hub (board_only, visibility and allowed_people as wa_sees_restricted reads them). Once a
--    day a person (change_log, entity_type task_due). Nothing is sent from a dry run.
-- 3. wa242_due_mine(): the caller's own lists (the centre shows them); wa242_remind_me(): sends the caller the day's
--    reminder now (at most three a day).
-- No row deleted.
-- =====================================================================

-- is this name (an owner, an allowed person) this team member? the email, the full name, a unique first name as a whole
-- word ("Ian and Steel"), or a nickname (team_members.nicknames)
create or replace function public.wa242_name_is(p_cand text, p_email text, p_name text, p_nicks jsonb default null)
returns boolean language sql stable security definer set search_path to '' as $$
  with c as (select lower(btrim(coalesce(p_cand, ''))) as cand, lower(btrim(coalesce(p_name, ''))) as nm, lower(btrim(coalesce(p_email, ''))) as em),
       f as (select c.cand, c.nm, c.em, split_part(c.nm, ' ', 1) as first, split_part(c.cand, ' ', 1) as cfirst,
                    regexp_replace(split_part(c.nm, ' ', 1), '[^a-z]', '', 'g') as fk,
                    (select count(*) from public.team_members t2 where coalesce(t2.active, true) and lower(split_part(btrim(t2.name), ' ', 1)) = split_part(c.nm, ' ', 1)) as nfirst
               from c)
  select case when f.cand = '' or f.nm = '' then false
              when f.cand = f.em and f.em <> '' then true
              when f.cand = f.nm then true
              when f.nfirst = 1 and length(f.fk) >= 2 and (f.cfirst = f.first or f.cand ~ ('(^|[^a-z])' || f.fk || '([^a-z]|$)')) then true
              when exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(coalesce(p_nicks, '[]'::jsonb)) = 'array' then p_nicks else '[]'::jsonb end) n
                            where length(regexp_replace(lower(btrim(n)), '[^a-z]', '', 'g')) >= 2
                              and (f.cand = lower(btrim(n)) or f.cfirst = lower(btrim(n))
                                   or f.cand ~ ('(^|[^a-z])' || regexp_replace(lower(btrim(n)), '[^a-z]', '', 'g') || '([^a-z]|$)'))) then true
              else false end
    from f;
$$;

-- one team member's open tasks with a date: due today, overdue (60 days) and due tomorrow, Toronto time
create or replace function public.wa242_due_lists(p_member bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  m record;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_lead boolean; v_admin boolean; v_board boolean;
  j_today jsonb; j_over jsonb; j_tom jsonb;
begin
  select tm.id, lower(coalesce(tm.email, '')) as email, coalesce(tm.name, '') as name, to_jsonb(tm.nicknames) as nicknames into m
    from public.team_members tm where tm.id = p_member;   -- nicknames is text[]; the matcher takes jsonb
  if m.id is null or m.email = '' then return jsonb_build_object('due_today', '[]'::jsonb, 'overdue', '[]'::jsonb, 'due_tomorrow', '[]'::jsonb); end if;
  v_admin := exists (select 1 from public.hub_roles r where lower(r.email) = m.email and r.role = 'admin');
  v_lead := v_admin or exists (select 1 from public.hub_roles r where lower(r.email) = m.email and r.role = 'leader');
  v_board := exists (select 1 from public.board_circle b where lower(b.email) = m.email);
  with x as (
  select t.id, t.title, t.due_date as due, t.department
    from public.dept_tasks t
   where t.done = false and t.banked_at is null
     and t.due_date between v_today - 60 and v_today + 1
     and (not coalesce(t.board_only, false) or v_board)
     and (exists (select 1 from public.task_assignees a where a.task_id = t.id and a.member_id = m.id)
          or public.wa242_name_is(t.owner, m.email, m.name, m.nicknames))
     and (t.visibility is null or t.visibility in ('', 'department')
          or (t.visibility = 'private' and (public.wa242_name_is(t.owner, m.email, m.name, m.nicknames)
                                            or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(coalesce(t.allowed_people, '[]'::jsonb)) = 'array' then t.allowed_people else '[]'::jsonb end) ap
                                                        where public.wa242_name_is(ap, m.email, m.name, m.nicknames))))
          or (t.visibility = 'speakers' and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(coalesce(t.allowed_people, '[]'::jsonb)) = 'array' then t.allowed_people else '[]'::jsonb end) ap
                                                     where public.wa242_name_is(ap, m.email, m.name, m.nicknames)))
          or (t.visibility = 'leadership' and (v_lead or v_board))
          or (v_admin and t.visibility <> 'speakers')))
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'due', to_char(x.due, 'FMDD Mon'), 'department', x.department) order by x.due, x.title) filter (where x.due = v_today), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'due', to_char(x.due, 'FMDD Mon'), 'department', x.department) order by x.due desc, x.title) filter (where x.due < v_today), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'due', to_char(x.due, 'FMDD Mon'), 'department', x.department) order by x.due, x.title) filter (where x.due = v_today + 1), '[]'::jsonb)
    into j_today, j_over, j_tom
    from x;
  return jsonb_build_object('due_today', j_today, 'overdue', j_over, 'due_tomorrow', j_tom, 'day', to_char(v_today, 'FMDay FMDD FMMonth'), 'date', v_today);
end $$;

-- the caller's own lists (the notification centre shows what the reminder would say)
create or replace function public.wa242_due_mine()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare me text := lower(coalesce(public.wa_email(), '')); v_id bigint;
begin
  if me = '' or not public.is_wa_staff() then raise exception 'Sign in to the Hub first.'; end if;
  select tm.id into v_id from public.team_members tm where lower(tm.email) = me and coalesce(tm.active, true) order by tm.id limit 1;
  if v_id is null then return jsonb_build_object('due_today', '[]'::jsonb, 'overdue', '[]'::jsonb, 'due_tomorrow', '[]'::jsonb, 'member', false); end if;
  return public.wa242_due_lists(v_id) || jsonb_build_object('member', true);
end $$;

-- the day's reminders: one message a person, weekdays at 8:30 Toronto (cron wa-task-due). p_dry: the plan, nothing sent.
create or replace function public.wa242_due_reminders(p_dry boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  m record;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_monday boolean := extract(isodow from (now() at time zone 'America/Toronto')) = 1;
  v_lists jsonb; v_payload jsonb;
  n_today int; n_over int; n_tom int;
  v_push boolean := coalesce((select value from public.app_config where key = 'push_on'), 'on') = 'on';
  v_plan jsonb := '[]'::jsonb;
  n_sent int := 0; n_people int := 0; n_skipped int := 0;
begin
  if session_user = 'authenticator' and coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'not allowed';
  end if;
  -- the switch: app_config task_due = off pauses the reminders (a dry run still shows the plan)
  if not p_dry and coalesce((select value from public.app_config where key = 'task_due'), 'on') = 'off' then
    return jsonb_build_object('day', v_today, 'off', true, 'sent', 0);
  end if;
  for m in select tm.id, lower(tm.email) as email, coalesce(tm.name, '') as name
             from public.team_members tm
            where coalesce(tm.active, true) and coalesce(tm.email, '') like '%@%'
              and not exists (select 1 from public.hub_roles r where lower(r.email) = lower(tm.email) and r.role in ('blocked', 'viewer'))
            order by tm.id loop
    n_people := n_people + 1;
    v_lists := public.wa242_due_lists(m.id);
    n_today := jsonb_array_length(v_lists -> 'due_today'); n_over := jsonb_array_length(v_lists -> 'overdue'); n_tom := jsonb_array_length(v_lists -> 'due_tomorrow');
    if n_today = 0 and n_tom = 0 and not (n_over > 0 and v_monday) then continue; end if;
    if exists (select 1 from public.change_log c where c.entity_type = 'task_due' and c.entity_id = m.email and c.field = v_today::text) then
      n_skipped := n_skipped + 1; continue;
    end if;
    v_payload := jsonb_build_object('event', 'task_due', 'email', m.email, 'name', m.name, 'day', v_lists ->> 'day',
                                    'due_today', v_lists -> 'due_today', 'overdue', v_lists -> 'overdue', 'due_tomorrow', v_lists -> 'due_tomorrow');
    if p_dry then
      v_plan := v_plan || jsonb_build_object('email', m.email, 'today', n_today, 'overdue', n_over, 'tomorrow', n_tom,
                                             'device', exists (select 1 from public.hub_push_subs s where lower(s.email) = m.email));
      continue;
    end if;
    begin perform public.call_edge('notify', v_payload); exception when others then null; end;
    if v_push and exists (select 1 from public.hub_push_subs s where lower(s.email) = m.email) then
      begin perform public.call_edge('hub-push', v_payload); exception when others then null; end;
    end if;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('task_due', m.email, v_today::text, null, 'today ' || n_today || ', overdue ' || n_over || ', tomorrow ' || n_tom, 'the Hub');
    n_sent := n_sent + 1;
  end loop;
  return jsonb_build_object('day', v_today, 'people', n_people, 'sent', n_sent, 'already', n_skipped, 'dry', p_dry, 'plan', v_plan);
end $$;

-- the caller asks for the day's reminder now (the centre's "Send me today's reminder"); at most three a day
create or replace function public.wa242_remind_me()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me text := lower(coalesce(public.wa_email(), ''));
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_lists jsonb; v_payload jsonb; v_name text; n int;
begin
  if me = '' or not public.is_wa_staff() then raise exception 'Sign in to the Hub first.'; end if;
  v_lists := public.wa242_due_mine();
  if not coalesce((v_lists ->> 'member')::boolean, false) then return jsonb_build_object('sent', false, 'why', 'You are not on the team list yet.'); end if;
  n := jsonb_array_length(v_lists -> 'due_today') + jsonb_array_length(v_lists -> 'overdue') + jsonb_array_length(v_lists -> 'due_tomorrow');
  if n = 0 then return jsonb_build_object('sent', false, 'why', 'Nothing of yours is due today, tomorrow or overdue.'); end if;
  if (select count(*) from public.change_log c where c.entity_type = 'task_due' and c.entity_id = me and c.changed_at >= (v_today::timestamp at time zone 'America/Toronto')) >= 3 then
    return jsonb_build_object('sent', false, 'why', 'Three today already; tomorrow brings a fresh one.');
  end if;
  select coalesce(tm.name, '') into v_name from public.team_members tm where lower(tm.email) = me and coalesce(tm.active, true) order by tm.id limit 1;
  v_payload := jsonb_build_object('event', 'task_due', 'email', me, 'name', v_name, 'day', v_lists ->> 'day',
                                  'due_today', v_lists -> 'due_today', 'overdue', v_lists -> 'overdue', 'due_tomorrow', v_lists -> 'due_tomorrow');
  begin perform public.call_edge('notify', v_payload); exception when others then null; end;
  if coalesce((select value from public.app_config where key = 'push_on'), 'on') = 'on' and exists (select 1 from public.hub_push_subs s where lower(s.email) = me) then
    begin perform public.call_edge('hub-push', v_payload); exception when others then null; end;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('task_due', me, v_today::text || ' asked', null, 'today ' || jsonb_array_length(v_lists -> 'due_today') || ', overdue ' || jsonb_array_length(v_lists -> 'overdue') || ', tomorrow ' || jsonb_array_length(v_lists -> 'due_tomorrow'), me);
  return jsonb_build_object('sent', true, 'today', jsonb_array_length(v_lists -> 'due_today'), 'overdue', jsonb_array_length(v_lists -> 'overdue'), 'tomorrow', jsonb_array_length(v_lists -> 'due_tomorrow'));
end $$;

-- the notification centre: each kind's Hub and Slack switch, the caller's own row; the disabled list kept in step
create or replace function public.wa242_prefs_set(p_kinds jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me text := lower(coalesce(public.wa_email(), ''));
  v_kinds jsonb := '{}'::jsonb;
  k text; v jsonb;
  v_row record;
begin
  if me = '' or not public.is_wa_staff() then raise exception 'Sign in to the Hub first.'; end if;
  if p_kinds is null or jsonb_typeof(p_kinds) <> 'object' then raise exception 'kinds must be an object of {hub, slack}'; end if;
  for k, v in select e.key, e.value from jsonb_each(p_kinds) e loop
    if k !~ '^[a-z_]{3,40}$' or jsonb_typeof(v) <> 'object' then continue; end if;
    v_kinds := v_kinds || jsonb_build_object(k, jsonb_build_object('hub', coalesce((v ->> 'hub')::boolean, true), 'slack', coalesce((v ->> 'slack')::boolean, true)));
  end loop;
  insert into public.wa_notify_prefs as p (email, disabled, prefs, updated_at)
  values (me, '[]'::jsonb, jsonb_build_object('kinds', v_kinds), now())
  on conflict (email) do update
    set prefs = coalesce(p.prefs, '{}'::jsonb) || jsonb_build_object('kinds', coalesce(p.prefs -> 'kinds', '{}'::jsonb) || v_kinds), updated_at = now();
  update public.wa_notify_prefs p
     set disabled = (select coalesce(jsonb_agg(s.x), '[]'::jsonb) from (
                       select d.x from jsonb_array_elements_text(case when jsonb_typeof(coalesce(p.disabled, '[]'::jsonb)) = 'array' then p.disabled else '[]'::jsonb end) d(x) where not (v_kinds ? d.x)
                       union
                       select e.key from jsonb_each(v_kinds) e where (e.value ->> 'slack')::boolean = false) s)
   where p.email = me;
  select p.disabled, p.prefs into v_row from public.wa_notify_prefs p where p.email = me;
  return jsonb_build_object('ok', true, 'disabled', v_row.disabled, 'kinds', coalesce(v_row.prefs -> 'kinds', '{}'::jsonb), 'channel', coalesce(v_row.prefs ->> 'channel', 'both'));
end $$;

revoke execute on function public.wa242_name_is(text, text, text, jsonb) from anon, authenticated;
revoke execute on function public.wa242_due_lists(bigint) from anon, authenticated;
revoke execute on function public.wa242_due_reminders(boolean) from anon, authenticated;
revoke execute on function public.wa242_due_mine() from anon;
revoke execute on function public.wa242_remind_me() from anon;
revoke execute on function public.wa242_prefs_set(jsonb) from anon;

comment on function public.wa242_name_is(text, text, text, jsonb) is 'wave242: is this owner or allowed person this team member (the email, the full name, a unique first name as a whole word, a nickname)';
comment on function public.wa242_due_lists(bigint) is 'wave242: a team member''s open tasks with a date: due today, overdue (60 days), due tomorrow; theirs as an assignee or the named owner, and only what they could open';
comment on function public.wa242_due_mine() is 'wave242: the caller''s due lists (the notification centre shows them)';
comment on function public.wa242_due_reminders(boolean) is 'wave242: the day''s task reminders, weekdays 8:30 Toronto (cron wa-task-due): one message a person through notify (task_due) and hub-push; p_dry shows the plan; app_config task_due = off pauses it';
comment on function public.wa242_remind_me() is 'wave242: the caller asks for the day''s reminder now (at most three a day)';
comment on function public.wa242_prefs_set(jsonb) is 'wave242: the notification centre saves each kind''s Hub and Slack switch (wa_notify_prefs.prefs.kinds), the disabled list kept in step';

-- weekdays at 8:30 Toronto (12:30 UTC in summer time)
do $$ begin perform cron.unschedule('wa-task-due'); exception when others then null; end $$;
select cron.schedule('wa-task-due', '30 12 * * 1-5', 'select public.wa242_due_reminders()');

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('hub', 'release', 'wave242', null,
        'The notification centre: Settings > Notifications lists every kind of notification with a Hub switch and a Slack switch each (wa_notify_prefs.prefs.kinds); task reminders: weekdays at 8:30 each person with tasks due today or tomorrow (or overdue, on Mondays) hears once, in the Hub and on Slack as they chose, and can ask for the day''s reminder any time',
        'assistant');
