// wave162: serve build/www/out to Playwright at https://welfareavenue.test/ the way Netlify will: pretty URLs
// (/about/ -> about/index.html), _redirects (301s), _headers (the CSP and friends on every response) and 404.html.
// Everything else (Google Fonts, Supabase, YouTube thumbnails, the Hub) goes out through the agent proxy.
const fs = require('fs'), path = require('path');
const OUT = process.env.WWW_OUT || path.join(__dirname, '..', 'build', 'www', 'out');
const ORIGIN = 'https://welfareavenue.test';
function parseHeaders() {
  const txt = fs.readFileSync(path.join(OUT, '_headers'), 'utf8'), rules = []; let cur = null;
  txt.split('\n').forEach(l => { if (!l.trim() || l.trim().startsWith('#')) return; if (!/^\s/.test(l)) { cur = { pat: l.trim(), h: {} }; rules.push(cur); } else { const i = l.indexOf(':'); cur.h[l.slice(0, i).trim()] = l.slice(i + 1).trim(); } });
  return rules;
}
function parseRedirects() {
  return fs.readFileSync(path.join(OUT, '_redirects'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => { const [from, to, code] = l.trim().split(/\s+/); return { from, to, code: +code }; });
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };
function match(pat, p) { if (pat.endsWith('/*')) return p.startsWith(pat.slice(0, -1)) || p === pat.slice(0, -2); return p === pat; }
async function attach(context, opts = {}) {
  const rules = parseHeaders(), redirects = parseRedirects();
  await context.route(ORIGIN + '/**', async route => {
    const u = new URL(route.request().url()); let p = decodeURIComponent(u.pathname);
    const r = redirects.find(r => match(r.from, p) || match(r.from, p.replace(/\/$/, '')));
    if (r) return route.fulfill({ status: r.code, headers: { location: r.to.startsWith('http') ? r.to : ORIGIN + r.to } });
    let file = path.join(OUT, p);
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) return route.fulfill({ status: 301, headers: { location: ORIGIN + p + '/' + u.search } });
    let status = 200;
    if (!fs.existsSync(file) || p.split('/').some(s => s.startsWith('_'))) { file = path.join(OUT, '404.html'); status = 404; }
    const headers = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' };
    rules.forEach(rule => { if (match(rule.pat, p) || rule.pat === '/*') Object.assign(headers, Object.fromEntries(Object.entries(rule.h).map(([k, v]) => [k.toLowerCase(), v]))); });
    if (opts.noCsp) delete headers['content-security-policy'];
    return route.fulfill({ status, headers, body: fs.readFileSync(file) });
  });
}
module.exports = { attach, ORIGIN, OUT };
