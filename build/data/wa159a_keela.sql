-- wave159a (28/09/26): Leaving Keela, the checklist at the top of the CRM's Sources tab. The dates it counts from, as read in
-- Keela on 28/09/26 (read-only): billed quarterly on the 19th, the next charge on 19 December 2026, $507 for the 2,500-contact
-- plan plus $150 for automation a quarter; cancelling needs at least 7 days' notice. keela_donation_form stays empty until the
-- online donations are decided (Zeffy or another option); then it names where donations go. Staff may update these.
insert into public.app_config (key, value, updated_at) values
  ('keela_next_charge', '2026-12-19', now()),
  ('keela_notice_days', '7', now()),
  ('keela_quarterly_cost', '657', now()),
  ('keela_donation_form', '', now())
on conflict (key) do nothing;
