-- wa166b_lead_names (29/09/26): the lead's moments read as things the lead does (they show on the lead's Home card, wave166).
update public.hr_setup_template set name = 'Give them their first tasks in a meeting',
    description = coalesce(description, 'In your team''s meeting in their first week, so they leave with work they own (their tasks live on your team''s page in the Hub).')
  where id = 'hrm1' and name = 'Manager assigns first tasks in a meeting';
