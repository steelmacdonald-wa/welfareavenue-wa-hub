#!/usr/bin/env python3
"""Assemble the UI integration parts into the Hub's single-file build."""
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
PARTS = ['sidebar', 'serving', 'status', 'sop']

blocks = ['/* WA v274 approved lab UI integration. */\n']
for name in PARTS:
    css = (HERE / (name + '.css')).read_text()
    blocks.append('(function () {\n  var style = document.createElement("style");\n')
    blocks.append('  style.id = ' + json.dumps('wa-ui-' + name) + ';\n')
    blocks.append('  style.textContent = ' + json.dumps(css, ensure_ascii=True) + ';\n')
    blocks.append('  document.head.appendChild(style);\n})();\n')
    source = (HERE / (name + '.js')).read_text()
    blocks.append(source.encode('ascii', 'backslashreplace').decode('ascii') + '\n')

target = HERE.parent / 'src/274_wave274.seg'
target.write_text(''.join(blocks))
print(target.name, target.stat().st_size, 'bytes')
