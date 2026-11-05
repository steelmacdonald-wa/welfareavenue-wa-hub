begin;
-- Welfare Avenue Hub: wave271 (271a), Task 1, 01/11/26. The database foundation for HR onboarding automation: an accepted offer starts one onboarding flow,
-- the flow keeps its grids and step results, and the onboarding call date is day one (it fills started_at, team_members.start_date and hub_candidates.start_date).
-- Design: claude/01-11-26 - HR onboarding automation, design (wave271).md. Proved offline first: node test/w271sql.mjs (PGlite). Safe to run twice.
-- Nothing here sends anything. The hub_candidates.position_id -> hub_positions.dept codes are the same codes as team_members.department and org_positions.department
-- (checked 01/11/26: board, exec, fundraising, hr, marketing, opsmtl, opsto, progdev), so the default manager needs no mapping.
-- Undo: build/wa271a_undo.sql

-- 1. what the offer says: the respond-by date and the date the offer suggests (the call date, once picked, is the real start; see wa271_move_start)
alter table public.hub_candidates add column if not exists offer_respond_by date;
alter table public.hub_candidates add column if not exists offer_start date;
comment on column public.hub_candidates.offer_respond_by is 'wave271: the date the offer letter asks the candidate to answer by. Written by recruit-actions when the offer goes out; read by the HR Center to show that an answer came late (wa271_ready_list.late).';
comment on column public.hub_candidates.offer_start is 'wave271: the start date the offer letter suggests. It only hints where HR looks on the availability grid; the onboarding call date is the real start (hub_candidates.start_date).';

-- 2. one onboarding flow per accepted candidate
create table if not exists public.hub_onboard_flows (
  id bigserial primary key,
  candidate_id bigint not null unique references public.hub_candidates (id) on delete cascade,
  practice boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting', 'ready', 'running', 'started', 'backed_out')),
  manager_member_id bigint references public.team_members (id) on delete set null,
  wa_email text,
  call_at timestamptz,
  one_on_one_at timestamptz,
  group_session text,
  call_event_id text,
  one_on_one_event_id text,
  onboarding_id bigint references public.onboardings (id) on delete set null,
  slack_channel_id text,
  slack_user_id text,
  welcome_subject text,
  welcome_text text,
  pw_nonce text,
  pw_expires_at timestamptz,
  pw_used_at timestamptz,
  reminded_hire_at timestamptz,
  reminded_manager_at timestamptz,
  started_by text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hub_onboard_flows add column if not exists roster_created boolean;
alter table public.hub_onboard_flows add column if not exists canva_link text;
alter table public.hub_onboard_flows add column if not exists welcome_edited boolean;
create index if not exists hub_onboard_flows_manager_idx on public.hub_onboard_flows (manager_member_id) where manager_member_id is not null;
create index if not exists hub_onboard_flows_onboarding_idx on public.hub_onboard_flows (onboarding_id) where onboarding_id is not null;
comment on table public.hub_onboard_flows is 'wave271: one onboarding flow per accepted candidate, from Accept to Start onboarding. Created by the trigger wa271_cand_accepted; written by the onboard-link and onboard-run edge functions with the service key. Read by HR and admins only (row security); nothing writes it from the browser.';
comment on column public.hub_onboard_flows.id is 'Flow id.';
comment on column public.hub_onboard_flows.candidate_id is 'The accepted candidate (hub_candidates.id). Unique: accepting twice, or two applications from one person, never makes a second flow for the same row. Deleting the candidate deletes the flow.';
comment on column public.hub_onboard_flows.practice is 'Copied from hub_candidates.practice. A practice flow only ever writes hub_onboard_steps rows marked practice; nothing to team_members, onboardings, Google, Slack, Calendar or email.';
comment on column public.hub_onboard_flows.status is 'waiting (accepted, grid not done or not picked), ready (times picked), running (Start onboarding is working), started (done, leaves the Ready list), backed_out (the hire withdrew after accepting).';
comment on column public.hub_onboard_flows.manager_member_id is 'The manager HR confirmed (team_members.id). Null until chosen; wa271_default_manager says who the Hub would suggest.';
comment on column public.hub_onboard_flows.wa_email is 'The new welfareavenue.com address HR approved in the preview. Null until Start.';
comment on column public.hub_onboard_flows.call_at is 'The onboarding call, picked by HR. Its date is day one: it fills onboardings.started_at, team_members.start_date and hub_candidates.start_date.';
comment on column public.hub_onboard_flows.one_on_one_at is 'The manager 1-on-1, picked by HR. Null while it waits on the manager; it can be booked later.';
comment on column public.hub_onboard_flows.group_session is 'The group session date HR typed in the preview, as text. Blank means the welcome email leaves the line out.';
comment on column public.hub_onboard_flows.call_event_id is 'The Google Calendar event id of the onboarding call, kept so Change time can update the invite.';
comment on column public.hub_onboard_flows.one_on_one_event_id is 'The Google Calendar event id of the 1-on-1, kept so Change time and Change manager can update the invite.';
comment on column public.hub_onboard_flows.onboarding_id is 'The onboarding plan Start created (onboardings.id). Null before Start and for practice flows.';
comment on column public.hub_onboard_flows.slack_channel_id is 'The Slack onboarding channel the Hub added the hire to. Null until the hourly Slack check finds their account.';
comment on column public.hub_onboard_flows.slack_user_id is 'The hire''s Slack user id, found by their welfareavenue.com address. Null until then.';
comment on column public.hub_onboard_flows.welcome_subject is 'The welcome email subject HR typed in the preview, saved at Start only if they changed it. Null: the Hub''s own subject. Never holds a password.';
comment on column public.hub_onboard_flows.welcome_text is 'The welcome email body HR typed in the preview, saved at Start only if they changed it, as typed with its [square bracket] places, which onboard-run fills in each time it is read (so a later change of time, manager, address or Canva link shows). Null: the Hub''s own text, which follows the template. Never holds a password.';
comment on column public.hub_onboard_flows.pw_nonce is 'Signs the one-time password link. A secret: left out of the browser column grants, read only by edge functions with the service key.';
comment on column public.hub_onboard_flows.pw_expires_at is 'When the one-time password link stops working (onboard_password_days after it was made).';
comment on column public.hub_onboard_flows.pw_used_at is 'When the new hire opened the one-time password page. Set once; a second open shows nothing.';
comment on column public.hub_onboard_flows.reminded_hire_at is 'When HR was last reminded that the new hire has not marked a grid (onboard_remind_hours).';
comment on column public.hub_onboard_flows.reminded_manager_at is 'When the manager was last reminded to mark their grid (onboard_remind_hours).';
comment on column public.hub_onboard_flows.started_by is 'Who pressed Start onboarding (email).';
comment on column public.hub_onboard_flows.started_at is 'When Start onboarding finished.';
comment on column public.hub_onboard_flows.created_at is 'When the acceptance created the flow.';
comment on column public.hub_onboard_flows.updated_at is 'Last change; set by whoever writes the row.';
comment on column public.hub_onboard_flows.roster_created is 'What the roster step did: true, it created the profile; false, the profile was on the roster before and it only linked it. Null until the step runs. The They backed out list words itself from this.';
comment on column public.hub_onboard_flows.welcome_edited is 'Whose welcome email this is: true, HR changed the subject or the text in the preview (welcome_subject, welcome_text keep their wording); false, the Hub''s own throughout. Null until Start. Either way the bracketed places are filled in when it is read.';
comment on column public.hub_onboard_flows.canva_link is 'a fresh Canva invite link HR pastes for this hire; Canva''s links last 30 days';

-- 3. the times people marked (the new hire's grid, the manager's grid)
create table if not exists public.hub_onboard_grids (
  flow_id bigint not null references public.hub_onboard_flows (id) on delete cascade,
  who text not null check (who in ('hire', 'manager')),
  slots timestamptz[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (flow_id, who)
);
comment on table public.hub_onboard_grids is 'wave271: the half-hour slots marked on the availability grid, one row per flow and person (the new hire, or the manager for the 1-on-1). Slots are absolute times, so a daylight-saving change never moves what someone chose. Written by onboard-link with the service key; read by HR and admins only.';
comment on column public.hub_onboard_grids.flow_id is 'The flow (hub_onboard_flows.id). Deleted with it.';
comment on column public.hub_onboard_grids.who is 'hire (the new hire, for the onboarding call and the 1-on-1) or manager (for the 1-on-1 only).';
comment on column public.hub_onboard_grids.slots is 'The start of every cell the person marked, as timestamptz. Empty means opened and saved with nothing marked.';
comment on column public.hub_onboard_grids.updated_at is 'When the person last saved the grid.';

-- 4. what each Start step did, so HR sees a result per step
create table if not exists public.hub_onboard_steps (
  flow_id bigint not null references public.hub_onboard_flows (id) on delete cascade,
  step text not null check (step in ('roster', 'google', 'plan', 'invites', 'manager', 'hub', 'slack', 'welcome')),
  status text not null default 'pending' check (status in ('pending', 'running', 'waiting', 'done', 'skipped', 'failed', 'hr_task')),
  detail text,
  practice boolean not null default false,
  at timestamptz not null default now(),
  by text,
  primary key (flow_id, step)
);
comment on table public.hub_onboard_steps is 'wave271: the result of each Start onboarding step for a flow (roster, google, plan, invites, manager, hub, slack, welcome). A practice run writes only here, marked practice. Written by onboard-run with the service key; read by HR and admins only. Never holds a password.';
comment on column public.hub_onboard_steps.flow_id is 'The flow (hub_onboard_flows.id). Deleted with it.';
comment on column public.hub_onboard_steps.step is 'Which step: roster, google, plan, invites, manager, hub, slack or welcome (that order). roster needs nothing; plan, invites, manager, slack and google need roster; hub and welcome need google.';
comment on column public.hub_onboard_steps.status is 'pending, running, waiting (on an earlier step), done, skipped, failed or hr_task (left to HR by hand).';
comment on column public.hub_onboard_steps.detail is 'Plain words for HR: what happened, or why it failed or waits. No passwords, tokens or full email bodies.';
comment on column public.hub_onboard_steps.practice is 'True when this result comes from a practice applicant: nothing real was changed.';
comment on column public.hub_onboard_steps.at is 'When the status last changed.';
comment on column public.hub_onboard_steps.by is 'Who or what made the change: an HR email, or the function name.';

-- 5. access: HR and admins read, nobody writes from the browser; the service key (edge functions) writes
alter table public.hub_onboard_flows enable row level security;
alter table public.hub_onboard_grids enable row level security;
alter table public.hub_onboard_steps enable row level security;
revoke all on public.hub_onboard_flows, public.hub_onboard_grids, public.hub_onboard_steps from public, anon, authenticated;
grant select (id, candidate_id, practice, status, manager_member_id, wa_email, call_at, one_on_one_at, group_session, call_event_id, one_on_one_event_id, onboarding_id,
              slack_channel_id, slack_user_id, welcome_subject, welcome_text, pw_expires_at, pw_used_at, reminded_hire_at, reminded_manager_at, started_by, started_at, created_at, updated_at, roster_created, canva_link, welcome_edited)
  on public.hub_onboard_flows to authenticated;   -- every column but pw_nonce
grant select on public.hub_onboard_grids, public.hub_onboard_steps to authenticated;
grant all on public.hub_onboard_flows, public.hub_onboard_grids, public.hub_onboard_steps to service_role;
grant usage, select on sequence public.hub_onboard_flows_id_seq to service_role;
drop policy if exists hub_onboard_flows_read on public.hub_onboard_flows;
create policy hub_onboard_flows_read on public.hub_onboard_flows for select to authenticated using (public.wa_is_hr() or public.is_hub_admin());
drop policy if exists hub_onboard_grids_read on public.hub_onboard_grids;
create policy hub_onboard_grids_read on public.hub_onboard_grids for select to authenticated using (public.wa_is_hr() or public.is_hub_admin());
drop policy if exists hub_onboard_steps_read on public.hub_onboard_steps;
create policy hub_onboard_steps_read on public.hub_onboard_steps for select to authenticated using (public.wa_is_hr() or public.is_hub_admin());

-- 6. who may call the wa271 functions: HR, an admin, or the service key (edge functions check the signed-in person themselves)
create or replace function public.wa271_can()
returns boolean language sql stable security definer set search_path to '' as $function$
  select coalesce(auth.role(), '') = 'service_role' or public.wa_is_hr() or public.is_hub_admin()
$function$;
revoke all on function public.wa271_can() from public, anon, authenticated;
comment on function public.wa271_can() is 'wave271: true for the service key, an HR person (wa_is_hr) or an admin (is_hub_admin). The check inside wa271_ready_list, wa271_default_manager and wa271_move_start. Not callable from the browser.';

-- 7. accepting an offer starts one waiting flow (only when accepted_on goes from empty to a date; a second acceptance or an edit starts nothing)
create or replace function public.wa271_cand_accepted()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  insert into public.hub_onboard_flows (candidate_id, practice, status) values (new.id, new.practice, 'waiting')
  on conflict (candidate_id) do nothing;
  return new;
end $function$;
revoke all on function public.wa271_cand_accepted() from public, anon, authenticated;
comment on function public.wa271_cand_accepted() is 'wave271: trigger function. When hub_candidates.accepted_on goes from empty to a date, creates the candidate''s onboarding flow (waiting, practice copied) once. Not callable.';
drop trigger if exists wa271_cand_accepted on public.hub_candidates;
create trigger wa271_cand_accepted after update of accepted_on on public.hub_candidates
  for each row when (old.accepted_on is null and new.accepted_on is not null) execute function public.wa271_cand_accepted();

-- 8. the manager the Hub would suggest: who the position reports to in org_positions, else the department's only leader, else nobody
create or replace function public.wa271_default_manager(p_candidate bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_title text; v_dept text; v_id bigint; v_name text; v_ids bigint[]; v_names text[];
begin
  if not public.wa271_can() then raise exception 'Only HR can see the default manager'; end if;
  select p.title, p.dept into v_title, v_dept
    from public.hub_candidates c join public.hub_positions p on p.id = c.position_id where c.id = p_candidate;
  if v_title is null then return jsonb_build_object('member_id', null, 'name', null, 'how', 'none'); end if;
  -- 1. the person the matching org position reports to (hub_positions.dept and org_positions.department use the same codes)
  select m.id, m.name into v_id, v_name
    from public.org_positions o
    join public.org_positions b on b.id = o.reports_to
    join public.team_members m on m.id = b.member_id and m.active
   where lower(trim(o.title)) = lower(trim(v_title)) and (v_dept is null or o.department = v_dept)
   order by (o.status in ('open', 'hiring')) desc, o.sort, o.id limit 1;
  if v_id is not null then return jsonb_build_object('member_id', v_id, 'name', v_name, 'how', 'reports_to'); end if;
  -- 2. the department's leader, when there is exactly one
  if coalesce(v_dept, '') <> '' then
    select array_agg(m.id order by m.id), array_agg(m.name order by m.id) into v_ids, v_names
      from public.team_members m
     where m.active and m.department = v_dept
       and exists (select 1 from public.hub_roles r where r.email = lower(trim(coalesce(m.email, ''))) and r.role = 'leader');
    if coalesce(array_length(v_ids, 1), 0) = 1 then
      return jsonb_build_object('member_id', v_ids[1], 'name', v_names[1], 'how', 'team_lead');
    end if;
  end if;
  return jsonb_build_object('member_id', null, 'name', null, 'how', 'none');
end $function$;
revoke all on function public.wa271_default_manager(bigint) from public, anon;
grant execute on function public.wa271_default_manager(bigint) to authenticated, service_role;
comment on function public.wa271_default_manager(bigint) is 'wave271: {member_id, name, how} for a candidate. how is reports_to (the org_positions reporting line for the position), team_lead (exactly one active leader in the position''s department) or none (HR must choose). HR, admins and the service key only.';

-- 9. the Ready to onboard list: flows that have not started and have not backed out, on a card still open, for someone with no open plan but this flow's own
--    (the roster dropdown makes a plan; the person is found by the card's profile or the personal email)
create or replace function public.wa271_ready_list()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.wa271_can() then raise exception 'Only HR can see the onboarding list'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.accepted_on, x.id) from (
      select f.id, c.accepted_on, jsonb_build_object(
        'flow_id', f.id,
        'candidate_id', c.id,
        'status', f.status,
        'practice', f.practice,
        'name', c.name,
        'role', c.role,
        'email', c.email,
        'accepted_on', c.accepted_on,
        'offer_respond_by', c.offer_respond_by,
        'offer_start', c.offer_start,
        'late', coalesce(c.accepted_on > c.offer_respond_by, false),
        'grids', jsonb_build_object(
          'hire', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'hire' and cardinality(g.slots) > 0) then 'marked' else 'none' end,
          'manager', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'manager' and cardinality(g.slots) > 0) then 'marked' else 'none' end),
        'call_at', f.call_at,
        'one_on_one_at', f.one_on_one_at,
        'manager_member_id', f.manager_member_id,
        'default_manager', public.wa271_default_manager(c.id),
        'other_open_rows', (select count(*) from public.hub_candidates o
                             where o.id <> c.id and nullif(lower(trim(coalesce(c.email, ''))), '') is not null
                               and lower(trim(coalesce(o.email, ''))) = lower(trim(c.email))
                               and o.status not in ('declined', 'withdrawn'))) as j
        from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id
       where f.status not in ('started', 'backed_out')
         and c.status not in ('declined', 'withdrawn')
         and not exists (select 1 from public.onboardings p join public.team_members m on m.id = p.member_id
                          where p.completed_at is null and p.id is distinct from f.onboarding_id
                            and (m.id = c.member_id or (nullif(lower(trim(coalesce(c.email, ''))), '') is not null and lower(trim(coalesce(m.email, ''))) = lower(trim(c.email)))))) x
  ), '[]'::jsonb);
end $function$;
revoke all on function public.wa271_ready_list() from public, anon;
grant execute on function public.wa271_ready_list() to authenticated, service_role;
comment on function public.wa271_ready_list() is 'wave271: the HR Center Ready to onboard list as jsonb: every flow not started or backed out, on a card not declined or withdrawn, for someone with no other open plan, with name, role, personal email, offer dates, late (answered after the respond-by date), grid statuses (none or marked), the default manager and other_open_rows (other applications with the same email that are not declined or withdrawn). HR, admins and the service key only; raises for anyone else.';

-- 10. onboarding_assign takes a start date (default today, as before); the old two-argument version is dropped so a call by name stays unambiguous
drop function if exists public.onboarding_assign(bigint, text);
create or replace function public.onboarding_assign(p_member_id bigint, p_by text, p_start date default current_date)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_name text; v_start date := coalesce(p_start, current_date);   -- wave271: was current_date
begin
  if not public.is_wa_staff() then raise exception 'Only staff can start an onboarding plan'; end if;   -- audit 26/09/26
  select name into v_name from public.team_members where id = p_member_id;
  if v_name is null then raise exception 'member not found'; end if;
  insert into public.onboardings (member_id, person_name, assigned_by, started_at)
  values (p_member_id, v_name, p_by, v_start) returning id into v_id;
  insert into public.onboarding_steps (onboarding_id, template_id, due_date)
  select v_id, t.id, public.onb_due(t.section, v_start) from public.onboarding_template t where t.active on conflict do nothing;
  insert into public.hr_setup_steps (onboarding_id, template_id)
  select v_id, t.id from public.hr_setup_template t where t.active on conflict do nothing;
  perform public.wa166_onb_sync(v_id);   -- wave166: what they already did in the Avenue Academy is ticked
  return v_id;
end $function$;
revoke all on function public.onboarding_assign(bigint, text, date) from public, anon;
grant execute on function public.onboarding_assign(bigint, text, date) to authenticated, service_role;
comment on function public.onboarding_assign(bigint, text, date) is 'Starts an HR onboarding plan for a roster member: creates the onboardings row, copies the onboarding_template steps with due dates, and copies the hr_setup_template steps. p_by is stored as given. Staff only (checked inside). Called by the page (HR centre). Access: authenticated. wave271: p_start (default today) is day one; started_at and every step due date count from it (WEEK 1 is p_start + 7).';

-- 11. changing day one later: the plan, the steps not yet done, the roster profile and the candidate follow
create or replace function public.wa271_move_start(p_onboarding bigint, p_new date)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_member bigint; v_old date;
begin
  if not public.wa271_can() then raise exception 'Only HR can move a start date'; end if;
  if p_new is null then raise exception 'A new start date is needed'; end if;
  select member_id, started_at into v_member, v_old from public.onboardings where id = p_onboarding for update;
  if not found then raise exception 'Onboarding % not found', p_onboarding; end if;
  update public.onboardings set started_at = p_new where id = p_onboarding;
  update public.onboarding_steps s set due_date = public.onb_due(t.section, p_new)
    from public.onboarding_template t where s.onboarding_id = p_onboarding and t.id = s.template_id and not s.done;
  if v_member is not null then
    update public.team_members set start_date = p_new, start_source = 'manual' where id = v_member;   -- manual: directory-sync leaves it alone
  end if;
  update public.hub_candidates c set start_date = p_new from public.hub_onboard_flows f where f.onboarding_id = p_onboarding and c.id = f.candidate_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('onboardings', p_onboarding::text, 'started_at', v_old::text, p_new::text, coalesce(nullif(auth.jwt() ->> 'email', ''), 'wave271'));
end $function$;
revoke all on function public.wa271_move_start(bigint, date) from public, anon;
grant execute on function public.wa271_move_start(bigint, date) to authenticated, service_role;
comment on function public.wa271_move_start(bigint, date) is 'wave271: moves an onboarding''s day one. Sets onboardings.started_at, re-dates only the steps not done (onb_due from the new date), sets team_members.start_date (marked manual so directory-sync keeps it) and hub_candidates.start_date (through the flow), and logs it. HR, admins and the service key only.';

-- 12. settings (HR can change them; the three links are filled in by Steel) and the checklist day
insert into public.app_config (key, value) values
  ('onboard_grid_days', '14'), ('onboard_grid_start', '8'), ('onboard_grid_end', '21'), ('onboard_grid_cell_min', '30'),
  ('onboard_call_min', '60'), ('onboard_one_on_one_min', '30'), ('onboard_remind_hours', '48'), ('onboard_password_days', '7'),
  ('onboard_auto_google', 'off'), ('onboard_auto_slack', 'off'),
  ('onboard_slack_join_link', ''), ('onboard_google_video', '')
on conflict (key) do nothing;

-- the onboarding call is day one, so its checklist steps are due on day 0 (they were day 3)
update public.hr_setup_template set due_day = 0 where phase = 'The onboarding call' and due_day is distinct from 0;
-- Welfare Avenue Hub: wave271 (271b), Task 6, 01/11/26. Notifications and reminders for HR onboarding automation.
-- 1. The notification centre's kind registry (hub_notification_kinds, wave245) learns three kinds, so each person has a Hub and a Slack switch for them:
--    onboard_date (the manager is told the new hire's call date and time), onboard_grid (the manager's link to mark their availability) and
--    onboard_remind (a grid still empty: HR about the new hire's, the manager about theirs). Nothing here is ever sent to the new hire.
-- 2. hub_onboard_flows remembers which manager got the grid link and when (manager_link_member_id, manager_link_sent_at), so the link goes once per manager
--    and the reminder counts its hours from it. reminded_hire_at and reminded_manager_at (271a) mark the reminders already sent.
-- 3. wa271_remind() calls the onboard-run action remind (through call_edge, as the other cron jobs do) and a pg_cron job runs it at 17 minutes past every hour.
-- Needs wa271a_onboard.sql first. Safe to run twice. Proved offline first: node test/w271sql.mjs (PGlite, with stand-ins for pg_cron and call_edge).
-- Undo: the first section of build/wa271a_undo.sql. Applying this sends nothing: the job only asks onboard-run, and onboard-run only writes to staff through notify.

-- 1. the three kinds (the group and the sort put them after the time off and applicant kinds in People and HR)
insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, example_title, example_body, example_url, hub, slack, email, channel_only, audience, sender, active, updated_at) values
('onboard_date', 'people', 'People and HR', 30, 'A new hire I manage has their onboarding call',
 'When HR presses Start onboarding for a new hire you manage. The onboarding call is booked then, and the date of that call is their first day.',
 'Who is starting and in what role, the date and time of the onboarding call, and a link to Onboarding in the HR centre.',
 'Alex Tremblay starts 2026-11-02', 'Alex Tremblay (Program Coordinator) has their onboarding call on Monday, November 2, 2026 at 10:00 a.m. That is their first day. Open Onboarding.', '#hrcentre/onboarding',
 true, true, false, false, 'the new hire''s manager', 'onboard-run, notify', true, now()),
('onboard_grid', 'people', 'People and HR', 40, 'A new hire I manage needs my availability',
 'Soon after a new hire accepts their offer, once the Hub can tell who their manager is or HR has confirmed one (and again, to the new manager, if HR changes the manager). One message for each manager.',
 'Who is joining and in what role, and your own link to mark when you are free for your 1-on-1 with them. The link needs no sign-in.',
 'Mark your availability for Alex Tremblay', 'Alex Tremblay (Program Coordinator) is joining. Please mark when you are free for your 1-on-1 with them. It takes a minute. Mark my availability.', '#hrcentre/onboarding',
 true, true, false, false, 'the new hire''s manager', 'onboard-run, notify', true, now()),
('onboard_remind', 'people', 'People and HR', 50, 'An availability grid is still empty after two days',
 'After onboard_remind_hours (48 by default): HR hears that a new hire has not marked their availability, and the manager hears that theirs is still empty. One reminder each for each new hire. The new hire is never sent a reminder by the Hub.',
 'Who has not marked their grid and for how long, and a link to Onboarding in the HR centre (for HR) or to your own grid (for the manager).',
 'Alex Tremblay has not marked their availability', 'Alex Tremblay (Program Coordinator) has not marked their availability yet (they accepted on 2026-10-15). Open Onboarding to send the link again or pick a time.', '#hrcentre/onboarding',
 true, true, false, false, 'the HR notify list (for the new hire''s grid) and the manager (for theirs)', 'onboard-run, notify', true, now())
on conflict (key) do update set grp = excluded.grp, grp_title = excluded.grp_title, sort = excluded.sort, title = excluded.title, blurb = excluded.blurb, says = excluded.says,
  example_title = excluded.example_title, example_body = excluded.example_body, example_url = excluded.example_url, hub = excluded.hub, slack = excluded.slack, email = excluded.email,
  channel_only = excluded.channel_only, audience = excluded.audience, sender = excluded.sender, active = excluded.active, updated_at = now();

-- 2. who got the manager's grid link, and when
alter table public.hub_onboard_flows add column if not exists manager_link_member_id bigint references public.team_members (id) on delete set null;
alter table public.hub_onboard_flows add column if not exists manager_link_sent_at timestamptz;
create index if not exists hub_onboard_flows_manager_link_idx on public.hub_onboard_flows (manager_link_member_id) where manager_link_member_id is not null;   -- its foreign key, as the release checklist asks
comment on column public.hub_onboard_flows.manager_link_member_id is 'wave271b: the manager (team_members.id) who was sent the link to mark their availability grid. If HR confirms a different manager, the link goes to the new one too and the reminder starts again.';
comment on column public.hub_onboard_flows.manager_link_sent_at is 'wave271b: when that link was sent. Null until then. The manager''s reminder counts onboard_remind_hours from here.';
grant select (manager_link_member_id, manager_link_sent_at) on public.hub_onboard_flows to authenticated;   -- as every column but pw_nonce (271a); the service key has it all

-- 3. the hourly job: onboard-run action remind. Only the service key and the cron job call it.
create or replace function public.wa271_remind()
returns bigint language sql security definer set search_path to '' as $function$
  select public.call_edge('onboard-run', '{"action":"remind"}'::jsonb)
$function$;
revoke all on function public.wa271_remind() from public, anon, authenticated;
grant execute on function public.wa271_remind() to service_role;
comment on function public.wa271_remind() is 'wave271b: asks the onboard-run edge function to run its action remind (through call_edge, with the trigger secret): tell each manager their grid link once, then remind HR about a new hire''s empty grid and the manager about theirs after onboard_remind_hours, each once. Returns the request id. Run hourly by the cron job wa-onboard-remind. Access: service role only.';

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'wa-onboard-remind') then perform cron.unschedule('wa-onboard-remind'); end if;
  perform cron.schedule('wa-onboard-remind', '17 * * * *', 'select public.wa271_remind()');
end $cron$;
-- Welfare Avenue Hub: wave271 (271c), 01/11/26. The lead's card before day one: the onboarding call date can be ahead, so wa166_person_card also says starts_on
-- (the Toronto date is still before onboardings.started_at; null from day one on) and the page says "Starts on <date>" in place of "Day 1".
-- One line changes from build/data/wa167c_lead_photo.sql: 'starts_on'. Safe to run twice. Undo: build/wa271a_undo.sql puts the wa167c body back.
create or replace function public.wa166_person_card(p_onb bigint, p_via text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  with ob as (
    select o.id, o.member_id, o.person_name, o.started_at, o.status, tm.email, tm.department, nullif(tm.avatar_url, '') as avatar_url,
           (select pos.title from public.org_positions pos where pos.member_id = o.member_id order by pos.id limit 1) as title
    from public.onboardings o join public.team_members tm on tm.id = o.member_id where o.id = p_onb
  ),
  st as (
    select s.id, s.done, s.done_at, s.due_date, t.section, t.name, t.parent_id, t.sort, coalesce(pt.sort, t.sort) as psort, t.academy_path, t.training_id, t.priority,
           case t.section when 'WEEK 1' then 1 when 'WEEK 2' then 2 when 'WEEK 3' then 3 when 'WEEK 4' then 4 when '60 DAYS' then 5 when '90 DAYS' then 6 when '6 MONTHS' then 7 else 9 end as rank
    from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id and t.active
    left join public.onboarding_template pt on pt.id = t.parent_id
    where s.onboarding_id = p_onb
  ),
  sec as (select section, min(rank) as rank, count(*)::int as total, count(*) filter (where done)::int as done, min(due_date) filter (where not done) as due from st group by section),
  hs as (
    select h.id, h.done, h.done_at, h.done_by, t.name, t.description, t.due_day, t.sort, (select started_at from ob) + coalesce(t.due_day, 0) as due
    from public.hr_setup_steps h join public.hr_setup_template t on t.id = h.template_id and t.active
    where h.onboarding_id = p_onb and t.who = 'lead'
  )
  select jsonb_build_object(
    'onboarding_id', ob.id, 'member_id', ob.member_id, 'name', ob.person_name, 'email', ob.email, 'department', ob.department, 'title', ob.title, 'via', p_via, 'avatar_url', ob.avatar_url,
    'started_at', ob.started_at, 'day', greatest(1, ((now() at time zone 'America/Toronto')::date - ob.started_at) + 1),
    'starts_on', case when ob.started_at > (now() at time zone 'America/Toronto')::date then ob.started_at end,
    'done', (select count(*) from st where done), 'total', (select count(*) from st),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('name', section, 'done', done, 'total', total, 'due', due) order by rank, section) from sec), '[]'::jsonb),
    'late_count', (select count(*) from st where not coalesce(done, false) and due_date < (now() at time zone 'America/Toronto')::date),
    'late', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'due', x.due_date, 'section', x.section) order by x.due_date, x.rank, x.psort, x.sort)
                      from (select * from st where not coalesce(done, false) and due_date < (now() at time zone 'America/Toronto')::date order by due_date, rank, psort, sort limit 6) x), '[]'::jsonb),
    'next', (select jsonb_build_object('name', name, 'due', due_date, 'section', section) from st where not coalesce(done, false) order by rank, psort, parent_id nulls first, sort limit 1),
    'last_done_at', (select max(done_at) from st),
    'steps', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'section', section, 'child', parent_id is not null, 'done', coalesce(done, false), 'due', due_date,
                                                            'academy', academy_path is not null or training_id is not null, 'important', priority = 'high')
                              order by rank, psort, parent_id nulls first, sort) from st), '[]'::jsonb),
    'quizzes_done', (select count(*) from st where done and training_id is null and academy_path is null and name in ('Policy quiz', '30 day quiz'))::int,
    'lead_steps', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'description', description, 'due', due, 'done', coalesce(done, false), 'done_at', done_at, 'done_by', done_by) order by due, sort) from hs), '[]'::jsonb),
    'help', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'step', h.step_name, 'note', h.note, 'at', h.created_at) order by h.created_at)
                      from public.onboarding_help h where h.onboarding_id = p_onb and coalesce(h.status, 'open') = 'open'), '[]'::jsonb),
    'academy', jsonb_build_array(public.wa166_path_state(ob.member_id, 'hub'), public.wa166_path_state(ob.member_id, 'foundations'),
                                 public.wa166_path_state(ob.member_id, 'branding'), public.wa166_path_state(ob.member_id, 'team'))
  ) from ob;
$function$;
revoke all on function public.wa166_person_card(bigint, text) from public, anon, authenticated;
comment on function public.wa166_person_card(bigint, text) is 'wave166, wave271: one onboarding as a lead sees it: the plan by week, what is late and next, the lead''s moments, open help requests and the avenues, and starts_on, the first day while it is still ahead (null from that day on). Only through onboarding_lead_view.';

-- Welfare Avenue Hub: wave271 (271a), Task 1. Assertions for build/wa271a_onboard.sql.
-- Assumes the migration is already loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises.
-- Offline: node test/w271sql.mjs (PGlite, with test/w271schema.sql). On live, only at the release gate and only with Steel's yes:
-- paste this file into execute_sql once the migration has been applied; afterwards the test rows are gone.
-- Every row is invented (Test Person, example.invalid). Fixtures sit in the department code w271test so no real team is touched.

-- ---------------------------------------------------------------- fixtures
insert into public.hub_positions (title, dept) values ('Test Analyst', 'w271test'), ('Test Other', 'w271test'), ('Test Foreign', 'w271test');

insert into public.team_members (name, email, department, role) values
  ('Test Leader One', 'w271.lead1@example.invalid', 'w271test', 'Director'),
  ('Test Hire A', 'w271.hirea@example.invalid', 'w271test', 'Analyst'),
  ('Test Hire B', 'w271.hireb@example.invalid', 'w271test', 'Analyst');

insert into public.hub_roles (email, role) values
  ('w271.lead1@example.invalid', 'leader'),
  ('w271.staff@example.invalid', 'member');
insert into public.wa_hr_access (email) values ('w271.hr@example.invalid');

insert into public.org_positions (member_id, title, department, kind, status)
  select id, 'Test Director', 'w271test', 'staff', 'filled' from public.team_members where email = 'w271.lead1@example.invalid';
insert into public.org_positions (title, department, status, reports_to)
  select 'Test Analyst', 'w271test', 'hiring', id from public.org_positions where title = 'Test Director' and department = 'w271test';

insert into public.hub_candidates (name, email, status, position_id, offer_respond_by) values
  ('Test Person One', 'w271.one@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Analyst' and dept = 'w271test'), date '2026-11-10');
insert into public.hub_candidates (name, email, status, position_id, practice) values
  ('Test Person Practice', 'w271.practice@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Other' and dept = 'w271test'), true);
insert into public.hub_candidates (name, email, status, position_id) values
  ('Test Person Twin Early', 'w271.twin@example.invalid', 'reviewing', (select id from public.hub_positions where title = 'Test Other' and dept = 'w271test')),
  ('Test Person Twin Late', 'w271.twin@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Analyst' and dept = 'w271test'));
insert into public.org_positions (title, department, status, reports_to)
  select 'Test Foreign', 'w271elsewhere', 'hiring', id from public.org_positions where title = 'Test Director' and department = 'w271test';   -- same title, another department: must not match
insert into public.hub_candidates (name, email, status) values ('Test Person No Role', 'w271.norole@example.invalid', 'offer');
insert into public.hub_candidates (name, email, status, position_id) values
  ('Test Person Foreign', 'w271.foreign@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Foreign' and dept = 'w271test'));

-- the Hub staff member who runs everything below (an HR person); the claims are read by auth.jwt() as on live
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.hr@example.invalid"}', true);

-- ---------------------------------------------------------------- the objects, comments and access rules
do $$
declare n int;
begin
  assert to_regclass('public.hub_onboard_flows') is not null and to_regclass('public.hub_onboard_grids') is not null
     and to_regclass('public.hub_onboard_steps') is not null, 'the three tables exist';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'offer_respond_by' and data_type = 'date'), 'offer_respond_by is a date';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'offer_start' and data_type = 'date'), 'offer_start is a date';

  -- COMMENT on every new table, column and function (release checklist)
  select count(*) into n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('hub_onboard_flows', 'hub_onboard_grids', 'hub_onboard_steps') and obj_description(c.oid, 'pg_class') is null;
  assert n = 0, 'every new table has a comment';
  select count(*) into n from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and c.relname in ('hub_onboard_flows', 'hub_onboard_grids', 'hub_onboard_steps') and a.attnum > 0 and not a.attisdropped and col_description(a.attrelid, a.attnum) is null;
  assert n = 0, format('%s new columns have no comment', n);
  select count(*) into n from pg_attribute a where a.attrelid = 'public.hub_candidates'::regclass and a.attname in ('offer_respond_by', 'offer_start') and col_description(a.attrelid, a.attnum) is null;
  assert n = 0, 'the two offer columns have a comment';
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'wa271\_%' or (p.proname = 'onboarding_assign')) and obj_description(p.oid, 'pg_proc') is null;
  assert n = 0, format('%s wa271 functions or onboarding_assign have no comment', n);

  -- row security on, reads for HR and admins only, nothing written from the browser
  select count(*) into n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('hub_onboard_flows', 'hub_onboard_grids', 'hub_onboard_steps') and c.relrowsecurity;
  assert n = 3, 'row security is on for all three tables';
  assert not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'insert') and not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'update')
     and not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'delete'), 'no direct writes to flows';
  assert not has_table_privilege('authenticated', 'public.hub_onboard_grids', 'insert') and not has_table_privilege('authenticated', 'public.hub_onboard_grids', 'update')
     and not has_table_privilege('authenticated', 'public.hub_onboard_grids', 'delete'), 'no direct writes to grids';
  assert not has_table_privilege('authenticated', 'public.hub_onboard_steps', 'insert') and not has_table_privilege('authenticated', 'public.hub_onboard_steps', 'update')
     and not has_table_privilege('authenticated', 'public.hub_onboard_steps', 'delete'), 'no direct writes to steps';
  assert not has_table_privilege('anon', 'public.hub_onboard_flows', 'select') and not has_table_privilege('anon', 'public.hub_onboard_grids', 'select')
     and not has_table_privilege('anon', 'public.hub_onboard_steps', 'select'), 'a signed-out visitor reads nothing';
  assert not has_column_privilege('authenticated', 'public.hub_onboard_flows', 'pw_nonce', 'select'), 'the password-link nonce never reaches the browser';
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'status', 'select'), 'HR can read the flow columns that are not secret';

  -- functions: signed-in people and the service key, never a signed-out visitor
  assert not has_function_privilege('anon', 'public.wa271_ready_list()', 'execute') and has_function_privilege('authenticated', 'public.wa271_ready_list()', 'execute'), 'ready list grants';
  assert not has_function_privilege('anon', 'public.wa271_default_manager(bigint)', 'execute') and has_function_privilege('authenticated', 'public.wa271_default_manager(bigint)', 'execute'), 'default manager grants';
  assert not has_function_privilege('anon', 'public.wa271_move_start(bigint, date)', 'execute') and has_function_privilege('authenticated', 'public.wa271_move_start(bigint, date)', 'execute'), 'move start grants';
  assert not has_function_privilege('anon', 'public.wa271_cand_accepted()', 'execute') and not has_function_privilege('authenticated', 'public.wa271_cand_accepted()', 'execute'), 'the trigger function is not callable';
  assert to_regprocedure('public.onboarding_assign(bigint,text)') is null, 'the 2-argument onboarding_assign is gone';
  assert to_regprocedure('public.onboarding_assign(bigint,text,date)') is not null, 'the dated onboarding_assign exists';
  assert not has_function_privilege('anon', 'public.onboarding_assign(bigint,text,date)', 'execute') and has_function_privilege('authenticated', 'public.onboarding_assign(bigint,text,date)', 'execute')
     and has_function_privilege('service_role', 'public.onboarding_assign(bigint,text,date)', 'execute'), 'onboarding_assign keeps its grants';
end $$;

-- the checks on the new tables
do $$
declare v_cand bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_ok boolean;
begin
  insert into public.hub_onboard_flows (candidate_id) values (v_cand);   -- default status
  assert (select status from public.hub_onboard_flows where candidate_id = v_cand) = 'waiting', 'a new flow waits';
  begin update public.hub_onboard_flows set status = 'nonsense' where candidate_id = v_cand; v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a flow status outside the five is refused';
  begin insert into public.hub_onboard_flows (candidate_id) values (v_cand); v_ok := false; exception when unique_violation then v_ok := true; end;
  assert v_ok, 'one flow per candidate';
  begin insert into public.hub_onboard_grids (flow_id, who) values ((select id from public.hub_onboard_flows where candidate_id = v_cand), 'boss'); v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a grid belongs to the hire or the manager';
  begin insert into public.hub_onboard_steps (flow_id, step, status) values ((select id from public.hub_onboard_flows where candidate_id = v_cand), 'nope', 'done'); v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a step key outside the eight is refused';
  begin insert into public.hub_onboard_steps (flow_id, step, status) values ((select id from public.hub_onboard_flows where candidate_id = v_cand), 'roster', 'finished'); v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a step status outside the seven is refused';
  delete from public.hub_onboard_flows where candidate_id = v_cand;   -- the trigger tests start from a clean candidate
end $$;

-- ---------------------------------------------------------------- settings
do $$
declare n int;
begin
  select count(*) into n from public.app_config where (key, value) in (
    ('onboard_grid_days', '14'), ('onboard_grid_start', '8'), ('onboard_grid_end', '21'), ('onboard_grid_cell_min', '30'), ('onboard_call_min', '60'),
    ('onboard_one_on_one_min', '30'), ('onboard_remind_hours', '48'), ('onboard_password_days', '7'), ('onboard_auto_google', 'off'), ('onboard_auto_slack', 'off'));
  assert n = 10, format('%s of the 10 fixed onboard_ settings have their default', n);
  select count(*) into n from public.app_config where key in ('onboard_slack_join_link', 'onboard_google_video');
  assert n = 2, 'the two link settings exist';
  assert not exists (select 1 from public.app_config where key = 'onboard_canva_link'), 'no Canva link in settings: HR pastes a fresh one for each hire';
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'canva_link', 'select'), 'HR can read the link on the flow';
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'welcome_edited', 'select'), 'HR can read whose welcome text is saved';
  assert col_description('public.hub_onboard_flows'::regclass, (select attnum from pg_attribute where attrelid = 'public.hub_onboard_flows'::regclass and attname = 'canva_link')) like '%30 days%', 'canva_link says why it is on the flow';

  -- the onboarding call is day one
  assert (select count(*) from public.hr_setup_template where phase = 'The onboarding call') > 0, 'the onboarding call phase exists';
  assert (select count(*) from public.hr_setup_template where phase = 'The onboarding call' and due_day is distinct from 0) = 0, 'The onboarding call phase is due on day 0';
  assert (select count(*) from public.hr_setup_template where phase = 'Manager follow-through' and due_day is null) = 0, 'the other phases keep their days';
end $$;

-- ---------------------------------------------------------------- accepting an offer starts one waiting flow
do $$
declare v_cand bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_prac bigint := (select id from public.hub_candidates where name = 'Test Person Practice');
begin
  assert (select count(*) from public.hub_onboard_flows where candidate_id in (v_cand, v_prac)) = 0, 'no flow before an acceptance';
  update public.hub_candidates set status = 'offer', notes = 'edited' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 0, 'an edit that is not an acceptance starts nothing';

  update public.hub_candidates set accepted_on = date '2026-11-12' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 1, 'the acceptance creates exactly one flow';
  assert (select status from public.hub_onboard_flows where candidate_id = v_cand) = 'waiting', 'the new flow is waiting';
  assert (select practice from public.hub_onboard_flows where candidate_id = v_cand) = false, 'a real candidate is not practice';

  update public.hub_candidates set accepted_on = date '2026-11-13' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 1, 'a second update creates none';
  update public.hub_candidates set accepted_on = null where id = v_cand;
  update public.hub_candidates set accepted_on = date '2026-11-12' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 1, 'accepting again after a clearing still leaves one flow';

  update public.hub_candidates set accepted_on = date '2026-11-12' where id = v_prac;
  assert (select practice from public.hub_onboard_flows where candidate_id = v_prac) = true, 'a practice candidate gets a practice flow';
end $$;

-- ---------------------------------------------------------------- two rows, one person
do $$
declare v_early bigint := (select id from public.hub_candidates where name = 'Test Person Twin Early'); v_late bigint := (select id from public.hub_candidates where name = 'Test Person Twin Late');
        e jsonb;
begin
  update public.hub_candidates set accepted_on = date '2026-11-14' where id = v_late;
  assert (select count(*) from public.hub_onboard_flows where candidate_id in (v_early, v_late)) = 1, 'only one flow for the two rows';
  assert (select candidate_id from public.hub_onboard_flows where candidate_id in (v_early, v_late)) = v_late, 'the flow is on the accepted row';
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_late;
  assert e is not null, 'the accepted row is on the ready list';
  assert (e ->> 'other_open_rows')::int = 1, format('other_open_rows is 1, got %s', e ->> 'other_open_rows');
  update public.hub_candidates set status = 'withdrawn' where id = v_early;
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_late;
  assert (e ->> 'other_open_rows')::int = 0, 'a withdrawn twin no longer counts';
  update public.hub_candidates set status = 'reviewing' where id = v_early;
end $$;

-- ---------------------------------------------------------------- the ready list
do $$
declare v_one bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_late bigint := (select id from public.hub_candidates where name = 'Test Person Twin Late');
        v_prac bigint := (select id from public.hub_candidates where name = 'Test Person Practice'); e jsonb; v_flow bigint;
begin
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one;
  assert e ->> 'name' = 'Test Person One' and e ->> 'email' = 'w271.one@example.invalid', 'name and personal email are listed';
  assert e ->> 'status' = 'waiting' and (e ->> 'practice')::boolean = false, 'status and practice are listed';
  assert e ->> 'accepted_on' = '2026-11-12' and e ->> 'offer_respond_by' = '2026-11-10', 'the offer dates are listed';
  assert (e ->> 'late')::boolean = true, 'accepted after the respond-by date is late';
  assert e -> 'grids' ->> 'hire' = 'none' and e -> 'grids' ->> 'manager' = 'none', 'no grid yet';
  assert e -> 'default_manager' ->> 'how' = 'reports_to', 'the default manager comes with the row';
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_late;
  assert (e ->> 'late')::boolean = false, 'no respond-by date means not late';

  select id into v_flow from public.hub_onboard_flows where candidate_id = v_one;
  insert into public.hub_onboard_grids (flow_id, who, slots) values (v_flow, 'hire', array[timestamptz '2026-11-20 15:00+00', timestamptz '2026-11-20 15:30+00']);
  insert into public.hub_onboard_grids (flow_id, who) values (v_flow, 'manager');
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one;
  assert e -> 'grids' ->> 'hire' = 'marked' and e -> 'grids' ->> 'manager' = 'none', 'a grid with times is marked, an empty one is not';

  -- once started or backed out, a flow leaves the list
  update public.hub_onboard_flows set status = 'running' where candidate_id = v_one;
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a running flow stays on the list';
  update public.hub_onboard_flows set status = 'started' where candidate_id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a started flow leaves the list';
  update public.hub_onboard_flows set status = 'backed_out' where candidate_id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a backed-out flow leaves the list';
  update public.hub_onboard_flows set status = 'waiting' where candidate_id = v_one;
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_prac), 'the practice flow is listed too, marked as practice';

  -- a closed card leaves the list, and comes back if the card opens again
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'an open card is listed';
  update public.hub_candidates set status = 'withdrawn' where id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a withdrawn card leaves the list';
  update public.hub_candidates set status = 'declined' where id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a declined card leaves the list';
  update public.hub_candidates set status = 'offer' where id = v_one;

  -- someone with an open plan (the roster dropdown) leaves the list, found by the card's profile or by the personal email
  insert into public.team_members (name, email) values ('Test Person One Roster', 'W271.One@example.invalid');
  insert into public.onboardings (member_id, person_name, started_at) select id, name, current_date from public.team_members where name = 'Test Person One Roster';
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'an open plan found by the personal email takes them off the list';
  update public.onboardings set completed_at = now() where person_name = 'Test Person One Roster';
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a finished plan does not count';
  update public.onboardings set completed_at = null where person_name = 'Test Person One Roster';
  update public.team_members set email = 'w271.other@example.invalid' where name = 'Test Person One Roster';
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'someone else''s plan does not count';
  update public.hub_candidates set member_id = (select id from public.team_members where name = 'Test Person One Roster') where id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'an open plan found by the card''s profile takes them off the list';
  update public.hub_candidates set member_id = null where id = v_one;
  delete from public.onboardings where person_name = 'Test Person One Roster';
  delete from public.team_members where name = 'Test Person One Roster';

  -- roster_created: the browser may read it, and it starts empty
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'roster_created', 'select'), 'HR can read roster_created';
  assert (select roster_created from public.hub_onboard_flows where candidate_id = v_one) is null, 'nothing is known until the roster step runs';
end $$;

-- ---------------------------------------------------------------- the default manager
do $$
declare v_one bigint := (select id from public.hub_candidates where name = 'Test Person One');          -- position Test Analyst: an org position reports to Test Leader One
        v_other bigint := (select id from public.hub_candidates where name = 'Test Person Practice');   -- position Test Other: no org position
        v_norole bigint := (select id from public.hub_candidates where name = 'Test Person No Role');
        v_foreign bigint := (select id from public.hub_candidates where name = 'Test Person Foreign');   -- an org position with this title exists, but in another department
        v_lead bigint := (select id from public.team_members where email = 'w271.lead1@example.invalid'); r jsonb;
begin
  r := public.wa271_default_manager(v_one);
  assert r ->> 'how' = 'reports_to' and (r ->> 'member_id')::bigint = v_lead and r ->> 'name' = 'Test Leader One', format('reports_to, got %s', r);

  r := public.wa271_default_manager(v_other);
  assert r ->> 'how' = 'team_lead' and (r ->> 'member_id')::bigint = v_lead, format('team_lead for exactly one leader, got %s', r);

  r := public.wa271_default_manager(v_foreign);
  assert r ->> 'how' = 'team_lead', format('an org position in another department does not match, got %s', r);

  insert into public.team_members (name, email, department, role) values ('Test Leader Two', 'w271.lead2@example.invalid', 'w271test', 'Director');
  insert into public.hub_roles (email, role) values ('w271.lead2@example.invalid', 'leader');
  r := public.wa271_default_manager(v_other);
  assert r ->> 'how' = 'none' and (r -> 'member_id') = 'null'::jsonb, format('none for two leaders, got %s', r);
  r := public.wa271_default_manager(v_one);
  assert r ->> 'how' = 'reports_to' and (r ->> 'member_id')::bigint = v_lead, 'a reporting line wins over two leaders';

  r := public.wa271_default_manager(v_norole);
  assert r ->> 'how' = 'none', 'a candidate with no position has no default';
  r := public.wa271_default_manager(-1);
  assert r ->> 'how' = 'none', 'an unknown candidate has no default';

  -- a leader who has left is not a leader of the department
  update public.team_members set active = false where email = 'w271.lead2@example.invalid';
  r := public.wa271_default_manager(v_other);
  assert r ->> 'how' = 'team_lead' and (r ->> 'member_id')::bigint = v_lead, 'an inactive leader does not count';
  -- the person at the top of the reporting line has left, and no leader is left in the department either
  update public.team_members set active = false where id = v_lead;
  r := public.wa271_default_manager(v_one);
  assert r ->> 'how' = 'none', 'a reporting line that ends at someone who left gives no default';
  update public.team_members set active = true where id = v_lead;
end $$;

-- ---------------------------------------------------------------- onboarding_assign takes a start date, and a move keeps the plan in step
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.staff@example.invalid"}', true);   -- onboarding_assign wants a staff member

do $$
declare m_a bigint := (select id from public.team_members where email = 'w271.hirea@example.invalid'); m_b bigint := (select id from public.team_members where email = 'w271.hireb@example.invalid');
        v_a bigint; v_b bigint;
begin
  v_a := public.onboarding_assign(m_a, 'x');
  assert (select started_at from public.onboardings where id = v_a) = current_date, 'two arguments still start today';
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_a) > 0, 'the plan has steps';
  assert (select bool_and(s.due_date = current_date + 7) from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_a and t.section = 'WEEK 1'), 'week 1 is due 7 days after today';
  assert (select count(*) from public.hr_setup_steps where onboarding_id = v_a) > 0, 'the HR checklist is copied';

  v_b := public.onboarding_assign(m_b, 'x', date '2026-12-07');
  assert (select started_at from public.onboardings where id = v_b) = date '2026-12-07', 'a dated plan starts on that day';
  assert (select count(*) from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 1') > 0, 'there is a week 1 step';
  assert (select bool_and(s.due_date = date '2026-12-14') from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 1'), 'week 1 is due 2026-12-14';
  assert (select assigned_by from public.onboardings where id = v_b) = 'x' and (select person_name from public.onboardings where id = v_b) = 'Test Hire B', 'name and assigner are kept';
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.hr@example.invalid"}', true);

do $$
declare m_b bigint := (select id from public.team_members where email = 'w271.hireb@example.invalid'); v_b bigint := (select id from public.onboardings where member_id = m_b);
        v_cand bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_done bigint; v_w2 date;
begin
  -- the candidate and the plan are tied together by the flow
  update public.hub_onboard_flows set onboarding_id = v_b where candidate_id = v_cand;
  update public.hub_candidates set start_date = date '2026-12-07' where id = v_cand;
  update public.team_members set start_date = date '2026-12-07', start_source = 'google' where id = m_b;
  -- one step is already done
  select s.id into v_done from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 1' order by s.id limit 1;
  update public.onboarding_steps set done = true, done_at = now(), done_by = 'x' where id = v_done;

  perform public.wa271_move_start(v_b, date '2026-12-14');

  assert (select started_at from public.onboardings where id = v_b) = date '2026-12-14', 'started_at moved';
  assert (select due_date from public.onboarding_steps where id = v_done) = date '2026-12-14', 'a step already done keeps its due date';
  assert (select bool_and(s.due_date = date '2026-12-21') from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
           where s.onboarding_id = v_b and t.section = 'WEEK 1' and s.id <> v_done), 'steps not done move with the start';
  select s.due_date into v_w2 from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 2' limit 1;
  assert v_w2 = date '2026-12-28', 'other sections move by the same amount';
  assert (select start_date from public.team_members where id = m_b) = date '2026-12-14', 'team_members.start_date moved';
  assert (select start_source from public.team_members where id = m_b) = 'manual', 'the moved date is marked manual so the directory sync leaves it alone';
  assert (select start_date from public.hub_candidates where id = v_cand) = date '2026-12-14', 'hub_candidates.start_date moved';
  assert (select count(*) from public.change_log where entity_type = 'onboardings' and entity_id = v_b::text and field = 'started_at' and old_value = '2026-12-07' and new_value = '2026-12-14') = 1, 'the move is logged';

  -- a plan with no flow (assigned from the roster dropdown) still moves
  perform public.wa271_move_start((select id from public.onboardings where member_id = (select id from public.team_members where email = 'w271.hirea@example.invalid')), date '2027-01-11');
  assert (select start_date from public.team_members where email = 'w271.hirea@example.invalid') = date '2027-01-11', 'a plan without a flow moves too';

  begin perform public.wa271_move_start(-1, date '2027-01-11'); assert false, 'unreachable'; exception when raise_exception then assert sqlerrm like '%not found%', 'an unknown plan is refused'; end;
  begin perform public.wa271_move_start(v_b, null); assert false, 'unreachable'; exception when raise_exception then assert sqlerrm like '%date%', 'a missing date is refused'; end;
end $$;

-- ---------------------------------------------------------------- who can read and call what
insert into public.hub_onboard_steps (flow_id, step, status, practice) select id, 'roster', 'done', practice from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Practice');

-- HR: reads all three, cannot write
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.hr@example.invalid"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  assert (select count(*) from public.hub_onboard_flows) >= 3, 'HR reads the flows';
  assert (select count(*) from public.hub_onboard_grids) >= 2, 'HR reads the grids';
  assert (select count(*) from public.hub_onboard_steps) >= 1, 'HR reads the steps';
  assert jsonb_array_length(public.wa271_ready_list()) >= 3, 'HR gets the ready list';
  begin perform pw_nonce from public.hub_onboard_flows; v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'HR cannot read pw_nonce';
  begin insert into public.hub_onboard_flows (candidate_id) values ((select id from public.hub_candidates where name = 'Test Person No Role')); v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'HR cannot write a flow directly';
end $$;
reset role;

-- an admin who is not in HR also reads (is_hub_admin)
insert into public.hub_roles (email, role) values ('w271.admin@example.invalid', 'admin');
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.admin@example.invalid"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.hub_onboard_flows) >= 3, 'an admin reads the flows';
  assert jsonb_array_length(public.wa271_ready_list()) >= 3, 'an admin gets the ready list';
end $$;
reset role;

-- someone signed in who is neither HR nor an admin: no rows, and the functions refuse
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.staff@example.invalid"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  assert (select count(*) from public.hub_onboard_flows) = 0, 'a staff member who is not HR reads no flows';
  assert (select count(*) from public.hub_onboard_grids) = 0, 'a staff member who is not HR reads no grids';
  assert (select count(*) from public.hub_onboard_steps) = 0, 'a staff member who is not HR reads no steps';
  begin perform public.wa271_ready_list(); v_ok := false; exception when raise_exception then v_ok := true; end;
  assert v_ok, 'wa271_ready_list raises for a non-HR person';
  begin perform public.wa271_default_manager(1); v_ok := false; exception when raise_exception then v_ok := true; end;
  assert v_ok, 'wa271_default_manager raises for a non-HR person';
  begin perform public.wa271_move_start(1, date '2027-01-01'); v_ok := false; exception when raise_exception then v_ok := true; end;
  assert v_ok, 'wa271_move_start raises for a non-HR person';
end $$;
reset role;

-- a visitor with no sign-in at all
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_ok boolean;
begin
  begin perform count(*) from public.hub_onboard_flows; v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'a signed-out visitor cannot read the flows';
  begin perform public.wa271_ready_list(); v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'a signed-out visitor cannot call the ready list';
end $$;
reset role;

-- the service key (edge functions) may call them
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
begin
  assert jsonb_array_length(public.wa271_ready_list()) >= 3, 'the service key gets the ready list';
end $$;

select 'w271sql: all assertions passed' as result;

rollback;
