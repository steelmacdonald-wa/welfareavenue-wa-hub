import hashlib, json
s = open('/home/claude/live/live3.html', encoding='utf-8').read()
assert hashlib.md5(s.encode()).hexdigest() == '031a7031659d82097a28e82276e46605'
PAIRS = []
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); PAIRS.append([a, b]); s = s.replace(a, b)
rep(open('/home/claude/live/w354_v356.js', encoding='utf-8').read(), open('/home/claude/live/w354.js', encoding='utf-8').read())
rep("""      if (s[0] === 'hired') list = list.filter(function (c) { return daysIn(c) <= 90; });""",
    """      if (s[0] === 'hired') list = list.filter(function (c) { return daysIn(c) <= 90 && !(window.w354 && w354.doneHire && w354.doneHire(c)); });   /* wave357: onboarded hires move to Closed */""")
rep("""    var closed = rows.filter(function (c) { return c.status === 'declined' || c.status === 'withdrawn' || c.status === 'volunteering'; });""",
    """    var closed = rows.filter(function (c) { return c.status === 'declined' || c.status === 'withdrawn' || c.status === 'volunteering' || (window.w354 && w354.doneHire && w354.doneHire(c)); });   /* wave357 */""")
rep("""' closed (declined, withdrawn or volunteering)</button>' + (S.showClosed ? '<div>' + closed.map(function (c) { return candCard(c, true); }).join('') + '</div>' : '') : '') +""",
    """' closed (declined, withdrawn, volunteering or onboarded)</button>' + (S.showClosed ? '<div>' + closed.map(function (c) { return window.w354 && w354.closedCard ? w354.closedCard(c, candCard(c, true)) : candCard(c, true); }).join('') + '</div>' : '') : '') +""")
rep("""and from the job boards land in New. Hired shows the last 90 days.</p></div>';""",
    """and from the job boards land in New. Hires move to Closed 30 days after Hired, once their onboarding is complete.</p></div>';""")
json.dump({'pairs': PAIRS, 'seg': ''}, open('/home/claude/live/patch357.json', 'w'))
open('/home/claude/live/candidate357.html', 'w', encoding='utf-8', newline='').write(s)
print(hashlib.md5(s.encode()).hexdigest())
