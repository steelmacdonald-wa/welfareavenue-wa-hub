/* w204gif.js: wave204's GIF encoder (build/parts202/m_gif.js) run alone in node. Writes test GIFs and the source frames
   (raw RGBA) to OUT, then test/w204gif_check.py decodes them with Pillow and compares every frame with its source. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const OUT = process.env.OUT || '/tmp/w204gif';
fs.mkdirSync(OUT, { recursive: true });
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../build/parts202/m_gif.js'), 'utf8') + '\nthis.GIF204 = GIF204;', ctx);
const G = ctx.GIF204;
function frames(w, h, n, kind) {
  const out = [];
  for (let f = 0; f < n; f++) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      let r, g, b;
      if (kind === 'flat') { r = 16; g = 63; b = 57; }
      else if (kind === 'noise') { r = (x * 7 + y * 13 + f * 31) % 256; g = (x * x + y * 3 + f * 17) % 256; b = (x * y + f * 11) % 256; }
      else { r = Math.round(255 * x / w); g = Math.round(255 * y / h); b = 140; }
      if (kind === 'scene') { const sx = 10 + f * 6, sy = 20 + f * 2; if (x >= sx && x < sx + 40 && y >= sy && y < sy + 30) { r = 220; g = 165; b = 39; } }
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
    }
    out.push(d);
  }
  return out;
}
(async () => {
  const cases = [['scene', 200, 120, 12, 10], ['flat', 64, 48, 5, 12], ['noise', 528, 297, 6, 10], ['scene', 528, 297, 30, 10]];
  const meta = [];
  for (const [kind, w, h, n, delay] of cases) {
    const fr = frames(w, h, n, kind);
    const t0 = Date.now();
    let prog = 0;
    const gif = await G.encode(fr, w, h, delay, { onProg: p => { prog = p; } });
    const name = kind + '_' + w + 'x' + h + '_' + n;
    fs.writeFileSync(path.join(OUT, name + '.gif'), Buffer.from(gif));
    fs.writeFileSync(path.join(OUT, name + '.rgba'), Buffer.concat(fr.map(a => Buffer.from(a.buffer))));
    meta.push({ name, w, h, n, delay, bytes: gif.length, ms: Date.now() - t0, prog });
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta));
})().catch(e => { console.error(e); process.exit(2); });
