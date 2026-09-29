-- wa167b_training (29/09/26): Hub module 7 says the plan is a journey now (wave167).
update public.trainings set description = replace(description, 'Stuck on a step? Ask for help from the plan: HR and your lead see it.',
    'The plan opens as a journey: the weeks are stops on the avenue, each with its photo, what you will learn and why it matters, and a short lesson with a knowledge check to start it; your people and our numbers sit below, and finishing a week is celebrated. Stuck on a step? Ask for help from the plan: HR and your lead see it.'),
  updated_at = now()
  where id = 45 and position('stops on the avenue' in description) = 0 and position('Stuck on a step? Ask for help from the plan: HR and your lead see it.' in description) > 0;
