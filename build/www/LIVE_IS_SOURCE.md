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
