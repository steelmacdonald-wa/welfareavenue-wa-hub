-- Welfare Avenue Hub: wave289 undo, 07/11/26. Takes the email history scan's database objects out again (build/data/wa289_scan.sql).
-- Before running it: put llm back to v1.6 (it reads ai_routes.provider, which this file drops) and delete the mail-history function.
-- It refuses while a scan is unfinished (a phase other than done, failed or summarised on a run that is not purged), or while an email-history
-- run has a batch (wave292 must be undone first), or while crm_email_suppressions holds rows (opt-outs are never dropped), or while a route other
-- than the mail_history_* ones carries a provider setting. Otherwise it: removes the pump; drops the wa289_* functions; deletes the four
-- mail_history_* routes and the mail_ settings wave289 added when they still hold its value; drops ai_routes.provider; deletes the email-history
-- runs (their scans and staged rows go with them); drops the import_stage mail tables (mail_seen and mail_left_alone only when empty: holding
-- rows they are kept with every grant revoked, eh-289 M5 and design 11.8), crm_mail_scans, crm_email_suppressions and crm_import_runs.source. wave289 changed no live function. Safe to run twice.
-- No transaction control. Proved offline: node test/w289sql.mjs.

do $wa289u$
begin
  -- nested: a check on a table runs only once the table is known to exist (plpgsql plans each statement when it first runs)
  if to_regclass('public.crm_mail_scans') is not null then
    if exists (select 1 from public.crm_mail_scans s join public.crm_import_runs r on r.id = s.run_id where r.purged_at is null and s.phase not in ('done', 'failed', 'summarised')) then
      raise exception 'wave289 undo: a scan is still running; pause it and mark it failed (or let it finish) first';
    end if;
  end if;
  if to_regclass('public.crm_import_batches') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crm_import_runs' and column_name = 'source') then
    if exists (select 1 from public.crm_import_batches b join public.crm_import_runs r on r.id = b.run_id where r.source = 'email_history') then
      raise exception 'wave289 undo: an email-history run has batches; undo wave292 first';
    end if;
  end if;
  if to_regclass('public.crm_email_suppressions') is not null then
    if exists (select 1 from public.crm_email_suppressions) then
      raise exception 'wave289 undo: crm_email_suppressions holds rows; opt-outs are never dropped, so the undo stops here';
    end if;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_routes' and column_name = 'provider') then
    if exists (select 1 from public.ai_routes where provider is not null and task not like 'mail\_history\_%') then
      raise exception 'wave289 undo: a route other than mail_history_* carries a provider setting; ai_routes.provider stays, so the undo stops here';
    end if;
  end if;
end $wa289u$;

do $wa289u$
begin
  if to_regnamespace('cron') is not null and exists (select 1 from cron.job where jobname = 'wa-mail-history-pump') then perform cron.unschedule('wa-mail-history-pump'); end if;
end $wa289u$;

do $wa289u$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'wa289\_%' loop
    execute format('drop function if exists %s', f.sig);
  end loop;
end $wa289u$;

delete from public.ai_routes where task in ('mail_history_thread', 'mail_history_type', 'mail_history_org', 'mail_history_insight');
alter table public.ai_routes drop column if exists provider;

delete from public.app_config c
 using (values
    ('mail_history_mailboxes', '["steel.macdonald@welfareavenue.com", "hub@welfareavenue.com"]'),
    ('mail_history_since', '2020-04-01'),
    ('mail_history_cap_usd', '60'),
    ('mail_history_sample_cap_usd', '0.25'),
    ('mail_history_read_rate', '{"per_second": 10, "parallel": 5, "backoff_ms": 2000}'),
    ('mail_history_step_seconds', '{"step": 100, "lease": 180}'),
    ('mail_history_max_recipients', '5'),
    ('mail_history_personal_words', '["birthday", "condolence", "condolences", "funeral", "wedding", "mom", "dad", "maman", "papa", "family dinner", "vacation photos", "anniversaire", "funérailles", "mariage", "souper de famille"]'),
    ('mail_history_platforms', '["stripe", "paypal", "zeffy", "canadahelps", "eventbrite", "square", "squareup", "interac", "shopify", "amazon", "zoom", "calendly", "wix", "squarespace", "canva", "mailchimp", "google", "facebookmail", "linkedin", "slack", "notion", "dropbox", "docusign", "quickbooks", "intuit", "gofundme", "benevity", "givebutter", "donorbox"]'),
    ('mail_history_freemail', '["gmail.com", "googlemail.com", "outlook", "hotmail", "live", "msn.com", "yahoo", "ymail.com", "icloud.com", "me.com", "mac.com", "aol", "proton.me", "protonmail.com", "gmx", "mail.com", "zoho.com", "videotron.ca", "bell.net", "sympatico.ca", "rogers.com", "shaw.ca", "telus.net", "cogeco.ca", "sfr.fr", "orange.fr", "free.fr", "laposte.net"]'),
    ('mail_history_type_unsure', '0.5'),
    ('mail_history_kind_min', '0.8'),
    ('mail_history_org_type_min', '0.6'),
    ('mail_history_org_cap', '{"domains": 600, "seconds": 8, "bytes": 1048576, "pause_ms": 1000}'),
    ('mail_history_org_map', '{"partner": {"relationship": "partner", "category": "partner"}, "donor": {"relationship": "donor organisation", "category": "sponsor"}, "government": {"relationship": "partner", "category": "partner"}, "vendor": {"relationship": "supplier", "category": "collaborator"}, "media": {"relationship": "collaborator", "category": "collaborator"}, "volunteer": {"relationship": "collaborator", "category": "collaborator"}, "supporter": {"relationship": "collaborator", "category": "collaborator"}, "other": null}'),
    ('mail_history_steel_open', 'false'),
    ('mail_insights_quiet_months', '12'),
    ('mail_history_clips', '{"subject": 300, "line": 140, "summary": 600, "fresh": 1200, "emails_per_call": 8, "rows_per_summary": 60}')
  ) as x(k, v)
 where c.key = x.k and c.value = x.v;

do $wa289u$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crm_import_runs' and column_name = 'source') then
    delete from public.crm_import_runs r where r.source = 'email_history';
  end if;
end $wa289u$;

drop table if exists import_stage.mail_messages;
drop table if exists import_stage.mail_people;
drop table if exists import_stage.mail_orgs;
-- eh-289 M5 (design 11.8): mail_seen and mail_left_alone are the scan's memory (hashes and ids only). When they hold rows they are kept, with
-- every grant revoked, so a later scan never reads that mail again; empty, they go.
do $wa289u$
declare t text; v boolean;
begin
  foreach t in array array['mail_seen', 'mail_left_alone'] loop
    if to_regclass('import_stage.' || t) is not null then
      execute format('select exists (select 1 from import_stage.%I)', t) into v;
      if v then execute format('revoke all on table import_stage.%I from public, anon, authenticated, service_role', t);
      else execute format('drop table import_stage.%I', t); end if;
    end if;
  end loop;
end $wa289u$;
drop table if exists public.crm_mail_scans;
drop table if exists public.crm_email_suppressions;
alter table public.crm_import_runs drop constraint if exists crm_import_runs_source_check;
alter table public.crm_import_runs drop column if exists source;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave289', 'wave289 undo', null, 'The email history scan''s database objects were removed (wa289_undo.sql).', 'wave289'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave289' and field = 'wave289 undo');
