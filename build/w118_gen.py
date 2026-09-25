#!/usr/bin/env python3
"""wave118 (25/09/26): brand depth. Generates src/118_wave118.seg and inserts it into the manifest
after 117_wave117 (before 110_wave110).

What the wave does (all additive, all reversible for the harness through window.__wa118.clean):
  1. Page mastheads on the older pages (section overline, Barlow Condensed title with the gold rule,
     one-line purpose, the page's help button moved up). The E that moves on the Executive dashboard.
  2. The Admin page split into five sections (AI models, Workspace accounts, People and access,
     Security and audit trail, Change the Hub): sidebar sub-links, a section switcher, deep links
     #adminpanel/<section>, one card shown at a time.
  3. One icon system: the emoji and dingbat glyphs used as icons in buttons, chips and headings become
     inline SVG line icons in the brand stroke.
  4. Control details: selects with a brand chevron, every text input styled, gold focus rings,
     placeholder, text selection, scrollbars, table row hover, button press, link underline offset.
  5. Empty states: one look, with the asterisk doodle.
  6. The tab favicon and the iOS icon become the WEL/FAR/E mark; theme-color; the tour and Home copy
     say "Ask the Hub" instead of "WA assistant".
Run from build/: python3 w118_gen.py && bash build.sh candidate.html
"""
import base64, io, json, os, re
from PIL import Image, ImageDraw
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, 'data', 'w117_paths.json')))
E_SMALL_D = re.search(r'd="([^"]+)"', open(os.path.join(HERE, 'data', 'e_small.svg')).read()).group(1)
BUCKET = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/'
CREAM, GREEN, GROUND, PURPLE, GOLD = '#FFFAF2', '#103F39', '#1F201E', '#6F64AB', '#DCA527'


# ----------------------------------------------------------------------------- favicon PNGs
def mark_png(size):
    """Green rounded tile with the cream secondary mark, as PNG bytes."""
    vb = P['viewBox_secondary']
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s"><path fill="%s" fill-rule="evenodd" d="%s"/></svg>'
           % (vb[0], vb[1], vb[2], vb[3], CREAM, P['secondary_d']))
    inner = int(size * 0.68)
    png = cairosvg.svg2png(bytestring=svg.encode('utf-8'), output_height=inner)
    mark = Image.open(io.BytesIO(png)).convert('RGBA')
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=GREEN)
    im.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    out = io.BytesIO(); im.save(out, 'PNG', optimize=True)
    return base64.b64encode(out.getvalue()).decode('ascii')

FAV64 = mark_png(64)
FAV180 = mark_png(180)

# ----------------------------------------------------------------------------- icons (24 grid, stroke)
ICONS = {
    'flag': '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'close': '<path d="M6 6l12 12M18 6L6 18"/>',
    'sparkle': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    'mic': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
    'send': '<path d="M4 12h15M13 6l6 6-6 6"/>',
    'folder': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'chart': '<path d="M4 20h16M7 16V9M12 16V5M17 16v-6"/>',
    'clipboard': '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
    'link': '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.5-1.5"/>',
    'people': '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.5A5 5 0 0 1 21 20"/>',
    'target': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/>',
    'doc': '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    'cap': '<path d="M3 9l9-4 9 4-9 4z"/><path d="M7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4M21 9v5"/>',
    'heart': '<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>',
    'pen': '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M13 7l3 3"/>',
    'star': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
    'home': '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    'dots': '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
}
GLYPHS = {  # glyph -> icon name
    '⚑': 'flag', '☰': 'menu', '✕': 'close', '✨': 'sparkle', '\U0001F3A4': 'mic', '➤': 'send',
    '\U0001F4C1': 'folder', '\U0001F4C2': 'folder', '\U0001F4CA': 'chart', '\U0001F4CB': 'clipboard', '\U0001F517': 'link',
    '\U0001F465': 'people', '\U0001F3AF': 'target', '\U0001F4C4': 'doc', '\U0001F393': 'cap', '♡': 'heart',
    '✍': 'pen', '✶': 'star',
}

# ----------------------------------------------------------------------------- mastheads
# id: [section overline, title, purpose, hide the page's own first h2 (it repeats the title)]
MAST = {
    'overview': ['Strategy', 'Executive dashboard', 'The numbers, what is new, and the decisions that sit with the executives.', False],
    'dashboard': ['Strategy', 'Delivery numbers', 'How fast work moves: time to close, open workload and aging, team by team.', False],
    'goals': ['Strategy', 'Department goals', 'Every team\'s goals for the quarter, with the projects and tasks that carry them.', True],
    'requests': ['Strategy', 'Requests', 'Ask another team for something and follow it through to done.', True, 'Department requests'],
    'transcripts': ['Meetings', 'Transcript archive', 'Every meeting the Hub has read, and where to add the next one.', False],
    'agendas': ['Meetings', 'Agendas', 'Build the agenda, run the meeting, tick items off as they happen.', True],
    'volunteering': ['Operations Montreal', 'Volunteering', 'Serving events, sign-ups and the volunteer records for Montreal.', True],
    'finances': ['Fundraising & Finances', 'Finances and budgeting', 'Statements, the ledger and budgets per team.', True],
    'hrcentre': ['Human Resources', 'HR centre', 'People records, hours, onboarding and policies in one place.', True],
    'orgchart': ['People', 'Org chart', 'Who does what, team by team. Click a person to open their profile.', True, 'Organization chart'],
    'training': ['People', 'My trainings', 'Policies to review and trainings to complete, with your progress.', False],
    'hubmail': ['Meetings', 'Hub inbox', 'What arrived at hub@ and where each email was filed.', False],
    'needsme': ['People', 'Needs me', 'Everything waiting on you, in one queue.', True],
    'activity': ['More', 'Activity', 'Everything that changed on the Hub, newest first.', True],
    'importantinfo': ['More', 'Important info', 'The standing facts and links everyone should know.', True],
    'brain': ['More', 'The Brain', 'Ask across everything the Hub knows.', True],
    'create': ['More', 'Create studio', 'Emails, one-pagers and posts in the Welfare Avenue brand.', True, 'Create branded content'],
}

# the Admin page, split: key -> [label, card selector, purpose]
# key -> [label, card selectors (comma separated; the first is the main card whose h2 repeats the title), purpose]
ADMIN = [
    ['ai', 'AI models', '#w116ncard', 'Which model answers each job, with fallbacks and spend.'],
    ['accounts', 'Workspace accounts', '#w116lcard', 'Google Workspace accounts, placed on the roster or set aside.'],
    ['people', 'People and access', '#w113card, #w113card + .card', 'Everyone on the roster, what they can see, their invitations, and the access requests.'],
    ['security', 'Security and audit trail', '#w86card', 'What the Hub enforces, the backups, and every change with who made it.'],
    ['change', 'Change the Hub', '#w96card', 'Edit content with AI, or file a build request for the pipeline.'],
]


def js_str(s):
    return json.dumps(s)


def build():
    icon_defs = ',\n    '.join('%s: %s' % (json.dumps(k), json.dumps(v)) for k, v in ICONS.items())
    glyph_map = ',\n    '.join('%s: %s' % (json.dumps(g), json.dumps(n)) for g, n in GLYPHS.items())
    mast_map = ',\n    '.join('%s: [%s, %s, %s, %s, %s]' % (json.dumps(k), json.dumps(v[0]), json.dumps(v[1]), json.dumps(v[2]), 'true' if v[3] else 'false', json.dumps(v[4] if len(v) > 4 else v[1])) for k, v in MAST.items())
    admin_list = ',\n    '.join('[%s, %s, %s, %s]' % tuple(json.dumps(x) for x in a) for a in ADMIN)
    hide_h2 = ', '.join('#%s > .w118mast + .card > h2:first-child' % k for k, v in MAST.items() if v[3])
    admin_hide = ', '.join('#adminpanel %s > h2:first-child' % a[2].split(',')[0].strip() for a in ADMIN)
    admin_rules = ''.join(
        '.w118adm[data-sec="%s"] ~ .card%s{display:none !important;}' % (a[0], ''.join(':not(%s)' % sel.strip() for sel in a[2].split(','))) for a in ADMIN)
    chevron = 'url(\"data:image/svg+xml;charset=utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3E%3Cpath fill=%27none%27 stroke=%27%23103F39%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 d=%27M6 8l4 4 4-4%27/%3E%3C/svg%3E\")'

    seg = r'''/* =====================================================================
   WA v118 brand depth: mastheads, the admin sections, one icon system, the details (25/09/26)
   =====================================================================
   Steel: "add more brand elements in to the hub" and "distribute the admin
   section into different sections: AI models, workspace accounts, people
   and access, security and audit trail, change the hub".
   1. Every older page opens like the wave116 pages: section overline,
      Barlow Condensed title with the gold rule, one line of purpose, the
      help button at the right. The Executive dashboard carries the E that
      moves (EXECUTIV[E]), the one major headline in the app that does.
   2. Admin is five sections with their own mastheads: sub-links under
      Admin in the sidebar, a switcher on the page, deep links
      #adminpanel/ai|accounts|people|security|change. One card at a time;
      the cards themselves (waves 86, 96, 113, 116l, 116n) are untouched.
   3. The emoji and dingbat glyphs used as icons become inline SVG line
      icons (flag, sparkle, folder, chart, clipboard, link, people, target,
      document, mic, send, menu, close), all currentColor.
   4. Details: selects with a brand chevron, every text input styled, gold
      focus rings, placeholder, selection colour, scrollbars, table row
      hover, button press, links. Empty states share one look with the
      asterisk doodle.
   5. The tab favicon and iOS icon are the WEL/FAR/E mark; theme-color is
      Community green; "WA assistant" reads "Ask the Hub".
   Everything is additive. window.__wa118.clean(el) returns the HTML of an
   element with this wave's changes undone (the harness parity gate uses it).
   Classic look (wa114classic) skips the wave. Loads after 117, before 110.
   ===================================================================== */
(function () {
  if (window.__wa118) return;
  var CLASSIC = false;
  try { CLASSIC = localStorage.getItem('wa114classic') === '1'; } catch (e) { /* fine */ }
  if (CLASSIC) { window.__wa118 = { classic: true }; return; }

  var B = __BUCKET__;
  var CREAM = '#FFFAF2', GREEN = '#103F39', GROUND = '#1F201E', PURPLE = '#6F64AB', GOLD = '#DCA527';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif", BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var E_D = __E_D__;
  var ICONS = {
    __ICONS__
  };
  var GLYPHS = {
    __GLYPHS__
  };
  var GLYPH_RE = new RegExp('[' + Object.keys(GLYPHS).map(function (g) { return g.length === 2 ? '\\u{' + g.codePointAt(0).toString(16) + '}' : '\\u' + ('0000' + g.charCodeAt(0).toString(16)).slice(-4); }).join('') + ']', 'u');
  var MAST = {
    __MAST__
  };
  var ADMIN = [
    __ADMIN__
  ];

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name, cls) { return '<svg class="w118i w118i-' + name + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }
  function svgE(cls) { return '<svg class="' + cls + '" viewBox="0 0 676 344" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="' + E_D + '"/></svg>'; }

  /* ---------- 1. CSS (inside #wa97css, after wave117) ---------- */
  var css = ''
    /* mastheads */
    + '.w118mast{position:relative;margin:0 0 16px;padding-right:180px;}'
    + '.w118mast .crumb{font-family:' + BODY + ';font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--wa-muted);margin:2px 0 6px;}'
    + '.w118mast h1{font-family:' + HEAD + ';font-weight:500;font-size:38px;line-height:1.05;letter-spacing:.3px;text-transform:uppercase;color:' + GREEN + ';margin:0;}'
    + '.w118mast h1::after,.w116ptop h2::after{content:"";display:block;width:40px;height:3px;background:' + GOLD + ';border-radius:2px;margin-top:9px;}'
    + '.w118mast p{font-family:' + BODY + ';font-size:13px;color:var(--wa-muted);margin:8px 0 0;max-width:680px;}'
    + '.w118mast .w43help{position:absolute;right:0;top:2px;margin:0;}'
    + '.w118mast h1 .w118e{display:inline-block;height:.7em;width:auto;vertical-align:baseline;margin:0 .1em 0 .03em;color:' + GREEN + ';}'
    + '@media (max-width:900px){.w118mast{padding-right:0;}.w118mast .w43help{position:static;display:inline-block;margin-top:8px;}.w118mast h1{font-size:30px;}}'
    /* the pages whose own first heading repeats the title */
    + '[data-w118hide="1"]{display:none !important;}'
    + 'h2[data-w118slim="1"]{font-size:0 !important;line-height:0 !important;margin:0 0 10px !important;}h2[data-w118slim="1"]::after{display:none !important;}h2[data-w118slim="1"] > *{font-size:12px;line-height:1.4;}'
    /* the admin sections */
    + '.w118adm{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px;padding:4px;background:rgba(16,63,57,.06);border-radius:14px;width:max-content;max-width:100%;}'
    + '.w118adm a{font-family:' + BODY + ';font-size:13px;font-weight:600;color:' + GREEN + ';padding:7px 13px;border-radius:10px;cursor:pointer;text-decoration:none;line-height:1.2;}'
    + '.w118adm a:hover{background:rgba(16,63,57,.08);}'
    + '.w118adm a.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '__ADMIN_RULES__'
    + '#adminpanel .w118adm ~ .card{margin-top:0;}'
    + 'nav.wa-nav .w118sub{display:none;padding:2px 0 8px 32px;}'
    + 'nav.wa-nav .tab[data-tab="adminpanel"].active + .w118sub{display:block;}'
    + 'nav.wa-nav .w118sub a{display:block;font-family:' + BODY + ';font-size:12.5px;color:var(--wa-muted);padding:4px 0;cursor:pointer;text-decoration:none;}'
    + 'nav.wa-nav .w118sub a:hover{color:' + GREEN + ';}'
    + 'nav.wa-nav .w118sub a.on{color:' + GREEN + ';font-weight:700;}'
    /* icons */
    + '.w118i{display:inline-block;width:1em;height:1em;vertical-align:-.16em;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;margin-right:.3em;flex:none;}'
    + 'h2 .w118i,h3 .w118i{width:.82em;height:.82em;vertical-align:-.08em;margin-right:.25em;}'
    + 'button .w118i-close,.mini-x .w118i,.x .w118i{margin-right:0;width:.95em;height:.95em;stroke-width:2.2;}'
    + '#wacSend .w118i,#w38send .w118i{margin-right:0;stroke-width:2.3;}'
    + 'b > .w118i:only-child{margin-right:0;}'
    /* the phone bar gets real icons */
    + '#w114bar button i{background:transparent;display:flex;align-items:center;justify-content:center;}'
    + '#w114bar button:not(.ask) i .w118i{width:22px;height:22px;margin:0;stroke:var(--wa-muted);stroke-width:1.8;}'
    + '#w114bar button.on i{background:transparent;}#w114bar button.on i .w118i{stroke:' + GREEN + ';}'
    /* controls */
    + 'select:not([multiple]){-webkit-appearance:none;appearance:none;background-image:__CHEVRON__;background-repeat:no-repeat;background-position:right 10px center;background-size:14px 14px;padding-right:32px !important;}'
    + 'input[type=url],input[type=tel],input[type=password],input[type=time],input[type=datetime-local],input:not([type]){font-family:' + BODY + ';font-size:14px;color:var(--wa-text);background:var(--wa-card);border:1px solid rgba(16,63,57,.18);border-radius:10px;padding:8px 12px;}'
    + 'input::placeholder,textarea::placeholder{color:#8F8D88;opacity:1;}'
    + 'input:focus,select:focus,textarea:focus{outline:none;border-color:' + GREEN + ';box-shadow:0 0 0 3px rgba(220,165,39,.35);}'
    + 'button:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + 'input[type=checkbox],input[type=radio]{accent-color:' + GREEN + ';}'
    + '::selection{background:rgba(220,165,39,.45);color:' + GROUND + ';}'
    + '#waChatPanel ::selection,.gate ::selection,#wa110veil ::selection{background:rgba(255,250,242,.35);color:' + CREAM + ';}'
    + '*{scrollbar-width:thin;scrollbar-color:rgba(16,63,57,.28) transparent;}'
    + '::-webkit-scrollbar{width:10px;height:10px;}::-webkit-scrollbar-track{background:transparent;}'
    + '::-webkit-scrollbar-thumb{background:rgba(16,63,57,.28);border-radius:999px;border:2px solid transparent;background-clip:padding-box;}'
    + '::-webkit-scrollbar-thumb:hover{background:rgba(16,63,57,.45);border:2px solid transparent;background-clip:padding-box;}'
    + 'table tbody tr:hover td,.wa-tbl tbody tr:hover td,.w86tbl tbody tr:hover td{background:rgba(220,165,39,.07);}'
    + '.btn,button.btn,.w113btn,.w84btn,.w111btn,.wa24-links button,.w112go{transition:transform .12s ease,filter .12s ease,background-color .15s ease;}'
    + '.btn:active,button.btn:active,.w113btn:active,.w84btn:active,.w111btn:active{transform:translateY(1px);}'
    + '.panel a:not([class]){text-underline-offset:3px;text-decoration-thickness:1px;}'
    /* empty states */
    + '.mp-empty,.empty,.w116empty,.w116empty2,.w67empty{font-family:' + BODY + ';font-size:13px;color:var(--wa-muted);padding:14px 16px;border:1px dashed rgba(16,63,57,.2);border-radius:12px;background:rgba(16,63,57,.025);}'
    + '.mp-empty::before,.empty::before,.w116empty::before,.w116empty2::before,.w67empty::before{content:"";display:inline-block;width:14px;height:14px;margin:0 8px -2px 0;background:url(' + B + 'doodle-asterisk-gold.png) center/contain no-repeat;opacity:.95;}'
    + '@media (prefers-reduced-motion:reduce){.btn,button.btn,.w113btn,.w84btn,.w111btn{transition:none;}}';

  var host = document.getElementById('wa97css');
  if (host) host.textContent += '\n/* wa118 */\n' + css;
  else { var style = document.createElement('style'); style.id = 'wa118css'; style.textContent = css; document.head.appendChild(style); }

  /* ---------- 2. head: favicon, iOS icon, theme colour ---------- */
  function head() {
    try {
      var fav = 'data:image/png;base64,__FAV64__', touch = 'data:image/png;base64,__FAV180__';
      var icons = document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]');
      if (icons.length) { icons.forEach(function (l) { l.setAttribute('href', fav); l.setAttribute('type', 'image/png'); l.removeAttribute('sizes'); }); }
      else { var l = document.createElement('link'); l.rel = 'icon'; l.type = 'image/png'; l.href = fav; document.head.appendChild(l); }
      var touches = document.querySelectorAll('link[rel="apple-touch-icon"]');
      if (touches.length) touches.forEach(function (l) { l.setAttribute('href', touch); l.removeAttribute('sizes'); });
      else { var t = document.createElement('link'); t.rel = 'apple-touch-icon'; t.href = touch; document.head.appendChild(t); }
      var m = document.querySelector('meta[name="theme-color"]');
      if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
      m.content = GREEN;
    } catch (e) { /* fine */ }
  }

  /* ---------- 3. mastheads ---------- */
  var slot = 0;
  function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function ownText(el) { var t = ''; for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue; return t; }
  function moveHelp(help, mast) {
    var parent = help.parentNode, idx = Array.prototype.indexOf.call(parent.childNodes, help);
    slot += 1;
    parent.setAttribute('data-w118slot', String(slot));
    help.setAttribute('data-w118from', String(slot));
    help.setAttribute('data-w118idx', String(idx));
    mast.appendChild(help);
  }
  function hideEl(el) { el.setAttribute('data-w118hide', '1'); }
  function mastHtml(crumb, title, blurb, withE) {
    var t = E(title);
    if (withE) t = t.replace(/^(EXECUTIV|Executiv)E /i, '$1' + svgE('w118e') + ' ');
    return '<div class="crumb">' + E(crumb) + '</div><h1>' + t + '</h1><p>' + E(blurb) + '</p>';
  }
  /* the page's own title heading: the first h2 whose own text is the title (glyphs and the help button aside) */
  function titleH2(panel, title) {
    var hs = panel.querySelectorAll('h2');
    for (var i = 0; i < hs.length && i < 5; i++) {
      if (hs[i].closest('.w118mast')) continue;
      var t = norm(ownText(hs[i]));
      if (t && (t === norm(title) || norm(title).indexOf(t) === 0 || t.indexOf(norm(title)) === 0)) return hs[i];
    }
    return null;
  }
  /* the page's own title heading: lift its help button into the masthead, hide it (or slim it when it holds a chip), reuse its subtitle */
  function claim(panel, el, m) {
    var h2 = m[3] ? titleH2(panel, m[4]) : null;
    if (!h2) return;
    var help = h2.querySelector(':scope > .w43help');
    if (help && !el.querySelector('.w43help')) moveHelp(help, el);
    if (!h2.getAttribute('data-w118hide') && !h2.getAttribute('data-w118slim')) {
      var others = Array.prototype.filter.call(h2.children, function (c) { return !c.classList.contains('w43help') && !c.classList.contains('w118i'); });
      if (!others.length) hideEl(h2); else h2.setAttribute('data-w118slim', '1');
    }
    var nx = h2.nextElementSibling;
    if (nx && nx.classList.contains('w85p') && !nx.getAttribute('data-w118hide') && norm(nx.textContent)) {
      var p = el.querySelector(':scope > p'); if (p) p.textContent = nx.textContent.trim();
      hideEl(nx);
    }
  }
  function mast(id) {
    var panel = document.getElementById(id), m = MAST[id];
    if (!panel || !m) return;
    var el = panel.querySelector(':scope > .w118mast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'w118mast';
      el.setAttribute('data-w118', id);
      el.innerHTML = mastHtml(m[0], m[1], m[2], id === 'overview');
      panel.insertBefore(el, panel.firstChild);
    } else if (panel.firstElementChild !== el) panel.insertBefore(el, panel.firstChild);
    claim(panel, el, m);
  }
  function mastheads() { Object.keys(MAST).forEach(function (id) { try { mast(id); } catch (e) { /* non-fatal */ } }); }

  /* ---------- 4. the admin sections ---------- */
  var admSec = ADMIN[0][0];
  function admKey(h) {
    var p = String(h || location.hash || '').replace(/^#/, '').split('/');
    if (p[0] !== 'adminpanel') return null;
    var k = p[1] || '';
    return ADMIN.some(function (a) { return a[0] === k; }) ? k : ADMIN[0][0];
  }
  function admDef(k) { for (var i = 0; i < ADMIN.length; i++) if (ADMIN[i][0] === k) return ADMIN[i]; return ADMIN[0]; }
  function admMount() {
    var panel = document.getElementById('adminpanel');
    if (!panel) return;
    var mastEl = panel.querySelector(':scope > .w118mast');
    if (!mastEl) {
      mastEl = document.createElement('div'); mastEl.className = 'w118mast'; mastEl.setAttribute('data-w118', 'adminpanel');
      panel.insertBefore(mastEl, panel.firstChild);
    }
    if (panel.firstChild !== mastEl) panel.insertBefore(mastEl, panel.firstChild);
    var sw = panel.querySelector(':scope > .w118adm');
    if (!sw) {
      sw = document.createElement('nav'); sw.className = 'w118adm'; sw.setAttribute('aria-label', 'Admin sections');
      sw.innerHTML = ADMIN.map(function (a) { return '<a href="#adminpanel/' + a[0] + '" data-w118sec="' + a[0] + '">' + E(a[1]) + '</a>'; }).join('');
      panel.insertBefore(sw, mastEl.nextSibling);
    }
    if (mastEl.nextSibling !== sw) panel.insertBefore(sw, mastEl.nextSibling);
    admApply(panel, mastEl, sw);
  }
  function admApply(panel, mastEl, sw) {
    var d = admDef(admSec);
    ADMIN.forEach(function (a) {
      var card = panel.querySelector(a[2].split(',')[0].trim());
      var h = card ? card.querySelector(':scope > h2:first-child') : null;
      if (h && !h.getAttribute('data-w118hide') && norm(ownText(h)) === norm(a[1]).replace(' trail', '')) hideEl(h);
      else if (h && !h.getAttribute('data-w118hide') && h.children.length === 0) hideEl(h);
    });
    sw.setAttribute('data-sec', d[0]);
    sw.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-w118sec') === d[0]); });
    var want = mastHtml('Admin', d[1], d[3], false);
    if (mastEl.getAttribute('data-w118cur') !== d[0]) { mastEl.innerHTML = want; mastEl.setAttribute('data-w118cur', d[0]); }
    var sub = document.querySelector('nav.wa-nav .w118sub');
    if (sub) sub.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-w118sec') === d[0]); });
    try { document.title = d[1] + ' \u00b7 Welfare Avenue Hub'; } catch (e) { /* fine */ }
  }
  function admNav() {
    var tab = document.querySelector('nav.wa-nav .tab[data-tab="adminpanel"]');
    if (!tab) return;
    var sub = document.querySelector('nav.wa-nav .w118sub');
    if (sub && tab.nextElementSibling === sub) return;
    if (sub) sub.parentNode.removeChild(sub);
    sub = document.createElement('div'); sub.className = 'w118sub';
    sub.innerHTML = ADMIN.map(function (a) { return '<a href="#adminpanel/' + a[0] + '" data-w118sec="' + a[0] + '">' + E(a[1]) + '</a>'; }).join('');
    sub.addEventListener('click', function () { try { document.body.classList.remove('wa-mob-open'); } catch (e) { /* fine */ } });
    tab.parentNode.insertBefore(sub, tab.nextSibling);
    sub.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-w118sec') === admSec); });
  }
  function admRoute(h) {
    var k = admKey(h);
    if (!k) return;
    admSec = k;
    admMount();
  }
  function admHook() {
    try {
      if (window.WA_NAV && WA_NAV.pages) {
        var pg = null;
        for (var i = 0; i < WA_NAV.pages.length; i++) if (WA_NAV.pages[i].id === 'adminpanel') pg = WA_NAV.pages[i];
        if (!pg) { pg = { id: 'adminpanel' }; WA_NAV.pages.push(pg); }
        if (!pg.__wa118) { var prev = pg.onShow; pg.__wa118 = true; pg.onShow = function (h) { if (prev) { try { prev(h); } catch (e) { /* fine */ } } admRoute(h); }; }
      }
    } catch (e) { /* fine */ }
    window.addEventListener('hashchange', function () { if (admKey()) setTimeout(function () { admRoute(); }, 0); });
  }

  /* ---------- 5. icons: glyphs used as icons become SVG ---------- */
  var ICON_SCOPE = 'button, a, h2, h3, h4, .w111btn, .tab, .chip, .pill, span.ic, b, .w75ic, summary, label';
  function swapNode(tn) {
    var text = tn.nodeValue;
    if (!GLYPH_RE.test(text)) return false;
    var frag = document.createDocumentFragment(), last = 0, re = new RegExp(GLYPH_RE.source, 'gu'), m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var span = document.createElement('span');
      span.innerHTML = icon(GLYPHS[m[0]]);
      var svg = span.firstChild; svg.setAttribute('data-w118g', m[0]);
      frag.appendChild(svg);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    tn.parentNode.replaceChild(frag, tn);
    return true;
  }
  function icons(root) {
    root = root || document.body;
    if (!root || !root.querySelectorAll) return;
    var hosts = root.matches && root.matches(ICON_SCOPE) ? [root] : [];
    root.querySelectorAll(ICON_SCOPE).forEach(function (h) { hosts.push(h); });
    hosts.forEach(function (h) {
      /* the retired classic department panels (hidden since wave116i) keep their text: other waves match on it */
      if (h.closest('#wa110veil, script, style, textarea, input, #opsmtl, #opsto, #marketing, #fundraising, #hr, #board, #progdev')) return;
      for (var i = 0; i < h.childNodes.length; i++) {
        var n = h.childNodes[i];
        if (n.nodeType === 3 && GLYPH_RE.test(n.nodeValue)) { if (swapNode(n)) i = -1; }
      }
    });
  }

  /* ---------- 5b. the phone bar: real icons in the empty slots ---------- */
  var BAR = { mypage: 'home', overview: 'chart', departments: 'people', more: 'dots' };
  function phoneBar() {
    var bar = document.getElementById('w114bar');
    if (!bar) return;
    bar.querySelectorAll('button').forEach(function (b) {
      var key = b.getAttribute('data-w114go') || b.getAttribute('data-w114grp'), name = BAR[key];
      var i = b.querySelector('i');
      if (!name || !i || i.querySelector('.w118i')) return;
      var span = document.createElement('span'); span.innerHTML = icon(name);
      var svg = span.firstChild; svg.setAttribute('data-w118g', '');
      i.appendChild(svg);
    });
  }

  /* ---------- 6. copy: the assistant is "Ask the Hub" ---------- */
  var FIX = [['Ask the WA assistant', 'Ask the Hub'], ['Meet the WA assistant', 'Meet Ask the Hub'], ['The WA assistant', 'Ask the Hub'], ['the WA assistant', 'Ask the Hub'], ['WA Assistant', 'Ask the Hub'], ['WA assistant', 'Ask the Hub']];
  function fixText(root) {
    root = root || document.body;
    if (!root || !root.querySelectorAll) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var todo = [], n;
    while ((n = walker.nextNode())) { if (n.nodeValue.indexOf('WA assistant') >= 0 || n.nodeValue.indexOf('WA Assistant') >= 0) todo.push(n); }
    todo.forEach(function (t) {
      if (t.parentNode && (t.parentNode.classList && t.parentNode.classList.contains('w118t'))) return;
      if (t.parentNode && t.parentNode.closest && t.parentNode.closest('script, style, textarea, #wa110veil')) return;
      var s = t.nodeValue, o = s;
      FIX.forEach(function (f) { s = s.split(f[0]).join(f[1]); });
      if (s === o) return;
      var span = document.createElement('span'); span.className = 'w118t'; span.setAttribute('data-w118o', o); span.textContent = s;
      t.parentNode.replaceChild(span, t);
    });
  }

  /* ---------- 7. clean copy for the harness: undo everything above on a clone ---------- */
  function cleanNode(el) {
    var c = el.cloneNode(true);
    c.querySelectorAll('[data-w118from]').forEach(function (b) {
      var tok = b.getAttribute('data-w118from'), idx = parseInt(b.getAttribute('data-w118idx'), 10) || 0;
      var slotEl = c.querySelector('[data-w118slot="' + tok + '"]');
      b.removeAttribute('data-w118from'); b.removeAttribute('data-w118idx');
      if (slotEl) { var ref = slotEl.childNodes[idx] || null; slotEl.insertBefore(b, ref); }
    });
    c.querySelectorAll('[data-w118slot]').forEach(function (s) { s.removeAttribute('data-w118slot'); });
    c.querySelectorAll('[data-w118hide],[data-w118slim]').forEach(function (s) { s.removeAttribute('data-w118hide'); s.removeAttribute('data-w118slim'); });
    c.querySelectorAll('.w118mast, .w118adm, .w118sub, #w118ck').forEach(function (n) { n.parentNode.removeChild(n); });
    c.querySelectorAll('svg.w118i').forEach(function (s) { s.parentNode.replaceChild(document.createTextNode(s.getAttribute('data-w118g') || ''), s); });
    c.querySelectorAll('span.w118t').forEach(function (s) { s.parentNode.replaceChild(document.createTextNode(s.getAttribute('data-w118o') || ''), s); });
    c.normalize();
    return c;
  }
  function clean(el) { return cleanNode(el).outerHTML; }

  /* ---------- wiring ---------- */
  var pending = null;
  function later(root) {
    if (pending) return;
    pending = setTimeout(function () { pending = null; try { mastheads(); if (document.querySelector('#adminpanel > .w118adm')) admMount(); icons(); fixText(); phoneBar(); } catch (e) { /* non-fatal */ } }, 60);
  }
  function boot() {
    head();
    try { mastheads(); } catch (e) { /* non-fatal */ }
    try { admNav(); admHook(); admMount(); if (admKey()) admRoute(); } catch (e) { /* non-fatal */ }
    try { icons(); fixText(); phoneBar(); } catch (e) { /* non-fatal */ }
    var mo = new MutationObserver(function (muts) {
      var need = false;
      for (var i = 0; i < muts.length && !need; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) need = true; }
      if (need) later();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    if (typeof showPanel === 'function') {
      var __sp118 = showPanel;
      showPanel = function (id) {
        var r = __sp118.apply(this, arguments);
        try { if (id === 'adminpanel') { if (!admKey()) admSec = ADMIN[0][0]; admMount(); } admNav(); setTimeout(mastheads, 30); } catch (e) { /* non-fatal */ }
        return r;
      };
    }
    if (typeof startApp === 'function') {
      var __sa118 = startApp;
      startApp = async function () {
        var r = await __sa118.apply(this, arguments);
        [300, 1500, 4000].forEach(function (ms) { setTimeout(function () { try { admNav(); mastheads(); icons(); fixText(); if (admKey()) admRoute(); } catch (e) { /* non-fatal */ } }, ms); });
        return r;
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.__wa118 = { version: 1, clean: clean, cleanNode: cleanNode, icons: icons, mastheads: mastheads, admin: admMount, ADMIN: ADMIN };
})();
'''
    seg = (seg.replace('__BUCKET__', json.dumps(BUCKET))
              .replace('__E_D__', json.dumps(E_SMALL_D))
              .replace('__ICONS__', icon_defs)
              .replace('__GLYPHS__', glyph_map)
              .replace('__MAST__', mast_map)
              .replace('__ADMIN__', admin_list)
              .replace('__ADMIN_RULES__', admin_rules)
              .replace('__CHEVRON__', chevron)
              .replace('__FAV64__', FAV64)
              .replace('__FAV180__', FAV180))
    bad = [ch for ch in seg if ord(ch) > 127]
    assert not bad, 'non-ascii in segment: %r' % bad[:5]
    return seg


def manifest():
    p = os.path.join(HERE, 'src', 'MANIFEST.txt')
    lines = [l.strip() for l in open(p) if l.strip()]
    changed = False
    if '118_wave118' not in lines:
        lines.insert(lines.index('110_wave110'), '118_wave118'); changed = True
    if '118b_wave118b' not in lines and os.path.exists(os.path.join(HERE, 'src', '118b_wave118b.seg')):
        lines.insert(lines.index('118_wave118') + 1, '118b_wave118b'); changed = True
    if changed:
        open(p, 'w').write('\n'.join(lines) + '\n')
    return lines[-5:]


if __name__ == '__main__':
    seg = build()
    open(os.path.join(HERE, 'src', '118_wave118.seg'), 'w', encoding='utf-8').write(seg)
    print('segment bytes', len(seg.encode('utf-8')), 'fav64', len(FAV64), 'fav180', len(FAV180))
    print('manifest', manifest())
