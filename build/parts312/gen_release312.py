#!/usr/bin/env python3
"""wave312: writes the release SQL and its undo (run in the Supabase SQL editor, one transaction each)."""
import json, hashlib
md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
live = open('/tmp/hub2.html', encoding='utf-8').read()
cand = open('/tmp/cand2.html', encoding='utf-8').read()
flive = open('/tmp/f.html', encoding='utf-8').read()
fnew = open('/home/claude/welfareavenue-wa-hub/build/f/index.html', encoding='utf-8').read()
E = json.load(open('/home/claude/w312/edits.json'))
db = open('/home/claude/w312/db312.sql', encoding='utf-8').read()

# the f page's three edits, found by comparing (each must match once)
FE = [
  ("<!-- Welfare Avenue: the public page of the CRM's forms (wave156, 28/09/26).", "<!-- Welfare Avenue: the public page of the CRM's forms (wave156, 28/09/26; wave312, 12/11/26: a donate button on the thank-you when the form asks for one)."),
  (".done .heart{position:absolute;right:-6px;top:-10px;width:70px;height:auto;transform:rotate(10deg)}\n",
   ".done .heart{position:absolute;right:-6px;top:-10px;width:70px;height:auto;transform:rotate(10deg)}\n.done .give{display:inline-block;font-weight:600;font-size:17px;border-radius:999px;padding:13px 28px;background:var(--gold);color:var(--ink);text-decoration:none;margin:4px 0 6px;transition:transform 160ms cubic-bezier(.23,1,.32,1)}\n.done .give:active{transform:scale(.97)}\n.done .give:focus-visible{outline:3px solid var(--green);outline-offset:3px}\n"),
  ("<p>' + E(msg) + '</p><p><a href=\"https://welfareavenue.com\">'",
   "<p>' + E(msg) + '</p>' + (S.form && S.form.donate && /^https:\\/\\/hub\\.welfareavenue\\.com\\/give/.test(S.form.donate.url) ? '<p><a class=\"give\" href=\"' + E(S.form.donate.url) + '\" target=\"_blank\" rel=\"noopener\">' + E(S.form.donate.label) + '</a></p>' : '') + '<p><a href=\"https://welfareavenue.com\">'"),
]
x = flive
for o, n in FE:
    assert x.count(o) == 1, o[:60]
    x = x.replace(o, n)
assert x == fnew, 'f page edits do not reproduce build/f/index.html'

def arr(name, items, tag):
    return '  ' + name + ' text[] := array[' + ',\n    '.join("replace($%s%d$%s$%s%d$, chr(13), '')" % (tag, i, s, tag, i) for i, s in enumerate(items)) + '];\n'

def applier(path, parts, items, before, after, label):
    olds = [o for o, n in items]; news = [n for o, n in items]
    for i, s in enumerate(olds + news):
        for t in ('o', 'n'):
            assert ('$%s%d$' % (t, i)) not in s
    split = ("  sz := ceil(length(v_new) / %d.0);\n  for i in 1..%d loop\n    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = '%s' and part = i;\n    if not found then raise exception '%s part %% missing', i; end if;\n  end loop;\n" % (parts, parts, path, path)) if parts > 1 else \
            ("  update public.site_files set content = v_new, updated_at = now() where path = '%s';\n  if not found then raise exception '%s missing'; end if;\n" % (path, path))
    return ("do $pg$\ndeclare v text; v_new text; n int; i int; sz int; o text; nw text;\n" + arr('olds', olds, 'o') + arr('news', news, 'n') +
      "begin\n  select string_agg(content, '' order by part) into v from public.site_files where path = '%s';\n" % path +
      "  if v is null then raise exception '%s not found'; end if;\n" % path +
      "  if position('wave312' in v) > 0 then raise exception '%s already has wave312'; end if;\n" % path +
      "  if md5(v) <> '%s' then raise notice '%s has moved since this file was made (md5 %%): the edits apply only if each still matches exactly once', md5(v); end if;\n" % (before, path) +
      "  v_new := v;\n  for i in 1..array_length(olds, 1) loop\n    o := olds[i]; nw := news[i];\n    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);\n" +
      "    if n <> 1 then raise exception '%s: edit %% matches %% times, nothing changed', i, n; end if;\n    v_new := replace(v_new, o, nw);\n  end loop;\n" % path +
      "  if md5(v) = '%s' and md5(v_new) <> '%s' then raise exception '%s: unexpected result %%', md5(v_new); end if;\n" % (before, after, path) +
      "  if right(v_new, 8) <> E'</html>\\n' then raise exception '%s: tail mismatch'; end if;\n" % path + split +
      "  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = '%s') <> md5(v_new) then raise exception '%s: post-check failed'; end if;\n" % (path, path) +
      "  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', '%s', 'wave312', md5(v), md5(v_new) || ': %s', 'Claude for Steel (12/11/26)');\nend $pg$;\n" % (path, label))

head = """-- 12/11/26 - wave312 release: Campaigns in the CRM, Email insights, buttons to a form or the donation page, a form's donate
-- button, the photo albums, and the Content Studio's "it went out" notice for Ian, KK and the sender.
--
-- STEP 1 FIRST (Supabase dashboard, Edge Functions): replace each function's index.ts with its one line, then Deploy.
--   social-publish (verify JWT off, as now):
--     import 'https://raw.githubusercontent.com/steelmacdonald-wa/welfareavenue-wa-hub/%(sha)s/fn/social-publish/index.ts';
--   form-submit (verify JWT on, as now):
--     import 'https://raw.githubusercontent.com/steelmacdonald-wa/welfareavenue-wa-hub/%(sha)s/fn/form-submit/index.ts';
--   social-publish must be v7 before this file runs: the new trigger asks it for the "went out" notice, which v6 does not know.
--
-- STEP 2: run this whole file once in the SQL editor (project zwnmulmnvopclzcvytce). One transaction: if any check fails,
-- nothing changes. Made against the live Hub page %(live)s (after wave309) and f/index.html %(flive)s.
-- What it does:
--   1. keeps a copy of today's pages (table site_files_bak_wa312, for the undo)
--   2. the database: wa_campaigns' folder columns, wa312_campaigns, wa312_campaign_save, wa312_mail_insights, wa_photo_albums,
--      the trigger trg_wa312_post_out, two page tours, and the folders we know (Gift Basket Drive 2026, One Bag Challenge 2026,
--      Rally Paper 2026, Football Fundraiser 2026)
--   3. the Hub page (index.html) and the public form page (f/index.html)
--   4. publishes through host-sync (about a minute).
-- Nobody is messaged by any of this. Undo: "12-11-26 - wave312 undo (only if needed).sql".

create table if not exists public.site_files_bak_wa312 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa312 enable row level security;
revoke all on public.site_files_bak_wa312 from anon, authenticated;
grant all on public.site_files_bak_wa312 to service_role;
comment on table public.site_files_bak_wa312 is 'wave312 (12/11/26): index.html and f/index.html before wave312, for its undo. Drop after a week.';
do $bk$
begin
  if not exists (select 1 from public.site_files_bak_wa312) then
    insert into public.site_files_bak_wa312 select path, part, content, updated_at from public.site_files where path in ('index.html', 'f/index.html');
  end if;
end $bk$;

-- 2. the database
"""
sha = open('/tmp/w312sha').read().strip()
out = head % {'sha': sha, 'live': md5(live), 'flive': md5(flive)} + db + "\n\n-- 3. the Hub page and the public form page\n" + \
  applier('index.html', 10, E, md5(live), md5(cand), 'Campaigns and Email insights in the CRM, buttons to a form or the donation page, the donate button on forms, the photo albums') + \
  applier('f/index.html', 1, FE, md5(flive), md5(fnew), 'a donate button on the thank-you') + \
  "\n-- 4. publish\nselect public.call_edge('host-sync', '{}'::jsonb) as host_sync,\n  (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5,\n  (select md5(content) from public.site_files where path = 'f/index.html') as form_md5;\n"
open('/home/claude/w312/release312.sql', 'w', encoding='utf-8').write(out)

undo = """-- 12/11/26 - wave312 undo (only if needed). Run the whole file once in the SQL editor: it puts index.html and f/index.html back
-- as they were before wave312 (from site_files_bak_wa312), removes the new trigger, functions and page tours, and publishes.
-- It keeps what people typed into the campaign folders (the wa_campaigns columns stay, harmless to older pages) and the listed
-- photo albums. Then, in the dashboard, deploy social-publish and form-submit again from their previous lines:
--   social-publish: the v6 source (deployed version 16 before wave312; build/fn.py get, or the repo at 57f51706)
--   form-submit:    import 'https://raw.githubusercontent.com/steelmacdonald-wa/welfareavenue-wa-hub/57f51706dc948eb3fa0648b758f5e14e9d3e9179/fn/form-submit/index.ts';
do $u$
begin
  if not exists (select 1 from public.site_files_bak_wa312 where path = 'index.html') then raise exception 'no wave312 backup: nothing changed'; end if;
  update public.site_files s set content = b.content, updated_at = now() from public.site_files_bak_wa312 b where s.path = b.path and s.part = b.part;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> '%(live)s' then raise exception 'index.html did not come back as before'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave312 undo', null, '%(live)s', 'Claude for Steel (undo)');
end $u$;
drop trigger if exists trg_wa312_post_out on public.content_posts;
drop function if exists public.wa312_post_out();
drop function if exists public.wa312_campaigns(bigint);
drop function if exists public.wa312_campaign_save(jsonb);
drop function if exists public.wa312_mail_insights(integer);
delete from public.trainings where key in ('tour:crmcampaigns', 'tour:crminsights') and not exists (select 1 from public.training_progress p where p.training_id = trainings.id);
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
""" % {'live': md5(live)}
open('/home/claude/w312/undo312.sql', 'w', encoding='utf-8').write(undo)
print('release', len(out), 'undo', len(undo), 'cand', md5(cand), 'fnew', md5(fnew))
