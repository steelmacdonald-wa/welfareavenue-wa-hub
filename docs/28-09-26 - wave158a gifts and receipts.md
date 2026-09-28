# 28/09/26 - wave158a: gifts by hand and the receipt foundation (the Gifts tab records gifts; every gift's receipt status; the receipt settings and a sample CRA receipt)

The first part of step 6 of the plan (wave158 of the deep dive: gifts and receipts). Where online gifts are taken is still open (the deep dive recommends Zeffy, which issues its own receipts and would send gifts to the Hub by webhook; Steel, 27/09/26: "only if I have full customization capabilities on the forms that I embed on the website"), so this part builds what the Hub needs either way: the gifts that come without a platform, what kind of money each gift is, and what a receipt from the Hub must carry. Issuing official receipts (the numbering, the PDF, the email) is wave158b, after the treasurer confirms the settings: receipts from the Hub are off, and Keela's 55 receipts stay the legal copies.

## What it does

- **Record a gift** (the Gifts tab, and a contact's page for that person): the donor (picked from the CRM's list), the amount and the date received, what kind of money it is (a donation, a registration such as a tournament fee, a ticket, a sponsorship, a gift in kind, other), how it came (cheque, e-transfer, cash, card, online, other), the campaign and designation, what the person received and its description (the advantage, for a registration or a ticket), the description and appraiser of a gift in kind, a tribute (in honour or in memory of someone), notes. The form says as you type whether a receipt will be due and for how much. A gift recorded in the Hub (platform hub) starts the gift thank-you automation when it is on. A gift from Keela keeps its amount, date and donor; the Hub adds the rest. Admins delete a gift recorded in the Hub.
- **Every gift's receipt status** (`crm_gift_receipts_v`): receipted (a receipt number exists, Keela's included), due (a donation, a gift in kind that is described, or a registration or ticket whose advantage is at most 80 per cent of the amount, for the eligible amount), Zeffy receipts it, or no receipt with the reason in words (a sponsorship gets an invoice or a thank-you; the advantage is worth more than 80 per cent; Keela marked it as not receiptable). Receipts follow the donor's tax year (January to December), not the fiscal year. Today: 55 receipted from Keela, one marked not receiptable, none due.
- **Receipts** (`#crm/gifts/receipts`): the settings every receipt will carry (the charity's name and address as on file with the CRA, the registration number, where receipts are issued, the number prefix and the next number, who signs and their title), changed by admins only; the receipts due for a tax year by donor with the eligible total and a missing address flagged, which is the list for the year-end run; a sample receipt from any gift.
- **A sample receipt** (`crm_receipt_sample`): every field the CRA requires on an official receipt for a gift (the statement that it is an official receipt for income tax purposes, the charity's name, address and registration number, a serial number, where and when it is issued, the date the gift was received, the donor's name and address, the amount, the value and description of any advantage, the eligible amount, an authorized signature, the CRA's name and website), what is still missing in words, marked SAMPLE. It is never numbered, kept or sent; Print the sample prints it alone.
- **Settings guarded:** the email settings (`mail_*`, including the mode) and the receipt settings (`receipt_*`) in `app_config` now change only through an admin or the service role (`wa_app_config_guard`). Before this, any staff member could have changed the email mode directly through the database API; mail-send already checked the admin, and other staff settings (the finance AI guidance) are untouched.

## What the CRA requires, as read on 28/09/26

From [What information must be on an official donation receipt](https://www.canada.ca/en/revenue-agency/services/charities-giving/charities/operating-a-registered-charity/issuing-receipts/what-information-must-on-official-donation-receipt-a-registered-charity.html), [Correcting or replacing receipts](https://www.canada.ca/en/revenue-agency/services/charities-giving/charities/operating-a-registered-charity/issuing-receipts/correcting-replacing-official-donation-receipts.html) and [Computer-generated receipts](https://www.canada.ca/en/revenue-agency/services/charities-giving/charities/operating-a-registered-charity/issuing-receipts/computer-generated-receipts.html): the thirteen fields above (the donor's full name with a middle initial); for a gift in kind, a description and the appraiser; a replacement carries the original's serial number and says it replaces it, and the original is kept marked cancelled; a receipt sent by email must be read-only (a PDF), protected, signed with a secure electronic signature under the control of an authorized person, and a copy kept. That is what wave158b has to build.

## Access

`crm_donations` keeps its policies (staff with the CRM page read, add and edit; admins delete). `crm_gift_receipts_v` follows them (security invoker). `crm_receipt_config` and `crm_receipt_sample`: staff with the CRM page; `crm_receipt_config_set`: admins, every change in `change_log` (it cannot switch receipts on). Security advisor: the three join the known list of security-definer RPCs callable by signed-in users (each checks the caller); nothing else. Checked in transactions that were rolled back: a staff member who is not an admin is refused the email mode and the receipt settings and can still save the finance guidance; an admin saves the settings; the sample for a real gift lists what is missing.

## Files

`build/data/wa158_gifts.sql` (applied as `wa158_gifts`); `build/parts152/k_gifts.js` (the gift form, the sample receipt, Receipts) with hooks in `e_gifts.js` (the row: kind, method, tribute, the receipt status; Record a gift and Receipts in the bar), `a_head.js` (the gifts loader reads the new columns), `c_list.js` (the receipts route, the statuses load with the gifts), `d_sheet.js` (Record a gift on a contact's page), `f_wire.js` (tour step, test hook), `assemble.py`; `test/w158drive.js` (23 checks).

## Deploy

Live since 08:58 on 28/09/26 (Toronto): the Hub at md5 ffad5da9ec103efe79e6f749e00c8ec6 (4,497,255 bytes); the release is in `change_log` (entity_type release, wave158a). No gift was added or changed.

## Tests

On the candidate: `w158drive` 23, `w157drive` 26, `w156drive` 26, `w156page` 14, `w155drive` 22, `w154drive` 30, `w153drive` 44, `w152drive` 68, `w151drive` 26, `w147drive` 12, `w143drive` 16, `w141drive` 11, `w140drive` 50, `w139drive` 7, `w136drive` 16, `w134drive` 37, all green; `w150drive` 34 of 35 (the logo check needs the network, as before).

## Open on the treasurer's and Steel's side

1. The receipt settings in Receipts: the charity's name and address exactly as on file with the CRA, where receipts are issued, the numbering (a prefix and a first number that cannot be confused with Keela's KEE numbers), who signs and their title, and the signature image for wave158b.
2. Whether the Hub issues receipts at all: for cheques and e-transfers at least (Zeffy would receipt online gifts), and at the year-end run.
3. The 35 flag football registrations Keela receipted as donations (the summary for the treasurer, 28/09/26): the Hub records them as Keela did and changes nothing until the treasurer decides.
4. Donor addresses: 42 of the 46 donors have one; a receipt needs it.

## Next

wave158b once the settings are confirmed: numbered receipts in a PDF with the signature, sent by email through mail-send and kept in a private bucket, cancel and replace, and the year-end run; the Zeffy webhook if Zeffy is chosen. Then wave159, leaving Keela.
