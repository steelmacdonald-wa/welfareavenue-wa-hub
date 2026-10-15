-- wave256 release (15/10/26): the Phone page's tour in Hub page tours, the release line, the cron for calls.
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
select 'Hub tours', 'Page tour: Phone', 'The Volunteer Manager''s Phone page: texts and calls on the ops line in one place, what waits (texts nobody answered, missed calls nobody returned), one conversation with texts and calls, New text, Text a group, and how Call hands the number to the Quo app.',
       'hub', 'Hub page tours', 20, true, 'tour', 'tour:phone', '{"tab":"volunteering","tour":"phone"}'::jsonb, 2, 20
 where not exists (select 1 from public.trainings where key = 'tour:phone');
-- cron (applied in migration wa256_quo_calls_cron):
-- select cron.schedule('wa-quo-calls', '6,16,26,36,46,56 * * * *', $$select public.call_edge('quo-calls', '{"action":"sync"}'::jsonb)$$);
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'index.html', 'wave256', 'b4b062f70950f2f140fd673bcad4ac0f', '3d68e04e29a43b34bfd24fc34fd6f1e0: wave256 the Volunteer Manager''s Phone page (texts and calls), usual spot counts', 'claude (cowork) wave256');
