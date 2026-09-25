/* =====================================================================
   WA v118c Photo library (25/09/26)
   =====================================================================
   Steel: "Okay I want to label all of these photos and host them in the
   Supabase storage. Can you set it up for successful use."
   - Storage and labels: every photo is three JPEGs in the public
     content-images bucket, photos/full (2400 px), photos/web (1600 px)
     and photos/thumb (640 px), sRGB, no location or camera data, cached
     a week (?v=<version> busts the cache). One row per photo in
     public.wa_photos: title, alt text, caption, description, date,
     season, place, event, scene, tags, what it is cleared for and why,
     people by role, partners, branding era, focal point, colour, best
     uses, sizes, credit and source. The view wa_photos_list adds the
     public URLs. Staff read and write, board viewers read, admins delete.
   - The page (#photos, under More): search, usage chips (Ready, Crop
     first, Consent needed), seasons, scenes, sets and picks; a grid
     cropped on each photo's focal point, grouped by year; a side panel
     with the photo, what it is cleared for, the alt text and caption to
     copy, three download sizes and the details. Deep links:
     #photos/<key>, #photos/new (add photos), #photos/review.
   - Staff edit the labels (focal point with crop previews included),
     add photos (the browser makes the three sizes, reads the date from
     the file, uploads with the person's session, and asks the llm route
     photo_label for first labels that a person confirms), and archive.
     Admins can delete an archived photo for good.
   - Hand-offs: Use in the Create studio (the photo sits behind a social
     graphic) and Use in a post (the content calendar composer opens with
     the photo attached); both screens get a "Pick from the photo library"
     link. Photos show in Search everything, and the Marketing and
     Fundraising team pages list the library in their tools.
   window.__wa118c: pick(opts), url(p, size), rows(), clean(el),
   cleanNode(el) (the harness strips every [data-w118c] node).
   ===================================================================== */
(function () {
  if (window.__wa118c) return;
  var W = window.__wa118c = { version: 1 };
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BUCKET = 'content-images';
  var BASE = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
  var SIZES = [['full', 2400, 0.85, 'Full size', 'Print, big screens and anything cropped hard'], ['web', 1600, 0.8, 'Web', 'Posts, the website, decks and reports'], ['thumb', 640, 0.76, 'Thumbnail', 'Emails, documents and previews']];
  var USAGE = {
    ready: { label: 'Ready', long: 'Ready for public use', tip: 'Fine for posts, the website, decks and reports.' },
    crop: { label: 'Crop first', long: 'Crop before public use', tip: 'Crop the edge named in the note before it goes public.' },
    consent: { label: 'Consent needed', long: 'Internal, or public with consent', tip: 'Someone we serve or a child is recognizable: use it inside the team, or publicly only with their consent.' },
    internal: { label: 'Internal only', long: 'Internal use only', tip: 'Keep it inside the team.' },
    check: { label: 'Not checked', long: 'Not checked yet', tip: 'Nobody has looked at who is in it yet.' }
  };
  var USAGE_ORDER = ['ready', 'crop', 'consent', 'internal', 'check'];
  var SEASONS = [['winter', 'Winter'], ['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn']];
  var SCENES = [['serving', 'Serving'], ['volunteers', 'Volunteers'], ['food', 'Food'], ['media', 'Media'], ['portrait', 'Portraits'], ['setup', 'Setup'], ['other', 'Other']];
  var BEST = [['report', 'Reports'], ['deck', 'Decks'], ['hero', 'Web banner'], ['card', 'Cards'], ['social_square', 'Social, square'], ['social_portrait', 'Social, portrait'], ['story', 'Stories'], ['email_header', 'Email header']];
  var BRANDING = [['legacy', 'Older branding'], ['current', 'Current branding'], ['none', 'No branding in view']];
  var CROPS = [['Square', 1], ['Portrait 4:5', 0.8], ['Wide 16:9', 16 / 9], ['Banner 1.91:1', 1.91]];
  /* the photo_label route: what the model is told, and the form it fills (tested 25/09/26 on Sonnet 5) */
  var SPEC = @@SPEC@@;
  var P = { rows: [], loaded: false, loading: null, err: null, at: 0, f: blankF(), sort: 'taken', limit: 120, open: null, mode: null, edit: null, up: null, pick: null, busy: false, ai: 0 };
  function blankF() { return { q: '', usage: '', season: '', scene: '', picks: false, status: '', series: '', tag: '' }; }

  var ICONS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.5-1.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    pen: '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M13 7l3 3"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
    restore: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    brush: '<path d="M14.5 4.5l5 5-8 8-5-5z"/><path d="M6.5 12.5L4 20l7.5-2.5"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'
  };
  function ic(name, cls) { return '<svg class="w118ci' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }

  /* ---------- styles ---------- */
  var css = document.createElement('style'); css.id = 'wa118ccss';
  css.textContent = '' +
    '#toast.toast{z-index:140;}' +
    '.w118ci{display:inline-block;width:1em;height:1em;vertical-align:-.15em;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none;}' +
    '#photos{font-family:' + BODY + ';}' +
    '#photos .w116ptop{position:relative;padding-right:220px;}' +
    '#photos .w116ptop .w43help{position:absolute;right:0;top:4px;float:none;margin:0;}' +
    '#photos .pbar{background:#FFFAF2;border:1px solid rgba(16,63,57,.10);border-radius:18px;padding:12px 14px;margin:0 0 6px;box-shadow:0 10px 24px -22px rgba(16,63,57,.6);}' +
    '#photos .pr1{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
    '#photos .srch{position:relative;flex:1 1 260px;max-width:460px;}' +
    '#photos .srch .w118ci{position:absolute;left:13px;top:50%;margin-top:-8px;width:16px;height:16px;color:var(--wa-muted);}' +
    '#photos .srch input{width:100%;box-sizing:border-box;padding:9px 14px 9px 37px;border:1px solid rgba(16,63,57,.2);border-radius:999px;font-size:13px;font-family:' + BODY + ';background:#FFFAF2;color:var(--wa-text);}' +
    '#photos select.sl{width:auto;padding:8px 30px 8px 13px;border:1px solid rgba(16,63,57,.2);border-radius:999px;font-size:12.5px;font-family:' + BODY + ';background-color:#FFFAF2;color:' + GREEN + ';font-weight:600;}' +
    '#photos .sp{flex:1;}' +
    '#photos .add{display:inline-flex;align-items:center;gap:8px;border:none;border-radius:999px;background:' + GOLD + ';color:' + GREEN + ';font-family:' + HEAD + ';font-size:15px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;padding:9px 17px 8px;cursor:pointer;box-shadow:0 8px 18px -12px rgba(16,63,57,.7);}' +
    '#photos .add:hover{filter:brightness(1.04);}' +
    '#photos .add .w118ci{width:16px;height:16px;}' +
    '#photos .chips{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:11px 0 0;}' +
    '#photos .chips span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;border-radius:999px;padding:5px 12px;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;user-select:none;white-space:nowrap;}' +
    '#photos .chips span:hover{background:rgba(16,63,57,.12);}' +
    '#photos .chips span.on{background:' + GREEN + ';color:' + CREAM + ';}' +
    '#photos .chips span.off{opacity:.4;cursor:default;}' +
    '#photos .chips span i{width:8px;height:8px;border-radius:50%;flex:none;}' +
    '#photos .chips span em{font-style:normal;font-weight:600;opacity:.7;}' +
    '#photos .chips span .w118ci{width:13px;height:13px;}' +
    '#photos .chips span.pk.on .w118ci{fill:' + GOLD + ';stroke:' + GOLD + ';}' +
    '#photos .chips b.dv{width:1px;height:18px;background:rgba(16,63,57,.15);margin:0 3px;}' +
    '#photos .chips span.x{background:rgba(220,165,39,.2);color:#6b4d05;}' +
    '#photos .legend{font-size:11.5px;color:var(--wa-muted);margin:10px 0 0;line-height:1.55;}' +
    '#photos .legend b{color:var(--wa-text);font-weight:700;}' +
    '#photos .legend i{display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 5px 1px 0;}' +
    '#photos .sum{font-size:12px;color:var(--wa-muted);margin:12px 2px 0;}' +
    '#photos .grp{display:flex;align-items:baseline;gap:10px;margin:18px 0 10px;}' +
    '#photos .grp h3{font-family:' + HEAD + ';font-weight:500;font-size:24px;letter-spacing:.4px;color:' + GREEN + ';margin:0;}' +
    '#photos .grp span{font-size:12px;color:var(--wa-muted);white-space:nowrap;}' +
    '#photos .grp::after{content:"";flex:1;height:1px;background:rgba(16,63,57,.12);}' +
    '#photos .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}' +
    '#photos .ph{position:relative;display:flex;flex-direction:column;text-align:left;border:1px solid rgba(16,63,57,.10);border-radius:18px;background:#FFFAF2;padding:0;margin:0;overflow:hidden;cursor:pointer;box-shadow:0 10px 24px -22px rgba(16,63,57,.6);transition:transform .14s ease,box-shadow .14s ease;font-family:' + BODY + ';color:var(--wa-text);width:100%;}' +
    '#photos .ph:hover{transform:translateY(-2px);box-shadow:0 18px 32px -20px rgba(16,63,57,.55);}' +
    '#photos .ph:focus-visible{outline:3px solid ' + GOLD + ';outline-offset:2px;}' +
    '#photos .ph .im{position:relative;display:block;aspect-ratio:4/3;overflow:hidden;}' +
    '#photos .ph .im img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease;color:transparent;}' +
    '#photos .ph:hover .im img{transform:scale(1.035);}' +
    '#photos .ph .tx{display:block;padding:10px 12px 12px;}' +
    '#photos .ph .tx b{display:block;font-size:13.5px;line-height:1.3;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#photos .ph .tx em{display:block;font-style:normal;font-size:11.5px;color:var(--wa-muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#photos .ph.arch .im img{filter:grayscale(.7);opacity:.75;}' +
    '#photos .more{display:block;margin:16px auto 0;border:1px solid rgba(16,63,57,.2);background:#FFFAF2;color:' + GREEN + ';border-radius:999px;padding:8px 18px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:' + BODY + ';}' +
    '#photos .foot{font-size:11.5px;color:var(--wa-muted);margin:22px 2px 4px;line-height:1.5;}' +
    '#photos .foot code{font-size:11px;background:rgba(16,63,57,.06);border-radius:5px;padding:1px 5px;}' +
    '.w118cub{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;letter-spacing:.3px;border-radius:999px;padding:3px 9px 3px 7px;background:rgba(255,250,242,.95);color:' + GREEN + ';box-shadow:0 2px 8px -3px rgba(0,0,0,.35);font-family:' + BODY + ';line-height:1.3;}' +
    '.w118cub i,.w118cdot{display:inline-block;width:7px;height:7px;border-radius:50%;background:' + TEAL + ';flex:none;}' +
    '.w118cub.u-crop i,.w118cdot.u-crop{background:' + GOLD + ';}.w118cub.u-consent i,.w118cdot.u-consent{background:' + FLAG + ';}.w118cub.u-internal i,.w118cdot.u-internal{background:#797773;}.w118cub.u-check i,.w118cdot.u-check,.w118cub.u-needs i,.w118cdot.u-needs{background:' + PURPLE + ';}.w118cub.u-arch i{background:#797773;}' +
    '.w118cstar{position:absolute;right:8px;top:8px;width:26px;height:26px;border-radius:50%;background:rgba(255,250,242,.95);color:' + GOLD + ';display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px -3px rgba(0,0,0,.35);}' +
    '.w118cstar .w118ci{width:15px;height:15px;fill:' + GOLD + ';}' +
    /* the side panel */
    '#w118cdr{position:fixed;inset:0;z-index:96;display:flex;justify-content:flex-end;font-family:' + BODY + ';}' +
    '#w118cdr .bk{position:absolute;inset:0;background:rgba(16,32,30,.42);animation:w118cfade .18s ease-out;}' +
    '#w118cdr .pn{position:relative;width:min(760px,100vw);height:100%;background:' + CREAM + ';box-shadow:-20px 0 50px -20px rgba(0,0,0,.35);display:flex;flex-direction:column;animation:w118cin .2s ease-out;}' +
    '@keyframes w118cin{from{transform:translateX(28px);opacity:.6;}to{transform:none;opacity:1;}}' +
    '@keyframes w118cfade{from{opacity:0;}to{opacity:1;}}' +
    '#w118cdr header{display:flex;align-items:center;gap:8px;padding:14px 18px 12px 20px;border-bottom:1px solid rgba(16,63,57,.10);}' +
    '#w118cdr header h3{flex:1;min-width:0;margin:0;font-family:' + HEAD + ';font-weight:500;font-size:25px;letter-spacing:.3px;color:' + GREEN + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#w118cdr header .ct{font-size:12px;color:var(--wa-muted);white-space:nowrap;margin-right:4px;}' +
    '#w118cdr .ib{width:34px;height:34px;border-radius:50%;border:none;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0;}' +
    '#w118cdr .ib:hover{background:rgba(16,63,57,.13);}' +
    '#w118cdr .ib:disabled{opacity:.3;cursor:default;}' +
    '#w118cdr .ib .w118ci{width:17px;height:17px;}' +
    '#w118cdr .bd{flex:1;overflow:auto;padding:16px 20px 26px;}' +
    '#w118cdr .hero{position:relative;margin:0 0 14px;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:120px;}' +
    '#w118cdr .hero img{display:block;max-width:100%;max-height:56vh;object-fit:contain;}' +
    '#w118cdr .hero .fw{position:relative;display:inline-block;line-height:0;}' +
    '#w118cdr .hero.pickable .fw{cursor:crosshair;}' +
    '#w118cdr .fm{position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:3px solid ' + GOLD + ';box-shadow:0 0 0 2px rgba(16,32,30,.55),inset 0 0 0 2px rgba(16,32,30,.35);pointer-events:none;}' +
    '#w118cdr .fm::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:' + GOLD + ';}' +
    '#w118cdr .use{border-radius:14px;padding:11px 14px;margin:0 0 14px;font-size:13px;line-height:1.5;background:rgba(42,140,122,.12);color:#155a4d;}' +
    '#w118cdr .use.u-crop{background:rgba(220,165,39,.16);color:#5a430c;}#w118cdr .use.u-consent{background:rgba(179,64,47,.10);color:#8f2f22;}#w118cdr .use.u-internal{background:rgba(16,63,57,.07);color:' + GREEN + ';}#w118cdr .use.u-check,#w118cdr .use.u-needs{background:rgba(111,100,171,.12);color:#4f4690;}#w118cdr .use.u-arch{background:rgba(16,63,57,.07);color:var(--wa-muted);}' +
    '#w118cdr .use b{display:block;font-size:13.5px;margin-bottom:1px;}' +
    '#w118cdr .use p{margin:4px 0 0;}' +
    '#w118cdr .acts{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px;}' +
    '#w118cdr .acts button,#w118cdr .acts a,#w118cdr .dl a{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(16,63,57,.18);background:#FFFAF2;color:' + GREEN + ';border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:700;cursor:pointer;text-decoration:none;font-family:' + BODY + ';line-height:1.2;}' +
    '#w118cdr .acts button:hover,#w118cdr .acts a:hover,#w118cdr .dl a:hover{background:rgba(16,63,57,.07);}' +
    '#w118cdr .acts .pri{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}' +
    '#w118cdr .acts .pri:hover{background:#0b302b;}' +
    '#w118cdr .acts .w118ci,#w118cdr .dl .w118ci{width:15px;height:15px;}' +
    '#w118cdr .sec{margin:0 0 18px;}' +
    '#w118cdr .lbl{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--wa-muted);font-weight:800;margin:0 0 7px;}' +
    '#w118cdr .lbl small{text-transform:none;letter-spacing:0;font-weight:600;font-size:11.5px;}' +
    '#w118cdr .copy{display:flex;gap:10px;align-items:flex-start;background:#FFFAF2;border:1px solid rgba(16,63,57,.12);border-radius:12px;padding:10px 12px;}' +
    '#w118cdr .copy p{flex:1;margin:0;font-size:13.5px;line-height:1.5;color:var(--wa-text);}' +
    '#w118cdr .copy p.none{color:var(--wa-muted);font-style:italic;}' +
    '#w118cdr .copy button{flex:none;display:inline-flex;align-items:center;gap:5px;border:none;background:rgba(16,63,57,.07);color:' + GREEN + ';border-radius:999px;padding:5px 11px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:' + BODY + ';}' +
    '#w118cdr .copy button.done{background:' + TEAL + ';color:' + CREAM + ';}' +
    '#w118cdr .copy button .w118ci{width:13px;height:13px;}' +
    '#w118cdr .desc{font-size:13.5px;line-height:1.6;color:var(--wa-text);margin:0;}' +
    '#w118cdr .dl{display:flex;gap:8px;flex-wrap:wrap;}' +
    '#w118cdr .dl a span{font-weight:600;color:var(--wa-muted);}' +
    '#w118cdr .dlh{font-size:11.5px;color:var(--wa-muted);margin:7px 0 0;}' +
    '#w118cdr dl.facts{display:grid;grid-template-columns:132px minmax(0,1fr);gap:7px 14px;font-size:13px;margin:0;}' +
    '#w118cdr dl.facts dt{color:var(--wa-muted);font-weight:700;font-size:12px;padding-top:1px;}' +
    '#w118cdr dl.facts dd{margin:0;color:var(--wa-text);line-height:1.45;overflow-wrap:anywhere;}' +
    '#w118cdr dl.facts dd small{display:block;color:var(--wa-muted);font-size:11.5px;}' +
    '#w118cdr dl.facts dd a{color:' + GREEN + ';font-weight:700;cursor:pointer;text-decoration:underline;}' +
    '#w118cdr dl.facts code{font-size:11.5px;background:rgba(16,63,57,.06);border-radius:5px;padding:1px 5px;}' +
    '#w118cdr .tags{display:flex;gap:6px;flex-wrap:wrap;}' +
    '#w118cdr .tags span{font-size:12px;font-weight:700;border-radius:999px;padding:4px 11px;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;}' +
    '#w118cdr .tags span:hover{background:rgba(16,63,57,.14);}' +
    '#w118cdr .tags span.bf{background:rgba(220,165,39,.18);color:#6b4d05;cursor:default;}' +
    '#w118cdr footer{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 20px 16px;border-top:1px solid rgba(16,63,57,.10);background:#FFFAF2;}' +
    '#w118cdr footer .sp{flex:1;}' +
    '#w118cdr footer .b{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(16,63,57,.2);background:#FFFAF2;color:' + GREEN + ';border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;font-family:' + BODY + ';}' +
    '#w118cdr footer .b:disabled{opacity:.5;cursor:default;}' +
    '#w118cdr footer .b .w118ci{width:15px;height:15px;}' +
    '#w118cdr footer .b.go{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}' +
    '#w118cdr footer .b.ai{border-color:rgba(111,100,171,.35);background:rgba(111,100,171,.08);color:' + PURPLE + ';}' +
    '#w118cdr footer .lnk{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--wa-muted);cursor:pointer;text-decoration:underline;background:none;border:none;padding:4px;font-family:' + BODY + ';}' +
    '#w118cdr footer .lnk.del{color:' + FLAG + ';}' +
    '#w118cdr footer .lnk .w118ci{width:14px;height:14px;}' +
    '#w118cdr .note{font-size:12px;color:var(--wa-muted);line-height:1.5;margin:6px 0 0;}' +
    /* the label form */
    '#w118cdr .fs{margin:0 0 20px;padding:0 0 4px;}' +
    '#w118cdr .fs h4{font-family:' + HEAD + ';font-weight:500;font-size:19px;letter-spacing:.4px;color:' + GREEN + ';margin:0 0 10px;text-transform:uppercase;}' +
    '#w118cdr .fg{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;}' +
    '#w118cdr .fg .full{grid-column:1 / -1;}' +
    '#w118cdr .fg label.fl{display:block;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--wa-muted);font-weight:800;margin:0 0 5px;}' +
    '#w118cdr .fg input[type=text],#w118cdr .fg input[type=date],#w118cdr .fg select,#w118cdr .fg textarea{width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid rgba(16,63,57,.2);border-radius:12px;font-size:13.5px;font-family:' + BODY + ';background-color:#FFFAF2;color:var(--wa-text);}' +
    '#w118cdr .fg textarea{min-height:64px;line-height:1.5;resize:vertical;}' +
    '#w118cdr .fg .hint{font-size:11.5px;color:var(--wa-muted);margin:4px 0 0;line-height:1.4;}' +
    '#w118cdr .fg .cnt{float:right;font-size:11px;color:var(--wa-muted);font-weight:600;text-transform:none;letter-spacing:0;}' +
    '#w118cdr .fg .cnt.bad{color:' + FLAG + ';}' +
    '#w118cdr .aih{display:flex;gap:8px;align-items:flex-start;margin:6px 0 0;font-size:12px;line-height:1.45;background:rgba(111,100,171,.08);border:1px dashed rgba(111,100,171,.4);border-radius:10px;padding:6px 10px;color:#4f4690;}' +
    '#w118cdr .aih span{flex:1;}' +
    '#w118cdr .aih a{font-weight:800;cursor:pointer;text-decoration:underline;white-space:nowrap;}' +
    '#w118cdr .aiflag{border-color:rgba(111,100,171,.55) !important;box-shadow:0 0 0 3px rgba(111,100,171,.12);}' +
    '#w118cdr .opts{display:flex;gap:6px;flex-wrap:wrap;}' +
    '#w118cdr .opts span{font-size:12px;font-weight:700;border-radius:999px;padding:5px 11px;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;user-select:none;}' +
    '#w118cdr .opts span.on{background:' + GREEN + ';color:' + CREAM + ';}' +
    '#w118cdr .ck{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--wa-text);cursor:pointer;}' +
    '#w118cdr .ck input{width:16px;height:16px;accent-color:' + GREEN + ';}' +
    '#w118cdr .crops{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin:10px 0 0;}' +
    '#w118cdr .crops div{text-align:center;font-size:11px;color:var(--wa-muted);font-weight:600;}' +
    '#w118cdr .crops .cv{overflow:hidden;border-radius:10px;margin:0 0 4px;box-shadow:0 0 0 1px rgba(16,63,57,.12);}' +
    '#w118cdr .crops .cv img{width:100%;height:100%;object-fit:cover;display:block;}' +
    '#w118cdr .busy{display:flex;gap:10px;align-items:center;font-size:12.5px;color:' + PURPLE + ';font-weight:700;background:rgba(111,100,171,.08);border-radius:12px;padding:9px 12px;margin:0 0 14px;}' +
    '#w118cdr .busy i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(111,100,171,.3);border-top-color:' + PURPLE + ';animation:w118cspin .8s linear infinite;flex:none;}' +
    '@keyframes w118cspin{to{transform:rotate(360deg);}}' +
    /* adding photos */
    '#w118cdr .drop{border:1.5px dashed rgba(16,63,57,.28);border-radius:16px;padding:26px 16px;text-align:center;font-size:13px;color:var(--wa-muted);background:#FFFAF2;transition:background .12s,border-color .12s;line-height:1.5;}' +
    '#w118cdr .drop.over{background:rgba(220,165,39,.12);border-color:' + GOLD + ';}' +
    '#w118cdr .drop b{display:block;font-family:' + HEAD + ';font-size:21px;color:' + GREEN + ';font-weight:500;letter-spacing:.4px;margin:6px 0 4px;text-transform:uppercase;}' +
    '#w118cdr .drop a{color:' + GREEN + ';font-weight:700;text-decoration:underline;cursor:pointer;}' +
    '#w118cdr .drop .w118ci{width:30px;height:30px;color:' + GOLD + ';}' +
    '#w118cdr .ups{margin:14px 0 0;}' +
    '#w118cdr .it{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(16,63,57,.08);}' +
    '#w118cdr .it img,#w118cdr .it .ph0{width:56px;height:56px;object-fit:cover;border-radius:10px;background:rgba(16,63,57,.08);display:block;}' +
    '#w118cdr .it b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#w118cdr .it em{display:block;font-style:normal;font-size:11.5px;color:var(--wa-muted);margin-top:2px;}' +
    '#w118cdr .it.err em{color:' + FLAG + ';}' +
    '#w118cdr .it.ok em{color:#1c6b5d;}' +
    '#w118cdr .it .bar{height:4px;background:rgba(16,63,57,.08);border-radius:3px;overflow:hidden;margin-top:6px;}' +
    '#w118cdr .it .bar i{display:block;height:100%;background:' + TEAL + ';transition:width .3s;}' +
    '#w118cdr .it a{font-size:12px;font-weight:700;color:' + GREEN + ';cursor:pointer;text-decoration:underline;white-space:nowrap;}' +
    /* the picker */
    '#w118cpk{position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;font-family:' + BODY + ';}' +
    '#w118cpk .bk{position:absolute;inset:0;background:rgba(16,32,30,.5);animation:w118cfade .15s ease-out;}' +
    '#w118cpk .box{position:relative;width:min(940px,94vw);max-height:88vh;background:' + CREAM + ';border-radius:22px;display:flex;flex-direction:column;box-shadow:0 30px 80px -30px rgba(0,0,0,.5);overflow:hidden;}' +
    '#w118cpk header{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:16px 18px 12px 20px;border-bottom:1px solid rgba(16,63,57,.10);}' +
    '#w118cpk header h3{margin:0;font-family:' + HEAD + ';font-weight:500;font-size:24px;letter-spacing:.3px;color:' + GREEN + ';text-transform:uppercase;flex:1 1 auto;}' +
    '#w118cpk header input{flex:1 1 200px;max-width:320px;box-sizing:border-box;padding:8px 14px;border:1px solid rgba(16,63,57,.2);border-radius:999px;font-size:13px;font-family:' + BODY + ';background:#FFFAF2;}' +
    '#w118cpk .tg{font-size:12px;font-weight:700;border-radius:999px;padding:6px 12px;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;user-select:none;white-space:nowrap;}' +
    '#w118cpk .tg.on{background:' + GREEN + ';color:' + CREAM + ';}' +
    '#w118cpk .x{width:34px;height:34px;border-radius:50%;border:none;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;}' +
    '#w118cpk .x .w118ci{width:17px;height:17px;}' +
    '#w118cpk .pg{flex:1;overflow:auto;padding:14px 18px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;align-content:start;grid-auto-rows:max-content;}' +
    '#w118cpk .pi{position:relative;border:1px solid rgba(16,63,57,.12);border-radius:14px;background:#FFFAF2;padding:0;overflow:hidden;cursor:pointer;text-align:left;font-family:' + BODY + ';}' +
    '#w118cpk .pi:hover{box-shadow:0 0 0 3px ' + GOLD + ';}' +
    '#w118cpk .pi .im{display:block;aspect-ratio:1/1;overflow:hidden;}' +
    '#w118cpk .pi img{width:100%;height:100%;object-fit:cover;display:block;color:transparent;}' +
    '#w118cpk .pi b{display:block;font-size:12px;line-height:1.3;padding:7px 9px 9px;color:var(--wa-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#w118cpk .pi .w118cub{font-size:9.5px;left:6px;top:6px;}' +
    '#w118cpk .ft{padding:10px 20px 14px;border-top:1px solid rgba(16,63,57,.10);font-size:12px;color:var(--wa-muted);}' +
    '#w118cpk .none{grid-column:1 / -1;text-align:center;color:var(--wa-muted);font-size:13px;padding:30px 0;}' +
    /* hand-offs */
    '.w118ccd{margin:7px 0 0;font-size:12px;color:var(--wa-muted);line-height:1.45;}' +
    '.w118ccd a{color:' + GREEN + ';font-weight:700;cursor:pointer;text-decoration:underline;}' +
    '.w118ccd .sel{display:flex;gap:9px;align-items:center;margin:7px 0 0;padding:6px;border:1px solid rgba(16,63,57,.14);border-radius:12px;background:#FFFAF2;}' +
    '.w118ccd .sel img{width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none;}' +
    '.w118ccd .sel span{flex:1;min-width:0;font-size:12px;color:var(--wa-text);}' +
    '.w118ccd .sel span small{display:block;color:var(--wa-muted);}' +
    '.w118ccd .sel button{border:none;background:none;color:var(--wa-muted);cursor:pointer;font-size:12px;text-decoration:underline;font-family:' + BODY + ';}' +
    '#w121dr .drop a[data-w118cpick]{white-space:nowrap;}' +
    '.sr .sr-type.w118cst{background:rgba(220,165,39,.2);color:#6b4d05;}' +
    '.sr[data-w118cs] img{width:26px;height:26px;border-radius:6px;object-fit:cover;vertical-align:middle;margin-right:8px;}' +
    '@media (max-width:900px){#photos .w116ptop{padding-right:0;}#photos .w116ptop .w43help{position:static;display:inline-block;margin-top:10px;}}' +
    '@media (max-width:640px){#photos .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}#photos .ph{border-radius:14px;}#photos .ph .tx{padding:8px 10px 10px;}#photos .ph .tx b{font-size:12.5px;}#photos .chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;}#photos .chips span{flex:none;}#photos .srch{flex-basis:100%;max-width:none;}#photos .add{padding:8px 14px 7px;}#w118cdr .pn{width:100vw;}#w118cdr .fg{grid-template-columns:1fr;}#w118cdr dl.facts{grid-template-columns:1fr;gap:2px;}#w118cdr dl.facts dt{margin-top:8px;}#w118cdr .bd{padding:14px 16px 22px;}#w118cdr footer{padding:10px 16px 14px;}#w118cpk .box{width:100vw;max-height:100vh;height:100%;border-radius:0;}#w118cpk .pg{grid-template-columns:repeat(2,minmax(0,1fr));}}' +
    '@media (prefers-reduced-motion:reduce){#photos .ph,#photos .ph .im img,#w118cdr .pn,#w118cdr .bk,#w118cpk .bk{transition:none !important;animation:none !important;}}';
  document.head.appendChild(css);
