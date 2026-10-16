-- wave258 and wave259 release (16/10/26, about 00:40): the tour rows and the release lines.
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
select 'Hub tours', 'Page tour: The texts volunteers get', 'What goes out automatically for each serving (the confirmation 10 days before, the Monday reminder, the last day to cancel, the Thursday check-in, the itinerary, the survey), the Texts strip on a serving, the Text log, My roles, From the old sheet.',
       'hub', 'Hub page tours', 22, true, 'tour', 'tour:voltexts', '{"tab":"volunteering","tour":"voltexts"}'::jsonb, 3, 20
 where not exists (select 1 from public.trainings where key = 'tour:voltexts');
update public.trainings set description = 'The Volunteer Manager has five places: Servings, Calendar, People (Volunteers, New applicants, Sign-offs), Messages (the ops line) and Setup (the SOP, recipes, inventory, spot counts, role owners, the text schedule). Where everyone is placed and Assign to servings.'
 where key = 'tour:volcalendar' and description not like 'The Volunteer Manager has five places%';
