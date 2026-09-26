-- wave134 (audit, 26/09/26): a schema an AI agent or a developer can read and trust.
-- Additive only: no table or column is dropped or renamed, no row is deleted.

-- 1. dept_meta says what each team code means (label, short label, menu order, colour), so code and agents
--    can read it instead of the 27 label maps in the page and the edge functions
alter table public.dept_meta add column if not exists label text;
alter table public.dept_meta add column if not exists short_label text;
alter table public.dept_meta add column if not exists sort smallint;
alter table public.dept_meta add column if not exists color text;
update public.dept_meta m set label = v.label, short_label = v.short_label, sort = v.sort, color = v.color
from (values
  ('opsmtl', 'Operations Montreal', 'Ops Montreal', 1, '#103F39'),
  ('progdev', 'Program Development', 'Program Dev', 2, '#2A8C7A'),
  ('opsto', 'Operations Toronto', 'Ops Toronto', 3, '#3A6EA5'),
  ('marketing', 'Marketing, Branding & Web', 'Marketing', 4, '#6F64AB'),
  ('fundraising', 'Fundraising & Finances', 'Fundraising & Finances', 5, '#C87A2F'),
  ('hr', 'Human Resources', 'HR', 6, '#B3402F'),
  ('board', 'Board & Governance', 'Board', 7, '#4A4F57')
) as v(code, label, short_label, sort, color)
where m.department = v.code;

-- 2. the one directory row that points at a roster id that no longer exists
update public.hub_directory d set member_id = null
where d.member_id is not null and not exists (select 1 from public.team_members m where m.id = d.member_id);

-- 3. foreign keys where every id already points somewhere (checked: no orphans), so the relationships
--    are visible to agents and kept by the database. Deleting a parent removes or unlinks what hangs off it.
do $$
declare r record; v_name text;
begin
  for r in select * from (values
    ('task_comments', 'task_id', 'dept_tasks', 'id', 'cascade'),
    ('task_due_suggestions', 'task_id', 'dept_tasks', 'id', 'cascade'),
    ('task_due_suggestions', 'transcript_id', 'transcripts', 'id', 'set null'),
    ('mentions', 'transcript_id', 'transcripts', 'id', 'cascade'),
    ('goal_wins', 'transcript_id', 'transcripts', 'id', 'set null'),
    ('request_suggestions', 'transcript_id', 'transcripts', 'id', 'cascade'),
    ('request_suggestions', 'request_id', 'dept_requests', 'id', 'set null'),
    ('request_suggestions', 'target_request_id', 'dept_requests', 'id', 'set null'),
    ('sop_event_extras', 'transcript_id', 'transcripts', 'id', 'set null'),
    ('transcript_request_scans', 'transcript_id', 'transcripts', 'id', 'cascade'),
    ('onboarding_update_acks', 'onboarding_id', 'onboardings', 'id', 'cascade'),
    ('onboarding_update_acks', 'template_id', 'onboarding_template', 'id', 'cascade'),
    ('sop_template', 'parent_id', 'sop_template', 'id', 'set null'),
    ('hub_roles', 'profile', 'hub_access_profiles', 'key', 'set null'),
    ('board_items', 'task_id', 'dept_tasks', 'id', 'set null'),
    ('fund_events', 'sop_training_id', 'trainings', 'id', 'set null'),
    ('hub_shoutouts', 'member_id', 'team_members', 'id', 'set null'),
    ('hub_directory', 'member_id', 'team_members', 'id', 'set null'),
    ('hub_directory', 'deactivated_member_id', 'team_members', 'id', 'set null'),
    ('dept_requests', 'mail_id', 'hub_mail', 'id', 'set null'),
    ('hub_candidates', 'mail_id', 'hub_mail', 'id', 'set null'),
    ('hub_mail', 'request_id', 'dept_requests', 'id', 'set null'),
    ('hub_candidates', 'request_id', 'dept_requests', 'id', 'set null'),
    ('dept_tasks', 'bank_project_id', 'projects', 'id', 'set null')
  ) as t(tbl, col, ref, refcol, del)
  loop
    v_name := r.tbl || '_' || r.col || '_fkey';
    if not exists (select 1 from pg_constraint where conname = v_name and conrelid = ('public.' || r.tbl)::regclass) then
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(%I) on update cascade on delete %s not valid',
                     r.tbl, v_name, r.col, r.ref, r.refcol, r.del);
      execute format('alter table public.%I validate constraint %I', r.tbl, v_name);
    end if;
  end loop;
end $$;

-- 4. an index on every single-column foreign key that has none (joins and cascades stay quick as the tables grow)
do $$
declare r record; v_idx text;
begin
  for r in
    select c.conrelid::regclass as tbl, cl.relname as tname, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and n.nspname = 'public' and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    v_idx := left('idx_' || r.tname || '_' || r.col, 63);
    execute format('create index if not exists %I on %s (%I)', v_idx, r.tbl, r.col);
  end loop;
end $$;

-- 5. the code-like columns whose values the code fixes get a CHECK, so the allowed values are in the schema
alter table public.hub_roles drop constraint if exists hub_roles_role_check;
alter table public.hub_roles add constraint hub_roles_role_check check (role in ('admin', 'leader', 'member', 'viewer', 'blocked')) not valid;
alter table public.hub_roles validate constraint hub_roles_role_check;
do $$
declare t text;
begin
  foreach t in array array['dept_tasks', 'dept_updates', 'decisions', 'transcripts', 'goal_wins', 'mentions'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'visibility') then
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_visibility_check');
      execute format('alter table public.%I add constraint %I check (visibility is null or visibility in (%L, %L, %L, %L)) not valid', t, t || '_visibility_check', '', 'department', 'leadership', 'private');
      execute format('alter table public.%I validate constraint %I', t, t || '_visibility_check');
    end if;
  end loop;
  foreach t in array array['social_posts', 'social_daily'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_platform_check');
    execute format('alter table public.%I add constraint %I check (platform in (%L, %L, %L, %L, %L, %L)) not valid', t, t || '_platform_check', 'facebook', 'instagram', 'tiktok', 'linkedin', 'ga4', 'youtube');
    execute format('alter table public.%I validate constraint %I', t, t || '_platform_check');
  end loop;
end $$;

-- 6. functions a signed-out visitor never needs (they ran with the owner's rights and no caller check)
create or replace function public.onboarding_assign(p_member_id bigint, p_by text)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare v_id bigint; v_name text; v_start date := current_date;
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
  return v_id;
end $function$;
revoke all on function public.onboarding_assign(bigint, text) from public, anon;
grant execute on function public.onboarding_assign(bigint, text) to authenticated, service_role;
-- ai_usage is read by the llm edge function (service role) for Admin > AI models
revoke all on function public.ai_usage(integer) from public, anon, authenticated;
grant execute on function public.ai_usage(integer) to service_role;
-- the serving checklist builders run from triggers and the import (both as the owner)
revoke all on function public.ensure_event_steps(bigint) from public, anon, authenticated;
revoke all on function public.sop_sync_all_events() from public, anon, authenticated;
grant execute on function public.ensure_event_steps(bigint) to service_role;
grant execute on function public.sop_sync_all_events() to service_role;
