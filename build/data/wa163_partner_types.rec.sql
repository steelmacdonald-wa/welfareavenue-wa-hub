-- wave163 (29/09/26): partners, collaborators and sponsors, told apart on the Partners page. Steel: "Add those 2, and ensure to
-- distinguish, partner, collaborator, and sponsors. No need to link the sheet, that sheet should be obsolete" (the Partner
-- Relations 2025-2030 sheet). The three words are the ones the Avenue Academy lesson "Our partners and how we work with them"
-- (training 52) already defines:
--   partner       works with us toward a shared goal through joint programs or initiatives, over time (ideally in an MOU or a
--                 project agreement);
--   collaborator  joins us for an event or initiative, without a formal agreement;
--   sponsor       gives money or in-kind support (goods, food, services, a grant) and gets recognition in return.
-- wa_partners.category holds the type; relationship keeps the finer detail (funder, donor organisation, supplier, venue). The
-- backfill follows relationship (sponsor, donor organisation and funder are sponsors), then each organization whose summary says
-- otherwise was moved by hand (listed below). GHD Group and Food Factory come in from the old sheet (the only two of its
-- organizations missing). The sheet stops being the reference: the partners lesson points to the Partners page, the old video on
-- using the sheet is retired, and the Document finder says the Partners page replaced it. Ask the Hub gets the type too.

alter table public.wa_partners add column if not exists category text;

update public.wa_partners set category = case
    when relationship in ('sponsor', 'donor organisation', 'funder') then 'sponsor'
    when relationship = 'collaborator' then 'collaborator'
    else 'partner' end
  where category is null;

-- moved by hand, from what each one did with us (id and name both checked)
update public.wa_partners x set category = m.category, relationship = coalesce(m.relationship, x.relationship), updated_by = 'wave163', updated_at = now()
  from (values
    (4,   'RBC (Van Horne and Darlington branch)',                       'collaborator', 'collaborator'),        -- staff volunteers at two events
    (5,   'Oberoi Financial Group',                                      'sponsor',      'sponsor'),             -- volunteers every summer and funds WA
    (55,  'University of Ottawa',                                        'collaborator', 'collaborator'),        -- students at one event (March 2026)
    (81,  'FlagPlus Football',                                           'collaborator', 'collaborator'),        -- one charity tournament (2023)
    (107, 'École de conduite Lauzon',                                    'sponsor',      'sponsor'),             -- part of its students' fees goes to WA
    (135, 'Daniella''s Delights',                                        'collaborator', 'collaborator'),        -- co-hosted two fundraisers
    (43,  'Toronto Youth Food Policy Council (TYFPC)',                   'partner',      'partner'),             -- joint work since 2025, an agreement drawn up
    (136, 'YMCA du Québec (C-Vert program)',                             'partner',      'partner'),             -- WA's workshops in its program, 2025 and 2026
    (137, 'Sustainable Youth Canada (Écosystème Jeunesse Canada Montréal)', 'partner',   'partner'),             -- co-delivers the C-Vert workshop
    (92,  'East Coast Donair',                                           'sponsor',      'donor organisation'),  -- donated the pizzas (October 2025)
    (69,  'Centre NAHA',                                                 'sponsor',      null),                  -- groceries at a steep discount (2020)
    (132, 'Westmount Florist',                                           'sponsor',      null),                  -- asked for flowers (2026)
    (87,  'La Licorne de Feu',                                           'collaborator', null),                  -- food vendor at one fundraiser
    (34,  'Dawson College',                                              'collaborator', null),                  -- campus events, no agreement
    (35,  'McGill University',                                           'collaborator', null),                  -- campus outreach, no agreement
    (111, 'Jet Nightclub',                                               'collaborator', null)                   -- hosted one party (2022)
  ) as m(id, name, category, relationship)
  where x.id = m.id and x.name = m.name;

alter table public.wa_partners alter column category set default 'partner';
alter table public.wa_partners alter column category set not null;
alter table public.wa_partners drop constraint if exists wa_partners_category_check;
alter table public.wa_partners add constraint wa_partners_category_check check (category in ('partner', 'collaborator', 'sponsor'));

comment on column public.wa_partners.category is 'What kind of relationship it is (wave163), as the Avenue Academy lesson Our partners and how we work with them defines it: partner (works with us toward a shared goal through joint programs or initiatives, over time, ideally in an MOU or a project agreement), collaborator (joins us for an event or initiative without a formal agreement) or sponsor (gives money or in-kind support and gets recognition). The Partners page groups by it; relationship keeps the finer detail.';
comment on column public.wa_partners.relationship is 'How they help, the finer detail under category: partner, collaborator, sponsor, funder, donor organisation, supplier or venue (a funder or a donor organisation is a sponsor; a supplier or a venue can be any of the three).';

-- the two organizations from the old Partner Relations sheet that were missing
insert into public.wa_partners (key, name, aka, kind, city, category, relationship, status, first_year, last_year, summary, contact_role, visibility, notes, sources, created_by, updated_by)
select v.key, v.name, v.aka, v.kind, v.city, v.category, v.relationship, v.status, v.first_year, v.last_year, v.summary, null, 'everyone', v.notes,
       jsonb_build_array(jsonb_build_object('url', 'https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit?usp=drivesdk', 'lead', false,
         'name', 'Partner Relations 2025-2030', 'quote', v.quote, 'where', 'Fundraising', 'file_id', '194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw')),
       'wave163', 'wave163'
  from (values
    ('ghd-group', 'GHD Group', array['GHD']::text[], 'business', 'Montreal', 'collaborator', 'collaborator', 'active', 2021, 2024,
     'Engineering and professional services company that held a volunteer event with WA in summer 2021 and called in 2024 to donate food. Some of its employees volunteer with WA often.',
     'The old partner sheet listed volunteering events and a sponsorship as the goals, and the relationship as developing.',
     'Did a wonderful volunteer event with them in summer 2021, also they called us in 2024 to donate food'),
    ('food-factory', 'Food Factory', array[]::text[], 'business', 'Montreal', 'partner', 'venue', 'declined', null, null,
     'Montreal kitchen WA looked at for cooking: at most four people can work in it at once (open to negotiation), selling food made there needs a certificate, and at least one person must hold the manager certification. The outreach went nowhere.',
     'The old partner sheet marked it a dead end: no reply, and no goal set yet.',
     '4 people max but capable of negotiation')
  ) as v(key, name, aka, kind, city, category, relationship, status, first_year, last_year, summary, notes, quote)
  where not exists (select 1 from public.wa_partners p where p.key = v.key or lower(p.name) = lower(v.name));

-- Ask the Hub: the type, in the partners it is given and in what it matches
do $do$
declare d text;
begin
  select pg_get_functiondef('public.wa_story_context(text[], integer[], boolean, boolean, boolean, boolean, integer)'::regprocedure) into d;
  if position('coalesce(x.category' in d) = 0 then
    if position('coalesce(x.kind, '''') || '' '' || x.relationship || '' '' || coalesce(x.city, '''')' in d) = 0 then raise exception 'wa_story_context: the partner match text has changed'; end if;
    if position('''relationship'', ps.relationship,' in d) = 0 then raise exception 'wa_story_context: the partner output has changed'; end if;
    d := replace(d, 'coalesce(x.kind, '''') || '' '' || x.relationship || '' '' || coalesce(x.city, '''')', 'coalesce(x.kind, '''') || '' '' || x.relationship || '' '' || coalesce(x.category, '''') || '' '' || coalesce(x.city, '''')');
    d := replace(d, '''relationship'', ps.relationship,', '''relationship'', ps.relationship, ''type'', ps.category,');
    execute d;
  end if;
end $do$;

-- the partners lesson (training 52): the Partners page is the list now, with the Hub's four statuses
do $do$
declare b text; n text; r text[]; pairs text[][] := array[
  array['Check the Partner Relations sheet for an existing relationship', 'Check the Partners page in the Hub for an existing relationship'],
  array['The sheet also shows the history, so your email starts in the right place.', 'The Partners page also shows the history, so your email starts in the right place.'],
  array['A relationship is marked Collaborated but dormant. What is the best move?', 'An organization we worked with before is marked Past on the Partners page. What is the best move?'],
  array['"Remove it from the sheet"', '"Delete it from the Partners page"'],
  array['Three words, three different relationships. Using the right one keeps our records, reports and thank-yous accurate.', 'Three words, three different relationships. Using the right one keeps our records, reports and thank-yous accurate, and the Partners page in the Hub shows which one each organization is.'],
  array['A snapshot from our Partner Relations sheet and this year''s plans. The sheet has the full list, points of contact and history.', 'A snapshot of who we work with and this year''s plans. The Partners page in the Hub has the full list: what each organization did with us, and whether it is a partner, a collaborator or a sponsor.'],
  array['what they did with us, the years, and the moments and documents they appear in. Check it, with the Partner Relations sheet, before you reach out.', 'whether it is a partner, a collaborator or a sponsor, what they did with us, the years, and the moments and documents they appear in. Check it before you reach out.'],
  array[', {"d": "Every organization, its status, point of contact, notes and completed goals.", "t": "Open the Partner Relations sheet", "url": "https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit", "type": "link"}', ''],
  array['Every organization in the sheet has a status. Moving a relationship forward is a team effort, so keep it current.', 'Every organization on the Partners page has a status. Moving a relationship forward is a team effort: tell your lead what changed so the page stays current.'],
  array['{"d": "Someone to contact. Pick an owner and a first step.", "t": "Follow up", "tone": "muted"}, {"d": "Conversations are happening. Agree on a first joint project.", "t": "Developing", "tone": "gold"}', '{"d": "Approached, nothing yet. Pick an owner and a first step, then agree on a first joint project.", "t": "Prospect", "tone": "gold"}'],
  array['{"d": "We have worked together and plan to keep going.", "t": "Established", "tone": "green"}', '{"d": "Working with us now. Keep the relationship going.", "t": "Active", "tone": "green"}'],
  array['{"d": "We worked together before. Re-engage with a specific ask.", "t": "Collaborated but dormant", "tone": "purple"}', '{"d": "We worked together before. Re-engage with a specific ask.", "t": "Past", "tone": "purple"}'],
  array['{"d": "No reply, or not interested. Note why, and move on.", "t": "Dead end", "tone": "flag"}', '{"d": "Said no, or never replied. Note why, and move on.", "t": "Declined", "tone": "flag"}'],
  array['{"d": "Before contacting an organization, look it up in the Partner Relations sheet. Someone may already own the relationship.", "t": "Check the sheet first"}', '{"d": "Before contacting an organization, look it up on the Partners page in the Hub. Someone may already own the relationship.", "t": "Check the Partners page first"}'],
  array['{"d": "Update the status, point of contact, notes and completed goals after each conversation.", "t": "Log every contact"}', '{"d": "After each conversation, tell your lead what changed (the status, what you agreed, what comes next) so the Partners page stays current. Leaders update it.", "t": "Log every contact"}'],
  array['{"d": "The live partner list.", "t": "Partner Relations 2025-2030", "url": "https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit"}', '{"d": "Every organization we have worked with or approached, and whether it is a partner, a collaborator or a sponsor.", "t": "Partners in the Hub", "url": "#partners"}']
];
begin
  select body::text into b from public.trainings where id = 52 and key = 'lesson:partners';
  if b is null then raise exception 'the partners lesson is missing'; end if;
  if position('Partner Relations' in b) = 0 then return; end if;  -- already done
  foreach r slice 1 in array pairs loop
    if (length(b) - length(replace(b, r[1], ''))) / length(r[1]) <> 1 then raise exception 'lesson 52: expected the text once: %', left(r[1], 90); end if;
    b := replace(b, r[1], r[2]);
  end loop;
  if position('Partner Relations' in b) > 0 or position('194k4xp372pFmAt1WO' in b) > 0 then raise exception 'lesson 52 still names the sheet'; end if;
  update public.trainings set body = b::jsonb, updated_at = now() where id = 52;
end $do$;

-- the old video on using the sheet is retired; the Partners page tour says what the page now shows
update public.trainings set active = false, updated_at = now() where id = 138 and title = 'The partner relations database: how to use it' and active;
update public.trainings set description = 'Every organization we have worked with or approached, whether it is a partner, a collaborator or a sponsor, and where each one stands.', updated_at = now()
  where id = 200 and title = 'Page tour: Partners';

-- the Document finder: the sheet is kept for its history, and says the Partners page replaced it
update public.wa_documents set summary = 'Replaced by the Partners page in the Hub (29/09/26). ' || summary, updated_at = now()
  where file_id = '194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw' and summary not like 'Replaced by the Partners page%';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('partners', 'wave163', 'category', 'one list, the relationship as a detail', 'partners, collaborators and sponsors told apart (wa_partners.category); GHD Group and Food Factory added; the Partner Relations sheet replaced by the Partners page', 'wave163');

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260929033000', 'wa163_partner_types', array[$m$alter table public.wa_partners add column if not exists category text$m$,$m$update public.wa_partners set category = case
    when relationship in ('sponsor', 'donor organisation', 'funder') then 'sponsor'
    when relationship = 'collaborator' then 'collaborator'
    else 'partner' end
  where category is null$m$,$m$update public.wa_partners x set category = m.category, relationship = coalesce(m.relationship, x.relationship), updated_by = 'wave163', updated_at = now()
  from (values
    (4,   'RBC (Van Horne and Darlington branch)',                       'collaborator', 'collaborator'),        -- staff volunteers at two events
    (5,   'Oberoi Financial Group',                                      'sponsor',      'sponsor'),             -- volunteers every summer and funds WA
    (55,  'University of Ottawa',                                        'collaborator', 'collaborator'),        -- students at one event (March 2026)
    (81,  'FlagPlus Football',                                           'collaborator', 'collaborator'),        -- one charity tournament (2023)
    (107, 'École de conduite Lauzon',                                    'sponsor',      'sponsor'),             -- part of its students' fees goes to WA
    (135, 'Daniella''s Delights',                                        'collaborator', 'collaborator'),        -- co-hosted two fundraisers
    (43,  'Toronto Youth Food Policy Council (TYFPC)',                   'partner',      'partner'),             -- joint work since 2025, an agreement drawn up
    (136, 'YMCA du Québec (C-Vert program)',                             'partner',      'partner'),             -- WA's workshops in its program, 2025 and 2026
    (137, 'Sustainable Youth Canada (Écosystème Jeunesse Canada Montréal)', 'partner',   'partner'),             -- co-delivers the C-Vert workshop
    (92,  'East Coast Donair',                                           'sponsor',      'donor organisation'),  -- donated the pizzas (October 2025)
    (69,  'Centre NAHA',                                                 'sponsor',      null),                  -- groceries at a steep discount (2020)
    (132, 'Westmount Florist',                                           'sponsor',      null),                  -- asked for flowers (2026)
    (87,  'La Licorne de Feu',                                           'collaborator', null),                  -- food vendor at one fundraiser
    (34,  'Dawson College',                                              'collaborator', null),                  -- campus events, no agreement
    (35,  'McGill University',                                           'collaborator', null),                  -- campus outreach, no agreement
    (111, 'Jet Nightclub',                                               'collaborator', null)                   -- hosted one party (2022)
  ) as m(id, name, category, relationship)
  where x.id = m.id and x.name = m.name$m$,$m$alter table public.wa_partners alter column category set default 'partner'$m$,$m$alter table public.wa_partners alter column category set not null$m$,$m$alter table public.wa_partners drop constraint if exists wa_partners_category_check$m$,$m$alter table public.wa_partners add constraint wa_partners_category_check check (category in ('partner', 'collaborator', 'sponsor'))$m$,$m$comment on column public.wa_partners.category is 'What kind of relationship it is (wave163), as the Avenue Academy lesson Our partners and how we work with them defines it: partner (works with us toward a shared goal through joint programs or initiatives, over time, ideally in an MOU or a project agreement), collaborator (joins us for an event or initiative without a formal agreement) or sponsor (gives money or in-kind support and gets recognition). The Partners page groups by it; relationship keeps the finer detail.'$m$,$m$comment on column public.wa_partners.relationship is 'How they help, the finer detail under category: partner, collaborator, sponsor, funder, donor organisation, supplier or venue (a funder or a donor organisation is a sponsor; a supplier or a venue can be any of the three).'$m$,$m$insert into public.wa_partners (key, name, aka, kind, city, category, relationship, status, first_year, last_year, summary, contact_role, visibility, notes, sources, created_by, updated_by)
select v.key, v.name, v.aka, v.kind, v.city, v.category, v.relationship, v.status, v.first_year, v.last_year, v.summary, null, 'everyone', v.notes,
       jsonb_build_array(jsonb_build_object('url', 'https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit?usp=drivesdk', 'lead', false,
         'name', 'Partner Relations 2025-2030', 'quote', v.quote, 'where', 'Fundraising', 'file_id', '194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw')),
       'wave163', 'wave163'
  from (values
    ('ghd-group', 'GHD Group', array['GHD']::text[], 'business', 'Montreal', 'collaborator', 'collaborator', 'active', 2021, 2024,
     'Engineering and professional services company that held a volunteer event with WA in summer 2021 and called in 2024 to donate food. Some of its employees volunteer with WA often.',
     'The old partner sheet listed volunteering events and a sponsorship as the goals, and the relationship as developing.',
     'Did a wonderful volunteer event with them in summer 2021, also they called us in 2024 to donate food'),
    ('food-factory', 'Food Factory', array[]::text[], 'business', 'Montreal', 'partner', 'venue', 'declined', null, null,
     'Montreal kitchen WA looked at for cooking: at most four people can work in it at once (open to negotiation), selling food made there needs a certificate, and at least one person must hold the manager certification. The outreach went nowhere.',
     'The old partner sheet marked it a dead end: no reply, and no goal set yet.',
     '4 people max but capable of negotiation')
  ) as v(key, name, aka, kind, city, category, relationship, status, first_year, last_year, summary, notes, quote)
  where not exists (select 1 from public.wa_partners p where p.key = v.key or lower(p.name) = lower(v.name))$m$,$m$do $do$
declare d text;
begin
  select pg_get_functiondef('public.wa_story_context(text[], integer[], boolean, boolean, boolean, boolean, integer)'::regprocedure) into d;
  if position('coalesce(x.category' in d) = 0 then
    if position('coalesce(x.kind, '''') || '' '' || x.relationship || '' '' || coalesce(x.city, '''')' in d) = 0 then raise exception 'wa_story_context: the partner match text has changed'; end if;
    if position('''relationship'', ps.relationship,' in d) = 0 then raise exception 'wa_story_context: the partner output has changed'; end if;
    d := replace(d, 'coalesce(x.kind, '''') || '' '' || x.relationship || '' '' || coalesce(x.city, '''')', 'coalesce(x.kind, '''') || '' '' || x.relationship || '' '' || coalesce(x.category, '''') || '' '' || coalesce(x.city, '''')');
    d := replace(d, '''relationship'', ps.relationship,', '''relationship'', ps.relationship, ''type'', ps.category,');
    execute d;
  end if;
end $do$$m$,$m$do $do$
declare b text; n text; r text[]; pairs text[][] := array[
  array['Check the Partner Relations sheet for an existing relationship', 'Check the Partners page in the Hub for an existing relationship'],
  array['The sheet also shows the history, so your email starts in the right place.', 'The Partners page also shows the history, so your email starts in the right place.'],
  array['A relationship is marked Collaborated but dormant. What is the best move?', 'An organization we worked with before is marked Past on the Partners page. What is the best move?'],
  array['"Remove it from the sheet"', '"Delete it from the Partners page"'],
  array['Three words, three different relationships. Using the right one keeps our records, reports and thank-yous accurate.', 'Three words, three different relationships. Using the right one keeps our records, reports and thank-yous accurate, and the Partners page in the Hub shows which one each organization is.'],
  array['A snapshot from our Partner Relations sheet and this year''s plans. The sheet has the full list, points of contact and history.', 'A snapshot of who we work with and this year''s plans. The Partners page in the Hub has the full list: what each organization did with us, and whether it is a partner, a collaborator or a sponsor.'],
  array['what they did with us, the years, and the moments and documents they appear in. Check it, with the Partner Relations sheet, before you reach out.', 'whether it is a partner, a collaborator or a sponsor, what they did with us, the years, and the moments and documents they appear in. Check it before you reach out.'],
  array[', {"d": "Every organization, its status, point of contact, notes and completed goals.", "t": "Open the Partner Relations sheet", "url": "https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit", "type": "link"}', ''],
  array['Every organization in the sheet has a status. Moving a relationship forward is a team effort, so keep it current.', 'Every organization on the Partners page has a status. Moving a relationship forward is a team effort: tell your lead what changed so the page stays current.'],
  array['{"d": "Someone to contact. Pick an owner and a first step.", "t": "Follow up", "tone": "muted"}, {"d": "Conversations are happening. Agree on a first joint project.", "t": "Developing", "tone": "gold"}', '{"d": "Approached, nothing yet. Pick an owner and a first step, then agree on a first joint project.", "t": "Prospect", "tone": "gold"}'],
  array['{"d": "We have worked together and plan to keep going.", "t": "Established", "tone": "green"}', '{"d": "Working with us now. Keep the relationship going.", "t": "Active", "tone": "green"}'],
  array['{"d": "We worked together before. Re-engage with a specific ask.", "t": "Collaborated but dormant", "tone": "purple"}', '{"d": "We worked together before. Re-engage with a specific ask.", "t": "Past", "tone": "purple"}'],
  array['{"d": "No reply, or not interested. Note why, and move on.", "t": "Dead end", "tone": "flag"}', '{"d": "Said no, or never replied. Note why, and move on.", "t": "Declined", "tone": "flag"}'],
  array['{"d": "Before contacting an organization, look it up in the Partner Relations sheet. Someone may already own the relationship.", "t": "Check the sheet first"}', '{"d": "Before contacting an organization, look it up on the Partners page in the Hub. Someone may already own the relationship.", "t": "Check the Partners page first"}'],
  array['{"d": "Update the status, point of contact, notes and completed goals after each conversation.", "t": "Log every contact"}', '{"d": "After each conversation, tell your lead what changed (the status, what you agreed, what comes next) so the Partners page stays current. Leaders update it.", "t": "Log every contact"}'],
  array['{"d": "The live partner list.", "t": "Partner Relations 2025-2030", "url": "https://docs.google.com/spreadsheets/d/194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw/edit"}', '{"d": "Every organization we have worked with or approached, and whether it is a partner, a collaborator or a sponsor.", "t": "Partners in the Hub", "url": "#partners"}']
];
begin
  select body::text into b from public.trainings where id = 52 and key = 'lesson:partners';
  if b is null then raise exception 'the partners lesson is missing'; end if;
  if position('Partner Relations' in b) = 0 then return; end if;  -- already done
  foreach r slice 1 in array pairs loop
    if (length(b) - length(replace(b, r[1], ''))) / length(r[1]) <> 1 then raise exception 'lesson 52: expected the text once: %', left(r[1], 90); end if;
    b := replace(b, r[1], r[2]);
  end loop;
  if position('Partner Relations' in b) > 0 or position('194k4xp372pFmAt1WO' in b) > 0 then raise exception 'lesson 52 still names the sheet'; end if;
  update public.trainings set body = b::jsonb, updated_at = now() where id = 52;
end $do$$m$,$m$update public.trainings set active = false, updated_at = now() where id = 138 and title = 'The partner relations database: how to use it' and active$m$,$m$update public.trainings set description = 'Every organization we have worked with or approached, whether it is a partner, a collaborator or a sponsor, and where each one stands.', updated_at = now()
  where id = 200 and title = 'Page tour: Partners'$m$,$m$update public.wa_documents set summary = 'Replaced by the Partners page in the Hub (29/09/26). ' || summary, updated_at = now()
  where file_id = '194k4xp372pFmAt1WO-WvDRoxjni0ZWPaRoaaEN8koDw' and summary not like 'Replaced by the Partners page%'$m$,$m$insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('partners', 'wave163', 'category', 'one list, the relationship as a detail', 'partners, collaborators and sponsors told apart (wa_partners.category); GHD Group and Food Factory added; the Partner Relations sheet replaced by the Partners page', 'wave163')$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
