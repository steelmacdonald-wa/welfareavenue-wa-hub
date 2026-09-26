-- wave142 (26/09/26): Steel's answers to the conflicts the Drive mining found, and the meals and volunteers estimate.
--   Founding: April 2020. CRA registered charity: 18 October 2023. Quebec nonprofit: 1 October 2021 (both already right).
--   Fiscal year end: 30 September (already right). Moisson Montréal, Poulet Rouge and Dollarama: settled from the evidence.
--   Meals and volunteers: a reconciled estimate replaces the conflicting claims (see the wave142 doc for the method).
-- Rows changed here are stamped updated_by 'Steel MacDonald (answers 26/09/26)', so a reload of the mining never overwrites them.
-- Also: the Our story article for the assistant (hub_knowledge 'wa-our-story') is rebuilt from wa_history and
-- wa_history_years by wa_story_article_refresh(), and triggers keep it in step with every edit leaders make.

-- 1. the founding: March 2020 is where it started, April 2020 is when Welfare Avenue began
update public.wa_history set title = 'Where it started: groceries for a man living outside',
  summary = 'In March 2020, as the pandemic emptied downtown Montreal, Steel MacDonald, then a business student at Vanier College, noticed more and more people living on the streets during his walks. He bought a bag of groceries for a man living outside. A month later, that encounter became Welfare Avenue.',
  highlight = false, updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now()
where id = 1;
update public.wa_history set title = 'Welfare Avenue begins: an awareness video and the first GoFundMe', kind = 'milestone', highlight = true,
  summary = 'Welfare Avenue began in April 2020. With a few friends, the founder bought 100 McDonald''s Junior Chicken sandwiches to hand out downtown and published an awareness video about how the lockdown was hurting people living on the streets. The video reached many people, and donations through a GoFundMe page called ''Help the Unseen of COVID-19'' paid for the first weekly food runs.',
  updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now()
where id = 2;
update public.wa_history_years set summary = 'The year Welfare Avenue began, in April. In March, during Montreal''s first COVID-19 lockdown, the founder started buying food for people living on the emptied downtown streets; an April awareness video with a GoFundMe turned that into Welfare Avenue and weekly food runs from his car, backed by friends, community donors and Vanier College''s student association. By the fall the project had its name, a founding team, public volunteer sign-ups and its own social media, and was feeding up to 200 people a week, with hygiene products and clothing added to the meals.',
  updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now()
where year = 2020;

-- 2. 2021: the estimate, with what was reported at the time
update public.wa_history set title = 'Weekend servings run all year, twice a week',
  summary = 'Through the 2021 lockdowns and curfew, WA kept serving every weekend, usually on both Saturday and Sunday, with volunteer cooks preparing meals at home and volunteer drivers and servers bringing them downtown, before pausing for the holidays on 19 December 2021. The Hub estimates about 7,000 meals and about 170 active volunteers for the year; WA reported more than 8,000 meals at the time.',
  numbers = '{"meals": 7000, "volunteers": 168}'::jsonb, updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now()
where id = 22;
update public.wa_history_years set summary = 'The year WA grew from a student project into an organization. Weekend servings ran twice a week through lockdowns and curfew, about 7,000 meals by the Hub''s estimate (more than 8,000 were reported at the time); WA held its first major event at Berri-UQAM with Sportira, got its own tent and settled at Place Émilie-Gamelin. The student management team grew to 15 across four departments, new partners such as McGill''s Global Food Security Club joined, and on 1 October 2021 Welfare Avenue was incorporated as a Quebec nonprofit.',
  updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now()
where year = 2021;

-- 3. the partners, settled from the evidence
update public.wa_partners set notes = 'Settled (26/09/26): not a partner yet. WA applied for accreditation in 2022 and has not completed it, and no document shows food received from Moisson Montréal; decks that list it as a partner are out of date.',
  updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now() where name = 'Moisson Montréal';
update public.wa_partners set notes = 'Settled (26/09/26): it did not sponsor the 2025 tournament (the recap names Sportira and Athlon Combine as the sponsors), and it declined in May 2026.',
  updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now() where name = 'Poulet Rouge';
update public.wa_partners set notes = 'Settled (26/09/26): it donated to the 2025 holiday baskets (November 2025 strategy meeting); the outreach tracker''s ''no answer'' was one contact.',
  updated_by = 'Steel MacDonald (answers 26/09/26)', updated_at = now() where name = 'Dollarama';

-- 4. the key facts the assistant reads
update public.hub_knowledge set body = replace(replace(replace(replace(body,
  '- Welfare Avenue started in Montreal in March 2020, at the start of the COVID-19 pandemic, when founder Steel MacDonald began bringing food to people experiencing homelessness downtown. An awareness video he posted in April 2020 brought in the first donations and volunteers. [as of 2020-03]',
  '- Welfare Avenue began in Montreal in April 2020, early in the COVID-19 pandemic: in March founder Steel MacDonald began bringing food to people experiencing homelessness downtown, and in April his awareness video and a GoFundMe brought in the first donations and volunteers. [as of 2020-04]'),
  '- Welfare Avenue says it has served more than 25,000 meals since 2020, the figure used in its materials from late 2024 through 2026. [as of 2026-09-25]',
  '- Meals since 2020 (the Hub''s estimate, 26/09/26): about 23,000 meals and food bags from April 2020 to September 2026, most likely between 17,000 and 27,000. By year: about 3,000 in 2020, 7,000 in 2021, 4,000 in 2022, 3,000 in 2023, 2,300 in 2024 (the impact tracker''s 2,269), 2,000 in 2025 and 1,600 in 2026 to September. The figure to use is ''more than 20,000 meals''; the 25,000+ used in materials since December 2023 is higher than the year-by-year records support. [as of 2026-09-26]'),
  '- In 2025 Welfare Avenue distributed about 2,270 meals or food bags, up about 8% from roughly 2,100 the year before, and held 33 events in Montreal and Toronto. [as of 2025]',
  '- The impact tracker counts 2,269 meals or food bags at 25 events in 2024 and 2,100 at 30 events in 2023. In 2025 Welfare Avenue held 33 events in Montreal and Toronto, with about 50 people at a typical serving; the tracker has no 2025 meal count yet (the Hub''s estimate is about 2,000). [as of 2026-09-26]'),
  '- More than 600 volunteers, most of them students, have served with Welfare Avenue since 2020. [as of 2026-09-25]',
  '- Volunteers since 2020 (the Hub''s estimate, 26/09/26): about 850 people have volunteered, most of them students: just over 500 by mid-2023, then about 110 new volunteers a year. Materials say 600+; ''more than 700 volunteers'' is safe. [as of 2026-09-26]'),
  updated_at = now()
where slug = 'wa-key-facts';

-- 5. the Our story article: rebuilt from the story itself, and kept in step with every edit
create or replace function public.wa_story_article_refresh() returns void
language sql security definer set search_path = '' as $$
  update public.hub_knowledge k set title = 'Welfare Avenue: our story since April 2020', body = s.body, updated_at = now()
  from (
    select 'Our story: what Welfare Avenue has done since April 2020, year by year (from its own documents; the Our story page has every entry with its sources).' || E'\n\n' ||
           coalesce(string_agg(y.block, E'\n\n' order by y.yr), '') as body
    from (
      select ys.yr, '## ' || ys.yr || coalesce(E'\n' || (select w.summary from public.wa_history_years w where w.year = ys.yr), '') ||
        coalesce(E'\n' || (select string_agg('- ' || case h.date_precision when 'year' then to_char(h.date_start, 'YYYY') when 'day' then to_char(h.date_start, 'YYYY-MM-DD') else to_char(h.date_start, 'YYYY-MM') end
                                             || ': ' || h.title || '. ' || coalesce(h.summary, ''), E'\n' order by h.date_start, h.id)
                           from public.wa_history h where extract(year from h.date_start)::int = ys.yr and h.status = 'published' and h.visibility = 'everyone'), '') as block
      from (select distinct extract(year from x.date_start)::int as yr from public.wa_history x where x.status = 'published' and x.visibility = 'everyone'
            union select w.year from public.wa_history_years w) ys
    ) y
  ) s
  where k.slug = 'wa-our-story';
$$;
create or replace function public.wa_story_article_trg() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.wa_story_article_refresh();
  return null;
end
$$;
revoke all on function public.wa_story_article_refresh() from public, anon, authenticated;
revoke all on function public.wa_story_article_trg() from public, anon, authenticated;
drop trigger if exists wa_history_article on public.wa_history;
create trigger wa_history_article after insert or update or delete on public.wa_history for each statement execute function public.wa_story_article_trg();
drop trigger if exists wa_history_years_article on public.wa_history_years;
create trigger wa_history_years_article after insert or update or delete on public.wa_history_years for each statement execute function public.wa_story_article_trg();
select public.wa_story_article_refresh();

comment on function public.wa_story_article_refresh() is 'Rebuilds hub_knowledge wa-our-story (the story article the assistant reads) from the published everyone rows of wa_history and the year lines in wa_history_years; triggers on both tables call it after every change (wave142). Access: owner only.';

-- 6. the Avenue Academy: the foundations lesson says April 2020; the partners lesson names the right flag football partners
update public.trainings set description = replace(description, 'began in March 2020', 'began in April 2020'),
  body = replace(replace(replace(replace(replace(body::text,
    'How Welfare Avenue began in March 2020,', 'How Welfare Avenue began in April 2020,'),
    'Welfare Avenue began in March 2020, during Montreal''s first COVID-19 lockdown, when our founder started bringing food to people living on the emptied downtown streets.',
    'Welfare Avenue began in April 2020, early in Montreal''s first COVID-19 lockdown. A month before, our founder had started bringing food to people living on the emptied downtown streets.'),
    'An awareness video in April brought the first donations and volunteers.', 'In April an awareness video and a GoFundMe brought the first donations and volunteers.'),
    'March 2020, during the first COVID-19 lockdown', 'April 2020, early in the first COVID-19 lockdown'),
    'It began in March 2020. Incorporation (2021) and charity status (2023) came later.', 'It began in April 2020, a month after the founder first brought food downtown. Incorporation (2021) and charity status (2023) came later.')::jsonb,
  updated_at = now()
where key = 'lesson:story';
update public.trainings set body = replace(replace(body::text,
    '{"d": "Our Flag Football fundraiser: Flag Plus runs the games, Poulet Rouge sponsors.", "n": "MTL Flag Plus and Poulet Rouge", "s": "Active"}',
    '{"d": "Our annual Flag Football Fundraiser: 12 teams in 2025, 13 in 2026. Athlon Combine and Sportira supported the first.", "n": "Montreal Flag Football League", "s": "Active"}'),
    'Poulet Rouge (Flag Football)', 'Athlon Combine (Flag Football)')::jsonb,
  updated_at = now()
where key = 'lesson:partners';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('story', 'wave142', 'answers', null, 'Founding April 2020; 2021 meals estimate; Moisson Montréal, Poulet Rouge and Dollarama settled; key facts meals (about 23,000, say more than 20,000) and volunteers (about 850, say more than 700); lessons updated', 'Steel MacDonald (answers 26/09/26)');
