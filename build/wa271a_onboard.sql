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
comment on column public.hub_onboard_flows.welcome_subject is 'The welcome email subject HR edited in the preview. Never holds a password.';
comment on column public.hub_onboard_flows.welcome_text is 'The welcome email body HR edited in the preview. Never holds a password.';
comment on column public.hub_onboard_flows.pw_nonce is 'Signs the one-time password link. A secret: left out of the browser column grants, read only by edge functions with the service key.';
comment on column public.hub_onboard_flows.pw_expires_at is 'When the one-time password link stops working (onboard_password_days after it was made).';
comment on column public.hub_onboard_flows.pw_used_at is 'When the new hire opened the one-time password page. Set once; a second open shows nothing.';
comment on column public.hub_onboard_flows.reminded_hire_at is 'When HR was last reminded that the new hire has not marked a grid (onboard_remind_hours).';
comment on column public.hub_onboard_flows.reminded_manager_at is 'When the manager was last reminded to mark their grid (onboard_remind_hours).';
comment on column public.hub_onboard_flows.started_by is 'Who pressed Start onboarding (email).';
comment on column public.hub_onboard_flows.started_at is 'When Start onboarding finished.';
comment on column public.hub_onboard_flows.created_at is 'When the acceptance created the flow.';
comment on column public.hub_onboard_flows.updated_at is 'Last change; set by whoever writes the row.';

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
              slack_channel_id, slack_user_id, welcome_subject, welcome_text, pw_expires_at, pw_used_at, reminded_hire_at, reminded_manager_at, started_by, started_at, created_at, updated_at)
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

-- 9. the Ready to onboard list: flows that have not started and have not backed out
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
       where f.status not in ('started', 'backed_out')) x
  ), '[]'::jsonb);
end $function$;
revoke all on function public.wa271_ready_list() from public, anon;
grant execute on function public.wa271_ready_list() to authenticated, service_role;
comment on function public.wa271_ready_list() is 'wave271: the HR Center Ready to onboard list as jsonb: every flow not started or backed out, with name, role, personal email, offer dates, late (answered after the respond-by date), grid statuses (none or marked), the default manager and other_open_rows (other applications with the same email that are not declined or withdrawn). HR, admins and the service key only; raises for anyone else.';

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
  ('onboard_canva_link', ''), ('onboard_slack_join_link', ''), ('onboard_google_video', '')
on conflict (key) do nothing;

-- the onboarding call is day one, so its checklist steps are due on day 0 (they were day 3)
update public.hr_setup_template set due_day = 0 where phase = 'The onboarding call' and due_day is distinct from 0;
