#!/usr/bin/env python3
"""wave302: apply the Finance redesign to the live Hub page.
usage: python3 -I patch302.py <in.html> <seg302.js> <out.html>
Every edit is an exact, unique string replacement; the script stops if an anchor is missing or appears twice."""
import sys

src, seg_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(src, encoding='utf-8').read()
seg = open(seg_path, encoding='utf-8').read()


def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit('anchor %s found %d times' % (label, n))
    s = s.replace(old, new, 1)


# 1. the Finance app's rail (wave153 APPS): Today, Match, Bank, Budget, Files; More: the older sections
rep("""      groups: function () {
        return [{ label: 'Finance', items: [
          { h: '#finances', l: 'Overview', ic: 'home', page: 'finances', sec: 'overview' },
          { h: '#finances', l: 'Tasks', ic: 'check', page: 'finances', sec: 'tasks' },
          { h: '#finances', l: 'Trends', ic: 'chart', page: 'finances', sec: 'trends' },
          { h: '#finances', l: 'Money map', ic: 'coins', page: 'finances', sec: 'money' },
          { h: '#finances', l: 'Budget', ic: 'list', page: 'finances', sec: 'budget' },
          { h: '#finances', l: 'Transactions', ic: 'db', page: 'finances', sec: 'txns' }
        ] }];
      }""", """      groups: function () {
        /* wave302 (Steel, 09/11/26, the approved redesign): Today, Match, Bank, Budget, Files; every older section stays
           under More. Match and Files are the team's (finance_docs is staff only); their counts come from wave302. */
        var c = null, st = false;
        try { c = window.w302 && window.w302.counts ? window.w302.counts() : null; } catch (e) { c = null; }
        try { st = typeof isStaff === 'function' && isStaff(); } catch (e) { st = false; }
        var main = [{ h: '#finances', l: 'Today', ic: 'home', page: 'finances', sec: 'today' }];
        if (st) main.push({ h: '#finances', l: 'Match', ic: 'link', page: 'finances', sec: 'match', n: c && c.match ? c.match : null });
        main.push({ h: '#finances', l: 'Bank', ic: 'db', page: 'finances', sec: 'bank' });
        main.push({ h: '#finances', l: 'Budget', ic: 'list', page: 'finances', sec: 'budget' });
        if (st) main.push({ h: '#finances', l: 'Files', ic: 'box', page: 'finances', sec: 'files', n: c && c.files ? c.files : null });
        return [{ label: 'Finance', solo: true, items: main }, { label: 'More', items: [
          { h: '#finances', l: 'Tasks', ic: 'check', page: 'finances', sec: 'tasks' },
          { h: '#finances', l: 'Trends', ic: 'chart', page: 'finances', sec: 'trends' },
          { h: '#finances', l: 'Money map', ic: 'coins', page: 'finances', sec: 'money' },
          { h: '#finances', l: 'Year overview', ic: 'layers', page: 'finances', sec: 'overview' },
          { h: '#finances', l: 'Transactions', ic: 'search', page: 'finances', sec: 'txns' }
        ] }];
      }""", 'APPS.finance')

# 2. wave164: the title follows the section
rep("""  var SECT = {
    overview: ['Overview', 'The year so far: what came in, what went out, how healthy the numbers are, and the finance work in flight.'],""",
    """  var SECT = {
    /* wave302: the redesigned Finance app's sections */
    today: ['Today', 'Where the money stands, and what needs someone.'],
    match: ['Match', 'Every bill, receipt and money email against the bank: confirm the Hub\\u2019s matches, find the missing ones.'],
    bank: ['Bank', 'Each statement month line by line: opening, in, out and closing, each line\\u2019s team, category and receipt.'],
    files: ['Files', 'The Accounting drive\\u2019s Year End folders: what is there, what is missing, and the tidy-ups waiting for a yes.'],
    overview: ['Year overview', 'The year so far: what came in, what went out, how healthy the numbers are, and the finance work in flight.'],""",
    'wave164 SECT')
rep("""    budget: ['Budget', 'Each line of the budget against what was actually spent.'],""",
    """    budget: ['Budget', 'The budget against what was actually spent, by category or by team. Edit any line in the tables.'],""", 'wave164 SECT budget')
rep("""    if (h && !same(h, t[0])) h.textContent = t[0];
    if (p && !same(p, t[1])) p.textContent = t[1];
    F.titled = id;
    try { if (panel() && panel().classList.contains('active')) document.title = (id === 'overview' ? 'Finance'""",
    """    if (h && !same(h, t[0])) h.textContent = t[0];
    if (p && !same(p, t[1])) p.textContent = t[1];
    F.titled = id;
    try { if (panel() && panel().classList.contains('active')) document.title = (id === 'today' ? 'Finance'""", 'wave164 title')

# 3. the masthead's first line (wave85) and the help panel (wave43)
rep("""    finances: 'The year so far: what came in, what went out, how healthy the numbers are, and the finance work in flight.',   /* wave164: the Overview's line (164_wave164 changes it with the section) */""",
    """    finances: 'Where the money stands, and what needs someone.',   /* wave164: the first section's line (164_wave164 changes it with the section); wave302: Today */""", 'W85 finances')
rep("""    finances: '<p>Budget vs actual by category, spending by department, and the full transaction ledger.</p><p>Re-allocate transactions inline, mark duplicates, import a statement, or log an expense. The fiscal year runs October 1 to September 30.</p>',""",
    """    finances: '<p><b>Today</b> shows what is in the bank, the year so far and what needs someone. <b>Match</b> pairs every bill, receipt and money email with its bank line. <b>Bank</b> walks each statement month line by line. <b>Budget</b> is budget against actual. <b>Files</b> keeps the Accounting drive tidy, with nothing moved until someone says yes.</p><p>Under More: Tasks, Trends, the Money map, the Year overview and every transaction (import a statement, log an expense, mark duplicates). The fiscal year runs October 1 to September 30.</p>',""", 'wave43 help')

# 4. the page tour walks the new sections
rep("""    finances: { tab: 'finances', icon: 'scale', hash: '#finances', steps: [
      S('#finances > .w118mast', 'Finances and budgeting', 'Statements, the ledger and budgets per team. The fiscal year runs October 1 to September 30.'),
      S('#finances .fin-head', 'The source', 'Which fiscal year you are looking at and where the budgets come from. Import a statement from here.', OPT),
      S('#w92pills', 'Time frame', 'Last fiscal year, this one, or the forecast.', OPT),
      S('#w94nav', 'Views', 'The overview, trends, the money map, budget against actual, and every transaction.', OPT),""",
    """    finances: { tab: 'finances', icon: 'scale', hash: '#finances', steps: [
      S('#finances > .w118mast', 'Finance', 'Where the money stands and what needs someone. The menu on the left is the app: Today, Match, Bank, Budget and Files, and More for the rest. The fiscal year runs October 1 to September 30.'),
      S('#w302today .w302tiles', 'Today', 'What is in the bank (read from the latest BMO statement), the year so far, and last year against its budget.', { opt: 1, go: function () { if (window.w302) window.w302.go('today'); } }),
      S('#w302today .w302need', 'Needs someone', 'Matches to confirm, bills with no bank line, Drive tidy-ups and anything else waiting on a person. Click a line to go straight to it.', OPT),
      S('#w302match .w302seg', 'Match', 'Every bill, receipt and money email against the bank. The Hub matches what it is sure of; you confirm the rest, or tell it that is not the one.', { opt: 1, go: function () { if (window.w302) window.w302.go('match'); } }),
      S('#w302bank .w302months', 'Bank', 'Each statement month: opening, in, out and closing, checked to the cent. Change a line\\u2019s team or category right there; lines the Hub guessed say so.', { opt: 1, go: function () { if (window.w302) window.w302.go('bank'); } }),
      S('#w302files .w302health', 'Files', 'The Accounting drive\\u2019s Year End folders, checked on the 1st and the 15th. Proposed names and moves wait for your yes; nothing moves without it.', { opt: 1, go: function () { if (window.w302) window.w302.go('files'); } }),
      S('#w92pills', 'Time frame', 'In Budget, Trends and the Money map: last fiscal year, this one, or the forecast.', { opt: 1, go: function () { if (window.w302) window.w302.go('budget'); } }),
      S('#finances .fin-head', 'The source', 'Which fiscal year you are looking at and where the budgets come from. Import a statement from here.', OPT),
      S('#w94nav', 'Views', 'On a phone, the same sections as a strip at the top.', OPT),""", 'TOURS.finances')

rep("""      S('#finances .fin-kpis', 'The headline', 'Income, spending and net for the fiscal year so far.', OPT),""",
    """      S('#finances .fin-kpis', 'Year overview', 'Under More: income, spending and net for the fiscal year so far, the charity health measures, and the finance work and meetings.', { opt: 1, go: function () { if (window.w302) window.w302.go('overview'); } }),""", 'TOURS.finances kpis')

# 5. the segment, after wave163 and before wave110 (110 stays last)
banner = "/* =====================================================================\n   WA v110 boot veil + self-provisioning + access requests (08/08/26)"
rep(banner, seg.rstrip('\n') + '\n\n' + banner, 'wave110 banner')

open(out, 'w', encoding='utf-8').write(s)
print('ok', len(s))
