#!/usr/bin/env python3
"""Fundraiser photos into the Hub's photo library (wave162b, 28/09/26): the 12 pictures on the events page
(content.FUND_PHOTOS) in the library's three sizes (long side 2400 full, 1600 web, 640 thumb; never enlarged),
written to build/www/fund-lib/<size>/<key>.jpg, staged into public.wa_stage_push for photo-library 'put', and the
wa_photos rows printed as SQL (labels by Claude (Cowork))."""
import base64, hashlib, json, os, sys, urllib.request
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); import content as C
OUT = os.path.join(HERE, 'fund-lib'); SIZES = {'full': 2400, 'web': 1600, 'thumb': 640}
META = {  # key -> (taken_on, date_note, season, event, scene, tags, usage_note, people, partner, branding, best_for, source)
    '2026-08-flag-football-team-in-yellow': ('2026-08-08', 'The tournament day (the camera clock reads May 2025).', 'summer', 'Flag Football 2026', 'portrait', ['fundraiser', 'flag football', 'team'], 'Players posing at a public tournament.', 'One team, about seven players', ['Montreal Flag Football League'], 'none', ['card', 'report', 'social_square'], 'Flagfootball 2026/BN0A8586.JPG, Canon EOS 5D Mark IV, 6720 x 4480'),
    '2025-12-gift-baskets-the-crew': (None, 'December 2025, around the drive of 21/12/25 (a WhatsApp copy, no camera date).', 'winter', 'Holiday Gift Basket Drive 2025', 'volunteers', ['fundraiser', 'gift baskets', 'holidays', 'group'], 'Volunteers posing for the photo.', 'About twenty volunteers', [], 'none', ['report', 'deck', 'card'], 'Gift basket drive/motion_photo_3185939658622393109.jpg, 1600 x 1200'),
    '2026-08-flag-football-on-the-run': ('2026-08-08', 'The tournament day (the camera clock reads May 2025).', 'summer', 'Flag Football 2026', 'other', ['fundraiser', 'flag football', 'action'], 'Players in play at a public tournament.', 'Several players', ['Montreal Flag Football League'], 'none', ['card', 'report'], 'Flagfootball 2026/BN0A8540.JPG, Canon EOS 5D Mark IV, 6720 x 4480'),
    '2025-12-gift-baskets-wrapping': (None, 'December 2025, around the drive of 21/12/25 (a WhatsApp copy, no camera date).', 'winter', 'Holiday Gift Basket Drive 2025', 'volunteers', ['fundraiser', 'gift baskets', 'holidays', 'wrapping'], 'Volunteers at work.', 'Four volunteers', [], 'none', ['story', 'report'], 'Gift basket drive/motion_photo_5583711275468760194.jpg, 1536 x 2048'),
    '2026-08-flag-football-celebration': ('2026-08-08', 'The tournament day (the camera clock reads May 2025).', 'summer', 'Flag Football 2026', 'other', ['fundraiser', 'flag football', 'team', 'celebration'], 'Players celebrating at a public tournament.', 'One team, about six players', ['Montreal Flag Football League'], 'none', ['card', 'social_square', 'report'], 'Flagfootball 2026/BN0A8601.JPG, Canon EOS 5D Mark IV, 6720 x 4480'),
    '2025-12-gift-baskets-bags': (None, 'December 2025, around the drive of 21/12/25 (a WhatsApp copy, no camera date).', 'winter', 'Holiday Gift Basket Drive 2025', 'other', ['fundraiser', 'gift baskets', 'holidays', 'gifts'], 'Gifts only, no people.', 'None', [], 'none', ['story', 'card', 'social_portrait'], 'Gift basket drive/motion_photo_3336655848881728989.jpg, 1152 x 2048'),
    '2026-08-flag-football-team-photo': ('2026-08-08', 'The tournament day (a shared copy, no camera date).', 'summer', 'Flag Football 2026', 'portrait', ['fundraiser', 'flag football', 'team'], 'Players posing at a public tournament.', 'One team, about seven players', ['Montreal Flag Football League'], 'none', ['card', 'banner'], 'Flagfootball 2026/27953746-b6cc-41ec-8724-9de3949d37d1.jpg, 4000 x 2252'),
    '2025-12-gift-baskets-elf-hat': (None, 'December 2025, around the drive of 21/12/25 (a WhatsApp copy, no camera date).', 'winter', 'Holiday Gift Basket Drive 2025', 'portrait', ['fundraiser', 'gift baskets', 'holidays', 'portrait'], 'A volunteer posing for the photo.', 'One volunteer', [], 'none', ['story', 'social_portrait'], 'Gift basket drive/motion_photo_2911787912436395858.jpg, 1536 x 2048'),
    '2026-08-flag-football-referee': ('2026-08-08', 'The tournament day (the camera clock reads May 2025).', 'summer', 'Flag Football 2026', 'portrait', ['fundraiser', 'flag football', 'referee'], 'A referee at a public tournament.', 'One referee', ['Montreal Flag Football League'], 'none', ['story', 'social_portrait'], 'Flagfootball 2026/BN0A8550.JPG, Canon EOS 5D Mark IV, 4480 x 6720'),
    '2025-12-gift-baskets-delivery': ('2025-12-23', 'From the WhatsApp file name (23/12/25).', 'winter', 'Holiday Gift Basket Drive 2025', 'volunteers', ['fundraiser', 'gift baskets', 'holidays', 'delivery'], 'Volunteers posing with the gifts they delivered.', 'Five people', [], 'none', ['report', 'card'], 'Gift basket drive/IMG-20251223-WA0008.jpg, 1600 x 1204'),
    '2026-08-flag-football-our-tent': ('2026-08-08', 'From the camera.', 'summer', 'Flag Football 2026', 'setup', ['fundraiser', 'flag football', 'tent', 'sponsor'], 'Our tent and table, no one recognizable.', 'None recognizable', ['GURU'], 'current', ['story', 'report'], 'Flagfootball 2026/20260808_113416.jpg, Galaxy S23 FE, 3000 x 4000'),
    '2026-08-flag-football-food-truck': ('2026-08-08', 'The tournament day (the camera clock reads May 2025).', 'summer', 'Flag Football 2026', 'food', ['fundraiser', 'flag football', 'food truck', 'partner'], 'The food partner at a public tournament.', 'Two people', ['La Licorne de Feu'], 'none', ['card', 'report'], 'Flagfootball 2026/BN0A8513.JPG, Canon EOS 5D Mark IV, 6720 x 4480'),
}
ANON = open('/tmp/anon.key').read().strip()
rows, sql = [], []
for key, src, cap, alt in C.FUND_PHOTOS:
    im = ImageOps.exif_transpose(Image.open(os.path.join(HERE, 'ev-src', src))).convert('RGB')
    info = {}
    for size, lim in SIZES.items():
        w0, h0 = im.size; s = min(1, lim / max(w0, h0)); r = im.resize((round(w0 * s), round(h0 * s)), Image.LANCZOS) if s < 1 else im
        os.makedirs(os.path.join(OUT, size), exist_ok=True); fn = os.path.join(OUT, size, key + '.jpg')
        r.save(fn, 'JPEG', quality=(82 if size == 'full' else 80 if size == 'web' else 76), optimize=True, progressive=True)
        data = open(fn, 'rb').read(); info[size] = (r.size, len(data))
        rows.append({'path': 'photos/%s/%s.jpg' % (size, key), 'b64': base64.b64encode(data).decode(), 'sha': hashlib.md5(data).hexdigest(), 'bytes': len(data)})
    (fw, fh), fb = info['full']; m = META[key]
    orient = 'landscape' if fw > fh * 1.05 else 'portrait' if fh > fw * 1.05 else 'square'
    q = lambda v: 'null' if v is None else "'" + str(v).replace("'", "''") + "'"
    arr = lambda xs: "array[" + ','.join(q(x) for x in xs) + "]::text[]" if xs else "'{}'::text[]"
    sql.append("(%s, %s, %s, %s, %s, %s, %s, %s, 'Montreal', %s, %s, %s, 'ready', %s, %s, %s, %s, %s, true, '%s', %d, %d, %s, 'photos/full/%s.jpg', 'photos/web/%s.jpg', 'photos/thumb/%s.jpg', %d, %d, %d, 1, 'ready', %s, 'Claude (Cowork), 28/09/26', 'wave162b (assistant)')" % (
        q(key), q(cap['en']), q(alt['en']), q(cap['en']), q(alt['en']), q(m[0]), q(m[1]), q(m[2]), q(m[3]), q(m[4]), arr(m[5]), q(m[6]), q(m[7]), arr(m[8]), q(m[9]),
        q('flag-football-2026' if key.startswith('2026-08') else 'gift-baskets-2025'), orient, fw, fh, arr(m[10]), key, key, key, fb, info['web'][1], info['thumb'][1],
        q('Sent by Steel, 28/09/26 (content-images/' + m[11] + '); picked for the website events page')))
# stage the files (the push table takes anon inserts; rows are told apart by the photos/ prefix)
for i in range(0, len(rows), 6):
    req = urllib.request.Request('https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/wa_stage_push', data=json.dumps(rows[i:i + 6]).encode(), method='POST',
                                 headers={'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
    with urllib.request.urlopen(req, timeout=120) as r: assert r.status == 201
print('staged', len(rows), 'files,', sum(r['bytes'] for r in rows), 'bytes')
print('md5:', json.dumps({r['path']: r['md5'] if 'md5' in r else r['sha'] for r in rows}))
open(os.path.join(OUT, 'insert.sql'), 'w').write(
    "insert into public.wa_photos (key, title, alt_text, caption, description, taken_on, date_note, season, place, event, scene, tags, usage, usage_note, people, partner, branding, series, is_pick, orientation, width, height, best_for, path_full, path_web, path_thumb, bytes_full, bytes_web, bytes_thumb, version, status, source, labelled_by, created_by) values\n"
    + ',\n'.join(sql) + "\non conflict (key) do nothing;\n")
print('sql', len(sql), 'rows')
