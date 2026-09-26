-- wave144: the access profiles and the Hub modules say who sees Meet attendance
update public.hub_access_profiles
   set can = can || to_jsonb('Meeting attendance: who came to each team''s meetings, the leadership meetings and the board meetings (the HR centre and the team pages)'::text),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'executive' and not (can::text like '%Meeting attendance%');
update public.hub_access_profiles
   set can = can || to_jsonb('Board attendance: how many directors came to the last board meeting, and each director''s board meetings this year'::text),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'board' and not (can::text like '%Board attendance%');
update public.hub_access_profiles
   set can = can || to_jsonb('Your team page: how many came to each team meeting, and your own attendance'::text),
       lead_note = lead_note || ' A lead, and whoever runs the team meeting, also sees who came to each meeting and who is not on the invite.',
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key in ('marketing', 'fundraising', 'progdev', 'opsmtl', 'opsto', 'hr') and not (can::text like '%your own attendance%');
update public.trainings
   set description = replace(description, E'\n\nTry it: open your department page, add yourself a small task',
       E'\n\nUnder Upcoming meetings, Meeting attendance shows how many of the team came to each of the last eight meetings on Google Meet, and whether you came. Whoever runs the meeting and the team lead also see who came and who is not on the invite.\n\nTry it: open your department page, add yourself a small task'),
       updated_at = now()
 where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 2: department pages, tasks and projects' and description not like '%Meeting attendance%';
update public.trainings
   set description = replace(description, E' Some things stay private whatever your profile: HR records stay with the HR access list, and private meeting notes stay with the people they name.',
       E' Some things stay private whatever your profile: HR records stay with the HR access list, private meeting notes stay with the people they name, and who came to a team meeting is for whoever runs it, the team lead and the executive directors (everyone on the team sees the counts and their own attendance).'),
       updated_at = now()
 where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 9: who sees what (access profiles)' and description not like '%who came to a team meeting%';
