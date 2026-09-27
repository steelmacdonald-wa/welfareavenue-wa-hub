-- wave149: Meet attendance only in the HR centre. Steel (27/09/26): "for attendance, I dont think it should be on the
-- department overview page. I think it should only be seen on the HR center or in one of the admin pages".
-- The team pages and the Board overview no longer show it (wave144 edited), so the database stops handing it to anyone else:
-- the meetings and who came are for the admins and the Executive profile (wa_org_editor), who see it in the HR centre.
drop policy if exists meet_meetings_read on public.meet_meetings;
create policy meet_meetings_read on public.meet_meetings for select to authenticated using (public.wa_org_editor());
drop policy if exists meet_attendance_read on public.meet_attendance;
create policy meet_attendance_read on public.meet_attendance for select to authenticated using (public.wa_org_editor());
comment on policy meet_meetings_read on public.meet_meetings is 'wave149: the admins and the Executive profile only (Meet attendance lives in the HR centre).';
comment on policy meet_attendance_read on public.meet_attendance is 'wave149: the admins and the Executive profile only (Meet attendance lives in the HR centre).';

/* the access profiles say so */
update public.hub_access_profiles
   set can = coalesce((select jsonb_agg(x) from jsonb_array_elements_text(can) x where x not like 'Your team page: how many came to each team meeting%'), '[]'::jsonb),
       lead_note = replace(coalesce(lead_note, ''), ' A lead, and whoever runs the team meeting, also sees who came to each meeting and who is not on the invite.', ''),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key in ('marketing', 'fundraising', 'progdev', 'opsmtl', 'opsto', 'hr')
   and (can::text like '%your own attendance%' or coalesce(lead_note, '') like '%who is not on the invite%');
update public.hub_access_profiles
   set can = coalesce((select jsonb_agg(x) from jsonb_array_elements_text(can) x where x not like 'Board attendance:%'), '[]'::jsonb),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'board' and can::text like '%Board attendance:%';
update public.hub_access_profiles
   set can = coalesce((select jsonb_agg(case when x like 'Meeting attendance:%' then 'Meeting attendance, in the HR centre only: who came to each team''s meetings, the leadership meetings and the board meetings, team by team' else x end) from jsonb_array_elements_text(can) x), '[]'::jsonb),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'executive' and can::text like '%Meeting attendance:%';

/* the Hub modules say so */
update public.trainings
   set description = replace(description, E'\n\nUnder Upcoming meetings, Meeting attendance shows how many of the team came to each of the last eight meetings on Google Meet, and whether you came. Whoever runs the meeting and the team lead also see who came and who is not on the invite.', ''),
       updated_at = now()
 where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 2: department pages, tasks and projects' and description like '%Meeting attendance shows how many%';
update public.trainings
   set description = replace(description, E'and who came to a team meeting is for whoever runs it, the team lead and the executive directors (everyone on the team sees the counts and their own attendance).',
       E'and who came to meetings is for the executive directors and the admins, in the HR centre.'),
       updated_at = now()
 where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 9: who sees what (access profiles)' and description like '%who came to a team meeting is for whoever runs it%';

comment on table public.meet_meetings is 'Meet attendance (wave144; HR centre only since wave149): one row per team meeting, leadership meeting or board meeting that was scheduled on the hub@ calendar (or in board_meetings) or held on a team''s Meet link. id is cal:<calendar instance id>, conf:<conference id> (a call on the team''s link with no scheduled meeting) or board:<board_meetings.id>. Counts: expected (invited people, or the active directors), came, team (the team''s own roster among the invited), visitors (came without an invitation), guests (not identified: signed out, phone). Written by meet-attendance only; read by the admins and the Executive profile.';

notify pgrst, 'reload schema';
