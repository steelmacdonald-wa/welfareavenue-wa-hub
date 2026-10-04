-- wave207 (04/10/26): goal_history also records the charitable activities a goal is anchored on, its yearly targets and their quarterly checkpoints.
alter table public.goal_history drop constraint if exists goal_history_entity_check;
alter table public.goal_history add constraint goal_history_entity_check check (entity in ('goal', 'milestone', 'path', 'owner', 'project', 'activity', 'target', 'checkpoint'));
comment on column public.goal_history.entity is 'goal, milestone, path, owner, project, and since wave207 activity (a goal_activities link), target (a goal_year_targets row) or checkpoint (a goal_checkpoints row); entity_id is that row''s id.';
