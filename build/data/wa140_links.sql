-- wave140 (26/09/26): link the organization names written in the timeline to their partner record (as another name),
-- so every name in a moment opens its partner. Re-run after reloading wa_partners from the refine output.
with m(partner, extra) as (values
  ('ASFA (Arts and Science Federation of Associations), Concordia', array['ASFA (Concordia)']),
  ('Canadian Street Soccer Association (CSSA)', array['Canadian Street Soccer Association']),
  ('Community Engagement Project (CEP)', array['CEP (Community Engagement Project)']),
  ('Concordia University Tea Enthusiast Association (CUTEA)', array['CUTEA (Concordia University Tea Enthusiast Association)']),
  ('Delta Kappa Epsilon McGill (DKE)', array['Delta Kappa Epsilon (McGill)']),
  ('Enactus Concordia', array['Enactus Concordia (Project SustainABite)']),
  ('Google (Google Ad Grants)', array['Google']),
  ('CASA Cares (CASA JMSB)', array['JMSB CASA Cares', 'JMSB CASA Cares (Concordia University)']),
  ('Montreal Flag Football League (MFL)', array['Montreal Flag Football League']),
  ('Café Pinocchio', array['Pinocchio (café)']),
  ('Political Science Student Association (PSSA), Concordia', array['Political Science Student Association (PSSA), Concordia University', 'PSSA (Concordia)']),
  ('Projets Autochtones du Québec (PAQ)', array['Projets Autochtones du Québec']),
  ('Reggie''s', array['Reggie''s (Concordia student bar)']),
  ('Sigma Theta Pi (Montreal)', array['Sigma Theta Pi']),
  ('SUS Social Sustainability (McGill)', array['SUS Social Sustainability (McGill University)']),
  ('The Home Depot Canada Foundation', array['The Home Depot Foundation (Orange Door Project)']),
  ('Toronto Community Housing (TCHC)', array['Toronto Community Housing']),
  ('Toronto Metropolitan University (TMU)', array['Toronto Metropolitan University']),
  ('Toronto Youth Food Policy Council (TYFPC)', array['Toronto Youth Food Policy Council']),
  ('RBC (Van Horne and Darlington branch)', array['RBC Royal Bank (Van Horne and Darlington branches)']),
  ('University of Toronto', array['University of Toronto Mississauga']),
  ('Concordia University', array['John Molson School of Business (Concordia University)', 'John Molson School of Business (JMSB), Concordia University'])
)
update public.wa_partners p
   set aka = (select array_agg(distinct x order by x) from unnest(coalesce(p.aka, '{}'::text[]) || m.extra) x)
  from m
 where p.name = m.partner and not (coalesce(p.aka, '{}'::text[]) @> m.extra)
returning p.name, p.aka;

-- a partner's years cover every moment that names it (only rows no leader has edited)
with m as (
  select p.id, min(extract(year from h.date_start))::int mn, max(extract(year from coalesce(h.date_end, h.date_start)))::int mx
  from public.wa_partners p join public.wa_history h on h.status = 'published' and exists (
    select 1 from unnest(h.partners) hp where public.wa_fold(hp) = any (array(select public.wa_fold(x) from unnest(array[p.name] || p.aka) x)))
  group by p.id)
update public.wa_partners p set first_year = least(coalesce(p.first_year, m.mn), m.mn), last_year = greatest(coalesce(p.last_year, m.mx), m.mx), updated_at = now()
from m where m.id = p.id and p.updated_by = 'wave140' and ((p.first_year is null or m.mn < p.first_year) or (p.last_year is null or m.mx > p.last_year));
