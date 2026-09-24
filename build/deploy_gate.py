#!/usr/bin/env python3
"""Print the gated DO block for the staged parts (reads /tmp/deploy_manifest.json).
Usage: deploy_gate.py <stage_table> <expected_live_md5> <marker1,marker2,...>
"""
import json, sys
table, live, markers = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
m = json.load(open("/tmp/deploy_manifest.json"))
md5s = ",".join("'%s'" % p["md5"] for p in m["parts"]); lens = ",".join(str(p["len"]) for p in m["parts"])
marks = " or ".join("position('%s' in v_assembled) = 0" % k for k in markers)
print(f"""do $$
declare
  v_live_md5 text; v_assembled text := ''; v_content text;
  v_exp_md5 text[] := array[{md5s}];
  v_exp_len int[] := array[{lens}];
  v_parts text[] := array[]::text[]; v_md5 text; i int;
begin
  select md5(string_agg(content, '' order by part)) into v_live_md5 from public.site_files where path = 'index.html';
  if v_live_md5 <> '{live}' then raise exception 'live changed underneath: %', v_live_md5; end if;
  for i in 1..10 loop
    select case when b64 then convert_from(decode(content, 'base64'), 'UTF8') else content end into v_content from public.{table} where part = i or part = 100 + i order by part limit 1;
    if v_content is null then raise exception 'part % missing', i; end if;
    if md5(v_content) <> v_exp_md5[i] or octet_length(v_content) <> v_exp_len[i] then raise exception 'part % mismatch', i; end if;
    v_parts := v_parts || v_content; v_assembled := v_assembled || v_content;
  end loop;
  if md5(v_assembled) <> '{m["total_md5"]}' or octet_length(v_assembled) <> {m["total_len"]} then raise exception 'assembled mismatch'; end if;
  if right(v_assembled, 8) <> E'</html>\\n' then raise exception 'tail mismatch'; end if;
  if {marks} then raise exception 'wave markers missing'; end if;
  if position('#2c7a66' in v_assembled) > 0 then raise exception 'legacy palette present'; end if;
  for i in 1..10 loop
    update public.site_files set content = v_parts[i], updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'site_files part % not found', i; end if;
  end loop;
  select md5(string_agg(content, '' order by part)) into v_md5 from public.site_files where path = 'index.html';
  if v_md5 <> '{m["total_md5"]}' then raise exception 'post-check failed: %', v_md5; end if;
end $$;
select public.call_edge('host-sync', '{{}}'::jsonb) as rid, md5(string_agg(content, '' order by part)) as live_md5 from public.site_files where path = 'index.html';""")
