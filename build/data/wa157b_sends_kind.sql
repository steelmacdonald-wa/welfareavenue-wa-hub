-- wa157b_sends_kind (28/09/26): the send log accepts the volunteer kind.
-- wave155 added the volunteer kind to the permission rule and to campaigns, but crm_email_sends kept its old check
-- (transactional, newsletter, fundraising, test), so a volunteer call-out could not have been queued. Found by the
-- wave157 engine tests before anything was sent (mail_mode has stayed test).
alter table public.crm_email_sends drop constraint if exists crm_email_sends_kind_check;
alter table public.crm_email_sends add constraint crm_email_sends_kind_check check (kind in ('transactional', 'newsletter', 'fundraising', 'volunteer', 'test'));
