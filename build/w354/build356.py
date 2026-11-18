import hashlib, json
s = open('/home/claude/live/live2.html', encoding='utf-8').read()
assert hashlib.md5(s.encode()).hexdigest() == 'f4d5b05099c49e509c1a5a138e8942d5'
PAIRS = []
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); PAIRS.append([a, b]); s = s.replace(a, b)
rep(open('/home/claude/live/w354_old.js', encoding='utf-8').read(), open('/home/claude/live/w354.js', encoding='utf-8').read())
old = """'<label>Stage</label><div class="stg">' + STAGES.map(function (p) { return '<button type="button" data-w197st="' + p[0] + '" class="' + (c.status === p[0] ? 'on' : '') + '">' + E(p[1]) + '</button>'; }).join('') +
      CLOSED.map(function (p) { return '<button type="button" data-w197st="' + p[0] + '" class="cl' + (c.status === p[0] ? ' on' : '') + '">' + E(p[1]) + '</button>'; }).join('') + '</div>' +"""
new = """'<label>Stage</label>' + (window.w354 && w354.flow ? w354.flow(c, STAGES, CLOSED) : '<div class="stg">' + STAGES.map(function (p) { return '<button type="button" data-w197st="' + p[0] + '" class="' + (c.status === p[0] ? 'on' : '') + '">' + E(p[1]) + '</button>'; }).join('') +
      CLOSED.map(function (p) { return '<button type="button" data-w197st="' + p[0] + '" class="cl' + (c.status === p[0] ? ' on' : '') + '">' + E(p[1]) + '</button>'; }).join('') + '</div>') +   /* wave356: the flow, with closing set apart */"""
rep(old, new)
json.dump({'pairs': PAIRS, 'seg': ''}, open('/home/claude/live/patch356.json', 'w'))
open('/home/claude/live/candidate356.html', 'w', encoding='utf-8', newline='').write(s)
print(hashlib.md5(s.encode()).hexdigest())
