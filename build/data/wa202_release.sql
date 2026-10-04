-- wave202 release data (04/10/26). The record of what ran, after wa202_email_studio (the schema and the two functions)
-- and wa202_email_studio_starters (the ten starters, from build/data/wa202_starters.js).

-- 1. The llm router's route for the studio (ran 04/10/26 04:08 UTC, right after the migration; Admin > AI models shows it).
insert into public.ai_routes (task, label, chain, jev, mode, max_tokens, notes, updated_at)
values ('email_studio', 'Email studio: putting emails together',
        array['anthropic/claude-sonnet-5', 'openai/gpt-5', 'anthropic/claude-sonnet-4.5'], false, 'chain', 8000,
        'wave202: the CRM''s email studio puts a designed email together (blocks in the brand) from what the writer gave and their photos, or fills a template with their details, and asks about anything missing or doubtful (dates, links, numbers). Claude first: it reads the photos and follows the tool''s schema and Welfare Avenue''s voice.',
        now())
on conflict (task) do update set label = excluded.label, chain = excluded.chain, jev = excluded.jev, mode = excluded.mode,
  max_tokens = excluded.max_tokens, notes = excluded.notes, updated_at = now();

-- 2. Two real calls through the route before the release (task email_studio, caller test:wave202; ai_calls only, nothing
--    saved or sent): the brief "We need three more servers this Saturday 11 October at Cabot Square, 11 to 2. Sign up on the
--    website." with a Photo library photo. The first (Sonnet 5, $0.0123) built a clean email but called 11 October 2026 a
--    Saturday (it is a Sunday) and added claims nobody made ("No experience needed", "we will confirm your spot"). The studio
--    now writes the coming three weeks out in the system prompt, checks the writer's own dates (d_checks' datesIn and
--    checkDate) and tells the model what it found, and forbids claims the writer did not make. The second ($0.0145) asked
--    "Did you mean Saturday 10 October or Sunday 11 October?", left [Saturday 10 or Sunday 11] October in the email, and kept
--    to the facts given.

-- 3. The page tour (row 231 on 04/10/26).
insert into public.trainings (key, kind, title, category, path_group, minutes, xp, active, sort, body, description)
select 'tour:studio', 'tour', 'Page tour: Email studio', 'Hub tours', 'Hub page tours', 2, 20, true, 42, '{"tab": "crm", "tour": "studio"}'::jsonb,
       'Emails in the Welfare Avenue brand for one person, a list or an automation: three ways to start (tell the Hub, a template, build it yourself), the Hub''s questions and checks, the editor, and sending or saving.'
where not exists (select 1 from public.trainings where key = 'tour:studio');

-- 4. The release line, right after the page went live (site_files at 04/10/26 05:06 UTC, 01:06 in Toronto; change_log 4747).
--    Deployed through the gated block (live d0612620... checked, ten staged parts checked by md5 and length, the markers, no
--    legacy palette, site_files swapped, post-check), host-sync ok (Netlify deploy 6ac1def645986f5e5cee34f9, one file
--    uploaded), hub.welfareavenue.com served 7704da352da4f87827371f6c59d462c0.
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave202', 'hub_build', 'd0612620de933dde9d58aa77243337c5',
       '7704da352da4f87827371f6c59d462c0 The CRM''s email studio (CRM > Studio, #crm/studio): Tell the Hub (words and photos put together by the llm router''s email_studio route), Start from a template (filled in by the Hub or by hand), Build it yourself; the Hub''s questions and the studio''s checks; a test, one person, a list (campaign draft) or a saved template for the automations; ten starters on four shelves. Netlify deploy 6ac1def645986f5e5cee34f9. Page tour row 231. mail_mode unchanged (test).',
       'assistant (wave202 session)'
where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave202' and field = 'hub_build');
