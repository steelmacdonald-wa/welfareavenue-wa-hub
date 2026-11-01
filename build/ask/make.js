// Node port of build_ask.py (S2, 26/10/26; no Python on this machine). Same steps, same output:
// builds ask/index.html from ask_src.html with the brand kit's logo paths (paths.json), ASCII only.
// Text-mode reads in Python turn \r\n into \n, so this does too; the md5 printed is of the page as stored in site_files.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const here = __dirname;
const paths = JSON.parse(fs.readFileSync(process.argv[2] || path.join(here, 'paths.json'), 'utf8'));
let src = fs.readFileSync(path.join(here, 'ask_src.html'), 'utf8').replace(/\r\n?/g, '\n');
for (const k of ['E', 'MARK', 'WORD']) {
  src = src.split('__' + k + '_VB__').join(paths[k].vb).split('__' + k + '_D__').join(paths[k].d);
}
// ASCII only: non-ASCII in the script becomes \uXXXX, elsewhere an HTML entity
const a = src.indexOf('<script>'), b = src.lastIndexOf('</script>');
if (a < 0 || b < 0) throw new Error('script tags not found');
const jsesc = t => Array.from(t).map(ch => ch.codePointAt(0) < 128 ? ch : '\\u' + ch.codePointAt(0).toString(16).padStart(4, '0')).join('');
const htesc = t => Array.from(t).map(ch => ch.codePointAt(0) < 128 ? ch : '&#' + ch.codePointAt(0) + ';').join('');
src = htesc(src.slice(0, a)) + jsesc(src.slice(a, b)) + htesc(src.slice(b));
if (src.includes('__E_') || src.includes('__MARK') || src.includes('__WORD')) throw new Error('placeholder left');
fs.mkdirSync(path.join(here, 'ask'), { recursive: true });
fs.writeFileSync(path.join(here, 'ask', 'index.html'), src, 'utf8');
const bad = Array.from(src).filter(c => c.codePointAt(0) > 127).length;
console.log('ask/index.html', Buffer.byteLength(src, 'utf8'), 'bytes, md5', crypto.createHash('md5').update(src, 'utf8').digest('hex'), 'non-ascii', bad);
