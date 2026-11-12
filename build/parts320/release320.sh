#!/usr/bin/env bash
# wave320 release helper (12/11/26). Run from the repo root.
#
#   build/parts320/release320.sh prepare
#       Fetches the live Hub page, builds the candidate on top of it, checks that every inline script parses,
#       runs the wave320 drive test and the regression drive tests, and writes:
#         /tmp/w320/step1.sql   the backup table and the short-lived stage table (guarded by the live md5)
#       Run step1.sql through the Supabase SQL tool, then:
#
#   build/parts320/release320.sh stage
#       Posts the candidate into the stage table in 10 parts (public key, insert only) and writes:
#         /tmp/w320/step2.sql   the gated release: checks every part, swaps the page, logs the release,
#                               drops the stage table and calls host-sync. One transaction.
#         build/parts320/wave320_undo.sql   the undo for exactly this release
#       Run step2.sql, then:
#
#   build/parts320/release320.sh verify
#       Reads the live site and compares it with the candidate.
#
# Nothing here sends a message to anyone. No secret is used: the stage table takes inserts with the public key
# for the few minutes between step 1 and step 2, and step 2 drops it.
set -euo pipefail
W=/tmp/w320; mkdir -p "$W" /tmp/live
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
KEY=${WA_ANON_KEY_FILE:-/tmp/anon.key}
export NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} WA_CHROME=${WA_CHROME:-/usr/bin/google-chrome}

case "${1:-}" in
prepare)
  curl -sS --max-time 90 https://hub.welfareavenue.com/ -o /tmp/live/index.html
  LIVE=$(md5sum /tmp/live/index.html | cut -d' ' -f1)
  if grep -q 'WA v320 ' /tmp/live/index.html; then echo "wave320 is already live ($LIVE)"; exit 1; fi
  python3 build/parts320/patch320.py /tmp/live/index.html "$W/candidate.html"
  CAND=$(md5sum "$W/candidate.html" | cut -d' ' -f1)
  node -e '
    const h = require("fs").readFileSync(process.argv[1], "utf8"); const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, n = 0;
    while ((m = re.exec(h))) { n++; if (/type="(application\/json|application\/ld\+json|text\/template)"/.test(m[0].slice(0, 90))) continue; new Function(m[1]); }
    console.log("inline scripts parse:", n);' "$W/candidate.html"
  CAND="$W/candidate.html" node test/w320drive.js "$W/shots" | tail -1
  for t in w272drive w306drive w310drive; do printf '%s: ' "$t"; CAND="$W/candidate.html" node "test/$t.js" "$W/shots_$t" | tail -1; done
  echo "$LIVE" > "$W/live.md5"; echo "$CAND" > "$W/cand.md5"
  cat > "$W/step1.sql" <<SQL
-- 12/11/26 - wave320 release, step 1: the backup for its undo, and a short-lived stage table. Made against the live Hub page $LIVE.
create table if not exists public.site_files_bak_wa320 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa320 enable row level security;
revoke all on public.site_files_bak_wa320 from anon, authenticated;
grant all on public.site_files_bak_wa320 to service_role;
comment on table public.site_files_bak_wa320 is 'wave320 (12/11/26): the Hub page before wave320 (md5 $LIVE), for its undo. Drop after a week.';
do \$bk\$ begin
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> '$LIVE' then raise exception 'live changed underneath'; end if;
  delete from public.site_files_bak_wa320;
  insert into public.site_files_bak_wa320 select path, part, content, updated_at from public.site_files where path = 'index.html';
end \$bk\$;
create table if not exists public.wa_stage_320 (part int primary key, content text not null, b64 boolean not null default false);
alter table public.wa_stage_320 enable row level security;
revoke all on public.wa_stage_320 from anon, authenticated;
delete from public.wa_stage_320;
drop policy if exists stage_ins on public.wa_stage_320;
create policy stage_ins on public.wa_stage_320 for insert to anon with check (true);
grant insert on public.wa_stage_320 to anon;
notify pgrst, 'reload schema';
comment on table public.wa_stage_320 is 'wave320 (12/11/26): the candidate Hub page, staged for the gated release. Insert only, for a few minutes. Step 2 drops it.';
select (select count(*) from public.site_files_bak_wa320) as bak_parts, (select md5(string_agg(content, '' order by part)) from public.site_files_bak_wa320) as bak_md5;
SQL
  echo "live $LIVE -> candidate $CAND ($(wc -c < "$W/candidate.html") bytes). Next: run $W/step1.sql, then '$0 stage'."
  ;;
stage)
  LIVE=$(cat "$W/live.md5"); CAND=$(cat "$W/cand.md5")
  [ "$(md5sum "$W/candidate.html" | cut -d' ' -f1)" = "$CAND" ] || { echo "the candidate changed since prepare"; exit 1; }
  # the REST layer learns about a new table a moment after it is made: wait until it answers for this one
  for i in $(seq 1 20); do
    CODE=$(curl -sS --max-time 20 -o "$W/probe.txt" -w '%{http_code}' "https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/wa_stage_320?select=part&limit=1" -H "apikey: $(cat "$KEY")" -H "Authorization: Bearer $(cat "$KEY")")
    if ! grep -q PGRST205 "$W/probe.txt"; then break; fi
    [ "$i" = 20 ] && { echo "the stage table is not there yet: has step1.sql run?"; exit 1; }
    sleep 2
  done
  python3 build/deploy_stage.py "$W/candidate.html" wa_stage_320 "$KEY" > "$W/stage.json"
  python3 - "$W/stage.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); bad = [p for p in d['posts'] if not (p[1] in ('200', '201') or p[2].endswith('201') or p[2].endswith('200'))]
print('parts posted:', len(d['posts']), 'failed:', bad)
sys.exit(1 if bad else 0)
PY
  python3 build/deploy_gate.py wa_stage_320 "$LIVE" "WA v320 ,window.__wa320" > "$W/gate.sql"
  python3 - "$W/gate.sql" "$W/step2.sql" "$LIVE" "$CAND" <<'PY'
import sys
gate, out, live, cand = open(sys.argv[1]).read(), sys.argv[2], sys.argv[3], sys.argv[4]
tail = "select public.call_edge('host-sync'"
i = gate.rindex(tail); do_block, last = gate[:i], gate[i:]
log = ("insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)\n"
       "values ('release', 'index.html', 'wave320', '%s', '%s: Ask the Hub reaches out (The Hub suggests, the daily note, Help me finish this, "
       "one-tap starter prompts), muted text darkened to pass AA, 44 px touch areas on a phone, tasks counted for a whole-word owner only', "
       "'Claude for Steel (12/11/26)');\n" % (live, cand))
drop = "drop table public.wa_stage_320;\n"
open(out, 'w').write("-- 12/11/26 - wave320 release, step 2: the gated swap. One transaction: if any check fails, nothing changes.\n" + do_block + log + drop + last)
PY
  cat > build/parts320/wave320_undo.sql <<SQL
-- 12/11/26 - wave320 undo (only if needed): puts back the Hub page from before wave320 ($LIVE).
-- It refuses when a later release sits on top of wave320, so that release is not undone by accident:
-- undo the later one first, or take the WA v320 block out with a new release.
do \$u\$ declare v text; begin
  if not exists (select 1 from public.site_files_bak_wa320) then raise exception 'no backup'; end if;
  select md5(string_agg(content, '' order by part)) into v from public.site_files where path = 'index.html';
  if v <> '$CAND' then raise exception 'the live page is not the wave320 page (%): a later release is on top', v; end if;
  update public.site_files f set content = b.content, updated_at = now() from public.site_files_bak_wa320 b where f.path = b.path and f.part = b.part and f.path = 'index.html';
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'index.html', 'wave320-undo', '$CAND', '$LIVE: wave320 undone, the page as it was before', 'Claude for Steel (12/11/26)');
end \$u\$;
select public.call_edge('host-sync', '{}'::jsonb) as rid, md5(string_agg(content, '' order by part)) as live_md5 from public.site_files where path = 'index.html';
SQL
  echo "staged. Next: run $W/step2.sql ($(wc -c < "$W/step2.sql") bytes), then '$0 verify'."
  ;;
verify)
  CAND=$(cat "$W/cand.md5")
  for i in 1 2 3 4 5 6; do
    NOW=$(curl -sS --max-time 90 https://hub.welfareavenue.com/ | md5sum | cut -d' ' -f1)
    if [ "$NOW" = "$CAND" ]; then echo "live is wave320: $NOW"; exit 0; fi
    echo "not yet ($NOW), waiting"; sleep 20
  done
  echo "the live site does not match the candidate $CAND"; exit 1
  ;;
*) sed -n '2,22p' "$0"; exit 1 ;;
esac
