-- wa207_release (04/10/26): the page tours and Hub module 5 say what wave207 added. Run with the deploy.
update public.trainings
   set description = 'The five organizational goals, edited live: this year''s goals (FY27) with the current quarter, what is due next and what is overdue, the 8 charitable activities every goal is anchored on, each goal''s owners, SMART statement, targets, paths, quarterly checkpoints and milestones by year, the projects that serve them, comments with @mentions, the history with Restore, the roadmap and the Strategy Library.',
       updated_at = now()
 where key = 'tour:orggoals';
update public.trainings
   set description = 'One project''s tasks, lead and progress: open any task to see and change it as on a team page (push it to the bank from there), tick it done with an Undo, link the team''s existing tasks into the project, and how its lead can park the project in the bank.',
       updated_at = now()
 where key = 'tour:project';
update public.trainings
   set description = replace(description, E'## Meetings keep it up to date',
       E'## This year and our charitable activities\n\n- Each goal has a target for this fiscal year (FY27 runs Oct 1, 2026 to Sep 30, 2027) and four quarterly checkpoints, each with a status: not started, on track, at risk or done.\n- The top of Goals shows the current quarter, what is due next and anything overdue. Owners report against the checkpoints at each board meeting.\n- Every goal is anchored on one or more of the 8 charitable activities Welfare Avenue is registered for. The chips on a goal say which, and why.\n- A project can serve a checkpoint as well as a goal: Link a project, then pick the checkpoint.\n\n## Meetings keep it up to date'),
       updated_at = now()
 where id = 43 and position('## This year and our charitable activities' in description) = 0;
