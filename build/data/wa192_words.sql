-- wave192 (01/10/26): the words. Training 216 (the Loom video on checking in and out) becomes a reading, The Loop, and
-- the WEEK 1 onboarding step says the same. Ships before the page: the Good to know line about the button names comes
-- out in wa192_release.sql once the page is live.
update public.trainings set
  kind = 'read',
  title = 'The Loop: I''m in, close the loop',
  resource_url = null, source = null, ext_id = null, duration_sec = null,
  minutes = 3,
  description = $w$Goal: Know what The Loop is, why we do it, and how to close it in under a minute.

Good to know: the Hub release that renames the buttons is on its way. Until it lands, the two buttons at the top of the Hub still read Check in and Check out, and a note posts to #check-in-out-wa.

**Two buttons, one habit**

The Loop is how a team that works apart stays in the loop. When you start working for Welfare Avenue, press I'm in at the top of the Hub. When you finish, press Close the loop and share a few lines on what moved.

That is the whole thing. A meeting, your onboarding, a task, a serving: I'm in when you start, Close the loop when you finish.

**Why we do it**

- **Nothing gets lost.** Your note is where a teammate picks up a thread, sees that a task is done, or learns that the flyers print Friday.
- **Your work is seen.** We cannot see each other across a hallway, so the note is how the team knows what you carried this week.
- **It marks the end.** Closing the loop closes your Welfare Avenue time and opens the rest of your day: your classes, your job, your evening.

**What it is not**

The Loop is not a timeclock. The shared note carries what moved, never the clock time and never the hours. Nobody is told when you start; the green ring on your photo only shows teammates you are around.

Your hours are yours. They count for you, on your own page and in the HR centre, for your records and your balance. They never go in the post.

**How to close the loop**

1. Press Close the loop at the top of the Hub.
2. Read what the Hub drafted: the tasks you closed or opened, the requests you made, the meetings you joined, the Academy modules you finished. Keep what matters and change any line.
3. Add what the Hub could not see: a call, an email thread, a conversation. Say it or type it; Add to the note turns it into bullets.
4. Tick the tasks you finished. They close themselves.
5. Choose who sees it: your team's channel (the usual choice), everyone in #the-loop, or just the Hub. Every note shows on Home either way.
6. Press Close the loop.

Tip: write it the way you would tell a teammate at the door. "Met Amanda about the flyers, she prints Friday" beats "Flyer discussion held".

Good to know: in a team meeting you are asked to be in at the start and to close the loop at the end, so the team's notes line up. The button replaces the in and out lines some of us typed in Slack.

Try it: press I'm in now, open the Avenue Academy, then press Close the loop and share the note with just the Hub.

Done when: you have closed the loop once. The Hub ticks this step for you.$w$,
  updated_at = now()
where id = 216;

-- the WEEK 1 step (86e1cj9gn): a real change, so people who finished their onboarding see it under Updated since you finished
update public.onboarding_template set
  name = 'The Loop: I''m in, close the loop (every time you work)',
  description = $w$Every time you work for Welfare Avenue (a meeting, your onboarding, a task), press I'm in at the top of the Hub when you start and Close the loop when you finish, with a few lines on what moved. It is how a team that works apart stays in the loop; it is not a timeclock, and the note never carries your hours. The reading in the Avenue Academy shows how in three minutes. (Until the next Hub release lands, the buttons still read Check in and Check out.)

**To complete this step:** be in for your onboarding, then close the loop once with a note shared with your team or just the Hub.

*This step ticks itself when you have closed the loop once.*$w$
where id = '86e1cj9gn';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('training', '216', 'wave192', 'video (Loom, Checking in and out)', 'read: The Loop: I''m in, close the loop (the data side of wave192; the page follows)', 'assistant (wave192 session)');
