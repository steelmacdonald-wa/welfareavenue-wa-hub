-- wa168b_more_posters (29/09/26): more past fundraisers like each event (wave168), and one date put right.
-- St. Patrick's at Reggie's: the two Party for a Good Cause nights were at Reggie's too. The Corporate Cook-Off is a bake-sale
-- competition between companies: the two cupcake sales and Adaptavist's team cooking for us. The One Bag Challenge is a
-- clothing fundraiser: the Hotel Zero1 clothing drive. The Sports Tournament: the FlagPlus tournament. Guarded, so running it
-- twice changes nothing; each stays editable on the event's page.
update public.fund_events set past_site_events = array[1, 2, 5]::bigint[] where id = 6 and title = 'St. Patrick''s Party at Reggie''s' and past_site_events = array[5]::bigint[];
update public.fund_events set past_site_events = array[9, 11, 12]::bigint[] where id = 9 and title = 'Corporate Cook-Off' and past_site_events = array[12]::bigint[];
update public.fund_events set past_site_events = array[4]::bigint[] where id = 3 and title = 'One Bag Challenge' and past_site_events is null;
update public.fund_events set past_site_events = array[7]::bigint[] where id = 11 and title = 'Sports Tournament' and past_site_events is null;
-- the St. Patty's party at Reggie's was on 17 March 2023 at 10 pm (its poster; the new website says the same); the archive had
-- the day it was posted
update public.site_events set starts_at = '2023-03-17 22:00:00 America/Toronto'::timestamptz where id = 5 and title = 'Reggie''s St. Patty''s Party' and starts_at::date = '2023-11-10';

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260929101000', 'wa168b_more_posters', array[$m$update public.fund_events set past_site_events = array[1, 2, 5]::bigint[] where id = 6 and title = 'St. Patrick''s Party at Reggie''s' and past_site_events = array[5]::bigint[]$m$,$m$update public.fund_events set past_site_events = array[9, 11, 12]::bigint[] where id = 9 and title = 'Corporate Cook-Off' and past_site_events = array[12]::bigint[]$m$,$m$update public.fund_events set past_site_events = array[4]::bigint[] where id = 3 and title = 'One Bag Challenge' and past_site_events is null$m$,$m$update public.fund_events set past_site_events = array[7]::bigint[] where id = 11 and title = 'Sports Tournament' and past_site_events is null$m$,$m$update public.site_events set starts_at = '2023-03-17 22:00:00 America/Toronto'::timestamptz where id = 5 and title = 'Reggie''s St. Patty''s Party' and starts_at::date = '2023-11-10'$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
