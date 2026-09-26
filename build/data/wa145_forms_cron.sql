-- wave145: the forms read every six hours (staggered from the Meet attendance run), and the profiles and Hub modules say so
select cron.unschedule('wa-forms-flow') where exists (select 1 from cron.job where jobname = 'wa-forms-flow');
select cron.schedule('wa-forms-flow', '17 */6 * * *', $$select public.call_edge('forms-flow', '{"action":"sync"}'::jsonb)$$);
update public.hub_access_profiles
   set can = can || to_jsonb('Onboarding quizzes: who took the policy quiz and the 30 day quiz, their score and what they said about the onboarding (HR centre)'::text),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key in ('executive', 'hr') and not (can::text like '%Onboarding quizzes%');
update public.hub_access_profiles
   set can = can || to_jsonb('Volunteer feedback: what volunteers said after each serving, the event audit, and new sign-ups from the recurrent volunteers form (Volunteering manager)'::text),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key in ('executive', 'opsmtl') and not (can::text like '%Volunteer feedback%');
update public.trainings
   set description = replace(description, E'\n\nTry it:', E'\n\nAfter each serving, send volunteers the survey from the event page (copy the link under What volunteers said). Their answers, the lead''s event audit and a short summary land on the event within six hours, and new sign-ups from the recurrent volunteers form wait for review in the volunteer list.\n\nTry it:'),
       updated_at = now()
 where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 6: the volunteering manager' and description like E'%\n\nTry it:%' and description not like '%What volunteers said%';
update public.trainings
   set description = replace(description, E'\n\nTry it:', E'\n\nThe policy quiz and the 30 day quiz are Google Forms: when someone with an onboarding in progress takes one, the Hub ticks that step with their score, and HR sees the results and what new members said in the HR centre.\n\nTry it:'),
       updated_at = now()
 where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 7: training and onboarding' and description like E'%\n\nTry it:%' and description not like '%policy quiz and the 30 day quiz%';
