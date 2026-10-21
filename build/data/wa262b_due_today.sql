-- wave262b: applied with the wave262 build (the page groups due_today; an older page would not show those rows).
-- wave262 (20/10/26): the due-date check after the 19/10/26 leadership meeting.
-- 1. Ian could not save the pop-up: confirm_due_check() re-ran the whole list (wa237_due_check(), about 0.56 s for a
--    person with 68 tasks) once per task, so 50 answers took about 28 s and hit the 8 s statement timeout; nothing saved.
--    Now the list is read once per call (and the page saves in batches of 15).
-- 2. Steel: "continue the prompt of having them clean up their tasks or change due dates if it's the day that these
--    tasks are due": a task due today joins the check (why = 'due_today') until the person confirms it today.

create or replace function public.wa237_due_check()
 returns table(task_id bigint, title text, department text, owner text, due_date date, why text, meeting_title text, meeting_date date, next_meeting date, following_meeting date, suggested date, owner_unsure boolean, for_lead boolean)
 language plpgsql
 stable
 set search_path to ''
as $function$
declare v_me public.team_members%rowtype; v_first text; v_lead boolean := false; v_today date; v_label text;
begin
  v_today := (now() at time zone 'America/Toronto')::date;
  select * into v_me from public.team_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and m.active limit 1;
  if v_me.id is null then return; end if;
  v_first := regexp_replace(lower(split_part(trim(v_me.name), ' ', 1)), '[^a-z]', '', 'g');
  if v_first = '' then return; end if;
  /* a team's lead: a Hub leader or admin on that team, or its director */
  v_lead := exists (select 1 from public.hub_roles r where r.email = lower(v_me.email) and r.role in ('admin', 'leader'))
            or coalesce(v_me.role, '') ~* 'director';
  select lower(coalesce(dm.label, '')) into v_label from public.dept_meta dm where dm.department = v_me.department;
  return query
  with mine as (
    /* my own tasks: assigned to me (unless the meeting left the owner unsure and the name on it is not mine), or carrying my name */
    select d.id, d.title, d.department, d.owner, d.due_date, d.opened_at, d.due_confirmed_at, d.owner_unsure,
           (select l.transcript_id from public.transcript_tasks l where l.task_id = d.id and l.kind = 'added' order by l.id limit 1) as tx_id,
           (select l.due_date from public.transcript_tasks l where l.task_id = d.id and l.kind = 'added' order by l.id limit 1) as tx_due,
           false as lead_row
    from public.dept_tasks d
    where d.done = false and d.banked_at is null
      and ((not d.owner_unsure and exists (select 1 from public.task_assignees a where a.task_id = d.id and a.member_id = v_me.id))
           or lower(coalesce(d.owner, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)'))
      and not (v_lead and d.owner_unsure and d.department = v_me.department)
    union all
    /* the lead's own team: tasks nobody on the roster owns (the meeting gave them to the team), and unsure tasks that
       landed on the lead by name or by the team's label (someone said "not mine"): "Who owns this?" */
    select d.id, d.title, d.department, d.owner, d.due_date, d.opened_at, d.due_confirmed_at, d.owner_unsure,
           null::bigint, null::date, true
    from public.dept_tasks d
    where v_lead and d.department = v_me.department and d.done = false and d.banked_at is null
      and d.opened_at >= '2026-09-01'
      and ((not exists (select 1 from public.task_assignees a where a.task_id = d.id)
            and not exists (select 1 from public.team_members m where m.active
                              and lower(coalesce(d.owner, '')) ~ ('(^|[^a-z])' || regexp_replace(lower(split_part(trim(m.name), ' ', 1)), '[^a-z]', '', 'g') || '([^a-z]|$)'))
            and lower(coalesce(d.owner, '')) !~ '(^|[^a-z])(steel|suhaib|both)([^a-z]|$)')
           or (d.owner_unsure and (lower(coalesce(d.owner, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)')
                                   or (v_label <> '' and lower(trim(coalesce(d.owner, ''))) = v_label)
                                   or lower(trim(coalesce(d.owner, ''))) = lower(d.department))))
  ), pick as (
    select m.*, t.title as mt, t.meeting_date as md,
           case when m.lead_row then 'needs_owner'
                when m.due_date is null then 'no_date'
                when m.due_date < v_today then 'overdue'
                /* wave262: due today, not yet confirmed today */
                when m.due_date = v_today then 'due_today'
                when m.due_confirmed_at is null and m.tx_id is not null and m.opened_at >= '2026-09-01' and m.due_date = m.tx_due then 'meeting_set'
                else 'owner_check' end as why_
    from mine m left join public.transcripts t on t.id = m.tx_id
    where m.lead_row
       or m.owner_unsure
       or m.due_date is null
       or m.due_date < v_today
       or (m.due_date = v_today and (m.due_confirmed_at is null or (m.due_confirmed_at at time zone 'America/Toronto')::date < v_today))
       or (m.due_confirmed_at is null and m.tx_id is not null and m.opened_at >= '2026-09-01' and m.due_date = m.tx_due)
  ), dated as (
    select p.*, public.wa213_team_meetings(p.department, v_today + 1) as mts from pick p
  )
  select x.id, x.title, x.department, x.owner, x.due_date, x.why_, x.mt, x.md,
         coalesce(x.mts[1], v_today + 7),
         coalesce(x.mts[2], v_today + 14),
         case when x.mts[1] is not null and x.mts[1] >= v_today + 2 then x.mts[1]
              when x.mts[2] is not null then x.mts[2]
              when x.mts[1] is not null then x.mts[1]
              else v_today + 7 end,
         x.owner_unsure, x.lead_row
  from dated x
  order by case x.why_ when 'owner_check' then 0 when 'overdue' then 1 when 'due_today' then 2 when 'no_date' then 3 when 'meeting_set' then 4 else 5 end,
           x.due_date nulls last, x.md desc nulls last, x.id;
end $function$;

comment on function public.wa237_due_check() is 'wave237, wave262: the due-date check''s list for the signed-in person: their open tasks that are overdue, due today and not yet confirmed today (wave262, due_today), undated, dated by a meeting and unconfirmed, or whose owner a meeting left unsure (owner_unsure: "Is this yours?"), plus, for a team''s lead, the team''s tasks nobody on the roster owns (for_lead: "Who owns this?"). Replaces my_due_date_check() for the pop-up; that one stays for pages on the old build. Access: authenticated (it reads the caller''s own email).';

revoke execute on function public.wa237_due_check() from public, anon, authenticated;
grant execute on function public.wa237_due_check() to authenticated;

-- The What changed tour (trainings tour:whatsnew), shown in the Avenue Academy under Hub page tours.
insert into public.trainings (category, title, description, kind, key, body, minutes, xp, active, sort, path_group)
select 'Hub tours', 'Page tour: What changed in the Hub (October 2026)',
       'The simpler Hub after the 19 October leadership meeting: your team first, Other teams and More in the menu, your apps first, and Show everything on Home.',
       'tour', 'tour:whatsnew', '{"tab": "mypage", "tour": "whatsnew"}'::jsonb, 1, 10, true, 0, 'Hub page tours'
where not exists (select 1 from public.trainings where key = 'tour:whatsnew');

-- Hub module 1 (training 39): the menu, Home and the apps as they are now (wording only, updated_at kept).
update public.trainings t set
  description = replace(replace(replace(t.description,
    E'- **At the top:** Home, the Avenue Academy, Team Requests, the Calendar and The Brain (the admins also see the Executive dashboard).\n- **Teams:** each team''s page, with its own pages folded under it.\n- **Other Tools:** Important info, The Task Bank, Agendas, the Document finder, the Transcript archive and the Photo library.\n- **Organization:** the Org chart, Our story and the Hub inbox.',
    E'- **At the top:** Home, the Avenue Academy, Team Requests and the Calendar (the admins also see the Executive dashboard).\n- **Teams:** your own team comes first, with its own pages folded under it. The other teams fold under **Other teams**: click it to show them (the Hub remembers your choice on that computer).\n- **More:** click it to open **Other Tools** (The Brain, Important info, The Task Bank, Agendas, the Document finder, the Transcript archive and the Photo library) and **Organization** (the Org chart, Our story and the Hub inbox). It opens by itself when you are on one of those pages.'),
    E'\n\nGood to know: leaders, HR and the admins post announcements from Home too.',
    E'\n\nHome shows what matters first. In the loop, Updates for you, time commitments, Slack notifications and time off wait behind **Show everything on Home**, at the bottom; one click shows them, another hides them again.\n\nGood to know: leaders, HR and the admins post announcements from Home too.'),
    E'Apps, at the bottom of the menu, open the bigger tools: Strategy',
    E'Apps, at the bottom of the menu, open the bigger tools. **Your apps** (your team''s) come first, then **More apps**: Strategy'),
  updated_at = t.updated_at
where t.id = 39;

-- Tate leads Operations Toronto (19/10/26: "more editing powers in the hub"): the lead option of his profile, as Ahmed and Shima have for theirs.
update public.hub_roles set role = 'leader' where email = 'tate.weinstein@welfareavenue.com' and role = 'member' and profile = 'opsto';
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('hub_role', 'tate.weinstein@welfareavenue.com', 'role', 'member', 'leader (Operations Toronto lead; Steel, 20/10/26)', 'Claude (20/10 leadership follow-through)');

-- Onboarding (Valex, 19/10/26: back to a 30-minute live walkthrough; Steel: the direct manager can run it): a lead's step.
insert into public.hr_setup_template (id, phase, name, description, sort, active, who, due_day)
values ('hrm05', 'Manager follow-through', 'Walk them through the Hub, live (30 minutes)',
        'In their first days, share your screen for half an hour: their Home and tasks, your team''s page, Team Requests, the Calendar and the apps your team uses. Then they take the What changed tour and their page tours in the Avenue Academy, so their pages unlock. Invite hub@welfareavenue.com so the call is recorded.',
        5, true, 'lead', 3)
on conflict (id) do nothing;
-- Loom joins through the Hub's account now (Steel, 19/10/26: "Loom at Welfare Avenue is no longer a thing"): wording only.
update public.hr_setup_template set description = replace(description, 'add admin@welfareavenue.com to the meeting', 'invite hub@welfareavenue.com to the meeting') where id = 'hrc1';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('trainings', '39', 'description', null, 'wave262: the menu (your team, Other teams, More), Show everything on Home, Your apps (wording only)', 'Claude (20/10 leadership follow-through)');
