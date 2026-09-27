-- wa152_crm_access (27/09/26): run at deploy time, after the page ships.
-- Steel: "CRM visible to all staff". Every profile gets the CRM page; the Board member profile does not
-- (directors never see contacts), and the database follows it (wa_page_ok('crm') in the CRM policies).
update public.hub_access_profiles set pages = pages || '{"crm":"all"}'::jsonb where key <> 'board';
update public.hub_access_profiles set pages = pages || '{"crm":"none"}'::jsonb where key = 'board';
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'access_profile', key, 'pages', null, 'crm: ' || (pages ->> 'crm') || ' (wave152)', 'wave152' from public.hub_access_profiles;
-- the page tour in Avenue Academy
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, minutes, xp)
select 'Hub tours', 'Page tour: CRM', 'Everyone we know in one place: who they are to us, how to reach them, what they did with us, their email permission, and the duplicates to check.', 'hub', 'Hub page tours', 38, true, 'tour', 'tour:crm', 2, 20
where not exists (select 1 from public.trainings where key = 'tour:crm');
