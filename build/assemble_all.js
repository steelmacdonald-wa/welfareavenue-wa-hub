/* assemble_all.js [out]: the same assembly as build.sh, for Windows where a shell loop over 300 files is slow.
   Reads the segments in MANIFEST order, byte for byte, and ends the file with one newline. */
const fs = require('fs'), path = require('path');
const here = __dirname, out = process.argv[2] || path.join(here, 'candidate.html');
const names = fs.readFileSync(path.join(here, 'src/MANIFEST.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && s[0] !== '#');
const buf = Buffer.concat(names.map(n => fs.readFileSync(path.join(here, 'src', n + '.seg'))));
let end = buf.length; while (end > 0 && buf[end - 1] === 10) end--;
fs.writeFileSync(out, Buffer.concat([buf.subarray(0, end), Buffer.from('\n')]));
console.log(names.length, 'segments', end + 1, 'bytes', require('crypto').createHash('md5').update(fs.readFileSync(out)).digest('hex'));
