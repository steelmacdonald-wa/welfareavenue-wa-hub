-- wa169b_training (30/09/26): the Academy's Hub module 7, its page tours and the access profiles say what wave169 added:
-- the master onboarding is what people see in the Avenue Academy, and HR and leaders assign trainings to the organization.

-- Hub module 7: training and onboarding
update public.trainings
   set description = replace(description,
         'HR manages onboarding and assigns trainings from the HR centre.',
         'HR manages onboarding from the HR centre: the master onboarding there is what you see here, week by week. HR and leaders assign trainings to everyone, a team or a few people; what is assigned to you shows at the top of the Academy, under Assigned to you, with the due date, who asked and why.'),
       updated_at = now()
 where id = 45 and title = 'Hub module 7: training and onboarding'
   and position('HR manages onboarding and assigns trainings from the HR centre.' in description) > 0;

-- the page tours
update public.trainings set description = 'People, hours, onboarding and what new people see in the Academy, assigning trainings to the organization, hiring and policies.', updated_at = now()
 where id = 72 and key = 'tour:hrcentre' and description = 'People, hours, onboarding, training, hiring and policies.';
update public.trainings set description = 'Onboarding, what is assigned to you, Learning Avenues, tours, the library and your trophy case.', updated_at = now()
 where id = 70 and key = 'tour:academy' and description = 'Onboarding, Learning Avenues, tours, the library and your trophy case.';

-- the access profiles: HR's own profile, the executive profile, and what a team's lead gets
update public.hub_access_profiles
   set can = jsonb_set(can, '{0}', to_jsonb('Use the HR centre: onboarding plans and the master onboarding (what new people see in the Avenue Academy, with a preview), hours, recruitment and policies'::text))
             || to_jsonb(array['Assign trainings to everyone, a team or a few people, with a due date and a note, from the HR centre or the Avenue Academy']),
       updated_at = now(), updated_by = 'wave169'
 where key = 'hr' and can ->> 0 = 'Use the HR centre: onboarding plans, hours, recruitment and policies';
update public.hub_access_profiles p
   set can = (select jsonb_agg(case when x.e = 'Add and assign trainings in the Avenue Academy'
                                    then to_jsonb('Add trainings to the Avenue Academy, and assign them to everyone, a team or a few people with a due date and a note (the Avenue Academy and the HR centre)'::text)
                                    else to_jsonb(x.e) end order by x.i)
               from jsonb_array_elements_text(p.can) with ordinality as x(e, i))
             || to_jsonb(array['The master onboarding in the HR centre: what new people see in the Avenue Academy each week, changed in place and previewed as a new person sees it']),
       updated_at = now(), updated_by = 'wave169'
 where p.key = 'executive' and p.can ? 'Add and assign trainings in the Avenue Academy';
update public.hub_access_profiles
   set lead_note = replace(lead_note, 'can add trainings to the Avenue Academy.', 'can add trainings to the Avenue Academy and assign them to everyone, a team or a few people, with a due date and a note.'),
       updated_at = now(), updated_by = 'wave169'
 where tier = 'member' and position('can add trainings to the Avenue Academy.' in coalesce(lead_note, '')) > 0;
