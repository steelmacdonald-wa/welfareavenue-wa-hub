const { chromium } = require('playwright');
const fs = require('fs');
/* wave219: the Hub app icons, drawn from the brand's secondary mark (WEL / FAR / E, wave117's SECONDARY_D) and the E bars.
   Run from build/site/icons: NODE_PATH=<global node_modules> node render_icons.js <a built Hub html>
   Writes hub-192.png and hub-512.png (rounded, for browsers and Android), hub-maskable-512.png (full bleed, the mark inside the
   safe zone), apple-touch-180.png (full bleed; iOS rounds it) and hub-badge-96.png (white E bars on transparent, Android's bar). */
const HTML = fs.readFileSync(process.argv[2] || '../../candidate.html', 'utf8');
function pathVar(name) { const i = HTML.indexOf("var " + name + " = '"); if (i < 0) throw new Error(name + ' not found'); const a = i + name.length + 8; return HTML.slice(a, HTML.indexOf("'", a)); }
const P = { SECONDARY_D: pathVar('SECONDARY_D') };
const GREEN = '#103F39', CREAM = '#FFFAF2';
const VB = '-6.05 0.0 276.98 345.1';   // the secondary mark (WEL / FAR / E)
function markSvg(color) { return '<svg viewBox="' + VB + '" xmlns="http://www.w3.org/2000/svg" style="display:block;height:100%;width:auto"><path fill="' + color + '" fill-rule="evenodd" d="' + P.SECONDARY_D + '"/></svg>'; }
function ebars(color) { return '<svg viewBox="0 0 676 344" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto"><rect x="0" y="0" width="69" height="344" fill="' + color + '"/><rect x="68" y="0" width="608" height="59" fill="' + color + '"/><rect x="68" y="142" width="608" height="59" fill="' + color + '"/><rect x="68" y="285" width="608" height="59" fill="' + color + '"/></svg>'; }
const jobs = [
  // name, size, radius (fraction), mark height (fraction), background
  { name: 'hub-192.png', size: 192, r: 0.22, h: 0.56, bg: GREEN },
  { name: 'hub-512.png', size: 512, r: 0.22, h: 0.56, bg: GREEN },
  { name: 'hub-maskable-512.png', size: 512, r: 0, h: 0.44, bg: GREEN },
  { name: 'apple-touch-180.png', size: 180, r: 0, h: 0.56, bg: GREEN },
  { name: 'hub-badge-96.png', size: 96, badge: true }
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const j of jobs) {
    const p = await b.newPage({ viewport: { width: j.size, height: j.size }, deviceScaleFactor: 1 });
    let inner;
    if (j.badge) inner = '<div style="width:' + Math.round(j.size * 0.8) + 'px">' + ebars('#FFFFFF') + '</div>';
    else inner = '<div style="height:' + Math.round(j.size * j.h) + 'px">' + markSvg(CREAM) + '</div>';
    const html = '<html><body style="margin:0;background:transparent"><div style="width:' + j.size + 'px;height:' + j.size + 'px;border-radius:' + Math.round(j.size * (j.r || 0)) + 'px;background:' + (j.bg || 'transparent') + ';display:flex;align-items:center;justify-content:center">' + inner + '</div></body></html>';
    await p.setContent(html);
    await p.screenshot({ path: j.name, omitBackground: true });
    await p.close();
  }
  await b.close();
})();
