-- wa167c_lead_photo (29/09/26): the leads' card on Home shows the new person's photo (wave167: photos everywhere in onboarding).
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

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260929095000', 'wa167c_lead_photo', array[$m$create or replace function public.wa166_person_card(p_onb bigint, p_via text)
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
$function$$m$,$m$revoke all on function public.wa166_person_card(bigint, text) from public, anon, authenticated$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
