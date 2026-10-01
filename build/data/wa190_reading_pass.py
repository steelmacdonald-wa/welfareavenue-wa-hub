#!/usr/bin/env python3
"""wave190 (01/10/26): the reading pass -> build/data/wa190_reading_pass.sql

Steel (30/09/26): "Can you revist some of the trainings and onboarding to ensure everything is please to read and that it's
well branded".

The words, rewritten to read well (the facts kept as they were, or brought up to date where the Hub has moved on):
  - the nine Using the Hub modules (trainings 39 to 46 and 92): a lead, short sections with headings, lists, Try it and
    Done when (the reading layout of wave190 in 122_wave122 draws ## headings, numbered steps and Tip: / Good to know: /
    Watch out: callouts). Module 1 lists the Volunteer Manager among the apps and module 6 is about the app (wave176);
    module 7 no longer names ClickUp.
  - the master onboarding (onboarding_template, the 45 active steps): one shape for every step (what and why, then
    "**To complete this step:**", then how it ticks itself in italics, which wave190 draws as a gold box and a quiet note);
    the Hub's address is hub.welfareavenue.com; one DocuSign ask instead of two; two learnings asked for, not "one ... (one
    and one)"; no "Link to quiz:". The steps' updated_at is kept as it was, so people who finished their onboarding are not
    told about 45 "updated" steps for what is wording.
  - the week 1 lesson (onb:w1): the Hub's address on the tools card, and a quiz option that no longer names ClickUp.
  - the welcome email's template (app_config onboarding_email_template): the Hub's address.
  - readings imported from the Slack training lists and ClickUp (113, 148, 149, 165, 173, 184, 37), the ClickUp leftovers
    (22, 33, 34, 35, 36, 38, 47, 48, 49, 50) and the Marketing Strategy Package (24 to 30): structure, no "Preserved from
    ClickUp", no credentials to share, the dead ClickUp link on 22 gone (it becomes a reading that points to the course's
    Learning Avenue and Important info), 34 (a placeholder with no content) becomes a planned training in Marketing basics,
    where leaders see it to write it.
Every update is guarded on the row's key or id; running it twice changes nothing more.
Run: python3 build/data/wa190_reading_pass.py
"""
import json, os

HUB = {}   # id: (title or None, minutes, description)

HUB[39] = (None, 3, """Goal: Know your way around Home, the menu and the apps, so you can always find your work.

## Home, your page
Sign in and you land on Home (My page). It gathers what is yours, top to bottom:

- **The news banner:** what happened lately and what is coming (the next servings, thank-yous after a serving, fundraising events, people who joined a team, wins from team meetings and news from the admins). It is rebuilt every morning; hover over it or press pause to stop it.
- **Announcements for you,** from your leaders, HR and the admins. Answer a poll with a tap, or a short form in a window; the totals show once you answer, when the poster shares them.
- **Your open tasks,** with their due dates. Late ones turn red.
- **Your team's plate,** if you lead people.
- **Updates** that mention you or your department, **incoming requests** and **your tracked hours.**
- **Mentions:** when a meeting you were not in talked about you, a card shows up so you stay in the loop. Press Got it once you have read it.

Good to know: leaders, HR and the admins post announcements from Home too. Each one goes out once in Slack and once by email.

## Your inbox (a few people for now)
If the inbox assistant is on for your mailbox, Your inbox on Home keeps what needs your reply and what a team should handle. It files your new Welfare Avenue mail into your own Gmail folders, writes a reply that sounds like you after asking you a question or two (saved as a Gmail draft: you send it), and sends an email on to a team's inbox with your one-line ask.

## The menu
- **At the top:** Home, the Avenue Academy, the Executive dashboard, the Calendar and The Brain.
- **Departments:** each team's page, with its own pages folded under it.
- **Other Tools:** Important info, The Task Bank, Agendas, the Document finder, the Transcript archive, the Photo library and Requests.
- **Organization:** the Org chart, Our story and the Hub inbox.

You see the pages your access profile opens (Hub module 9 explains how).

## The apps
Apps, at the bottom of the menu, open the bigger tools: Strategy (goals and projects), the Volunteer Manager (servings, rosters, texts and volunteers), the CRM (contacts, partners, gifts and email), the HR centre, Finance and the Admin centre.

## On a phone
The bar at the bottom has Home, the Calendar, Ask, your team and Menu. Menu opens everything, with Find a page at the top and the apps as tiles.

Try it: open Home, find your open tasks, and click one update to read it.

Done when: you can say where your tasks, your mentions and your department's updates live.""")

HUB[40] = (None, 3, """Goal: Use your team's page to see what is going on, and to add, move and close your own tasks.

## Your team's page
Each department page is the team's live status board, top to bottom:

1. The quarterly goals, with the wins the AI spotted in meetings.
2. Updates from recent meetings.
3. Workstreams and tasks.

## Tasks
- **Add one** with the + button. A task for someone in another department files itself into their department.
- **Link it** to a project with the project pill, and give it a date with the due pill.
- **Close it** when it is done. Nothing is ever deleted: closed tasks keep their history, and every change shows in Activity.

## The bank: work for later
When a task cannot start for three months or more, open it and press Move to the bank. It leaves every board and count, and comes back by itself on the day you pick. A project's lead can bank a whole project from its page. Everything waiting is in The Task Bank, under Other Tools.

## Bring someone in with @
Type @ and their name, then pick them from the list. It works in a task's comments or description, a goal comment, a request note, a team update, a decision, a project description and the notes of a Content calendar post. They get a Slack message with what you wrote and a link straight to it.

Tip: connect Slack under Settings, Connections (Send @mentions as you) and the message comes from you. Until then it comes from the Hub, with your name.

Good to know: a mention in a confidential or board-only item tells them where to look, without the text.

Try it: open your department page, add yourself a small task with a due date, then close it.

Done when: you can add, assign, project-link, bank and close a task, and bring someone in with @.""")

HUB[41] = (None, 3, """Goal: Turn a meeting into tasks, updates and wins, and know who can see it.

## Meetings come in by themselves
Meetings recorded on the Hub's Loom account (hub@welfareavenue.com) arrive on their own: every Monday, Wednesday and Friday at 7:30, the Hub pulls the new ones. Board meetings, anything that may be sensitive and meetings whose team is unclear wait for an admin, who files or skips them from the Loom card at the top of the Transcript archive.

## Upload one yourself
1. Drop the transcript into the Transcript archive.
2. Pick the department, or Leadership meeting to spread it across all departments.
3. Set the Meeting visibility: everyone, leaders only, confidential to the people you pick, or a one-on-one that only the people in it see.
4. Press Save, then read the preview. It lists everything the AI intends to do: new tasks, closures with their evidence, updates, suggested requests, goal wins and mentions. Nothing saves until you approve.

## What the Hub does with it
- **Closing a task** needs clear proof from the meeting.
- **Work talked about again** becomes a comment on the task it already has, not a duplicate.
- **Work put off by three months or more** goes straight to the bank, with the reason, and comes back on its date.
- **In a marketing meeting,** ideas for posts, reels and series go to the Content calendar's Ideas, each with the meeting it came from. An idea three months or more away waits in the bank until six weeks before its date.
- **Older Loom meetings** the Hub pulled in later are kept for the archive and Ask the Hub only: no tasks, updates or suggestions come from them.

## Who sees a meeting
- **Weekly team meetings:** everyone.
- **Leadership meetings:** the leaders.
- **A one-on-one:** only the people speaking in it. Nobody else, not even an admin or a leader, can open it, find it in a search or get answers from it.
- **Interviews and other meetings:** the people in them and the leaders.

Ask the Hub answers from every meeting you may see, and only those.

Try it: upload your next meeting and read the preview before you approve it.

Done when: you have uploaded one transcript and checked what it filed.""")

HUB[42] = (None, 3, """Goal: Ask another team for something, follow it, and handle what comes to your team.

## Asking another team
The Requests page is how one team asks another for something concrete: a post, a design, printing, event coverage, supplies, transport, a recruit, access or time off.

1. Press New request.
2. Pick the team, then what you need (or Something else).
3. Fill in the short form.

It lands in that team's inbox and is posted in their Slack channel. Follow it in My requests; you get a Slack message when it is done.

## Money goes to Finance
Finance is a team of its own, apart from Fundraising. Reimbursements and purchase approvals are requests to Finance, the Hub inbox sends Finance the invoices and receipts, and #accounting-finance hears about each one. Finance's inbox and tasks are in the Finance app.

## Your team's inbox
Your team's work waits in the Team inbox, on the Requests page and at the top of your team's overview page:

- Requests to your team.
- Emails the Hub inbox filed for your team. Jev pings the channel only when one needs you soon.
- Emails sent to info@, with a To do line the Hub wrote. The person it is for gets a Slack message, or the channel when it is for the whole team; nobody is pinged when someone on the team is already on the email.
- Emails a colleague sent on from their own inbox, with their ask.
- Asks the AI heard in meetings. They wait until someone accepts or dismisses them.

Open anything to set its status, hand it to someone, mark it done or add a note. Notes go into the Slack thread too.

Try it: file one real request, then open your team's inbox and handle one item.

Done when: you know where to ask, where to follow your asks and where your team's inbox lives.""")

HUB[43] = (None, 2, """Goal: See how a task you finish moves a quarterly goal.

## How the work adds up
1. Tasks group into projects.
2. Projects roll up into the quarterly department goals.
3. Department goals roll up into the organization's goals.

## Where it lives
The goals and projects live in the Strategy app (Apps, at the bottom of the menu): Organizational goals, Department goals, Projects and Goal alignment. Department goals is where goals are added, measured and linked to projects.

## Meetings keep it up to date
Meeting transcripts feed it by themselves: tasks route into the right project, and real progress shows up as wins under each goal on the department page.

Try it: open Strategy, then Department goals, then your department page, and follow one goal down to its projects and tasks.

Done when: you can explain how a task you finish moves a quarterly goal.""")

HUB[44] = ('Hub module 6: the Volunteer Manager', 2, """Goal: Find your way around the Volunteer Manager, where our Montreal servings are run.

## The app
The Volunteer Manager is an app of its own: open it from Apps, at the bottom of the menu. Its rail has:

- **Servings:** the Calendar (every serving opens inside the app), The SOP, Recipes and Inventory.
- **People:** Volunteers.

Text volunteers sits in the app's bar.

## Each serving
- **Its checklist,** copied from the master program SOP. A role like Coordinating volunteers is given to a person with one dropdown, and every linked step across the upcoming servings gets that owner.
- **Its roster,** with texting and confirmations.
- **The inventory:** staff edit the counts in place, and can share a no-account editing link with volunteer leaders when needed.

Good to know: a volunteer is one record across the Volunteer Manager and the CRM. An edit in one shows in the other straight away.

## After each serving
Send volunteers the survey from the event page (copy the link under What volunteers said). Their answers, the lead's event audit and a short summary land on the event within six hours. New sign-ups from the recurrent volunteers form wait for review in the volunteer list.

Try it: open the next serving and read its checklist top to bottom.

Done when: you can find a serving's roster, checklist and itinerary.""")

HUB[45] = (None, 3, """Goal: Know where your onboarding, your assigned trainings and every page tour live.

## The Avenue Academy, top to bottom
- **Your onboarding:** your plan week by week, the Hub's first steps and the policies to sign.
- **Assigned to you:** trainings HR or a leader gave you, with the due date, who asked and why.
- **Your level and progress,** and what is up next.
- **Learning Avenues,** each with a certificate at the end.
- **Page tours:** a guided tour for every page of the Hub.
- **The library:** every video, lesson and document.

Open anything and it fills the screen: watch, read or take the knowledge check, then mark it complete. Certificates and badges show on your profile.

## Your onboarding is a journey
The plan opens as an avenue: each week is a stop, with its photo, what you will learn, why it matters and a short lesson with a knowledge check to start it. Your people and our numbers sit below, and finishing a week is celebrated.

Many steps are Avenue Academy modules or Learning Avenues (the three everyone does, your team's and one of your choice). They tick themselves when you finish them, and the videos play inside the Hub.

Tip: stuck on a step? Use Ask for help under your plan. HR and your lead see it.

## Three avenues everyone does
Welfare Avenue foundations, Our brand and Using the Hub.

The Our brand knowledge check is a hard one: 15 questions in a new order every attempt. A wrong answer points you to the page of the Brand Guides to check instead of showing the answer, and you see every answer once you pass (12 of 15).

## Quizzes, HR and leads
- **The policy quiz and the 30 day quiz** are Google Forms. When someone with an onboarding in progress takes one, the Hub ticks that step with their score, and HR sees the results and what new members said in the HR centre.
- **HR runs onboarding from the HR centre:** its master onboarding is exactly what you see here, week by week. HR and leaders assign trainings to everyone, a team or a few people.
- **Leads see each person they are onboarding on Home:** how far they are, what is late, and the moments that are the lead's (introduce them, first tasks, the two-week and 30-day check-ins, the quizzes).

Good to know: leaders also see Planned trainings inside a Learning Avenue: the ones the team listed in the Slack training lists but never made (or whose link did not come across). Add the content, a link or the text, and it joins the avenue for everyone.

Try it: take the tour of the Avenue Academy itself, then one page tour.

Done when: you know where your onboarding, your assigned trainings and the page tours live.""")

HUB[46] = (None, 2, """Goal: Get answers from the Hub, build a meeting agenda in a minute, and find help on any page.

## Ask the Hub
The chat assistant (Ask) answers from the whole Hub: tasks, decisions, transcripts and what we know as an organization, plus our story since 2020: what happened when, with which partners, what we learned and where it is written down. Restricted meetings stay sealed.

## Agendas
Agendas builds a meeting agenda from the board: type the meeting's purpose and it pulls in the right tasks and topics. You only see the agendas you are part of.

## Help on every page
Every page has a How this page works button with a visual guide. When in doubt, start there.

Try it: ask the Hub "what is overdue in my department?", then "when did we become a registered charity?", and build one agenda with a purpose line.

Done when: you know where to ask questions, build agendas and find help.""")

HUB[92] = (None, 2, """Goal: Know which access profile you have, what it opens and how to ask for more.

## Your profile decides your pages
Everyone on the Hub has an access profile:

- **One for each team:** Marketing, Fundraising, Program Development, Operations Montreal, Operations Toronto, and HR & People.
- **Board member, Executive and Admin.**

Team leads get a little more: Agendas, Activity, the HR centre, the board pages, and inviting people into their own team.

## Closed, not just hidden
The finances and the board pages are also protected in the database, so a page you do not have is closed, not just hidden.

## Private whatever your profile
- **HR records** stay with the HR access list.
- **Private meeting notes** stay with the people they name.
- **Who came to meetings** is for the executive directors and the admins, in the HR centre.

Try it: open your profile menu (your photo, top right) and choose Your access. Look through your pages, then use Request more access if something you need is missing.

Done when: you can say which profile you have, name one page it gives you, and know how to ask for more.""")

# ---------------------------------------------------------------- the master onboarding
TICK_VIDEO = '*This step ticks itself when you mark the video watched.*'
TICK_MODULE = '*This step ticks itself when you mark the module watched.*'
TICK_CHECK = '*This step ticks itself when you pass the knowledge check.*'
TICK_AVENUE = '*This step ticks itself when you finish the avenue.*'
TICK_FORM = '*This step ticks itself when you send the form.*'

ONB = {
 # WEEK 1
 'wa167w1': "A 10-minute lesson in the Avenue Academy: who we are, how your onboarding works, the tools you will use and how we work together, with a short knowledge check.\n\n" + TICK_CHECK,
 'wa166hub': "The Hub ([hub.welfareavenue.com](https://hub.welfareavenue.com)) is where Welfare Avenue's work lives: your team's tasks, meetings and requests, the calendar, and the Avenue Academy, where this plan and your trainings are.\n\n**To complete this step:** sign in with your Welfare Avenue Google account and bookmark the Hub.",
 'wa166hubfirst': "The Get started card on Home walks you through your profile, your team and your first task, and ticks each part as you do it.\n\n**To complete this step:** finish the Get started card in your first days.",
 'wa166usehub': "Nine short modules on how the Hub works: Home, your team's page and tasks, meeting transcripts, requests between teams, goals, the Volunteer Manager, training, Ask the Hub and who sees what. Everyone does this avenue.\n\n" + TICK_AVENUE,
 '86e1cj9gj': "Set up Chrome with your Welfare Avenue Google account, so your work stays apart from your school or personal accounts. Work through the four steps below.",
 '86e1cj9gp': "Download Chrome on your laptop, then watch the welcome video in the Avenue Academy: it sets up your Welfare Avenue profile.\n\n" + TICK_VIDEO,
 '86e1cj9gr': "Google Meet is how we meet. Watch the Avenue Academy module on setting up a Google Meet. To find a time that suits everyone, keep [this short video on When2Meet](https://www.loom.com/share/500d4af7547742a89458dfaf3e3194be) handy.\n\n**To complete this step:** bookmark your Google Calendar.\n\n" + TICK_MODULE,
 '86e1cj9gx': "Set up your Welfare Avenue email signature with the Avenue Academy module.\n\n**To complete this step:** send your lead a test email that shows your signature.\n\n" + TICK_MODULE,
 '86e1cj9gy': "Google Groups are shared email addresses for a group of people. [Watch the short training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07NETWRVE1?record_id=Rec07QRFM2Q4V), then ask HR to add you to the groups you should be in.\n\n**To complete this step:** once you are in a group, send it a test email with \"Onboarding test\" as the subject.",
 '86e1cj9gh': "Our policies are what we commit to as a team. Read them in full, in the [full version](https://docs.google.com/document/d/1_M0fdr3P71Y95ptj-6toA6phRYHaKCsG/edit) or the [summarized version](https://docs.google.com/document/d/1Sg62q5H4KktrYTp0tGneto4ruouwgLbU5lej4gkMo5E/edit), and keep this step open until you have. Questions are welcome: ask in your onboarding channel, or comment on the doc and tag someone.\n\nThe policies also live in the shared [Org Files > HR folder](https://drive.google.com/drive/folders/1Q0YRW5TroUNSI411lYaNbWIEvz7BvKvb), with the [90 day evaluation](https://docs.google.com/document/d/1TXKgL8V-JGvRneKa6BGuRUrjeGJ_pYfs/edit).\n\n**To complete this step:** once you have read them, ask HR to send you the policies to sign on DocuSign.",
 '86e1cj9gn': "Every time you work for Welfare Avenue (a meeting, your onboarding, a task), check in when you start and out when you finish, with a line on what you did. The Check in button at the top of the Hub does it and posts in #check-in-out-wa for you. The video in the Avenue Academy shows how.\n\n**To complete this step:** check in and out for your onboarding and for your first team meeting.\n\n" + TICK_VIDEO,
 '86e1cj9gq': "Read [performance and discipline tracking](https://docs.google.com/document/d/1PHhf41ChaLOZu4ybsWyEpXrsKIQLDDlCN-_kfq7sH5c/edit), then watch Our policies in practice, from HR, in the Avenue Academy.\n\n**To complete this step:** if you have not signed the policies yet (the step above), ask HR to send them to you on DocuSign.\n\n" + TICK_VIDEO,
 '86e1cj9h0': "Slack is where we talk to each other, so it matters from day one. Work through the five steps below.",
 '86e1cj9h3': "Slack is a must: communication is central to your role.\n\n- On your phone: [Android](https://slack.com/downloads/android) or [Apple](https://apps.apple.com/ca/app/slack/id618783545)\n- On your computer: [Windows](https://slack.com/downloads/windows) or [Mac](https://slack.com/downloads/mac), and pin Slack to your Chrome bookmarks\n\n**To complete this step:** have Slack on your phone and on your computer.",
 '86e1cj9h2': "Watch how our Slack is laid out, in the Avenue Academy.\n\n**To complete this step:** find your team's channel.\n\n" + TICK_VIDEO,
 'wa166slack2': "Watch part 2 in the Avenue Academy.\n\n**To complete this step:** set up your Slack profile: your photo, your name and your role.\n\n" + TICK_VIDEO,
 '86e1cj9h8': "Watch Organising your Slack in the Avenue Academy, then make a section for each team so you can see everyone at Welfare Avenue (the Org chart in the Hub shows who is where).\n\n**To complete this step:** send your onboarding channel a screenshot of your sections.\n\n" + TICK_VIDEO,
 '86e1cj9hc': "Watch Managing your Slack notifications in the Avenue Academy.\n\n**To complete this step:** make sure your team's channel notifies you on your phone.\n\n**Tip:** add your lead and your teammates as VIP contacts, so you never miss their messages.\n\n" + TICK_VIDEO,
 '86e1cj9h6': "Meet Welfare Avenue through other people's eyes:\n\n- [Our CityNews segment](https://www.youtube.com/watch?v=_K5C8O6HEZE)\n- [Our mission, vision and activities](https://www.youtube.com/watch?v=mt8jNvv9uso): jump to the 50-minute mark; the question period is worth it\n- [Montreal Guardian on Welfare Avenue](https://montrealguardian.com/montreal-charity-welfare-avenue/)\n- [The Link on the gentrification of thrifting](https://thelinknewspaper.ca/article/the-gentrification-of-thrifting)\n- [CBC on Montreal homelessness and Welfare Avenue](https://www.cbc.ca/news/canada/montreal/montreal-homeless-welfare-avenue-1.6470047)\n\n**To complete this step:** tell us in your onboarding channel what stuck with you or what you learned about us. A short message is plenty.",
 '86e1cj9ha': "As you go, tell us anything that is unclear, missing (a link, a file), repeated, or could be more helpful. It makes the onboarding better for the next person.\n\nStuck on a step (a link that does not open, an invite that never came)? Use Ask for help under your plan: HR and your lead see it in the Hub.",
 '86e1cj9he': "**Introduce yourself in your team's channel** before your first meeting with your department: your name and role, where you are, and a fun fact or something you enjoy.\n\n**Introduce yourself in #general** within your first four days: your name and role, and a line on what you are looking forward to.",
 '86e1cj9hh': "Our meetings are recorded on Loom, and the trainings you watch in the Avenue Academy are Loom videos too. You should get an invitation to Loom from your onboarding team; if not, ask for one.\n\n**To complete this step:** make sure you have a Loom profile on your Welfare Avenue email, then message your onboarding channel once you have finished week 1.",
 # WEEK 2
 'wa167w2': "A 12-minute lesson: our mission, our story from a car trunk to three cities, how a Sunday serving runs and how we speak, with a short knowledge check.\n\n" + TICK_CHECK,
 'wa166found': "Three lessons: the eight charitable activities we are registered for, our partners, and our story since 2020. Everyone does this avenue.\n\n" + TICK_AVENUE,
 'wa166brand': "The Brand Guides, the brand refresh video and the knowledge check (12 of 15 to pass). Everyone does this avenue.\n\n" + TICK_AVENUE,
 'wa166work': "Your tasks live on your team's page in the Hub. Read Hub module 2 in the Avenue Academy, then open your team's page: find your tasks, open one, comment with @ to bring someone in, and close a task when it is done. Work for another team goes through Requests.\n\nYour lead gives you your first tasks in a meeting this week.\n\n*This step ticks itself when you finish Hub module 2.*",
 '86e1cj9gm': "We design in Canva.\n\n**To complete this step:** ask Marketing for the Canva invitation, then for the folders and files you need (the folders especially).",
 '86e1cj9gv': "[Watch the short Google Photos training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07MM3G4P18?record_id=Rec07MZPARJL9), then open [Google Photos](https://photos.google.com/) and bookmark it. Ask Marketing for the Team Share album.\n\n**To complete this step:** add all the photos from the Team Share album to your own Google Photos.\n\n**Tip:** the photos that are labelled and cleared for use are in the Hub's Photo library (Other Tools).",
 # WEEK 3
 'wa167w3': "An 8-minute lesson: our teams, how a good team meeting runs, your tasks and requests in the Hub, and your first serving, with a short knowledge check.\n\n" + TICK_CHECK,
 '86e1cj9hg': "Volunteering at our events is part of everyone's role. Ask your onboarding team to put you in touch with the person who runs volunteering events, and sign up for an upcoming one.\n\n**To complete this step:** tell your lead the date you will volunteer.",
 '86e1cj9hm': "Watch [the itinerary training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07RK3A3NVD?record_id=Rec07RZGPAMK5) to see how our events run. Not on the Operations team? Skimming the videos is enough.\n\n**To complete this step:** send your onboarding team a few lines on how you understand an event runs.",
 'wa166team': "Your team has its own Learning Avenues in the Avenue Academy (Marketing basics, Operations basics, People and HR, Fundraising and grants, and more). Work through one; ask your lead which fits your role. If your team has none yet, any avenue besides the three everyone does counts.\n\n*This step ticks itself when you finish one.*",
 'wa166meeting': "Your team's weekly meeting comes into the Hub by itself from Loom.\n\n**To complete this step:** after your next one, find it in the Transcript archive (Other Tools) or on your team's page, and ask the Hub one question about it, like what was decided or what is yours to do.",
 # WEEK 4
 'wa167w4': "A 6-minute lesson: your 30-day evaluation, how to keep growing with us and what we hold on to, with a short knowledge check.\n\n" + TICK_CHECK,
 '86e1cj9ht': "A deeper look at our charitable work, in the step below.",
 '86e1cj9hx': "You met our eight charitable activities in the foundations avenue (week 2). Now go deeper with [the full document](https://docs.google.com/document/d/1jCbzwXECdzeRskF7NHjPB7n4_wW9wn-X/edit#heading=h.v8n7c0e22e).\n\n**To complete this step:** leave at least three comments in the document.",
 '86e1cj9hr': "Two short quizzes to check what you have learned, in the steps below.",
 '86e1cj9hv': "This quiz checks your understanding of the policies you take on as a member of the team: [take the policy quiz (Google Form)](https://forms.gle/zesoPhpx9ga33j817).\n\n**To complete this step:** message your onboarding channel once it is done, so HR can look over your answers.\n\n" + TICK_FORM,
 '86e1cj9hw': "[Take the 30 day quiz (Google Form)](https://forms.gle/aoZVR1g6ELRnogMw9).\n\n**To complete this step:** message your onboarding channel once you have sent it.\n\n" + TICK_FORM,
 '86e1cj9hz': "Write a short self-assessment of your first three weeks. Keep it light: it is only to hear how it is going for you.\n\n- What went well, and what you like so far\n- The challenges you faced\n- The skills or areas you want to learn more about\n- Where you see yourself contributing more\n\n**To complete this step:** send your answers in your onboarding channel, or to your HR rep and your lead.",
 # 60 DAYS
 '86e1cj9j1': "How Canadian charities work, in the two steps below.",
 '86e1cj9j3': "Watch [how charities work (YouTube)](https://www.youtube.com/watch?v=ZLA-trD_vVc).",
 '86e1cj9j4': "Watch, read and review everything in the [charitable receipts training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07NETWRVE1?record_id=Rec07PC0EF9AL).\n\n**To complete this step:** share two things you learned about charitable receipts in your onboarding channel: one from the video and one from the CRA website.",
 '86e1cj9j0': "Pick a Learning Avenue in the Avenue Academy that fits where you want to grow (Leading a team, Charity governance, Marketing basics and more) and work through it; your lead can help you choose.\n\n*This step ticks itself when you finish one besides the three everyone does and the one you did for your team.*",
 '86e1cj9j6': "Book 15 minutes with one of our co-executive directors.\n\n**To complete this step:** send them a Google Calendar invite (see Setting up a meeting, week 1) and post in your onboarding channel once it is booked.",
}

# ---------------------------------------------------------------- other readings
# id: dict of the columns to set (description always; title, kind, resource_url, path_group, body, minutes when they change)
READS = {}

READS[113] = {'description': """Goal: Get a new person ready on day one: their Google account, Slack, the website and our drives.

1. **Create their Google account** ([how to add a user](https://support.google.com/a/answer/33310?hl=en)).
- Use the format firstname.lastname@welfareavenue.com.
- Set a temporary password, tick "Ask for a new password when they sign in", and share it with them one to one.
- They add the account in a Chrome window of its own, apart from their school or personal one.
2. **Add them to Slack** with the Welfare Avenue email you just created.
3. **Add them to the Slack channels they need,** at least #general and #training.
4. **Add them to Meet the Team on the website.** They sign up on the website first, with their Welfare Avenue email (not with Google) and a photo; the training Adding a new person to Meet the Team on the website shows the rest, and counts as done with this one.
5. **Add them to the shared drives and the email groups** they need.
6. **Ask them for a photo** for the newsletter announcement."""}

READS[148] = {'description': """Goal: Run a meeting with a partner, sponsor or funder that is clear, professional and leads somewhere.

1. **Before the meeting**
- Dress professionally: first impressions count.
- Review the materials and the agenda.
- Confirm the date and time, and invite everyone who needs to be there.
2. **Starting the meeting**
- Greet them and thank them for their time.
- Clear up any scheduling mix-up first.
3. **The purpose**
- Say clearly what the meeting is for.
- Give the context and any background they need.
4. **The main topics**
- Keep the conversation structured: project updates, event planning, ways to work together.
- Be specific about dates, expectations and logistics (the venue, the materials).
5. **Options, together**
- Work through the options with them.
- Stay open to their ideas and feedback.
6. **Next steps**
- Sum up what you agreed and what happens next.
- Say who does what, and by when.
7. **Closing**
- Thank everyone for their time.
- Confirm the next meeting or follow-up.
8. **After the meeting**
- Send a follow-up email with the outcomes, the next steps and the dates agreed.
- Follow each action until it is done.

Watch out: avoid jargon and technical language, keep to time, and make sure everyone gets to speak.

Tip: an agenda keeps the conversation on track, shared documents and calendars make planning easier, a recording (with their consent) keeps the details, and regular check-ins keep the relationship going.

More to watch: [the Loom walkthrough](https://loom.com/share/f64b44e7b24d4f4b9423655d5a3bdccb)."""}

READS[149] = {'description': """1. Get the course login: it is in Important info, under Thriving Non-Profits course (ask your lead if you cannot open it).
2. Complete every class in Introduction to the Program, except:
- Tell Us About Your Organization
- Activate your 3-month Free Trial (optional)
- Non-profits coaching"""}

READS[165] = {'description': """Goal: Run a tabling event that recruits and raises awareness, with everything you need on the table.

## Bring
- A computer to show our videos and the QR code.
- [The QR code (Canva)](https://www.canva.com/design/DAF_b_87rXE/cTsk8udrOWIms-quYE_LQw/edit).
- Our pinnies and the tablecloth.
- Posters: from the storage unit in Park Ex, or print them from [the posters folder](https://drive.google.com/drive/folders/1o9OB9j-BOekg0PyQ8DQ2XQPi5WX7QY9G?usp=sharing).
- [The recruitment form](https://forms.gle/w2Cr5HBhBXyKUReYA), ready to scan.
- If you are fundraising, the Square payment machine.

Good to know: everything is in the storage unit, and the payment machine is with Steel.

## Steps
1. Request the table (see the training on tabling requests).
2. Tell the team about the tabling event in #general, then message people one by one.
3. Make sure you, or someone attending, brings everything above.
4. Make a group chat with the details and each person's time. At least two members must attend."""}

READS[173] = {'description': """Two videos show how we build a serving's itinerary: one for the servers, and one for the team leader and the drivers.

Watch out: their links did not come across from Slack. Find them in [the thread in Slack](https://welfareavenue.slack.com/archives/C045HMDRMAP/p1677601887060919?thread_ts=1677601887.060919&cid=C045HMDRMAP), or ask Operations."""}

READS[184] = {'description': """Chapter 3 of the Impact Navigator: email marketing.

Try it: bring your lead three to five takeaways, and what you are saving to Keela or to your notes."""}

READS[37] = {'description': """Goal: Ask for a new position the right way, so HR can recruit the person the team needs.

## How we recruit
- Recruitment is an active process.
- Lean teams work better.
- Screen for integrity, intelligence and energy.
- Referrals come before experience.
- For roles that are not leadership roles, the ability to learn is key.

## Make sure it fits
- Talk with the role's direct lead to understand exactly what the role needs, and adjust the job description.
- Check [the org chart](https://www.canva.com/design/DAGmEcr0-SU/X_NSqPEpeK6ouzc5MnINxg/edit) and add the new role to it.

## Make the request
File a Position recruitment request in the Hub with:
- the role's title and the date,
- a link to the job description,
- the number of interview stages (for example an HR interview, then an executive director),
- a priority: Urgent (a critical replacement), High (needed for an open project or goal), Normal (planning ahead) or Low (needed in three to six months).

Tell HR if the request is not acknowledged, or if someone already on the team could fill the role.

## Post the job
On LinkedIn, and with [the recruitment form](https://form-can.keela.co/welfare-avenue-recruitment-form) (Valex has the CABM login).

## Helpful videos
- [Posting a job on LinkedIn](https://www.loom.com/share/e0e2a087272245938b9940147c6228cf)
- Calling potential recruits: [part 1](https://www.loom.com/share/007ee9f8fe4c461a831d62fb55474bef) and [part 2](https://www.loom.com/share/568e02d5df8d412b8e05ba9f942b2f54)
- [A first interview](https://www.loom.com/share/7278c9bcf7cd470b917294330d4bd14b)
- [A second interview](https://www.loom.com/share/f0462c4b565d4d2a97927291e7a7cda9)"""}

READS[22] = {'kind': 'read', 'resource_url': None, 'description': """The Thriving Non-Profits course, on charity governance and accounting. Its modules are summed up in the Learning Avenue Thriving Nonprofits course, here in the Avenue Academy.

The login is in Important info, under Thriving Non-Profits course."""}

READS[33] = {'description': """How event photos are retrieved and filed after servings and events. The walkthrough deck is in Canva.

Good to know: the photos that are labelled and cleared for use are in the Hub's Photo library (Other Tools)."""}

READS[34] = {'path_group': 'Marketing basics',
             'body': {'planned': True, 'from': 'ClickUp, before wave141', 'note': 'Kept from ClickUp, where the task had no written steps. Write them here to publish it.'},
             'description': """How we make a collab post with a partner's account. Nobody has written the steps down yet: if you know them, add them here."""}

READS[35] = {'description': """How we design and order business cards.

1. Polish the design in [Canva](https://www.canva.com/design/DAFUVHK5Tc0/S_8cG6hoW67PUtKjHHb66A/edit).
2. Check that the QR code works and opens our Linktree.
3. Find a printer that does 1,000 cards at a good price, make an account and fill the cart.
4. Tell Steel on Slack when it is ready, so he can pay for it."""}

READS[36] = {'description': """Goal: Order a custom 10x10 canopy tent in our new brand.

- **Supplier:** BannerBuzz CA, product 10x10 Custom Canopy Tent ([bannerbuzz.ca/10x10-canopy-tents](https://bannerbuzz.ca/10x10-canopy-tents)). Free shipping over $99, and a designer tool on the site.
- **Design:** the approved palette (pastel shades with a purple accent).
- **Before you finish the artwork:** confirm the exact panel dimensions and the print areas on the product page."""}

READS[38] = {'title': 'Nourish and Flourish (Corporate Cook Volunteering & Fundraising Plan)', 'description': """The template for planning a Nourish and Flourish event: corporate cooking, volunteering and fundraising. The action plan is in Google Docs."""}

READS[47] = {'description': """Goal: Order a roll-up banner stand in our new brand.

- **Supplier:** BannerBuzz CA, product Deluxe Wide Base Single-Screen Roll-Up Banner Stand ([bannerbuzz.ca](https://bannerbuzz.ca/deluxe-wide-base-single-screen-roll-up-banner-stands)). 20% off a first purchase, free shipping over $99.
- **Design:** the approved palette (pastel shades with a purple accent).
- **Before you finish the artwork:** take the exact dimensions from the product page, and check whether the artwork goes in through BannerBuzz's online designer.
- **Design leads:** Eduardo and Alejandra."""}

READS[48] = {'description': """Goal: Redesign our six-foot tablecloth in the new brand palette.

- **Supplier:** Sportira. Steel has the email with the previous specs and templates.
- **Reference files:** Welfare Avenue Toronto 6 Foot Tablecloth 2024, v1 and v2.
- **Design:** the approved palette (pastel shades with a purple accent).
- **Before you finish the artwork:** confirm the exact dimensions and the template with Sportira.
- **Design leads:** Eduardo and Alejandra."""}

READS[49] = {'description': """Goal: Redesign our pinnies (the freestyle BIB) in the new brand palette.

- **Supplier:** Sportira. Steel has the earlier emails with the specs and templates.
- **Reference files:** Toronto Freestyle BIB Men v1 Purple and v1 Green; Montreal v3 Purple.
- **Design:** the approved palette (pastel shades with a purple accent). Toronto and Montreal may need their own versions.
- **Before you finish the artwork:** confirm the dimensions and the template with Sportira.
- **Design leads:** Eduardo and Alejandra."""}

READS[50] = {'description': """The layout and design brief for the Impact Report. The words are in [the content doc](https://docs.google.com/document/d/13QovqaFpkpAVFl8TWle-r3bRDZWAcKRmx_NueJN_IaQ/edit).

## Before design starts
The words must be final, fact-checked and approved by leadership (confirm with Jemeela).

## Photos
Gather the 2025 photos by event (Sunday Servings, the Holiday Gift Drive, Flag Football, Rally Paper) and place the best 10 to 15.

## Layout
- A cover, the inside pages and a back page.
- Our colours and fonts.
- Bold infographics for the key numbers: funds raised, people served, teams.
- Icons, space and pull quotes to break up the text.
- Partner and sponsor logos, placed cleanly.

## What we deliver
- A print-ready PDF: high resolution, CMYK, with bleed.
- A web PDF: small, RGB.

Done when: leadership has reviewed and approved the final design.

Design coordination: Eduardo, Alejandra and Soraya."""}

READS[174] = {'description': """How we coordinate with our volunteer cooks. Their food reaches us one of two ways (the document has the details):

1. They drop it off at the serving location.
2. We pick it up from their home, in our pickup areas."""}

READS[175] = {'description': """What we check with a first-time driver (the document has the details):

1. Reliability
2. The type of car
3. A driver's licence"""}

# the Marketing Strategy Package (MG&Co Consulting)
READS[24] = {'description': """Goal: Understand the context, and the problems this strategy package solves.

Welfare Avenue is a youth-powered non-profit fighting food insecurity, founded in Montreal in 2020. As we grew, marketing was a recurring weak spot. MG&Co Consulting studied our organization and built a package to fix three connected problems:

1. **The marketing plan:** campaigns lacked a clear strategy, which meant too few donations.
2. **Social media:** disorganized content, late or irregular posts, and nothing measured.
3. **The website:** unstructured, which weakened our brand and our credibility with donors.

The package answers all three with a target market, a social media channel strategy, a content template and calendar, a donor journey map, website and SEO recommendations, and a roles and communication model (RACI).

Good to know: charities fighting hunger compete with hundreds of others for the same donors. A clear, consistent, measurable marketing strategy is essential, not optional.

Done when: you can name the three problems and explain why a deliberate marketing strategy matters for a small charity like ours."""}

READS[25] = {'description': """Goal: Know who we market to, and why every content decision flows from it.

Because Welfare Avenue is small and still building its reputation, the package targets Gen Z and millennials, for three reasons:

1. **Trust:** younger generations are more likely to trust and give to smaller, lesser-known charities (56% of Gen Z prefer giving to lesser-known causes).
2. **Social justice:** they care most about supporting marginalized communities and social causes.
3. **Sharing:** they are very active on social media and promote the causes they support, which grows our reach for free.

## What they want from our content
- **Educational:** about 50% research a cause thoroughly before giving.
- **Shareable:** 42% or more share or promote causes on social media.
- **Impact and transparency:** they want to see exactly where donations go.
- **Real and human:** they distrust traditional ads and trust authentic, personal content.
- **Short and visual:** attention spans of about 8 seconds for Gen Z and 12 for millennials, so video and images win.

Done when: you can name the target market, the three reasons we chose it, and the five things our content needs for them."""}

READS[26] = {'description': """Goal: Know which channels we focus on, why, and how often we post.

The old problem: we were on almost every platform (Facebook, Instagram, Twitter, YouTube, LinkedIn, TikTok) but posted rarely and irregularly, often one or two posts a month, with no tracking.

The strategy: fewer channels, posted more consistently, aimed at donations. With a student-run team's time, we focus on four channels that match our audience:

- **Instagram:** strong with our core 18 to 35 audience. 3 posts a week.
- **LinkedIn:** donors are over-represented here (LinkedIn members are 56% more likely to donate than the average user). 3 a week.
- **TikTok:** our existing strength and the best way to reach Gen Z; shift toward posts that lead to donations. 1 to 2 a week.
- **YouTube:** 89% of Gen Z and 86% of millennials watch every week; good for deeper videos. 1 every 3 months.

Tip: favour platforms with easy in-app donations, and keep the pace realistic for a volunteer team.

Done when: you can list the four priority channels, why each was chosen, and how often we post on each."""}

READS[27] = {'description': """Goal: Understand the structure that makes every post purposeful and measurable.

The old problem: content was made on the spot, with no schedule, no focus on our audience and no way to measure what worked.

The fix: a monthly content calendar where every post is planned against four elements:

1. **Content category:** a clear purpose or theme behind the post.
2. **Media type:** vary it and label it (video or image), so we can see which formats perform.
3. **A clear goal:** each post serves one marketing goal; reviewing the goals each month confirms they are all covered.
4. **A call to action and a tracking link:** so we can measure each post's performance and impact.

## Content ideas that fit our audience
Infographics that teach, testimonials that show impact, hashtags that invite sharing, videos that drive donations, live coverage of events, "where your donation goes" posts, and behind-the-scenes and vlog content. Every event is a chance to film.

Done when: you can list the four elements every planned post needs, and explain why tracking links matter."""}

READS[28] = {'description': """Goal: Understand how we turn first-time viewers into repeat donors and advocates.

A Donor Journey Map (DJM) is a blueprint of how a donor interacts with us at each stage. Its aim is retention and loyalty: more donations, repeat donors and advocates.

## The four stages
1. **Awareness:** they discover Welfare Avenue (searching online, hearing from friends).
2. **Consideration:** they weigh whether we are worth giving to (watching our videos, seeing volunteers in action).
3. **Decision:** they give (reading the donation page, choosing an amount).
4. **Evangelize:** they spread the word and promote us to others.

Each major event (for example the Concordia Shuffle) gets its own map, fitted to the season, the economy and the audience.

## Three pieces that build loyalty
- **An Impact Statement:** the difference donations make.
- **The Annual Report:** transparency on our results.
- **A Donation Survey:** questions after a gift, so decisions come from data.

Done when: you can name the four stages in order and the three pieces that build loyalty."""}

READS[29] = {'description': """Goal: Understand what makes our website turn visitors into donors, and how people find it.

The package checked our site against five themes common to leading non-profits:

1. **Look and accessibility:** consistent fonts and colours, no clutter, built for phones and computers, links to all our social accounts, and a French version.
2. **Mission and team:** a clear vision and mission for our region, with professional bios, roles and contact details.
3. **Partners and events:** feature partners and sponsors, promote events, and grow the site into a community hub. (The package notes that our charity status limits tax-receipted donations, which affects corporate partnerships.)
4. **Volunteering:** fill in the FAQ, add visual instructions and walkthrough videos, and keep a secure, up-to-date volunteer database.
5. **Donations and transparency:** show how funds are used, offer more ways to pay than PayPal, and run a survey after each donation.

## SEO basics
Meet the searcher's intent, load fast, use HTTPS, work well on phones, use relevant keywords (for example "food kitchen"), link in context, and build a strong brand. Follow E-A-T: content should show Expertise, Authoritativeness and Trustworthiness.

Done when: you can name the five website themes, and explain what SEO and E-A-T do for donor traffic and trust."""}

READS[30] = {'description': """Goal: Understand how we reduce confusion and keep marketing in step with the rest of the organization.

A RACI model (a responsibility assignment matrix) is a table of every person involved in a project and their part in each task. It makes clear who does what, which cuts ambiguity and improves communication and decisions. Job functions run across the top, the project's activities down the left side, and each cell says how a person is involved in that activity.

## Our key recommendation
Name one member per department to own communication and updates between departments. Not a director (they are already stretched), but someone who knows the other departments and how we are organized, reporting directly to the founders and directors.

## Why it matters for marketing
With clear roles, content requests, approvals and event coverage do not fall through the cracks between marketing, operations and fundraising.

Done when: you can explain what a RACI model does, and why we name a cross-department communicator."""}


def headings(s):
    """'## Heading' -> a block of its own that is only **Heading**: the reader before wave190 shows it as a bold line,
    wave190's reader as a heading, so the words can go live before the page does."""
    out = []
    for line in s.split('\n'):
        if line.startswith('## '):
            if out and out[-1] != '': out.append('')
            out.append('**' + line[3:].strip() + '**'); out.append('')
        else:
            out.append(line)
    t = '\n'.join(out)
    while '\n\n\n' in t: t = t.replace('\n\n\n', '\n\n')
    return t


def dq(s, tag='t'):
    assert '$' + tag + '$' not in s
    return '$' + tag + '$' + s + '$' + tag + '$'


def check(s):
    """the house rules: plain ASCII from this script, no em or en dash, no ClickUp outside its own history, no password"""
    assert all(ord(c) < 128 for c in s), s[:80]
    low = s.lower()
    assert 'password:' not in low and 'credentials if' not in low, s[:80]
    return s


out = []
out.append("""-- wa190_reading_pass (01/10/26): the reading pass (wave190). Generated by build/data/wa190_reading_pass.py; edit that, not this.
-- Steel (30/09/26): "Can you revist some of the trainings and onboarding to ensure everything is please to read and that it's
-- well branded". The words of the nine Using the Hub modules, the master onboarding, the week 1 lesson, the welcome email and the
-- readings imported from Slack and ClickUp, rewritten to read well; the facts kept, or brought up to date where the Hub moved on.

-- 1. the nine Using the Hub modules""")
for tid in sorted(HUB):
    title, mins, desc = HUB[tid]
    sets = ['description = ' + dq(check(headings(desc))), 'minutes = %d' % mins, 'updated_at = now()']
    if title: sets.insert(0, 'title = ' + dq(check(title)))
    out.append('update public.trainings set ' + ', '.join(sets) + ' where id = %d and path_group = %s;' % (tid, dq('Using the Hub')))

out.append("""
-- 2. the master onboarding: one shape for every step. The steps' updated_at is kept, so nobody who finished is told about
--    wording ("Updated since you finished" compares it with their finish).
create temp table w190_onb_was as select id, updated_at from public.onboarding_template;""")
for sid in ONB:
    out.append('update public.onboarding_template set description = %s where id = %s and active;' % (dq(check(ONB[sid])), dq(sid)))
out.append("update public.onboarding_template t set updated_at = w.updated_at from w190_onb_was w where w.id = t.id and t.updated_at is distinct from w.updated_at;")
out.append("drop table w190_onb_was;")

out.append("""
-- 3. the week 1 lesson: the Hub's address on the tools card, and a quiz option that does not name ClickUp
update public.trainings set body = jsonb_set(body, '{chapters,2,blocks,1,items,0,k}', '"hub.welfareavenue.com"'), updated_at = now()
  where key = 'onb:w1' and body #>> '{chapters,2,blocks,1,items,0,k}' = 'wa-exec-dashboard.netlify.app';
update public.trainings set body = jsonb_set(jsonb_set(body, '{quiz,questions,0,a,1}', '"In your email inbox"'),
    '{quiz,questions,0,why}', to_jsonb('Every team''s tasks, projects and requests live in the Hub, on your team''s page.'::text)), updated_at = now()
  where key = 'onb:w1' and body #>> '{quiz,questions,0,a,1}' = 'In ClickUp';

-- 4. the welcome email's template: the Hub's address
update public.app_config set value = replace(value, 'https://wa-exec-dashboard.netlify.app', 'https://hub.welfareavenue.com'), updated_at = now()
  where key = 'onboarding_email_template' and value like '%wa-exec-dashboard.netlify.app%';

-- 5. readings imported from the Slack training lists and ClickUp, and the Marketing Strategy Package""")
for tid in sorted(READS):
    r = READS[tid]
    sets = []
    for col in ('title', 'kind', 'path_group'):
        if col in r: sets.append(col + ' = ' + dq(check(r[col])))
    if 'resource_url' in r: sets.append('resource_url = ' + ('null' if r['resource_url'] is None else dq(r['resource_url'])))
    if 'body' in r: sets.append('body = ' + dq(check(json.dumps(r['body'])), 'j') + '::jsonb')
    sets.append('description = ' + dq(check(headings(r['description']))))
    sets.append('updated_at = now()')
    out.append('update public.trainings set ' + ', '.join(sets) + ' where id = %d and active;' % tid)

out.append("""
-- 6. the record of it
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('migration', 'wa190_reading_pass', 'applied', null, 'the reading pass: 9 Hub modules, %d onboarding steps, the week 1 lesson, the welcome email, %d readings', 'automation');
""" % (len(ONB), len(READS)))

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wa190_reading_pass.sql')
open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(path, len(HUB), 'modules,', len(ONB), 'steps,', len(READS), 'readings')

# the same words for the drive test's fixture (test/w190drive.js reads them from the scratchpad when it is there)
SP = os.environ.get('W190_SP')
if SP and os.path.isdir(SP):
    json.dump({'hub': {str(k): {'title': v[0], 'minutes': v[1], 'description': headings(v[2])} for k, v in HUB.items()}, 'onb': ONB,
               'reads': {str(k): dict(v, description=headings(v['description'])) for k, v in READS.items()}}, open(os.path.join(SP, 'fx190.json'), 'w'), indent=1)
