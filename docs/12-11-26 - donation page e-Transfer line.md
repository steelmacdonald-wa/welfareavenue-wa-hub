# 12/11/26 - The donation page: a line under the amount, always shown, offers an Interac e-Transfer and asks for a mailing address for a tax receipt (give/index.html v7)

Status: BUILT AND TESTED, NOT LIVE YET. Publishing from the session was refused (a production deploy needs Steel's own go), so Steel runs `12-11-26 - donation page e-Transfer line with receipt note, release.sql` once in the Supabase SQL editor. The release and undo files are in the Claude project "Welfare Avenue Executive Assistant" (`claude/`).

## What was asked

Steel, 12/11/26, in three messages. First, with a screenshot of the message under Other amount ("For a gift above $10,000, please write to info@welfareavenue.com."): "Could we also add and say consider sending an etransfer to info@welfareavenue.com to avoid payment processor fees?" Then, on the wording: "Yes that's good but the avoid processing fees should always be there even before a number is entered". Then "Sure" to adding a sentence asking for the donor's mailing address in the e-Transfer message, for a tax receipt.

## What changes

A line under the Other amount box, always shown: before anything is typed, for Give once and Give monthly, on campaign links, in English and French. It is on hub.welfareavenue.com/give and in the Donate pop-up on welfareavenue.com (the same page in a frame), in the small grey text of the page's other notes.

- English: "You can also send an Interac e-Transfer to info@welfareavenue.com to avoid payment processing fees. Include your mailing address in the message for a tax receipt."
- French: "Vous pouvez aussi envoyer un Virement Interac à info@welfareavenue.com pour éviter les frais de traitement des paiements. Indiquez votre adresse postale dans le message pour obtenir un reçu fiscal."

The message for an amount above the maximum stays as it is ("For a gift above $10,000, please write to info@welfareavenue.com."). The new line sits right under it, so the e-Transfer is said once. The e-Transfer address is written out in the page, not taken from the reply-to setting (`mail_reply_to`), so changing that setting never changes where e-Transfers are sent.

Two earlier versions were built on 12/11/26 and never released: the sentence inside the over-the-maximum message only (`33e54a3d`), then the line always shown without the receipt sentence (`13e5bf54`). Their release files are withdrawn. If one of them was run all the same, the release file notices and takes that version out first.

## Release (Steel)

1. Run the whole of `12-11-26 - donation page e-Transfer line with receipt note, release.sql` once in the Supabase SQL editor. A good run ends with one row whose `give_md5` is `c04f7e4e89499b77214c848f287bf864`.
2. One to two minutes later, open hub.welfareavenue.com/give: the line is under Other amount.

The file changes only `site_files` `give/index.html` (`62081e25` to `c04f7e4e`, 69,630 to 70,360 bytes), logs one `change_log` row and calls host-sync. It stops with "Nothing was changed" if the stored page is not one it knows, or if it has already been run. Undo: `12-11-26 - donation page e-Transfer line with receipt note, undo (only if needed).sql`, which takes the whole line off (back to `62081e25`).

Every file the Hub serves matched its `site_files` row byte for byte when checked (12/11/26, about 01:05 Toronto), so host-sync publishes nothing else.

## Checks

- `test/w161page.js`: 50 of 50, six of them for this change (the line before anything is typed, in monthly, in French, after an error, and above the maximum in both languages with nothing sent). `test/w161embed.js`: 17 of 17.
- The built page in Chromium with the real fonts, at computer, phone and pop-up widths, in both languages, before typing and with 524552 typed: the line shows under the amount box, nothing scrolls sideways, no page errors, nothing is sent.
- Both SQL files run on a scratch Postgres 16 loaded with the live page: the release gives the built page byte for byte, logs one row, calls host-sync once and leaves `index.html` alone; a second run, an undo before a release, and an unknown stored page all refuse; the undo restores `62081e25`; from either earlier version the release still ends on `c04f7e4e`.
- Not checked: the live page, since it is not released.

## What it means for gifts

- An e-Transfer arrives outside the form, so someone records each one by hand in the CRM (Gifts, Record a gift, e-transfer). The line asks for the mailing address a receipt needs; a donor who leaves it out has to be asked.
- It comes with no campaign (a Holiday Gift Basket Drive gift joins the drive's total only once someone records it in the CRM with the campaign) and no news consent.
- Meta's Donate event fires only for gifts completed on the form, so e-Transfer gifts do not show as conversions for the One Bag ads.
- The line also shows on Give monthly; an e-Transfer does not repeat by itself.
- Banks cap what a donor can send by Interac e-Transfer, usually well under $10,000 from a personal account (Desjardins: $5,000 per transfer and per 24 hours, with no increase possible; BMO's posted maximum: $3,000 a day). A business account can send up to $25,000 a transfer, depending on the bank. Sources, read 12/11/26: desjardins.com/en/accounts-services/interac-e-transfer.html, bmo.com (Interac e-Transfer daily sending limit), interac.ca (Interac e-Transfer for Business).

## Repo

- Branch `claude/give-etransfer-line`: `build/give/src.html`, `build/give/index.html`, `test/w161page.js` and this note. Three commits: the two earlier versions (`c915a34`, `1dfcb39`), then this one.
- `build/give/src.html` on main was one version behind the live page: it built v5 (`ea758ea7`), while the committed and live `index.html` was v6 (`62081e25`, the `?a=` amount of 17/10/26). The branch first brings `src.html` up to v6 (it then rebuilds `62081e25` exactly), then adds v7. Rebuilding the page from main's `src.html` would drop `?a=`.
