#!/usr/bin/env python3
"""Team photos for About (wave162, 28/09/26): the Hub's avatars (public bucket 'avatars', downloaded into team-src/
as <hub id>.<ext>) cropped square and saved as out/img/team/<name>.jpg at 192 px (shown at 96). A few are cropped
around the person because the person is small in the frame. Members without a usable photo show initials."""
import os
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'team-src'); OUT = os.path.join(HERE, 'out', 'img', 'team')
os.makedirs(OUT, exist_ok=True)
FILES = {1: 'ahmed', 3: 'shima', 4: 'brianna', 6: 'mary', 17: 'ian', 18: 'kahkashan', 22: 'joy', 27: 'amanda', 30: 'alexis',
         32: 'daniela', 34: 'valex', 37: 'steel', 41: 'tamara', 43: 'eleftherios', 49: 'eno'}
CROPS = {3: (250, 190, 450, 390), 22: (100, 250, 300, 450), 32: (66, 170, 246, 350), 49: (118, 110, 338, 330)}  # in the 512 px source
for hid, name in FILES.items():
    src = next(os.path.join(SRC, f) for f in os.listdir(SRC) if f.split('.')[0] == str(hid))
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    if hid in CROPS: im = im.crop(CROPS[hid])
    else:
        w, h = im.size; s = min(w, h); im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    im.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, name + '.jpg'), 'JPEG', quality=80, optimize=True, progressive=True)
print('team photos:', len(FILES))
