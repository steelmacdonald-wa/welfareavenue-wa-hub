-- wave220 (09/10/26): Steel's team phones, one record per person.
-- Merges each team member's personal volunteer/supporter contact into their staff contact
-- (crm_merge_contacts, as Steel), restores the full name, and sets the phone Steel gave.
-- Applied 09/10/26 as migration wa220_team_phones. The numbers are not kept in the repo: they are on the contacts.
do $$
declare
  m record; r jsonb; v_phones text[];
begin
  perform set_config('request.jwt.claims', '{"email":"steel.macdonald@welfareavenue.com","role":"authenticated"}', true);
  perform set_config('wa.no_automations', 'on', true);
  for m in select * from (values
      (449::bigint, array[4]::bigint[],            'Ahmed Fakhir',            'Ahmed',   'Fakhir',           '<number>'),
      (446,         array[1655,1653]::bigint[],     'Amanda Bujalski-Zoldak',  'Amanda',  'Bujalski-Zoldak',  '<number>'),
      (450,         array[70]::bigint[],            'Ian Odhiambo',            'Ian',     'Odhiambo',         '<number>'),
      (444,         array[77]::bigint[],            'Jemeela Taing',           'Jemeela', 'Taing',            '<number>'),
      (312,         array[2078]::bigint[],          'Novie Joy Dumansi',       'Joy',     'Dumansi',          '<number>'),
      (152,         array[151]::bigint[],           'Soraya Tyree',            'Soraya',  'Tyree',            '<number>'),
      (441,         array[164]::bigint[],           'Valex Sanon',             'Valex',   'Sanon',            '<number>')
    ) as t(keep, drops, full_name, first_name, last_name, phone)
  loop
    for i in 1 .. coalesce(array_length(m.drops, 1), 0) loop
      if exists (select 1 from public.crm_contacts where id = m.drops[i] and merged_into is null) then
        r := public.crm_merge_contacts(m.keep, m.drops[i]);
      end if;
    end loop;
    -- the given number first; other numbers kept unless they are the same number in another format
    select array[m.phone] || coalesce(array_agg(p order by ord), '{}') into v_phones
      from (select p, min(ord) ord from unnest((select phones from public.crm_contacts where id = m.keep)) with ordinality as x(p, ord)
             where right(regexp_replace(p, '\D', '', 'g'), 10) <> right(regexp_replace(m.phone, '\D', '', 'g'), 10)
               and btrim(p) <> '' group by p) z;
    update public.crm_contacts
       set phones = v_phones,
           full_name = m.full_name,
           first_name = coalesce(nullif(first_name, ''), m.first_name),
           last_name = coalesce(nullif(last_name, ''), m.last_name),
           kinds = case when 'staff' = any(coalesce(kinds, '{}')) then kinds else array_append(coalesce(kinds, '{}'), 'staff') end,
           updated_by = 'steel.macdonald@welfareavenue.com'
     where id = m.keep;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('crm_contact', m.keep::text, 'phones', null, 'Team phone from Steel (wave220)', 'steel.macdonald@welfareavenue.com');
  end loop;
  -- Amanda had no volunteer record (a Keela volunteer the directory never got): give her one, linked to her contact
  if not exists (select 1 from public.crm_contacts where id = 446 and volunteer_id is not null) then
    with p as (insert into public.volunteer_profiles (roles, joined_note) values (array['server'], 'Team member (wave220)') returning id)
    update public.crm_contacts c set volunteer_id = p.id, updated_by = 'steel.macdonald@welfareavenue.com' from p where c.id = 446;
  end if;
end $$;
