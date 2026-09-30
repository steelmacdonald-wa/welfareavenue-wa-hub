-- wa170c_training (30/09/26): the Academy's Hub modules, the page tours and the access profiles say what wave170 added: emails to
-- info@ are passed on to the team or the person with a line saying what to do (or filed quietly when someone on the team is
-- already on the email), a colleague can send an email on to a team from their own inbox, and Your inbox on Home for the people
-- whose mailbox the inbox assistant works on.

-- Hub module 1: My page (Home) and Your inbox
update public.trainings
   set description = replace(description,
         '(hit Got it once you have read it).',
         '(hit Got it once you have read it). If the inbox assistant is on for your mailbox (a few people for now), Your inbox on Home keeps what needs your reply and what a team should handle: it files your new Welfare Avenue mail into your own Gmail folders, writes a reply that sounds like you after asking you a question or two (saved as a Gmail draft: you send it), and sends an email on to a team''s inbox with your one-line ask.'),
       updated_at = now()
 where id = 39 and title = 'Hub module 1: My page and finding your work'
   and position('(hit Got it once you have read it).' in description) > 0
   and position('inbox assistant' in description) = 0;

-- Hub module 4: the team inbox, info@ included
update public.trainings
   set description = replace(description,
         'emails the Hub inbox filed for your team (Jev pings the channel only when one needs you soon), and asks the AI heard in meetings',
         'emails the Hub inbox filed for your team (Jev pings the channel only when one needs you soon), emails sent to info@ with a To do line the Hub wrote (the person it is for gets a Slack message, or the channel when it is for the whole team; nobody is pinged when someone on the team is already on the email), emails a colleague sent on from their own inbox with their ask, and asks the AI heard in meetings'),
       updated_at = now()
 where id = 42 and title = 'Hub module 4: requests between teams'
   and position('emails the Hub inbox filed for your team (Jev pings the channel only when one needs you soon), and asks the AI heard in meetings' in description) > 0;

-- the page tours
update public.trainings set description = 'Your personal queue: meetings, tasks, mentions, updates and time, and your inbox when the assistant is on for you.', updated_at = now()
 where id = 54 and key = 'tour:home' and description = 'Your personal queue: meetings, tasks, mentions, updates and time.';
update public.trainings set description = 'Ask another team for something, follow it through to done, and see what came in for your team, info@ emails included.', updated_at = now()
 where id = 64 and key = 'tour:requests' and description = 'Ask another team for something, follow it through to done, and see what came in for your team.';
update public.trainings set description = 'What happens when you cc hub@welfareavenue.com, and how emails to info@ are passed on.', updated_at = now()
 where id = 67 and key = 'tour:hubmail' and description = 'What happens when you cc hub@welfareavenue.com.';

-- the access profiles: each team answers the emails in its inbox too, info@ ones included
update public.hub_access_profiles p
   set can = (select jsonb_agg(case when x.e ~ '^Answer the requests sent to .+ in the team inbox$'
                                    then to_jsonb(replace(x.e, 'Answer the requests sent to ', 'Answer the requests and emails (info@ ones included) sent to '))
                                    else to_jsonb(x.e) end order by x.i)
               from jsonb_array_elements_text(p.can) with ordinality as x(e, i)),
       updated_at = now(), updated_by = 'wave170'
 where p.key in ('opsmtl', 'opsto', 'progdev', 'marketing', 'fundraising')
   and exists (select 1 from jsonb_array_elements_text(p.can) e where e ~ '^Answer the requests sent to .+ in the team inbox$');
update public.hub_access_profiles p
   set can = (select jsonb_agg(case when x.e = 'Answer the requests and job applications sent to HR in the team inbox'
                                    then to_jsonb('Answer the requests, emails (info@ ones included) and job applications sent to HR in the team inbox'::text)
                                    else to_jsonb(x.e) end order by x.i)
               from jsonb_array_elements_text(p.can) with ordinality as x(e, i)),
       updated_at = now(), updated_by = 'wave170'
 where p.key = 'hr' and p.can ? 'Answer the requests and job applications sent to HR in the team inbox';

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930120000', 'wa170c_training', array[$m$update public.trainings
   set description = replace(description,
         '(hit Got it once you have read it).',
         '(hit Got it once you have read it). If the inbox assistant is on for your mailbox (a few people for now), Your inbox on Home keeps what needs your reply and what a team should handle: it files your new Welfare Avenue mail into your own Gmail folders, writes a reply that sounds like you after asking you a question or two (saved as a Gmail draft: you send it), and sends an email on to a team''s inbox with your one-line ask.'),
       updated_at = now()
 where id = 39 and title = 'Hub module 1: My page and finding your work'
   and position('(hit Got it once you have read it).' in description) > 0
   and position('inbox assistant' in description) = 0$m$,$m$update public.trainings
   set description = replace(description,
         'emails the Hub inbox filed for your team (Jev pings the channel only when one needs you soon), and asks the AI heard in meetings',
         'emails the Hub inbox filed for your team (Jev pings the channel only when one needs you soon), emails sent to info@ with a To do line the Hub wrote (the person it is for gets a Slack message, or the channel when it is for the whole team; nobody is pinged when someone on the team is already on the email), emails a colleague sent on from their own inbox with their ask, and asks the AI heard in meetings'),
       updated_at = now()
 where id = 42 and title = 'Hub module 4: requests between teams'
   and position('emails the Hub inbox filed for your team (Jev pings the channel only when one needs you soon), and asks the AI heard in meetings' in description) > 0$m$,$m$update public.trainings set description = 'Your personal queue: meetings, tasks, mentions, updates and time, and your inbox when the assistant is on for you.', updated_at = now()
 where id = 54 and key = 'tour:home' and description = 'Your personal queue: meetings, tasks, mentions, updates and time.'$m$,$m$update public.trainings set description = 'Ask another team for something, follow it through to done, and see what came in for your team, info@ emails included.', updated_at = now()
 where id = 64 and key = 'tour:requests' and description = 'Ask another team for something, follow it through to done, and see what came in for your team.'$m$,$m$update public.trainings set description = 'What happens when you cc hub@welfareavenue.com, and how emails to info@ are passed on.', updated_at = now()
 where id = 67 and key = 'tour:hubmail' and description = 'What happens when you cc hub@welfareavenue.com.'$m$,$m$update public.hub_access_profiles p
   set can = (select jsonb_agg(case when x.e ~ '^Answer the requests sent to .+ in the team inbox$'
                                    then to_jsonb(replace(x.e, 'Answer the requests sent to ', 'Answer the requests and emails (info@ ones included) sent to '))
                                    else to_jsonb(x.e) end order by x.i)
               from jsonb_array_elements_text(p.can) with ordinality as x(e, i)),
       updated_at = now(), updated_by = 'wave170'
 where p.key in ('opsmtl', 'opsto', 'progdev', 'marketing', 'fundraising')
   and exists (select 1 from jsonb_array_elements_text(p.can) e where e ~ '^Answer the requests sent to .+ in the team inbox$')$m$,$m$update public.hub_access_profiles p
   set can = (select jsonb_agg(case when x.e = 'Answer the requests and job applications sent to HR in the team inbox'
                                    then to_jsonb('Answer the requests, emails (info@ ones included) and job applications sent to HR in the team inbox'::text)
                                    else to_jsonb(x.e) end order by x.i)
               from jsonb_array_elements_text(p.can) with ordinality as x(e, i)),
       updated_at = now(), updated_by = 'wave170'
 where p.key = 'hr' and p.can ? 'Answer the requests and job applications sent to HR in the team inbox'$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
