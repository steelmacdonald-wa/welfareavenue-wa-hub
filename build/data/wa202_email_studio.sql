-- wa202_email_studio (03/10/26): the CRM's email studio (CRM > Studio, #crm/studio; build/parts202).
-- Steel, 03/10/26, with the Rally Paper 2026 emails as the example: "For our emails, I'd like to be able to produce these
-- types of emails for one-off emails and template emails going forward for both our volunteers and donors." His answers:
-- "To start an email they should be given the option to put in what they wrote, and the photos for the email and then the
-- AI puts it together. Or they use a template with their written information and the hub ai puts it together in an html
-- structured email. I want there to be a few options they could take to build emails. Also, if there's missing information,
-- I want the hub to prompt the user to ensure they've got all necessary and correct information for the newsletter. I'd like
-- them to also have created emails used for automation workflows." Templates for volunteers (welcome and serving; call-outs
-- and events) and donors (thanks and impact; appeals and events); saved templates, one-off to a list, one-off to one person.
--
-- A designed email is a crm_email_templates row: html_body is the studio's inner HTML (table-based blocks in the brand, every
-- tag carrying its own inline style so mail-send's styleInner leaves it alone), text_body its plain text, design the blocks the
-- studio edits. mail-send renders it exactly like any template (placeholders, the brand layout, the CASL footer), so the same
-- row serves a test, a one-person send ('send'), a campaign to a list (crm_campaigns.template_key) and an automation step
-- ("Saved email"). A one-off (one_off) is an email written for one send: it stays out of the template pickers. The studio
-- writes only through email_studio_save and email_studio_remove (checked inside); the system templates (design is null) stay
-- the Email tab's, edited by admins through mail-send.

alter table public.crm_email_templates
  add column if not exists design jsonb,
  add column if not exists one_off boolean not null default false,
  add column if not exists audience text,
  add column if not exists category text,
  add column if not exists lang text not null default 'en',
  add column if not exists description text,
  add column if not exists created_by text,
  add column if not exists created_at timestamptz not null default now();

alter table public.crm_email_templates drop constraint if exists crm_email_templates_kind_check;
alter table public.crm_email_templates add constraint crm_email_templates_kind_check check (kind in ('transactional', 'newsletter', 'fundraising', 'volunteer', 'test'));
alter table public.crm_email_templates drop constraint if exists crm_email_templates_audience_check;
alter table public.crm_email_templates add constraint crm_email_templates_audience_check check (audience is null or audience in ('volunteers', 'donors', 'everyone'));
alter table public.crm_email_templates drop constraint if exists crm_email_templates_category_check;
alter table public.crm_email_templates add constraint crm_email_templates_category_check check (category is null or category in ('volunteers_welcome', 'volunteers_callouts', 'donors_thanks', 'donors_appeals', 'other'));
alter table public.crm_email_templates drop constraint if exists crm_email_templates_lang_check;
alter table public.crm_email_templates add constraint crm_email_templates_lang_check check (lang in ('en', 'fr'));
alter table public.crm_email_templates drop constraint if exists crm_email_templates_design_check;
alter table public.crm_email_templates add constraint crm_email_templates_design_check check (design is null or jsonb_typeof(design) = 'object');

comment on column public.crm_email_templates.kind is 'What the message is under CASL: transactional (a confirmation, reminder, receipt or thank-you: not a commercial message, goes to anyone with a working address), newsletter (needs express or unexpired implied consent), fundraising (a registered charity''s appeal: follows the newsletter rule unless the fundraising exemption setting is on), volunteer (a volunteer call-out, wave202: the permission rule''s volunteer kind), test.';
comment on column public.crm_email_templates.design is 'wave202: the email studio''s design, {"v":1,"blocks":[...],"asks":[...]} (hero, text, heading, details, list, button, photo, photos, video, band, quote, stats, signoff, divider). Null for the system templates, which the studio never edits. html_body and text_body are what the studio rendered from it; mail-send only reads those.';
comment on column public.crm_email_templates.one_off is 'wave202: an email written in the studio for one send (a person or a list), kept out of the template pickers (automations, a contact''s Send an email). False for saved templates.';
comment on column public.crm_email_templates.audience is 'wave202: who a studio template is for: volunteers, donors or everyone. Null for the system templates.';
comment on column public.crm_email_templates.category is 'wave202: the studio''s shelf for a template: volunteers_welcome (welcome and serving), volunteers_callouts (call-outs and events), donors_thanks (thanks and impact), donors_appeals (appeals and events), other.';
comment on column public.crm_email_templates.lang is 'wave202: the language the email is written in (en, fr). mail-send''s layout and footer stay English.';
comment on column public.crm_email_templates.description is 'wave202: when to use a studio template, in a line, shown in the studio and the pickers.';
comment on column public.crm_email_templates.created_by is 'wave202: who made the template in the studio (their email), or starter for the ten the studio shipped with. Only they and admins edit it; anyone with the CRM can copy it.';
comment on column public.crm_email_templates.created_at is 'wave202: when the row was made (the system templates got the migration time).';

-- ---------- the studio's one way in: save a design (new or changed) ----------
create or replace function public.email_studio_save(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_me text := public.wa_email();
  v_role text;
  v_admin boolean := coalesce(public.is_wa_admin(), false) or public.wa_email() in ('steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com');
  v_key text := nullif(btrim(coalesce(p ->> 'key', '')), '');
  v_old public.crm_email_templates%rowtype;
  v_name text := left(btrim(coalesce(p ->> 'name', '')), 120);
  v_kind text := coalesce(nullif(p ->> 'kind', ''), 'newsletter');
  v_subject text := left(btrim(coalesce(p ->> 'subject', '')), 300);
  v_pre text := left(btrim(coalesce(p ->> 'preheader', '')), 300);
  v_html text := coalesce(p ->> 'html_body', '');
  v_text text := coalesce(p ->> 'text_body', '');
  v_design jsonb := p -> 'design';
  v_one boolean := coalesce((p ->> 'one_off')::boolean, true);
  v_aud text := nullif(p ->> 'audience', '');
  v_cat text := nullif(p ->> 'category', '');
  v_lang text := coalesce(nullif(p ->> 'lang', ''), 'en');
  v_desc text := nullif(left(btrim(coalesce(p ->> 'description', '')), 300), '');
  v_active boolean := coalesce((p ->> 'active')::boolean, true);
  v_vars jsonb := coalesce(p -> 'vars', '[]'::jsonb);
begin
  select r.role into v_role from public.hub_roles r where r.email = v_me;
  if not public.is_wa_staff() or coalesce(v_role, 'member') in ('viewer', 'blocked') or coalesce(public.wa_page_ok('crm'), true) = false then
    raise exception 'not_allowed';
  end if;
  if v_kind not in ('transactional', 'newsletter', 'fundraising', 'volunteer') then raise exception 'kind'; end if;
  if v_subject = '' then raise exception 'subject'; end if;
  if btrim(v_html) = '' or length(v_html) > 250000 or length(v_text) > 120000 then raise exception 'body'; end if;
  if v_design is null or jsonb_typeof(v_design) <> 'object' or length(v_design::text) > 400000 then raise exception 'design'; end if;
  if v_aud is not null and v_aud not in ('volunteers', 'donors', 'everyone') then v_aud := null; end if;
  if v_cat is not null and v_cat not in ('volunteers_welcome', 'volunteers_callouts', 'donors_thanks', 'donors_appeals', 'other') then v_cat := 'other'; end if;
  if v_lang not in ('en', 'fr') then v_lang := 'en'; end if;
  if jsonb_typeof(v_vars) <> 'array' then v_vars := '[]'::jsonb; end if;
  if v_name = '' then v_name := left(v_subject, 120); end if;

  if v_key is not null then
    select * into v_old from public.crm_email_templates where key = v_key for update;
    if not found then raise exception 'not_found'; end if;
    if v_old.design is null then raise exception 'not_studio'; end if;
    if not (v_admin or (v_old.created_by is not distinct from v_me and v_old.created_by <> 'starter')) then raise exception 'not_yours'; end if;
    update public.crm_email_templates set
      name = v_name, kind = v_kind, subject = v_subject, preheader = nullif(v_pre, ''), html_body = v_html, text_body = nullif(v_text, ''),
      vars = v_vars, design = v_design, one_off = v_one, audience = v_aud, category = case when v_one then null else coalesce(v_cat, 'other') end,
      lang = v_lang, description = v_desc, active = v_active, updated_by = v_me, updated_at = now()
     where key = v_key;
  else
    v_key := 'st_' || substr(md5(random()::text || clock_timestamp()::text || v_me), 1, 10);
    insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, vars, active, sort, updated_by, updated_at,
                                            design, one_off, audience, category, lang, description, created_by, created_at)
    values (v_key, v_name, v_kind, v_subject, nullif(v_pre, ''), v_html, nullif(v_text, ''), v_vars, v_active, case when v_one then 900 else 300 end, v_me, now(),
            v_design, v_one, v_aud, case when v_one then null else coalesce(v_cat, 'other') end, v_lang, v_desc, v_me, now());
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('mail', v_key, case when v_one then 'studio_one_off' else 'studio_template' end,
          case when v_old.key is null then null else left(v_old.name || ': ' || v_old.subject, 200) end, left(v_name || ': ' || v_subject, 200), v_me);
  return jsonb_build_object('key', v_key, 'updated_at', now(), 'one_off', v_one);
end $$;
comment on function public.email_studio_save(jsonb) is 'wave202: the email studio saves a design: {key (empty for a new one), name, kind, subject, preheader, html_body, text_body, design, vars, one_off, audience, category, lang, description, active}. Staff with the CRM page (not board viewers); a new row gets the key st_ plus ten letters; changing one needs its creator or an admin (the starters: admins), and never touches a system template (design is null). Logs mail studio_template or studio_one_off in change_log. Returns {key, updated_at, one_off}.';
revoke all on function public.email_studio_save(jsonb) from public, anon;
grant execute on function public.email_studio_save(jsonb) to authenticated;

-- ---------- remove: delete what nothing used, switch off what something did ----------
create or replace function public.email_studio_remove(p_key text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_me text := public.wa_email();
  v_role text;
  v_admin boolean := coalesce(public.is_wa_admin(), false) or public.wa_email() in ('steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com');
  v_old public.crm_email_templates%rowtype;
  v_used boolean;
begin
  select r.role into v_role from public.hub_roles r where r.email = v_me;
  if not public.is_wa_staff() or coalesce(v_role, 'member') in ('viewer', 'blocked') or coalesce(public.wa_page_ok('crm'), true) = false then
    raise exception 'not_allowed';
  end if;
  select * into v_old from public.crm_email_templates where key = p_key for update;
  if not found then raise exception 'not_found'; end if;
  if v_old.design is null then raise exception 'not_studio'; end if;
  if not (v_admin or (v_old.created_by is not distinct from v_me and v_old.created_by <> 'starter')) then raise exception 'not_yours'; end if;
  v_used := exists (select 1 from public.crm_email_sends s where s.template_key = p_key and not s.is_test)
         or exists (select 1 from public.crm_campaigns k where k.template_key = p_key)
         or exists (select 1 from public.crm_automations a where a.steps::text like '%"' || p_key || '"%');
  if v_used then
    update public.crm_email_templates set active = false, updated_by = v_me, updated_at = now() where key = p_key;
  else
    delete from public.crm_email_templates where key = p_key;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('mail', p_key, 'studio_remove', left(v_old.name || ': ' || v_old.subject, 200), case when v_used then 'switched off (it was sent, or a campaign or an automation uses it)' else 'deleted' end, v_me);
  return jsonb_build_object('key', p_key, 'deleted', not v_used, 'switched_off', v_used);
end $$;
comment on function public.email_studio_remove(text) is 'wave202: the email studio removes a design it made: deleted when nothing used it, switched off (active false) when it was sent, a campaign points at it or an automation step names it, so the history keeps its words. Same rights as email_studio_save; a system template is never touched. Logs mail studio_remove.';
revoke all on function public.email_studio_remove(text) from public, anon;
grant execute on function public.email_studio_remove(text) to authenticated;
