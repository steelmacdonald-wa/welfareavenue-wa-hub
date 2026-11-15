-- 14/11/26 - wave343 setup: the words of the volunteer welcome series, and the WhatsApp community link.
-- Run this whole file once in the Supabase SQL editor (project zwnmulmnvopclzcvytce). One block: if any check fails, nothing changes.
-- It writes the five emails into CRM > Automations > "Welcome new volunteers (Montreal)" and stores the WhatsApp community link.
-- It does NOT switch the series on and it emails nobody. You send yourself a test, read it, then switch it on in the CRM.
-- Undo: "14-11-26 - wave343 undo (only if needed).sql".

create table if not exists public.wa343_undo (k text primary key, v text, saved_at timestamptz default now());
alter table public.wa343_undo enable row level security;
revoke all on public.wa343_undo from anon, authenticated;
grant all on public.wa343_undo to service_role;
comment on table public.wa343_undo is 'wave343 (14/11/26): the welcome automation as it was before its words were written, for the undo. Drop after a week.';

do $w343$
declare a record; v_link text := '__WA_LINK__'; v_steps jsonb := $j343$[
 {
  "id": "s1",
  "type": "send",
  "email": "write",
  "route": "volunteer",
  "kind": "transactional",
  "subject": "Welcome to Welfare Avenue, {{first_name|friend}}",
  "headline": "Welcome to the crew",
  "preheader": "You are on the list. Here is what happens next.",
  "body": "Hi {{first_name|there}},\n\nThank you for signing up to serve with us. You just joined a youth-powered movement that meets people where they are, every second Sunday in Montreal.\n\nHere is what happens next.\n\nYou are on the list for the Sundays you picked. Our team confirms your spot by email, about a week and a half before each one.\n\nIf a Sunday fills up before we get to you, we will offer you the next one. Nobody who raises a hand gets left out.\n\nIn the meantime, join our volunteer community on WhatsApp. It is the easiest way to hear about upcoming dates and stay close to the team between servings.\n\nQuestions? Reply to this email. We read every one.\n\nWarmly,\nThe Welfare Avenue team",
  "cta_label": "Join the WhatsApp community",
  "cta_url": "__WA_LINK__"
 },
 {
  "id": "s2",
  "type": "task",
  "department": "opsmtl",
  "due_days": 3,
  "title": "Place {{full_name}} on a serving",
  "note": "They signed up on the volunteer form and are on the sign-up list of the dates they picked (Volunteer Manager, Events, each event's Team tab). Place them, or offer another date if theirs is full. Phone: {{phone|not given}}."
 },
 {
  "id": "s3",
  "type": "wait",
  "days": 2
 },
 {
  "id": "s4",
  "type": "send",
  "email": "write",
  "route": "volunteer",
  "kind": "volunteer",
  "subject": "How a Sunday works",
  "headline": "How a Sunday works",
  "preheader": "Three roles, a noon start, and what to expect on your first day.",
  "body": "Hi {{first_name|there}},\n\nBefore your first Sunday, here is how the day runs.\n\nWe serve every second Sunday, starting at noon.\n\nCooks make a dish for 30 to 35 people from our recipe book, with their own ingredients when they can. If that is hard, tell us and we will sort it out together. Cooks are welcome to bring their dish and stay to serve it.\n\nDrivers bring the food and the supplies to the serving.\n\nServers set up, serve, and take the time to talk with the people we serve. That conversation matters as much as the meal.\n\nNo experience needed. You will meet your team leader on the day, and they will show you everything. The day before, we send you where to meet and what to bring.\n\nOne thing we ask: if your plans change, tell us at least 4 days before, so someone else can take your spot.\n\nYour volunteer hours count for school and work.\n\nWarmly,\nThe Welfare Avenue team",
  "cta_label": "See the open Sundays",
  "cta_url": "https://welfareavenue.com/volunteer/"
 },
 {
  "id": "s5",
  "type": "wait",
  "days": 3
 },
 {
  "id": "s6",
  "type": "send",
  "email": "write",
  "route": "volunteer",
  "kind": "volunteer",
  "subject": "Why food comes first",
  "headline": "Food is the starting point",
  "preheader": "What a meal makes possible.",
  "body": "Hi {{first_name|there}},\n\nHere is the idea behind every Sunday.\n\nA meal is where it starts. Sharing food opens a conversation, the conversation builds trust, and trust is what connects someone with the support they need.\n\nSince April 2020, our volunteers have served more than 20,000 meals. Every one was cooked, driven and handed over by someone like you.\n\nAt each serving, our community leads sit down with the people we serve and listen. What we hear shapes what we do next.\n\nThat is what you are part of now.\n\nWarmly,\nThe Welfare Avenue team",
  "cta_label": "",
  "cta_url": ""
 },
 {
  "id": "s7",
  "type": "wait",
  "days": 3
 },
 {
  "id": "s8",
  "type": "send",
  "email": "write",
  "route": "volunteer",
  "kind": "volunteer",
  "subject": "Come say hi on WhatsApp",
  "headline": "Stay close between Sundays",
  "preheader": "Our volunteer community is one tap away.",
  "body": "Hi {{first_name|there}},\n\nThank you again for raising your hand.\n\nIf you have not joined yet, our volunteer community on WhatsApp is the easiest way to stay close between Sundays and hear about upcoming dates.\n\nKnow someone who would enjoy this? Forward them this email, or bring them along. Friends, classmates and coworkers are welcome, and groups can serve together.\n\nWarmly,\nThe Welfare Avenue team",
  "cta_label": "Join the WhatsApp community",
  "cta_url": "__WA_LINK__"
 },
 {
  "id": "s9",
  "type": "wait",
  "days": 4
 },
 {
  "id": "s10",
  "type": "send",
  "email": "write",
  "route": "volunteer",
  "kind": "volunteer",
  "subject": "Pick your next Sunday",
  "headline": "Pick your next Sunday",
  "preheader": "If your first date did not work out, there is always another.",
  "body": "Hi {{first_name|there}},\n\nIf you have already served with us, thank you. We hope to see you again.\n\nIf your first Sunday did not work out, or it filled up before we could place you, there is always another one. We serve every second Sunday, and the next dates are open for sign-up.\n\nPick the next one that works for you, and we will take it from there.\n\nAnd if now is not the right time, no worries at all. Reply to this email and tell us, and we will keep you posted for later.\n\nWarmly,\nThe Welfare Avenue team",
  "cta_label": "Pick a Sunday",
  "cta_url": "https://welfareavenue.com/volunteer/"
 }
]$j343$::jsonb;
begin
  if v_link !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$' then raise exception 'the WhatsApp link does not read as an invite link'; end if;
  select * into a from public.crm_automations where id = 1 for update;
  if not found or a.name not ilike 'Welcome new volunteers (Montreal)%' then raise exception 'the Montreal welcome automation was not found where expected'; end if;
  if a.status <> 'draft' then raise exception 'the welcome series is % (not a draft): pause it in the CRM first, then run this again', a.status; end if;
  if exists (select 1 from public.crm_automation_runs r where r.automation_id = 1 and not coalesce(r.is_test, false) and r.status = 'active') then raise exception 'someone is part-way through the series: tell Claude'; end if;
  insert into public.wa343_undo (k, v) values ('steps', a.steps::text), ('description', a.description), ('link', (select value from public.app_config where key = 'vol_whatsapp_community_url')) on conflict (k) do nothing;
  insert into public.app_config (key, value) values ('vol_whatsapp_community_url', v_link) on conflict (key) do update set value = excluded.value, updated_at = now();
  update public.crm_automations set steps = v_steps, description = $d343$The welcome for everyone who signs up on the volunteer form: a welcome the day they sign up (with the WhatsApp community), a task for Ops Montreal to place them, then four emails over twelve days: how a Sunday works, why food comes first, the WhatsApp community again, and pick your next Sunday. Written 14/11/26 (wave343).$d343$, updated_at = now() where id = 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_automation', '1', 'wave343', 'placeholders for Keela''s words', 'welcome series written: 5 emails over 12 days, a task for Ops Montreal, the WhatsApp community link; still a draft', 'Claude for Steel (14/11/26)');
end $w343$;

select name, status, jsonb_array_length(steps) as steps,
  (select count(*) from jsonb_array_elements(steps) s where s->>'type' = 'send') as emails,
  (select value from public.app_config where key = 'vol_whatsapp_community_url') as whatsapp_link
from public.crm_automations where id = 1;
