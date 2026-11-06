#!/usr/bin/env python3
"""Print one SQL block that runs committed SQL files against the live database and then throws it all away.

Usage: python3 build/sql_rollback_test.py <commit-sha> <repo/path/one.sql> [<repo/path/two.sql> ...]

For each file, in order, the block fetches the file from GitHub at that exact commit (the Hub repo is public),
checks the HTTP status and the md5 of what came back against `git show <sha>:<path>`, and EXECUTEs it. When
every file has run (migrations first, then the test files, whose assertions raise on failure), the block
raises ROLLBACK_OK, so Postgres rolls back everything: nothing is kept, no cron job is left, no pg_net
request is sent (pg_net only sends after a commit).

Paste the printed SQL into the Supabase connector's execute_sql. Reading the result:
  - "ROLLBACK_OK ..."            every file ran and every assertion passed; nothing was kept.
  - any other error              the first failure (a bad statement or a failed assertion); nothing was kept.
  - success with no error        impossible by construction; if it ever happens, stop and tell the controller.

Rules for the files it runs: no transaction control (BEGIN, COMMIT, ROLLBACK), no CREATE INDEX CONCURRENTLY,
no VACUUM. Push the commit first (git push origin HEAD) so GitHub can serve it.
"""
import hashlib
import subprocess
import sys

REPO_RAW = "https://raw.githubusercontent.com/steelmacdonald-wa/welfareavenue-wa-hub"


def blob(sha, path):
    return subprocess.run(["git", "show", f"{sha}:{path}"], capture_output=True, check=True).stdout


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    sha, paths = sys.argv[1], sys.argv[2:]
    if len(sha) != 40:
        sha = subprocess.run(["git", "rev-parse", sha], capture_output=True, text=True, check=True).stdout.strip()
    out = ["do $rbt$", "declare r record;", "begin"]
    for p in paths:
        data = blob(sha, p)
        if b"\r\n" in data:
            sys.exit(f"{p} has CRLF line endings at {sha}; commit it with LF")
        md5 = hashlib.md5(data).hexdigest()
        url = f"{REPO_RAW}/{sha}/{p}".replace(" ", "%20")
        out += [
            f"  select status, content into r from extensions.http_get('{url}');",
            f"  if r.status <> 200 then raise exception 'fetch failed (%): {p}', r.status; end if;",
            f"  if md5(r.content) <> '{md5}' then raise exception 'md5 mismatch: {p}'; end if;",
            "  execute r.content;",
            f"  raise notice 'ran {p}';",
        ]
    out += [
        f"  raise exception 'ROLLBACK_OK: {len(paths)} file(s) ran and every assertion passed; nothing was kept';",
        "end $rbt$;",
    ]
    print("\n".join(out))


if __name__ == "__main__":
    main()
