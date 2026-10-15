#!/usr/bin/env python3
"""wave243 (15/10/26): the Learning Avenue "The Content Studio" in the Avenue Academy, and its assignment to the marketing
team through the Academy's own assignments (academy_assignments + academy_assign_apply, include_new: people who join the
team later get it too; the daily cron wa-academy-assign keeps it current). Writes build/data/wa243_studio_academy.sql:
the path (academy_paths studio), the lesson How the Content Studio works (a chapter per part of the Studio, the approval
flow from wave241, content for each serving from wave240, the notification switches from wave242, then a knowledge
check). No overlap with what the Academy already has: the page tour (trainings tour:contentstudio, Hub page tours) and
Marketing basics' two reads on posting stay where they are and the lesson points to them. Steel, 14/10/26 marketing
meeting; 15/10/26: "Content Studio path in the Academy (academy_assign, kept current, no overlaps)"."""
import json, os

PATH = 'The Content Studio'

def ch(cid, t, *blocks):
    return {'id': cid, 't': t, 'blocks': list(blocks)}
def lead(x): return {'type': 'lead', 'text': x}
def p(x): return {'type': 'p', 'text': x}
def h(x): return {'type': 'h', 'text': x}
def lst(*x): return {'type': 'list', 'items': list(x)}
def steps(*x): return {'type': 'steps', 'items': [{'t': a, 'd': b} for a, b in x]}
def tip(x, t=None): return {'type': 'callout', 'tone': 'tip', 't': t, 'text': x}
def info(x, t=None): return {'type': 'callout', 'tone': 'info', 't': t, 'text': x}
def warn(x, t=None): return {'type': 'callout', 'tone': 'warn', 't': t, 'text': x}
def tryit(x): return {'type': 'callout', 'tone': 'try', 't': 'Try it', 'text': x}
def stages(*x): return {'type': 'stages', 'items': [{'t': a, 'd': b, 'tone': c} for a, b, c in x]}
def cards(*x): return {'type': 'cards', 'items': [{'t': a, 'd': b, 'icon': c} for a, b, c in x]}

lesson = {
  'summary': 'Every part of the Content Studio: planning the week, writing a post, how it goes to Ian and KK for approval, how it goes out on each platform, comments, the library, the content for each serving, and what reaches you.',
  'chapters': [
    ch('what', 'What the Content Studio is',
      lead('The Content Studio is where Welfare Avenue plans, writes, approves, posts and measures everything on social media, in one place.'),
      p('It opens from the 9 dots (the rose tile, after Fundraising) and lives at #studio. The marketing team and admins can open it. Marketing leads, admins and the named approvers (Ian and KK) can publish; everyone else writes and schedules posts that wait for an approver.'),
      cards(('Plan', 'Overview, Calendar, Queue and schedule: the week ahead, free slots, the posting times and weekly goals.', 'target'),
            ('Make', 'The composer: one post for up to six platforms, with its own caption on each, media, links, a Canva design and a partner.', 'edit'),
            ('Approve', 'Approvals: what waits, what was sent back, yours, approved. Ian and KK hear at once.', 'shield'),
            ('Listen', 'Comments from Instagram, Facebook, Threads and YouTube, every ten minutes, with replies.', 'chat'),
            ('Keep', 'Library: templates, hashtag groups, saved replies, tags, posts by partner; short links and the link in bio page.', 'box'),
            ('Measure', 'Analytics and the printable monthly Report.', 'star')),
      tip('Every page of the Studio has "How this page works" at the top right. The guided page tour is in this Academy under Hub page tours: Content Studio.')),
    ch('plan', 'Overview, the calendar and the queue',
      lead('Overview is the Studio at a glance; the Calendar and the Queue are where the week gets planned.'),
      lst('**Overview**: six numbers, the week ahead, what needs attention, the approvals waiting, the weekly goals and the streak, how each platform posts (direct or by reminder), the latest comments and the best post.',
          '**Calendar**: every post on its day, for Instagram, Facebook, Threads, LinkedIn, TikTok and YouTube. Click a day to add a post, a post to open it.',
          '**Queue and schedule**: the next 14 days with the free slots ("Fill with an idea"), the posting times per platform and weekday, the times our own results suggest, the weekly goals, and the Instagram grid preview so the feed looks right before it is posted.'),
      info('The Hub suggests posts too: a throwback or a recap for a partner serving (see Content for each serving below) arrives as a draft idea, never as a post.')),
    ch('composer', 'The composer',
      lead('One post, written once, tailored for each platform.'),
      lst('**Name and caption**: the caption is shared; "Tailor for each platform" gives Instagram, LinkedIn or any other its own words. Instagram keeps at most five hashtags (the Hub warns past that).',
          '**Media**: photos and videos, with alt text and people tags; carousels, reels and stories on Instagram and Facebook.',
          '**A link**: links in captions become tracked short links (hub.welfareavenue.com/l/...) with UTM tags, so Analytics shows the clicks. Instagram captions are left alone, links are not clickable there.',
          '**First comment**: posted right after the post on Instagram and Facebook (a reply on Threads).',
          '**Canva design (optional)**: the link to the design, so the approvers open it in one click.',
          '**Partner organization (optional)**: the partner the post is about; Library > By partner finds every post about them later (a throwback, a recap, last year’s article).',
          '**LinkedIn article**: a switch when LinkedIn is among the platforms; the name is the headline, the caption the body. Articles are posted by hand: the Hub reminds the owner at the time and asks for the link.',
          '**Templates, hashtag groups, tags, repeats**: from the Library; a repeating post makes the next one after it goes out.'),
      p('The preview shows the post as each platform shows it. Save draft keeps it; Schedule (or Schedule for approval) gives it its time.')),
    ch('approval', 'Scheduling goes to approval',
      lead('Nothing posts unapproved. If you cannot publish, scheduling sends the post to the approvers and keeps its date.'),
      steps(('You schedule it', 'Give the post a date and time and press Schedule for approval (Send for approval when it has no date yet). The post keeps its date and waits.'),
            ('Ian and KK hear at once', 'In the Hub and on Slack, with who sent what, the platforms and the time, your note, the Canva link, and two buttons: Approve and Send it back.'),
            ('Approved', 'The post is scheduled for its time and goes out by itself. You hear in the Hub and on Slack.'),
            ('Sent back', 'A note says what to change (a note is required). Fix it in the composer and schedule it again.')),
      p('Approvals in the Studio shows the same in four lists: Waiting, Sent back, Mine and Approved. Marketing leads, admins and the named approvers schedule and publish directly.'),
      warn('Publishing by hand (Publish now) is for publishers only. A post that was never approved never goes out, whatever its date.')),
    ch('out', 'How a post goes out',
      lead('At its time, the Hub posts where it can and asks a person where it cannot.'),
      lst('**Instagram and Facebook**: posted by the Hub (feed photos, carousels, reels and stories; the first comment right after).',
          '**Threads**: posted by the Hub when its connection is on.',
          '**LinkedIn**: through Make.com, or directly once the LinkedIn connection is approved; videos and articles by hand.',
          '**YouTube Shorts**: uploaded by the Hub when YouTube is connected. **TikTok**: the video lands in our TikTok drafts, to post from the app.',
          '**Anywhere the Hub cannot post**: the reminder flow. At the post’s time the owner gets a Hub notification and a Slack DM with the caption and the media, posts it in the app, then presses Mark posted (with the link).'),
      p('Each platform’s result is saved as it lands, so Try again only sends what is missing and nothing posts twice. A post is **published** when every platform is up or handed to a person, **failed** otherwise, with the reason on the post.'),
      info('The confirmations: every few minutes the Hub matches what is live on the platforms to the calendar, so a post made by hand still shows as posted, with its reach.')),
    ch('comments', 'Comments',
      lead('Every comment on Instagram, Facebook, Threads and YouTube, checked every ten minutes.'),
      lst('Reply (with saved replies and suggested replies), like on Facebook, hide, resolve, assign to someone; delete is for leads and admins.',
          'The comment score and the typical reply time show how we are doing; the latest comments are on Overview too.'),
      tip('Answer as Welfare Avenue, warmly and briefly; questions about a serving go to Operations, about a gift to Fundraising.')),
    ch('library', 'The Library, links and analytics',
      lst('**Templates** (Save as template from the composer), **hashtag groups**, **saved replies** and **tags**.',
          '**By partner**: every post that names a partner organization, newest first, with the platforms, the state and the links.',
          '**Short links**: hub.welfareavenue.com/l/<code> with click counts; **Link pages**: the link in bio page (hub.welfareavenue.com/links) and campaign, event and city pages, with their own insights.',
          '**Analytics**: reach, views, engagement and the best posts by platform; **Report**: a printable month with month-on-month change and a copyable summary.')),
    ch('servings', 'Content for each serving',
      lead('Each serving has a Content card in its Plan stage, so the photos and the stories are planned with the serving.'),
      lst('**The photographers**: who is on the roster as a photographer or videographer, or "No photographer yet" with a link to the Volunteers page. When nobody is confirmed within five days of a partner serving, the Hub gives the owner of the photographer step a task, "Book a photographer", that closes itself once one confirms.',
          '**The Google Photos album**: made by hand in Google Photos, its link pasted on the card; the photographer’s own page and their confirmation text carry it.',
          '**The content brief**: the LinkedIn questions apart from the Instagram and TikTok ones, and shot notes; photographers and videographers see it on their page.',
          '**Throwback and recap ideas**: for a partner serving the Hub suggests a throwback to the last time with that partner before the day and a recap after it; they land in the Studio as ideas to write from.')),
    ch('notify', 'What reaches you, and where',
      p('Settings > Notifications is the notification centre: every kind of notification with a Hub switch and a Slack switch. The Content Studio kind covers a post waiting for your approval, a decision on your post, and a post that is yours to post by hand. Hub notifications pop up on the devices you turned on; Slack ones come to your DMs.'),
      tip('If you approve posts, keep both on: the Slack message carries the Approve and Send it back buttons.')),
    ch('try', 'Your first post',
      steps(('Open the Studio', 'The 9 dots, then Content Studio. Take the page tour once (Academy > Hub page tours > Content Studio).'),
            ('Write a post for next week', 'Calendar, a free day, New post: a name, a caption with one link, a photo with alt text, Instagram and LinkedIn.'),
            ('Tailor LinkedIn', 'Tailor for each platform: a fuller LinkedIn caption; keep Instagram to five hashtags.'),
            ('Add the design', 'Paste the Canva link, choose the partner if the post is about one.'),
            ('Schedule for approval', 'Give it a day and a time. Ian and KK hear; you hear back in the Hub and on Slack.')),
      tryit('Marketing basics has the two reads on getting into our accounts and on engagement; read them before your first post goes live.')),
  ],
  'quiz': {'pass': 0.8, 'questions': [
    {'q': 'You are a marketing member, not a lead. You give a post a date and press Schedule for approval. What happens?', 'a': ['It posts at that time', 'It keeps its date, waits for an approver, and goes out at that time once approved', 'It is deleted', 'It posts right away'], 'c': 1, 'why': 'Scheduling by someone who cannot publish is a submission: the date is kept and the approvers are told at once.'},
    {'q': 'Who hears when a post waits for approval?', 'a': ['Everyone in #general', 'The named approvers, Ian and KK, in the Hub and on Slack', 'Only the board', 'Nobody until Monday'], 'c': 1, 'why': 'The approvers (hub_settings content_studio.approvers) get the notice with Approve and Send it back.'},
    {'q': 'A post is for LinkedIn and the LinkedIn connection is not on. What does the Hub do at the post’s time?', 'a': ['Nothing', 'Posts it to Instagram instead', 'Reminds the owner with the caption and the media, who posts by hand and presses Mark posted', 'Emails the board'], 'c': 2, 'why': 'A platform the Hub cannot post to gets the reminder flow.'},
    {'q': 'How many hashtags does Instagram keep?', 'a': ['Thirty', 'Ten', 'Five', 'None'], 'c': 2, 'why': 'Instagram has kept at most five since December 2025; the composer warns past that.'},
    {'q': 'Where do you find every post about a partner organization?', 'a': ['Analytics', 'Library > By partner', 'Comments', 'Connections'], 'c': 1, 'why': 'Posts carry a partner organization; Library > By partner lists them newest first.'},
    {'q': 'Nobody is confirmed as photographer four days before a partner serving. What does the Hub do?', 'a': ['Cancels the serving', 'Gives the owner of the photographer step a task, Book a photographer, that closes itself once one confirms', 'Posts a call-out by itself', 'Nothing'], 'c': 1, 'why': 'The daily check within five days makes the task; a confirmed photographer on the roster closes it.'},
    {'q': 'A link in a Facebook caption becomes what?', 'a': ['A hub.welfareavenue.com/l/ short link with UTM tags, so the clicks are counted', 'A QR code', 'Plain text', 'A Canva link'], 'c': 0, 'why': 'Tracked links: the go function counts the clicks for Analytics.'},
  ]},
}

def q(s): return "'" + s.replace("'", "''") + "'"
out = ["-- generated by build/data/wa243_studio_academy.py (wave243, 15/10/26)",
  "insert into public.academy_paths (key, name, title, blurb, dept, required, cert_title, color, icon, sort, active) values ('studio', " + q(PATH) + ", 'The Content Studio', " +
  q('How the Content Studio works, part by part: planning the week, writing a post for six platforms, the approval by Ian and KK, how posts go out, comments, the library, the content for each serving and what reaches you.') +
  ", 'marketing', false, 'Content Studio Ready', '#6F64AB', 'spark', 46, true) on conflict (key) do update set name = excluded.name, title = excluded.title, blurb = excluded.blurb, dept = excluded.dept, cert_title = excluded.cert_title, color = excluded.color, icon = excluded.icon, sort = excluded.sort, active = true, updated_at = now();"]
def row(key, kind, title, desc, minutes, xp, sort, body):
    return ("insert into public.trainings (category, title, description, source, kind, key, minutes, xp, path_group, sort, active, body) values ('Marketing', " + q(title) + ", " + q(desc) + ", 'hub', " + q(kind) + ", " + q(key) + ", " + str(minutes) + ", " + str(xp) + ", " + q(PATH) + ", " + str(sort) + ", true, " + q(json.dumps(body, ensure_ascii=True)) + "::jsonb) " +
            "on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, kind = excluded.kind, minutes = excluded.minutes, xp = excluded.xp, path_group = excluded.path_group, sort = excluded.sort, active = true, body = excluded.body, updated_at = now();")
out.append(row('lesson:studio', 'lesson', 'How the Content Studio works', 'Every part of the Content Studio, the approval flow, how posts go out, the content for each serving and what reaches you, with a short knowledge check.', 14, 40, 0, lesson))
# the assignment: the marketing team, people who join later included (the daily cron applies it to them), due in three weeks
out.append("""do $$
declare v_id bigint; v_rows int; v_n int;
begin
  if exists (select 1 from public.academy_assignments a where a.active and a.path_key = 'studio') then return; end if;
  insert into public.academy_assignments (path_key, audience, teams, people, include_new, due_date, due_days, note, assigned_by, assigned_by_email)
  values ('studio', 'team', '{marketing}', '{}', true, current_date + 21, 21, 'The Content Studio, part by part: read it before your next post goes in. Ian and KK approve what the rest of us schedule.', 'the Hub', 'hub@welfareavenue.com')
  returning id into v_id;
  v_rows := public.academy_assign_apply(v_id, null);
  select count(*) into v_n from public.wa169_targets(v_id);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('academy_assignment', v_id::text, 'assigned', null, 'The Content Studio to marketing, due ' || (current_date + 21)::text || ' (' || v_n || ' people, wave243)', 'the Hub');
end $$;""")
out.append("insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('hub', 'release', 'wave243', null, 'The Content Studio in the Avenue Academy: a Learning Avenue with the lesson How the Content Studio works (every part, the approval by Ian and KK, how posts go out, comments, the library, the content for each serving, the notification switches, a knowledge check), assigned to the marketing team and kept current for people who join; process-transcript v18.2: a task with no assignee named goes to its owner', 'assistant');")
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wa243_studio_academy.sql'), 'w').write('\n'.join(out) + '\n')
print(len(out), 'statements')
