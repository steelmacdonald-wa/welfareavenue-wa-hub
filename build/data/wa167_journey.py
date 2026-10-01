#!/usr/bin/env python3
"""wave167 (29/09/26): the onboarding journey's lessons and settings -> build/data/wa167_journey.sql

Steel: "Make the onboarding interactive with our branding highlighted everywhere. Use photos and make it the best most
educational onboarding possible."

Four Avenue Academy lessons, one to start each week of the plan (chapters with photos from the Photo library, our story,
our numbers, how a serving runs, how the teams work, and a knowledge check each), the step that opens each week and ticks
itself when the check is passed, the avenue renamed Your onboarding, and the journey's settings (app_config
onboarding_journey: the photo, title, goals and why of each week, and our numbers). Facts come from the Hub's key facts
(hub_knowledge wa-key-facts, Steel's answers of 26/09/26); photos only from the Photo library's ready ones.
Run: python3 build/data/wa167_journey.py
"""
import json, os

B = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/'
def P(key, fx=0.5, fy=0.5): return {'src': B + 'photos/web/' + key + '.jpg', 'fx': fx, 'fy': fy}
def photo(key, cap, alt, fx=0.5, fy=0.5): d = P(key, fx, fy); d.update({'type': 'photo', 'cap': cap, 'alt': alt}); return d
def pair(a, b):
    return {'type': 'photos', 'items': [dict(P(a[0], *a[3:]), cap=a[1], alt=a[2]), dict(P(b[0], *b[3:]), cap=b[1], alt=b[2])]}

W1 = {
  'v': 1, 'cover': 'green',
  'summary': 'Who we are in one page, how your onboarding works, the tools you will use, and the habits that keep a remote team of volunteers working well together.',
  'chapters': [
    {'id': 'welcome', 't': 'Welcome to Welfare Avenue', 'blocks': [
      photo('2022-10-autumn-crew-at-the-tent', 'The autumn crew in front of the tents, October 2022.', 'About twenty volunteers in green Welfare Avenue vests pose in front of two green tents under yellow autumn trees.', 0.52, 0.58),
      {'type': 'lead', 'text': 'Welcome. You are joining a youth-powered non-profit fighting food insecurity and poverty by providing direct support to neighbours and communities in need.'},
      {'type': 'p', 'text': 'It started in April 2020, during Montreal\'s first lockdown, when our founder and a few friends began bringing food to people living on the emptied streets downtown. Six years later we serve in Montreal and Toronto, we ran a first pilot in Ottawa, and every one of us, leadership included, is a volunteer.'},
      {'type': 'stats', 'items': [{'n': '2020', 'l': 'the year we began, in Montreal'}, {'n': '20,000+', 'l': 'meals and food bags since'}, {'n': '700+', 'l': 'people have volunteered with us'}, {'n': '3', 'l': 'cities: Montreal, Toronto and a pilot in Ottawa'}],
       'note': 'The Hub\'s estimates from our own records, September 2026.'},
      {'type': 'quote', 'text': 'Service is solidarity, not charity.', 'by': 'Our brand, 2026'},
    ]},
    {'id': 'how', 't': 'How your onboarding works', 'blocks': [
      {'type': 'lead', 'text': 'Your onboarding runs for about 90 days. The first four weeks carry most of it; the 60-day steps help you grow from there.'},
      {'type': 'steps', 'items': [
        {'t': 'Week 1: Get set up', 'd': 'Your accounts, the Hub, our policies, Slack and Loom.'},
        {'t': 'Week 2: Who we are', 'd': 'Our story and foundations, our brand, and your first work in the Hub.'},
        {'t': 'Week 3: Your team', 'd': 'How your team works, your team\'s Learning Avenue, and your first serving.'},
        {'t': 'Week 4: Look back', 'd': 'Two short quizzes, a self-assessment and your 30-day evaluation.'},
        {'t': '60 days: Grow', 'd': 'How charities work, a Learning Avenue of your choice, and 15 minutes with one of our co-executive directors.'}]},
      {'type': 'callout', 'tone': 'tip', 't': 'Steps that tick themselves', 'text': 'Steps marked **Avenue Academy** are done here: finish the lesson, the video or the avenue and the step ticks itself. Everything else, you tick when it is done.'},
      {'type': 'callout', 'tone': 'info', 't': 'Stuck?', 'text': 'Use **Ask for help** under your plan. HR and your lead see it in the Hub and reach out. Your onboarding channel in Slack works too.'},
    ]},
    {'id': 'tools', 't': 'The tools you will use', 'blocks': [
      {'type': 'lead', 'text': 'We are a remote team, so our tools are our office. Each one has a job.'},
      {'type': 'cards', 'items': [
        {'icon': 'home', 't': 'The Hub', 'd': 'Where our work lives: your team\'s page and tasks, meetings, requests, the calendar, and the Avenue Academy with this plan.', 'k': 'hub.welfareavenue.com'},
        {'icon': 'chat', 't': 'Slack', 'd': 'Where we talk every day: your team\'s channel, your onboarding channel and messages.'},
        {'icon': 'doc', 't': 'Google Workspace', 'd': 'Your Welfare Avenue email, calendar and shared drives. Use it in its own Chrome profile, apart from your personal account.'},
        {'icon': 'play', 't': 'Loom', 'd': 'Our meetings are recorded on Loom and come into the Hub by themselves. The Academy\'s videos are Loom videos too.'},
        {'icon': 'sparkle', 't': 'Canva', 'd': 'Where our designs are made, with the brand\'s colours, fonts and doodles.'},
        {'icon': 'search', 't': 'Ask the Hub', 'd': 'Ask a question in plain words: it reads our meetings, documents and trainings and answers with where it found it.'}]},
    ]},
    {'id': 'habits', 't': 'How we work together', 'blocks': [
      {'type': 'lead', 'text': 'Most of us are students giving our time around classes and jobs. A few habits keep that working.'},
      {'type': 'cards', 'items': [
        {'icon': 'clock', 't': 'Check in and out', 'd': 'When you start working for Welfare Avenue, press **Check in** at the top of the Hub; check out when you finish, with a line on what you did. It posts in #check-in-out-wa for you.'},
        {'icon': 'chat', 't': 'Answer within 24 hours', 'd': 'Acknowledge messages from your team within a day, even when the full answer comes later.'},
        {'icon': 'target', 't': 'Your time', 'd': 'Team members give at least 16 hours a month (directors 24) and volunteer at a serving at least twice a year.'},
        {'icon': 'people', 't': 'One meeting a week', 'd': 'Each team meets online once a week. The whole team takes a break every August.'}]},
      {'type': 'callout', 'tone': 'info', 't': 'Finding anything', 'text': 'Search everything at the top of the Hub finds people, tasks, meetings and documents. Ask the Hub answers questions.'},
    ]},
  ],
  'quiz': {'pass': 0.8, 'questions': [
    {'q': 'Where do your team\'s tasks live?', 'a': ['On your team\'s page in the Hub', 'In your email inbox', 'In a spreadsheet your lead shares'], 'c': 0, 'why': 'Every team\'s tasks, projects and requests live in the Hub, on your team\'s page.'},   # wave190: no ClickUp in onboarding text
    {'q': 'You sit down to work on your onboarding. What do you do first?', 'a': ['Nothing, the Hub tracks it', 'Press Check in at the top of the Hub', 'Email HR'], 'c': 1, 'why': 'Check in when you start and out when you finish, with a line on what you did.'},
    {'q': 'What happens to a step marked Avenue Academy in your plan?', 'a': ['HR ticks it for you', 'It ticks itself when you finish it in the Academy', 'It is optional'], 'c': 1, 'why': 'Finish the lesson, video or avenue and the step ticks itself.'},
    {'q': 'How soon should you acknowledge a message from your team?', 'a': ['Within 24 hours', 'Within a week', 'Only when it is urgent'], 'c': 0, 'why': 'A quick acknowledgment keeps a remote team moving, even if the full answer comes later.'},
    {'q': 'Who is paid at Welfare Avenue?', 'a': ['The leadership team', 'The directors', 'Nobody: every one of us, leadership included, volunteers'], 'c': 2, 'why': 'Welfare Avenue has no paid staff. Everyone, leadership included, gives their time.'}]},
}

W2 = {
  'v': 1, 'cover': 'purple',
  'summary': 'Our mission and what we do, our story from a car trunk to three cities, how a Sunday serving runs, and the words we use.',
  'chapters': [
    {'id': 'mission', 't': 'Our mission', 'blocks': [
      photo('2022-02-winter-volunteer-group-b', 'The winter crew, February 2022.', 'Five volunteers in winter coats and green Welfare Avenue vests pose in the snow, one giving a thumbs up.', 0.5, 0.55),
      {'type': 'quote', 'text': 'Welfare Avenue is a youth-powered non-profit fighting food insecurity and poverty by providing direct support to neighbours and communities in need.', 'by': 'Our mission, June 2026'},
      {'type': 'p', 'text': '**Our vision:** a world where poverty is eradicated, everyone has access to basic necessities and inclusive communities are prioritized.'},
      {'type': 'h', 'text': 'What we do'},
      {'type': 'cards', 'items': [
        {'icon': 'bowl', 't': 'Food security', 'd': 'Consistent, coordinated food distribution: healthy meals that build the trust that leads to long-term social reintegration.'},
        {'icon': 'gift', 't': 'Dignified resources', 'd': 'Seasonal clothing, hygiene essentials and basic items, given directly and always with respect.'},
        {'icon': 'handshake', 't': 'The care ecosystem', 'd': 'A bridge between the trust we build on the street and housing, mental health and employment support from our partners.'},
        {'icon': 'people', 't': 'Belonging', 'd': 'Community pop-ups, creative arts and recreational sports that break down isolation.'}]},
      {'type': 'callout', 'tone': 'info', 't': 'Our eight charitable activities', 'text': 'Relieving poverty, addressing food insecurity, increasing access to resources, mobilizing youth and volunteers, collaborating with other nonprofits, advocacy and being a voice, reducing isolation, and outreach and partnerships. The foundations avenue, this week, goes through each.'},
    ]},
    {'id': 'story', 't': 'Our story', 'blocks': [
      {'type': 'lead', 'text': 'From a car trunk to three cities, in six years.'},
      {'type': 'stages', 'items': [
        {'tone': 'gold', 't': 'April 2020', 'd': 'Welfare Avenue begins: 100 sandwiches, an awareness video and a first GoFundMe during Montreal\'s first lockdown.'},
        {'tone': 'green', 't': 'Fall 2020', 'd': 'Weekly food runs from the founder\'s car, feeding about 150 to 200 people a week.'},
        {'tone': 'green', 't': 'March 2021', 'd': 'Our first big event, outside Berri-UQAM metro with Sportira.'},
        {'tone': 'green', 't': 'June 2021', 'd': 'Our own tent; Place Émilie-Gamelin becomes home.'},
        {'tone': 'green', 't': 'October 2021', 'd': 'Incorporated as a Quebec nonprofit, Avenue du Bien-Être in French.'},
        {'tone': 'purple', 't': '2022', 'd': 'CBC and CityNews tell our story; student clubs open at Vanier and Marianopolis.'},
        {'tone': 'gold', 't': 'October 2023', 'd': 'A registered charity: we can issue official donation receipts.'},
        {'tone': 'green', 't': 'September 2024', 'd': 'Toronto: our first serving there, 36 meals at the University of Toronto.'},
        {'tone': 'purple', 't': 'December 2025', 'd': 'The second Holiday Gift Drive delivers more than 3,000 gifts.'},
        {'tone': 'green', 't': 'March 2026', 'd': 'A first pilot in Ottawa with University of Ottawa students.'},
        {'tone': 'gold', 't': 'August 2026', 'd': 'Our refreshed brand, and our first Community Kitchen with DESTA Black Community Network.'}]},
      pair(('2025-12-gift-baskets-delivery', 'Gifts delivered, December 2025.', 'Five volunteers stand with carts piled high with gift bags in a lobby.'),
           ('2026-08-flag-football-team-photo', 'The flag football fundraiser, August 2026.', 'A group of players poses on the field under a blue sky.')),
      {'type': 'note', 'text': 'Every moment, with its sources, is on the Our story page in the Hub (Organization, Our story).'},
    ]},
    {'id': 'serving', 't': 'A Sunday serving', 'blocks': [
      {'type': 'lead', 'text': 'Sunday Servings are our flagship: free, healthy, home-cooked meals, with clothing, hygiene items and someone to talk to, open to everyone, without conditions.'},
      pair(('food-salads-and-grapes', 'Salads and grapes, ready for a serving.', 'Foil trays of green salads and grapes seen from above.'),
           ('2023-10-autumn-plate-served', 'A plate served, October 2023.', 'Volunteers in green vests serve food onto a plate held out across the table.', 0.45, 0.55)),
      {'type': 'steps', 'items': [
        {'t': 'The days before', 'd': 'Groceries go to volunteer cooks\' homes through Instacart; each cook prepares food for about 30 to 35 people.'},
        {'t': 'Late morning', 'd': 'A driver and the team leader collect the tents, tables and supplies from our storage unit and pick up the meals.'},
        {'t': '12:00', 'd': 'Volunteers meet at Place Émilie-Gamelin, next to Berri-UQAM metro, and set up.'},
        {'t': '12:30', 'd': 'Serving starts: meals, clothing, hygiene products and conversation.'},
        {'t': 'Around 2:30', 'd': 'We clean up and pack everything back up.'}]},
      {'type': 'p', 'text': 'In Montreal we serve every second Sunday. Toronto holds about one meal event a month with shelters. You volunteer at one in week 3.'},
    ]},
    {'id': 'speak', 't': 'How we speak', 'blocks': [
      {'type': 'lead', 'text': 'The words we choose decide the picture people have of us and of the people we serve.'},
      {'type': 'compare', 'cols': [
        {'t': 'We say', 'tone': 'good', 'items': ['The people we serve, our community', 'Support, dignity, connection', 'Food as a starting point', 'Youth-powered, a movement', 'Partnership, collaboration']},
        {'t': "We don't say", 'tone': 'bad', 'items': ['The homeless, beneficiaries, people in need', 'Pity, saving people', 'Feeding people, handing out food', 'Just a student club', 'We are the only ones']}]},
      {'type': 'list', 'items': ['**Lead with the person, not their circumstance.**', '**Solidarity, never pity.**', '**Food is our conduit:** the meal builds trust; connection and dignity are the goal.']},
      {'type': 'callout', 'tone': 'tip', 't': 'Our brand', 'text': 'The brand has its own avenue in the Academy, with its knowledge check. It is one of your week 2 steps.'},
    ]},
  ],
  'quiz': {'pass': 0.8, 'questions': [
    {'q': 'When did Welfare Avenue begin?', 'a': ['April 2020', 'October 2023', 'September 2024'], 'c': 0, 'why': 'In April 2020, during Montreal\'s first lockdown.'},
    {'q': 'How do we refer to the people we support?', 'a': ['The homeless', 'Beneficiaries', 'The people we serve'], 'c': 2, 'why': 'We lead with the person, not their circumstance.'},
    {'q': 'What changed in October 2023?', 'a': ['We opened in Toronto', 'We became a registered charity and can issue official receipts', 'We got our first tent'], 'c': 1, 'why': 'The Canada Revenue Agency registered Welfare Avenue as a charity effective October 18, 2023.'},
    {'q': 'Where do our Montreal servings take place?', 'a': ['Place Émilie-Gamelin, next to Berri-UQAM metro', 'The Old Port', 'Concordia University'], 'c': 0, 'why': 'Place Émilie-Gamelin has been our home since 2021.'},
    {'q': 'Which line sums up our brand?', 'a': ['Every little bit helps', 'Service is solidarity, not charity', 'Saving people in need'], 'c': 1, 'why': 'Solidarity, never pity.'}]},
}

W3 = {
  'v': 1, 'cover': 'gold',
  'summary': 'The teams and what each one does, how a good team meeting runs, your tasks and requests in the Hub, and your first serving.',
  'chapters': [
    {'id': 'teams', 't': 'Our teams', 'blocks': [
      photo('2023-05-spring-crew-under-the-tent', 'The crew under the tent, May 2023.', 'About twelve volunteers, most in green vests, pose in front of the green tent in a downtown park.', 0.55, 0.62),
      {'type': 'lead', 'text': 'Two co-executive directors lead the teams below. Every team has a page in the Hub with its tasks, meetings, agenda and requests.'},
      {'type': 'cards', 'items': [
        {'icon': 'bowl', 't': 'Operations Montreal', 'd': 'The Sunday Servings, volunteers and logistics in Montreal.'},
        {'icon': 'map', 't': 'Operations Toronto', 'd': 'The Toronto meal events, partners and volunteers.'},
        {'icon': 'compass', 't': 'Program Development', 'd': 'Our programs, research and data, and the people we serve.'},
        {'icon': 'megaphone', 't': 'Marketing', 'd': 'Content, design, social media and the website.'},
        {'icon': 'target', 't': 'Fundraising', 'd': 'Events, partners, donors and grants.'},
        {'icon': 'people', 't': 'People and HR', 'd': 'Hiring, onboarding, hours and policies.'},
        {'icon': 'file', 't': 'Finance', 'd': 'Money in and out: invoices, receipts and reimbursements.'}]},
    ]},
    {'id': 'meetings', 't': 'Team meetings', 'blocks': [
      {'type': 'lead', 'text': 'Each team meets online once a week. Good meetings are made before they start.'},
      {'type': 'cards', 'items': [
        {'icon': 'chat', 't': 'Confirm the day before', 'd': 'A message 24 hours ahead gives time to fix the time or the agenda.'},
        {'icon': 'list', 't': 'An agenda from the work', 'd': 'The agenda starts from the team\'s tasks in the Hub; add your own items.'},
        {'icon': 'edit', 't': 'A note-taker every time', 'd': 'Someone is named to write the notes and the tasks, every meeting.'},
        {'icon': 'check', 't': 'Tasks with owners', 'd': 'Every task leaves the meeting with a name and a date.'}]},
      {'type': 'callout', 'tone': 'info', 't': 'After the meeting', 'text': 'Meetings are recorded on Loom and come into the Hub by themselves: the summary, the decisions and the tasks land on your team\'s page. One-on-ones stay private to the people in them.'},
    ]},
    {'id': 'work', 't': 'Your tasks and requests', 'blocks': [
      {'type': 'steps', 'items': [
        {'t': 'Find your tasks', 'd': 'On your team\'s page, or under My tasks on Home.'},
        {'t': 'Open one', 'd': 'Its description, comments, files and due date are in one place.'},
        {'t': 'Bring someone in', 'd': 'Type @ and a name in a comment; they get a notification.'},
        {'t': 'Close it', 'd': 'Tick it done when it is done. Your team sees it move.'},
        {'t': 'Need another team?', 'd': 'Send a Request: it lands in their team inbox with what you need and by when.'}]},
    ]},
    {'id': 'serve', 't': 'Your first serving', 'blocks': [
      photo('2024-10-autumn-volunteers-at-work', 'Volunteers at work, autumn 2024.', 'Four volunteers work side by side over foil trays at the serving table.'),
      {'type': 'lead', 'text': 'Every member volunteers at a serving at least twice a year. Your first one is this week, and it is where our work makes the most sense.'},
      {'type': 'list', 'items': ['Ask your onboarding team to put you in touch with the person who runs the serving, and sign up for the next one.', 'Arrive at 12:00 for the setup, dressed for the weather.', 'The team leader briefs you on the day: you might set up, serve, hand out clothing or talk with people.', 'Tell your lead the date you are going, and afterwards how it went.']},
    ]},
  ],
  'quiz': {'pass': 0.75, 'questions': [
    {'q': 'Where do your team\'s meeting notes and tasks end up?', 'a': ['In the Hub, from Loom, by themselves', 'In a document someone writes up', 'Only in Slack'], 'c': 0, 'why': 'The recording comes in from Loom; the summary, decisions and tasks land on your team\'s page.'},
    {'q': 'You need something from another team. What do you do?', 'a': ['Message whoever you know there', 'Send a Request in the Hub, to their team inbox', 'Wait for the next all-team meeting'], 'c': 1, 'why': 'A Request reaches the whole team with what you need and by when.'},
    {'q': 'How often does every member volunteer at a serving?', 'a': ['Once, during onboarding', 'At least twice a year', 'Every week'], 'c': 1, 'why': 'At least twice a year, starting in your onboarding.'},
    {'q': 'Who writes the notes and tasks in a team meeting?', 'a': ['Whoever remembers', 'Someone named at every meeting', 'Nobody, the recording is enough'], 'c': 1, 'why': 'Naming a note-taker every time is the one non-negotiable in our leads\' guidance.'}]},
}

W4 = {
  'v': 1, 'cover': 'teal',
  'summary': 'Your 30-day evaluation, how to keep growing with us, and what we hold on to.',
  'chapters': [
    {'id': 'eval', 't': 'Your 30-day evaluation', 'blocks': [
      photo('2022-10-autumn-student-group', 'A student group behind the tables, October 2022.', 'About twenty-five young volunteers stand smiling behind folding tables under the green Welfare Avenue tent.'),
      {'type': 'lead', 'text': 'At the end of your first month, you and your lead look back together.'},
      {'type': 'steps', 'items': [
        {'t': 'Two short quizzes', 'd': 'The policy quiz and the 30 day quiz. They tick themselves when you submit them.'},
        {'t': 'Your self-assessment', 'd': 'What went well, what was hard, what you want to learn. Send it to your onboarding channel or to HR and your lead.'},
        {'t': 'The 30-day evaluation', 'd': 'Your lead and HR sit down with you. Bring your questions and what you would change.'}]},
    ]},
    {'id': 'grow', 't': 'Growing with us', 'blocks': [
      {'type': 'lead', 'text': 'Onboarding ends at about 90 days. Growing does not.'},
      {'type': 'cards', 'items': [
        {'icon': 'map', 't': 'Learning Avenues', 'd': 'Pick one where you want to grow; each ends with a certificate.'},
        {'icon': 'flag', 't': 'Leading a team', 'd': 'When you are ready to run a meeting or a project, the Leading a team avenue is for you.'},
        {'icon': 'bolt', 't': 'Take on more', 'd': 'Ask your lead about the projects on your team\'s page and in the Task Bank.'},
        {'icon': 'user', 't': 'Meet leadership', 'd': 'Book 15 minutes with one of our co-executive directors in your first 60 days.'}]},
      photo('2021-11-two-volunteers-at-the-tent', 'Two volunteers at the tent, November 2021.', 'Two volunteers in green vests smile side by side under the green Welfare Avenue tent.', 0.6, 0.6),
    ]},
    {'id': 'values', 't': 'What we hold on to', 'blocks': [
      {'type': 'list', 'items': ['**Lead with the person**, not their circumstance.', '**Solidarity, never pity.**', '**We complement, we do not compete:** our role is to connect people with the right support.', '**Outcomes, not inputs:** we talk about the difference we make.', '**Say what could be better.** Your feedback on this onboarding shapes the next one.']},
      {'type': 'callout', 'tone': 'tip', 't': 'Thank you', 'text': 'The people we serve feel the difference every serving, and your team feels it every week. Thank you for being here.'},
    ]},
  ],
  'quiz': {'pass': 0.75, 'questions': [
    {'q': 'What happens around day 30?', 'a': ['Your 30-day evaluation with your lead and HR', 'Your onboarding ends', 'Nothing in particular'], 'c': 0, 'why': 'Your lead and HR sit down with you around day 30.'},
    {'q': 'Where do you pick a Learning Avenue to grow in?', 'a': ['The Avenue Academy', 'Slack', 'The Task Bank'], 'c': 0, 'why': 'Every Learning Avenue is in the Avenue Academy, with a certificate at the end.'},
    {'q': 'Which sentence fits how we speak?', 'a': ['We help the homeless', 'We stand with the people we serve', 'We feed people in need'], 'c': 1, 'why': 'Lead with the person, and solidarity, never pity.'},
    {'q': 'How long does onboarding last?', 'a': ['One week', 'About 90 days', 'A year'], 'c': 1, 'why': 'About 90 days: four weeks, then the 60-day steps.'}]},
}

LESSONS = [
  ('onb:w1', 'Week 1: Welcome to Welfare Avenue', 10, 5, W1),
  ('onb:w2', 'Week 2: Who we are', 12, 70, W2),
  ('onb:w3', 'Week 3: Working with your team', 8, 80, W3),
  ('onb:w4', 'Week 4: Look back, look ahead', 6, 90, W4),
]
STEPS = [
  ('wa167w1', 'WEEK 1', 'Start here: Welcome to Welfare Avenue', 'onb:w1', 'A 10-minute lesson in the Avenue Academy: who we are, how your onboarding works, the tools you will use and how we work together, with a short knowledge check. This step ticks itself when you pass it.'),
  ('wa167w2', 'WEEK 2', 'Start here: Who we are', 'onb:w2', 'A 12-minute lesson: our mission, our story from a car trunk to three cities, how a Sunday serving runs and how we speak, with a short knowledge check. This step ticks itself when you pass it.'),
  ('wa167w3', 'WEEK 3', 'Start here: Working with your team', 'onb:w3', 'An 8-minute lesson: our teams, how a good team meeting runs, your tasks and requests in the Hub, and your first serving, with a short knowledge check. This step ticks itself when you pass it.'),
  ('wa167w4', 'WEEK 4', 'Start here: Look back, look ahead', 'onb:w4', 'A 6-minute lesson: your 30-day evaluation, how to keep growing with us and what we hold on to, with a short knowledge check. This step ticks itself when you pass it.'),
]
JOURNEY = {
  'v': 1,
  'hero': {'photo': 'photos/web/2024-07-summer-team-under-the-tent.jpg', 'fx': 0.5, 'fy': 0.52, 'alt': 'Thirteen volunteers in green Welfare Avenue vests pose under the green tent in a leafy park.', 'tag': 'Service is solidarity, not charity.'},
  'weeks': {
    'WEEK 1': {'title': 'Get set up', 'photo': 'photos/web/2024-10-autumn-volunteers-plating.jpg', 'fx': 0.42, 'fy': 0.45, 'lesson': 'wa167w1',
               'learn': ['Set up your Welfare Avenue accounts: Google, Chrome, Slack and Loom', 'Find your way around the Hub and your team\'s page', 'Read our policies, and check in and out every time you work'],
               'why': 'Everything at Welfare Avenue runs through these tools. A week spent setting them up well saves you hours later, and it means your team can reach you.'},
    'WEEK 2': {'title': 'Who we are', 'photo': 'photos/web/2022-01-winter-crew-in-the-snow.jpg', 'fx': 0.5, 'fy': 0.64, 'lesson': 'wa167w2',
               'learn': ['Tell our story and our mission in your own words', 'Use our brand and the words we use for the people we serve', 'Do your first work in the Hub'],
               'why': 'You represent Welfare Avenue at servings, in messages and online. Knowing where we come from and how we speak means you represent us well.'},
    'WEEK 3': {'title': 'Your team', 'photo': 'photos/web/2023-10-autumn-crew-behind-the-table.jpg', 'fx': 0.55, 'fy': 0.55, 'lesson': 'wa167w3',
               'learn': ['Know how your team works and meets', 'Start your team\'s Learning Avenue', 'Volunteer at your first serving'],
               'why': 'This is where you start contributing: your team, your tasks, and a serving where you see our work first hand.'},
    'WEEK 4': {'title': 'Look back', 'photo': 'photos/web/2025-12-gift-baskets-the-crew.jpg', 'fx': 0.5, 'fy': 0.5, 'lesson': 'wa167w4',
               'learn': ['Show what stuck in two short quizzes', 'Look back on your first weeks in a self-assessment', 'Sit down with your lead and HR for your 30-day evaluation'],
               'why': 'A moment to check what stuck, say what could be better, and plan what comes next with your lead.'},
    '60 DAYS': {'title': 'Grow', 'photo': 'photos/web/2026-08-flag-football-celebration.jpg', 'fx': 0.5, 'fy': 0.5, 'lesson': None,
                'learn': ['Understand how Canadian charities work, receipts included', 'Pick a Learning Avenue to grow in', 'Meet one of our co-executive directors'],
                'why': 'Onboarding ends, growing does not. These steps set you up for the months ahead.'},
  },
  'numbers': [{'n': '2020', 'l': 'the year we began, in Montreal'}, {'n': '20,000+', 'l': 'meals and food bags since'}, {'n': '700+', 'l': 'people have volunteered with us'},
              {'n': '3,000+', 'l': 'holiday gifts delivered in 2025'}, {'n': '3', 'l': 'cities: Montreal, Toronto and a pilot in Ottawa'}],
  'numbers_note': 'The Hub\'s estimates from our own records, September 2026.',
}

def q(s): return "'" + s.replace("'", "''") + "'"
def dq(obj, tag):
    s = json.dumps(obj, ensure_ascii=False)
    assert '$' + tag + '$' not in s
    return '$' + tag + '$' + s + '$' + tag + '$'

out = []
out.append("""-- wa167_journey (29/09/26): the onboarding journey (wave167). Generated by build/data/wa167_journey.py; edit that, not this.
-- Steel: "Make the onboarding interactive with our branding highlighted everywhere. Use photos and make it the best most
-- educational onboarding possible." Four lessons open the weeks (with photos, our story, our numbers and a knowledge check each),
-- their steps tick themselves when the check is passed, the avenue becomes Your onboarding, and the journey's settings live in
-- app_config onboarding_journey. Every change is guarded: running it twice changes nothing.

-- 1. the avenue holds the whole onboarding now (the week 1 videos and the four lessons)
update public.trainings set path_group = 'Your onboarding' where path_group = 'Your first week';
update public.academy_paths set name = 'Your onboarding', title = 'Your onboarding',
    blurb = 'The lessons that open each week of your onboarding and the videos behind week 1: your accounts, Slack, checking in and out, our policies, who we are, how the teams work, and looking back and ahead.',
    cert_title = 'Welcome to Welfare Avenue', updated_at = now()
  where key = 'firstweek' and name = 'Your first week';
""")
out.append('-- 2. the four lessons')
for key, title, mins, sort, body in LESSONS:
    out.append("insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, minutes, body)\n  values ('Onboarding', %s, %s, 'hub', 'Your onboarding', %d, true, 'lesson', %s, %d, %s::jsonb)\n  on conflict (key) where key is not null do nothing;"
               % (q(title), q(body['summary']), sort, q(key), mins, dq(body, 'j')))
out.append('\n-- 3. each week opens with its lesson; the step ticks itself when the knowledge check is passed')
vals = []
for sid, sec, name, key, desc in STEPS:
    vals.append("  (%s, %s, null, %s, %s, 1, 'high', true, false, null, null, (select id from public.trainings where key = %s))" % (q(sid), q(sec), q(name), q(desc), q(key)))
out.append("insert into public.onboarding_template (id, section, parent_id, name, description, sort, priority, active, content_pending, clickup_url, academy_path, training_id)\n  values\n" + ',\n'.join(vals) + '\n  on conflict (id) do nothing;')
out.append("""
-- 4. the journey's settings: each week's photo, title, goals, why and lesson, our numbers (the page falls back to the same values)
insert into public.app_config (key, value, updated_at) values ('onboarding_journey', %s, now())
  on conflict (key) do nothing;
""" % dq(JOURNEY, 'c'))
out.append("""-- 5. what it means
comment on column public.onboarding_template.training_id is 'wave166: the step is done in the Avenue Academy, by finishing this module (trainings.id). The step ticks itself (wa166_onb_sync, trg_wa166_tp_onb). wave167: each week opens with a lesson step (wa167w1 to wa167w4) that ticks itself when its knowledge check is passed.';
""")
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wa167_journey.sql')
open(path, 'w', encoding='utf-8').write('\n'.join(out))
print(path)
# a copy of the settings for the page's fallback
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'parts167', 'journey_defaults.json'), 'w', encoding='utf-8').write(json.dumps(JOURNEY, ensure_ascii=False, indent=1))

# test data for test/w167drive.js (the scratchpad fixture): the lessons, the steps and the settings as rows
SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/'
if os.path.isdir(SP):
    json.dump({'lessons': [{'key': k, 'title': t, 'minutes': m, 'sort': so, 'body': b} for k, t, m, so, b in LESSONS],
               'steps': [{'id': i, 'section': sec, 'name': n, 'key': k, 'description': d} for i, sec, n, k, d in STEPS],
               'journey': JOURNEY}, open(SP + 'fx167.json', 'w', encoding='utf-8'), ensure_ascii=False)
