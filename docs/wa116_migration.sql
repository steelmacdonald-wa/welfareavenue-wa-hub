-- wave116 (24/09/26): Program Development splits out of Operations Montreal
-- Applied after the wave116 build went live. Every statement is idempotent.

-- the new team's row (calendar_match feeds calendar-sync's department tagging)
insert into public.dept_meta (department, read, progress, priorities, updated_at, calendar_match, meeting_schedule)
values ('progdev',
        'Shima''s team: research, data and the programmes that serve beneficiaries (feedback, employment, referrals).',
        '', '[]'::jsonb, now(), '["program development"]'::jsonb, 'Program Development Meeting, Mondays 7:30 PM')
on conflict (department) do nothing;
update public.dept_meta set calendar_match = '["weekly operations meeting","operations meeting","ops meeting","operations check-in"]'::jsonb where department = 'opsmtl';
update public.dept_meta set calendar_match = '["fundraising meeting","grants check-in","finance meeting","donor meeting","grants meeting"]'::jsonb where department = 'fundraising';

-- people
update public.team_members set department = 'progdev'
 where department = 'opsmtl' and name in ('Shima', 'Brianna', 'Ola', 'Amena HajjDiab', 'Zachee Leonel Ngue');

-- work: the Program development workstream and the two PD projects
update public.dept_tasks set department = 'progdev', subsection = null, updated_at = now()
 where department = 'opsmtl' and (subsection = 'Program development' or project_id in (3, 4));
update public.projects set department = 'progdev', updated_at = now() where id in (3, 4) and department = 'opsmtl';
update public.goals set department = 'progdev', updated_at = now() where department = 'opsmtl';

-- meetings and what came out of them (Slack digests of the shared channel stay with Ops Montreal)
update public.transcripts set department = 'progdev'
 where department = 'opsmtl' and title ilike '%program dev%' and title not ilike 'Slack digest%';
update public.dept_updates set department = 'progdev'
 where department = 'opsmtl' and added_by ilike '%program dev%' and added_by not ilike '%slack digest%';
update public.mentions set department = 'progdev' where department = 'opsmtl' and meeting_title ilike '%program dev%';
update public.agendas set department = 'progdev' where department = 'opsmtl' and id = 6;

-- sources
update public.slack_sources set department = 'progdev' where department = 'opsmtl' and name = 'program-development';
update public.app_config
   set value = (value::jsonb || jsonb_build_object('map', (value::jsonb -> 'map') || '{"progdev": "program-development"}'::jsonb))::text,
       updated_at = now()
 where key = 'slack_digest' and (value::jsonb -> 'map') ? 'progdev' = false;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('department', 'progdev', 'created', 'opsmtl', 'Program Development split out of Operations Montreal (wave116)', 'wave116');
