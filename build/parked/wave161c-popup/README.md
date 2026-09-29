# Parked: the donation popup (wave161c, 28/09/26), not deployed

Built and tested offline on 28/09/26 evening, then parked when Steel chose to build the new website first ("leave the donation form as is, let's build the actual website first with the new branding"). Nothing here is live: the donation page, its headers and host-sync are exactly as released in wave161b.

What it does: `embed.js`, served from `https://hub.welfareavenue.com/give/embed.js`, opens the Hub's donation page in a popup over any page that loads it, like Keela's popup: for buttons with `data-wa-donate`, links to `hub.welfareavenue.com/give`, and the old website's Keela donate buttons (`.keela-popup-button` with a `give-can.keela.co` data-src; Keela's handler is set aside for that click and the site's own listeners still hear it). Stripe's embedded form opens inside the popup, so the donor never leaves the site. The page inside takes an embed layout (a photo beside the form, no band, a short footer), tells the popup its height and whether a payment is open (a click outside does not close it then; Escape and the close button do), the thank-you has Close, and Stripe's hosted page (the fallback) opens at the top of the window through a link.

To bring it back (for the new website or as a bridge on the old one):

1. `git apply build/parked/wave161c-popup/wave161c.patch` (the donation page's embed layout, `_headers` letting welfareavenue.com and www frame `/give`, X-Frame-Options DENY kept on the Hub and form pages, host-sync v7 deploying `give/embed.js`).
2. Copy `embed.js` to `build/give/embed.js` and `w161embed.js` to `test/w161embed.js`; `python3 build/give/make.py`; run `test/w161embed.js` (17 checks) and `test/w161page.js`.
3. Deploy host-sync v7 through fn-deploy, then stage `give/index.html`, `give/embed.js` (a new site_files row) and `_headers`, call host-sync, and curl each path's headers.
4. On a website: `<script async src="https://hub.welfareavenue.com/give/embed.js"></script>`; register the website's domains (welfareavenue.com and www) under Stripe's Payment method domains for Apple Pay, Google Pay and Link in the popup.
