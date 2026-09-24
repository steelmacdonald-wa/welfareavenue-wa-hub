#!/usr/bin/env python3
"""Push the hub workspace to GitHub through the repo-sync edge function.

Usage: repo_push.py "<commit message>" [--all]
The build sandbox cannot reach GitHub with its own credentials, so files go
to Supabase (repo-sync), which commits them with the vault GITHUB_TOKEN via
the Git Data API. Only files that changed since the last successful push are
sent (state in .pushed.json, git-ignored); --all resends everything.
Run it after the local git commit so both histories agree.
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "steelmacdonald-wa/welfareavenue-wa-hub"
BRANCH = "main"
FN = "https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/repo-sync"
STATE = os.path.join(ROOT, ".pushed.json")
SECRET_FILE = "/tmp/wa.secret"

msg = sys.argv[1] if len(sys.argv) > 1 else "hub update"
send_all = "--all" in sys.argv
secret = open(SECRET_FILE).read().strip()


def call(body):
    req = urllib.request.Request(FN, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", "x-wa-secret": secret})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def git_sha(data):
    h = hashlib.sha1()
    h.update(("blob %d\0" % len(data)).encode("ascii"))
    h.update(data)
    return h.hexdigest()


tracked = subprocess.run(["git", "-C", ROOT, "ls-files", "-z"], capture_output=True).stdout.decode("utf-8").split("\0")
tracked = [t for t in tracked if t]
pushed = {}
if os.path.exists(STATE) and not send_all:
    pushed = json.load(open(STATE))
current = {}
for p in tracked:
    with open(os.path.join(ROOT, p), "rb") as f:
        current[p] = git_sha(f.read())
changed = [p for p in tracked if pushed.get(p) != current[p]]
deletes = [p for p in pushed if p not in current]
print("files: %d tracked, %d to send, %d to delete" % (len(tracked), len(changed), len(deletes)))

entries = []
# blobs in batches under ~900 KB of base64
batch, size = [], 0
def flush():
    global batch, size
    if not batch:
        return
    res = call({"action": "blobs", "repo": REPO, "files": batch})
    if res.get("errors"):
        raise SystemExit("blob errors: " + json.dumps(res["errors"])[:500])
    for b in res["blobs"]:
        entries.append({"path": b["path"], "sha": b["sha"]})
    print("  blobs: %d sent" % len(batch))
    batch, size = [], 0

for p in changed:
    data = open(os.path.join(ROOT, p), "rb").read()
    b64 = base64.b64encode(data).decode("ascii")
    if size + len(b64) > 900_000 and batch:
        flush()
    batch.append({"path": p, "content_b64": b64})
    size += len(b64)
flush()

if not entries and not deletes:
    print("nothing to push")
    sys.exit(0)
for e in entries:
    assert current[e["path"]] == e["sha"], "sha mismatch for " + e["path"]
res = call({"action": "commit", "repo": REPO, "branch": BRANCH, "message": msg, "entries": entries, "deletes": deletes})
if "commit" not in res:
    raise SystemExit("commit failed: " + json.dumps(res)[:500])
json.dump(current, open(STATE, "w"), indent=0)
print("pushed", res["commit"][:10], res["url"], "(%d files, %d deletes%s)" % (res["files"], res["deletes"], ", first commit" if res.get("first_commit") else ""))
