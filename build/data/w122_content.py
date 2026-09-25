#!/usr/bin/env python3
"""wave122 Training academy content: the two Foundations lessons, the learning
paths and the page tour catalogue rows. Emits:
  build/data/wa122_academy.sql   (schema + seeds, idempotent)
  test/fx_w122.json              (the same rows for the offline harness)
Run from the repo root: python3 build/data/w122_content.py
The tour STEPS live in build/src/122_wave122.seg (they point at the DOM, so
they version with the code); only the catalogue rows live here.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ACTIVITIES_DOC = 'https://drive.google.com/file/d/1jCbzwXECdzeRskF7NHjPB7n4_wW9wn-X/view'
PARTNER_SHEET = 'https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit'
OUTREACH_DOC = 'https://docs.google.com/document/d/1hQ6jkvhWWDgEa9DdhWPEvujlGjQMfKY01FpVffoQYoE/edit'
EMAIL_TEMPLATES = 'https://docs.google.com/document/d/1V6c52sZNcKCnbYazrXyx60aZPDXhgRwYKLzdzkjvfZg/edit'
KITCHEN_PLAN = 'https://drive.google.com/file/d/1_8RZR3_GedHD2wZcJpFi8goCYPWgZus7/view'

# ---------------------------------------------------------------- lesson 1
ACTIVITIES = {
    "v": 1,
    "cover": "gold",
    "summary": "The eight activities we described to the CRA when we applied for charitable status, what each one looks like in practice, and how to talk about our work.",
    "chapters": [
        {"id": "why", "t": "Why this matters", "blocks": [
            {"type": "lead", "text": "When Welfare Avenue applied for charitable status, we described our work to the Canada Revenue Agency (CRA) as eight charitable activities. They are the backbone of everything we do: every serving, drive, workshop and partnership should trace back to at least one of them."},
            {"type": "p", "text": "Our charitable purposes are the **relief of poverty** and the **advancement of education**. The eight activities are how we carry out those purposes, day to day."},
            {"type": "quote", "text": "Welfare Avenue is a youth-powered non-profit dedicated to fighting food insecurity and poverty through direct community action, delivering meals and essential support directly to people where they are.", "by": "Our mission"},
            {"type": "stats", "items": [
                {"n": "25,000+", "l": "meals delivered"},
                {"n": "600+", "l": "volunteers engaged"},
                {"n": "3,000+", "l": "holiday gifts delivered"},
                {"n": "$40,000+", "l": "raised since our founding"}
            ], "note": "From our 2026 brand guide and recent grant applications."}
        ]},
        {"id": "eight", "t": "The eight activities", "blocks": [
            {"type": "p", "text": "Tap an activity to open it. Each one has a purpose, the way we carry it out, and the teams involved."},
            {"type": "activities", "items": [
                {"n": 1, "t": "Outreach and partnerships", "icon": "handshake",
                 "sum": "Building relationships with organizations, businesses and schools that share our mission, so we reach more people and pool resources.",
                 "how": ["Find organizations working on poverty, food security and inclusion, and learn about their impact.",
                         "Reach out, meet, and present our mission and current activities.",
                         "Write tailored partnership and sponsorship proposals with clear roles and shared projects.",
                         "Run the joint projects, then review the results together and adjust."],
                 "teams": "Outreach finds and grows partners and sponsors, Marketing promotes, Operations runs the volunteer base and equipment, Finance tracks sponsorship and campaign money, and the executive team makes sure every partnership fits the mission.",
                 "extra": "As a youth-powered organization, outreach also builds our volunteer base through schools, student associations and clubs."},
                {"n": 2, "t": "Essential goods and services", "icon": "gift",
                 "sum": "Relieving poverty by getting clothing, hygiene products and other essentials to people who need them, and connecting them with services.",
                 "how": ["Run donation drives with supermarkets, schools, colleges and companies.",
                         "Sort, store and distribute what comes in, with volunteers at every step.",
                         "Connect people with mental health, employment, housing and shelter resources through our network.",
                         "Gather feedback after each drive to make the next one better."],
                 "teams": "Operations runs collection and distribution, Outreach brings in organizations and students, Marketing invites the community to contribute, and Finance tracks what we spend."},
                {"n": 3, "t": "Free, healthy meals", "icon": "bowl",
                 "sum": "Addressing food insecurity with free meals at our Sunday servings.",
                 "how": ["Fundraise for food and receive food donations.",
                         "Plan meals with Canada's Food Guide in mind: fresh, balanced and mostly plant-based.",
                         "Coordinate volunteer cooks, drivers and servers through the volunteering manager.",
                         "Serve with care: safely, respectfully and on time."],
                 "teams": "Operations plans each serving, the recipes and the food, Finance tracks food spending and budgets, Marketing raises awareness of food insecurity, and Outreach finds funding for meals."},
                {"n": 4, "t": "Community and belonging", "icon": "people",
                 "sum": "Addressing isolation by making our servings and events places where people feel welcome and connected.",
                 "how": ["Organize free community events, indoors and outdoors, where everyone can take part.",
                         "Put the proceeds of paid events back into food, hygiene supplies and clothing.",
                         "Talk with the people we serve, one on one and in groups, to understand their needs and build real connection.",
                         "Help young people understand homelessness and reduce stigma."],
                 "teams": "Operations makes each serving a place for real connection, Outreach and Marketing raise awareness of isolation, and Finance keeps money available for community events."},
                {"n": 5, "t": "Access to resources", "icon": "compass",
                 "sum": "Helping people meet their basic needs by knowing what support exists and how to reach it.",
                 "how": ["Make space for open conversation at servings to learn what people need, including dietary needs and preferences.",
                         "Bring in information from partner organizations on mental health, shelters, housing and employment training.",
                         "Turn it into clear infographics, factsheets and brochures that we share at servings."],
                 "teams": "Operations makes sure people know where we will be and what is available, Marketing shows why access matters, and Outreach shares what people tell us they need."},
                {"n": 6, "t": "Mobilizing youth and volunteers", "icon": "spark",
                 "sum": "Engaging students and young people to take action on poverty and homelessness.",
                 "how": ["Network at schools such as McGill, Concordia, Dawson and Vanier.",
                         "Run campus events like bake sales and student gatherings to raise awareness, volunteers and donations.",
                         "Offer volunteer roles and run workshops that encourage civic engagement."],
                 "teams": "Outreach works with schools and clubs, Operations sets new student volunteers up, and Marketing reaches students online."},
                {"n": 7, "t": "Working with other charities", "icon": "link",
                 "sum": "Joining forces with non-profits and charities on the issues that affect the people we serve.",
                 "how": ["Network with local organizations, charities and community workers.",
                         "Take part in advisory work on poverty, such as Campaign 2000 advisory meetings.",
                         "Attend events that highlight these issues, such as Disability Without Poverty and Dignity for All."],
                 "teams": "Outreach connects with other charities, Operations runs joint volunteer events, and Marketing supports partners online."},
                {"n": 8, "t": "A voice for the people we serve", "icon": "mic",
                 "sum": "Working with people who share our concern, and bringing the lived experience of the people we serve into the conversation.",
                 "how": ["Attend forums and conferences on poverty and homelessness in Canada.",
                         "Listen closely through conversations and feedback surveys, and learn the barriers people face.",
                         "Use what we learn to shape our services and to raise awareness on social media."],
                 "teams": "Outreach attends forums and conferences, Operations gathers feedback at servings, Marketing amplifies the voices of the people we serve, and the executive team keeps everyone coordinated."}
            ]},
            {"type": "note", "text": "Team names are as written in our submission. They map onto today's departments on the Hub."}
        ]},
        {"id": "pillars", "t": "How they show up today", "blocks": [
            {"type": "p", "text": "Our 2026 brand guide describes the same work as four pillars. Here is how the eight activities feed them."},
            {"type": "cards", "items": [
                {"icon": "bowl", "t": "Food security mobilization", "d": "Consistent, well-coordinated food distribution, using the meal as a trust-building first step toward long-term reintegration.", "k": "Activities 3 and 2"},
                {"icon": "gift", "t": "Dignified resource distribution", "d": "Seasonal clothing, hygiene essentials and basic amenities, always offered with respect and solidarity.", "k": "Activity 2"},
                {"icon": "people", "t": "Dismantling social isolation", "d": "Pop-ups, creative arts and recreational sports that break down barriers and build belonging.", "k": "Activity 4"},
                {"icon": "link", "t": "Integrating the care ecosystem", "d": "Bridging street-level trust with housing, mental health and employment networks across our partners.", "k": "Activities 1, 5 and 7"}
            ]},
            {"type": "callout", "tone": "tip", "t": "And the energy behind all four", "text": "Activities 6 and 8 are why we call ourselves youth-powered: young leaders mobilizing their communities, and a voice for the people we serve."}
        ]},
        {"id": "where", "t": "Where the work happens", "blocks": [
            {"type": "p", "text": "Our submission names **Place Émilie-Gamelin** (1500 rue Berri, by Berri-UQAM) as our main serving location, with a storage unit in Parc-Extension for the tents, tables and serving equipment."},
            {"type": "p", "text": "Schools and campuses host much of our outreach, youth and education work: LaurenHill Academy, Vanier College, McGill, Dawson and Concordia."},
            {"type": "p", "text": "Today we work in Montreal and Toronto, in parks, shelters and other community spaces."},
            {"type": "callout", "tone": "info", "t": "Always current in the Hub", "text": "The volunteering manager has the details of the next serving: date, place, roster and checklist. Take its page tour to see how it works."}
        ]},
        {"id": "who", "t": "Who we serve, and how we say it", "blocks": [
            {"type": "p", "text": "We serve people experiencing homelessness or housing instability, low-income individuals and families, and anyone facing food insecurity. Support is based on need: people self-identify, or a partner organization refers them."},
            {"type": "p", "text": "The words we use matter. If we call it the wrong word, someone reading gets the wrong image of what we do."},
            {"type": "compare", "cols": [
                {"t": "We say", "tone": "good", "items": ["The people we serve, community, support", "Support, dignity, connection, safety", "Food as a starting point, refer, reintegrate", "Youth-powered, professional, a movement", "Collaborate, ecosystem, partnership"]},
                {"t": "We don't say", "tone": "bad", "items": ["The homeless, beneficiaries, people in need", "Pity, saving people, feeling sorry", "Feed people, hand out food", "Student club, just volunteers, a small project", "We do everything, we're the only ones"]}
            ]},
            {"type": "callout", "tone": "info", "t": "One exception", "text": "Formal filings, like our CRA forms, use the word beneficiaries because it is the legal term. Everywhere else, we say the people we serve."}
        ]},
        {"id": "education", "t": "The other half: education", "blocks": [
            {"type": "p", "text": "Advancing education is part of our charitable purpose, not an extra. We help our community understand food insecurity, isolation and access to resources, and invite them to act."},
            {"type": "list", "items": [
                "Workshops and presentations in schools, from LaurenHill Academy to Concordia.",
                "Conferences such as Apathy is Boring, and Force Avenir, where we were selected in the Mutual Aid, Peace and Justice category.",
                "Research and knowledge sharing: infographics, factsheets and information letters.",
                "Social media that shows homelessness is about belonging and dignity, not only basic necessities.",
                "Recruiting people who care about their community, and helping them grow professionally."
            ]}
        ]},
        {"id": "you", "t": "What this means for you", "blocks": [
            {"type": "steps", "items": [
                {"t": "Tie your work to an activity", "d": "When you plan an event, a post or a partnership, know which activity it serves. It makes reports, grant applications and our annual return stronger."},
                {"t": "Check new ideas", "d": "If an idea does not clearly fit one of the eight activities or our purposes, check with the executive team before committing time or money."},
                {"t": "Use our language", "d": "Say the people we serve, and lead with dignity."},
                {"t": "Record the impact", "d": "Log servings, volunteers and outcomes in the Hub so the numbers are ready when a funder or the CRA asks."}
            ]},
            {"type": "link", "t": "Read the full document", "d": "Our 8 Charitable Activities, the training copy of our submission to the CRA Charities Directorate.", "url": ACTIVITIES_DOC}
        ]}
    ],
    "quiz": {"pass": 0.8, "questions": [
        {"q": "What are our two charitable purposes?", "a": ["Relief of poverty and advancement of education", "Sports and recreation", "Housing construction and health care"], "c": 0,
         "why": "Everything we do serves the relief of poverty and the advancement of education."},
        {"q": "Our Sunday servings mainly carry out which activity?", "a": ["Activity 7: working with other charities", "Activity 3: free, healthy meals", "Activity 6: mobilizing youth"], "c": 1,
         "why": "Free, healthy meals address food insecurity. Servings touch other activities too, like community and belonging."},
        {"q": "How are our meals planned?", "a": ["Whatever is cheapest that week", "Only from restaurant donations", "With Canada's Food Guide in mind: fresh, balanced and mostly plant-based"], "c": 2,
         "why": "Healthy meals are part of dignity: fresh ingredients, balanced and mostly plant-based."},
        {"q": "Which activity is about making servings and events places of belonging?", "a": ["Activity 4: community and belonging", "Activity 1: outreach and partnerships", "Activity 5: access to resources"], "c": 0,
         "why": "Isolation is as real as hunger. Activity 4 is about welcome, conversation and connection."},
        {"q": "How do we refer to the people who come to our servings?", "a": ["Beneficiaries", "The people we serve", "The homeless"], "c": 1,
         "why": "We lead with the person, not their circumstance. Beneficiary is only the legal term in formal filings."},
        {"q": "You have an idea for a project that does not clearly fit any of the eight activities. What do you do?", "a": ["Start it and explain later", "Drop it", "Check with the executive team before committing time or money"], "c": 2,
         "why": "Our resources must go to our charitable purposes. A quick check keeps us compliant and often sharpens the idea."}
    ]}
}

# ---------------------------------------------------------------- lesson 2
def partner(n, d, s):
    return {"n": n, "d": d, "s": s}

PARTNERS = {
    "v": 1,
    "cover": "green",
    "summary": "Why we partner, the difference between partners, sponsors and collaborators, who we work with today, and how a partnership comes together.",
    "chapters": [
        {"id": "default", "t": "Collaboration is the default", "blocks": [
            {"type": "lead", "text": "Welfare Avenue does not try to do everything itself. We complement the services that already exist and connect people with the right support. Partners make that possible."},
            {"type": "quote", "text": "Collaboration is the default. Until we build a larger audience, most events run with a partner org that shares the planning load.", "by": "Fundraising planning notes, June 2026"},
            {"type": "cards", "items": [
                {"icon": "spark", "t": "More impact", "d": "Combining strengths, resources and expertise lets us reach more people, more effectively."},
                {"icon": "people", "t": "Inclusion", "d": "Programs shaped with partners reflect the communities we serve."},
                {"icon": "check", "t": "Better programs", "d": "Co-created programs draw on shared knowledge and experience."},
                {"icon": "box", "t": "Shared resources", "d": "Kitchens, halls, equipment and networks, without duplicating effort."},
                {"icon": "megaphone", "t": "Visibility for both", "d": "Joint communication amplifies both missions."}
            ]}
        ]},
        {"id": "kinds", "t": "Partners, sponsors and collaborators", "blocks": [
            {"type": "p", "text": "Three words, three different relationships. Using the right one keeps our records, reports and thank-yous accurate."},
            {"type": "kinds", "items": [
                {"t": "Partner", "icon": "handshake", "d": "An organization we work with toward a shared goal, through joint programs or initiatives. Formalized in writing: an MOU or a project agreement.", "e": "DESTA Black Community Network (community kitchen and a joint grant application), Union United Church (kitchen space)."},
                {"t": "Sponsor", "icon": "star", "d": "A person, business or organization that gives money or in-kind support, and gets recognition in return.", "e": "VCSA (has funded our club since the beginning), Sportira (jerseys and pinnies), Poulet Rouge (Flag Football)."},
                {"t": "Collaborator", "icon": "link", "d": "An organization that joins us for an event or initiative, without a formal agreement.", "e": "Student clubs and companies that join a serving or co-host a fundraiser."}
            ]},
            {"type": "callout", "tone": "tip", "t": "Relationships grow", "text": "Collaborators often become partners or sponsors. Every good event is the start of a relationship, so log it."}
        ]},
        {"id": "who", "t": "Who we work with", "blocks": [
            {"type": "p", "text": "A snapshot from our Partner Relations sheet and this year's plans. The sheet has the full list, points of contact and history."},
            {"type": "partners", "groups": [
                {"g": "Community and non-profit", "items": [
                    partner("DESTA Black Community Network", "Community kitchen pilot and a joint Community Connections grant application.", "New in 2026"),
                    partner("Union United Church", "Kitchen space for our December 2024 cooking event with Adaptavist.", "Established"),
                    partner("Scattered", "Holiday gift drive for children in hospitals (December 2024). Art4All is a possible summer event.", "Established"),
                    partner("Old Brewery Mission", "We have delivered food donations many times.", "Developing"),
                    partner("Refuge des Jeunes de Montréal", "Received meals from our December 2024 cooking event.", "Developing"),
                    partner("Moisson Montréal", "Food bank accreditation in progress: it would supply food for our meals.", "Developing"),
                    partner("Chez Doris", "Receives leftover clothing from the fashion show, and a possible Women's Day partner.", "Planned")
                ]},
                {"g": "Schools, student associations and clubs", "items": [
                    partner("VCSA", "The Vanier College Student Association has funded our club since the beginning.", "Established"),
                    partner("JMCC", "Rally Paper partner. Runs offload fundraisers with us, usually two a year.", "Established"),
                    partner("CASA Cares", "Volunteer events and fundraisers, and promotes our volunteering to Concordia business students.", "Established"),
                    partner("Enactus Concordia", "Invited us as panelists and is planning a volunteering event.", "Established"),
                    partner("LaurenHill Academy", "Student volunteers, workshops and food drives.", "Established"),
                    partner("CASA JMSB", "A five-day volunteering and fundraising event.", "Developing"),
                    partner("CUTEA", "Volunteering event in February 2025.", "Developing")
                ]},
                {"g": "Businesses and companies", "items": [
                    partner("Sportira", "Has supported us since we were founded: jerseys, pinnies and volunteering events.", "Established"),
                    partner("Reggie's", "Venue for five or six fundraisers over the years.", "Established"),
                    partner("Adaptavist", "A cooking event that served over 250 people and raised about $2,000 (2024).", "Established"),
                    partner("MTL Flag Plus and Poulet Rouge", "Our Flag Football fundraiser: Flag Plus runs the games, Poulet Rouge sponsors.", "Active"),
                    partner("GHD Group", "Volunteer event (2021) and a food donation (2024). Employees volunteer with us.", "Developing"),
                    partner("Lauzon driving school", "Equipment support, and a possible source of volunteer drivers.", "Developing"),
                    partner("Oberoi Financial and RBC", "Past volunteering events. Worth re-engaging.", "Dormant")
                ]},
                {"g": "Guidance and media", "items": [
                    partner("MCC", "Strategic guidance through the CMP program. The growth strategy deck in the academy came from it.", "Established"),
                    partner("CBC, CityNews and CTV", "Television coverage of our servings.", "Established"),
                    partner("The Montreal Guardian and The Link", "Articles featuring our work.", "Established")
                ]}
            ]},
            {"type": "link", "t": "Open the Partner Relations sheet", "d": "Every organization, its status, point of contact, notes and completed goals.", "url": PARTNER_SHEET}
        ]},
        {"id": "stages", "t": "Relationship stages", "blocks": [
            {"type": "p", "text": "Every organization in the sheet has a status. Moving a relationship forward is a team effort, so keep it current."},
            {"type": "stages", "items": [
                {"t": "Follow up", "d": "Someone to contact. Pick an owner and a first step.", "tone": "muted"},
                {"t": "Developing", "d": "Conversations are happening. Agree on a first joint project.", "tone": "gold"},
                {"t": "Established", "d": "We have worked together and plan to keep going.", "tone": "green"},
                {"t": "Collaborated but dormant", "d": "We worked together before. Re-engage with a specific ask.", "tone": "purple"},
                {"t": "Dead end", "d": "No reply, or not interested. Note why, and move on.", "tone": "flag"}
            ]}
        ]},
        {"id": "how", "t": "How a partnership comes together", "blocks": [
            {"type": "steps", "items": [
                {"t": "Define the scope and objectives", "d": "The goals, the programs or events involved, and the impact we expect for the people we serve."},
                {"t": "Agree roles and responsibilities", "d": "Who coordinates, who handles volunteers, logistics, communications and reporting. One point of contact on each side."},
                {"t": "Plan operations and resources", "d": "Facilities, equipment, volunteers, materials and timelines, plus any budget or in-kind contributions."},
                {"t": "Formalize it", "d": "An MOU or project agreement covering commitments, liability, safeguarding, branding and reporting."},
                {"t": "Monitor and evaluate", "d": "Clear measures, regular check-ins, and feedback from partners, volunteers and the people we serve."},
                {"t": "Plan what comes next", "d": "How good work continues, and how to end a partnership responsibly if it needs to."}
            ]},
            {"type": "p", "text": "Three models give us a flexible starting point, from our community kitchen partnership plan:"},
            {"type": "cards", "items": [
                {"icon": "home", "t": "Host arrangement", "d": "A partner provides a space, like a certified kitchen, on a predictable schedule. We bring the volunteers, food and supplies."},
                {"icon": "handshake", "t": "Program collaboration", "d": "We design and deliver a program together, sharing the work and the credit."},
                {"icon": "flag", "t": "Pilot project", "d": "A short trial with clear goals. Then we decide together what comes next."}
            ]}
        ]},
        {"id": "offer", "t": "What we offer, what we ask", "blocks": [
            {"type": "compare", "cols": [
                {"t": "We offer", "tone": "good", "items": ["A dedicated, diverse volunteer network", "Experience designing and delivering programs", "A strong community presence", "Promotion on our channels, and co-branding"]},
                {"t": "We look for", "tone": "neutral", "items": ["Alignment with our mission and values", "Resources: space, expertise, networks or funding", "A collaborative spirit and open communication", "Active support for delivery and outreach"]}
            ]},
            {"type": "p", "text": "And the principles we hold ourselves to:"},
            {"type": "cards", "items": [
                {"icon": "scale", "t": "Mutual benefit", "d": "Every partner gets real value, and is treated fairly."},
                {"icon": "eye", "t": "Transparency", "d": "Open communication and responsible use of every resource."},
                {"icon": "chat", "t": "Clear communication", "d": "Regular, consistent updates build trust."},
                {"icon": "shield", "t": "Safeguarding and dignity", "d": "Everyone is treated with dignity and respect, and partners follow safeguarding practices."},
                {"icon": "target", "t": "Impact first", "d": "Measurable outcomes for the communities we serve."}
            ]}
        ]},
        {"id": "you", "t": "Your part", "blocks": [
            {"type": "steps", "items": [
                {"t": "Check the sheet first", "d": "Before contacting an organization, look it up in the Partner Relations sheet. Someone may already own the relationship."},
                {"t": "Use the templates", "d": "The Partnership Email Templates cover pharmacies, clothing charities and thrift stores, food suppliers and restaurants, and other non-profits."},
                {"t": "Log every contact", "d": "Update the status, point of contact, notes and completed goals after each conversation."},
                {"t": "Keep commitments with your lead", "d": "Anything involving money, logos or a formal agreement goes through your lead and the executive team."},
                {"t": "Bring it back to the Hub", "d": "Record outcomes on your team page, and ask Marketing through Requests for co-branded posts."}
            ]},
            {"type": "links", "items": [
                {"t": "Partner Relations 2025-2030", "d": "The live partner list.", "url": PARTNER_SHEET},
                {"t": "Partnership Outreach Document", "d": "Our full approach to partnerships.", "url": OUTREACH_DOC},
                {"t": "Partnership Email Templates", "d": "Ready-to-edit first emails.", "url": EMAIL_TEMPLATES},
                {"t": "Community kitchen partnership plan", "d": "A worked example with the three models.", "url": KITCHEN_PLAN}
            ]}
        ]}
    ],
    "quiz": {"pass": 0.8, "questions": [
        {"q": "A company gives us $500 and we put their logo on our event banner. What is that relationship?", "a": ["Partner", "Sponsor", "Collaborator"], "c": 1,
         "why": "Sponsors give money or in-kind support and get recognition in return."},
        {"q": "A student club joins one of our Sunday servings, with no formal agreement. What is that?", "a": ["A collaborator", "A sponsor", "A partner"], "c": 0,
         "why": "Collaborators join events or initiatives without a formal agreement, and often grow into partners."},
        {"q": "Before emailing an organization about working together, what comes first?", "a": ["Send a template right away", "Check the Partner Relations sheet for an existing relationship", "Post about it on social media"], "c": 1,
         "why": "Someone may already own the relationship. The sheet also shows the history, so your email starts in the right place."},
        {"q": "What formalizes a partnership's roles, liability, safeguarding and branding?", "a": ["A handshake", "A social media post", "An MOU or project agreement"], "c": 2,
         "why": "Partnerships are formalized in writing, with roles, responsibilities and expectations agreed up front."},
        {"q": "A relationship is marked Collaborated but dormant. What is the best move?", "a": ["Re-engage with a specific ask", "Remove it from the sheet", "Never contact them again"], "c": 0,
         "why": "We have worked together before. A clear, specific ask is the best way to restart."},
        {"q": "Which model fits using a partner's certified kitchen on a predictable schedule?", "a": ["Sponsorship", "Host arrangement", "Media coverage"], "c": 1,
         "why": "In a host arrangement the partner provides the space; we bring the volunteers, food and supplies."}
    ]}
}

MODULE7 = ("The Training academy starts with your onboarding: your onboarding plan week by week, the Hub first steps and the policies to sign. "
           "Below it: your level and progress, what is up next, learning paths with a certificate at the end, a guided tour for every page of the Hub, "
           "and the full library of videos, lessons and documents. Open anything and it fills the screen: watch, read or take the quiz, then mark it complete. "
           "Certificates and badges show on your profile. HR manages onboarding and assigns trainings from the HR centre."
           "\n\nTry it: take the tour of the academy itself, then one page tour.\n\n"
           "Done when: you know where your onboarding, your assigned trainings and the page tours live.")

MODULE_TOURS = {39: ["home", "chrome"], 40: ["team", "tasks"], 41: ["transcripts"], 42: ["requests"],
                43: ["goals", "orggoals", "goalmap"], 44: ["volunteering"], 45: ["academy"], 46: ["chrome", "agendas"]}

PATHS = [
    # key, name (= trainings.path_group), title, blurb, dept, required, cert, color, icon, sort
    ("foundations", "Welfare Avenue foundations", "Welfare Avenue foundations", "Who we are, the eight activities we are registered for, and the partners we work with.", None, True, "Welfare Avenue Foundations", "#DCA527", "heart", 10),
    ("hub", "Using the Hub", "Using the Hub", "Eight short modules on how the Hub turns meetings into work.", None, True, "Hub Essentials", "#103F39", "compass", 20),
    ("tours", "Hub page tours", "Hub page tours", "A guided walkthrough of every page of the Hub, section by section.", None, False, "Hub Navigator", "#2A8C7A", "map", 30),
    ("marketing", "Marketing Strategy Package", "Marketing strategy", "The marketing strategy built for Welfare Avenue, module by module.", "marketing", False, "Marketing Strategy", "#6F64AB", "megaphone", 40),
    ("branding", "Branding", "Our brand", "The brand refresh: what changed and why.", "marketing", False, "Brand Ready", "#B9851B", "sparkle", 45),
    ("ops", "Operations Basics", "Operations basics", "Running volunteers and ordering for a serving.", "opsmtl", False, "Operations Basics", "#2B6F55", "box", 50),
    ("keela", "Keela donor CRM", "Keela donor CRM", "Contacts, donation forms, volunteers and Smart Ask in Keela.", "fundraising", False, "Keela Ready", "#B3402F", "gift", 60),
    ("governance", "Charity governance", "Charity governance", "Keeping our registration, filing the T3010, and gifting and receipting.", "board", False, "Governance Ready", "#1F201E", "shield", 70),
]

TOURS = [
    # key, title, tab, blurb, minutes
    ("chrome", "Finding your way around", "mypage", "The menu, search, check-in, Needs me and Ask the Hub: the parts that follow you everywhere.", 2),
    ("home", "Home", "mypage", "Your personal queue: meetings, tasks, mentions, updates and time.", 3),
    ("team", "Your department page", "dept", "Your team's pulse, decisions, updates, meetings, projects and tools.", 3),
    ("tasks", "Team tasks and agendas", "dept", "Lists, boards and calendars for the team's work, and the team agenda.", 2),
    ("overview", "Executive dashboard", "overview", "The numbers, what is new and the decisions that sit with the executives.", 3),
    ("dashboard", "Delivery numbers", "dashboard", "How fast work moves: time to close, open workload and aging.", 2),
    ("orggoals", "Organizational goals", "orggoals", "The yearly and multi-year goals everything rolls up to.", 3),
    ("goals", "Department goals", "goals", "Every team's quarterly goals, with the projects and tasks behind them.", 3),
    ("projects", "Projects", "projects", "Every active project by team, with its lead and its goal.", 2),
    ("goalmap", "Goal alignment", "goalmap", "How projects, department goals and organizational goals connect.", 2),
    ("project", "Project pages", "projects", "One project's tasks, lead and progress.", 2),
    ("requests", "Requests", "requests", "How teams ask each other for work.", 2),
    ("transcripts", "Transcript archive", "transcripts", "How a meeting becomes tasks, updates and decisions.", 3),
    ("agendas", "Agendas", "agendas", "Build an agenda, run the meeting, share it.", 2),
    ("hubmail", "Hub inbox", "hubmail", "What happens when you cc hub@welfareavenue.com.", 2),
    ("orgchart", "Org chart", "orgchart", "Who does what, team by team.", 2),
    ("person", "People pages", "orgchart", "A person's work, responsibilities, meetings and progress.", 2),
    ("academy", "Training academy", "training", "Onboarding, paths, tours, the library and your trophy case.", 2),
    ("volunteering", "Volunteering", "volunteering", "The serving programme: calendar, events, checklist and roster.", 4),
    ("hrcentre", "HR centre", "hrcentre", "People, hours, onboarding, training, hiring and policies.", 3),
    ("finances", "Finances", "finances", "Statements, budgets, the ledger and nonprofit health.", 3),
    ("contentcal", "Content calendar", "contentcal", "Plan, publish and confirm Instagram and Facebook posts.", 3),
    ("socialstats", "Marketing analytics", "socialstats", "Followers, reach and what worked over any range back to the start, every post with its numbers, who follows us, and how far back each platform goes.", 3),
    ("create", "Create studio", "create", "Branded drafts from a short brief.", 2),
    ("brain", "The Brain", "brain", "The living map of people, meetings, tasks and goals.", 2),
    ("importantinfo", "Important info", "importantinfo", "Logins, videos, drives and key links.", 2),
    ("photos", "Photo library", "photos", "Our photos, labelled and cleared for use, ready for posts and the Create studio.", 2),
    ("activity", "Activity", "activity", "The audit trail of every change.", 1),
    ("adminpanel", "Admin", "adminpanel", "AI models, adoption, accounts, access, security and changes.", 3),
]

KEELA_IDS = [13, 14, 15, 16, 17, 18, 19]
GOV_IDS = [6, 7, 8, 10, 11, 12]


def check_text(obj, where='content'):
    s = json.dumps(obj, ensure_ascii=False)
    bad = [c for c in ('—', '–') if c in s]
    if bad:
        raise SystemExit('dash found in ' + where + ': ' + repr(bad))
    for w in re.findall(r'\bbeneficiar\w*', s, flags=re.I):
        pass  # allowed only in the "we don't say" and the CRA exception lines
    return s


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def jb(obj, tag='j'):
    s = json.dumps(obj, ensure_ascii=False)
    assert '$' + tag + '$' not in s
    return '$' + tag + '$' + s + '$' + tag + '$::jsonb'


def build():
    check_text(ACTIVITIES, 'activities')
    check_text(PARTNERS, 'partners')
    check_text(PATHS, 'paths')
    check_text(TOURS, 'tours')
    check_text(MODULE7, 'module7')
    out = []
    out.append('-- wa122_academy: Training academy (wave122). Idempotent. Generated by build/data/w122_content.py')
    out.append('''
alter table public.trainings
  add column if not exists kind text,
  add column if not exists key text,
  add column if not exists body jsonb,
  add column if not exists minutes int,
  add column if not exists xp int,
  add column if not exists updated_at timestamptz default now();
create unique index if not exists trainings_key_uidx on public.trainings(key) where key is not null;

alter table public.training_progress
  add column if not exists email text,
  add column if not exists started_at timestamptz,
  add column if not exists pct int,
  add column if not exists last_step int,
  add column if not exists score int,
  add column if not exists seconds int,
  add column if not exists data jsonb;

create table if not exists public.academy_paths (
  key text primary key,
  name text not null unique,
  title text not null,
  blurb text,
  dept text,
  required boolean not null default false,
  cert_title text,
  color text,
  icon text,
  sort int not null default 100,
  active boolean not null default true,
  updated_at timestamptz default now()
);
alter table public.academy_paths enable row level security;
drop policy if exists academy_paths_read on public.academy_paths;
create policy academy_paths_read on public.academy_paths for select to authenticated using (public.is_wa_staff());
drop policy if exists academy_paths_write on public.academy_paths;
create policy academy_paths_write on public.academy_paths for all to authenticated using (public.is_hub_leader()) with check (public.is_hub_leader());
grant select, insert, update, delete on public.academy_paths to authenticated;

create table if not exists public.academy_awards (
  id bigint generated always as identity primary key,
  person_name text not null,
  email text,
  award text not null,
  kind text not null default 'badge',
  title text not null,
  detail text,
  meta jsonb not null default '{}'::jsonb,
  earned_at timestamptz not null default now(),
  unique (person_name, award)
);
create index if not exists academy_awards_earned_idx on public.academy_awards(earned_at desc);
alter table public.academy_awards enable row level security;
drop policy if exists academy_awards_read on public.academy_awards;
create policy academy_awards_read on public.academy_awards for select to authenticated using (public.is_wa_staff());
drop policy if exists academy_awards_insert on public.academy_awards;
create policy academy_awards_insert on public.academy_awards for insert to authenticated
  with check (public.is_wa_staff() and (lower(coalesce(email, '')) = public.wa_email() or public.is_hub_leader()));
drop policy if exists academy_awards_update on public.academy_awards;
create policy academy_awards_update on public.academy_awards for update to authenticated
  using (lower(coalesce(email, '')) = public.wa_email() or public.is_hub_admin())
  with check (lower(coalesce(email, '')) = public.wa_email() or public.is_hub_admin());
drop policy if exists academy_awards_delete on public.academy_awards;
create policy academy_awards_delete on public.academy_awards for delete to authenticated using (public.is_hub_admin());
grant select, insert, update, delete on public.academy_awards to authenticated;

insert into public.training_categories (name, department, sort) values ('Welfare Avenue', null, 5), ('Hub tours', null, 15)
  on conflict (name) do nothing;
''')
    # paths
    for p in PATHS:
        key, name, title, blurb, dept, req, cert, color, icon, sort = p
        out.append('insert into public.academy_paths (key, name, title, blurb, dept, required, cert_title, color, icon, sort) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %d)\n  on conflict (key) do update set name = excluded.name, title = excluded.title, blurb = excluded.blurb, dept = excluded.dept, required = excluded.required, cert_title = excluded.cert_title, color = excluded.color, icon = excluded.icon, sort = excluded.sort, updated_at = now();'
                   % (q(key), q(name), q(title), q(blurb), q(dept) if dept else 'null', 'true' if req else 'false', q(cert), q(color), q(icon), sort))
    # kinds, minutes for the existing catalogue (only where not set)
    out.append('''
update public.trainings set kind = case
    when coalesce(resource_url, '') ~* 'loom\\.com/(share|embed)/' then 'video'
    when source = 'loom' then 'video'
    when coalesce(resource_url, '') ~* '^https?://' then 'doc'
    else 'read' end
  where kind is null;
update public.trainings set minutes = greatest(1, round(duration_sec / 60.0)::int) where minutes is null and duration_sec is not null;
update public.trainings set minutes = greatest(2, ceil(length(coalesce(description, '')) / 900.0)::int) where minutes is null and kind = 'read';
update public.trainings set minutes = 5 where minutes is null;''')
    out.append("update public.trainings set path_group = 'Keela donor CRM', updated_at = now() where id in (%s) and path_group is null;" % ','.join(map(str, KEELA_IDS)))
    out.append("update public.trainings set path_group = 'Charity governance', updated_at = now() where id in (%s) and path_group is null;" % ','.join(map(str, GOV_IDS)))
    out.append("update public.trainings set description = %s, updated_at = now() where id = 45;" % q(MODULE7))
    for tid, tours in MODULE_TOURS.items():
        out.append("update public.trainings set body = %s, updated_at = now() where id = %d and body is null;" % (jb({"tours": tours}), tid))
    # lessons
    lessons = [
        ("lesson:activities", "Our eight charitable activities", ACTIVITIES, 12, 1, "What we are registered to do, how each activity works in practice, and how to talk about it."),
        ("lesson:partners", "Our partners and how we work with them", PARTNERS, 12, 2, "Partners, sponsors and collaborators, who we work with today, and how a partnership comes together."),
    ]
    for key, title, body, mins, sort, desc in lessons:
        out.append('''insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
  values ('Welfare Avenue', %s, %s, 'hub', 'Welfare Avenue foundations', %d, true, 'lesson', %s, %s, %d, 60)
  on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, body = excluded.body, minutes = excluded.minutes, path_group = excluded.path_group, sort = excluded.sort, category = excluded.category, kind = excluded.kind, active = true, updated_at = now();'''
                   % (q(title), q(desc), sort, q(key), jb(body), mins))
    for i, t in enumerate(TOURS):
        key, title, tab, blurb, mins = t
        out.append('''insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
  values ('Hub tours', %s, %s, 'hub', 'Hub page tours', %d, true, 'tour', %s, %s, %d, 20)
  on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, body = excluded.body, minutes = excluded.minutes, path_group = excluded.path_group, sort = excluded.sort, category = excluded.category, kind = excluded.kind, active = true, updated_at = now();'''
                   % (q('Page tour: ' + title), q(blurb), i + 1, q('tour:' + key), jb({"tour": key, "tab": tab}), mins))
    sql = '\n'.join(out) + '\n'
    with open(os.path.join(ROOT, 'build', 'data', 'wa122_academy.sql'), 'w') as f:
        f.write(sql)

    # harness fixture rows
    fx = {"academy_paths": [], "trainings_new": [], "academy_awards": []}
    for p in PATHS:
        key, name, title, blurb, dept, req, cert, color, icon, sort = p
        fx["academy_paths"].append({"key": key, "name": name, "title": title, "blurb": blurb, "dept": dept, "required": req, "cert_title": cert, "color": color, "icon": icon, "sort": sort, "active": True})
    nid = 1000
    for key, title, body, mins, sort, desc in lessons:
        nid += 1
        fx["trainings_new"].append({"id": nid, "category": "Welfare Avenue", "title": title, "description": desc, "source": "hub", "path_group": "Welfare Avenue foundations", "sort": sort, "active": True, "kind": "lesson", "key": key, "body": body, "minutes": mins, "xp": 60, "resource_url": None, "ext_id": None, "duration_sec": None})
    for i, t in enumerate(TOURS):
        key, title, tab, blurb, mins = t
        nid += 1
        fx["trainings_new"].append({"id": nid, "category": "Hub tours", "title": "Page tour: " + title, "description": blurb, "source": "hub", "path_group": "Hub page tours", "sort": i + 1, "active": True, "kind": "tour", "key": "tour:" + key, "body": {"tour": key, "tab": tab}, "minutes": mins, "xp": 20, "resource_url": None, "ext_id": None, "duration_sec": None})
    fx["module7"] = MODULE7
    fx["module_tours"] = MODULE_TOURS
    fx["keela_ids"] = KEELA_IDS
    fx["gov_ids"] = GOV_IDS
    with open(os.path.join(ROOT, 'test', 'fx_w122.json'), 'w') as f:
        json.dump(fx, f, ensure_ascii=False, indent=1)
    print('wrote wa122_academy.sql (%d bytes), fx_w122.json (%d trainings)' % (len(sql), len(fx["trainings_new"])))


if __name__ == '__main__':
    build()
