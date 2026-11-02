/* w272film.js: stills of the how-to films at their steps. Writes a contact sheet page for each film to WA_SHOTS. */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const src = fs.readFileSync(path.join(__dirname, '../build/parts272/e_howto.js'), 'utf8');
const html = `<!doctype html><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel=stylesheet><body style="margin:0;background:#FFFAF2"><div id=h style="width:330px;padding:10px"></div><script>(function(){var HEAD="'Barlow Condensed',sans-serif",BODY="'Space Grotesk',sans-serif";function E(s){return String(s)}${src};window.F=window.w272howto(document.getElementById('h'),location.hash.slice(1));window.F.stop();})();<\/script>`;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WA_CHROME });
  const out = process.env.WA_SHOTS;
  const TIMES = { iphone: [0.5, 3.9, 4.6, 6.3, 8.4, 11, 13.2, 13.7, 15], android: [0.5, 4, 4.7, 7.2, 8.8, 9.4, 9.8, 11] };
  for (const k of Object.keys(TIMES)) {
    const p = await b.newPage({ viewport: { width: 350, height: 640 } });
    await p.goto('data:text/html;base64,' + Buffer.from(html).toString('base64') + '#' + k);
    await p.evaluate(k2 => {}, k).catch(() => {});
    await p.waitForTimeout(600);
    const shots = [];
    for (const t of TIMES[k]) {
      await p.evaluate(x => window.F.seek(x), t);
      shots.push((await p.screenshot({ clip: { x: 0, y: 0, width: 350, height: 530 } })).toString('base64'));
    }
    const sheet = await b.newPage({ viewport: { width: 1500, height: 1090 } });
    await sheet.setContent('<body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(5,1fr);gap:4px">' + shots.map(s => '<img style="width:100%" src="data:image/png;base64,' + s + '">').join(''));
    await sheet.waitForTimeout(300);
    await sheet.screenshot({ path: path.join(out, 'film_' + k + '.png') });
    await sheet.close(); await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
