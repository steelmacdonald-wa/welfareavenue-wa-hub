#!/usr/bin/env python3
"""Edge functions from the repo, through fn-deploy.

  python3 build/fn.py list
  python3 build/fn.py get <name>            -> fn/<name>/index.ts + meta.json
  python3 build/fn.py deploy <name> [--verify-jwt true|false]
  python3 build/fn.py deploy-all a b c ...

Needs /tmp/anon.key and /tmp/wa.secret; the vault must hold
SUPABASE_ACCESS_TOKEN (fn-deploy says so if it does not)."""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/fn-deploy'
ANON = open('/tmp/anon.key').read().strip()
SEC = open('/tmp/wa.secret').read().strip()


def call(payload):
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(), method='POST', headers={
        'Authorization': 'Bearer ' + ANON, 'x-wa-secret': SEC, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        try:
            return json.loads(body)
        except Exception:
            return {'error': str(e.code) + ' ' + body[:300]}


def eszip_index(data):
    """index.ts source out of an ESZIP2.x bundle (what the Management API returns as a function body)."""
    import struct
    u32 = lambda p: struct.unpack('>I', data[p:p + 4])[0]
    pos = 8
    if data[:8] != b'ESZIP_V2':
        olen = u32(pos); pos += 4 + olen  # options section (2.1+)
        # the options may be followed by a hash; find the header length by trying hash sizes
        cands = [0, 32, 8]
    else:
        cands = [0]
    for ohash in cands:
        hp = pos + ohash
        hlen = u32(hp)
        if not (16 < hlen < 50_000_000):
            continue
        p = hp + 4; end = p + hlen; entries = []
        try:
            while p < end:
                sl = u32(p); p += 4; spec = data[p:p + sl].decode('utf-8', 'replace'); p += sl
                kind = data[p]; p += 1
                if kind == 0:
                    so, sln, mo, mln = struct.unpack('>IIII', data[p:p + 16]); p += 16; mk = data[p]; p += 1
                    entries.append((spec, so, sln))
                elif kind == 1:
                    tl = u32(p); p += 4 + tl
                elif kind == 2:
                    tl = u32(p); p += 4 + tl
                else:
                    break  # an entry shape this parser does not know; the first entries are what matter
        except Exception:
            pass
        want = [e for e in entries if e[0].endswith('index.ts') and not e[0].startswith('http') and not e[0].startswith('npm:') and not e[0].startswith('jsr:')]
        if not want:
            continue
        spec, so, sln = want[0]
        # sections after the header (npm snapshot, sources, source maps): walk until the sources section
        p = end
        for _ in range(6):
            for hhash in (0, 32, 8):
                q = p + hhash
                if q + 4 > len(data):
                    break
                slen = u32(q)
                chunk = data[q + 4 + so: q + 4 + so + sln]
                try:
                    text = chunk.decode('utf-8')
                except Exception:
                    text = None
                if text is not None and len(chunk) == sln and (text.startswith('//') or text.startswith('import') or text.startswith('/*')):
                    return text
                if 0 < slen < len(data) - q:
                    p = q + 4 + slen
                    break
            else:
                break
    raise ValueError('index.ts not found in bundle')


def get(name):
    out = call({'action': 'get', 'name': name})
    if not out.get('ok'):
        print(name + ': ' + str(out.get('error'))); return False
    d = os.path.join(ROOT, 'fn', name); os.makedirs(d, exist_ok=True)
    if out.get('bundle_b64'):
        import base64
        source = eszip_index(base64.b64decode(out['bundle_b64']))
    else:
        source = out['source']
    out['source'] = source
    open(os.path.join(d, 'index.ts'), 'w').write(source)
    json.dump({'verify_jwt': out['verify_jwt'], 'version': out['version'], 'content_type': out.get('content_type')}, open(os.path.join(d, 'meta.json'), 'w'))
    print('%s: v%s, verify_jwt=%s, %d bytes -> fn/%s/index.ts' % (name, out['version'], out['verify_jwt'], len(out['source']), name))
    return True


def deploy(name, verify=None):
    p = os.path.join(ROOT, 'fn', name, 'index.ts')
    src = open(p).read()
    if verify is None:
        mp = os.path.join(ROOT, 'fn', name, 'meta.json')
        if os.path.exists(mp):
            verify = json.load(open(mp)).get('verify_jwt')
    payload = {'action': 'deploy', 'name': name, 'source': src}
    if verify is not None:
        payload['verify_jwt'] = bool(verify)
    out = call(payload)
    if not out.get('ok'):
        print(name + ': FAILED ' + str(out.get('error'))); return False
    mp = os.path.join(ROOT, 'fn', name, 'meta.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {}
    meta.update({'verify_jwt': out['verify_jwt'], 'version': out['version']}); json.dump(meta, open(mp, 'w'))
    print('%s: deployed v%s (verify_jwt=%s, %d bytes)' % (name, out['version'], out['verify_jwt'], len(src)))
    return True


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'list':
        out = call({'action': 'list'})
        if not out.get('ok'):
            print(out.get('error')); sys.exit(1)
        for f in sorted(out['functions'], key=lambda x: x['slug']):
            print('%-22s v%-3s verify_jwt=%s' % (f['slug'], f['version'], f['verify_jwt']))
    elif a[0] == 'get':
        ok = all(get(n) for n in a[1:]); sys.exit(0 if ok else 1)
    elif a[0] == 'deploy':
        verify = None
        if '--verify-jwt' in a:
            i = a.index('--verify-jwt'); verify = a[i + 1].lower() == 'true'; a = a[:i] + a[i + 2:]
        sys.exit(0 if deploy(a[1], verify) else 1)
    elif a[0] == 'deploy-all':
        ok = all(deploy(n) for n in a[1:]); sys.exit(0 if ok else 1)
    else:
        print(__doc__); sys.exit(1)
