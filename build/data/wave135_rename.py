#!/usr/bin/env python3
"""wave135 (26/09/26): the Training academy is the Avenue Academy, and learning paths are Learning Avenues.

Steel: "Change Training Academy to Avenue Academy and Learning Paths to Learning Avenues"

Display text only. The page id (#training), the table names (academy_paths, academy_awards), the
tour key (tour:academy) and the code names stay, so links, bookmarks and progress keep working.
Historical header comments are left as they were.

Each edit is an exact replacement with an expected count, so a drifted source fails loudly.
Run once from the repo root: python3 build/data/wave135_rename.py
Then re-assemble parts122, parts127, parts130 and parts131, and build.
"""
import os
import sys

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AA = 'Avenue Academy'

EDITS = [
    # ---- the page's name: menu label, help titles, access labels, crumbs ----
    ('src/043_wave43.seg', "training: 'Training academy',", "training: 'Avenue Academy',", 1),
    ('src/043_wave43.seg', "'<p>The Training academy: your onboarding first", "'<p>The Avenue Academy: your onboarding first", 1),
    ('src/043_wave43.seg', 'what is up next, learning paths with a certificate at the end,', 'what is up next, Learning Avenues with a certificate at the end,', 1),
    ('src/061_wave61.seg', "training: 'Training academy',", "training: 'Avenue Academy',", 1),
    ('src/106_wave106.seg', "t.textContent.indexOf('Training academy') < 0", "t.textContent.indexOf('Avenue Academy') < 0", 1),
    ('src/106_wave106.seg', '</span>Training academy\';', '</span>Avenue Academy\';', 1),
    ('src/110_wave110.seg', "training: 'Training academy',", "training: 'Avenue Academy',", 1),
    ('src/118_wave118.seg',
     '"training": ["People", "Training academy", "Onboarding, learning paths, a tour of every page, and your progress.", false, "Training academy"]',
     '"training": ["People", "Avenue Academy", "Onboarding, Learning Avenues, a tour of every page, and your progress.", false, "Avenue Academy"]',
     1),
    ('src/060_wave60.seg', "orgchart: 'Org chart', training: 'Training',", "orgchart: 'Org chart', training: 'Avenue Academy',", 1),
    ('src/072_wave72.seg', "volunteering: 'Volunteering', training: 'Training', hrcentre: 'HR centre',", "volunteering: 'Volunteering', training: 'Avenue Academy', hrcentre: 'HR centre',", 1),
    ('parts127/a_head.js', "training: 'Training academy',", "training: 'Avenue Academy',", 1),
    ('parts131/a_head.js', "training: 'Training academy',", "training: 'Avenue Academy',", 1),
    ('parts130/b_main.js', "training: ['The training academy', 1],", "training: ['The Avenue Academy', 1],", 1),
    # ---- the team pages' tool links (HR and Marketing) ----
    ('src/116_wave116.seg', "tools.push(['&#127891;', 'Training', '#training']);", "tools.push(['&#127891;', 'Avenue Academy', '#training']);", 1),
    ('src/116_wave116.seg', "tools.push(['&#127891;', 'Training paths', '#training']);", "tools.push(['&#127891;', 'Learning Avenues', '#training']);", 1),
    ('src/039_wave39.seg', "tools.push(['&#127891;', 'Training', '#training']);", "tools.push(['&#127891;', 'Avenue Academy', '#training']);", 1),
    ('src/039_wave39.seg', "tools.push(['&#127891;', 'Training paths', '#training']);", "tools.push(['&#127891;', 'Learning Avenues', '#training']);", 1),
    # ---- the HR centre points people to it ----
    ('src/046_wave46.seg', 'Personal training lives on the Training page.', 'Personal training lives in the Avenue Academy.', 1),
    ('src/046_wave46.seg', 'their own training and onboarding live on the Training page.', 'their own training and onboarding live in the Avenue Academy.', 1),
    # ---- the academy itself (wave122) ----
    ('parts122/d_home.js', 'People &middot; Training academy', 'People &middot; Avenue Academy', 1),
    ('parts122/d_home.js', '<h1>Training academy</h1>', '<h1>Avenue Academy</h1>', 1),
    ('parts122/d_home.js', 'Welcome to the new academy.', 'Welcome to the Avenue Academy.', 1),
    ('parts122/d_home.js', 'Explore a path or the library below.', 'Explore a Learning Avenue or the library below.', 1),
    ('parts122/d_home.js', '<h2>Learning paths</h2>', '<h2>Learning Avenues</h2>', 1),
    ('parts122/d_home.js', '>More paths<', '>More Learning Avenues<', 1),
    ('parts122/d_home.js', 'The Training academy is available to staff accounts.', 'The Avenue Academy is available to staff accounts.', 1),
    ('parts122/d_home.js', 'The academy could not load (', 'The Avenue Academy could not load (', 1),
    ('parts122/d_home.js', 'Loading the academy…', 'Loading the Avenue Academy…', 1),
    ('parts122/e_reader.js', "toastS('That path is not available')", "toastS('That Learning Avenue is not available')", 1),
    ('parts122/e_reader.js', "' Learning path</span>", "' Learning Avenue</span>", 1),
    ('parts122/e_reader.js', "' Path complete</span>", "' Learning Avenue complete</span>", 1),
    ('parts122/e_reader.js', 'WELFARE AVENUE &middot; TRAINING ACADEMY', 'WELFARE AVENUE &middot; AVENUE ACADEMY', 1),
    ('parts122/e_reader.js', "' certificate in the Training academy.'", "' certificate in the Avenue Academy.'", 1),
    ('parts122/e_reader.js', "' reached ' + a.title + ' in the Training academy.'", "' reached ' + a.title + ' in the Avenue Academy.'", 1),
    ('parts122/e_reader.js', '<label>Learning path<select', '<label>Learning Avenue<select', 1),
    ('parts122/e_reader.js', 'It no longer shows in the academy.', 'It no longer shows in the Avenue Academy.', 1),
    ('parts122/e_reader.js', '>Back to the academy<', '>Back to the Avenue Academy<', 1),
    ('parts122/g_wire.js', "<h3>Academy <a class=\"lnk\" href=\"#training\">' + (isMe ? 'open' : 'the academy')", "<h3>Avenue Academy <a class=\"lnk\" href=\"#training\">' + (isMe ? 'open' : 'open yours')", 1),
    ('parts122/g_wire.js', 'Back to the Training academy', 'Back to the Avenue Academy', 1),
    ('parts122/g_wire.js', 'It disappears from the academy,', 'It disappears from the Avenue Academy,', 1),
    ('parts122/h_sops.js', 'Shown on the card in the academy and on the team page.', 'Shown on the card in the Avenue Academy and on the team page.', 1),
    # ---- Hub training: the tours ----
    ('parts122/f_tours.js', 'every page has a guided tour like this one in the Training academy.', 'every page has a guided tour like this one in the Avenue Academy.', 1),
    ('parts122/f_tours.js', 'in the Onboarding section of the Training academy.', 'in the Onboarding section of the Avenue Academy.', 2),
    ('parts122/f_tours.js', 'kept in the Training academy.', 'kept in the Avenue Academy.', 1),
    ('parts122/f_tours.js', "'Academy', 'Their level, certificates and badges from the Training academy.'", "'Avenue Academy', 'Their level, certificates and badges from the Avenue Academy.'", 1),
    ('parts122/f_tours.js', "'Learning paths', 'Short series with a certificate at the end.'", "'Learning Avenues', 'Short series with a certificate at the end.'", 1),
    ('parts122/f_tours.js', 'academy certificates can be shared here too', 'Avenue Academy certificates can be shared here too', 1),
    ('parts122/f_tours.js', 'The full video library lives in the Training academy.', 'The full video library lives in the Avenue Academy.', 1),
    ('parts122/f_tours.js', 'Pick it up again from the Training academy.', 'Pick it up again from the Avenue Academy.', 1),
]


def main():
    bad = 0
    for path, old, new, n in EDITS:
        p = os.path.join(B, path)
        s = open(p, encoding='utf-8').read()
        c = s.count(old)
        if c != n:
            print('SKIP (found %d, expected %d): %s :: %s' % (c, n, path, old[:70]))
            bad += 1
            continue
        open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    print('%d edits, %d problems' % (len(EDITS), bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
