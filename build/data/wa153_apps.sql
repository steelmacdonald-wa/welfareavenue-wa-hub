-- wa153_apps (27/09/26): run at deploy time, after the page ships. The launcher tour in Avenue Academy.
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, minutes, xp)
select 'Hub tours', 'Page tour: the apps', 'The 9 dots at the bottom of the menu: the CRM, the HR centre, Finance and the Admin centre as apps of their own, each with its own menu, and the way back to the Hub.', 'hub', 'Hub page tours', 39, true, 'tour', 'tour:apps', 2, 20
where not exists (select 1 from public.trainings where key = 'tour:apps');
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('site_deploy', 'wave153', 'release', null, 'the apps: the 9-dot launcher, the app frame (rail and app bar), the CRM as an app with a Gifts tab, contacts in Search everything', 'wave153');
