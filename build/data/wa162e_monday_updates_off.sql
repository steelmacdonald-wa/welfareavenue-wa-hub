-- wave162e (29/09/26): the Monday morning updates stop. Steel: "the monday morning updates should stop going forward"; he chose
-- the 8:00 Monday summary in Slack (wa-weekly-digest, weekly-digest), the 9:00 team digests in each team's channel
-- (wa-slack-weekly-digest, slack-digest) and the 7:20 ClickUp snapshot with its Slack line (wa-clickup-pull, clickup-pull).
-- The jobs are paused (active false), not removed, so an admin can switch one back on with
--   select cron.alter_job(jobid, active := true) from cron.job where jobname = '<name>';
-- The other Monday jobs stay: the Slack pull (7:30), the Loom pull (7:30, Monday, Wednesday and Friday), the check-in scope
-- (7:45) and the weekly social note (8:20). Nothing on the page reads these jobs (the ClickUp movement card has had no data
-- since wave116g), and no access profile or Hub module mentions them.

select cron.alter_job(jobid, active := false) from cron.job where jobname in ('wa-weekly-digest', 'wa-slack-weekly-digest', 'wa-clickup-pull') and active;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  select 'cron', j.jobname, 'active', 'on (' || j.schedule || ' UTC, Mondays)', 'paused: Steel asked for the Monday morning updates to stop (wave162e)', 'Steel MacDonald'
  from cron.job j where j.jobname in ('wa-weekly-digest', 'wa-slack-weekly-digest', 'wa-clickup-pull');
