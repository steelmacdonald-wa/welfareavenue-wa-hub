-- Welfare Avenue Hub: wave286, 06/11/26. Hub CRM slice 1, Phase 5b: the Volunteer Manager by chapter (design CRM-S1 v2, B.2 5b and items 35 to 43).
-- For staff: servings have a chapter (Montreal by default), so the Volunteer Manager can show Montreal, Toronto or All; Find volunteers takes a chapter;
-- a Toronto serving's emails come from toronto@. It adds: volunteer_events.chapter (with an index) and volunteer_event_summary.chapter; a roster
-- trigger that puts a confirmed volunteer in their serving's chapter (crm_add_chapter, source serving); wa286_volunteer_chapters (the chapter map the
-- page filters People with); wa191_recruit_pool with a fourth argument, p_chapter, that also always leaves out do-not-contact people; and the
-- serving's mail route in wa266f_email_drain's mail-send call.
-- Needs wave281 first (crm_chapters, crm_in_chapter, crm_add_chapter): the file stops at the top without it. Live functions and the view are changed
-- by exact replacement of an anchor in their live text (pg_get_functiondef, pg_get_viewdef), as wave273 and wave281 did: if an anchor is missing the
-- whole file fails rather than overwrite something that moved. wa191_recruit_pool cannot gain an argument in place (a second version would make every
-- call "not unique"), so its live text is read, patched, the three-argument function dropped and the patched text created, in one block. Each patch
-- skips when its wave286 text is already there and every other step is guarded, so the file is safe to run twice. The live text of
-- wa266f_email_drain, wa191_recruit_pool and volunteer_event_summary, with their grants and comments, is in build/data/wa286_undo.sql.
-- No transaction control: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it inside a block that rolls
-- back. Proved offline first: node test/w286sql.mjs (PGlite). Built 06/11/26, not released. Needs wave281 only; it does not need the Toronto forms
-- wave (wave288, which adds volunteer_applications.chapter) and can go before it: until then the page counts every application as Montreal.

do $wa286$
begin
  if to_regclass('public.crm_chapters') is null or to_regprocedure('public.crm_in_chapter(bigint,text)') is null
     or to_regprocedure('public.crm_add_chapter(bigint,text,text,text)') is null then
    raise exception 'wave286 needs wave281 first (crm_chapters, crm_in_chapter and crm_add_chapter are missing)';
  end if;
end $wa286$;

-- ============================================================================================ 35.1 a serving's chapter
-- Every serving so far was in Montreal, so the default keeps every row (and every Montreal list) as it is.
alter table public.volunteer_events add column if not exists chapter text not null default 'montreal' references public.crm_chapters(code);
create index if not exists volunteer_events_chapter_idx on public.volunteer_events (chapter);
comment on column public.volunteer_events.chapter is 'wave286: the serving''s chapter (crm_chapters.code): montreal (the default; every serving before wave286) or toronto. The Volunteer Manager''s Montreal, Toronto or All switch filters the servings by it; a confirmed volunteer joins this chapter (trg_wa286_roster_chapter); the serving''s emails go from the chapter''s mail_route (wa266f_email_drain, mail-send''s itinerary).';

-- ============================================================================================ 35.2 volunteer_event_summary gains chapter
-- The live definition with chapter appended (read live, one anchor replaced; create or replace keeps the view's grants, which are set again below).
do $view$
declare v text; v_sp text := current_setting('search_path'); a text := $x$) AS roster_texted
   FROM volunteer_events e;$x$;
begin
  perform set_config('search_path', 'public', true);
  v := pg_get_viewdef('public.volunteer_event_summary'::regclass, true);
  if not exists (select 1 from pg_attribute where attrelid = 'public.volunteer_event_summary'::regclass and attname = 'chapter' and not attisdropped) then
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave286: a live view moved: volunteer_event_summary (anchor roster_texted)'; end if;
    v := replace(v, a, $x$) AS roster_texted,
    chapter
   FROM volunteer_events e;$x$);
    execute 'create or replace view public.volunteer_event_summary with (security_invoker = on) as ' || v;   -- live stores on
  end if;
  perform set_config('search_path', v_sp, true);
end $view$;
revoke all on table public.volunteer_event_summary from public, anon, authenticated;
grant select on table public.volunteer_event_summary to authenticated;
grant all on table public.volunteer_event_summary to service_role;
comment on view public.volunteer_event_summary is 'One row per volunteering event with its roster and checklist counts (security invoker: staff read). wave171 adds format, roster_by_link (confirmed on the text link or by replying YES), roster_declined (Unavailable) and roster_texted (sent a confirmation text). wave286 adds chapter (the serving''s chapter, volunteer_events.chapter) and makes it read-only for signed-in users (it was never written).';

-- ============================================================================================ 35.3 a confirmed volunteer joins their serving's chapter
create or replace function public.wa286_roster_chapter()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_contact bigint; v_chapter text; v_code text;
begin
  if new.person_id is null or new.status is distinct from 'Confirmed' then return null; end if;
  select e.chapter, coalesce(e.code, e.id::text) into v_chapter, v_code from public.volunteer_events e where e.id = new.event_id;
  select c.id into v_contact from public.crm_contacts c where c.volunteer_id = new.person_id and c.merged_into is null order by c.id limit 1;
  if v_contact is null or v_chapter is null then return null; end if;
  perform public.crm_add_chapter(v_contact, v_chapter, 'serving', 'serving ' || v_code);
  return null;
end $function$;
revoke all on function public.wa286_roster_chapter() from public, anon, authenticated;
comment on function public.wa286_roster_chapter() is 'wave286: trigger function on event_roster (trg_wa286_roster_chapter). When a roster row is Confirmed, the volunteer''s contact (crm_contacts.volunteer_id = person_id, not merged) joins the serving''s chapter through crm_add_chapter (source serving, source note serving <code>); a row already there is kept. Security definer: crm_add_chapter is service role only.';
drop trigger if exists trg_wa286_roster_chapter on public.event_roster;
create trigger trg_wa286_roster_chapter after insert or update of status on public.event_roster
  for each row when (new.status = 'Confirmed') execute function public.wa286_roster_chapter();
comment on trigger trg_wa286_roster_chapter on public.event_roster is 'wave286: a volunteer confirmed on a serving joins the serving''s chapter (crm_contact_chapters, source serving).';

-- ============================================================================================ 35.4 Find volunteers takes a chapter
-- The live text, with p_chapter after the three live arguments (defaults kept) and two lines in the base list: do-not-contact people are always left
-- out, and with p_chapter only the people crm_in_chapter puts in that chapter stay (security definer, so crm_in_chapter reads every chapter row).
do $wa286$
declare v text; a1 text; a2 text; n1 text; n2 text;
begin
  if to_regprocedure('public.wa191_recruit_pool(bigint[],integer,integer,text)') is null then
    if to_regprocedure('public.wa191_recruit_pool(bigint[],integer,integer)') is null then raise exception 'wave286: a live function moved: wa191_recruit_pool (the three-argument version is missing)'; end if;
    v := pg_get_functiondef('public.wa191_recruit_pool(bigint[],integer,integer)'::regprocedure);
    a1 := $x$p_regular_min integer DEFAULT 3)
 RETURNS jsonb$x$;
    n1 := $x$p_regular_min integer DEFAULT 3, p_chapter text DEFAULT NULL::text)
 RETURNS jsonb$x$;
    a2 := $x$       and (c.volunteer_id is not null or 'volunteer' = any (c.kinds) or exists (select 1 from public.crm_volunteer_history h where h.contact_id = c.id))
  ), hub as ($x$;
    n2 := $x$       and (c.volunteer_id is not null or 'volunteer' = any (c.kinds) or exists (select 1 from public.crm_volunteer_history h where h.contact_id = c.id))
       and not coalesce(c.do_not_contact, false)   -- wave286: never a do-not-contact person
       and (p_chapter is null or public.crm_in_chapter(c.id, p_chapter))   -- wave286: the chosen chapter (null: all)
  ), hub as ($x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) or length(v) - length(replace(v, a2, '')) <> length(a2) then
      raise exception 'wave286: a live function moved: wa191_recruit_pool';
    end if;
    v := replace(replace(v, a1, n1), a2, n2);
    drop function public.wa191_recruit_pool(bigint[], integer, integer);
    execute v;
  end if;
end $wa286$;
revoke all on function public.wa191_recruit_pool(bigint[], integer, integer, text) from public, anon;
grant execute on function public.wa191_recruit_pool(bigint[], integer, integer, text) to authenticated, service_role;
comment on function public.wa191_recruit_pool(bigint[], integer, integer, text) is 'wave191e: Find volunteers. Every volunteer in the CRM (a volunteer record, the volunteer kind, or old-website history) with servings (Hub and old website, as the CRM counts), the last and first, the role done most, how often asked and how often they said no, when they signed up, liked (Excellent or Good on the Hub survey, or on the volunteer feedback form matched by the email they left), their rows on the chosen servings, their last texts, and their groups: never, lapsed (p_regular_min or more servings, none in p_lapsed_days), once, liked (unless they answered not at this time). Staff only. wave286: p_chapter (montreal, toronto; null for all chapters) keeps only the people crm_in_chapter puts in that chapter (Montreal: a montreal row or no chapter row), and do-not-contact people are always left out.';

-- ============================================================================================ 35.5 the chapter map for the page
-- crm_in_chapter is security invoker and the page may not read crm_contact_chapters (its policies need the CRM page), so the Volunteer Manager reads
-- chapters only through this staff-checked function and applies the rule itself (Montreal: a montreal code, or no entry at all).
create or replace function public.wa286_volunteer_chapters()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select case when coalesce(public.is_wa_staff(), false) then coalesce((
    select jsonb_object_agg(c.volunteer_id::text, x.codes)
      from public.crm_contacts c
      cross join lateral (select jsonb_agg(cc.chapter order by cc.chapter) as codes from public.crm_contact_chapters cc where cc.contact_id = c.id) x
     where c.volunteer_id is not null and c.merged_into is null and x.codes is not null), '{}'::jsonb)
  else '{}'::jsonb end
$function$;
revoke all on function public.wa286_volunteer_chapters() from public, anon;
grant execute on function public.wa286_volunteer_chapters() to authenticated, service_role;
comment on function public.wa286_volunteer_chapters() is 'wave286: the Volunteer Manager''s chapter map: {volunteer_profiles.id: [chapter codes]} for every volunteer whose contact (not merged) has a crm_contact_chapters row. A volunteer with no row is left out, and the page counts them as Montreal (crm_in_chapter''s rule). Returns {} unless is_wa_staff(). Security definer, so staff without the CRM page get it too.';

-- ============================================================================================ 35.6 a serving's emails go from its chapter's address
-- The drain's mail-send call names the route of the serving's chapter (montreal: volunteer, the template's default; toronto: toronto@). The route goes
-- next to wave273's reply_to, at the top level of the call (mail-send reads body.route), not inside vars. The roster row is aliased x because the
-- drain's own record variable is called r.
do $wa286$
declare v text; a text := $x$'reply_to', public.wa258_role_owner(r.role),$x$;
begin
  v := pg_get_functiondef('public.wa266f_email_drain(integer)'::regprocedure);
  if position($x$'route', (select c.mail_route from public.crm_chapters c$x$ in v) = 0 then
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave286: a live function moved: wa266f_email_drain'; end if;
    v := replace(v, a, a || $x$ 'route', (select c.mail_route from public.crm_chapters c join public.volunteer_events ve on ve.chapter = c.code where ve.id = (select x.event_id from public.event_roster x where x.id = q.roster_id)),$x$);
    execute v;
  end if;
end $wa286$;
revoke all on function public.wa266f_email_drain(integer) from public, anon, authenticated;
grant execute on function public.wa266f_email_drain(integer) to service_role;
comment on function public.wa266f_email_drain(integer) is 'wave266f: sends the volunteer texts that wait as email (quo_messages delivery email_pending) through mail-send, up to p_limit a run (cron wa-email-drain); back to a text when the email does not go. wave273: replies reach whoever handles the role (reply_to). wave286: the email goes from the serving''s chapter address (route: crm_chapters.mail_route). Service role only.';

-- the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave286', 'wave286', null,
       'The Volunteer Manager by chapter: volunteer_events.chapter (Montreal by default) and volunteer_event_summary.chapter, a confirmed volunteer joins the serving''s chapter, '
       || 'wa286_volunteer_chapters, wa191_recruit_pool takes p_chapter and leaves out do-not-contact people, the email drain sends from the serving''s chapter address.', 'wave286'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286');
