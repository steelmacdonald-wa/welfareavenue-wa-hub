-- wave258 (15/10/26): the Fundraising meeting's follow-through. Data only, no new database objects.
-- 1. The Grants page follows Fundraising in every access profile (People and access > Profiles): the same decision as the
--    Fundraising team page (all, lead or none). The page itself also checks wa40Allowed in the browser (Grants needs Fundraising).
-- 2. The page tour row tour:grants in "Hub page tours".
-- 3. The audit trail.

update public.hub_access_profiles
   set pages = pages || jsonb_build_object('grants', coalesce(pages ->> 'fundraising', 'none'))
 where not (pages ? 'grants');

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'access_profile', p.key, 'pages', null, 'grants: ' || coalesce(p.pages ->> 'grants', 'none') || ' (the Grants page follows Fundraising)', 'Claude (15/10 fundraising follow-through)'
  from public.hub_access_profiles p;

insert into public.trainings (key, title, kind, category, path_group, sort, minutes, active, description)
select 'tour:grants', 'Page tour: Grants', 'tour', 'Hub tours', 'Hub page tours', 22, 2, true,
       'The Grants page: the grants tasks on their own page (out of the Fundraising page), who oversees them, Add a grants task, and the way into the Fundraising app''s grants pipeline.'
 where not exists (select 1 from public.trainings where key = 'tour:grants');

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'trainings', t.id::text, 'created', null, 'tour:grants (Page tour: Grants)', 'Claude (15/10 fundraising follow-through)'
  from public.trainings t where t.key = 'tour:grants';
