#!/usr/bin/env python3
"""wave193 (02/10/26): build the Fundraising app's seed rows from the research pass and post them to the stage table.

Inputs (the research folder, not in the repo): drive_grants.json (119 rows read out of the Drive trackers and applications),
sources_grants.json (44 rows from the meeting transcripts and Steel's mailbox), funders_watchlist.json (70 funders researched on
02/10/26) and screened_out.json (18 funders that are not for us), plus the texts of the past applications (ocr/*.ocr.txt).
Output: rows in public.wa_stage_193seed (k, v) over PostgREST with the anon key; wa193_seed_apply.sql moves them into fund_*.
Usage: python3 wa193_seed.py <research_dir> /tmp/anon.key [--dry]
"""
import json, os, re, sys, unicodedata, urllib.request, datetime

R = sys.argv[1]
KEY = open(sys.argv[2]).read().strip() if len(sys.argv) > 2 else None
DRY = '--dry' in sys.argv
BASE = 'https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/'

def load(n):
    with open(os.path.join(R, n), encoding='utf8') as f: return json.load(f)
W = load('funders_watchlist.json'); SO = load('screened_out.json'); D = load('drive_grants.json'); S = load('sources_grants.json')

# ---------- names ----------
def fold(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', s).strip()
STOP = {'the', 'of', 'du', 'de', 'la', 'le', 'les', 'des', 'canada', 'canadian', 'canadien', 'canadienne', 'foundation', 'fondation', 'inc', 'inc.', 'group', 'financial', 'corporation', 'company', 'limited', 'ltd', 'and', 'et', 'pour', 'for', 'a', 'to', 'via'}
def norm(s):
    s = fold(s).lower()
    s = re.sub(r'\(.*?\)', ' ', s)
    s = re.sub(r'[^a-z0-9 ]+', ' ', s)
    return ' '.join(w for w in s.split() if w not in STOP)

# the canonical name of each funder we know under several names (the key is any spelling, folded and lowered)
CANON = {}
def canon(name, *others):
    for n in (name,) + others: CANON[norm(n)] = name
canon('Employment and Social Development Canada (ESDC)', 'ESDC', 'Government of Canada (ESDC via national funders)', 'Employment and Social Development Canada')
canon('The Refugee Centre (Canada Service Corps micro-grants)', 'ESDC / The Refugee Centre (Canada Service Corps delivery partner)', 'The Refugee Centre')
canon('Glocal Foundation of Canada', 'GLOCAL Foundation of Canada (Canada Service Corps delivery partner)', 'Glocal Foundation', 'GLOCAL Foundation')
canon('Canadian Centre for Community Advancement (3CA)', 'Canadian Center for Community Advancement (3CA)', '3CA')
canon('Agriculture and Agri-Food Canada (AAFC)', 'Agriculture and Agri-Food Canada', 'AAFC')
canon('Centraide of Greater Montreal', 'Centraide du Grand Montreal', 'Centraide du Grand Montréal', 'Centraide (for the Quebec government, SACAIS)', 'Centraide', 'United Way Centraide Canada')
canon('Foundation of Greater Montreal (FGM)', 'Fondation du Grand Montreal (FGM)', 'Foundation of Greater Montréal (FGM / Fondation du Grand Montréal)', 'FGM', 'Fondation du Grand Montréal')
canon('Fondation Lucie et André Chagnon', 'Fondation Lucie et Andre Chagnon')
canon('Ville de Montréal', 'Ville de Montreal', 'Ville de Montreal (boroughs)', 'Ville de Montreal (boroughs) / Fonds quebecois d\'initiatives sociales (FQIS)', 'Ville de Montreal - Arrondissement de Ville-Marie', 'City of Montreal')
canon('Fondation J.A. DeSève', 'Fondation J.A. DeSeve')
canon('Fondation Béati', 'Fondation Beati')
canon('ECHO Foundation', 'ECHO Foundation (Fondation Echo)')
canon('Moisson Montréal', 'Moisson Montreal')
canon('Ontario Trillium Foundation (OTF)', 'Ontario Trillium Foundation', 'OTF')
canon('Maytree Foundation', 'Maytree')
canon('MAZON Canada', 'Mazon Canada')
canon('TD Bank Group', 'TD Bank Group (TD Ready Commitment)', 'TD')
canon('RBC Foundation', 'Royal Bank of Canada (RBC)', 'RBC')
canon('BMO Financial Group', 'BMO')
canon('CIBC Foundation', 'CIBC')
canon('The Home Depot Canada Foundation', 'Home Depot Canada Foundation', 'Home Depot')
canon('Sobeys Inc.', 'Sobeys', 'Safeway (Sobeys)')
canon('Costco Wholesale Canada', 'Costco Wholesale', 'Costco')
canon('Google (Google for Nonprofits)', 'Google', 'Google for Nonprofits')
canon('Microsoft (Tech for Social Impact)', 'Microsoft')
canon('SilverChef Canada / EconoLease', 'SilverChef')
canon('Desjardins', 'Desjardins caisses', 'Desjardins (Cooperathon)')
canon('Peter Gilgan Foundation')
canon('Zeller Family Foundation')
canon('Perdue Farms', 'Perdue')
canon('L\'Oréal Canada', 'L\'Oréal', 'L\'Oreal Canada')
canon('Foundation for Black Communities (FFBC)', 'Foundation for Black Communities')
canon('IMPACT Funding Solutions', 'Impact Funding Solutions')
canon('Concordia University (SHIFT Centre for Social Transformation)', 'Concordia University — SHIFT Centre for Social Transformation', 'Concordia University - SHIFT Centre for Social Transformation')
canon('Concordia University Sustainability Action Fund (SAF)', 'Concordia University Sustainability Action Fund', 'Concordia University students')
canon('TakingITGlobal', 'TakingITGlobal (#RisingYouth)')
canon('Loblaw Companies / President\'s Choice Children\'s Charity', 'President\'s Choice Children\'s Charity', 'Loblaw Companies')
canon('Fondation Choquette-Legault')
canon('TELUS Friendly Future Foundation')
canon('Canada Post Community Foundation')
canon('Air Canada Foundation')
canon('Laidlaw Foundation')
canon('McConnell Foundation')
canon('Catherine Donnelly Foundation')
canon('Canadian Women\'s Foundation')
canon('Walmart Canada')
canon('Scotiabank')
canon('Zensurance')
canon('Helping Hands')
canon('No Small Change')
canon('Right To Food (formerly Community Food Centres Canada)', 'Right To Food', 'Community Food Centres Canada')
def C(name):
    k = norm(name)
    if k in CANON: return CANON[k]
    return fold(name).strip()

# funders that are event sponsors, recipients or directories, not grant makers (the Flag Football prospects, the gift-basket
# partners, the competition prize); they live elsewhere in the Hub (Partners, the events)
EXCLUDE = {norm(x) for x in ['Vanier College Student Association (VCSA)', 'Apathy is Boring (RISE)', 'Salvation Army (Montreal, 6112 Sherbrooke St W)', 'Hotel Zero1', 'Sportira (Sportira Cage Inc.)', 'GHD Group', 'Oberoi Financial Group', 'Ardene', 'Dollarama', 'Mini Biblio Plus', 'Montreal Flag Football League (MFL) / Athlon Combine', 'Rally Paper Montreal', 'Dose Juice', 'Guru Organic Energy', 'Lush Cosmetics', 'Poulet Rouge', 'Montreal Canadiens', 'Flag Football 2026 vendor/product sponsor prospects (aggregate)', 'CanadaHelps', 'GrantWatch', 'My Giving Moment (ChangeNow)', 'Government of Canada', 'Community Foundations of Canada', 'Perdue', 'Fondation Boucher Lambert (as transcribed; unidentified)', 'Unidentified foundations (transcribed \'Mason Royale\', \'Fondation Boucher Lambert\')']}
def excluded(name):
    n = norm(name)
    if n in EXCLUDE: return True
    if 'unidentified foundations' in fold(name).lower() or 'boucher lambert' in fold(name).lower(): return True
    return False

# Vanier stays as a funder of its own kind (student_fund): WA's founding funder
STUDENT_FUNDER = 'Vanier College Student Association (VCSA)'

KINDS = {'government_federal', 'government_provincial', 'municipal', 'foundation', 'community_foundation', 'corporate', 'student_fund', 'in_kind', 'network', 'other'}
REGIONS = {'canada', 'quebec', 'montreal', 'ontario', 'toronto', 'international', 'other'}
def kind_of(k, name=''):
    k = (k or '').strip()
    if k in KINDS: return k
    return 'other'
def region_of(r, name='', notes=''):
    r = (r or '').strip().lower()
    if r in REGIONS: return r
    t = (name + ' ' + notes).lower()
    if 'toronto' in t or 'gta' in t: return 'toronto'
    if 'montr' in t: return 'montreal'
    if 'quebec' in t or 'québec' in t: return 'quebec'
    if 'ontario' in t: return 'ontario'
    return 'canada'

MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}
def a_date(s):
    """the first date in a string: ISO, 'Mar 9 2024', '9 Mar 2024', 'March 13, 2026', 'june 15th 2026'"""
    if not s: return None
    s = fold(s)
    m = re.search(r'(20\d\d)-(\d\d)-(\d\d)', s)
    if m: return '%s-%s-%s' % (m.group(1), m.group(2), m.group(3))
    m = re.search(r'\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)', s)
    if m and m.group(1)[:3].lower() in MONTHS: return '%s-%02d-%02d' % (m.group(3), MONTHS[m.group(1)[:3].lower()], int(m.group(2)))
    m = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(20\d\d)', s)
    if m and m.group(2)[:3].lower() in MONTHS: return '%s-%02d-%02d' % (m.group(3), MONTHS[m.group(2)[:3].lower()], int(m.group(1)))
    return None
def num(v):
    if v is None or v == '': return None
    if isinstance(v, (int, float)): return v
    m = re.search(r'(\d[\d,]*(?:\.\d+)?)', str(v).replace(' ', ''))
    return float(m.group(1).replace(',', '')) if m else None
def year_of(s):
    m = re.search(r'(20\d\d)', str(s or '')); return m.group(1) if m else None

# ---------- funders ----------
F = {}   # canonical name -> row
def funder(name, **kw):
    cn = C(name)
    row = F.get(cn)
    if not row:
        row = F[cn] = {'name': cn, 'aliases': [], 'kind': 'other', 'region': 'canada', 'url': None, 'portal': None, 'contact': None, 'eligibility': None, 'funds_what': None, 'cycle': None, 'next_deadline': None, 'amount_min': None, 'amount_max': None, 'fit': 'unknown', 'fit_note': None, 'relationship': None, 'notes': None, 'watch': False, 'screened_out': False, 'screened_reason': None, 'source': None}
    a = fold(name).strip()
    if a and a != cn and a not in row['aliases']: row['aliases'].append(a)
    for k, v in kw.items():
        if v in (None, '', []): continue
        if k == 'fit' and row['fit'] != 'unknown' and v == 'unknown': continue
        if k in ('relationship', 'notes', 'source') and row.get(k):
            if v not in row[k]: row[k] = row[k] + ' | ' + v
        elif k == 'aliases':
            for x in v:
                x = fold(x).strip()
                if x and x != cn and x not in row['aliases']: row['aliases'].append(x)
        elif row.get(k) in (None, '', 'other', 'canada', 'unknown', False) or k in ('watch',):
            row[k] = v
    return row

for x in W:
    r = funder(x['funder'], kind=kind_of(x['kind']), region=region_of(x['region']), url=x.get('url'), portal=x.get('application_format'), eligibility=x.get('eligibility'), funds_what=x.get('funds_what'), cycle=x.get('cycle'), next_deadline=x.get('next_deadline'), amount_min=x.get('amount_min'), amount_max=x.get('amount_max'), fit=x.get('fit') or 'unknown', fit_note=x.get('fit_note'), watch=(x.get('fit') in ('good', 'possible')), source='research 02/10/26')
    # several watchlist rows for one funder (OTF, Ville de Montreal): the best fit wins and the programs are listed in the notes
    order = {'good': 3, 'possible': 2, 'weak': 1, 'unknown': 0}
    if order.get(x.get('fit'), 0) > order.get(r['fit'], 0): r['fit'] = x['fit']; r['fit_note'] = x.get('fit_note'); r['watch'] = x['fit'] in ('good', 'possible')
    r['notes'] = ((r['notes'] + ' | ') if r['notes'] else '') + 'Program: ' + x['program'] if x.get('program') and ('Program: ' + x['program']) not in (r['notes'] or '') else r['notes']
for x in SO:
    r = funder(x['funder'], kind=kind_of(x['kind']), region=region_of(x['region']), url=x.get('url'), eligibility=x.get('eligibility'), funds_what=x.get('funds_what'), cycle=x.get('cycle'), fit='weak', fit_note=x.get('fit_note'), source='research 02/10/26 (screened out)')
    r['screened_out'] = True; r['screened_reason'] = x.get('fit_note'); r['watch'] = False
    r['notes'] = ((r['notes'] + ' | ') if r['notes'] else '') + 'Program: ' + x['program'] if x.get('program') else r['notes']
for x in D:
    if excluded(x['funder']): continue
    kind = kind_of(x['kind'])
    if norm(x['funder']) == norm(STUDENT_FUNDER): kind = 'student_fund'
    r = funder(x['funder'], kind=kind, region=region_of('', x['funder'], x.get('country_region') or ''), url=x.get('url'), contact=x.get('contact_or_portal'), eligibility=x.get('eligibility_notes'), cycle=x.get('deadline_or_cycle'), amount_min=num(x.get('amount_min')), amount_max=num(x.get('amount_max')), source='the team\'s Drive trackers (' + (x.get('source_file') or '')[:120] + ')')
    if x.get('fit_notes') and not r.get('fit_note'): r['fit_note'] = x['fit_notes']
    hist = x['status'] + (' ' + x['year_or_date'] if x.get('year_or_date') else '') + (': ' + x['program'][:80] if x.get('program') else '')
    r['relationship'] = ((r['relationship'] + ' | ') if r['relationship'] else '') + hist
for x in S:
    if excluded(x['funder']): continue
    r = funder(x['funder'], kind=kind_of(x['kind']), region=region_of('', x['funder'], x.get('notes') or ''), amount_min=num(x.get('amount_min')), amount_max=num(x.get('amount_max')), cycle=x.get('deadline_or_cycle'), source='the meeting transcripts and the mailbox')
    hist = x['status'] + (' (last mentioned ' + x['last_mentioned'] + ')' if x.get('last_mentioned') else '') + (': ' + x['program'][:80] if x.get('program') else '')
    r['relationship'] = ((r['relationship'] + ' | ') if r['relationship'] else '') + hist
# the two 2025 applications whose funder nobody named
funder('Funder to identify (2025 applications)', kind='other', region='canada', fit='unknown', notes='Two applications the team discussed on 16 Oct 2025 (a $4,000 youth program, a $5,000 initiative for racialized communities) whose funder the transcripts do not name. Elika (then grant coordinator) prepared them.', source='the meeting transcripts')
# fix a few kinds and regions by hand
FIX = {'Google (Google for Nonprofits)': ('in_kind', 'international'), 'Microsoft (Tech for Social Impact)': ('in_kind', 'international'), 'Canva': ('in_kind', 'international'), 'Benevity': ('in_kind', 'international'), 'Moisson Montréal': ('in_kind', 'montreal'), 'Second Harvest': ('in_kind', 'canada'), 'Right To Food (formerly Community Food Centres Canada)': ('network', 'canada'), 'Vanier College Student Association (VCSA)': ('student_fund', 'montreal'), 'Fondation Choquette-Legault': ('foundation', 'quebec'), 'Zeller Family Foundation': ('foundation', 'montreal'), 'Foundation of Greater Montreal (FGM)': ('community_foundation', 'montreal'), 'Centraide of Greater Montreal': ('foundation', 'montreal'), 'Peter Gilgan Foundation': ('foundation', 'toronto'), 'Maytree Foundation': ('foundation', 'toronto'), 'Ontario Trillium Foundation (OTF)': ('government_provincial', 'ontario'), 'Ville de Montréal': ('municipal', 'montreal'), 'Fondation Lucie et André Chagnon': ('foundation', 'quebec'), 'The Refugee Centre (Canada Service Corps micro-grants)': ('government_federal', 'montreal'), 'Canadian Centre for Community Advancement (3CA)': ('foundation', 'canada'), 'Glocal Foundation of Canada': ('foundation', 'canada'), 'QBE Foundation (via Social Shifters)': ('corporate', 'international'), 'Workforce Funders Collaborative (GTA)': ('foundation', 'toronto'), 'Investissement Québec': ('government_provincial', 'quebec'), 'Chick-fil-A Foundation': ('corporate', 'international'), 'Slaight Family Foundation (via Right To Food)': ('foundation', 'canada'), 'Waltons Trust (via Right To Food)': ('foundation', 'canada'), 'Quebec Community Groups Network (QCGN)': ('network', 'quebec'), 'Emploi-Québec': ('government_provincial', 'quebec'), 'Fierté Montréal': ('other', 'montreal'), 'Conseil des arts de Montréal': ('municipal', 'montreal'), 'Fondation Montréal Inc': ('foundation', 'montreal'), 'Montreal Community Cares Foundation': ('foundation', 'montreal'), 'Mission inclusion': ('foundation', 'quebec'), 'Force Jeunesse': ('other', 'quebec'), 'Youth Fusion': ('foundation', 'montreal'), 'Fondation Jeunes en Tête': ('foundation', 'quebec'), 'Quebecor': ('corporate', 'quebec'), 'Ubisoft Montréal': ('corporate', 'montreal'), 'Charles H. Ivey Foundation': ('foundation', 'ontario'), 'Government of Ontario': ('government_provincial', 'ontario'), 'Toronto Foundation': ('community_foundation', 'toronto'), 'City of Toronto': ('municipal', 'toronto')}
for n, (k, rg) in FIX.items():
    if n in F: F[n]['kind'] = k; F[n]['region'] = rg
# the far-away community foundations the 2026 AI list assumed: not for us
FAR = {'Red Deer & District Community Foundation (RDDCF)': 'Alberta only.', 'Brant Community Foundation': 'Brant County, Ontario only.', 'WindsorEssex Community Foundation': 'Windsor-Essex only.', 'Oakville Community Foundation / Burlington Foundation / Community Foundation of Halton North': 'Halton region only (the 2026 AI-made list assumed Welfare Avenue was in Milton).', 'Charles H. Ivey Foundation': 'Southern Ontario youth-at-risk projects outside Toronto.', 'Canadian Roots Exchange': 'Indigenous youth-led projects only.', 'Emploi-Québec': 'Jeunes Volontaires funds individual young people, not organizations.', 'Fondation Montréal Inc': 'Grants to young entrepreneurs, not charities.', 'Conseil des arts de Montréal': 'Arts organizations only.', 'InMotion Network': 'Women in sport and physical activity.', 'TD Friends of the Environment Foundation': 'Environmental projects only.', 'Chantier de l\'économie sociale (Fiducie)': 'Loans to social economy enterprises, not grants.', 'Workforce Funders Collaborative (GTA)': 'Workforce development organizations with budgets far above ours (about $250K asks).', 'Infrastructure Canada': 'Reaching Home flows through community entities (Montreal: the Table itinérance / Mouvement pour mettre fin à l\'itinérance); apply through them, not directly.', 'Public Health Agency of Canada': 'Large multi-year contributions for established organizations; not a near-term fit.', 'Canadian Heritage': 'Multiculturalism and anti-racism programs: a fit only for a project built for them.'}
for n, why in FAR.items():
    if n in F: F[n]['screened_out'] = True; F[n]['screened_reason'] = why; F[n]['fit'] = 'weak'; F[n]['watch'] = False

# ---------- grants ----------
STAGE = {'won': 'awarded', 'applied': 'submitted', 'declined': 'declined', 'not_eligible': 'not_eligible', 'considered': 'watching', 'to_watch': 'watching', 'in_progress': 'drafting', 'unknown': 'submitted'}
G = []
# funders with more than one program: a candidate joins the first program whose pattern matches; every other funder is one grant
PROGRAMS = {
    'Employment and Social Development Canada (ESDC)': [('Canada Summer Jobs', r'summer jobs|csj'), ('Canada Service Corps micro-grants (EmpowerMTL)', r'service corps|gcos|empowermtl'), ('New Horizons for Seniors Program', r'new horizons|nhsp'), ('Enabling Accessibility Fund, Youth Innovation', r'accessibility'), ('Youth Employment and Skills Strategy', r'youth employment')],
    'Ontario Trillium Foundation (OTF)': [('Youth Opportunities Fund', r'^youth opportunities fund|youth innovations'), ('Grow Grant', r'^grow grant'), ('Seed Grant (Youth Harvest)', r'seed')],
    'Ville de Montr\u00e9al': [('Fonds de soutien financier en d\u00e9veloppement social (Ville-Marie)', r'ville-marie|ville marie'), ("Appels \u00e0 projets Par et pour les jeunes", r'par et pour'), ('Pr\u00e9vention Montr\u00e9al 2027-2030', r'prevention'), ('Lutte contre la pauvret\u00e9 et l\u2019exclusion sociale (Agir ensemble, FQIS)', r'agir ensemble|pauvrete|fqis|lutte')],
    'Centraide of Greater Montreal': [("Fonds d'aide urgente en itin\u00e9rance", r'urgente|emergency'), ('Soutien aux organismes (mission funding)', r'.')],
    'Desjardins': [('Cooperathon', r'cooperathon'), ('GoodSpark Fund', r'goodspark'), ("Fonds d'aide au d\u00e9veloppement du milieu and donations (caisses)", r'.')],
    'TD Bank Group': [('TD Scholarships for Community Leadership (individuals)', r'scholarship'), ('TD Ready Commitment community giving', r'.')],
    'Right To Food (formerly Community Food Centres Canada)': [('Good Food Organization program', r'.')],
}
def merge_key(fname, program):
    p = fold(program or '').lower()
    if fname in PROGRAMS:
        for name, rx in PROGRAMS[fname]:
            if re.search(rx, p): return fname + '::' + name
        return fname + '::' + p[:40]
    return fname + '::one'
def program_name(fname, program):
    p = fold(program or '').lower()
    if fname in PROGRAMS:
        for name, rx in PROGRAMS[fname]:
            if re.search(rx, p): return name
    return None
def add_grant(fname, program, stage, **kw):
    if fname not in F: return
    k = merge_key(fname, program)
    for g in G:
        if g['_k'] == k:
            # the more advanced stage wins; notes and amounts are kept from both
            rank = {'watching': 0, 'found': 0, 'screened': 1, 'relationship': 2, 'drafting': 3, 'submitted': 4, 'declined': 5, 'not_eligible': 5, 'dropped': 5, 'awarded': 6, 'reporting': 6, 'closed': 6}
            if rank.get(stage, 0) > rank.get(g['stage'], 0): g['stage'] = stage
            for f, v in kw.items():
                if v in (None, '', []): continue
                if f in ('notes', 'source', 'source_ref'): g[f] = (g[f] + '\n' + v) if g.get(f) and v not in g[f] else (g.get(f) or v)
                elif f == 'links': g['links'] = (g.get('links') or []) + [l for l in v if l not in (g.get('links') or [])]
                elif not g.get(f): g[f] = v
            pn = program_name(fname, program)
            if pn: g['program'] = pn
            elif kw.get('source') == 'research 02/10/26' and program: g['program'] = program
            return g
    g = {'_k': k, 'funder': fname, 'program': (program_name(fname, program) or program or 'Grant')[:200], 'stage': stage, 'title': None, 'amount_ask': None, 'amount_awarded': None, 'deadline': None, 'deadline_note': None, 'submitted_on': None, 'decided_on': None, 'decision_note': None, 'owner_name': None, 'partner': None, 'program_area': None, 'next_action': None, 'links': [], 'source': None, 'source_ref': None, 'notes': None}
    for f, v in kw.items():
        if v not in (None, '', []): g[f] = v
    G.append(g); return g

PA = lambda p: ('community kitchen' if 'kitchen' in (p or '').lower() else 'gift baskets' if 'basket' in (p or '').lower() else 'Toronto' if 'toronto' in (p or '').lower() or 'youth harvest' in (p or '').lower() else None)
for x in S:
    if excluded(x['funder']): continue
    fname = C(x['funder'])
    if 'Unidentified funder' in x['funder']: fname = 'Funder to identify (2025 applications)'
    st = STAGE.get(x['status'], 'watching')
    notes = (x.get('notes') or '')
    dl = a_date(x.get('deadline_or_cycle'))
    add_grant(fname, x.get('program'), st, amount_ask=num(x.get('amount_max')) if st in ('submitted', 'drafting') else None, amount_awarded=num(x.get('outcome_amount')) if st == 'awarded' else None,
              deadline=dl if st in ('watching', 'drafting') else None, deadline_note=x.get('deadline_or_cycle'), submitted_on=a_date(notes) if st == 'submitted' else None, decided_on=x.get('outcome_date') if st in ('declined', 'awarded', 'not_eligible') else None,
              decision_note=None, owner_name=(x.get('owner') or None), partner=('DESTA Black Community Network' if 'desta' in (notes + ' ' + str(x.get('owner'))).lower() else None), program_area=PA(x.get('program')),
              source='transcript, email', source_ref=(x.get('source') or '')[:600], notes=notes[:1500], title=('Youth Harvest' if 'youth harvest' in (x.get('program') or '').lower() else None))
for x in D:
    if excluded(x['funder']): continue
    fname = C(x['funder'])
    st = STAGE.get(x['status'], 'watching')
    if x['status'] == 'considered' and ('idea list' in (x.get('year_or_date') or '').lower() or (x.get('year_or_date') or '').strip() == '2026-06'): continue   # the 2023-24 idea lists and the AI-made 2026 list: the funder row keeps the note, the pipeline stays clean
    notes = ' '.join(filter(None, [x.get('notes'), ('Eligibility: ' + x['eligibility_notes']) if x.get('eligibility_notes') else None, ('Fit: ' + x['fit_notes']) if x.get('fit_notes') else None]))
    when = x.get('year_or_date') or ''
    links = [{'label': 'The funder', 'url': x['url']}] if x.get('url') and str(x['url']).startswith('http') else []
    add_grant(fname, x.get('program'), st, amount_ask=num(x.get('amount_max')) if st in ('submitted', 'drafting', 'declined') else None, amount_awarded=num(x.get('outcome_amount')) if st == 'awarded' else None,
              deadline=None, deadline_note=x.get('deadline_or_cycle'), submitted_on=a_date(when) if st == 'submitted' else None, decided_on=(a_date(x.get('outcome_date')) or a_date(when)) if st in ('declined', 'not_eligible') else None,
              program_area=PA(x.get('program')), links=links, source='the Drive trackers', source_ref=(x.get('source_file') or '')[:300], notes=(when + '. ' + notes)[:1500])
for x in W:
    fname = C(x['funder'])
    if x.get('fit') not in ('good', 'possible'): continue
    add_grant(fname, x.get('program'), 'watching', deadline=x.get('next_deadline'), deadline_note=(x.get('cycle') or '')[:300] + (' (deadline projected from the last cycle)' if x.get('next_deadline') and 'expect' in (x.get('cycle') or '').lower() else ''),
              amount_ask=None, links=[{'label': 'The program', 'url': x['url']}] if x.get('url') else [], source='research 02/10/26', notes=(x.get('fit_note') or '')[:800] + ('\nFunds: ' + x['funds_what'] if x.get('funds_what') else '') + ('\nEligibility: ' + x['eligibility'] if x.get('eligibility') else ''))

G[:] = [g for g in G if not (g['funder'] == 'TD Bank Group' and 'Scholarship' in g['program'])]
# the watching rows whose deadline has passed are a cycle to watch, not a live deadline
for g in G:
    if g['stage'] == 'watching' and g.get('deadline') and g['deadline'] < '2026-10-02': g['deadline_note'] = ('Last cycle closed ' + g['deadline'] + '. ' + (g.get('deadline_note') or ''))[:300]; g['deadline'] = None
# a few known facts by hand
for g in G:
    p = g['program'].lower(); f = g['funder']
    if f == 'Ontario Trillium Foundation (OTF)' and 'seed' in p: g.update(stage='submitted', title='Youth Harvest', submitted_on=g.get('submitted_on') or '2026-08-19', amount_ask=g.get('amount_ask') or 60000, owner_name='Suhaib (lead); Melvina, Danielle, Shima', program_area='Toronto', notes=(g.get('notes') or '') + '\nSubmitted for the 19 Aug 2026 deadline (counted among the five applications in the 8 Sept leadership recap); OTF\'s program manager advised asking $10K to $30K. Decision pending.')
    if f == 'Centraide of Greater Montreal' and 'urgente' in p: g.update(stage='submitted', submitted_on='2026-08-03', owner_name='Danielle, with DESTA', program_area='community kitchen')
    if f == 'Fondation Choquette-Legault': g.update(stage='submitted', submitted_on=g.get('submitted_on') or '2026-09-11', title='Community Connections Initiative', amount_ask=50000, partner='DESTA Black Community Network', owner_name='Shima, Danielle; Suhaib reviews', program_area='community kitchen', deadline=None, notes=(g.get('notes') or '') + '\nThe 12-month, $50,000 Community Connections Initiative with DESTA (letter of intent due 11 Sept 2026); confirm it went in.')
    if f == 'Moisson Montréal': g.update(stage='drafting', program_area='servings', partner='DESTA Black Community Network', owner_name='Shima, Danielle; Steel (board documents)')
    if f == 'Canadian Centre for Community Advancement (3CA)': g.update(stage='drafting', deadline='2026-12-18', owner_name='Danielle', amount_ask=5000)
    if f == 'Zeller Family Foundation': g.update(stage='declined', decided_on='2026-06-15', decision_note='Two requests declined: the gift basket drive ($2,000, letter of 23 Jan 2026) and kitchen supplies (15 Jun 2026). Windows close 10 May and 10 Nov.', deadline=None)
    if f == 'Foundation of Greater Montreal (FGM)': g.update(stage='declined', decided_on='2026-03-30', decision_note='Not selected among 476 applications (30 Mar 2026). The next Collective Fund round is expected 12 Jan to 20 Feb 2027.', deadline=None)
    if f == 'Fondation Lucie et André Chagnon': g.update(stage='declined', decided_on='2026-05-27', decision_note='Request for the community kitchen food distribution denied 27 May 2026. Chagnon funds coalitions, not direct services.')
    if f == 'Maytree Foundation': g.update(stage='declined', decided_on='2024-04-17', decision_note='Letter of interest declined 17 Apr 2024: strategic priorities and limited resources. Maytree focuses on the GTA and systems change.')
    if f == 'Costco Wholesale Canada': g.update(stage='submitted', submitted_on='2026-02-24', amount_ask=3000, owner_name='Danielle, Daniela', program_area='equipment', notes=(g.get('notes') or '') + '\nThe in-person form at the Bridge Street warehouse (24 Feb 2026); no answer by July. Costco asks three months and no more than 10% of the program budget.')
    if f == 'BMO Financial Group': g.update(stage='submitted', submitted_on='2025-09-29', owner_name='Daniela (CFO)', notes=(g.get('notes') or '') + '\nFiled on the CyberGrants sponsorship portal under Daniela\'s address; no decision seen. Community Giving cut-offs 31 Mar and 30 Sept.')
    if f == 'Google (Google for Nonprofits)': g.update(stage='reporting', amount_awarded=10000, decision_note='In kind: up to US$10,000 a month of search ads, held but little used (Aug 2026: an agency or volunteer to run it). Keep the click-through rate at 5% or more or the account is paused.', owner_name='KK and Ian (marketing)', program_area='marketing')
    if f == 'Zensurance': g.update(stage='submitted', submitted_on='2024-11-07', amount_ask=10000, decision_note='No answer; the shortlist excluded Quebec.', owner_name='Tamara, Steel')
    if f == 'SilverChef Canada / EconoLease': g.update(stage='submitted', submitted_on='2024-03-09', amount_ask=5000, program_area='equipment', notes=(g.get('notes') or '') + '\nQuarterly rounds; unsuccessful applications get no answer. Reapply with the kitchen list and quotes.')
    if f == 'Employment and Social Development Canada (ESDC)' and 'service corps' in p: g.update(stage='declined', submitted_on='2023-12-19', decided_on=None, amount_ask=662350, title='EmpowerMTL', decision_note='The $662,350 three-year Canada Service Corps application (Dec 2023) was not funded; no decision letter is on file.', program_area='capacity')
    if f == 'Employment and Social Development Canada (ESDC)' and 'new horizons' in p: g.update(stage='submitted', submitted_on='2022-10-31', amount_ask=25000, decision_note='The first application on record (31 Oct 2022); no outcome on file.')
    if f == 'Employment and Social Development Canada (ESDC)' and 'summer jobs' in p: g.update(stage='watching', deadline='2026-12-11', deadline_note='The 2027 window is expected to open early November and close about 11 December 2026 (projected from the 2026 cycle).', program_area='capacity')
    if f == 'Peter Gilgan Foundation': g.update(stage='not_eligible', decision_note='Requires at least one paid staff member.')
    if f == 'Glocal Foundation of Canada': g.update(stage='not_eligible', decision_note='CANConnect micro-grants were Toronto-only in the round reviewed with DESTA (Aug 2026); a Quebec stream was to be explored.')
    if f == 'Right To Food (formerly Community Food Centres Canada)': g.update(stage='awarded', decided_on='2025-12-17', decision_note='Accepted as a Good Food Organization for 2026 (a network, not money): access to member-only calls such as the Slaight Emergency Food Funding.')
    if f == 'Fondation Béati': g.update(program_area='capacity', notes=(g.get('notes') or '') + '\nThe web check of 2 Oct 2026 read on fondationbeati.org: the 2025-26 call closed 15 Jan 2026 and the next call opens in fall 2026; $30,000 a year for three years, unrestricted.')
    if f == 'Helping Hands': g.update(stage='submitted', submitted_on='2025-11-14', amount_ask=5000, decision_note='Change Makers micro-grant (Nov 2025); no outcome on file.')
    if f == 'Quebecor': g.update(stage='submitted', submitted_on='2025-11-13')
    if f == 'Ubisoft Montréal': g.update(stage='submitted', submitted_on='2025-12-11')

# screened-out funders carry no live opportunity: their rows are dropped with the reason
for g in G:
    fr = F.get(g['funder'])
    if fr and fr['screened_out'] and g['stage'] in ('watching', 'found', 'screened'):
        g['stage'] = 'dropped'; g['decision_note'] = fr['screened_reason'] or 'Not for us.'; g['deadline'] = None
# a deadline belongs to what is still open; elsewhere it is a note
for g in G:
    if g['stage'] not in ('watching', 'found', 'screened', 'relationship', 'drafting') and g.get('deadline'):
        g['deadline_note'] = ('Next cycle: ' + g['deadline'] + '. ' + (g.get('deadline_note') or ''))[:300]; g['deadline'] = None
# old submissions with no outcome on file are closed, not pending
for g in G:
    if g['stage'] == 'submitted' and g.get('submitted_on') and g['submitted_on'] < '2025-01-01':
        g['stage'] = 'closed'; g['decision_note'] = (g.get('decision_note') or 'No outcome recorded; treat as not funded.')
for g in G:
    if g['funder'] == 'No Small Change': g.update(stage='watching', submitted_on=None, decision_note=None, deadline=None, deadline_note='Rounds open in May and June; the 2026 round shows as sent on one tab of the team\'s sheet and not sent on another.', notes=(g.get('notes') or '') + '\nBrand and visibility grant for small Canadian charities (pro bono creative). Confirm whether the June 2026 application went in.')
    if g['funder'] == 'Ontario Trillium Foundation (OTF)' and 'Seed' in g['program']: g['amount_ask'] = None; g['notes'] = (g.get('notes') or '') + '\nThe drafts aimed at $50,000 to $70,000 (a coordinator and equipment); confirm the amount submitted in the OTF portal.'
    if g['funder'] == 'Peter Gilgan Foundation': g['deadline'] = None

# ---------- sources for the scanner ----------
SRC = []
for x in W:
    if x.get('fit') in ('good', 'possible') and x.get('url'):
        SRC.append({'funder': C(x['funder']), 'name': x['funder'] + ': ' + x['program'], 'kind': 'funder_page', 'url': x['url'], 'query': None, 'active': True, 'notes': 'Watchlist page from the 02/10/26 research. ' + (x.get('cycle') or '')[:200]})
AGG = [
    ('Ville de Montréal: appels de projets (programmes)', 'https://montreal.ca/programmes', 'The city\'s program and call-for-projects listings; look for lutte contre la pauvreté, jeunesse, sécurité alimentaire.'),
    ('Centraide du Grand Montréal: soutien aux organismes', 'https://www.centraide-mtl.org/soutien-aux-organismes-et-projets/', 'Centraide\'s funding pages and any special fund.'),
    ('Fondation du Grand Montréal: subventions', 'https://fgmtl.org/en/fgm-collective-funds/', 'FGM\'s collective funds and calls.'),
    ('Right To Food: Good Food Organizations grants and funding', 'https://righttofood.ca/', 'Member-only funding calls (Slaight, Waltons) are announced on the GFO hub; check the public pages for new ones.'),
    ('Imagine Canada: funding news', 'https://www.imaginecanada.ca/en', 'Sector news that announces new funds.'),
    ('CharityVillage: funding and grants news', 'https://charityvillage.com/category/funding/', 'Canadian sector news on new grant programs.'),
    ('Government of Canada: funding for not-for-profits', 'https://www.canada.ca/en/services/business/grants.html', 'Federal funding programs index.'),
    ('Ontario Trillium Foundation: grants and deadlines', 'https://otf.ca/our-grants', 'OTF\'s deadlines (Seed, Grow, Youth Opportunities Fund).'),
    ('City of Toronto: community grants', 'https://www.toronto.ca/community-people/community-partners/apply-for-grants/', 'Toronto\'s grant programs and open calls.'),
    ('Toronto Foundation: grants', 'https://torontofoundation.ca/grants/', 'Vital Signs and other Toronto Foundation calls.'),
]
for n, u, note in AGG: SRC.append({'funder': None, 'name': n, 'kind': 'aggregator', 'url': u, 'query': None, 'active': True, 'notes': note})
QUERIES = [
    ('Montreal food security and homelessness grants open now', 'What grants, calls for proposals or donation programs are open right now (October 2026 onward) for a small registered charity in Montreal that serves free meals to people experiencing homelessness and runs a holiday gift basket drive? Include foundations, corporate programs, the City of Montreal and Quebec programs. For each: funder, program, who is eligible, amounts, deadline, URL.'),
    ('Quebec youth-led charity grants', 'Which funders in Quebec currently fund youth-led or student-run charities (volunteer-run, no paid staff, revenue under $50,000) for community food programs, community kitchens or basic-needs distribution? List open or upcoming calls with deadlines, amounts and URLs.'),
    ('Toronto youth food security grants', 'What grants are open or opening in the next six months for a youth-led charity starting a student food-security program in downtown Toronto (shelter food donations, student housing food support), including youth-specific funds, community foundations and corporate programs? Funder, program, eligibility, amounts, deadline, URL.'),
    ('Canadian corporate community grants small charities', 'Which Canadian corporate or bank foundations currently accept applications from small registered charities (under $100,000 revenue) for food security, poverty relief or volunteer programs, with online applications and amounts under $25,000? Give the program name, cut-off dates, the ask-to-budget rule if any, and the URL.'),
    ('Canada federal and Quebec provincial funding for small food charities', 'What federal (Canada) and Quebec provincial programs are taking applications in the coming months from small community organizations for food security, poverty reduction, youth volunteering or community kitchens? Include wage subsidies and micro-grants. Program, eligibility, amounts, deadline, URL.'),
    ('In-kind programs for food charities Canada', 'What in-kind programs (equipment grants, free food rescue, software for nonprofits, kitchen equipment, vehicles) are open to a small Canadian food charity in 2026-27? Program, eligibility, how to apply, URL.'),
    ('New grant programs announced this month Canada nonprofits', 'What new grant programs, funds or calls for proposals for Canadian nonprofits and charities were announced in the last 30 days, especially for food security, homelessness, youth and community programs in Quebec and Ontario? Funder, program, eligibility, amounts, deadline, URL.'),
    ('Student association and university funds Montreal community projects', 'Which Montreal student unions, university funds and student-directed grants (Concordia, McGill, Dawson, Vanier, UQAM, Université de Montréal) fund community service projects run by student organizations in 2026-27, and when do they take applications? Fund, amounts, deadline, URL.'),
]
for n, q in QUERIES: SRC.append({'funder': None, 'name': n, 'kind': 'search', 'url': None, 'query': q, 'active': True, 'notes': 'A weekly web search through the llm router (grant_scan route).'})

# ---------- the fact base ----------
def fact(key, cat, title, body, source, status='needs_check', sort=100, notes=None, body_fr=None):
    return {'key': key, 'category': cat, 'title': title, 'body': body.strip(), 'body_fr': body_fr, 'source': source, 'status': status, 'sort': sort, 'notes': notes, 'verified_on': None}
FACTS = [
fact('mission-legal', 'mission', 'Mission (the charity\'s registered wording)', """Welfare Avenue is a not-for-profit organization whose mission is to work towards the advancement and inclusion of low-income and unhoused individuals in the Greater Montreal Area, nationally, and internationally. This is accomplished by the following activities: 1. Addressing food insecurity by working collaboratively with volunteers to operate a food distribution service that provides healthy meals to people experiencing poverty and homelessness. 2. Relieving poverty by providing clothing, essential products, and other basic amenities to individuals and families of low income and those experiencing homelessness. 3. Addressing isolation by implementing activities such as sports, community pop-ups, and game events for individuals experiencing social exclusion, and 4. Increasing accessibility to valuable resources for marginalized individuals by partnering with local organizations and community workers to provide access to mental health supports, employment opportunities, and subsidized housing.""", 'The charity application to the CRA (2023); reused in the GCOS 2023, SilverChef 2024 and BMO 2025 applications', 'verified', 10, 'Keep the four activities in this order (some pasted copies scrambled them).'),
fact('mission-short', 'mission', 'Mission, one sentence', """To work towards the advancement and inclusion of low-income and unhoused individuals in the Greater Montreal Area, nationally and internationally, by relieving poverty and addressing food insecurity, isolation and access to valuable resources.""", 'MARK452 client brief (June 2026)', 'verified', 11),
fact('mission-2026', 'mission', 'Mission, the 2026 narrative (200 words)', """Welfare Avenue is a youth-powered non-profit fighting food insecurity and poverty by providing direct support to neighbours and local communities in need. Through grassroots outreach and action, we deliver meals, essential resources, and support directly to people where they are, in parks, shelters, and other community spaces.

We believe that addressing poverty starts with connecting with people, listening to their experiences, and responding directly to their needs. Our work starts with delivering immediate support but does not stop there. We connect neighbours with information and resources, including on temporary housing options or long-term meal programs, that can help them build better lives.

Community is at the heart of our organization. We believe real change happens when people come together to support their neighbours and respond to the challenges facing their neighbourhoods. We work to build strong relationships with the people and communities we serve, ensuring local needs inform our programming and services.

We work alongside community members and partner organizations to identify challenges and deliver practical solutions. Through collaboration and compassion, Welfare Avenue is building a society where everyone has access to the food and resources they need to thrive.""", 'OTF Seed Grant draft (Aug 2026); DESTA partnership application (Sept 2026)', 'verified', 12),
fact('vision', 'mission', 'Vision', """A world without poverty: a world where all individuals have the necessities they require and the opportunities available to them, where proactive measures prevent homelessness, where youth are deeply involved in community development, and where community engagement is a central value starting at a young age.""", 'SilverChef application (Mar 2024); DESTA answers bank (Sept 2026)', 'verified', 13),
fact('values', 'mission', 'Values', """Dignity. Inclusion. Community. Impact. We meet people where they are, we welcome everyone, and we measure ourselves by the real change we create. Our community of guests, volunteers and staff is built on mutual benefit: volunteers dedicate time to support marginalized people and gain empathy, leadership skills and a deeper understanding of the challenges those people face.""", 'MARK452 brief (June 2026); SilverChef application (Mar 2024)', 'verified', 14),
fact('tagline', 'mission', 'Tagline', 'Building pathways in our community.', 'MARK452 brief (June 2026)', 'verified', 15),
fact('origin', 'history', 'Origin story', """Welfare Avenue was founded in April 2020 by Steel James MacDonald in response to the impact of the COVID-19 pandemic on vulnerable, unhoused and marginalized people in Greater Montreal. A team of volunteers, friends and colleagues gathered weekly to organize meal distributions and provide essential resources. We grew from a student initiative into a grassroots organization and a registered charity, expanding to Toronto and partnering with academic institutions and community organizations.""", 'Donor Program Outline (2024, 2026); DESTA answers bank (Sept 2026); Zensurance entry (Nov 2024)', 'verified', 20),
fact('founding-year', 'history', 'Founding and incorporation years', """Founded in April 2020 as a student initiative; incorporated in 2021 (legal name Avenue du Bien-Être, operating name Welfare Avenue); registered charity (business number 713048502RR0001). The registration acceptance letter in Drive is dated 23 February 2024.""", 'Charity application (2023); NHSP 2022 and GCOS 2023 forms (established 2021); the registration letter (Feb 2024)', 'conflict', 21, 'The forms disagree: the story says 2020, the federal forms say established 2021, the OTF draft says registered 2021 while the acceptance letter is dated Feb 2024. Settle one formulation ("founded 2020, incorporated 2021, registered charity 2024") against the letters patent and the CRA letter before using it.'),
fact('registration', 'history', 'Registration and identifiers', """Registered charity, business number 713048502RR0001. Legal name Avenue du Bien-Être; operating name Welfare Avenue. Address: 8200 avenue Bloomfield, Montréal QC H3N 2H9. Fiscal year ends 30 September. Website welfareavenue.com; info@welfareavenue.com.""", 'The receipt settings in the Hub (app_config), the T3010 for FY2025, the OTF draft (Aug 2026)', 'verified', 22, 'Use the legal name, never a person\'s name, in legal-name fields (the OTF draft got this wrong).'),
fact('milestones', 'history', 'Milestones', """2020: weekly meal distributions begin at Place Émilie-Gamelin (Berri). 2021: incorporation; funding from the Vanier College Student Association. 2022: featured on CBC, CityNews and CTV; selected in Forces Avenir\'s Mutual Aid, Peace and Justice category; first grant application (New Horizons for Seniors). 2023: charity application; Canada Service Corps application; first Toronto events; a storage unit, a new website, a strategic plan. 2024: charity registration letter; first Holiday Gift Basket Drive with Scattered. 2025: Toronto relaunch; Flag Football fundraiser with the Montreal Flag Football League ($2,500+); Rally Paper third place ($1,000); Keela CRM; first formal budget and audit relationship. 2026: co-executive director Suhaib Abdillahi joins (grants); DESTA community-kitchen partnership; the new website and the Hub\'s donation page; Flag Football 2026 (13 teams, $2,800).""", 'Compiled from the charity application, the Impact Tracker, the strategic plan 2026, the BMO 2025 application and the Hub (fund_events)', 'needs_check', 23),
fact('program-servings', 'programs', 'Sunday servings (Montreal)', """Every week we provide about 100 free, healthy meals to low-income and unhoused people in downtown Montreal (Place Émilie-Gamelin at Berri-UQAM, and Atwater), along with clothing and hygiene items. Meals are nutritionally balanced, mostly plant-based and designed with the Canada Food Guide. Volunteers cook, drive, serve and lead; new cooks donate food, regular cooks receive food purchased by the organization; drivers get a gas gift card of up to $50. Serving frequency is biweekly in 2026; check the Hub\'s volunteering calendar before stating weekly or biweekly.""", 'Charity application (2023); DESTA answers bank (Sept 2026); OTF draft (Aug 2026, "bi-weekly and monthly"); the Hub\'s volunteer_events', 'conflict', 30, 'Documents say "every Sunday" (DESTA, MARK452) and "bi-weekly" (OTF draft, strategic plan). The Hub\'s serving calendar is the source of truth.'),
fact('program-essentials', 'programs', 'Essentials distribution', """We collect and distribute essential items, hygiene supplies and clothing through drives with supermarkets, schools, colleges and companies. In 2025: 4,346 clothing items distributed and 280 hygiene products (Impact Tracker).""", 'DESTA answers bank (Sept 2026); Impact Tracker (2025)', 'needs_check', 31),
fact('program-baskets', 'programs', 'Holiday Gift Basket Drive (December, since 2024)', """Each December we assemble and deliver gift baskets (hygiene products, warm clothing, non-perishable food and Scattered\'s mindfulness workbook) to shelters, hospitals and community organizations in Montreal: Chez Doris, the Montreal Children\'s Hospital, the Douglas Institute, Old Brewery Mission and others. 2025 partners included Ardene, Sportira, Mini Biblio Plus, the MUHC Foundation, the Starlight Foundation and Scattered (co-lead). The 2026 edition is fed by a November fundraiser (the One Bag Challenge).""", 'Salvation Army letter (Dec 2024); BMO application (Sept 2025); Impact Tracker; the Hub\'s fund_events', 'verified', 32),
fact('program-kitchen', 'programs', 'Community kitchen with DESTA (2026)', """Since the City of Montreal requires food served publicly to be prepared in an approved space, we cook in DESTA Black Community Network\'s certified community kitchen on Crescent Street (about $143 a session after seven free sessions). DESTA also reviews our grant applications and co-applies with us. The 12-month Community Connections Initiative proposed with DESTA (Sept 2026) covers community kitchens, food security, hygiene and clothing distribution, resource navigation, volunteer engagement and workshops ($50,000).""", 'Program development meetings (Apr to Jun 2026); DESTA partnership application (Sept 2026)', 'verified', 33),
fact('program-events', 'programs', 'Community events against isolation', """We host free, inclusive community events, indoors and outdoors, around the servings: pop-ups, sports activities, game events and seasonal celebrations, where we talk one on one and in groups with the people we serve.""", 'DESTA answers bank (Sept 2026); OTF draft (Aug 2026)', 'verified', 34),
fact('program-navigation', 'programs', 'Resource navigation', """Through open dialogue with the people we serve we identify needs and connect them to local services (mental health, subsidized housing, shelters, employment training), with accessible infographics, factsheets and brochures on disability supports, long-term food banks and subsidized health care.""", 'DESTA answers bank (Sept 2026)', 'verified', 35),
fact('program-youth', 'programs', 'Youth mobilisation', """We recruit and mobilize the next generation of community leaders at McGill, Concordia, Dawson and Vanier through campus events, workshops and volunteer roles, and we present in schools (LaurenHill Academy) and youth programs (Apathy is Boring, Laurus Summer Camp). Trajet refers young people completing community hours to our volunteer positions.""", 'DESTA answers bank (Sept 2026); charity application (2023)', 'verified', 36),
fact('program-toronto', 'programs', 'Welfare Avenue Toronto', """Since 2023, relaunched in 2025: food donated to Margaret\'s Toronto East Drop-In Centre and the Salvation Army with fruit from Not Far From The Tree and food from Aangen Kitchen and East Coast Donair; registered as an external organization with TMU; a Community Research Program on homelessness and poverty data; partnerships with the Toronto Youth Food Policy Council (Cook & Support Program agreement, Sept 2026) and Ralph Thornton Community Centre. 2026 goals: two volunteer events a month at GTA shelters and a first grant for Toronto. The OTF Seed application (Aug 2026) proposed Youth Harvest, a student-led campus and student-housing food-security program in downtown Toronto.""", 'Toronto 2026 Overview (Dec 2025); Grants Check-In (4 Aug 2026); TYFPC agreement (Sept 2026)', 'verified', 37),
fact('numbers-meals', 'numbers', 'Meals and food bags', """Tracked totals (Impact Tracker): 788 (2020), 1,653 (2021), 2,344 (2022), 2,100 (2023), 2,269 (2024); 2025 not yet entered. About 100 meals per serving. Applications have claimed 25,000 meals (Nov 2024, Sept 2026), 10,000 (Sept 2025) and 20,000 (Aug 2026): these are not reconciled with the tracker.""", 'Impact Tracker (Jan 2025 to Apr 2026); Zensurance (2024), BMO (2025), OTF (2026), DESTA (2026) applications', 'conflict', 40, 'Do not reuse 25,000 or 20,000 until the Hub\'s count is reconciled. The defensible figure is roughly 9,000 to 11,000 meals and food bags tracked 2020 to 2025 plus about 100 a serving today.'),
fact('numbers-people', 'numbers', 'People served', """In 2025 Welfare Avenue served more than 2,000 people through meal distribution and clothing programs across Montreal and Toronto. People served per event (average): 115 (2020), 150 (2021), 168 (2022), 190 (2023), 180 (2024), 320 (2025). Events held: 28, 38, 40, 30, 25, 33 for 2020 to 2025; 9 in Q1 2026.""", 'OTF draft (Aug 2026); Impact Tracker', 'needs_check', 41),
fact('numbers-volunteers', 'numbers', 'Volunteers', """About 200 active volunteers over the last 12 months across Montreal and Toronto; over 600 people have volunteered since 2020. 2025: 201 volunteers, 115 new, 5,586 volunteer hours. The Hub\'s CRM holds 497 volunteer contacts and 444 volunteer records (Sept 2026).""", 'OTF draft (Aug 2026); DESTA answers bank (Sept 2026); Impact Tracker; the Hub\'s CRM', 'conflict', 42, '500 (Sept 2025) and 600 (Sept 2026) are cumulative; about 200 is the yearly active number. Say both, never one for the other.'),
fact('numbers-money', 'numbers', 'Revenue and expenses', """Total donations: $15,347 (FY2023), $10,553 (FY2024), $12,983 (FY2025). Expenses: $10,037, $14,552, $12,915. No paid staff; no employee compensation. FY2025 (T3010, filed 4 Feb 2026): revenue $12,983, all gifts without official receipts; expenses $12,915 (supplies and goods $4,774, office supplies $2,724, rent, meals and telecom $3,037, professional fees $1,261, travel $452, advertising $176). Grants received: $0 every year 2020 to 2025 (the Google Ad Grant is in kind).""", 'T3010 FY2025; Impact Tracker', 'verified', 43),
fact('numbers-staff', 'numbers', 'Team and governance numbers', """Welfare Avenue has no paid staff; it is fully managed and powered by volunteers (about 40 active team members in eight teams in 2026, each committing 3 to 6 hours a week; 4 hours minimum, 6 for leaders). The T3010 for FY2025 lists five directors and officers.""", 'OTF draft (Aug 2026); the Hub\'s team roster; T3010 FY2025; Steel (Sept 2026)', 'verified', 44),
fact('numbers-fundraising', 'numbers', 'Fundraising events', """Flag Football 2026 with the Montreal Flag Football League: 13 teams, 78 players, $2,800 raised (8 Aug 2026; 2025 raised over $2,500). Rally Paper Montreal: third place and a $1,000 prize in 2025; played again 19 and 20 Sept 2026. Holiday Gift Basket Drive: about $1,000 raised historically. Fiscal 2026-27 event goals: $10,000 minimum, $15,000 healthy, $20,000 target.""", 'The Hub\'s fund_events and fund_goals; BMO application (Sept 2025)', 'verified', 45),
fact('board', 'people', 'Board of directors', """The T3010 for FY2025 (filed Feb 2026) lists Steel MacDonald (President), Shanada Kurbanali (Vice-President), Tamara Medford-Williams (Secretary), Lailaah Wilson and Angela Ghazarian (Directors), all from 18 Oct 2023. The BMO application of Sept 2025 named a different list (Kurbanali, MacDonald, Mohammed Ashraf Ibrahim VP, Kellian Debargis Treasurer). The Hub\'s board roster is the current list; Daniela Nita is treasurer (2026).""", 'T3010 FY2025; BMO application (Sept 2025); the Hub\'s board roster', 'conflict', 50, 'Reconcile the board list (names, roles, term dates, arm\'s length) with the Hub\'s roster before any application; OTF requires three or more members with 50% at arm\'s length and term dates.'),
fact('leadership', 'people', 'Leadership', """Steel MacDonald, founder and executive director (moving to chair of the board; Suhaib Abdillahi is co-executive director). Suhaib Abdillahi, co-executive director (Toronto), leads grants. Fundraising: events (Amanda Zoldak, Jemeela Taing), donors and partners (Rami Al-Silq, Alexis Walter, Danielle Pidi until Sept 2026), grants (Suhaib; Shima Butera for program development and the DESTA relationship; Melvina Ogakwu for Toronto budgets and templates). Marketing: Ian Odhiambo. Treasurer: Daniela Nita.""", 'Fundraising Team Structure (May 2026); leadership recaps (Aug to Sept 2026); the Hub\'s roster', 'needs_check', 51),
fact('departments', 'people', 'How we are organized', """Seven teams with pages in the Hub: Operations Montreal, Program Development, Operations Toronto, Marketing, Fundraising (grants, event fundraising, donor relations), Human Resources and the Board; Finance is its own function. The Hub (hub.welfareavenue.com) holds the volunteer records, servings, tasks, meetings, the CRM, finances and this grants pipeline, and produces the figures in our applications.""", 'The Hub (2026)', 'verified', 52),
fact('policies', 'people', 'Policies and systems', """A governing board that meets regularly, bylaws, a non-discrimination policy ("Welfare Avenue is an equal opportunity organization and will not allow discrimination based upon age, ethnicity, ancestry, gender, national origin, disability, race, size, religion, sexual orientation, socioeconomic background, or any other status prohibited by the applicable law"), financial management policies, HR policies in the Hub, photo consent forms, a food waiver for cooks. Treasurer bank access and posting financial statements on the website were open compliance items in April 2026.""", 'GCOS 2023; BMO 2025; Fundraising agenda (Apr 2026)', 'needs_check', 53),
fact('partners-community', 'partners', 'Community and institutional partners', """DESTA Black Community Network (community kitchen, grant reviews, co-applications); Scattered (gift baskets); Union United Church (letter of support 2023); Moisson Montréal (accreditation in progress); Right To Food (Good Food Organization since Dec 2025); Toronto Youth Food Policy Council and Ralph Thornton Community Centre (Toronto); Not Far From The Tree, Aangen Kitchen, East Coast Donair (Toronto food); Goodera; Trajet; Apathy is Boring; Arts4All; 253e Scout St-Maron; Eyes on Earth. Academic: Vanier College and the VCSA, Concordia (CASA Cares, JMCC, Enactus, SHIFT), McGill, Dawson, John Abbott, TMU and York.""", 'Charity application (2023); Impact Tracker; DESTA 2026; TYFPC 2026', 'needs_check', 60),
fact('partners-corporate', 'partners', 'Corporate partners and sponsors', """GHD (volunteering day, June 2025), Adaptavist (Jan 2025), RBC (July 2023), Oberoi Financial Group, Hotel Zero1, Sportira, Ardene, Dollarama, Mini Biblio Plus, the Montreal Flag Football League and Athlon Combine, Guru, DOSE, Lush, La Licorne de Feu, the MUHC Foundation and the Starlight Foundation.""", 'Charity application (2023); the website (About); the Hub\'s fund_events', 'needs_check', 61),
fact('partners-shelters', 'partners', 'Shelters and institutions we serve', """Montreal: Old Brewery Mission, The Open Door, Refuge des Jeunes, Maison du Père, Chez Doris, Resilience Montreal, St. Michael\'s Mission, Logifem, the Montreal Children\'s Hospital, the Douglas Institute. Toronto: Horizons for Youth, Haven Toronto, Margaret\'s Drop-In, the Salvation Army.""", 'Impact Tracker (2026); Toronto 2026 Overview', 'needs_check', 62),
fact('budget-costs', 'budget', 'What things cost', """A community kitchen session at DESTA: about $143 after seven free sessions. Food for a serving of about 100 to 120 meals: roughly $140 purchased (Moisson Montréal would supply much of it in kind once accredited). Drivers: a gas gift card up to $50. Storage unit lease: $598 a month (2026 budget). Subscriptions: about $450 a month. Monthly donations in 2026: $2,400 to $4,500.""", 'Program development meetings (Apr 2026); Grants list 2026 financial sheet; charity application (2023)', 'needs_check', 70),
fact('budget-asks', 'budget', 'Budgets we have written', """New Horizons 2022 ($25,000): wages $11,000, project costs $10,000, capital $2,000, facilities $2,000. Canada Service Corps 2023 ($662,350 over three years): staff $440,000, project costs $127,300, participant costs $39,750, vehicle $30,000, admin $25,300. SilverChef 2024 ($5,000): heating trays, folding tables, induction cooktops, insulated carriers, electric cookers, hand-washing stations, carts. BMO 2025: $5,000 of a $10,000 gift basket budget. DESTA and Choquette-Legault 2026 ($50,000 for 12 months): community kitchen $12,500, supplies $10,000, workshops $5,000, outreach $3,750, coordination and volunteer management $11,250, evaluation $2,500, admin $5,000, plus in-kind volunteer time, partnerships and expertise.""", 'The applications on file (2022 to 2026)', 'verified', 71),
fact('budget-wishlist', 'budget', 'What funding would buy', """Kitchen equipment and a certified kitchen or storage space; a vehicle for food transport; a second weekly serving and home deliveries of non-perishables; volunteer management software (now the Hub); a first paid coordinator (Canada Summer Jobs is the realistic first step); the Toronto pilot (Youth Harvest). Standing wording: "Securing this grant would be transformative for our organization, ensuring the long-term sustainability and growth of our vital community initiatives... we aim to acquire upgraded kitchen equipment to streamline meal preparation and distribution, while funding the purchase of fresh, nutritious food items that accommodate diverse dietary restrictions." """, 'DESTA answers bank (Sept 2026); Grant Coordinator JD (2024); charity application (2023)', 'verified', 72),
fact('inkind-value', 'budget', 'Valuing in-kind contributions', """Volunteer time: hours multiplied by the Quebec general minimum wage ($16.60 an hour from 1 May 2026) for general labour, a Statistics Canada occupational wage for specialized work; never issue a donation receipt for time. Donated food at fair market value; kitchen space (DESTA) at its session rate. 2025: 5,586 volunteer hours (Impact Tracker).""", 'The grants playbook (Oct 2026); Gouvernement du Québec; CRA gifts of services', 'verified', 73),
fact('outcomes-method', 'outcomes', 'How we measure', """Serving leads record meals, volunteers and hours in the Hub after every serving (the Hub\'s volunteer records and rosters); the Impact Tracker (since Jan 2025) holds the yearly totals; one-on-one and group conversations with guests and feedback surveys inform changes; the CRM records donors and gifts. Planned: twice-yearly guest and volunteer surveys (bilingual), an annual impact report (CanadaHelps template, drafted Apr 2026).""", 'Charity application (2023); GCOS 2023; Fundraising agenda (Apr 2026); the Hub', 'needs_check', 80),
fact('outcomes-claimed', 'outcomes', 'Outcomes we commit to', """Increased food security for guests; reduced social isolation; better access to community services through referrals; more volunteers and volunteer hours; stronger community partnerships; youth who gain leadership skills and keep volunteering. Outputs are counted (meals, servings, baskets, volunteers, hours); outcomes are what changed for people, and we separate the two.""", 'DESTA application (Sept 2026); the grants playbook (Oct 2026)', 'verified', 81),
fact('sustainability', 'outcomes', 'Sustainability', """Diversified funding (student-association fundraisers such as Rally Paper, corporate volunteering days, Flag Football, the gift basket drive, individual and monthly donors through the Hub\'s donation page, foundation grants, in-kind food and equipment), a volunteer base renewed each school year, partnerships (DESTA, Moisson Montréal once accredited), and systems that keep the record (the Hub).""", 'SilverChef 2024; DESTA 2026; the Hub', 'verified', 82),
fact('equity', 'equity', 'Equity and lived experience', """Welfare Avenue is youth-led: board members and program leads are students or recent graduates. We serve low-income and unhoused people, newcomers and refugees, youth facing barriers, seniors experiencing isolation, people with disabilities, 2SLGBTQIA+ people, and Black, Indigenous and racialized community members. Guests are not asked for ID; servings are bilingual (English and French) and offer vegetarian and halal options; we recruit bilingual and trilingual volunteers (EN, FR, ES).""", 'GCOS 2023; Home Depot registration (2024); DESTA 2026; Team structure (2026)', 'needs_check', 90, 'The claim "at least 50% of the leadership from underserved populations" (EmpowerMTL 2024) is unverified: check before reuse.'),
fact('need-data', 'need', 'Need data we cite', """Montreal\'s 2022 count found more than 4,000 people living on the street (Je compte MTL). Statistics Canada (2018): hidden homelessness affects 18% of people 40 to 49 and 11.2% of Quebecers surveyed. Food insecurity among students: 51% at TMU (2024). The City of Montreal now requires food served publicly to be prepared in an approved kitchen, which raises the cost of every serving. Keep the latest homelessness count (Je compte MTL / MSSS), Moisson Montréal\'s Bilan-Faim and Food Banks Canada\'s HungerCount on file with their years.""", 'NHSP 2022; Grants Check-In (Aug 2026); the grants playbook (Oct 2026)', 'needs_check', 95),
fact('documents-kit', 'documents', 'The document kit (where things are)', """Letters patent, Quebec enterprise number (NEQ), CRA business number letter, charity registration acceptance letter (Feb 2024), bylaws, board resolutions (Moisson Montréal 2022), financial statements 2022, 2024 and 2025 (signed), T3010 returns, budgets 2025 and 2026, storage unit lease, letters of support (Union United Church 2023; CDC and Sportira recommendations), photo consent forms, the non-discrimination policy, expense reports: the "Grant Application Files" folder in Google Drive. Portals: GCOS (account WelfareAvenue1), Benevity, SmartSimple, CyberGrants, JotForm, OTF.""", 'Drive (Grant Application Files); the Grants list 2026', 'needs_check', 100),
fact('answer-change', 'answers', 'Standard answer: what change do you make?', """We address immediate basic needs by collecting and distributing essential items, including hygiene supplies and clothing, and by serving about 100 free, healthy meals a week to low-income and unhoused people in downtown Montreal. We connect people to the services that change their situation (mental health resources, subsidized housing, shelters, employment training). We counter isolation with free, inclusive community events built around the servings. We mobilize students at McGill, Concordia, Dawson and Vanier to lead, and we take part in systemic advocacy on poverty.""", 'DESTA answers bank, "Responses used in the past" (Sept 2026)', 'verified', 110),
fact('answer-five-years', 'answers', 'Standard answer: where are you in five years?', """From a localized weekly initiative to a multi-city, high-impact network: expansion to three or four Canadian cities; daily food distribution in select locations; permanent infrastructure (a central office or community centre, or institutional student chapters); a dedicated kitchen; holistic reintegration pathways with partners.""", 'DESTA answers bank (Sept 2026)', 'verified', 111),
fact('answer-media', 'answers', 'Standard answer: recognition', """Our efforts have been featured on CBC (2022), CityNews (June 2022) and CTV; Welfare Avenue was selected in the Mutual Aid, Peace and Justice category of Forces Avenir, Quebec\'s university student project competition.""", 'DESTA answers bank (Sept 2026); charity application (2023)', 'verified', 112),
]

# ---------- settings ----------
DONOR = {
    'name': 'Monthly donor program', 'launched': None,
    'goals': {'monthly_donors': 40, 'monthly_revenue': 400, 'year_revenue': 3000, 'by': '2027-09-30', 'ladder': [{'when': '3 months', 'donors': 15, 'avg': 8}, {'when': '6 months', 'donors': 40, 'avg': 10}, {'when': '9 months', 'donors': 60, 'avg': 10}, {'when': '1 year', 'donors': 100, 'avg': 17}, {'when': '3 years', 'donors': 500, 'avg': 25}]},
    'tiers': [{'amount': 5, 'label': '$5 a month', 'buys': 'the serving ware for one Sunday'}, {'amount': 10, 'label': '$10 a month', 'buys': 'a week of fresh produce for the servings'}, {'amount': 20, 'label': '$20 a month', 'buys': 'the food for about 15 meals a month'}],
    'audience': 'Adults 35 and older through outreach agencies, faith groups, schools and newcomer organizations; young people met at fundraisers; one-time donors (they convert within 30 to 60 days when asked).',
    'cadence': [{'k': 'thanks', 'l': 'Automatic thank-you after every gift', 'how': 'The CRM automation "Thank donors for a gift" (ready, off until the team turns it on).', 'done': False}, {'k': 'monthly', 'l': 'Monthly update email (one story, one photo, where the money went)', 'how': 'A campaign from the CRM, end of month.', 'done': False}, {'k': 'quarterly', 'l': 'Quarterly video Q&A with the executive team', 'how': 'Google Meet, donors only.', 'done': False}, {'k': 'yearend', 'l': 'Year-end impact report and receipts', 'how': 'The CRM\'s Reports and Receipts (annual receipts in January).', 'done': False}, {'k': 'lapsed', 'l': 'A personal note to donors who gave last year and not this year', 'how': 'The CRM\'s Reports lists them; Make a list of them.', 'done': False}],
    'playbook': ['Ask "Join our monthly community of donors", not "Donate today".', 'Three simple options ($5, $10, $20) each with what it buys in a month.', 'After every one-time gift: a thank-you, then within 30 to 60 days the ask to become monthly.', 'Monthly impact updates; test and adjust the message; make joining fast and mobile (the donation page at hub.welfareavenue.com/give, monthly option).', 'Launch sequence: 1 introduce the program, 2 an impact story, 3 the call to become recurring.', 'Weekly: two or three social posts, one outreach action, new donors recorded in the CRM. Monthly: one campaign or newsletter, review new donors, conversion and engagement.', 'Publish the number of monthly donors each month; a milestone goal (172 donors at $5 a month would add a Saturday serving).'],
    'roles': [{'role': 'Program lead (strategy, targets, channel mix)', 'who': 'Rami Al-Silq'}, {'role': 'Donor acquisition and communications (ambassadors, onboarding sequence)', 'who': 'Alexis Walter'}, {'role': 'Stewardship and retention (thank-yous, anniversaries, lapsing donors), database hygiene', 'who': 'Open since Danielle left (Sept 2026)'}, {'role': 'Oversight', 'who': 'Steel MacDonald'}],
    'launch': [{'step': 'Finalize goals, tiers and the engagement plan', 'done': True}, {'step': 'Monthly option live on the donation page (Stripe, hub.welfareavenue.com/give)', 'done': True}, {'step': 'Warm talk track to previous and one-time donors before launch', 'done': False}, {'step': 'Three launch emails written (introduce, story, ask)', 'done': False}, {'step': 'Turn on the gift thank-you automation in the CRM', 'done': False}, {'step': 'Launch day: posts, emails, the team asks in person', 'done': False}, {'step': 'First month review: donors, monthly total, channels', 'done': False}],
    'sources': ['Donor Program Outline (2024)', 'Donor Program Outline 2026 and the 3-month plan (Danielle Pidi, Apr 2026)', 'Recurring Donor Program Outline (2026)', 'Fundraising Team Structure (May 2026)', 'Strategic plan 2026']
}
SCANNER = {'slack_channel': 'C041VL0LEBG', 'slack_channel_name': 'grants', 'post_new_finds': True, 'schedule': 'Mondays 09:30 Toronto (cron wa-grant-scan, 13:30 UTC)', 'min_fit_to_post': 55, 'max_pages_per_run': 60, 'model_route': 'grant_scan',
    'profile': 'Welfare Avenue (Avenue du Bien-Être) is a CRA-registered charity (713048502RR0001) founded in 2020 in Montreal, with a program in Toronto. It is youth-led and fully volunteer-run (no paid staff), with revenue of about $13,000 in FY2025 and no cash grant won yet. Programs: Sunday meal servings for people experiencing homelessness in downtown Montreal (about 100 meals a serving), essentials and hygiene distribution, a December holiday gift basket drive to shelters and hospitals, a community kitchen with DESTA Black Community Network, corporate volunteering days, community events, youth mobilisation on campuses, a Toronto shelter food program and a planned student food-security pilot (Youth Harvest). It can accept grants up to roughly $30,000 realistically; asks over 20% of its budget are weak unless the funder says otherwise. Not eligible for: programs requiring paid staff, programs requiring prior Quebec government funding, children-only mandates, sport-only or arts-only mandates, Ontario-only funds except through its Toronto program, individual bursaries.',
    'last_run': None}
SETTINGS = [{'key': 'donor_program', 'value': DONOR}, {'key': 'scanner', 'value': SCANNER}]
# the playbook (markdown) is posted as its own row: the approach page renders it
PLAY = open(os.path.join(R, 'grant_playbook.md'), encoding='utf8').read()
SETTINGS.append({'key': 'playbook', 'value': {'title': 'How we win grants: the approach', 'written': '2026-10-02', 'markdown': PLAY}})

# ---------- documents ----------
def doc(title, kind, text, date=None, lang='en', url=None, source=None, funder=None, grant_hint=None):
    text = re.sub(r'\n{3,}', '\n\n', text.replace('\r', '')).strip()
    return {'title': title, 'kind': kind, 'lang': lang, 'doc_date': date, 'text': text, 'words': len(text.split()), 'source_url': url, 'source': source, 'funder': funder, 'grant_hint': grant_hint}
def ocr(n):
    p = os.path.join(R, 'ocr', n)
    t = open(p, encoding='utf8', errors='ignore').read()
    return re.sub(r'===== PAGE [^\n]+ =====\n', '', t)
DOCS = [
    doc('SilverChef Community Grant application (9 Mar 2024)', 'application', ocr('silverchef.ocr.txt'), '2024-03-09', source='Drive: Grant - submitted Welfare Avenue Mail - Your SilverChef C...pdf (OCR)', funder='SilverChef Canada / EconoLease', grant_hint='silverchef'),
    doc('Canada Service Corps micro-grants application: EmpowerMTL (19 Dec 2023, GCOS)', 'application', ocr('gcos_youth.ocr.txt'), '2023-12-19', source='Drive: GCOS Micro grant youth stream.pdf (OCR)', funder='Employment and Social Development Canada (ESDC)', grant_hint='service corps'),
    doc('Maytree grant notes (GrantWatch listing, Mar 2024)', 'guide', ocr('maytree_notes.ocr.txt'), '2024-03-09', source='Drive: 2024-03-09 Maytree Grant - Grants to Canada Registered Charities f...pdf (OCR)', funder='Maytree Foundation', grant_hint='strengthening communities'),
    doc('Home Depot Canada Foundation registration (Mar 2024)', 'confirmation', ocr('homedepot_reg.ocr.txt'), '2024-03-09', source='Drive: Home Depot Canada Foundation registration pdf (OCR)', funder='The Home Depot Canada Foundation', grant_hint='youth opportunity'),
    doc('GCOS submission confirmation (Dec 2023)', 'confirmation', ocr('submission_confirmation.ocr.txt'), '2023-12-18', source='Drive: Grant submission confirmation.pdf (OCR)', funder='Employment and Social Development Canada (ESDC)', grant_hint='service corps'),
]
# the Google Docs come straight from wa_drive_docs in SQL (wa193_seed_apply.sql); the three read on 02/10/26 are posted here
EXTRA = os.path.join(R, '..', 'seed')
for fn, title, kind, date, url, funder, hint in [
    ('otf_seed_draft.txt', 'OTF Seed Grant draft: Youth Harvest (Aug 2026)', 'application', '2026-08-18', 'https://docs.google.com/document/d/1-vWObCjFTYJrgvVi8q2DQ8GxdNHoa7HE5HwTSH3CByI/edit', 'Ontario Trillium Foundation (OTF)', 'seed'),
    ('funding_proposal_template.txt', 'Welfare Avenue funding proposal template (Melvina Ogakwu, Jun 2026)', 'guide', '2026-07-06', 'https://docs.google.com/document/d/1_oVBOx4sO_68cwvXBJ5IzoawwfiueyiwEfqPaZ0tI3w/edit', None, None),
    ('grants_planning.txt', 'Grants Planning, Team Welfare Avenue (11 Jun 2026)', 'plan', '2026-06-11', 'https://docs.google.com/document/d/1HgWsFjgQe5UlXgVE5xfQxFF0EigKf3Uqfr0CuJ7uf24/edit', None, None)]:
    p = os.path.join(EXTRA, fn)
    if os.path.exists(p): DOCS.append(doc(title, kind, open(p, encoding='utf8').read(), date, url=url, source='Drive (read 02/10/26)', funder=funder, grant_hint=hint))

# ---------- post ----------
rows = []
for r in F.values(): rows.append({'k': 'funder', 'v': r})
for g in G:
    g2 = dict(g); g2.pop('_k', None); rows.append({'k': 'grant', 'v': g2})
for s in SRC: rows.append({'k': 'source', 'v': s})
for f in FACTS: rows.append({'k': 'fact', 'v': f})
for d in DOCS: rows.append({'k': 'doc', 'v': d})
for s in SETTINGS: rows.append({'k': 'setting', 'v': s})
print('funders', len(F), 'grants', len(G), 'sources', len(SRC), 'facts', len(FACTS), 'docs', len(DOCS), 'settings', len(SETTINGS))
from collections import Counter
print('stages', Counter(g['stage'] for g in G)); print('fit', Counter(r['fit'] for r in F.values()), 'watch', sum(1 for r in F.values() if r['watch']), 'screened', sum(1 for r in F.values() if r['screened_out']))
if DRY:
    for g in sorted(G, key=lambda g: (g['funder'], g['program'])): print(f"  {g['funder'][:40]:40} | {g['program'][:60]:60} | {g['stage']:12} | {g.get('deadline')} | {g.get('amount_ask')} | {g.get('owner_name') or ''}")
    sys.exit(0)
def post(batch):
    req = urllib.request.Request(BASE + 'wa_stage_193seed', data=json.dumps(batch).encode(), method='POST', headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
    with urllib.request.urlopen(req, timeout=120) as r: return r.status
for i in range(0, len(rows), 40):
    b = rows[i:i + 40]
    big = [x for x in b if len(json.dumps(x)) > 300000]
    for x in big: print('big row', x['k'], len(json.dumps(x)))
    st = post(b); print('posted', i, '+', len(b), st)
print('done')
