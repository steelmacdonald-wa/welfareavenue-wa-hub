-- wave194 release data (02/10/26). The record of what ran.
-- 1. The certificate's signature (app_config cert_signature): the image Steel sent in the session, trimmed to the stroke
--    with a clear background and the ink set to Ground #1F201E (480 x 193 px PNG, 15,235 bytes), with the name and title
--    he chose ("Founder and Chair"). The picture is not kept in the repo: it lives in the database only, read by signed-in
--    staff (and board viewers, as app_config is) and written by admins only (wa_app_config_guard, cert_*). It went in
--    through a temporary staged row (md5 of the JSON a20e3f6acdb29c85da98fc81c74daeea, 20,536 characters):
--      insert into public.app_config (key, value, updated_at)
--      values ('cert_signature', '{"image":"data:image/png;base64,<the signature, not in the repo>","name":"Steel MacDonald",
--              "title":"Founder and Chair","org":"Welfare Avenue","updated_by":"assistant (wave194 session), from the signature Steel sent",
--              "updated_at":"2026-10-02T19:40:00Z"}', now())
--      on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('app_config', 'cert_signature', 'value', null, 'The signature on the Avenue Academy certificates (wave194): Steel MacDonald, Founder and Chair, Welfare Avenue; the image Steel sent in the session, trimmed. Set by the assistant at Steel''s request; admins change it from a certificate (Signature).', 'assistant (wave194 session)');

-- 2. The release line, right after the page went live (02/10/26 20:00 UTC, 16:00 in Toronto; change_log 4540).
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'wave194', 'hub_build', 'aaa7bd8e7b3348ada3a383d812370a8d', 'e07376daff6c15e2c91069f1136cd670 Updated since you finished: each changed step is opened (its module, its avenue or the step in the plan) before Close appears; opening saved in onboarding_update_opens, Close writes onboarding_update_acks; a gold bar on what opens with Close the update. The Avenue Academy certificate in the brand, signed by Steel MacDonald, Founder and Chair (app_config cert_signature, admins change it from a certificate); print A4 landscape with the brand fonts.', 'assistant (wave194 session)');
