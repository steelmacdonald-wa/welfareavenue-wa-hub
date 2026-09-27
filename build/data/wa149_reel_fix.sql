-- wave149 review fixes (27/09/26): what an admin takes off stays off (across days and weeks); a rebuild replaces the
-- lines in one locked transaction (no duplicates, no empty moment, a hide made during a rebuild is kept); the change log
-- records which line was taken off without repeating its text; the news banner only shows today's news (or yesterday's
-- until the morning run).

/* one line per source in a day or a week */
create unique index if not exists hub_reel_one_per_source on public.hub_reel (kind, batch, source_key) where batch is not null and source_key is not null;

/* the lines of a kind set for a batch, replaced atomically; keys an admin took off in the last 120 days are skipped.
   Called by hub-reel (service role) only. p_rows: [{kind, text, link, source, source_key, sort, created_by}] */
create or replace function public.hub_reel_replace(p_kinds text[], p_batch date, p_rows jsonb) returns int
language plpgsql volatile security definer set search_path to '' as $$
declare v_n int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('hub_reel:' || array_to_string(p_kinds, ',') || ':' || p_batch::text));
  delete from public.hub_reel where kind = any (p_kinds) and batch = p_batch and not hidden;
  insert into public.hub_reel (batch, kind, text, link, source, source_key, sort, created_by)
  select p_batch, r.kind, left(r.text, 220), r.link, r.source, r.source_key, coalesce(r.sort, 0), r.created_by
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(kind text, text text, link text, source text, source_key text, sort int, created_by text)
   where r.kind = any (p_kinds) and char_length(coalesce(r.text, '')) between 3 and 220
     and (r.source_key is null or not exists (
       select 1 from public.hub_reel h where h.hidden and h.source_key = r.source_key and (h.batch = p_batch or h.hidden_at > now() - interval '120 days')))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.hub_reel_replace(text[], date, jsonb) from public, anon, authenticated;
grant execute on function public.hub_reel_replace(text[], date, jsonb) to service_role;
comment on function public.hub_reel_replace(text[], date, jsonb) is 'hub-reel only (service role): replaces the lines of the given kinds for a batch in one locked transaction, keeping what admins took off and skipping any source taken off in the last 120 days.';

/* the change log says which line, not its words (the log is readable by staff) */
create or replace function public.hub_reel_hide(p_id bigint, p_hidden boolean default true) returns void
language plpgsql volatile security definer set search_path to '' as $$
declare v_kind text; v_key text;
begin
  if not public.is_hub_admin() then raise exception 'admins only'; end if;
  update public.hub_reel set hidden = coalesce(p_hidden, true), hidden_by = case when coalesce(p_hidden, true) then public.wa_email() else null end,
         hidden_at = case when coalesce(p_hidden, true) then now() else null end
   where id = p_id returning kind, source_key into v_kind, v_key;
  if v_kind is null then raise exception 'no such line'; end if;
  /* a source put back is put back everywhere it was taken off */
  if not coalesce(p_hidden, true) and v_key is not null then
    update public.hub_reel set hidden = false, hidden_by = null, hidden_at = null where source_key = v_key and hidden and id <> p_id;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('hub_reel', p_id::text, case when coalesce(p_hidden, true) then 'taken off the loading screen' else 'put back on the loading screen' end, null, v_kind || coalesce(' ' || v_key, ''), public.wa_email());
end $$;

/* today's news, or yesterday's until the morning run; never older */
create or replace function public.hub_reel_current() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_week date; v_day date; v_lines jsonb; v_news jsonb;
begin
  if not (public.is_wa_staff() or public.is_board_viewer() or public.is_hub_admin()) then
    raise exception 'not allowed';
  end if;
  select max(batch) into v_week from public.hub_reel where kind in ('lesson', 'learning', 'milestone') and batch <= v_today and batch > v_today - 21;
  select max(batch) into v_day from public.hub_reel where kind = 'news' and batch between v_today - 1 and v_today;
  select coalesce(jsonb_agg(jsonb_build_object('k', r.kind, 't', r.text) order by r.sort, r.id), '[]'::jsonb) into v_lines
    from public.hub_reel r where r.kind in ('lesson', 'learning', 'milestone') and r.batch = v_week and not r.hidden;
  select coalesce(jsonb_agg(jsonb_build_object('t', x.text, 'link', x.link) order by x.o, x.sort, x.id), '[]'::jsonb) into v_news from (
    select 0 as o, u.sort, u.id, u.text, u.link from public.hub_reel u where u.kind = 'update' and not u.hidden and (u.until is null or u.until >= v_today)
    union all
    select 1, n.sort, n.id, n.text, n.link from public.hub_reel n where n.kind = 'news' and n.batch = v_day and not n.hidden
  ) x;
  return jsonb_build_object('week', v_week, 'day', v_today, 'lines', v_lines, 'news', v_news);
end $$;

notify pgrst, 'reload schema';
