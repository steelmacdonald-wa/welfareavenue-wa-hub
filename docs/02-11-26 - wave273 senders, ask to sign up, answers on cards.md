# 02/11/26 - wave273: senders, Ask to sign up, answers on the team cards

Steel, 02/11/26. Three things.

## Who emails come from
`app_config.mail_senders` maps a template to a route, and a route to an address: volunteer@, operations@, job@. mail-send v6 reads it. `send` also takes `route` and `reply_to`. A `reply_to` on our domain is where replies go; otherwise replies go to the address it came from.

- Volunteer emails: from volunteer@. Replies go to the role's owner (`volunteer_role_owners`, Role owners on a serving), or the person who placed them or asked them to sign up.
- HR offers (recruit-actions): from `mail_from_hr`, job@. Replies already go to the signer and the sender.
- operations@ is set as a route, but no automatic email uses it yet: nothing the Hub sends is corporate or partner mail today. A new one passes `route: 'operations'` and the handler as `reply_to`.
- Everything else (receipts, sign-in codes, newsletters, team alerts) stays on info@.

## Ask to sign up
Applicants received, on a card that did not come from the website: Ask to sign up shows the email, then Send the email sends it from volunteer@ with replies to the sender and moves the card to Contacted. `wa273_ask_signup`, same people as `wa256_can_text`.

## Answers on the team cards
`answerRows` in `258v_wave258v.seg`: what each person told us, from `event_roster.confirm`, then the old sheet's `detail`. The cook's page now asks for ingredients and, if we send them, the delivery days (`ingredients`, `delivery_windows`). Both are required on the page for a cook who confirms there; a cook who already confirmed isn't asked again until they open and save.

## How the two large functions are deployed
`SUPABASE_ACCESS_TOKEN` in the vault is invalid, so `fn-deploy` is down, and mail-send and recruit-actions are too large to send through the connector safely. Their deployed `index.ts` is one line that imports the full source from this repo at a pinned commit (`raw.githubusercontent.com/.../<sha>/fn/<name>/index.ts`). The real source is still `fn/<name>/index.ts`. To change one: commit, push, deploy the one line with the new sha.

**recruit-actions and wave271:** this was built on the live copy. wave271's branch has its own changes to it, so carry the `mail_from_hr` line over when wave271 deploys.

## Undo
Senders: `delete from app_config where key in ('mail_senders', 'mail_from_hr');` puts everything back on info@ with no deploy. The other function changes: see `build/data/wa273_senders_signup_answers.sql`, each is an exact replacement.
