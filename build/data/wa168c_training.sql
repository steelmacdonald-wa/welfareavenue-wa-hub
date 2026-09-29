-- wa168c_training (29/09/26): the Academy's page tours say where the photos now show (wave168).
update public.trainings set description = 'The year''s fundraising events with their photos and past fundraisers like them, the goals, and how to add and update them.'
  where id = 83 and key = 'tour:fundevents' and description = 'The year''s fundraising events, the goals, and how to add and update them.';
update public.trainings set description = 'Our photos, labelled and cleared for use, ready for posts, the Create studio, the fundraising events and the forms.'
  where id = 79 and key = 'tour:photos' and description = 'Our photos, labelled and cleared for use, ready for posts and the Create studio.';
-- and the cover's comment: the website's fundraisers take their photos from build/www (content.py), not from this column
comment on column public.fund_events.cover_photo_id is 'wave168: the event''s cover (wa_photos.id): on its card in the Events calendar and at the top of its page. A photo from an earlier edition says so.';
