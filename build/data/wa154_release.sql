-- wa154_release (28/09/26): run at deploy time, after the page ships. The Email tab lives on the CRM page (no new
-- page, no new profile decision); the CRM tour gained an Email step. The tables, the rule and the settings are in
-- wa154_email.sql and wa154_templates.sql (applied before the deploy).
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('site_deploy', 'wave154', 'release', null, 'the email foundation: Resend from welfareavenue.com (mail-send, mail-events, mail-unsubscribe), brand templates with the CASL footer, the permission rule (express, implied for two years after a gift or a serving as a registered charity, transactional to any working address, unsubscribed and bounced never), the CRM''s Email tab and Send an email from a contact''s page, sends on the timeline; test mode until an admin switches it to live', 'wave154');
