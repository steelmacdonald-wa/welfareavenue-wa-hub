# 02/10/26 - wave194: Updated since you finished (open it, then close it) and the certificate, signed

Live md5 `e07376daff6c15e2c91069f1136cd670` (5,748,181 bytes), deployed through the gated pipeline on top of `aaa7bd8e` (wave193, which carries waves 191 and 192) at 20:00 UTC (16:00 in Toronto); host-sync published it to Netlify. Migration `wa194_updates_certificate`. No edge function changed.

## What Steel asked

Steel (02/10/26): "when new onboarding changes are made, I understand that everyone get a section called "Update since you finished" and the option to write got it. Instead I'd like for them to haft to open the link of the module to re do it and then they can close it." Then: "the certificate members get should be better branded with our branding and I'll add my signature", and he sent the signature.

His choices (02/10/26):

- **What unlocks Close:** opening the module. The opening is saved, so Close is still there on another device.
- **A step with no module** (26 of the 45 steps): it opens in the person's plan with its new instructions, the same way.
- **Under the signature:** Steel MacDonald, Founder and Chair.

## What changed for people

- **Updated since you finished** (the onboarding card in the Avenue Academy, and the Classic view): each changed step says where it opens, Open the module, Open the avenue or Open the step, with its week and what it is. There is no Got it.
- **Opening** goes to the module, the avenue or the plan, and the page that opens carries a gold bar: Updated since you finished, the week, the step, what changed, and Close the update. A step with no module opens the plan at that step: its week is chosen, the step is shown and marked, and the bar holds the step's words as they are now (folded when the step is in the plan, open when it is not).
- **Back on the card**, an opened step shows Open it again and Close. Close (or Close the update on the bar) records it, and the step leaves the card.
- **A step opened on another device** shows Close at once. A step opened before HR changed it again must be opened again.
- **The certificate** is in the brand: the green band with the cream lockup, AVENUE ACADEMY in gold, the gold seal with the E and one gold star; Certificate of completion with the gold rule; the name in Barlow Condensed capitals; what was completed in purple; Steel's signature over the line with STEEL MACDONALD and Founder and Chair, Welfare Avenue; the date awarded and the certificate number. On a phone it stacks (the band on top). Printing gives one A4 landscape page, edge to edge, with the brand fonts and colours. Every certificate already earned shows the new design and the signature.
- **Admins** get Signature on a certificate: the picture, the name and the title. A photo or scan of a signature on white paper is cleaned in the browser (the white goes clear, the ink is set to the brand's near black, the picture is trimmed). Save changes every certificate at once.

## In the database

- `onboarding_update_opens` (new): who opened which changed step, for which version (`template_updated_at`); one row per person per version (unique). Staff read and write, like `onboarding_update_acks`; signed-out visitors cannot read it.
- `onboarding_update_acks`: unchanged; since wave194 the Hub writes it from Close, which shows only after the step was opened.
- `app_config` `cert_signature`: the signature (a PNG data URL), the name, the title and the organization, as JSON. Signed-in staff and board viewers read it (app_config's policies); only admins write it: `wa_app_config_guard` now covers `cert_*` (checked as a member: refused; as an admin: saved; rolled back). Set by the assistant from the signature Steel sent (audit line in change_log). The picture is not in the repo.

## Verification

- `test/w194drive.js` 41 of 41: the card (3 changed steps, the acknowledged one left out, no Got it, the words), Open the module (the opening saved for the version, the module with the bar), Open it again and Close on the card, Close (the acknowledgement for the version, the step leaves), Open the step (the plan, the step's week, the mark, the bar with the words), Close the update from the bar, Open the avenue, a saved opening from another device and one for an older version, the Classic view, the certificate (band, lockup, seal, star, A4 proportions, the words, the signature, the date and number), the admin's Signature editor (a white-paper signature cleaned and trimmed, Save writes `cert_signature`, the certificate updates), print (A4 landscape, the fonts link, exact colours), a member (no Signature), a phone (stacked, readable, no sideways scroll), no page errors.
- Print rendered to PDF: one A4 landscape page with Barlow Condensed and Space Grotesk loaded.
- The same results on the live build and the new one: `test/w190drive.js` 25 of 25, `test/w134drive.js` 34 of 34, `test/w192drive.js` 79 of 79, `test/w122drive.js` (stops at the same step on both, as before), every page tour (41, identical; the Academy's 10 of 10). `test/w166drive.js` and `test/w167drive.js` need fixtures from an older session.
- The security advisor: nothing on this wave's table or the guard. Two errors from other sessions remain: the view `volunteer_people` (security definer) and the wave193 session's `wa_stage_push193_rids` (no row security).

## For Steel

- Look at a certificate in the Avenue Academy (Trophy case, or the onboarding card's Certificate) and print one; Signature on it changes the picture or the title.
- Two changed steps are waiting on your own card (both changed at 03:54 UTC on 02/10/26): Week 3's lesson, Start here: Working with your team (Open the module), and Mandatory volunteering (Open the step).

## Files

- `build/src/194_wave194.seg` (new; after 193 in the manifest), `122_wave122.seg` (pendingHtml, renderSheet, certHtml, renderCert and printCert call wave194), `058_wave58.seg` (the Classic view's buttons).
- `build/data/wa194_updates_certificate.sql` (the migration), `wa194_release.sql` (what ran, the signature left out).
- `test/w194drive.js`.
