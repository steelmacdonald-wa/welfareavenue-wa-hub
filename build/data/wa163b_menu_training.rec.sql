-- wa163b_menu_training (29/09/26): the Hub training follows the menu's new shape (wave163).
-- Steel: "Put Avenue Academy below Home", sections "Other Tools" and "Organization", "The Task Bank (previously The bank)",
-- the goal pages in an app called Strategy, "move partners to the CRM for now", "remove trainings from" Important info.
-- Each change replaces an exact phrase and is guarded, so running it twice changes nothing.

-- Hub module 1: where things are in the menu
update public.trainings set description = replace(description, '(hit Got it once you have read it).' || chr(10) || chr(10) || 'Try it: open My page',
  '(hit Got it once you have read it).' || chr(10) || chr(10) || 'The menu on the left: Home, the Avenue Academy, the Executive dashboard, the Calendar and The Brain at the top, then Departments (each team''s page, with its own pages folded under it), Other Tools (Important info, The Task Bank, Agendas, the Document finder, the Transcript archive, the Photo library and Requests) and Organization (the Org chart, Our story and the Hub inbox). You see the pages your access profile opens. The apps open from Apps at the bottom of the menu: Strategy (the goals and projects), the CRM (contacts, partners, gifts and email), the HR centre, Finance and the Admin centre.' || chr(10) || chr(10) || 'Try it: open My page'),
  updated_at = now()
  where id = 39 and position('(hit Got it once you have read it).' || chr(10) || chr(10) || 'Try it: open My page' in description) > 0 and position('The menu on the left' in description) = 0;

-- Hub module 2: The Task Bank is in Other Tools
update public.trainings set description = replace(description, 'Everything waiting is under Goals and projects, The bank.', 'Everything waiting is in The Task Bank, under Other Tools.'), updated_at = now()
  where id = 40 and position('Everything waiting is under Goals and projects, The bank.' in description) > 0;

-- Hub module 5: the goals and projects are the Strategy app
update public.trainings set description = replace(replace(description,
    'The Goals page is where goals are added, measured and linked to projects.',
    'The goals and projects live in the Strategy app (Apps, at the bottom of the menu): Organizational goals, Department goals, Projects and Goal alignment. Department goals is where goals are added, measured and linked to projects.'),
    'Try it: open the Goals page, then your department page,',
    'Try it: open Strategy, then Department goals, then your department page,'), updated_at = now()
  where id = 43 and position('The Goals page is where goals are added' in description) > 0;

-- the page tours
update public.trainings set description = 'Logins, shared drives and key links. Training videos live in the Avenue Academy.', updated_at = now()
  where id = 78 and key = 'tour:importantinfo' and description = 'Logins, videos, drives and key links.';
update public.trainings set title = 'Page tour: The Task Bank', updated_at = now()
  where id = 93 and key = 'tour:bank' and title = 'Page tour: The bank';
update public.trainings set description = 'The 9 dots at the bottom of the menu: Strategy (the goals and projects), the CRM (with Partners), the HR centre, Finance and the Admin centre as apps of their own, each with its own menu, and the way back to the Hub.', updated_at = now()
  where id = 205 and key = 'tour:apps' and position('Strategy' in description) = 0;
update public.trainings set description = 'Every organization we have worked with or approached, whether it is a partner, a collaborator or a sponsor, and where each one stands. The page is in the CRM.', updated_at = now()
  where id = 200 and key = 'tour:partners' and position('in the CRM' in description) = 0;

-- the lessons' links (and one quiz answer) say where the pages are now
update public.trainings set body = replace(body::text, 'Resources, then Partners', 'Apps, then the CRM, then Partners')::jsonb, updated_at = now()
  where id in (52, 198) and body::text like '%Resources, then Partners%';
update public.trainings set body = replace(replace(body::text, 'Resources, then Our story', 'Organization, then Our story'), 'Resources, then Document finder', 'Other Tools, then Document finder')::jsonb, updated_at = now()
  where id = 198 and (body::text like '%Resources, then Our story%' or body::text like '%Resources, then Document finder%');

-- the release
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'wave163', 'hub_release', '1a86a2c1d5dd20181890526481f43542', '9feedd1dd3d2b0dd14ae046fabf4c930 (the menu: Avenue Academy under Home, The Brain under the Calendar, Other Tools and Organization; the Strategy app; Partners in the CRM with partner, collaborator and sponsor; The Task Bank; Important info without training videos; the menu shows only once it is whole)', 'wave163');

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260929050000', 'wa163b_menu_training', array[$m$update public.trainings set description = replace(description, '(hit Got it once you have read it).' || chr(10) || chr(10) || 'Try it: open My page',
  '(hit Got it once you have read it).' || chr(10) || chr(10) || 'The menu on the left: Home, the Avenue Academy, the Executive dashboard, the Calendar and The Brain at the top, then Departments (each team''s page, with its own pages folded under it), Other Tools (Important info, The Task Bank, Agendas, the Document finder, the Transcript archive, the Photo library and Requests) and Organization (the Org chart, Our story and the Hub inbox). You see the pages your access profile opens. The apps open from Apps at the bottom of the menu: Strategy (the goals and projects), the CRM (contacts, partners, gifts and email), the HR centre, Finance and the Admin centre.' || chr(10) || chr(10) || 'Try it: open My page'),
  updated_at = now()
  where id = 39 and position('(hit Got it once you have read it).' || chr(10) || chr(10) || 'Try it: open My page' in description) > 0 and position('The menu on the left' in description) = 0$m$,$m$update public.trainings set description = replace(description, 'Everything waiting is under Goals and projects, The bank.', 'Everything waiting is in The Task Bank, under Other Tools.'), updated_at = now()
  where id = 40 and position('Everything waiting is under Goals and projects, The bank.' in description) > 0$m$,$m$update public.trainings set description = replace(replace(description,
    'The Goals page is where goals are added, measured and linked to projects.',
    'The goals and projects live in the Strategy app (Apps, at the bottom of the menu): Organizational goals, Department goals, Projects and Goal alignment. Department goals is where goals are added, measured and linked to projects.'),
    'Try it: open the Goals page, then your department page,',
    'Try it: open Strategy, then Department goals, then your department page,'), updated_at = now()
  where id = 43 and position('The Goals page is where goals are added' in description) > 0$m$,$m$update public.trainings set description = 'Logins, shared drives and key links. Training videos live in the Avenue Academy.', updated_at = now()
  where id = 78 and key = 'tour:importantinfo' and description = 'Logins, videos, drives and key links.'$m$,$m$update public.trainings set title = 'Page tour: The Task Bank', updated_at = now()
  where id = 93 and key = 'tour:bank' and title = 'Page tour: The bank'$m$,$m$update public.trainings set description = 'The 9 dots at the bottom of the menu: Strategy (the goals and projects), the CRM (with Partners), the HR centre, Finance and the Admin centre as apps of their own, each with its own menu, and the way back to the Hub.', updated_at = now()
  where id = 205 and key = 'tour:apps' and position('Strategy' in description) = 0$m$,$m$update public.trainings set description = 'Every organization we have worked with or approached, whether it is a partner, a collaborator or a sponsor, and where each one stands. The page is in the CRM.', updated_at = now()
  where id = 200 and key = 'tour:partners' and position('in the CRM' in description) = 0$m$,$m$update public.trainings set body = replace(body::text, 'Resources, then Partners', 'Apps, then the CRM, then Partners')::jsonb, updated_at = now()
  where id in (52, 198) and body::text like '%Resources, then Partners%'$m$,$m$update public.trainings set body = replace(replace(body::text, 'Resources, then Our story', 'Organization, then Our story'), 'Resources, then Document finder', 'Other Tools, then Document finder')::jsonb, updated_at = now()
  where id = 198 and (body::text like '%Resources, then Our story%' or body::text like '%Resources, then Document finder%')$m$,$m$insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'wave163', 'hub_release', '1a86a2c1d5dd20181890526481f43542', '9feedd1dd3d2b0dd14ae046fabf4c930 (the menu: Avenue Academy under Home, The Brain under the Calendar, Other Tools and Organization; the Strategy app; Partners in the CRM with partner, collaborator and sponsor; The Task Bank; Important info without training videos; the menu shows only once it is whole)', 'wave163')$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
