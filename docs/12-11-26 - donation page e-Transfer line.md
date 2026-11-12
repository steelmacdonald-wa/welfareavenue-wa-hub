# 12/11/26 - The donation page: the over-the-maximum message also offers an Interac e-Transfer (give/index.html v7)

Status: BUILT AND TESTED, NOT LIVE YET. Publishing from the session was refused (a production deploy needs Steel's own go), so Steel runs `12-11-26 - donation page e-Transfer line, release.sql` once in the Supabase SQL editor. The release and undo files are in the Claude project "Welfare Avenue Executive Assistant" (`claude/`).

## What was asked

Steel, 12/11/26, with a screenshot of the message under Other amount ("For a gift above $10,000, please write to info@welfareavenue.com."): "Could we also add and say consider sending an etransfer to info@welfareavenue.com to avoid payment processor fees?"

## What changes

The message a donor sees when the amount is above the maximum (`donate_max`, $10,000), on hub.welfareavenue.com/give and in the Donate pop-up on welfareavenue.com (the same page in a frame):

- English: "For a gift above $10,000, please write to info@welfareavenue.com. You can also send an Interac e-Transfer to info@welfareavenue.com to avoid payment processing fees."
- French: "Pour un don de plus de 10 000 $, veuillez écrire à info@welfareavenue.com. Vous pouvez aussi envoyer un Virement Interac à info@welfareavenue.com pour éviter les frais de traitement des paiements."

The first address still follows the reply-to setting (`mail_reply_to`, info@ today). The e-Transfer address is written out in the page, so changing that setting never changes where e-Transfers are sent. Nothing else on the page changes; donors under the maximum see no difference.

## Release (Steel)

1. Run the whole of `12-11-26 - donation page e-Transfer line, release.sql` once in the Supabase SQL editor. A good run ends with one row whose `give_md5` is `33e54a3d0e8f16fe0803dabfa3287fc4`.
2. One to two minutes later, open hub.welfareavenue.com/give, type an amount above 10,000 in Other amount and press Continue to payment.

The file changes only `site_files` `give/index.html` (`62081e25` to `33e54a3d`, 69,630 to 70,079 bytes), logs one `change_log` row and calls host-sync. It stops with "Nothing was changed" if the stored page is not the one it was built on, or if it has already been run. Undo: `12-11-26 - donation page e-Transfer line, undo (only if needed).sql`, with the same checks in reverse.

Before the release, every file the Hub serves matched its `site_files` row byte for byte (checked 12/11/26, about 00:45 Toronto), so host-sync publishes nothing else.

## Checks

- `test/w161page.js`: 46 of 46, with two new checks (the message in English and in French, nothing sent). `test/w161embed.js`: 17 of 17.
- The built page in Chromium with the real fonts, 524552 typed in Other amount, at computer, phone and pop-up widths, in both languages: the message shows over three to five lines, nothing scrolls sideways, no page errors, nothing is sent.
- Both SQL files run on a scratch Postgres 16 loaded with the live page: the release gives the built page byte for byte, logs one row, calls host-sync once and leaves `index.html` alone; a second run, and an undo before a release, both refuse; the undo restores `62081e25`.
- Not checked: the live page, since it is not released.

## Not changed

- The donate function keeps its own shorter sentence for the same case (`check` in `fn/donate/index.ts`). A donor sees it only if the page's own check is skipped, which takes the maximum changing while their page is open. Bring the two together at the next donate release.

## Repo

- Branch `claude/give-etransfer-line`: `build/give/src.html`, `build/give/index.html`, `test/w161page.js` and this note.
- `build/give/src.html` on main was one version behind the live page: it built v5 (`ea758ea7`), while the committed and live `index.html` was v6 (`62081e25`, the `?a=` amount of 17/10/26). The branch first brings `src.html` up to v6 (it then rebuilds `62081e25` exactly), then adds v7. Rebuilding the page from main's `src.html` would drop `?a=`.

## Good to know

- Banks cap what a donor can send by Interac e-Transfer, usually well under $10,000 from a personal account (Desjardins: $5,000 per transfer and per 24 hours, with no increase possible; BMO's posted maximum: $3,000 a day). A business account can send up to $25,000 a transfer, depending on the bank. A donor above $10,000 may have to split the gift over several days; the first sentence (write to us) covers them. Sources, read 12/11/26: desjardins.com/en/accounts-services/interac-e-transfer.html, bmo.com (Interac e-Transfer daily sending limit), interac.ca (Interac e-Transfer for Business).
- If the aim is to save fees on more gifts, the same suggestion could sit on the form for every donor. Not done: Steel's call.
