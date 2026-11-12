# wave320 (12/11/26): Ask the Hub reaches out, muted text that passes AA, names for two controls.
# Usage: python3 patch320.py <live index.html> <candidate out>
# The block (320_v320.js) goes in before wave110, which must stay last. Everything else is an exact replacement.
import sys, re, hashlib, os
HERE = os.path.dirname(os.path.abspath(__file__))

def rep(s, old, new, label, count=1):
    n = s.count(old)
    if n != count: raise SystemExit('%s: expected %s match, found %s' % (label, count, n))
    return s.replace(old, new)

V110 = "/* =====================================================================\n   WA v110 boot veil + self-provisioning + access requests (08/08/26)\n"
OLD_GREY, NEW_GREY = '#797773', '#585B57'   # the website's own --muted: 6.6, 6.1 and 5.6 to 1 on cream, paper and the quiet cards (was 4.3, 4.0, 3.7)

EDITS = [
    # the Ask button's tooltip named the "WA assistant"
    ("btn.title = 'Ask the WA assistant anything, or tell it to file a request or task';",
     "btn.title = 'Ask the Hub anything, or have it file a request or add a task';   /* wave320 */", 'fab title'),
    # the Academy's topic filter had no name for a screen reader
    ("'<select class=\"w122sel\" data-w122cat=\"1\">",
     "'<select class=\"w122sel\" data-w122cat=\"1\" aria-label=\"Topic\">", 'academy select'),
    # the dashboard's hover tip is for the mouse only: hidden from screen readers (it had the tooltip role and no name)
    ("tip.id = 'w301tip'; tip.setAttribute('role', 'tooltip');",
     "tip.id = 'w301tip'; tip.setAttribute('role', 'tooltip'); tip.setAttribute('aria-hidden', 'true');   /* wave320 */", 'w301 tip'),
    # whose task it is: the person's first name as a whole word in the owner, as wa237_due_check asks ("Ian" matched "Brianna")
    ("return !t.done && (t.owner || '').toLowerCase().indexOf(ft) >= 0;",
     "return !t.done && !!ft && (' ' + (t.owner || '').toLowerCase().replace(/[^a-z0-9\\u00c0-\\u024f-]+/g, ' ') + ' ').indexOf(' ' + ft + ' ') >= 0;   /* wave320: a whole word, so Ian is not Brianna */", 'waTasksOf'),
    ("return (t.owner || '').toLowerCase().indexOf(ft) >= 0;\n    } catch (e) { return false; }",
     "return !!ft && (' ' + (t.owner || '').toLowerCase().replace(/[^a-z0-9\\u00c0-\\u024f-]+/g, ' ') + ' ').indexOf(' ' + ft + ' ') >= 0;   /* wave320: a whole word */\n    } catch (e) { return false; }", 'w109Mine'),
    ("if (r.owner.indexOf(ft) >= 0) { cur += r.cur; w3 += r.w3; }",
     "if ((' ' + r.owner.replace(/[^a-z0-9\\u00c0-\\u024f-]+/g, ' ') + ' ').indexOf(' ' + ft + ' ') >= 0) { cur += r.cur; w3 += r.w3; }   /* wave320: a whole word */", 'w54 taskStats'),
]

def patch(s, block):
    if 'WA v320 ' in s: raise SystemExit('the page already has wave320')
    for old, new, label in EDITS: s = rep(s, old, new, label)
    n_grey = len(re.findall(re.escape(OLD_GREY), s, re.I))
    s = re.sub(re.escape(OLD_GREY), NEW_GREY, s, flags=re.I)
    if not block.endswith('\n'): block += '\n'
    s = rep(s, V110, block + V110, 'v110 header')
    return s, n_grey

if __name__ == '__main__':
    live, out = sys.argv[1], sys.argv[2]
    s = open(live, encoding='utf-8').read()
    block = open(os.path.join(HERE, '320_v320.js'), encoding='utf-8').read()
    try: block.encode('ascii')
    except UnicodeEncodeError as e: raise SystemExit('320_v320.js is not ASCII: %s' % e)
    if '—' in block or '–' in block: raise SystemExit('dash in block')
    res, n = patch(s, block)
    open(out, 'w', encoding='utf-8', newline='').write(res)
    print('grey replaced: %d' % n)
    print(len(res.encode()), hashlib.md5(res.encode()).hexdigest())
