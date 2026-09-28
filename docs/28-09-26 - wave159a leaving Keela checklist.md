# 28/09/26 - wave159a: leaving Keela, the checklist (a live card at the top of the CRM's Sources tab)

The first part of step 7 of the plan (wave159, leaving Keela). The rest of wave159 needs Keela's final exports, which Steel downloads. This part shows, from what the Hub knows today, what is left before Keela can be cancelled, whose step each one is, and the date that matters. Nothing is sent or changed; it reads.

## What it does

**The date that matters.** Keela bills quarterly: the next charge is 19 December 2026 ($507 for the 2,500-contact plan plus $150 for automation a quarter, read in Keela on 28/09/26). Cancelling needs at least 7 days' notice, so notice goes by 12 December, and the aim is every step done by 5 December. The card counts the days left (78 on 28/09/26). These live in `app_config` (`keela_next_charge`, `keela_notice_days`, `keela_quarterly_cost`), so a later date is a change of setting, not of code.

**Six steps.** Each says what Keela does today, what the Hub has in its place, and what is next (Steel's step, the treasurer's, or the assistant's), with a status: done, in progress, waiting on a decision, or to do.

| Step | Today | Next |
|---|---|---|
| Contacts and gifts | In progress: the contacts and gifts from Keela are in the Hub | The final export (contacts with their subscription status and custom fields, the transactions with the receipts, the form answers that prove consent), imported and checked against Keela's counts. Steel downloads; the assistant imports |
| Forms | To do: 0 of the 3 forms are live | Steel puts them live, the website's buttons move to hub.welfareavenue.com/f/, and the Keela forms close |
| Automations | To do: 0 of 5 are on | 3 drafts still need the words of Keela's emails |
| Email | To do: test mode | Steel switches the mode to live |
| Tax receipts | Waiting on a decision: receipts are off, and who signs and the numbering are missing | The treasurer and Steel decide |
| Online donations | Waiting on a decision | Zeffy, or another option (`app_config` `keela_donation_form` names it once decided). Until then Keela's form stays on the website |

The count at the top ("0 of 6 done" today) follows the data. A form put live or an automation turned on shows at once.

## Files

- `build/data/wa159a_keela.sql`, applied as `wa159a_keela`: the four settings.
- `build/parts152/n_keela.js`, with hooks in:
  - `e_dupes.js`: the card at the top of Sources, and it loads the forms, automations, settings and gifts it reads.
  - `f_wire.js`: the CRM tour's step on the tabs now names every tab; test hook `window.w159`.
  - `assemble.py`.
- `test/w159drive.js`: 12 checks.
- `w152drive` now counts five cards in Sources.

## Deploy

Live since 10:16 on 28/09/26 (Toronto): the Hub at md5 29e0e3da1d698db765539946fb8f5730 (4,558,599 bytes), through the gated pipeline. The stage table `wa_stage_w159a` guarded on the live wave158b build and was dropped after. The release is in `change_log` (wave159a), and the live page boots with no page errors.

## Tests

On the candidate, all green: `w159drive` 12, `w158bdrive` 25, `w160drive` 39, `w158drive` 23, `w157drive` 26, `w156drive` 26, `w156page` 14, `w155drive` 22, `w154drive` 30, `w153drive` 44, `w152drive` 68, `w151drive` 26, `w147drive` 12, `w143drive` 16, `w141drive` 11, `w140drive` 50, `w139drive` 7, `w136drive` 16, `w134drive` 37.

`w150drive` passed 34 of 35. The failing check is the logo, which needs the network, as before.

## Next

The rest of wave159, once Steel downloads Keela's exports:

1. The final import, checked against Keela's counts.
2. The consent evidence (each newsletter opt-in with its date and wording) kept on the contacts.
3. Keela's forms closed.
4. The cancellation, with at least 7 days' notice before 19 December.
