import hashlib
src = open('/home/claude/live/index.html', encoding='utf-8').read()
cand = open('build/candidate.html', encoding='utf-8').read()
code = open('build/parts314/manage.js', encoding='utf-8').read()
O1 = "Open Ads Manager</a></p>';\n  }\n\n  /* ---------- Connections: Meta live, and WhatsApp ---------- */"
N1 = "Open Ads Manager</a></p>' + manage314();\n  }\n" + code + "\n  /* ---------- Connections: Meta live, and WhatsApp ---------- */"
O2 = " clicks. Read-only from Meta\\u2019s ad accounts; the Hub never changes an ad.</p></div>';"
N2 = " clicks. ' + (M314.lead ? 'From Meta\\u2019s ad accounts; marketing leads manage them below.' : 'Read-only from Meta\\u2019s ad accounts.') + '</p></div>';"
def q(tag, s):
    assert ('$%s$' % tag) not in s
    return '$%s$%s$%s$' % (tag, s, tag)
m0 = hashlib.md5(src.encode()).hexdigest(); m1 = hashlib.md5(cand.encode()).hexdigest()
sql = f"""-- 13/11/26 - wave314 release: Manage ads in the Content Studio (Paid), for marketing leads only.
-- One transaction: if any check fails, nothing changes. Made against the live Hub page {m0}; result {m1}.
-- Already live before this file: the edge function social-ads-manage (v1), the function wa314_ads_lead / wa314_ads_leads,
-- the table social_ad_actions and hub_settings studio_ads_limits (migration wave314_ads_manage).
-- Safe to paste from Windows: line endings are normalised (v2, 13/11/26).
-- Nobody is messaged by this release. Undo: "13-11-26 - wave314 undo (only if needed).sql".
create table if not exists public.site_files_bak_wa314 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa314 enable row level security;
revoke all on public.site_files_bak_wa314 from anon, authenticated;
grant all on public.site_files_bak_wa314 to service_role;
comment on table public.site_files_bak_wa314 is 'wave314 (13/11/26): index.html before wave314, for its undo. Drop after a week.';
do $bk$ begin
  if not exists (select 1 from public.site_files_bak_wa314) then
    insert into public.site_files_bak_wa314 select path, part, content, updated_at from public.site_files where path = 'index.html';
  end if;
end $bk$;
do $pg$
declare v text; v_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[replace({q('o1', O1)}, chr(13), ''), replace({q('o2', O2)}, chr(13), '')];
  news text[] := array[replace({q('n1', N1)}, chr(13), ''), replace({q('n2', N2)}, chr(13), '')];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'index.html';
  if v is null then raise exception 'index.html not found'; end if;
  if (select count(*) from public.site_files where path = 'index.html') <> 10 then raise exception 'index.html is not in 10 parts'; end if;
  if position('WA v314 ' in v) > 0 then raise exception 'index.html already has wave314'; end if;
  if md5(v) <> '{m0}' then raise notice 'index.html has moved since this file was made (md5 %): the edits apply only if each still matches once', md5(v); end if;
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i];
    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'index.html: edit % matches % times, nothing changed', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v) = '{m0}' and md5(v_new) <> '{m1}' then raise exception 'index.html: unexpected result %', md5(v_new); end if;
  sz := ceil(length(v_new) / 10.0);
  for i in 1..10 loop
    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'index.html part % missing', i; end if;
  end loop;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> md5(v_new) then raise exception 'index.html: post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave314', md5(v), md5(v_new) || ': Manage ads in the Content Studio (Paid), marketing leads only', 'Claude for Steel (13/11/26)');
end $pg$;
select public.call_edge('host-sync', '{{}}'::jsonb) as host_sync, (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5;
"""
open('build/parts314/release.sql', 'w', encoding='utf-8').write(sql)
undo = """-- 13/11/26 - wave314 undo: puts index.html back as it was before wave314 and publishes it. Run only if needed.
-- The edge function social-ads-manage stays (only marketing leads can call it); to switch it off as well, delete it in
-- Supabase, Edge Functions. The table social_ad_actions keeps the record of what was done.
do $u$ begin
  if not exists (select 1 from public.site_files_bak_wa314) then raise exception 'no wave314 backup'; end if;
  update public.site_files f set content = b.content, updated_at = now() from public.site_files_bak_wa314 b where f.path = b.path and f.part = b.part;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave314 undo', null, (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html'), 'Claude for Steel (13/11/26)');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
"""
open('build/parts314/undo.sql', 'w', encoding='utf-8').write(undo)
print(len(sql))
