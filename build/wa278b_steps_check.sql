-- Welfare Avenue Hub: wave278b, 04/11/26. The step key check on hub_onboard_steps (wave271a) listed the eight wave271 keys only, so the four
-- wave278 steps (groups, drives, meeting, channel) could not be seeded: accept_setup answered 500 at the practice run. Replaces the check with
-- the twelve keys. Applied live 04/11/26 by the connector (schema_migrations 20261104201001). Safe to run twice. Undo: not needed (a wider check
-- harms nothing); wa278a_undo.sql leaves it in place.
alter table public.hub_onboard_steps drop constraint if exists hub_onboard_steps_step_check;
alter table public.hub_onboard_steps add constraint hub_onboard_steps_step_check
  check (step = any (array['roster', 'google', 'plan', 'invites', 'manager', 'hub', 'slack', 'welcome', 'groups', 'drives', 'meeting', 'channel']));
