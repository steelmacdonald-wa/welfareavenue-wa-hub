# 28/09/26 - wave158b: official receipts from the Hub (numbered PDF receipts, the year-end run, replace and cancel), built with receipts off

The second part of step 6 of the plan Steel approved on 27/09/26 (wave158: "CRA receipts with numbering, PDF email, cancel and reissue, the year-end run"). Everything is built and deployed, and **receipts from the Hub are off** (`receipt_mode` off): nothing was issued, numbered or sent, and nothing can be until an admin switches receipts on in Receipts, which needs every setting and a signature image. The treasurer and Steel decide that; the assistant never does. Keela's 55 receipts stay the legal copies until then. If Zeffy or Keela ends up issuing every receipt instead, the switch simply stays off.

## What it does

- **Receipts** (`#crm/gifts/receipts`) says whether receipts from the Hub are on and what is still missing, in words: today "the next number, who signs and a signature image".
- **The signature:** an admin uploads a PNG or JPG. The Hub keeps it as a PNG no wider than 900 pixels at `receipts/settings/signature.png` in a private bucket, and shows it from a short-lived link.
- **The switch:** Turn receipts on… opens only once nothing is missing, asks first (with the first number it will use), and calls `crm_receipt_mode_set` (admins, logged). Turn receipts off stops issuing and replacing; cancelling still works.
- **Issuing** (admins, only while on): Issue beside a donor in the receipts due for a tax year gives one receipt for that donor's due gifts of the year (a single gift, or several together). Issue one receipt per donor is the year-end run. Each receipt takes the next number from the settings, then receipt-pdf draws its official PDF once and keeps it in the private bucket.
- **The receipts issued:** each with its serial number, donor, eligible amount, date and status (issued, cancelled, or replaced by which number, with the reason), its PDF and the copy marked cancelled (opened from a two-minute link). An admin can Replace (while on) or Cancel, and each needs the reason in a few words. A replacement takes the next number, prints the donor as they are now, and says which receipt it cancels and replaces. The original is kept, marked cancelled, as the CRA requires.
- **A sample downloads as a PDF** (Download the sample on the sample sheet): the real layout, marked SAMPLE, never numbered, kept or sent. This is what the treasurer can review.
- **Safety in the database:** a gift on an issued receipt keeps its amount, advantage, date and kind, and cannot be deleted, until the receipt is replaced or cancelled. A donor's receipts follow them when two contacts are merged, and the printed donor stays as issued. A number already used (in the Hub or on a Keela gift) is refused.

## The PDF

Letter size, with the Hub's brand logo, the charity's name, address and registration number, and the statement "Official receipt for income tax purposes". Then:

- the receipt number, the date and place issued
- the donor's name and address
- the date the gift was received (or the year and a table of the gifts for a receipt covering several)
- the amount (the fair market value for a gift in kind, with its description and the appraiser)
- the value and description of the advantage, and the eligible amount
- the signature image with the signatory's name and title
- "Canada Revenue Agency: canada.ca/charities-giving" and a thank-you line

These are the fields of the CRA page read on 28/09/26 (see the wave158a doc for the links). Samples carry SAMPLE across the page and a line saying they are not receipts; kept copies of cancelled receipts carry CANCELLED.

The standard PDF fonts print Western European letters. A name or address they cannot print stops an official copy with a message ("issue this receipt by hand"), and a sample shows ? instead.

## The database

Migration `wa158b_receipts`:

- `crm_receipts`: every receipt, with its serial, the gifts, the donor and charity as printed, the amounts, where, when and by whom it was issued, what it replaces or was replaced by, the cancellation and its reason, and the PDF paths with a SHA-256. Staff with the CRM page can read it; it is written only through the functions.
- The functions, admin-only unless noted:
  - `crm_receipt_issue(gift ids)`: only while on.
  - `crm_receipt_replace(id, reason)`: only while on.
  - `crm_receipt_cancel(id, reason)`: whatever the mode.
  - `crm_receipt_mode_set(on or off)`: turning on needs every setting and the signature.
  - `crm_receipt_make`: internal. It takes the next number under a row lock and needs one donor, one tax year, every gift due, the settings complete, and the donor's name and address.
  - `crm_receipt_doc(id)`: staff with the CRM page.
  - `crm_receipt_pdf_set`: service role only.
  - `crm_receipt_missing(settings)`.
- `crm_receipt_config` now also says whether a signature is uploaded, what is missing, and how many receipts are issued.
- Triggers: `crm_donations_receipt_guard` and `crm_receipts_follow_merge`.
- The private bucket `receipts` (PDF and PNG, 5 MB): staff with the CRM page read; only an admin writes the signature; the service role writes the PDFs.

Every issue, replacement, cancellation and mode change goes to `change_log`.

## Checked

**In transactions that were rolled back, against the live database:**
- As Steel:
  - Issuing is refused while off, and turning on is refused with what is missing.
  - With the settings filled and the mode on (inside the test only), two gifts of one donor became receipt TEST-0007 (annual, $150 received, $30 advantage, $120 eligible, the next number moved to 8), and their view status became receipted.
  - Two tax years in one receipt, the same gift twice, changing an amount on the receipt and deleting a gift on it were all refused.
  - Replace made TEST-0008 "replaces TEST-0007" and marked the original cancelled by it. Cancel returned the gifts to due. Three lines went to `change_log`.
- A staff member who is not an admin was refused issuing, cancelling and the switch, could not upload a signature or write `receipt_mode` directly, and could read the receipts list.
- An admin could upload the signature, and nobody but the service role can write other files in the bucket.

**receipt-pdf v2** (platform version 2), deployed through fn-deploy from SQL with the source staged in a temporary table (dropped):
- Its check drew a made-up receipt in the function (a 20 KB PDF with the logo).
- It saved it in the bucket and removed it again.
- The bucket is empty.

The drawing was also checked locally with pdf-lib: a sample, an annual replacement and a cancelled gift in kind, looked at as images.

## Access

No new page. The Receipts view follows the CRM page, and the admin controls follow `is_admin` from the database. Security advisor after the migration: no ERROR; no CRM function is callable by anon; the five receipt RPCs join the known list of security-definer functions for signed-in users, and each checks the caller.

## Files

- `build/data/wa158b_receipts.sql` (applied as `wa158b_receipts`)
- `fn/receipt-pdf` (`render.js`, `serve.ts`, `build.py` → `index.ts`, `meta.json`)
- `build/parts152/m_receipts.js`, with hooks in:
  - `k_gifts.js`: the state, signature and switch in the settings card, Issue and the year-end run in the due list, the issued list, Download the sample
  - `e_gifts.js`: loads the receipts issued
  - `c_list.js`: resets the view on the route
  - `f_wire.js`: tour text, test hook `window.w158b`
  - `assemble.py`
- `test/w158bdrive.js` (25 checks)
- `docs/EDGE_FUNCTIONS.md` (receipt-pdf) and `docs/DATA_MODEL.md` regenerated

## Deploy

Live since 10:02 on 28/09/26 (Toronto): the Hub at md5 0530660e9da482dbd2625edb838bef33 (4,549,853 bytes), through the gated pipeline (stage `wa_stage_w158b`, guard on the live wave160 build, dropped after). The release is in `change_log` (wave158b). The live page boots with no page errors.

## Tests

On the candidate, all green: `w158bdrive` 25, `w160drive` 39, `w158drive` 23, `w157drive` 26, `w156drive` 26, `w156page` 14, `w155drive` 22, `w154drive` 30, `w153drive` 44, `w152drive` 68, `w151drive` 26, `w147drive` 12, `w143drive` 16, `w141drive` 11, `w140drive` 50, `w139drive` 7, `w136drive` 16, `w134drive` 37. `w150drive` passed 34 of 35: its logo check needs the network, as before.

## Open on the treasurer's and Steel's side

1. Look at a sample: Receipts → Sample beside a donor → Download the sample (PDF).
2. Fill the settings and upload the signature: who signs and their title, the prefix and first number (not KEE), and the charity's name and address exactly as on file with the CRA.
3. Decide whether receipts from the Hub go on: for cheques and e-transfers at least, and for the year-end run in January. Then an admin turns them on. Until then Keela keeps issuing.
4. The football registrations, per the treasurer's summary.

## Next

Emailing a receipt (mail-send with the PDF attached, through the permission rule as a message about something they did, test mode first) was left for the next session. Receipts can be downloaded and sent by hand until then. After that: the Zeffy webhook if Zeffy is chosen, and wave159, leaving Keela.
