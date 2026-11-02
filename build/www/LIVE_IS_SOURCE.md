# welfareavenue.com: the live files are the source (since 09/10/26)

Since the Toronto page (09/10/26), several website changes were made on the built files the site serves (Supabase table
`www_files`, deployed by the `www-sync` function), not in `make.py` / `content.py`:

- the Toronto page (`toronto/`, `fr/toronto/`, `assets/toronto.css`), Toronto in the menu and footer of every page, the
  volunteer pages' Toronto band, the About page's Toronto partners (Daily Bread and Aangen removed), Tate's story paragraph;
- `_headers` (Keela's forms allowed in `frame-src`);
- 12/10/26 (wave232): the footer's small legal line (Privacy, Terms, Data deletion), the Terms and Data deletion pages, the French
  logo (Avenue du Bien-Être) on the French pages, and the team section's photos.

`build/www/live/` is a copy of every text file the site serves, taken 12/10/26. Until those changes are ported into
`make.py`, **do not deploy a `make.py` build**: it would erase them. Edit the live files instead (pull them from `www_files`,
patch, md5-guarded swap, `www-sync`), keep the patch script under `build/www/patches/`, and refresh `build/www/live/`.

15/10/26: the Holiday Gift Basket Drive page (`gift-basket-drive/`, `fr/paniers-cadeaux/`, `assets/drive.css`, `assets/drive.js`, the
events cards' links and the sitemap) was made the same way: `build/www/patches/gbd_gift_basket_drive.py` writes it from the live
Donate pages' header and footer; its outputs are in `build/www/live/`.

16/10/26 (wave261): the drive page's pop-up forms and gift counter are a patch on the live files, `build/www/patches/261_drive_popups.py`
(idempotent): the two drive pages, `assets/forms.js` (data-wa-popup-id, data-wa-popup-bare; CSS_V stamped), `assets/forms.css`,
`assets/drive.js` (gifts_in), `assets/drive.css`. The deploy is `build/data/wa261_www_deploy.sql` (md5-guarded www_files swap, then
www-sync). `gbd_gift_basket_drive.py` no longer regenerates these pages as they are (the live Donate page it copies the header from has
moved on): treat the live files as the source. The other page copies in `build/www/live/` were refreshed from welfareavenue.com the same
day (about, donate, press, privacy, terms, toronto, data deletion and their French pages, site.css, site.js had drifted).
