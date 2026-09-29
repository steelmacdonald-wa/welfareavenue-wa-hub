-- wa168_photos_brand (29/09/26): photos on the fundraising events and on every CRM form (wave168).
-- Steel: "Also where possible add photos to our fundraising events pages, all forms in the CRM - in fact really try to enhance
-- branding here" (both the Hub's event pages and the website's).
-- A fundraising event gets a cover from the Photo library, a gallery (a series of the Photo library: this year's, or last
-- year's edition) and the past fundraisers like it from the website's archive (site_events, with their posters). A form gets a cover
-- from the Photo library, shown at the top of its public page. Only photos marked ready are chosen, team and volunteer shots
-- or food, no close-ups of the people we serve. Every change is guarded: running it twice changes nothing.

-- 1. fundraising events
alter table public.fund_events add column if not exists cover_photo_id bigint;
alter table public.fund_events drop constraint if exists fund_events_cover_photo_id_fkey;
alter table public.fund_events add constraint fund_events_cover_photo_id_fkey foreign key (cover_photo_id) references public.wa_photos(id) on delete set null;
create index if not exists idx_fund_events_cover_photo_id on public.fund_events (cover_photo_id);
alter table public.fund_events add column if not exists photo_series text;
alter table public.fund_events add column if not exists past_site_events bigint[];

-- what we have: Flag Football 2026's own photos (and for next year's), last December's gift baskets, and the posters of the
-- website's past fundraisers where the event is the same kind (a flag football tournament, gift baskets, a St. Patrick's party
-- at Reggie's, a company's team cooking for us, variety shows, tabling)
update public.fund_events set cover_photo_id = 105, photo_series = 'flag-football-2026', past_site_events = array[7]::bigint[]
  where id = 1 and title = 'Flag Football 2026' and cover_photo_id is null;
update public.fund_events set cover_photo_id = 107, photo_series = 'flag-football-2026', past_site_events = array[7]::bigint[]
  where id = 13 and title = 'Flag Football 2027' and cover_photo_id is null;
update public.fund_events set cover_photo_id = 102, photo_series = 'gift-baskets-2025', past_site_events = array[14]::bigint[]
  where id = 4 and title = 'Gift Basket Drive 2026' and cover_photo_id is null;
update public.fund_events set past_site_events = array[5]::bigint[] where id = 6 and title = 'St. Patrick''s Party at Reggie''s' and past_site_events is null;
update public.fund_events set past_site_events = array[12]::bigint[] where id = 9 and title = 'Corporate Cook-Off' and past_site_events is null;
update public.fund_events set past_site_events = array[3, 13]::bigint[] where id = 20 and title = 'Talent show, karaoke or spelling bee' and past_site_events is null;
update public.fund_events set past_site_events = array[8]::bigint[] where id = 22 and title = 'Tabling at Montreal events' and past_site_events is null;

-- 2. forms
alter table public.crm_forms add column if not exists cover_photo_id bigint;
alter table public.crm_forms drop constraint if exists crm_forms_cover_photo_id_fkey;
alter table public.crm_forms add constraint crm_forms_cover_photo_id_fkey foreign key (cover_photo_id) references public.wa_photos(id) on delete set null;
create index if not exists idx_crm_forms_cover_photo_id on public.crm_forms (cover_photo_id);
update public.crm_forms set cover_photo_id = case slug when 'volunteer' then 9 when 'benevole' then 9 when 'toronto-volunteer' then 58
    when 'newsletter' then 3 when 'infolettre' then 3 when 'contact' then 26 when 'nous-joindre' then 26 end
  where cover_photo_id is null and slug in ('volunteer', 'benevole', 'toronto-volunteer', 'newsletter', 'infolettre', 'contact', 'nous-joindre');

-- 3. what they mean
comment on column public.fund_events.cover_photo_id is 'wave168: the event''s cover (wa_photos.id): on its card in the Events calendar, at the top of its page, and on the website. A photo from an earlier edition says so.';
comment on column public.fund_events.photo_series is 'wave168: the Photo library series shown as the event''s photos (wa_photos.series): its own, or last year''s edition.';
comment on column public.fund_events.past_site_events is 'wave168: the website''s past fundraisers like this one (site_events.id), shown with their posters on the event''s page.';
comment on column public.crm_forms.cover_photo_id is 'wave168: the photo at the top of the form''s public page (wa_photos.id); none uses the default for the form''s kind (form-submit).';
