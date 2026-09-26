-- wave137 (26/09/26): Steel and Suhaib leave the Board & Governance team; they are the executive team.
-- Steel: "You should take Suhaib and I out of the board team - we are more part of the executive team.
-- I don't want all our meetings and stuff flooding the board tabs"
-- A team page counts a calendar event as the team's meeting when two of its members attend (unless the event is
-- tagged with another team), so every meeting the two co-executive directors share showed on the board pages.
-- 'exec' is a label, not a team: no team page, not in dept_meta. They stay directors in board_members.
update public.team_members set department = 'exec' where id in (37, 38) and department = 'board';
update public.org_positions set department = 'exec', updated_at = now(), updated_by = 'Claude for Steel MacDonald'
  where member_id in (37, 38) and kind = 'exec' and department = 'board';
comment on column public.team_members.department is 'Team code (the dept_meta codes), or exec for the co-executive directors (the executive team: a label with no team page, so their shared meetings do not count as any team''s). Board directors are listed in board_members whatever their team.';
comment on column public.org_positions.department is 'Team code of the seat, or exec for the co-executive directors'' seats.';
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values
  ('team_member', '37', 'department', 'board', 'exec (the executive team, off the Board & Governance team)', 'Claude for Steel MacDonald'),
  ('team_member', '38', 'department', 'board', 'exec (the executive team, off the Board & Governance team)', 'Claude for Steel MacDonald');
