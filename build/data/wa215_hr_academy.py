#!/usr/bin/env python3
"""wave215 (07/10/26): the Learning Avenue "The HR centre" in the Avenue Academy.
Writes build/data/wa215_hr_academy.sql: the path (academy_paths hrcentre), the lesson How the HR centre works (a chapter per
part of the HR centre, then a knowledge check) and the seven hands-on walkthroughs (trainings kind tour, key tour:hrwalk-*,
run by parts215). Steel: "a whole rundown on how the HR center works", "really, really comprehensive, every step of the way"."""
import json, os

PATH = 'The HR centre'

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
  'summary': 'Every page of the HR centre, what it is for, who sees it and what happens when you press its buttons.',
  'chapters': [
    ch('what', 'What the HR centre is',
      lead('The HR centre is where Welfare Avenue looks after its people, from the day someone applies to the day they move on.'),
      p('It lives in the menu under People, and in the HR app. HR (Valex, Samson and the HR team), admins and team leaders can open it. Policies and the discipline tracker are for the HR access list only.'),
      cards(('People', 'Team, Hours, Time off, Recognition: who is here, the time they give, time away and thank-yous.', 'people'),
            ('Hiring', 'Applications, Positions, Playbook: from a job posting to a signed offer.', 'flag'),
            ('Growth', 'Onboarding, Onboarding plan, Training: the first weeks and everything learned after.', 'sparkle'),
            ('Records', 'Policies and Discipline: what everyone signs, and the record when things go wrong.', 'shield')),
      tip('Every page has How this page works at the top right, and each part of the HR centre has a hands-on walkthrough in this Learning Avenue.')),
    ch('overview', 'Overview and the bell',
      lead('Overview is the HR centre at a glance.'),
      lst('**Six tiles**: people on the roster, people in The Loop this week, new applications, people onboarding now, people with a training overdue, time off waiting. A tile with something to act on is highlighted; click it to go to its page.',
          '**Needs HR**: everything waiting on HR right now, oldest first, each with Open.',
          '**Coming up** (work anniversaries) and **Newest on the team**.'),
      h('The bell'),
      p('The bell at the top right counts what needs you since you last opened it: time off waiting (HR), applicants you handle who need a call, interviews today and tomorrow, offer letters not sent yet, and new applications. Each line opens the card or the page.')),
    ch('team', 'Team, hours and recognition',
      h('Team'),
      p('Everyone on the roster, by team, with search. Open profile goes to a person\'s page. HR can set a start date by hand. Add someone goes to the Admin panel, where Welfare Avenue accounts (first.last@welfareavenue.com) are made.'),
      h('Hours'),
      p('Hours come from two places, added together for each week:'),
      lst('**The Loop**: from I\'m in to Close the loop. A session left open counts at most eight hours.',
          '**Slack**: the hours people log with their own "in" and "out" messages in the Slack check-in channels, read every morning. The Hub\'s own Loop posts there are never counted twice.'),
      p('The table shows this week, last week and the average a week against each person\'s weekly minimum (managers and up, and everyone else; the board is exempt; the operational executives give 8 hours). People below their minimum come first. Hours from Slack say so under the number. What people shared when they closed the loop is listed below, never with times or hours. Meeting attendance (from Google Meet) is at the bottom.'),
      h('Recognition'),
      p('Shout-outs for someone who did something worth noticing. Anyone who can open the HR centre can post one; it shows here and on the Hub\'s loading screen. Admins can take any down, authors their own.')),
    ch('timeoff', 'Time off',
      lead('People ask for time off from their My page (or the Requests page). HR decides it here.'),
      steps(('They ask', 'Type (vacation, school break, mental health or sick, bereavement, religious holiday, wedding, other), dates and a note. The policy for the type shows as they choose it.'),
            ('Valex and Samson are told', 'A Slack message the moment the request arrives, with a link to Time off.'),
            ('HR decides', 'Approve, or Decline with a reason the person sees.'),
            ('It goes on the calendar', 'Approved time off becomes an all-day event on the hub@welfareavenue.com calendar, with the person as a guest so it shows on theirs too. Declining or reopening takes it off.')),
      p('**Log time off** is for time off agreed in a conversation or an email: the person, the type, the dates, and whether it is already approved. **Days taken this fiscal year** (October to September) adds each person\'s approved days by type, with a total and the mental health and sick days left of 7.'),
      info('Handbook: vacation 4 to 6 weeks by tenure (volunteering 4 times a year adds a week, up to two), 7 mental health and sick days, 2 weeks bereavement. All time off is mutually exclusive.')),
    ch('apps', 'Applications: the board',
      lead('Every application is a card in its stage. Each stage asks for what it needs before a card can move, so nobody skips a step.'),
      stages(('New', 'Just arrived. Read it, choose who handles it.', 'muted'),
             ('Reviewing', 'Needs: Handled by. Call them; text them "still interested?" if it has been a while.', 'gold'),
             ('Interview', 'Needs: the position, a call logged (from Quo with its transcript, or by hand) and the interview day and time.', 'purple'),
             ('Offer', 'Needs: their email, an interview that already happened, and interview impressions. The offer letter opens next.', 'green'),
             ('Hired', 'Needs: the offer letter (or "made another way"), the day they accepted and the start date. Next: onboarding.', 'green'),
             ('Declined or Withdrawn', 'Needs: a reason. A closed card can be moved back if things change.', 'flag')),
      p('Skipping stages asks for everything in between; moving a card back asks nothing. Several cards can move at once with Select: the ready ones move, the others are listed with what they need.'),
      h('Where applications come from'),
      lst('**job@ and the website**: filed by the Hub from the inbox.',
          '**CABM and Je Bénévole**: filed from their emails; volunteer roles (cooks, drivers, servers and the like) go to the Volunteer Manager instead.',
          '**A CV dropped in a position\'s Resumes folder** in Google Drive: a New card within about ten minutes.',
          '**Add an applicant**: someone who applied another way. Their CV\'s Google Drive link is required (Share, then Copy link); the Hub checks it can open it, copies it into the position\'s Resumes folder and reads it.')),
    ch('card', 'Applications: the card',
      lst('**Handled by**: who looks after the applicant. They get a Slack message when the card moves to Interview, Offer or Hired, and the HR channel hears it too.',
          '**Text: still interested?**: one text from the ops line with their own link. Yes moves the card to Reviewing, No to Withdrawn. You see the exact text first.',
          '**Calls**: Reached, voicemail, no answer, wrong number, with a note. At Interview you can pick the call from Quo, with its summary and transcript.',
          '**Grade**: one to five stars per interviewer, with a note; the board can sort by the best grade.',
          '**Interview day and time**, and the **interview** itself: a recorded interview in the Transcript archive links to the card and is reviewed against the job description and the MCC framework.',
          '**From the CV**: what the CV says (current role, experience, education, languages, skills), read from any file, scanned ones too.',
          '**Offer letter**: who they report to, hours, start date, reply-by, who signs, a personal note. It is saved as a Google Doc in Recruitment > Offer Letters and emailed as a PDF.'),
      warn('While Hub email is in test mode, offer letters go to the test inboxes, not to the applicant. Practice applicants (the walkthrough) always get theirs, because they are you.')),
    ch('positions', 'Positions and the Playbook',
      p('Every role is a position with a folder in Google Drive: the job description, older versions and a Resumes folder. A position has a stage (requested, defined, posted, interviewing, offer, filled, closed), its applications, the CVs in its folder (with Add to Applications), and the people who hold the role. New position makes the folder; Sync with Drive brings in what changed there.'),
      p('The **Playbook** is how Welfare Avenue recruits: the philosophy, the interview structure, the templates and the diagrams. Read it before your first interview.')),
    ch('onboarding', 'Onboarding',
      steps(('Assign an onboarding', 'On Onboarding, choose the person. Their plan starts today: every step of the master onboarding with its due date, and what they already did in the Avenue Academy is ticked.'),
            ('Send the Welcome kit', 'It opens on its own: the welcome email and the Slack message, ready to copy.'),
            ('HR setup', 'HR\'s own list for that person: the Google account, Slack, the Hub, the policies to sign.'),
            ('Follow the progress', 'The bar, the steps done and overdue. Leaders see their people on Home. Journey shows the plan exactly as the person sees it.'),
            ('It completes itself', 'When the last step is ticked, by anyone. Steps done in the Avenue Academy tick themselves.')),
      p('**remove** on a row deletes that plan and its progress: only for a plan given by mistake.'),
      h('The onboarding plan'),
      p('The master onboarding: every week and step a new person gets. Edit what people see (a week\'s title, photo, goals, why it matters and opening lesson), add, edit or retire steps, and link a step to the Avenue Academy so it ticks itself. Changes reach everyone still onboarding. Preview what a new person sees shows day one.')),
    ch('training', 'Training',
      p('**Assign a training**: one or more modules or Learning Avenues, to everyone, teams or people, with a due date and a note. People who join later can get it too. Each assignment shows a bar of who finished, See who, and Stop (rows nobody started go; progress made stays).'),
      p('**Trainings across the team**: everyone\'s training person by person, with Assign for one person.'),
      tip('HR, leaders and admins can assign. Leaders can also assign from the Avenue Academy page.')),
    ch('records', 'Policies and discipline',
      p('**Policies**: each links to its document in Drive, with how many signed and who has not. Add a policy (title and Drive link), edit or retire one. People sign on their My page and at the top of their Avenue Academy with I have read and reviewed this.'),
      p('**Discipline**: each person\'s record by category (acknowledging messages, time commitment, missed meetings, conduct, other) and step, with Clean slate to close it. Entries are permanent and only the HR access list sees them.')),
    ch('walk', 'Practice in the walkthroughs',
      p('The walkthroughs in this Learning Avenue have you click the real buttons. In recruitment you are the applicant and the offer letter arrives in your inbox; in onboarding you give yourself a plan; in time off you ask and you decide.'),
      p('What you make there is marked **Practice**: it never goes to Slack, is never texted and never reaches the calendar. Each walkthrough ends with Clear my practice records, and Clear practice on Applications removes what is left.'),
      tryit('Start with HR centre: getting around, then recruitment.')),
  ],
  'quiz': {'pass': 0.8, 'questions': [
    {'q': 'What does a card need before it can move from New to Reviewing?', 'a': ['Someone in Handled by', 'An interview time', 'A grade', 'Nothing'], 'c': 0, 'why': 'Reviewing needs someone handling the applicant.'},
    {'q': 'To move a card to Offer, which of these is required?', 'a': ['A start date', 'Interview impressions and an interview that already happened', 'A Slack message', 'A text to the applicant'], 'c': 1, 'why': 'Offer needs their email, a past interview and impressions; the start date comes at Hired.'},
    {'q': 'Someone adds an applicant by hand. What must the form have?', 'a': ['A LinkedIn link', 'A phone number', 'The Google Drive link to their CV', 'A grade'], 'c': 2, 'why': 'The CV\'s Drive link is required; the Hub checks it and files it into the Resumes folder.'},
    {'q': 'Time off is approved. What happens?', 'a': ['Nothing else', 'It goes on the hub@welfareavenue.com calendar with the person as a guest', 'It is posted in #general', 'It is emailed to the board'], 'c': 1, 'why': 'Approved time off becomes an all-day event on the hub@ calendar; declining takes it off.'},
    {'q': 'Where do the hours on the Hours page come from?', 'a': ['Only The Loop', 'Only Slack', 'The Loop, plus people\'s own in and out messages in the Slack check-in channels', 'Google Calendar'], 'c': 2, 'why': 'Both are added for each week; Slack hours say so under the number.'},
    {'q': 'Who is told when someone asks for time off?', 'a': ['Nobody', 'Valex and Samson, by Slack message', 'Their whole team', 'The board'], 'c': 1, 'why': 'hr-notify messages Valex and Samson with a link to Time off.'},
    {'q': 'A walkthrough left a practice application on the board. How do you remove it?', 'a': ['Decline it', 'Clear my practice records, or Clear practice on Applications', 'Move it to Hired', 'It cannot be removed'], 'c': 1, 'why': 'Practice records are cleared from the walkthrough\'s last step or the Applications bar.'},
  ]},
}

WALKS = [
  ('hrwalk-start', 'Walkthrough: HR centre, getting around', 'The rail, Overview and its tiles, Needs HR, the bell and where every page lives. Hands-on.', 3, 1),
  ('hrwalk-recruit', 'Walkthrough: recruitment, start to finish', 'You are the applicant: add yourself with your own email and a CV link, take your card through Reviewing, a call, Interview, the offer letter (it arrives in your inbox) and Hired, then clear it. Hands-on, practice records only.', 12, 3),
  ('hrwalk-onboard', 'Walkthrough: onboarding a new person', 'Give yourself a practice onboarding plan, send the Welcome kit, open the checklist and HR setup, see the journey as a new person does, then remove it. Hands-on.', 8, 4),
  ('hrwalk-timeoff', 'Walkthrough: time off, both sides', 'Ask for time off as a team member, approve it as HR, see what approving does (the calendar, the totals), log time off for someone. Hands-on, practice records only.', 5, 5),
  ('hrwalk-people', 'Walkthrough: team, hours and recognition', 'The roster, hours from The Loop and Slack against each minimum, what people shared, meeting attendance and shout-outs.', 4, 6),
  ('hrwalk-training', 'Walkthrough: training and the onboarding plan', 'Assign a training to yourself and stop it, follow who finished, and edit the master onboarding and preview what a new person sees. Hands-on.', 6, 7),
  ('hrwalk-policies', 'Walkthrough: policies and discipline', 'Policies and sign-offs, adding and retiring a policy, how people sign, and the discipline tracker (look only).', 3, 8),
]

def q(s): return "'" + s.replace("'", "''") + "'"
out = ["-- generated by build/data/wa215_hr_academy.py (wave215, 07/10/26)",
  "insert into public.academy_paths (key, name, title, blurb, dept, required, cert_title, color, icon, sort, active) values ('hrcentre', " + q(PATH) + ", 'The HR centre', " +
  q('How the HR centre works, page by page, and a hands-on walkthrough of each part: you click the real buttons on practice records (you are the test applicant, and the offer letter comes to you).') +
  ", 'hr', false, 'HR Centre Ready', '#B3402F', 'people', 56, true) on conflict (key) do update set name = excluded.name, title = excluded.title, blurb = excluded.blurb, dept = excluded.dept, cert_title = excluded.cert_title, color = excluded.color, icon = excluded.icon, sort = excluded.sort, active = true, updated_at = now();"]
def row(key, kind, title, desc, minutes, xp, sort, body):
    return ("insert into public.trainings (category, title, description, source, kind, key, minutes, xp, path_group, sort, active, body) values ('HR centre', " + q(title) + ", " + q(desc) + ", 'hub', " + q(kind) + ", " + q(key) + ", " + str(minutes) + ", " + str(xp) + ", " + q(PATH) + ", " + str(sort) + ", true, " + q(json.dumps(body, ensure_ascii=False)) + "::jsonb) " +
            "on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, kind = excluded.kind, minutes = excluded.minutes, xp = excluded.xp, path_group = excluded.path_group, sort = excluded.sort, active = true, body = excluded.body, updated_at = now();")
out.append(row('lesson:hrcentre', 'lesson', 'How the HR centre works', 'Every page of the HR centre, what it is for, who sees it and what its buttons do, with a short knowledge check.', 12, 40, 0, lesson))
for key, title, desc, mins, sort in WALKS:
    out.append(row('tour:' + key, 'tour', title, desc, mins, 30 if mins >= 5 else 20, sort, {'tour': key, 'tab': 'hrcentre'}))
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wa215_hr_academy.sql'), 'w').write('\n'.join(out) + '\n')
print(len(out), 'statements')
