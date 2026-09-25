#!/usr/bin/env python3
"""wave117 (25/09/26): generate the branded boot veil (patched into 000_head_base) and src/117_wave117.seg
from the brand vectors in data/w117_paths.json. Run from build/: python3 w117_gen.py
Idempotent: re-running replaces the veil block and rewrites the segment."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, 'data', 'w117_paths.json')))
E_SMALL_D = re.search(r'd="([^"]+)"', open(os.path.join(HERE, 'data', 'e_small.svg')).read()).group(1)
BUCKET = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/'
CREAM, GREEN, GROUND, PURPLE, GOLD = '#FFFAF2', '#103F39', '#1F201E', '#6F64AB', '#DCA527'
HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif"
BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif"
FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap'

vb = P['viewBox_lockup']; vbp = P['viewBox_primary']; be = P['bar_e']
bars = be['bars']

def e_rects(cls_prefix='bar'):
    x0 = be['x']; stem = be['stem_w']; right = be['right']
    r = f'<rect class="stem" x="{x0}" y="{be["y"]}" width="{stem}" height="{round(be["bottom"]-be["y"],2)}" fill="currentColor"/>'
    for i, (y0, y1) in enumerate(bars, 1):
        r += f'<rect class="{cls_prefix} b{i}" x="{round(x0+stem-0.6,2)}" y="{y0}" width="{round(right-x0-stem+0.6,2)}" height="{round(y1-y0,2)}" fill="currentColor"/>'
    return r

# Fun facts shown on the loading veil: public-safe, from the brand deck and the facts sheet.
FACTS = [
    "Welfare Avenue began as a small group of students with one goal: serve our neighbours through Sunday servings.",
    "We serve in two cities: bi-weekly servings in Montreal and monthly servings in Toronto.",
    "More than 3,000 holiday gifts have been delivered to neighbours since our founding.",
    "Food is our starting point. The meal builds trust; the larger goal is connection, dignity and reintegration.",
    "Our four pillars: dismantling social isolation, dignified resource distribution, integrating the care ecosystem and food security mobilization.",
    "We say people we serve, community and support. Never beneficiaries, never the homeless.",
    "Youth-powered, and open to volunteers and partners of every generation.",
    "Our five brand colours have names: Dignity, Community, Ground, Possibility and Action.",
    "The E in AVENUE is drawn as a pathway: three bars that extend forward. That is the E that moves.",
    "Our doodles are hand-drawn on purpose. Imperfect lines keep the brand human.",
    "Every September, Rally Paper sends four charity teams racing across Montreal for 36 hours. A canoe race, a mud pit and, one year, a horse.",
    "Our vision: a world without poverty, where community engagement is a central value from a young age.",
    "Together we move forward: every act of kindness creates a path.",
    "The hub turns meeting notes into tasks, goals and decisions automatically, so everyone can see how the work moves.",
]

VEIL_CSS = f"""<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="w117fonts" rel="stylesheet" href="{FONTS}">
<style id="wa110veilcss">
  /* WA v110 boot veil (restyled by wave117, 25/09/26): the static page used to
     paint before the waves restyled it. Until the last wave flags
     html.wa-ready, everything but the veil is hidden; a 9s failsafe in
     wave110 reveals the page no matter what. wave117 fills the veil with the
     brand: the wordmark with the E that moves as the loader, and a fun fact
     about Welfare Avenue that rotates while the hub boots. */
  html:not(.wa-ready) body > *:not(#wa110veil) {{ visibility: hidden !important; }}
  #wa110veil {{ position: fixed; inset: 0; background: {GREEN}; display: flex; align-items: center; justify-content: center; z-index: 99999; transition: opacity .45s ease; overflow: hidden; font-family: {BODY}; color: {CREAM}; }}
  html.wa-ready #wa110veil {{ opacity: 0; pointer-events: none; }}
  #wa110veil .w117blob {{ position: absolute; left: -16vw; top: -28vh; width: 58vw; height: 62vh; border-radius: 50%; background: radial-gradient(closest-side, rgba(111,100,171,.96), rgba(111,100,171,.78) 52%, rgba(111,100,171,0) 100%); filter: blur(1.5px); pointer-events: none; }}
  #wa110veil .w117doo {{ position: absolute; pointer-events: none; opacity: 0; animation: w117fade .9s ease .25s forwards; }}
  #wa110veil .w117star {{ right: 5vw; top: 7vh; width: min(150px, 15vw); }}
  #wa110veil .w117flow {{ left: 4vw; bottom: 5vh; width: min(150px, 15vw); }}
  #wa110veil .w117heart {{ right: 6vw; bottom: 6vh; width: min(150px, 15vw); }}
  #wa110veil .w117c {{ position: relative; text-align: center; padding: 0 24px; max-width: 600px; }}
  #wa110veil .w117wm {{ width: min(440px, 74vw); height: auto; display: block; margin: 0 auto; color: {CREAM}; overflow: visible; }}
  #wa110veil .w117wm .bar {{ transform-box: fill-box; transform-origin: left center; animation: w117bar 1.7s cubic-bezier(.65,0,.35,1) infinite; }}
  #wa110veil .w117wm .bar.b2 {{ animation-delay: .16s; }}
  #wa110veil .w117wm .bar.b3 {{ animation-delay: .32s; }}
  @keyframes w117bar {{ 0% {{ transform: scaleX(.16); }} 42% {{ transform: scaleX(1); }} 68% {{ transform: scaleX(1); }} 100% {{ transform: scaleX(.16); }} }}
  #wa110veil .w117ov {{ margin: 36px 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: {GOLD}; }}
  #wa110veil .w117fact {{ font-size: 16px; line-height: 1.5; min-height: 3.1em; color: rgba(255,250,242,.92); transition: opacity .35s ease, transform .35s ease; }}
  #wa110veil .w117fact.out {{ opacity: 0; transform: translateY(4px); }}
  @keyframes w117fade {{ to {{ opacity: 1; }} }}
  @media (max-width: 600px) {{ #wa110veil .w117doo {{ width: 22vw; }} #wa110veil .w117heart {{ display: none; }} #wa110veil .w117fact {{ font-size: 14.5px; }} }}
  @media (prefers-reduced-motion: reduce) {{ #wa110veil .w117wm .bar {{ animation: none; transform: none; }} #wa110veil .w117doo {{ animation: none; opacity: 1; }} }}
</style>"""

VEIL_HTML = (
    '<div id="wa110veil" aria-hidden="true"><div class="w117blob"></div>'
    f'<img class="w117doo w117star" src="{BUCKET}doodle-star-gold.png" alt="">'
    f'<img class="w117doo w117flow" src="{BUCKET}doodle-flowers-gold.png" alt="">'
    f'<img class="w117doo w117heart" src="{BUCKET}doodle-heart-purple.png" alt="">'
    '<div class="w117c">'
    f'<svg class="w117wm" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" xmlns="http://www.w3.org/2000/svg" aria-label="Welfare Avenue">'
    f'<path fill="currentColor" fill-rule="evenodd" d="{P["primary_no_e_d"]}"/>{e_rects()}'
    f'<path fill="currentColor" d="{P["tag_main_d"]}"/><path fill="{GOLD}" d="{P["tag_gold_d"]}"/></svg>'
    '<div class="w117ov">Did you know</div><div class="w117fact" id="w117fact"></div></div></div>\n'
    '<script>(function(){var F=' + json.dumps(FACTS) + ';var i=Math.floor(Math.random()*F.length);var el=document.getElementById("w117fact");if(!el)return;el.textContent=F[i];'
    'var t=setInterval(function(){if(document.documentElement.classList.contains("wa-ready")||!document.getElementById("w117fact")){clearInterval(t);return;}'
    'el.classList.add("out");setTimeout(function(){i=(i+1)%F.length;el.textContent=F[i];el.classList.remove("out");},360);},3400);})();</script>'
)

def patch_base():
    p = os.path.join(HERE, 'src', '000_head_base.seg')
    s = open(p, encoding='utf-8').read()
    # 1. the style block (from any earlier fonts link we added, or the original style) up to </style>
    m = re.search(r'(?:<link rel="preconnect"[^\n]*\n<link id="w117fonts"[^\n]*\n)?<style id="wa110veilcss">.*?</style>', s, re.S)
    assert m, 'veil css block not found'
    s = s[:m.start()] + VEIL_CSS + s[m.end():]
    # 2. the veil element (+ our script when re-running)
    m = re.search(r'<div id="wa110veil" aria-hidden="true">.*?</div>\n(?:<script>\(function\(\)\{var F=.*?</script>)?', s, re.S)
    assert m, 'veil element not found'
    # the original element is a single line; on re-run our multi-line version ends at </script>
    s = s[:m.start()] + VEIL_HTML + s[m.end():]
    open(p, 'w', encoding='utf-8').write(s)
    return len(s)

# ----------------------------------------------------------------------------- the wave
def svg_data_uri(path_d, fill, viewbox):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}"><path fill="{fill}" d="{path_d}"/></svg>'
    enc = svg.replace('"', '%22').replace('#', '%23').replace('<', '%3C').replace('>', '%3E')
    return 'url("data:image/svg+xml;utf8,' + enc + '")'

E_URI_CREAM = svg_data_uri(E_SMALL_D, CREAM, '0 0 676 344')
E_URI_GREEN = svg_data_uri(E_SMALL_D, GREEN, '0 0 676 344')

SEG = r"""/* =====================================================================
   WA v117 more of the brand feel (25/09/26)
   =====================================================================
   Steel: "update hub to have more of the brand feel", "add some
   animations to the Ask the hub chat bot, make it look really cool
   filled with our branding assets", "fill the loading page with strong
   branding and sprinkle fun facts about Welfare Avenue when it loads".
   Brand source: wa_brand / wa_brand_assets in Supabase (Brand Guides
   v1 2026) and the brand/ folder in content-images.
   Pieces:
   1. Boot veil: rebuilt in 000_head_base (first paint): the vector
      wordmark with the E that moves as the loader, the descriptor line,
      doodles, a purple spray and a rotating "Did you know" fact.
   2. Sidebar wordmark: the traced vector (inline SVG) replaces the PNG.
   3. Sign-in gate: doodles and the purple spray on the green, the lockup
      in the card, the headline TOGETHER WE MOV[E] FORWARD with the E
      component.
   4. Ask the Hub: gold pill with the E icon (bars extend on hover), the
      drawer slides in, green header with the secondary mark, a purple
      spray and a twinkling star, bot messages with the WEL/FAR/E
      avatar, "Thinking..." becomes the E-that-moves loader, starter
      prompts as gold-ruled cards, rounded input with a gold send button,
      a faint E watermark behind the thread.
   5. Accents: gold active-tab mark in the sidebar, flower doodle after
      team page titles, E watermark in the green dashboard tile,
      asterisk before empty states, star before toasts, button lift on
      hover, pages fade in. Everything honours prefers-reduced-motion.
   Classic look (wa114classic) skips all of it except the veil.
   CSS rides inside #wa97css like wave114. Loads BEFORE wave110.
   ===================================================================== */
(function () {
  if (window.__wa117) return; window.__wa117 = true;
  var CLASSIC = false;
  try { CLASSIC = localStorage.getItem('wa114classic') === '1'; } catch (e) { /* fine */ }
  if (CLASSIC) return;

  var B = '__BUCKET__';
  var CREAM = '#FFFAF2', GREEN = '#103F39', GROUND = '#1F201E', PURPLE = '#6F64AB', GOLD = '#DCA527';
  var HEAD = "__HEAD__", BODY = "__BODY__";
  var PRIMARY_D = '__PRIMARY_D__';
  var LOCKUP_TAG_D = '__TAG_MAIN__', LOCKUP_GOLD_D = '__TAG_GOLD__';
  var SECONDARY_D = '__SECONDARY_D__';
  var E_D = '__E_SMALL_D__';
  var VB_PRIMARY = '__VB_PRIMARY__', VB_LOCKUP = '__VB_LOCKUP__', VB_SECONDARY = '__VB_SECONDARY__';

  function svgPrimary(cls) { return '<svg class="' + cls + '" viewBox="' + VB_PRIMARY + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Welfare Avenue"><path fill="currentColor" fill-rule="evenodd" d="' + PRIMARY_D + '"/></svg>'; }
  function svgLockup(cls) { return '<svg class="' + cls + '" viewBox="' + VB_LOCKUP + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Welfare Avenue, building pathways in our community"><path fill="currentColor" fill-rule="evenodd" d="' + PRIMARY_D + '"/><path fill="currentColor" d="' + LOCKUP_TAG_D + '"/><path fill="' + GOLD + '" d="' + LOCKUP_GOLD_D + '"/></svg>'; }
  function svgSecondary(cls) { return '<svg class="' + cls + '" viewBox="' + VB_SECONDARY + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="' + SECONDARY_D + '"/></svg>'; }
  function svgE(cls) { return '<svg class="' + cls + '" viewBox="0 0 676 344" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="' + E_D + '"/></svg>'; }
  function svgEBars(cls) {
    /* the E as four rects so the bars can move (stem 20%, bars ~17% of the height) */
    return '<svg class="' + cls + '" viewBox="0 0 676 344" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="0" y="0" width="69" height="344" fill="currentColor"/>'
      + '<rect class="bar b1" x="68" y="0" width="608" height="59" fill="currentColor"/><rect class="bar b2" x="68" y="142" width="608" height="59" fill="currentColor"/><rect class="bar b3" x="68" y="285" width="608" height="59" fill="currentColor"/></svg>';
  }

  var css = ''
    /* ---------- motion ---------- */
    + '@keyframes w117in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
    + '@keyframes w117slide{from{transform:translateX(48px);opacity:0}to{transform:none;opacity:1}}'
    + '@keyframes w117msg{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
    + '@keyframes w117bar{0%{transform:scaleX(.16)}42%{transform:scaleX(1)}68%{transform:scaleX(1)}100%{transform:scaleX(.16)}}'
    + '@keyframes w117twinkle{0%,100%{transform:rotate(-8deg) scale(1);opacity:.85}50%{transform:rotate(10deg) scale(1.14);opacity:1}}'
    + '@keyframes w117pop{0%{transform:scale(1)}40%{transform:scale(1.35) rotate(12deg)}100%{transform:scale(1) rotate(0)}}'
    + '.panel.active{animation:w117in .32s cubic-bezier(.2,.7,.2,1);}'

    /* ---------- sidebar ---------- */
    + 'nav.wa-nav .w114brand{margin:4px 10px 20px;}'
    + 'nav.wa-nav .w114brand img{display:none;}'
    + 'nav.wa-nav .w114brand .w117logo{width:136px;height:auto;display:block;color:' + GREEN + ';transition:transform .2s ease;}'
    + 'nav.wa-nav .w114brand:hover .w117logo{transform:translateY(-1px);}'
    + 'nav.wa-nav #tabBar .tab.active{box-shadow:inset 3px 0 0 ' + GOLD + ';}'

    /* ---------- buttons ---------- */
    + '.btn,button.btn,.w113btn,.w84btn,#w72inv,.btn-google,.w81chip{transition:transform .15s ease,box-shadow .15s ease,background .15s ease;}'
    + '.btn:hover,button.btn:hover,.w113btn:hover,.w84btn:hover,.btn-google:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(16,63,57,.16);}'
    + '.btn:active,button.btn:active{transform:translateY(0);}'

    /* ---------- accents ---------- */
    + '.w116top > div:first-child h2::after{content:"";display:inline-block;width:44px;height:52px;margin-left:6px;background:url(' + B + 'doodle-flowers-gold.png) center/contain no-repeat;flex:0 0 auto;}'
    + '#w35stats .w35stat.acc{position:relative;overflow:hidden;}'
    + '#w35stats .w35stat.acc::after{content:"";position:absolute;right:-14px;bottom:-8px;width:150px;height:50px;background:' + E_URI_CREAM + ' right bottom/contain no-repeat;opacity:.14;pointer-events:none;}'
    + '.mp-empty::before,.w116empty::before{content:"";display:inline-block;width:13px;height:13px;margin-right:7px;vertical-align:-2px;background:url(' + B + 'doodle-asterisk-gold.png) center/contain no-repeat;}'
    + '#toast.toast{padding-left:40px;background-image:url(' + B + 'doodle-star-gold.png);background-repeat:no-repeat;background-position:12px center;background-size:18px 18px;}'

    /* ---------- sign-in gate ---------- */
    + '.gate{overflow:hidden;background:' + GREEN + ';}'
    + '.gate::before{content:"";position:absolute;left:-14vw;top:-26vh;width:54vw;height:58vh;border-radius:50%;background:radial-gradient(closest-side,rgba(111,100,171,.96),rgba(111,100,171,.78) 52%,rgba(111,100,171,0) 100%);filter:blur(1.5px);pointer-events:none;}'
    + '.gate .w117gd{position:absolute;pointer-events:none;opacity:0;animation:w117fadein .9s ease .2s forwards;}'
    + '@keyframes w117fadein{to{opacity:1}}'
    + '.gate .w117gd.star{right:5vw;top:7vh;width:min(150px,15vw);}'
    + '.gate .w117gd.flow{left:4vw;bottom:5vh;width:min(150px,15vw);}'
    + '.gate .w117gd.heart{right:6vw;bottom:6vh;width:min(140px,14vw);}'
    + '.gate-card{position:relative;z-index:1;max-width:460px;padding:34px 34px 28px;animation:w117in .5s cubic-bezier(.2,.7,.2,1);}'
    + '.gate .gate-card .wa-logo,.gate .gate-card .wa-logo.w31img{display:none !important;}'
    + '.gate .gate-card .w117lock{width:232px;height:auto;display:block;margin:0 auto 16px;color:' + GREEN + ';}'
    + '.gate-card h2{font-family:' + HEAD + ';font-weight:600;font-size:31px;line-height:1.05;text-transform:uppercase;letter-spacing:.4px;color:' + GREEN + ';margin:4px 0 10px;}'
    + '.gate-card h2 .w117e{display:inline-block;height:.7em;width:auto;vertical-align:baseline;margin:0 .04em 0 .02em;color:' + GREEN + ';}'
    + '.gate-card h2 .w117gold{color:' + GOLD + ';}'
    + '.gate-card p{font-family:' + BODY + ';color:' + GROUND + ';}'
    + '.btn-google{border-radius:999px;}'
    + '.gate-foot{font-size:12.5px;}'
    + '@media (max-width:600px){.gate .w117gd{width:22vw;}.gate .w117gd.heart{display:none;}.gate-card{padding:26px 22px 22px;}.gate .gate-card .w117lock{width:190px;}}'

    /* ---------- Ask the Hub: the pill ---------- */
    + '#waChatBtn{background:' + GOLD + ' !important;color:' + GREEN + ' !important;font-family:' + HEAD + ';font-weight:600;font-size:17px;letter-spacing:1px;text-transform:uppercase;box-shadow:0 10px 30px rgba(16,63,57,.25);transition:transform .18s ease,box-shadow .18s ease;}'
    + '#waChatBtn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 16px 36px rgba(16,63,57,.32);}'
    + '#waChatBtn .w75ic{display:none;}'
    + '#waChatBtn .w117ei{display:inline-block;width:30px;height:15px;margin:0 4px 0 0;color:' + GREEN + ';overflow:visible;}'
    + '#waChatBtn .w117ei .bar{transform-box:fill-box;transform-origin:left center;transform:scaleX(.45);transition:transform .35s cubic-bezier(.65,0,.35,1);}'
    + '#waChatBtn .w117ei .bar.b2{transition-delay:.06s;}#waChatBtn .w117ei .bar.b3{transition-delay:.12s;}'
    + '#waChatBtn:hover .w117ei .bar{transform:scaleX(1);}'
    + '#waChatBtn.w75pulse{animation:w75p 2.4s ease-out infinite;}'
    + '#w114bar button.ask i{background:' + GOLD + ' ' + E_URI_GREEN + ' center/58% no-repeat;}'

    /* ---------- Ask the Hub: the drawer ---------- */
    + '#waChatPanel{background:' + CREAM + ';border-left:1px solid rgba(16,63,57,.10);box-shadow:-20px 0 60px rgba(16,63,57,.28);animation:w117slide .45s cubic-bezier(.16,1,.3,1);font-family:' + BODY + ';}'
    + '#waChatPanel::after{content:"";position:absolute;right:-70px;bottom:96px;width:420px;height:120px;background:' + E_URI_GREEN + ' right bottom/contain no-repeat;opacity:.06;pointer-events:none;z-index:0;}'
    + '#waChatPanel .wac-h{position:relative;overflow:hidden;background:' + GREEN + ';color:' + CREAM + ';padding:20px 54px 20px 18px;min-height:100px;display:flex;align-items:center;gap:14px;font-family:' + HEAD + ';font-weight:500;font-size:26px;line-height:1;text-transform:uppercase;letter-spacing:.5px;z-index:1;}'
    + '#waChatPanel .wac-h::before{content:"";position:absolute;right:-90px;top:-100px;width:300px;height:220px;background:url(' + B + 'doodle-blob-purple.png) center/contain no-repeat;opacity:.95;pointer-events:none;}'
    + '#waChatPanel .wac-h .w117mark{flex:0 0 auto;width:42px;height:auto;color:' + CREAM + ';position:relative;z-index:1;}'
    + '#waChatPanel .wac-h .w117tt{position:relative;z-index:1;display:block;}'
    + '#waChatPanel .wac-h small{display:block;font-family:' + BODY + ';font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;color:rgba(255,250,242,.82);margin-top:4px;line-height:1.35;}'
    + '#waChatPanel .wac-h .w117st{position:absolute;right:54px;top:12px;width:34px;height:36px;background:url(' + B + 'doodle-star-gold.png) center/contain no-repeat;animation:w117twinkle 3.2s ease-in-out infinite;pointer-events:none;z-index:1;}'
    + '#waChatPanel .wac-h .w117st.pop{animation:w117pop .6s cubic-bezier(.2,.7,.2,1) 1;}'
    + '#w81close{color:' + CREAM + ' !important;top:16px !important;right:16px !important;z-index:2;font-size:20px;opacity:.9;}'
    + '.wac-msgs{padding:16px 14px 8px;position:relative;z-index:1;}'
    + '.wac-m{animation:w117msg .35s cubic-bezier(.2,.7,.2,1) both;margin:8px 0;font-size:13px;line-height:1.5;}'
    + '.wac-m.bot{display:flex;align-items:flex-start;gap:9px;}'
    + '.wac-m.bot > .w117av{flex:0 0 30px;width:30px;height:30px;border-radius:50%;background:' + GREEN + ';color:' + CREAM + ';display:flex;align-items:center;justify-content:center;margin-top:2px;}'
    + '.wac-m.bot > .w117av svg{width:15px;height:19px;display:block;}'
    + '.wac-m.bot > div{flex:1 1 auto;min-width:0;}'
    + '.wac-m.bot span{background:rgba(16,63,57,.07);color:' + GROUND + ';border-radius:14px 14px 14px 4px;padding:9px 12px;display:inline-block;max-width:100%;white-space:pre-wrap;}'
    + '.wac-m.user span{background:' + GREEN + ';color:' + CREAM + ';border-radius:14px 14px 4px 14px;padding:9px 12px;}'
    + '.wac-src{font-size:11px;color:#797773;margin-top:4px;}'
    + '.wac-m.bot.w117think span{display:inline-flex;align-items:center;gap:10px;color:' + GREEN + ';font-weight:500;}'
    + '.w117load{display:inline-flex;flex-direction:column;justify-content:space-between;width:28px;height:15px;position:relative;padding-left:4px;}'
    + '.w117load::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:' + GREEN + ';border-radius:2px;}'
    + '.w117load b{display:block;height:3px;background:' + GREEN + ';border-radius:2px;transform-origin:left center;animation:w117bar 1.3s cubic-bezier(.65,0,.35,1) infinite;}'
    + '.w117load b:nth-child(2){animation-delay:.14s;}.w117load b:nth-child(3){animation-delay:.28s;}'
    + '.w81chips{padding:6px 14px 12px;position:relative;z-index:1;}'
    + '.w81chips .w81h{font-family:' + BODY + ';font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:' + PURPLE + ';font-weight:700;}'
    + '.w81chip{background:' + CREAM + ';border:1px solid rgba(16,63,57,.12);border-left:3px solid ' + GOLD + ';border-radius:12px;padding:10px 12px;font-family:' + BODY + ';font-size:13px;color:' + GREEN + ';}'
    + '.w81chip:hover{transform:translateX(3px);box-shadow:0 6px 16px rgba(16,63,57,.12);background:' + CREAM + ';}'
    + '#waChatPanel .wac-in{border-top:1px solid rgba(16,63,57,.10);padding:12px 14px 14px;background:' + CREAM + ';position:relative;z-index:1;align-items:center;}'
    + '#waChatPanel .wac-in input{border-radius:999px;border:1px solid rgba(16,63,57,.18);padding:11px 16px;font-family:' + BODY + ';font-size:13.5px;background:#F4F2EA;color:' + GROUND + ';}'
    + '#waChatPanel .wac-in input:focus{outline:2px solid rgba(220,165,39,.75);background:' + CREAM + ';}'
    + '#waChatPanel .wac-in button{background:' + GOLD + ';color:' + GREEN + ';border-radius:999px;width:42px;height:42px;padding:0;font-size:17px;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s ease;flex:0 0 auto;}'
    + '#waChatPanel .wac-in button:hover{transform:scale(1.08);}'
    + '.wac-card{border-left-color:' + GOLD + ';border-color:rgba(16,63,57,.12);border-radius:14px;font-family:' + BODY + ';animation:w117msg .35s cubic-bezier(.2,.7,.2,1) both;}'
    + '.wac-card .go{background:' + GOLD + ';color:' + GREEN + ';}'
    + '#w75nudge{background:' + GREEN + ';color:' + CREAM + ';border-radius:16px;font-family:' + BODY + ';}'
    + '#w75nudge:after{background:' + GREEN + ';}'
    + '#w75nudge .go{background:' + GOLD + ';color:' + GREEN + ';}'

    + '@media (prefers-reduced-motion:reduce){.panel.active,#waChatPanel,.wac-m,.wac-card,.gate-card,.gate .w117gd{animation:none !important;opacity:1;}'
    + '#waChatPanel .wac-h .w117st,.w117load b{animation:none !important;}#waChatBtn .w117ei .bar{transform:none;}}';

  var host = document.getElementById('wa97css');
  if (host) host.textContent += '\n/* wa117 */\n' + css;
  else { var style = document.createElement('style'); style.id = 'wa117css'; style.textContent = css; document.head.appendChild(style); }

  /* ---------- 2. sidebar wordmark ---------- */
  function sidebar() {
    var a = document.querySelector('nav.wa-nav .w114brand');
    if (!a || a.querySelector('.w117logo')) return;
    a.insertAdjacentHTML('afterbegin', svgLockup('w117logo'));
  }

  /* ---------- 3. the gate ---------- */
  function gate() {
    var g = document.getElementById('gate');
    if (!g) return;
    if (!g.querySelector('.w117gd')) {
      g.insertAdjacentHTML('afterbegin', '<img class="w117gd star" src="' + B + 'doodle-star-gold.png" alt=""><img class="w117gd flow" src="' + B + 'doodle-flowers-gold.png" alt=""><img class="w117gd heart" src="' + B + 'doodle-heart-purple.png" alt="">');
    }
    var card = g.querySelector('.gate-card');
    if (card && !card.querySelector('.w117lock')) card.insertAdjacentHTML('afterbegin', svgLockup('w117lock'));
    var h2 = card && card.querySelector('h2');
    if (h2 && h2.getAttribute('data-w117') !== '1') {
      h2.setAttribute('data-w117', '1');
      h2.innerHTML = 'Together we mov' + svgE('w117e') + ' <span class="w117gold">forward</span>';
    }
  }

  /* ---------- 4. Ask the Hub ---------- */
  function pill() {
    var btn = document.getElementById('waChatBtn');
    if (!btn || btn.querySelector('.w117ei')) return;
    if (!btn.querySelector('.w75ic')) return;   /* wave75 has not decorated yet; try again later */
    btn.insertAdjacentHTML('afterbegin', svgEBars('w117ei'));
  }
  function header() {
    var panel = document.getElementById('waChatPanel');
    var h = panel && panel.querySelector('.wac-h');
    if (!h || h.querySelector('.w117tt')) return;
    var small = h.querySelector('small');
    var subtitle = small ? small.textContent : '';
    var close = h.querySelector('#w81close');
    h.innerHTML = '';
    h.insertAdjacentHTML('afterbegin', svgSecondary('w117mark') + '<span class="w117tt">Ask the Hub<small></small></span><i class="w117st"></i>');
    h.querySelector('small').textContent = subtitle || 'Ask anything, put in requests, add tasks. You confirm before anything is saved.';
    if (close) h.appendChild(close);
  }
  function decorateMsg(d) {
    if (!d || !d.classList || !d.classList.contains('wac-m') || !d.classList.contains('bot')) return;
    if (!d.querySelector(':scope > .w117av')) {
      var wrap = document.createElement('div');
      while (d.firstChild) wrap.appendChild(d.firstChild);
      d.appendChild(wrap);
      d.insertAdjacentHTML('afterbegin', '<i class="w117av">' + svgSecondary('') + '</i>');
    }
    var span = d.querySelector('span');
    if (span && /^Thinking\.\.\.$/.test(span.textContent || '') && !d.classList.contains('w117think')) {
      d.classList.add('w117think');
      span.innerHTML = '<i class="w117load"><b></b><b></b><b></b></i>Thinking';
    } else if (!d.classList.contains('w117think')) {
      var st = document.querySelector('#waChatPanel .wac-h .w117st');
      if (st && d.getAttribute('data-w117pop') !== '1') {
        d.setAttribute('data-w117pop', '1');
        st.classList.remove('pop'); void st.offsetWidth; st.classList.add('pop');
      }
    }
  }
  var observed = false;
  function thread() {
    var m = document.getElementById('wacMsgs');
    if (!m) return;
    m.querySelectorAll('.wac-m.bot').forEach(decorateMsg);
    if (observed || typeof MutationObserver === 'undefined') return;
    observed = true;
    new MutationObserver(function (recs) {
      recs.forEach(function (r) { r.addedNodes.forEach(function (n) { try { decorateMsg(n); } catch (e) { /* fine */ } }); });
    }).observe(m, { childList: true });
  }
  function chat() { pill(); header(); thread(); }

  /* ---------- wiring ---------- */
  function all() { try { sidebar(); } catch (e) { /* fine */ } try { gate(); } catch (e) { /* fine */ } try { chat(); } catch (e) { /* fine */ } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
  if (typeof startApp === 'function') {
    var __sa117 = startApp;
    startApp = async function () {
      var r = await __sa117.apply(this, arguments);
      all();
      setTimeout(all, 1200);
      setTimeout(all, 4000);
      return r;
    };
  }
  if (typeof showPanel === 'function') {
    var __sp117 = showPanel;
    showPanel = function () { var out = __sp117.apply(this, arguments); try { chat(); } catch (e) { /* fine */ } return out; };
  }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#waChatBtn, [data-w114ask], [data-w75go], [data-w75q]')) setTimeout(chat, 60);
  });
})();
"""

def build_segment():
    seg = SEG
    reps = {
        '__BUCKET__': BUCKET, '__HEAD__': HEAD, '__BODY__': BODY,
        '__PRIMARY_D__': P['primary_d'], '__TAG_MAIN__': P['tag_main_d'], '__TAG_GOLD__': P['tag_gold_d'],
        '__SECONDARY_D__': P['secondary_d'], '__E_SMALL_D__': E_SMALL_D,
        '__VB_PRIMARY__': ' '.join(str(v) for v in P['viewBox_primary']),
        '__VB_LOCKUP__': ' '.join(str(v) for v in P['viewBox_lockup']),
        '__VB_SECONDARY__': ' '.join(str(v) for v in P['viewBox_secondary']),
    }
    for k, v in reps.items():
        assert k in seg, k
        seg = seg.replace(k, v)
    seg = seg.replace("E_URI_CREAM", "'" + E_URI_CREAM + "'").replace("E_URI_GREEN", "'" + E_URI_GREEN + "'")
    assert '__' not in re.sub(r'__wa117|__sa117|__sp117', '', seg), 'unreplaced placeholder'
    open(os.path.join(HERE, 'src', '117_wave117.seg'), 'w', encoding='utf-8').write(seg)
    return len(seg)

def manifest():
    p = os.path.join(HERE, 'src', 'MANIFEST.txt')
    lines = [l.strip() for l in open(p) if l.strip()]
    if '117_wave117' not in lines:
        i = lines.index('110_wave110')
        lines.insert(i, '117_wave117')
        open(p, 'w').write('\n'.join(lines) + '\n')
    return lines

if __name__ == '__main__':
    print('base bytes', patch_base())
    print('segment bytes', build_segment())
    print('manifest', manifest()[-4:])
