const { launch, fresh } = require('./boot');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await launch();
  const f = await fresh(browser, { who: 'board', width: 1366, hash: '#mypage', init: `(function(){var d=Object.getOwnPropertyDescriptor(Location.prototype,'hash'); window.__hs=[]; window.addEventListener('hashchange',function(){window.__hs.push(location.hash+' @'+Math.round(performance.now()));});})();` });
  await wait(4000);
  console.log(JSON.stringify(await f.ev(() => {
    const t = document.querySelector('#tabBar .tab[data-tab="mypage"]');
    const out = { hs: window.__hs, hash: location.hash, allowed: wa40Allowed().join(','), tab: t ? { html: t.outerHTML.slice(0, 200), disp: getComputedStyle(t).display, parent: t.parentNode.id || t.parentNode.className, w: t.getBoundingClientRect().width } : null };
    location.hash = '#mypage'; return out;
  })));
  await wait(1000);
  console.log(JSON.stringify(await f.ev(() => ({ hash: location.hash, active: document.getElementById('mypage').classList.contains('active'), hs: window.__hs.slice(-3) }))));
  await f.close(); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
