"""w204gif_check.py: decode the GIFs w204gif.js wrote (Pillow) and compare each frame with its source frame."""
import json, os, sys
from PIL import Image, ImageSequence
OUT = os.environ.get('OUT', '/tmp/w204gif')
meta = json.load(open(os.path.join(OUT, 'meta.json')))
bad = 0
for m in meta:
    im = Image.open(os.path.join(OUT, m['name'] + '.gif'))
    src = open(os.path.join(OUT, m['name'] + '.rgba'), 'rb').read()
    fs = m['w'] * m['h'] * 4
    errs, durs = [], []
    for k, fr in enumerate(ImageSequence.Iterator(im)):
        durs.append(fr.info.get('duration'))
        rgb = fr.convert('RGB').tobytes()
        s = src[k * fs:(k + 1) * fs]
        tot = 0; mx = 0
        for p in range(0, m['w'] * m['h'], 7):
            for c in range(3):
                dlt = abs(rgb[p * 3 + c] - s[p * 4 + c]); tot += dlt; mx = max(mx, dlt)
        errs.append(round(tot / (len(range(0, m['w'] * m['h'], 7)) * 3), 2))
    n = getattr(im, 'n_frames', 1)
    okk = n == m['n'] and im.size == (m['w'], m['h']) and all(d == m['delay'] * 10 for d in durs) and im.info.get('loop') == 0 and max(errs) < (40 if m['name'].startswith('noise') else 12)
    if not okk: bad += 1
    print(('PASS ' if okk else 'FAIL ') + m['name'], 'frames', n, 'size', im.size, 'loop', im.info.get('loop'), 'dur', sorted(set(durs)), 'mean err max', max(errs), 'bytes', m['bytes'], 'ms', m['ms'])
print('w204gif: %d of %d GIFs decode and match their frames' % (len(meta) - bad, len(meta)))
sys.exit(1 if bad else 0)
