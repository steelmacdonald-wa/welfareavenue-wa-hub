-- wa166c_access_notes (29/09/26): the access profiles say where a lead follows their new people (wave166: the card on Home).
update public.hub_access_profiles
   set lead_note = lead_note || ' Anyone onboarding who reports to a lead in the org chart shows on the lead''s Home: how their plan is going, what is late, and the moments that are the lead''s.',
       updated_at = now()
 where coalesce(lead_note, '') <> '' and position('onboarding who reports to a lead' in lead_note) = 0;
update public.hub_access_profiles
   set can = coalesce(can, '[]'::jsonb) || jsonb_build_array('Home shows the people onboarding who report to you in the org chart (and, to admins, anyone onboarding with no lead yet): their progress, what is late and the moments that are yours'),
       updated_at = now()
 where key in ('executive', 'admin') and position('people onboarding who report to you' in coalesce(can::text, '')) = 0;
