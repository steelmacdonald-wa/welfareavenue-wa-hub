-- wave257 release (15/10/26): the Calendar page's tour in Hub page tours, the release line.
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
select 'Hub tours', 'Page tour: Volunteer calendar', 'The Volunteer Manager''s Calendar: every serving month by month with its spots filled, opening a serving, adding an event, and where everyone is placed (Volunteers, Applicants received, Assign to servings).',
       'hub', 'Hub page tours', 21, true, 'tour', 'tour:volcalendar', '{"tab":"volunteering","tour":"volcalendar"}'::jsonb, 2, 20
 where not exists (select 1 from public.trainings where key = 'tour:volcalendar');
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'index.html', 'wave257', '3d68e04e29a43b34bfd24fc34fd6f1e0', '9803ee6fc062591129729a03ec7efc8c: wave257 Calendar its own page, upcoming servings on Volunteers and Applicants received, Assign to servings', 'claude (cowork) wave257');
