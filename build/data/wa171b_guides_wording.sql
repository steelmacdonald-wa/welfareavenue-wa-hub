-- wa171b (30/09/26): the day-before text (itinerary and WhatsApp link) is not built yet, so the confirm page does not promise it.
update public.volunteer_role_guides set
  arrive_en = replace(arrive_en, 'The day before, we text you the itinerary and the WhatsApp group link.', 'Before the serving, the team shares the itinerary and the WhatsApp group with you.'),
  arrive_fr = replace(arrive_fr, 'La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.', 'Avant le service, l''équipe vous transmet l''itinéraire et le groupe WhatsApp.'),
  updated_at = now(), updated_by = 'wa171b'
where arrive_en like '%The day before, we text you%' or arrive_fr like '%La veille, nous vous textons%';
