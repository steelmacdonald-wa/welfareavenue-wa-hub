-- Welfare Avenue Hub: wave286 undo, 06/11/26. Reverses build/data/wa286_vm_chapter.sql, in reverse order: the Volunteer Manager has no chapter again.
-- wa266f_email_drain and wa191_recruit_pool come back exactly as live had them on 06/11/26 (read with the Supabase connector: md5 bdf1673f... and
-- 4091ecf5..., checked in test/w286sql.mjs), with their grants and comments; each is put back only while the wave286 version is there, so the file
-- is safe to run twice. Then wa286_volunteer_chapters and the roster trigger are dropped, volunteer_event_summary is recreated from its live text
-- (dropped first: a view cannot lose a column in place) with its live comment and grants, and volunteer_events.chapter and its index are dropped.
-- What stays: the crm_contact_chapters rows the roster trigger added (source serving; they are true evidence: delete them by hand if wanted), the
-- release line in change_log (an undo line is added). The live texts below hold the public anon key, which is already in the page and in
-- build/data/wa273_senders_signup_answers.sql. Comment statements here are indented on purpose: build/gen_data_model.py reads every file in
-- build/data and must keep reading the migration's text. No transaction control (see the migration).

-- ============================================================================================ 1. wa266f_email_drain back (no route)
do $u286$
begin
  if position($x$'route', (select c.mail_route from public.crm_chapters c$x$ in pg_get_functiondef('public.wa266f_email_drain(integer)'::regprocedure)) > 0 then
    execute $f286a$CREATE OR REPLACE FUNCTION public.wa266f_email_drain(p_limit integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q record; r record; v_lang text; v_first text; v_role text; v_day text; v_link text; v_msg text; v_subject text; v_button text;
        v_key text; v_vars jsonb; v_res record; v_out jsonb; n_sent int := 0; n_text int := 0; n_unknown int := 0;
begin
  for q in select * from public.quo_messages where delivery = 'email_pending' and status = 'sent' order by id limit greatest(p_limit, 1) for update skip locked loop
    select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date, e.start_time, e.location into r
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = q.roster_id;
    v_lang := public.wa171_lang(q.person_id);
    v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || r.confirm_token;
    if q.kind = 'confirm' then
      v_first := nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), '');
      v_role := lower(public.wa171_role_label(r.role, v_lang));
      v_day := public.wa171_date_words(r.event_date, v_lang);
      v_key := case when v_lang = 'fr' then 'volunteer_assigned_fr' else 'volunteer_assigned' end;
      v_vars := jsonb_build_object('first_name', coalesce(v_first, ''), 'role', v_role, 'count', '1', 'confirm_url', v_link,
        'extra_html', '<ul><li><strong>' || replace(replace(v_day, '&', '&amp;'), '<', '&lt;') || '</strong>, ' || v_role || ' (' || to_char(coalesce(r.start_time, '12:00'::time), 'HH24:MI') || ', ' || replace(replace(coalesce(nullif(r.location, ''), 'Montreal'), '&', '&amp;'), '<', '&lt;') || ')</li></ul>',
        'extra_text', '- ' || v_day || ', ' || v_role);
    else
      v_msg := public.wa266f_email_words(q.body);
      v_subject := case q.kind
        when 'signup' then case when v_lang = 'fr' then 'Merci de votre inscription chez Welfare Avenue' else 'Thanks for signing up with Welfare Avenue' end
        when 'reminder' then case when v_lang = 'fr' then 'Un rappel pour votre prochain service' else 'A reminder for your next serving' end
        when 'checkin' then case when v_lang = 'fr' then 'À bientôt chez Welfare Avenue' else 'See you soon at Welfare Avenue' end
        else case when v_lang = 'fr' then 'Comment ça s''est passé?' else 'How did it go?' end end;
      v_button := case when q.kind = 'survey' then case when v_lang = 'fr' then 'Donner mon avis' else 'Share my feedback' end
                       else case when v_lang = 'fr' then 'Ouvrir ma page' else 'Open my page' end end;
      v_key := case when v_lang = 'fr' then 'volunteer_update_fr' else 'volunteer_update' end;
      v_vars := jsonb_build_object('subject_line', v_subject, 'button', v_button, 'confirm_url', v_link, 'extra_text', v_msg,
        'extra_html', '<p>' || replace(replace(v_msg, '&', '&amp;'), '<', '&lt;') || '</p>');
    end if;
    begin
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
      select * into v_res from extensions.http(('POST', 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/mail-send',
        array[extensions.http_header('x-wa-secret', public.get_secret('WA_TRIGGER_SECRET')),
              extensions.http_header('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4'),
              extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4')],
        'application/json',
        jsonb_build_object('action', 'send', 'template_key', v_key, 'contact_id', (public.wa182_roster_email(q.roster_id)->>'contact_id')::bigint, 'reply_to', public.wa258_role_owner(r.role), 'vars', v_vars)::text)::extensions.http_request);
      v_out := v_res.content::jsonb;
    exception when others then
      update public.quo_messages set delivery = 'email_unknown', delivery_at = now(), error = left('email: ' || sqlerrm, 300) where id = q.id;
      n_unknown := n_unknown + 1; continue;
    end;
    if v_out->>'status' = 'sent' then
      update public.quo_messages set delivery = 'email', delivery_at = now(), body = '[By email] ' || body where id = q.id;
      if q.kind = 'confirm' then
        update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('confirm_emailed_at', now(), 'confirm_emailed_why', 'wave266f') where id = q.roster_id;
      end if;
      n_sent := n_sent + 1;
    else
      update public.quo_messages set status = 'queued', sent_at = null, delivery = null, error = left('email did not go (' || coalesce(v_out->>'status', v_out->>'error', '?') || '), texted instead', 300) where id = q.id;
      n_text := n_text + 1;
    end if;
  end loop;
  return jsonb_build_object('emailed', n_sent, 'back_to_text', n_text, 'unknown', n_unknown);
end $function$
$f286a$;
  end if;
end $u286$;
revoke all on function public.wa266f_email_drain(integer) from public, anon, authenticated;
grant execute on function public.wa266f_email_drain(integer) to service_role;
  comment on function public.wa266f_email_drain(integer) is null;

-- ============================================================================================ 2. wa191_recruit_pool back to its three arguments
do $u286$
begin
  if to_regprocedure('public.wa191_recruit_pool(bigint[],integer,integer,text)') is not null then
    drop function public.wa191_recruit_pool(bigint[], integer, integer, text);
    execute $f286b$CREATE OR REPLACE FUNCTION public.wa191_recruit_pool(p_events bigint[] DEFAULT NULL::bigint[], p_lapsed_days integer DEFAULT 60, p_regular_min integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_today date := (now() at time zone 'America/Toronto')::date; v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  p_lapsed_days := greatest(coalesce(p_lapsed_days, 60), 7);
  p_regular_min := greatest(coalesce(p_regular_min, 3), 2);
  with base as (
    select c.id cid, c.volunteer_id pid, c.full_name,
           coalesce(nullif(btrim(c.first_name), ''), nullif(split_part(btrim(coalesce(c.full_name, '')), ' ', 1), '')) first_name,
           (select public.wa171_digits(x) from unnest(c.phones) x where public.wa171_digits(x) is not null limit 1) phone,
           c.emails, lower(coalesce(c.language, '')) like 'fr%' fr, coalesce(c.sms_opt_out, false) opted_out, c.city,
           coalesce(vp.roles, '{}') roles, vp.needs_review, coalesce(vp.last_applied, (vp.created_at at time zone 'America/Toronto')::date, (c.created_at at time zone 'America/Toronto')::date) signed_up
      from public.crm_contacts c left join public.volunteer_profiles vp on vp.id = c.volunteer_id
     where c.merged_into is null
       and (c.volunteer_id is not null or 'volunteer' = any (c.kinds) or exists (select 1 from public.crm_volunteer_history h where h.contact_id = c.id))
  ), hub as (
    select er.person_id pid, count(distinct e.id) n, max(e.event_date) last_on, min(e.event_date) first_on, mode() within group (order by lower(er.role)) top_role
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.status = 'completed' and er.status = 'Confirmed' and er.person_id is not null
     group by er.person_id
  ), asked as (
    select er.person_id pid, count(*) n, count(*) filter (where lower(coalesce(er.status, '')) = 'unavailable') said_no
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.status = 'completed' and er.person_id is not null group by er.person_id
  ), leg as (
    select h.contact_id cid, count(*) n, max((h.event_at at time zone 'America/Toronto')::date) last_on, min((h.event_at at time zone 'America/Toronto')::date) first_on
      from public.crm_volunteer_history h where h.attended and h.volunteer_event_id is null group by h.contact_id
  ), fbf as (
    select lower(btrim((select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%email%' limit 1))) email,
           (select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%overall%' limit 1) overall,
           (select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%continue volunteering%' limit 1) again,
           (r.submitted_at at time zone 'America/Toronto')::date on_day
      from public.form_responses r where r.kind = 'volunteer_feedback'
  ), liked_all as (
    select b.cid, f.on_day, f.overall word, f.again, 'form' src
      from fbf f join base b on f.email is not null and f.email like '%@%' and exists (select 1 from unnest(b.emails) e where lower(btrim(e)) = f.email)
     where lower(coalesce(f.overall, '')) in ('excellent', 'good')
    union all
    select b.cid, (s.submitted_at at time zone 'America/Toronto')::date, initcap(s.answers->>'overall'), replace(s.answers->>'again', '_', ' '), 'survey'
      from public.volunteer_survey_responses s join base b on b.pid = s.person_id
     where s.answers->>'overall' in ('excellent', 'good')
  ), lk as (
    select distinct on (cid) cid, on_day, word, again, src from liked_all order by cid, on_day desc nulls last
  ), onr as (
    select er.person_id pid, jsonb_agg(jsonb_build_object('e', er.event_id, 'st', coalesce(er.status, 'TBD'), 'r', er.role, 'src', er.detail->>'source') order by er.event_id) j
      from public.event_roster er
     where p_events is not null and er.event_id = any (p_events) and er.person_id is not null and lower(coalesce(er.status, '')) <> 'cancelled'
     group by er.person_id
  ), tx as (
    select q.person_id pid,
           max(q.created_at) filter (where q.direction = 'out' and q.status in ('queued', 'sent')) last_out,
           max(q.created_at) filter (where q.direction = 'in') last_in,
           max(q.created_at) filter (where q.direction = 'out' and q.kind = 'recruit' and q.status in ('queued', 'sent')) last_recruit
      from public.quo_messages q where q.person_id is not null group by q.person_id
  ), p as (
    select b.*, coalesce(hub.n, 0) + coalesce(leg.n, 0) served, greatest(hub.last_on, leg.last_on) last_on, least(hub.first_on, leg.first_on) first_on,
           hub.top_role, coalesce(asked.n, 0) asked, coalesce(asked.said_no, 0) said_no, lk.on_day lk_on, lk.word lk_word, lk.again lk_again, lk.src lk_src,
           onr.j on_roster, tx.last_out, tx.last_in, tx.last_recruit
      from base b left join hub on hub.pid = b.pid left join leg on leg.cid = b.cid left join asked on asked.pid = b.pid
      left join lk on lk.cid = b.cid left join onr on onr.pid = b.pid left join tx on tx.pid = b.pid
  )
  select jsonb_build_object('today', v_today, 'lapsed_days', p_lapsed_days, 'regular_min', p_regular_min,
           'mode', coalesce((select value from public.app_config where key = 'sms_mode'), 'off'), 'window_open', public.wa191_sms_window(),
           'people', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'c', p.cid, 'p', p.pid, 'n', coalesce(nullif(btrim(p.full_name), ''), '(no name)'), 'f', p.first_name,
             'ph', case when p.phone is not null then '(' || substr(p.phone, 1, 3) || ') ' || substr(p.phone, 4, 3) || '-' || substr(p.phone, 7, 4) end,
             't', case when p.phone is not null and public.wa171_test_phone(p.phone) then true end,
             'fr', case when p.fr then true end, 'out', case when p.opted_out then true end, 'city', p.city,
             'roles', case when cardinality(p.roles) > 0 then to_jsonb(p.roles) end, 'top', p.top_role,
             's', p.served, 'l', p.last_on, 'f1', p.first_on, 'su', p.signed_up, 'ask', p.asked, 'no', p.said_no,
             'lk', case when p.lk_word is not null then jsonb_build_object('on', p.lk_on, 'w', p.lk_word, 'again', p.lk_again, 'src', p.lk_src) end,
             'g', to_jsonb(array_remove(array[
                    case when p.served = 0 then 'never' end,
                    case when p.served >= p_regular_min and p.last_on < v_today - p_lapsed_days then 'lapsed' end,
                    case when p.served = 1 then 'once' end,
                    case when p.lk_word is not null and lower(coalesce(p.lk_again, '')) not like 'not%' then 'liked' end], null)),
             'on', p.on_roster, 'tx', (p.last_out at time zone 'America/Toronto')::date, 'rx', (p.last_in at time zone 'America/Toronto')::date,
             'inv', (p.last_recruit at time zone 'America/Toronto')::date, 'rv', case when p.needs_review then true end))
           order by lower(coalesce(p.full_name, ''))), '[]'::jsonb))
    into v from p;
  return v;
end $function$
$f286b$;
  end if;
end $u286$;
revoke all on function public.wa191_recruit_pool(bigint[], integer, integer) from public, anon;
grant execute on function public.wa191_recruit_pool(bigint[], integer, integer) to authenticated, service_role;
  comment on function public.wa191_recruit_pool(bigint[], integer, integer) is 'wave191e: Find volunteers. Every volunteer in the CRM (a volunteer record, the volunteer kind, or old-website history) with servings (Hub and old website, as the CRM counts), the last and first, the role done most, how often asked and how often they said no, when they signed up, liked (Excellent or Good on the Hub survey, or on the volunteer feedback form matched by the email they left), their rows on the chosen servings, their last texts, and their groups: never, lapsed (p_regular_min or more servings, none in p_lapsed_days), once, liked (unless they answered not at this time). Staff only.';

-- ============================================================================================ 3. the chapter map and the roster trigger
drop function if exists public.wa286_volunteer_chapters();
drop trigger if exists trg_wa286_roster_chapter on public.event_roster;
drop function if exists public.wa286_roster_chapter();

-- ============================================================================================ 4. volunteer_event_summary back to its live text (no chapter)
do $u286$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.volunteer_event_summary'::regclass and attname = 'chapter' and not attisdropped) then
    drop view public.volunteer_event_summary;
    execute $v286$create view public.volunteer_event_summary with (security_invoker = on) as
 SELECT id,
    code,
    event_date,
    season,
    location,
    status,
    kind,
    COALESCE(title,
        CASE
            WHEN kind = 'service'::text THEN 'Sunday serving'::text
            ELSE initcap(kind)
        END) AS title,
    notes,
    ( SELECT count(*) AS count
           FROM public.event_roster r
          WHERE r.event_id = e.id) AS roster_count,
    ( SELECT count(*) AS count
           FROM public.event_roster r
          WHERE r.event_id = e.id AND r.status ~~* 'confirmed'::text) AS roster_confirmed,
    ( SELECT count(*) AS count
           FROM public.sop_event_steps s
          WHERE s.event_id = e.id) AS steps_total,
    ( SELECT count(*) AS count
           FROM public.sop_event_steps s
          WHERE s.event_id = e.id AND s.done) AS steps_done,
    ( SELECT count(*) AS count
           FROM public.sop_event_extras x
          WHERE x.event_id = e.id) AS extras_total,
    ( SELECT count(*) AS count
           FROM public.sop_event_extras x
          WHERE x.event_id = e.id AND NOT x.done) AS extras_open,
    format,
    ( SELECT count(*) AS count
           FROM public.event_roster r
          WHERE r.event_id = e.id AND r.confirm_status = 'confirmed'::text) AS roster_by_link,
    ( SELECT count(*) AS count
           FROM public.event_roster r
          WHERE r.event_id = e.id AND r.status ~~* 'unavailable'::text) AS roster_declined,
    ( SELECT count(DISTINCT q.roster_id) AS count
           FROM public.quo_messages q
          WHERE q.event_id = e.id AND q.direction = 'out'::text AND q.kind = 'confirm'::text AND q.status = 'sent'::text) AS roster_texted
   FROM public.volunteer_events e$v286$;
  end if;
end $u286$;
revoke all on table public.volunteer_event_summary from public, anon;
grant all on table public.volunteer_event_summary to authenticated, service_role;   -- as live had it
  comment on view public.volunteer_event_summary is 'One row per volunteering event with its roster and checklist counts (security invoker: staff read). wave171 adds format, roster_by_link (confirmed on the text link or by replying YES), roster_declined (Unavailable) and roster_texted (sent a confirmation text).';

-- ============================================================================================ 5. the serving's chapter goes
drop index if exists public.volunteer_events_chapter_idx;
alter table public.volunteer_events drop column if exists chapter;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave286', 'wave286 undo', null, 'wave286 undone: servings have no chapter, Find volunteers takes three arguments again, the email drain names no route, the roster trigger and wa286_volunteer_chapters are gone.', 'wave286 undo'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286 undo');
