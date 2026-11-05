# wave274d brief: Keela out, the Toronto answers in (for one builder with no other context)

Status: **ready once the two Keela form exports exist** (CSV, from Keela's form responses for *Toronto Volunteer
Registration* and *Welfare Avenue Toronto Student Registration Form*). Welfare Avenue cancels Keela by 05/12/26; the next
charge is 19/12/26. Repository: `/home/user/welfareavenue-wa-hub`. Do not commit, push, apply SQL or touch any database.

## 1. The goal

The Hub's CRM already holds the Toronto volunteers as contacts (44 tagged `toronto volunteer` on 05/11/26, from a Keela
contacts export, `crm_contacts.source = 'keela'`, the Keela id in `legacy_refs.keela.contact_id`), but **not their form
answers**: the part of the GTA, the school, the days, 16 or older, photo consent, experience, support needs. Write a
repeatable import that puts those answers on the right contacts, adds the people who registered after the contacts export,
and says exactly what it would change before anything changes.

## 2. Privacy first

The exports hold people's names, emails and phones. **They never go in the repository**, and neither does anything the
script writes from them. The script reads the CSVs from a path given on the command line and writes its outputs to a path
given on the command line (a private folder). Only the script, its tests with made-up rows, and the doc are committed.

## 3. The work

- `build/data/wa274d_keela_toronto.py` (Python 3, standard library only):
  - `--general <csv> --student <csv> --contacts <json> --out <dir>`. `--contacts` is a JSON export of the Toronto-relevant
    `crm_contacts` rows (`id, full_name, primary_email, emails, phones, city, tags, org_id, volunteer_id, legacy_refs`) and
    of `volunteer_orgs (id, name, short)` and `crm_fields (id, key)`, made with the read-only query in the doc.
  - Map the Keela columns by header, flexibly (case, spacing, punctuation; print every header it could not map). Targets:
    first and last name, email, phone, `gta_area` (one of Downtown Toronto, Midtown (Yonge-Eglinton), North York, East
    York, York, Etobicoke, Scarborough; anything else kept as written and reported), `age_16_plus`, `photo_consent`
    (yes / no), `days_available` (weekday names), `food_nonprofit_experience`, `support_note`, the school (student form)
    matched to `volunteer_orgs` by name, short name or alias, the submission date.
  - Match people by email (any of `emails`, folded), then by the Keela contact id, then by phone digits; never by name
    alone (names go in a "check by hand" list).
  - Outputs in `--out`: `report.md` (counts; matched, new, ambiguous; every unmapped header and value; the people to
    check by hand), `apply.sql` (one transaction: upsert `crm_contact_fields` with `source = 'keela:toronto'`, set
    `city = 'Toronto'` only where it is empty, add the tags `toronto` and, for the student form, `toronto student`, set
    `org_id` only where it is empty, insert the new contacts with `source = 'keela'`), and `undo.sql` (puts every changed
    value back).
  - A `--self-test` that runs on built-in made-up rows and checks the matching, the mapping and the SQL quoting.
  - Adding tags fires the CRM's tag automations (trigger `crm_auto_on_tags` on `crm_contacts`). `report.md` must say
    so at the top, and the doc tells Steel to check that no automation on `toronto` or `toronto student` is turned on
    (the "Welcome new volunteers (Toronto)" automation of wave157 is a draft) before applying.
- `docs/<date> - wave274d Keela out, the Toronto answers in.md`: how to export from Keela, the read-only query for
  `--contacts`, how to run it, how Steel reviews `report.md` and applies `apply.sql`, how to undo.

## 4. Hand back

The files; the self-test output; the headers you expect Keela to use and how unknown ones are reported; anything the
elephant should know.
