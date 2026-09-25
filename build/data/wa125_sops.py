#!/usr/bin/env python3
"""wave125 SOPs: six standard operating procedures for the events on the 2026-27 plan that Welfare Avenue has run
(or played in) before. Written from the meeting transcripts, tasks, Drive documents and Slack (research 25/09/26).
Writes build/data/wa125_sops.sql: trainings rows (kind 'sop', key 'sop:<slug>') and the fund_events links."""
import json, os

D = os.path.dirname(os.path.abspath(__file__))
REVIEWED = '2026-09-25'
SOURCES_NOTE = 'Written from our meeting transcripts, tasks, Drive documents and Slack. Update it after every edition.'

SOPS = []

# ---------------------------------------------------------------- Flag Football
SOPS.append({
    'slug': 'flag-football', 'title': 'SOP: Flag Football tournament', 'minutes': 8, 'sort': 10,
    'description': 'How we run the summer flag football tournament with the Montreal Flag Football League: the partner, registration, sponsors, the day and the wrap-up.',
    'fund': [1, 13],
    'body': {
        'depts': ['fundraising', 'marketing'], 'owner': 'Fundraising, with Marketing',
        'intro': 'Our summer tournament with the Montreal Flag Football League (MFL). Teams register and pay a fee, the league runs the games, and we run everything around them: registration, sponsors, the booth, drinks, the raffle and the thank-yous. Two editions so far, both at Le Ber Park in Pointe-Saint-Charles. The league is what fills the fields, so the relationship with Terry comes first.',
        'glance': [
            ['When', 'A Saturday in August or early September (2025: September 6, from 2pm; 2026: August 8, 10am to 4pm)'],
            ['Where', 'Le Ber Park fields. Terry already rents them on Saturdays, so they cost us nothing. Backup: the Concordia Dome.'],
            ['Partner', 'Montreal Flag Football League (Terry Babalis): the fields, schedule and divisions, referees, rules and the league mailing list (about 1,000 players)'],
            ['Price', '$180 per team, $30 per free agent'],
            ['Lead time', 'About 5 months (the 2026 kickoff with Terry was March 26)'],
            ['Best result', '13 teams, 78 players and over $2,800 raised (2026)'],
        ],
        'editions': [
            ['2026', 'Saturday, August 8', '13 teams and 78 players across Competitive, Intermediate and Beginner, and over $2,800 raised (about $2,400 through Keela and about $400 on site). Guru (drinks), DOSE (ginger shots) and Lush (raffle prizes) gave in kind, and La Licorne de Feu sold food. Amanda led it, Jemeela ran the league relationship and registration, Rami brought the drinks and the student clubs, Alexis ran donations, and Ian and the marketing team made the content.'],
            ['2025', 'Saturday, September 6', 'Our first edition with the league: about 12 teams, 6v6, from 2pm. Sportira gave winner jerseys and discount certificates and Athlon ran an activity station; food came from Costco and a bake sale. The event overview reports $2,500+ raised. Jemeela and Lina coordinated with Aksel, Daniela handled finance, Steel the sponsor asks, and Ian and Robert the posters and email.'],
            ['2023', 'December 21', 'An indoor tournament with a different league (Flag Plus).'],
        ],
        'roles': [
            ['Event lead', 'The plan, the sponsorship package and asks, the raffle, the budget, day-of setup and the post-mortem'],
            ['League and registration', 'Meetings with Terry, the Keela registration form, the registration sheet, vendors'],
            ['Sponsors and drinks', 'In-kind asks (drinks, snacks, prizes) and student clubs'],
            ['Donations', 'Raffle prizes, the donation table (Square and receipts), donor follow-up and the thank-you email'],
            ['Marketing', 'Interviews and reels, newsletters, LinkedIn, league and club reposts, day-of photos and video'],
            ['Executive', 'The league relationship and the storage unit'],
            ['The league', 'Fields, schedule and divisions, referees and equipment, rules, the league mailing list'],
        ],
        'phases': [
            {'when': '5 months out (March)', 'title': 'Lock the partner and the date', 'steps': [
                'Meet Terry: the date, the fields, the divisions, what the league provides (referees, equipment) and what we provide.',
                'Pick a date away from the between-season gap, when many players are on vacation.',
                'Set the goal and a quota of teams from our own network (for example 5).',
                'Agree in writing on any food vendor and their share of sales, and on who sells what.',
                'Open the event budget (2026 planned about $330 in costs).',
            ]},
            {'when': '4 months out (April)', 'title': 'Forms and the sponsor package', 'steps': [
                'One bilingual Keela registration form: team name, division, captain, and every player\'s email. Turn on the confirmation email.',
                'Test the payment link end to end before it goes out.',
                'Write the sponsorship package and start the sponsor tracker.',
                'Plan the content calendar with Marketing: interviews, promo reels, newsletters.',
            ]},
            {'when': '3 months out (May)', 'title': 'Sponsors and content', 'steps': [
                'Start the sponsor asks wide and early: in 2026, more than 40 asks brought 3 in-kind yeses. In-kind is easier to get than cash.',
                'Film the interviews (the league, players).',
                'Send a save-the-date to past teams, the league list, student clubs and corporate friends.',
            ]},
            {'when': '2 months out (June)', 'title': 'Open registration', 'steps': [
                'Open registration with the first promo post and a newsletter.',
                'Ask Terry to email the league list: it brings most of the teams.',
                'Pitch student clubs and companies with a one-pager, and follow up by phone.',
                'Ask staff, volunteers and partners to enter a team.',
            ]},
            {'when': '1 month out (July)', 'title': 'Push sign-ups, lock suppliers', 'steps': [
                'Check registrations every week and share the count with Terry.',
                'Confirm the food vendor and the drinks; file the in-kind forms that need lead time (DOSE needs about two weeks).',
                'Plan the raffle and the donation table.',
                'Keep registration open into the last week (in 2025, 4 to 8 teams signed up in the final days), and publish the format early.',
            ]},
            {'when': 'Event week', 'title': 'Close, schedule, pack', 'steps': [
                'Close registration and send Terry the sheet of paid teams; the league builds the schedule.',
                'Buy drinks and supplies, print the QR donation flyers and signs.',
                'Confirm who does setup, the booth, the raffle and photos.',
                'Plan for heat: water, shade, sunscreen.',
            ]},
            {'when': 'Within 2 weeks after', 'title': 'Thank, reconcile, learn', 'steps': [
                'Thank the players, sponsors and the league within a week.',
                'Reconcile the money (Keela, Square, cash, cheques, costs, the vendor\'s share) and record the result on the events calendar.',
                'Post the recap content.',
                'Hold the post-mortem, with the league too, and update this SOP.',
            ]},
        ],
        'dayof': [
            '9am: pick up the tent, 2 tables and the cooler from the storage unit (a sedan fits 2 tables). 9:30am: on site.',
            'Set up the booth: tent, tables, drinks, the raffle table, the Square reader, QR donation flyers, receipts and a speaker.',
            'The 2026 format: 6v6 on 3 fields, at least 4 games per team, 20-minute halves in 30-minute slots, finals by division at 3:30pm.',
            'Staff the booth all day: talk to players about the people we serve and what is next (Rally Paper, the donor program).',
            'Do not sell what the food vendor sells.',
            'Photos and video for the recap; announce the winners.',
            'Pack up and return everything to the storage unit.',
        ],
        'money': [
            'Income: team fees ($180), free agents ($30), on-site donations and the raffle, and sponsors.',
            '2026: about $2,400 through Keela and about $400 on site, over $2,800 before costs. The costs and the vendor\'s share were not recorded: record them next time.',
            '2025: the event overview reports $2,500+; the Costco run was about $356.',
            'The 2026 plan assumed 40 teams ($7,200 in fees). Terry expects 15 to 20 league teams and says the fields handle 30 well, so our own network has to bring the rest.',
        ],
        'lessons': [
            'The league fills the fields: nearly every team came through the league, so plan the numbers with Terry.',
            'Bring our own teams: set a quota and ask staff, volunteers, partners and companies early.',
            'Send the save-the-date months ahead.',
            'Close registration later, and share the schedule early.',
            'One bilingual form, and capture every player\'s email so we can thank them and invite them back.',
            'Put any vendor\'s share in writing, and do not sell the same products side by side.',
            'Staff the booth to talk to players, not just to take payments.',
            'Agree who does what between Fundraising and Operations for setup.',
            'Kids\' activities only with pre-registration (none came in 2025).',
            'Thank everyone within a week.',
        ],
        'confirm': [
            'The 2025 team count and total (sources say 12 or 13 teams and $2,100 to $3,000).',
            'The 2026 costs, the vendor\'s share and the net.',
            'Waivers, insurance and first aid do not appear in past plans: confirm with the league what covers the players.',
        ],
        'links': [
            ['Event overview: Flag Football 2025', 'https://docs.google.com/document/d/1LF3KLxNWgqsMYZQBTdmkBWvOGYUmOjcbWvY91-H-gZY'],
            ['Overview of the 2026 football fundraiser', 'https://docs.google.com/document/d/1DcGsWtIb3qOH2Z_EhINnamdpOdhgDIVXffM6wCzf6Ms'],
            ['Tentative budget: MFL football fundraiser', 'https://docs.google.com/document/d/1TL-YgM0WUK6dD68FqT_AEU7aAEkH4UPtl9DlgxobnKk'],
            ['Meeting with Terry: prep', 'https://docs.google.com/document/d/1T702MaDSXha7DIbSpWM9JY5_KMkpcV_SHe9A0enFzyc'],
            ['Registration tracking (2026)', 'https://docs.google.com/spreadsheets/d/1uK2LPn2S0xzMQln4rbE231H5BDI8ts0X0y2Ej7SRkTw'],
            ['Sponsor tracking (2026)', 'https://docs.google.com/spreadsheets/d/1vazswnnU3Pepx7F414HRPt_0YNDL8c4Cz7DlQFubkrI'],
            ['Content calendar deadlines', 'https://docs.google.com/document/d/1QIRpmnDJPvPiya0m5H6_chMeavpyELrcn0I1kAtjHuU'],
        ],
    },
})

# ---------------------------------------------------------------- Rally Paper
SOPS.append({
    'slug': 'rally-paper', 'title': 'SOP: Rally Paper (playing as a charity team)', 'minutes': 9, 'sort': 20,
    'description': 'How we field a team in Rally Paper Montreal, the 36-hour student challenge where charity teams play for prize money: recruiting, squads, shifts and the weekend.',
    'fund': [2, 14],
    'body': {
        'depts': ['fundraising', 'marketing'], 'owner': 'Fundraising, with Marketing',
        'intro': 'Rally Paper Montreal is a 36-hour challenge run by an outside organizing team (Rayan is the founder). A few charities each field a team, and the prize money goes to the winning teams\' charities. We do not run the event: we recruit, organize and lead our team. Headcount decides the placing, so this SOP is about getting enough people, early, into the right squads.',
        'glance': [
            ['When', 'A weekend in late September, Saturday 8am to Sunday afternoon (2025: September 27 and 28; 2026: September 19 and 20)'],
            ['Organizer', 'Rally Paper Montreal (Rayan). JMCC sends delegates, who count their shifts toward their volunteer hours.'],
            ['Prizes', '$7,000 for first, $2,000 for second, $1,000 for third, and $500 to the charity of the MVP'],
            ['Our results', '3rd in 2025 ($1,000, received October 15, 2025); reportedly 3rd again in 2026 (to confirm)'],
            ['Lead time', 'About 3 months, from the organizer briefing in June or July'],
            ['Costs', 'Small: flyers and printing. The organizer supplies shirts and cars.'],
        ],
        'format': [
            'A booklet drops every 2 hours from 8am Saturday; the last one drops at 2pm Sunday. Late submissions are disqualified.',
            'Squads: Online, Treasure hunt, Logic and trivia, Quest, and Challengers (physical). In 2026 quest and trivia shared a slot, so we ran four squads.',
            'Trivia in 2026: 6 booklets of 70 weighted questions, 2 hours to return each Excel file, no AI tools.',
            'Physical crews are gender-balanced (2025: 12 people, 6 and 6, with waivers and the list sent in advance; 2026: up to 10, plus smaller crews of 3 to 5). The schedule comes early and the exact place 2 hours before each challenge.',
            'Overnight challenges (midnight to 4am) score higher.',
            'Pre-challenge videos count: in 2026 the team intro video was judged on likes, comments and shares.',
            'Posts go on an Instagram account the organizer lends us (ours was @rally.avenue). Every video opens with the Rally Paper banner, and sponsor challenges are mandatory and worth triple.',
        ],
        'editions': [
            ['2026', 'September 19 and 20', 'Base camp in the JMSB building, about 75 people on the roster and about 40 JMCC sign-ups; reportedly 3rd again. Amanda managed the project, Steel led outreach and media and co-led the physical squad with Ryan (JMCC VP Charity), Alexis and Ian co-led online, Jemeela, Tate and Ibrahim led quest and trivia, Ahmed and Marina led the treasure hunt, and Ian and Kahkashan made the intro video.'],
            ['2025', 'September 27 and 28', 'Our first edition: 3rd place and $1,000 for Welfare Avenue, and a challenge that put Steel on CTV News. About 40 active players. Steel led the team and the physical squad, Ian led online, Mohamed led quest and trivia, Amanda (then with JMCC) brought the delegates, Jemeela moved sign-ups into WhatsApp, and Soraya ran the newsletters and the results email.'],
        ],
        'roles': [
            ['Project manager', 'The plan, the roster, the leads meeting and the post-mortem'],
            ['Squad co-leads', 'Two per squad (one for Saturday, one for Sunday): online, treasure hunt, trivia and quest, physical'],
            ['Recruitment', 'Student clubs, JMCC delegations, tabling and the sign-up form'],
            ['Media', 'The pre-challenge videos, the lent Instagram account and weekend content'],
            ['Sponsors', 'Food and drinks for base camp, and logos in time for the shirts'],
            ['Volunteer hours', 'Track and verify the hours of JMCC delegates'],
        ],
        'phases': [
            {'when': '3 months out (June to July)', 'title': 'Confirm with the organizer', 'steps': [
                'Go to the organizer briefing: dates, rules, prizes and base camp options.',
                'Name the project manager and two co-leads per squad, so no squad depends on one person.',
                'Ask JMCC to offer Rally Paper to its delegations as volunteer hours.',
                'Ask the organizer for their list of 24-hour venues (Concordia rooms close around 8 or 9pm; McGill allows overnight).',
            ]},
            {'when': '2 months out (July to August)', 'title': 'Plan and start recruiting', 'steps': [
                'Write the project plan and the outreach tracker: clubs, student associations, JMCC delegations, the CASA newsletter.',
                'Hand out flyers at the summer events (Flag Football in 2026).',
                'Line up sponsors by mid-August: food for base camp, and logos in time for the shirts.',
            ]},
            {'when': '6 weeks out (mid-August)', 'title': 'Registration and content', 'steps': [
                'Put the Keela sign-up form live now, not the last week. Reuse the 2025 fields (squad, days, shifts, location, overnight, referrals, organization, newsletter) and add the delegation (for hours) and a media release.',
                'Start the countdown posts and the recruitment video.',
                'All-staff call: Rally Paper is a volunteering event for every staff member.',
            ]},
            {'when': '3 weeks out', 'title': 'Squads and shifts', 'steps': [
                'Put everyone in a squad and a shift: Saturday 8am to 2pm, 2 to 8pm and 8pm to midnight; Sunday midnight to 5am, 8am to noon and noon to 6pm.',
                'Start WhatsApp fresh each year: one community, one chat per squad and an invite-only leaders chat. Never post answers in open chats.',
                'Tabling on campus (Concordia, Vanier, Loyola) and a one-pager for club presidents.',
            ]},
            {'when': '1 week out', 'title': 'Lock the physical squad', 'steps': [
                'Lock the physical roster (gender-balanced) and send the organizer the waivers and the list.',
                'Receive the Instagram account; give access to about 3 people and share the login through a password manager, never in a channel.',
                'Prepare the pre-challenge booklet and post the intro video.',
                'Leads meeting: the roster sheet (a Present column per squad) and the base camp plan.',
            ]},
            {'when': 'After the weekend', 'title': 'Results, hours and thanks', 'steps': [
                'Confirm the placing and the prize with the organizer, and record the money on the events calendar when it arrives.',
                'Verify volunteer hours with JMCC (only hours actually done) and send them.',
                'Thank everyone, post the result and return the Instagram account.',
                'Hold the post-mortem and update this SOP.',
            ]},
        ],
        'dayof': [
            'Base camp opens before 8am Saturday; co-leads check people in against the roster.',
            'Every 2 hours the booklet drops: split the work and submit before the deadline, every time.',
            'The physical squad goes where the organizer sends it, 2 hours ahead, ready to get wet (the 2025 rules said to bring a swimsuit and towel).',
            'Keep the online squad going overnight: the Saturday and Sunday co-leads hand over.',
            'Food and drinks at base camp (from sponsors or the budget).',
            'Every video on the lent account opens with the Rally Paper banner.',
        ],
        'money': [
            'The prize is the fundraiser: 3rd place paid $1,000 in 2025.',
            'Costs are small: about 100 printed flyers in 2026. Shirts and cars come from the organizer.',
            'Food sponsors are worth asking: another team got about $200 to $300 of food.',
        ],
        'lessons': [
            'Headcount decides the placing. In the organizer\'s words, "spirit was there, headcount was not."',
            'Recruit early: in 2026 the sign-up form went live 12 days before the event. Put it up six weeks out.',
            'JMCC delegations brought the most players; adding hundreds of people to WhatsApp brought few.',
            'Two co-leads per squad, split Saturday and Sunday, so no squad fades overnight.',
            'Share every piece of work between at least two people, so nothing stalls if someone steps away.',
            'Test every email before it goes out.',
            'Keep internal meetings few and short, at times people can make.',
        ],
        'confirm': [
            'The official 2026 placing, the prize and when it arrives, and any MVP award.',
            'The 2027 timing: the events calendar has Rally Paper 2027 in summer, but both editions ran in late September.',
        ],
        'links': [
            ['Guidelines for teams (2025)', 'https://drive.google.com/file/d/1OJxCY0eI5IKrKmstZHDgMTiO59iTOOzW/view'],
            ['Rally Paper at a glance (2025)', 'https://docs.google.com/document/d/1bupqxTKexQ54mOQrPflMgLwwzBDtvFtORVCXDTfn4pQ/edit'],
            ['Rally Paper results (2025)', 'https://docs.google.com/document/d/12lYzLINza9CTAQlhr_UgN-S7Y_Hy2BAoTdDMpG1Kin4/edit'],
            ['Keela form (2025)', 'https://docs.google.com/document/d/1_tutIBNh6nkFkwfG3ZYdo2WDSgfh_qohqfoO0xHn2S8/edit'],
            ['Project plan (2026)', 'https://drive.google.com/file/d/1O64JHBKM7VxbHOO4zJkiEu2ZcgIuVEKd/view'],
            ['Outreach tracker (2026)', 'https://drive.google.com/file/d/1qJY1Jfpp0AY3hSUOEqPfLOARtoqLcy4q/view'],
            ['Countdown calendar (2026)', 'https://drive.google.com/file/d/14N-T0QqeK5GI3F31zP2KVfx46s5I1-pg/view'],
            ['Booklet instructions (2026)', 'https://drive.google.com/file/d/1WIAn0kXV0TlVbIu5eVM0o12m-6fUvDmC/view'],
        ],
    },
})

# ---------------------------------------------------------------- Gift Basket Drive
SOPS.append({
    'slug': 'gift-basket-drive', 'title': 'SOP: Gift Basket Drive', 'minutes': 8, 'sort': 30,
    'description': 'How we collect, pack and deliver holiday gift baskets to shelters and hospitals in December: partners, donations, the packing day and the deliveries.',
    'fund': [4],
    'body': {
        'depts': ['opsmtl', 'fundraising'], 'owner': 'Operations, with Fundraising',
        'intro': 'Every December we gather donated clothing, hygiene products, books and small joys, pack them into baskets on one big day, and deliver them to shelters and hospitals before Christmas. It is a drive for donated goods, not a cash fundraiser: the November events raise the money for it. Two editions so far, each bigger than the last.',
        'glance': [
            ['When', 'The packing day is the Sunday before Christmas; deliveries run until December 23'],
            ['Where', 'A church hall (2025: Union United Church, 3007 Rue Delisle)'],
            ['Partners', 'Scattered (our co-founder of the drive), JMCC, Enactus Concordia and CEP'],
            ['Donors', 'Ardene, Sportira, MiniBiblioPlus (300 books), Literacy Quebec and many individuals'],
            ['Best result', '3,000+ items in 446 baskets for six shelters, plus two hospitals (2025)'],
            ['Lead time', 'About 11 weeks (the first tasks go out in early October)'],
        ],
        'editions': [
            ['2025', 'Packing on Sunday, December 21', '3,000+ items (2,000+ pieces of clothing, 200+ joy items, 100+ hygiene products) in 446 baskets: Chez Doris 46 (hygiene), Resilience 60, St Michael\'s 80, Logifem 80, Open Door 80 and Mission Bon Accueil 100, with the rest to the Montreal Children\'s (through the MUHC and Starlight foundations) and the Douglas. Jemeela coordinated the shelters, churches and itinerary (and wrote the 15-step template), Daniela led donor outreach, Steel handled partners, pickups and the venue, Natalia messaged volunteers, Soraya ran the newsletter, Ian and Patricia promoted it, and Scattered found the book and stationery donors.'],
            ['2024', 'Deliveries on December 23', 'Our first edition with Scattered, launched with a free talent show at Reggie\'s on December 20. Gifts went to the Douglas, the Royal Victoria, the Montreal Children\'s and an ICU: 1,500+ gifts, beating the goal.'],
        ],
        'roles': [
            ['Coordinator', 'Shelters and hospitals, the venue, the itinerary and the delivery sheet'],
            ['Donor outreach', 'Companies and in-kind donors, the donation forms and pages'],
            ['Partners and logistics', 'Partner organizations, donation pickups, storage and the venue'],
            ['Volunteers', 'Recruiting through partners and the staff volunteering day, and reminders'],
            ['Marketing', 'The flyer, the newsletter, posts and the recap'],
            ['Line leads', 'One lead per packing line on the day'],
        ],
        'phases': [
            {'when': 'Early October', 'title': 'Partners, venue and recipients', 'steps': [
                'Confirm the partners (Scattered, JMCC, Enactus) and open a WhatsApp group with each one.',
                'Book the venue and secure storage for donations.',
                'Contact shelters and hospitals now: ask how many baskets, what they need most and their delivery windows. Replies are slow (only two shelters had answered by mid-October 2025).',
                'Set the target (2026: 4,000+ gifts).',
            ]},
            {'when': 'Mid-October to mid-November', 'title': 'Donations', 'steps': [
                'Open the Keela forms for items, money and volunteers, and get the web donation page ready.',
                'Ask companies and in-kind donors for clothing, books and hygiene products (in 2024 the Salvation Army gave clothing).',
                'Tabling on campus with a sample basket.',
                'Have the flyer, the tracker and the budget ready by mid-November.',
            ]},
            {'when': 'Mid-November', 'title': 'Volunteers and promotion', 'steps': [
                'Newsletter and posts.',
                'Make the packing day a staff volunteering day, and ask JMCC and Enactus for volunteers early.',
                'Tie the November fundraisers (the fashion show, the One Bag Challenge) to the drive.',
            ]},
            {'when': 'December, weekly', 'title': 'Plan the day', 'steps': [
                'A short planning meeting every week in December.',
                'One packing day, not two.',
                'Donation pickups in the week before.',
                'Finish the delivery sheet: quantities, delivery windows and entry notes for each place.',
            ]},
            {'when': 'After', 'title': 'Thank and report', 'steps': [
                'Thank donors, partners and volunteers, and post the recap with the numbers.',
                'Bring back everything we lent or used (tablecloths went missing in 2025).',
                'Debrief and update this SOP.',
            ]},
        ],
        'dayof': [
            '8am set-up. Public drop-off from 9am to 1pm at the venue.',
            'Four packing lines: clothing (about 11 people), hygiene and food (8), joy items (7), and quality check, sealing and labeling (4).',
            'Pizza lunch at noon.',
            'Label every basket for its recipient from the delivery sheet.',
            'Clean-up done by 5pm; deliveries start the same day.',
            'Delivery notes that matter: text Chez Doris 5 minutes before arriving; use the loading dock at Mission Bon Accueil.',
        ],
        'money': [
            'The 2025 budget template was $4,000: venue $1,500, gifts $1,000, ads $900 and supplies $600. Actual spending was not recorded: record it this year.',
            'The drive collects goods, so the money comes from the November events and from donations.',
        ],
        'lessons': [
            'Lock the partners and the venue earlier: partners can confirm late.',
            'WhatsApp groups with partner organizations worked well.',
            'Volunteers come from partners and the staff day; the public volunteer form brought 3 sign-ups in 2025.',
            'One packing day works; two sessions did not.',
            'Have the web donation pages ready by December.',
        ],
        'confirm': [
            'What the 2025 drive actually cost.',
        ],
        'links': [
            ['Gift Basket event plan', 'https://docs.google.com/document/d/1cNYuOP0f7_cgoy0OVFOjVX99kATwvW4NXoiX73Mk0ZM/edit'],
            ['Itinerary (2025)', 'https://docs.google.com/spreadsheets/d/1mUjqYLaBVvtuxvQhDOoGgOmAThXhLHb-0DSnqdti00Y/edit'],
            ['Shelter deliveries', 'https://docs.google.com/spreadsheets/d/1pCz1FOTPc4np0e7nK7ONCQTkori33YTTnmu-NTIVuiw/edit'],
            ['Tracker', 'https://docs.google.com/spreadsheets/d/1mHfXHd85l2LUP2COoGVGsxWeApFynrbekcMjip08ROc/edit'],
            ['Budget', 'https://docs.google.com/spreadsheets/d/1wBN64eys0jyucazPWrEs2DWfuCoJA09k4uTmACJp6oE/edit'],
            ['The 2024 plan', 'https://docs.google.com/document/d/1VQtuy4V4dYh_BKBpMklcj_7IblMMdLDXEGNRnxn6ueA/edit'],
        ],
    },
})

# ---------------------------------------------------------------- student associations
SOPS.append({
    'slug': 'student-association-nights', 'title': 'SOP: Fundraisers run by student associations (JMCC, CASA)', 'minutes': 6, 'sort': 40,
    'description': 'How we work with JMCC and CASA when they run fundraising nights and weeks for Welfare Avenue: their part, our part, and collecting the money.',
    'fund': [5, 6],
    'body': {
        'depts': ['fundraising'], 'owner': 'Fundraising',
        'intro': 'Some of our best nights are run by student associations. JMCC (the JMSB competition committee) picks a charity each year and its VP Charity runs events for it. CASA JMSB chose us for its 5 Days for the Homeless week in March 2025 and again in 2026. They run the night; we advise, promote, show up, thank them, and make sure the money reaches us.',
        'glance': [
            ['JMCC', 'A night at Reggie\'s and a bake sale in November (2024 and 2025), planned by the VP Charity (2026-27: Ryan Antosh)'],
            ['CASA', '5 Days for the Homeless in March, with a St. Patrick\'s party at Reggie\'s in 2025'],
            ['Results', 'JMCC about $2,000 (2024); CASA about $1,000 by cheque (2026)'],
            ['Our part', 'Advise, promote, attend, thank, verify volunteer hours, collect the money'],
        ],
        'editions': [
            ['JMCC 2024', 'November', 'A bake sale in early November and a Reggie\'s night on Thursday, November 21, run by VP Charity Charles Arsenault, with a donation link that counted toward JMCC\'s competition goal: about $2,000.'],
            ['JMCC 2025', 'November', 'A fundraiser at Reggie\'s on Thursday, November 13 (5 to 8pm) with activities and merch, toward JMCC\'s $2,500 goal. Delegates also earned volunteer hours at the storage clean-up, Sunday servings and the Gift Basket Drive.'],
            ['CASA 2025', 'March 10 to 15', 'CASA JMSB\'s 5 Days for the Homeless: an awareness post, a food bank collection, a bake and merch sale, a free St. Patrick\'s party at Reggie\'s on Thursday, March 13 with shot sales going to us, sandwiches made and delivered on the Friday, and CASA serving with us on the Saturday. Gabriela coordinated for CASA and Jemeela pitched the themes.'],
            ['CASA 2026', 'Week of March 9', '5 Days for the Homeless again: about $1,000, paid by cheque.'],
        ],
        'roles': [
            ['Partner lead (Fundraising)', 'The relationship, the dates, the ask, collecting the money and the thank-yous'],
            ['Marketing', 'Posts and stories before and during the event, and the thank-you post'],
            ['Staff', 'Come to the night, and to the serving the association joins'],
            ['Volunteer hours', 'Track and verify JMCC delegates\' hours'],
        ],
        'phases': [
            {'when': 'Start of term (September or January)', 'title': 'Meet the new organizers', 'steps': [
                'Meet JMCC\'s VP Charity in September and CASA in January, and agree the dates early.',
                'Share what worked (Reggie\'s nights, bake sales, merch) and what we can bring: a speaker, photos, a table.',
                'Agree how the money reaches us (a donation link we control, an e-transfer or a cheque) and by when.',
                'For JMCC, agree how delegates\' volunteer hours are logged and verified.',
                'Before booking Reggie\'s, check the rate: a 2022 note says it was free for nonprofits affiliated with Concordia.',
            ]},
            {'when': '4 weeks out', 'title': 'Promote', 'steps': [
                'Share the event on our channels and in the newsletter; give them our logo and a short blurb.',
                'Invite staff and volunteers.',
            ]},
            {'when': 'The night', 'title': 'Show up', 'steps': [
                'Be there with a few staff: say thank you, talk about the people we serve, take photos.',
            ]},
            {'when': 'Within 2 weeks after', 'title': 'Collect and thank', 'steps': [
                'Collect the money and record it on the events calendar.',
                'Thank the association publicly (a post) and privately (a note or a thank-you receipt made in Canva).',
                'Verify and send the volunteer hours.',
            ]},
        ],
        'lessons': [
            'Nights run by the association work. A second, separate party the same night, run by an events company for a share of ticket sales, did not.',
            'Volunteer hours motivate JMCC delegates, so track them properly.',
            'Confirm the dates early.',
            'Agree how and when the money arrives before the event: in 2026 the cheque took months.',
        ],
        'confirm': [
            'The JMCC 2025 result and the CASA 2025 total.',
            '"Casa X" in the events plan most likely means CASA JMSB.',
        ],
        'links': [
            ['JMSB x Welfare Avenue deck', 'https://docs.google.com/presentation/d/1BQVBFE_ZXfgIj4laZ0NBIy_K1BCy4l4OHs4J5qEIvyE/edit'],
            ['CASA x Welfare Avenue ideas', 'https://docs.google.com/document/d/19QTlVMUdKXPgOJNkTuBfuCf6IoemFAAHmnwgT_a1TuU/edit'],
            ['Reggie\'s party (2022)', 'https://docs.google.com/document/d/1Kb2Xi2Fo1HxOupYm-iwwxmHa9NBQ5mtqyEpMWWL6gU0/edit'],
        ],
    },
})

# ---------------------------------------------------------------- corporate volunteering
SOPS.append({
    'slug': 'corporate-volunteering', 'title': 'SOP: Corporate volunteering days', 'minutes': 6, 'sort': 50,
    'description': 'How we host a company team for a cooking or serving day that the team also fundraises for: the pitch, the budget, the kitchen and the day.',
    'fund': [10],
    'body': {
        'depts': ['fundraising', 'opsmtl'], 'owner': 'Fundraising (outreach and planning), Operations (the day)',
        'intro': 'A company sends a team to cook or serve with us for a day, and the team raises money to cover the day and more. Fundraising sells and plans the day; Operations runs it. Since 2022 we have hosted GHD, RBC Van Horne, Oberoi Financial and Adaptavist, and Benevity has offered to send us more groups.',
        'glance': [
            ['What', 'A 4- or 8-hour cooking or serving day for 10 to 20 staff, with a fundraising goal'],
            ['Goal', '$2,000 or more per day. Send the budget first, so the company knows its goal.'],
            ['Best result', 'Adaptavist, December 6, 2024: 15 volunteers, 250+ meals and $1,400+ raised (their blog)'],
            ['Lead time', '6 to 8 weeks'],
            ['Model', 'The "Nourish & Flourish" action plan (February 2025)'],
        ],
        'editions': [
            ['Adaptavist', 'April 17, 2025', 'A pizza day at Union United Church, 10am to 4pm: 8 to 10 staff and 288 servings. Food cost about $470 to $540, plus $200 to $300 for the kitchen. Staff gave through Benevity.'],
            ['Adaptavist', 'December 6, 2024', 'A cooking day: 10 of their staff and 2 of ours, a 300-meal goal and a $2,000 target, with about $600 to $700 of food. Their blog reports 15 volunteers, 250+ meals and $1,400+ raised.'],
            ['Oberoi Financial', 'Summers', 'Summer events, most recently July 27, 2025 (one was lost to weather in 2024).'],
            ['GHD', 'May 2022 and May 2025', 'Engineers handed out meals, diapers, hygiene products, shoes and clothes (May 28, 2022 and May 31, 2025).'],
            ['RBC Van Horne', '2022', 'A volunteering day with the branch team.'],
        ],
        'roles': [
            ['Fundraising', 'The pitch, the FAQ call, the budget and goal, the donation page, and the company relationship'],
            ['Operations', 'The kitchen, the menu and food, the shelters receiving the meals, and running the day'],
        ],
        'phases': [
            {'when': '8 weeks out', 'title': 'Pitch', 'steps': [
                'Send the pitch email and the pamphlet.',
                'FAQ call: team size (10 to 20), a 4- or 8-hour day, possible dates and what they will do.',
            ]},
            {'when': '6 weeks out', 'title': 'Budget and goal', 'steps': [
                'Send the budget first, so the company knows its fundraising goal (aim for $2,000 or more).',
                'Set up how they give: a donation page, or their workplace giving platform. Benevity took time to set up in 2025, so start now.',
            ]},
            {'when': '5 weeks out', 'title': 'Book and match', 'steps': [
                'Book the kitchen and the venue.',
                'With Operations, choose the shelters that will receive the meals.',
                'Keep Operations on the email thread from here on.',
            ]},
            {'when': '4 weeks out', 'title': 'Itinerary', 'steps': [
                'Send the itinerary a month ahead: arrival, safety and hygiene briefing, stations, lunch and deliveries.',
                'Buy the food against the budget.',
            ]},
            {'when': 'After', 'title': 'Thank and report', 'steps': [
                'Thank the team with photos and the numbers: meals, people served, dollars raised.',
                'Record the result, and invite them back next season.',
            ]},
        ],
        'dayof': [
            'Operations runs the kitchen; Fundraising hosts the company team.',
            'Start with the safety and hygiene briefing, then the stations.',
            'Photos for the company and for our channels.',
            'Deliver the meals to the shelters on the itinerary.',
        ],
        'money': [
            'Budget per day: food about $470 to $700, plus $200 to $300 for a kitchen when we rent one.',
            'The company team fundraises the goal; send the budget before anything else.',
        ],
        'lessons': [
            'Send the budget first: it sets the company\'s goal.',
            'Workplace giving platforms take weeks to set up.',
            'Companies go quiet between meetings: end every call with a next step and a date.',
            'Fundraising owns the outreach and volunteer details; Operations owns the logistics.',
        ],
        'confirm': [
            'What Adaptavist raised through Benevity in April 2025.',
        ],
        'links': [
            ['Nourish & Flourish action plan', 'https://docs.google.com/document/d/1QB5_XT7Ai3eEtioVp8AagclpXYjMnEPUJCmyvtymmAI/edit'],
            ['Adaptavist cooking day (2024)', 'https://docs.google.com/document/d/1hVy7HyH4jWkvimbBfFra6v8BTxgwlViNMHhvidHPqgQ/edit'],
            ['Pizza day (2025)', 'https://docs.google.com/document/d/1Rh_sUY2aNEkgNfpRMksxZVmZe1SkdaRoRlz1qhFv81U/edit'],
            ['Partner relations', 'https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit'],
        ],
    },
})

# ---------------------------------------------------------------- a partner's festival
SOPS.append({
    'slug': 'partner-festival', 'title': 'SOP: Serving at a partner\'s festival (Art4All)', 'minutes': 4, 'sort': 60,
    'description': 'How we serve meals and run a table at a partner\'s community festival, from Art4All with Scattered in June 2026.',
    'fund': [12],
    'body': {
        'depts': ['opsmtl', 'fundraising'], 'owner': 'Operations, with Fundraising',
        'intro': 'When a partner runs a community festival, we can bring food, a table and our volunteers. We did this at Scattered\'s Art4All festival on June 5, 2026: about 150 cold meals, then a table to meet people and recruit volunteers. It is not a fundraiser on its own, but it is how we meet new people and partners.',
        'glance': [
            ['Last time', 'Art4All with Scattered, Friday June 5, 2026, near 4 Rue Cloutier (Rosemont), 5 to 8pm'],
            ['What we did', 'About 150 cold meals from 5 to 6:30pm, then a table and volunteer recruitment'],
            ['We bring', 'Our tent, tables and tablecloths, the food and our signage'],
            ['Lead time', 'At least 4 weeks'],
            ['Next', 'Only if Scattered brings it back in a format that fits (see the events calendar)'],
        ],
        'editions': [
            ['2026', 'Friday, June 5', 'Set-up at 4pm, about 150 cold meals, then the table. Amanda made 70+ sandwiches, Rami ran transport and photos, Ahmed brought the tent, Alexis made the poster, Shima owned the task and Steel led the team.'],
        ],
        'phases': [
            {'when': '4 to 6 weeks out', 'title': 'Agree the format', 'steps': [
                'Agree with the partner: the date and times, what we serve, who the audience is, and the expected headcount so the food is sized right.',
                'Confirm set-up time, space, power and water.',
            ]},
            {'when': '3 weeks out', 'title': 'Food and people', 'steps': [
                'Menu and quantities from the headcount, and who makes what.',
                'Volunteers and transport; a WhatsApp group with the partner.',
            ]},
            {'when': '1 week out', 'title': 'Confirm', 'steps': [
                'Confirm the logistics in writing, and meet again if anything is unclear.',
                'The poster and posts.',
            ]},
            {'when': 'After', 'title': 'Thank and debrief', 'steps': [
                'Thank the partner, debrief within two weeks and update this SOP.',
            ]},
        ],
        'dayof': [
            'Arrive an hour early to set up the tent, tables and the serving line.',
            'Serve, then run the table: talk to people, recruit volunteers, collect emails.',
            'Photos for the recap.',
        ],
        'lessons': [
            'Get a headcount from the partner so the food is sized right.',
            'Meet earlier and more often: the 2026 details were confirmed only about two weeks out.',
            'A WhatsApp group with the partner worked.',
            'Know the audience: Art4All serves the neurodivergent community, which is different from the people at our other events.',
        ],
    },
})


def sql_str(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    out = ['-- wave125: SOPs in the academy (kind sop), linked from the fundraising events calendar', 'begin;']
    for s in SOPS:
        body = dict(s['body']); body['v'] = 1; body['reviewed'] = REVIEWED; body['sources'] = SOURCES_NOTE
        j = json.dumps(body, ensure_ascii=False)
        assert '$j$' not in j
        for bad in ('—', '– '):
            assert bad not in j, (s['slug'], bad)
        out.append("insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)")
        out.append("  values ('Our SOPs', %s, %s, 'hub', null, %d, true, 'sop', %s, $j$%s$j$::jsonb, %d, 30)" % (sql_str(s['title']), sql_str(s['description']), s['sort'], sql_str('sop:' + s['slug']), j, s['minutes']))
        out.append("  on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, body = excluded.body, minutes = excluded.minutes, category = excluded.category, kind = excluded.kind, sort = excluded.sort, active = true, updated_at = now();")
        if s.get('fund'):
            out.append("update public.fund_events set sop_training_id = (select id from public.trainings where key = %s), updated_at = now() where id in (%s);" % (sql_str('sop:' + s['slug']), ', '.join(str(i) for i in s['fund'])))
    out.append('commit;')
    open(os.path.join(D, 'wa125_sops.sql'), 'w').write('\n'.join(out) + '\n')
    # the harness fixture rows
    rows = []
    for i, s in enumerate(SOPS):
        body = dict(s['body']); body['v'] = 1; body['reviewed'] = REVIEWED; body['sources'] = SOURCES_NOTE
        rows.append({'id': 900 + i, 'category': 'Our SOPs', 'title': s['title'], 'description': s['description'], 'resource_url': None, 'source': 'hub', 'ext_id': None, 'duration_sec': None, 'path_group': None, 'sort': s['sort'], 'active': True, 'created_at': '2026-09-25T18:00:00Z', 'kind': 'sop', 'key': 'sop:' + s['slug'], 'body': body, 'minutes': s['minutes'], 'xp': 30, 'updated_at': '2026-09-25T18:00:00Z', '_fund': s.get('fund') or []})
    json.dump(rows, open(os.path.join(D, 'wa125_sops.json'), 'w'), ensure_ascii=False, indent=1)
    print('SOPs', len(SOPS), 'sql', os.path.join(D, 'wa125_sops.sql'))


if __name__ == '__main__':
    main()
