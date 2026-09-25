#!/usr/bin/env python3
"""Import LinkedIn page analytics exports (.xls) into Social analytics (social-pull import_csv).

Usage: linkedin_import.py <content.xls> <followers.xls> <visitors.xls> [--dry]
  content   : sheet "Metrics" (daily impressions, unique impressions, clicks, reactions,
              comments, reposts) and sheet "All posts" (one row per post)
  followers : sheet "New followers" (daily) and the follower breakdowns
  visitors  : sheet "Visitor metrics" (daily page views) and the visitor breakdowns
Daily metrics: views = impressions (total), reach = unique impressions (organic),
clicks, likes = reactions, comments, shares = reposts, engagement = clicks + reactions
+ comments + reposts, new_followers, profile_views = total page views.
Posts: views = impressions, likes, comments, shares = reposts, clicks, engagement =
clicks + likes + comments + reposts + follows (LinkedIn's own definition); CTR,
engagement rate, follows, author and audience are kept in raw.
Needs /tmp/anon.key and /tmp/wa.secret (the trigger secret)."""
import json, sys, urllib.request, datetime
import xlrd

args = [a for a in sys.argv[1:] if not a.startswith('--')]
DRY = '--dry' in sys.argv
content, followers, visitors = args[:3]


def day(v):
    s = str(v).strip()
    m, d, y = s.split('/')
    return '%s-%02d-%02d' % (y, int(m), int(d))


def num(v):
    if v in ('', None):
        return None
    try:
        return float(v)
    except Exception:
        return None


def col(sh, row, names):
    hdr = [str(sh.cell_value(row, c)).strip() for c in range(sh.ncols)]
    return {n: hdr.index(n) for n in names if n in hdr}


rows = []
def put(d, metric, v):
    if v is None:
        return
    rows.append({'day': d, 'metric': metric, 'value': round(v, 4)})

# content: daily
cb = xlrd.open_workbook(content)
m = cb.sheet_by_name('Metrics')
H = col(m, 1, ['Date', 'Impressions (total)', 'Unique impressions (organic)', 'Clicks (total)', 'Reactions (total)', 'Comments (total)', 'Reposts (total)'])
first = last = None
for r in range(2, m.nrows):
    v = m.row_values(r)
    if not v[H['Date']]:
        continue
    d = day(v[H['Date']]); first = first or d; last = d
    imp, uniq, clk, rea, com, rep = (num(v[H[k]]) for k in ['Impressions (total)', 'Unique impressions (organic)', 'Clicks (total)', 'Reactions (total)', 'Comments (total)', 'Reposts (total)'])
    put(d, 'views', imp); put(d, 'reach', uniq); put(d, 'clicks', clk); put(d, 'likes', rea); put(d, 'comments', com); put(d, 'shares', rep)
    put(d, 'engagement', sum(x or 0 for x in (clk, rea, com, rep)))

# content: posts
p = cb.sheet_by_name('All posts')
P = col(p, 1, ['Post title', 'Post link', 'Post type', 'Campaign name', 'Posted by', 'Created date', 'Audience', 'Impressions', 'Views', 'Offsite Views', 'Clicks', 'Click through rate (CTR)', 'Likes', 'Comments', 'Reposts', 'Follows', 'Engagement rate', 'Content Type'])
posts = []
for r in range(2, p.nrows):
    v = p.row_values(r)
    link = str(v[P['Post link']]).strip()
    if not link:
        continue
    g = lambda k: num(v[P[k]]) if k in P else None
    likes, comments, reposts, clicks, follows = g('Likes'), g('Comments'), g('Reposts'), g('Clicks'), g('Follows')
    kind = str(v[P['Content Type']]).strip().lower() if 'Content Type' in P and v[P['Content Type']] else 'post'
    posts.append({
        'external_id': link, 'url': link, 'kind': kind or 'post',
        'caption': str(v[P['Post title']]).strip()[:600],
        'published_at': day(v[P['Created date']]) + 'T12:00:00Z' if v[P['Created date']] else None,
        'views': g('Impressions'), 'likes': likes, 'comments': comments, 'shares': reposts, 'clicks': clicks,
        'engagement': sum(x or 0 for x in (likes, comments, reposts, clicks, follows)),
        'raw': {k2: v2 for k2, v2 in {
            'post_type': str(v[P['Post type']]).strip() or None, 'posted_by': str(v[P['Posted by']]).strip() or None,
            'audience': str(v[P['Audience']]).strip() or None, 'campaign': str(v[P['Campaign name']]).strip() or None,
            'ctr': g('Click through rate (CTR)'), 'engagement_rate': g('Engagement rate'), 'follows': follows,
            'video_views': g('Views'), 'offsite_views': g('Offsite Views'), 'source': 'LinkedIn export'}.items() if v2 not in (None, '')}
    })

# followers: daily new followers and the breakdowns
fb = xlrd.open_workbook(followers)
nf = fb.sheet_by_name('New followers')
F = col(nf, 0, ['Date', 'Total followers', 'Organic followers', 'Sponsored followers'])
for r in range(1, nf.nrows):
    v = nf.row_values(r)
    if v[F['Date']]:
        put(day(v[F['Date']]), 'new_followers', num(v[F['Total followers']]))


def breakdown(book, sheet, top):
    sh = book.sheet_by_name(sheet)
    out = [[str(sh.cell_value(r, 0)).strip(), int(num(sh.cell_value(r, 1)) or 0)] for r in range(1, sh.nrows) if str(sh.cell_value(r, 0)).strip()]
    out.sort(key=lambda x: -x[1])
    return out[:top]

KEYS = [('Location', 'location', 30), ('Job function', 'job_function', 30), ('Seniority', 'seniority', 20), ('Industry', 'industry', 30), ('Company size', 'company_size', 20)]
demo = {'as_of': last, 'period': [first, last], 'source': 'LinkedIn export',
        'followers': {k: breakdown(fb, s, t) for s, k, t in KEYS},
        'visitors': {}}

# visitors: daily page views and the breakdowns
vb = xlrd.open_workbook(visitors)
vm = vb.sheet_by_name('Visitor metrics')
V = col(vm, 0, ['Date', 'Total page views (total)', 'Total unique visitors (total)'])
uniq_total = 0
for r in range(1, vm.nrows):
    v = vm.row_values(r)
    if v[V['Date']]:
        put(day(v[V['Date']]), 'profile_views', num(v[V['Total page views (total)']]))
        uniq_total += num(v[V['Total unique visitors (total)']]) or 0
demo['visitors'] = {k: breakdown(vb, s, t) for s, k, t in KEYS}
demo['visitors_unique_sum'] = int(uniq_total)

body = {'action': 'import_csv', 'platform': 'linkedin', 'handle': 'welfareavenue', 'name': 'Welfare Avenue', 'rows': rows, 'posts': posts, 'demographics': demo}
print('days %s to %s; %d daily numbers; %d posts; new followers in the year %d; page views %d' % (
    first, last, len(rows), len(posts), sum(r['value'] for r in rows if r['metric'] == 'new_followers'), sum(r['value'] for r in rows if r['metric'] == 'profile_views')))
if DRY:
    print(json.dumps({k: (v if k not in ('rows', 'posts') else len(v)) for k, v in body.items()}, indent=1)[:1500])
    sys.exit(0)
anon = open('/tmp/anon.key').read().strip(); sec = open('/tmp/wa.secret').read().strip()
req = urllib.request.Request('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/social-pull', data=json.dumps(body).encode(), method='POST',
                             headers={'Authorization': 'Bearer ' + anon, 'apikey': anon, 'x-wa-secret': sec, 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        print(r.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read().decode()[:500])
