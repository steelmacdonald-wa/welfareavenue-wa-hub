-- wa206_release (04/10/26): a project page opens its tasks. No schema change: the project page now opens the team pages'
-- task drawer (wave116b), which writes through the same dept_tasks, task_comments, task_assignees and change_log rows as before.
-- The page tour's training row says so. The release line (change_log entity release / wave206) is added right after the deploy.
update public.trainings
   set description = 'One project''s tasks, lead and progress: open any task to see and change it as on a team page, and how its lead can park the project in the bank.',
       updated_at = now()
 where key = 'tour:project';
