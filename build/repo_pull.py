#!/usr/bin/env python3
"""Pull what changed on GitHub into the workspace (other sessions ship too).

  python3 build/repo_pull.py            # report: head, files that differ from the working tree
  python3 build/repo_pull.py --apply    # write the remote versions of changed/new files
  python3 build/repo_pull.py --apply build/src/ docs/   # only paths under these prefixes

Compares git blob shas of the remote tree with the local files; local files
that are not in the remote are left alone (report only). Uses the repo-sync
edge function (tree, get) with the trigger secret."""
import base64, hashlib, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FN = 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/repo-sync'
REPO = 'steelmacdonald-wa/welfareavenue-wa-hub'
ANON = open('/tmp/anon.key').read().strip()
SEC = open('/tmp/wa.secret').read().strip()
SKIP_PREFIX = ('test/c1', 'test/shots')


def call(body):
    req = urllib.request.Request(FN, data=json.dumps(body).encode(), method='POST', headers={'Authorization': 'Bearer ' + ANON, 'x-wa-secret': SEC, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def git_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def main():
    apply = '--apply' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    t = call({'action': 'tree', 'repo': REPO})
    if t.get('error'):
        print(t['error']); sys.exit(1)
    print('remote head %s  %s  (%s)' % (t['head'][:9], (t.get('message') or '').split('\n')[0][:90], t.get('date')))
    changed, new = [], []
    for f in t['files']:
        p = os.path.join(ROOT, f['path'])
        if f['path'].startswith(SKIP_PREFIX):
            continue
        if not os.path.exists(p):
            new.append(f); continue
        if git_sha(open(p, 'rb').read()) != f['sha']:
            changed.append(f)
    print('%d files differ, %d only on GitHub' % (len(changed), len(new)))
    for f in changed:
        print('  changed  %s (%s bytes)' % (f['path'], f.get('size')))
    for f in new:
        print('  new      %s (%s bytes)' % (f['path'], f.get('size')))
    if not apply:
        return
    for f in changed + new:
        if only and not any(f['path'].startswith(o) for o in only):
            continue
        b = call({'action': 'get', 'repo': REPO, 'sha': f['sha']})
        if b.get('error'):
            print('  FAILED ' + f['path'] + ': ' + b['error']); continue
        data = base64.b64decode(b['content_b64'])
        p = os.path.join(ROOT, f['path']); os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(data)
        print('  wrote   %s (%d bytes)' % (f['path'], len(data)))


if __name__ == '__main__':
    main()
