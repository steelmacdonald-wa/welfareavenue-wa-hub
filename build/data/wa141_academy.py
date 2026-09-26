#!/usr/bin/env python3
"""wave141 (26/09/26): the Slack training lists (one per department, plus General) into the Avenue Academy.
Steel: "I'd also like you to look through my Slack lists, there's one per department on training. It could be smart
to transfer things from there to Avenue Academy".

Reads the lists as a reader saved them (items.json: one row per list item, with the trained people's emails) and
writes build/data/wa141_academy.sql:
  - new Learning Avenues (tools, leading a team, people and HR, fundraising and grants, student clubs, the Thriving
    Nonprofits course, marketing basics, campaigns and storytelling), and a wider Keela blurb;
  - every list item with content as a training (video, document or reading) in the right avenue, duplicates across
    the lists merged, items the Academy already has linked to the existing training instead;
  - items the lists mark To Create (or whose only content was a link that did not survive the export) as planned
    trainings: only leaders see them, inside their avenue, with Add the content;
  - the Leading a team lesson, written from the two meeting-guidance canvases;
  - completions: everyone on the roster the lists name under "Members Trained" is marked done (no date: the lists
    never recorded one).
Items replaced by the Hub (Slack task lists, task requests, the org structure) and empty rows are left out.

  python3 build/data/wa141_academy.py <items.json> <out.sql>
"""
import json, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
items = json.load(open(SRC, encoding='utf8'))

PEOPLE = {'U02308AHH9N': 'Steel', 'U057BRKP1R9': 'Ian', 'U0431PFJKPC': 'Michael', 'U062S6ETBUG': 'Simran', 'U072R31C4PJ': 'Haleema',
          'U09QVV1B2NT': 'Valex', 'U0AFZ65EUGZ': 'Shima'}
LIST_KEY = {'General Trainings': 'general', 'Outreach Trainings': 'outreach', 'Copy of Outreach Department Trainings': 'outreach2',
            'Operations Department Trainings': 'operations', 'Marketing Department Trainings': 'marketing'}

AVENUES = {
    'tools': dict(name='Your tools and accounts', title='Tools and accounts', blurb='Slack, your Google account, OpenPhone, DocuSign and the website: set up once, used every week.',
                  dept=None, cert_title='Tools Ready', color='#3A6EA5', icon='grid', sort=25),
    'leading': dict(name='Leading a team', title='Leading a team', blurb='Meetings people want to come to, work that keeps moving between them, and bringing new people in.',
                    dept=None, cert_title='Team Lead', color='#6F64AB', icon='flag', sort=35),
    'mktbasics': dict(name='Marketing basics', title='Marketing basics', blurb='Canva, photos, posting and the marketing drive: what every marketing member uses.',
                      dept='marketing', cert_title='Marketing Basics', color='#8A5CA8', icon='edit', sort=42),
    'campaigns': dict(name='Campaigns and storytelling', title='Campaigns and storytelling', blurb='Impact Navigator modules on campaign strategy, messaging, storytelling and email, and building a community.',
                      dept='marketing', cert_title='Campaign Ready', color='#6F64AB', icon='mic', sort=44),
    'people': dict(name='People and HR', title='People and HR', blurb='Setting up new people, interviews, job posts and policies, and handing over well when someone leaves.',
                   dept='hr', cert_title='People Ready', color='#B3402F', icon='people', sort=55),
    'fundraising': dict(name='Fundraising and grants', title='Fundraising and grants', blurb='Grant writing, sponsorships, meetings with partners and the events that raise money.',
                        dept='fundraising', cert_title='Fundraising Ready', color='#C87A2F', icon='handshake', sort=62),
    'clubs': dict(name='Student clubs and tabling', title='Student clubs and tabling', blurb='Working with our campus clubs at Vanier and Concordia: tabling, budgets and club approvals.',
                  dept='fundraising', cert_title='Campus Ready', color='#2A8C7A', icon='home', sort=64),
    'thriving': dict(name='Thriving Nonprofits course', title='Thriving Nonprofits', blurb='The eight-module course on nonprofit money: culture of money, fee for service, social enterprise, assets, partnerships and leverage. Log in through Important info.',
                     dept='fundraising', cert_title='Thriving Nonprofits', color='#B9851B', icon='scale', sort=66),
}
EXISTING = {'keela': 'Keela donor CRM', 'ops': 'Operations Basics', 'governance': 'Charity governance', 'foundations': 'Welfare Avenue foundations'}
CATEGORY = {'tools': 'Tools', 'leading': 'Leadership', 'mktbasics': 'Marketing', 'campaigns': 'Marketing', 'people': 'People and HR', 'fundraising': 'Fundraising',
            'clubs': 'Fundraising', 'thriving': 'Fundraising', 'keela': 'Keela (donor CRM)', 'ops': 'Operations', 'governance': 'Charity governance & accounting'}

def avenue_name(k):
    return AVENUES[k]['name'] if k in AVENUES else EXISTING[k]

# ---- decisions, by row in items.json ----
# new: (avenue, kind, title, extra)   merge: into another row   existing: training id (and the avenue it moves to)
# plan: (avenue, title, note)         skip: reason
D = {
  0: ('new', 'tools', 'video', 'Organising your Slack', {'done': 'your Slack sidebar is sorted into sections the way the video shows.'}),
  1: ('new', 'people', 'video', 'Slack analytics: which team is least engaged', {'done': 'you can name the least engaged team this month and why.'}),
  2: ('plan', 'tools', 'Getting the most from OpenPhone inboxes', 'Naming your inbox, filtering unread, tagging teammates, marking conversations done, email notifications.'),
  3: ('existing', 21, 'tools'),
  4: ('plan', 'people', 'Policy enforcement: how we track and act on policy', 'The Slack list had this as a video (18 people trained) but its link did not come across. Paste the video link to publish it.'),
  5: ('new', 'people', 'video', 'Adding a new person in Google Admin', {}),
  6: ('new', 'governance', 'doc', 'Our charity acceptance letter from the CRA', {'url': 'drive:1Pah1AinzkVEqPRhPUuoa7zVz8YCGwl3H', 'minutes': 10,
      'desc': 'The Canada Revenue Agency’s letter confirming Welfare Avenue’s registration as a charity, effective 18 October 2023, with our business number and the obligations that come with it: devoting our resources to charitable activities, keeping records of gifts and receipts, and filing the T3010 return every year.\n\nRead it once so you know what registration commits us to. The Charity governance avenue has the videos on keeping our registration and on receipting.'}),
  7: ('merge', 31),
  8: ('skip', 'replaced by the Hub: tasks live in the Hub, not in Slack'),
  9: ('skip', 'replaced by the Hub: tasks live in the Hub, not in Slack'),
  10: ('new', 'tools', 'video', 'Adding yourself to Meet the Team on the website', {}),
  11: ('plan', 'tools', 'Adding photos to the website gallery', 'Ian was going to record this one.'),
  12: ('new', 'people', 'video', 'When someone leaves: removing them in Google Admin and handing over their files', {'append': 'Before you delete the account, transfer their Drive files and calendar to the person taking over their role (the successor), so nothing they made is lost.'}),
  13: ('new', 'tools', 'video', 'Searching Slack like a pro', {}),
  14: ('new', 'people', 'video', 'Adding someone to the website’s admin dashboard', {}),
  15: ('new', 'tools', 'video', 'Sending documents for signature with DocuSign', {}),
  16: ('plan', 'people', 'Job descriptions quiz', 'A short quiz on our roles and who does what.'),
  17: ('new', 'tools', 'video', 'Finding a meeting time with When2Meet', {}),
  18: ('merge', 15),
  19: ('new', 'leading', 'video', 'How we run the operations meetings', {'sort': 20}),
  20: ('new', 'tools', 'video', 'Adding your email signature in Gmail', {'done': 'you have sent your manager a test email that shows your new signature.'}),
  21: ('existing', 7, None),
  22: ('existing', 6, None),
  23: ('existing', 2, 'people'),
  24: ('new', 'tools', 'video', 'Setting up your OpenPhone voicemail', {}),
  25: ('new', 'tools', 'video', 'Slack huddles', {}),
  26: ('new', 'people', 'video', 'Making an onboarding channel for a new person', {}),
  27: ('new', 'people', 'read', 'Setting up a new person: accounts, channels, website and drives', {'minutes': 20}),
  28: ('skip', 'replaced by the Hub: Requests'),
  29: ('skip', 'already in the Academy: Our eight charitable activities (Welfare Avenue foundations)'),
  30: ('skip', 'replaced by the Hub: the org chart (and its link pointed to the HR plan)'),
  31: ('existing', 8, None, 'Extra, if you want to go further:\n- [CRA: sample official donation receipts](https://www.canada.ca/en/revenue-agency/services/charities-giving/charities/sample-official-donation-receipts.html)\n- [A video walkthrough of receipting](https://www.youtube.com/watch?v=R5curWncFnQ)\n- [The Canadian charitable receipt expert (a custom GPT)](https://chatgpt.com/g/g-673812032f98819185891d4a9cdfe417-canadian-charitable-receipt-expert)'),
  32: ('new', 'people', 'video', 'The first call with a candidate', {}),
  33: ('merge', 99),
  34: ('new', 'tools', 'video', 'Setting up a Google Meet', {}),
  35: ('new', 'people', 'read', 'Adding a new person to Meet the Team on the website', {'minutes': 5}),
  36: ('skip', 'empty in the list'),
  37: ('plan', 'people', 'Conducting interviews', 'Review the job description and the application, prepare the questions, and tips for the interview itself.'),
  38: ('plan', 'tools', 'Quick texts in OpenPhone', 'Creating and using saved replies in OpenPhone.'),
  39: ('plan', 'tools', 'A walk through our Google Drive', 'Where things live across the shared drives.'),
  40: ('plan', 'governance', 'The board of directors: what it is and what it does', 'The list linked the receipting video by mistake: the board video still needs recording or linking.'),
  41: ('plan', 'governance', 'The difference between a nonprofit and a charity', 'The Slack list had a video for this (5 people trained) but the link did not come across. Paste it to publish it.'),
  42: ('skip', 'empty in the list (Zapier)'),
  43: ('skip', 'replaced by the Hub: lists and tasks live in the Hub'),
  44: ('skip', 'empty in the list'),
  45: ('new', 'tools', 'video', 'Group emails: sending as a team address', {}),
  46: ('plan', 'governance', 'Reviewing QuickBooks transactions', ''),
  47: ('plan', 'governance', 'Downloading bank statements', ''),
  48: ('new', 'governance', 'doc', 'Our articles of incorporation', {'minutes': 30}),
  49: ('plan', 'governance', 'Member reimbursements', 'How a member gets paid back for something they bought for Welfare Avenue.'),
  50: ('merge', 12),
  51: ('new', 'keela', 'read', 'Email marketing in Keela', {'minutes': 60}),
  52: ('plan', 'fundraising', 'The 4P formula', ''),
  53: ('new', 'keela', 'read', 'Keela: introduction and basics', {'minutes': 20, 'lead': 'Start here: Keela is our donor and volunteer CRM. Go through the three parts of Keela’s own help centre: the introduction, a quick browse of its tools, and the trainings for the work your role involves.'}),
  54: ('skip', 'empty row'),
  55: ('new', 'thriving', 'read', 'Module 1: the culture of money', {}),
  56: ('new', 'thriving', 'read', 'Module 2: an entrepreneurial approach', {}),
  57: ('new', 'thriving', 'read', 'Module 3: fee for service', {}),
  58: ('new', 'thriving', 'read', 'Module 4: social enterprise', {}),
  59: ('new', 'thriving', 'read', 'Module 5: assets', {}),
  60: ('new', 'thriving', 'read', 'Module 6: partnerships', {}),
  61: ('new', 'thriving', 'read', 'Module 7: leverage', {}),
  62: ('new', 'thriving', 'read', 'Module 8: taking the learning forward', {}),
  63: ('merge', 155),
  64: ('new', 'fundraising', 'video', 'The partner relations database: how to use it', {}),
  65: ('plan', 'keela', 'Keela and QuickBooks', 'How Keela donations flow into QuickBooks.'),
  66: ('new', 'fundraising', 'doc', 'Monthly giving: the podcast', {}),
  67: ('plan', 'fundraising', 'A pitch deck for major donors', 'The Slack list pointed to a template whose link did not come across.'),
  68: ('new', 'fundraising', 'doc', 'Before you write a grant: the Grant Ready program', {}),
  69: ('plan', 'keela', 'Selling tickets with Keela', ''),
  70: ('plan', 'fundraising', 'Planning an event with Donorbox', ''),
  71: ('plan', 'keela', 'Keela and Mailchimp', ''),
  72: ('existing', 18, None),
  73: ('plan', 'keela', 'Double the Donation in Keela', 'Matching gifts from donors’ employers.'),
  74: ('new', 'fundraising', 'doc', 'All you need to start writing grants', {}),
  75: ('new', 'fundraising', 'read', 'Meetings with external partners (our SOP)', {'minutes': 30}),
  76: ('new', 'thriving', 'read', 'Introduction to the course', {'sort': 1}),
  77: ('new', 'keela', 'read', 'The monthly newsletter in Keela', {}),
  78: ('existing', 13, None, None),
  79: ('new', 'keela', 'video', 'Keela workflows and email automations', {'minutes': 90}),
  80: ('new', 'fundraising', 'doc', 'Putting a fundraising event on the website', {}),
  81: ('plan', 'clubs', 'Writing a club constitution (Vanier, CSU)', 'The Vanier and Concordia (CSU) versions.'),
  82: ('plan', 'clubs', 'Budget requests for the Concordia club', ''),
  83: ('plan', 'clubs', 'Tabling requests at Vanier', ''),
  84: ('merge', 53),
  85: ('new', 'fundraising', 'doc', 'Sponsorship guidance', {'note': 'marked Needs update in the Slack list'}),
  86: ('new', 'fundraising', 'doc', 'The sponsor contract', {'note': 'marked Needs update in the Slack list'}),
  87: ('plan', 'clubs', 'Budget requests for the Vanier club', ''),
  88: ('plan', 'fundraising', 'Selling event tickets (Eventbrite and others)', ''),
  89: ('existing', 19, None),
  90: ('new', 'keela', 'video', 'Making the newsletter header in Canva', {}),
  91: ('existing', 16, None),
  92: ('plan', 'keela', 'Keela and Zapier', 'The Slack list had this ready to train but its link did not come across.'),
  93: ('plan', 'keela', 'Keela reports', 'The Slack list had this ready to train but its link did not come across.'),
  94: ('skip', 'already in the Academy: SOP: Gift Basket Drive'),
  95: ('plan', 'clubs', 'The CSU’s yearly club approval', ''),
  96: ('skip', 'already in the Academy: SOP: Corporate volunteering days'),
  97: ('skip', 'already in the Academy: SOP: Gift Basket Drive'),
  98: ('plan', 'fundraising', 'Our general rules for grant writing', ''),
  99: ('new', 'clubs', 'read', 'Running a tabling event', {'minutes': 15}),
  100: ('merge', 81),
  101: ('new', 'clubs', 'video', 'Tabling requests at Concordia', {}),
  102: ('existing', 17, None),
  103: ('merge', 51), 104: ('skip', 'already in the Academy: SOP: Corporate volunteering days'), 105: ('merge', 81), 106: ('skip', 'empty in the list'),
  107: ('merge', 88), 108: ('merge', 86), 109: ('merge', 140), 110: ('merge', 85), 111: ('merge', 133), 112: ('merge', 87), 113: ('merge', 138),
  114: ('merge', 77), 115: ('merge', 83), 116: ('plan', 'ops', 'Finding volunteers', 'Where we recruit cooks, drivers and servers.'), 117: ('merge', 82),
  118: ('merge', 139), 119: ('merge', 143), 120: ('merge', 53), 121: ('skip', 'empty in the list'), 122: ('merge', 80), 123: ('merge', 79), 124: ('merge', 126),
  125: ('merge', 80),
  126: ('new', 'ops', 'doc', 'The driver briefing call', {}),
  127: ('plan', 'ops', 'Collab events', ''),
  128: ('plan', 'ops', 'The team leader briefing call', ''),
  129: ('new', 'ops', 'video', 'Writing a volunteer recognition letter', {}),
  130: ('skip', 'empty in the list'),
  131: ('skip', 'already in the Academy: SOP: Fundraisers run by student associations'),
  132: ('skip', 'empty row'),
  133: ('new', 'ops', 'doc', 'Setting up a volunteering event on the website', {}),
  134: ('merge', 86), 135: ('skip', 'empty in the list'), 136: ('merge', 85), 137: ('skip', 'already in the Academy: SOP: Corporate volunteering days'),
  138: ('new', 'ops', 'read', 'Creating a serving itinerary', {'minutes': 45}),
  139: ('new', 'ops', 'doc', 'Coordinating with volunteer cooks', {}),
  140: ('new', 'ops', 'doc', 'Assessing first-time drivers', {}),
  141: ('skip', 'empty row'), 142: ('merge', 88),
  143: ('existing', 5, None),
  144: ('existing', 15, None),
  145: ('merge', 79),
  146: ('new', 'campaigns', 'doc', 'Impact Navigator: campaign strategy', {'minutes': 45}),
  147: ('merge', 168),
  148: ('new', 'mktbasics', 'read', 'Our social media accounts: getting in and posting', {'minutes': 10, 'desc': 'How the marketing team uses our social media accounts (Instagram, Facebook, LinkedIn, TikTok) and the marketing channel in Slack, where tasks and posts are agreed.\n\nAsk your marketing lead for access to each account. Passwords are never written in the Hub or in Slack: they are shared by your lead, one to one.\n\nDone when: you can log in to each account you post on.'}),
  149: ('plan', 'mktbasics', 'Getting more engagement on social media', ''),
  150: ('new', 'campaigns', 'doc', 'Building a community', {}),
  151: ('new', 'mktbasics', 'doc', 'Our photography guide', {}),
  152: ('new', 'mktbasics', 'doc', 'Photo ideas for our events', {}),
  153: ('new', 'mktbasics', 'video', 'Nonprofit photography', {}),
  154: ('new', 'campaigns', 'doc', 'Impact Navigator: campaign messaging', {'minutes': 45}),
  155: ('new', 'campaigns', 'doc', 'Impact Navigator: email marketing', {}),
  156: ('new', 'campaigns', 'doc', 'Impact Navigator: storytelling', {}),
  157: ('new', 'campaigns', 'doc', 'Impact Navigator: launching a campaign', {'minutes': 45}),
  158: ('new', 'mktbasics', 'video', 'Making and uploading Instagram reel covers', {}),
  159: ('merge', 53),
  160: ('plan', 'mktbasics', 'Canva tips and tricks', 'The Slack list had a video for this but its link did not come across.'),
  161: ('plan', 'mktbasics', 'Getting the most from Canva Premium', ''),
  162: ('new', 'mktbasics', 'read', 'Practice posts for Instagram and Facebook', {}),
  163: ('new', 'mktbasics', 'video', 'The LinkedIn dashboard', {}),
  164: ('plan', 'campaigns', 'Google Ad Grant basics', 'How our Google Ad Grant works and the rules that keep it active.'),
  165: ('new', 'keela', 'read', 'Keela forms: the full guide', {'minutes': 45}),
  166: ('merge', 78),
  167: ('merge', 148),
  168: ('new', 'mktbasics', 'read', 'Setting up Canva and your folder', {'minutes': 30}),
  169: ('new', 'mktbasics', 'video', 'Sharing photos in Google Photos', {}),
  170: ('new', 'mktbasics', 'read', 'Finding your way around the marketing drive', {}),
}


THRIVING = {55: ('the culture of money', 'how an organisation thinks and talks about money'), 56: ('an entrepreneurial approach', 'running programmes with an entrepreneur\u2019s habits'),
            57: ('fee for service', 'charging for services without losing the mission'), 58: ('social enterprise', 'businesses that fund the mission'),
            59: ('assets', 'what the organisation owns and how it can earn from it'), 60: ('partnerships', 'partners who bring money as well as help'),
            61: ('leverage', 'getting more from what you already have'), 62: ('taking the learning forward', 'turning the course into a plan')}
for _i, (_t, _about) in THRIVING.items():
    _n = _i - 54
    D[_i] = ('new', 'thriving', 'read', 'Module %d: %s' % (_n, _t), {'desc': 'Module %d of the Thriving Non-Profits course: %s.\n\nLog in to the course with the Thriving Non-Profits login in Important info, open module %d and work through its classes. Bring one idea for Welfare Avenue to your next team meeting.\n\nDone when: you have finished the module\u2019s classes in the course.' % (_n, _about, _n)})
D[19] = ('new', 'leading', 'video', 'How we run the operations meetings', {'sort': 20, 'desc': 'A short walkthrough of how the operations meetings are run: the agenda, going through tasks, and follow-up. The Running a team lesson in this avenue covers the full guidance.'})
D[170] = ('plan', 'mktbasics', 'Finding your way around the marketing drive', 'The Slack list had a video for this but its link did not come across: what is in the Marketing shared drive and how to add your own items.')
D[35] = ('new', 'people', 'read', 'Adding a new person to Meet the Team on the website', {'minutes': 5, 'desc': '1. Make sure the person has a profile on the website first: a normal profile (not an admin account) made with their Welfare Avenue email, with a photo.\n2. Then add them to Meet the Team from the website\u2019s back end. The how-to video is in the Slack General Trainings list.'})

# ---- cleaning Slack text into Academy text ----
def minutes_of(s):
    s = str(s or '').lower().strip()
    if not s: return None
    m = re.match(r'([\d.]+)\s*(h|hr|hrs|hour|hours)\b', s)
    if m: return int(round(float(m.group(1)) * 60))
    m = re.match(r'([\d.]+)', s)
    if not m: return None
    v = float(m.group(1))
    return int(round(v * 60)) if v < 3 and '.' in m.group(1) else int(round(v))

def clean(text):
    t = str(text or '').replace('\r', '')
    t = re.sub(r'\?sid=[0-9a-f-]+', '', t)
    t = re.sub(r'<(https?://[^|>]+)\|([^>]+)>', lambda m: '[' + m.group(2).strip() + '](' + m.group(1) + ')', t)
    t = re.sub(r'<(https?://[^>]+)>', r'\1', t)
    t = re.sub(r'<@([A-Z0-9]+)>', lambda m: PEOPLE.get(m.group(1), 'a team lead'), t)
    t = re.sub(r'<#(C05MUS33M8R|C07NL842YG4)\|?[^>]*>', lambda m: {'C05MUS33M8R': '#general', 'C07NL842YG4': '#training'}[m.group(1)], t)
    t = re.sub(r'<#[A-Z0-9]+\|([^>]*)>', lambda m: ('#' + m.group(1)) if m.group(1) else 'the team channel', t)
    t = t.replace('make an easy password to share with them', 'set a temporary password and tick "Ask for a new password when they sign in", then share it with them one to one')
    t = re.sub(r'(?<![*\w])\*([^*\n]+)\*(?!\*)', r'**\1**', t)
    out = []
    for line in t.split('\n'):
        l = line.rstrip()
        if re.search(r'imgur\.com', l): continue
        if re.search(r'(members trained|add your name|don.t forget to add|once completed\s*:?\)?\s*$)', l, re.I): continue
        if re.search(r'comment .{0,20}done', l, re.I): continue
        l = re.sub(r'^\s*[•◦▪‣-]\s*', '- ', l)
        l = re.sub(r'^\s{2,}[a-z]\.\s+', '- ', l)
        l = re.sub(r'^\s{2,}\d+\.\s+', '- ', l)
        out.append(l)
    # a bullet run gets its own paragraph, so the Academy draws it as a list
    res = []
    for l in out:
        is_b = bool(re.match(r'^(- |\d+[.)] )', l))
        if res and res[-1].strip() and l.strip():
            prev_b = bool(re.match(r'^(- |\d+[.)] )', res[-1]))
            if prev_b != is_b: res.append('')
        res.append(l)
    t = '\n'.join(res)
    t = re.sub(r'\n{3,}', '\n\n', t).strip()
    return t


def polish(desc, url):
    """Bare links become one list at the end; lead-ins left without a link go; task lines become Try it boxes."""
    base_u = re.sub(r'[?#].*$', '', url or '')
    extra_links, out = [], []
    for l in desc.split('\n'):
        st = l.strip()
        if re.fullmatch(r'-?\s*https?://\S+', st):
            u = re.sub(r'\?sid=[0-9a-f-]+', '', st.lstrip('- ').strip())
            if (not base_u or re.sub(r'[?#].*$', '', u) != base_u) and u not in extra_links: extra_links.append(u)
            continue
        if re.fullmatch(r'(&\s*this one|step \d+:?|watch these[^:]*:|here.?s (is )?the document:|see video here.*|watch video here.*|watch this:?|fill out the pdf here:?|review [a-z ]*template:?)', st, re.I):
            continue
        if re.match(r'^(make|develop|complete|bring|explain|send|then send|your mini task|read this and send|review this guide and send)\b', st, re.I) and not st.lower().startswith(('try it', 'done when')):
            l = 'Try it: ' + st[0].lower() + st[1:]
        out.append(l)
    t = re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).strip()
    t = re.sub(r'(^|\n)[^\n]{0,60}:\s*$', '', t).strip()   # a lead-in that ends the text
    if extra_links:
        t = (t + '\n\n' if t else '') + 'More to watch or read:\n\n' + '\n'.join('- ' + u for u in extra_links)
    return re.sub(r'\n{3,}', '\n\n', t).strip()

def links(text):
    return re.findall(r'https?://[^\s|>)\]]+', str(text or ''))
def loom_ids(text):
    return re.findall(r'loom\.com/share/([0-9a-f]{32})', str(text or ''))

# ---- resolve merges ----
root = {}
def find_root(i):
    d = D.get(i)
    while d and d[0] == 'merge':
        i = d[1]; d = D.get(i)
    return i
groups = {}
for i in range(len(items)):
    r = find_root(i)
    groups.setdefault(r, []).append(i)

def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
def qj(o):
    return 'null' if o is None else "'" + json.dumps(o, ensure_ascii=False).replace("'", "''") + "'::jsonb"

sql = []
sql.append('-- wave141 (26/09/26): the Slack training lists into the Avenue Academy. Generated by build/data/wa141_academy.py.')
# avenues
for k, a in AVENUES.items():
    sql.append("insert into public.academy_paths (key, name, title, blurb, dept, required, cert_title, color, icon, sort, active, updated_at) values (%s, %s, %s, %s, %s, false, %s, %s, %s, %d, true, now())\n"
               "on conflict (key) do update set name = excluded.name, title = excluded.title, blurb = excluded.blurb, dept = excluded.dept, cert_title = excluded.cert_title, color = excluded.color, icon = excluded.icon, sort = excluded.sort, active = true, updated_at = now();"
               % (q(k), q(a['name']), q(a['title']), q(a['blurb']), q(a['dept']), q(a['cert_title']), q(a['color']), q(a['icon']), a['sort']))
sql.append("update public.academy_paths set blurb = 'Contacts, forms, email marketing and automations, volunteers and Smart Ask in Keela, our donor and volunteer CRM.', updated_at = now() where key = 'keela';")
sql.append("update public.academy_paths set blurb = 'Running volunteers for a serving: drivers, cooks, itineraries, the website and ordering.', updated_at = now() where key = 'ops';")
for c, dept in [('Tools', None), ('Leadership', None), ('People and HR', 'hr'), ('Fundraising', 'fundraising')]:
    sql.append("insert into public.training_categories (name, department) select %s, %s where not exists (select 1 from public.training_categories where name = %s);" % (q(c), q(dept), q(c)))

report = {'new': [], 'existing': [], 'plan': [], 'skip': [], 'merged': 0}
completions = []   # (key or id, emails)
sort_in = {}
for r, members in sorted(groups.items()):
    d = D.get(r)
    if d is None:
        raise SystemExit('no decision for row %d: %s' % (r, items[r].get('name')))
    emails = sorted({e.strip().lower() for i in members for e in (items[i].get('trained_emails') or []) if e and '@' in e})
    report['merged'] += len(members) - 1
    base = items[r]
    all_desc = [items[i].get('description') or '' for i in members]
    if d[0] == 'skip':
        report['skip'].append((base.get('name'), d[1])); continue
    if d[0] == 'existing':
        tid = d[1]; move = d[2] if len(d) > 2 else None; extra = d[3] if len(d) > 3 else None
        sets = []
        if move: sets.append('path_group = %s' % q(avenue_name(move))); sets.append('category = %s' % q(CATEGORY[move]))
        if extra: sets.append("description = case when coalesce(description, '') like %s then description else trim(both E'\\n' from coalesce(description, '') || E'\\n\\n' || %s) end" % (q('%' + extra[:40].replace('%', '') + '%'), q(extra)))
        if tid == 13:
            extra13 = clean(items[78].get('description')) + '\n\n' + clean(items[166].get('description'))
            extra13 = extra13.replace('Watch this link (WA Focused)', 'The video above is the Welfare Avenue walkthrough.').replace('Keela Training - Watch here for a structured training (not WA focused)', '')
            extra13 = re.sub(r'\n{3,}', '\n\n', extra13).strip()
            sets.append("description = case when coalesce(description, '') like '%%Task to do after%%' then description else trim(both E'\\n' from coalesce(description, '') || E'\\n\\n' || %s) end" % q(extra13))
        if sets: sql.append('update public.trainings set %s, updated_at = now() where id = %d;' % (', '.join(sets), tid))
        report['existing'].append((base.get('name'), tid))
        completions.append(('id', tid, emails))
        continue
    lk = LIST_KEY.get(base.get('list'), 'list')
    key = 'slack:%s:%d' % (lk, base.get('row', r))
    if d[0] == 'plan':
        av, title, note = d[1], d[2], d[3]
        desc = clean(base.get('description'))
        if len(desc) < 40: desc = note or ''
        body = {'planned': True, 'from': 'Slack training list: ' + base.get('list', ''), 'note': note or 'Listed as To Create in the Slack training list.'}
        sql.append("insert into public.trainings (key, title, kind, category, path_group, description, source, sort, active, body, updated_at) values (%s, %s, 'read', %s, %s, %s, 'slack', 800, true, %s, now())\n"
                   "on conflict (key) where key is not null do update set title = excluded.title, category = excluded.category, path_group = excluded.path_group, description = excluded.description, body = excluded.body, updated_at = now();"
                   % (q(key), q(title), q(CATEGORY[av]), q(avenue_name(av)), q(desc or None), qj(body)))
        report['plan'].append((title, av))
        continue
    # new
    av, kind, title, extra = d[1], d[2], d[3], d[4]
    texts = [clean(x) for x in all_desc if x and x.strip()]
    desc = extra.get('desc')
    if desc is None:
        seen, parts = set(), []
        for tx in texts:
            if tx and tx not in seen: seen.add(tx); parts.append(tx)
        desc = '\n\n'.join(parts)
        if extra.get('lead'): desc = extra['lead'] + ('\n\n' + desc if desc else '')
        if extra.get('append'): desc = (desc + '\n\n' if desc else '') + extra['append']
        if extra.get('done'): desc = (desc + '\n\n' if desc else '') + 'Done when: ' + extra['done']
    url = extra.get('url')
    all_links = [u for x in all_desc for u in links(x) if 'imgur' not in u]
    if url and url.startswith('drive:'):
        url = 'https://drive.google.com/file/d/' + url[6:] + '/view'
    if not url:
        if kind == 'video':
            vids = [u for u in all_links if re.search(r'loom\.com/share|youtu', u)]
            url = re.sub(r'\?sid=[0-9a-f-]+', '', vids[0]) if vids else None
        elif kind == 'doc':
            docs = [u for u in all_links if re.search(r'docs\.google|drive\.google|canva\.com|forms\.gle|welfareavenue\.com|podcast|spotify|apple\.co', u)]
            url = docs[0] if docs else (all_links[0] if all_links else None)
    if kind in ('video', 'doc') and not url:
        kind = 'read'
    if url and desc and extra.get('desc') is None:
        base_u = re.sub(r'[?#].*$', '', url)
        lines, keep_l = desc.split('\n'), []
        for li, l in enumerate(lines):
            if base_u and base_u in l:
                rest = re.sub(r'https?://\S+', '', l).strip()
                if not rest or re.match(r'^(step \d+:|watch|see|link to watch|read|listen|refer to document|fill out|review|here|use this)[^.]{0,60}:?\s*$', rest, re.I):
                    if keep_l and re.match(r'^(watch|see|read|listen|link|fill out|review|here)[^.]{0,60}:\s*$', keep_l[-1].strip(), re.I): keep_l.pop()
                    continue
                l = l.replace(url, '').replace(base_u, '').rstrip(' :-')
            if re.match(r'^(follow this link|watch video here|watch here|watch this|watch this video|read this|listen)\s*:?\s*$', l.strip(), re.I):
                continue
            keep_l.append(l)
        desc = re.sub(r'\n{3,}', '\n\n', '\n'.join(keep_l)).strip()
    if desc and extra.get('desc') is None:
        desc = polish(desc, url)
    ext = (loom_ids(url or '') or [None])[0]
    mins = extra.get('minutes') or next((minutes_of(items[i].get('time')) for i in members if minutes_of(items[i].get('time'))), None)
    note = extra.get('note')
    body = {'from': 'Slack training list: ' + base.get('list', ''), 'rows': [items[i].get('row', i) for i in members]}
    if note: body['note'] = note
    sort_in.setdefault(av, [])
    srt = extra.get('sort') or (100 + len(sort_in[av]) * 10); sort_in[av].append(key)
    sql.append("insert into public.trainings (key, title, kind, category, path_group, description, resource_url, ext_id, minutes, source, sort, active, body, updated_at) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %d, true, %s, now())\n"
               "on conflict (key) where key is not null do update set title = excluded.title, kind = excluded.kind, category = excluded.category, path_group = excluded.path_group, description = excluded.description, resource_url = excluded.resource_url, ext_id = excluded.ext_id, minutes = excluded.minutes, body = excluded.body, updated_at = now();"
               % (q(key), q(title), q(kind), q(CATEGORY[av]), q(avenue_name(av)), q(desc or None), q(url), q(ext), 'null' if not mins else str(int(mins)), q('loom' if ext else 'slack'), srt, qj(body)))
    report['new'].append((title, av, kind))
    report.setdefault('rows', []).append({'title': title, 'kind': kind, 'url': url, 'min': mins, 'desc': desc})
    completions.append(('key', key, emails))

# ---- the Leading a team lesson (from the two meeting-guidance canvases) ----
LESSON = {
  'v': 1,
  'cover': 'purple',
  'summary': 'How Welfare Avenue leads run a team: meetings people want to come to, work that keeps moving between them, and new people brought in properly. Written from the leads’ own guidance in Slack.',
  'chapters': [
    {'id': 'before', 't': 'Before the meeting', 'blocks': [
      {'type': 'lead', 'text': 'A good meeting is mostly made before it starts. Give yourself an hour to prepare, ideally the morning of the meeting.'},
      {'type': 'cards', 'items': [
        {'t': 'Confirm attendance', 'd': 'Message the team 24 hours before to confirm who is coming.', 'icon': 'chat'},
        {'t': 'Fix the time early', 'd': 'If attendance drops or the time stops working, run a When2Meet. Plan one ahead of exams, new members and the September, January and May schedule changes.', 'icon': 'clock'},
        {'t': 'Build the agenda from the work', 'd': 'Open your team’s tasks in the Hub before you write the agenda. Ask members to add their own agenda items: it saves you time and they own them.', 'icon': 'list'},
        {'t': 'Check the workload', 'd': 'Someone with under four hours of work a week needs something that fits their role, or a teammate to help.', 'icon': 'people'}]},
      {'type': 'quote', 'text': 'Prep at least 1 hour before meeting, ideally the morning of the day of the meeting.', 'by': 'Running WA Meetings: Tips & Guidelines'}]},
    {'id': 'during', 't': 'In the meeting', 'blocks': [
      {'type': 'lead', 'text': 'People stay engaged when they have a part to play.'},
      {'type': 'cards', 'items': [
        {'t': 'Open with an icebreaker', 'd': 'A quick peak and pit of the week, especially with a new team or a short meeting.', 'icon': 'spark'},
        {'t': 'Name a note-taker', 'd': 'Every meeting has someone writing the notes and the tasks. It is not optional.', 'icon': 'edit'},
        {'t': 'Members present their work', 'd': 'Each person shows what they did. Ask for opinions on what you pitch.', 'icon': 'mic'},
        {'t': 'Leave with tasks', 'd': 'Set the tasks in the meeting, with owners, and follow up on them at the next one. Upload the transcript and the Hub creates them for you.', 'icon': 'check'}]}]},
    {'id': 'between', 't': 'Between meetings', 'blocks': [
      {'type': 'lead', 'text': 'Work keeps moving when the conversation does.'},
      {'type': 'cards', 'items': [
        {'t': 'Check in on tasks', 'd': 'If you see no progress or check-ins during the week, ask. An @mention in the Hub sends the person a Slack message.', 'icon': 'bolt'},
        {'t': 'Keep leaders in the loop', 'd': 'Talk in the open team channels so the leaders above you can support and back you up.', 'icon': 'people'},
        {'t': 'Late or absent?', 'd': 'People tell you 24 hours ahead (one hour in an emergency). Talk to anyone who does not.', 'icon': 'clock'},
        {'t': 'Plan around busy weeks', 'd': 'When you know people will be busy, delegate early.', 'icon': 'target'}]},
      {'type': 'quote', 'text': 'Dont be too lenient it’ll backfire in long run', 'by': 'Team Meetings & Leadership Guidance'}]},
    {'id': 'people', 't': 'New people and growing your team', 'blocks': [
      {'type': 'lead', 'text': 'New members decide in their first weeks whether they stay.'},
      {'type': 'cards', 'items': [
        {'t': 'Touch base every meeting', 'd': 'Check in with each new person and let them go faster than week by week if they want to.', 'icon': 'user'},
        {'t': 'Stay after the call', 'd': 'Keep a new person back for a few minutes to connect and train them where needed.', 'icon': 'chat'},
        {'t': 'Assign trainings', 'd': 'Give a new team as many Academy trainings as fit, during quiet weeks, and make new ones when something is missing.', 'icon': 'book'},
        {'t': 'Set them up properly', 'd': 'Make sure everyone is signed in to Slack with notifications on and to their Welfare Avenue Google account, and invite them to other teams’ meetings to see how they work.', 'icon': 'home'}]},
      {'type': 'callout', 'tone': 'info', 't': 'Done when', 'text': 'you have run a meeting with a confirmed time, an agenda built from the team’s tasks, a named note-taker, and tasks set with owners.'}]},
  ],
  'quiz': {'pass': 0.75, 'questions': [
    {'q': 'When should you confirm who is coming to your team meeting?', 'a': ['The morning of the meeting', '24 hours before', 'At the start of the meeting'], 'c': 1, 'why': 'A message 24 hours ahead gives you time to fix the time or the agenda.'},
    {'q': 'Someone on your team has under four hours of work a week. What do you do?', 'a': ['Leave it: they are a volunteer', 'Find something that fits their role, or pair them with a teammate', 'Remove them from the team'], 'c': 1, 'why': 'Under-used people drift away; the right piece of work keeps them in.'},
    {'q': 'Who takes the notes and writes the tasks?', 'a': ['Whoever remembers', 'Someone named at every meeting', 'Nobody: the leader remembers'], 'c': 1, 'why': 'Naming a note-taker every time is the one non-negotiable in our guidance.'},
    {'q': 'A new member joined two weeks ago. What helps most?', 'a': ['Waiting for them to ask', 'Checking in every meeting and staying after the call to train them', 'Giving them the hardest task'], 'c': 1, 'why': 'Early attention and training is what keeps new people.'}]},
}
sql.append("insert into public.trainings (key, title, kind, category, path_group, description, source, sort, minutes, xp, active, body, updated_at) values ('lesson:leading-a-team', 'Running a team: meetings, follow-up and new people', 'lesson', 'Leadership', %s, %s, 'hub', 10, 12, 60, true, %s, now())\n"
           "on conflict (key) where key is not null do update set title = excluded.title, path_group = excluded.path_group, description = excluded.description, body = excluded.body, minutes = excluded.minutes, updated_at = now();"
           % (q(AVENUES['leading']['name']), q(LESSON['summary']), qj(LESSON)))

# ---- completions: people still on the roster, matched by email ----
for kind_, ref, emails in completions:
    if not emails: continue
    tid = ('(select id from public.trainings where key = %s)' % q(ref)) if kind_ == 'key' else str(ref)
    sql.append("insert into public.training_progress (training_id, person_name, email, status, note, updated_at)\n"
               "select %s, m.name, lower(m.email), 'done', 'Trained before the Hub: marked in the Slack training list', now() from public.team_members m\n"
               " where m.active is not false and lower(m.email) = any (array[%s]) and %s is not null\n"
               "on conflict (training_id, person_name) do nothing;" % (tid, ','.join(q(e) for e in emails), tid))

sql.append("insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('academy', 'wave141', 'import', null, %s, 'wave141');"
           % q('%d new trainings, %d linked to existing ones, %d planned, %d left out, %d duplicates merged, 1 lesson (Leading a team), from the Slack training lists' % (len(report['new']), len(report['existing']), len(report['plan']), len(report['skip']), report['merged'])))
open(OUT, 'w', encoding='utf8').write('\n\n'.join(sql) + '\n')
json.dump(report, open(OUT[:-4] + '.report.json', 'w'), ensure_ascii=False, indent=1)
print('new', len(report['new']), 'existing', len(report['existing']), 'plan', len(report['plan']), 'skip', len(report['skip']), 'merged', report['merged'], 'completion groups', sum(1 for c in completions if c[2]))
