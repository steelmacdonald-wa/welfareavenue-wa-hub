#!/usr/bin/env python3
"""Build-time brand remap (wave114, 24/09/26).

The Hub carries 113 waves of hand-written CSS with the legacy palette hard
coded (#2c7a66 greens, #14302b ink, #d4a13c gold, #8455ff purple, white
cards, grey-green muted text). The brand file (v1 2026) allows five colours
only: Dignity cream #FFFAF2, Community green #103F39, Ground #1F201E,
Possibility purple #6F64AB, Action gold #DCA527. Rather than touching every
wave, build.sh runs this after assembling candidate.html and rewrites the
legacy values in place. Tints used for lines and canvases are mixes of cream
and green; reds stay as functional warning colours; department identity
colours (Toronto blue, fundraising orange, board grey) stay for recognition.
Idempotent: running it twice changes nothing.
"""
import re, sys

HEX = {
    # greens and ink -> Community green
    '2c7a66': '103F39', '1f5f4f': '103F39', '4a7c59': '103F39', '3f9c7f': '103F39', '1baf7a': '103F39',
    '14302b': '103F39', '1c2b27': '103F39', '566a7f': '103F39', '003f38': '103F39', '1e3d3a': '103F39',
    # body text -> Ground
    '243029': '1F201E', '3d4642': '1F201E', '191615': '1F201E', '697a8d': '1F201E',
    # muted grey-greens -> muted (Ground mixed 40% into cream)
    '5b6b66': '797773', '5c6b66': '797773', '6b7670': '797773', '6f6b64': '797773', '7b8a86': '797773',
    '8b968f': '797773', '8a8f85': '797773', '9aa5a1': '797773', '8592a3': '797773', '8b8f96': '797773', 'a3b8a0': '797773',
    # gold
    'd4a13c': 'DCA527', 'f0d9a8': 'F5E1B5',
    # purples
    '8455ff': '6F64AB', '5b32c7': '6F64AB', '8a5cc4': '6F64AB', 'c78996': '6F64AB',
    # white -> cream
    'ffffff': 'FFFAF2',
    # light canvases -> cream canvas tint
    'faf9f4': 'F4F2EA', 'f6f8f7': 'F4F2EA', 'f2f4f3': 'F4F2EA', 'f2ebe3': 'F4F2EA', 'f5f5f9': 'F4F2EA', 'f7f5ef': 'F4F2EA', 'ede6dd': 'F4F2EA',
    # soft tints -> cream + 8% green
    'eef2f0': 'ECEBE3', 'eef4f1': 'ECEBE3', 'e8efe9': 'ECEBE3', 'dcebe5': 'ECEBE3',
    # lines -> cream + 14% green
    'e3e7e5': 'DEE0D8', 'dde5e1': 'DEE0D8', 'd8e6e0': 'DEE0D8', 'e7e9f0': 'DEE0D8', 'e3ded2': 'DEE0D8',
}
HEX3 = { 'fff': 'FFFAF2' }
RGBA = {
    '31,95,79': '16,63,57', '44,122,102': '16,63,57', '20,48,43': '16,63,57', '20,40,30': '16,63,57',
    '67,89,113': '16,63,57', '212,161,60': '220,165,39', '132,85,255': '111,100,171', '255,255,255': '255,250,242',
}

def remap(text: str) -> str:
    def hex6(m):
        key = m.group(1).lower()
        return '#' + HEX.get(key, m.group(1))
    text = re.sub(r'#([0-9a-fA-F]{6})(?![0-9a-fA-F])', hex6, text)
    def hex3(m):
        key = m.group(1).lower()
        return '#' + HEX3.get(key, m.group(1))
    text = re.sub(r'#([0-9a-fA-F]{3})(?![0-9a-fA-F])', hex3, text)
    def rgba(m):
        trip = re.sub(r'\s+', '', m.group(2))
        return m.group(1) + RGBA.get(trip, m.group(2)) + m.group(3)
    text = re.sub(r'(rgba?\()\s*(\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3})(\s*[,)])', rgba, text)
    return text

if __name__ == '__main__':
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    out = remap(src)
    open(path, 'w', encoding='utf-8').write(out)
    changed = sum(1 for a, b in zip(src.split('\n'), out.split('\n')) if a != b)
    print('brand_remap: %d lines changed' % changed)
