-- wave244 (Steel, 15/10/26): at most two roles, read before signing up, the coordinator places people who pick two.
-- "I want to limit people from being able to sign up to two or more positions ... when they choose the positions on the
-- website, they should be 100% aware and have reviewed ... what the role is. For example, a driver, they need to know that
-- they have to bring their own car ... I want to make sure that they click check a box that they've read what positions they
-- are signing up to." Asked where someone who picks two goes: "Wait for coordinator to choose". Then: "remove the not sure
-- ... take off the dishwasher role [on the website], but still keep it on the volunteer manager side".

-- 1. the volunteer forms (volunteer, benevole): no dishwasher, each role says what it involves, at most 2, then a box ticked
update public.crm_forms f
   set questions = (
     select jsonb_agg(x order by n, k)
       from (
         select n, 0 as k,
                case when q->>'id' = 'roles' then
                  (q - 'help') || jsonb_build_object('max', 2, 'help', case when f.slug = 'benevole'
                    then 'Choisissez-en 2 au plus. Si vous en choisissez 2, notre coordination choisit votre rôle pour chaque dimanche et vous le dit avant de confirmer.'
                    else 'Pick up to 2. If you pick 2, our coordinator chooses your role for each Sunday and tells you before we confirm.' end,
                  'options', case when f.slug = 'benevole' then jsonb_build_array(
                    jsonb_build_object('v', 'server', 'l', 'Servir les repas', 'd', 'Monter, servir des repas maison avec soin, puis ranger ensemble. Arrivée au plus tard à midi; environ 2 heures.'),
                    jsonb_build_object('v', 'cook', 'l', 'Cuisiner (à la maison)', 'd', 'Préparer un plat à la maison à partir de nos recettes, prêt pour midi : nous passons le chercher ou vous le déposez.'),
                    jsonb_build_object('v', 'driver', 'l', 'Conduire (votre propre voiture)', 'd', 'Vous conduisez votre propre voiture : apporter la nourriture et le matériel au service, puis tout ramener. Il faut un permis. Environ 3 h 30; l’essence est remboursée jusqu’à 15 $.'),
                    jsonb_build_object('v', 'photographer', 'l', 'Prendre des photos', 'd', 'Raconter la journée en images, dans le respect de la vie privée de chacun. Environ 2 heures.'),
                    jsonb_build_object('v', 'videographer', 'l', 'Filmer des vidéos', 'd', 'Filmer de courts extraits de la journée, dans le respect de la vie privée de chacun. Environ 2 heures.'),
                    jsonb_build_object('v', 'community_debrief', 'l', 'Responsable communautaire', 'd', 'Accueillir les gens que nous servons et parler avec eux, puis animer le court bilan avec la ou le responsable d’équipe. Pour les bénévoles qui ont déjà servi avec nous au moins deux fois; nous le confirmons avec vous avant le service.'))
                  else jsonb_build_array(
                    jsonb_build_object('v', 'server', 'l', 'Serving food', 'd', 'Set up, serve home-cooked meals with care and pack up together. Arrive by noon; about 2 hours.'),
                    jsonb_build_object('v', 'cook', 'l', 'Cooking (at home)', 'd', 'Cook one dish at home from our recipes, ready by noon: we pick it up or you drop it off.'),
                    jsonb_build_object('v', 'driver', 'l', 'Driving (your own car)', 'd', 'You drive your own car: bring the food and supplies to the serving and everything back after. You need a licence. About 3½ hours; gas is reimbursed up to $15.'),
                    jsonb_build_object('v', 'photographer', 'l', 'Taking photos', 'd', 'Capture the day for our stories, with care for everyone’s privacy. About 2 hours.'),
                    jsonb_build_object('v', 'videographer', 'l', 'Filming video', 'd', 'Film short clips of the day for our stories, with care for everyone’s privacy. About 2 hours.'),
                    jsonb_build_object('v', 'community_debrief', 'l', 'Community lead', 'd', 'Welcome and talk with the people we serve, then run the short debrief with the team leader. For volunteers who have served with us at least twice; we confirm it with you before the serving.')) end)
                else q end as x
           from jsonb_array_elements(f.questions) with ordinality t(q, n)
          where q->>'id' <> 'roles_read'
         union all
         select n, 1, jsonb_build_object('id', 'roles_read', 'type', 'multi', 'required', true,
                  'label', case when f.slug = 'benevole' then 'À lire avant de vous inscrire' else 'Read before you sign up' end,
                  'options', jsonb_build_array(jsonb_build_object('v', 'yes', 'l', case when f.slug = 'benevole'
                    then 'J’ai lu ce que demandent les rôles que j’ai choisis (pour conduire : j’utilise ma propre voiture).'
                    else 'I have read what the roles I picked involve (drivers: I bring my own car).' end)))
           from jsonb_array_elements(f.questions) with ordinality t(q, n)
          where q->>'id' = 'roles'
       ) y),
       updated_at = now(), updated_by = 'wa244'
 where f.slug in ('volunteer', 'benevole');

-- 2. website accounts: no dishwasher to sign up as (the Hub keeps the role, its guide and its spots)
update public.app_config set value = 'server,cook,photographer,community_debrief', updated_at = now() where key = 'vol_signup_roles';

-- 3. crm_form_apply: two roles picked means the roster row waits as 'volunteer' with detail.role_choices
do $$
declare d text;
begin
  d := pg_get_functiondef('public.crm_form_apply'::regproc);
  if strpos(d, 'v_role text;') = 0 or strpos(d, '''community_talker'']) with ordinality t(x, o)') = 0
     or strpos(d, 'jsonb_build_object(''source'', ''hub_form'', ''form'', f.slug, ''submission_id'', s.id))') = 0 then
    raise exception 'crm_form_apply changed';
  end if;
  d := replace(d, 'v_role text;', 'v_role text; v_pick text[];');
  d := regexp_replace(d, '(''community_talker''\]\) with ordinality t\(x, o\)\s+where x = any\(v_roles\) order by o limit 1\), ''server''\);)',
    E'\\1\n  -- wave244: two roles picked (the forms allow 2): the roster row waits as ''volunteer'' and the coordinator chooses\n'
    || E'  v_pick := coalesce((select array_agg(x order by o) from unnest(array[''cook'', ''driver'', ''server'', ''dishwasher'', ''photographer'', ''videographer'', ''community_debrief'']) with ordinality t(x, o) where x = any(v_roles)), ''{}'');\n'
    || E'  if cardinality(v_pick) > 1 then v_role := ''volunteer''; end if;');
  if strpos(d, 'v_pick := coalesce(') = 0 then raise exception 'crm_form_apply: role line not found'; end if;
  d := replace(d, 'jsonb_build_object(''source'', ''hub_form'', ''form'', f.slug, ''submission_id'', s.id))',
    'jsonb_build_object(''source'', ''hub_form'', ''form'', f.slug, ''submission_id'', s.id) || case when v_role = ''volunteer'' and cardinality(v_pick) > 1 then jsonb_build_object(''role_choices'', to_jsonb(v_pick)) else ''{}''::jsonb end)');
  execute d;
end $$;

-- 4. texts: no 7-day confirmation until the coordinator has chosen (unless a person is texted on purpose); the sign-up
--    notice names the two roles and says the coordinator chooses
do $$
declare d text;
begin
  d := pg_get_functiondef('public.wa171_queue_confirms'::regproc);
  if strpos(d, '       and er.confirm_status is null') = 0 then raise exception 'wa171_queue_confirms changed'; end if;
  d := replace(d, '       and er.confirm_status is null',
    '       and er.confirm_status is null' || chr(10) ||
    '       and (p_roster is not null or not (lower(coalesce(er.role, '''')) = ''volunteer'' and er.detail ? ''role_choices''))   -- wave244: the coordinator chooses first');
  execute d;

  d := pg_get_functiondef('public.wa172_queue_signups'::regproc);
  if strpos(d, '|| '' ('' || lower(public.wa171_role_label(er.role, v_lang)) || '')''') = 0
     or strpos(d, ''' Comme responsable communautaire, lisez vos consignes sur cette page avant le service.'' else '''' end') = 0
     or strpos(d, ''' As Community lead, please read your briefing on that page before the serving.'' else '''' end') = 0 then
    raise exception 'wa172_queue_signups changed';
  end if;
  d := replace(d, '|| '' ('' || lower(public.wa171_role_label(er.role, v_lang)) || '')''',
    '|| '' ('' || case when lower(er.role) = ''volunteer'' and er.detail ? ''role_choices'' then (select string_agg(lower(public.wa171_role_label(c, v_lang)), case when v_lang = ''fr'' then '' ou '' else '' or '' end order by o) from jsonb_array_elements_text(er.detail->''role_choices'') with ordinality u(c, o)) else lower(public.wa171_role_label(er.role, v_lang)) end || '')''');
  d := replace(d, ''' Comme responsable communautaire, lisez vos consignes sur cette page avant le service.'' else '''' end',
    ''' Comme responsable communautaire, lisez vos consignes sur cette page avant le service.'' else '''' end || case when exists (select 1 from public.event_roster x where x.id = any (g.ids) and lower(x.role) = ''volunteer'' and x.detail ? ''role_choices'') then '' Notre coordination choisira votre rôle et vous le dira avant de confirmer.'' else '''' end');
  d := replace(d, ''' As Community lead, please read your briefing on that page before the serving.'' else '''' end',
    ''' As Community lead, please read your briefing on that page before the serving.'' else '''' end || case when exists (select 1 from public.event_roster x where x.id = any (g.ids) and lower(x.role) = ''volunteer'' and x.detail ? ''role_choices'') then '' Our coordinator will choose your role and let you know before we confirm.'' else '''' end');
  execute d;
end $$;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('crm_form', 'volunteer,benevole', 'roles', null, 'wave244: at most 2 roles, each with what it involves (drivers bring their own car), a box ticked to say they read them, no dishwasher on the forms or website accounts (kept in the Hub); two roles picked wait for the coordinator (role volunteer, detail.role_choices), their confirmation text held until then', 'claude (cowork) wave244');
