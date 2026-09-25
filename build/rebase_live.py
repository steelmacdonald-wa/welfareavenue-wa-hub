#!/usr/bin/env python3
"""Rebase the src/ segments on the live hub build (wave117, 25/09/26).

Another agent ships waves in place while this workspace is open, so before a
deploy the workspace is re-based on whatever is live:

  python3 rebase_live.py [live.html]      (default: fetch from Netlify)

Every segment in src/MANIFEST.txt (except 117_wave117, which is generated) is
located in the live file in manifest order. Segments are compared after the
build-time remaps (brand_remap.py + teams_remap.py), so pre-remap sources still
match. A segment that is not found is replaced by the live content up to the
next located segment; live content that appears between two located segments
becomes a new segment named from its "WA v<n>" header and is inserted into the
manifest. The base segment is restored from git HEAD before locating, and the
script ends by checking that the plain build (no wave117) reproduces the live
md5 exactly. It prints what changed; it never touches 117_wave117.seg.
"""
import hashlib, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OURS = '117_wave117'


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def remapped(text):
    """Run the two build-time remaps on a copy of `text` and return the result."""
    fd, tmp = tempfile.mkstemp(suffix='.html', dir='/tmp')
    os.close(fd)
    open(tmp, 'w', encoding='utf-8', newline='').write(text)
    sh(['python3', os.path.join(HERE, 'brand_remap.py'), tmp])
    sh(['python3', os.path.join(HERE, 'teams_remap.py'), tmp])
    out = open(tmp, encoding='utf-8', newline='').read()
    os.remove(tmp)
    return out


def head_version(relpath):
    r = sh(['git', 'show', 'HEAD:build/' + relpath], cwd=os.path.dirname(HERE))
    return r.stdout if r.returncode == 0 else None


def seg_name(block):
    m = re.search(r'WA v(\d+[a-z]*)\b', block[:400])
    if not m:
        raise SystemExit('cannot name a new block: ' + block[:120].replace('\n', ' '))
    return '%s_wave%s' % (m.group(1), m.group(1))


def main():
    if len(sys.argv) > 1:
        live = open(sys.argv[1], encoding='utf-8', newline='').read()
    else:
        r = subprocess.run(['curl', '-sS', 'https://wa-exec-dashboard.netlify.app/'], capture_output=True)
        live = r.stdout.decode('utf-8')
    live_md5 = hashlib.md5(live.encode('utf-8')).hexdigest()
    print('live md5', live_md5, 'bytes', len(live.encode('utf-8')))

    # restore the base and the manifest from HEAD (wave117 patches both)
    for f in ('src/000_head_base.seg', 'src/MANIFEST.txt'):
        hv = head_version(f)
        if hv is None:
            raise SystemExit('no HEAD version of ' + f)
        open(os.path.join(HERE, f), 'w', encoding='utf-8', newline='').write(hv)
    names = [l.strip() for l in open(os.path.join(SRC, 'MANIFEST.txt')) if l.strip() and l.strip() != OURS]

    cur = 0
    new_manifest = []
    changed, added = [], []
    pending_gap_start = None
    i = 0
    while i < len(names):
        n = names[i]
        content = open(os.path.join(SRC, n + '.seg'), encoding='utf-8', newline='').read()
        rc = remapped(content) if n != '999_tail' else content
        pos = live.find(rc, cur)
        if pos < 0:
            # changed: its live content runs to the next located segment
            j = i + 1
            nxt_pos = len(live)
            while j < len(names):
                c2 = open(os.path.join(SRC, names[j] + '.seg'), encoding='utf-8', newline='').read()
                rc2 = remapped(c2) if names[j] != '999_tail' else c2
                p2 = live.find(rc2, cur)
                if p2 >= 0:
                    nxt_pos = p2
                    break
                j += 1
            block = live[cur:nxt_pos]
            # the block may hold this segment's new version plus brand new waves
            parts = re.split(r'(?=^/\* =+\n   WA v\d+[a-z]*\b)', block, flags=re.M)
            parts = [p for p in parts if p]
            if not parts:
                raise SystemExit('empty block for ' + n)
            # first part replaces this segment; the rest are new waves (or the following changed segments)
            open(os.path.join(SRC, n + '.seg'), 'w', encoding='utf-8', newline='').write(parts[0])
            changed.append((n, len(parts[0].encode('utf-8'))))
            new_manifest.append(n)
            for p in parts[1:]:
                nm = seg_name(p)
                if nm in names:
                    # a later manifest segment that also changed: write it now and skip it below
                    open(os.path.join(SRC, nm + '.seg'), 'w', encoding='utf-8', newline='').write(p)
                    changed.append((nm, len(p.encode('utf-8'))))
                    new_manifest.append(nm)
                    names.remove(nm)
                else:
                    open(os.path.join(SRC, nm + '.seg'), 'w', encoding='utf-8', newline='').write(p)
                    added.append((nm, len(p.encode('utf-8'))))
                    new_manifest.append(nm)
            cur = nxt_pos
            i += 1
            continue
        if pos > cur:
            # new content before this segment: one or more new waves
            block = live[cur:pos]
            parts = re.split(r'(?=^/\* =+\n   WA v\d+[a-z]*\b)', block, flags=re.M)
            for p in [p for p in parts if p]:
                nm = seg_name(p)
                open(os.path.join(SRC, nm + '.seg'), 'w', encoding='utf-8', newline='').write(p)
                added.append((nm, len(p.encode('utf-8'))))
                new_manifest.append(nm)
        new_manifest.append(n)
        cur = pos + len(rc)
        i += 1
    if cur != len(live):
        raise SystemExit('trailing live content not accounted for: %d bytes' % (len(live) - cur))

    open(os.path.join(SRC, 'MANIFEST.txt'), 'w').write('\n'.join(new_manifest) + '\n')
    print('changed', changed)
    print('added', added)

    # the plain build must reproduce live
    r = sh(['bash', os.path.join(HERE, 'build.sh'), 'rebase_check.html'])
    got = hashlib.md5(open(os.path.join(HERE, 'rebase_check.html'), 'rb').read()).hexdigest()
    os.remove(os.path.join(HERE, 'rebase_check.html'))
    if got != live_md5:
        raise SystemExit('REBASE FAILED: plain build %s != live %s' % (got, live_md5))
    open(os.path.join(HERE, 'live.html'), 'w', encoding='utf-8', newline='').write(live)
    print('OK: plain build reproduces live', live_md5)
    print('manifest tail', new_manifest[-4:])


if __name__ == '__main__':
    main()
