-- =====================================================================
-- wave240 (15/10/26): content for each serving
-- =====================================================================
-- Steel, 14/10/26 marketing meeting (Ian: "we don't have someone to take pictures"; Roberto's LinkedIn questions kept apart
-- from the Instagram and TikTok ones; a throwback to the last time with Oberoi; the photos go to the Google Photos album):
-- 1. volunteer_events.photos_album_url: the serving's own Google Photos album (made by hand in Google Photos; the Photos
--    API no longer shares albums). The photographer's page links it in place of the shared album, and the photographer's
--    confirmation text names it. volunteer_events.content_brief: the LinkedIn questions, the Instagram and TikTok
--    questions and the shot notes, shown to photographers and videographers on their page.
-- 2. wa240_event_content_set(event, {album_url, brief}): staff set both from the serving page.
-- 3. wa240_photo_check() (cron wa-photo-check, daily 14:15 UTC): within 5 days of a serving with no photographer or
--    videographer confirmed, a task "Book a photographer for the serving on <day>" for the SOP's photographer owner, due
--    the day before (a Slack DM through notify's task_reassigned, a Hub notification through hub-push). The task closes
--    itself once one confirms. Then wa240_event_ideas().
-- 4. wa240_event_ideas(event): for a serving with a partner organization, a Throwback idea (when they served with us
--    before; two days ahead) and a Recap idea (the day after), as Content Studio drafts suggested by the Hub.
-- volunteer_confirm_get and wa171_confirm_text are patched in place from their live definitions. No row deleted.
-- =====================================================================

alter table public.volunteer_events add column if not exists photos_album_url text;
alter table public.volunteer_events add column if not exists content_brief jsonb not null default '{}'::jsonb;
comment on column public.volunteer_events.photos_album_url is 'wave240: the serving''s Google Photos album (made by hand); the photographer''s page and text use it';
comment on column public.volunteer_events.content_brief is 'wave240: {linkedin, social, notes, updated_by, updated_at}: the questions and shot notes for the photographer and videographer';

-- ---------- 2. staff set the album and the brief ----------
create or replace function public.wa240_event_content_set(p_event bigint, p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text; v_album text; e record; v_brief jsonb;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'not allowed'; end if;
  v_who := coalesce(auth.jwt() ->> 'email', 'staff');
  select id, photos_album_url, content_brief into e from public.volunteer_events where id = p_event;
  if not found then raise exception 'no such serving'; end if;
  if p ? 'album_url' then
    v_album := nullif(btrim(p ->> 'album_url'), '');
    if v_album is not null and v_album !~ '^https://[^ ]+$' then raise exception 'The album link must start with https://'; end if;
    update public.volunteer_events set photos_album_url = v_album where id = p_event;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', p_event::text, 'photos_album_url', e.photos_album_url, v_album, v_who);
  end if;
  if p ? 'brief' then
    v_brief := coalesce(e.content_brief, '{}'::jsonb)
      || jsonb_build_object('linkedin', left(coalesce(p #>> '{brief,linkedin}', coalesce(e.content_brief ->> 'linkedin', '')), 4000),
                            'social', left(coalesce(p #>> '{brief,social}', coalesce(e.content_brief ->> 'social', '')), 4000),
                            'notes', left(coalesce(p #>> '{brief,notes}', coalesce(e.content_brief ->> 'notes', '')), 4000),
                            'updated_by', v_who, 'updated_at', now());
    update public.volunteer_events set content_brief = v_brief where id = p_event;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', p_event::text, 'content_brief', null, 'the content brief was saved (' || length(coalesce(v_brief ->> 'linkedin', '')) + length(coalesce(v_brief ->> 'social', '')) + length(coalesce(v_brief ->> 'notes', '')) || ' characters)', v_who);
  end if;
  select photos_album_url, content_brief into e from public.volunteer_events where id = p_event;
  return jsonb_build_object('ok', true, 'album_url', e.photos_album_url, 'brief', e.content_brief);
end $$;

-- ---------- 1. the photographer's page carries the serving's album and brief ----------
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'volunteer_confirm_get';
  if position('photos_album_url' in d) > 0 then return; end if;
  d := replace(d, E'         coalesce(e.start_time, \'12:00\'::time) as start_time\n    into r\n',
                  E'         coalesce(e.start_time, \'12:00\'::time) as start_time, e.photos_album_url, e.content_brief\n    into r\n');
  d := replace(d, E'    \'guide\', jsonb_build_object(\'expect_en\', to_jsonb(g.expect_en), \'expect_fr\', to_jsonb(g.expect_fr),\n       \'bring_en\', g.bring_en, \'bring_fr\', g.bring_fr, \'arrive_en\', g.arrive_en, \'arrive_fr\', g.arrive_fr, \'links\', g.links));',
$s$    -- wave240: photographers and videographers see the serving's own album and its content brief
    'album_url', case when lower(r.role) in ('photographer', 'videographer') then nullif(btrim(coalesce(r.photos_album_url, '')), '') end,
    'brief', case when lower(r.role) in ('photographer', 'videographer') and coalesce(r.content_brief, '{}'::jsonb) <> '{}'::jsonb then r.content_brief end,
    'guide', jsonb_build_object('expect_en', to_jsonb(g.expect_en), 'expect_fr', to_jsonb(g.expect_fr),
       'bring_en', g.bring_en, 'bring_fr', g.bring_fr, 'arrive_en', g.arrive_en, 'arrive_fr', g.arrive_fr,
       'links', case when lower(r.role) in ('photographer', 'videographer') and nullif(btrim(coalesce(r.photos_album_url, '')), '') is not null
                     then (select coalesce(jsonb_agg(case when l ->> 'url' like 'https://photos.app.goo.gl/%' then l || jsonb_build_object('url', btrim(r.photos_album_url)) else l end), '[]'::jsonb) from jsonb_array_elements(coalesce(g.links, '[]'::jsonb)) l)
                     else g.links end));$s$);
  if position('photos_album_url' in d) = 0 or position('''brief'', case' in d) = 0 then raise exception 'volunteer_confirm_get: an anchor was not found'; end if;
  execute d;
end $$;

-- the photographer's confirmation text names the serving's album when it has one
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'wa171_confirm_text';
  if position('v_album' in d) > 0 then return; end if;
  d := replace(d, 'declare r record; v_lang text; v_first text; v_role text; v_day text; v_link text; v_art text;',
                  'declare r record; v_lang text; v_first text; v_role text; v_day text; v_link text; v_art text; v_album text;');
  d := replace(d, E'  v_lang := public.wa171_lang(r.person_id);\n',
$s$  v_lang := public.wa171_lang(r.person_id);
  if lower(r.role) in ('photographer', 'videographer') then   -- wave240: the serving's own album
    select nullif(btrim(e.photos_album_url), '') into v_album from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  end if;
$s$);
  d := replace(d, '|| v_link || '' (ou répondez OUI ou NON). Répondez ARRET pour ne plus recevoir de textos.'';',
                  '|| v_link || '' (ou répondez OUI ou NON). Répondez ARRET pour ne plus recevoir de textos.'' || case when v_album is not null then '' Album pour vos photos : '' || v_album else '''' end;');
  d := replace(d, '|| v_link || '' (or reply YES or NO). Reply STOP to stop texts.'';',
                  '|| v_link || '' (or reply YES or NO). Reply STOP to stop texts.'' || case when v_album is not null then '' Album for your photos: '' || v_album else '''' end;');
  if position('Album for your photos' in d) = 0 or position('Album pour vos photos' in d) = 0 then raise exception 'wa171_confirm_text: an anchor was not found'; end if;
  execute d;
end $$;

-- ---------- 4. throwback and recap ideas for a serving with a partner organization ----------
create or replace function public.wa240_event_ideas(p_event bigint default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare ev record; v_today date := (now() at time zone 'America/Toronto')::date; n int := 0; v_partner text; v_words text; v_prev_n int; v_prev date; v_camp text;
begin
  if session_user = 'authenticator' and coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.is_wa_staff(), false) then raise exception 'not allowed'; end if;
  for ev in select e.id, e.event_date, e.title, e.location, e.photos_album_url, p.partner_name, p.partner_id
             from public.volunteer_events e join public.volunteer_event_partners p on p.event_id = e.id and coalesce(p.active, true)
            where e.kind = 'service' and coalesce(e.status, '') not in ('cancelled') and nullif(btrim(coalesce(p.partner_name, '')), '') is not null
              and ((p_event is null and e.event_date between v_today - 1 and v_today + 10) or e.id = p_event)
            order by e.event_date loop
    v_partner := btrim(ev.partner_name); v_camp := v_partner || ' collaboration';
    v_words := to_char(ev.event_date, 'FMDay DD FMMonth');
    select count(*), max(x.event_date) into v_prev_n, v_prev
      from public.volunteer_events x left join public.volunteer_event_partners q on q.event_id = x.id
     where x.id <> ev.id and x.event_date < ev.event_date and x.kind = 'service' and coalesce(x.status, '') <> 'cancelled'
       and ((ev.partner_id is not null and q.partner_id = ev.partner_id) or lower(coalesce(q.partner_name, '')) = lower(v_partner)
            or x.title ilike '%' || split_part(v_partner, ' ', 1) || '%');
    -- the throwback, two days ahead, when they served with us before
    if v_prev_n > 0 and ev.event_date >= v_today
       and not exists (select 1 from public.content_posts c where c.suggested_by = 'the Hub' and c.campaign = v_camp and c.title ilike 'Throwback%' and c.idea_for = ev.event_date - 2) then
      insert into public.content_posts (title, platforms, format, caption, notes, status, suggested_by, idea_for, campaign, created_by, updated_by)
      values ('Throwback: last time with ' || v_partner || ' (' || to_char(v_prev, 'FMDD FMMonth YYYY') || ')', array['linkedin', 'instagram', 'facebook'], 'post',
              'Throwback to ' || to_char(v_prev, 'FMMonth YYYY') || ', the last time ' || v_partner || ' served with us. This ' || to_char(ev.event_date, 'FMDay') || ' we are back together at ' || coalesce(nullif(ev.location, ''), 'the serving') || '. Stay tuned.',
              'Post it a day or two before ' || v_words || '. Photos from ' || to_char(v_prev, 'FMDD FMMonth YYYY') || ': the photo library, or the Google Drive (ask Ian). Say what we did last time and what is coming, with the partner tagged. The LinkedIn version can run longer (a short article). ' || v_prev_n || ' past serving' || case when v_prev_n = 1 then '' else 's' end || ' with them.',
              'draft', 'the Hub', ev.event_date - 2, v_camp, 'the Hub', 'the Hub');
      n := n + 1;
    end if;
    -- the recap, the day after, made from the day before the serving
    if ev.event_date - v_today <= 1
       and not exists (select 1 from public.content_posts c where c.suggested_by = 'the Hub' and c.campaign = v_camp and c.title ilike 'Recap%' and c.idea_for = ev.event_date + 1) then
      insert into public.content_posts (title, platforms, format, caption, notes, status, suggested_by, idea_for, campaign, created_by, updated_by)
      values ('Recap: ' || v_partner || ' served with us on ' || v_words, array['linkedin', 'instagram', 'facebook'], 'post',
              'Thank you ' || v_partner || '! On ' || v_words || ' their team served with us at ' || coalesce(nullif(ev.location, ''), 'the serving') || '. [meals] meals and [volunteers] volunteers: fill in from the serving run.',
              'Photos: ' || coalesce(ev.photos_album_url, 'the shared Google Photos album (the photographer adds them within 24 hours)') || '. The numbers (meals, volunteers) come from the serving run on the day. LinkedIn: the longer thank-you with the partner tagged. Instagram and TikTok: the best clips and one question answered by their volunteers (the content brief on the serving page has the questions).',
              'draft', 'the Hub', ev.event_date + 1, v_camp, 'the Hub', 'the Hub');
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('added', n);
end $$;

-- ---------- 3. the photographer check ----------
create or replace function public.wa240_photo_check()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare e record; v_today date := (now() at time zone 'America/Toronto')::date; v_days int; v_owner jsonb; v_name text; v_tid bigint; v_mid bigint;
        v_booked boolean; v_marker text; v_words text; v_desc text; n_tasks int := 0; n_closed int := 0; n_ideas int := 0; k int;
begin
  if session_user = 'authenticator' and coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.is_wa_admin(), false) then raise exception 'not allowed'; end if;
  for e in select id, event_date, title from public.volunteer_events
            where kind = 'service' and coalesce(status, '') not in ('cancelled', 'completed') and event_date between v_today and v_today + 5
            order by event_date loop
    v_marker := '[serving ' || e.id || ']';
    v_booked := exists (select 1 from public.event_roster r where r.event_id = e.id and lower(coalesce(r.role, '')) in ('photographer', 'videographer')
                          and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable') and r.confirm_status is distinct from 'declined'
                          and (lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed'));
    if v_booked then
      update public.dept_tasks set done = true, status = 'Done', closed_at = now(), updated_by = 'the Hub (a photographer confirmed)', updated_at = now()
       where done = false and title like 'Book a photographer%' and description like '%' || v_marker || '%';
      get diagnostics k = row_count; n_closed := n_closed + k;
      continue;
    end if;
    v_days := e.event_date - v_today;   -- the first day within 5 that finds nobody confirmed
    if exists (select 1 from public.dept_tasks t where t.done = false and t.title like 'Book a photographer%' and t.description like '%' || v_marker || '%') then continue; end if;
    v_owner := public.wa239_photo_owner(); v_name := coalesce(nullif(v_owner ->> 'name', ''), 'Ian');
    v_words := to_char(e.event_date, 'FMDay DD FMMonth');
    v_desc := 'No photographer or videographer is confirmed for the serving on ' || v_words || coalesce(' (' || nullif(e.title, '') || ')', '') || ', ' || v_days || ' day' || case when v_days = 1 then '' else 's' end
      || ' away. Book one: Volunteers > Photographers in the Volunteer Manager (Text: still in? reaches the past photographers), or a call-out on social. This task closes itself once a photographer confirms on the roster. ' || v_marker;
    insert into public.dept_tasks (department, title, owner, status, done, due_date, description, updated_by, updated_at, opened_at, sort, priority)
    values ('marketing', 'Book a photographer for the serving on ' || v_words, v_name, 'Open', false, e.event_date - 1, v_desc, 'the Hub', now(), now(),
            (select coalesce(max(sort), 0) + 1 from public.dept_tasks where department = 'marketing'), true)
    returning id into v_tid;
    select tm.id into v_mid from public.team_members tm where coalesce(tm.active, true) and lower(tm.email) = lower(coalesce(v_owner ->> 'email', '')) limit 1;
    if v_mid is not null then insert into public.task_assignees (task_id, member_id) values (v_tid, v_mid) on conflict do nothing; end if;
    perform public.wa_notify_call(jsonb_build_object('event', 'task_reassigned', 'task_id', v_tid, 'new_owner', v_name, 'old_owner', null));
    if coalesce((select value from public.app_config where key = 'push_on'), 'on') = 'on' and exists (select 1 from public.hub_push_subs) then
      begin perform public.call_edge('hub-push', jsonb_build_object('event', 'task_assigned', 'task_id', v_tid, 'by', 'the Hub')); exception when others then null; end;
    end if;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', e.id::text, 'photographer_check', null, 'no photographer ' || v_days || ' days out: task ' || v_tid || ' for ' || v_name, 'wa240_photo_check');
    n_tasks := n_tasks + 1;
  end loop;
  begin n_ideas := coalesce((public.wa240_event_ideas(null) ->> 'added')::int, 0); exception when others then n_ideas := -1; end;
  return jsonb_build_object('tasks', n_tasks, 'closed', n_closed, 'ideas', n_ideas, 'day', v_today);
end $$;
select cron.schedule('wa-photo-check', '15 14 * * *', $$select public.wa240_photo_check()$$);

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('hub', 'release', 'wave240', null,
        'Content for each serving: its Google Photos album and content brief (on the serving page, the photographer''s page and text); 5, 3 and 1 days out with no photographer confirmed, a task for the SOP''s photographer owner that closes itself; throwback and recap ideas for partner servings in the Content Studio',
        'assistant');

-- run apart (the connector may hold a revoke; both functions check their caller anyway):
--   revoke execute on function public.wa240_photo_check() from public, anon, authenticated;
--   revoke execute on function public.wa240_event_ideas(bigint) from public, anon;
