-- wa171c_training (30/09/26): the Academy's page tours say what wave171 added (volunteers confirming by text, the format, the next serving on Home).
update public.trainings set description = 'The serving programme: calendar, events, checklist and roster, the format of each serving, and volunteers confirming their spot by text.'
  where id = 71 and key = 'tour:volunteering' and description = 'The serving programme: calendar, events, checklist and roster.';
update public.trainings set description = 'Your personal queue: meetings, tasks, mentions, updates and time, and who has confirmed for the next serving.'
  where id = 54 and key = 'tour:home' and description = 'Your personal queue: meetings, tasks, mentions, updates and time.';
