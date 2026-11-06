"""Fast LF build: joins src/*.seg in MANIFEST order, the same as build.sh, then makes every
line ending LF (the live page is all LF since wave279). Usage: python build_lf.py [out]"""
import sys, pathlib, subprocess
here = pathlib.Path(__file__).resolve().parent
out = here / (sys.argv[1] if len(sys.argv) > 1 else 'candidate.html')
names = []
for line in (here / 'src' / 'MANIFEST.txt').read_bytes().decode('utf-8').splitlines():
    line = line.strip()
    if line and not line.startswith('#'):
        names.append(line)
buf = b''.join((here / 'src' / (n + '.seg')).read_bytes() for n in names)
buf = buf.replace(b'\r\n', b'\n').rstrip(b'\n') + b'\n'
out.write_bytes(buf)
subprocess.run([sys.executable, str(here / 'check_remaps.py'), str(out)], check=True)
print(len(buf), 'bytes', out.name)
