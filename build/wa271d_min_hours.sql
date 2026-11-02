-- Welfare Avenue Hub: wave271 (271d), 02/11/26. The new hire's availability grid needs a minimum number of hours before it saves (so the manager has times to choose from).
-- One setting, onboard_grid_min_hours, in hours (default 10; 0 for no minimum; 0 to 40). The onboard-link function reads it; the manager's grid has no minimum.
-- Needs wa271a_onboard.sql first. Safe to run twice, and it keeps a value HR has changed. Undo: the last line of build/wa271a_undo.sql. Proved offline: node test/w271sql.mjs.
insert into public.app_config (key, value) values
  ('onboard_grid_min_hours', '10')
on conflict (key) do nothing;
