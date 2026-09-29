#!/usr/bin/env python3
"""Website images (wave162, 28/09/26): resize the vetted photos and event posters in build/www/img-src into
build/www/out/img as progressive JPEGs, and write build/www/img.json (name -> widths, width, height) for the
generator's width/height attributes. Sources: content-images/photos/web (the Hub's photo library, usage 'ready'
only) and site-media/events/fundraising (the old website's posters). Photos of people we serve that need consent,
the old site's winter serving gallery and the driver itinerary are left out on purpose."""
import json, os
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'img-src'); OUT = os.path.join(HERE, 'out', 'img')
os.makedirs(OUT, exist_ok=True)
PHOTOS = ['2022-02-winter-volunteer-group-b', '2022-02-winter-volunteer-group-a', '2022-01-winter-serving-team',
          '2022-06-media-interview-b', '2024-07-summer-salad-trays', '2024-07-summer-volunteer-portrait',
          '2024-07-summer-volunteer-team', '2024-10-autumn-volunteers-plating', 'food-salads-and-grapes']
POSTERS = {  # event id -> source file (the poster people saw), in the order of site_events ids
    1: 'ev1-club-night-poster-instagram-post-1920-1080-px-1200-628-px.png', 2: 'ev2-club-nightstory-presentation-169.png',
    3: 'ev3-img-0160.jpg', 4: 'ev4-img-1350.jpg', 5: 'ev5-fundraisers-82568da6a122fd63b7b2.png',
    6: 'ev6-screenshot-2023-11-06-000022.png', 7: 'ev7-green-brown-simple-big-gaming-football-instagram-post.png',
    8: 'ev8-424571125-3396315253993658-4084162262773713192-n.webp', 9: 'ev9-cupcake-fundraiser-poster.png',
    10: 'ev10-1.png', 11: 'ev11-img-0869.png', 12: 'ev12-img-0905.jpg', 13: 'ev13-img-0903.jpg'}
man = {}
def save(im, name, widths, q=78):
    im = ImageOps.exif_transpose(im).convert('RGB')
    w0, h0 = im.size; done = []
    for w in widths:
        if w > w0 and done: continue
        ww = min(w, w0); hh = round(h0 * ww / w0)
        r = im.resize((ww, hh), Image.LANCZOS) if ww != w0 else im
        fn = '%s-%d.jpg' % (name, ww)
        r.save(os.path.join(OUT, fn), 'JPEG', quality=(68 if ww >= 1400 else 74 if ww >= 900 else q), optimize=True, progressive=True)
        done.append(ww)
    man[name] = {'w': done, 'ratio': round(h0 / w0, 4)}
for k in PHOTOS:
    save(Image.open(os.path.join(SRC, 'photo-' + k + '.jpg')), k, [480, 960, 1600])
# 28/09/26: Steel's Good photos, from the photo library's web size (build/www/good-out/web, labelled by good_labels.py)
import sys; sys.path.insert(0, HERE); import content
for k, _, _ in content.PHOTOS_NEW:
    save(Image.open(os.path.join(HERE, 'good-out', 'web', k + '.jpg')), k, [480, 960, 1600])
for i, f in POSTERS.items():
    save(Image.open(os.path.join(SRC, f)), 'event-%d' % i, [480, 1080])
json.dump(man, open(os.path.join(HERE, 'img.json'), 'w'), indent=1, sort_keys=True)
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(len(os.listdir(OUT)), 'images', tot, 'bytes')
