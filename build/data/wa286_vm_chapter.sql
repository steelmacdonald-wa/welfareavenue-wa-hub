-- Welfare Avenue Hub: wave286, 06/11/26. Hub CRM slice 1, Phase 5b as Steel reduced it on 06/11/26: Toronto crews in the CRM.
-- Steel folded the design's Phase 5b (the Volunteer Manager by chapter) into wave274's one Volunteer Manager, which already has its Montreal |
-- Toronto switch and Toronto's own screens. What is left for wave286 is the link from a Toronto crew to the CRM's Toronto chapter: whoever is put on
-- a Toronto event's crew joins the Toronto chapter (crm_contact_chapters), so the CRM's Toronto filter (crm_in_chapter, wave281) finds them.
-- A Toronto event is a Toronto event in wave274's sense: a volunteer_events row with kind 'meal' and location 'Toronto' (wa274_crew_add puts its
-- crew on event_roster, with the contact in detail.contact_id). Montreal is untouched: no serving, roster row, function or Montreal chapter row
-- changes, and nothing here adds 'montreal' or removes a chapter row.
-- It adds: wa286_crew_contact (the crew member's contact: detail.contact_id first, then the volunteer record; merged contacts never), the trigger
-- trg_wa286_toronto_crew on event_roster (after insert, and after update of event_id or person_id), and a backfill for the crews already there.
-- Rows it adds carry source serving (the wave281 source for "on a Toronto serving") and a source note that starts "Toronto crew:", so the undo
-- removes exactly those. Needs wave281 first (crm_contact_chapters, crm_add_chapter): the file stops at the top without it. Every step is guarded,
-- so the file is safe to run twice. No transaction control: the release runs it through the Supabase connector, and build/sql_rollback_test.py
-- runs it inside a block that rolls back. Proved offline first: node test/w286sql.mjs (PGlite). Built 06/11/26, not released.
-- Undo: build/data/wa286_undo.sql.

do $wa286$
begin
  if to_regclass('public.crm_contact_chapters') is null or to_regprocedure('public.crm_add_chapter(bigint,text,text,text)') is null then
    raise exception 'wave286 needs wave281 first (crm_contact_chapters and crm_add_chapter are missing)';
  end if;
end $wa286$;

-- ============================================================================================ 1. the crew member's contact
create or replace function public.wa286_crew_contact(p_detail jsonb, p_person bigint)
returns bigint language sql stable security definer set search_path to '' as $function$
  select coalesce(
    (select c.id from public.crm_contacts c
      where c.id = case when (p_detail ->> 'contact_id') ~ '^[0-9]{1,18}$' then (p_detail ->> 'contact_id')::bigint end
        and c.merged_into is null),
    (select c.id from public.crm_contacts c
      where p_person is not null and c.volunteer_id = p_person and c.merged_into is null
      order by c.id limit 1))
$function$;
revoke all on function public.wa286_crew_contact(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.wa286_crew_contact(jsonb, bigint) to service_role;
comment on function public.wa286_crew_contact(jsonb, bigint) is 'wave286: the CRM contact of a roster row: the contact named in detail.contact_id (as wa274_crew_add writes it), else the contact whose volunteer_id is the row''s person_id; never a merged contact (null when there is none). Service role only: called by the wave286 trigger and backfill.';

-- ============================================================================================ 2. a Toronto crew member joins the Toronto chapter
create or replace function public.wa286_toronto_crew()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_code text; v_contact bigint;
begin
  if to_regprocedure('public.crm_add_chapter(bigint,text,text,text)') is null then return null; end if;   -- wave281 undone first: never block a crew add
  select coalesce(e.code, e.id::text) into v_code from public.volunteer_events e where e.id = new.event_id and e.kind = 'meal' and e.location = 'Toronto';
  if v_code is null then return null; end if;   -- not a Toronto event (every Montreal serving ends here)
  v_contact := public.wa286_crew_contact(new.detail, new.person_id);
  if v_contact is null then return null; end if;
  perform public.crm_add_chapter(v_contact, 'toronto', 'serving', 'Toronto crew: ' || v_code);
  return null;
end $function$;
revoke all on function public.wa286_toronto_crew() from public, anon, authenticated;
comment on function public.wa286_toronto_crew() is 'wave286: trigger function on event_roster (trg_wa286_toronto_crew). When the row is on a Toronto event (wave274: kind meal, location Toronto), the crew member''s contact (wa286_crew_contact) joins the Toronto chapter through crm_add_chapter (source serving, source note Toronto crew: <event code>); a row already there is kept. It never removes a chapter row and never adds montreal. Security definer: crm_add_chapter is service role only.';
drop trigger if exists trg_wa286_toronto_crew on public.event_roster;
create trigger trg_wa286_toronto_crew after insert or update of event_id, person_id on public.event_roster
  for each row execute function public.wa286_toronto_crew();
comment on trigger trg_wa286_toronto_crew on public.event_roster is 'wave286: someone put on a Toronto event''s crew (wave274) joins the CRM''s Toronto chapter (crm_contact_chapters, source serving, Toronto crew: <code>).';

-- ============================================================================================ 3. the crews already there (once; a row already there is kept)
do $wa286$
declare n int;
begin
  insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
  select distinct on (k.cid) k.cid, 'toronto', 'serving', 'Toronto crew: ' || k.code, 'wave286'
    from (select public.wa286_crew_contact(r.detail, r.person_id) as cid, coalesce(e.code, e.id::text) as code, r.id as rid
            from public.event_roster r join public.volunteer_events e on e.id = r.event_id
           where e.kind = 'meal' and e.location = 'Toronto') k
   where k.cid is not null
     and not exists (select 1 from public.crm_contact_chapters x where x.contact_id = k.cid and x.chapter = 'toronto')
   order by k.cid, k.rid
  on conflict (contact_id, chapter) do nothing;
  get diagnostics n = row_count;
  raise notice 'wave286: % people from Toronto crews joined the Toronto chapter', n;
  -- the release record (once), with the backfill's count
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  select 'release', 'wave286', 'wave286', null,
         'Toronto crews in the CRM: someone put on a Toronto event''s crew (wave274) joins the CRM''s Toronto chapter (trg_wa286_toronto_crew, wa286_crew_contact); '
         || n || ' people from the crews already there joined it.', 'wave286'
   where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286');
end $wa286$;
