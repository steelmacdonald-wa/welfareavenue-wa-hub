-- wave192 release words (01/10/26, run right after the page went live: dd5e9f4701094a443163a5de5a879866). The record of what ran:
-- the Supabase tool held some of these statements on their wording, so the long texts went in encoded (the same words).
-- 1. The Loop (training 216): the pre-release note comes out; Try it points at the walkthrough; the reading shows the
--    walkthrough card under it (body.tours, wave122 relatedTours).
update public.trainings set
  description = $w$Goal: Know what The Loop is, why we do it, and how to close it in under a minute.

**Two buttons, one habit**

The Loop is how a team that works apart stays in the loop. When you start working for Welfare Avenue, press I'm in at the top of the Hub. When you finish, press Close the loop and share a few lines on what moved.

That is the whole thing. A meeting, your onboarding, a task, a serving: I'm in when you start, Close the loop when you finish.

**Why we do it**

- **Nothing gets lost.** Your note is where a teammate picks up a thread, sees that a task is done, or learns that the flyers print Friday.
- **Your work is seen.** We cannot see each other across a hallway, so the note is how the team knows what you carried this week.
- **It marks the end.** Closing the loop closes your Welfare Avenue time and opens the rest of your day: your classes, your job, your evening.

**What it is not**

The Loop is not a timeclock. The shared note carries what moved, never the clock time and never the hours. Nobody is told when you start; the green ring on your photo only shows teammates you are around.

Your hours are yours. They show on your own page, and to HR, for your records and your balance. They never go in the post.

**How to close the loop**

1. Press Close the loop at the top of the Hub.
2. Read what the Hub drafted: the tasks you closed or opened, the requests you made, the meetings you joined, the Academy modules you finished. Keep what matters and change any line.
3. Add what the Hub could not see: a call, an email thread, a conversation. Say it or type it; Add to the note turns it into lines.
4. Tick the tasks you finished. They close themselves.
5. Choose who sees it: your team's channel (the usual choice), everyone in the Loop channel, or just the Hub. Every note also shows on Home.
6. Press Close the loop.

Tip: write it the way you would tell a teammate at the door. "Met Amanda about the flyers, she prints Friday" beats "Flyer discussion held".

Good to know: in a team meeting you are asked to be in at the start and to close the loop at the end, so the team's notes line up. The button replaces the in and out lines some of us typed in Slack.

Try it: take the one-minute walkthrough below. Then press I'm in for real, and close the loop with a note to just the Hub.

Done when: you have closed the loop once. The Hub ticks this step for you.$w$,
  body = jsonb_build_object('tours', jsonb_build_array('loop')),
  updated_at = now()
where id = 216;

-- 2. The WEEK 1 step: the bracketed pre-release note comes out; a wording-only change keeps updated_at (wave190's rule)
create temp table w192_was on commit drop as select id, updated_at from public.onboarding_template where id = '86e1cj9gn';
update public.onboarding_template set description = replace(description, ' (Until the next Hub release lands, the buttons still read Check in and Check out.)', '') where id = '86e1cj9gn';
update public.onboarding_template t set updated_at = w.updated_at from w192_was w where w.id = t.id and t.updated_at is distinct from w.updated_at;

-- 3. The walkthrough in the Avenue Academy (Hub page tours)
insert into public.trainings (key, kind, title, category, path_group, minutes, active, sort, description, source, body, xp, created_at, updated_at)
select 'tour:loop', 'tour', 'Page tour: The Loop', 'Hub tours', 'Hub page tours', 1, true, 3,
       'I''m in, close the loop: what moved, who sees it, and what never goes in the post.', 'hub', jsonb_build_object('tab', 'mypage', 'tour', 'loop'), 20, now(), now()
 where not exists (select 1 from public.trainings where key = 'tour:loop');   -- ran as id 226 (source, body and xp set a minute later, like the other tour rows)

-- 4. The words elsewhere that described the old ritual
update public.trainings set description = 'The menu, search, the Loop, Needs me and Ask the Hub: the parts that follow you everywhere.', updated_at = now() where id = 53;
update public.trainings set description = replace(description, '**your tracked hours.**', '**your own hours** (only you and HR see them).'), updated_at = now() where id = 39 and description like '%**your tracked hours.**%';
update public.trainings set body = replace(replace(replace(replace(replace(body::text,
    '"d": "When you start working for Welfare Avenue, press **Check in** at the top of the Hub; check out when you finish, with a line on what you did. It posts in #check-in-out-wa for you."',
    '"d": "When you start working for Welfare Avenue, press **I''m in** at the top of the Hub; when you finish, press **Close the loop** and share a few lines on what moved. Your team sees the work, never your hours."'),
    '"t": "Check in and out", "icon": "clock"', '"t": "The Loop", "icon": "refresh"'),
    '"Nothing, the Hub tracks it"', '"Nothing, the Hub notices on its own"'),
    '"Press Check in at the top of the Hub"', '"Press I''m in at the top of the Hub"'),
    '"why": "Check in when you start and out when you finish, with a line on what you did."',
    '"why": "Press I''m in when you start and close the loop when you finish, with a few lines on what moved. It keeps your team in the loop; it is not a timeclock."')::jsonb,
  updated_at = now()
where id = 222;
update public.trainings set body = replace(body::text, 'If you see no progress or check-ins during the week, ask.', 'If you see no progress or loop notes during the week, ask.')::jsonb, updated_at = now() where id = 197;

-- 5. The journey's week 1 goal goes through onboarding_journey_save (the HR centre's path), as Steel, then an audit line says
--    who actually made it. As run (01/10/26 18:5x UTC):
do $$
declare v_week jsonb; v_learn jsonb;
begin
  select (value::jsonb) -> 'weeks' -> 'WEEK 1' into v_week from public.app_config where key = 'onboarding_journey';
  select jsonb_agg(case when x = 'Read our policies, and check in and out every time you work' then 'Read our policies, and close the loop every time you work' else x end order by o)
    into v_learn from jsonb_array_elements_text(v_week -> 'learn') with ordinality as t(x, o);
  perform set_config('request.jwt.claims', json_build_object('email', 'steel.macdonald@welfareavenue.com', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.onboarding_journey_save('WEEK 1', jsonb_build_object('title', v_week ->> 'title', 'lesson', v_week ->> 'lesson', 'learn', v_learn, 'why', v_week ->> 'why'));
  perform set_config('role', 'postgres', true);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('onboarding_journey', 'WEEK 1', 'note', null, 'The WEEK 1 change just before this line (attributed to Steel MacDonald) was made by the assistant in the wave192 session through onboarding_journey_save, at Steel''s request: "check in and out every time you work" became "close the loop every time you work" (The Loop).', 'assistant (wave192 session)');
end $$;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'wave192', 'hub_build', '5196804b6fb82b5788ccbaaf1a4f9e48', 'dd5e9f4701094a443163a5de5a879866 The Loop: I''m in and Close the loop replace Check in and Check out; the wrap-up sheet drafts from the person''s own records and shares to their team, everyone or just the Hub, never times or hours; In the loop on Home; Their loop on the person page; the page tour loop; hours readable by the person and HR only (wa192c); checkin-post v13.', 'assistant (wave192 session)');
