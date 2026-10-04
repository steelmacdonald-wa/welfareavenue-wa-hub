-- wave205 release data (04/10/26): the trainings and the audit lines, run after wa205_strategy and its data
-- (wa205_strategy_data.sql). The release line (change_log entity release / wave205) is added right after the deploy.

-- 1. The page tours: Goals (row 59) is the rebuilt page; Department goals (row 60) is retired with the tier; Goal alignment
--    (row 62) is projects to goals; the Strategy Library gets its own tour.
update public.trainings set title = 'Page tour: Goals (Strategy)',
  description = 'The five organizational goals, edited live: the mission, each goal''s owners, SMART statement, targets, paths and milestones by year, the projects that serve them, comments with @mentions, the history with Restore, the roadmap and the Strategy Library.',
  updated_at = now()
where key = 'tour:orggoals';
update public.trainings set active = false, updated_at = now() where key = 'tour:goals';
update public.trainings set description = 'Every department''s projects and the organizational goal each one serves, on one map.', updated_at = now() where key = 'tour:goalmap';
insert into public.trainings (key, kind, title, category, path_group, minutes, xp, active, sort, body, description)
select 'tour:strategylib', 'tour', 'Page tour: Strategy Library', 'Hub tours', 'Hub page tours', 1, 10, true, 11, '{"tab": "orggoals", "tour": "strategylib"}'::jsonb,
       'The documents that set Welfare Avenue''s direction (our plans, the consulting work, the sources), what each one says and where it stands; pinned ones lead the Goals page.'
where not exists (select 1 from public.trainings where key = 'tour:strategylib');

-- 2. Hub module 5 (row 43) follows the new shape: departments own projects; projects serve the five goals.
update public.trainings set description = $m5$Goal: See how the work you do moves one of Welfare Avenue's five goals.

## How the work adds up

1. Tasks group into projects.
2. Each department owns its projects, and each project serves one of the five organizational goals, ideally one of its milestones.
3. The five goals carry yearly milestones from FY27 to FY29, with a gated view to FY31.

## Where it lives

The goals live in the Strategy app (the 9 dots, then Strategy): Goals, Projects, Goal alignment and the Strategy Library. Each goal's owners keep it up to date: click any text to change it, and it saves as you type. Everyone on staff reads the goals, comments on them and links their projects.

## Working on a goal together

- You see who else is on the page and which goal they are in.
- Comments are threaded; type @ to bring someone in.
- History shows every change, who made it and when; Restore puts an old version back.

Good to know: department goals are retired. They are kept, with their wins and comments, under Goals, then Retired goals.

## Meetings keep it up to date

Meeting transcripts feed it by themselves: tasks route into the right project, and real progress shows up as wins under each goal.

Try it: open Strategy, then Goals, find the goal your team's work serves, and link one of your projects to it (or to one of its milestones).

Done when: you can say which goal and which milestone your project serves.$m5$,
  body = '{"tours": ["orggoals", "strategylib", "goalmap"]}'::jsonb, updated_at = now()
where id = 43;

-- 3. Access profiles: no page changed hands. orggoals now also holds the Strategy Library (#orggoals/library) and Retired
--    goals; goals (Department goals) is retired and opens Retired goals; every profile keeps its decision (all nine decide
--    all four Strategy pages 'all', the board profile included, which is what lets directors read the goals). Logged.
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('access_profile', 'pages', 'wave205', null,
  'orggoals is Goals and the Strategy Library (the library and Retired goals are sections of it); goals (Department goals) is retired and opens Retired goals; no decision changed. Writes are checked in the database: each goal''s owners and admins edit (strategy_save and the other strategy_* functions, restrictive policies on goals); staff comment and link projects (wa205_can_comment); board viewers read only.',
  'assistant (wave205 session)');
