// Rebuilds paths.json from the brand kit SVGs in content-images/brand (the pasted copy was cut off).
// Usage: node make_paths.js <MARK file> <WORD file>   (E is always e-small.svg)
const fs = require('fs'), path = require('path');
const base = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/';
(async () => {
  const one = async f => {
    const t = await (await fetch(base + f)).text();
    const ds = [...t.matchAll(/\sd="([^"]+)"/g)];
    if (ds.length !== 1) throw new Error(f + ': expected one path, got ' + ds.length);
    return { vb: t.match(/viewBox="([^"]+)"/)[1], d: ds[0][1] };
  };
  const out = { E: await one('e-small.svg'), MARK: await one(process.argv[2]), WORD: await one(process.argv[3]) };
  fs.writeFileSync(path.join(__dirname, 'paths.json'), JSON.stringify(out));
  console.log('paths.json: MARK', process.argv[2], 'WORD', process.argv[3]);
})();
