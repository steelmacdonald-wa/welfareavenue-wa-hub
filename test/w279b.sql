-- Welfare Avenue Hub: wave279 (279b). Assertions for build/wa279b_template.sql.
-- Assumes wa279a and test/w279live_template.sql are loaded and wa279b has been applied. One transaction, ends with a rollback; any failed assertion raises.
-- Offline: node test/w279sql.mjs. Every person is invented (example.invalid).

begin;

-- the generic fixture rows (t-w1, t-w2, t-d30) are not part of the live template; take them out so the counts are the live plan's
delete from public.onboarding_steps where template_id like 't-%';
delete from public.onboarding_template where id like 't-%';

insert into public.team_members (name, email, department, role) values
  ('Test Hire NoFlow', 'w279b.noflow@example.invalid', 'w279test', 'Analyst'),
  ('Test Hire Flow', 'w279b.flow@example.invalid', 'w279test', 'Analyst');
insert into public.hub_roles (email, role) values ('w279b.staff@example.invalid', 'member');
insert into public.hub_candidates (name, start_date) values ('Test Candidate B Flow', null);
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w279b.staff@example.invalid"}', true);

do $$
declare
  v_noflow bigint; v_flow bigint; v_flow_row bigint; v_cfg jsonb; v_dept text; r record;
begin
  -- ---- two fresh plans: one that went through setup (a flow is linked), one that did not
  v_noflow := public.onboarding_assign((select id from public.team_members where email = 'w279b.noflow@example.invalid'), 'test');
  v_flow := public.onboarding_assign((select id from public.team_members where email = 'w279b.flow@example.invalid'), 'test');
  insert into public.hub_onboard_flows (candidate_id) select id from public.hub_candidates where name = 'Test Candidate B Flow' returning id into v_flow_row;
  update public.hub_onboard_flows set onboarding_id = v_flow where id = v_flow_row;

  -- section counts
  for r in select * from (values ('WEEK 1', 14), ('WEEK 2', 12), ('WEEK 3', 10), ('WEEK 4', 8), ('60 DAYS', 8), ('90 DAYS', 5)) as x(section, n) loop
    assert (select count(*) from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
             where s.onboarding_id = v_flow and t.section = r.section) = r.n, 'a plan that went through setup has ' || r.n || ' steps in ' || r.section;
    assert (select count(*) from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
             where s.onboarding_id = v_noflow and t.section = r.section) = r.n + case when r.section = 'WEEK 1' then 4 else 0 end,
           'a plan with no flow has ' || (r.n + case when r.section = 'WEEK 1' then 4 else 0 end) || ' steps in ' || r.section;
  end loop;
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_noflow and template_id in ('86e1cj9gj', '86e1cj9gp', '86e1cj9gy', '86e1cj9h3')) = 4,
    'the plan with no flow keeps the four setup-covered steps';
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_flow and template_id in ('86e1cj9gj', '86e1cj9gp', '86e1cj9gy', '86e1cj9h3')) = 0,
    'the plan that went through setup has none of them';
  assert (select count(*) from public.onboarding_template where setup_covered) = 4, 'only the four are flagged';

  -- switched off, and not on any plan
  assert (select count(*) from public.onboarding_template where id in ('86e1cj9gx', 'wa166team', '86e1cj9j0') and active) = 0, 'Gmail signature, Your team''s Learning Avenue and Pick a Learning Avenue are off';
  assert not exists (select 1 from public.onboarding_steps where template_id in ('86e1cj9gx', 'wa166team', '86e1cj9j0')), 'and on no plan';

  -- moves
  assert (select section || '/' || coalesce(parent_id, 'null') from public.onboarding_template where id = 'wa166usehub') = 'WEEK 3/null', 'Using the Hub is in WEEK 3, top level';
  assert (select section || '/' || coalesce(parent_id, 'null') from public.onboarding_template where id = '86e1cj9gr') = 'WEEK 2/null', 'Setting up a meeting is in WEEK 2, top level';
  assert (select section || '/' || coalesce(parent_id, 'null') from public.onboarding_template where id = '86e1cj9h8') = 'WEEK 2/null', 'Optimizing Slack is in WEEK 2, top level';
  assert (select section from public.onboarding_template where id = '86e1cj9h6') = 'WEEK 2', 'About Welfare Avenue is in WEEK 2';
  assert (select due_date - started_at from public.onboarding_steps s join public.onboardings o on o.id = s.onboarding_id where o.id = v_flow and s.template_id = 'wa166usehub') = 21,
    'a moved step takes its new section''s due date (Week 3 is day 21)';

  -- rewords
  assert (select name from public.onboarding_template where id = 'wa272appsetup') = 'Turn on Hub notifications', 'the notifications step is renamed';
  assert (select name from public.onboarding_template where id = '86e1cj9gm') = 'Your Canva folders', 'the Canva step is renamed';
  assert (select academy_path from public.onboarding_template where id = '86e1cj9gh') = 'policies', 'Policies ticks from the policies path';
  assert (select description from public.onboarding_template where id = '86e1cj9gh') like '%https://docs.google.com/document/d/1_M0fdr3P71Y95ptj-6toA6phRYHaKCsG/edit%'
     and (select description from public.onboarding_template where id = '86e1cj9gh') like '%ticks itself once you have signed both policies on Home%', 'Policies keeps its links and ticks on signing';
  assert (select training_id from public.onboarding_template where id = '86e1cj9j4') = 8, 'Charitable receipts links Academy module 8';
  assert (select description from public.onboarding_template where id = '86e1cj9h2') like '%slack.com/downloads/windows%', 'Understanding Slack part 1 holds the desktop links';
  assert (select description from public.onboarding_template where id = '86e1cj9h3') like '%slack.com/downloads/windows%', 'and Download Slack still has them for plans with no setup';
  assert (select description from public.onboarding_template where id = '86e1cj9j6') like '%Setting up a meeting, week 2%', 'the co-executive director step points at week 2';
  assert (select description from public.onboarding_template where id = '86e1cj9gr') not ilike '%bookmark your Google Calendar%', 'Setting up a meeting no longer asks for the calendar bookmark';
  assert (select description from public.onboarding_template where id = '86e1cj9hh') ilike '%accept%' and (select description from public.onboarding_template where id = '86e1cj9hh') ilike '%name shows%', 'Loom: accept the invite, check your name shows';

  -- wording of the active steps
  assert not exists (select 1 from public.onboarding_template where active and (name || ' ' || coalesce(description, '')) ilike '%clickup%'), 'no active step mentions ClickUp';
  assert not exists (select 1 from public.onboarding_template where active and description ~* '(when2meet.{0,200}bookmark|bookmark.{0,200}when2meet)'), 'no active step asks for When2Meet bookmarking';
  assert not exists (select 1 from public.onboarding_template where active and description ilike '%ask HR to add you to the groups%'), 'no active step says "ask HR to add you to the groups"';
  assert not exists (select 1 from public.onboarding_template where active and description ilike '%docusign%'), 'no active step sends people to DocuSign';
  assert not exists (select 1 from public.onboarding_template where active and (name || ' ' || coalesce(description, '')) like '%—%'), 'no em dash in an active step';

  -- the new steps
  assert (select count(*) from public.onboarding_template where id like 'wa279%' and active) = 18, 'eighteen new steps (2 role, 4 content, 12 trainings)';
  assert (select academy_path from public.onboarding_template where id = 'wa279role60') = 'role60' and (select section from public.onboarding_template where id = 'wa279role60') = '60 DAYS', 'role60 is in 60 DAYS';
  assert (select academy_path from public.onboarding_template where id = 'wa279role90') = 'role90' and (select section from public.onboarding_template where id = 'wa279role90') = '90 DAYS', 'role90 is in 90 DAYS';
  assert (select name from public.onboarding_template where id = 'wa279role60') = 'Your role trainings' and (select name from public.onboarding_template where id = 'wa279role90') = 'Your role trainings', 'both are called Your role trainings';
  assert (select count(*) from public.onboarding_template where id in ('wa279serving', 'wa279review', 'wa279share', 'wa279feedback') and academy_path is null and training_id is null) = 4, 'the four content steps are plain steps';
  assert (select section from public.onboarding_template where id = 'wa279serving') = '60 DAYS' and (select count(*) from public.onboarding_template where id in ('wa279review', 'wa279share', 'wa279feedback') and section = '90 DAYS') = 3, 'content steps are in the right sections';
  assert (select description from public.onboarding_template where id = 'wa279role60') ilike '%week 3%' and (select description from public.onboarding_template where id = 'wa279role60') ilike '%the Hub picks%', 'role steps say who picks, when, and what the Hub does';
  for r in select * from (values ('WEEK 2', '119,205,68'), ('WEEK 3', '122,103,82,201,71'), ('WEEK 4', '126'), ('60 DAYS', '121,120'), ('90 DAYS', '148')) as x(section, ids) loop
    assert (select string_agg(training_id::text, ',' order by training_id desc) from public.onboarding_template where id like 'wa279t%' and section = r.section)
         = (select string_agg(i, ',' order by i::int desc) from unnest(string_to_array(r.ids, ',')) as i), 'the everyone-trainings in ' || r.section;
  end loop;
  assert not exists (select 1 from public.onboarding_template t join public.trainings g on g.id = t.training_id where t.id like 'wa279t%' and (t.name <> g.title or t.id <> 'wa279t' || g.id)),
    'each everyone-training step is named after its training and has the id wa279t<training id>';
  assert (select count(*) from public.onboarding_template where id like 'wa279t%' and description like '%ticks itself%') = 12, 'each says it ticks itself';
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_flow and template_id like 'wa279%') = 18, 'a fresh plan gets all eighteen';

  -- every link points at something real (or at a path the Hub resolves itself)
  assert not exists (select 1 from public.onboarding_template t where t.active and t.training_id is not null and not exists (select 1 from public.trainings g where g.id = t.training_id)), 'every training_id exists';
  assert not exists (select 1 from public.onboarding_template t where t.active and t.academy_path is not null and t.academy_path not in ('role60', 'role90', 'policies')
                       and not exists (select 1 from public.academy_paths p where p.key = t.academy_path)), 'every academy_path exists, or is role60, role90 or policies';

  -- the role-recommend setting
  select value::jsonb into v_cfg from public.app_config where key = 'onboard_role_recommend';
  assert v_cfg is not null, 'onboard_role_recommend is set and parses';
  foreach v_dept in array array['opsto', 'progdev', 'board', 'fundraising', 'opsmtl', 'marketing', 'hr', 'exec'] loop
    assert jsonb_typeof(v_cfg -> 'by_department' -> v_dept -> 'paths') = 'array' and jsonb_typeof(v_cfg -> 'by_department' -> v_dept -> 'trainings') = 'array', 'recommend covers ' || v_dept;
  end loop;
  assert (select count(*) from jsonb_object_keys(v_cfg -> 'by_department')) = 8, 'exactly eight departments';
  assert v_cfg -> 'leaders' -> 'paths' = '["leading"]'::jsonb, 'leaders get Leading a team';
  assert v_cfg -> 'by_department' -> 'marketing' -> 'paths' = '["mktbasics","campaigns","marketing","studio"]'::jsonb, 'marketing paths';
  assert v_cfg -> 'by_department' -> 'exec' -> 'trainings' = '[57,73,90,91,80]'::jsonb, 'exec app tours';
  assert v_cfg -> 'by_department' -> 'opsto' = v_cfg -> 'by_department' -> 'opsmtl', 'Toronto operations use the Montreal list';

end $$;

select 'w279b: all assertions passed' as result;
rollback;
