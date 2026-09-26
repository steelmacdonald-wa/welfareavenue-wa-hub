-- wave143: the access profiles say who builds the board pack and who reads it
update public.hub_access_profiles
   set can = (select jsonb_agg(case when v = 'Board overview and Committees: schedule board meetings and update the three jobs'
                                    then 'Board overview and Committees: schedule board meetings, build the board pack (agenda, meeting notes and deck) and update the three jobs'
                                    else v end order by o)
                from jsonb_array_elements_text(can) with ordinality as a(v, o)),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'executive' and can ? 'Board overview and Committees: schedule board meetings and update the three jobs';
update public.hub_access_profiles
   set can = (select jsonb_agg(case when v = 'Board overview: the next meeting, the three jobs, terms and the fiscal year at a glance (totals, never transactions)'
                                    then 'Board overview: the next meeting and its board pack (agenda, meeting notes and deck), the three jobs, terms and the fiscal year at a glance (totals, never transactions)'
                                    else v end order by o)
                from jsonb_array_elements_text(can) with ordinality as a(v, o)),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'board' and can ? 'Board overview: the next meeting, the three jobs, terms and the fiscal year at a glance (totals, never transactions)';
-- the Board overview page tour says it shows the board pack (applied as wa143_tour_text)
update public.trainings
   set description = 'The three jobs of a board, the next meeting and its board pack, and each director''s progress.', updated_at = now()
 where key = 'tour:governance' and description = 'The three jobs of a board, the next meeting and each director''s progress.';
