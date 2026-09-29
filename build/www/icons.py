#!/usr/bin/env python3
"""Website icons (wave162): favicon-32.png and apple-touch-icon.png (the brand E, cream on community green)."""
import os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
def icon(size, radius):
    s = 4  # draw big, then shrink for clean edges
    W = size * s
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, W - 1], radius=radius * s, fill='#103F39')
    u = W / 64.0
    for (x, y, w, h) in [(17, 15, 7, 34), (17, 15, 30, 7), (17, 28.5, 26, 7), (17, 42, 30, 7)]:
        d.rounded_rectangle([x * u, y * u, (x + w) * u, (y + h) * u], radius=1.5 * u, fill='#FFFAF2')
    return im.resize((size, size), Image.LANCZOS)
icon(32, 6).save(os.path.join(OUT, 'favicon-32.png'))
a = icon(180, 0); bg = Image.new('RGB', (180, 180), '#103F39'); bg.paste(a, (0, 0), a); bg.save(os.path.join(OUT, 'apple-touch-icon.png'))
print('icons ok')
