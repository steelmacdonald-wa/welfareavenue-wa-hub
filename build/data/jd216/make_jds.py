#!/usr/bin/env python3
"""wave216e (07/10/26): the open roles' job descriptions in the Welfare Avenue brand (Steel: "re do the job descriptions with the new
branding - remove the VCSA"). Each role becomes an HTML file that Google Drive converts into a Google Doc in the position's folder,
so HR keeps editing it in Drive; jd-drive then moves the old JD into Older JDs and recruit-actions jd_publish exports the new one as
the PDF linked on welfareavenue.com/join and the application form.
  python3 build/data/jd216/make_jds.py      -> build/data/jd216/<slug>.html"""
import html, os
HERE = os.path.dirname(os.path.abspath(__file__))
LOCKUP = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/logo-lockup-cream-600.png'
# wave216f (wa-brand v1): only the five brand colours. Purple carries the subtitle, cream the fact labels and the page.
GREEN, GOLD, INK, PURPLE, CREAM = '#103F39', '#DCA527', '#1F201E', '#6F64AB', '#FFFAF2'
MUTED, SAND = PURPLE, CREAM
HEAD = "font-family:'Barlow Condensed',Arial;font-weight:700;text-transform:uppercase;color:" + GREEN + ';'
BODY = "font-family:'Space Grotesk',Arial;color:" + INK + ';font-size:10.5pt;line-height:1.45;'
ABOUT = ('Welfare Avenue is a youth-powered registered charity in Montreal. We serve home-cooked meals and connect people experiencing '
         'homelessness and food insecurity with the support they need, carried by a community of volunteers. We champion leadership, '
         'partnership and networking to bring community members and organizations together around that work.')
APPLY = ('Apply at welfareavenue.com/join: pick this role, attach your resume and tell us why Welfare Avenue. Questions? Write to '
         'job@welfareavenue.com.')
LOOK = ('We hire for integrity, curiosity and follow-through, and for people who learn quickly. Experience helps, but we care more '
        'about how you think, how you show up for a team, and whether our mission matters to you.')
E = html.escape

def doc(r):
    facts = ''.join('<tr><td style="background:%s;padding:5pt 8pt;width:32%%;%sfont-weight:700;color:#FFFAF2;">%s</td><td style="padding:5pt 8pt;%s">%s</td></tr>'
                    % (GREEN, BODY.replace('color:' + INK + ';', ''), E(k), BODY, E(v)) for k, v in r['facts'])
    def ul(items): return '<ul>' + ''.join('<li style="%s">%s</li>' % (BODY, E(i)) for i in items) + '</ul>'
    def h2(t): return '<h2 style="%sfont-size:16pt;margin:16pt 0 4pt;">%s</h2>' % (HEAD, E(t.upper()))
    def h3(t): return '<p style="font-family:\'Space Grotesk\',Arial;font-weight:400;letter-spacing:.5pt;color:%s;font-size:11pt;margin:10pt 0 2pt;">%s</p>' % (GREEN, E(t.upper()))  # Docs bolds h3; the brand h3 is Regular
    def p(t): return '<p style="%s">%s</p>' % (BODY, E(t))
    resp = ''.join(h3(t) + ul(items) for t, items in r['resp'])
    quals = ''.join(h3(t) + ul(items) for t, items in r['quals'])
    return ('<html><head><meta charset="utf-8"><title>%s - Job Description</title></head><body style="background:#FFFAF2;">'
            '<table style="width:100%%;border-collapse:collapse;"><tr><td style="background:%s;padding:14pt 16pt;"><img src="%s" width="170" alt="Welfare Avenue"></td>'
            '<td style="background:%s;padding:14pt 16pt;text-align:right;%scolor:%s;font-size:9pt;letter-spacing:1pt;">JOB DESCRIPTION</td></tr></table>'
            '<h1 style="%sfont-size:30pt;margin:14pt 0 2pt;">%s</h1>'
            '<p style="font-family:\'Space Grotesk\',Arial;color:%s;font-size:10pt;margin:0 0 8pt;"><span style="color:%s;font-weight:700;">&#9632;</span> Welfare Avenue &middot; %s</p>'
            '<table style="width:100%%;border-collapse:collapse;border:1pt solid #103F39;">%s</table>'
            '%s%s%s%s%s%s%s%s%s%s'
            '<p style="font-family:\'Space Grotesk\',Arial;color:%s;font-size:8.5pt;margin-top:18pt;border-top:1pt solid %s;padding-top:6pt;">Welfare Avenue &middot; Registered charity 713048502RR0001 &middot; welfareavenue.com &middot; Updated 07/10/26</p>'
            '</body></html>'
            % (E(r['title']), GREEN, LOCKUP, GREEN, "font-family:'Space Grotesk',Arial;font-weight:700;text-transform:uppercase;", GOLD,
               HEAD, E(r['title'].upper()), MUTED, GOLD, E(r['team']), facts,
               h2('About Welfare Avenue'), p(ABOUT), h2('The role'), ''.join(p(x) for x in r['summary']),
               h2('What you will do'), resp, h2('What you bring'), quals, h2('What we look for'), p(LOOK) + h2('How to apply') + p(APPLY),
               INK, GOLD))

OPS_SUMMARY = lambda t: [
    'The %s leads operational planning and execution for Welfare Avenue’s volunteering events, so that every event is set up for success and runs smoothly. You lead the logistics and operations team, make sure every event-critical task is done on time, and make sure each event has a complete, accurate itinerary in volunteers’ hands.' % t,
    'Volunteer outreach, confirmations and day-to-day communication sit with the Operations Coordinators and Assistants. The %s brings the leadership, accountability and structure that let the team deliver well-run events, week after week.' % t,
    'You also partner with the Program Development team to put new programs into practice, use budgets responsibly and deliver on grant commitments. A big part of the role is growth: taking our servings from every second Sunday towards every week, and then to more locations in Montreal and across Quebec.']
OPS_RESP = lambda t: [
    ('Team leadership and event readiness', ['Lead the logistics and operations team so every event is fully prepared and well run',
        'Set clear timelines, owners and follow-through across the team',
        'Make sure event-critical information is complete and accurate ahead of time: roster, locations, timing, supplies, roles and back-up plans',
        'Spot gaps early and get the team to close them before event day']),
    ('Itineraries and logistics', ['Send each weekend’s itinerary to volunteers in advance, with the schedule, locations, roles and what to expect',
        'Keep itineraries in one standard format in the Welfare Avenue Hub and improve them from team feedback',
        'Oversee set-up needs: equipment, transport, supplies and role coverage',
        'Hold the team accountable for volunteer confirmations and group chats, which the Coordinators and Assistants run']),
    ('Programs and budgets', ['Turn Program Development plans into clear workflows, staffing plans and timelines',
        'Make sure budgets, including grant-funded ones, are used well, tracked and tied to outcomes',
        'Deliver grant commitments consistently, with strong operational oversight']),
    ('Growth', ['Improve how reliably and efficiently we run events',
        'Build the systems and routines that let us move from every second Sunday to every week',
        'Help plan new locations in Montreal and across Quebec with logistics models that scale',
        'Track how events go and recommend changes that grow our impact without lowering quality'])]
OPS_QUALS = [
    ('Education and experience', ['Enrolled in or graduated from a CEGEP or university program in logistics, event management, nonprofit management or a related field, or equivalent hands-on experience',
        'Experience in operations or logistics coordination, team leadership, volunteer events or event planning (student clubs and community events count)']),
    ('Skills', ['Strong leadership: you can hold a team accountable kindly and clearly',
        'Organized and detail-minded, with many moving parts and deadlines at once',
        'Clear written and spoken communication; French and English is a strong asset',
        'Comfortable with a CRM and event tools; you will work in the Welfare Avenue Hub, Slack and Google Workspace',
        'Able to work independently and as part of a team, and available some weekends and evenings, including in person at events'])]
def ops(title): return {'title': title, 'slug': title.lower().replace(' ', '-'), 'team': 'Operations, Montreal',
    'facts': [('Role', title), ('Team', 'Operations, Montreal'), ('Reports to', 'Co-Executive Directors'),
              ('Leads', 'Operations Coordinators and Assistants, and the event-day team leads'), ('Works with', 'Program Development, Fundraising, HR'),
              ('Location', 'Montreal: planning mostly remote, in person at events'), ('Weekly commitment', '4-8 hours, flexible around your work and school schedule')],
    'summary': OPS_SUMMARY(title), 'resp': OPS_RESP(title), 'quals': OPS_QUALS}

ROLES = [
  {'title': 'Co-Director of Marketing', 'slug': 'co-director-of-marketing', 'team': 'Marketing & Communications',
   'facts': [('Role', 'Co-Director of Marketing'), ('Team', 'Marketing & Communications'), ('Reports to', 'Co-Executive Directors'),
             ('Works with', 'Director of Marketing (you share the department)'),
             ('Leads', 'Content Manager, Communications Lead, Brand and Graphic Designers, Campaign Manager'),
             ('Location', 'Montreal, mostly remote, with some events and team meetings in person'), ('Weekly commitment', '4-8 hours, flexible around your work and school schedule')],
   'summary': ['The Co-Director of Marketing leads Welfare Avenue’s marketing and communications side by side with the Director of Marketing. Together you set the direction for how we tell our story: our social media, our newsletter and website, our campaigns and our brand. You split the department between you and lead the people who make the content, so that donors, volunteers, partners and the people we serve see one consistent Welfare Avenue wherever they find us.',
               'It is a leadership seat with real ownership: you plan the campaigns behind our events and fundraisers, decide where our time and budget go, and grow the next marketing leaders on the team.'],
   'resp': [('Strategy and campaigns', ['Set the marketing plan for the year with the Director of Marketing, tied to our events, fundraising campaigns and recruitment',
              'Plan and run campaigns before, during and after each event and fundraiser, with clear goals and messages',
              'Spot trends and new opportunities, and test new formats and channels']),
            ('Brand and channels', ['Keep every channel on brand with the Welfare Avenue Brand Guides: Instagram, Facebook, LinkedIn, TikTok, the newsletter and welfareavenue.com',
              'Oversee marketing material such as posters, flyers and event visuals',
              'Build and keep relationships with our audience, partners and media']),
            ('Leading the team', ['Share the leadership of the department: weekly marketing meeting, clear priorities and owners',
              'Coach the Content Manager, designers and writers, and review their work with kind, direct feedback',
              'Recruit and onboard new marketing volunteers with HR']),
            ('Planning and reporting', ['Track the marketing budget and spending',
              'Read the numbers each month and report what is working to the Co-Executive Directors',
              'Attend directors’ meetings and key events'])],
   'quals': [('Education and experience', ['Enrolled in or graduated from a program in marketing, communications or a related field, or equivalent hands-on experience',
              'Experience in marketing or communications for a brand, club, nonprofit or company',
              'Some experience leading a team or a project'])],
   },
  ops('Operations Manager'),
  ops('Logistics Manager'),
  {'title': 'HR Technician', 'slug': 'hr-technician', 'team': 'Human Resources',
   'facts': [('Role', 'HR Technician'), ('Team', 'Human Resources'), ('Reports to', 'HR Lead'),
             ('Works with', 'Team leads in every department'), ('Location', 'Remote and flexible'),
             ('Weekly commitment', '4-8 hours, flexible around your work and school schedule')],
   'summary': ['The HR Technician helps us recruit and welcome the volunteers who run Welfare Avenue. Working with our HR leads, you keep the recruitment pipeline moving: posting roles, screening applications, scheduling interviews and making sure every candidate gets a timely answer. Then you help new team members get started well.',
               'It is a hands-on role for someone who wants practical HR and recruitment experience and enjoys talking to people.'],
   'resp': [('Recruitment', ['Post open roles on welfareavenue.com, CABM, LinkedIn and campus boards, and keep postings current',
              'Screen applications and resumes in the Welfare Avenue Hub and shortlist candidates with the team lead',
              'Schedule and sit in on interviews, and send follow-ups and answers to every candidate',
              'Keep each applicant’s card up to date on the Hub’s Applications board']),
            ('Onboarding and records', ['Prepare the first steps for new team members: accounts, welcome message, first meeting and their onboarding plan in the Hub',
              'Keep team records and job descriptions current with team leads',
              'Reach out to past volunteers and student networks when a role is hard to fill'])],
   'quals': [('Education and experience', ['Studies or interest in human resources, management, psychology, communications or a related field']),
             ('Skills', ['Organized and detail-minded: nothing falls through the cracks',
              'Clear, friendly written communication with candidates',
              'Comfortable with Google Workspace, Slack and online tools; experience with an applicant tracker is a plus',
              'Discreet with personal information',
              'French and English is an asset'])]},
]
# the Co-Director's skills
ROLES[0]['quals'].append(('Skills', ['A strategic thinker who can also roll up their sleeves', 'A sharp eye for detail, tone and visual consistency',
    'Clear, confident writing; French and English is a strong asset', 'Comfortable reading social media analytics and turning them into decisions',
    'Familiar with Canva, Meta Business Suite and scheduling tools']))

CONTENT_MANAGER = {'title': 'Content Manager', 'slug': 'content-manager', 'team': 'Marketing & Communications',
   'facts': [('Role', 'Content Manager'), ('Team', 'Marketing & Communications'), ('Reports to', 'Director of Marketing'),
             ('Leads', 'Writer, Content Developers (static content, posts and stories, video)'),
             ('Works alongside', 'Communications Lead, Brand Manager, Graphic / Brand Designer, Campaign Manager, Communications Coordinator'),
             ('Location', 'Montreal, mostly remote, with some serving events and team meetings in person'), ('Weekly commitment', '6-8 hours, flexible around your work and school schedule')],
   'summary': ['The Content Manager owns what Welfare Avenue publishes and when. You plan the content calendar for our social media and email channels, assign the work to our writers and content developers, keep everyone on deadline, and review every post before it goes out so it is accurate, on tone and on brand. You read the numbers each month and tell the Director of Marketing what is working, what is not, and what we should do next.',
               'The role exists so that our designers and writers can focus on making great content, and so that the people we serve, our volunteers and our donors see one consistent Welfare Avenue wherever they find us.'],
   'resp': [('Content planning', ['Plan and maintain the monthly content calendar for Instagram, Facebook, LinkedIn, TikTok and our email newsletter, in the Welfare Avenue Hub’s content calendar',
              'Line content up with serving events, fundraising campaigns, partnerships and announcements, working from the event calendar Operations shares and the campaign plans from Fundraising',
              'Turn ideas from marketing meetings, the team and the community into planned posts, and keep a bank of ideas for quieter weeks',
              'Plan the newsletter and LinkedIn calendar with the Communications Lead so written and visual content tell the same story']),
            ('Leading the content team', ['Assign content tasks to the Writer and Content Developers with a clear brief, a deadline and the assets they need',
              'Track progress, coordinate deadlines and deliverables, and unblock people early when something slips',
              'Run a short weekly content check-in with the team', 'Give constructive feedback and help newer team members grow in their role']),
            ('Quality and brand', ['Review every post, caption and email before it is scheduled for accuracy, tone, quality and brand alignment',
              'Apply the Welfare Avenue Brand Guides consistently across every channel, working with the Brand Manager',
              'Keep a cohesive, consistent social media feed and a recognisable Welfare Avenue voice in English and French',
              'Make sure people featured in our content have given consent, and that photos and stories respect the dignity of the people we serve']),
            ('Analytics and reporting', ['Monitor engagement, growth and reach across all channels using the Hub’s analytics',
              'Compile a monthly report for the Director of Marketing: what we posted, how it performed, and what we will change',
              'Use what the numbers show to adjust the calendar, formats and posting times']),
            ('Content creation support', ['Write captions, draft posts and step in on content creation when the team needs it',
              'Flag important comments and messages to the Communications Coordinator'])],
   'quals': [('Education and experience', ['Currently enrolled in or graduated from a program in Marketing, Communications, Digital Media or a related field, or equivalent hands-on experience',
              'Experience managing social media accounts or a content calendar for an organisation, student club, nonprofit or brand',
              'Experience coordinating or reviewing other people’s work is a strong asset', 'A portfolio, or accounts you have managed, that we can look at']),
             ('Skills and competencies', ['Strong organisation: you can keep many deliverables and deadlines moving at once', 'A sharp eye for detail, tone and visual consistency',
              'Clear written communication; French is a strong asset', 'Comfort reading social media analytics and turning them into recommendations',
              'Familiarity with Instagram, Facebook, LinkedIn and TikTok, and with tools such as Canva and scheduling or analytics tools', 'Able to give feedback kindly and directly, and to take it'])]}
ROLES.insert(1, CONTENT_MANAGER)

for r in ROLES:
    open(os.path.join(HERE, r['slug'] + '.html'), 'w', encoding='utf8').write(doc(r))
    print(r['slug'], len(doc(r)))
