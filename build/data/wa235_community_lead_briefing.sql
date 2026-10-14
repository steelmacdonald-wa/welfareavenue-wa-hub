-- wave235 (Steel, 14/10/26): the Community lead. "We should pick volunteer servers that have been to 2 or more of our events
-- and they need to be briefed on what to do"; asked, he said: pick from servers with 2 or more servings if we don't have someone,
-- but look within our pool of community leads as well; people could sign up for it but should be aware of what the role
-- consists of before applying; the briefing on their page and in the text.

-- 1. the briefing: Community welcome's duties folded into the Community lead's guide
update public.volunteer_role_guides set
  expect_en = array[
    'You are the team''s link with the community. Arrive with the team and check in with the team leader.',
    'Welcome people in the line and talk with them while they wait and eat: how they are doing, what they need, what they thought of the meal.',
    'Point people to the table, and to the clothes when there are some.',
    'After the serving, run the short community debrief with the team leader.',
    'The same day, fill in the Beneficiary form (below): it is how we capture who we served and what they told us.'],
  expect_fr = array[
    'Vous êtes le lien de l''équipe avec la communauté. Arrivez avec l''équipe et présentez-vous à la ou au responsable d''équipe.',
    'Accueillez les gens dans la file et parlez avec eux pendant l''attente et le repas : comment ils vont, ce dont ils ont besoin, ce qu''ils ont pensé du repas.',
    'Orientez les gens vers la table, et vers les vêtements quand il y en a.',
    'Après le service, animez le court bilan communautaire avec la ou le responsable d''équipe.',
    'Le jour même, remplissez le formulaire des bénéficiaires (ci-dessous) : c''est ainsi que nous consignons qui nous avons servi et ce qu''on nous a dit.'],
  updated_at = now(), updated_by = 'wa235'
 where role = 'community_debrief';

-- 2. people can sign up for it again (the website account and the forms), knowing what it is
update public.app_config set value = 'server,cook,dishwasher,photographer,community_debrief', updated_at = now() where key = 'vol_signup_roles';
update public.crm_forms f
   set questions = (select jsonb_agg(case when q->>'id' = 'roles' and jsonb_typeof(q->'options') = 'array'
       then jsonb_set(q || jsonb_build_object('help', case when f.slug = 'benevole'
              then 'Responsable communautaire est un rôle avec plus de responsabilités, pour les bénévoles qui ont déjà servi avec nous au moins deux fois. Nous le confirmons avec vous avant le service.'
              else 'Community lead is a role with more responsibility, for volunteers who have served with us at least twice. We confirm it with you before the serving.' end),
            '{options}', (q->'options') || jsonb_build_array(jsonb_build_object('v', 'community_debrief', 'l', case when f.slug = 'benevole'
              then 'Responsable communautaire : accueillir les gens que nous servons et parler avec eux, puis animer le court bilan'
              else 'Community lead: welcome and talk with the people we serve, then run the short debrief' end)))
       else q end order by n)
     from jsonb_array_elements(f.questions) with ordinality t(q, n)),
       updated_at = now(), updated_by = 'wa235'
 where f.slug in ('volunteer', 'benevole') and f.questions::text not like '%community_debrief%';

-- 3. the page: "I have read my briefing" is kept on the roster row (confirm.briefed_at) and read back
do $$
declare d text;
begin
  d := pg_get_functiondef('public.volunteer_confirm_get'::regproc);
  if strpos(d, '''note'', r.confirm->>''note''),') = 0 then raise exception 'volunteer_confirm_get changed'; end if;
  execute replace(d, '''note'', r.confirm->>''note''),', '''note'', r.confirm->>''note'', ''briefed_at'', r.confirm->>''briefed_at''),');
  d := pg_get_functiondef('public.volunteer_confirm_details'::regproc);
  if strpos(d, '  if v_add <> ''{}''::jsonb then') = 0 then raise exception 'volunteer_confirm_details changed'; end if;
  execute replace(d, '  if v_add <> ''{}''::jsonb then',
    '  if p ? ''briefed'' and lower(r.role) = ''community_debrief'' then   -- wave235: the Community lead read the briefing' || chr(10) ||
    '    v_add := v_add || jsonb_build_object(''briefed_at'', case when coalesce((p->>''briefed'')::boolean, false) then to_jsonb(now()) else ''null''::jsonb end);' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if v_add <> ''{}''::jsonb then');
end $$;

-- 4. the texts: a Community lead is pointed at the briefing
do $$
declare d text;
begin
  d := pg_get_functiondef('public.wa171_confirm_text'::regproc);
  if strpos(d, '|| ''. Confirmez ici : '' || v_link') = 0 or strpos(d, '|| ''. Please confirm here: '' || v_link') = 0 then raise exception 'wa171_confirm_text changed'; end if;
  d := replace(d, '|| ''. Confirmez ici : '' || v_link',
    '|| case when lower(r.role) = ''community_debrief'' then ''. Lisez vos consignes de responsable et confirmez ici : '' else ''. Confirmez ici : '' end || v_link');
  d := replace(d, '|| ''. Please confirm here: '' || v_link',
    '|| case when lower(r.role) = ''community_debrief'' then ''. Please read your Community lead briefing and confirm here: '' else ''. Please confirm here: '' end || v_link');
  execute d;
  d := pg_get_functiondef('public.wa172_queue_signups'::regproc);
  if strpos(d, '|| v_link || '' . Nous vous texterons') = 0 or strpos(d, '|| v_link || '' . We''''ll text you') = 0 then raise exception 'wa172_queue_signups changed'; end if;
  d := replace(d, '|| v_link || '' . Nous vous texterons',
    '|| v_link || '' .'' || case when exists (select 1 from public.event_roster x where x.id = any (g.ids) and lower(x.role) = ''community_debrief'') then '' Comme responsable communautaire, lisez vos consignes sur cette page avant le service.'' else '''' end || '' Nous vous texterons');
  d := replace(d, '|| v_link || '' . We''''ll text you',
    '|| v_link || '' .'' || case when exists (select 1 from public.event_roster x where x.id = any (g.ids) and lower(x.role) = ''community_debrief'') then '' As Community lead, please read your briefing on that page before the serving.'' else '''' end || '' We''''ll text you');
  execute d;
end $$;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('volunteer_role', 'community_debrief', 'briefing', null, 'wave235: the guide as a briefing (welcome duties folded in), sign-up with its description (forms, website accounts), briefing read on the page, the texts point leads to it', 'claude (cowork) wave235');
