-- wave134: the Hub modules follow the new menu groups (The bank now sits under Goals and projects)
update public.trainings
  set description = replace(description, 'under Strategy, The bank', 'under Goals and projects, The bank'), updated_at = now()
  where id = 40 and position('under Strategy, The bank' in description) > 0;
