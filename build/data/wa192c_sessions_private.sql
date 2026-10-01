-- wave192c (01/10/26): session rows (and so hours) are the person's own, and HR's. Steel's choice: "Hours stay private: the
-- person's own page and the HR centre". Applied right after the wave192 page ships (it reads who is in and the shared notes
-- through loop_in_now() and loop_feed()). Before this, any staff member or board viewer could read everyone's sessions.
alter policy hub_checkins_read on public.hub_checkins using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or (select public.is_hub_admin())
  or (select public.wa169_can_assign())
);
comment on policy hub_checkins_read on public.hub_checkins is 'wave192c: a person reads their own sessions; admins and HR (wa169_can_assign: the HR profile, leaders and admins, the people the HR centre is for) read everyone''s. Teammates see shared notes through loop_feed() and who is in through loop_in_now(), never times or hours.';
comment on table public.hub_checkins is 'The Loop (wave192; check in and out before): a session starts with I''m in and ends with Close the loop, with minutes worked and the wrap-up note (summary.bullets) the person chose to share: to their team''s channel, to everyone (the Loop channel) or just the Hub. Starting posts nothing; the shared post carries what moved, never times or hours. Rows are read by the person, admins and HR (wave192c); everyone else reads loop_feed() and loop_in_now(). Open sessions close themselves after eight hours (auto_closed).';
