-- wave133: the academy and the access profiles learn the interactive org chart (run after the wave133 deploy)
update public.trainings
  set description = 'Who reports to whom, team by team, with the open positions. Executives and admins can rearrange it.', minutes = 2, updated_at = now()
  where key = 'tour:orgchart';

-- the profiles that can change the chart say so (and the audit trail records it, only for the profiles that changed)
with upd as (
  update public.hub_access_profiles
    set can = can || to_jsonb('Rearrange the org chart: who reports to whom, direct reports and the open positions'::text)
    where key in ('executive', 'admin') and jsonb_typeof(can) = 'array'
      and not exists (select 1 from jsonb_array_elements_text(can) c where c like 'Rearrange the org chart%')
    returning key
)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'access_profile', key, 'can', null, 'Rearrange the org chart (added with the interactive org chart)', 'Hub release (wave133)'
from upd;
