-- =====================================================================
-- wave245 (15/10/26): the notification centre, robust and descriptive
-- =====================================================================
-- Steel, 15/10/26, on seeing wave242's centre: "The notifications need to be even more robust and descriptive."
-- 1. hub_notification_kinds: the registry of every kind of notification the Hub sends a person (and, for the record, what
--    it posts in Slack channels): when it fires, what the message says, an example, which channels it has, who gets it,
--    which function sends it. The centre reads it (no list in the page), the senders name their kind by its key.
-- 2. hub_notifications_sent: one row per message the Hub tried to send a person (Slack DM, Hub notification, email):
--    what it said, where, and the outcome (sent, skipped and why, failed and why). notify v15, hub-push v4 and the
--    relayed senders write it; the centre shows each person their own last 30 ("Recent") so nobody wonders whether
--    something was sent. Admins read all rows (the Admin centre). Written by the service role only.
-- 3. wa245_notify_allowed(email, kind, channel): the one rule every sender can ask (the saved switch, else the old
--    disabled list, else the Hub/Slack channel with a device on), so a kind cannot slip past the centre.
-- 4. wa245_due_lists carries each task's team, project and the first line of its description (the reminder reads them).
-- 5. The kinds that had no switch (time off requests to HR, an applicant you handle, the Loop's Still in?) now go
--    through notify (events timeoff_request, applicant, loop_still) and so through the switches, the log and the
--    fallback to the Hub when Slack cannot reach the person.
-- No row deleted.
-- =====================================================================

create table if not exists public.hub_notification_kinds (
  key text primary key,
  grp text not null,
  grp_title text not null,
  sort int not null default 100,
  title text not null,
  blurb text not null,
  says text not null,
  example_title text,
  example_body text,
  example_url text,
  hub boolean not null default true,
  slack boolean not null default true,
  email boolean not null default false,
  channel_only boolean not null default false,
  audience text not null default 'everyone',
  sender text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.hub_notification_kinds is 'wave245: the registry of every notification the Hub sends a person (and posts in Slack channels): when it fires, what it says, an example, its channels, who gets it, which function sends it. The notification centre reads it; migrations write it.';
comment on column public.hub_notification_kinds.channel_only is 'wave245: true for what is posted in a Slack channel for everyone (no per-person switch); shown in the centre for the record';
comment on column public.hub_notification_kinds.audience is 'wave245: who gets this kind in words (everyone, the HR notify list, publishers, the owner of the photographer step)';
alter table public.hub_notification_kinds enable row level security;
drop policy if exists hub_notification_kinds_read on public.hub_notification_kinds;
create policy hub_notification_kinds_read on public.hub_notification_kinds for select to authenticated using (public.is_wa_staff());
grant select on public.hub_notification_kinds to authenticated;

insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, example_title, example_body, example_url, hub, slack, email, channel_only, audience, sender) values
('task_reassigned', 'work', 'Your work', 10, 'A task is given or handed to me',
 'The moment someone makes a task for you or moves one to you: on a team page, from a meeting (the transcript names you), or by the Hub itself (a photographer to book, a recap to write).',
 'The task, its team and project, the due date, who gave it, the first lines of its description, and a link that opens the task.',
 'A task is now yours', 'Call Oberoi about the Oct 18 event: food, number of volunteers, arrival time. Marketing, due Fri 17 Oct, from Ian. "Confirm the headcount and the 11:30 arrival; ask whether they bring the cooler."', '#mypage', true, true, false, false, 'everyone', 'notify, hub-push'),
('task_due', 'work', 'Your work', 20, 'My tasks due today, tomorrow or overdue',
 'Weekday mornings at 8:30, once a day, when you have a task due today or tomorrow; on Mondays also when you only have overdue ones (the last 60 days).',
 'Each task with its team, its due date and the first line of its description, in three lists: due today, overdue, due tomorrow; then a link to My page to close them or move the dates.',
 'Your tasks, Thursday 16 October', 'Due today (2): Call Oberoi about the Oct 18 event (Marketing). Decide with Suro on inventory (Operations Montreal). Due tomorrow (1): Follow up with Vatsala (HR). Close them or move the dates in the Hub.', '#mypage', true, true, false, false, 'everyone', 'wa242_due_reminders, notify, hub-push'),
('request_filed', 'work', 'Your work', 30, 'A request is filed for my team',
 'When someone files a request that lands with you: it is assigned to you, its type goes to you by default, or you lead the team it is for.',
 'The request and its type, who asked, when it is needed, the details they wrote, and a link to the Requests page.',
 'New request for your team', 'Volunteer appreciation stickers (Marketing), from Soraya, needed by Fri 24 Oct. "50 stickers with the new logo for the Oct 26 serving; the printer needs the file by Tuesday."', '#requests', true, true, false, false, 'the person it is assigned to, else the team’s leads', 'notify, hub-push'),
('suggestion_accepted', 'work', 'Your work', 40, 'A meeting suggestion becomes a request for my team',
 'When a request the Hub suggested from a meeting transcript is accepted into a real request that lands with you.',
 'The request, the meeting it came from and the sentence that raised it, and a link to the Requests page.',
 'A meeting suggestion is now a request', 'Order the Rally Paper banners (Fundraising), from the 14 Oct marketing meeting: "we need the two banners before the Concordia tabling".', '#requests', true, true, false, false, 'the person it is assigned to', 'notify, hub-push'),
('request_update', 'work', 'Your work', 50, 'A request I asked for is done, or someone adds a note to it',
 'When a request you filed is marked done, and when someone adds a note on it (the person it is assigned to hears about notes too).',
 'The request, who did it or wrote the note, the note itself, and a link to the request.',
 'Your request is done', 'Your request "Volunteer appreciation stickers" to Marketing is done (Eduardo).', '#requests', false, true, false, false, 'the person who asked, and the person assigned', 'team-inbox'),
('mail_for_you', 'work', 'Your work', 60, 'An email to info@ is passed on to me',
 'When an email to info@welfareavenue.com (or one sent on to a team) is for you: the Hub reads it and passes it on, unless someone on the team is already on the email.',
 'Who wrote, the subject, the gist in a few lines, and a link to the email in the Hub inbox.',
 'An email for you', 'From Oberoi Financial Group: "Oct 18 volunteer day: parking and arrival". They ask where the team parks and confirm 12 volunteers.', '#hubmail', false, true, false, false, 'the person it is for', 'team-inbox'),
('mentioned', 'mentions', 'Meetings and mentions', 10, 'A meeting mentions me',
 'After a meeting transcript is processed and the meeting names you with something to do or know. Never from a one-on-one or a private meeting; a leadership meeting names the meeting without the sentence.',
 'The meeting and its date, the sentence that mentions you, and a link to My page.',
 'You were mentioned in a meeting', 'Marketing meeting (14 Oct): "Ian will find a photographer for the Oberoi event and send the album link to Roberto."', '#mypage', true, true, false, false, 'everyone', 'notify, hub-push'),
('comment_mention', 'mentions', 'Meetings and mentions', 20, 'Someone @mentions me in the Hub',
 'When someone writes @you in a comment, a task description, a request note, a goal or a project in the Hub. On Slack it arrives as a message from the writer when they connected Slack, else from the Hub with their name.',
 'Their words around the mention and where it is, with a link that opens it. A confidential item is named without its text.',
 'Ian mentioned you', 'On the task "Book a photographer for the serving on Saturday 18 October": "@Roberto can you bring the second camera and shoot the arrival?"', '#task/757', true, true, false, false, 'everyone', 'notify, hub-push'),
('content_studio', 'studio', 'Content Studio', 10, 'Content Studio: a post waits for my approval, is decided, or is mine to post by hand',
 'When a post is scheduled for approval (the approvers hear with Approve and Send it back buttons), when your post is approved or sent back, at the time of a post the Hub cannot post itself (LinkedIn articles, TikTok photos: you post it and press Mark posted), and the Monday link pages digest for publishers.',
 'Who sent what, the platforms and the time, the note, the Canva link, and the buttons or the link into the Studio.',
 'A post waits for your approval', 'Roberto sent a post for approval: "Oberoi volunteer day, the recap" (Instagram, LinkedIn, Sun Oct 19 6:00 p.m.). Approve · Send it back · Open the Studio.', '#studio/approvals', true, true, false, false, 'the approvers, the publishers and the post’s owner', 'social-publish, linkpage, hub-push'),
('volunteer_applied', 'volunteers', 'Volunteers and servings', 10, 'A photographer or videographer applies',
 'When a volunteer applies as a photographer or videographer (the website form, CABM, Je Bénévole, by hand). It goes to the owner of the Volunteer Photographers step in the serving SOP.',
 'Who applied, as what, where from, their message, and a link to Applicants received.',
 'A photographer applied', 'Amina Osei applied as a photographer (the website), also as a server: "I shoot events on weekends and can come to the Oct 26 serving."', '#volunteering/applicants', true, true, false, false, 'the owner of the photographer step', 'notify, hub-push'),
('timeoff_request', 'people', 'People and HR', 10, 'Someone asks for time off',
 'The moment a team member asks for time off on their My page or the Requests page. It goes to the HR notify list (Valex and Samson). Practice requests from the Academy never send it.',
 'Who asks, the dates and the number of days, the type, their note, and a link to Time off in the HR centre.',
 'Time off requested', 'Joy asks for vacation, Mon 3 to Fri 7 Nov (5 days): "Family visit; the content calendar is scheduled through the week." Decide it in the HR centre.', '#hrcentre/timeoff', true, true, false, false, 'the HR notify list', 'hr-notify, notify'),
('applicant', 'people', 'People and HR', 20, 'An applicant I handle moves stage',
 'When an application card you handle moves to Interview, Offer or Hired, or is closed after an interview, by someone else. The HR channel hears every move; this is your own copy.',
 'The applicant and the role, the stage and the interview time, who moved it, and a link to the Applications board.',
 'An applicant you handle moved', 'Vatsala Godi (Operations Co-Lead) moved to Interview (Tue Oct 21, 2:00 p.m.) by Samson. You handle this applicant.', '#hrcentre/applications', true, true, false, false, 'the person handling the applicant', 'recruit-actions, notify'),
('loop_still', 'loop', 'The Loop', 10, 'Still in? after three hours in the Loop',
 'When your Loop session has run for three hours with no sign of life (the Hub asked under the button at one hour, then every half hour). One message per session, never a second one.',
 'How long you have been in, and the links: still in, or close the loop (nothing changes your hours without an answer).',
 'Still in the Loop?', 'You have been in the Loop since 9:15 (3 hours). Still in? Or close the loop. Nothing changes your hours until you answer.', '#mypage', true, true, false, false, 'everyone', 'checkin-post, notify'),
('announcement', 'announce', 'Announcements', 10, 'A new announcement for me',
 'When someone posts an announcement for everyone or for your team. Its Slack post in the team channel and its email are sent once regardless; this is the Hub notification.',
 'Who posted, the title and the first line, and a link that opens it (a poll or a short form opens on its question).',
 'Announcement from Steel', 'Oct 18 Oberoi volunteer day: meeting point, times and who brings what. Open it to see the plan.', '#home', true, false, false, false, 'the people it is for', 'hub-push'),
('daily_alerts', 'channels', 'Also, in Slack channels', 10, 'The daily alerts', 'Every morning at 9:00 in the dashboard channel: tasks that passed their due date yesterday, tasks a week overdue, decisions open for 14 and 30 days. Open work only.', 'Each item with its team and owner, as a link into the Hub.', null, null, null, false, true, false, true, 'the channel', 'daily-alerts'),
('weekly_digest', 'channels', 'Also, in Slack channels', 20, 'The weekly digest', 'Mondays in the dashboard channel: what each team moved last week, what is due this week, the decisions waiting. Open work only.', 'A section per team with counts and the top items.', null, null, null, false, true, false, true, 'the channel', 'weekly-digest, slack-digest'),
('shoutouts', 'channels', 'Also, in Slack channels', 30, 'Shout-outs', 'Daily, the work people closed and the thank-yous posted in the Hub, on the loading screen and in Slack.', 'Who did what, in a line.', null, null, null, false, true, false, true, 'the channel', 'shoutouts'),
('hr_channel', 'channels', 'Also, in Slack channels', 40, 'Applications and time off in #human-resources', 'Every applicant card that moves to Interview, Offer or Hired, and the offer letters sent, as a line in the HR channel.', 'The applicant, the role, the stage and who moved it.', null, null, null, false, true, false, true, 'the channel', 'recruit-actions'),
('studio_confirm', 'channels', 'Also, in Slack channels', 50, 'Posts that went out, in #social-media', 'When the Content Studio publishes a post (or sees one posted by hand in the analytics), a confirmation with the links, when the Studio setting is on.', 'The post, each platform it went to, and the link to open it.', null, null, null, false, true, false, true, 'the channel', 'social-publish'),
('loop_channel', 'channels', 'Also, in Slack channels', 60, 'The Loop in #check-in-out-wa', 'When someone presses I’m in and when they close the loop: one line each, with what moved; never hours, times or a private task’s title.', 'Who is in, who closed the loop and what they moved.', null, null, null, false, true, false, true, 'the channel', 'checkin-post')
on conflict (key) do update set grp = excluded.grp, grp_title = excluded.grp_title, sort = excluded.sort, title = excluded.title, blurb = excluded.blurb, says = excluded.says, example_title = excluded.example_title, example_body = excluded.example_body, example_url = excluded.example_url, hub = excluded.hub, slack = excluded.slack, email = excluded.email, channel_only = excluded.channel_only, audience = excluded.audience, sender = excluded.sender, active = true, updated_at = now();

create table if not exists public.hub_notifications_sent (
  id bigint generated always as identity primary key,
  email text not null,
  kind text not null,
  channel text not null,
  title text,
  body text,
  url text,
  outcome text not null,
  ref text,
  sent_by text,
  sent_at timestamptz not null default now()
);
create index if not exists hub_notifications_sent_email_idx on public.hub_notifications_sent (email, sent_at desc);
comment on table public.hub_notifications_sent is 'wave245: one row per message the Hub tried to send a person (a Slack DM, a Hub notification, an email): the kind (hub_notification_kinds.key), the words, where it went and the outcome (sent, skipped: why, failed: why). Written by the senders with the service role (notify, hub-push, team-inbox, wa242_due_reminders); each person reads their own rows in the notification centre (Recent), admins read all.';
comment on column public.hub_notifications_sent.outcome is 'wave245: sent | sent (Hub instead: no Slack account) | skipped: switched off | skipped: Hub only | skipped: no device | failed: <why>';
alter table public.hub_notifications_sent enable row level security;
drop policy if exists hub_notifications_sent_own on public.hub_notifications_sent;
create policy hub_notifications_sent_own on public.hub_notifications_sent for select to authenticated using (public.is_wa_staff() and (lower(email) = lower(public.wa_email()) or public.is_hub_admin()));
grant select on public.hub_notifications_sent to authenticated;

-- the one rule every sender may ask: does this kind reach this person on this channel?
create or replace function public.wa245_notify_allowed(p_email text, p_kind text, p_channel text)
returns boolean language plpgsql stable security definer set search_path to '' as $$
declare
  v_email text := lower(coalesce(p_email, ''));
  v_kind text := coalesce(p_kind, '');
  v_prefs jsonb; v_disabled jsonb; v_k jsonb; v_channel text; v_device boolean;
  v_can_hub boolean := true; v_can_slack boolean := true;
begin
  if v_email = '' or v_kind = '' or p_channel not in ('hub', 'slack') then return false; end if;
  select coalesce(hub, true), coalesce(slack, true) into v_can_hub, v_can_slack from public.hub_notification_kinds where key = v_kind;
  if found and ((p_channel = 'hub' and not v_can_hub) or (p_channel = 'slack' and not v_can_slack)) then return false; end if;
  select coalesce(p.prefs, '{}'::jsonb), case when jsonb_typeof(p.disabled) = 'array' then p.disabled else '[]'::jsonb end into v_prefs, v_disabled
    from public.wa_notify_prefs p where lower(p.email) = v_email;
  if v_prefs is null then return true; end if;   -- nothing saved: everything on
  v_k := v_prefs -> 'kinds' -> v_kind;
  if v_k is not null and jsonb_typeof(v_k) = 'object' and jsonb_typeof(v_k -> p_channel) = 'boolean' then return (v_k ->> p_channel)::boolean; end if;
  if v_disabled ? v_kind then return false; end if;
  v_channel := coalesce(v_prefs ->> 'channel', 'both');
  if p_channel = 'hub' then return v_channel <> 'slack'; end if;
  if v_channel = 'hub' then
    select exists (select 1 from public.hub_push_subs s where lower(s.email) = v_email) into v_device;
    return not v_device;   -- Hub only, with a device on: no Slack
  end if;
  return true;
end $$;
comment on function public.wa245_notify_allowed(text, text, text) is 'wave245: does this kind of notification reach this person on this channel (hub or slack): the saved switch (wa_notify_prefs.prefs.kinds), else the disabled list, else the channel choice with a device on. Every sender asks it.';

-- a line in the log from SQL (the reminders, the relayed senders)
create or replace function public.wa245_log_sent(p_email text, p_kind text, p_channel text, p_title text, p_body text, p_url text, p_outcome text, p_ref text default null, p_by text default null)
returns bigint language plpgsql security definer set search_path to '' as $$
declare v_id bigint;
begin
  insert into public.hub_notifications_sent (email, kind, channel, title, body, url, outcome, ref, sent_by)
  values (lower(coalesce(p_email, '')), coalesce(p_kind, ''), coalesce(p_channel, ''), left(p_title, 200), left(p_body, 600), left(p_url, 300), left(coalesce(p_outcome, ''), 300), left(p_ref, 120), left(p_by, 80))
  returning id into v_id;
  return v_id;
end $$;

-- the reminder's lines carry the team, the project and the first line of the description
create or replace function public.wa242_due_lists(p_member bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  m record;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_lead boolean; v_admin boolean; v_board boolean;
  j_today jsonb; j_over jsonb; j_tom jsonb;
begin
  select tm.id, lower(coalesce(tm.email, '')) as email, coalesce(tm.name, '') as name, to_jsonb(tm.nicknames) as nicknames into m
    from public.team_members tm where tm.id = p_member;
  if m.id is null or m.email = '' then return jsonb_build_object('due_today', '[]'::jsonb, 'overdue', '[]'::jsonb, 'due_tomorrow', '[]'::jsonb); end if;
  v_admin := exists (select 1 from public.hub_roles r where lower(r.email) = m.email and r.role = 'admin');
  v_lead := v_admin or exists (select 1 from public.hub_roles r where lower(r.email) = m.email and r.role = 'leader');
  v_board := exists (select 1 from public.board_circle b where lower(b.email) = m.email);
  with x as (
  select t.id, t.title, t.due_date as due, t.department,
         coalesce((select dm.label from public.dept_meta dm where dm.department = t.department), t.department) as team,
         (select pr.name from public.projects pr where pr.id = t.project_id) as project,
         nullif(left(regexp_replace(regexp_replace(coalesce(t.description, ''), '[#*_>`]+', '', 'g'), '\s+', ' ', 'g'), 140), '') as line,
         t.priority
    from public.dept_tasks t
   where t.done = false and t.banked_at is null
     and t.due_date between v_today - 60 and v_today + 1
     and (not coalesce(t.board_only, false) or v_board)
     and (exists (select 1 from public.task_assignees a where a.task_id = t.id and a.member_id = m.id)
          or public.wa242_name_is(t.owner, m.email, m.name, m.nicknames))
     and (t.visibility is null or t.visibility in ('', 'department')
          or (t.visibility = 'private' and (public.wa242_name_is(t.owner, m.email, m.name, m.nicknames)
                                            or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(coalesce(t.allowed_people, '[]'::jsonb)) = 'array' then t.allowed_people else '[]'::jsonb end) ap
                                                        where public.wa242_name_is(ap, m.email, m.name, m.nicknames))))
          or (t.visibility = 'speakers' and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(coalesce(t.allowed_people, '[]'::jsonb)) = 'array' then t.allowed_people else '[]'::jsonb end) ap
                                                     where public.wa242_name_is(ap, m.email, m.name, m.nicknames)))
          or (t.visibility = 'leadership' and (v_lead or v_board))
          or (v_admin and t.visibility <> 'speakers')))
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'due', to_char(x.due, 'FMDD Mon'), 'due_date', x.due, 'department', x.department, 'team', x.team, 'project', x.project, 'line', x.line, 'priority', coalesce(x.priority, false)) order by x.due, x.title) filter (where x.due = v_today), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'due', to_char(x.due, 'FMDD Mon'), 'due_date', x.due, 'department', x.department, 'team', x.team, 'project', x.project, 'line', x.line, 'priority', coalesce(x.priority, false)) order by x.due desc, x.title) filter (where x.due < v_today), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'due', to_char(x.due, 'FMDD Mon'), 'due_date', x.due, 'department', x.department, 'team', x.team, 'project', x.project, 'line', x.line, 'priority', coalesce(x.priority, false)) order by x.due, x.title) filter (where x.due = v_today + 1), '[]'::jsonb)
    into j_today, j_over, j_tom
    from x;
  return jsonb_build_object('due_today', j_today, 'overdue', j_over, 'due_tomorrow', j_tom, 'day', to_char(v_today, 'FMDay FMDD FMMonth'), 'date', v_today);
end $$;

revoke execute on function public.wa245_notify_allowed(text, text, text) from public, anon;
grant execute on function public.wa245_notify_allowed(text, text, text) to authenticated;
revoke execute on function public.wa245_log_sent(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.wa242_due_lists(bigint) from public, anon, authenticated;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('hub', 'release', 'wave245', null,
        'The notification centre, robust and descriptive: every kind the Hub sends a person is in a registry (hub_notification_kinds) with when it fires, what it says and an example, grouped in the centre with a Hub and a Slack switch and Send me a sample; three kinds that had no switch (time off requests to HR, an applicant you handle, the Loop''s Still in?) now go through it; every message tried is logged (hub_notifications_sent) and the centre shows each person their Recent; Slack cannot reach you means the Hub tries instead (and the centre says when nothing would reach you); the reminders and the task, request and mention messages say more (team, project, due date, the details)',
        'assistant');

-- Run by hand after the security advisor check (15/10/26): the trigger function is not for the API roles.
revoke execute on function public.wa239_volunteer_applied() from public, anon, authenticated;
