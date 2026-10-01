const { launch, fresh } = require('./boot');
const fx = require('./w191fx');
(async () => {
  const browser = await launch();
  const f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', width: 1440, fixture: fx(), rpcs: { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0, unticked: 0 } }, wait: 6000 });
  const out = await f.ev(() => {
    function line(el, d) { const t = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 50); return '  '.repeat(d) + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + ' [' + el.children.length + '] ' + t; }
    function walk(el, d, max, acc) { acc.push(line(el, d)); if (d >= max) return; Array.prototype.forEach.call(el.children, c => walk(c, d + 1, max, acc)); }
    const acc = []; const root = document.getElementById('w119'); if (!root) return 'no #w119';
    walk(root, 0, 3, acc);
    const card = document.querySelector('#volunteering > .card'); acc.push('--- card children:'); Array.prototype.forEach.call(card.children, c => acc.push(line(c, 1)));
    acc.push('--- mast:'); const m = document.querySelector('#volunteering .w118mast'); if (m) walk(m, 0, 2, acc);
    return acc.join('\n');
  });
  console.log(out); console.log('errors', f.errs);
  await f.close(); await browser.close();
})();
